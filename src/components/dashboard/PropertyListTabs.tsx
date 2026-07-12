"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PostStatusBadge } from "@/components/shared/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, formatPrice, propertyStatusLabel } from "@/lib/format";
import type { PostStatus, PropertyListingType, PropertyStatus } from "@/types/enums";

const STATUS_VARIANT: Record<PropertyStatus, "default" | "secondary" | "outline"> = {
  available: "default",
  under_offer: "secondary",
  sold: "outline",
  rented: "outline",
  withdrawn: "outline",
};

export interface PropertyListRow {
  id: string;
  location: string;
  title: string;
  price: number;
  status: PropertyStatus;
  listingType: PropertyListingType;
  listedAt: string | null;
  thumbnailUrl: string | undefined;
  postStatus: PostStatus | undefined;
}

export function PropertyListTabs({ properties, safeDate }: { properties: PropertyListRow[]; safeDate?: string }) {
  const [activeTab, setActiveTab] = useState<PropertyListingType>("sale");
  const [search, setSearch] = useState("");

  const forSale = useMemo(() => properties.filter((p) => p.listingType === "sale"), [properties]);
  const forRent = useMemo(() => properties.filter((p) => p.listingType === "rent"), [properties]);

  const searchTerm = search.trim().toLowerCase();
  const filterBySearch = (rows: PropertyListRow[]) =>
    searchTerm ? rows.filter((p) => p.location.toLowerCase().includes(searchTerm)) : rows;

  return (
    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as PropertyListingType)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="sale">Te koop ({forSale.length})</TabsTrigger>
          <TabsTrigger value="rent">Te huur ({forRent.length})</TabsTrigger>
        </TabsList>
        <div className="relative w-full max-w-64">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Zoek op adres..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-7"
          />
        </div>
      </div>
      <TabsContent value="sale">
        <PropertyTable rows={filterBySearch(forSale)} searching={!!searchTerm} safeDate={safeDate} />
      </TabsContent>
      <TabsContent value="rent">
        <PropertyTable rows={filterBySearch(forRent)} searching={!!searchTerm} safeDate={safeDate} />
      </TabsContent>
    </Tabs>
  );
}

function PropertyTable({ rows, searching, safeDate }: { rows: PropertyListRow[]; searching: boolean; safeDate?: string }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-neutral-200 py-16 text-center text-sm text-muted-foreground">
        {searching ? "Geen panden gevonden voor deze zoekopdracht." : "Geen panden in dit tabblad."}
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-14" />
          <TableHead>Adres</TableHead>
          <TableHead>Prijs</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Gepubliceerd (CRM)</TableHead>
          <TableHead>Social post</TableHead>
          <TableHead className="text-right">Actie</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((property) => (
          <TableRow key={property.id}>
            <TableCell>
              <Link href={`/dashboard/properties/${property.id}`} className="relative block h-10 w-10 overflow-hidden rounded-md bg-neutral-100">
                {property.thumbnailUrl && <Image src={property.thumbnailUrl} alt="" fill sizes="40px" className="object-cover" />}
              </Link>
            </TableCell>
            <TableCell>
              <Link href={`/dashboard/properties/${property.id}`} className="hover:underline">
                <p className="font-medium text-neutral-900">{property.location}</p>
                <p className="text-xs text-muted-foreground">{property.title}</p>
              </Link>
            </TableCell>
            <TableCell className="text-sm text-neutral-700">{formatPrice(property.price)}</TableCell>
            <TableCell>
              <Badge variant={STATUS_VARIANT[property.status]}>{propertyStatusLabel(property.status)}</Badge>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">{formatDate(property.listedAt)}</TableCell>
            <TableCell>
              {property.postStatus ? (
                <PostStatusBadge status={property.postStatus} />
              ) : (
                <span className="text-xs text-muted-foreground">Nog niet gepland</span>
              )}
            </TableCell>
            <TableCell className="text-right">
              <Button
                size="sm"
                nativeButton={false}
                render={
                  <Link
                    href={`/dashboard/create-post/${property.id}?returnTo=${encodeURIComponent("/dashboard/properties")}${safeDate ? `&date=${safeDate}` : ""}`}
                  />
                }
              >
                Post maken
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
