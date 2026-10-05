import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import { buildCalibration } from "./aggregate";
import type { ScanResult } from "./types";

const LATEST_PATH =
  process.env.TEMPO_LIMITS_PATH ?? path.join(homedir(), ".claude", "tempo", "rate-limits.json");
/** Écrit par la statusline à côté du dernier relevé. */
const HISTORY_PATH = path.join(path.dirname(LATEST_PATH), "rate-limits-history.jsonl");

export const SESSION_WINDOW_MS = 5 * 60 * 60 * 1000;
export const WEEK_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Même tolérance que la statusline : `resets_at` bouge de quelques secondes. */
const SAME_WINDOW_TOLERANCE_MS = 10 * 60 * 1000;

/** Période sur laquelle se mesure le rythme récent, par type de fenêtre. */
const PACE_LOOKBACK_MS = { session: 60 * 60 * 1000, week: 24 * 60 * 60 * 1000 };
/** En dessous, l'écart de temps est trop court pour mesurer un rythme fiable. */
const MIN_PACE_SPAN_MS = 5 * 60 * 1000;

/** Une fenêtre trop peu entamée donne un rapport coût/pourcentage trop bruité. */
const MIN_USED_FOR_CAP = 0.05;

/** Nombre maximal de points renvoyés par courbe : au-delà, l'œil ne voit plus la différence. */
const MAX_SERIES_POINTS = 240;

/** Consommation d'une fenêtre de limite, telle que Claude Code la rapporte. */
export interface LimitWindow {
  /** Part consommée, entre 0 et 1. */
  used: number;
  /** Instant de réinitialisation, en millisecondes. */
  resetAt: number | null;
}

/** Un relevé de la statusline. */
export interface LimitSample {
  at: number;
  session: LimitWindow | null;
  week: LimitWindow | null;
}

export type LimitKind = "session" | "week";

export interface LimitProjection {
  /** Part consommée par heure au rythme récent. */
  ratePerHour: number;
  /** Instant où la limite serait atteinte, si c'est avant la réinitialisation. */
  hitsAt: string | null;
  /** Part projetée au moment de la réinitialisation, plafonnée à 1. */
  usedAtReset: number;
  /** Durée sur laquelle le rythme a été mesuré. */
  measuredOverMs: number;
}

/**
 * Estimation de ce que représente la limite en coût équivalent API.
 *
 * Anthropic ne publie pas les plafonds : on les déduit en rapportant le coût des
 * requêtes Claude Code d'une fenêtre au pourcentage qu'elle a consommé.
 */
export interface CapEstimate {
  costPerPercent: number;
  /** Coût équivalent API d'une fenêtre consommée à 100 %. */
  capCost: number;
  /** Nombre de fenêtres ayant servi à l'estimation. */
  windows: number;
}

export interface LimitAnalysis {
  /** Part consommée, ramenée à 0 si la fenêtre s'est réinitialisée depuis le relevé. */
  used: number;
  resetsAt: string | null;
  windowStart: string | null;
  /** Vrai si l'échéance est passée depuis le dernier relevé. */
  expired: boolean;
  /** Évolution de la consommation dans la fenêtre en cours. */
  series: Array<{ at: string; used: number }>;
  projection: LimitProjection | null;
  cap: CapEstimate | null;
}

export interface LimitsReport {
  /** Instant du dernier relevé : les chiffres ne bougent que pendant qu'une session tourne. */
  capturedAt: string;
  session: LimitAnalysis | null;
  week: LimitAnalysis | null;
  /** Nombre de relevés dans l'historique. */
  historySize: number;
}

/** `resets_at` arrive en secondes Unix ; on tolère aussi millisecondes et ISO. */
function toMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 1e12 ? value * 1_000 : value;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function parseWindow(raw: unknown): LimitWindow | null {
  if (!raw || typeof raw !== "object") return null;
  const { used_percentage, resets_at } = raw as Record<string, unknown>;
  if (typeof used_percentage !== "number" || !Number.isFinite(used_percentage)) return null;
  return {
    used: Math.min(1, Math.max(0, used_percentage / 100)),
    resetAt: toMs(resets_at),
  };
}

/** Interprète un relevé tel qu'écrit par la statusline, ou `null` s'il est inutilisable. */
export function parseSample(raw: unknown): LimitSample | null {
  if (!raw || typeof raw !== "object") return null;
  const { capturedAt, rate_limits } = raw as Record<string, unknown>;
  const limits = (rate_limits ?? {}) as Record<string, unknown>;
  const session = parseWindow(limits.five_hour);
  const week = parseWindow(limits.seven_day);
  const at = toMs(capturedAt);
  if ((!session && !week) || at === null) return null;
  return { at, session, week };
}

function sameWindow(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return a === b;
  return Math.abs(a - b) < SAME_WINDOW_TOLERANCE_MS;
}

/**
 * Coût équivalent API cumulé dans le temps, calibré comme le reste du tableau
 * de bord, pour répondre en temps logarithmique à « combien entre t1 et t2 ».
 */
function costIndex(scan: ScanResult) {
  const calibration = buildCalibration(scan);
  const times: number[] = [];
  const cumulative: number[] = [0];
  for (const event of scan.events) {
    times.push(event.time);
    const factor = calibration.get(event.sessionId) ?? 1;
    cumulative.push(cumulative[cumulative.length - 1] + event.cost.total * factor);
  }

  /** Nombre d'événements strictement antérieurs à `time` (ou égaux si `inclusive`). */
  const countBefore = (time: number, inclusive: boolean) => {
    let low = 0;
    let high = times.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (times[mid] < time || (inclusive && times[mid] === time)) low = mid + 1;
      else high = mid;
    }
    return low;
  };

  return (from: number, to: number) =>
    cumulative[countBefore(to, true)] - cumulative[countBefore(from, false)];
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function downsample<T>(points: T[]): T[] {
  if (points.length <= MAX_SERIES_POINTS) return points;
  const step = Math.ceil(points.length / MAX_SERIES_POINTS);
  return points.filter((_, index) => index % step === 0 || index === points.length - 1);
}

/**
 * Estime le plafond à partir de chaque fenêtre de l'historique : le coût des
 * requêtes entre l'ouverture de la fenêtre et son relevé le plus haut, rapporté
 * au pourcentage atteint. La médiane amortit les fenêtres atypiques.
 */
function estimateCap(
  entries: Array<{ at: number; window: LimitWindow }>,
  duration: number,
  costBetween: (from: number, to: number) => number,
): CapEstimate | null {
  const peaks: Array<{ at: number; window: LimitWindow }> = [];
  const byReset = entries
    .filter((entry) => entry.window.resetAt !== null)
    .sort((a, b) => a.window.resetAt! - b.window.resetAt!);

  for (const entry of byReset) {
    const last = peaks[peaks.length - 1];
    if (last && sameWindow(last.window.resetAt, entry.window.resetAt)) {
      if (entry.window.used > last.window.used) peaks[peaks.length - 1] = entry;
    } else {
      peaks.push(entry);
    }
  }

  const ratios = peaks
    .filter((peak) => peak.window.used >= MIN_USED_FOR_CAP)
    .map((peak) => {
      const cost = costBetween(peak.window.resetAt! - duration, peak.at);
      return cost > 0 ? cost / (peak.window.used * 100) : null;
    })
    .filter((ratio): ratio is number => ratio !== null);

  if (ratios.length === 0) return null;
  const costPerPercent = median(ratios);
  return { costPerPercent, capCost: costPerPercent * 100, windows: ratios.length };
}

/**
 * Rythme récent : écart de consommation entre maintenant et le dernier relevé
 * antérieur au début de la période de mesure. Faute de relevé assez ancien, on
 * part de l'ouverture de la fenêtre, à zéro — ce qui revient au rythme moyen.
 */
function project(
  current: LimitWindow & { resetAt: number },
  samples: Array<{ at: number; used: number }>,
  windowStart: number,
  lookback: number,
  now: number,
): LimitProjection | null {
  const from = Math.max(windowStart, now - lookback);
  let anchor = { at: windowStart, used: 0 };
  for (const sample of samples) {
    if (sample.at <= from) anchor = sample;
  }

  const span = now - anchor.at;
  if (span < MIN_PACE_SPAN_MS) return null;

  const rate = Math.max(0, (current.used - anchor.used) / span);
  const untilReset = current.resetAt - now;
  const hitsAtMs = rate > 0 ? now + Math.max(0, 1 - current.used) / rate : null;

  return {
    ratePerHour: rate * 60 * 60 * 1000,
    hitsAt: hitsAtMs !== null && hitsAtMs < current.resetAt ? new Date(hitsAtMs).toISOString() : null,
    usedAtReset: Math.min(1, current.used + rate * untilReset),
    measuredOverMs: span,
  };
}

function analyzeWindow(
  kind: LimitKind,
  latest: LimitSample,
  history: LimitSample[],
  costBetween: (from: number, to: number) => number,
  now: number,
): LimitAnalysis | null {
  const current = latest[kind];
  if (!current) return null;

  const duration = kind === "session" ? SESSION_WINDOW_MS : WEEK_WINDOW_MS;
  const entries = [...history, latest]
    .map((sample) => ({ at: sample.at, window: sample[kind] }))
    .filter((entry): entry is { at: number; window: LimitWindow } => entry.window !== null);
  const cap = estimateCap(entries, duration, costBetween);

  const resetAt = current.resetAt;
  if (resetAt === null) {
    return {
      used: current.used,
      resetsAt: null,
      windowStart: null,
      expired: false,
      series: [],
      projection: null,
      cap,
    };
  }

  if (resetAt <= now) {
    // La fenêtre s'est vidée depuis le dernier relevé ; la suivante n'est pas
    // encore ouverte, ou pas encore observée.
    return {
      used: 0,
      resetsAt: new Date(resetAt).toISOString(),
      windowStart: null,
      expired: true,
      series: [],
      projection: null,
      cap,
    };
  }

  const windowStart = resetAt - duration;
  const samples = entries
    .filter((entry) => entry.at >= windowStart && sameWindow(entry.window.resetAt, resetAt))
    .map((entry) => ({ at: entry.at, used: entry.window.used }))
    .sort((a, b) => a.at - b.at);

  return {
    used: current.used,
    resetsAt: new Date(resetAt).toISOString(),
    windowStart: new Date(windowStart).toISOString(),
    expired: false,
    series: downsample(samples).map((sample) => ({
      at: new Date(sample.at).toISOString(),
      used: sample.used,
    })),
    projection: project({ ...current, resetAt }, samples, windowStart, PACE_LOOKBACK_MS[kind], now),
    cap,
  };
}

/** Assemble le rapport des limites à partir des relevés et des transcripts. */
export function analyzeLimits(
  latest: LimitSample | null,
  history: LimitSample[],
  scan: ScanResult,
  now: number = Date.now(),
): LimitsReport | null {
  // Sans dernier relevé, le plus récent de l'historique en tient lieu.
  const reference =
    latest ?? history.reduce<LimitSample | null>((a, b) => (!a || b.at > a.at ? b : a), null);
  if (!reference) return null;

  const costBetween = costIndex(scan);
  return {
    capturedAt: new Date(reference.at).toISOString(),
    session: analyzeWindow("session", reference, history, costBetween, now),
    week: analyzeWindow("week", reference, history, costBetween, now),
    historySize: history.length,
  };
}

async function readLatest(): Promise<LimitSample | null> {
  try {
    return parseSample(JSON.parse(await readFile(LATEST_PATH, "utf8")));
  } catch {
    return null;
  }
}

async function readHistory(): Promise<LimitSample[]> {
  let raw: string;
  try {
    raw = await readFile(HISTORY_PATH, "utf8");
  } catch {
    return [];
  }
  const samples: LimitSample[] = [];
  for (const line of raw.split("\n")) {
    if (!line) continue;
    try {
      const sample = parseSample(JSON.parse(line));
      if (sample) samples.push(sample);
    } catch {
      // Ligne tronquée par une écriture concurrente : on l'ignore.
    }
  }
  return samples;
}

/**
 * Lit les relevés de la statusline et les croise avec les transcripts. Renvoie
 * `null` tant que la statusline de Tempo n'est pas installée ou n'a rien écrit.
 */
export async function loadLimits(
  scan: ScanResult,
  now: number = Date.now(),
): Promise<LimitsReport | null> {
  const [latest, history] = await Promise.all([readLatest(), readHistory()]);
  return analyzeLimits(latest, history, scan, now);
}
