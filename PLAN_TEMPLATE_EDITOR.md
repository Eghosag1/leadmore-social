# Visuele template-editor (Canva-stijl, enkel admin) + multi-foto-carrousels + multi-font

> Status: plan klaar, nog niet gestart met bouwen. Opgesteld 2026-07-15, na een
> uitgebreide brainstorm. Nog niet formeel goedgekeurd via Plan Mode — dat doen we
> wanneer we hierop terugkomen.

## Context

Uit een uitgebreide brainstorm (deze sessie) volgt dat de huidige manier van templates
aanmaken — TSX/Tailwind-broncode plakken in een tekstvak — omslachtig is, en dat een echte
Figma-vertaling (icoontjes, fonts, exacte maten) telkens handmatig/via Claude moet gebeuren.
Voorstel, bevestigd door de gebruiker: een visuele editor, enkel voor de platformbeheerder
(super_admin — kantoren blijven nooit templates aanmaken/aanpassen, "vaste-layout-regel"
blijft gelden), waarin je tekst, simpele vormen, de pandfoto en het logo sleept/positioneert
i.p.v. code schrijft.

Onderweg zijn drie onderliggende, noodzakelijke fixes bevestigd:
- **Templates die meerdere foto's per carrousel tonen** (vandaag hergebruikt een
  template-carrousel altijd dezelfde ene foto over alle slides — bevestigd "sowieso niet
  top", los van de editor).
- **Onbeperkt aantal fonts per kantoor** (vandaag exact 1) — nodig omdat de editor per
  tekstelement een eigen font moet kunnen kiezen.
- **Drie onafhankelijk-optionele "scènes" per template**: cover (slide 1), content
  (herhaald voor tussenliggende slides), eind (vaste afsluiter zonder foto, altijd de
  laatste slide indien gedefinieerd). Ontbreekt een scène-rol voor een bepaalde slide, dan
  toont die slide gewoon de kale foto — hetzelfde gedrag als "eigen foto's" vandaag al heeft.

**Bevestigde beslissing over databinding** (gevraagd, expliciet bevestigd): elk tekstelement
in de editor krijgt een aan/uit-schakelaar "kantoor mag dit aanpassen", **standaard uit**
(dus standaard net zo vast als prijs/slaapkamers vandaag al zijn). Zet je 'm aan voor een
specifiek element, dan krijgt het kantoor bij het maken van een post daar dezelfde
keuzeknop als nu al bestaat voor titel/beschrijving.

Dit is veruit het grootste stuk werk van de hele sessie — nieuwe databasetabellen, een
volledig nieuwe editor-UI, en wijzigingen doorheen de hele post-aanmaakflow. Daarom
opgedeeld in 5 onafhankelijk uitvoerbare fases (A→E, in volgorde van afhankelijkheid). Elke
fase is op zich al waardevol en apart te verifiëren — je hoeft niet in één keer alles te
laten bouwen.

Alle nieuwe migraties bouwen verder op `0014_post_canvas_mode.sql` (huidige hoogste), starten
dus bij `0015`.

## Fase A — Datamodel + onbeperkt fonts per kantoor

**Nieuwe migratie `0015_agency_fonts.sql`**: nieuwe tabel `agency_fonts` (id, agency_id,
label, font_url, font_family, created_at) + RLS (zelfde `is_super_admin()`/
`current_profile_agency_id()`-patroon als overal), backfill van de bestaande
`agencies.custom_font_url`/`custom_font_family` naar 1 rij per kantoor dat al een font had,
plus `storage.buckets.file_size_limit` op de `agency-fonts`-bucket (5MB, echte
server-side-controle i.p.v. enkel het bestandstype-vertrouwen dat `FontUploader.tsx` vandaag
doet). **Aparte, latere migratie `0016_drop_agency_custom_font_columns.sql`** (pas runnen
nadat Fase A's code écht draait en geverifieerd is) die de oude 2 kolommen op `agencies`
verwijdert.

**Nieuw**: `src/components/admin/FontsCard.tsx` — lijst + toevoegformulier + verwijderknop,
naar het patroon van `AgencyUsersCard.tsx` (die al exact dit lijst/toevoeg/verwijder-patroon
heeft). Verwijderen haalt ook het bestand uit Storage weg (vandaag blijven oude fonts bij
her-upload gewoon als verweesd bestand staan — dat lossen we hier meteen mee op).
Server-acties `addAgencyFontAction`/`removeAgencyFontAction` in
`src/app/admin/agencies/actions.ts`, zelfde vorm als `inviteAgencyUserAction`/
`removeAgencyUserAction`.

**Wijzigingen**: `AgencyForm.tsx` verliest de huidige `<FontUploader>` (een nieuw kantoor
start dus met 0 fonts, net zoals het al met 0 templates/gebruikers start — fonts voeg je
nadien toe op de instellingenpagina, waar `FontsCard` een eigen plek krijgt naast
`CrmConnectionForm`/`MetaConnectionForm`). `DynamicTemplateRenderer.tsx`'s font-injectie
wordt uitgebreid van 1 `@font-face`/`--font-brand` naar N `@font-face`-blokken + N
CSS-variabelen (`--font-{fontId}`) — `.font-brand` blijft als alias naar het eerste font
bestaan, zodat niets stilzwijgend breekt. `TemplateRenderProps`/`buildTemplateRenderProps()`
(`src/lib/template-render.ts`) krijgen `fonts: {id,label,family,url}[]` i.p.v. de twee losse
velden — representatieve aanpassingsplekken: `renderDataService.ts` (2 queries),
`postDetailService.ts`, `CreatePostForm.tsx`, `TemplateForm.tsx`/`TemplatePreviewClient.tsx`,
en elke pagina die vandaag `custom_font_url`/`custom_font_family` opvraagt (zelfde
query-vorm overal, gewoon een tweede tabel erbij).

**Verificatie**: 2 fonts uploaden voor een kantoor, bevestigen dat beide écht renderen in een
live preview én in een echte Puppeteer-render (niet enkel de client-preview) — precies het
soort "test het echt, vertrouw niet enkel op code" dat deze sessie al meermaals nodig bleek.

## Fase B — Multi-foto template-carrousels

**Kernprobleem**: `agency_templates.slide_count` bepaalt vandaag hoeveel slides een
template-carrousel krijgt, en elke slide krijgt dezelfde ene gekozen foto
(`Array.from({length: slide_count}, () => ({imageUrl: coverImageUrl, ...}))` in
`create-post/[propertyId]/actions.ts`). De "eigen foto's"-tak doet al exact het juiste
(`urls.map((url, index) => ({imageUrl: url, ...}))`) — dit wordt hetzelfde patroon voor
templates.

**Wijzigingen**: `CreatePostForm.tsx`'s bestaande `isOwnCarousel`-boolean (die al de
foto-grid single-select-vs-multi-select stuurt) wordt verbreed zodat multi-select ook geldt
zodra `mode === "template" && selectedType === "carousel"` — geen structurele herschrijving,
enkel die ene voorwaarde verbreden plus een max-cap van **9 foto's** inbouwen in
`toggleOwnPhoto` (9, niet 10: de 10e plek is gereserveerd voor een eventuele eind-scène uit
Fase C — zodra Fase C er is wordt dit een simpele `template.end_scene ? 9 : 10`).
`create-post/[propertyId]/actions.ts`'s `mode === "template"`-tak wordt herschreven naar
exact hetzelfde patroon als de `mode === "own"`-tak, inclusief een server-side her-controle
van de 9-cap (nooit enkel de client vertrouwen — zelfde principe als de bestaande
`clampCanvasHeight()`). `postSchedulerService.createPost()` zelf hoeft **niet** te
veranderen — die is al volledig generiek over `{imageUrl, textContent}[]`.

**Belangrijk, al bevestigd met jou**: dit geldt voor **alle** bestaande template-carrousels,
niet enkel toekomstige scène-templates — een bestaande 3-slide-broncode-template die vandaag
altijd dezelfde foto toont, toont straks de effectief gekozen foto's. Bij een template die
zelf per `slideIndex` iets anders doet (zoals de carrousel-starter) en je kiest meer/minder
foto's dan de template ooit voorzag, val je terug op wat die template's eigen
`else`-tak toont — geen crash, maar wel een zichtbare wijziging t.o.v. vandaag.

**Verificatie**: een bestaand template-carrousel-post maken met 2 verschillend gekozen
foto's, bevestigen dat `post_slides` 2 rijen krijgt met 2 verschillende `image_url`'s (niet
dezelfde herhaald), en dat de 10e foto-knop geblokkeerd is in de UI én server-side geweigerd
wordt als je de client omzeilt.

## Fase C — Scène-datamodel + generieke renderer (nog geen editor-UI)

**Nieuwe migratie `0017_template_scenes.sql`**: 3 nullable `jsonb`-kolommen op
`agency_templates` — `cover_scene`, `content_scene`, `end_scene`. Geen apart
enum/vlag-kolom nodig: of een rij "scène-gebaseerd" is volgt gewoon uit "minstens één van
de drie is niet leeg", exact hetzelfde patroon als `template_key` vandaag al gebruikt om
zich te onderscheiden van `component_source`.

**Nieuw type** (`src/types/scene.ts`): een `Scene` = achtergrondkleur + een geordende lijst
`elements` (volgorde in de array = laagvolgorde, geen apart z-index-veld nodig — één
potentiële bron van inconsistentie minder). Elk element heeft `x/y/breedte/hoogte/rotatie`
(in % van het 1080-brede canvas) plus, per type:
- **tekst**: letterlijke tekst óf gekoppeld aan een pandveld (hergebruikt
  `BINDABLE_PROPERTY_FIELDS`/`resolvePropertyField` uit `src/lib/field-binding.ts`, precies
  wat vandaag al bestaat), font (verwijzing naar een `agency_fonts`-rij), grootte, kleur,
  uitlijning, en de `agencyEditable`-schakelaar uit de bevestigde beslissing hierboven.
- **vorm**: rechthoek/cirkel/ruit (een ruit is gewoon een rechthoek met 45°-rotatie, geen
  aparte renderlogica nodig), vulkleur, afgeronde hoeken.
- **foto**: geen eigen bestand — verwijst naar de foto van de post op die slide-index, met
  pan/zoom-instellingen binnen het frame.
- **logo**: verwijst automatisch naar het kantoorlogo.

**Nieuwe render-resolutie** (`src/lib/scene/resolveScene.ts`): een functie
`resolveSceneForSlide(scenes, slideIndex, totaalAantalSlides)` die op basis van "is dit de
eerste/laatste/tussenliggende slide, en heeft de template daar een scène voor" de juiste
`Scene | null` teruggeeft — deze berekening moet plaatsvinden vóórdat
`DynamicTemplateRenderer` in beeld komt (die kent enkel de huidige `slideIndex`, niet het
totaal), dus bij dezelfde aanroepers die vandaag al `templateKey` vs `source` kiezen.

**`DynamicTemplateRenderer.tsx`/`ScaledTemplateCanvas.tsx`**: de bestaande
`{source} | {templateKey}`-keuze wordt een 3-weg-keuze met `{scene: Scene | null}` erbij.
Is de scène `null` (geen bijpassende scène voor deze slide), dan toont een nieuwe kleine
component (`PlainPhotoSlide.tsx`) gewoon de kale foto — zelfde gedrag als "eigen foto's".
Is er wél een scène, dan rendert een nieuwe `SceneRenderer`-component
(`src/templates/scene/SceneRenderer.tsx`) de elementen als gewone, absoluut-gepositioneerde
`<div>`s — **geen canvas-library nodig op het renderpad**, gewoon platte HTML/CSS,
gescreenshot door exact dezelfde bestaande Puppeteer-pijplijn. De editor (Fase E) gebruikt
wél een canvas-library, maar enkel om te *bewerken* — het uiteindelijke beeld komt altijd uit
deze ene `SceneRenderer`.

**Verificatie**: handmatig één scène-JSON in een bestaand template-rij zetten (rechtstreeks
via de databaseverbinding), bevestigen dat de preview-pagina en een echte Puppeteer-render
allebei correct tonen — inclusief dat een slide zonder bijpassende scène terugvalt op de
kale foto.

## Fase D — Validatie voor scène-templates

Templates moeten, net als vandaag, pas bruikbaar worden voor een kantoor nadat ze
succesvol "gevalideerd en gepubliceerd" zijn (`templateValidationService.ts`) — een echte
Puppeteer-render die effectief lukt, geen crash. Voor scène-templates wordt dit: geen
Tailwind-compilatie nodig (net als bij `template_key`), en i.p.v. een vaste `slide_count`
te doorlopen, wordt élke gedefinieerde scène (cover/content/eind, wat er ook is) apart
getest tegen het voorbeeldpand. Een nieuwe interne renderroute
(`/internal/render-template-scene/[templateId]/[sceneRole]`) toont één scène in isolatie,
zelfde HMAC-token-beveiliging als de bestaande interne renderpagina's.

**Verificatie**: een template met enkel een cover-scène valideren → precies 1 render-poging;
een template met alle 3 → 3 pogingen. Een scène met een fout erin (bv. verwijzing naar een
niet-bestaand font) laten mislukken en bevestigen dat de template dan niet bruikbaar wordt
voor een kantoor (RLS filtert toch al op `status = 'published'`).

## Fase E — De visuele editor zelf

**Library-keuze: `react-moveable` (+ `react-selecto` voor multi-select), geen Konva.**
Konva tekent naar een canvas-element — dat zou de *bewerk*-weergave en de *echte*
renderweergave (platte HTML/CSS via `SceneRenderer`) twee verschillende rendertechnieken
maken, met risico dat tekst er in de editor net iets anders uitziet dan in de uiteindelijke
post. `react-moveable` werkt in plaats daarvan rechtstreeks op echte HTML-elementen — de
editor kan dus letterlijk dezelfde `SceneRenderer`-component tonen als wat er straks
gepubliceerd wordt, met sleep/resize/rotatie-grepen eroverheen. Dat garandeert dat "wat je
ziet is wat je krijgt" door constructie, niet door apart testen.

**Waar**: een nieuwe keuze bij het aanmaken van een template ("Broncode" vs "Visuele
editor"), met een nieuwe editorpagina per template. Bestaande broncode-templates krijgen
geen retrofit — die blijven op de oude editor werken, geen gedwongen migratie.

**Onderdelen**: canvas met live `SceneRenderer`-preview + sleep/resize/rotatie-grepen,
een werktuigenbalk om tekst/vorm/foto-plek/logo-plek toe te voegen, een eigenschappenpaneel
(positie, kleur, font uit de kantoor-fontlijst van Fase A, pandveld-koppeling met de
`agencyEditable`-schakelaar), en een eenvoudige lagenlijst (omhoog/omlaag, geen aparte
sleep-bibliotheek nodig voor zoiets kleins). "Opslaan als concept" schrijft gewoon de
JSON-kolommen weg; "Valideren en publiceren" roept exact dezelfde validatie uit Fase D aan
— geen nieuwe validatielogica nodig.

**Verificatie**: een volledige scène (foto + tekst gekoppeld aan titel + logo) helemaal via
de UI opbouwen, opslaan, herladen en bevestigen dat alles exact terugkomt. Publiceren en de
echte Puppeteer-screenshot naast de editor-weergave leggen — dat is de concrete test of
"wat je ziet is wat je krijgt" ook echt klopt, niet enkel een aanname. Daarna een volledige
end-to-end-test: een kantoor maakt er echt een post mee, kiest foto's (Fase B), plant in,
en de gepubliceerde Instagram/Facebook-post komt overeen met de editor-preview.

## Belangrijkste te hergebruiken bestanden/functies (niet opnieuw uitvinden)

- `src/lib/field-binding.ts` (`BINDABLE_PROPERTY_FIELDS`, `resolvePropertyField`) — voor
  pandveld-koppeling, zowel bestaand (post-aanmaak) als nieuw (editor).
- `src/components/admin/AgencyUsersCard.tsx` — patroon voor `FontsCard.tsx`
  (lijst/toevoegen/verwijderen via `useActionState`).
- `src/components/templates/ScaledTemplateCanvas.tsx` — schaal-logica hergebruiken voor de
  editor-canvas, niet opnieuw bouwen.
- `src/lib/canvas-format.ts` — precedent voor "klem/valideer server-side, vertrouw de
  client niet" (hergebruikt voor de 9-foto-cap in Fase B).
- `postSchedulerService.createPost()` — blijft ongewijzigd, is al generiek genoeg.

## Belangrijk om te weten

Dit plan beschrijft alle 5 fases in detail zodat je het volledige plaatje ziet, maar elke
fase is apart uitvoerbaar en apart te verifiëren — net zoals we eerder dit project een groot
plan in stappen hebben opgedeeld en niet alles in één keer bouwden. Na goedkeuring bepalen
we samen tot welke fase we nu doorgaan.

## Volgende stap (morgen)

Dit plan is nog niet formeel goedgekeurd — wanneer we hierop terugkomen, herbekijken we het
samen en beslissen we tot welke fase(s) we nu bouwen, daarna begin ik met Fase A.