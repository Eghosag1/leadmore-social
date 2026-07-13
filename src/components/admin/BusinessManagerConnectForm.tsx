"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Circle, CheckCircle2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { BusinessManagerConnectState } from "@/app/admin/agencies/actions";

/**
 * The one-time steps (System User created + given an App role + a token
 * generated) only ever need to happen once for Leadmore's own Business
 * Manager, not per agency — see CLAUDE.md's "Tweede koppelmethode" section.
 * Listed here purely for context, not tracked per agency.
 */
const ONE_TIME_STEPS = [
  "Systeemgebruiker aangemaakt in Leadmore's eigen Business Manager.",
  'Die systeemgebruiker heeft een rol op de app "Leadmore Social" zelf (Business Settings → Apps → Mensen toewijzen).',
  "Systeemgebruiker-token gegenereerd met alle 5 permissies aangevinkt en in META_SYSTEM_USER_TOKEN gezet.",
];

/**
 * The two steps that genuinely repeat for every new agency whose Page ends
 * up inside a Business Portfolio (which, per CLAUDE.md, is now the common
 * case — Meta auto-adds a Page to a Portfolio the moment Instagram is
 * linked). Tracked as checked/unchecked per agency in localStorage, purely
 * to help the admin pick back up mid-flow — nothing server-side depends on
 * this state, it's just a memory aid while switching between browser tabs.
 */
const PER_AGENCY_STEPS = [
  {
    id: "share-page",
    title: "Het kantoor deelt hun Pagina met Leadmore",
    description:
      "Vraag het kantoor om, vanuit hún Business Settings, naar Pagina's te gaan → de Pagina → Partners toevoegen → Leadmore's Business Manager-ID hieronder invullen.",
  },
  {
    id: "assign-page-role",
    title: "Wijs de systeemgebruiker een rol toe op die Pagina",
    description:
      "Ga zelf naar Leadmore's Business Settings → Pagina's → de nu zichtbare gedeelde Pagina → Mensen toewijzen → geef de systeemgebruiker een rol. Overslaan geeft later \"(#10) This endpoint requires the 'pages_read_engagement' permission...\" — de permissie staat dan wel aangevinkt op het token, maar heeft niets om op toe te passen.",
  },
];

function storageKey(agencyId: string) {
  return `bm-connect-steps:${agencyId}`;
}

export function BusinessManagerConnectForm({
  agencyId,
  businessManagerId,
  action,
}: {
  agencyId: string;
  businessManagerId?: string;
  action: (prev: BusinessManagerConnectState, formData: FormData) => Promise<BusinessManagerConnectState>;
}) {
  const [state, formAction, isPending] = useActionState(action, { error: null });
  const [expanded, setExpanded] = useState(false);
  // Lazy initializer (not an effect) so this reads localStorage once on
  // mount without a synchronous post-mount setState — the settings page
  // remounts this component per agency navigation, so agencyId is stable
  // for the component's lifetime.
  const [checked, setChecked] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    const raw = window.localStorage.getItem(storageKey(agencyId));
    if (!raw) return new Set();
    try {
      return new Set(JSON.parse(raw));
    } catch {
      return new Set();
    }
  });

  function toggleStep(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      window.localStorage.setItem(storageKey(agencyId), JSON.stringify([...next]));
      return next;
    });
  }

  async function copyBusinessManagerId() {
    if (!businessManagerId) return;
    await navigator.clipboard.writeText(businessManagerId);
    toast.success("Business Manager-ID gekopieerd.");
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-dashed border-neutral-200 p-3">
      <button type="button" onClick={() => setExpanded((v) => !v)} className="flex items-center justify-between gap-2 text-left">
        <div>
          <p className="text-sm font-medium text-neutral-900">Pagina binnen een Business Portfolio?</p>
          <p className="text-xs text-muted-foreground">
            Gebruik deze gids als de gewone &quot;Verbind met Facebook&quot;-knop de Pagina niet vindt.
          </p>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 shrink-0 text-neutral-400" /> : <ChevronDown className="h-4 w-4 shrink-0 text-neutral-400" />}
      </button>

      {expanded && (
        <div className="flex flex-col gap-4 border-t border-neutral-100 pt-3">
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-neutral-500 uppercase">Eenmalig, al gebeurd voor Leadmore</p>
            {ONE_TIME_STEPS.map((step) => (
              <div key={step} className="flex items-start gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                <span>{step}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-neutral-500 uppercase">Per kantoor te doen</p>
            {PER_AGENCY_STEPS.map((step, index) => {
              const isChecked = checked.has(step.id);
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => toggleStep(step.id)}
                  className="flex items-start gap-2 rounded-md p-1.5 text-left hover:bg-neutral-50"
                >
                  {isChecked ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <Circle className="mt-0.5 h-4 w-4 shrink-0 text-neutral-300" />
                  )}
                  <span>
                    <span className={`text-sm font-medium ${isChecked ? "text-neutral-400 line-through" : "text-neutral-900"}`}>
                      {index + 1}. {step.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{step.description}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="businessManagerIdDisplay">Leadmore&apos;s Business Manager-ID</Label>
            <div className="flex gap-2">
              <Input id="businessManagerIdDisplay" readOnly value={businessManagerId ?? "Niet ingesteld — zie META_BUSINESS_MANAGER_ID"} />
              {businessManagerId && (
                <Button type="button" size="sm" variant="outline" onClick={copyBusinessManagerId}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-neutral-500 uppercase">Tot slot</p>
            <p className="text-xs text-muted-foreground">Vul het Facebook-pagina ID van het kantoor in en koppel.</p>
            <form action={formAction} className="flex items-end gap-2">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="businessManagerPageId">Facebook-pagina ID</Label>
                <Input id="businessManagerPageId" name="businessManagerPageId" placeholder="1234567890" />
              </div>
              <Button type="submit" size="sm" variant="outline" disabled={isPending}>
                {isPending ? "Bezig..." : "Koppel via Business Manager"}
              </Button>
            </form>
            {state.error && (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      )}

      {!expanded && checked.size > 0 && (
        <Badge variant="secondary" className="w-fit">
          {checked.size}/{PER_AGENCY_STEPS.length} stappen aangevinkt
        </Badge>
      )}
    </div>
  );
}
