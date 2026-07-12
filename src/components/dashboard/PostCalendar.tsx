"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { nl } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PostQuickViewSheet } from "@/components/dashboard/PostQuickViewSheet";
import { cn } from "@/lib/utils";
import type { PostStatus } from "@/types/enums";

export interface CalendarPost {
  id: string;
  scheduledAt: string;
  status: PostStatus;
  propertyTitle: string;
}

const STATUS_DOT: Record<PostStatus, string> = {
  draft: "bg-neutral-300",
  pending_render: "bg-blue-400",
  rendering: "bg-blue-400",
  ready: "bg-blue-400",
  rendered: "bg-blue-400",
  scheduled: "bg-emerald-500",
  published: "bg-emerald-500",
  failed: "bg-red-500",
  render_failed: "bg-red-500",
  publish_failed: "bg-red-500",
  cancelled: "bg-amber-400",
};

const WEEKDAY_LABELS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

export function PostCalendar({ posts }: { posts: CalendarPost[] }) {
  const router = useRouter();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  const postsByDay = useMemo(() => {
    const map = new Map<string, CalendarPost[]>();
    for (const post of posts) {
      const key = format(new Date(post.scheduledAt), "yyyy-MM-dd");
      map.set(key, [...(map.get(key) ?? []), post]);
    }
    return map;
  }, [posts]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold capitalize text-neutral-900">{format(month, "MMMM yyyy", { locale: nl })}</h2>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="icon-sm" onClick={() => setMonth((m) => subMonths(m, 1))} aria-label="Vorige maand">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>
            Vandaag
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Volgende maand">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-neutral-200 bg-neutral-200">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="bg-neutral-50 px-2 py-1.5 text-center text-xs font-medium text-muted-foreground">
            {label}
          </div>
        ))}
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayPosts = postsByDay.get(key) ?? [];
          const inMonth = isSameMonth(day, month);
          return (
            <div
              key={key}
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/dashboard/properties?date=${key}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") router.push(`/dashboard/properties?date=${key}`);
              }}
              className={cn(
                "flex min-h-[104px] cursor-pointer flex-col gap-1 bg-white p-1.5 hover:bg-neutral-50",
                !inMonth && "bg-neutral-50/60",
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-xs",
                  isToday(day) ? "bg-neutral-900 font-semibold text-white" : inMonth ? "text-neutral-700" : "text-neutral-400",
                )}
              >
                {format(day, "d")}
              </span>
              <div className="flex flex-col gap-0.5">
                {dayPosts.slice(0, 3).map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPostId(post.id);
                    }}
                    className="flex items-center gap-1 truncate rounded bg-neutral-50 px-1 py-0.5 text-left text-[11px] text-neutral-700 hover:bg-neutral-100"
                  >
                    <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[post.status])} />
                    <span className="truncate">{post.propertyTitle}</span>
                  </button>
                ))}
                {dayPosts.length > 3 && <span className="px-1 text-[11px] text-muted-foreground">+{dayPosts.length - 3} meer</span>}
              </div>
            </div>
          );
        })}
      </div>

      <PostQuickViewSheet
        postId={selectedPostId}
        open={selectedPostId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedPostId(null);
        }}
      />
    </div>
  );
}
