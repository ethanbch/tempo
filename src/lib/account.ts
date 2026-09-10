import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import type { Account } from "./types";

const CONFIG_PATH = process.env.CLAUDE_CONFIG_PATH ?? path.join(homedir(), ".claude.json");

const MISSING_ACCOUNT: Account = {
  email: null,
  accountUuid: null,
  organizationUuid: null,
  plan: null,
  hasExtraUsageEnabled: false,
  subscriptionCreatedAt: null,
  missing: true,
};

/**
 * Traduit le type d'organisation renvoyé par Claude en libellé de plan.
 * `claude_pro` -> « Pro », `claude_max` -> « Max », etc.
 */
function planLabel(organizationType: unknown): string | null {
  if (typeof organizationType !== "string" || organizationType.length === 0) return null;
  const bare = organizationType.replace(/^claude_/, "").replace(/_/g, " ");
  return bare.replace(/\b\w/g, (c) => c.toUpperCase());
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Lit le compte Claude connecté depuis la configuration locale de Claude Code.
 *
 * Rien n'est envoyé sur le réseau : l'« authentification » de ce tableau de bord
 * est la session Claude Code déjà présente sur la machine.
 */
export async function readAccount(): Promise<Account> {
  let raw: string;
  try {
    raw = await readFile(CONFIG_PATH, "utf8");
  } catch {
    return MISSING_ACCOUNT;
  }

  let config: unknown;
  try {
    config = JSON.parse(raw);
  } catch {
    return MISSING_ACCOUNT;
  }

  const oauth = (config as { oauthAccount?: Record<string, unknown> })?.oauthAccount;
  if (!oauth || typeof oauth !== "object") return MISSING_ACCOUNT;

  return {
    email: asString(oauth.emailAddress),
    accountUuid: asString(oauth.accountUuid),
    organizationUuid: asString(oauth.organizationUuid),
    plan: planLabel(oauth.organizationType),
    hasExtraUsageEnabled: oauth.hasExtraUsageEnabled === true,
    subscriptionCreatedAt: asString(oauth.subscriptionCreatedAt),
    missing: false,
  };
}
