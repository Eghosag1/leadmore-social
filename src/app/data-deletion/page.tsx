import Link from "next/link";

export const metadata = {
  title: "Gegevensverwijdering — Leadmore Social",
};

/**
 * Public, unauthenticated page — this exact URL is what Meta's App Dashboard
 * "Data Deletion Instructions URL" field points to (a required field before
 * App Review permissions can be requested). Meta reviews the content itself,
 * not just that the URL resolves.
 */
export default function DataDeletionPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-16">
      <div>
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          ← Leadmore Social
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-neutral-900">Gegevensverwijdering</h1>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-neutral-900">De Facebook/Instagram-koppeling zelf intrekken</h2>
        <p>
          Wil je enkel de toegang die je aan Leadmore Social gaf via Facebook of Instagram intrekken, zonder je
          hele Leadmore-account te verwijderen? Dat kan rechtstreeks bij Meta, zonder tussenkomst van ons:
        </p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            Ga naar Facebook →{" "}
            <a
              href="https://www.facebook.com/settings?tab=business_tools"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Instellingen → Bedrijfstools
            </a>{" "}
            (of Instagram → Instellingen → Apps en websites).
          </li>
          <li>Zoek &quot;Leadmore Social&quot; in de lijst van gekoppelde apps.</li>
          <li>Kies &quot;Verwijderen&quot; / &quot;Toegang intrekken&quot;.</li>
        </ol>
        <p>
          Vanaf dat moment kan Leadmore Social niets meer publiceren op je Pagina of Instagram-account. We krijgen
          hier geen automatische melding van, dus laat het ons ook even weten (zie hieronder) zodat we de
          gekoppelde gegevens aan onze kant kunnen opschonen.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-neutral-900">Al je gegevens laten verwijderen</h2>
        <p>
          Voor een volledig verzoek — verwijdering van je kantooraccount en alle bijhorende gegevens (panden,
          templates, posts, gebruikersaccounts, en de versleutelde Facebook/Instagram-toegangstokens) — mail naar{" "}
          <a href="mailto:privacy@leadmore.be" className="underline">privacy@leadmore.be</a> vanaf het e-mailadres
          dat aan je account gekoppeld is, met de naam van het kantoor.
        </p>
        <p>We bevestigen het verzoek en voeren de verwijdering binnen 30 dagen door.</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-neutral-900">Meer informatie</h2>
        <p>
          Zie onze <Link href="/privacy" className="underline">privacyverklaring</Link> voor een volledig overzicht
          van welke gegevens we verwerken en waarom.
        </p>
      </section>
    </div>
  );
}
