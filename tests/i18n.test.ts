import { describe, expect, it } from "vitest";

import { createFormat } from "@/lib/format";
import { LOCALES, getMessages, resolveLocale } from "@/lib/i18n";

describe("resolveLocale", () => {
  it("prefers the saved choice", () => {
    expect(resolveLocale("de", "fr-FR,fr;q=0.9")).toBe("de");
  });

  it("follows the browser preferences in priority order", () => {
    expect(resolveLocale(null, "it-IT,es;q=0.8,fr;q=0.9")).toBe("fr");
    expect(resolveLocale(undefined, "de-CH")).toBe("de");
    expect(resolveLocale("klingon", "pt-BR")).toBe("en");
  });
});

/** Toutes les clés d'un objet de messages, chemins complets. */
function keys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => keys(child, `${prefix}.${key}`));
}

describe("messages", () => {
  it("cover exactly the same keys in every language", () => {
    const reference = keys(getMessages("fr")).sort();
    for (const locale of LOCALES) {
      expect(keys(getMessages(locale)).sort(), locale).toEqual(reference);
    }
  });
});

/** `Intl` sépare les milliers par des espaces insécables : on les ramène à des espaces simples. */
function plain<T extends Record<string, unknown>>(format: T): T {
  return new Proxy(format, {
    get(target, key) {
      const value = target[key as string];
      return typeof value === "function"
        ? (...args: unknown[]) => String(value(...args)).replace(/[\u00a0\u202f]/g, " ")
        : value;
    },
  });
}

describe("createFormat", () => {
  it("follows each language's conventions", () => {
    const en = plain(createFormat("en"));
    const fr = plain(createFormat("fr"));
    const de = plain(createFormat("de"));

    expect(en.usd(1234.5)).toBe("$1,234.50");
    expect(fr.usd(1234.5)).toBe("1 234,50 $");
    expect(en.percent(0.42)).toBe("42%");
    expect(fr.percent(0.42)).toBe("42 %");
    expect(en.compactTokens(1_500_000)).toBe("1.5 M");
    expect(de.compactTokens(1_500_000)).toBe("1,5 Mio.");
    expect(en.duration(2 * 3_600_000 + 14 * 60_000)).toBe("2h 14m");
    expect(fr.duration(2 * 3_600_000 + 14 * 60_000)).toBe("2 h 14");
    expect(fr.countdown(3 * 86_400_000 + 14 * 3_600_000)).toBe("3 j 14 h");
    expect(en.weekday(0)).toBe("Mon");
    expect(en.timeAgo("2026-10-05T11:00:00.000Z", Date.parse("2026-10-05T12:00:00.000Z"))).toBe(
      "1 hour ago",
    );
  });
});
