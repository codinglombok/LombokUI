import { fail, LombokUIError } from "./errors.js";
import { fitsText, isFiniteNumber, isInt, isObject, MAX_INT, MAX_LABEL, type Json, type JsonObject } from "./util.js";

/** Attribute map of one part: string values, or `true` for a present boolean attribute (SPEC 2.4). */
export type Attrs = Record<string, string | true>;
export type Effect = JsonObject & { type: string };
export type Event = Record<string, unknown> & { type: string };

export interface Component<C, S extends JsonObject> {
  readonly name: string;
  /** Validates options (`invalid_option`) and returns the normalized context and the initial state. */
  setup(options: unknown): { ctx: C; state: S };
  /** Pure transition. Validates the event (`invalid_event`); never mutates `state`. */
  send(ctx: C, state: S, event: Event): { state: S; effects: Effect[] };
  /** ARIA and data attributes of every part, keyed `part` or `part:itemId`. */
  attrs(ctx: C, state: S): Record<string, Attrs>;
}

type FieldKind = "id" | "key" | "at" | "bool" | "number" | "text" | "check" | "duration" | "kind";

/** Event schema: event type -> required and optional fields. */
export type EventSchema = Record<string, { req?: Record<string, FieldKind>; opt?: Record<string, FieldKind> }>;

const KEY_MAX = 32;
export const MAX_DURATION = 2147483647;

function fieldOk(kind: FieldKind, v: unknown): boolean {
  switch (kind) {
    case "id":
      return typeof v === "string";
    case "key":
      return typeof v === "string" && v.length >= 1 && fitsText(v, KEY_MAX);
    case "at":
      return isInt(v) && v >= 0 && v <= MAX_INT;
    case "bool":
      return typeof v === "boolean";
    case "number":
      return isFiniteNumber(v);
    case "text":
      return fitsText(v, MAX_LABEL);
    case "check":
      return v === true || v === false || v === "mixed";
    case "duration":
      return v === null || (isInt(v) && v >= 1 && v <= MAX_DURATION);
    case "kind":
      return v === "info" || v === "success" || v === "warning" || v === "danger";
  }
}

/** Validates an event against a schema (SPEC 2.3). Unknown types and keys are `invalid_event`. */
export function readEvent(schema: EventSchema, e: unknown): Event {
  if (!isObject(e) || typeof e.type !== "string") fail("invalid_event", "event must be an object with a string type");
  const spec = Object.prototype.hasOwnProperty.call(schema, e.type) ? schema[e.type] : undefined;
  if (!spec) fail("invalid_event", `unknown event type "${e.type}"`);
  const req = spec.req ?? {};
  const opt = spec.opt ?? {};
  for (const k of Object.keys(e)) {
    if (k === "type") continue;
    const kind = req[k] ?? opt[k];
    if (!kind) fail("invalid_event", `${e.type}: unknown field "${k}"`);
    if (!fieldOk(kind, e[k])) fail("invalid_event", `${e.type}.${k} is invalid`);
  }
  for (const k of Object.keys(req)) {
    if (e[k] === undefined) fail("invalid_event", `${e.type}.${k} is required`);
  }
  return e as Event;
}

/** Modifier keys suppress typeahead and plain-key handling (SPEC 3.1). */
export function hasModifier(e: Event): boolean {
  return e.ctrl === true || e.alt === true || e.meta === true;
}

export const KEY_FIELDS: Record<string, FieldKind> = { at: "at", shift: "bool", ctrl: "bool", alt: "bool", meta: "bool" };

/** A registry entry with its type parameters erased. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyComponent = Component<any, JsonObject>;

const registry = new Map<string, AnyComponent>();

export function register(c: AnyComponent): void {
  registry.set(c.name, c);
}

export function getComponent(name: unknown): AnyComponent {
  const c = typeof name === "string" ? registry.get(name) : undefined;
  if (!c) fail("invalid_component", `unknown component "${String(name)}"`);
  return c;
}

export function componentNames(): string[] {
  return [...registry.keys()].sort();
}

/** A stateful convenience wrapper around a pure component. */
export class Machine<S extends JsonObject = JsonObject> {
  readonly component: AnyComponent;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly ctx: any;
  private current: S;
  private listeners = new Set<(state: S, effects: Effect[]) => void>();

  constructor(component: string, options?: unknown) {
    this.component = getComponent(component);
    const { ctx, state } = this.component.setup(options);
    this.ctx = ctx;
    this.current = state as S;
  }

  get state(): S {
    return this.current;
  }

  send(event: Event): Effect[] {
    const { state, effects } = this.component.send(this.ctx, this.current, event);
    this.current = state as S;
    for (const l of this.listeners) l(this.current, effects);
    return effects;
  }

  attrs(): Record<string, Attrs> {
    return this.component.attrs(this.ctx, this.current);
  }

  subscribe(fn: (state: S, effects: Effect[]) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export function createMachine<S extends JsonObject = JsonObject>(component: string, options?: unknown): Machine<S> {
  return new Machine<S>(component, options);
}

export type StepOutput = { state: JsonObject; effects: Effect[] } | { $error: string };

/** Contract entry point (SPEC 4): runs a script of events from the initial state. */
export function run(component: unknown, options: unknown, events: unknown): { initial: JsonObject; steps: StepOutput[] } {
  const c = getComponent(component);
  if (!Array.isArray(events)) fail("invalid_event", "events must be an array");
  const { ctx, state } = c.setup(options);
  const initial = state;
  let cur = state;
  const steps: StepOutput[] = [];
  for (const e of events) {
    try {
      const r = c.send(ctx, cur, e as Event);
      cur = r.state;
      steps.push({ state: r.state, effects: r.effects });
    } catch (err) {
      if (err instanceof LombokUIError) steps.push({ $error: err.code });
      else throw err;
    }
  }
  return { initial, steps };
}

/** Contract entry point (SPEC 4): attributes after a script of events; any failing event fails the call. */
export function attrsAfter(component: unknown, options: unknown, events: unknown = []): Record<string, Attrs> {
  const c = getComponent(component);
  if (!Array.isArray(events)) fail("invalid_event", "events must be an array");
  const { ctx, state } = c.setup(options);
  let cur = state;
  for (const e of events) cur = c.send(ctx, cur, e as Event).state;
  return c.attrs(ctx, cur);
}

export function jsonClone<T extends Json>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
