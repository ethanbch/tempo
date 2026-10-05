import { openSync, writeSync, closeSync } from "node:fs";

import { buildCalibration } from "../lib/aggregate";
import { loadLimits } from "../lib/limits";
import { scanUsage } from "../lib/scan";
import { cliText, palette } from "./env";

/**
 * Hook SessionEnd de Claude Code : une ligne de bilan quand la session se ferme.
 *
 * Claude Code a déjà rendu la main au terminal quand ce hook tourne, et ce que
 * le hook écrit sur sa sortie standard n'est pas affiché. La ligne est donc
 * écrite directement sur le terminal (/dev/tty). Rien n'est écrit pour un
 * `/clear`, où l'interface est encore à l'écran.
 */

const SHOWN_REASONS = new Set(["prompt_input_exit", "logout", "other"]);

async function readStdin(): Promise<string> {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  return raw;
}

/** La ligne de bilan d'une session, ou null si elle n'a fait aucune requête. */
export async function sessionSummary(sessionId: string, colorEnabled: boolean): Promise<string | null> {
  const { t, f } = cliText();
  const colors = palette(colorEnabled);
  const scan = await scanUsage();
  const events = scan.events.filter((event) => event.sessionId === sessionId);
  if (events.length === 0) return null;

  const factor = buildCalibration(scan).get(sessionId) ?? 1;
  const cost = events.reduce((sum, event) => sum + event.cost.total * factor, 0);
  const durationMs = events[events.length - 1].time - events[0].time;
  const branch = events.find((event) => event.gitBranch)?.gitBranch;

  const parts = [
    f.duration(durationMs),
    colors.ink(f.usd(cost)),
    t.cli.requests(f.integer(events.length)),
  ];
  if (branch) parts.push(branch);

  const limits = await loadLimits(scan);
  const session = limits?.session;
  if (session && !session.expired) parts.push(`5h ${f.percent(session.used)}`);

  return `${colors.accent("tempo")} ${colors.faint("·")} ${colors.muted(parts.join(" · "))}`;
}

export async function sessionEnd(): Promise<number> {
  if (process.env.TEMPO_SESSION_SUMMARY === "off") return 0;
  let input: { session_id?: string; reason?: string } = {};
  try {
    input = JSON.parse(await readStdin());
  } catch {
    return 0;
  }
  if (!input.session_id || !SHOWN_REASONS.has(input.reason ?? "other")) return 0;

  try {
    const line = await sessionSummary(input.session_id, !process.env.NO_COLOR);
    if (!line) return 0;
    if (process.env.TEMPO_SUMMARY_TO_STDOUT) {
      process.stdout.write(`${line}\n`);
      return 0;
    }
    const tty = openSync("/dev/tty", "w");
    writeSync(tty, `${line}\n`);
    closeSync(tty);
  } catch {
    // Pas de terminal, transcripts illisibles : le hook ne doit jamais gêner la sortie.
  }
  return 0;
}
