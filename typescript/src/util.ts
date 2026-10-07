import { fail, type ErrorCode } from "./errors.js";

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };

/** Largest safe integer (2^53 - 1); every integer in the contract stays within it. */
export const MAX_INT = 9007199254740991;
export const MAX_ITEMS = 1000;
export const MAX_LABEL = 1000;

const ID_RE = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;

/** Length in Unicode code points (SPEC 2.1); every text limit counts code points. */
export function cpLen(s: string): number {
  if (s.length <= 1) return s.length;
  let n = 0;
  for (const _ of s) n++;
  return n;
}

export function fitsText(v: unknown, max: number): v is string {
  return typeof v === "string" && (v.length <= max || cpLen(v) <= max);
}

/** Trims ASCII whitespace only (SPEC 8.1), so every language trims the same characters. */
export function trimAscii(s: string): string {
  return s.replace(/^[\t\n\f\r ]+|[\t\n\f\r ]+$/g, "");
}

export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function isInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && Math.abs(v) <= MAX_INT;
}

export function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function isId(v: unknown): v is string {
  return typeof v === "string" && ID_RE.test(v);
}

/** Reads an options/props object strictly: unknown keys are an error. */
export class Reader {
  readonly src: Record<string, unknown>;
  readonly code: ErrorCode;
  readonly what: string;

  constructor(src: unknown, code: ErrorCode, what: string, allowed: readonly string[]) {
    if (src === undefined) src = {};
    if (!isObject(src)) fail(code, `${what} must be an object`);
    for (const k of Object.keys(src)) {
      if (!allowed.includes(k)) fail(code, `${what}: unknown key "${k}"`);
    }
    this.src = src;
    this.code = code;
    this.what = what;
  }

  has(key: string): boolean {
    return this.src[key] !== undefined;
  }

  raw(key: string): unknown {
    return this.src[key];
  }

  bad(key: string, why: string): never {
    fail(this.code, `${this.what}.${key} ${why}`);
  }

  bool(key: string, def: boolean): boolean {
    const v = this.src[key];
    if (v === undefined) return def;
    if (typeof v !== "boolean") this.bad(key, "must be a boolean");
    return v;
  }

  oneOf<T extends string>(key: string, values: readonly T[], def: T): T {
    const v = this.src[key];
    if (v === undefined) return def;
    if (typeof v !== "string" || !(values as readonly string[]).includes(v)) this.bad(key, `must be one of ${values.join(", ")}`);
    return v as T;
  }

  int(key: string, min: number, max: number, def: number): number {
    const v = this.src[key];
    if (v === undefined) return def;
    if (!isInt(v) || v < min || v > max) this.bad(key, `must be an integer in ${min}..${max}`);
    return v;
  }

  num(key: string, def: number): number {
    const v = this.src[key];
    if (v === undefined) return def;
    if (!isFiniteNumber(v)) this.bad(key, "must be a finite number");
    return v;
  }

  text(key: string, def: string | null, max = MAX_LABEL): string | null {
    const v = this.src[key];
    if (v === undefined || v === null) return def;
    if (!fitsText(v, max)) this.bad(key, `must be a string of at most ${max} characters`);
    return v;
  }

  reqText(key: string, max = MAX_LABEL): string {
    const v = this.src[key];
    if (!fitsText(v, max)) this.bad(key, `must be a string of at most ${max} characters`);
    return v;
  }

  id(key: string, def: string | null): string | null {
    const v = this.src[key];
    if (v === undefined || v === null) return def;
    if (!isId(v)) this.bad(key, "must be an id ([A-Za-z][A-Za-z0-9_-]{0,63})");
    return v;
  }

  idBase(): string {
    return this.id("idBase", "lui") as string;
  }
}

export interface Item {
  id: string;
  label: string;
  disabled: boolean;
}

/** Validates an item list (SPEC 2.2): 1..1000 objects, unique ids. */
export function readItems(v: unknown, code: ErrorCode, what = "items", min = 1): Item[] {
  if (!Array.isArray(v) || v.length < min || v.length > MAX_ITEMS) fail(code, `${what} must be an array of ${min}..${MAX_ITEMS} items`);
  const seen = new Set<string>();
  return v.map((raw, i) => {
    const r: Reader = new Reader(raw, code, `${what}[${i}]`, ["id", "label", "disabled"]);
    const id = r.id("id", null);
    if (id === null) r.bad("id", "is required");
    if (seen.has(id)) r.bad("id", `duplicates "${id}"`);
    seen.add(id);
    return { id, label: r.text("label", id) as string, disabled: r.bool("disabled", false) };
  });
}

export function indexOf(items: readonly Item[], id: string | null): number {
  if (id === null) return -1;
  for (let i = 0; i < items.length; i++) if (items[i].id === id) return i;
  return -1;
}

export function findItem(items: readonly Item[], id: unknown): Item | null {
  if (typeof id !== "string") return null;
  const i = indexOf(items, id);
  return i < 0 ? null : items[i];
}

/** Ids from `items` that are in `set`, in item order. */
export function ordered(items: readonly Item[], set: ReadonlySet<string>): string[] {
  return items.filter((it) => set.has(it.id)).map((it) => it.id);
}

export function firstEnabled(items: readonly Item[]): string | null {
  for (const it of items) if (!it.disabled) return it.id;
  return null;
}

export type Move = "next" | "prev" | "first" | "last";
export type Orientation = "horizontal" | "vertical" | "both";
export type Dir = "ltr" | "rtl";

/** Maps a UI Events `key` to a move (SPEC 3.1). */
export function keyMove(key: string, orientation: Orientation, dir: Dir): Move | null {
  if (key === "Home") return "first";
  if (key === "End") return "last";
  const vertical = orientation === "vertical" || orientation === "both";
  const horizontal = orientation === "horizontal" || orientation === "both";
  if (vertical && key === "ArrowDown") return "next";
  if (vertical && key === "ArrowUp") return "prev";
  if (horizontal && key === "ArrowRight") return dir === "rtl" ? "prev" : "next";
  if (horizontal && key === "ArrowLeft") return dir === "rtl" ? "next" : "prev";
  return null;
}

/** Moves among enabled items (SPEC 3.2). Returns `current` when nothing qualifies. */
export function navigate(items: readonly Item[], current: string | null, move: Move, loop: boolean): string | null {
  const n = items.length;
  if (move === "first" || move === "last") {
    if (move === "first") {
      for (let i = 0; i < n; i++) if (!items[i].disabled) return items[i].id;
    } else {
      for (let i = n - 1; i >= 0; i--) if (!items[i].disabled) return items[i].id;
    }
    return current;
  }
  const ci = indexOf(items, current);
  if (move === "next") {
    for (let i = ci + 1; i < n; i++) if (!items[i].disabled) return items[i].id;
    if (loop) for (let i = 0; i < ci; i++) if (!items[i].disabled) return items[i].id;
    return current;
  }
  const start = ci < 0 ? n : ci;
  for (let i = start - 1; i >= 0; i--) if (!items[i].disabled) return items[i].id;
  if (loop) for (let i = n - 1; i > start; i--) if (!items[i].disabled) return items[i].id;
  return current;
}

/** ASCII-only lowercase (SPEC 3.3): identical in every language. */
export function fold(s: string): string {
  return s.replace(/[A-Z]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 32));
}

/** A printable character key: exactly one code point, not a control character, not a space. */
export function isCharKey(key: string): boolean {
  const cps = Array.from(key);
  if (cps.length !== 1) return false;
  const cp = cps[0].codePointAt(0) as number;
  return cp > 0x20 && cp !== 0x7f && !(cp >= 0x80 && cp <= 0x9f);
}

export interface TypeaheadState {
  query: string;
  queryAt: number | null;
}

/** Typeahead (SPEC 3.3). Returns the new query state and the matched id (or null). */
export function typeahead(
  items: readonly Item[],
  current: string | null,
  st: TypeaheadState,
  ch: string,
  at: number,
  timeout: number,
): { query: string; queryAt: number; match: string | null } {
  const cont = st.queryAt !== null && at >= st.queryAt && at - st.queryAt < timeout;
  const query = cont ? st.query + ch : ch;
  const q = fold(query);
  const cps = Array.from(q);
  const repeated = cps.every((c) => c === cps[0]);
  const needle = repeated ? cps[0] : q;
  const ci = indexOf(items, current);
  const n = items.length;
  const start = repeated ? ci + 1 : Math.max(ci, 0);
  let match: string | null = null;
  for (let k = 0; k < n; k++) {
    const it = items[(start + k) % n];
    if (!it.disabled && fold(it.label).startsWith(needle)) {
      match = it.id;
      break;
    }
  }
  return { query, queryAt: at, match };
}

/** Formats a number for an attribute value (SPEC 2.5). */
export function formatNumber(v: number, decimals: number): string {
  if (Object.is(v, -0)) v = 0;
  let s = v.toFixed(decimals);
  if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
  if (s === "-0") s = "0";
  return s;
}

/** Number of decimal digits in the shortest round-trip representation of `v`. */
export function decimalsOf(v: number): number {
  const s = String(Math.abs(v));
  const e = s.indexOf("e");
  if (e >= 0) {
    const mant = s.slice(0, e);
    const exp = Number(s.slice(e + 1));
    const md = mant.includes(".") ? mant.length - mant.indexOf(".") - 1 : 0;
    return Math.max(0, md - exp);
  }
  return s.includes(".") ? s.length - s.indexOf(".") - 1 : 0;
}

export function bool(v: boolean): string {
  return v ? "true" : "false";
}
