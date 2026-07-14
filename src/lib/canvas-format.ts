// Shared between the client (CreatePostForm's live measurement/preview) and
// the server action (re-clamping before persisting) — client-safe, no
// "server-only", same reasoning as template-render.ts.

export const CANVAS_WIDTH = 1080;
// Today's fixed default (4:5).
export const CANVAS_MAX_HEIGHT = 1350;
// Instagram's Content Publishing API only accepts photos with a width/height
// ratio between 0.8 (4:5) and 1.91 (landscape) — at a fixed 1080px width
// that's a height range of 1350 down to ~565px. Anything computed outside
// this range must be clamped, or a real "origineel formaat" post could pass
// every local check yet still fail Meta's actual publish call.
export const CANVAS_MIN_HEIGHT = 565;

/** Client-side: derive + clamp a canvas height from a photo's measured natural size (e.g. an <Image> onLoad handler). */
export function computeClampedCanvasHeight(naturalWidth: number, naturalHeight: number): number {
  if (!naturalWidth || !naturalHeight || !Number.isFinite(naturalWidth) || !Number.isFinite(naturalHeight)) {
    return CANVAS_MAX_HEIGHT;
  }
  const raw = Math.round((CANVAS_WIDTH * naturalHeight) / naturalWidth);
  return clampCanvasHeight(raw);
}

/**
 * Server-side: re-clamp a client-submitted height into the safe range.
 * This is a range check, not a re-measurement — the server can't verify the
 * submitted number actually matches the photo without fetching/decoding the
 * image binary (no such dependency exists in this codebase). It guarantees
 * the persisted value can never break Puppeteer's viewport or Meta's publish
 * call, but a buggy/malicious client could still submit an in-range height
 * that doesn't match the real photo.
 */
export function clampCanvasHeight(height: number): number {
  if (!Number.isFinite(height)) return CANVAS_MAX_HEIGHT;
  return Math.min(CANVAS_MAX_HEIGHT, Math.max(CANVAS_MIN_HEIGHT, Math.round(height)));
}
