# Backlog — later toe te voegen

Dingen die we bewust nog niet gebouwd hebben, met de context waarom, zodat we ze
niet vergeten. Geen einddatum/prioriteit — gewoon een geheugensteun.

## Instagram-scheduling faalt in productie (Vercel) — QStash-signature-verificatie geeft "invalid signature"

Ontdekt tijdens het live testen van de eerste echte Vercel-productiedeploy (2026-07-19), na
het aanvullen van de ontbrekende env-vars (`QSTASH_*`, `RESEND_*`, `META_SYSTEM_USER_TOKEN` —
stonden lokaal wel, op Vercel nog niet). Een echte, ingeplande post (Facebook + Instagram) via
de live `leadmore-social.vercel.app`-link liet zien: Instagram bleef voor onbepaalde tijd op
`scheduled` hangen, nooit gepubliceerd.

**Grondig onderzocht, oorzaak nog niet 100% vastgepind:**
- **Niet** Vercel Deployment Protection — rechtstreeks getest, gewone pagina's én de interne
  render-call (`/internal/render-slide`) komen gewoon door zonder auth-muur.
- QStash levert wél netjes af aan de juiste URL (bevestigd via QStash's eigen `/v2/events`-log
  — 3 retries, telkens **401 `{"error":"invalid signature"}`** terug van onze eigen route, zie
  `src/app/api/internal/instagram-sweep/route.ts`). Het verzoek bereikt de app dus wél, en
  faalt bij `receiver.verify()` (het `@upstash/qstash`-`Receiver`-package).
- De signing keys in `.env.local` zijn **geverifieerd correct** tegen QStash's eigen
  account-API (`GET /v2/keys`) — exacte match, geen verlopen/geroteerde sleutel.
- De bestemmings-URL wordt zowel bij het inplannen (`scheduleInstagramSweep()` in
  `src/lib/qstash.ts`) als bij het verifiëren (dezelfde route) via dezelfde `siteUrl()`-functie
  opgebouwd — zou dus moeten matchen, geen voor de hand liggende URL-mismatch gevonden.
- De route zelf logt **niets** bij een falende verificatie (`receiver.verify()`'s `catch`-blok
  geeft gewoon 401 terug, geen `console.error`) — daardoor is er geen enkel spoor van deze
  fout terug te vinden in Vercel's eigen function-logs, enkel via QStash's *eigen*
  events-log (`GET https://qstash.upstash.io/v2/events?fromDate=0`, met `QSTASH_TOKEN` als
  Bearer-token) kon de echte responstekst (base64 in `responseBody`) achterhaald worden.

**Nog te doen**: tijdelijke logging toevoegen aan `instagram-sweep/route.ts` (bv. de opgebouwde
`url`, of de rauwe reden die `receiver.verify()` intern teruggeeft) om het exacte verschil te
vinden — de meest waarschijnlijke overgebleven hypothese is een subtiele URL-mismatch die de
handmatige vergelijking hierboven niet ving (bv. een omleiding tussen de deployment-specifieke
`VERCEL_URL` en het gealiaste productiedomein `leadmore-social.vercel.app`, of een
scheme/trailing-slash-verschil). **Geen echte publicatie gebeurd** tijdens dit testen — de
testpost bleef overal steken vóór de effectieve Meta-publicatie, dus geen opruiming nodig aan
Meta's kant. Lokaal (via een Cloudflare-tunnel naar de dev-server) werkte dit exacte pad wel
al eerder echt (zie CLAUDE.md "Instagram-scheduling"), dus dit is specifiek een
productie/Vercel-probleem, geen fundamenteel ontwerpprobleem.

## Geplande Facebook-posts — status onduidelijk, niet geldig herverifieerd

Ontdekt tijdens het verifiëren van Fase B van `PLAN_TEMPLATE_EDITOR.md` (2026-07-15): een
**geplande** Facebook-post (`scheduled_publish_time` in de toekomst, via "Inplannen" i.p.v.
"Nu posten") faalde toen altijd met `(#100) The specified scheduled publish time was
invalid.` — bevestigd via een rechtstreekse Graph API-test dat dit **zowel bij een losse
foto als bij een carrousel** gebeurde. "Nu posten" (`scheduledAt: null`, slaat dit veld over)
bleef wél werken.

Op 2026-07-19 gemeld als "werkt weer" door de gebruiker (kon terug posten op Facebook/
Instagram) en toen als afgesloten gemarkeerd — **te snel**: dat posten was vermoedelijk via
"Nu posten", niet via een echte scheduled post, dus geen echte herbevestiging van dit
specifieke pad. Nog dezelfde dag, bij het live testen van de Vercel-productiedeploy, dook
exact dezelfde `(#100)`-fout weer op bij een **geplande** post — maar die test plande slechts
3 minuten vooruit, en de render-pijplijn had daar al ~2 minuten van opgesoupeerd vóór de
eigenlijke Facebook-call gebeurde (om 17:42:07 voor een geplande tijd van 17:43:00 — amper 52
seconden marge, ruim onder Facebook's vereiste minimum van 10 minuten). Die specifieke
herhaling is dus zeer waarschijnlijk **een test-fout** (te weinig marge ingepland), geen
bevestiging dat de oorspronkelijke bug terug is. **Nog te doen**: een propere herverificatie
met een scheduled_at die minstens 15+ minuten vooruit ligt, om pas dan echt te weten of dit
pad werkt.

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

## ~~Manier van templates aanmaken herbekijken~~ — afgesloten, git-registry-pad geschrapt

De huidige flow (super_admin plakt/schrijft zelf TSX + Tailwind in een tekstvak) bleek
omslachtig bij het overzetten van een echt Figma-ontwerp. Als tussenoplossing werd een PoC
gebouwd: templates konden ook als echte, git-beheerde `.tsx`-bestanden bestaan
(`src/templates/registry.ts`, `agency_templates.template_key`) i.p.v. enkel als DB-string —
één template werd zo overgezet als bewijs, echt getest.

**Beslissing (2026-07-19)**: de scene-editor wordt de enige manier om een template aan te
maken of te bewerken. Het git-registry-pad vereiste een echt `.tsx`-bestand schrijven en
deployen — iets wat geen enkele admin-UI-flow ooit kon doen, en dus fundamenteel botste met
die beslissing. Volledig geschrapt i.p.v. verder uitgebouwd: `src/templates/registry.ts`,
`src/templates/types.ts`, `src/templates/components/AutoSizeText.tsx` en het enige
PoC-template (`vastgoed-de-meester/wuustwezel-single.tsx`) zijn verwijderd,
`agency_templates.template_key` is gedropt (`0018_drop_template_key.sql`, geen rij had 'm ooit
ingevuld staan), en elke `templateKey`-tak in de renderpijplijn/preview-componenten is
verwijderd. Blijft uitdrukkelijk **geen** Canva-achtige drag-and-drop-builder voor het kantoor
(zie CLAUDE.md "Productvisie") — dit ging over hoe de *admin* templates aanmaakt.

## ~~Gebruikersbeheer voor kantoorstaff ontbreekt~~ — afgesloten, gebouwd

Gebouwd (2026-07-14): een "Gebruikers"-kaart op `/admin/agencies/[id]`
(`AgencyUsersCard.tsx`) — lijst van bestaande profielen met e-mail (via
`admin.auth.admin.getUserById`), een toevoegformulier
(`inviteAgencyUserAction`, `src/app/admin/agencies/actions.ts`: genereert een
tijdelijk wachtwoord, `createUser` + `profiles`-insert, toont het wachtwoord
eenmalig in een dialoog), en `removeAgencyUserAction`
(`admin.auth.admin.deleteUser`).

## ~~Geen wachtwoord-reset~~ — afgesloten, gebouwd

Gebouwd (2026-07-14): `/forgot-password` en `/reset-password`
(`ForgotPasswordForm.tsx`/`ResetPasswordForm.tsx`), plus een link vanaf
`LoginForm.tsx`. De aanvraag loopt via een server action
(`requestPasswordResetAction`, `src/lib/auth-actions.ts`) i.p.v. een
rechtstreekse client-side Supabase-call, zodat de rate limit (zie hieronder)
er ook echt op toegepast kan worden.

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

## ~~Geen rate limiting~~ — afgesloten, eerste versie gebouwd

Gebouwd (2026-07-14): `src/lib/rate-limit.ts` — een in-memory,
IP-gekeyde sliding-window teller, toegepast op `signInAction` (5 pogingen/5
min) en `requestPasswordResetAction` (5 aanvragen/5 min). **Bewust aanvaarde
beperking**: per-instance (niet gedeeld tussen meerdere Vercel-instanties,
reset bij een cold start) — een eerste verdedigingslinie, geen waterdichte
bescherming. Upgrade-pad: `@upstash/ratelimit` met Redis (zelfde
Upstash-account als de al-bestaande QStash-koppeling) zodra dat nodig blijkt
in productie.

## ~~Facebook/Instagram-carrousels worden nog niet echt gepubliceerd~~ — afgesloten, gebouwd

Gebouwd (2026-07-14): `facebookPublishingService.ts`'s
`createScheduledPost` vertakt nu op `imageUrls.length` — bij >1 foto worden
alle foto's eerst ongepubliceerd geüpload (`Promise.all`) en dan in één
`POST /{page-id}/feed`-call samengevoegd via `attached_media`.
`instagramPublishingService.ts`'s `publishPhotoNow` bouwt bij >1 foto een
carrousel: per foto een `is_carousel_item`-container (parallel aangemaakt en
gepolld), dan één ouder-`CAROUSEL`-container, dan pas `media_publish`.
`instagramSchedulerSweepService.ts` geeft nu alle slides door, niet enkel
`slides?.[0]`.

**Echte test (2026-07-14) vond een echte bug, intussen gefixt**: een live
2-foto-carrousel via "nu posten" — Facebook lukte meteen, Instagram faalde
met `(#9004) Media ID is not available`, ondanks dat `waitForContainerReady`
vooraf `FINISHED` had gezien. Bleek een Meta-eigenaardigheid specifiek voor
het ouder-`CAROUSEL`-container: dat container heeft zelf geen afbeelding om
te verwerken, dus `status_code` staat vrijwel meteen op `FINISHED` — geen
betrouwbaar signaal dat `media_publish` ook echt zal lukken. Fix:
`publishContainer()` in `instagramPublishingService.ts` retryt nu tot 4x
(2s ertussen) specifiek op Graph API-foutcode 9004, i.p.v. enkel op de
vooraf-check te vertrouwen. Geldt voor zowel de losse-foto- als de
carrousel-publiceerpaden (gedeelde functie). Bevestigd: `retryPublish()`
herpakt enkel de mislukte `post_jobs`-rij, dus een retry post Facebook niet
dubbel.

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

## ~~Geen stale-check voor de "publishing"-tussenstatus~~ — afgesloten, gebouwd

Gebouwd (2026-07-14): `postDetailService.ts` heeft nu ook een
`STALE_PUBLISHING_THRESHOLD_MS`-check (3 min, zelfde patroon als de
bestaande `rendering`-check) die `posts.status === 'publishing'` na de
drempel naar `publish_failed` zet + `notifyPostFailure`. Enkel op
`posts.status` — niet op de aparte, korter-levende `post_jobs`-niveau
"publishing"-claim in `instagramSchedulerSweepService.ts`, die heeft al zijn
eigen conditionele claim-guard.

## ~~Elk aangemaakt template moet altijd "Bewerken" hebben, niet enkel "Preview"~~ — afgesloten, gebouwd

Gemeld door de gebruiker (2026-07-15), opgelost (2026-07-19): op `/admin/agencies/[id]` (de
templatelijst) stond de "Bewerken"-knop enkel naast templates waarvoor `isSceneTemplate` waar
was (`scenes_by_format` heeft al minstens één scène). Een net aangemaakte template heeft dat
nog niet — `createSceneAgencyTemplate` zet enkel `component_source: ""`, geen
`scenes_by_format` — dus wie na het aanmaken wegnavigeerde vóór de eerste keer opslaan in de
editor, verloor daarmee elke manier om er nog in te geraken (enkel Preview/Verwijderen bleven
over, geen enkele pagina linkt anders terug naar de editor).

**Bewuste keuze bij het oplossen** (expliciet bevestigd door de gebruiker): de scène-editor is
voortaan de **enige** manier om een template aan te maken of te bewerken (`templates/new`
maakt altijd een scène-template aan, de oude broncode-editor bestaat niet meer) — dus de
`isSceneTemplate`-gate diende geen echt doel meer. Opgelost door die conditie gewoon te laten
vallen in `src/app/admin/agencies/[id]/page.tsx`: "Bewerken" toont nu altijd, voor elke
template, ongeacht of `scenes_by_format` al iets bevat. Voor een (in deze app niet meer
bestaand, maar in principe mogelijk) legacy `component_source`-only-template zou dit gewoon
een leeg canvas openen — `component_source` wordt sowieso nergens meer gelezen zodra
`scenes_by_format` iets bevat, en dat risico is bewust aanvaard omdat er nog geen live
productieomgeving met bestaande templates is. Geverifieerd via Puppeteer: nieuw template
aanmaken → wegnavigeren zonder op te slaan → "Bewerken" staat er, en opent de editor
probleemloos.

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

## Vrij-positie "Groeperen" (Cmd+G) in de scene-editor, los van Auto-layout-containers

Bewust uitgesteld tijdens de Figma-pariteitspas op de scene-editor (native-size artboard +
pan/zoom-viewport, multi-select via shift-klik/marquee, dupliceren/kopiëren/plakken, volledige
sneltoetsenset, align/distribute — dat alles wél gebouwd en geverifieerd). Een vrij-positie
groep (kinderen behouden hun absolute positie, geen flex, wél individueel sleepbaar binnen de
groep — een écht ander concept dan de bestaande flex-`ContainerSceneElement`) is het duurste en
riskantste stuk van dat hele plan: een nieuw `GroupSceneElement`-type, een ouder-type-bewuste
herziening van meerdere plekken die vandaag impliciet `!!parentId` betekent "flex-beheerd, dus
niet interactief" (`selectedNode`/`guideNodes`-logica en de render-lussen in zowel
`SceneEditorCanvas.tsx` als `SceneRenderer.tsx`), én een niet-triviale auto-hug
(bounding-box-unie + herijking van elk kind se %-van-groepsbox-coördinaten bij elke wijziging,
in tegenstelling tot een container se simpele `offsetWidth`-lezing). Relatief veel risico/werk
voor wat de bestaande auto-layout-container (nu makkelijker bereikbaar via **Shift+A** — wrapt
de huidige selectie automatisch in een container, `wrapSelectionInContainer()` in
`SceneEditor.tsx`) al grotendeels dekt. **Nog te doen, mocht dit alsnog gewenst zijn**: het
volledige, uitgewerkte technische ontwerp staat nog in de sessiegeschiedenis (Explore- en
Plan-subagents hebben `react-moveable`/`react-selecto` grondig doorgelicht voor multi-target-
groepgedrag) — belangrijkste open vragen die eerst een beslissing nodig hebben: blijft
groep-selectie "plat" (klik op een kind selecteert het meteen) of komt er een Figma-stijl
dubbelklik-om-in-te-gaan; mag Cmd+G een kind van een bestaande groep samen met een top-level
element groeperen (aanbevolen: nee, één-niveau-nesting-regel).
