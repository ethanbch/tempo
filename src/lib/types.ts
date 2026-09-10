import type { CostBreakdown, Speed, TokenCounts } from "./pricing";

/** Une requête API unitaire, extraite d'un message assistant du transcript. */
export interface UsageEvent extends TokenCounts {
  /** Identifiant de la ligne dans le transcript. */
  uuid: string;
  /**
   * Identifiant du message API. C'est la clé de facturation : une réponse
   * s'étale sur plusieurs lignes du transcript qui répètent toutes le même
   * `usage`, et une session reprise peut la réécrire dans un autre fichier.
   */
  requestKey: string;
  /** Horodatage ISO 8601 de la réponse. */
  timestamp: string;
  /** Même valeur en millisecondes, pour éviter de reparser à chaque agrégation. */
  time: number;
  model: string;
  /** Tokens de raisonnement, sous-ensemble de `outputTokens`. */
  thinkingTokens: number;
  webSearchRequests: number;
  webFetchRequests: number;
  speed: Speed;
  serviceTier: string;
  effort: string | null;
  sessionId: string;
  /** Clé du projet, dérivée du répertoire de travail. */
  projectId: string;
  projectName: string;
  gitBranch: string | null;
  /** Vrai quand la requête vient d'un sous-agent plutôt que de la boucle principale. */
  isSidechain: boolean;
  cost: CostBreakdown;
}

/** Un prompt utilisateur, pour compter les tours réellement initiés. */
export interface PromptEvent {
  uuid: string;
  time: number;
  sessionId: string;
  projectId: string;
}

/** Résultat brut d'un scan du répertoire de transcripts. */
export interface ScanResult {
  events: UsageEvent[];
  prompts: PromptEvent[];
  /** Coûts de session faisant autorité, un par session rencontrée. */
  sessionCosts: SessionCost[];
  /** Nombre de fichiers de transcript lus. */
  fileCount: number;
  /** Octets lus, pour afficher le volume traité. */
  byteCount: number;
  /** Lignes ignorées faute d'être du JSON valide. */
  skippedLines: number;
  scannedAt: number;
  /** Répertoire effectivement scanné. */
  root: string;
}

/** Compte Claude détecté localement, tel qu'affiché dans l'en-tête. */
export interface Account {
  email: string | null;
  accountUuid: string | null;
  organizationUuid: string | null;
  /** Libellé du plan, par exemple « Pro » ou « Max ». */
  plan: string | null;
  hasExtraUsageEnabled: boolean;
  subscriptionCreatedAt: string | null;
  /** Vrai si aucune information de compte n'a pu être lue. */
  missing: boolean;
}

/**
 * Coût de session tel que Claude Code le calcule lui-même.
 *
 * Fait autorité : il inclut des appels facturés que le transcript n'enregistre
 * pas comme messages assistant (génération de titre, compaction, utilitaires).
 */
export interface SessionCost {
  sessionId: string;
  projectId: string;
  totalCostUSD: number;
  /** Coût par identifiant de modèle brut, tel qu'écrit par Claude Code. */
  byModel: Record<string, number>;
  /** Durée cumulée passée à attendre l'API, en millisecondes. */
  apiDurationMs: number;
  linesAdded: number;
  linesRemoved: number;
  /** Vrai si Claude Code a rencontré un modèle dont il ignore le tarif. */
  hasUnknownModelCost: boolean;
}
