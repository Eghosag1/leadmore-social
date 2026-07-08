import type { AgencyRow } from "@/types/database";
import { AGENCY_IDS } from "./ids";

export type MockAgency = Pick<
  AgencyRow,
  "id" | "name" | "slug" | "logo_url" | "primary_color" | "secondary_color" | "website_url"
>;

export const MOCK_AGENCIES: MockAgency[] = [
  {
    id: AGENCY_IDS.deMeester,
    name: "Vastgoed De Meester",
    slug: "vastgoed-de-meester",
    logo_url: "https://api.dicebear.com/9.x/initials/png?seed=De%20Meester&backgroundType=solid&backgroundColor=0f172a",
    primary_color: "#0f172a",
    secondary_color: "#c9a227",
    website_url: "https://www.vastgoeddemeester.example",
  },
  {
    id: AGENCY_IDS.huysHaard,
    name: "Huys & Haard Makelaars",
    slug: "huys-en-haard",
    logo_url: "https://api.dicebear.com/9.x/initials/png?seed=Huys%20Haard&backgroundType=solid&backgroundColor=1d4f3f",
    primary_color: "#1d4f3f",
    secondary_color: "#d97706",
    website_url: "https://www.huysenhaard.example",
  },
];
