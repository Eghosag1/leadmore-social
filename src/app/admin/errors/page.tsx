import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";

export default async function AdminErrorsPage() {
  await requireRole(["super_admin"]);
  const supabase = await createClient();

  const { data: failedJobs } = await supabase
    .from("post_jobs")
    .select("*")
    .eq("status", "failed")
    .order("updated_at", { ascending: false });

  const postIds = [...new Set((failedJobs ?? []).map((j) => j.post_id))];
  const { data: posts } = postIds.length
    ? await supabase.from("posts").select("id, agency_id, property_id, caption").in("id", postIds)
    : { data: [] };

  const agencyIds = [...new Set((posts ?? []).map((p) => p.agency_id))];
  const propertyIds = [...new Set((posts ?? []).map((p) => p.property_id))];
  const [{ data: agencies }, { data: properties }] = await Promise.all([
    agencyIds.length ? supabase.from("agencies").select("id, name").in("id", agencyIds) : Promise.resolve({ data: [] }),
    propertyIds.length
      ? supabase.from("properties").select("id, title").in("id", propertyIds)
      : Promise.resolve({ data: [] }),
  ]);

  const postById = new Map((posts ?? []).map((p) => [p.id, p]));
  const agencyNameById = new Map((agencies ?? []).map((a) => [a.id, a.name]));
  const propertyTitleById = new Map((properties ?? []).map((p) => [p.id, p.title]));

  return (
    <div>
      <PageHeader title="Errors" description="Mislukte post-jobs over alle vastgoedkantoren." />

      {!failedJobs || failedJobs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-200 py-16 text-center text-sm text-muted-foreground">
          Geen mislukte jobs. Alles loopt vlot.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {failedJobs.map((job) => {
            const post = postById.get(job.post_id);
            return (
              <Card key={job.id}>
                <CardContent className="pt-6">
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>
                      {post ? agencyNameById.get(post.agency_id) : "Onbekend kantoor"} —{" "}
                      {job.platform === "facebook" ? "Facebook" : "Instagram"}
                    </AlertTitle>
                    <AlertDescription>
                      <p>{post ? propertyTitleById.get(post.property_id) : "Onbekend pand"}</p>
                      <p className="mt-1">{job.error_message ?? "Geen foutdetails beschikbaar."}</p>
                      <p className="mt-1 text-xs opacity-70">{formatDateTime(job.updated_at)}</p>
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
