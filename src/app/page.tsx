import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function Home() {
  const current = await getCurrentUser();

  if (!current) redirect("/login");
  redirect(current.profile.role === "super_admin" ? "/admin" : "/dashboard");
}
