import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import path from "node:path";

import type { BranchPoint } from "./aggregate";

/**
 * Liens vers les branches et leurs PR, tirés du dépôt git local uniquement.
 *
 * Aucun appel réseau : l'URL vient du remote `origin`, le numéro de PR des
 * commits de fusion « Merge pull request #12 from owner/branche » de
 * l'historique local. Une PR fusionnée par squash ne laisse pas ce commit :
 * la branche garde alors un lien vers elle-même, sans numéro.
 */

const GIT_TIMEOUT_MS = 1500;
/** Commits de fusion lus par dépôt : de quoi couvrir des mois d'activité. */
const MERGE_DEPTH = 2000;

interface RepoInfo {
  /** `https://github.com/owner/repo`, ou null si le remote n'est pas reconnu. */
  web: string | null;
  /** Branche → numéro de PR. */
  prs: Map<string, number>;
}

function git(cwd: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    execFile("git", ["-C", cwd, ...args], { timeout: GIT_TIMEOUT_MS }, (error, stdout) =>
      resolve(error ? null : stdout),
    );
  });
}

/** `git@github.com:owner/repo.git` ou `https://github.com/owner/repo` → URL web. */
export function webUrl(remote: string): string | null {
  const trimmed = remote.trim().replace(/\.git$/, "");
  const ssh = trimmed.match(/^git@([^:]+):(.+)$/);
  if (ssh) return `https://${ssh[1]}/${ssh[2]}`;
  const https = trimmed.match(/^https?:\/\/(?:[^@/]+@)?([^/]+)\/(.+)$/);
  if (https) return `https://${https[1]}/${https[2]}`;
  return null;
}

/** Branche → PR, depuis les sujets des commits de fusion GitHub. */
export function parseMergeSubjects(log: string): Map<string, number> {
  const prs = new Map<string, number>();
  for (const line of log.split("\n")) {
    const match = line.match(/^Merge pull request #(\d+) from [^/\s]+\/(\S+)/);
    if (match && !prs.has(match[2])) prs.set(match[2], Number(match[1]));
  }
  return prs;
}

/** Cache par dépôt, invalidé quand `.git/HEAD` ou ses références bougent. */
const cache = new Map<string, { stamp: number; info: RepoInfo }>();

async function repoStamp(cwd: string): Promise<number> {
  try {
    const [head, refs] = await Promise.all([
      stat(path.join(cwd, ".git", "HEAD")),
      stat(path.join(cwd, ".git", "refs")),
    ]);
    return Math.max(head.mtimeMs, refs.mtimeMs);
  } catch {
    return -1;
  }
}

async function repoInfo(cwd: string): Promise<RepoInfo> {
  const stamp = await repoStamp(cwd);
  const cached = cache.get(cwd);
  if (cached && cached.stamp === stamp) return cached.info;

  const [remote, merges] = await Promise.all([
    git(cwd, ["remote", "get-url", "origin"]),
    git(cwd, ["log", "--all", "--merges", `-n${MERGE_DEPTH}`, "--pretty=%s"]),
  ]);
  const info = { web: remote ? webUrl(remote) : null, prs: parseMergeSubjects(merges ?? "") };
  cache.set(cwd, { stamp, info });
  return info;
}

/** Ajoute à chaque branche le lien vers sa PR, ou à défaut vers la branche. */
export async function attachBranchLinks(branches: BranchPoint[]): Promise<BranchPoint[]> {
  const paths = [...new Set(branches.map((b) => b.projectPath).filter((p): p is string => !!p))];
  const infos = new Map(await Promise.all(paths.map(async (p) => [p, await repoInfo(p)] as const)));

  return branches.map((branch) => {
    const info = branch.projectPath ? infos.get(branch.projectPath) : undefined;
    if (!info?.web) return branch;
    const pr = info.prs.get(branch.branch) ?? null;
    const url = pr ? `${info.web}/pull/${pr}` : `${info.web}/tree/${encodeURI(branch.branch)}`;
    return { ...branch, link: { url, pr } };
  });
}
