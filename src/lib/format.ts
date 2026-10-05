import { INTL_LOCALES, getMessages, type Locale } from "./i18n";

/**
 * Formatage des nombres et des dates affichés, selon les conventions de la
 * langue choisie.
 *
 * Les montants gardent la ponctuation de la langue et un simple « $ » placé
 * comme elle le veut : `style: "currency"` rendrait par exemple « 12,30 $US »
 * en français, lourd dans une interface dense.
 */
export function createFormat(locale: Locale) {
  const intl = INTL_LOCALES[locale];
  const units = getMessages(locale).units;

  const amount = new Intl.NumberFormat(intl, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const amountPrecise = new Intl.NumberFormat(intl, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
  /** Graduations d'axe : pas de décimale inutile, l'axe doit rester court. */
  const amountAxis = new Intl.NumberFormat(intl, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const integerFormat = new Intl.NumberFormat(intl, { maximumFractionDigits: 0 });
  const oneDecimal = new Intl.NumberFormat(intl, { maximumFractionDigits: 1 });
  const twoDecimals = new Intl.NumberFormat(intl, { maximumFractionDigits: 2 });
  const relative = new Intl.RelativeTimeFormat(intl, { numeric: "always" });

  const dayLabel = new Intl.DateTimeFormat(intl, { day: "numeric", month: "short" });
  const dayLong = new Intl.DateTimeFormat(intl, { weekday: "long", day: "numeric", month: "long" });
  const timeLabel = new Intl.DateTimeFormat(intl, { hour: "2-digit", minute: "2-digit" });
  const dateTimeLabel = new Intl.DateTimeFormat(intl, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const weekdayShort = new Intl.DateTimeFormat(intl, { weekday: "short" });

  const integer = (value: number) => integerFormat.format(value);

  /** Durée lisible à partir de millisecondes : « 2 h 14 », « 47 min », « 12 s ». */
  const duration = (ms: number): string => {
    if (ms < 1_000) return units.milliseconds(integer(ms));
    const seconds = Math.round(ms / 1_000);
    if (seconds < 60) return units.seconds(integer(seconds));
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return units.minutes(integer(minutes));
    const hours = Math.floor(minutes / 60);
    return units.hoursMinutes(integer(hours), `${minutes % 60}`.padStart(2, "0"));
  };

  return {
    /** Montant en dollars, avec plus de décimales sous le centime si `precise`. */
    usd(value: number, precise = false): string {
      const formatted =
        precise && value > 0 && value < 0.01 ? amountPrecise.format(value) : amount.format(value);
      return units.usd(formatted);
    },

    /** Montant condensé pour les graduations d'axe. */
    usdAxis(value: number): string {
      return units.usd(amountAxis.format(value));
    },

    integer,

    compactTokens(value: number): string {
      if (value === 0) return "0";
      if (Math.abs(value) < 1_000) return integer(value);
      if (Math.abs(value) < 1_000_000) return `${oneDecimal.format(value / 1_000)} ${units.thousand}`;
      if (Math.abs(value) < 1_000_000_000) {
        return `${oneDecimal.format(value / 1_000_000)} ${units.million}`;
      }
      return `${twoDecimals.format(value / 1_000_000_000)} ${units.billion}`;
    },

    percent(value: number, digits = 0): string {
      return new Intl.NumberFormat(intl, {
        style: "percent",
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(value);
    },

    duration,

    /** Compte à rebours qui passe aux jours au-delà de 24 h : « 3 j 14 h ». */
    countdown(ms: number): string {
      const days = Math.floor(ms / 86_400_000);
      if (days === 0) return duration(ms);
      return units.daysHours(integer(days), integer(Math.floor((ms % 86_400_000) / 3_600_000)));
    },

    formatDay(key: string): string {
      return dayLabel.format(parseDayKey(key));
    },

    formatDayLong(key: string): string {
      return dayLong.format(parseDayKey(key));
    },

    formatTime(iso: string): string {
      return timeLabel.format(new Date(iso));
    },

    formatDateTime(iso: string): string {
      return dateTimeLabel.format(new Date(iso));
    },

    /** Jour de la semaine abrégé, 0 = lundi. */
    weekday(index: number): string {
      // Le 1er janvier 2024 était un lundi.
      return weekdayShort.format(new Date(2024, 0, 1 + index));
    },

    hourOfDay(hour: number): string {
      return units.hourOfDay(`${hour}`.padStart(2, "0"));
    },

    /** Écart au présent, formulé simplement : « il y a 4 min ». */
    timeAgo(iso: string, now: number = Date.now()): string {
      const delta = now - new Date(iso).getTime();
      if (delta < 60_000) return units.justNow;
      if (delta < 3_600_000) return relative.format(-Math.floor(delta / 60_000), "minute");
      if (delta < 86_400_000) return relative.format(-Math.floor(delta / 3_600_000), "hour");
      return relative.format(-Math.floor(delta / 86_400_000), "day");
    },

    bytes(value: number): string {
      if (value < 1_000_000) {
        return `${integerFormat.format(value / 1_000)} ${units.kilobytes}`;
      }
      return `${oneDecimal.format(value / 1_000_000)} ${units.megabytes}`;
    },
  };
}

export type Format = ReturnType<typeof createFormat>;

/** Interprète une clé `AAAA-MM-JJ` dans le fuseau local, sans décalage UTC. */
export function parseDayKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
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
