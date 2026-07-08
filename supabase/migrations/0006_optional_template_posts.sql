-- Posts can now be created without an admin-authored template ("eigen foto's"
-- mode): the agency picks 1 photo (single) or several photos (carousel)
-- directly, with no branded overlay. agency_template_id becomes optional.
alter table public.posts alter column agency_template_id drop not null;
