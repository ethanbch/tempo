import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import net from "node:net";
import path from "node:path";

import { cliText, packageRoot, palette } from "./env";
import { isTempoStatusline, readSettings } from "./setup";

/**
 * `tempo` : démarre le serveur du tableau de bord et ouvre le navigateur.
 *
 * Le serveur écoute sur 127.0.0.1 seulement : rien n'est exposé au réseau.
 */

const DEFAULT_PORT = 4317;
const HOST = "127.0.0.1";
const READY_TIMEOUT_MS = 30_000;

function portFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen(port, HOST, () => server.close(() => resolve(true)));
  });
}

async function firstFreePort(from: number): Promise<number | null> {
  for (let port = from; port < from + 20; port += 1) {
    if (await portFree(port)) return port;
  }
  return null;
}

async function waitReady(url: string): Promise<boolean> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { method: "HEAD" });
      if (response.status < 500) return true;
    } catch {
      // Pas encore prêt.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

function openBrowser(url: string) {
  const command =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  try {
    spawn(command, args, { detached: true, stdio: "ignore" }).on("error", () => {}).unref();
  } catch {
    // Pas de navigateur : l'URL est affichée de toute façon.
  }
}

export async function start(options: { port?: number; open: boolean }): Promise<number> {
  const { t } = cliText();
  const colors = palette();
  const server = path.join(packageRoot(), ".next", "standalone", "server.js");
  try {
    await stat(server);
  } catch {
    console.error(t.cli.noBuild);
    return 1;
  }

  const port = await firstFreePort(options.port ?? DEFAULT_PORT);
  if (!port) {
    console.error(t.cli.startFailed);
    return 1;
  }
  const url = `http://${HOST}:${port}`;
  console.log(colors.muted(t.cli.starting));

  const child = spawn(process.execPath, [server], {
    cwd: path.dirname(server),
    env: { ...process.env, PORT: String(port), HOSTNAME: HOST, NODE_ENV: "production" },
    stdio: ["ignore", "ignore", "inherit"],
  });
  const stop = () => child.kill("SIGTERM");
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  if (!(await waitReady(url))) {
    stop();
    console.error(t.cli.startFailed);
    return 1;
  }

  console.log(`${colors.accent("▍")} ${t.cli.ready(colors.ink(url))}`);
  console.log(colors.muted(t.cli.stop));
  try {
    if (!isTempoStatusline((await readSettings()).statusLine)) console.log(colors.warning(t.cli.setupHint));
  } catch {
    // Réglages illisibles : tempo doctor le dira.
  }
  if (options.open) openBrowser(url);

  return new Promise((resolve) => child.on("exit", (code) => resolve(code ?? 0)));
}
