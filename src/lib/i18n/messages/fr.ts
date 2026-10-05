/**
 * Textes de l'interface en français : la référence dont les autres langues
 * reprennent la forme exacte (`Messages`).
 *
 * Les textes qui embarquent des valeurs sont des fonctions ; les valeurs leur
 * arrivent déjà formatées, pour que chaque langue n'ait qu'à placer les mots.
 */
export const fr = {
  meta: {
    title: "Tempo — usage Claude",
    description:
      "Suivi local de ton usage de Claude Code : coût équivalent API, tokens, cache, fenêtres de quota.",
  },

  units: {
    thousand: "k",
    million: "M",
    billion: "Md",
    kilobytes: "ko",
    megabytes: "Mo",
    usd: (amount: string) => `${amount} $`,
    milliseconds: (value: string) => `${value} ms`,
    seconds: (value: string) => `${value} s`,
    minutes: (value: string) => `${value} min`,
    hoursMinutes: (hours: string, minutes: string) => `${hours} h ${minutes}`,
    daysHours: (days: string, hours: string) => `${days} j ${hours} h`,
    hourOfDay: (hour: string) => `${hour} h`,
    justNow: "à l'instant",
  },

  common: {
    cost: "Coût",
    requests: "Requêtes",
    sessions: "Sessions",
    input: "Entrée",
    output: "Sortie",
    cacheWrite: "Écriture cache",
    cacheRead: "Lecture cache",
    reasoning: "Raisonnement",
    duration: "Durée",
    lastActivity: "Dernière activité",
    value: "Valeur",
    project: "Projet",
    total: "Total",
    day: "Jour",
    noData: "Aucune donnée sur cette période.",
    unknownError: "erreur inconnue",
    httpStatus: (status: number) => `réponse ${status}`,
  },

  header: {
    tagline: "Ton usage de Claude Code, lu depuis les transcripts de ta machine.",
    noAccount: "Aucun compte Claude détecté",
    account: "Compte Claude",
    plan: (plan: string) => `Claude ${plan}`,
    active: (ago: string) => `actif ${ago}`,
    language: "Langue",
  },

  theme: {
    light: "Thème clair",
    dark: "Thème sombre",
    system: "Thème du système",
    change: (current: string) => `${current}, changer de thème`,
  },

  filters: {
    ranges: { "24h": "24 heures", "7d": "7 jours", "30d": "30 jours", all: "Tout" },
    period: "Période",
    allProjects: "Tous les projets",
    allModels: "Tous les modèles",
    byProject: "Filtrer par projet",
    byModel: "Filtrer par modèle",
    showTable: "Voir le tableau",
    hideTable: "Masquer le tableau",
    reloadFailed: (error: string) => `Rechargement impossible : ${error}`,
  },

  stats: {
    cost: "Coût équivalent API",
    costHint: "ce que cet usage aurait coûté à l'API",
    costHintPlan: (plan: string) => `ce que cet usage aurait coûté à l'API, hors abonnement ${plan}`,
    requestsHint: (prompts: string, sessions: string, count: number) =>
      `${prompts} prompts · ${sessions} ${count === 1 ? "session" : "sessions"}`,
    tokens: "Tokens",
    tokensHint: (output: string, thinking: string) =>
      `${output} en sortie · ${thinking} de raisonnement`,
    cache: "Servi par le cache",
    cacheHint: (tokens: string) => `${tokens} tokens relus`,
  },

  cards: {
    daily: {
      title: "Coût par jour",
      subtitle: "Ventilé par poste : entrée, écriture et lecture de cache, sortie.",
    },
    quota: {
      title: "Fenêtres de 5 heures",
      subtitle: "Le quota Claude se recharge par fenêtre glissante ouverte à la première requête.",
    },
    byModel: { title: "Par modèle", subtitle: "Coût équivalent API sur la période." },
    byProject: { title: "Par projet", subtitle: "Les huit projets les plus coûteux." },
    sessions: {
      title: "Sessions",
      subtitle: "Les huit sessions les plus coûteuses. Cliquer pour le détail.",
    },
    heatmap: {
      title: "Quand tu utilises Claude",
      subtitle: "Requêtes par jour de la semaine et par heure, sur ton fuseau local.",
    },
    levers: {
      title: "Leviers d'optimisation",
      subtitle: "Ce que tes propres requêtes révèlent, classé par ce qu'il y a à gagner.",
    },
    cacheCauses: {
      title: "Écritures de cache, par cause",
      subtitle: "Réenregistrer du contexte se paie : voici ce qui l'a déclenché.",
      empty: "Aucune écriture de cache sur cette période.",
    },
    effort: {
      title: "Par niveau d'effort",
      subtitle: "Dépense et part du raisonnement, du plus léger au plus soutenu.",
      empty: "Aucun niveau d'effort renseigné sur cette période.",
    },
    table: { title: "Détail par jour", subtitle: "Toutes les valeurs des graphiques, en clair." },
  },

  captions: {
    requests: (requests: string) => `${requests} requêtes`,
    requestsTokens: (requests: string, tokens: string) => `${requests} req · ${tokens} tokens`,
    requestsReasoning: (requests: string, share: string) =>
      `${requests} req · ${share} raisonnement`,
    sessionsRequests: (sessions: string, requests: string, count: number) =>
      `${sessions} ${count === 1 ? "session" : "sessions"} · ${requests} req`,
    requestsDuration: (requests: string, duration: string) => `${requests} req · ${duration}`,
    contextRewritten: "Contexte réécrit",
  },

  causes: {
    "session-start": "Ouverture de session",
    "context-growth": "Croissance du contexte",
    "idle-timeout": "Reprise après pause",
    "model-switch": "Changement de modèle",
    "effort-switch": "Changement d'effort",
  },

  effortUnspecified: "non précisé",

  limits: {
    title: "Limites d'usage",
    subtitle:
      "Relevées par la statusline Claude Code. Le plafond estimé rapporte le coût des requêtes Claude Code de cette machine au pourcentage consommé : l'usage sur claude.ai ou ailleurs compte aussi dans la limite, le plafond réel est alors plus haut.",
    setup: "Les jauges de session et de semaine s'affichent une fois la statusline de Tempo installée. Depuis le dossier de Tempo :",
    session: "Session (5 heures)",
    week: "Semaine",
    noReading: "Pas encore de relevé.",
    meterLabel: (title: string) => `${title} : part consommée`,
    expired: "Réinitialisée depuis le dernier relevé",
    unknownReset: "Échéance inconnue",
    sessionReset: (time: string, remaining: string) =>
      `Réinitialisation à ${time} · dans ${remaining}`,
    weekReset: (remaining: string, date: string) => `Réinitialisation dans ${remaining} · ${date}`,
    hitsAt: (when: string) => `À ce rythme, limite atteinte vers ${when}`,
    idleSession: "Aucune consommation sur la dernière heure",
    idleWeek: "Aucune consommation sur les dernières 24 h",
    atReset: (share: string) => `À ce rythme, ≈ ${share} à la réinitialisation`,
    capSession: (perPercent: string, full: string, windows: number) =>
      `1 % ≈ ${perPercent} · session complète ≈ ${full} en équivalent API, d'après ${windows} ${
        windows > 1 ? "sessions" : "session"
      }`,
    capWeek: (perPercent: string, full: string, windows: number) =>
      `1 % ≈ ${perPercent} · semaine complète ≈ ${full} en équivalent API, d'après ${windows} ${
        windows > 1 ? "semaines" : "semaine"
      }`,
    noCap: "Plafond estimé : pas encore assez de données",
    lastReading: (ago: string, count: string) =>
      `Dernier relevé ${ago} · ${count} relevés en historique`,
  },

  quota: {
    empty: "Aucune fenêtre d'activité sur cette période.",
    current: "Fenêtre en cours",
    openFor: (elapsed: string, remaining: string) =>
      `ouverte ${elapsed} · il reste ${remaining}`,
    volume: (requests: string, tokens: string) => `${requests} requêtes · ${tokens} tokens`,
    meterLabel: "Poids de la fenêtre en cours, comparé à la fenêtre la plus chargée",
    ofPeak: (share: string, peak: string) => `${share} de ta fenêtre la plus chargée (${peak})`,
    none: (duration: string) =>
      `Aucune fenêtre ouverte. La prochaine requête en démarrera une nouvelle, valable ${duration}.`,
  },

  levers: {
    empty: "Rien à optimiser sur cette période — c'est une conclusion valable, pas un manque.",
    freeTitle: "Gains sans contrepartie",
    freeNote: (total: string) => `${total} de surcoût identifié, sans perte de qualité`,
    tradeoffTitle: "Arbitrages",
    tradeoffNote:
      "ils échangent du coût contre de l'intelligence — à décider, pas à appliquer d'office",
    avoidable: "surcoût évitable",
    involved: "dépense concernée",
    ofTotal: (share: string) => `${share} du total`,
    idleTimeout: {
      title: "Contexte repayé après une pause",
      finding: (requests: number, tokens: string, cost: string) =>
        `${requests} reprise${requests > 1 ? "s" : ""} après une pause ont réécrit ${tokens} tokens de contexte, pour ${cost}.`,
      action:
        "Une entrée de cache expire après une heure d'inactivité. Reprendre une session longue après une pause fait repayer tout son contexte au prix fort. Mieux vaut enchaîner les tours d'une même tâche, et repartir d'une session neuve plutôt que réveiller une session déjà lourde.",
    },
    cacheInvalidation: {
      title: "Cache invalidé en cours de session",
      finding: (cost: string, causes: string) => `${cost} de contexte réécrit après : ${causes}.`,
      action:
        "Changer de modèle ou de niveau d'effort au milieu d'une session invalide le cache et fait repayer l'historique entier. Autant fixer les deux en début de session, ou changer au moment d'en ouvrir une nouvelle.",
    },
    longContext: {
      title: "Contexte au-delà du seuil de confort",
      finding: (requests: number, threshold: string, cost: string, peak: string) =>
        `${requests} requêtes ont relu plus de ${threshold} tokens de contexte. Relire ce qui dépasse ce seuil a coûté ${cost}. Pic observé : ${peak} tokens en une requête.`,
      action: (threshold: string) =>
        `Chaque tour renvoie tout l'historique : le coût d'une session croît à peu près comme le carré du nombre de tours. Compacter le contexte, ou découper en plusieurs sessions ciblées, casse cette courbe. Le montant indiqué est ce qu'aurait évité un compactage systématique à ${threshold} tokens — le contexte sous ce seuil, lui, est le travail lui-même.`,
    },
    sidechains: {
      title: "Coût des sous-agents",
      finding: (cost: string) => `${cost} dépensés par des sous-agents.`,
      action:
        "Un sous-agent part avec son propre contexte : utile pour isoler une recherche volumineuse de la conversation principale, coûteux si la tâche tenait dans le fil courant.",
    },
    effort: {
      title: "Niveau d'effort",
      finding: (cost: string, share: string) =>
        `${cost} de dépense à effort élevé. Le raisonnement occupe ${share} des tokens de sortie.`,
      action:
        "L'effort est le premier levier qui échange du coût contre de la réflexion. Le codage et les tâches longues le rentabilisent ; les questions courtes et le travail routinier tiennent souvent à effort réduit. À régler par type de tâche, pas globalement.",
    },
    modelMix: {
      title: "Répartition entre modèles",
      finding: (model: string, share: string, requests: string) =>
        `${model} concentre ${share} de la dépense, sur ${requests} requêtes.`,
      action:
        "Un modèle plus cher qui finit en moins de tours reste l'option la moins chère : ce qui compte est le coût par tâche menée à bout, pas par token. Le basculement se juge tâche par tâche, en observant si le résultat tient.",
    },
  },

  session: {
    title: "Détail de la session",
    close: "Fermer",
    loading: "Chargement…",
    loadFailed: (error: string) => `Chargement impossible : ${error}`,
    effort: (effort: string) => `effort ${effort}`,
    output: (tokens: string) => `${tokens} sortie`,
    reread: (tokens: string) => `${tokens} relus`,
    cacheRewritten: (cause: string) => `cache réécrit : ${cause}`,
  },

  table: {
    caption: "Usage par jour : requêtes, tokens par type et coût équivalent API",
  },

  charts: {
    stackedAria: "Coût équivalent API par jour, ventilé par poste de dépense",
    noRequests: "Aucune requête sur cette période.",
    noRequest: "Aucune requête",
    rankedAria: "Classement par valeur",
    heatmapAria: "Requêtes par jour de la semaine et par heure",
    heatmapEmpty: "Aucune activité à répartir sur cette période.",
    less: "moins",
    more: (max: string) => `plus · jusqu'à ${max} requêtes`,
  },

  footer: {
    readTitle: "Comment lire le coût.",
    read: "Un abonnement Claude Pro ou Max n'est pas facturé au token : le montant affiché est ce que le même usage aurait coûté à l'API, tarifs publics à l'appui. Il mesure la valeur consommée, pas une dépense réelle.",
    computeTitle: "Comment le coût est calculé.",
    compute: (raw: string, untracked: string, share: string) =>
      `Les ${raw} de requêtes visibles dans les transcripts sont calibrés session par session sur les relevés que Claude Code écrit en fin de session, ce qui ajoute ${untracked} d'appels qu'il ne journalise pas — génération de titres, compaction de contexte, tâches utilitaires. ${share} du total affiché est ainsi calibré.`,
    uncalibrated: (sessions: string) =>
      ` ${sessions} session(s) encore ouverte(s) n'ont pas de relevé : leur coût est un plancher, légèrement sous-estimé.`,
    unknownModel: " Une session au moins porte un modèle dont Claude Code ignore le tarif.",
    files: (count: string, size: string) => `${count} transcripts · ${size} lus depuis`,
    skipped: (lines: string) => ` · ${lines} lignes illisibles ignorées`,
    since: (date: string) => ` · historique depuis le ${date}`,
    scanned: (date: string) => ` · scan du ${date}`,
    activeDays: (days: string) => ` · ${days} jours actifs`,
    privacy: (window: string) =>
      `Aucune donnée ne quitte ta machine : l'application lit les fichiers locaux et n'appelle aucun service distant. Les jauges de limite viennent du relevé déposé par la statusline de Claude Code. Durée d'une fenêtre de quota : ${window}.`,
  },

  noTranscripts: {
    title: "Aucun transcript trouvé",
    body: "Tempo lit l'usage de Claude Code depuis les transcripts locaux, attendus dans",
    empty: "Ce répertoire est vide ou introuvable.",
    runSession: "Lance au moins une session Claude Code sur cette machine.",
    pointElsewhere: "Ou pointe Tempo ailleurs avec la variable d'environnement",
  },
};

/**
 * Forme commune à toutes les langues : chaque clé, et la signature de chaque
 * fonction, doit exister à l'identique dans chaque traduction.
 */
export type Messages = typeof fr;
