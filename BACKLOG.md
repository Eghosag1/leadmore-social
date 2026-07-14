# Backlog — later toe te voegen

Dingen die we bewust nog niet gebouwd hebben, met de context waarom, zodat we ze
niet vergeten. Geen einddatum/prioriteit — gewoon een geheugensteun.

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

## ~~Uitzoeken of de partner-stap voor Business Portfolio-pagina's te vermijden is~~ — afgesloten, niet mogelijk

Onderzocht en met een echte test afgesloten (2026-07-14): Leadmore's Business
Manager is geverifieerd via Meta's Business Verification, en de gewone
OAuth-flow gaf voor een echte Business-Portfolio-Pagina nadien nog steeds
dezelfde fout ("Dit Facebook-account beheert geen enkele Pagina..."). De
hypothese dat Verification dit zou oplossen is dus **ontkracht** — zie
CLAUDE.md "Tweede koppelmethode". De Business Manager/System User-koppeling
blijft de permanente weg voor Pagina's binnen een Business Portfolio, geen
tijdelijke omweg. Geen verder onderzoek hier nodig.

## Manier van templates aanmaken herbekijken — PoC gebouwd, migratie nog niet

De huidige flow (super_admin plakt/schrijft zelf TSX + Tailwind in een
tekstvak, `TemplateForm`) bleek omslachtig bij het overzetten van een echt
Figma-ontwerp. Opgelost op architectuurniveau: templates kunnen nu ook als
echte, git-beheerde `.tsx`-bestanden bestaan (`src/templates/registry.ts`,
`agency_templates.template_key`) i.p.v. enkel als DB-string — zie CLAUDE.md
"Admin-geschreven React-templates" en de "Templatearchitectuur"-analyse. Eén
template is zo overgezet als bewijs, echt getest (Puppeteer-render + geen
regressie op bestaande DB-string-templates). **Nog niet gedaan**: een
admin-UI om een kantoor aan een registry-template te koppelen (nu handmatig
via SQL), de resterende bestaande templates overzetten, en het oude
`new Function`-compileerpad uiteindelijk verwijderen. Blijft uitdrukkelijk
**geen** Canva-achtige drag-and-drop-builder voor het kantoor (zie CLAUDE.md
"Productvisie") — dit gaat over hoe de *admin* templates aanmaakt.

## Gebruikersbeheer voor kantoorstaff ontbreekt

Er is geen enkele manier om een `agency_admin`/`agency_user`-account aan te
maken buiten `scripts/seed.ts` — geen uitnodigingsflow, geen admin-UI-pagina
om een nieuw kantoorlid toe te voegen. Vandaag moet dat via een script of
rechtstreeks in Supabase. Blokkerend voor eender welk echt kantoor: een
platformbeheerder moet zelf, vanuit `/admin/agencies/[id]`, minstens een
eerste `agency_admin` kunnen aanmaken/uitnodigen (bv. via
`admin.auth.admin.inviteUserByEmail` + een `profiles`-rij).

## Geen wachtwoord-reset

Wie zijn wachtwoord vergeet kan nergens terecht — er is enkel een
login-pagina (`src/app/(auth)/login`). Nodig: een "wachtwoord vergeten"-link
die `supabase.auth.resetPasswordForEmail()` gebruikt, plus een pagina om het
nieuwe wachtwoord in te stellen.

## Echte CRM-integratie

`crmMockService` (`src/services/crm/`) leest vandaag enkel statische
testdata uit `src/data/mock/properties.ts`. Voor een eerste echt kantoor
moet ofwel een echte CRM-provider gebouwd worden (Whise, Immoweb, ...) achter
dezelfde `CrmService`-interface, ofwel een manuele pand-invoerflow als
tussenstap. Zie CLAUDE.md "Mock services" voor het bestaande
interface-contract dat hiervoor al klaarstaat.

## Meta App Review nog niet aangevraagd

Enkel accounts die als tester/admin aan de Leadmore-Meta-app gekoppeld zijn,
kunnen vandaag de Facebook/Instagram-OAuth-flow succesvol doorlopen
("Development Access"). Een echt kantoor dat geen tester is, komt er niet
door zonder dat Meta de gevraagde permissies (`pages_show_list`,
`pages_manage_posts`, `pages_read_engagement`, `instagram_basic`,
`instagram_content_publish`) goedkeurt via App Review ("Advanced Access").
Business Verification (zie hierboven) is daarvoor meestal een vereiste
voorstap — die is intussen afgerond (2026-07-14), dus App Review kan nu in
principe aangevraagd worden. Let op: lost het Business-Portfolio-
surfacing-probleem niet op (zie hierboven, apart en al ontkracht), enkel het
"enkel testers kunnen inloggen"-probleem.

## Productiedeploy nog niet gebeurd

Alles is tot nu toe enkel lokaal getest, nooit gedeployed. Nodig: een
Vercel-project, en productie-versies van alle env-vars — `META_REDIRECT_URI`
naar het echte domein (moet exact overeenkomen met wat in het
Meta-dashboard geregistreerd staat), `NEXT_PUBLIC_SITE_URL`, een
Resend-domein dat echt geverifieerd is (i.p.v. de sandbox
`onboarding@resend.dev` die nu gebruikt wordt — zie CLAUDE.md "Meldingen bij
mislukte posts"), een QStash-config die het echte domein kan bereiken, en
een nieuw, voor productie gegenereerd `TOKEN_ENCRYPTION_KEY`.

## Geen foutmonitoring

Geen Sentry (of gelijkaardig) geïntegreerd — een fout in productie is enkel
zichtbaar als iemand zelf in Vercel's eigen logs gaat kijken.

## Geen geautomatiseerde tests

Geen enkel testbestand, geen testrunner (`package.json` heeft enkel `dev`/
`build`/`start`/`lint`/`seed`). Alles is deze sessie manueel of via ad-hoc
scripts geverifieerd — reëel risico bij toekomstige wijzigingen zonder een
testharnas.

## Geen rate limiting

`src/proxy.ts` ververst enkel de Supabase-sessiecookie, verder geen
rate limiting op login of andere publieke routes.

## Facebook/Instagram-carrousels worden nog niet echt gepubliceerd

Ook als een gebruiker een carrousel-template kiest, publiceert
`facebookPublishingService`/`instagramPublishingService` vandaag enkel de
eerste foto (`imageUrls[0]`) — staat al zo genoteerd in CLAUDE.md's
mock-services-tabel als bekende beperking. Facebook heeft hiervoor
`attached_media` nodig, Instagram een aparte carrousel-media-flow.

## Geen facturatie-integratie

`billable_type`/`included_in_plan` op templates zijn vandaag pure
metadata/classificatie (`included` vs. `regie`), geen echte
betaalverwerking. Nodig zodra er effectief gefactureerd moet worden: een
Stripe-integratie (of gelijkaardig).

## Juridisch nog niet in orde — eerste opzet privacyverklaring staat er

`/privacy` en `/data-deletion` bestaan intussen als echte, publieke pagina's
(2026-07-14, aangemaakt voor de Meta App Review-indiening hieronder, zie
`src/app/privacy/page.tsx`/`src/app/data-deletion/page.tsx`) — een eerste
ontwerp, geen juridisch nagekeken tekst. **Nog te doen**: de
placeholder-velden invullen (officiële bedrijfsnaam/rechtsvorm,
ondernemingsnummer, adres, een echt `privacy@leadmore.be`-postvak), de
inhoud laten nakijken door iemand die dat kan beoordelen, en nog steeds geen
verwerkersovereenkomst of gebruiksvoorwaarden. Bedrijfsbeslissing, geen
coderingstaak.

## Meta App Review — indiening voorbereid, nog niet ingediend

Business Verification is rond (zie hierboven), dus App Review kan nu
aangevraagd worden voor `pages_show_list`/`pages_manage_posts`/
`pages_read_engagement`/`instagram_basic`/`instagram_content_publish`. De
vijf gebruiksuitleg-teksten staan klaar (gegenereerd 2026-07-14, gedeeld in
de chat — niet in de repo bewaard, puur kopieermateriaal voor Meta's
formulier) en `/privacy`/`/data-deletion` bestaan nu als in te vullen URL's
voor het App Dashboard. **Nog te doen, enkel handmatig in Meta's eigen
dashboard**: een app-icoon (1024×1024) uploaden, een screencast per
permissie opnemen (voorgestelde opname-flow staat bij de teksten), en
effectief indienen. Doorlooptijd doorgaans 2-4 weken per indiening.

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
