import { readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import { readAccount } from "../lib/account";
import { scanUsage } from "../lib/scan";
import { cliText, packageRoot, palette, tempoDir } from "./env";
import { hasTempoHook, isTempoStatusline, readSettings } from "./setup";

/** `tempo doctor` : chaque point de l'installation, avec ce qu'il faut faire s'il manque. */

type Level = "ok" | "warn" | "missing";

/** Un relevé plus vieux que ça ne reflète plus la fenêtre de 5 heures en cours. */
const STALE_READING_MS = 6 * 60 * 60 * 1000;

function tilde(file: string): string {
  return file.startsWith(homedir()) ? `~${file.slice(homedir().length)}` : file;
}

export async function doctor(): Promise<number> {
  const { t, f } = cliText();
  const colors = palette();
  const checks: Array<[Level, string]> = [];

  const major = Number(process.versions.node.split(".")[0]);
  checks.push(major >= 20 ? ["ok", t.cli.node(process.versions.node)] : ["missing", t.cli.nodeOld(process.versions.node)]);

  const scan = await scanUsage();
  checks.push(
    scan.fileCount > 0
      ? ["ok", t.cli.transcripts(f.integer(scan.fileCount), tilde(scan.root))]
      : ["missing", t.cli.noTranscripts(tilde(scan.root))],
  );

  const account = await readAccount();
  checks.push(
    account.missing
      ? ["warn", t.cli.noAccount]
      : ["ok", t.cli.account(account.plan ?? "")],
  );

  let settings = {};
  try {
    settings = await readSettings();
  } catch (error) {
    checks.push(["missing", (error as Error).message]);
  }
  checks.push(
    isTempoStatusline((settings as { statusLine?: { command?: string } }).statusLine)
      ? ["ok", t.cli.statusline]
      : ["missing", t.cli.noStatusline],
  );
  checks.push(hasTempoHook(settings) ? ["ok", t.cli.hook] : ["missing", t.cli.noHook]);

  try {
    const latest = JSON.parse(await readFile(path.join(tempoDir(), "rate-limits.json"), "utf8"));
    const at = Date.parse(latest.capturedAt);
    const ago = f.timeAgo(latest.capturedAt);
    checks.push(Date.now() - at > STALE_READING_MS ? ["warn", t.cli.readingOld(ago)] : ["ok", t.cli.reading(ago)]);
  } catch {
    checks.push(["warn", t.cli.noReading]);
  }

  // Le serveur n'existe que dans un paquet construit ; un dépôt cloné doit d'abord le construire.
  let built = false;
  try {
    built = (await stat(path.join(packageRoot(), ".next", "standalone", "server.js"))).isFile();
  } catch {
    built = false;
  }
  checks.push(built ? ["ok", t.cli.build] : ["missing", t.cli.noBuild2]);

  const tone = { ok: colors.good, warn: colors.warning, missing: colors.critical };
  const word = { ok: t.cli.ok, warn: t.cli.warn, missing: t.cli.missing };
  const width = Math.max(...Object.values(word).map((value) => value.length)) + 2;

  const lines = [colors.bold(t.cli.doctorTitle), ""];
  for (const [level, text] of checks) {
    lines.push(`${tone[level](word[level].padEnd(width))}${text}`);
  }
  const problems = checks.filter(([level]) => level !== "ok").length;
  lines.push("", problems === 0 ? t.cli.allGood : t.cli.toFix(problems));
  console.log(lines.join("\n"));

  return checks.some(([level]) => level === "missing") ? 1 : 0;
}
