# Backlog — later toe te voegen

Dingen die we bewust nog niet gebouwd hebben, met de context waarom, zodat we ze
niet vergeten. Geen einddatum/prioriteit — gewoon een geheugensteun.

## Meldingen bij mislukte posts

Vandaag komt een kantoor een mislukte post (`render_failed`/`publish_failed`)
enkel tegen als iemand toevallig het kalenderoverzicht of de posts-lijst bekijkt
— geen enkele proactieve melding. Gekozen richting: **e-mail**, niet enkel een
in-app banner, net omdat een banner afhankelijk blijft van dat iemand toevallig
inlogt. Vereist een mailprovider (Resend/Postmark/...) — nog niet gekozen.

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

## Template-versiebeheer

Geen versiegeschiedenis/rollback voor admin-templates — een template bewerken
overschrijft de vorige versie definitief (met automatische terugval naar
`draft` tot opnieuw gevalideerd, zie Fase 1). Expliciet uit scope gelaten bij
de eerste versie van de validatieflow.

## Vercel Cron i.p.v. QStash/fire-and-forget, zodra het project naar Pro verhuist

Twee plekken gebruiken vandaag bewust geen Vercel Cron omdat het Hobby-plan
een cron-job maar 1x/dag toelaat: de render-queue (`after()`-getriggerde
fire-and-forget request + een lazy vangnet in `postDetailService.ts`,
20s-drempel) en de Instagram-scheduler (QStash-wake-up-calls naar
`/api/internal/instagram-sweep`, zie CLAUDE.md "Instagram-scheduling").
Beide zijn zo ontworpen dat de trigger losstaat van de eigenlijke logica —
voor de Instagram-sweep in het bijzonder is overstappen naar een Vercel
Pro-cron (elke minuut) dan ook letterlijk enkel de QStash-aanroep vervangen
door een `vercel.json`-cron-entry die dezelfde route aanroept, geen enkele
wijziging aan `instagramSchedulerSweepService.ts` zelf. Voor de render-queue
zou een Pro-cron een extra vangnet worden bovenop de bestaande
request-level check, niet een vervanging.
