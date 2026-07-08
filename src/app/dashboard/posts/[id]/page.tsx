import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { PostDetailClient } from "@/components/dashboard/PostDetailClient";
import { requireRole } from "@/lib/auth";
import { getPostDetailData } from "@/services/posts/postDetailService";

export default async function PostDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const current = await requireRole(["agency_admin", "agency_user"]);
  const agencyId = current.profile.agency_id!;

  const data = await getPostDetailData(id, agencyId);
  if (!data) notFound();

  return (
    <div>
      <PageHeader
        title="Post"
        description={data.propertyTitle}
        backHref={from === "dashboard" ? "/dashboard" : "/dashboard/scheduled"}
        backLabel={from === "dashboard" ? "Overzicht" : "Posts"}
      />
      <PostDetailClient
        postId={data.postId}
        property={data.property}
        initialCaption={data.initialCaption}
        scheduledAt={data.scheduledAt}
        status={data.status}
        jobs={data.jobs}
        propertyTitle={data.propertyTitle}
        componentSource={data.componentSource}
        slideCount={data.slideCount}
        previewData={data.previewData}
        agencyName={data.agencyName}
        agencyLogo={data.agencyLogo}
        hasRenderFallback={data.hasRenderFallback}
      />
    </div>
  );
}
