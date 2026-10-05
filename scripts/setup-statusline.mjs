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

/** Messages, dans la langue de `TEMPO_LANG` ou du terminal, sinon en anglais. */
const TEXTS = {
  en: {
    invalidJson: (file) => `✗ ${file} isn't valid JSON: fix it, then run this again.`,
    yesNo: "(y/N)",
    yes: /^(y|yes)$/i,
    alreadyInstalled: "✓ Tempo's statusline is already installed.",
    existing: (current) => `A statusline is already configured:\n  ${current}`,
    replace: "Replace it with Tempo's?",
    untouched: "Nothing was changed. Run again with --force to replace it.",
    setAside: (file) => `  Set aside in ${file}, restored by --remove.`,
    installed: (file) => `✓ Statusline installed in ${file}.`,
    nextMessage: "  It will show up with your next message in Claude Code.",
    notInstalled: "Tempo's statusline isn't installed: nothing to do.",
    removedRestored: "✓ Tempo's statusline removed, the previous one is restored.",
    removed: "✓ Tempo's statusline removed.",
  },
  fr: {
    invalidJson: (file) => `✗ ${file} n'est pas du JSON valide : corrige-le avant de relancer.`,
    yesNo: "(o/N)",
    yes: /^(o|oui|y|yes)$/i,
    alreadyInstalled: "✓ La statusline de Tempo est déjà installée.",
    existing: (current) => `Une statusline est déjà configurée :\n  ${current}`,
    replace: "La remplacer par celle de Tempo ?",
    untouched: "Rien n'a été modifié. Relance avec --force pour la remplacer.",
    setAside: (file) => `  Mise de côté dans ${file}, restaurée par --remove.`,
    installed: (file) => `✓ Statusline installée dans ${file}.`,
    nextMessage: "  Elle apparaîtra au prochain message dans Claude Code.",
    notInstalled: "La statusline de Tempo n'est pas installée : rien à faire.",
    removedRestored: "✓ Statusline de Tempo retirée, la précédente est restaurée.",
    removed: "✓ Statusline de Tempo retirée.",
  },
  es: {
    invalidJson: (file) => `✗ ${file} no es un JSON válido: corrígelo y vuelve a ejecutarlo.`,
    yesNo: "(s/N)",
    yes: /^(s|si|sí|y|yes)$/i,
    alreadyInstalled: "✓ La statusline de Tempo ya está instalada.",
    existing: (current) => `Ya hay una statusline configurada:\n  ${current}`,
    replace: "¿Sustituirla por la de Tempo?",
    untouched: "No se ha cambiado nada. Vuelve a ejecutarlo con --force para sustituirla.",
    setAside: (file) => `  Guardada en ${file}, se restaura con --remove.`,
    installed: (file) => `✓ Statusline instalada en ${file}.`,
    nextMessage: "  Aparecerá con tu próximo mensaje en Claude Code.",
    notInstalled: "La statusline de Tempo no está instalada: no hay nada que hacer.",
    removedRestored: "✓ Statusline de Tempo eliminada, se ha restaurado la anterior.",
    removed: "✓ Statusline de Tempo eliminada.",
  },
  de: {
    invalidJson: (file) => `✗ ${file} ist kein gültiges JSON: Korrigiere es und starte erneut.`,
    yesNo: "(j/N)",
    yes: /^(j|ja|y|yes)$/i,
    alreadyInstalled: "✓ Die Statuszeile von Tempo ist bereits installiert.",
    existing: (current) => `Es ist bereits eine Statuszeile eingerichtet:\n  ${current}`,
    replace: "Durch die von Tempo ersetzen?",
    untouched: "Nichts wurde geändert. Mit --force erneut starten, um sie zu ersetzen.",
    setAside: (file) => `  Gesichert in ${file}, wird mit --remove wiederhergestellt.`,
    installed: (file) => `✓ Statuszeile installiert in ${file}.`,
    nextMessage: "  Sie erscheint bei deiner nächsten Nachricht in Claude Code.",
    notInstalled: "Die Statuszeile von Tempo ist nicht installiert: nichts zu tun.",
    removedRestored: "✓ Statuszeile von Tempo entfernt, die vorherige ist wiederhergestellt.",
    removed: "✓ Statuszeile von Tempo entfernt.",
  },
};

const T = (() => {
  const { TEMPO_LANG, LC_ALL, LC_MESSAGES, LANG } = process.env;
  for (const value of [TEMPO_LANG, LC_ALL, LC_MESSAGES, LANG]) {
    const code = value?.slice(0, 2).toLowerCase();
    if (code && code in TEXTS) return TEXTS[code];
  }
  return TEXTS.en;
})();

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
    console.error(T.invalidJson(SETTINGS_PATH));
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
  const answer = await prompt.question(`${question} ${T.yesNo} `);
  prompt.close();
  return T.yes.test(answer.trim());
}

async function install() {
  const settings = await readSettings();
  const current = settings.statusLine;

  if (current && current.command === STATUS_LINE.command) {
    console.log(T.alreadyInstalled);
    return;
  }

  if (current && !isTempo(current)) {
    console.log(T.existing(JSON.stringify(current)));
    if (!args.has("--force") && !(await confirm(T.replace))) {
      console.log(T.untouched);
      process.exitCode = 1;
      return;
    }
    await writeJson(BACKUP_PATH, current);
    console.log(T.setAside(BACKUP_PATH));
  }

  await writeJson(SETTINGS_PATH, { ...settings, statusLine: STATUS_LINE });
  console.log(T.installed(SETTINGS_PATH));
  console.log(T.nextMessage);
}

async function remove() {
  const settings = await readSettings();
  if (!isTempo(settings.statusLine)) {
    console.log(T.notInstalled);
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
    console.log(T.removedRestored);
  } else {
    console.log(T.removed);
  }
}

await (args.has("--remove") ? remove() : install());
