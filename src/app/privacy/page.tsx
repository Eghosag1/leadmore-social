import Link from "next/link";

export const metadata = {
  title: "Privacyverklaring — Leadmore Social",
};

/**
 * Public, unauthenticated page — required as a live URL for Meta App Review
 * (Basic Settings' "Privacy Policy URL" + the content itself is reviewed).
 * TODO before relying on this for a real submission: fill in the bracketed
 * placeholders (legal entity name, ondernemingsnummer, address, contact
 * email) with Leadmore's real details, and have someone qualified review the
 * legal content — this is a first draft, not legal advice.
 */
export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-16">
      <div>
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          ← Leadmore Social
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-neutral-900">Privacyverklaring</h1>
        <p className="mt-2 text-sm text-muted-foreground">Laatst bijgewerkt: 14 juli 2026</p>
      </div>

      <section className="flex flex-col gap-3">
        <p>
          Leadmore Social (&quot;Leadmore&quot;, &quot;wij&quot;) biedt een platform waarmee vastgoedkantoren
          social-media-posts kunnen opmaken en inplannen op basis van hun eigen pandaanbod. Deze verklaring legt
          uit welke persoonsgegevens we verwerken, waarom, en welke rechten je hebt.
        </p>
        <p className="rounded-md border border-dashed border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          [In te vullen: officiële bedrijfsnaam en rechtsvorm, ondernemingsnummer, maatschappelijke zetel]
          <br />
          Contact: <a href="mailto:privacy@leadmore.be" className="underline">privacy@leadmore.be</a> [te
          bevestigen/aan te maken]
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-neutral-900">Welke gegevens verwerken we</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Accountgegevens</strong> — e-mailadres en naam van wie bij een vastgoedkantoor of bij Leadmore
            met een account inlogt.
          </li>
          <li>
            <strong>Kantoorgegevens</strong> — naam, logo, huisstijlkleuren, een eventueel geüpload huisstijlfont,
            en websiteadres van het vastgoedkantoor.
          </li>
          <li>
            <strong>Pandgegevens</strong> — titel, beschrijving, prijs, locatie, kenmerken en foto&apos;s van
            panden, gesynchroniseerd vanuit het CRM-systeem van het vastgoedkantoor.
          </li>
          <li>
            <strong>Facebook- en Instagram-koppelingsgegevens</strong> — het Facebook-Pagina-ID, het gekoppelde
            Instagram-bedrijfsaccount-ID, en een versleuteld toegangstoken. Dit token wordt uitsluitend gebruikt om,
            in naam van en op uitdrukkelijk verzoek van het vastgoedkantoor, posts te plannen en te publiceren op
            hún eigen Facebook-Pagina en Instagram-account. We gebruiken deze toegang nooit voor iets anders (geen
            advertenties, geen doorverkoop, geen posts zonder een expliciete actie van het kantoor).
          </li>
          <li>
            <strong>Postgegevens</strong> — bijschriften, gekozen afbeeldingen, planningsdatum/-uur en
            publicatiestatus van de posts die een kantoor aanmaakt.
          </li>
          <li>
            <strong>Technische gegevens</strong> — standaard serverlogs (IP-adres, tijdstip) voor beveiliging en
            foutopsporing.
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-neutral-900">Waarom we deze gegevens verwerken</h2>
        <p>
          De verwerking gebeurt om de overeenkomst met het vastgoedkantoor uit te voeren: hun panden omzetten naar
          een social-media-post in hun eigen huisstijl, en die post — enkel na hun expliciete goedkeuring en
          planning — publiceren op de platformen die zij zelf gekoppeld hebben.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-neutral-900">Met wie we gegevens delen</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Meta Platforms, Inc.</strong> (Facebook en Instagram) — om posts effectief te publiceren.</li>
          <li><strong>Supabase</strong> — database-, authenticatie- en bestandsopslag.</li>
          <li><strong>Vercel</strong> — hosting van de applicatie.</li>
          <li><strong>Resend</strong> — verzending van e-mailmeldingen bij een mislukte post.</li>
          <li><strong>Upstash</strong> — planning van Instagram-publicaties op het gekozen tijdstip.</li>
          <li>De <strong>CRM-provider</strong> van het vastgoedkantoor, voor het ophalen van pandgegevens.</li>
        </ul>
        <p>We verkopen persoonsgegevens nooit door aan derden.</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-neutral-900">Hoe lang we gegevens bewaren</h2>
        <p>
          Zolang het account of de koppeling van een vastgoedkantoor actief is. Verwijdert Leadmore een kantoor uit
          het platform, dan worden alle bijhorende panden, templates, posts en gebruikersaccounts van dat kantoor
          definitief verwijderd.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-neutral-900">Jouw rechten</h2>
        <p>
          Je hebt recht op inzage, correctie, verwijdering en bezwaar tegen de verwerking van je persoonsgegevens.
          Zie onze <Link href="/data-deletion" className="underline">pagina over gegevensverwijdering</Link> voor
          hoe je dat concreet aanvraagt, of neem rechtstreeks contact op via{" "}
          <a href="mailto:privacy@leadmore.be" className="underline">privacy@leadmore.be</a>.
        </p>
      </section>
    </div>
  );
}
