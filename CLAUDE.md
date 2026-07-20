@AGENTS.md

# Taal

Antwoord altijd in het Nederlands.

Gebruik Nederlands voor:
- uitleg
- vragen
- samenvattingen
- plannen
- foutmeldingen
- opmerkingen over uitgevoerde wijzigingen

Behoud Engelse termen wanneer dat gebruikelijk of technisch noodzakelijk is, zoals functienamen, variabelen, bestandsnamen, commando's en code.

Schrijf code en codecommentaar in het Engels, tenzij ik expliciet anders vraag.

# Leadmore Social — SaaS MVP voor vastgoedkantoren

## Productvisie

Vastgoedkantoren zien hun panden (via een CRM-koppeling) in één dashboard en kunnen met een paar klikken een
Facebook- en/of Instagram-post maken voor een pand — single post of carousel — in hun eigen huisstijl, en die
inplannen. Kantoren bouwen of ontwerpen zelf niets: alle templates zijn vooraf door Leadmore gemaakt. Dit is
uitdrukkelijk **geen Canva-editor en geen drag-and-drop layout builder**.

## MVP-scope

- **Wel gebouwd nu:** volledige architectuur, database schema + RLS, beide dashboards, template-rendering via
  React componenten, post-aanmaak- en planningsflow, rolgebaseerde toegang.
- **Mock, met een echte interface ervoor:** enkel nog CRM-data (`crmMockService`). Facebook- én
  Instagram-scheduling (`facebookPublishingService`/`instagramPublishingService`) zijn intussen **echt** — zie
  "Meta (Facebook + Instagram) integratie" onder "Mock services" hieronder. Alles is geschreven achter een
  interface (`CrmService`, `MetaPublishingService`) zodat een echte integratie er telkens gewoon voor in de
  plaats komt.
- **Rendering:** `renderPost()` gebruikt intussen `browserRenderService` — een **echte** headless-Chromium
  screenshot van de template (zie "Echte beeldcompositie" onder "Mock services" hieronder). `mockRenderService`
  (kale brontfoto teruggeven) blijft in `renderService.ts` staan als lokaal fallback-alternatief, maar wordt niet
  meer standaard gebruikt.

## Technische architectuur

- **Next.js 16** (App Router, Turbopack), **TypeScript**, **Tailwind CSS**, **shadcn/ui**.
  ⚠️ shadcn/ui hier is gebouwd op **`@base-ui/react`, niet Radix**. Er bestaat geen `asChild` prop — gebruik de
  `render` prop: `<Button render={<Link href="/x" />}>Label</Button>`. Zie ook `AGENTS.md` voor Next.js 16
  breaking changes (o.a. `params`/`searchParams` zijn altijd `Promise`, en `middleware.ts` heet nu `proxy.ts` met
  een `proxy()` export — zie `src/proxy.ts`).
- **Supabase**: Postgres database, Auth en Storage. Schema + RLS-policies staan in `supabase/migrations/`. Er is
  geen Supabase CLI/Docker beschikbaar geweest in deze omgeving — migraties zijn plain `.sql`-bestanden. Twee
  manieren om ze effectief toe te passen: handmatig plakken in de Supabase SQL editor, **of** rechtstreeks via
  `scripts/run-migration.ts` (`npx tsx scripts/run-migration.ts supabase/migrations/000X_naam.sql`) — een klein
  script dat met `pg` rechtstreeks verbindt via `SUPABASE_DB_URL` (`.env.local`, een platte Postgres-connectiestring,
  apart van de Supabase API-keys). Niet idempotent (`create type`/`add column` falen luid bij een tweede run, met
  opzet — zelfde gedrag als tweemaal dezelfde SQL in de editor plakken), dus bij twijfel of een migratie al liep
  eerst checken (bv. `select column_name from information_schema.columns where table_name = 'posts'`).
  - `src/lib/supabase/client.ts` — browser client (RLS als ingelogde gebruiker). **Belangrijke val, echt tegengekomen
    (2026-07-14)**: `src/lib/supabase/env.ts` moet `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` lezen
    via een **letterlijke** `process.env.NEXT_PUBLIC_X`-expressie, niet via een gedeelde `readEnv(name)`-helper met
    `process.env[name]` (dynamische key). Next.js' build-time env-inlining voor clientbundels herkent enkel
    statisch-analyseerbare, letterlijke `process.env.NEXT_PUBLIC_X`-verwijzingen — een dynamische lookup blijft in
    de browser altijd `undefined`, waardoor elke client-side Storage-upload (`LogoUploader`/`FontUploader`, beide
    gebruiken deze client rechtstreeks) stil terugviel op de `http://localhost:54321`-fallback en faalde met
    `ERR_CONNECTION_REFUSED` — pas ontdekt bij het testen van `FontUploader`, maar trof `LogoUploader` al even lang.
  - `src/lib/supabase/server.ts` — server client voor Server Components/Server Actions (RLS als ingelogde gebruiker).
  - `src/lib/supabase/admin.ts` — service-role client (**bypasses RLS**), alleen voor server-only "achtergrond"
    operaties die een echt systeem simuleren: CRM-sync, Meta-scheduling status-updates. Nooit client-side gebruiken.
  - Hand-geschreven DB-types in `src/types/database.ts`. Belangrijke val: elke tabel heeft een lege
    `Relationships: []` nodig en Row-types zijn `type`-aliassen (geen `interface`s), anders resolvet
    `@supabase/supabase-js` alle `.insert()`/`.update()`-calls stilzwijgend naar `never`.
  - **Geen embedded/joined `.select("*, other(col)")` gebruiken** — met een leeg `Relationships`-array typeert de
    hele rij dan als `never`. Overal in deze codebase: aparte queries per tabel, joinen in JS met een `Map`.
- **Mock/seed-data**: `src/data/mock/*` (TypeScript, gebruikt door `crmMockService` en door `scripts/seed.ts`).
  `scripts/seed.ts` (`npm run seed`) zet dit om in echte Supabase-rijen: 1 super_admin, 2 kantoren met branding,
  6 panden per kantoor, 3 standaardtemplates per kantoor, een paar posts in verschillende statussen.

## Mappenstructuur

```
src/app/                    routes (App Router)
  (auth)/login               inlogpagina
  dashboard/                 agency dashboard (agency_admin, agency_user)
  admin/                     super admin dashboard (super_admin)
src/components/
  ui/                        shadcn/ui primitives
  layout/                    AppShell, Sidebar/NavList, UserMenu
  dashboard/                 agency-dashboard-specifieke componenten
  admin/                     admin-dashboard-specifieke componenten
  templates/                 TemplateComponentProps-contract + DynamicTemplateRenderer (compileert admin-code)
  shared/                    gedeeld tussen beide dashboards (PageHeader, StatusBadge, ...)
src/services/                crmMockService, templateService, renderService, postSchedulerService, meta/*
src/lib/                     supabase clients, auth helpers, format helpers, template-render (client-safe),
                              dynamic-template.ts (sucrase-compiler), field-binding.ts
src/types/                   enums.ts, database.ts (DB rows), domain.ts (app-level shapes)
src/data/mock/                mock CRM/branding/template/post data, herbruikt door crmMockService én seed.ts
src/data/template-starters.ts  startbroncode-snippets voor de admin-editor (single/carousel/verkocht)
supabase/migrations/          SQL schema + RLS policies
scripts/seed.ts               vult Supabase met de mock data (npm run seed)
```

## Rollen en permissies

| Rol | Scope | Kan |
|---|---|---|
| `super_admin` | Alle kantoren | Kantoren beheren/verwijderen, huisstijl instellen, CRM- en Meta-koppeling per kantoor configureren, templates per kantoor aanmaken/bewerken/activeren, alle posts en errors bekijken |
| `agency_admin` | Eigen kantoor | Zelfde als `agency_user` — er is geen apart instellingenbeheer meer bij het kantoor (zie hieronder) |
| `agency_user` | Eigen kantoor | Kalenderdashboard bekijken, panden bekijken, posts maken/inplannen op basis van bestaande templates, posts-tabel bekijken |

Rolcontrole gebeurt op twee niveaus:
1. **App-niveau**: `requireRole()` (`src/lib/auth.ts`) in elke layout (`src/app/dashboard/layout.tsx`,
   `src/app/admin/layout.tsx`) — redirect naar `/login` of de juiste home als de rol niet klopt.
2. **Database-niveau**: RLS-policies in `supabase/migrations/0001_init.sql` (aangevuld door `0004_template_restructure.sql`),
   via de SECURITY DEFINER functies `is_super_admin()`, `is_agency_admin()`, `current_profile_agency_id()`. Dit is
   de echte grens — de UI-checks zijn UX, niet de beveiliging.

Agency-gebruikers kunnen **nooit**: nieuwe templates maken, layouts aanpassen, template-structuur wijzigen, de
Meta/CRM-koppeling van hun kantoor configureren, andere kantoren zien, of admin-functies gebruiken. Dit wordt
zowel in de UI verborgen als in RLS afgedwongen (alleen `super_admin` heeft INSERT/UPDATE/DELETE op
`agency_templates`, en sinds `0004` ook exclusief schrijftoegang tot `social_connections`).

### Gebruikersbeheer en authenticatie

Een `super_admin` beheert kantoorstaff vanaf `/admin/agencies/[id]` (`AgencyUsersCard.tsx`): de lijst van
bestaande profielen (naam, rol, e-mail — e-mail via `admin.auth.admin.getUserById`, want `profiles` heeft zelf
geen e-mailkolom, die leeft op `auth.users`), een toevoegformulier, en een verwijderknop per gebruiker.
`inviteAgencyUserAction` (`src/app/admin/agencies/actions.ts`) genereert een willekeurig tijdelijk wachtwoord
(`crypto.randomBytes`), maakt de gebruiker aan via `admin.auth.admin.createUser({ email_confirm: true })` + een
`profiles`-insert, en toont dat wachtwoord eenmalig in een dialoog met kopieerknop — geen uitnodigingsmail nodig
(dat zou Supabase's eigen mailer-config vereisen, een aparte afhankelijkheid). De nieuwe gebruiker zet zelf een
eigen wachtwoord via de gewone "wachtwoord vergeten"-flow. `removeAgencyUserAction` is
`admin.auth.admin.deleteUser(userId)`, zelfde patroon als `deleteAgencyAction`.

Wachtwoord-reset (`/forgot-password` → `/reset-password`) is standaard Supabase Auth. De aanvraag zelf loopt
bewust via een **server action** (`requestPasswordResetAction`, `src/lib/auth-actions.ts`), niet een rechtstreekse
client-side `supabase.auth.resetPasswordForEmail()`-call — enkel server-side is er een IP te lezen (`next/headers`)
om de rate limit hieronder op toe te passen. Toont altijd dezelfde "als er een account bestaat..."-bevestiging,
ongeacht of het adres echt bestaat (anti-enumeratie). `/reset-password` zelf blijft client-side
(`supabase.auth.updateUser({ password })`) — de recovery-sessie die Supabase's e-maillink meegeeft wordt door
`@supabase/ssr`'s browserclient automatisch herkend, geen server-actie nodig voor die stap.

**Rate limiting** (`src/lib/rate-limit.ts`): een in-memory, IP-gekeyde sliding-window-teller (`Map<string,
number[]>`, IP via `headers().get("x-forwarded-for")`), toegepast op `signInAction` en
`requestPasswordResetAction` (elk 5 pogingen/5 minuten). Bewust **niet** Upstash-Redis-backed voor v1 — dat zou nu
een nieuw extern account vereisen; in-memory is per-instance (niet gedeeld tussen meerdere Vercel-instanties, reset
bij een cold start) en dus een eerste verdedigingslinie, geen waterdichte bescherming. Een
`@upstash/ratelimit`-versie (zelfde Upstash-account als de al-bestaande QStash-koppeling) is een genoteerde latere
upgrade, zie `BACKLOG.md`.

## Template businessmodel

Er is **geen gedeelde basistemplate-laag en geen vaste layout-catalogus**. Elk kantoor heeft uitsluitend eigen
templates — een `agency_templates`-rij is vanaf het moment van aanmaken al gekoppeld aan precies één `agency_id`,
en een nieuw kantoor start met **nul templates**. Er bestaat geen `template_blueprints`-tabel (verwijderd in
`0004`) en geen vast-ingebouwde set React-componenten om uit te kiezen (die zijn verwijderd in `0005` — zie
"Admin-geschreven React-templates" hieronder).

### Admin-geschreven React-templates (live code, per kantoor)

De admin schrijft/plakt zelf de **echte React-broncode (TSX)** per template, rechtstreeks in het admin-dashboard
(`TemplateForm`, `src/components/admin/TemplateForm.tsx`, gebruikt door zowel "Template toevoegen" als "Bewerken").
Die code wordt **at runtime gecompileerd** met `sucrase` (JSX/TS → JS, geen build-stap) en uitgevoerd via
`new Function` — zie `src/lib/dynamic-template.ts` (`compileTemplateSource`) en
`src/components/templates/DynamicTemplateRenderer.tsx` (compileert + rendert binnen een React error boundary, zodat
een kapotte template de pagina niet laat crashen).

- **Schrijfcontract**: een normale function component die eindigt met `export default JouwComponent;`. Props:
  `{ data: TemplateRenderProps; slideIndex?: number; className?: string }` (`src/components/templates/types.ts`).
- **Beschikbare scope**: enkel `React` en next/image's `Image` worden meegegeven — geen andere imports mogelijk.
- **Starter-snippets** (`src/data/template-starters.ts`, 3 stuks: single/carousel/verkocht) zijn puur bronteksten
  ter inspiratie, geen registry — de admin kan er een laden in de editor en vanaf daar aanpassen.
- **`slide_count`** wordt expliciet door de admin ingesteld (1 = single, >1 = carousel) — bepaalt `type`.
- **Live preview tijdens het schrijven**: `TemplateForm` toont de `DynamicTemplateRenderer`-output naast de
  editor, met een voorbeeldpand (`src/data/mock/example-property.ts`), zodat de admin WYSIWYG werkt.

**Er bestond een tweede, git-beheerd bronpad (`template_key`), inmiddels weer geschrapt.** Een proof-of-concept
liet een template ook als een echt, statisch geïmporteerd `.tsx`-bestand bestaan (`src/templates/registry.ts`),
i.p.v. enkel als DB-string. Bewust geschrapt (2026-07-19) toen bleek dat het de scene-editor als enige
aanmaak/bewerk-pad tegensprak: `template_key` vereiste een echt bestand schrijven en deployen, iets wat geen
enkele admin-UI-flow ooit deed en ook nooit zou kunnen doen. `src/templates/registry.ts`, `src/templates/types.ts`
en het enige PoC-template (`vastgoed-de-meester/wuustwezel-single.tsx`) zijn verwijderd,
`agency_templates.template_key` is gedropt (`0018_drop_template_key.sql`) — geen enkele rij had deze ooit ingevuld
staan.

**Belangrijke afweging — geen sandbox.** De geplakte code draait client-side, ook in de browser van
agency-gebruikers zodra zij een post maken met die template. `new Function`-uitvoering is géén echte sandbox:
gecompileerde code heeft ambient toegang tot browser-globals (`window`/`fetch`/`document`). Dit is aanvaard omdat
enkel `super_admin` templates mag schrijven (afgedwongen door `requireRole` + RLS — alleen super_admin heeft
INSERT/UPDATE op `agency_templates`), en die rol heeft toch al onbeperkte platformtoegang. Geen extra
iframe/worker-isolatie in deze MVP — dat zou nodig worden als de trustgrens ooit verlaagd wordt (bv. als kantoren
ooit zelf templates zouden mogen schrijven, wat expliciet **niet** de bedoeling is).

Elke template krijgt een naam die voor het kantoor duidelijk maakt waarvoor hij dient (bv. "Nieuw pand",
"Verkocht/verhuurd", "Prijswijziging"). `config` (jsonb) bepaalt de huisstijl van die ene template: merkkleuren,
CTA-tekst, badge-tekst, zichtbare velden — ingesteld door de admin, niet door het kantoor.

`billable_type`/`included_in_plan` blijven bestaan als facturatiemetadata (`included` vs. `regie`, in te stellen
bij het aanmaken), maar worden bewust **niet** getoond in het klantdashboard — `listActiveAgencyTemplatesForCustomer`
haalt enkel de klant-relevante kolommen op.

**Custom fonts — per kantoor, niet per template.** `agencies.custom_font_url`/`custom_font_family`
(`0012_agency_custom_font.sql`) worden ingesteld op `/admin/agencies/[id]/settings` via `FontUploader.tsx`
(zelfde upload-patroon als `LogoUploader.tsx`, naar de `agency-fonts`-Storage-bucket). Geldt voor **alle**
templates van dat kantoor tegelijk, DB-string of git-beheerd — geen per-template instelling. Het font stroomt mee
in `TemplateRenderProps` (`buildTemplateRenderProps()`, `src/lib/template-render.ts`) en wordt centraal
geïnjecteerd door `DynamicTemplateRenderer.tsx` als een `@font-face`/`--font-brand`-`<style>`-blok, ongeacht welk
renderpad. Een template gebruikt het gewoon via de vaste, altijd-beschikbare `.font-brand`-klasse
(`globals.css`) — géén Tailwind-utility (die kan immers nooit een runtime-geüploade font-URL kennen), gewoon
plain CSS die al in het globale stylesheet zit.

**Templateversiebeheer — enkel voor `component_source`-templates.** Elke geslaagde
`validateAndPublishTemplate()` (`src/services/templates/templateValidationService.ts`) slaat een snapshot op in
`agency_template_versions` (`0013_template_versions.sql`, oplopend versienummer per template). Een scene-template
heeft geen `component_source` om te snapshotten en slaat dus nooit zo'n snapshot op. In `TemplateForm.tsx` (enkel
`mode="edit"`) kan de admin op een versie klikken om die terug in de editor te laden
(`setSource`/`setSlideCount`, zelfde client-side patroon als de starter-knoppen) — dat overschrijft de live
template pas na opnieuw expliciet opslaan/valideren, nooit meteen.

**Vaste-layout regel:** het kantoor kan de template-broncode **nooit** wijzigen. Bij het maken van een post kan de
gebruiker enkel: titel/beschrijving op de visual koppelen aan een pandveld naar keuze of handmatig invullen (zie
"Databinding" hieronder), het bijschrift schrijven, een foto uit de pandfoto's kiezen, het platform kiezen, en
datum/uur kiezen. Nooit: de broncode zelf, merkkleuren, logo, CTA-/badge-tekst.

`/admin/agencies/[id]` toont primair de templatelijst van dat kantoor (klikken op een kantoor moet meteen de
templates tonen, niet instellingen) — `/admin/agencies/[id]/settings` is de aparte, secundaire pagina voor
Huisstijl (logo/website), CRM-koppeling, Meta-koppeling en "Kantoor verwijderen". Admin-flow voor een nieuw kantoor
(`/admin/agencies/new` → `/admin/agencies/[id]`): kantoor aanmaken → CRM- en Meta-koppeling configureren op
`/admin/agencies/[id]/settings` (`CrmConnectionForm`/`MetaConnectionForm`, zie hieronder) → templates schrijven op
`/admin/agencies/[id]/templates/new` (starter kiezen of vanaf nul, code + huisstijl) → preview bekijken met een
echt pand (`/admin/agencies/[id]/templates/[templateId]/preview`) → activeren op `/admin/agencies/[id]`.

### Databinding (per post)

Op `/dashboard/create-post/[propertyId]` kan de gebruiker per tekstveld op de visual (titel, beschrijving) kiezen
waar de tekst vandaan komt: een willekeurig pandveld (`BINDABLE_PROPERTY_FIELDS` in `src/lib/field-binding.ts` —
titel, locatie, beschrijving, prijs, type, slaapkamers, badkamers, oppervlakte, status) of "Handmatig invullen".
`resolvePropertyField()` zet de gekozen bron om naar de uiteindelijke tekst; welke bron gekozen werd, wordt mee
opgeslagen in `post_slides.text_content` (`titleSource`/`descriptionSource`) voor traceerbaarheid — er is geen
aparte tabel voor nodig.

### Canvas-formaat per post — "Standaard (4:5)" vs "Origineel formaat"

Elke gerenderde post stond tot `0014_post_canvas_mode.sql` vast op een 1080x1350-canvas (4:5), hardcoded op vijf
plekken buiten de templates zelf. Bij een template kan de gebruiker nu kiezen (stap "5. Formaat", enkel zichtbaar
bij `mode === "template"` in `CreatePostForm.tsx`) tussen dat standaardformaat en "Origineel formaat": het canvas
volgt dan de brontfoto's eigen beeldverhouding, zonder bijsnijden. **Geen enkele template moest hiervoor aangepast
worden** — alle templates (starters én de git-beheerde `wuustwezel-single.tsx`) positioneren overlays al
hoogte-relatief (Flexbox/percentages, `AutoSizeText`) met een full-bleed `object-cover`-achtergrondfoto; wanneer de
buitenste wrapper exact de foto's eigen verhouding krijgt, snijdt `object-cover` wiskundig niets af. De
vaste-canvas-aanname zat uitsluitend *buiten* de templates: `ScaledTemplateCanvas.tsx`'s `NATIVE_HEIGHT`, de
Puppeteer-`defaultViewport`, en de `render-slide`-pagina's wrapper-`<div>` — die drie zijn nu allemaal `canvas_mode`-
bewust. `templateValidationService.ts`/`render-template`-pagina (templatevalidatie, geen specifieke post/foto) en
`TemplateDefinition`/`registry.ts`'s literal `1080`/`1350`-types blijven **bewust ongewijzigd**: validatie
certificeert de code tegen één vaste referentie-canvas, en aangezien templates al hoogte-relatief zijn bewijst dat
ook correctheid op een andere runtime-hoogte.

`property_images` slaat geen breedte/hoogte op — de brontfoto's natuurlijke afmetingen worden client-side gemeten
via de `onLoad`-handler van de al-geladen thumbnail (`naturalWidth`/`naturalHeight`, gratis, geen nieuwe
dependency) en eenmalig opgeslagen op de **post** (`canvas_height`, niet per foto — een carrousel-met-template
hergebruikt toch al 1 foto per slide). Instagram's Content Publishing API vereist een beeldverhouding tussen 4:5 en
1.91:1; bij vaste breedte 1080px komt dat neer op een hoogte tussen 565 en 1350px. `src/lib/canvas-format.ts` klemt
dit zowel client-side (`computeClampedCanvasHeight`, voor de live preview) als server-side
(`clampCanvasHeight` in `createAndSchedulePostAction`, nooit de client-waarde blindelings vertrouwen) —
laatstgenoemde is een bereik-check, geen her-meting, want er is geen image-decode-dependency om de echte foto
server-side te herverifiëren.

"Eigen foto's"-posts (geen template) krijgen bewust **geen** `canvas_mode`-keuze: `browserRenderService.renderSlide`
slaat Puppeteer daar toch al volledig over en publiceert de brontfoto letterlijk, dus die zijn al "origineel
formaat" zonder dat er iets voor gebouwd moest worden. De enige bijhorende fix was cosmetisch:
`RawImageSlide.tsx` toonde voorheen een hardcoded `aspect-square`-preview die niet overeenkwam met wat er echt
gepubliceerd werd — toont nu de foto's gemeten werkelijke verhouding.

## Post-lifecycle en scheduling

Flow (`src/components/dashboard/CreatePostForm.tsx` → `src/app/dashboard/create-post/[propertyId]/actions.ts`):

1. Agency-gebruiker kiest een pand → `/dashboard/create-post/[propertyId]`.
2. Kiest single of carousel (altijd beide opties, ongeacht welke templates het kantoor heeft).
3. Kiest ofwel een template binnen dat type, ofwel **"Eigen foto's"** — geen template, geen branded overlay, gewoon
   de gekozen foto('s) as-is. `agency_templates`-selectie is dus optioneel (`posts.agency_template_id` is
   nullable, zie `0006_optional_template_posts.sql`).
4. Bij een template: app vult de template automatisch met panddata (`buildTemplateRenderProps`,
   `src/lib/template-render.ts` — bewust *niet* `"server-only"` zodat zowel de server-side render als de live
   client-side preview exact dezelfde mapping gebruiken). Bij "Eigen foto's": `buildRawPhotoRenderProps` (zelfde
   bestand) — enkel `images` doet er toe, er is geen overlay om te vullen.
5. Bij een template: gebruiker koppelt titel/beschrijving aan een pandveld naar keuze of vult ze handmatig in (zie
   "Databinding" hierboven). Het bijschrift wordt in beide gevallen geschreven.
6. Foto('s): single → 1 foto; carousel-met-template → 1 foto (hergebruikt per slide); carousel-"eigen foto's" →
   meerdere foto's, klikvolgorde bepaalt slide-volgorde (badge per foto).
7. Live preview: `PhonePreview` (`src/components/dashboard/PhonePreview.tsx`) toont een iPhone-mockup met een
   Instagram/Facebook-toggle (`InstagramPostMock`/`FacebookPostMock`). `componentSource` is `string | null` — bij
   `null` (eigen foto's) renderen die mocks `RawImageSlide` (`src/components/templates/RawImageSlide.tsx`) in
   plaats van `DynamicTemplateRenderer`.
8. Kiest Facebook en/of Instagram.
9. Kiest datum/uur, **of "Nu posten"** — of vertrekt vanaf een klik op een dag in het kalenderoverzicht
   (`/dashboard`, `PostCalendar.tsx`), die dan al voorgeselecteerd staat (via `?date=` doorgegeven t/m de
   pandkeuze).
10. `postSchedulerService.createPost()` — maakt `posts` (status `draft`, `agency_template_id` null bij eigen
    foto's) + `post_slides` aan (1 slide per gekozen foto).
11. `createAndSchedulePostAction` zet `posts.status = 'pending_render'` + `scheduled_at`, en redirect meteen naar
    `/dashboard/scheduled?created=1` (`PostCreatedToast` toont een "wordt verwerkt"-melding) — het eigenlijke
    renderen/publiceren gebeurt niet meer in dezelfde request (zie "Achtergrond-queue voor renderen" hieronder).

**"Nu posten"** (toegevoegd 2026-07-14, `CreatePostForm.tsx`'s toggle naast de datum/uur-kiezer): `scheduled_at`
wordt dan bewust `null` in plaats van een toekomstig tijdstip, en dat `null` stroomt letterlijk door tot in
`facebookPublishingService`/`instagramPublishingService` — Facebook publiceert automatisch onmiddellijk als
`scheduled_publish_time` ontbreekt, en `instagramPublishingService.schedule()` had toch al een
directe-publish-fallback (`publishPhotoNow()`) voor wanneer er geen `scheduledAt` is. **Cruciale valkuil, echt
tegengekomen**: `null` moet een echte `null` blijven, nooit vervangen worden door een `new Date().toISOString()`
("dichtbij nu")-fallback — Facebook weigert `scheduled_publish_time` binnen de 10 minuten, dus zo'n fallback zou
"nu posten" alsnog laten falen. Precies dat gebeurde oorspronkelijk in zowel `postQueueService.processPendingPost()`
als `postSchedulerService.retryPublish()` (beide hadden een `?? new Date().toISOString()`-fallback voor een
ontbrekend `scheduled_at`) — beide gefixt om `null` gewoon door te geven. Bij "nu posten" wordt
`post_jobs.status`/`posts.status` bij succes meteen `published` gezet (niet `scheduled`), want er is niets meer om
op te wachten.

**Statusflow:** `draft → pending_render → rendering → rendered → scheduled → published`, met twee foutstatussen
die elk hun eigen herstelactie hebben: `render_failed` (`RenderFailedActions.tsx` — "Opnieuw proberen" of "Toch
originele foto gebruiken") en `publish_failed` (`PublishFailedActions.tsx` — enkel "Opnieuw proberen";
`postSchedulerService.retryPublish()`, nodig omdat `reschedulePost()` enkel jobs met een reeds bestaand
`meta_object_id` bijwerkt, niet een job die van bij de eerste `schedule()`-poging al geweigerd werd).
`cancelled` bij annuleren. `/dashboard/scheduled` heeft 3 tabbladen: "Ingepland" (alles behalve `published`/mislukt),
"Gepubliceerd", en "Mislukt" (`render_failed`/`publish_failed`/legacy `failed`) — dat laatste met een rood
cirkel-badge met het aantal, zodat mislukte posts opvallen zonder de "Ingepland"-lijst te moeten doorlopen.

RLS-detail: agency-gebruikers mogen `post_jobs` aanmaken (INSERT) wanneer ze plannen, maar **niet** de status
achteraf wijzigen (UPDATE is `super_admin`/service-role only) — dat simuleert een echte Meta-webhook die de
publicatiestatus later bijwerkt, niet de browser-sessie van de gebruiker. Concreet raakt dit elke functie in
`postSchedulerService.ts` die een bestaande `post_jobs`-rij update (`retryPublish`, `reschedulePost`): die
gebruiken daarvoor expliciet `createAdminClient()`, niet de sessie-client — anders faalt de update stil (geen
error, gewoon 0 rijen geraakt), wat tijdens het bouwen van `retryPublish` ook echt zo gebeurde.

**Belangrijke correctie (2026-07-14):** `publishPost()`/`retryPublish()` zetten `posts.status = 'publish_failed'`
op basis van of **minstens één** platform mislukte, niet enkel wanneer **alle** platforms mislukten — de oude
`alle mislukt`-check liet een gedeeltelijke mislukking (bv. Facebook gelukt, Instagram niet) gewoon op
`scheduled` staan, waarna `publishReconciliationService.ts` die later stilzwijgend naar `published` zette zodra
het wél-gelukte platform bevestigd werd (die query filtert enkel op `post_jobs.status = 'scheduled'`, en ziet de
mislukte job dus nooit). Dezelfde bugklasse zat ook in `instagramSchedulerSweepService.ts`'s
`updatePostAggregateStatus` en is daar identiek gefixt.

### Meldingen bij mislukte posts

`postFailureNotificationService.ts`'s `notifyPostFailure(postId, "render" | "publish", reason)` stuurt via Resend
(`src/lib/resend.ts`, kale `fetch()` naar `https://api.resend.com/emails`, geen SDK — zelfde stijl als
`src/lib/qstash.ts`) een mail naar elke gebruiker van het kantoor zodra een post `render_failed`/`publish_failed`
wordt — vroeger enkel zichtbaar als iemand toevallig het dashboard bekeek. Aangeroepen op elke plek waar die
status effectief gezet wordt: `renderService.ts`, de lazy stale-rendering-reconciliatie in
`postDetailService.ts`, `postSchedulerService.ts`'s `publishPost()`/`retryPublish()`, en
`instagramSchedulerSweepService.ts`'s `updatePostAggregateStatus`. E-mailadressen komen van `auth.users` (niet
`profiles`, dat heeft er geen) via `admin.auth.admin.getUserById()` per profiel van het kantoor. Volledig
best-effort: elke fout (ontbrekende `RESEND_API_KEY`, Resend zelf onbereikbaar, ...) wordt gelogd en geslikt — een
mislukte melding mag nooit de render-/publiceerflow zelf laten falen. Bewust geen dedupe: een opnieuw mislukte
retry stuurt gewoon opnieuw een mail.

### Achtergrond-queue voor renderen

Renderen (headless-Chromium screenshot, zie "Echte beeldcompositie" hieronder) gebeurt niet meer synchroon binnen
`createAndSchedulePostAction`'s request. Reden: het project draait op **Vercel Hobby**, waar cron-jobs maximaal
1x per dag mogen draaien — een cron-gebaseerde queue zou renders tot 24u kunnen laten wachten, dus geen optie.
In plaats daarvan:

1. De post-aanmaak-action zet `posts.status = 'pending_render'` en triggert via `after()` (`next/server`) een
   niet-afgewachte `fetch()` naar `src/app/api/internal/process-post-queue/route.ts` — draait daardoor in een
   **eigen serverless functie-instantie** met een eigen volledig tijdsbudget, terwijl de aanmaak-request meteen
   kan redirecten. `after()` is bewust gebruikt i.p.v. een kale `void fetch(...)`: die laatste raakt in een
   servomgeving een race tegen de functie die net na de `redirect()` bevriest/afgesloten wordt vóór de fetch
   effectief vertrekt.
2. Die route is geautoriseerd met een HMAC-token (`src/lib/queue/token.ts`, zelfde patroon als
   `src/lib/render/token.ts`) — server-to-server, geen gebruikerssessie.
3. `src/services/posts/postQueueService.ts` (`processPendingPost`) doet het eigenlijke werk: claimt de post met
   een conditionele update (`status='rendering' WHERE status='pending_render'`, voorkomt dubbel verwerken bij een
   race), rendert (`renderPostForScheduling`), en publiceert bij succes (`publishPost`).
4. **Veiligheidsnet**, geen cron: `postDetailService.ts` reconciliet lazily — als een post nog >20s op
   `pending_render` staat wanneer de detailpagina bekeken wordt (fire-and-forget-trigger nooit aangekomen), roept
   die pagina zelf `processPendingPost` aan met de gewone sessie-client. Bewust **niet** toegevoegd aan de
   lijst-/kalenderpagina's — die mogen niet enkel door bekeken te worden al zwaar renderwerk starten.
5. Zelfde lazy-reconciliatie-idee, twee losstaande stale-checks in dezelfde functie: een post die te lang
   (>3 min) op `rendering` blijft staan (afgebroken request, crash buiten `browserRenderService`'s eigen
   try/catch) springt naar `render_failed`; een post die te lang (>3 min) op `publishing` blijft staan (de
   "nu posten"-tussenstatus uit `postSchedulerService.publishPost()`) springt naar `publish_failed`. Beide
   drempels ruim boven wat een gezonde run nodig heeft (respectievelijk de render-pipeline's eigen 2×15s-retrybudget
   en een handvol synchrone Graph API-calls), dus geen normale wachttijd. Geldt niet voor de aparte, korter-levende
   `post_jobs`-niveau "publishing"-claim tijdens de Instagram-sweep (`instagramSchedulerSweepService.ts`) — die
   heeft al zijn eigen conditionele claim-guard.

`renderPostForScheduling()` en `publishPost()` (en de `MetaPublishingService`-interface-methodes
`schedule`/`reschedule`/`checkPublishStatus`) accepteren daarom een **optionele** Supabase-client-parameter: de
gewone aanroepen (retry-acties, UI-flows) laten hem weg (valt terug op de sessie-client), de queue-route geeft
expliciet `createAdminClient()` door omdat er geen sessie is.

## Mock services → toekomstige echte integraties

| Service | Nu | Later |
|---|---|---|
| `crmMockService` (`src/services/crm/`) | Leest `src/data/mock/properties.ts`, `syncAgencyPropertiesFromCrm()` schrijft naar `properties`/`property_images` | Vervang de implementatie van de `CrmService`-interface door een echte provider (Whise, Immoweb, ...); de sync-functie en het datamodel blijven ongewijzigd |
| `facebookPublishingService` (`src/services/meta/`) | **Echt**, inclusief carrousel/multi-foto-posts (`attached_media`, zie hieronder) — roept de Graph API rechtstreeks aan | — |
| `instagramPublishingService` (`src/services/meta/`) | **Echt**, inclusief carrousel/multi-foto-posts (`CAROUSEL`-container, zie "Instagram-scheduling" hieronder) | — |
| `metaAuthService` (`src/services/meta/metaAuthService.ts`) | **Echt**, voor zowel Facebook als Instagram (authorization URL + volledige token exchange, inclusief Instagram-scopes) | — |
| CRM-configuratie | Admin vult `provider`/`config` rechtstreeks in via `CrmConnectionForm` op `/admin/agencies/[id]/settings` | CRM-config-velden worden providerspecifiek zodra een echte CRM-integratie gekozen is |

### Meta (Facebook + Instagram) integratie — beide echt

`super_admin` klikt "Verbind met Facebook" op `/admin/agencies/[id]/settings` (`startMetaConnectAction`,
`src/app/admin/agencies/actions.ts`) → `metaAuthService.buildAuthorizationUrl()` bouwt de Facebook OAuth-dialoog-URL
met een HMAC-ondertekende `state`-param (`src/lib/meta/state.ts`) die het `agencyId` vastlegt. Wie het
toestemmingsscherm doorloopt hoeft **niet** ingelogd te zijn in Leadmore Social — de callback-route
(`src/app/api/meta/callback/route.ts`, de eerste Route Handler in dit project) vertrouwt op die ondertekende
`state`, niet op `requireRole()`, en schrijft met de service-role admin-client naar `social_connections` — een
trusted backend-stap, geen gebruikersactie (zelfde redenering als `instagramSchedulerSweepService.ts`).

`metaAuthService.handleOAuthCallback()` doorloopt de volledige exchange: code → short-lived user token →
long-lived user token → Page-token via `/me/accounts` → gekoppeld Instagram-account via
`?fields=instagram_business_account`. **Bewuste MVP-vereenvoudiging:** als het account meerdere Pages beheert,
wordt de eerste uit `/me/accounts` gebruikt — geen Page-kiezer in v1.

**Bevestigd via handmatig testen:** een Pagina die onder een **Business Portfolio** valt, surfacet soms niet via
`/me/accounts`, zelfs met `pages_show_list` correct "granted" (zichtbaar via `/me/permissions`) én de Pagina expliciet
als bedrijfsmiddel aan de app gekoppeld in Business Settings. Een standalone Pagina (aangemaakt via gewoon
facebook.com, niet via business.facebook.com) werkte meteen. Grondoorzaak niet volledig uitgeklaard — mogelijk
vereist dit Business Verification of een correcte taak-toewijzing op Pagina-niveau (los van de app-toewijzing) in
Business Manager. Relevant om vooraf te weten bij het onboarden van kantoren: hun Pagina kan in de praktijk
onder een Business Portfolio vallen.

### Tweede koppelmethode: Business Manager / System User

Voor Pagina's binnen een Business Portfolio, als alternatief voor de personal-OAuth-flow hierboven:
`metaAuthService.connectViaBusinessManager(facebookPageId)` gebruikt Leadmore's eigen **System User**-token
(`META_SYSTEM_USER_TOKEN`) om rechtstreeks `GET /{page-id}?fields=access_token,instagram_business_account` aan te
roepen — geen OAuth-redirect, geen per-kantoor consentscherm. **Vereist wel een handmatige, kantoor-kant stap die
geen enkele API kan vervangen:** het kantoor moet hun Pagina eerst delen met Leadmore's Business Manager als
partner. Pas daarna kan de admin in `BusinessManagerConnectForm`
(`src/components/admin/BusinessManagerConnectForm.tsx`, op `/admin/agencies/[id]/settings` onder de gewone
"Verbind met Facebook"-knop) het Facebook-pagina ID invullen via `connectAgencyViaBusinessManagerAction`
(`src/app/admin/agencies/actions.ts`) — schrijft naar dezelfde `social_connections`-tabel, dus
`facebookPublishingService` werkt ongewijzigd verder ongeacht welke van de twee methodes gebruikt werd.

**Belangrijke opmerking, geleerd tijdens het écht doorlopen van deze flow (2026-07-14):** Meta's UI koppelt
tegenwoordig **elke** Facebook-pagina waaraan een Instagram-account gekoppeld wordt automatisch aan een Business
Portfolio, ook een voorheen "onafhankelijke" pagina — deze koppelmethode is dus in de praktijk vaker nodig dan
"uitzondering voor Business Portfolio's" doet vermoeden. `META_SYSTEM_USER_TOKEN` aanmaken vereist meer stappen dan
enkel "Business Settings → System Users → Generate New Token":
1. Systeemgebruiker aanmaken in **Leadmore's eigen** Business Manager (niet die van het kantoor).
2. De systeemgebruiker expliciet een rol geven **op de app zelf** (Business Settings → Apps → de app → "Mensen
   toewijzen") — de app enkel toevoegen aan het business-account volstaat niet; zonder deze stap geeft
   token-generatie "Geen toestemmingen beschikbaar."
3. Het kantoor deelt hun Pagina als partner met Leadmore's Business Manager (vanuit *hun* portfolio, Business
   Settings → Pages → Partner toevoegen → Leadmore's Business Manager-ID).
4. De systeemgebruiker moet **ook** expliciet een rol krijgen op die specifieke Pagina, vanuit Leadmore's eigen
   Business Settings → Pagina's → de nu-zichtbare gedeelde pagina → "Mensen toewijzen." Overslaan van deze stap
   geeft `(#10) This endpoint requires the 'pages_read_engagement' permission...` bij het effectief koppelen, óók
   al staat die permissie wel aangevinkt op de token zelf — de permissie heeft dan gewoon niets om op toe te
   passen.
5. Pas daarna zijn `pages_show_list`/`pages_manage_posts`/`pages_read_engagement`/`instagram_basic`/
   `instagram_content_publish` allemaal aanvinkbaar bij het genereren van het token.

Stap 1, 2 en 5 zijn eenmalig voor Leadmore als geheel (al gebeurd). Stap 3 en 4 herhalen zich per kantoor. Om dat
draaglijk te houden staat `BusinessManagerConnectForm` intussen niet meer enkel het invulveld, maar een uitklapbare
stap-voor-stapgids (met per-kantoor-afvinklijst, bewaard in `localStorage`, puur als geheugensteun — niets
server-side hangt hiervan af) én een read-only veld met Leadmore's Business Manager-ID (optionele env-var
`META_BUSINESS_MANAGER_ID`, `src/lib/meta/env.ts`) met een kopieerknop, zodat de admin die niet uit het hoofd hoeft
te kennen bij het doorgeven aan een kantoor.

**Meta Business Verification doorlopen, hypothese ontkracht (2026-07-14).** Leadmore's Business Manager-account is
inmiddels geverifieerd (Business Settings → Security Centre → "Start Verification"). De hypothese was dat dit de
gewone, eenvoudige OAuth-flow (personal-flow hierboven) ook voor Business-Portfolio-Pagina's betrouwbaar zou laten
werken, wat de Business Manager-omweg voor toekomstige kantoren overbodig zou maken. **Getest met een echte
Business-Portfolio-Pagina na Verification — nog steeds dezelfde fout** ("Dit Facebook-account beheert geen enkele
Pagina (of enkel Pagina's binnen een Business Portfolio — probeer een standalone Pagina)"). Business Verification
lost het `/me/accounts`-surfacing-probleem dus **niet** op — de Business Manager/System User-koppelmethode
hieronder blijft de permanente, noodzakelijke weg voor elk kantoor waarvan de Pagina in een Business Portfolio zit
(in de praktijk vrijwel elk kantoor met Instagram gekoppeld, zie hierboven). Verification blijft wel relevant als
voorwaarde voor Meta App Review (zie BACKLOG.md), dat is een apart traject.

Tokens worden versleuteld opgeslagen (`src/lib/token-encryption.ts`, AES-256-GCM) — ook het handmatige token-veld
in `MetaConnectionForm` gaat nu door `encryptToken()`; het veld toont nooit een opgeslagen token terug (leeg laten
= huidig token behouden, zie `updateAgencyMetaConnectionAction`). `facebookPublishingService.schedule()` ontsleutelt
het Page-token en post naar `POST /{page-id}/photos` met `published=false` + `scheduled_publish_time` — Facebook
plant de post zelf in, er is geen eigen achtergrond-job voor nodig (in tegenstelling tot Instagram, zie hieronder).

**Carrousels (2026-07-14)**: `createScheduledPost` (voorheen `createScheduledPhotoPost`) vertakt op
`imageUrls.length`. Bij 1 foto ongewijzigd het directe `/photos`-pad. Bij >1 foto: elke foto wordt eerst
ongepubliceerd geüpload (`POST /{page-id}/photos?published=false&url=<url>`, parallel via `Promise.all`, enkel om
een `media_fbid` te krijgen — verschijnt zelf nooit los op de Pagina), en dan één `POST /{page-id}/feed` met
`attached_media=[{"media_fbid":"..."},...]` + dezelfde `published`/`scheduled_publish_time`-logica als vandaag.
`schedule()` en `reschedule()` geven nu het volledige `request.imageUrls` door i.p.v. enkel `imageUrls[0]`.

### Instagram-scheduling — echte publicatie via een eigen QStash-scheduler

Instagram's Content Publishing API kent geen `scheduled_publish_time`-equivalent — `media_publish` publiceert
altijd onmiddellijk. `instagramPublishingService.schedule()` doet daarom **geen** Graph API-call zodra
`scheduledAt` in de toekomst ligt: enkel de `social_connections`-rij valideren, en een QStash-wake-up-call
inplannen (`src/lib/qstash.ts`, `scheduleInstagramSweep()` — kale `fetch()` naar QStash's publish-to-URL-endpoint
met een `Upstash-Not-Before`-header, geen SDK nodig om te versturen). `post_jobs.meta_object_id` blijft bewust
`null` tot de post écht gepubliceerd is.

Op het afgesproken tijdstip roept QStash `POST /api/internal/instagram-sweep` aan (handtekening geverifieerd via
het officiële `@upstash/qstash`-`Receiver`-package, niet zelf-gebouwde HMAC-verificatie — JWT-verificatie correct
herbouwen is foutgevoeliger dan de officiële library gebruiken). Die route roept enkel
`instagramSchedulerSweepService.publishDueInstagramPosts()` aan, die **alles** publiceert wat op dat moment klaar
staat (`post_jobs` met `platform='instagram', status='scheduled', scheduled_at <= now()`), niet enkel de ene post
die de wake-up triggerde — bewust zo ontworpen zodat de route zelf niet weet/kan weten wie hem aanriep of waarom.
Dat maakt een latere overstap naar een Vercel Pro-cron (elke minuut, i.p.v. QStash) een kwestie van enkel de
trigger vervangen — de publiceerlogica zelf blijft volledig ongewijzigd.

Per due job: conditioneel geclaimd (`status → 'publishing'`, voorkomt dubbel verwerken bij een race tussen twee
sweep-aanroepen — zelfde patroon als `postQueueService.processPendingPost`'s render-claim), dan de echte
twee-staps flow (`POST /{ig-id}/media` → `POST /{ig-id}/media_publish`), dan `post_jobs.status = 'published'` met
het echte IG-media-id. Waarom **niet** de container meteen bij het inplannen aanmaken: Instagram media-containers
zijn niet oneindig geldig, en een post die dagen vooruit ingepland wordt zou dan een verlopen container tegenkomen
op het eigenlijke publicatiemoment.

**Carrousels (2026-07-14)**: `publishPhotoNow` neemt nu `imageUrls: string[]` i.p.v. één `imageUrl`. Bij 1 foto
ongewijzigd het directe container→publish-pad. Bij >1 foto: per foto een `is_carousel_item=true`-container
(`POST /{ig-id}/media`), **parallel** aangemaakt én parallel gepolld via `waitForContainerReady` — belangrijk voor
het gedeelde 60s Hobby-plan-tijdsbudget van de sweep, sequentieel zou bij 4+ foto's dat budget kunnen
overschrijden. Dan één ouder-container (`media_type=CAROUSEL`, `children=<id1,id2,...>`), zelf ook gepolld, en pas
dan `media_publish` met die ouder-container-id. `instagramSchedulerSweepService.ts` geeft nu alle slides door, niet
enkel `slides?.[0]`.

**Echte carrousel-test, echte bug gevonden en gefixt (2026-07-14)**: een live 2-foto-carrousel via "nu posten" —
Facebook lukte, Instagram faalde met `(#9004) Media ID is not available`, ondanks dat `waitForContainerReady` het
ouder-`CAROUSEL`-container vooraf als `FINISHED` had gezien. Verklaring: dat ouder-container heeft zelf geen
afbeelding om te verwerken (enkel `children`-referenties), dus Meta zet `status_code` daar vrijwel meteen op
`FINISHED` — geen betrouwbaar signaal dat `media_publish` ook effectief zal lukken, exact dezelfde raceconditie als
bij losse foto's, maar niet volledig afgedekt door enkel de vooraf-poll. `publishContainer()` retryt nu tot 4x
(2s ertussen) specifiek op Graph API-foutcode `9004`, i.p.v. enkel op de vooraf-check te vertrouwen — geldt voor
zowel het losse-foto- als het carrousel-publiceerpad (gedeelde functie).

**Belangrijk gevolg voor "Bewerken" (nieuwe datum/uur)**: `postSchedulerService.reschedulePost()` sloeg vroeger elke
job zonder `meta_object_id` gewoon over (correct voor Facebook, waar dat altijd "mislukt" betekent) — voor
Instagram betekent een ontbrekend `meta_object_id` net "succesvol ingepland, nog niet gepubliceerd." De
skip-conditie is daarom `job.status === 'failed'` geworden, niet `!meta_object_id`; anders zou een nieuw
datum/uur stilzwijgend genegeerd worden en de post alsnog op het oude tijdstip publiceren.

`checkPublishStatus()` doet voor Instagram geen Meta-call — de sweep is zelf de bron van waarheid, dus
`post_jobs.status` is al correct op het moment dat `meta_object_id` gezet wordt.

**Nieuwe env-vars** (zie "Lokale setup"): `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`,
`TOKEN_ENCRYPTION_KEY`, optioneel `META_SYSTEM_USER_TOKEN` (enkel voor de Business Manager-koppelmethode
hierboven), en voor Instagram-scheduling `QSTASH_URL`/`QSTASH_TOKEN`/`QSTASH_CURRENT_SIGNING_KEY`/
`QSTASH_NEXT_SIGNING_KEY` (gratis account op upstash.com → QStash — `QSTASH_URL` is regio-specifiek sinds
Upstash multi-region ondersteunt, bv. `https://qstash-eu-central-1.upstash.io`, geen vaste URL voor elk account).
Zonder deze vars blijft de app gewoon bouwen/draaien (zelfde lazy-`readEnv()`-patroon als de Supabase-vars) —
enkel de betrokken koppeling zelf faalt dan met een duidelijke foutmelding i.p.v. een cryptische crash.

Alle mock-vervangingen raken enkel bestanden in `src/services/**` — de rest van de app (pagina's, services die
ervan afhangen zoals `postSchedulerService`) blijft ongewijzigd omdat alles achter de `CrmService` /
`MetaPublishingService` interfaces (`src/types/domain.ts`) is geschreven.

### Echte beeldcompositie

`renderPostForScheduling()` (`src/services/render/renderService.ts`) roept nu `browserRenderService` aan i.p.v. de mock: voor
elke slide van een post mét template wordt een headless Chromium-instantie (`puppeteer-core` +
`@sparticuz/chromium`, de Vercel/Lambda-compatibele combinatie) naar een **interne, ongeauthenticeerde pagina**
gestuurd (`src/app/internal/render-slide/[postId]/[slideIndex]/page.tsx`) die exact `DynamicTemplateRenderer`
toont — dezelfde component als de live preview, dus geen enkele template hoeft aangepast te worden. Satori/
`@vercel/og` viel af als alternatief: dat rendert enkel inline `style`-objecten, geen Tailwind-classNames — en elk
admin-template is met Tailwind geschreven (vast schrijfcontract, zie hierboven).

Autorisatie voor die interne pagina loopt niet via `requireRole()` (Puppeteer benadert 'm server-naar-server,
geen gebruikerssessie) maar via een HMAC-ondertekend `?token=` (`src/lib/render/token.ts`, zelfde patroon als de
Meta OAuth `state`-param). De screenshot wordt geüpload naar de al bestaande `rendered-posts`-bucket
(`0002_storage.sql`) en die URL komt in `post_slides.rendered_image_url` — `publishPost()`/`reschedulePost()`
gebruiken die kolom (met fallback op `image_url`) voor de Meta-publish-call i.p.v. de kale brontfoto.

**Betrouwbaarheid**: tot 3 renderpogingen met backoff bij een mislukking, en als het na alle pogingen nog steeds
faalt, valt de pipeline terug op de brontfoto in plaats van `publishPost()` te laten crashen — een mislukte
render mag nooit een post blokkeren. Die fallback is wel zichtbaar: `hasRenderFallback`
(`src/services/posts/postDetailService.ts`, gedetecteerd via `rendered_image_url === image_url` op een slide van
een post mét template) toont een waarschuwing op de post-detailpagina i.p.v. stilzwijgend een ongebrande post de
deur uit te laten gaan.

**Nieuwe env-var**: `NEXT_PUBLIC_SITE_URL` (absolute URL van de app zelf, nodig omdat Puppeteer niet relatief kan
navigeren — op Vercel automatisch afgeleid van `VERCEL_URL` als fallback). Optioneel voor lokale dev:
`CHROME_EXECUTABLE_PATH` (`@sparticuz/chromium`'s binary is Lambda-only, lokaal wordt een systeem-Chrome gebruikt).

## Lokale setup

1. `cp .env.local.example .env.local` en vul een Supabase-project in (URL, publishable/anon key, secret/service
   role key — te vinden onder Project Settings → API Keys).
2. Voer de migraties in `supabase/migrations/` **in volgorde** uit tegen dat project (SQL editor, `scripts/run-migration.ts`,
   of Supabase CLI):
   `0001_init.sql` → `0002_storage.sql` → `0003_grants.sql` (nodig omdat sommige nieuwe Supabase-projecten geen
   standaard tabelrechten meer geven aan `anon`/`authenticated`/`service_role` voor tabellen die je zelf via SQL
   aanmaakt — zonder deze migratie krijg je `permission denied for table ...` zodra `npm run seed` draait) →
   `0004_template_restructure.sql` (schrapt `template_blueprints`, voegt `properties.listed_at` toe, verstrakt
   `social_connections`-rechten tot super_admin-only) → `0005_dynamic_templates.sql` (schrapt `layout_key` en de
   `layout_key`-domain, voegt `component_source`/`slide_count` toe aan `agency_templates`) →
   `0006_optional_template_posts.sql` (maakt `posts.agency_template_id` optioneel, voor "eigen foto's"-posts zonder
   template) → `0007_template_validation.sql` (vervangt `is_active` door een `template_status`-enum plus
   `compiled_css`/`validated_at`/`validation_error`, voor de Fase 1-validatieflow) →
   `0008_post_lifecycle.sql` (voegt `pending_render` toe aan `post_status` en `posts.platforms`) →
   `0009_property_listing_type.sql` (voegt `properties.listing_type` toe — "te koop" vs. "te huur", los van
   `property_type`/`status`) → `0010_instagram_scheduling.sql` (voegt `'publishing'` toe aan `post_status`, de
   claim-status tijdens de Instagram-sweep) → `0011_template_registry_key.sql` (voegt `agency_templates.template_key`
   toe, nullable — het git-beheerde templatepad; sindsdien weer geschrapt, zie `0018` hieronder) →
   `0012_agency_custom_font.sql` (voegt `agencies.custom_font_url`/`custom_font_family` toe + de
   `agency-fonts`-Storage-bucket) → `0013_template_versions.sql` (nieuwe `agency_template_versions`-tabel voor
   templateversiebeheer) → `0014_post_canvas_mode.sql` (voegt `posts.canvas_mode`/`canvas_height` toe, zie
   "Canvas-formaat per post" hieronder) → `0015_agency_fonts.sql` → `0016_template_scenes.sql` →
   `0017_scene_canvas_formats.sql` → `0018_drop_template_key.sql` (dropt `agency_templates.template_key` weer —
   het git-beheerde templatepad is geschrapt, zie "Admin-geschreven React-templates" hierboven).
3. `npm run seed` — vult het project met demo-kantoren, panden, templates en posts (idempotent, veilig opnieuw te
   draaien).
4. `npm run dev`.
5. Optioneel, enkel nodig voor de echte Facebook-koppeling (zie "Meta (Facebook) integratie" hierboven): vul
   `META_APP_ID`/`META_APP_SECRET` in vanuit je Meta Developer App, `META_REDIRECT_URI` (bv.
   `http://localhost:3000/api/meta/callback`, moet exact overeenkomen met wat in het Meta-dashboard geregistreerd
   staat), en `TOKEN_ENCRYPTION_KEY` (zelf te genereren met `openssl rand -hex 32`). Zonder deze vars werkt de rest
   van de app gewoon door.
6. Optioneel, enkel nodig voor de Business Manager-koppelmethode (zie "Tweede koppelmethode" hierboven):
   `META_SYSTEM_USER_TOKEN`, aan te maken via Business Settings → System Users → Generate New Token.
7. Optioneel, enkel nodig voor echte Instagram-scheduling (zie "Instagram-scheduling" hierboven): gratis account op
   upstash.com → QStash → kies een regio (bv. EU Region) → op die regio-detailpagina staan alle vier: `QSTASH_URL`
   (regio-specifiek, bv. `https://qstash-eu-central-1.upstash.io` — géén vaste URL voor elk account), `QSTASH_TOKEN`,
   `QSTASH_CURRENT_SIGNING_KEY` en `QSTASH_NEXT_SIGNING_KEY`. Zonder deze vars blijft Facebook-scheduling gewoon
   werken; enkel het inplannen van een Instagram-post faalt dan met een duidelijke foutmelding.
8. Optioneel, enkel nodig voor e-mailmeldingen bij mislukte posts (zie "Meldingen bij mislukte posts" hierboven):
   gratis account op resend.com → `RESEND_API_KEY` + een geverifieerd verzenddomein voor `RESEND_FROM_EMAIL`.
   Zonder deze vars blijft de rest van de app gewoon werken; een mislukte post faalt nog steeds correct, er komt
   enkel geen mail.

**Demo-accounts na het seeden** (wachtwoord `Leadmore123!` voor iedereen, tenzij je `SEED_SUPER_ADMIN_EMAIL`/
`SEED_SUPER_ADMIN_PASSWORD` in `.env.local` hebt gezet — dat overschrijft enkel het super_admin-account):

| Rol | E-mail |
|---|---|
| `super_admin` | `admin@leadmore.be` |
| `agency_admin` (Vastgoed De Meester) | `admin@vastgoeddemeester.example` |
| `agency_user` (Vastgoed De Meester) | `medewerker@vastgoeddemeester.example` |
| `agency_admin` (Huys & Haard Makelaars) | `admin@huysenhaard.example` |
| `agency_user` (Huys & Haard Makelaars) | `medewerker@huysenhaard.example` |

Bron: `src/data/mock/users.ts` (`MOCK_USERS`). `npm run seed` print deze lijst ook aan het einde.

Zonder geldige Supabase-credentials bouwt en start de app nog steeds (env-fallbacks in `src/lib/supabase/env.ts`),
maar elke pagina die data ophaalt toont dan uiteraard geen echte data.
