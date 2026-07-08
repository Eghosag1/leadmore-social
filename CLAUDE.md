@AGENTS.md

# Leadmore Social — SaaS MVP voor vastgoedkantoren

## Productvisie

Vastgoedkantoren zien hun panden (via een CRM-koppeling) in één dashboard en kunnen met een paar klikken een
Facebook- en/of Instagram-post maken voor een pand — single post of carousel — in hun eigen huisstijl, en die
inplannen. Kantoren bouwen of ontwerpen zelf niets: alle templates zijn vooraf door Leadmore gemaakt. Dit is
uitdrukkelijk **geen Canva-editor en geen drag-and-drop layout builder**.

## MVP-scope

- **Wel gebouwd nu:** volledige architectuur, database schema + RLS, beide dashboards, template-rendering via
  React componenten, post-aanmaak- en planningsflow, rolgebaseerde toegang.
- **Mock, met een echte interface ervoor:** CRM-data (`crmMockService`) en Instagram-scheduling
  (`instagramPublishingService`, delegeert nog naar `mockMetaSchedulingService`). Facebook-scheduling
  (`facebookPublishingService`) is intussen **echt** — zie "Meta (Facebook) integratie" onder "Mock services"
  hieronder. Alles is geschreven achter een interface (`CrmService`, `MetaPublishingService`) zodat een echte
  integratie er telkens gewoon voor in de plaats komt.
- **Rendering:** `renderService` heeft de juiste interface maar doet nu geen echte beeldcompositie (echoot de
  brontfoto terug als "rendered" resultaat). De template-preview in de browser (de React componenten zelf) is al
  wél de echte, uiteindelijke visual.

## Technische architectuur

- **Next.js 16** (App Router, Turbopack), **TypeScript**, **Tailwind CSS**, **shadcn/ui**.
  ⚠️ shadcn/ui hier is gebouwd op **`@base-ui/react`, niet Radix**. Er bestaat geen `asChild` prop — gebruik de
  `render` prop: `<Button render={<Link href="/x" />}>Label</Button>`. Zie ook `AGENTS.md` voor Next.js 16
  breaking changes (o.a. `params`/`searchParams` zijn altijd `Promise`, en `middleware.ts` heet nu `proxy.ts` met
  een `proxy()` export — zie `src/proxy.ts`).
- **Supabase**: Postgres database, Auth en Storage. Schema + RLS-policies staan in `supabase/migrations/`. Er is
  geen Supabase CLI/Docker beschikbaar geweest in deze omgeving — migraties zijn plain `.sql`-bestanden, uit te
  voeren via de Supabase SQL editor of `supabase db push` zodra de CLI lokaal beschikbaar is.
  - `src/lib/supabase/client.ts` — browser client (RLS als ingelogde gebruiker).
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
9. Kiest datum/uur.
10. `postSchedulerService.createPost()` — maakt `posts` (status `draft`, `agency_template_id` null bij eigen
    foto's) + `post_slides` aan (1 slide per gekozen foto).
11. `postSchedulerService.schedulePost()` — rendert (`renderService`, status `rendering` → `ready`), zet
    `posts.status = 'scheduled'`, en maakt per gekozen platform een `post_jobs`-rij aan via
    `facebookPublishingService` / `instagramPublishingService` (die vandaag beide naar
    `mockMetaSchedulingService` verwijzen). Na een geslaagde redirect naar `/dashboard/scheduled?created=1` toont
    `PostCreatedToast` een bevestigingsmelding (sonner) en strip de query param meteen weer.

**Statusflow:** `draft → rendering → ready → scheduled → published`, of `failed` (met `error_message` op de
`post_jobs`-rij) als het schedulen mislukt (bv. geen actieve Meta-koppeling). `cancelled` bij annuleren.

RLS-detail: agency-gebruikers mogen `post_jobs` aanmaken (INSERT) wanneer ze plannen, maar **niet** de status
achteraf wijzigen (UPDATE is `super_admin`/service-role only) — dat simuleert een echte Meta-webhook die de
publicatiestatus later bijwerkt, niet de browser-sessie van de gebruiker.

## Mock services → toekomstige echte integraties

| Service | Nu | Later |
|---|---|---|
| `crmMockService` (`src/services/crm/`) | Leest `src/data/mock/properties.ts`, `syncAgencyPropertiesFromCrm()` schrijft naar `properties`/`property_images` | Vervang de implementatie van de `CrmService`-interface door een echte provider (Whise, Immoweb, ...); de sync-functie en het datamodel blijven ongewijzigd |
| `facebookPublishingService` (`src/services/meta/`) | **Echt** — roept de Graph API rechtstreeks aan (zie subsectie hieronder) | Carousel/multi-foto Facebook-posts (`attached_media`) — vandaag wordt enkel de cover-foto gepost, ook voor carousel-posts |
| `instagramPublishingService` (`src/services/meta/`) | Nog mock, delegeert naar `mockMetaSchedulingService` | Instagram's Content Publishing API publiceert altijd onmiddellijk (`media_publish` kent geen `scheduled_publish_time`) — vereist een eigen achtergrond-scheduler die op `scheduled_at` wacht, niet enkel een andere API-call |
| `metaAuthService` (`src/services/meta/metaAuthService.ts`) | **Echt** voor de Facebook-kant (authorization URL + volledige token exchange) | Vraagt vandaag enkel Page-scopes aan (`pages_show_list`, `pages_manage_posts`, `pages_read_engagement`) — Instagram-scopes toevoegen zodra die integratie gebouwd wordt; Meta's permissienaamgeving voor Instagram is intussen gewijzigd (`instagram_business_basic`/`instagram_business_content_publish` naast de oudere `instagram_basic`/`instagram_content_publish`), dus best de actuele Meta-documentatie erbij nemen op dat moment |
| CRM-configuratie | Admin vult `provider`/`config` rechtstreeks in via `CrmConnectionForm` op `/admin/agencies/[id]/settings` | CRM-config-velden worden providerspecifiek zodra een echte CRM-integratie gekozen is |

### Meta (Facebook) integratie — echt, Instagram nog mock

`super_admin` klikt "Verbind met Facebook" op `/admin/agencies/[id]/settings` (`startMetaConnectAction`,
`src/app/admin/agencies/actions.ts`) → `metaAuthService.buildAuthorizationUrl()` bouwt de Facebook OAuth-dialoog-URL
met een HMAC-ondertekende `state`-param (`src/lib/meta/state.ts`) die het `agencyId` vastlegt. Wie het
toestemmingsscherm doorloopt hoeft **niet** ingelogd te zijn in Leadmore Social — de callback-route
(`src/app/api/meta/callback/route.ts`, de eerste Route Handler in dit project) vertrouwt op die ondertekende
`state`, niet op `requireRole()`, en schrijft met de service-role admin-client naar `social_connections` (zelfde
vertrouwensmodel als `mockMetaSchedulingService`: een trusted backend-stap, geen gebruikersactie).

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

### Tweede koppelmethode: Business Manager / System User (branch `feature/business-manager-connect`, nog niet op main)

Voor Pagina's binnen een Business Portfolio, als alternatief voor de personal-OAuth-flow hierboven:
`metaAuthService.connectViaBusinessManager(facebookPageId)` gebruikt Leadmore's eigen **System User**-token
(`META_SYSTEM_USER_TOKEN`, aan te maken via Business Settings → System Users → Generate New Token) om rechtstreeks
`GET /{page-id}?fields=access_token,instagram_business_account` aan te roepen — geen OAuth-redirect, geen
per-kantoor consentscherm. **Vereist wel een handmatige, kantoor-kant stap die geen enkele API kan vervangen:** het
kantoor moet hun Pagina eerst delen met Leadmore's Business Manager als partner (Business Settings → Pages →
Assign Partner → Leadmore's Business ID invullen, of Leadmore vraagt toegang aan via de Pagina-ID). Pas daarna
kan de admin in `BusinessManagerConnectForm` (`src/components/admin/BusinessManagerConnectForm.tsx`, op
`/admin/agencies/[id]/settings` onder de gewone "Verbind met Facebook"-knop) het Facebook-pagina ID invullen via
`connectAgencyViaBusinessManagerAction` (`src/app/admin/agencies/actions.ts`) — schrijft naar dezelfde
`social_connections`-tabel, dus `facebookPublishingService` werkt ongewijzigd verder ongeacht welke van de twee
methodes gebruikt werd.

Tokens worden versleuteld opgeslagen (`src/lib/token-encryption.ts`, AES-256-GCM) — ook het handmatige token-veld
in `MetaConnectionForm` gaat nu door `encryptToken()`; het veld toont nooit een opgeslagen token terug (leeg laten
= huidig token behouden, zie `updateAgencyMetaConnectionAction`). `facebookPublishingService.schedule()` ontsleutelt
het Page-token en post naar `POST /{page-id}/photos` met `published=false` + `scheduled_publish_time` — Facebook
plant de post zelf in, er is geen eigen achtergrond-job voor nodig (in tegenstelling tot Instagram, zie de tabel
hierboven).

**Nieuwe env-vars** (zie "Lokale setup"): `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`,
`TOKEN_ENCRYPTION_KEY`. Zonder deze vars blijft de app gewoon bouwen/draaien (zelfde lazy-`readEnv()`-patroon als
de Supabase-vars) — enkel de Meta-koppeling zelf faalt dan met een duidelijke foutmelding i.p.v. een cryptische
crash.

Alle mock-vervangingen raken enkel bestanden in `src/services/**` — de rest van de app (pagina's, services die
ervan afhangen zoals `postSchedulerService`) blijft ongewijzigd omdat alles achter de `CrmService` /
`MetaPublishingService` interfaces (`src/types/domain.ts`) is geschreven.

## Lokale setup

1. `cp .env.local.example .env.local` en vul een Supabase-project in (URL, publishable/anon key, secret/service
   role key — te vinden onder Project Settings → API Keys).
2. Voer de migraties in `supabase/migrations/` **in volgorde** uit tegen dat project (SQL editor of Supabase CLI):
   `0001_init.sql` → `0002_storage.sql` → `0003_grants.sql` (nodig omdat sommige nieuwe Supabase-projecten geen
   standaard tabelrechten meer geven aan `anon`/`authenticated`/`service_role` voor tabellen die je zelf via SQL
   aanmaakt — zonder deze migratie krijg je `permission denied for table ...` zodra `npm run seed` draait) →
   `0004_template_restructure.sql` (schrapt `template_blueprints`, voegt `properties.listed_at` toe, verstrakt
   `social_connections`-rechten tot super_admin-only) → `0005_dynamic_templates.sql` (schrapt `layout_key` en de
   `layout_key`-domain, voegt `component_source`/`slide_count` toe aan `agency_templates`) →
   `0006_optional_template_posts.sql` (maakt `posts.agency_template_id` optioneel, voor "eigen foto's"-posts zonder
   template).
3. `npm run seed` — vult het project met demo-kantoren, panden, templates en posts (idempotent, veilig opnieuw te
   draaien).
4. `npm run dev`.
5. Optioneel, enkel nodig voor de echte Facebook-koppeling (zie "Meta (Facebook) integratie" hierboven): vul
   `META_APP_ID`/`META_APP_SECRET` in vanuit je Meta Developer App, `META_REDIRECT_URI` (bv.
   `http://localhost:3000/api/meta/callback`, moet exact overeenkomen met wat in het Meta-dashboard geregistreerd
   staat), en `TOKEN_ENCRYPTION_KEY` (zelf te genereren met `openssl rand -hex 32`). Zonder deze vars werkt de rest
   van de app gewoon door.
6. Optioneel, enkel nodig voor de Business Manager-koppelmethode (zie "Tweede koppelmethode" hierboven, branch
   `feature/business-manager-connect`): `META_SYSTEM_USER_TOKEN`, aan te maken via Business Settings → System
   Users → Generate New Token.

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
