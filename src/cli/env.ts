import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getMessages, isLocale, type Locale, type Messages } from "../lib/i18n";
import { createFormat, type Format } from "../lib/format";

/**
 * Emplacements, langue et couleurs de la commande `tempo`.
 *
 * Les chemins sont relus à chaque appel (et non figés au chargement) pour que
 * les tests puissent les rediriger par variables d'environnement.
 */

export function claudeDir(): string {
  return path.join(homedir(), ".claude");
}

export function settingsPath(): string {
  return process.env.CLAUDE_SETTINGS_PATH ?? path.join(claudeDir(), "settings.json");
}

/** Dossier de Tempo dans la configuration de Claude Code : relevés, copies des scripts. */
export function tempoDir(): string {
  return process.env.TEMPO_LIMITS_PATH
    ? path.dirname(process.env.TEMPO_LIMITS_PATH)
    : path.join(claudeDir(), "tempo");
}

/** Les scripts installés par `tempo setup`, à un emplacement qui ne dépend pas du dépôt. */
export function binDir(): string {
  return path.join(tempoDir(), "bin");
}

/** Racine du paquet : `dist/tempo.mjs` est un niveau sous elle. */
export function packageRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

/** Langue : `TEMPO_LANG`, sinon celle du terminal, sinon l'anglais. */
export function cliLocale(): Locale {
  const { TEMPO_LANG, LC_ALL, LC_MESSAGES, LANG } = process.env;
  for (const value of [TEMPO_LANG, LC_ALL, LC_MESSAGES, LANG]) {
    const code = value?.slice(0, 2).toLowerCase();
    if (isLocale(code)) return code;
  }
  return "en";
}

export function cliText(): { t: Messages; f: Format; locale: Locale } {
  const locale = cliLocale();
  return { t: getMessages(locale), f: createFormat(locale), locale };
}

/** Couleurs Readout en ANSI 24 bits, coupées hors terminal ou avec NO_COLOR. */
export function palette(enabled = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR) {
  const rgb = (r: number, g: number, b: number) => (text: string) =>
    enabled ? `\x1b[38;2;${r};${g};${b}m${text}\x1b[0m` : text;
  return {
    accent: rgb(139, 147, 255),
    warning: rgb(229, 176, 74),
    critical: rgb(229, 103, 90),
    good: rgb(63, 185, 80),
    ink: rgb(236, 235, 231),
    muted: rgb(140, 140, 140),
    faint: rgb(85, 85, 85),
    bold: (text: string) => (enabled ? `\x1b[1m${text}\x1b[22m` : text),
  };
}

export type Palette = ReturnType<typeof palette>;

/** Jauge de terminal : 8 cellules, teintée selon la part consommée (0 à 1). */
export function meter(used: number, colors: Palette): string {
  const value = Math.min(1, Math.max(0, used));
  const tone = value >= 0.9 ? colors.critical : value >= 0.7 ? colors.warning : colors.accent;
  const lit = value > 0 ? Math.max(1, Math.round(value * 8)) : 0;
  return tone("▰".repeat(lit)) + colors.faint("▱".repeat(8 - lit));
}
