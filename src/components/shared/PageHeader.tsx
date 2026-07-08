import type { ReactNode } from "react";
import { BackButton } from "./BackButton";

export function PageHeader({
  title,
  description,
  actions,
  backHref,
  backLabel,
  backReturnTo,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** When set, shows a small back link above the title instead of relying on the browser back button. Acts as the fallback target when backReturnTo isn't set. */
  backHref?: string;
  backLabel?: string;
  /** Preferred back target (e.g. a `?returnTo=` search param) — wins over backHref when present. */
  backReturnTo?: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        {backHref && <BackButton fallbackHref={backHref} returnTo={backReturnTo} label={backLabel} />}
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
