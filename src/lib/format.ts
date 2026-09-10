/** Formatage des nombres affichés, en conventions françaises. */

// `style: "currency"` en fr-FR rend « 12,30 $US », lourd dans une interface
// dense. On garde la ponctuation française et on suffixe le symbole nous-mêmes.
const AMOUNT = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const AMOUNT_PRECISE = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

/** Graduations d'axe : pas de décimale inutile, l'axe doit rester court. */
const AMOUNT_AXIS = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const INTEGER = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

/** Montant en dollars, avec plus de décimales sous le centime. */
export function usd(value: number, precise = false): string {
  if (precise && value > 0 && value < 0.01) return `${AMOUNT_PRECISE.format(value)} $`;
  return `${AMOUNT.format(value)} $`;
}

/** Montant condensé pour les graduations d'axe. */
export function usdAxis(value: number): string {
  return `${AMOUNT_AXIS.format(value)} $`;
}

export function integer(value: number): string {
  return INTEGER.format(value);
}

/** Compacte un nombre de tokens : 1 284 -> « 1,3 k », 2 400 000 -> « 2,4 M ». */
export function compactTokens(value: number): string {
  if (value === 0) return "0";
  if (Math.abs(value) < 1_000) return INTEGER.format(value);
  if (Math.abs(value) < 1_000_000) {
    return `${(value / 1_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} k`;
  }
  if (Math.abs(value) < 1_000_000_000) {
    return `${(value / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M`;
  }
  return `${(value / 1_000_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} Md`;
}

export function percent(value: number, digits = 0): string {
  return `${(value * 100).toLocaleString("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} %`;
}

/** Durée lisible à partir de millisecondes : « 2 h 14 », « 47 min », « 12 s ». */
export function duration(ms: number): string {
  if (ms < 1_000) return `${Math.round(ms)} ms`;
  const seconds = Math.round(ms / 1_000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${`${minutes % 60}`.padStart(2, "0")}`;
}

const DAY_LABEL = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const DAY_LONG = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const TIME_LABEL = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const DATETIME_LABEL = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** Interprète une clé `AAAA-MM-JJ` dans le fuseau local, sans décalage UTC. */
export function parseDayKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatDay(key: string): string {
  return DAY_LABEL.format(parseDayKey(key));
}

export function formatDayLong(key: string): string {
  return DAY_LONG.format(parseDayKey(key));
}

export function formatTime(iso: string): string {
  return TIME_LABEL.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return DATETIME_LABEL.format(new Date(iso));
}

/** Écart au présent, formulé simplement : « il y a 4 min ». */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const delta = now - new Date(iso).getTime();
  if (delta < 60_000) return "à l'instant";
  if (delta < 3_600_000) return `il y a ${Math.floor(delta / 60_000)} min`;
  if (delta < 86_400_000) return `il y a ${Math.floor(delta / 3_600_000)} h`;
  return `il y a ${Math.floor(delta / 86_400_000)} j`;
}

export function bytes(value: number): string {
  if (value < 1_000_000) {
    return `${(value / 1_000).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} ko`;
  }
  return `${(value / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
}

/**
 * Choisit des graduations rondes pour un axe de valeurs.
 *
 * On vise `target` graduations et on arrondit le pas à 1, 2, 2,5 ou 5 fois une
 * puissance de dix, pour que l'axe porte des nombres lisibles.
 */
export function niceTicks(max: number, target = 4): number[] {
  if (max <= 0) return [0];
  const rawStep = max / target;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const step =
    (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10) *
    magnitude;

  const ticks: number[] = [];
  for (let value = 0; value <= max + step * 0.001; value += step) {
    ticks.push(Number(value.toFixed(10)));
  }
  return ticks;
}
