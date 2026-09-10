/**
 * Tarification des modèles Claude, en USD par million de tokens.
 *
 * Les multiplicateurs de cache suivent la grille publique : une écriture de cache
 * 5 minutes coûte 1.25x le prix d'entrée, une écriture 1 heure 2x, et une lecture
 * 0.1x. Quelques modèles dérogent à la lecture (voir `cacheRead`).
 *
 * Vérifié contre les totaux `cost-state` que Claude Code écrit lui-même dans ses
 * transcripts : voir `scripts/verify-pricing.mjs`.
 */

export type Speed = "standard" | "fast";

export interface ModelPrice {
  /** USD par million de tokens d'entrée non cachés. */
  input: number;
  /** USD par million de tokens de sortie. */
  output: number;
  /** Surcharge optionnelle du prix de lecture de cache (défaut : 0.1x l'entrée). */
  cacheRead?: number;
  /** Tarif en mode rapide, quand le modèle le propose. */
  fast?: { input: number; output: number };
}

const CACHE_WRITE_5M_MULTIPLIER = 1.25;
const CACHE_WRITE_1H_MULTIPLIER = 2;
const CACHE_READ_MULTIPLIER = 0.1;

/** Tarifs explicites, indexés par identifiant canonique de modèle. */
const PRICES: Record<string, ModelPrice> = {
  "claude-fable-5-1": { input: 10, output: 50, cacheRead: 0.25 },
  "claude-mythos-5-1": { input: 10, output: 50, cacheRead: 0.25 },
  "claude-fable-5": { input: 10, output: 50 },
  "claude-mythos-5": { input: 10, output: 50 },
  "claude-opus-5": { input: 5, output: 25, fast: { input: 10, output: 50 } },
  "claude-opus-4-8": { input: 5, output: 25, fast: { input: 10, output: 50 } },
  "claude-opus-4-7": { input: 5, output: 25 },
  "claude-opus-4-6": { input: 5, output: 25 },
  "claude-opus-4-5": { input: 5, output: 25 },
  "claude-opus-4-1": { input: 15, output: 75 },
  "claude-opus-4": { input: 15, output: 75 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-sonnet-4-5": { input: 3, output: 15 },
  "claude-sonnet-4": { input: 3, output: 15 },
  "claude-3-7-sonnet": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-3-5-haiku": { input: 0.8, output: 4 },
};

/** Repli par famille quand un identifiant inconnu apparaît (tarif approché). */
const FAMILY_FALLBACK: Array<[RegExp, ModelPrice]> = [
  [/fable|mythos/, { input: 10, output: 50 }],
  [/opus/, { input: 5, output: 25 }],
  [/sonnet/, { input: 3, output: 15 }],
  [/haiku/, { input: 1, output: 5 }],
];

/**
 * Ramène un identifiant de modèle brut à sa forme canonique en retirant le
 * suffixe de date (`claude-haiku-4-5-20251001` -> `claude-haiku-4-5`).
 */
export function canonicalModelId(model: string): string {
  return model.replace(/-\d{8}$/, "");
}

/** Libellé court et lisible pour l'affichage (`claude-opus-5` -> `Opus 5`). */
export function modelLabel(model: string): string {
  const id = canonicalModelId(model);
  const match = id.match(
    /^claude-(?:(\d+(?:-\d+)?)-)?(fable|mythos|opus|sonnet|haiku)(?:-(\d+(?:-\d+)?))?$/,
  );
  if (!match) return id;
  const [, prefixVersion, family, suffixVersion] = match;
  const version = (suffixVersion ?? prefixVersion ?? "").replace(/-/g, ".");
  const name = family.charAt(0).toUpperCase() + family.slice(1);
  return version ? `${name} ${version}` : name;
}

export interface PriceLookup extends ModelPrice {
  /** Vrai quand le tarif vient d'un repli de famille et non d'une entrée connue. */
  estimated: boolean;
}

/** Retourne le tarif d'un modèle, en signalant les tarifs approchés. */
export function priceFor(model: string): PriceLookup {
  const id = canonicalModelId(model);
  const exact = PRICES[id];
  if (exact) return { ...exact, estimated: false };

  for (const [pattern, price] of FAMILY_FALLBACK) {
    if (pattern.test(id)) return { ...price, estimated: true };
  }
  return { input: 0, output: 0, estimated: true };
}

export interface TokenCounts {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWrite5mTokens: number;
  cacheWrite1hTokens: number;
}

/** Ventilation d'un coût en USD par poste de dépense. */
export interface CostBreakdown {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  total: number;
  estimated: boolean;
}

/**
 * Calcule le coût en USD d'un lot de tokens pour un modèle donné.
 *
 * `speed` bascule sur le tarif du mode rapide quand le modèle en propose un ;
 * les multiplicateurs de cache restent indexés sur le prix d'entrée retenu.
 */
export function computeCost(
  model: string,
  tokens: TokenCounts,
  speed: Speed = "standard",
): CostBreakdown {
  const price = priceFor(model);
  const rate = speed === "fast" && price.fast ? price.fast : price;
  const cacheReadRate = price.cacheRead ?? rate.input * CACHE_READ_MULTIPLIER;

  const perMillion = (count: number, usdPerMillion: number) =>
    (count / 1_000_000) * usdPerMillion;

  const input = perMillion(tokens.inputTokens, rate.input);
  const output = perMillion(tokens.outputTokens, rate.output);
  const cacheRead = perMillion(tokens.cacheReadTokens, cacheReadRate);
  const cacheWrite =
    perMillion(tokens.cacheWrite5mTokens, rate.input * CACHE_WRITE_5M_MULTIPLIER) +
    perMillion(tokens.cacheWrite1hTokens, rate.input * CACHE_WRITE_1H_MULTIPLIER);

  return {
    input,
    output,
    cacheRead,
    cacheWrite,
    total: input + output + cacheRead + cacheWrite,
    estimated: price.estimated,
  };
}
