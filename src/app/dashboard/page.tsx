import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { PostCalendar, type CalendarPost } from "@/components/dashboard/PostCalendar";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardOverviewPage() {
  const current = await requireRole(["agency_admin", "agency_user"]);
  const agencyId = current.profile.agency_id!;
  const supabase = await createClient();

  const { data: posts } = await supabase
    .from("posts")
    .select("id, status, scheduled_at, property_id")
    .eq("agency_id", agencyId)
    .not("scheduled_at", "is", null);

  const propertyIds = [...new Set((posts ?? []).map((p) => p.property_id))];
  const { data: properties } = propertyIds.length
    ? await supabase.from("properties").select("id, title").in("id", propertyIds)
    : { data: [] as { id: string; title: string }[] };
  const propertyTitleById = new Map((properties ?? []).map((p) => [p.id, p.title]));

  const calendarPosts: CalendarPost[] = (posts ?? [])
    .filter((post) => post.scheduled_at)
    .map((post) => ({
      id: post.id,
      scheduledAt: post.scheduled_at!,
      status: post.status,
      propertyTitle: propertyTitleById.get(post.property_id) ?? "Onbekend pand",
    }));

  return (
    <div>
      <PageHeader
        title="Overzicht"
        description="Uw geplande social media posts in kalendervorm."
        actions={
          <Button nativeButton={false} render={<Link href="/dashboard/properties" />}>
            <Plus className="h-4 w-4" />
            Nieuwe post maken
          </Button>
        }
      />

      <PostCalendar posts={calendarPosts} />
    </div>
  );
}
