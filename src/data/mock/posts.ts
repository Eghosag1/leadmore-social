import type { Platform, PostStatus, PostType } from "@/types/enums";
import { AGENCY_IDS, AGENCY_TEMPLATE_IDS, POST_IDS, PROFILE_IDS, PROPERTY_IDS } from "./ids";

export interface MockPostSlide {
  sort_order: number;
  image_url: string;
  text_content: Record<string, unknown>;
  rendered_image_url: string | null;
}

export interface MockPostJob {
  platform: Platform;
  status: PostStatus;
  scheduled_at: string | null;
  meta_object_id: string | null;
  error_message: string | null;
}

export interface MockPost {
  id: string;
  agency_id: string;
  property_id: string;
  agency_template_id: string;
  post_type: PostType;
  caption: string;
  status: PostStatus;
  scheduled_at: string | null;
  created_by: string;
  slides: MockPostSlide[];
  jobs: MockPostJob[];
}

export const MOCK_POSTS: MockPost[] = [
  {
    id: POST_IDS.deMeesterScheduled,
    agency_id: AGENCY_IDS.deMeester,
    property_id: PROPERTY_IDS.deMeester[0],
    agency_template_id: AGENCY_TEMPLATE_IDS.deMeesterNieuwPand,
    post_type: "single",
    caption:
      "Nieuw op de markt: karaktervolle herenwoning met tuin in Cogels-Osylei. 4 slaapkamers, 220m² en een zuidgerichte tuin. Interesse? Neem contact op! 🏡",
    status: "scheduled",
    scheduled_at: "2026-07-10T14:00:00.000Z",
    created_by: PROFILE_IDS.deMeesterUser,
    slides: [
      {
        sort_order: 0,
        image_url: "https://picsum.photos/seed/dm-1001-0/1200/900",
        text_content: { title: "Nieuw op de markt", location: "Cogels-Osylei, Antwerpen" },
        rendered_image_url: null,
      },
    ],
    jobs: [
      { platform: "facebook", status: "scheduled", scheduled_at: "2026-07-10T14:00:00.000Z", meta_object_id: null, error_message: null },
      { platform: "instagram", status: "scheduled", scheduled_at: "2026-07-10T14:00:00.000Z", meta_object_id: null, error_message: null },
    ],
  },
  {
    id: POST_IDS.deMeesterPublished,
    agency_id: AGENCY_IDS.deMeester,
    property_id: PROPERTY_IDS.deMeester[4],
    agency_template_id: AGENCY_TEMPLATE_IDS.deMeesterVerkocht,
    post_type: "single",
    caption: "Verkocht! Dit recent gebouwde rijhuis in Berchem vond een nieuwe eigenaar. Ook uw pand verkopen? Wij helpen u graag verder.",
    status: "published",
    scheduled_at: "2026-07-01T09:00:00.000Z",
    created_by: PROFILE_IDS.deMeesterAdmin,
    slides: [
      {
        sort_order: 0,
        image_url: "https://picsum.photos/seed/dm-1005-0/1200/900",
        text_content: { title: "Verkocht!", location: "Berchem, Antwerpen" },
        rendered_image_url: "https://picsum.photos/seed/dm-1005-rendered/1200/1350",
      },
    ],
    jobs: [
      {
        platform: "facebook",
        status: "published",
        scheduled_at: "2026-07-01T09:00:00.000Z",
        meta_object_id: "mock_fb_9f1c2b3a",
        error_message: null,
      },
      {
        platform: "instagram",
        status: "published",
        scheduled_at: "2026-07-01T09:00:00.000Z",
        meta_object_id: "mock_ig_7d4e5f6a",
        error_message: null,
      },
    ],
  },
  {
    id: POST_IDS.deMeesterDraft,
    agency_id: AGENCY_IDS.deMeester,
    property_id: PROPERTY_IDS.deMeester[1],
    agency_template_id: AGENCY_TEMPLATE_IDS.deMeesterCarousel,
    post_type: "carousel",
    caption: "Lichtrijk appartement met terras in Zurenborg — swipe voor alle details.",
    status: "draft",
    scheduled_at: null,
    created_by: PROFILE_IDS.deMeesterUser,
    slides: [
      {
        sort_order: 0,
        image_url: "https://picsum.photos/seed/dm-1002-0/1200/900",
        text_content: { title: "Lichtrijk appartement met terras", location: "Zurenborg, Antwerpen" },
        rendered_image_url: null,
      },
      {
        sort_order: 1,
        image_url: "https://picsum.photos/seed/dm-1002-1/1200/900",
        text_content: { price: 289000, bedrooms: 2, surface: 95 },
        rendered_image_url: null,
      },
      {
        sort_order: 2,
        image_url: "https://picsum.photos/seed/dm-1002-2/1200/900",
        text_content: {
          description: "Modern tweeslaapkamerappartement op de derde verdieping met lift, terras op het zuiden en ondergrondse parkeerplaats.",
        },
        rendered_image_url: null,
      },
      {
        sort_order: 3,
        image_url: "https://picsum.photos/seed/dm-1002-3/1200/900",
        text_content: { ctaText: "Contacteer Vastgoed De Meester" },
        rendered_image_url: null,
      },
    ],
    jobs: [],
  },
  {
    id: POST_IDS.huysHaardScheduled,
    agency_id: AGENCY_IDS.huysHaard,
    property_id: PROPERTY_IDS.huysHaard[0],
    agency_template_id: AGENCY_TEMPLATE_IDS.huysHaardNieuwPand,
    post_type: "single",
    caption: "Nieuw op de markt: verzorgde gezinswoning met ruime tuin in Sint-Amandsberg. Contacteer ons voor een bezoek!",
    status: "scheduled",
    scheduled_at: "2026-07-09T16:30:00.000Z",
    created_by: PROFILE_IDS.huysHaardUser,
    slides: [
      {
        sort_order: 0,
        image_url: "https://picsum.photos/seed/hh-2001-0/1200/900",
        text_content: { title: "Nieuw op de markt", location: "Sint-Amandsberg, Gent" },
        rendered_image_url: null,
      },
    ],
    jobs: [
      { platform: "facebook", status: "scheduled", scheduled_at: "2026-07-09T16:30:00.000Z", meta_object_id: null, error_message: null },
    ],
  },
  {
    id: POST_IDS.huysHaardFailed,
    agency_id: AGENCY_IDS.huysHaard,
    property_id: PROPERTY_IDS.huysHaard[1],
    agency_template_id: AGENCY_TEMPLATE_IDS.huysHaardCarousel,
    post_type: "carousel",
    caption: "Duplexappartement met dakterras in Patershol — een unieke kans in het centrum van Gent.",
    status: "failed",
    scheduled_at: "2026-07-05T11:00:00.000Z",
    created_by: PROFILE_IDS.huysHaardAdmin,
    slides: [
      {
        sort_order: 0,
        image_url: "https://picsum.photos/seed/hh-2002-0/1200/900",
        text_content: { title: "Duplexappartement met dakterras", location: "Patershol, Gent" },
        rendered_image_url: null,
      },
      {
        sort_order: 1,
        image_url: "https://picsum.photos/seed/hh-2002-1/1200/900",
        text_content: { price: 329000, bedrooms: 2, surface: 110 },
        rendered_image_url: null,
      },
      {
        sort_order: 2,
        image_url: "https://picsum.photos/seed/hh-2002-2/1200/900",
        text_content: { description: "Hoogwaardig afgewerkt duplexappartement met een riant dakterras en panoramisch uitzicht over de stad." },
        rendered_image_url: null,
      },
      {
        sort_order: 3,
        image_url: "https://picsum.photos/seed/hh-2002-3/1200/900",
        text_content: { ctaText: "Contacteer Huys & Haard" },
        rendered_image_url: null,
      },
    ],
    jobs: [
      {
        platform: "facebook",
        status: "published",
        scheduled_at: "2026-07-05T11:00:00.000Z",
        meta_object_id: "mock_fb_2a3b4c5d",
        error_message: null,
      },
      {
        platform: "instagram",
        status: "failed",
        scheduled_at: "2026-07-05T11:00:00.000Z",
        meta_object_id: null,
        error_message: "Meta API: instagram account niet gekoppeld aan een Facebook-pagina met publicatierechten.",
      },
    ],
  },
];
