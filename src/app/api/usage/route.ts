import { NextResponse } from "next/server";

import { readAccount } from "@/lib/account";
import { buildReport, isRangeKey, type RangeKey } from "@/lib/aggregate";
import { scanUsage } from "@/lib/scan";

/** Le rapport dépend de fichiers locaux : rien ne doit être pré-rendu. */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("range") ?? "7d";
  const range: RangeKey = isRangeKey(requested) ? requested : "7d";

  try {
    const [scan, account] = await Promise.all([scanUsage(), readAccount()]);
    return NextResponse.json(
      { account, report: buildReport(scan, range) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json(
      { error: `Lecture des transcripts impossible : ${message}` },
      { status: 500 },
    );
  }
}
