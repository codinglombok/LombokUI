import "./components/index.js";
import { fail } from "./errors.js";
import { attrsAfter, run } from "./machine.js";
import { pagination } from "./pagination.js";
import { position } from "./position.js";
import { render } from "./render.js";
import type { Json } from "./util.js";

/** Functions reachable through `call` (SPEC 4). */
export const FUNCTIONS = ["attrs", "pagination", "position", "render", "run"] as const;

/**
 * Dynamic entry point used by vector runners and foreign hosts: `call(fn, args)` returns the
 * result as JSON data or throws `LombokUIError`.
 */
export function call(fn: string, args: unknown[]): Json {
  switch (fn) {
    case "run":
      return run(args[0], args[1], args[2]) as unknown as Json;
    case "attrs":
      return attrsAfter(args[0], args[1], args[2] ?? []) as unknown as Json;
    case "position":
      return position(args[0]) as unknown as Json;
    case "pagination":
      return pagination(args[0]) as unknown as Json;
    case "render":
      return render(args[0], args[1] ?? {});
    default:
      return fail("invalid_component", `unknown function "${fn}"`);
  }
}
