/** Error codes of the contract (SPEC section 11). */
export type ErrorCode = "invalid_component" | "invalid_option" | "invalid_event" | "invalid_props";

export const ERROR_CODES: readonly ErrorCode[] = ["invalid_component", "invalid_option", "invalid_event", "invalid_props"];

/** The only error type thrown by LombokUI. `code` is the cross-language contract. */
export class LombokUIError extends Error {
  readonly code: ErrorCode;
  readonly messageId: string;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = "LombokUIError";
    this.code = code;
    this.messageId = `lombokui.error.${code}`;
  }
}

export function fail(code: ErrorCode, message: string): never {
  throw new LombokUIError(code, message);
}
