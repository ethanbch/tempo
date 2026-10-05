import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

const LIMITS_PATH =
  process.env.TEMPO_LIMITS_PATH ?? path.join(homedir(), ".claude", "tempo", "rate-limits.json");

/** Consommation d'une fenêtre de limite, telle que Claude Code la rapporte. */
export interface LimitWindow {
  /** Part consommée, entre 0 et 1. */
  used: number;
  /** Instant de réinitialisation, en ISO 8601. */
  resetsAt: string | null;
}

/** Dernier relevé des limites d'usage, déposé par `scripts/statusline.mjs`. */
export interface RateLimits {
  session: LimitWindow | null;
  week: LimitWindow | null;
  /** Instant du relevé : les chiffres ne bougent que pendant qu'une session tourne. */
  capturedAt: string;
}

/** `resets_at` arrive en secondes Unix ; on tolère aussi millisecondes et ISO. */
function toIso(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value < 1e12 ? value * 1_000 : value).toISOString();
  }
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) {
    return new Date(value).toISOString();
  }
  return null;
}

function parseWindow(raw: unknown): LimitWindow | null {
  if (!raw || typeof raw !== "object") return null;
  const { used_percentage, resets_at } = raw as Record<string, unknown>;
  if (typeof used_percentage !== "number" || !Number.isFinite(used_percentage)) return null;
  return {
    used: Math.min(1, Math.max(0, used_percentage / 100)),
    resetsAt: toIso(resets_at),
  };
}

/**
 * Lit le dernier relevé des limites. Renvoie `null` tant que la statusline de
 * Tempo n'est pas installée ou n'a encore rien écrit.
 */
export async function readRateLimits(): Promise<RateLimits | null> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(LIMITS_PATH, "utf8"));
  } catch {
    return null;
  }

  const { capturedAt, rate_limits } = (parsed ?? {}) as Record<string, unknown>;
  const limits = (rate_limits ?? {}) as Record<string, unknown>;
  const session = parseWindow(limits.five_hour);
  const week = parseWindow(limits.seven_day);
  if (!session && !week) return null;

  return { session, week, capturedAt: toIso(capturedAt) ?? new Date(0).toISOString() };
}
