import { canonicalModelId, modelLabel } from "./pricing";
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

const CAUSE_LABELS: Record<RebuildCause, string> = {
  "context-growth": "Croissance du contexte",
  "idle-timeout": "Reprise après pause",
  "session-start": "Ouverture de session",
  "model-switch": "Changement de modèle",
  "effort-switch": "Changement d'effort",
};

/** Ce qui a provoqué une écriture de cache, et ce qu'elle a coûté. */
export interface CacheRebuild {
  cause: RebuildCause;
  label: string;
  requests: number;
  tokens: number;
  cost: number;
}

/** Dépense et raisonnement pour un niveau d'effort donné. */
export interface EffortSlice {
  effort: string;
  requests: number;
  cost: number;
  outputTokens: number;
  thinkingTokens: number;
  /** Part des tokens de sortie consacrée au raisonnement, entre 0 et 1. */
  thinkingShare: number;
}

export interface Lever {
  id: string;
  /** `free` : gain sans contrepartie. `tradeoff` : échange coût contre qualité. */
  kind: "free" | "tradeoff";
  title: string;
  /** Surcoût identifié pour un gain, dépense concernée pour un arbitrage. */
  amount: number;
  /** Part du coût total de la période, entre 0 et 1. */
  share: number;
  /** Ce que disent les données. */
  finding: string;
  /** Ce qu'il est possible de faire. */
  action: string;
}

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

function compactTokens(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} k`;
  }
  return `${Math.round(value)}`;
}

function money(value: number): string {
  return `${value.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} $`;
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
      entry = { cause, label: CAUSE_LABELS[cause], requests: 0, tokens: 0, cost: 0 };
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

      if (!previous) {
        add("session-start", tokens, cost);
        continue;
      }

      // Le cache écrit au tour précédent détermine la fenêtre de validité.
      const ttl = previous.cacheWrite1hTokens > 0 ? CACHE_TTL_1H_MS : CACHE_TTL_5M_MS;
      const gap = event.time - previous.time;

      if (canonicalModelId(previous.model) !== canonicalModelId(event.model)) {
        add("model-switch", tokens, cost);
      } else if (previous.effort !== event.effort) {
        add("effort-switch", tokens, cost);
      } else if (gap > ttl) {
        add("idle-timeout", tokens, cost);
      } else {
        add("context-growth", tokens, cost);
      }
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
    const effort = event.effort ?? "non précisé";
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
      title: "Contexte repayé après une pause",
      amount: idle.cost,
      share: share(idle.cost),
      finding:
        `${idle.requests} reprise${idle.requests > 1 ? "s" : ""} après une pause ont réécrit ` +
        `${compactTokens(idle.tokens)} tokens de contexte, pour ${money(idle.cost)}.`,
      action:
        "Une entrée de cache expire après une heure d'inactivité. Reprendre une " +
        "session longue après une pause fait repayer tout son contexte au prix fort. " +
        "Mieux vaut enchaîner les tours d'une même tâche, et repartir d'une session " +
        "neuve plutôt que réveiller une session déjà lourde.",
    });
  }

  const switches = [rebuild("model-switch"), rebuild("effort-switch")].filter(
    (entry): entry is CacheRebuild => entry !== undefined,
  );
  const switchCost = switches.reduce((sum, entry) => sum + entry.cost, 0);
  if (switchCost > 0) {
    const parts = switches.map((entry) => `${entry.label.toLowerCase()} (${entry.requests})`);
    levers.push({
      id: "cache-invalidation",
      kind: "free",
      title: "Cache invalidé en cours de session",
      amount: switchCost,
      share: share(switchCost),
      finding: `${money(switchCost)} de contexte réécrit après : ${parts.join(", ")}.`,
      action:
        "Changer de modèle ou de niveau d'effort au milieu d'une session invalide " +
        "le cache et fait repayer l'historique entier. Autant fixer les deux en " +
        "début de session, ou changer au moment d'en ouvrir une nouvelle.",
    });
  }

  if (insights.longContextExcessCost > 0) {
    levers.push({
      id: "long-context",
      kind: "free",
      title: "Contexte au-delà du seuil de confort",
      amount: insights.longContextExcessCost,
      share: share(insights.longContextExcessCost),
      finding:
        `${insights.longContextRequests} requêtes ont relu plus de ` +
        `${compactTokens(LONG_CONTEXT_TOKENS)} tokens de contexte. Relire ce qui ` +
        `dépasse ce seuil a coûté ${money(insights.longContextExcessCost)}. Pic ` +
        `observé : ${compactTokens(insights.peakContextTokens)} tokens en une requête.`,
      action:
        "Chaque tour renvoie tout l'historique : le coût d'une session croît à peu " +
        "près comme le carré du nombre de tours. Compacter le contexte, ou découper " +
        "en plusieurs sessions ciblées, casse cette courbe. Le montant indiqué est " +
        `ce qu'aurait évité un compactage systématique à ${compactTokens(
          LONG_CONTEXT_TOKENS,
        )} tokens — le contexte sous ce seuil, lui, est le travail lui-même.`,
    });
  }

  if (insights.sidechainCost > 0) {
    levers.push({
      id: "sidechains",
      kind: "free",
      title: "Coût des sous-agents",
      amount: insights.sidechainCost,
      share: share(insights.sidechainCost),
      finding: `${money(insights.sidechainCost)} dépensés par des sous-agents.`,
      action:
        "Un sous-agent part avec son propre contexte : utile pour isoler une " +
        "recherche volumineuse de la conversation principale, coûteux si la tâche " +
        "tenait dans le fil courant.",
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
      title: "Niveau d'effort",
      amount: effortSpend,
      share: share(effortSpend),
      finding:
        `${money(effortSpend)} de dépense à effort élevé. Le raisonnement occupe ` +
        `${(insights.thinkingShare * 100).toLocaleString("fr-FR", {
          maximumFractionDigits: 1,
        })} % des tokens de sortie.`,
      action:
        "L'effort est le premier levier qui échange du coût contre de la " +
        "réflexion. Le codage et les tâches longues le rentabilisent ; les " +
        "questions courtes et le travail routinier tiennent souvent à effort " +
        "réduit. À régler par type de tâche, pas globalement.",
    });
  }

  const ranked = [...models.entries()].sort((a, b) => b[1].cost - a[1].cost);
  const top = ranked[0];
  if (top && ranked.length > 1 && share(top[1].cost) > 0.5) {
    levers.push({
      id: "model-mix",
      kind: "tradeoff",
      title: "Répartition entre modèles",
      amount: top[1].cost,
      share: share(top[1].cost),
      finding:
        `${modelLabel(top[0])} concentre ${(share(top[1].cost) * 100).toLocaleString("fr-FR", {
          maximumFractionDigits: 0,
        })} % de la dépense, sur ${top[1].requests} requêtes.`,
      action:
        "Un modèle plus cher qui finit en moins de tours reste l'option la moins " +
        "chère : ce qui compte est le coût par tâche menée à bout, pas par token. " +
        "Le basculement se juge tâche par tâche, en observant si le résultat tient.",
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
