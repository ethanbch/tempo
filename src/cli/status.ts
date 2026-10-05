import { execFile } from "node:child_process";

import { buildReport, type BranchPoint } from "../lib/aggregate";
import { attachBranchLinks } from "../lib/git";
import type { Lever } from "../lib/insights";
import type { Messages } from "../lib/i18n";
import type { LimitAnalysis, LimitKind } from "../lib/limits";
import { loadLimits } from "../lib/limits";
import { scanUsage } from "../lib/scan";
import { cliText, meter, palette, type Palette } from "./env";

/** `tempo status` : limites, coût et branche courante, sans ouvrir le navigateur. */

const LABEL_WIDTH = 14;

const LEVER_TEXT: Record<Lever["id"], keyof Messages["levers"]> = {
  "idle-timeout": "idleTimeout",
  "cache-invalidation": "cacheInvalidation",
  "long-context": "longContext",
  sidechains: "sidechains",
  effort: "effort",
  "model-mix": "modelMix",
};

function git(args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    execFile("git", args, { timeout: 1000 }, (error, stdout) => resolve(error ? null : stdout.trim()));
  });
}

/** La branche du dossier courant et son coût cumulé, s'il y a eu des sessions dessus. */
async function currentBranch(branches: BranchPoint[]): Promise<BranchPoint | null> {
  const [branch, root] = await Promise.all([
    git(["rev-parse", "--abbrev-ref", "HEAD"]),
    git(["rev-parse", "--show-toplevel"]),
  ]);
  if (!branch || !root) return null;
  const match = branches.find(
    (point) =>
      point.branch === branch &&
      !!point.projectPath &&
      (point.projectPath === root || point.projectPath.startsWith(`${root}/`)),
  );
  if (!match) return null;
  const [linked] = await attachBranchLinks([match]);
  return linked;
}

function limitLine(
  kind: LimitKind,
  analysis: LimitAnalysis | null,
  now: number,
  colors: Palette,
): string | null {
  const { t, f } = cliText();
  if (!analysis) return null;
  const label = colors.muted((kind === "session" ? t.cli.session : t.cli.week).padEnd(LABEL_WIDTH));
  let reset = "";
  if (analysis.resetsAt) {
    const remaining = f.countdown(Date.parse(analysis.resetsAt) - now);
    reset =
      kind === "session"
        ? t.limits.sessionReset(f.formatTime(analysis.resetsAt), remaining)
        : t.limits.weekReset(remaining, f.formatDateTime(analysis.resetsAt));
  }
  const hits = analysis.projection?.hitsAt;
  const pace = hits
    ? colors.warning(` · ${t.cli.limitAt(kind === "session" ? f.formatTime(hits) : f.formatDateTime(hits))}`)
    : "";
  return `${label}${meter(analysis.used, colors)} ${colors.ink(f.percent(analysis.used).padStart(5))}  ${colors.muted(reset)}${pace}`;
}

export async function status(): Promise<number> {
  const { t, f } = cliText();
  const colors = palette();
  const now = Date.now();
  const scan = await scanUsage();
  const [limits, day, week, all] = await Promise.all([
    loadLimits(scan, now),
    Promise.resolve(buildReport(scan, "24h", now)),
    Promise.resolve(buildReport(scan, "7d", now)),
    Promise.resolve(buildReport(scan, "all", now)),
  ]);

  const lines: string[] = [colors.bold(`tempo ${colors.accent("▍")}`), ""];

  if (limits) {
    for (const line of [
      limitLine("session", limits.session, now, colors),
      limitLine("week", limits.week, now, colors),
    ]) {
      if (line) lines.push(line);
    }
  } else {
    lines.push(colors.muted(t.cli.noLimits));
  }
  lines.push("");

  const label = (text: string) => colors.muted(text.padEnd(LABEL_WIDTH));
  lines.push(
    `${label(t.filters.ranges["24h"])}${colors.ink(f.usd(day.summary.cost))}  ${colors.muted(
      t.cli.requests(f.integer(day.summary.requests)),
    )}`,
  );

  const previous = week.summary.previousCost;
  let delta = "";
  if (previous && previous > 0) {
    const change = (week.summary.cost - previous) / previous;
    delta = `${change >= 0 ? "▲ +" : "▼ −"}${f.percent(Math.abs(change))} ${t.overview.vsPrevious}`;
  }
  lines.push(`${label(t.cli.last7)}${colors.ink(f.usd(week.summary.cost))}  ${colors.muted(delta)}`);

  const branch = await currentBranch(all.byBranch);
  if (branch) {
    const pr = branch.link?.pr ? ` · PR #${branch.link.pr}` : "";
    lines.push(
      `${label(t.cli.branch)}${colors.ink(branch.branch)}  ${colors.muted(
        `${f.usd(branch.cost)} · ${t.captions.branch(branch.projectName, branch.sessions, null)}${pr}`,
      )}`,
    );
  }

  const lever = week.insights.levers.find((entry) => entry.kind === "free");
  if (lever) {
    const text = t.levers[LEVER_TEXT[lever.id]] as { title: string };
    lines.push(
      `${label(t.cli.lever)}${colors.ink(text.title)}  ${colors.muted(t.cli.avoidable(f.usd(lever.amount)))}`,
    );
  }

  console.log(lines.join("\n"));
  return 0;
}
