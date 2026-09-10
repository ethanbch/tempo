/**
 * Vérifie la table de tarification contre la vérité terrain.
 *
 * Claude Code écrit périodiquement dans ses transcripts un enregistrement
 * `cost-state` contenant le coût cumulé de la session, ventilé par modèle. Ce
 * script rejoue les messages assistant qui précèdent chaque point de contrôle,
 * applique `computeCost`, et compare les deux totaux.
 *
 *   node --experimental-strip-types scripts/verify-pricing.ts
 */

import { createReadStream } from "node:fs";
import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import readline from "node:readline";

import { canonicalModelId, computeCost, type Speed } from "../src/lib/pricing.ts";

const ROOT = process.env.CLAUDE_PROJECTS_PATH ?? path.join(homedir(), ".claude", "projects");

/*
 * Le facteur de calibration attendu : le rapport entre le coût de référence de
 * Claude Code et le coût des seules requêtes visibles dans le transcript.
 *
 * Il dépasse toujours 1, parce que Claude Code facture aussi des appels qu'il
 * ne journalise pas. Un facteur inférieur à 1 signifie qu'on surfacture — le
 * symptôme d'une double comptabilisation. Un facteur très supérieur signale un
 * tarif faux ou un modèle mal reconnu. Entre les deux, l'écart est structurel
 * et attendu, pas un défaut.
 */
const MIN_FACTOR = 0.98;
const MAX_FACTOR = 2;

const absentModels = new Set<string>();

interface Checkpoint {
  file: string;
  model: string;
  expected: number;
  actual: number;
  factor: number;
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

async function listTranscripts(): Promise<string[]> {
  const entries = await readdir(ROOT, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(ROOT, entry.name);
    for (const name of await readdir(dir)) {
      if (name.endsWith(".jsonl")) files.push(path.join(dir, name));
    }
  }
  return files;
}

async function checkFile(filePath: string): Promise<Checkpoint[]> {
  const running = new Map<string, number>();
  const checkpoints: Checkpoint[] = [];
  const seen = new Set<string>();

  const stream = createReadStream(filePath, { encoding: "utf8" });
  const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of lines) {
    if (!line) continue;
    let record: Record<string, unknown>;
    try {
      record = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }

    if (record.type === "assistant") {
      const message = record.message as Record<string, unknown> | undefined;
      const usage = message?.usage as Record<string, unknown> | undefined;
      const model = typeof message?.model === "string" ? message.model : null;
      const uuid = typeof record.uuid === "string" ? record.uuid : null;
      if (!usage || !model || !uuid || model === "<synthetic>") continue;
      // Une réponse s'étale sur plusieurs lignes qui répètent le même `usage` :
      // seul l'identifiant du message API compte une requête facturée.
      const requestKey =
        (typeof message?.id === "string" && message.id) ||
        (typeof record.requestId === "string" && record.requestId) ||
        uuid;
      if (seen.has(requestKey)) continue;
      seen.add(requestKey);

      const cacheCreation = usage.cache_creation as Record<string, unknown> | undefined;
      const speed: Speed = usage.speed === "fast" ? "fast" : "standard";
      const cost = computeCost(
        model,
        {
          inputTokens: num(usage.input_tokens),
          outputTokens: num(usage.output_tokens),
          cacheReadTokens: num(usage.cache_read_input_tokens),
          cacheWrite5mTokens: cacheCreation
            ? num(cacheCreation.ephemeral_5m_input_tokens)
            : num(usage.cache_creation_input_tokens),
          cacheWrite1hTokens: cacheCreation ? num(cacheCreation.ephemeral_1h_input_tokens) : 0,
        },
        speed,
      );
      const key = canonicalModelId(model);
      running.set(key, (running.get(key) ?? 0) + cost.total);
      continue;
    }

    if (record.type !== "cost-state") continue;
    if (record.hasUnknownModelCost === true) continue;

    const modelUsage = record.modelUsage as Record<string, { costUSD?: unknown }> | undefined;
    if (!modelUsage) continue;

    for (const [rawModel, usage] of Object.entries(modelUsage)) {
      const expected = num(usage?.costUSD);
      if (expected <= 0) continue;
      const key = canonicalModelId(rawModel);
      // Claude Code facture aussi des appels utilitaires (génération de titre,
      // par exemple) qui n'apparaissent jamais comme messages assistant dans le
      // transcript. Rien à réconcilier pour ces modèles-là.
      if (!running.has(key)) {
        absentModels.add(rawModel);
        continue;
      }
      const actual = running.get(key) ?? 0;
      if (actual <= 0) continue;
      checkpoints.push({
        file: path.basename(filePath),
        model: rawModel,
        expected,
        actual,
        factor: expected / actual,
      });
    }
  }

  lines.close();
  stream.destroy();
  return checkpoints;
}

const files = await listTranscripts();
const checkpoints = (await Promise.all(files.map(checkFile))).flat();

if (checkpoints.length === 0) {
  console.log("Aucun point de contrôle `cost-state` trouvé — rien à vérifier.");
  process.exit(0);
}

const factors = checkpoints.map((c) => c.factor).sort((a, b) => a - b);
const median = factors[Math.floor(factors.length / 2)];
const suspicious = checkpoints.filter(
  (c) => c.factor < MIN_FACTOR || c.factor > MAX_FACTOR,
);

console.log(`${files.length} transcripts · ${checkpoints.length} points de contrôle`);
if (absentModels.size > 0) {
  console.log(
    `modèles facturés hors transcript (non réconciliables) : ${[...absentModels].join(", ")}`,
  );
}
console.log(
  `facteur de calibration : min ${factors[0].toFixed(3)} · ` +
    `médiane ${median.toFixed(3)} · max ${factors[factors.length - 1].toFixed(3)}`,
);

for (const c of checkpoints) {
  console.log(
    `  ${c.model.padEnd(28)} référence $${c.expected.toFixed(4).padStart(10)} · ` +
      `calculé $${c.actual.toFixed(4).padStart(10)} · facteur ${c.factor.toFixed(3)}`,
  );
}

if (suspicious.length > 0) {
  console.error(
    `\n${suspicious.length} point(s) hors de la plage attendue ` +
      `[${MIN_FACTOR}, ${MAX_FACTOR}] — tarif probablement faux :`,
  );
  for (const c of suspicious) {
    console.error(`  ${c.file} · ${c.model} · facteur ${c.factor.toFixed(3)}`);
  }
  process.exit(1);
}

console.log(
  "\nOK — tous les facteurs sont dans la plage attendue : la grille tarifaire " +
    "reproduit les relevés de Claude Code, à l'écart structurel près.",
);
