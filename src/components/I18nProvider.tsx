"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { createFormat, type Format } from "@/lib/format";
import { LOCALE_COOKIE, getMessages, type Locale, type Messages } from "@/lib/i18n";

interface I18nValue {
  locale: Locale;
  t: Messages;
  f: Format;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nValue | null>(null);

/**
 * Fournit la langue à toute l'interface.
 *
 * La langue initiale vient du serveur, pour que le premier rendu soit déjà dans
 * la bonne langue. Un changement s'applique ensuite sur place, sans recharger :
 * tous les textes sont traduits côté client à partir de données brutes.
 */
export function I18nProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  const [locale, setLocaleState] = useState(initialLocale);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      t: getMessages(locale),
      f: createFormat(locale),
      setLocale(next) {
        setLocaleState(next);
        document.documentElement.lang = next;
        document.title = getMessages(next).meta.title;
        document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      },
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside an I18nProvider");
  return value;
}
