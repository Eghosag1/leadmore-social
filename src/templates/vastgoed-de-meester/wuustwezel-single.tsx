import Image from "next/image";
import { AutoSizeText } from "@/templates/components/AutoSizeText";
import type { TemplateComponentProps } from "@/components/templates/types";

/**
 * Git-managed port of the Figma frame (node 564:26, "LEADS — Social") used as
 * the proof-of-concept for the file-based template architecture — see the
 * "Templatearchitectuur" analysis and its migration plan. Same visual design
 * as the original chat-generated version, with two upgrades only possible
 * once a template is a real file: a real `AutoSizeText` import (no more
 * fixed text-6xl that just overflows on a long title), and full TypeScript
 * checking on `data` instead of an untyped compiled string.
 *
 * Colors intentionally use `data.brandColor` (not the Figma frame's fixed
 * #163b49) so the design still adapts per agency, same convention as the
 * existing DB-string starters (src/data/template-starters.ts).
 */
export default function WuustwezelSingle({ data, className }: TemplateComponentProps) {
  const cover = data.images[0];
  const footerColor = data.brandColor || "#163b49";

  const stats: { icon: string; value: string | number }[] = [];
  if (data.fields.showBedrooms && data.bedrooms !== null) stats.push({ icon: "🛏", value: data.bedrooms });
  if (data.fields.showBathrooms && data.bathrooms !== null) stats.push({ icon: "🛁", value: data.bathrooms });
  if (data.fields.showSurface && data.surface !== null) stats.push({ icon: "📐", value: `${data.surface} m²` });

  return (
    <div className={["relative h-full w-full overflow-hidden bg-neutral-900", className].filter(Boolean).join(" ")}>
      {cover ? (
        <Image src={cover} alt={data.title} fill sizes="1080px" className="object-cover" priority />
      ) : (
        <div className="absolute inset-0 bg-neutral-800" />
      )}

      <div
        className="absolute inset-x-0 bottom-[18%] h-[22%]"
        style={{ background: `linear-gradient(to bottom, transparent, ${footerColor})` }}
      />
      <div className="absolute inset-x-0 bottom-0 h-[18%]" style={{ backgroundColor: footerColor }} />

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-8 px-12 pb-14 pt-20">
        <AutoSizeText className="font-serif font-light leading-[1.2] text-white" maxFontSizePx={60} minFontSizePx={30}>
          {data.title}
        </AutoSizeText>

        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-8">
            {stats.map((stat, index) => (
              <span key={index} className="flex items-center gap-2 text-3xl font-light text-white">
                <span className="text-2xl">{stat.icon}</span>
                {stat.value}
              </span>
            ))}
          </div>
          <AutoSizeText
            className="font-light text-white"
            maxFontSizePx={30}
            minFontSizePx={16}
            multiline={false}
          >
            {data.location}
          </AutoSizeText>
        </div>
      </div>
    </div>
  );
}
