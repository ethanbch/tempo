#!/usr/bin/env node
/**
 * Statusline Claude Code qui relaie les limites d'usage à Tempo.
 *
 * Claude Code transmet à la statusline, sur l'entrée standard, les pourcentages
 * consommés de la fenêtre de 5 heures et de la semaine (`rate_limits`). C'est la
 * seule source locale de ces chiffres : on les dépose dans un fichier que Tempo
 * relit, sans que Tempo ait à toucher au jeton OAuth ni au réseau.
 *
 * Chaque changement est aussi ajouté à un historique, qui sert à Tempo pour
 * projeter le rythme et estimer les plafonds, et une notification part quand
 * un seuil d'alerte est franchi.
 *
 * Installation : `npm run setup:statusline`.
 *
 * Variables d'environnement, toutes facultatives :
 *   TEMPO_LIMITS_PATH        dernier relevé (l'historique est écrit à côté)
 *   TEMPO_ALERT_THRESHOLDS   seuils d'alerte en %, « 80,95 » par défaut, « off » pour couper
 *   TEMPO_ALERT_DRY_RUN      si défini, les alertes sont écrites sur stderr au lieu d'être notifiées
 *   TEMPO_LANG               langue (en, fr, es, de), sinon celle du terminal, sinon l'anglais
 */
import { execFile, spawn } from "node:child_process";
import { appendFile, mkdir, open, readFile, rename, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

const LATEST_PATH =
  process.env.TEMPO_LIMITS_PATH ?? path.join(homedir(), ".claude", "tempo", "rate-limits.json");
const HISTORY_PATH = path.join(path.dirname(LATEST_PATH), "rate-limits-history.jsonl");

/** Au-delà de cette taille, l'historique est élagué de ses relevés trop anciens. */
const HISTORY_MAX_BYTES = 2_000_000;
const HISTORY_RETENTION_MS = 60 * 24 * 60 * 60 * 1000;

/**
 * `resets_at` peut varier de quelques secondes d'un relevé à l'autre pour une
 * même fenêtre : on ne parle de nouvelle fenêtre qu'au-delà de cet écart.
 */
const SAME_WINDOW_TOLERANCE_MS = 10 * 60 * 1000;

const pad = (value) => String(value).padStart(2, "0");

/**
 * Textes de la statusline et des alertes. Les échéances portent leur
 * préposition — « à 20h », « dans 13h30m » — pour qu'on ne confonde jamais une
 * heure avec une durée.
 */
const TEXTS = {
  en: {
    week: "7d",
    day: "d",
    clock: (hours, minutes) => `${hours}:${pad(minutes)}`,
    at: (time) => `at ${time}`,
    in: (remaining) => `in ${remaining}`,
    percent: (value) => `${value}%`,
    detached: "detached",
    sessionName: "session",
    weekName: "week",
    alertTitle: (name, value) => `Claude · ${name} at ${value}%`,
    resetsAt: (time) => `Resets at ${time}`,
    resetsIn: (remaining) => `Resets in ${remaining}`,
    unknownReset: "Reset time unknown",
    limitAt: (time) => `limit ~${time}`,
  },
  fr: {
    week: "7j",
    day: "j",
    clock: (hours, minutes) => `${hours}h${minutes ? pad(minutes) : ""}`,
    at: (time) => `à ${time}`,
    in: (remaining) => `dans ${remaining}`,
    percent: (value) => `${value} %`,
    detached: "détachée",
    sessionName: "session",
    weekName: "semaine",
    alertTitle: (name, value) => `Claude · ${name} à ${value} %`,
    resetsAt: (time) => `Réinitialisation à ${time}`,
    resetsIn: (remaining) => `Réinitialisation dans ${remaining}`,
    unknownReset: "Échéance inconnue",
    limitAt: (time) => `limite ~${time}`,
  },
  es: {
    week: "7d",
    day: "d",
    clock: (hours, minutes) => `${hours}:${pad(minutes)}`,
    at: (time) => `a las ${time}`,
    in: (remaining) => `en ${remaining}`,
    percent: (value) => `${value} %`,
    detached: "separada",
    sessionName: "sesión",
    weekName: "semana",
    alertTitle: (name, value) => `Claude · ${name} al ${value} %`,
    resetsAt: (time) => `Se reinicia a las ${time}`,
    resetsIn: (remaining) => `Se reinicia en ${remaining}`,
    unknownReset: "Reinicio desconocido",
    limitAt: (time) => `límite ~${time}`,
  },
  de: {
    week: "7T",
    day: "T",
    clock: (hours, minutes) => `${hours}:${pad(minutes)}`,
    at: (time) => `um ${time}`,
    in: (remaining) => `in ${remaining}`,
    percent: (value) => `${value} %`,
    detached: "losgelöst",
    sessionName: "Sitzung",
    weekName: "Woche",
    alertTitle: (name, value) => `Claude · ${name} bei ${value} %`,
    resetsAt: (time) => `Zurücksetzung um ${time}`,
    resetsIn: (remaining) => `Zurücksetzung in ${remaining}`,
    unknownReset: "Zurücksetzung unbekannt",
    limitAt: (time) => `Limit ~${time}`,
  },
};

/** Langue : `TEMPO_LANG`, sinon celle du terminal, sinon l'anglais. */
const T = (() => {
  const { TEMPO_LANG, LC_ALL, LC_MESSAGES, LANG } = process.env;
  for (const value of [TEMPO_LANG, LC_ALL, LC_MESSAGES, LANG]) {
    const code = value?.slice(0, 2).toLowerCase();
    if (code && code in TEXTS) return TEXTS[code];
  }
  return TEXTS.en;
})();

const ALERT_THRESHOLDS = (() => {
  const raw = process.env.TEMPO_ALERT_THRESHOLDS ?? "80,95";
  if (raw.trim() === "off") return [];
  return raw
    .split(",")
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0 && value <= 100)
    .sort((a, b) => a - b);
})();

/* Palette Readout (spécification terminal) : l'accent indigo, les statuts réservés, des gris. */
const RESET = "\x1b[0m";
const rgb = (r, g, b) => (text) => `\x1b[38;2;${r};${g};${b}m${text}${RESET}`;
const accent = rgb(139, 147, 255); // #8b93ff
const warning = rgb(229, 176, 74); // #e5b04a, à partir de 70 %
const critical = rgb(229, 103, 90); // #e5675a, à partir de 90 %
const ink = rgb(236, 235, 231); // #ecebe7
const muted = rgb(140, 140, 140); // #8c8c8c
const faint = rgb(85, 85, 85); // #555555

const SEPARATOR = faint("  ·  ");
const BAR_CELLS = 8;

/** Échelle d'effort, du plus léger au plus soutenu, avec un glyphe qui se remplit. */
const EFFORT_GLYPHS = { low: "○", medium: "◔", high: "◑", xhigh: "◕", max: "●" };

async function readStdin() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  return raw;
}

/**
 * Branche, modifications en cours et écart avec le distant, en un seul appel à
 * `git`. Borné dans le temps : la statusline ne doit jamais attendre un dépôt lent.
 */
function gitStatus(dir) {
  if (!dir) return Promise.resolve(null);
  return new Promise((resolve) => {
    execFile(
      "git",
      ["--no-optional-locks", "status", "--porcelain=v2", "--branch"],
      { cwd: dir, timeout: 400 },
      (error, stdout) => {
        if (error) return resolve(null);
        let branch = null;
        let ahead = 0;
        let behind = 0;
        let dirty = false;
        for (const line of stdout.split("\n")) {
          if (line.startsWith("# branch.head ")) branch = line.slice(14);
          else if (line.startsWith("# branch.ab ")) {
            const [, a, b] = line.match(/\+(\d+) -(\d+)/) ?? [];
            ahead = Number(a ?? 0);
            behind = Number(b ?? 0);
          } else if (line && !line.startsWith("#")) dirty = true;
        }
        resolve({ branch: branch === "(detached)" ? T.detached : branch, ahead, behind, dirty });
      },
    );
  });
}

/** `resets_at` arrive en secondes Unix ; on tolère aussi les millisecondes. */
function toDate(resetsAt) {
  if (typeof resetsAt !== "number" || !Number.isFinite(resetsAt)) return null;
  const date = new Date(resetsAt < 1e12 ? resetsAt * 1_000 : resetsAt);
  return date.getTime() > Date.now() ? date : null;
}

/** « 16h40 » ou « 16h » pile en français, « 16:40 » ailleurs. */
function clock(date) {
  return T.clock(date.getHours(), date.getMinutes());
}

/** Heure de réinitialisation de la session : « 16h40 ». */
function resetClock(resetsAt) {
  const date = toDate(resetsAt);
  return date ? clock(date) : null;
}

/** Temps restant avant réinitialisation : « 3j14h10m », « 14h10m », « 37m ». */
function resetCountdown(resetsAt) {
  const date = toDate(resetsAt);
  if (!date) return null;
  const totalMinutes = Math.floor((date.getTime() - Date.now()) / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}${T.day}${hours}h${minutes}m`;
  if (hours > 0) return `${hours}h${minutes}m`;
  return `${minutes}m`;
}

function resetMs(resetsAt) {
  if (typeof resetsAt !== "number" || !Number.isFinite(resetsAt)) return null;
  return resetsAt < 1e12 ? resetsAt * 1_000 : resetsAt;
}

function sameWindow(a, b) {
  const left = resetMs(a?.resets_at);
  const right = resetMs(b?.resets_at);
  if (left === null || right === null) return left === right;
  return Math.abs(left - right) < SAME_WINDOW_TOLERANCE_MS;
}

/** Vrai si un relevé apporte quelque chose de neuf à l'historique. */
function hasChanged(previous, next) {
  if (!previous) return true;
  return ["five_hour", "seven_day"].some(
    (key) =>
      previous[key]?.used_percentage !== next[key]?.used_percentage ||
      !sameWindow(previous[key], next[key]),
  );
}

async function readLatest() {
  try {
    return JSON.parse(await readFile(LATEST_PATH, "utf8"))?.rate_limits ?? null;
  } catch {
    return null;
  }
}

/** Garde l'historique sous une taille raisonnable en oubliant les relevés trop vieux. */
async function pruneHistory() {
  const info = await stat(HISTORY_PATH);
  if (info.size <= HISTORY_MAX_BYTES) return;
  const cutoff = Date.now() - HISTORY_RETENTION_MS;
  const kept = (await readFile(HISTORY_PATH, "utf8")).split("\n").filter((line) => {
    try {
      return Date.parse(JSON.parse(line).capturedAt) >= cutoff;
    } catch {
      return false;
    }
  });
  const temp = `${HISTORY_PATH}.${process.pid}.tmp`;
  await writeFile(temp, kept.map((line) => `${line}\n`).join(""));
  await rename(temp, HISTORY_PATH);
}

/** Échappe une chaîne pour AppleScript. */
function appleString(text) {
  return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** Notification système, lancée sans l'attendre : la statusline ne doit pas ralentir. */
function notify(title, body) {
  if (process.env.TEMPO_ALERT_DRY_RUN) {
    process.stderr.write(`[alerte] ${title} — ${body}\n`);
    return;
  }
  let command = null;
  if (process.platform === "darwin") {
    command = [
      "osascript",
      ["-e", `display notification ${appleString(body)} with title ${appleString(title)} sound name "Glass"`],
    ];
  } else if (process.platform === "linux") {
    command = ["notify-send", [title, body]];
  }
  if (!command) return;
  try {
    const child = spawn(command[0], command[1], { detached: true, stdio: "ignore" });
    child.on("error", () => {});
    child.unref();
  } catch {
    // Pas d'outil de notification : tant pis, la jauge reste là.
  }
}

/**
 * Notifie le plus haut seuil franchi depuis le relevé précédent, une seule fois
 * par fenêtre : une fenêtre neuve repart de zéro.
 */
function alertOnThresholds(previous, next) {
  const windows = [
    { key: "five_hour", name: T.sessionName, reset: (value) => T.resetsAt(resetClock(value)) },
    { key: "seven_day", name: T.weekName, reset: (value) => T.resetsIn(resetCountdown(value)) },
  ];
  for (const { key, name, reset } of windows) {
    const current = next[key];
    if (typeof current?.used_percentage !== "number") continue;
    const before =
      previous?.[key] && sameWindow(previous[key], current)
        ? (previous[key].used_percentage ?? 0)
        : 0;
    const crossed = ALERT_THRESHOLDS.filter(
      (threshold) => before < threshold && current.used_percentage >= threshold,
    );
    if (crossed.length === 0) continue;
    const body = toDate(current.resets_at) ? reset(current.resets_at) : T.unknownReset;
    notify(T.alertTitle(name, Math.round(current.used_percentage)), body);
  }
}

/**
 * Enregistre un relevé : dernier état (écriture atomique, pour que Tempo ne lise
 * jamais un fichier à moitié écrit), historique si quelque chose a bougé, puis
 * alertes. Rien de tout cela ne doit pouvoir faire échouer la statusline.
 */
async function record(limits) {
  try {
    const previous = await readLatest();
    const snapshot = JSON.stringify({ capturedAt: new Date().toISOString(), rate_limits: limits });

    await mkdir(path.dirname(LATEST_PATH), { recursive: true });
    const temp = `${LATEST_PATH}.${process.pid}.tmp`;
    await writeFile(temp, snapshot);
    await rename(temp, LATEST_PATH);

    if (hasChanged(previous, limits)) {
      await appendFile(HISTORY_PATH, `${snapshot}\n`);
      await pruneHistory();
    }
    alertOnThresholds(previous, limits);
  } catch {
    // La statusline ne doit jamais échouer à cause de Tempo.
  }
}

const SESSION_MS = 5 * 60 * 60 * 1000;
/** Période sur laquelle se mesure le rythme récent de la session, comme le tableau de bord. */
const PACE_LOOKBACK_MS = 60 * 60 * 1000;
const MIN_PACE_SPAN_MS = 5 * 60 * 1000;
/** Fin de l'historique relue à chaque passage : largement de quoi couvrir une session. */
const HISTORY_TAIL_BYTES = 64 * 1024;

async function historyTail() {
  try {
    const file = await open(HISTORY_PATH, "r");
    try {
      const { size } = await file.stat();
      const length = Math.min(size, HISTORY_TAIL_BYTES);
      const buffer = Buffer.alloc(length);
      await file.read(buffer, 0, length, size - length);
      return buffer.toString("utf8").split("\n").slice(size > length ? 1 : 0);
    } finally {
      await file.close();
    }
  } catch {
    return [];
  }
}

/**
 * Heure à laquelle la session atteindra sa limite au rythme de la dernière
 * heure, si c'est avant la réinitialisation ; sinon null.
 */
async function sessionLimitAt(current) {
  const resetAt = resetMs(current?.resets_at);
  const used = current?.used_percentage;
  if (resetAt === null || typeof used !== "number" || used >= 100) return null;
  const now = Date.now();
  const windowStart = resetAt - SESSION_MS;
  const from = Math.max(windowStart, now - PACE_LOOKBACK_MS);

  let anchor = { at: windowStart, used: 0 };
  for (const line of await historyTail()) {
    try {
      const sample = JSON.parse(line);
      const at = Date.parse(sample.capturedAt);
      const window = sample.rate_limits?.five_hour;
      if (!window || at > from || at < windowStart || !sameWindow(window, current)) continue;
      if (at >= anchor.at) anchor = { at, used: window.used_percentage };
    } catch {
      // Ligne tronquée : ignorée.
    }
  }

  const span = now - anchor.at;
  const rate = (used - anchor.used) / span;
  if (span < MIN_PACE_SPAN_MS || !(rate > 0)) return null;
  const hitsAt = now + (100 - used) / rate;
  return hitsAt < resetAt ? new Date(hitsAt) : null;
}

/** « 5h ▰▰▱▱▱▱▱▱ 23 % ↻ 16h40 », teinté selon la consommation. */
function gauge(name, used, { warnAt, criticalAt, reset }) {
  if (typeof used !== "number" || !Number.isFinite(used)) return null;
  const value = Math.min(100, Math.max(0, used));
  const tone = value >= criticalAt ? critical : value >= warnAt ? warning : accent;
  // Une consommation non nulle remplit toujours au moins une case.
  const filled = value > 0 ? Math.max(1, Math.round((value / 100) * BAR_CELLS)) : 0;
  const bar = tone("▰".repeat(filled)) + faint("▱".repeat(BAR_CELLS - filled));
  return [muted(name), bar, tone(T.percent(Math.round(value))), reset ? faint(`↻ ${reset}`) : null]
    .filter(Boolean)
    .join(" ");
}

let input = {};
try {
  input = JSON.parse(await readStdin());
} catch {
  // Entrée illisible : on affiche quand même une ligne plutôt que de planter.
}

const limits = input.rate_limits;
// Sans `rate_limits` (début de session, avant la première réponse), on garde le
// relevé précédent plutôt que de l'effacer.
if (limits && (limits.five_hour || limits.seven_day)) await record(limits);

const dir = input.workspace?.current_dir ?? input.cwd;
const git = await gitStatus(dir);

// Modèle, effort et mode rapide forment un seul bloc : c'est « qui répond, et comment ».
const effort = input.effort?.level;
const model = input.model?.display_name
  ? [
      accent(input.model.display_name),
      effort ? muted(`${EFFORT_GLYPHS[effort] ?? "◌"} ${effort}`) : null,
      input.fast_mode ? warning("⚡") : null,
    ]
      .filter(Boolean)
      .join(" ")
  : null;

const where = dir
  ? [
      ink(path.basename(dir)),
      git?.branch ? muted(`⎇ ${git.branch}`) : null,
      git?.dirty ? warning("●") : null,
      git?.ahead ? muted(`↑${git.ahead}`) : null,
      git?.behind ? muted(`↓${git.behind}`) : null,
    ]
      .filter(Boolean)
      .join(" ")
  : null;

// Le rythme compare le relevé actuel au dernier relevé d'il y a une heure ou plus.
const limitAt = await sessionLimitAt(limits?.five_hour);

const parts = [
  model,
  where,
  // Le contexte se resserre plus tôt : la compaction automatique guette vers 80 %.
  gauge("ctx", input.context_window?.used_percentage, { warnAt: 60, criticalAt: 80 }),
  gauge("5h", limits?.five_hour?.used_percentage, {
    warnAt: 70,
    criticalAt: 90,
    reset: (() => {
      const time = resetClock(limits?.five_hour?.resets_at);
      if (!time) return null;
      return limitAt ? `${T.at(time)} ${warning("· " + T.limitAt(clock(limitAt)))}` : T.at(time);
    })(),
  }),
  gauge(T.week, limits?.seven_day?.used_percentage, {
    warnAt: 70,
    criticalAt: 90,
    reset: (() => {
      const remaining = resetCountdown(limits?.seven_day?.resets_at);
      return remaining && T.in(remaining);
    })(),
  }),
].filter(Boolean);
process.stdout.write(parts.join(SEPARATOR));
