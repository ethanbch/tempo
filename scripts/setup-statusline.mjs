#!/usr/bin/env node
/**
 * Installe la statusline de Tempo dans les réglages de Claude Code.
 *
 *   npm run setup:statusline              installe, en demandant avant de remplacer une autre statusline
 *   npm run setup:statusline -- --force   remplace sans demander
 *   npm run setup:statusline -- --remove  désinstalle et restaure la statusline précédente
 *
 * Les autres réglages ne sont jamais touchés. Une statusline remplacée est mise
 * de côté et restaurée par `--remove`.
 */
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const SETTINGS_PATH =
  process.env.CLAUDE_SETTINGS_PATH ?? path.join(homedir(), ".claude", "settings.json");
const TEMPO_DIR = process.env.TEMPO_LIMITS_PATH
  ? path.dirname(process.env.TEMPO_LIMITS_PATH)
  : path.join(homedir(), ".claude", "tempo");
const BACKUP_PATH = path.join(TEMPO_DIR, "previous-statusline.json");

const SCRIPT_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "statusline.mjs");
const STATUS_LINE = { type: "command", command: `node ${JSON.stringify(SCRIPT_PATH)}` };

const args = new Set(process.argv.slice(2));

/** Reconnaît la statusline de Tempo, même installée depuis un autre clone. */
function isTempo(statusLine) {
  return typeof statusLine?.command === "string" && statusLine.command.includes("statusline.mjs");
}

async function readSettings() {
  let raw;
  try {
    raw = await readFile(SETTINGS_PATH, "utf8");
  } catch {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch {
    console.error(`✗ ${SETTINGS_PATH} n'est pas du JSON valide : corrige-le avant de relancer.`);
    process.exit(1);
  }
}

/** Écriture atomique, pour ne jamais laisser des réglages à moitié écrits. */
async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temp, file);
}

async function confirm(question) {
  if (!process.stdin.isTTY) return false;
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await prompt.question(`${question} (o/N) `);
  prompt.close();
  return /^(o|oui|y|yes)$/i.test(answer.trim());
}

async function install() {
  const settings = await readSettings();
  const current = settings.statusLine;

  if (current && current.command === STATUS_LINE.command) {
    console.log("✓ La statusline de Tempo est déjà installée.");
    return;
  }

  if (current && !isTempo(current)) {
    console.log(`Une statusline est déjà configurée :\n  ${JSON.stringify(current)}`);
    if (!args.has("--force") && !(await confirm("La remplacer par celle de Tempo ?"))) {
      console.log("Rien n'a été modifié. Relance avec --force pour la remplacer.");
      process.exitCode = 1;
      return;
    }
    await writeJson(BACKUP_PATH, current);
    console.log(`  Mise de côté dans ${BACKUP_PATH}, restaurée par --remove.`);
  }

  await writeJson(SETTINGS_PATH, { ...settings, statusLine: STATUS_LINE });
  console.log(`✓ Statusline installée dans ${SETTINGS_PATH}.`);
  console.log("  Elle apparaîtra au prochain message dans Claude Code.");
}

async function remove() {
  const settings = await readSettings();
  if (!isTempo(settings.statusLine)) {
    console.log("La statusline de Tempo n'est pas installée : rien à faire.");
    return;
  }

  let previous = null;
  try {
    previous = JSON.parse(await readFile(BACKUP_PATH, "utf8"));
  } catch {
    // Pas de statusline précédente.
  }

  const rest = { ...settings };
  delete rest.statusLine;
  await writeJson(SETTINGS_PATH, previous ? { ...rest, statusLine: previous } : rest);
  if (previous) {
    await rm(BACKUP_PATH, { force: true });
    console.log("✓ Statusline de Tempo retirée, la précédente est restaurée.");
  } else {
    console.log("✓ Statusline de Tempo retirée.");
  }
}

await (args.has("--remove") ? remove() : install());
