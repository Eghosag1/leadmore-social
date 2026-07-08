import Link from "next/link";
import { AlertTriangle, Building2, CalendarClock, LayoutList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PostStatusBadge } from "@/components/shared/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";

export default async function AdminOverviewPage() {
  const current = await requireRole(["super_admin"]);
  const supabase = await createClient();

  const [
    { count: agencyCount },
    { count: propertyCount },
    { count: scheduledCount },
    { count: failedCount },
    { data: scheduledPosts },
    { data: failedJobs },
  ] = await Promise.all([
    supabase.from("agencies").select("id", { count: "exact", head: true }),
    supabase.from("properties").select("id", { count: "exact", head: true }),
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("status", "scheduled"),
    supabase.from("post_jobs").select("id", { count: "exact", head: true }).eq("status", "failed"),
    supabase
      .from("posts")
      .select("id, agency_id, property_id, status, scheduled_at")
      .eq("status", "scheduled")
      .order("scheduled_at", { ascending: true })
      .limit(5),
    supabase.from("post_jobs").select("*").eq("status", "failed").order("updated_at", { ascending: false }).limit(5),
  ]);

  const overviewPostIds = [
    ...new Set([...(scheduledPosts ?? []).map((p) => p.id), ...(failedJobs ?? []).map((j) => j.post_id)]),
  ];
  const overviewPosts =
    overviewPostIds.length > 0
      ? (await supabase.from("posts").select("id, agency_id, property_id").in("id", overviewPostIds)).data ?? []
      : [];
  const overviewAgencyIds = [...new Set(overviewPosts.map((p) => p.agency_id))];
  const overviewPropertyIds = [...new Set(overviewPosts.map((p) => p.property_id))];

  const [{ data: overviewAgencies }, { data: overviewProperties }] = await Promise.all([
    overviewAgencyIds.length
      ? supabase.from("agencies").select("id, name").in("id", overviewAgencyIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    overviewPropertyIds.length
      ? supabase.from("properties").select("id, title").in("id", overviewPropertyIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
  ]);

  const agencyNameById = new Map((overviewAgencies ?? []).map((a) => [a.id, a.name]));
  const propertyTitleById = new Map((overviewProperties ?? []).map((p) => [p.id, p.title]));
  const overviewPostById = new Map(overviewPosts.map((p) => [p.id, p]));

  const stats = [
    { label: "Vastgoedkantoren", value: agencyCount ?? 0, icon: Building2, href: "/admin/agencies" },
    { label: "Panden (alle kantoren)", value: propertyCount ?? 0, icon: Building2, href: "/admin/agencies" },
    { label: "Ingeplande posts", value: scheduledCount ?? 0, icon: CalendarClock, href: "/admin/posts" },
    { label: "Mislukte jobs", value: failedCount ?? 0, icon: AlertTriangle, href: "/admin/errors" },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Welkom, {current.profile.full_name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Platformoverzicht over alle vastgoedkantoren.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="transition-colors hover:border-neutral-300">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{stat.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Ingeplande posts</CardTitle>
            <Link href="/admin/posts" className="text-xs font-medium text-muted-foreground hover:text-neutral-900">
              Alles bekijken
            </Link>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {!scheduledPosts || scheduledPosts.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">Geen ingeplande posts.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kantoor</TableHead>
                    <TableHead>Pand</TableHead>
                    <TableHead>Ingepland op</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scheduledPosts.map((post) => {
                    const full = overviewPostById.get(post.id);
                    return (
                      <TableRow key={post.id}>
                        <TableCell className="text-sm font-medium text-neutral-900">
                          {full ? agencyNameById.get(full.agency_id) ?? "-" : "-"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {full ? propertyTitleById.get(full.property_id) ?? "-" : "-"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDateTime(post.scheduled_at)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Errors</CardTitle>
            <Link href="/admin/errors" className="text-xs font-medium text-muted-foreground hover:text-neutral-900">
              Alles bekijken
            </Link>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {!failedJobs || failedJobs.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">Geen mislukte jobs.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kantoor</TableHead>
                    <TableHead>Pand</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {failedJobs.map((job) => {
                    const full = overviewPostById.get(job.post_id);
                    return (
                      <TableRow key={job.id}>
                        <TableCell className="text-sm font-medium text-neutral-900">
                          {full ? agencyNameById.get(full.agency_id) ?? "-" : "-"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {full ? propertyTitleById.get(full.property_id) ?? "-" : "-"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground capitalize">{job.platform}</TableCell>
                        <TableCell>
                          <PostStatusBadge status={job.status} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href="/admin/agencies/new">
          <Card className="transition-colors hover:border-neutral-300">
            <CardContent className="flex items-center gap-3 pt-6">
              <Building2 className="h-5 w-5 text-neutral-500" />
              <div>
                <p className="text-sm font-medium text-neutral-900">Nieuw vastgoedkantoor</p>
                <p className="text-xs text-muted-foreground">Kantoor aanmaken en onboarden.</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/agencies">
          <Card className="transition-colors hover:border-neutral-300">
            <CardContent className="flex items-center gap-3 pt-6">
              <LayoutList className="h-5 w-5 text-neutral-500" />
              <div>
                <p className="text-sm font-medium text-neutral-900">Alle kantoren bekijken</p>
                <p className="text-xs text-muted-foreground">Templates, koppelingen en huisstijl per kantoor beheren.</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
