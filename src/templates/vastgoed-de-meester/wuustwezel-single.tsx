import Image from "next/image";
import { Cormorant_Garamond, Jost } from "next/font/google";
import { AutoSizeText } from "@/templates/components/AutoSizeText";
import type { TemplateComponentProps } from "@/components/templates/types";

/**
 * Git-managed port of the Figma frame (node 564:26, "LEADS — Social") — see
 * the "Templatearchitectuur" analysis and its migration plan. Re-pulled via
 * the Figma MCP's get_design_context/download_assets (2026-07-14) to replace
 * the first pass's placeholders with the real design: inlined SVG icons
 * (exported straight from the Figma nodes, see the path data below) instead
 * of emoji stand-ins, and a real font pairing instead of plain font-serif.
 *
 * Fonts: the design uses two licensed fonts we don't have files for
 * ("IvyPresto Headline" for the title, "Agape" for stats/location) — no
 * agency has an uploaded custom font either (checked live), so this uses the
 * closest freely-available Google Fonts instead (Cormorant Garamond, Jost),
 * loaded via next/font/google like the rest of the app already does
 * (src/app/layout.tsx). Swap for data.customFontFamily first if an agency
 * ever uploads one — out of scope for this pass since the per-agency font
 * system is one font for the whole template, not a title/body split.
 *
 * Colors intentionally use `data.brandColor` (not the Figma frame's fixed
 * #297975) so the design still adapts per agency, same convention as the
 * existing DB-string starters (src/data/template-starters.ts).
 */
const titleFont = Cormorant_Garamond({ subsets: ["latin"], weight: "300" });
const bodyFont = Jost({ subsets: ["latin"], weight: "300" });

function BedIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 43 57" fill="none" className={className}>
      <path
        fill="currentColor"
        d="M0.711914 41.8814V30.7602C0.711914 30.1686 0.9091 29.4883 1.30347 28.7193C1.69784 27.9503 2.2894 27.408 3.07814 27.0925V22.0051C3.07814 20.8615 3.46265 19.9051 4.23167 19.1361C5.0007 18.3671 5.95705 17.9825 7.10072 17.9825H18.1037C18.8924 17.9825 19.5431 18.1502 20.0558 18.4854C20.5685 18.8206 20.9826 19.284 21.2981 19.8755C21.6136 19.284 22.0277 18.8206 22.5403 18.4854C23.053 18.1502 23.7037 17.9825 24.4925 17.9825H35.4954C36.6391 17.9825 37.5955 18.3671 38.3645 19.1361C39.1335 19.9051 39.518 20.8615 39.518 22.0051V27.0925C40.3068 27.408 40.8983 27.9503 41.2927 28.7193C41.687 29.4883 41.8842 30.1686 41.8842 30.7602V41.8814H40.2279V37.149H2.36827V41.8814H0.711914ZM22.1263 26.7376H37.8617V22.0051C37.8617 21.3347 37.6349 20.7727 37.1814 20.3192C36.7278 19.8657 36.1659 19.6389 35.4954 19.6389H24.4925C23.822 19.6389 23.2601 19.8657 22.8065 20.3192C22.353 20.7727 22.1263 21.3347 22.1263 22.0051V26.7376ZM4.7345 26.7376H20.4699V22.0051C20.4699 21.3347 20.2431 20.7727 19.7896 20.3192C19.3361 19.8657 18.7741 19.6389 18.1037 19.6389H7.10072C6.43029 19.6389 5.86831 19.8657 5.41479 20.3192C4.96126 20.7727 4.7345 21.3347 4.7345 22.0051V26.7376Z"
      />
    </svg>
  );
}

function BathtubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 48" fill="none" className={className}>
      <path
        fill="currentColor"
        d="M5.10486 19.6906C4.59547 19.1789 4.34077 18.5638 4.34077 17.8454C4.34077 17.0997 4.59547 16.4615 5.10486 15.9308C5.61426 15.3997 6.2469 15.1341 7.00277 15.1341C7.75865 15.1341 8.39129 15.3972 8.90068 15.9234C9.41008 16.4498 9.66478 17.0825 9.66478 17.8213C9.66478 18.5604 9.41008 19.1846 8.90068 19.694C8.39129 20.2034 7.75865 20.4581 7.00277 20.4581C6.2469 20.4581 5.61426 20.2023 5.10486 19.6906ZM4.34077 40.8175C3.78208 40.8175 3.31376 40.6121 2.93582 40.2013C2.55788 39.7905 2.36891 39.3058 2.36891 38.7471C1.51444 38.7471 0.807863 38.4479 0.249171 37.8494C-0.309521 37.2506 -0.588867 36.531 -0.588867 35.6907V27.8033H4.34077V26.2751C4.34077 25.322 4.67763 24.4922 5.35134 23.7856C6.02506 23.0791 6.83845 22.7258 7.79151 22.7258C8.38307 22.7258 8.94176 22.8654 9.46759 23.1448C9.99342 23.4241 10.4535 23.7939 10.8479 24.254L12.6226 26.3737C12.8855 26.6461 13.1402 26.9015 13.3867 27.1398C13.6331 27.378 13.9043 27.5992 14.2 27.8033H28.3974V10.9439C28.3974 10.1223 28.1263 9.40753 27.584 8.79954C27.0417 8.19156 26.3762 7.88756 25.5875 7.88756C25.2046 7.88756 24.8379 7.96972 24.4872 8.13404C24.1362 8.29836 23.8293 8.51198 23.5664 8.7749L21.1015 11.3137C21.2659 11.8891 21.2987 12.4562 21.2001 13.0149C21.1015 13.5732 20.9043 14.0989 20.6086 14.5919L16.9606 10.8453C17.4207 10.5394 17.9137 10.3438 18.4395 10.2587C18.9654 10.1739 19.4912 10.2334 20.017 10.4372L22.4818 7.88756C22.8959 7.45441 23.3682 7.11607 23.8986 6.87255C24.4294 6.62902 24.9923 6.50726 25.5875 6.50726C26.7637 6.50726 27.7561 6.94271 28.5645 7.81362C29.3733 8.68452 29.7777 9.72796 29.7777 10.9439V27.8033H33.7214V35.6907C33.7214 36.531 33.4421 37.2506 32.8834 37.8494C32.3247 38.4479 31.6181 38.7471 30.7636 38.7471C30.7636 39.3058 30.5747 39.7905 30.1967 40.2013C29.8188 40.6121 29.3505 40.8175 28.7918 40.8175H4.34077Z"
      />
    </svg>
  );
}

function AreaIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 29 43" fill="none" className={className}>
      <path
        fill="currentColor"
        d="M0.53833 34.9598V26.6189H1.7806V32.8302L8.43561 26.1752L9.32294 27.0626L2.66793 33.7176H8.87927V34.9598H0.53833ZM19.5273 34.9598V33.7176H25.7386L19.0836 27.0626L19.971 26.1752L26.626 32.8302V26.6189H27.8682V34.9598H19.5273ZM8.43561 16.4146L1.7806 9.75955V15.9709H0.53833V7.62994H8.87927V8.87221H2.66793L9.32294 15.5272L8.43561 16.4146ZM19.971 16.4146L19.0836 15.5272L25.7386 8.87221H19.5273V7.62994H27.8682V15.9709H26.626V9.75955L19.971 16.4146Z"
      />
    </svg>
  );
}

export default function WuustwezelSingle({ data, className }: TemplateComponentProps) {
  const cover = data.images[0];
  const footerColor = data.brandColor || "#297975";

  const stats: { Icon: typeof BedIcon; iconClassName: string; value: string | number }[] = [];
  if (data.fields.showBedrooms && data.bedrooms !== null) {
    stats.push({ Icon: BedIcon, iconClassName: "h-[38px] w-[28px]", value: data.bedrooms });
  }
  if (data.fields.showBathrooms && data.bathrooms !== null) {
    stats.push({ Icon: BathtubIcon, iconClassName: "h-[32px] w-[24px]", value: data.bathrooms });
  }
  if (data.fields.showSurface && data.surface !== null) {
    stats.push({ Icon: AreaIcon, iconClassName: "h-[29px] w-[19px]", value: `${data.surface} m²` });
  }

  return (
    <div className={["relative h-full w-full overflow-hidden bg-neutral-900", className].filter(Boolean).join(" ")}>
      {cover ? (
        <Image src={cover} alt={data.title} fill sizes="1080px" className="object-cover" priority />
      ) : (
        <div className="absolute inset-0 bg-neutral-800" />
      )}

      {/* Single gradient matching the Figma frame exactly (transparent at ~54% down to the brand color at ~79%) — a CSS gradient's last stop color holds through the rest of the box, so this alone covers both the fade and the solid footer the original two-div version needed. */}
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(to bottom, transparent 53.96%, ${footerColor} 78.83%)` }}
      />

      <div className="absolute inset-0 flex flex-col items-start justify-end gap-[52px] px-[75px] py-[85px]">
        <AutoSizeText className={`${titleFont.className} font-light leading-[1.2] text-white`} maxFontSizePx={77} minFontSizePx={36}>
          {data.title}
        </AutoSizeText>

        <div className="flex w-full items-center justify-between gap-6">
          <div className="flex items-center gap-[35px]">
            {stats.map(({ Icon, iconClassName, value }, index) => (
              <span key={index} className={`${bodyFont.className} flex items-center gap-[17px] text-[38px] text-white`}>
                <Icon className={`${iconClassName} shrink-0 text-white`} />
                {value}
              </span>
            ))}
          </div>
          <AutoSizeText className={`${bodyFont.className} text-white`} maxFontSizePx={44} minFontSizePx={20} multiline={false}>
            {data.location}
          </AutoSizeText>
        </div>
      </div>
    </div>
  );
}
