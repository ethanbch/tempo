import type { Messages } from "./fr";

export const es: Messages = {
  meta: {
    title: "Tempo — uso de Claude",
    description:
      "Seguimiento local de tu uso de Claude Code: coste equivalente en API, tokens, caché, ventanas de cuota.",
  },

  units: {
    thousand: "k",
    million: "M",
    billion: "mil M",
    kilobytes: "KB",
    megabytes: "MB",
    usd: (amount) => `${amount} $`,
    milliseconds: (value) => `${value} ms`,
    seconds: (value) => `${value} s`,
    minutes: (value) => `${value} min`,
    hoursMinutes: (hours, minutes) => `${hours} h ${minutes}`,
    daysHours: (days, hours) => `${days} d ${hours} h`,
    hourOfDay: (hour) => `${hour} h`,
    justNow: "ahora mismo",
  },

  common: {
    cost: "Coste",
    requests: "Solicitudes",
    sessions: "Sesiones",
    input: "Entrada",
    output: "Salida",
    cacheWrite: "Escritura de caché",
    cacheRead: "Lectura de caché",
    reasoning: "Razonamiento",
    duration: "Duración",
    lastActivity: "Última actividad",
    value: "Valor",
    project: "Proyecto",
    total: "Total",
    day: "Día",
    noData: "Sin datos en este periodo.",
    unknownError: "error desconocido",
    httpStatus: (status) => `respuesta ${status}`,
  },

  header: {
    tagline: "Tu uso de Claude Code, leído de los transcripts de tu máquina.",
    noAccount: "No se ha detectado ninguna cuenta de Claude",
    account: "Cuenta de Claude",
    plan: (plan) => `Claude ${plan}`,
    active: (ago) => `activo ${ago}`,
    language: "Idioma",
  },

  theme: {
    light: "Tema claro",
    dark: "Tema oscuro",
    system: "Tema del sistema",
    change: (current) => `${current}, cambiar de tema`,
  },

  filters: {
    ranges: { "24h": "24 horas", "7d": "7 días", "30d": "30 días", all: "Todo" },
    period: "Periodo",
    allProjects: "Todos los proyectos",
    allModels: "Todos los modelos",
    byProject: "Filtrar por proyecto",
    byModel: "Filtrar por modelo",
    showTable: "Ver la tabla",
    hideTable: "Ocultar la tabla",
    reloadFailed: (error) => `No se pudo recargar: ${error}`,
  },

  stats: {
    cost: "Coste equivalente en API",
    costHint: "lo que este uso habría costado en la API",
    costHintPlan: (plan) => `lo que este uso habría costado en la API, fuera de la suscripción ${plan}`,
    requestsHint: (prompts, sessions, count) =>
      `${prompts} prompts · ${sessions} ${count === 1 ? "sesión" : "sesiones"}`,
    tokens: "Tokens",
    tokensHint: (output, thinking) => `${output} de salida · ${thinking} de razonamiento`,
    cache: "Servido desde la caché",
    cacheHint: (tokens) => `${tokens} tokens releídos`,
  },

  cards: {
    daily: {
      title: "Coste por día",
      subtitle: "Desglosado por partida: entrada, escritura y lectura de caché, salida.",
    },
    quota: {
      title: "Ventanas de 5 horas",
      subtitle: "La cuota de Claude se recarga por una ventana deslizante que abre la primera solicitud.",
    },
    byModel: { title: "Por modelo", subtitle: "Coste equivalente en API del periodo." },
    byProject: { title: "Por proyecto", subtitle: "Los ocho proyectos más costosos." },
    sessions: {
      title: "Sesiones",
      subtitle: "Las ocho sesiones más costosas. Haz clic para ver el detalle.",
    },
    heatmap: {
      title: "Cuándo usas Claude",
      subtitle: "Solicitudes por día de la semana y por hora, en tu zona horaria.",
    },
    levers: {
      title: "Palancas de optimización",
      subtitle: "Lo que revelan tus propias solicitudes, ordenado por lo que hay que ganar.",
    },
    cacheCauses: {
      title: "Escrituras de caché, por causa",
      subtitle: "Volver a guardar contexto se paga: esto es lo que lo provocó.",
      empty: "Ninguna escritura de caché en este periodo.",
    },
    effort: {
      title: "Por nivel de esfuerzo",
      subtitle: "Gasto y proporción de razonamiento, del más ligero al más intenso.",
      empty: "Ningún nivel de esfuerzo registrado en este periodo.",
    },
    table: { title: "Detalle por día", subtitle: "Todos los valores de los gráficos, en texto." },
  },

  captions: {
    requests: (requests) => `${requests} solicitudes`,
    requestsTokens: (requests, tokens) => `${requests} sol. · ${tokens} tokens`,
    requestsReasoning: (requests, share) => `${requests} sol. · ${share} razonamiento`,
    sessionsRequests: (sessions, requests, count) =>
      `${sessions} ${count === 1 ? "sesión" : "sesiones"} · ${requests} sol.`,
    requestsDuration: (requests, duration) => `${requests} sol. · ${duration}`,
    contextRewritten: "Contexto reescrito",
  },

  causes: {
    "session-start": "Inicio de sesión",
    "context-growth": "Crecimiento del contexto",
    "idle-timeout": "Reanudación tras una pausa",
    "model-switch": "Cambio de modelo",
    "effort-switch": "Cambio de esfuerzo",
  },

  effortUnspecified: "sin especificar",

  limits: {
    title: "Límites de uso",
    subtitle:
      "Leídos por la statusline de Claude Code. El tope estimado divide el coste de las solicitudes de Claude Code de esta máquina entre el porcentaje consumido: el uso en claude.ai o en otro lugar también cuenta para el límite, y en ese caso el tope real es mayor.",
    setup: "Los indicadores de sesión y de semana aparecen una vez instalada la statusline de Tempo. Desde la carpeta de Tempo:",
    session: "Sesión (5 horas)",
    week: "Semana",
    noReading: "Aún no hay lecturas.",
    meterLabel: (title) => `${title}: proporción consumida`,
    expired: "Reiniciada desde la última lectura",
    unknownReset: "Reinicio desconocido",
    sessionReset: (time, remaining) => `Se reinicia a las ${time} · en ${remaining}`,
    weekReset: (remaining, date) => `Se reinicia en ${remaining} · ${date}`,
    hitsAt: (when) => `A este ritmo, límite alcanzado hacia ${when}`,
    idleSession: "Sin consumo en la última hora",
    idleWeek: "Sin consumo en las últimas 24 h",
    atReset: (share) => `A este ritmo, ≈ ${share} al reiniciarse`,
    capSession: (perPercent, full, windows) =>
      `1 % ≈ ${perPercent} · sesión completa ≈ ${full} equivalente en API, según ${windows} ${
        windows > 1 ? "sesiones" : "sesión"
      }`,
    capWeek: (perPercent, full, windows) =>
      `1 % ≈ ${perPercent} · semana completa ≈ ${full} equivalente en API, según ${windows} ${
        windows > 1 ? "semanas" : "semana"
      }`,
    noCap: "Tope estimado: aún no hay datos suficientes",
    lastReading: (ago, count) => `Última lectura ${ago} · ${count} lecturas en el historial`,
  },

  quota: {
    empty: "Ninguna ventana de actividad en este periodo.",
    current: "Ventana actual",
    openFor: (elapsed, remaining) => `abierta hace ${elapsed} · quedan ${remaining}`,
    volume: (requests, tokens) => `${requests} solicitudes · ${tokens} tokens`,
    meterLabel: "Peso de la ventana actual, comparado con la más cargada",
    ofPeak: (share, peak) => `${share} de tu ventana más cargada (${peak})`,
    none: (duration) =>
      `Ninguna ventana abierta. La próxima solicitud abrirá una nueva, válida durante ${duration}.`,
  },

  levers: {
    empty: "Nada que optimizar en este periodo: es una conclusión válida, no una carencia.",
    freeTitle: "Ganancias sin contrapartida",
    freeNote: (total) => `${total} de sobrecoste identificado, sin pérdida de calidad`,
    tradeoffTitle: "Compromisos",
    tradeoffNote: "cambian coste por inteligencia: hay que decidirlos, no aplicarlos sin más",
    avoidable: "sobrecoste evitable",
    involved: "gasto afectado",
    ofTotal: (share) => `${share} del total`,
    idleTimeout: {
      title: "Contexto pagado de nuevo tras una pausa",
      finding: (requests, tokens, cost) =>
        `${requests} reanudacion${requests > 1 ? "es" : ""} tras una pausa reescribieron ${tokens} tokens de contexto, por ${cost}.`,
      action:
        "Una entrada de caché caduca tras una hora de inactividad. Retomar una sesión larga después de una pausa obliga a pagar de nuevo todo su contexto a precio completo. Es mejor encadenar los turnos de una misma tarea y empezar una sesión nueva en lugar de despertar una ya pesada.",
    },
    cacheInvalidation: {
      title: "Caché invalidada a mitad de sesión",
      finding: (cost, causes) => `${cost} de contexto reescrito tras: ${causes}.`,
      action:
        "Cambiar de modelo o de nivel de esfuerzo a mitad de sesión invalida la caché y obliga a pagar de nuevo todo el historial. Mejor fijar ambos al principio de la sesión, o cambiar al abrir una nueva.",
    },
    longContext: {
      title: "Contexto por encima del umbral de comodidad",
      finding: (requests, threshold, cost, peak) =>
        `${requests} solicitudes releyeron más de ${threshold} tokens de contexto. Releer lo que supera ese umbral costó ${cost}. Pico observado: ${peak} tokens en una solicitud.`,
      action: (threshold) =>
        `Cada turno reenvía todo el historial: el coste de una sesión crece aproximadamente como el cuadrado del número de turnos. Compactar el contexto, o dividir el trabajo en sesiones más acotadas, rompe esa curva. El importe indicado es lo que habría evitado una compactación sistemática a ${threshold} tokens; el contexto por debajo de ese umbral es el propio trabajo.`,
    },
    sidechains: {
      title: "Coste de los subagentes",
      finding: (cost) => `${cost} gastados por subagentes.`,
      action:
        "Un subagente parte con su propio contexto: útil para aislar una búsqueda voluminosa de la conversación principal, costoso si la tarea cabía en el hilo actual.",
    },
    effort: {
      title: "Nivel de esfuerzo",
      finding: (cost, share) =>
        `${cost} de gasto con esfuerzo alto. El razonamiento ocupa el ${share} de los tokens de salida.`,
      action:
        "El esfuerzo es la primera palanca que cambia coste por reflexión. La programación y las tareas largas lo rentabilizan; las preguntas cortas y el trabajo rutinario suelen funcionar con un esfuerzo menor. Ajústalo por tipo de tarea, no de forma global.",
    },
    modelMix: {
      title: "Reparto entre modelos",
      finding: (model, share, requests) =>
        `${model} concentra el ${share} del gasto, en ${requests} solicitudes.`,
      action:
        "Un modelo más caro que termina en menos turnos sigue siendo la opción más barata: lo que cuenta es el coste por tarea completada, no por token. El cambio se evalúa tarea por tarea, comprobando si el resultado se mantiene.",
    },
  },

  session: {
    title: "Detalle de la sesión",
    close: "Cerrar",
    loading: "Cargando…",
    loadFailed: (error) => `No se pudo cargar: ${error}`,
    effort: (effort) => `esfuerzo ${effort}`,
    output: (tokens) => `${tokens} de salida`,
    reread: (tokens) => `${tokens} releídos`,
    cacheRewritten: (cause) => `caché reescrita: ${cause}`,
  },

  table: {
    caption: "Uso por día: solicitudes, tokens por tipo y coste equivalente en API",
  },

  charts: {
    stackedAria: "Coste equivalente en API por día, desglosado por partida",
    noRequests: "Ninguna solicitud en este periodo.",
    noRequest: "Ninguna solicitud",
    rankedAria: "Clasificación por valor",
    heatmapAria: "Solicitudes por día de la semana y por hora",
    heatmapEmpty: "Ninguna actividad que repartir en este periodo.",
    less: "menos",
    more: (max) => `más · hasta ${max} solicitudes`,
  },

  footer: {
    readTitle: "Cómo leer el coste.",
    read: "Una suscripción a Claude Pro o Max no se factura por token: el importe mostrado es lo que el mismo uso habría costado en la API, según las tarifas públicas. Mide el valor consumido, no un gasto real.",
    computeTitle: "Cómo se calcula el coste.",
    compute: (raw, untracked, share) =>
      `Los ${raw} de solicitudes visibles en los transcripts se calibran sesión por sesión con los registros que Claude Code escribe al cerrar una sesión, lo que añade ${untracked} de llamadas que no registra: generación de títulos, compactación de contexto, tareas auxiliares. El ${share} del total mostrado está calibrado así.`,
    uncalibrated: (sessions) =>
      ` ${sessions} sesión(es) aún abierta(s) no tienen registro: su coste es un mínimo, ligeramente subestimado.`,
    unknownModel: " Al menos una sesión usa un modelo cuya tarifa Claude Code desconoce.",
    files: (count, size) => `${count} transcripts · ${size} leídos desde`,
    skipped: (lines) => ` · ${lines} líneas ilegibles ignoradas`,
    since: (date) => ` · historial desde el ${date}`,
    scanned: (date) => ` · escaneado el ${date}`,
    activeDays: (days) => ` · ${days} días activos`,
    privacy: (window) =>
      `Ningún dato sale de tu máquina: la aplicación lee archivos locales y no llama a ningún servicio remoto. Los indicadores de límite proceden de las lecturas que guarda la statusline de Claude Code. Duración de una ventana de cuota: ${window}.`,
  },

  noTranscripts: {
    title: "No se encontraron transcripts",
    body: "Tempo lee el uso de Claude Code desde los transcripts locales, que se esperan en",
    empty: "Este directorio está vacío o no existe.",
    runSession: "Ejecuta al menos una sesión de Claude Code en esta máquina.",
    pointElsewhere: "O indica otra ubicación a Tempo con la variable de entorno",
  },
};
