import type { Messages } from "./fr";

export const en: Messages = {
  meta: {
    title: "Tempo — Claude usage",
    description:
      "Local tracking of your Claude Code usage: API-equivalent cost, tokens, cache, quota windows.",
  },

  units: {
    thousand: "k",
    million: "M",
    billion: "B",
    kilobytes: "KB",
    megabytes: "MB",
    usd: (amount) => `$${amount}`,
    milliseconds: (value) => `${value} ms`,
    seconds: (value) => `${value}s`,
    minutes: (value) => `${value} min`,
    hoursMinutes: (hours, minutes) => `${hours}h ${minutes}m`,
    daysHours: (days, hours) => `${days}d ${hours}h`,
    hourOfDay: (hour) => `${hour}:00`,
    justNow: "just now",
  },

  common: {
    cost: "Cost",
    requests: "Requests",
    sessions: "Sessions",
    input: "Input",
    output: "Output",
    cacheWrite: "Cache write",
    cacheRead: "Cache read",
    reasoning: "Reasoning",
    duration: "Duration",
    lastActivity: "Last activity",
    value: "Value",
    project: "Project",
    total: "Total",
    day: "Day",
    noData: "No data for this period.",
    unknownError: "unknown error",
    httpStatus: (status) => `status ${status}`,
  },

  header: {
    tagline: "Your Claude Code usage, read from the transcripts on your machine.",
    noAccount: "No Claude account detected",
    account: "Claude account",
    plan: (plan) => `Claude ${plan}`,
    active: (ago) => `active ${ago}`,
    language: "Language",
  },

  theme: {
    light: "Light theme",
    dark: "Dark theme",
    system: "System theme",
    change: (current) => `${current}, change theme`,
  },

  filters: {
    ranges: { "24h": "24 hours", "7d": "7 days", "30d": "30 days", all: "All" },
    period: "Period",
    allProjects: "All projects",
    allModels: "All models",
    byProject: "Filter by project",
    byModel: "Filter by model",
    showTable: "Show table",
    hideTable: "Hide table",
    reloadFailed: (error) => `Couldn't reload: ${error}`,
  },

  stats: {
    cost: "API-equivalent cost",
    costHint: "what this usage would have cost on the API",
    costHintPlan: (plan) => `what this usage would have cost on the API, outside your ${plan} plan`,
    requestsHint: (prompts, sessions, count) =>
      `${prompts} prompts · ${sessions} ${count === 1 ? "session" : "sessions"}`,
    tokens: "Tokens",
    tokensHint: (output, thinking) => `${output} output · ${thinking} reasoning`,
    cache: "Served from cache",
    cacheHint: (tokens) => `${tokens} tokens re-read`,
  },

  cards: {
    daily: {
      title: "Cost per day",
      subtitle: "Broken down by item: input, cache write and read, output.",
    },
    quota: {
      title: "5-hour windows",
      subtitle: "Claude's quota recharges on a rolling window opened by the first request.",
    },
    byModel: { title: "By model", subtitle: "API-equivalent cost over the period." },
    byProject: { title: "By project", subtitle: "The eight most expensive projects." },
    sessions: {
      title: "Sessions",
      subtitle: "The eight most expensive sessions. Click for details.",
    },
    heatmap: {
      title: "When you use Claude",
      subtitle: "Requests by weekday and hour, in your local time zone.",
    },
    levers: {
      title: "Optimization levers",
      subtitle: "What your own requests reveal, ranked by what there is to gain.",
    },
    cacheCauses: {
      title: "Cache writes, by cause",
      subtitle: "Re-saving context costs money: here's what triggered it.",
      empty: "No cache writes in this period.",
    },
    effort: {
      title: "By effort level",
      subtitle: "Spend and reasoning share, from lightest to most intensive.",
      empty: "No effort level recorded in this period.",
    },
    table: { title: "Daily breakdown", subtitle: "Every value from the charts, in plain text." },
  },

  captions: {
    requests: (requests) => `${requests} requests`,
    requestsTokens: (requests, tokens) => `${requests} req · ${tokens} tokens`,
    requestsReasoning: (requests, share) => `${requests} req · ${share} reasoning`,
    sessionsRequests: (sessions, requests, count) =>
      `${sessions} ${count === 1 ? "session" : "sessions"} · ${requests} req`,
    requestsDuration: (requests, duration) => `${requests} req · ${duration}`,
    contextRewritten: "Context rewritten",
  },

  causes: {
    "session-start": "Session start",
    "context-growth": "Context growth",
    "idle-timeout": "Resume after a pause",
    "model-switch": "Model switch",
    "effort-switch": "Effort switch",
  },

  effortUnspecified: "unspecified",

  tabs: {
    label: "Sections",
    overview: "Overview",
    spend: "Spend",
    activity: "Activity",
    optimize: "Optimize",
  },

  overview: {
    costLabel: (period) => `API-equivalent · ${period}`,
    teaser: (count, amount) =>
      `${count} optimization lever${count > 1 ? "s" : ""} · ${amount} of avoidable overspend`,
    teaserTradeoffs: (count) => `${count} trade-off${count > 1 ? "s" : ""} to consider`,
    nothing: "Nothing to optimize in this period",
    see: "View",
    limitsDetail: "Details",
    dailyMax: (value) => `max ${value}`,
    vsPrevious: "vs previous period",
    noPrevious: "no activity in the previous period",
    avgPerDay: "Average per active day",
    peakDay: "Most expensive day",
  },

  method: {
    open: "How it's computed",
    title: "How it's computed",
    info: "Explanation",
  },

  limits: {
    title: "Usage limits",
    subtitle:
      "Read from the Claude Code statusline. The estimated cap divides the cost of this machine's Claude Code requests by the percentage used: usage on claude.ai or elsewhere also counts toward the limit, in which case the real cap is higher.",
    setup: "Session and weekly gauges appear once Tempo's statusline is installed. From the Tempo folder:",
    session: "Session (5 hours)",
    week: "Week",
    noReading: "No reading yet.",
    meterLabel: (title) => `${title}: share used`,
    expired: "Reset since the last reading",
    unknownReset: "Reset time unknown",
    sessionReset: (time, remaining) => `Resets at ${time} · in ${remaining}`,
    weekReset: (remaining, date) => `Resets in ${remaining} · ${date}`,
    hitsAt: (when) => `At this pace, limit reached around ${when}`,
    idleSession: "No usage in the last hour",
    idleWeek: "No usage in the last 24 hours",
    atReset: (share) => `At this pace, ≈ ${share} at reset`,
    capSession: (perPercent, full, windows) =>
      `1% ≈ ${perPercent} · full session ≈ ${full} API-equivalent, from ${windows} ${
        windows > 1 ? "sessions" : "session"
      }`,
    capWeek: (perPercent, full, windows) =>
      `1% ≈ ${perPercent} · full week ≈ ${full} API-equivalent, from ${windows} ${
        windows > 1 ? "weeks" : "week"
      }`,
    noCap: "Estimated cap: not enough data yet",
    lastReading: (ago, count) => `Last reading ${ago} · ${count} readings in history`,
  },

  quota: {
    empty: "No activity window in this period.",
    current: "Current window",
    openFor: (elapsed, remaining) => `open for ${elapsed} · ${remaining} left`,
    volume: (requests, tokens) => `${requests} requests · ${tokens} tokens`,
    meterLabel: "Weight of the current window, compared with the busiest one",
    ofPeak: (share, peak) => `${share} of your busiest window (${peak})`,
    none: (duration) =>
      `No window open. The next request will start a new one, valid for ${duration}.`,
  },

  levers: {
    empty: "Nothing to optimize in this period — that's a valid conclusion, not a gap.",
    freeTitle: "Free wins",
    freeNote: (total) => `${total} of overspend identified, with no loss of quality`,
    tradeoffTitle: "Trade-offs",
    tradeoffNote: "they trade cost for intelligence — to decide on, not to apply blindly",
    avoidable: "avoidable overspend",
    involved: "spend involved",
    ofTotal: (share) => `${share} of total`,
    idleTimeout: {
      title: "Context repaid after a pause",
      finding: (requests, tokens, cost) =>
        `${requests} resume${requests > 1 ? "s" : ""} after a pause rewrote ${tokens} tokens of context, for ${cost}.`,
      action:
        "A cache entry expires after an hour of inactivity. Resuming a long session after a break repays its entire context at full price. Better to chain the turns of one task, and start a fresh session rather than wake up an already heavy one.",
    },
    cacheInvalidation: {
      title: "Cache invalidated mid-session",
      finding: (cost, causes) => `${cost} of context rewritten after: ${causes}.`,
      action:
        "Switching model or effort level mid-session invalidates the cache and repays the entire history. Better to set both at the start of a session, or switch when opening a new one.",
    },
    longContext: {
      title: "Context past the comfort threshold",
      finding: (requests, threshold, cost, peak) =>
        `${requests} requests re-read more than ${threshold} tokens of context. Re-reading what's past that threshold cost ${cost}. Peak observed: ${peak} tokens in one request.`,
      action: (threshold) =>
        `Every turn resends the whole history: a session's cost grows roughly as the square of the number of turns. Compacting the context, or splitting the work into focused sessions, breaks that curve. The amount shown is what systematic compaction at ${threshold} tokens would have avoided — the context below that threshold is the work itself.`,
    },
    sidechains: {
      title: "Sub-agent cost",
      finding: (cost) => `${cost} spent by sub-agents.`,
      action:
        "A sub-agent starts with its own context: useful to isolate a large search from the main conversation, costly if the task fit in the current thread.",
    },
    effort: {
      title: "Effort level",
      finding: (cost, share) =>
        `${cost} spent at high effort. Reasoning takes up ${share} of output tokens.`,
      action:
        "Effort is the first lever that trades cost for thinking. Coding and long tasks make it pay off; short questions and routine work often hold up at lower effort. Set it per type of task, not globally.",
    },
    modelMix: {
      title: "Model mix",
      finding: (model, share, requests) =>
        `${model} accounts for ${share} of spend, over ${requests} requests.`,
      action:
        "A pricier model that finishes in fewer turns is still the cheapest option: what matters is the cost per completed task, not per token. Switching is judged task by task, by checking whether the result holds up.",
    },
  },

  session: {
    title: "Session details",
    close: "Close",
    loading: "Loading…",
    loadFailed: (error) => `Couldn't load: ${error}`,
    effort: (effort) => `effort ${effort}`,
    output: (tokens) => `${tokens} output`,
    reread: (tokens) => `${tokens} re-read`,
    cacheRewritten: (cause) => `cache rewritten: ${cause}`,
  },

  table: {
    caption: "Usage per day: requests, tokens by type and API-equivalent cost",
  },

  charts: {
    stackedAria: "API-equivalent cost per day, broken down by item",
    noRequests: "No requests in this period.",
    noRequest: "No requests",
    rankedAria: "Ranking by value",
    heatmapAria: "Requests by weekday and hour",
    heatmapEmpty: "No activity to spread over this period.",
    less: "less",
    more: (max) => `more · up to ${max} requests`,
  },

  footer: {
    readTitle: "How to read the cost.",
    read: "A Claude Pro or Max subscription isn't billed per token: the amount shown is what the same usage would have cost on the API, at public rates. It measures value consumed, not an actual bill.",
    computeTitle: "How the cost is computed.",
    compute: (raw, untracked, share) =>
      `The ${raw} of requests visible in transcripts are calibrated session by session against the records Claude Code writes when a session ends, which adds ${untracked} of calls it doesn't log — title generation, context compaction, utility tasks. ${share} of the total shown is calibrated this way.`,
    uncalibrated: (sessions) =>
      ` ${sessions} session(s) still open have no record yet: their cost is a floor, slightly underestimated.`,
    unknownModel: " At least one session uses a model whose price Claude Code doesn't know.",
    files: (count, size) => `${count} transcripts · ${size} read from`,
    skipped: (lines) => ` · ${lines} unreadable lines skipped`,
    since: (date) => ` · history since ${date}`,
    scanned: (date) => ` · scanned ${date}`,
    activeDays: (days) => ` · ${days} active days`,
    privacy: (window) =>
      `No data leaves your machine: the app reads local files and calls no remote service. The limit gauges come from the readings saved by the Claude Code statusline. Length of a quota window: ${window}.`,
  },

  noTranscripts: {
    title: "No transcripts found",
    body: "Tempo reads Claude Code usage from local transcripts, expected in",
    empty: "This directory is empty or missing.",
    runSession: "Run at least one Claude Code session on this machine.",
    pointElsewhere: "Or point Tempo elsewhere with the environment variable",
  },
};
