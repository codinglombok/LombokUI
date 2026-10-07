import { Reader, type JsonObject } from "./util.js";

export type PageItem = number | "ellipsis";

export interface PaginationResult extends JsonObject {
  items: PageItem[];
  prev: number | null;
  next: number | null;
}

export const MAX_PAGES = 2147483647;

function range(a: number, b: number): number[] {
  const out: number[] = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}

/**
 * Page list with ellipses (SPEC 7). For a fixed `siblings` and `boundaries` the list has a
 * constant length once `total` is large enough, so the control does not jump while paging.
 */
export function pagination(args: unknown): PaginationResult {
  const r: Reader = new Reader(args, "invalid_option", "pagination", ["page", "total", "siblings", "boundaries"]);
  const total = r.int("total", 1, MAX_PAGES, 1);
  if (!r.has("total")) r.bad("total", "is required");
  const page = r.int("page", 1, total, 1);
  const s = r.int("siblings", 0, 10, 1);
  const b = r.int("boundaries", 0, 10, 1);

  const startPages = range(1, Math.min(b, total));
  const endPages = range(Math.max(total - b + 1, b + 1), total);
  const sibStart = Math.max(Math.min(page - s, total - b - s * 2 - 1), b + 2);
  const sibEnd = Math.min(Math.max(page + s, b + s * 2 + 2), endPages.length > 0 ? endPages[0] - 2 : total - 1);

  const items: PageItem[] = [...startPages];
  if (sibStart > b + 2) items.push("ellipsis");
  else if (b + 1 < total - b) items.push(b + 1);
  items.push(...range(sibStart, sibEnd));
  if (sibEnd < total - b - 1) items.push("ellipsis");
  else if (total - b > b) items.push(total - b);
  items.push(...endPages);

  return { items, prev: page > 1 ? page - 1 : null, next: page < total ? page + 1 : null };
}
