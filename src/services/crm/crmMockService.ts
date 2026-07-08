import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { MOCK_CRM_PROPERTIES } from "@/data/mock/properties";
import type { CrmProperty, CrmService } from "@/types/domain";

/**
 * Mock stand-in for a real CRM integration (Whise, Immoweb, ...). Implements
 * the CrmService contract so a real provider can be dropped in later without
 * touching any calling code — see syncAgencyPropertiesFromCrm below and
 * src/types/domain.ts for the shared CrmProperty / CrmService shapes.
 */
export const crmMockService: CrmService = {
  async listProperties(agencyId: string): Promise<CrmProperty[]> {
    return MOCK_CRM_PROPERTIES[agencyId] ?? [];
  },

  async getProperty(agencyId: string, crmPropertyId: string): Promise<CrmProperty | null> {
    const properties = MOCK_CRM_PROPERTIES[agencyId] ?? [];
    return properties.find((property) => property.crmPropertyId === crmPropertyId) ?? null;
  },
};

/**
 * Simulates what a scheduled CRM sync job would do: pull properties from the
 * CRM and upsert them into Supabase. Runs with the service-role client
 * because in production this is a trusted backend job, not a user action —
 * agency users never write to `properties` directly (see RLS in
 * supabase/migrations/0001_init.sql).
 */
export async function syncAgencyPropertiesFromCrm(agencyId: string): Promise<{ synced: number }> {
  const properties = await crmMockService.listProperties(agencyId);
  const admin = createAdminClient();
  let synced = 0;

  for (const property of properties) {
    const { data: propertyRow, error } = await admin
      .from("properties")
      .upsert(
        {
          agency_id: agencyId,
          crm_property_id: property.crmPropertyId,
          title: property.title,
          description: property.description,
          price: property.price,
          location: property.location,
          property_type: property.propertyType,
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

    if (error || !propertyRow) continue;

    await admin.from("property_images").delete().eq("property_id", propertyRow.id);
    if (property.images.length > 0) {
      await admin.from("property_images").insert(
        property.images.map((image) => ({
          property_id: propertyRow.id,
          image_url: image.url,
          sort_order: image.sortOrder,
          is_primary: image.isPrimary,
        })),
      );
    }
    synced += 1;
  }

  await admin
    .from("crm_connections")
    .update({ last_sync_at: new Date().toISOString(), status: "connected" })
    .eq("agency_id", agencyId)
    .eq("provider", "mock");

  return { synced };
}
