/**
 * Translates a raw failure reason (Meta Graph API JSON/English messages,
 * infra-specific strings like a QStash error, ...) into a short, actionable
 * Dutch message for agency users — the raw text stays exactly as-is in the
 * database and on /admin/errors (super_admin only), this only changes what
 * agency-facing surfaces display. Order matters: first matching pattern
 * wins, so more specific/actionable patterns are listed before generic
 * catch-alls. Anything not matched falls back to one generic message rather
 * than risk leaking another raw/technical string we haven't seen yet.
 */
interface ErrorPattern {
  test: RegExp;
  message: string;
}

const KNOWN_PATTERNS: ErrorPattern[] = [
  {
    test: /geen actief(e)? (facebook|instagram)|token kon niet gelezen worden|koppel opnieuw|niet gekoppeld aan (dit kantoor|een facebook-pagina)/i,
    message: "De Facebook/Instagram-koppeling van uw kantoor werkt niet (meer). Neem contact op met de platformbeheerder.",
  },
  {
    test: /rate limit|limit reached|too many requests/i,
    message: "Meta heeft tijdelijk te veel aanvragen geweigerd. Probeer het over enkele minuten opnieuw.",
  },
  {
    test: /media id is not available|\(#9004\)|kon de afbeelding niet verwerken|nog aan het verwerken/i,
    message: "Instagram kon de foto('s) niet verwerken. Probeer het opnieuw.",
  },
  {
    test: /geen foto om te posten/i,
    message: "Er ontbreekt een foto voor deze post. Neem contact op met de platformbeheerder.",
  },
];

const GENERIC_FALLBACK = "Er ging iets mis. Probeer opnieuw of neem contact op met de platformbeheerder.";

export function friendlyErrorMessage(rawError: string | null | undefined): string {
  if (!rawError) return GENERIC_FALLBACK;
  return KNOWN_PATTERNS.find((pattern) => pattern.test.test(rawError))?.message ?? GENERIC_FALLBACK;
}
