import { buildInsights, type Insights } from "./insights";
import { canonicalModelId, modelLabel } from "./pricing";
import type { ScanResult, UsageEvent } from "./types";

/** Durée d'une fenêtre de quota Claude, en millisecondes. */
export const QUOTA_WINDOW_MS = 5 * 60 * 60 * 1000;

export type RangeKey = "24h" | "7d" | "30d" | "all";

const RANGE_DURATIONS: Record<Exclude<RangeKey, "all">, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

export function isRangeKey(value: string): value is RangeKey {
  return value === "24h" || value === "7d" || value === "30d" || value === "all";
}

/** Ventilation du coût par poste, en dollars. */
export interface CostParts {
  input: number;
  cacheWrite: number;
  cacheRead: number;
  output: number;
}

function emptyCost(): CostParts {
  return { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 };
}

function addCost(parts: CostParts, event: UsageEvent, factor: number): void {
  parts.input += event.cost.input * factor;
  parts.cacheWrite += event.cost.cacheWrite * factor;
  parts.cacheRead += event.cost.cacheRead * factor;
  parts.output += event.cost.output * factor;
}

/**
 * Calcule un facteur de calibration par session.
 *
 * Les transcripts n'enregistrent pas toutes les requêtes facturées : Claude Code
 * appelle aussi l'API pour générer des titres, compacter le contexte ou d'autres
 * tâches utilitaires, sans écrire de message assistant. À la clôture d'une
 * session il écrit en revanche un `cost-state` qui, lui, totalise tout.
 *
 * Le rapport entre les deux donne un facteur — mesuré entre 1,00 et 1,26 sur des
 * sessions réelles, médiane 1,11 — appliqué à chaque requête visible. La
 * dépense invisible est ainsi répartie au prorata, ce qui garde les graphiques
 * cohérents avec le total et fait que filtrer une période reste juste.
 *
 * Une session encore ouverte n'a pas de `cost-state` : son facteur vaut 1 et son
 * coût est un plancher, signalé comme tel dans la réconciliation.
 */
function buildCalibration(scan: ScanResult): Map<string, number> {
  const trackedBySession = new Map<string, number>();
  for (const event of scan.events) {
    trackedBySession.set(
      event.sessionId,
      (trackedBySession.get(event.sessionId) ?? 0) + event.cost.total,
    );
  }

  const calibration = new Map<string, number>();
  for (const session of scan.sessionCosts) {
    const tracked = trackedBySession.get(session.sessionId) ?? 0;
    if (tracked > 0 && session.totalCostUSD > 0) {
      calibration.set(session.sessionId, session.totalCostUSD / tracked);
    }
  }
  return calibration;
}

/** Ventilation de tokens réutilisée par tous les regroupements. */
export interface TokenTotals {
  inputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  totalTokens: number;
}

function emptyTokens(): TokenTotals {
  return {
    inputTokens: 0,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
    outputTokens: 0,
    thinkingTokens: 0,
    totalTokens: 0,
  };
}

function addEvent(totals: TokenTotals, event: UsageEvent): void {
  const cacheWrite = event.cacheWrite5mTokens + event.cacheWrite1hTokens;
  totals.inputTokens += event.inputTokens;
  totals.cacheWriteTokens += cacheWrite;
  totals.cacheReadTokens += event.cacheReadTokens;
  totals.outputTokens += event.outputTokens;
  totals.thinkingTokens += event.thinkingTokens;
  totals.totalTokens +=
    event.inputTokens + cacheWrite + event.cacheReadTokens + event.outputTokens;
}

/** Clé de jour locale `AAAA-MM-JJ`, pour regrouper selon le fuseau de l'utilisateur. */
function dayKey(time: number): string {
  const date = new Date(time);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export interface DailyPoint extends TokenTotals {
  date: string;
  cost: number;
  costParts: CostParts;
  requests: number;
}

export interface ModelPoint extends TokenTotals {
  model: string;
  label: string;
  cost: number;
  costParts: CostParts;
  requests: number;
}

export interface ProjectPoint extends TokenTotals {
  projectId: string;
  name: string;
  cost: number;
  costParts: CostParts;
  requests: number;
  sessions: number;
  lastActivity: string;
}

/** Une fenêtre de quota de 5 heures, ouverte par une requête après une pause. */
export interface QuotaBlock extends TokenTotals {
  start: string;
  end: string;
  cost: number;
  costParts: CostParts;
  requests: number;
  /** Vrai si la fenêtre est encore ouverte au moment du scan. */
  active: boolean;
}

export interface HeatCell {
  /** Jour de la semaine, 0 = lundi. */
  weekday: number;
  hour: number;
  requests: number;
  cost: number;
}

/**
 * Réconciliation entre le coût calculé et le coût faisant autorité.
 *
 * Les transcripts n'enregistrent pas toutes les requêtes facturées : Claude Code
 * appelle aussi l'API pour générer des titres de conversation, compacter le
 * contexte ou d'autres tâches utilitaires, sans écrire de message assistant.
 * L'écart est réel et se situe typiquement autour de 10 %.
 */
export interface Reconciliation {
  /** Coût affiché, après calibration par session. */
  reportedCost: number;
  /** Coût des seules requêtes visibles dans les transcripts, avant calibration. */
  rawCost: number;
  /** Part ajoutée par la calibration, imputable aux appels non journalisés. */
  untrackedCost: number;
  /** Part du coût affiché provenant de sessions calibrées, entre 0 et 1. */
  calibratedShare: number;
  /** Sessions encore ouvertes, dont le coût reste un plancher. */
  uncalibratedSessions: number;
  /** Vrai si des sessions portent un modèle au tarif inconnu de Claude Code. */
  hasUnknownModelCost: boolean;
}

export interface Summary extends TokenTotals {
  cost: number;
  requests: number;
  prompts: number;
  sessions: number;
  projects: number;
  /** Part des tokens d'entrée servie par le cache, entre 0 et 1. */
  cacheHitRate: number;
  /** Tokens de sortie rapportés au nombre de requêtes. */
  avgOutputPerRequest: number;
  firstActivity: string | null;
  lastActivity: string | null;
  /** Nombre de jours distincts avec au moins une requête. */
  activeDays: number;
}

export interface UsageReport {
  range: RangeKey;
  /**
   * Tous les modèles rencontrés dans l'historique complet, indépendamment de la
   * période retenue : c'est ce qui permet à la couleur d'un modèle de rester la
   * même quand on change de période.
   */
  allModels: string[];
  /** Borne basse de la période, ou null quand tout l'historique est retenu. */
  since: string | null;
  summary: Summary;
  daily: DailyPoint[];
  byModel: ModelPoint[];
  byProject: ProjectPoint[];
  blocks: QuotaBlock[];
  heatmap: HeatCell[];
  /** Leviers d'optimisation dérivés des mêmes requêtes. */
  insights: Insights;
  reconciliation: Reconciliation;
  meta: {
    fileCount: number;
    byteCount: number;
    skippedLines: number;
    /** Dernière lecture effective des fichiers. */
    scannedAt: string;
    /** Instant du calcul de ce rapport, référence de toutes les durées relatives. */
    generatedAt: string;
    root: string;
  };
}

/** Remplit les jours sans activité pour que l'axe temporel reste continu. */
function fillMissingDays(points: Map<string, DailyPoint>, from: number, to: number): DailyPoint[] {
  const filled: DailyPoint[] = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const last = new Date(to);
  last.setHours(0, 0, 0, 0);

  while (cursor.getTime() <= last.getTime()) {
    const key = dayKey(cursor.getTime());
    filled.push(
      points.get(key) ?? {
        date: key,
        cost: 0,
        costParts: emptyCost(),
        requests: 0,
        ...emptyTokens(),
      },
    );
    cursor.setDate(cursor.getDate() + 1);
  }
  return filled;
}

/**
 * Découpe les requêtes en fenêtres de quota de 5 heures.
 *
 * Le quota Claude fonctionne par fenêtre glissante ouverte à la première requête
 * suivant une période d'inactivité : on rejoue donc la même règle, une fenêtre
 * démarrant au premier événement qui tombe hors de la précédente.
 */
function buildQuotaBlocks(
  events: UsageEvent[],
  now: number,
  factorFor: (sessionId: string) => number,
): QuotaBlock[] {
  const blocks: QuotaBlock[] = [];
  let current: { startTime: number; block: QuotaBlock } | null = null;

  for (const event of events) {
    if (current === null || event.time >= current.startTime + QUOTA_WINDOW_MS) {
      const startTime = event.time;
      const block: QuotaBlock = {
        start: new Date(startTime).toISOString(),
        end: new Date(startTime + QUOTA_WINDOW_MS).toISOString(),
        cost: 0,
        costParts: emptyCost(),
        requests: 0,
        active: false,
        ...emptyTokens(),
      };
      current = { startTime, block };
      blocks.push(block);
    }
    const factor = factorFor(event.sessionId);
    current.block.cost += event.cost.total * factor;
    current.block.requests += 1;
    addEvent(current.block, event);
    addCost(current.block.costParts, event, factor);
  }

  for (const block of blocks) {
    block.active = Date.parse(block.end) > now;
  }
  return blocks;
}

/**
 * Transforme un scan brut en rapport d'usage prêt à afficher.
 *
 * Les coûts sont recalculés depuis les requêtes visibles dans les transcripts,
 * puis calibrés session par session sur les relevés de Claude Code pour intégrer
 * les appels qu'il ne journalise pas. `reconciliation` expose ce que vaut cet
 * ajustement et ce qui reste non calibré.
 */
export function buildReport(
  scan: ScanResult,
  range: RangeKey,
  now: number = Date.now(),
): UsageReport {
  const since = range === "all" ? null : now - RANGE_DURATIONS[range];
  const events = since === null ? scan.events : scan.events.filter((e) => e.time >= since);
  const prompts = since === null ? scan.prompts : scan.prompts.filter((p) => p.time >= since);

  const totals = emptyTokens();
  const daily = new Map<string, DailyPoint>();
  const models = new Map<string, ModelPoint>();
  const projects = new Map<string, ProjectPoint>();
  const projectSessions = new Map<string, Set<string>>();
  const heat = new Map<string, HeatCell>();
  const sessions = new Set<string>();
  const calibration = buildCalibration(scan);
  const factorFor = (sessionId: string) => calibration.get(sessionId) ?? 1;
  let rawCost = 0;
  let calibratedCost = 0;
  let uncalibratedCost = 0;

  for (const event of events) {
    const factor = factorFor(event.sessionId);
    const cost = event.cost.total * factor;

    addEvent(totals, event);
    rawCost += event.cost.total;
    calibratedCost += cost;
    if (!calibration.has(event.sessionId)) uncalibratedCost += cost;
    sessions.add(event.sessionId);

    const key = dayKey(event.time);
    let day = daily.get(key);
    if (!day) {
      day = { date: key, cost: 0, costParts: emptyCost(), requests: 0, ...emptyTokens() };
      daily.set(key, day);
    }
    day.cost += cost;
    day.requests += 1;
    addEvent(day, event);
    addCost(day.costParts, event, factor);

    const modelId = canonicalModelId(event.model);
    let model = models.get(modelId);
    if (!model) {
      model = {
        model: modelId,
        label: modelLabel(modelId),
        cost: 0,
        costParts: emptyCost(),
        requests: 0,
        ...emptyTokens(),
      };
      models.set(modelId, model);
    }
    model.cost += cost;
    model.requests += 1;
    addEvent(model, event);
    addCost(model.costParts, event, factor);

    let project = projects.get(event.projectId);
    if (!project) {
      project = {
        projectId: event.projectId,
        name: event.projectName,
        cost: 0,
        costParts: emptyCost(),
        requests: 0,
        sessions: 0,
        lastActivity: event.timestamp,
        ...emptyTokens(),
      };
      projects.set(event.projectId, project);
      projectSessions.set(event.projectId, new Set());
    }
    project.cost += cost;
    project.requests += 1;
    project.lastActivity = event.timestamp;
    addEvent(project, event);
    addCost(project.costParts, event, factor);
    projectSessions.get(event.projectId)?.add(event.sessionId);

    const date = new Date(event.time);
    // `getDay()` place dimanche en 0 ; on décale pour une semaine lundi-dimanche.
    const weekday = (date.getDay() + 6) % 7;
    const hour = date.getHours();
    const heatKey = `${weekday}-${hour}`;
    let cell = heat.get(heatKey);
    if (!cell) {
      cell = { weekday, hour, requests: 0, cost: 0 };
      heat.set(heatKey, cell);
    }
    cell.requests += 1;
    cell.cost += cost;
  }

  for (const project of projects.values()) {
    project.sessions = projectSessions.get(project.projectId)?.size ?? 0;
  }

  const relevantCosts = scan.sessionCosts.filter((cost) => sessions.has(cost.sessionId));
  const uncalibratedSessions = [...sessions].filter((id) => !calibration.has(id)).length;

  const cachedInput = totals.cacheReadTokens;
  const allInput = totals.inputTokens + totals.cacheWriteTokens + totals.cacheReadTokens;

  const firstEvent = events[0];
  const lastEvent = events[events.length - 1];
  const dailyPoints =
    events.length > 0 ? fillMissingDays(daily, firstEvent.time, lastEvent.time) : [];

  const allModels = [...new Set(scan.events.map((event) => canonicalModelId(event.model)))].sort();

  return {
    range,
    allModels,
    since: since === null ? null : new Date(since).toISOString(),
    summary: {
      ...totals,
      // On expose le chiffre de référence quand il existe, et le coût recalculé
      // sinon (sessions trop anciennes pour porter un `cost-state`).
      cost: calibratedCost,
      requests: events.length,
      prompts: prompts.length,
      sessions: sessions.size,
      projects: projects.size,
      cacheHitRate: allInput > 0 ? cachedInput / allInput : 0,
      avgOutputPerRequest: events.length > 0 ? totals.outputTokens / events.length : 0,
      firstActivity: firstEvent?.timestamp ?? null,
      lastActivity: lastEvent?.timestamp ?? null,
      activeDays: daily.size,
    },
    daily: dailyPoints,
    byModel: [...models.values()].sort((a, b) => b.cost - a.cost),
    byProject: [...projects.values()].sort((a, b) => b.cost - a.cost),
    blocks: buildQuotaBlocks(events, now, factorFor),
    heatmap: [...heat.values()],
    insights: buildInsights(events, factorFor),
    reconciliation: {
      reportedCost: calibratedCost,
      rawCost,
      untrackedCost: Math.max(0, calibratedCost - rawCost),
      calibratedShare: calibratedCost > 0 ? 1 - uncalibratedCost / calibratedCost : 1,
      uncalibratedSessions,
      hasUnknownModelCost: relevantCosts.some((cost) => cost.hasUnknownModelCost),
    },
    meta: {
      fileCount: scan.fileCount,
      byteCount: scan.byteCount,
      skippedLines: scan.skippedLines,
      scannedAt: new Date(scan.scannedAt).toISOString(),
      generatedAt: new Date(now).toISOString(),
      root: scan.root,
    },
  };
}
