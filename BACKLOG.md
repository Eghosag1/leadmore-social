# Backlog — later toe te voegen

Dingen die we bewust nog niet gebouwd hebben, met de context waarom, zodat we ze
niet vergeten. Geen einddatum/prioriteit — gewoon een geheugensteun.

## Meldingen bij mislukte posts

Vandaag komt een kantoor een mislukte post (`render_failed`/`publish_failed`)
enkel tegen als iemand toevallig het kalenderoverzicht of de posts-lijst bekijkt
— geen enkele proactieve melding. Gekozen richting: **e-mail**, niet enkel een
in-app banner, net omdat een banner afhankelijk blijft van dat iemand toevallig
inlogt. Vereist een mailprovider (Resend/Postmark/...) — nog niet gekozen.

## "Opnieuw proberen" voor `publish_failed`

`RenderFailedActions` (retry/override) bestaat vandaag enkel voor
`render_failed`. Een post die wél rendert maar bij Meta wordt geweigerd
(`publish_failed` — zoals het echte permissieprobleem dat we tijdens het testen
tegenkwamen) heeft geen directe "opnieuw proberen"-knop; de bestaande
"Bewerken"-flow (`reschedulePost`) lost dit niet op omdat die enkel jobs met
een reeds bestaand `meta_object_id` bijwerkt, niet een job die van bij het
begin geweigerd werd.

## Kapotte testtemplate opruimen

Template "Open kijkdag" (agency Vastgoed De Meester) staat op `published` maar
heeft een lege `component_source` — overblijfsel van vóór de Fase 1-validatie
bestond. Nooit opgeruimd. Zou nu gewoon herschreven of gearchiveerd moeten
worden via de admin-UI.

## Echte achtergrond-queue voor renderen

`pending_render` bestaat al in de `post_status`-enum maar wordt nog nergens
geschreven — renderen gebeurt nog volledig synchroon binnen de request. Zodra
dat verandert (bv. voor langere carousels of om de Vercel-functietijdslimiet
niet meer te raken), is het schema er al klaar voor.

## Instagram-scheduling

`instagramPublishingService` is nog steeds mock (delegeert naar
`mockMetaSchedulingService`). Instagram's Content Publishing API kent geen
`scheduled_publish_time` — vereist een eigen achtergrond-scheduler die op
`scheduled_at` wacht, geen simpele andere API-call.

## Business Manager-koppelingspad

Bestaat op branch `feature/business-manager-connect`, bewust nooit gemerged
naar `main`. Alternatief voor de standaard OAuth-flow voor kantoren waarvan de
Facebook-pagina onder een Business Portfolio valt (zie de noot hierover in
CLAUDE.md).

## Tabbladen "Ingepland"/"Gepubliceerd" op de posts-pagina

`/dashboard/scheduled` toont vandaag alle posts van een kantoor in één platte
tabel, ongeacht status. Moet opgesplitst worden in 2 tabbladen: "Ingepland"
(nog te publiceren) en "Gepubliceerd" (al de deur uit) — overzichtelijker
zodra een kantoor een langere geschiedenis opbouwt.

## Post aanmaken vanuit de kalender

Op het kalenderoverzicht (`/dashboard`) klikken op een dag opent vandaag niets
— je moet apart naar "Nieuwe post maken" en dan een pand kiezen. Klikken op een
dag zou meteen de post-aanmaakflow moeten starten (met die datum al
voorgeselecteerd), in plaats van een aparte stap te blijven.

## Template-versiebeheer

Geen versiegeschiedenis/rollback voor admin-templates — een template bewerken
overschrijft de vorige versie definitief (met automatische terugval naar
`draft` tot opnieuw gevalideerd, zie Fase 1). Expliciet uit scope gelaten bij
de eerste versie van de validatieflow.
