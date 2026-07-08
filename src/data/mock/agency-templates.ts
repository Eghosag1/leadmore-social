import type { TemplateConfig } from "@/types/domain";
import type { BillableType, PostFormat, TemplateType } from "@/types/enums";
import { AGENCY_IDS, AGENCY_TEMPLATE_IDS } from "./ids";
import { MOCK_AGENCIES } from "./agencies";
import { TEMPLATE_STARTERS } from "../template-starters";

export interface MockAgencyTemplate {
  id: string;
  agency_id: string;
  name: string;
  description: string;
  component_source: string;
  slide_count: number;
  type: TemplateType;
  post_format: PostFormat;
  config: TemplateConfig;
  preview_image_url: string | null;
  is_active: boolean;
  included_in_plan: boolean;
  billable_type: BillableType;
  sort_order: number;
}

const deMeester = MOCK_AGENCIES.find((a) => a.id === AGENCY_IDS.deMeester)!;
const huysHaard = MOCK_AGENCIES.find((a) => a.id === AGENCY_IDS.huysHaard)!;

const singleStarter = TEMPLATE_STARTERS.find((s) => s.id === "single")!;
const carouselStarter = TEMPLATE_STARTERS.find((s) => s.id === "carousel")!;
const soldStarter = TEMPLATE_STARTERS.find((s) => s.id === "sold")!;

function brandFor(agency: typeof deMeester, ctaText: string): TemplateConfig["brand"] {
  return {
    brandColor: agency.primary_color,
    secondaryColor: agency.secondary_color,
    logoUrl: agency.logo_url ?? undefined,
    ctaText,
  };
}

const fullFields: TemplateConfig["fields"] = {
  showPrice: true,
  showBedrooms: true,
  showBathrooms: true,
  showSurface: true,
  showDescription: true,
  showAgentName: true,
};

// Demo data for the 2 seeded agencies only, so the seed remains a useful
// showcase. Agencies created for real through the admin UI start with zero
// templates — every template is admin-authored TSX from that point on (see
// src/lib/dynamic-template.ts, src/data/template-starters.ts).
export const MOCK_AGENCY_TEMPLATES: MockAgencyTemplate[] = [
  {
    id: AGENCY_TEMPLATE_IDS.deMeesterNieuwPand,
    agency_id: AGENCY_IDS.deMeester,
    name: "Nieuw pand",
    description: "Nieuw pand — single post in de huisstijl van Vastgoed De Meester.",
    component_source: singleStarter.source,
    slide_count: singleStarter.slideCount,
    type: "single",
    post_format: "feed",
    config: {
      brand: brandFor(deMeester, "Ontdek dit pand"),
      fields: fullFields,
      defaultTexts: { badgeText: "Nieuw op de markt" },
    },
    preview_image_url: null,
    is_active: true,
    included_in_plan: true,
    billable_type: "included",
    sort_order: 1,
  },
  {
    id: AGENCY_TEMPLATE_IDS.deMeesterCarousel,
    agency_id: AGENCY_IDS.deMeester,
    name: "Pand carousel",
    description: "Vierluik carousel in de huisstijl van Vastgoed De Meester.",
    component_source: carouselStarter.source,
    slide_count: carouselStarter.slideCount,
    type: "carousel",
    post_format: "feed",
    config: {
      brand: brandFor(deMeester, "Contacteer Vastgoed De Meester"),
      fields: fullFields,
    },
    preview_image_url: null,
    is_active: true,
    included_in_plan: true,
    billable_type: "included",
    sort_order: 2,
  },
  {
    id: AGENCY_TEMPLATE_IDS.deMeesterVerkocht,
    agency_id: AGENCY_IDS.deMeester,
    name: "Verkocht/verhuurd",
    description: "Verkocht- of verhuurdaankondiging in de huisstijl van Vastgoed De Meester.",
    component_source: soldStarter.source,
    slide_count: soldStarter.slideCount,
    type: "single",
    post_format: "feed",
    config: {
      brand: brandFor(deMeester, "Ook uw pand verkopen?"),
      fields: { ...fullFields, showBedrooms: false, showBathrooms: false, showSurface: false },
    },
    preview_image_url: null,
    is_active: true,
    included_in_plan: true,
    billable_type: "included",
    sort_order: 3,
  },
  {
    id: AGENCY_TEMPLATE_IDS.deMeesterPrijswijziging,
    agency_id: AGENCY_IDS.deMeester,
    name: "Prijswijziging (in regie)",
    description: "Extra template, apart in regie gemaakt en gefactureerd — geen onderdeel van het standaardpakket.",
    component_source: singleStarter.source,
    slide_count: singleStarter.slideCount,
    type: "single",
    post_format: "feed",
    config: {
      brand: brandFor(deMeester, "Bekijk de nieuwe prijs"),
      fields: fullFields,
      defaultTexts: { badgeText: "Prijs aangepast" },
    },
    preview_image_url: null,
    is_active: true,
    included_in_plan: false,
    billable_type: "regie",
    sort_order: 4,
  },
  {
    id: AGENCY_TEMPLATE_IDS.huysHaardNieuwPand,
    agency_id: AGENCY_IDS.huysHaard,
    name: "Nieuw pand",
    description: "Nieuw pand — single post in de huisstijl van Huys & Haard Makelaars.",
    component_source: singleStarter.source,
    slide_count: singleStarter.slideCount,
    type: "single",
    post_format: "feed",
    config: {
      brand: brandFor(huysHaard, "Ontdek dit pand"),
      fields: fullFields,
      defaultTexts: { badgeText: "Nieuw op de markt" },
    },
    preview_image_url: null,
    is_active: true,
    included_in_plan: true,
    billable_type: "included",
    sort_order: 1,
  },
  {
    id: AGENCY_TEMPLATE_IDS.huysHaardCarousel,
    agency_id: AGENCY_IDS.huysHaard,
    name: "Pand carousel",
    description: "Vierluik carousel in de huisstijl van Huys & Haard Makelaars.",
    component_source: carouselStarter.source,
    slide_count: carouselStarter.slideCount,
    type: "carousel",
    post_format: "feed",
    config: {
      brand: brandFor(huysHaard, "Contacteer Huys & Haard"),
      fields: fullFields,
    },
    preview_image_url: null,
    is_active: true,
    included_in_plan: true,
    billable_type: "included",
    sort_order: 2,
  },
  {
    id: AGENCY_TEMPLATE_IDS.huysHaardVerkocht,
    agency_id: AGENCY_IDS.huysHaard,
    name: "Verkocht/verhuurd",
    description: "Verkocht- of verhuurdaankondiging in de huisstijl van Huys & Haard Makelaars.",
    component_source: soldStarter.source,
    slide_count: soldStarter.slideCount,
    type: "single",
    post_format: "feed",
    config: {
      brand: brandFor(huysHaard, "Ook uw pand verkopen?"),
      fields: { ...fullFields, showBedrooms: false, showBathrooms: false, showSurface: false },
    },
    preview_image_url: null,
    is_active: true,
    included_in_plan: true,
    billable_type: "included",
    sort_order: 3,
  },
];
