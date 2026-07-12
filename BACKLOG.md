# Backlog — later toe te voegen

Dingen die we bewust nog niet gebouwd hebben, met de context waarom, zodat we ze
niet vergeten. Geen einddatum/prioriteit — gewoon een geheugensteun.

## Meldingen bij mislukte posts

Vandaag komt een kantoor een mislukte post (`render_failed`/`publish_failed`)
enkel tegen als iemand toevallig het kalenderoverzicht of de posts-lijst bekijkt
— geen enkele proactieve melding. Gekozen richting: **e-mail**, niet enkel een
in-app banner, net omdat een banner afhankelijk blijft van dat iemand toevallig
inlogt. Vereist een mailprovider (Resend/Postmark/...) — nog niet gekozen.

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
