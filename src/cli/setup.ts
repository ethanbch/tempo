import { copyFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

import { binDir, cliText, packageRoot, settingsPath, tempoDir } from "./env";

/**
 * `tempo setup` : installe la statusline et le résumé de fin de session dans les
 * réglages de Claude Code, sans toucher au reste.
 *
 * Les deux scripts sont copiés dans ~/.claude/tempo/bin : ils ne dépendent plus
 * de l'emplacement du dépôt ni du paquet npm, qu'on peut déplacer ou supprimer.
 */

type Settings = Record<string, unknown> & {
  statusLine?: { type?: string; command?: string };
  hooks?: Record<string, Array<{ matcher?: string; hooks?: Array<{ type?: string; command?: string }> }>>;
};

const HOOK_MARK = "session-end";

function quote(file: string): string {
  return JSON.stringify(file);
}

export function statuslineCommand(): string {
  return `node ${quote(path.join(binDir(), "statusline.mjs"))}`;
}

export function hookCommand(): string {
  return `node ${quote(path.join(binDir(), "tempo.mjs"))} ${HOOK_MARK}`;
}

/** Reconnaît la statusline de Tempo, quelle que soit la version qui l'a installée. */
export function isTempoStatusline(statusLine: Settings["statusLine"]): boolean {
  return typeof statusLine?.command === "string" && statusLine.command.includes("statusline.mjs");
}

function isTempoHook(command: unknown): boolean {
  return typeof command === "string" && command.includes("tempo.mjs") && command.includes(HOOK_MARK);
}

export function hasTempoHook(settings: Settings): boolean {
  return (settings.hooks?.SessionEnd ?? []).some((entry) =>
    (entry.hooks ?? []).some((hook) => isTempoHook(hook.command)),
  );
}

/** Retire nos entrées SessionEnd, en laissant celles des autres outils. */
function withoutTempoHook(settings: Settings): Settings {
  if (!settings.hooks?.SessionEnd) return settings;
  const sessionEnd = settings.hooks.SessionEnd.map((entry) => ({
    ...entry,
    hooks: (entry.hooks ?? []).filter((hook) => !isTempoHook(hook.command)),
  })).filter((entry) => entry.hooks.length > 0);
  const hooks = { ...settings.hooks, SessionEnd: sessionEnd };
  if (sessionEnd.length === 0) delete (hooks as Record<string, unknown>).SessionEnd;
  const next: Settings = { ...settings, hooks };
  if (Object.keys(hooks).length === 0) delete next.hooks;
  return next;
}

export async function readSettings(): Promise<Settings> {
  let raw: string;
  try {
    raw = await readFile(settingsPath(), "utf8");
  } catch {
    return {};
  }
  try {
    return JSON.parse(raw) as Settings;
  } catch {
    throw new Error(cliText().t.cli.invalidJson(settingsPath()));
  }
}

/** Écriture atomique : des réglages ne restent jamais à moitié écrits. */
async function writeJson(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temp, file);
}

async function confirm(question: string): Promise<boolean> {
  const { t } = cliText();
  if (!process.stdin.isTTY) return false;
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await prompt.question(`${question} ${t.cli.yesNo} `);
  prompt.close();
  return new RegExp(t.cli.yes, "i").test(answer.trim());
}

/** Copie les deux scripts à leur emplacement stable. */
async function copyScripts() {
  await mkdir(binDir(), { recursive: true });
  await copyFile(path.join(packageRoot(), "scripts", "statusline.mjs"), path.join(binDir(), "statusline.mjs"));
  await copyFile(fileURLToPath(import.meta.url), path.join(binDir(), "tempo.mjs"));
}

function backupPath(): string {
  return path.join(tempoDir(), "previous-statusline.json");
}

export async function install(force: boolean): Promise<number> {
  const { t } = cliText();
  const settings = await readSettings();
  const current = settings.statusLine;

  if (current && !isTempoStatusline(current)) {
    console.log(t.cli.existing(JSON.stringify(current)));
    if (!force && !(await confirm(t.cli.replace))) {
      console.log(t.cli.untouched);
      return 1;
    }
    await writeJson(backupPath(), current);
    console.log(t.cli.setAside(backupPath()));
  }

  await copyScripts();
  const next = withoutTempoHook(settings);
  const hooks = { ...(next.hooks ?? {}) };
  hooks.SessionEnd = [...(hooks.SessionEnd ?? []), { hooks: [{ type: "command", command: hookCommand() }] }];
  await writeJson(settingsPath(), {
    ...next,
    statusLine: { type: "command", command: statuslineCommand() },
    hooks,
  });
  console.log(t.cli.installed(settingsPath()));
  console.log(t.cli.nextMessage);
  return 0;
}

export async function remove(): Promise<number> {
  const { t } = cliText();
  const settings = await readSettings();
  if (!isTempoStatusline(settings.statusLine) && !hasTempoHook(settings)) {
    console.log(t.cli.notInstalled);
    return 0;
  }

  let previous: unknown = null;
  try {
    previous = JSON.parse(await readFile(backupPath(), "utf8"));
  } catch {
    // Pas de statusline précédente.
  }

  const next = withoutTempoHook(settings);
  if (isTempoStatusline(next.statusLine)) delete next.statusLine;
  if (previous) next.statusLine = previous as Settings["statusLine"];
  await writeJson(settingsPath(), next);
  await rm(binDir(), { recursive: true, force: true });
  if (previous) await rm(backupPath(), { force: true });
  console.log(previous ? t.cli.removedRestored : t.cli.removed);
  return 0;
}
