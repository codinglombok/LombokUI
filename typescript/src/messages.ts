/**
 * Built-in message catalogs. They MUST equal `locales/<tag>/lombokui.json` (checked by test/docs.test.ts).
 * Keys follow `lombokui.<kind>.<code>` (Lang document section 2).
 */
export const CATALOGS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  en: {
    "lombokui.error.invalid_component": "The component name is unknown.",
    "lombokui.error.invalid_option": "A component option or function argument is invalid.",
    "lombokui.error.invalid_event": "The event is invalid for this component.",
    "lombokui.error.invalid_props": "A render property is invalid.",
    "lombokui.label.close": "Close",
    "lombokui.label.breadcrumb": "Breadcrumb",
    "lombokui.label.pagination": "Pagination",
    "lombokui.label.previous_page": "Previous page",
    "lombokui.label.next_page": "Next page",
  },
  id: {
    "lombokui.error.invalid_component": "Nama komponen tidak dikenal.",
    "lombokui.error.invalid_option": "Opsi komponen atau argumen fungsi tidak sah.",
    "lombokui.error.invalid_event": "Event tidak sah untuk komponen ini.",
    "lombokui.error.invalid_props": "Properti render tidak sah.",
    "lombokui.label.close": "Tutup",
    "lombokui.label.breadcrumb": "Jejak navigasi",
    "lombokui.label.pagination": "Navigasi halaman",
    "lombokui.label.previous_page": "Halaman sebelumnya",
    "lombokui.label.next_page": "Halaman berikutnya",
  },
};

export const LABEL_KEYS = ["close", "breadcrumb", "pagination", "previous_page", "next_page"] as const;
export type LabelKey = (typeof LABEL_KEYS)[number];

/**
 * Picks a built-in catalog for a BCP 47 tag (SPEC 8.2): exact tag, then the language subtag,
 * then `en`. Matching is ASCII case-insensitive.
 */
export function resolveLocale(tag: string): string {
  const t = tag.replace(/[A-Z]/g, (c) => c.toLowerCase()).replace(/_/g, "-");
  if (Object.prototype.hasOwnProperty.call(CATALOGS, t)) return t;
  const lang = t.split("-")[0];
  if (Object.prototype.hasOwnProperty.call(CATALOGS, lang)) return lang;
  return "en";
}

export function label(locale: string, key: LabelKey, overrides: Readonly<Record<string, string>> | null): string {
  if (overrides !== null && Object.prototype.hasOwnProperty.call(overrides, key)) return overrides[key];
  return CATALOGS[resolveLocale(locale)][`lombokui.label.${key}`];
}
