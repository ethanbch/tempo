import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import { computeCost, type Speed } from "./pricing";
import type { PromptEvent, ScanResult, SessionCost, UsageEvent } from "./types";

const PROJECTS_ROOT =
  process.env.CLAUDE_PROJECTS_PATH ?? path.join(homedir(), ".claude", "projects");

/** Modèle factice écrit par Claude Code pour les messages générés localement. */
const SYNTHETIC_MODEL = "<synthetic>";

/** Code de la fin de ligne, cherché directement dans les octets. */
const NEWLINE = 0x0a;

interface TranscriptFile {
  filePath: string;
  /** Nom du répertoire projet, qui encode le chemin de travail. */
  projectDir: string;
  size: number;
  mtimeMs: number;
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Reconstruit un chemin lisible depuis le nom de répertoire encodé par Claude
 * Code (`-Users-ethan-Dev-tempo`). L'encodage étant ambigu — les tirets du nom
 * d'origine et les séparateurs deviennent le même caractère — on ne s'en sert
 * qu'en dernier recours, quand aucun `cwd` n'a été trouvé dans le transcript.
 */
function decodeProjectDir(dir: string): string {
  return dir.startsWith("-") ? dir.replace(/-/g, "/") : dir;
}

/** Liste tous les transcripts présents sous la racine des projets. */
async function listTranscripts(root: string): Promise<TranscriptFile[]> {
  let projectDirs: string[];
  try {
    projectDirs = (await readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }

  const files = await Promise.all(
    projectDirs.map(async (projectDir) => {
      const dirPath = path.join(root, projectDir);
      let names: string[];
      try {
        names = await readdir(dirPath);
      } catch {
        return [];
      }

      const jsonl = names.filter((name) => name.endsWith(".jsonl"));
      const stats = await Promise.all(
        jsonl.map(async (name): Promise<TranscriptFile | null> => {
          const filePath = path.join(dirPath, name);
          try {
            const info = await stat(filePath);
            return { filePath, projectDir, size: info.size, mtimeMs: info.mtimeMs };
          } catch {
            return null;
          }
        }),
      );
      return stats.filter((entry): entry is TranscriptFile => entry !== null);
    }),
  );

  return files.flat();
}

/**
 * Lit un fichier à partir d'un décalage et livre les lignes **complètes**.
 *
 * Le décalage retourné s'arrête à la dernière fin de ligne rencontrée : si
 * Claude Code est en train d'écrire, la ligne partielle en fin de fichier n'est
 * ni livrée ni comptée, et sera relue entière au passage suivant.
 *
 * Le découpage se fait sur les octets plutôt que sur du texte décodé, pour que
 * le décalage reste exact même en présence de caractères multi-octets — le saut
 * de ligne ne peut jamais faire partie d'une séquence UTF-8.
 */
async function readLinesFrom(
  filePath: string,
  start: number,
  onLine: (line: string) => void,
): Promise<number> {
  const stream = createReadStream(filePath, { start });
  let consumed = start;
  // Ne retient qu'une ligne partielle à la fois : la mémoire ne dépend pas de
  // la taille du fichier.
  let pending: Buffer = Buffer.alloc(0);

  try {
    for await (const chunk of stream) {
      const buffer =
        pending.length > 0 ? Buffer.concat([pending, chunk as Buffer]) : (chunk as Buffer);
      let from = 0;
      let index = buffer.indexOf(NEWLINE, from);

      while (index !== -1) {
        if (index > from) onLine(buffer.subarray(from, index).toString("utf8"));
        consumed += index - from + 1;
        from = index + 1;
        index = buffer.indexOf(NEWLINE, from);
      }
      pending = Buffer.from(buffer.subarray(from));
    }
  } finally {
    stream.destroy();
  }

  return consumed;
}

/** État conservé pour un transcript entre deux scans. */
interface FileState {
  /** Octets déjà analysés, arrêtés sur une fin de ligne. */
  consumed: number;
  mtimeMs: number;
  events: UsageEvent[];
  prompts: PromptEvent[];
  /** Dernier relevé de coût par session rencontré dans ce fichier. */
  sessionCosts: Map<string, SessionCost>;
  /** Messages API déjà facturés, pour ne pas les compter deux fois. */
  billedRequests: Set<string>;
  /** Répertoire de travail, découvert au premier enregistrement qui le porte. */
  cwd: string | null;
  projectName: string;
  skippedLines: number;
}

function emptyFileState(): FileState {
  return {
    consumed: 0,
    mtimeMs: 0,
    events: [],
    prompts: [],
    sessionCosts: new Map(),
    billedRequests: new Set(),
    cwd: null,
    projectName: "",
    skippedLines: 0,
  };
}

/** Analyse une ligne de transcript et l'ajoute à l'état du fichier. */
function ingestLine(line: string, state: FileState, file: TranscriptFile): void {
  let record: Record<string, unknown>;
  try {
    record = JSON.parse(line) as Record<string, unknown>;
  } catch {
    state.skippedLines += 1;
    return;
  }

  state.cwd ??= str(record.cwd);
  const type = record.type;

  if (type === "user") {
    // `isMeta` marque les messages injectés par l'outil (rappels système,
    // sorties de commandes locales) : ce ne sont pas des prompts humains.
    if (record.isMeta === true || record.isSidechain === true) return;
    const uuid = str(record.uuid);
    const timestamp = str(record.timestamp);
    if (!uuid || !timestamp) return;
    state.prompts.push({
      uuid,
      time: Date.parse(timestamp),
      sessionId: str(record.sessionId) ?? "",
      projectId: file.projectDir,
    });
    return;
  }

  if (type === "cost-state") {
    const sessionId = str(record.sessionId);
    if (!sessionId) return;
    const modelUsage = record.modelUsage as Record<string, { costUSD?: unknown }> | undefined;
    const byModel: Record<string, number> = {};
    for (const [model, usage] of Object.entries(modelUsage ?? {})) {
      byModel[model] = num(usage?.costUSD);
    }
    state.sessionCosts.set(sessionId, {
      sessionId,
      projectId: file.projectDir,
      totalCostUSD: num(record.totalCostUSD),
      byModel,
      apiDurationMs: num(record.totalAPIDuration),
      linesAdded: num(record.totalLinesAdded),
      linesRemoved: num(record.totalLinesRemoved),
      hasUnknownModelCost: record.hasUnknownModelCost === true,
    });
    return;
  }

  if (type !== "assistant") return;

  const message = record.message as Record<string, unknown> | undefined;
  const usage = message?.usage as Record<string, unknown> | undefined;
  const model = str(message?.model);
  const uuid = str(record.uuid);
  const timestamp = str(record.timestamp);
  if (!usage || !model || !uuid || !timestamp || model === SYNTHETIC_MODEL) return;

  // Claude Code écrit une ligne par bloc de contenu de la réponse, et chacune
  // répète l'`usage` complet de la requête. La clé de facturation est donc
  // l'identifiant du message API, jamais l'`uuid` de la ligne.
  const requestKey = str(message?.id) ?? str(record.requestId) ?? uuid;
  if (state.billedRequests.has(requestKey)) return;
  state.billedRequests.add(requestKey);

  const time = Date.parse(timestamp);
  if (Number.isNaN(time)) return;

  const cacheCreation = usage.cache_creation as Record<string, unknown> | undefined;
  // `cache_creation` ventile l'écriture par durée de vie ; l'ancien champ
  // agrégé sert de repli et est facturé au tarif 5 minutes.
  const cacheWrite5m = cacheCreation
    ? num(cacheCreation.ephemeral_5m_input_tokens)
    : num(usage.cache_creation_input_tokens);
  const cacheWrite1h = cacheCreation ? num(cacheCreation.ephemeral_1h_input_tokens) : 0;

  const serverToolUse = usage.server_tool_use as Record<string, unknown> | undefined;
  const outputDetails = usage.output_tokens_details as Record<string, unknown> | undefined;

  const tokens = {
    inputTokens: num(usage.input_tokens),
    outputTokens: num(usage.output_tokens),
    cacheReadTokens: num(usage.cache_read_input_tokens),
    cacheWrite5mTokens: cacheWrite5m,
    cacheWrite1hTokens: cacheWrite1h,
  };
  const speed: Speed = usage.speed === "fast" ? "fast" : "standard";

  state.events.push({
    uuid,
    requestKey,
    timestamp,
    time,
    model,
    ...tokens,
    thinkingTokens: outputDetails ? num(outputDetails.thinking_tokens) : 0,
    webSearchRequests: serverToolUse ? num(serverToolUse.web_search_requests) : 0,
    webFetchRequests: serverToolUse ? num(serverToolUse.web_fetch_requests) : 0,
    speed,
    serviceTier: str(usage.service_tier) ?? "standard",
    effort: str(record.effort),
    sessionId: str(record.sessionId) ?? "",
    projectId: file.projectDir,
    projectName: state.projectName,
    gitBranch: str(record.gitBranch),
    isSidechain: record.isSidechain === true,
    cost: computeCost(model, tokens, speed),
  });
}

/**
 * Met à jour l'état d'un transcript, en ne lisant que ce qui a été ajouté.
 *
 * Les transcripts ne font que croître par ajout en fin de fichier : une session
 * active n'oblige donc à relire que ses quelques nouvelles lignes, et non ses
 * mégaoctets. Deux cas imposent malgré tout une relecture complète — un fichier
 * qui a rétréci, et un fichier modifié à taille constante — parce que dans les
 * deux cas la partie déjà analysée n'est plus fiable.
 */
async function updateFileState(
  file: TranscriptFile,
  previous: FileState | undefined,
): Promise<FileState> {
  const rewritten =
    previous !== undefined &&
    (file.size < previous.consumed ||
      (file.mtimeMs !== previous.mtimeMs && file.size === previous.consumed));

  const state = previous && !rewritten ? previous : emptyFileState();

  if (previous && !rewritten && file.size === previous.consumed) {
    // Rien de neuf : l'état précédent est réutilisé tel quel.
    state.mtimeMs = file.mtimeMs;
    return state;
  }

  const before = state.events.length;
  state.consumed = await readLinesFrom(file.filePath, state.consumed, (line) =>
    ingestLine(line, state, file),
  );
  state.mtimeMs = file.mtimeMs;

  const projectName = path.basename(state.cwd ?? decodeProjectDir(file.projectDir));
  if (projectName !== state.projectName) {
    // Le `cwd` peut n'apparaître qu'après les premières lignes : on rétropropage
    // le nom sur les événements déjà collectés, une seule fois.
    state.projectName = projectName;
    for (const event of state.events) event.projectName = projectName;
  } else {
    for (let index = before; index < state.events.length; index += 1) {
      state.events[index].projectName = projectName;
    }
  }

  return state;
}

/** États des transcripts, conservés d'un scan à l'autre. */
const fileStates = new Map<string, FileState>();

/** Dernier résultat produit, réutilisé tant que rien n'a bougé sur le disque. */
let cachedSignature: string | null = null;
let cachedResult: ScanResult | null = null;

/**
 * Scanne les transcripts locaux de Claude Code et retourne l'usage normalisé.
 *
 * Deux niveaux de réutilisation permettent d'appeler cette fonction souvent sans
 * coût notable :
 *
 * 1. Une empreinte du disque — chemin, taille et date de modification de chaque
 *    fichier — court-circuite tout le reste quand rien n'a bougé. C'est le cas
 *    courant d'un rafraîchissement périodique : le travail se réduit alors à un
 *    `stat` par fichier. L'empreinte capture déjà tout changement, il n'y a donc
 *    aucune raison de la doubler d'une expiration par le temps.
 * 2. Quand quelque chose a bougé, seuls les fichiers concernés sont relus, et
 *    seulement à partir de leur dernier octet analysé.
 */
export async function scanUsage(): Promise<ScanResult> {
  const root = PROJECTS_ROOT;
  const files = await listTranscripts(root);
  const signature = files
    .map((file) => `${file.filePath}:${file.size}:${file.mtimeMs}`)
    .sort()
    .join("|");

  if (cachedResult && cachedSignature === signature) return cachedResult;

  const states = await Promise.all(
    files.map(async (file) => {
      const state = await updateFileState(file, fileStates.get(file.filePath));
      fileStates.set(file.filePath, state);
      return state;
    }),
  );

  // Libère les états des transcripts supprimés ou déplacés.
  const alive = new Set(files.map((file) => file.filePath));
  for (const filePath of fileStates.keys()) {
    if (!alive.has(filePath)) fileStates.delete(filePath);
  }

  // Un même message peut être réécrit dans un autre transcript lorsqu'une
  // session est reprise : `requestKey` fait foi pour ne le facturer qu'une fois.
  const seenEvents = new Set<string>();
  const events: UsageEvent[] = [];
  const seenPrompts = new Set<string>();
  const prompts: PromptEvent[] = [];
  // Une session reprise peut réécrire son `cost-state` dans un autre fichier ;
  // on garde le relevé le plus élevé, qui est le plus avancé dans la session.
  const costBySession = new Map<string, SessionCost>();
  let skippedLines = 0;

  for (const state of states) {
    skippedLines += state.skippedLines;
    for (const event of state.events) {
      if (seenEvents.has(event.requestKey)) continue;
      seenEvents.add(event.requestKey);
      events.push(event);
    }
    for (const prompt of state.prompts) {
      if (seenPrompts.has(prompt.uuid)) continue;
      seenPrompts.add(prompt.uuid);
      prompts.push(prompt);
    }
    for (const cost of state.sessionCosts.values()) {
      const existing = costBySession.get(cost.sessionId);
      if (!existing || cost.totalCostUSD > existing.totalCostUSD) {
        costBySession.set(cost.sessionId, cost);
      }
    }
  }

  events.sort((a, b) => a.time - b.time);
  prompts.sort((a, b) => a.time - b.time);

  const result: ScanResult = {
    events,
    prompts,
    sessionCosts: [...costBySession.values()],
    fileCount: files.length,
    byteCount: files.reduce((total, file) => total + file.size, 0),
    skippedLines,
    scannedAt: Date.now(),
    root,
  };

  cachedSignature = signature;
  cachedResult = result;
  return result;
}
