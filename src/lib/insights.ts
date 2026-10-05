import { canonicalModelId } from "./pricing";
import type { UsageEvent } from "./types";

/**
 * Analyse des leviers d'optimisation.
 *
 * La méthode d'optimisation de coût d'Anthropic distingue deux familles, et
 * l'ordre est porteur de sens :
 *
 * - les **gains sans contrepartie** (hygiène de cache, d'entrée, de sortie)
 *   baissent la dépense sans toucher à la qualité ;
 * - les **arbitrages** (effort, choix du modèle) échangent du coût contre de
 *   l'intelligence, et se décident en connaissance de cause.
 *
 * On ne présente donc jamais un arbitrage comme une économie acquise : pour
 * ceux-là, le montant affiché est la dépense concernée, pas un gain promis.
 */

/** Durée de vie d'une entrée de cache, selon qu'elle a été écrite en 5 min ou 1 h. */
const CACHE_TTL_5M_MS = 5 * 60 * 1000;
const CACHE_TTL_1H_MS = 60 * 60 * 1000;

/** Au-delà de ce contexte relu, une requête est comptée comme « à contexte long ». */
const LONG_CONTEXT_TOKENS = 200_000;

export type RebuildCause =
  | "session-start"
  | "context-growth"
  | "idle-timeout"
  | "model-switch"
  | "effort-switch";

/** Ce qui a provoqué une écriture de cache, et ce qu'elle a coûté. */
export interface CacheRebuild {
  cause: RebuildCause;
  requests: number;
  tokens: number;
  cost: number;
}

/** Dépense et raisonnement pour un niveau d'effort donné. */
export interface EffortSlice {
  /** Niveau d'effort, ou `UNSPECIFIED_EFFORT` quand la requête n'en porte pas. */
  effort: string;
  requests: number;
  cost: number;
  outputTokens: number;
  thinkingTokens: number;
  /** Part des tokens de sortie consacrée au raisonnement, entre 0 et 1. */
  thinkingShare: number;
}

export const UNSPECIFIED_EFFORT = "unspecified";

interface LeverBase {
  /** `free` : gain sans contrepartie. `tradeoff` : échange coût contre qualité. */
  kind: "free" | "tradeoff";
  /** Surcoût identifié pour un gain, dépense concernée pour un arbitrage. */
  amount: number;
  /** Part du coût total de la période, entre 0 et 1. */
  share: number;
}

/**
 * Un levier et les faits qui le fondent. Les phrases qui les racontent sont
 * écrites par l'interface, dans la langue choisie.
 */
export type Lever = LeverBase &
  (
    | { id: "idle-timeout"; requests: number; tokens: number }
    | { id: "cache-invalidation"; switches: Array<{ cause: RebuildCause; requests: number }> }
    | { id: "long-context"; requests: number; thresholdTokens: number; peakTokens: number }
    | { id: "sidechains" }
    | { id: "effort"; thinkingShare: number }
    | { id: "model-mix"; model: string; requests: number }
  );

export interface Insights {
  cacheRebuilds: CacheRebuild[];
  byEffort: EffortSlice[];
  levers: Lever[];
  /** Part du raisonnement dans l'ensemble des tokens de sortie. */
  thinkingShare: number;
  /** Plus grand contexte relu en une requête, en tokens. */
  peakContextTokens: number;
  /**
   * Coût de la seule fraction de contexte relue **au-delà** du seuil.
   *
   * C'est la part réellement évitable : le contexte sous le seuil est le
   * travail lui-même, pas du gaspillage. Compter la totalité laisserait croire
   * à une économie qui n'existe pas.
   */
  longContextExcessCost: number;
  longContextRequests: number;
  /** Coût imputable aux sous-agents. */
  sidechainCost: number;
  webSearchRequests: number;
  totalCost: number;
}

/**
 * Détermine la cause d'une écriture de cache, à partir de la requête précédente
 * de la même session (`null` si c'est la première).
 *
 * Extrait pour être réutilisé tel quel par la vue de détail d'une session, qui
 * annote chaque requête individuellement plutôt que d'agréger par cause.
 */
export function classifyCacheCause(
  previous: UsageEvent | null,
  event: UsageEvent,
): RebuildCause {
  if (!previous) return "session-start";

  // Le cache écrit au tour précédent détermine la fenêtre de validité.
  const ttl = previous.cacheWrite1hTokens > 0 ? CACHE_TTL_1H_MS : CACHE_TTL_5M_MS;
  const gap = event.time - previous.time;

  if (canonicalModelId(previous.model) !== canonicalModelId(event.model)) return "model-switch";
  if (previous.effort !== event.effort) return "effort-switch";
  if (gap > ttl) return "idle-timeout";
  return "context-growth";
}

/**
 * Attribue chaque écriture de cache à sa cause, en rejouant chaque session.
 *
 * Une écriture de cache est du contexte qu'on paie à (ré)enregistrer. Dans une
 * session qui avance normalement, elle ne couvre que le dernier tour. Quand elle
 * couvre bien plus, c'est que l'entrée précédente n'était plus valable : le
 * cache avait expiré, ou un changement de modèle ou d'effort l'a invalidé.
 */
function attributeCacheRebuilds(
  events: UsageEvent[],
  factorFor: (sessionId: string) => number,
): CacheRebuild[] {
  const bySession = new Map<string, UsageEvent[]>();
  for (const event of events) {
    const list = bySession.get(event.sessionId);
    if (list) list.push(event);
    else bySession.set(event.sessionId, [event]);
  }

  const totals = new Map<RebuildCause, CacheRebuild>();
  const add = (cause: RebuildCause, tokens: number, cost: number) => {
    let entry = totals.get(cause);
    if (!entry) {
      entry = { cause, requests: 0, tokens: 0, cost: 0 };
      totals.set(cause, entry);
    }
    entry.requests += 1;
    entry.tokens += tokens;
    entry.cost += cost;
  };

  for (const session of bySession.values()) {
    // `scanUsage` trie déjà par date, l'ordre au sein d'une session est donc bon.
    for (let index = 0; index < session.length; index += 1) {
      const event = session[index];
      const tokens = event.cacheWrite5mTokens + event.cacheWrite1hTokens;
      if (tokens <= 0) continue;

      const cost = event.cost.cacheWrite * factorFor(event.sessionId);
      const previous = index > 0 ? session[index - 1] : null;
      add(classifyCacheCause(previous, event), tokens, cost);
    }
  }

  return [...totals.values()].sort((a, b) => b.cost - a.cost);
}

/** Regroupe la dépense par niveau d'effort, avec la part de raisonnement. */
function groupByEffort(
  events: UsageEvent[],
  factorFor: (sessionId: string) => number,
): EffortSlice[] {
  const slices = new Map<string, EffortSlice>();

  for (const event of events) {
    const effort = event.effort ?? UNSPECIFIED_EFFORT;
    let slice = slices.get(effort);
    if (!slice) {
      slice = {
        effort,
        requests: 0,
        cost: 0,
        outputTokens: 0,
        thinkingTokens: 0,
        thinkingShare: 0,
      };
      slices.set(effort, slice);
    }
    slice.requests += 1;
    slice.cost += event.cost.total * factorFor(event.sessionId);
    slice.outputTokens += event.outputTokens;
    slice.thinkingTokens += event.thinkingTokens;
  }

  for (const slice of slices.values()) {
    slice.thinkingShare = slice.outputTokens > 0 ? slice.thinkingTokens / slice.outputTokens : 0;
  }

  return [...slices.values()].sort((a, b) => b.cost - a.cost);
}

/**
 * Construit la liste ordonnée des leviers, à partir de ce que les données
 * révèlent réellement. Un levier sans matière n'est pas affiché : « rien à
 * optimiser ici » est une conclusion valable, pas un manque.
 */
function buildLevers(
  insights: Omit<Insights, "levers">,
  models: Map<string, { cost: number; requests: number }>,
): Lever[] {
  const levers: Lever[] = [];
  const total = insights.totalCost;
  const share = (amount: number) => (total > 0 ? amount / total : 0);

  const rebuild = (cause: RebuildCause) =>
    insights.cacheRebuilds.find((entry) => entry.cause === cause);

  const idle = rebuild("idle-timeout");
  if (idle && idle.cost > 0) {
    levers.push({
      id: "idle-timeout",
      kind: "free",
      amount: idle.cost,
      share: share(idle.cost),
      requests: idle.requests,
      tokens: idle.tokens,
    });
  }

  const switches = [rebuild("model-switch"), rebuild("effort-switch")].filter(
    (entry): entry is CacheRebuild => entry !== undefined,
  );
  const switchCost = switches.reduce((sum, entry) => sum + entry.cost, 0);
  if (switchCost > 0) {
    levers.push({
      id: "cache-invalidation",
      kind: "free",
      amount: switchCost,
      share: share(switchCost),
      switches: switches.map((entry) => ({ cause: entry.cause, requests: entry.requests })),
    });
  }

  if (insights.longContextExcessCost > 0) {
    levers.push({
      id: "long-context",
      kind: "free",
      amount: insights.longContextExcessCost,
      share: share(insights.longContextExcessCost),
      requests: insights.longContextRequests,
      thresholdTokens: LONG_CONTEXT_TOKENS,
      peakTokens: insights.peakContextTokens,
    });
  }

  if (insights.sidechainCost > 0) {
    levers.push({
      id: "sidechains",
      kind: "free",
      amount: insights.sidechainCost,
      share: share(insights.sidechainCost),
    });
  }

  // Arbitrages : le montant est la dépense concernée, jamais un gain acquis.
  const effortSpend = insights.byEffort
    .filter((slice) => slice.effort === "high" || slice.effort === "xhigh" || slice.effort === "max")
    .reduce((sum, slice) => sum + slice.cost, 0);
  if (effortSpend > 0 && insights.thinkingShare > 0) {
    levers.push({
      id: "effort",
      kind: "tradeoff",
      amount: effortSpend,
      share: share(effortSpend),
      thinkingShare: insights.thinkingShare,
    });
  }

  const ranked = [...models.entries()].sort((a, b) => b[1].cost - a[1].cost);
  const top = ranked[0];
  if (top && ranked.length > 1 && share(top[1].cost) > 0.5) {
    levers.push({
      id: "model-mix",
      kind: "tradeoff",
      amount: top[1].cost,
      share: share(top[1].cost),
      model: top[0],
      requests: top[1].requests,
    });
  }

  return levers.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "free" ? -1 : 1;
    return b.amount - a.amount;
  });
}

/** Calcule les leviers d'optimisation pour un jeu de requêtes déjà filtré. */
export function buildInsights(
  events: UsageEvent[],
  factorFor: (sessionId: string) => number,
): Insights {
  let thinkingTokens = 0;
  let outputTokens = 0;
  let peakContextTokens = 0;
  let longContextExcessCost = 0;
  let longContextRequests = 0;
  let sidechainCost = 0;
  let webSearchRequests = 0;
  let totalCost = 0;
  const models = new Map<string, { cost: number; requests: number }>();

  for (const event of events) {
    const cost = event.cost.total * factorFor(event.sessionId);
    totalCost += cost;
    thinkingTokens += event.thinkingTokens;
    outputTokens += event.outputTokens;
    webSearchRequests += event.webSearchRequests;
    if (event.isSidechain) sidechainCost += cost;
    if (event.cacheReadTokens > peakContextTokens) peakContextTokens = event.cacheReadTokens;
    if (event.cacheReadTokens > LONG_CONTEXT_TOKENS) {
      const excess = (event.cacheReadTokens - LONG_CONTEXT_TOKENS) / event.cacheReadTokens;
      longContextExcessCost += event.cost.cacheRead * excess * factorFor(event.sessionId);
      longContextRequests += 1;
    }

    const id = canonicalModelId(event.model);
    const entry = models.get(id) ?? { cost: 0, requests: 0 };
    entry.cost += cost;
    entry.requests += 1;
    models.set(id, entry);
  }

  const base: Omit<Insights, "levers"> = {
    cacheRebuilds: attributeCacheRebuilds(events, factorFor),
    byEffort: groupByEffort(events, factorFor),
    thinkingShare: outputTokens > 0 ? thinkingTokens / outputTokens : 0,
    peakContextTokens,
    longContextExcessCost,
    longContextRequests,
    sidechainCost,
    webSearchRequests,
    totalCost,
  };

  return { ...base, levers: buildLevers(base, models) };
}
