import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Building2, CalendarClock, FileStack, LayoutDashboard, LayoutTemplate, Table2 } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const AGENCY_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Overzicht", icon: CalendarClock },
  { href: "/dashboard/properties", label: "Panden", icon: Building2 },
  { href: "/dashboard/scheduled", label: "Posts", icon: Table2 },
  { href: "/dashboard/templates", label: "Templates", icon: LayoutTemplate },
];

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Overzicht", icon: LayoutDashboard },
  { href: "/admin/agencies", label: "Vastgoedkantoren", icon: Building2 },
  { href: "/admin/posts", label: "Posts", icon: FileStack },
  { href: "/admin/errors", label: "Errors", icon: AlertTriangle },
];
