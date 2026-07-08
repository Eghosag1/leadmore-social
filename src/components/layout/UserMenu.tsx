"use client";

import { LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/lib/auth-actions";

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function UserMenu({ name, roleLabel }: { name: string; roleLabel: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-auto w-full items-center justify-start gap-2.5 rounded-md px-2 py-2 text-left hover:bg-neutral-100">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-neutral-900 text-xs text-white">{initials(name)}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col items-start">
          <span className="truncate text-sm font-medium text-neutral-900">{name}</span>
          <span className="truncate text-xs text-muted-foreground">{roleLabel}</span>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="p-0">
            <form action={signOutAction} className="w-full">
              <button type="submit" className="flex w-full items-center gap-2 px-1.5 py-1 text-destructive">
                <LogOut className="h-4 w-4" />
                Uitloggen
              </button>
            </form>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
