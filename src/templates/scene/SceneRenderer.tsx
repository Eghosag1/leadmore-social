import type { CSSProperties, MouseEvent, ReactNode } from "react";
import Image from "next/image";
import { groupElementsByParent, resolveFieldFromRenderProps } from "@/lib/scene/resolveScene";
import type { TemplateComponentProps } from "@/components/templates/types";
import type { Scene, SceneElement } from "@/types/scene";

/**
 * The one shared renderer every scene-based template uses — paints
 * `scene.elements` as plain HTML/CSS (absolutely-positioned at the top
 * level, flex-flowed within an auto-layout container — see
 * ContainerSceneElement), screenshotted by the exact same Puppeteer
 * pipeline every other template already goes through. No canvas library
 * here on purpose: the visual editor (Phase E) uses react-moveable to
 * *author* a Scene, but its canvas renders each element through the exact
 * same SceneElementView below (see SceneEditorCanvas.tsx) — true WYSIWYG by
 * construction, not by separately keeping two rendering implementations in
 * sync. See PLAN_TEMPLATE_EDITOR.md Phase C/E.
 *
 * Which of a template's (up to 3) scenes applies to the current slideIndex
 * is resolved *before* this component ever runs (resolveSceneForSlide(), in
 * DynamicTemplateRenderer.tsx) — this component only ever paints the one
 * Scene it's handed.
 */
export default function SceneRenderer({ data, slideIndex, className, scene }: TemplateComponentProps & { scene: Scene }) {
  const { topLevel, childrenByParent } = groupElementsByParent(scene.elements);
  return (
    <div
      className={["relative h-full w-full overflow-hidden", className].filter(Boolean).join(" ")}
      style={{ backgroundColor: scene.backgroundColor }}
    >
      {topLevel.map((element) => renderSceneElementTree(element, data, slideIndex ?? 0, childrenByParent, true))}
    </div>
  );
}

/**
 * Recurses into a container's children regardless of whether a child is
 * itself a container — nesting depth is unlimited (see
 * ContainerSceneElement's own doc comment). `isTopLevel` only changes
 * `positionStyle`: top-level elements use the default %-of-canvas absolute
 * positioning (`elementPositionStyle`, via `positionStyle={undefined}`),
 * every nested element uses the flex-flow `childPositionStyle` instead.
 */
function renderSceneElementTree(
  element: SceneElement,
  data: TemplateComponentProps["data"],
  slideIndex: number,
  childrenByParent: Map<string, SceneElement[]>,
  isTopLevel: boolean,
): ReactNode {
  return (
    <SceneElementView
      key={element.id}
      element={element}
      data={data}
      slideIndex={slideIndex}
      positionStyle={isTopLevel ? undefined : childPositionStyle(element)}
    >
      {element.type === "container" &&
        (childrenByParent.get(element.id) ?? []).map((child) => renderSceneElementTree(child, data, slideIndex, childrenByParent, false))}
    </SceneElementView>
  );
}

function elementPositionStyle(element: SceneElement): CSSProperties {
  return {
    position: "absolute",
    left: `${element.x}%`,
    top: `${element.y}%`,
    width: `${element.width}%`,
    height: `${element.height}%`,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    opacity: element.opacity ?? 1,
  };
}

/**
 * A container's child renders in normal flex flow, not absolute — `width`
 * is a literal px (see SceneElementBase's doc comment for why), `height`
 * likewise except for text, which is deliberately left unset so its box is
 * always exactly as tall as the content needs.
 */
function childPositionStyle(element: SceneElement): CSSProperties {
  return {
    position: "relative",
    width: element.width,
    height: element.type === "text" ? undefined : element.height,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    opacity: element.opacity ?? 1,
  };
}

/** Purely a hook for the visual editor (Phase E) to target this exact DOM node with Moveable — never read by the render path itself. */
function elementDataAttr(element: SceneElement) {
  return { "data-scene-element-id": element.id };
}

/**
 * Renders one scene element. Exported (not module-private) so the editor
 * canvas (SceneEditorCanvas.tsx) can reuse this exact same visual logic
 * instead of re-implementing it — the only two things the editor overrides
 * are `positionStyle` (its own working canvas is a different pixel size than
 * the real 1080-wide render, so it can't use the %-of-1080 default) and
 * `scaleFactor` (proportionally shrinks the few *absolute*-px fields —
 * fontSize, cornerRadius, gap, padding — to match; position/size stay
 * percentage- or px-based either way, so saving back to the Scene never
 * depends on this component's own working size). `onRef`/`onClick` are
 * editor-only hooks for selection — both are no-ops on the real render path.
 * `children`, used only by the "container" case, is normal React
 * composition — the caller (this file's default export, or
 * SceneEditorCanvas.tsx) resolves and renders a container's children itself
 * and passes the result in, rather than this component reaching back into a
 * scene-wide element list it was never given.
 */
export function SceneElementView({
  element,
  data,
  slideIndex,
  positionStyle,
  scaleFactor = 1,
  onRef,
  onClick,
  onTextContentRef,
  children,
}: {
  element: SceneElement;
  data: TemplateComponentProps["data"];
  slideIndex: number;
  positionStyle?: CSSProperties;
  scaleFactor?: number;
  onRef?: (el: HTMLDivElement | null) => void;
  onClick?: (e: MouseEvent) => void;
  /** Editor-only: ref to the actual `<p>` node of a text element, for measuring its natural (unclipped) content height — see SceneEditorCanvas.tsx's auto-height effect. No-op on the real render path. */
  onTextContentRef?: (el: HTMLParagraphElement | null) => void;
  /** Container children only — see this function's own doc comment above. */
  children?: ReactNode;
}) {
  const position = positionStyle ?? elementPositionStyle(element);

  switch (element.type) {
    case "photo": {
      const imageUrl = data.images[slideIndex] ?? data.images[0];
      return (
        <div style={position} className="overflow-hidden" ref={onRef} onClick={onClick} {...elementDataAttr(element)}>
          {imageUrl && (
            <Image
              src={imageUrl}
              alt=""
              fill
              sizes="1080px"
              priority
              className="object-cover"
              style={{
                objectPosition: `${element.focalX}% ${element.focalY}%`,
                transform: element.zoom !== 1 ? `scale(${element.zoom})` : undefined,
              }}
            />
          )}
        </div>
      );
    }
    case "logo":
      return (
        <div style={position} ref={onRef} onClick={onClick} {...elementDataAttr(element)}>
          {data.agencyLogo && <Image src={data.agencyLogo} alt="" fill sizes="300px" className="object-contain" />}
        </div>
      );
    case "shape":
      return (
        <div
          style={{
            ...position,
            backgroundColor: element.fill,
            borderRadius: element.shape === "circle" ? "50%" : element.cornerRadius ? `${element.cornerRadius * scaleFactor}px` : undefined,
          }}
          ref={onRef}
          onClick={onClick}
          {...elementDataAttr(element)}
        />
      );
    case "container":
      return (
        <div
          style={{
            ...position,
            display: "flex",
            flexDirection: element.direction,
            gap: element.gap * scaleFactor,
            padding: element.padding * scaleFactor,
            alignItems: element.align === "start" ? "flex-start" : element.align === "end" ? "flex-end" : "center",
            backgroundColor: element.backgroundColor || undefined,
            width: "fit-content",
            height: "fit-content",
          }}
          ref={onRef}
          onClick={onClick}
          {...elementDataAttr(element)}
        >
          {children}
        </div>
      );
    case "text": {
      const text = element.content.mode === "literal" ? element.content.value : resolveFieldFromRenderProps(data, element.content.field);
      const justify = element.align === "center" ? "center" : element.align === "right" ? "flex-end" : "flex-start";
      // Undefined = "auto-height", same as before this field existed — see TextSceneElement's own doc comment on `sizing`.
      const isAutoWidth = (element.sizing ?? "auto-height") === "auto-width";
      return (
        <div
          style={{
            ...position,
            display: "flex",
            alignItems: "center",
            justifyContent: justify,
            overflow: "hidden",
            // Same "always hugs content" override SceneElementView's "container" case already does — an
            // auto-width box's stored width/height are a JS-measured cache (see the editor's auto-hug effect),
            // this guarantees correctness even on the very first paint before that measurement has run once.
            ...(isAutoWidth ? { width: "fit-content", height: "fit-content" } : {}),
          }}
          ref={onRef}
          onClick={onClick}
          {...elementDataAttr(element)}
        >
          <p
            ref={onTextContentRef}
            style={{
              width: isAutoWidth ? "auto" : "100%",
              margin: 0,
              fontFamily: element.fontId ? `var(--font-${element.fontId})` : undefined,
              fontSize: element.fontSize * scaleFactor,
              fontWeight: element.fontWeight,
              lineHeight: element.lineHeight ?? 1.2,
              color: element.color,
              textAlign: element.align,
              whiteSpace: isAutoWidth ? "nowrap" : undefined,
            }}
          >
            {text}
          </p>
        </div>
      );
    }
  }
}
