/** Langues de l'interface. La première sert de repli quand rien ne correspond. */
export const LOCALES = ["en", "fr", "es", "de"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Cookie qui mémorise le choix fait dans l'interface. */
export const LOCALE_COOKIE = "tempo-locale";

/** Nom de chaque langue dans cette langue même, pour le sélecteur. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  es: "Español",
  de: "Deutsch",
};

/** Conventions `Intl` de chaque langue : nombres, dates, jours de la semaine. */
export const INTL_LOCALES: Record<Locale, string> = {
  en: "en-US",
  fr: "fr-FR",
  es: "es-ES",
  de: "de-DE",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Choisit la langue : d'abord le choix mémorisé, puis les préférences du
 * navigateur dans leur ordre de priorité, enfin l'anglais.
 */
export function resolveLocale(cookie?: string | null, acceptLanguage?: string | null): Locale {
  if (isLocale(cookie)) return cookie;

  const preferences = (acceptLanguage ?? "")
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const quality = params.find((param) => param.trim().startsWith("q="));
      return { tag: tag.toLowerCase(), q: quality ? Number(quality.trim().slice(2)) : 1 };
    })
    .filter((entry) => entry.tag && !Number.isNaN(entry.q))
    .sort((a, b) => b.q - a.q);

  for (const { tag } of preferences) {
    const language = tag.split("-")[0];
    if (isLocale(language)) return language;
  }
  return DEFAULT_LOCALE;
}
