import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

const STATUSLINE = path.resolve(import.meta.dirname, "../scripts/statusline.mjs");
const SETUP = path.resolve(import.meta.dirname, "../scripts/setup-statusline.mjs");

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "tempo-statusline-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function run(script: string, input: string, args: string[] = [], lang = "fr") {
  const result = spawnSync("node", [script, ...args], {
    input,
    encoding: "utf8",
    env: {
      ...process.env,
      TEMPO_LANG: lang,
      TEMPO_LIMITS_PATH: path.join(dir, "rate-limits.json"),
      CLAUDE_SETTINGS_PATH: path.join(dir, "settings.json"),
      TEMPO_ALERT_DRY_RUN: "1",
    },
  });
  return {
    status: result.status,
    stdout: result.stdout.replace(/\x1b\[[0-9;]*m/g, ""),
    stderr: result.stderr,
  };
}

function limitsInput(session: number, week: number, resetIn = 7_200) {
  const now = Math.floor(Date.now() / 1000);
  return JSON.stringify({
    model: { display_name: "Opus 5.5" },
    effort: { level: "high" },
    context_window: { used_percentage: 52 },
    rate_limits: {
      five_hour: { used_percentage: session, resets_at: now + resetIn },
      seven_day: { used_percentage: week, resets_at: now + 300_000 },
    },
  });
}

async function historyLines() {
  try {
    return (await readFile(path.join(dir, "rate-limits-history.jsonl"), "utf8"))
      .split("\n")
      .filter(Boolean);
  } catch {
    return [];
  }
}

describe("statusline", () => {
  it("renders the model, effort, context and limit gauges", () => {
    const { stdout, status } = run(STATUSLINE, limitsInput(6, 35));
    expect(status).toBe(0);
    expect(stdout).toContain("Opus 5.5 ◑ high");
    expect(stdout).not.toContain("✻");
    expect(stdout).toMatch(/ctx ▰{4}▱{4} 52 %/);
    // Une heure pour la session, une durée pour la semaine : la préposition
    // évite de confondre les deux.
    expect(stdout).toMatch(/5h ▰▱{7} 6 % ↻ à \d+h(\d{2})?/);
    expect(stdout).toMatch(/7j ▰{3}▱{5} 35 % ↻ dans 3j\d+h\d+m/);
  });

  it("follows the requested language", () => {
    const { stdout } = run(STATUSLINE, limitsInput(6, 35), [], "en");
    expect(stdout).toMatch(/5h ▰▱{7} 6% ↻ at \d+:\d{2}/);
    expect(stdout).toMatch(/7d ▰{3}▱{5} 35% ↻ in 3d\d+h\d+m/);
  });

  it("never fails on unreadable input", () => {
    const { status } = run(STATUSLINE, "pas du json");
    expect(status).toBe(0);
  });

  it("appends to the history only when something changed", async () => {
    run(STATUSLINE, limitsInput(10, 20));
    run(STATUSLINE, limitsInput(10, 20));
    run(STATUSLINE, limitsInput(11, 20));
    expect(await historyLines()).toHaveLength(2);

    // Sans `rate_limits`, le relevé précédent reste en place.
    run(STATUSLINE, JSON.stringify({ model: { display_name: "Opus 5.5" } }));
    const latest = JSON.parse(await readFile(path.join(dir, "rate-limits.json"), "utf8"));
    expect(latest.rate_limits.five_hour.used_percentage).toBe(11);
  });

  it("alerts once per threshold crossed, and again in a new window", () => {
    expect(run(STATUSLINE, limitsInput(79, 20)).stderr).toBe("");
    expect(run(STATUSLINE, limitsInput(81, 20)).stderr).toContain("session à 81 %");
    expect(run(STATUSLINE, limitsInput(85, 20)).stderr).toBe("");
    // Deux seuils franchis d'un coup : une seule notification, pour le plus haut.
    const crossedTwo = run(STATUSLINE, limitsInput(70, 96));
    expect(crossedTwo.stderr.match(/\[alerte\]/g)).toHaveLength(1);
    expect(crossedTwo.stderr).toContain("semaine à 96 %");
    // Nouvelle fenêtre de session : le seuil peut de nouveau être notifié.
    expect(run(STATUSLINE, limitsInput(82, 96, 20_000)).stderr).toContain("session à 82 %");
  });
});

describe("setup-statusline", () => {
  const settingsPath = () => path.join(dir, "settings.json");
  const settings = async () => JSON.parse(await readFile(settingsPath(), "utf8"));

  it("installs next to the existing settings", async () => {
    await writeFile(settingsPath(), JSON.stringify({ theme: "dark" }));
    expect(run(SETUP, "").status).toBe(0);
    const result = await settings();
    expect(result.theme).toBe("dark");
    expect(result.statusLine.command).toContain("statusline.mjs");
  });

  it("refuses to replace another statusline without --force, then restores it on --remove", async () => {
    const other = { type: "command", command: "echo hi" };
    await writeFile(settingsPath(), JSON.stringify({ statusLine: other }));

    expect(run(SETUP, "").status).toBe(1);
    expect((await settings()).statusLine).toEqual(other);

    expect(run(SETUP, "", ["--force"]).status).toBe(0);
    expect((await settings()).statusLine.command).toContain("statusline.mjs");

    expect(run(SETUP, "", ["--remove"]).status).toBe(0);
    expect((await settings()).statusLine).toEqual(other);
  });
});
