import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { PostStatusBadge } from "@/components/shared/StatusBadge";
import { PostCreatedToast } from "@/components/dashboard/PostCreatedToast";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { friendlyErrorMessage } from "@/lib/friendly-error";
import { reconcilePublishedPosts } from "@/services/posts/publishReconciliationService";
import type { PostJobRow, PostRow } from "@/types/database";
import type { Platform, PostStatus } from "@/types/enums";

// lucide-react no longer ships brand marks (trademark reasons), so platforms
// are labelled with short text badges instead of logos.
const PLATFORM_LABEL: Record<Platform, string> = { facebook: "FB", instagram: "IG" };

// Mirrors PostDetailClient's canEdit — these statuses still allow editing caption/date.
const EDITABLE_STATUSES: PostStatus[] = ["draft", "ready", "rendered", "scheduled", "render_failed", "publish_failed"];
const FAILED_STATUSES: PostStatus[] = ["render_failed", "publish_failed", "failed"];

export default async function PostsPage({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  const { created } = await searchParams;
  const current = await requireRole(["agency_admin", "agency_user"]);
  const agencyId = current.profile.agency_id!;
  const supabase = await createClient();

  // No webhook tells us Meta actually published a scheduled post — reconcile
  // lazily on read, the moment this list is viewed (see postDetailService.ts
  // for the single-post equivalent).
  const { data: scheduledCandidates } = await supabase.from("posts").select("id").eq("agency_id", agencyId).eq("status", "scheduled");
  if (scheduledCandidates?.length) await reconcilePublishedPosts(scheduledCandidates.map((p) => p.id));

  const { data: posts } = await supabase
    .from("posts")
    .select("*")
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false });

  const postIds = (posts ?? []).map((p) => p.id);
  const propertyIds = [...new Set((posts ?? []).map((p) => p.property_id))];

  const [{ data: properties }, { data: jobs }] = await Promise.all([
    propertyIds.length
      ? supabase.from("properties").select("id, title").in("id", propertyIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    postIds.length ? supabase.from("post_jobs").select("*").in("post_id", postIds) : Promise.resolve({ data: [] }),
  ]);

  const propertyTitleById = new Map((properties ?? []).map((p) => [p.id, p.title]));
  const jobsByPost = new Map<string, typeof jobs>();
  for (const job of jobs ?? []) {
    jobsByPost.set(job.post_id, [...(jobsByPost.get(job.post_id) ?? []), job]);
  }

  const publishedPosts = posts?.filter((p) => p.status === "published") ?? [];
  const failedPosts = posts?.filter((p) => FAILED_STATUSES.includes(p.status)) ?? [];
  const scheduledPosts = posts?.filter((p) => p.status !== "published" && !FAILED_STATUSES.includes(p.status)) ?? [];

  return (
    <div>
      {created === "1" && <PostCreatedToast />}
      <PageHeader title="Posts" description="Alle posts die u heeft aangemaakt, ingepland via Facebook en Instagram." />

      {!posts || posts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-200 py-16 text-center text-sm text-muted-foreground">
          Nog geen posts aangemaakt.
        </p>
      ) : (
        <Tabs defaultValue="scheduled">
          <TabsList>
            <TabsTrigger value="scheduled">Ingepland ({scheduledPosts.length})</TabsTrigger>
            <TabsTrigger value="published">Gepubliceerd ({publishedPosts.length})</TabsTrigger>
            <TabsTrigger value="failed" className="gap-1.5">
              Mislukt
              {failedPosts.length > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
                  {failedPosts.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="scheduled">
            <PostsTable posts={scheduledPosts} propertyTitleById={propertyTitleById} jobsByPost={jobsByPost} />
          </TabsContent>
          <TabsContent value="published">
            <PostsTable posts={publishedPosts} propertyTitleById={propertyTitleById} jobsByPost={jobsByPost} />
          </TabsContent>
          <TabsContent value="failed">
            <PostsTable posts={failedPosts} propertyTitleById={propertyTitleById} jobsByPost={jobsByPost} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function PostsTable({
  posts,
  propertyTitleById,
  jobsByPost,
}: {
  posts: PostRow[];
  propertyTitleById: Map<string, string>;
  jobsByPost: Map<string, PostJobRow[] | null | undefined>;
}) {
  if (posts.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-neutral-200 py-16 text-center text-sm text-muted-foreground">
        Geen posts in dit tabblad.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Pand</TableHead>
          <TableHead>Bijschrift</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Platform</TableHead>
          <TableHead>Ingepland op</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actie</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {posts.map((post) => {
          const postJobs = jobsByPost.get(post.id) ?? [];
          return (
            <TableRow key={post.id}>
              <TableCell className="font-medium text-neutral-900">
                {propertyTitleById.get(post.property_id) ?? "Onbekend pand"}
              </TableCell>
              <TableCell className="max-w-64 truncate text-sm text-muted-foreground">{post.caption}</TableCell>
              <TableCell className="text-sm text-muted-foreground capitalize">{post.post_type}</TableCell>
              <TableCell>
                <div className="flex gap-1.5">
                  {postJobs.map((job) => (
                    <span
                      key={job.platform}
                      title={job.error_message ? friendlyErrorMessage(job.error_message) : undefined}
                      className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600"
                    >
                      {PLATFORM_LABEL[job.platform]}
                    </span>
                  ))}
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{formatDateTime(post.scheduled_at)}</TableCell>
              <TableCell>
                <PostStatusBadge status={post.status} />
              </TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/dashboard/posts/${post.id}`} />}>
                  {/* Failed posts open the same detail page as any other post — same per-platform status
                      breakdown, plus both "Bewerken" and "Opnieuw proberen" there — but "Bekijken" is the
                      honest label from this list: the primary reason to click through is to see what went
                      wrong, not to edit fields. */}
                  {FAILED_STATUSES.includes(post.status) ? "Bekijken" : EDITABLE_STATUSES.includes(post.status) ? "Bewerken" : "Bekijken"}
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
