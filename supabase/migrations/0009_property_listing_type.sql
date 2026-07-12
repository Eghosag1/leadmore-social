-- Splits "te koop" (for sale) from "te huur" (for rent) — a genuinely new
-- axis, orthogonal to both property_type (physical kind of property) and
-- status (available/under_offer/sold/rented/withdrawn). Needed for the
-- agency dashboard's properties list, which splits into separate "Te
-- koop"/"Te huur" tabs.

create type public.property_listing_type as enum ('sale', 'rent');

alter table public.properties
  add column listing_type public.property_listing_type not null default 'sale';
