import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ForgotPasswordForm } from "@/components/shared/ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-muted/40 p-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-lg font-semibold tracking-tight">Leadmore Social</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Wachtwoord vergeten</CardTitle>
            <CardDescription>Vul uw e-mailadres in, we sturen een link om een nieuw wachtwoord in te stellen.</CardDescription>
          </CardHeader>
          <CardContent>
            <ForgotPasswordForm />
          </CardContent>
        </Card>
        <p className="text-center text-xs text-muted-foreground">
          <Link href="/login" className="hover:underline">
            ← Terug naar inloggen
          </Link>
        </p>
      </div>
    </div>
  );
}
