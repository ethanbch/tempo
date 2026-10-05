import { NextResponse } from "next/server";

import { buildCalibration } from "@/lib/aggregate";
import { classifyCacheCause } from "@/lib/insights";
import { canonicalModelId, modelLabel } from "@/lib/pricing";
import { scanUsage } from "@/lib/scan";

/** Le détail dépend de fichiers locaux : rien ne doit être pré-rendu. */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("id");
  if (!sessionId) {
    return NextResponse.json({ error: "Missing `id` parameter." }, { status: 400 });
  }

  try {
    const scan = await scanUsage();
    const events = scan.events.filter((event) => event.sessionId === sessionId);
    if (events.length === 0) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    const calibration = buildCalibration(scan);
    const factor = calibration.get(sessionId) ?? 1;

    const requests = events.map((event, index) => {
      const previous = index > 0 ? events[index - 1] : null;
      const cacheWriteTokens = event.cacheWrite5mTokens + event.cacheWrite1hTokens;
      return {
        time: event.timestamp,
        model: canonicalModelId(event.model),
        label: modelLabel(canonicalModelId(event.model)),
        effort: event.effort,
        inputTokens: event.inputTokens,
        outputTokens: event.outputTokens,
        cacheReadTokens: event.cacheReadTokens,
        cacheWriteTokens,
        cost: event.cost.total * factor,
        cacheCause: cacheWriteTokens > 0 ? classifyCacheCause(previous, event) : null,
      };
    });

    const first = events[0];
    const last = events[events.length - 1];
    const cost = requests.reduce((sum, r) => sum + r.cost, 0);

    return NextResponse.json(
      {
        session: {
          sessionId,
          projectId: first.projectId,
          projectName: first.projectName,
          gitBranch: first.gitBranch,
          firstActivity: first.timestamp,
          lastActivity: last.timestamp,
          durationMs: last.time - first.time,
          cost,
          requests,
        },
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Could not read transcripts: ${message}` },
      { status: 500 },
    );
  }
}
