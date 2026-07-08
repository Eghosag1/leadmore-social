import type { ProfileRole } from "@/types/enums";
import { AGENCY_IDS, PROFILE_IDS } from "./ids";

export interface MockUser {
  profileId: string;
  email: string;
  password: string;
  fullName: string;
  role: ProfileRole;
  agencyId: string | null;
}

// Passwords are for local/demo seeding only — never reuse this pattern for
// anything that touches a real environment.
export const MOCK_USERS: MockUser[] = [
  {
    profileId: PROFILE_IDS.superAdmin,
    email: "admin@leadmore.be",
    password: "Leadmore123!",
    fullName: "Eghosa (Platform Admin)",
    role: "super_admin",
    agencyId: null,
  },
  {
    profileId: PROFILE_IDS.deMeesterAdmin,
    email: "admin@vastgoeddemeester.example",
    password: "Leadmore123!",
    fullName: "Sophie De Meester",
    role: "agency_admin",
    agencyId: AGENCY_IDS.deMeester,
  },
  {
    profileId: PROFILE_IDS.deMeesterUser,
    email: "medewerker@vastgoeddemeester.example",
    password: "Leadmore123!",
    fullName: "Tom Vermeulen",
    role: "agency_user",
    agencyId: AGENCY_IDS.deMeester,
  },
  {
    profileId: PROFILE_IDS.huysHaardAdmin,
    email: "admin@huysenhaard.example",
    password: "Leadmore123!",
    fullName: "Karim Haddad",
    role: "agency_admin",
    agencyId: AGENCY_IDS.huysHaard,
  },
  {
    profileId: PROFILE_IDS.huysHaardUser,
    email: "medewerker@huysenhaard.example",
    password: "Leadmore123!",
    fullName: "Elke Van Damme",
    role: "agency_user",
    agencyId: AGENCY_IDS.huysHaard,
  },
];
