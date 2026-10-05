import { NextResponse } from "next/server";

import { readAccount } from "@/lib/account";
import { buildReport, isRangeKey, type RangeKey } from "@/lib/aggregate";
import { attachBranchLinks } from "@/lib/git";
import { loadLimits } from "@/lib/limits";
import { scanUsage } from "@/lib/scan";

/** Le rapport dépend de fichiers locaux : rien ne doit être pré-rendu. */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const requested = params.get("range") ?? "7d";
  const range: RangeKey = isRangeKey(requested) ? requested : "7d";
  const projectId = params.get("project") ?? undefined;
  const model = params.get("model") ?? undefined;

  try {
    const [scan, account] = await Promise.all([scanUsage(), readAccount()]);
    const limits = await loadLimits(scan);
    const report = buildReport(scan, range, undefined, { projectId, model });
    report.byBranch = await attachBranchLinks(report.byBranch);
    return NextResponse.json(
      { account, limits, report },
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
