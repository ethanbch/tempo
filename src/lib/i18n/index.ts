import type { Locale } from "./locales";
import { de } from "./messages/de";
import { en } from "./messages/en";
import { es } from "./messages/es";
import { fr, type Messages } from "./messages/fr";

export * from "./locales";
export type { Messages };

const MESSAGES: Record<Locale, Messages> = { en, fr, es, de };

export function getMessages(locale: Locale): Messages {
  return MESSAGES[locale];
}
