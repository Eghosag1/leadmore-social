// Starting points for the admin's template code editor. These are plain TSX
// strings — not real, compiled files — deliberately self-contained (no
// imports beyond what DynamicTemplateRenderer injects: React + next/image's
// Image) since that's the only scope admin-authored template code runs in.
// See src/lib/dynamic-template.ts.

export interface TemplateStarter {
  id: string;
  label: string;
  slideCount: number;
  source: string;
}

const SINGLE_SOURCE = `function Template({ data, className }) {
  const cover = data.images[0];
  const formatPrice = (price) =>
    price === null
      ? "Prijs op aanvraag"
      : new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(price);

  return (
    <div className={["relative h-full w-full overflow-hidden rounded-lg bg-neutral-900 text-white shadow-sm", className].filter(Boolean).join(" ")}>
      {cover ? (
        <Image src={cover} alt={data.title} fill sizes="600px" className="object-cover" priority />
      ) : (
        <div className="absolute inset-0 bg-neutral-800" />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/40" />

      {data.agencyLogo && (
        <div className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-white shadow-md">
          <Image src={data.agencyLogo} alt={data.agencyName} width={44} height={44} className="h-full w-full object-cover" />
        </div>
      )}

      {data.badgeText && (
        <span
          className="absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow"
          style={{ backgroundColor: data.brandColor }}
        >
          {data.badgeText}
        </span>
      )}

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-5">
        <div className="flex items-center gap-1.5 text-sm font-medium text-white/85">
          <span>📍</span>
          <span className="truncate">{data.location}</span>
        </div>

        <h2 className="text-xl font-semibold leading-snug text-white">{data.title}</h2>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/90">
          {data.fields.showPrice && <span className="text-base font-bold text-white">{formatPrice(data.price)}</span>}
          {data.fields.showBedrooms && data.bedrooms !== null && <span>🛏 {data.bedrooms}</span>}
          {data.fields.showBathrooms && data.bathrooms !== null && <span>🛁 {data.bathrooms}</span>}
          {data.fields.showSurface && data.surface !== null && <span>📐 {data.surface} m²</span>}
        </div>

        {data.ctaText && (
          <span
            className="mt-1 inline-flex w-fit items-center rounded-full px-3 py-1.5 text-xs font-semibold text-white"
            style={{ backgroundColor: data.brandColor }}
          >
            {data.ctaText}
          </span>
        )}
      </div>
    </div>
  );
}

export default Template;
`;

const CAROUSEL_SOURCE = `function Template({ data, slideIndex, className }) {
  const cover = data.images[0];
  const formatPrice = (price) =>
    price === null
      ? "Prijs op aanvraag"
      : new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(price);

  const frameClass = ["relative h-full w-full overflow-hidden rounded-lg bg-neutral-900 text-white shadow-sm", className]
    .filter(Boolean)
    .join(" ");

  if (slideIndex === 1) {
    const stats = [];
    if (data.fields.showBedrooms && data.bedrooms !== null) stats.push(["Slaapkamers", data.bedrooms]);
    if (data.fields.showBathrooms && data.bathrooms !== null) stats.push(["Badkamers", data.bathrooms]);
    if (data.fields.showSurface && data.surface !== null) stats.push(["Oppervlakte", data.surface + " m²"]);

    return (
      <div className={frameClass}>
        <div className="flex h-full w-full flex-col justify-center gap-6 p-8" style={{ backgroundColor: data.brandColor }}>
          {data.fields.showPrice && (
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-white/70">Vraagprijs</p>
              <p className="text-3xl font-bold text-white">{formatPrice(data.price)}</p>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3">
            {stats.map(([label, value]) => (
              <div key={label} className="flex items-center gap-3 rounded-lg bg-white/10 px-4 py-3">
                <span className="text-sm text-white/80">{label}</span>
                <span className="ml-auto text-base font-semibold text-white">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (slideIndex === 2) {
    return (
      <div className={frameClass}>
        <div className="flex h-full w-full flex-col justify-center gap-4 p-8" style={{ backgroundColor: data.secondaryColor ?? data.brandColor }}>
          <p className="text-sm font-medium uppercase tracking-wide text-white/70">Over dit pand</p>
          <p className="text-lg leading-relaxed text-white">
            {data.fields.showDescription ? (data.description ?? "Neem contact op voor meer informatie over dit pand.") : ""}
          </p>
        </div>
      </div>
    );
  }

  if (slideIndex === 3) {
    return (
      <div className={frameClass}>
        <div className="flex h-full w-full flex-col items-center justify-center gap-5 p-8 text-center" style={{ backgroundColor: data.brandColor }}>
          {data.agencyLogo && (
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-white shadow-md">
              <Image src={data.agencyLogo} alt={data.agencyName} width={64} height={64} className="h-full w-full object-cover" />
            </div>
          )}
          <p className="text-lg font-semibold text-white">{data.agencyName}</p>
          <p className="text-base text-white/90">{data.ctaText ?? "Neem contact met ons op"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={frameClass}>
      {cover ? (
        <Image src={cover} alt={data.title} fill sizes="600px" className="object-cover" priority />
      ) : (
        <div className="absolute inset-0 bg-neutral-800" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/5 to-black/30" />
      {data.badgeText && (
        <span
          className="absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow"
          style={{ backgroundColor: data.brandColor }}
        >
          {data.badgeText}
        </span>
      )}
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-5">
        <div className="flex items-center gap-1.5 text-sm font-medium text-white/85">
          <span>📍</span>
          <span className="truncate">{data.location}</span>
        </div>
        <h2 className="text-xl font-semibold leading-snug text-white">{data.title}</h2>
      </div>
    </div>
  );
}

export default Template;
`;

const SOLD_SOURCE = `function Template({ data, className }) {
  const cover = data.images[0];
  const ribbonByStatus = { sold: "Verkocht", rented: "Verhuurd", under_offer: "Onder optie" };
  const ribbonText = data.badgeText ?? ribbonByStatus[data.status] ?? "Niet meer beschikbaar";

  return (
    <div className={["relative h-full w-full overflow-hidden rounded-lg bg-neutral-900 text-white shadow-sm", className].filter(Boolean).join(" ")}>
      {cover ? (
        <Image src={cover} alt={data.title} fill sizes="600px" className="object-cover grayscale-[35%]" priority />
      ) : (
        <div className="absolute inset-0 bg-neutral-800" />
      )}

      <div className="absolute inset-0 bg-black/45" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/30" />

      {data.agencyLogo && (
        <div className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-white shadow-md">
          <Image src={data.agencyLogo} alt={data.agencyName} width={44} height={44} className="h-full w-full object-cover" />
        </div>
      )}

      <div className="absolute left-1/2 top-1/2 w-[140%] -translate-x-1/2 -translate-y-1/2 -rotate-[8deg]">
        <div
          className="flex items-center justify-center py-3 text-center text-2xl font-black uppercase tracking-[0.2em] text-white shadow-lg"
          style={{ backgroundColor: data.brandColor }}
        >
          {ribbonText}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-5">
        <div className="flex items-center gap-1.5 text-sm font-medium text-white/85">
          <span>📍</span>
          <span className="truncate">{data.location}</span>
        </div>
        <h2 className="text-lg font-semibold leading-snug text-white">{data.title}</h2>
        {data.ctaText && (
          <span
            className="mt-1 inline-flex w-fit items-center rounded-full px-3 py-1.5 text-xs font-semibold text-white"
            style={{ backgroundColor: data.brandColor }}
          >
            {data.ctaText}
          </span>
        )}
      </div>
    </div>
  );
}

export default Template;
`;

export const TEMPLATE_STARTERS: TemplateStarter[] = [
  { id: "single", label: "Single post", slideCount: 1, source: SINGLE_SOURCE },
  { id: "carousel", label: "Carousel (4 slides)", slideCount: 4, source: CAROUSEL_SOURCE },
  { id: "sold", label: "Verkocht/verhuurd", slideCount: 1, source: SOLD_SOURCE },
];
