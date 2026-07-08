import { cn } from "@/lib/utils";
import type { PostStatus } from "@/types/enums";
import { POST_STATUS_META } from "@/types/domain";

const TONE_CLASSES: Record<string, string> = {
  neutral: "bg-neutral-100 text-neutral-700",
  info: "bg-blue-50 text-blue-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
};

export function PostStatusBadge({ status }: { status: PostStatus }) {
  const meta = POST_STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONE_CLASSES[meta.tone],
      )}
    >
      {meta.label}
    </span>
  );
}
