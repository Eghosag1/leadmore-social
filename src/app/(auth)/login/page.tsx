import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/shared/LoginForm";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const current = await getCurrentUser();
  if (current) {
    redirect(current.profile.role === "super_admin" ? "/admin" : "/dashboard");
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-muted/40 p-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-lg font-semibold tracking-tight">Leadmore Social</span>
          <p className="text-sm text-muted-foreground">Social media posts voor vastgoedkantoren</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Welkom terug</CardTitle>
            <CardDescription>Log in met uw kantoor-account.</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
