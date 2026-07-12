# Backlog — later toe te voegen

Dingen die we bewust nog niet gebouwd hebben, met de context waarom, zodat we ze
niet vergeten. Geen einddatum/prioriteit — gewoon een geheugensteun.

## Meldingen bij mislukte posts

Vandaag komt een kantoor een mislukte post (`render_failed`/`publish_failed`)
enkel tegen als iemand toevallig het kalenderoverzicht of de posts-lijst bekijkt
— geen enkele proactieve melding. Gekozen richting: **e-mail**, niet enkel een
in-app banner, net omdat een banner afhankelijk blijft van dat iemand toevallig
inlogt. Vereist een mailprovider (Resend/Postmark/...) — nog niet gekozen.

## Tabblad "Mislukt" op de posts-pagina

`/dashboard/scheduled` heeft vandaag 2 tabbladen ("Ingepland"/"Gepubliceerd" —
zie CLAUDE.md), waarbij `render_failed`/`publish_failed` posts nog gewoon
onder "Ingepland" vallen. Vraag van het kantoor: een apart derde tabblad
"Mislukt" met een rood cirkel-badge en het aantal mislukte posts erop, zodat
je in één oogopslag ziet of er iets misgelopen is zonder de hele
"Ingepland"-lijst te moeten doorlopen.

## Hover-knop "+ Nieuwe post" op de kalender

Sinds kalenderdagen klikbaar zijn (zie CLAUDE.md, stap 9 van de post-flow)
weten gebruikers niet noodzakelijk dat dat kán — er is geen visuele hint.
Vraag: bij hover op een dagkader een "+ Nieuwe post"-knop laten verschijnen,
zodat de affordance duidelijker is.

## Facebook-koppeling — model nog eens goed doordenken

Vandaag configureert enkel de platformbeheerder de Meta-koppeling (bewust zo
ontworpen, zie CLAUDE.md "Rollen en permissies" — agency-gebruikers mogen dit
nooit zelf instellen, RLS staat enkel super_admin schrijftoegang toe op
`social_connections`). In de praktijk verloopt het koppelen zo: de
platformbeheerder genereert de OAuth-link en stuurt die door naar iemand bij
het kantoor die beheerder is van hun eigen Facebook-pagina (die persoon heeft
zelf geen Leadmore-account nodig); voor pagina's binnen een Business
Portfolio deelt het kantoor in plaats daarvan hun Pagina met Leadmore's
Business Manager als partner, waarna de platformbeheerder enkel het
Pagina-ID moet invullen. Overwogen om dit naar de kantoorkant (`agency_admin`)
te verplaatsen, maar voorlopige neiging: **bij de platformbeheerder houden**
(consistent met CRM-koppeling en templates, die ook nooit door het kantoor
zelf geconfigureerd worden) — zie de twee concrete vervolgpunten hieronder.

## "Kopieer link"-knop bij de Facebook-koppeling

`startMetaConnectAction` herleidt vandaag de browser van de platformbeheerder
zelf onmiddellijk naar Facebook's OAuth-scherm (`redirect(...)` in
`src/app/admin/agencies/actions.ts`) — er is geen manier om de
autorisatie-link zelf te pakken te krijgen om door te sturen naar iemand bij
het kantoor, zonder te prutsen met de adresbalk tijdens de redirect. Toe te
voegen: een tweede, kleine knop naast de bestaande "Verbind met
Facebook"-knop die de link (`metaAuthService.buildAuthorizationUrl(...)`)
naar het klembord kopieert in plaats van te redirecten. De link zelf heeft
geen vervaldatum ingebakken (`signState()` in `src/lib/meta/state.ts` bevat
geen timestamp) — geen haast nodig om 'm snel te versturen.

## Uitzoeken of de partner-stap voor Business Portfolio-pagina's te vermijden is

Voor Pagina's binnen een Business Portfolio is vandaag een manuele
Facebook-kant-actie door het kantoor nodig (Pagina delen als partner met
Leadmore's Business Manager, zie "Tweede koppelmethode" in CLAUDE.md) — het
gewone OAuth-scherm surfacet zo'n Pagina niet altijd betrouwbaar via
`/me/accounts`, zelfs met correcte permissies. Grondoorzaak nooit volledig
uitgeklaard (zie CLAUDE.md). Te onderzoeken: of Meta's **Business
Verification**-proces voor Leadmore's eigen Business Manager/App dit
gewone OAuth-scherm alsnog betrouwbaar zou laten werken voor zulke pagina's,
waardoor de partner-stap overbodig wordt. Onbevestigd, niet getest — puur een
onderzoekspiste.

## Instagram-scheduling

`instagramPublishingService` is nog steeds mock (delegeert naar
`mockMetaSchedulingService`). Instagram's Content Publishing API kent geen
`scheduled_publish_time` — vereist een eigen achtergrond-scheduler die op
`scheduled_at` wacht, geen simpele andere API-call.

## Template-versiebeheer

Geen versiegeschiedenis/rollback voor admin-templates — een template bewerken
overschrijft de vorige versie definitief (met automatische terugval naar
`draft` tot opnieuw gevalideerd, zie Fase 1). Expliciet uit scope gelaten bij
de eerste versie van de validatieflow.

## Vercel Cron als extra vangnet voor de render-queue

De achtergrond-queue voor renderen (zie CLAUDE.md, "Echte achtergrond-queue
voor renderen") gebruikt bewust geen Vercel Cron — op het huidige Hobby-plan
draait een cron-job maximaal 1x per dag, wat renders tot 24u zou kunnen laten
wachten. In plaats daarvan: een `after()`-getriggerde fire-and-forget request
plus een lazy vangnet in `postDetailService.ts` (20s-drempel). Zodra het
project naar een Pro-plan verhuist, kan een echte cron-job (elke minuut) als
extra vangnet toegevoegd worden bovenop de bestaande request-level check.
