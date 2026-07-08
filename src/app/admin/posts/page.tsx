import { PageHeader } from "@/components/shared/PageHeader";
import { PostStatusBadge } from "@/components/shared/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";

export default async function AdminPostsPage() {
  await requireRole(["super_admin"]);
  const supabase = await createClient();

  const { data: posts } = await supabase.from("posts").select("*").order("created_at", { ascending: false }).limit(100);

  const agencyIds = [...new Set((posts ?? []).map((p) => p.agency_id))];
  const propertyIds = [...new Set((posts ?? []).map((p) => p.property_id))];

  const [{ data: agencies }, { data: properties }] = await Promise.all([
    agencyIds.length ? supabase.from("agencies").select("id, name").in("id", agencyIds) : Promise.resolve({ data: [] }),
    propertyIds.length
      ? supabase.from("properties").select("id, title").in("id", propertyIds)
      : Promise.resolve({ data: [] }),
  ]);

  const agencyNameById = new Map((agencies ?? []).map((a) => [a.id, a.name]));
  const propertyTitleById = new Map((properties ?? []).map((p) => [p.id, p.title]));

  return (
    <div>
      <PageHeader title="Posts" description="Alle posts over alle vastgoedkantoren, meest recent eerst." />

      {!posts || posts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-200 py-16 text-center text-sm text-muted-foreground">
          Nog geen posts aangemaakt.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kantoor</TableHead>
              <TableHead>Pand</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Ingepland op</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {posts.map((post) => (
              <TableRow key={post.id}>
                <TableCell className="text-sm font-medium text-neutral-900">
                  {agencyNameById.get(post.agency_id) ?? "-"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {propertyTitleById.get(post.property_id) ?? "-"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground capitalize">{post.post_type}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDateTime(post.scheduled_at)}</TableCell>
                <TableCell>
                  <PostStatusBadge status={post.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
