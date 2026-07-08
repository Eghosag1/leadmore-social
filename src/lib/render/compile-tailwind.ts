import "server-only";
import { createHash } from "crypto";
import postcss from "postcss";
import tailwindPostcss from "@tailwindcss/postcss";

/**
 * Extracts candidate Tailwind classNames from a template's raw TSX source
 * (regex-based, not a full parser — covers static `className="..."` strings
 * and every quoted string literal inside `className={...}` expressions,
 * which covers the array-join / template-literal patterns the starter
 * templates use, e.g. `className={["...", className].filter(Boolean).join(" ")}`).
 * Static classNames are the primary target; more exotic dynamic expressions
 * (fully computed class strings with no literal substrings) aren't covered.
 */
export function extractClassNames(source: string): string[] {
  const groups = new Set<string>();

  const staticAttrRegex = /className\s*=\s*["']([^"']*)["']/g;
  let m: RegExpExecArray | null;
  while ((m = staticAttrRegex.exec(source))) {
    groups.add(m[1]);
  }

  // className={...} — a simple one-level-of-nesting brace match is enough for
  // our patterns; grab every quoted string literal inside it.
  const dynamicAttrRegex = /className\s*=\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
  const quotedStringRegex = /["'`]([^"'`]+)["'`]/g;
  while ((m = dynamicAttrRegex.exec(source))) {
    const expr = m[1];
    let qm: RegExpExecArray | null;
    while ((qm = quotedStringRegex.exec(expr))) {
      groups.add(qm[1]);
    }
  }

  const individual = new Set<string>();
  for (const group of groups) {
    for (const cls of group.split(/\s+/)) {
      if (cls) individual.add(cls);
    }
  }
  return Array.from(individual);
}

/**
 * Compiles real Tailwind CSS for exactly the classNames a database-stored
 * template uses, via Tailwind v4's `@source inline(...)` — the mechanism
 * built specifically for content Tailwind's build-time file scan can never
 * see (which is exactly our situation: admin templates are TSX strings in
 * Postgres, not files in the repo). Deterministic, no CDN, no DOM scanning.
 */
export async function compileTailwindForClassNames(classNames: string[]): Promise<string> {
  if (classNames.length === 0) return "";
  const input = `@import "tailwindcss";\n@source inline("${classNames.join(" ")}");\n`;
  const result = await postcss([tailwindPostcss()]).process(input, { from: undefined });
  return result.css;
}

// In-memory only — cold starts get an empty cache, but repeated renders of
// the same template within one warm serverless instance skip recompiling.
// Keyed by a hash of the source so an edited template can't serve stale CSS.
const cssCache = new Map<string, string>();

export async function getCompiledCssForTemplate(source: string): Promise<string> {
  const hash = createHash("sha256").update(source).digest("hex");
  const cached = cssCache.get(hash);
  if (cached !== undefined) return cached;

  const css = await compileTailwindForClassNames(extractClassNames(source));
  cssCache.set(hash, css);
  return css;
}
