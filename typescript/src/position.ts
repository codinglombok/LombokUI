import { isFiniteNumber, Reader, type JsonObject } from "./util.js";

export type Side = "top" | "bottom" | "left" | "right";
export type Align = "start" | "end" | "center";
export type Placement = Side | `${Side}-start` | `${Side}-end`;

export const PLACEMENTS: readonly Placement[] = [
  "top", "top-start", "top-end", "bottom", "bottom-start", "bottom-end",
  "left", "left-start", "left-end", "right", "right-start", "right-end",
];

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PositionResult extends JsonObject {
  x: number;
  y: number;
  placement: Placement;
  side: Side;
  align: Align;
  arrow: { edge: Side; offset: number } | null;
}

const OPPOSITE: Record<Side, Side> = { top: "bottom", bottom: "top", left: "right", right: "left" };

function readRect(v: unknown, key: string, size = false): Rect {
  const r: Reader = new Reader(v, "invalid_option", key, size ? ["width", "height"] : ["x", "y", "width", "height"]);
  for (const k of size ? ["width", "height"] : ["x", "y", "width", "height"]) {
    if (!isFiniteNumber(r.raw(k))) r.bad(k, "must be a finite number");
  }
  const width = r.raw("width") as number;
  const height = r.raw("height") as number;
  if (width < 0 || height < 0) r.bad("width", "and height must not be negative");
  return { x: size ? 0 : (r.raw("x") as number), y: size ? 0 : (r.raw("y") as number), width, height };
}

/**
 * Places a floating element next to a reference element (SPEC 6): placement, offset,
 * flip to the opposite side, shift into the boundary, and arrow offset. Pure arithmetic.
 */
export function position(args: unknown): PositionResult {
  const r: Reader = new Reader(args, "invalid_option", "position", [
    "reference", "floating", "placement", "offset", "flip", "shift", "padding", "boundary", "arrow", "arrowPadding", "dir",
  ]);
  const ref = readRect(r.raw("reference"), "reference");
  const fl = readRect(r.raw("floating"), "floating", true);
  const placement = r.oneOf("placement", PLACEMENTS, "bottom");
  const offset = r.num("offset", 0);
  const flip = r.bool("flip", true);
  const shift = r.bool("shift", true);
  const padding = r.num("padding", 0);
  const boundary = r.raw("boundary") === undefined || r.raw("boundary") === null ? null : readRect(r.raw("boundary"), "boundary");
  const arrowSize = r.raw("arrow") === undefined || r.raw("arrow") === null ? null : r.num("arrow", 0);
  if (arrowSize !== null && arrowSize < 0) r.bad("arrow", "must not be negative");
  const arrowPadding = r.num("arrowPadding", 0);
  const dir = r.oneOf("dir", ["ltr", "rtl"] as const, "ltr");

  let side = placement.split("-")[0] as Side;
  const align: Align = placement.includes("-") ? (placement.split("-")[1] as Align) : "center";

  const coords = (s: Side): { x: number; y: number } => {
    let x: number;
    let y: number;
    if (s === "top" || s === "bottom") {
      y = s === "top" ? ref.y - fl.height - offset : ref.y + ref.height + offset;
      const a = align === "center" ? "center" : dir === "rtl" ? (align === "start" ? "end" : "start") : align;
      x = a === "start" ? ref.x : a === "end" ? ref.x + ref.width - fl.width : ref.x + ref.width / 2 - fl.width / 2;
    } else {
      x = s === "left" ? ref.x - fl.width - offset : ref.x + ref.width + offset;
      y = align === "start" ? ref.y : align === "end" ? ref.y + ref.height - fl.height : ref.y + ref.height / 2 - fl.height / 2;
    }
    return { x, y };
  };
  const overflow = (s: Side, p: { x: number; y: number }, b: Rect): number => {
    switch (s) {
      case "top":
        return b.y + padding - p.y;
      case "bottom":
        return p.y + fl.height - (b.y + b.height - padding);
      case "left":
        return b.x + padding - p.x;
      case "right":
        return p.x + fl.width - (b.x + b.width - padding);
    }
  };

  let p = coords(side);
  if (flip && boundary !== null) {
    const o1 = overflow(side, p, boundary);
    if (o1 > 0) {
      const opp = OPPOSITE[side];
      const q = coords(opp);
      const o2 = overflow(opp, q, boundary);
      if (o2 < o1) {
        side = opp;
        p = q;
      }
    }
  }
  if (shift && boundary !== null) {
    if (side === "top" || side === "bottom") {
      const lo = boundary.x + padding;
      const hi = boundary.x + boundary.width - padding - fl.width;
      p = { x: Math.max(lo, Math.min(p.x, hi)), y: p.y };
    } else {
      const lo = boundary.y + padding;
      const hi = boundary.y + boundary.height - padding - fl.height;
      p = { x: p.x, y: Math.max(lo, Math.min(p.y, hi)) };
    }
  }
  let arrow: PositionResult["arrow"] = null;
  if (arrowSize !== null) {
    const vertical = side === "top" || side === "bottom";
    const raw = vertical ? ref.x + ref.width / 2 - p.x - arrowSize / 2 : ref.y + ref.height / 2 - p.y - arrowSize / 2;
    const hi = (vertical ? fl.width : fl.height) - arrowPadding - arrowSize;
    arrow = { edge: OPPOSITE[side], offset: Math.max(arrowPadding, Math.min(raw, hi)) };
  }
  const finalPlacement = (align === "center" ? side : `${side}-${align}`) as Placement;
  return { x: p.x, y: p.y, placement: finalPlacement, side, align, arrow };
}
