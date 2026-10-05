import type { Messages } from "./fr";

export const de: Messages = {
  meta: {
    title: "Tempo — Claude-Nutzung",
    description:
      "Lokale Übersicht deiner Claude-Code-Nutzung: API-Gegenwert, Tokens, Cache, Kontingentfenster.",
  },

  units: {
    thousand: "Tsd.",
    million: "Mio.",
    billion: "Mrd.",
    kilobytes: "KB",
    megabytes: "MB",
    usd: (amount) => `${amount} $`,
    milliseconds: (value) => `${value} ms`,
    seconds: (value) => `${value} s`,
    minutes: (value) => `${value} Min.`,
    hoursMinutes: (hours, minutes) => `${hours} Std. ${minutes} Min.`,
    daysHours: (days, hours) => `${days} T. ${hours} Std.`,
    hourOfDay: (hour) => `${hour} Uhr`,
    justNow: "gerade eben",
  },

  common: {
    cost: "Kosten",
    requests: "Anfragen",
    sessions: "Sitzungen",
    input: "Eingabe",
    output: "Ausgabe",
    cacheWrite: "Cache-Schreiben",
    cacheRead: "Cache-Lesen",
    reasoning: "Reasoning",
    duration: "Dauer",
    lastActivity: "Letzte Aktivität",
    value: "Wert",
    project: "Projekt",
    total: "Gesamt",
    day: "Tag",
    noData: "Keine Daten in diesem Zeitraum.",
    unknownError: "unbekannter Fehler",
    httpStatus: (status) => `Antwort ${status}`,
  },

  header: {
    tagline: "Deine Claude-Code-Nutzung, gelesen aus den Transkripten auf deinem Rechner.",
    noAccount: "Kein Claude-Konto erkannt",
    account: "Claude-Konto",
    plan: (plan) => `Claude ${plan}`,
    active: (ago) => `aktiv ${ago}`,
    language: "Sprache",
  },

  theme: {
    light: "Helles Design",
    dark: "Dunkles Design",
    system: "Systemdesign",
    change: (current) => `${current}, Design wechseln`,
  },

  filters: {
    ranges: { "24h": "24 Stunden", "7d": "7 Tage", "30d": "30 Tage", all: "Alles" },
    period: "Zeitraum",
    allProjects: "Alle Projekte",
    allModels: "Alle Modelle",
    byProject: "Nach Projekt filtern",
    byModel: "Nach Modell filtern",
    showTable: "Tabelle anzeigen",
    hideTable: "Tabelle ausblenden",
    reloadFailed: (error) => `Neu laden fehlgeschlagen: ${error}`,
  },

  stats: {
    cost: "API-Gegenwert",
    costHint: "was diese Nutzung über die API gekostet hätte",
    costHintPlan: (plan) => `was diese Nutzung über die API gekostet hätte, außerhalb des ${plan}-Abos`,
    requestsHint: (prompts, sessions, count) =>
      `${prompts} Prompts · ${sessions} ${count === 1 ? "Sitzung" : "Sitzungen"}`,
    tokens: "Tokens",
    tokensHint: (output, thinking) => `${output} Ausgabe · ${thinking} Reasoning`,
    cache: "Aus dem Cache bedient",
    cacheHint: (tokens) => `${tokens} Tokens erneut gelesen`,
  },

  cards: {
    daily: {
      title: "Kosten pro Tag",
      subtitle: "Aufgeschlüsselt nach Posten: Eingabe, Cache-Schreiben und -Lesen, Ausgabe.",
    },
    quota: {
      title: "5-Stunden-Fenster",
      subtitle: "Das Claude-Kontingent lädt sich in einem gleitenden Fenster auf, das die erste Anfrage öffnet.",
    },
    byModel: { title: "Nach Modell", subtitle: "API-Gegenwert im Zeitraum." },
    byProject: { title: "Nach Projekt", subtitle: "Die acht teuersten Projekte." },
    sessions: {
      title: "Sitzungen",
      subtitle: "Die acht teuersten Sitzungen. Für Details anklicken.",
    },
    heatmap: {
      title: "Wann du Claude nutzt",
      subtitle: "Anfragen nach Wochentag und Uhrzeit, in deiner lokalen Zeitzone.",
    },
    levers: {
      title: "Optimierungshebel",
      subtitle: "Was deine eigenen Anfragen zeigen, sortiert nach dem möglichen Gewinn.",
    },
    cacheCauses: {
      title: "Cache-Schreibvorgänge nach Ursache",
      subtitle: "Kontext erneut zu speichern kostet Geld: Das hat es ausgelöst.",
      empty: "Keine Cache-Schreibvorgänge in diesem Zeitraum.",
    },
    effort: {
      title: "Nach Effort-Stufe",
      subtitle: "Ausgaben und Reasoning-Anteil, von der leichtesten zur intensivsten Stufe.",
      empty: "Keine Effort-Stufe in diesem Zeitraum erfasst.",
    },
    table: { title: "Tagesübersicht", subtitle: "Alle Werte der Diagramme im Klartext." },
    branches: {
      title: "Nach Branch",
      subtitle:
        "Kosten der Arbeits-Branches, ohne main und master. Der Link öffnet den PR, wenn die lokale Git-Historie ihn findet (Merge-Commit), sonst den Branch. Kein Netzwerkaufruf.",
      empty: "Kein Arbeits-Branch in diesem Zeitraum.",
    },
  },

  captions: {
    requests: (requests) => `${requests} Anfragen`,
    requestsTokens: (requests, tokens) => `${requests} Anfr. · ${tokens} Tokens`,
    requestsReasoning: (requests, share) => `${requests} Anfr. · ${share} Reasoning`,
    sessionsRequests: (sessions, requests, count) =>
      `${sessions} ${count === 1 ? "Sitzung" : "Sitzungen"} · ${requests} Anfr.`,
    requestsDuration: (requests, duration) => `${requests} Anfr. · ${duration}`,
    contextRewritten: "Neu geschriebener Kontext",
    branch: (project, sessions, pr) =>
      `${project}${pr ? ` · PR #${pr}` : ""} · ${sessions} ${sessions > 1 ? "Sitzungen" : "Sitzung"}`,
  },

  causes: {
    "session-start": "Sitzungsbeginn",
    "context-growth": "Wachsender Kontext",
    "idle-timeout": "Fortsetzung nach Pause",
    "model-switch": "Modellwechsel",
    "effort-switch": "Effort-Wechsel",
  },

  effortUnspecified: "nicht angegeben",

  tabs: {
    label: "Bereiche",
    overview: "Übersicht",
    spend: "Ausgaben",
    activity: "Aktivität",
    optimize: "Optimierung",
  },

  overview: {
    costLabel: (period) => `API-Gegenwert · ${period}`,
    teaser: (count, amount) =>
      `${count} Optimierungshebel · ${amount} vermeidbare Mehrkosten`,
    teaserTradeoffs: (count) => `${count} Abwägung${count > 1 ? "en" : ""} zu prüfen`,
    nothing: "In diesem Zeitraum gibt es nichts zu optimieren",
    see: "Ansehen",
    limitsDetail: "Details",
    dailyMax: (value) => `max. ${value}`,
    vsPrevious: "ggü. Vorperiode",
    noPrevious: "keine Aktivität in der Vorperiode",
    avgPerDay: "Schnitt pro aktivem Tag",
    peakDay: "Teuerster Tag",
  },

  shortcuts: {
    hint: "Tastenkürzel: 1–4 Tabs · t Design · / Projekt",
  },

  method: {
    open: "So wird gerechnet",
    title: "So wird gerechnet",
    info: "Erklärung",
  },

  limits: {
    title: "Nutzungslimits",
    subtitle:
      "Erfasst über die Claude-Code-Statuszeile. Die geschätzte Obergrenze teilt die Kosten der Claude-Code-Anfragen dieses Rechners durch den verbrauchten Prozentsatz: Nutzung auf claude.ai oder anderswo zählt ebenfalls zum Limit, die tatsächliche Obergrenze liegt dann höher.",
    setup: "Die Anzeigen für Sitzung und Woche erscheinen, sobald die Statuszeile von Tempo installiert ist. Im Tempo-Ordner:",
    session: "Sitzung (5 Stunden)",
    week: "Woche",
    noReading: "Noch keine Messung.",
    meterLabel: (title) => `${title}: verbrauchter Anteil`,
    expired: "Seit der letzten Messung zurückgesetzt",
    unknownReset: "Zurücksetzung unbekannt",
    sessionReset: (time, remaining) => `Zurücksetzung um ${time} · in ${remaining}`,
    weekReset: (remaining, date) => `Zurücksetzung in ${remaining} · ${date}`,
    hitsAt: (when) => `In diesem Tempo ist das Limit gegen ${when} erreicht`,
    idleSession: "Kein Verbrauch in der letzten Stunde",
    idleWeek: "Kein Verbrauch in den letzten 24 Std.",
    atReset: (share) => `In diesem Tempo ≈ ${share} bei der Zurücksetzung`,
    capSession: (perPercent, full, windows) =>
      `1 % ≈ ${perPercent} · volle Sitzung ≈ ${full} API-Gegenwert, aus ${windows} ${
        windows > 1 ? "Sitzungen" : "Sitzung"
      }`,
    capWeek: (perPercent, full, windows) =>
      `1 % ≈ ${perPercent} · volle Woche ≈ ${full} API-Gegenwert, aus ${windows} ${
        windows > 1 ? "Wochen" : "Woche"
      }`,
    noCap: "Geschätzte Obergrenze: noch nicht genug Daten",
    lastReading: (ago, count) => `Letzte Messung ${ago} · ${count} Messungen im Verlauf`,
  },

  quota: {
    empty: "Kein Aktivitätsfenster in diesem Zeitraum.",
    current: "Aktuelles Fenster",
    openFor: (elapsed, remaining) => `seit ${elapsed} offen · noch ${remaining}`,
    volume: (requests, tokens) => `${requests} Anfragen · ${tokens} Tokens`,
    meterLabel: "Gewicht des aktuellen Fensters im Vergleich zum stärksten",
    ofPeak: (share, peak) => `${share} deines stärksten Fensters (${peak})`,
    none: (duration) =>
      `Kein Fenster offen. Die nächste Anfrage öffnet ein neues, gültig für ${duration}.`,
  },

  levers: {
    empty: "In diesem Zeitraum gibt es nichts zu optimieren – ein gültiges Ergebnis, kein Mangel.",
    freeTitle: "Gewinne ohne Gegenleistung",
    freeNote: (total) => `${total} Mehrkosten erkannt, ohne Qualitätsverlust`,
    tradeoffTitle: "Abwägungen",
    tradeoffNote: "sie tauschen Kosten gegen Intelligenz – zu entscheiden, nicht pauschal anzuwenden",
    avoidable: "vermeidbare Mehrkosten",
    involved: "betroffene Ausgaben",
    ofTotal: (share) => `${share} des Gesamtbetrags`,
    idleTimeout: {
      title: "Kontext nach einer Pause erneut bezahlt",
      finding: (requests, tokens, cost) =>
        `${requests} Fortsetzung${requests > 1 ? "en" : ""} nach einer Pause haben ${tokens} Tokens Kontext neu geschrieben, für ${cost}.`,
      action:
        "Ein Cache-Eintrag läuft nach einer Stunde Inaktivität ab. Wer eine lange Sitzung nach einer Pause fortsetzt, bezahlt ihren gesamten Kontext erneut zum vollen Preis. Besser die Schritte einer Aufgabe zusammenhängend erledigen und eine neue Sitzung beginnen, statt eine bereits schwere wieder aufzuwecken.",
    },
    cacheInvalidation: {
      title: "Cache mitten in der Sitzung ungültig",
      finding: (cost, causes) => `${cost} Kontext neu geschrieben nach: ${causes}.`,
      action:
        "Ein Wechsel von Modell oder Effort-Stufe mitten in der Sitzung macht den Cache ungültig, und der gesamte Verlauf wird erneut bezahlt. Besser beides zu Beginn festlegen oder erst beim Öffnen einer neuen Sitzung wechseln.",
    },
    longContext: {
      title: "Kontext über der Komfortschwelle",
      finding: (requests, threshold, cost, peak) =>
        `${requests} Anfragen haben mehr als ${threshold} Tokens Kontext erneut gelesen. Das erneute Lesen oberhalb dieser Schwelle kostete ${cost}. Höchstwert: ${peak} Tokens in einer Anfrage.`,
      action: (threshold) =>
        `Jeder Schritt sendet den gesamten Verlauf erneut: Die Kosten einer Sitzung wachsen ungefähr mit dem Quadrat der Anzahl der Schritte. Den Kontext zu komprimieren oder die Arbeit auf gezielte Sitzungen aufzuteilen, durchbricht diese Kurve. Der angegebene Betrag ist das, was eine systematische Komprimierung bei ${threshold} Tokens vermieden hätte – der Kontext unterhalb der Schwelle ist die eigentliche Arbeit.`,
    },
    sidechains: {
      title: "Kosten der Sub-Agenten",
      finding: (cost) => `${cost} von Sub-Agenten ausgegeben.`,
      action:
        "Ein Sub-Agent startet mit eigenem Kontext: nützlich, um eine umfangreiche Recherche vom Hauptgespräch zu trennen, teuer, wenn die Aufgabe in den aktuellen Verlauf gepasst hätte.",
    },
    effort: {
      title: "Effort-Stufe",
      finding: (cost, share) =>
        `${cost} Ausgaben bei hohem Effort. Reasoning macht ${share} der Ausgabe-Tokens aus.`,
      action:
        "Effort ist der erste Hebel, der Kosten gegen Nachdenken tauscht. Programmieren und lange Aufgaben rechtfertigen ihn; kurze Fragen und Routinearbeit kommen oft mit weniger Effort aus. Pro Aufgabentyp einstellen, nicht global.",
    },
    modelMix: {
      title: "Verteilung auf Modelle",
      finding: (model, share, requests) =>
        `${model} vereint ${share} der Ausgaben, bei ${requests} Anfragen.`,
      action:
        "Ein teureres Modell, das in weniger Schritten fertig wird, bleibt die günstigste Option: Entscheidend sind die Kosten pro erledigter Aufgabe, nicht pro Token. Ein Wechsel wird Aufgabe für Aufgabe beurteilt, indem man prüft, ob das Ergebnis trägt.",
    },
  },

  session: {
    title: "Sitzungsdetails",
    close: "Schließen",
    loading: "Wird geladen…",
    loadFailed: (error) => `Laden fehlgeschlagen: ${error}`,
    effort: (effort) => `Effort ${effort}`,
    output: (tokens) => `${tokens} Ausgabe`,
    reread: (tokens) => `${tokens} erneut gelesen`,
    cacheRewritten: (cause) => `Cache neu geschrieben: ${cause}`,
    branch: "Branch",
    peakContext: "Max. Kontext",
    rewrites: "Cache neu geschrieben",
    contextTitle: "Erneut gelesener Kontext pro Anfrage",
    contextLegend: "Gelbe Linie: Cache nach einer Pause, einem Modell- oder Effort-Wechsel neu geschrieben.",
  },

  table: {
    caption: "Nutzung pro Tag: Anfragen, Tokens nach Typ und API-Gegenwert",
  },

  charts: {
    stackedAria: "API-Gegenwert pro Tag, aufgeschlüsselt nach Posten",
    noRequests: "Keine Anfragen in diesem Zeitraum.",
    noRequest: "Keine Anfragen",
    rankedAria: "Rangfolge nach Wert",
    heatmapAria: "Anfragen nach Wochentag und Uhrzeit",
    heatmapEmpty: "Keine Aktivität in diesem Zeitraum.",
    less: "weniger",
    more: (max) => `mehr · bis zu ${max} Anfragen`,
  },

  footer: {
    readTitle: "So liest du die Kosten.",
    read: "Ein Claude-Pro- oder Max-Abo wird nicht pro Token abgerechnet: Der angezeigte Betrag ist das, was dieselbe Nutzung über die API zu öffentlichen Preisen gekostet hätte. Er misst den verbrauchten Wert, keine tatsächliche Ausgabe.",
    computeTitle: "So werden die Kosten berechnet.",
    compute: (raw, untracked, share) =>
      `Die ${raw} an Anfragen, die in den Transkripten sichtbar sind, werden Sitzung für Sitzung mit den Einträgen kalibriert, die Claude Code am Sitzungsende schreibt. Das ergänzt ${untracked} an Aufrufen, die es nicht protokolliert – Titelerzeugung, Kontextkomprimierung, Hilfsaufgaben. ${share} des angezeigten Gesamtbetrags sind so kalibriert.`,
    uncalibrated: (sessions) =>
      ` ${sessions} noch offene Sitzung(en) haben keinen Eintrag: Ihre Kosten sind eine Untergrenze, leicht unterschätzt.`,
    unknownModel: " Mindestens eine Sitzung nutzt ein Modell, dessen Preis Claude Code nicht kennt.",
    files: (count, size) => `${count} Transkripte · ${size} gelesen aus`,
    skipped: (lines) => ` · ${lines} unlesbare Zeilen übersprungen`,
    since: (date) => ` · Verlauf seit ${date}`,
    scanned: (date) => ` · gescannt am ${date}`,
    activeDays: (days) => ` · ${days} aktive Tage`,
    privacy: (window) =>
      `Keine Daten verlassen deinen Rechner: Die App liest lokale Dateien und ruft keinen entfernten Dienst auf. Die Limit-Anzeigen stammen aus den Messungen, die die Claude-Code-Statuszeile speichert. Länge eines Kontingentfensters: ${window}.`,
  },

  cli: {
    help: [
      "Verwendung: tempo [Befehl]",
      "",
      "  tempo            Startet das Dashboard und öffnet es im Browser",
      "  tempo status     Übersicht im Terminal: Limits, Kosten, Branch",
      "  tempo doctor     Prüft die Installation",
      "  tempo setup      Installiert Statuszeile und Sitzungsübersicht",
      "  tempo setup --remove   Deinstalliert beides",
      "",
      "Optionen für tempo: --port <n>, --no-open",
    ],
    noBuild: "Das Dashboard ist nicht gebaut. Führe npm run build im Tempo-Ordner aus.",
    starting: "Tempo startet…",
    ready: (url) => `Tempo läuft auf ${url}`,
    stop: "Strg+C zum Beenden.",
    startFailed: "Der Server ist nicht gestartet. Versuche einen anderen Port mit --port.",
    setupHint: "Statuszeile nicht installiert: tempo setup zeigt deine Limits.",
    unknown: (command) => `Unbekannter Befehl: ${command}`,
    invalidJson: (file) => `${file} ist kein gültiges JSON: Korrigiere es und starte erneut.`,
    yesNo: "(j/N)",
    yes: "^(j|ja|y|yes)$",
    existing: (current) => `Es ist bereits eine Statuszeile eingerichtet:\n  ${current}`,
    replace: "Durch die von Tempo ersetzen?",
    untouched: "Nichts wurde geändert. Mit --force erneut starten, um sie zu ersetzen.",
    setAside: (file) => `Gesichert in ${file}, wird mit --remove wiederhergestellt.`,
    installed: (file) => `Statuszeile und Sitzungsübersicht installiert in ${file}.`,
    nextMessage: "Sie erscheinen bei deiner nächsten Nachricht in Claude Code.",
    notInstalled: "Nichts von Tempo ist installiert: nichts zu tun.",
    removedRestored: "Deinstalliert. Die vorherige Statuszeile ist wiederhergestellt.",
    removed: "Deinstalliert.",
    session: "Sitzung (5 Std.)",
    week: "Woche",
    today: "Heute",
    last7: "7 Tage",
    branch: "Branch",
    lever: "Hebel",
    noLimits: "Keine Limit-Messung: tempo setup ausführen, dann eine Nachricht in Claude Code senden.",
    limitAt: (time) => `Limit ~${time}`,
    requests: (count) => `${count} Anfr.`,
    avoidable: (amount) => `${amount} vermeidbar`,
    ok: "ok",
    warn: "Warnung",
    missing: "fehlt",
    doctorTitle: "tempo doctor",
    node: (version) => `Node ${version}`,
    nodeOld: (version) => `Node ${version}: Tempo braucht Node 20 oder neuer`,
    transcripts: (count, root) => `${count} Transkripte in ${root}`,
    noTranscripts: (root) => `Keine Transkripte in ${root}: starte eine Claude-Code-Sitzung`,
    account: (plan) => `Claude-${plan}-Konto`,
    noAccount: "Kein Claude-Konto in ~/.claude.json gefunden",
    statusline: "Statuszeile installiert",
    noStatusline: "Statuszeile nicht installiert: tempo setup",
    hook: "Sitzungsübersicht installiert",
    noHook: "Sitzungsübersicht nicht installiert: tempo setup",
    reading: (ago) => `Letzte Limit-Messung ${ago}`,
    readingOld: (ago) => `Letzte Limit-Messung ${ago}: sende eine Nachricht in Claude Code zum Aktualisieren`,
    noReading: "Keine Limit-Messung: sende eine Nachricht in Claude Code",
    build: "Dashboard gebaut",
    noBuild2: "Dashboard nicht gebaut: npm run build",
    allGood: "Alles ist eingerichtet.",
    toFix: (count) => `${count} Punkt${count > 1 ? "e" : ""} zu beheben.`,
  },

  noTranscripts: {
    title: "Keine Transkripte gefunden",
    body: "Tempo liest die Claude-Code-Nutzung aus den lokalen Transkripten, erwartet in",
    empty: "Dieses Verzeichnis ist leer oder existiert nicht.",
    runSession: "Starte mindestens eine Claude-Code-Sitzung auf diesem Rechner.",
    pointElsewhere: "Oder verweise Tempo mit der Umgebungsvariable auf einen anderen Ort",
  },
};
