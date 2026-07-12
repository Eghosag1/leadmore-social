/**
 * Seeds a Supabase project with demo data: 1 super_admin, 2 agencies (with
 * branding), 6 properties per agency (from the mock CRM data), 3 standard
 * agency templates per agency, and a handful of posts in various statuses.
 *
 * Run after applying supabase/migrations/*.sql to your project:
 *   npm run seed
 *
 * Idempotent: safe to re-run — everything is upserted by a fixed id (see
 * src/data/mock/ids.ts), and users are looked up by email before creating.
 *
 * This runs as a plain Node script (not through Next.js), so it can't import
 * anything guarded by "server-only" or that touches next/headers — it talks
 * to Supabase directly with its own service-role client instead.
 */
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { MOCK_AGENCIES } from "../src/data/mock/agencies";
import { MOCK_USERS } from "../src/data/mock/users";
import { MOCK_CRM_PROPERTIES } from "../src/data/mock/properties";
import { MOCK_AGENCY_TEMPLATES } from "../src/data/mock/agency-templates";
import { MOCK_POSTS } from "../src/data/mock/posts";
import { AGENCY_IDS, PROPERTY_IDS } from "../src/data/mock/ids";
import type { Database } from "../src/types/database";

loadEnv({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Copy .env.local.example to .env.local and fill in your Supabase project credentials first.",
  );
  process.exit(1);
}

const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Let SEED_SUPER_ADMIN_EMAIL / SEED_SUPER_ADMIN_PASSWORD (.env.local) override
// the mock super_admin's login so you're not stuck with the hardcoded demo
// credentials once this touches a real project.
const SEED_USERS = MOCK_USERS.map((user) =>
  user.role === "super_admin"
    ? {
        ...user,
        email: process.env.SEED_SUPER_ADMIN_EMAIL || user.email,
        password: process.env.SEED_SUPER_ADMIN_PASSWORD || user.password,
      }
    : user,
);

async function seedAgencies() {
  console.log(`Seeding ${MOCK_AGENCIES.length} agencies...`);
  const { error } = await admin.from("agencies").upsert(MOCK_AGENCIES, { onConflict: "id" });
  if (error) throw new Error(`agencies: ${error.message}`);
}

async function seedUsersAndProfiles() {
  console.log(`Seeding ${SEED_USERS.length} users + profiles...`);

  const { data: existing, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listError) throw new Error(`listUsers: ${listError.message}`);
  const byEmail = new Map(existing.users.map((u) => [u.email, u]));

  for (const mockUser of SEED_USERS) {
    let authUserId = byEmail.get(mockUser.email)?.id;

    if (!authUserId) {
      const { data, error } = await admin.auth.admin.createUser({
        email: mockUser.email,
        password: mockUser.password,
        email_confirm: true,
        user_metadata: { full_name: mockUser.fullName },
      });
      if (error || !data.user) throw new Error(`createUser(${mockUser.email}): ${error?.message}`);
      authUserId = data.user.id;
    } else {
      // Keep the password in sync with SEED_USERS on re-runs — otherwise an
      // earlier run with a different SEED_SUPER_ADMIN_PASSWORD (or a leftover
      // placeholder value in .env.local) silently sticks forever.
      const { error: updateError } = await admin.auth.admin.updateUserById(authUserId, {
        password: mockUser.password,
        email_confirm: true,
      });
      if (updateError) throw new Error(`updateUser(${mockUser.email}): ${updateError.message}`);
    }

    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: mockUser.profileId,
        user_id: authUserId,
        agency_id: mockUser.agencyId,
        full_name: mockUser.fullName,
        role: mockUser.role,
      },
      { onConflict: "id" },
    );
    if (profileError) throw new Error(`profiles(${mockUser.email}): ${profileError.message}`);
  }
}

const MOCK_ACCESS_TOKEN = "mock-encrypted-token";

async function seedCrmAndSocialConnections() {
  console.log("Seeding CRM + Meta connections...");
  for (const agency of MOCK_AGENCIES) {
    const { error: crmError } = await admin
      .from("crm_connections")
      .upsert(
        { agency_id: agency.id, provider: "mock", status: "connected", last_sync_at: new Date().toISOString() },
        { onConflict: "agency_id,provider" },
      );
    if (crmError) throw new Error(`crm_connections(${agency.slug}): ${crmError.message}`);

    // Never clobber a real Meta connection (set up via the actual OAuth flow
    // or Business Manager connect) with mock data on a re-seed — only seed
    // when there's no row yet, or the row is already the mock placeholder
    // from a previous seed run. A real access_token_encrypted value is a
    // genuine AES-GCM ciphertext, never literally MOCK_ACCESS_TOKEN.
    const { data: existing } = await admin
      .from("social_connections")
      .select("access_token_encrypted")
      .eq("agency_id", agency.id)
      .eq("provider", "meta")
      .maybeSingle();
    if (existing && existing.access_token_encrypted !== MOCK_ACCESS_TOKEN) {
      console.log(`  social_connections(${agency.slug}): real connection detected, leaving it alone.`);
      continue;
    }

    const { error: socialError } = await admin.from("social_connections").upsert(
      {
        agency_id: agency.id,
        provider: "meta",
        status: "connected",
        facebook_page_id: `mock_page_${agency.slug}`,
        instagram_account_id: `mock_ig_${agency.slug}`,
        access_token_encrypted: MOCK_ACCESS_TOKEN,
        token_expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      },
      { onConflict: "agency_id,provider" },
    );
    if (socialError) throw new Error(`social_connections(${agency.slug}): ${socialError.message}`);
  }
}

const PROPERTY_ID_LISTS: Record<string, readonly string[]> = {
  [AGENCY_IDS.deMeester]: PROPERTY_IDS.deMeester,
  [AGENCY_IDS.huysHaard]: PROPERTY_IDS.huysHaard,
};

async function seedProperties() {
  console.log("Seeding properties + property images...");

  for (const [agencyId, crmProperties] of Object.entries(MOCK_CRM_PROPERTIES)) {
    const propertyIds = PROPERTY_ID_LISTS[agencyId];

    for (const [index, property] of crmProperties.entries()) {
      const propertyId = propertyIds?.[index];

      const { data: row, error } = await admin
        .from("properties")
        .upsert(
          {
            ...(propertyId ? { id: propertyId } : {}),
            agency_id: agencyId,
            crm_property_id: property.crmPropertyId,
            title: property.title,
            description: property.description,
            price: property.price,
            location: property.location,
            property_type: property.propertyType,
            listing_type: property.listingType,
            bedrooms: property.bedrooms,
            bathrooms: property.bathrooms,
            surface: property.surface,
            status: property.status,
            listed_at: property.listedAt,
          },
          { onConflict: "agency_id,crm_property_id" },
        )
        .select("id")
        .single();

      if (error || !row) throw new Error(`properties(${property.crmPropertyId}): ${error?.message}`);

      await admin.from("property_images").delete().eq("property_id", row.id);
      if (property.images.length > 0) {
        const { error: imagesError } = await admin.from("property_images").insert(
          property.images.map((image) => ({
            property_id: row.id,
            image_url: image.url,
            sort_order: image.sortOrder,
            is_primary: image.isPrimary,
          })),
        );
        if (imagesError) throw new Error(`property_images(${property.crmPropertyId}): ${imagesError.message}`);
      }
    }
  }
}

async function seedTemplates() {
  console.log(`Seeding ${MOCK_AGENCY_TEMPLATES.length} agency templates...`);
  const { error: templateError } = await admin
    .from("agency_templates")
    .upsert(
      MOCK_AGENCY_TEMPLATES.map((t) => ({ ...t, config: t.config as unknown as Record<string, unknown> })),
      { onConflict: "id" },
    );
  if (templateError) throw new Error(`agency_templates: ${templateError.message}`);
}

async function seedPosts() {
  console.log(`Seeding ${MOCK_POSTS.length} posts...`);

  for (const post of MOCK_POSTS) {
    const { error: postError } = await admin.from("posts").upsert(
      {
        id: post.id,
        agency_id: post.agency_id,
        property_id: post.property_id,
        agency_template_id: post.agency_template_id,
        post_type: post.post_type,
        caption: post.caption,
        status: post.status,
        scheduled_at: post.scheduled_at,
        created_by: post.created_by,
      },
      { onConflict: "id" },
    );
    if (postError) throw new Error(`posts(${post.id}): ${postError.message}`);

    await admin.from("post_slides").delete().eq("post_id", post.id);
    if (post.slides.length > 0) {
      const { error: slidesError } = await admin.from("post_slides").insert(
        post.slides.map((slide) => ({
          post_id: post.id,
          sort_order: slide.sort_order,
          image_url: slide.image_url,
          text_content: slide.text_content,
          rendered_image_url: slide.rendered_image_url,
        })),
      );
      if (slidesError) throw new Error(`post_slides(${post.id}): ${slidesError.message}`);
    }

    await admin.from("post_jobs").delete().eq("post_id", post.id);
    if (post.jobs.length > 0) {
      const { error: jobsError } = await admin.from("post_jobs").insert(
        post.jobs.map((job) => ({
          post_id: post.id,
          platform: job.platform,
          status: job.status,
          scheduled_at: job.scheduled_at,
          meta_object_id: job.meta_object_id,
          error_message: job.error_message,
        })),
      );
      if (jobsError) throw new Error(`post_jobs(${post.id}): ${jobsError.message}`);
    }
  }
}

async function main() {
  await seedAgencies();
  await seedUsersAndProfiles();
  await seedCrmAndSocialConnections();
  await seedProperties();
  await seedTemplates();
  await seedPosts();

  console.log("\nDone. Demo accounts (password: Leadmore123! unless overridden in .env.local):");
  for (const user of SEED_USERS) {
    console.log(`  ${user.role.padEnd(13)} ${user.email}`);
  }
}

main().catch((error) => {
  console.error("\nSeed failed:", error.message ?? error);
  process.exit(1);
});
