// Fixed UUIDs for seed data so scripts/seed.ts is idempotent (re-running it
// upserts the same rows instead of creating duplicates) and so cross-file
// references (property -> agency, post -> template, ...) stay simple to read.

export const AGENCY_IDS = {
  deMeester: "10000000-0000-4000-8000-000000000001",
  huysHaard: "10000000-0000-4000-8000-000000000002",
} as const;

export const AGENCY_TEMPLATE_IDS = {
  deMeesterNieuwPand: "30000000-0000-4000-8000-000000000001",
  deMeesterCarousel: "30000000-0000-4000-8000-000000000002",
  deMeesterVerkocht: "30000000-0000-4000-8000-000000000003",
  deMeesterPrijswijziging: "30000000-0000-4000-8000-000000000004",
  huysHaardNieuwPand: "30000000-0000-4000-8000-000000000005",
  huysHaardCarousel: "30000000-0000-4000-8000-000000000006",
  huysHaardVerkocht: "30000000-0000-4000-8000-000000000007",
} as const;

export const PROPERTY_IDS = {
  deMeester: [
    "40000000-0000-4000-8000-000000000001",
    "40000000-0000-4000-8000-000000000002",
    "40000000-0000-4000-8000-000000000003",
    "40000000-0000-4000-8000-000000000004",
    "40000000-0000-4000-8000-000000000005",
    "40000000-0000-4000-8000-000000000006",
  ],
  huysHaard: [
    "40000000-0000-4000-8000-000000000007",
    "40000000-0000-4000-8000-000000000008",
    "40000000-0000-4000-8000-000000000009",
    "40000000-0000-4000-8000-00000000000a",
    "40000000-0000-4000-8000-00000000000b",
    "40000000-0000-4000-8000-00000000000c",
  ],
} as const;

export const POST_IDS = {
  deMeesterScheduled: "50000000-0000-4000-8000-000000000001",
  deMeesterPublished: "50000000-0000-4000-8000-000000000002",
  deMeesterDraft: "50000000-0000-4000-8000-000000000003",
  huysHaardScheduled: "50000000-0000-4000-8000-000000000004",
  huysHaardFailed: "50000000-0000-4000-8000-000000000005",
} as const;

// Note: there are no fixed ids for auth.users — Supabase's admin API
// generates those on creation. scripts/seed.ts looks users up by email
// (creating them if missing) and uses the returned id as profiles.user_id.
// profiles.id (below) is our own primary key and can be pinned safely.
export const PROFILE_IDS = {
  superAdmin: "70000000-0000-4000-8000-000000000001",
  deMeesterAdmin: "70000000-0000-4000-8000-000000000002",
  deMeesterUser: "70000000-0000-4000-8000-000000000003",
  huysHaardAdmin: "70000000-0000-4000-8000-000000000004",
  huysHaardUser: "70000000-0000-4000-8000-000000000005",
} as const;
