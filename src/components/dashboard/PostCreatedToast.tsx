"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/** Fires once after a redirect from the create-post flow, then strips the query param so a refresh doesn't re-show it. */
export function PostCreatedToast() {
  const router = useRouter();

  useEffect(() => {
    toast.success("Post ingepland!", { description: "U vindt de post hieronder terug in de lijst." });
    router.replace("/dashboard/scheduled");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
