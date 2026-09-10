import { readAccount } from "@/lib/account";
import { buildReport } from "@/lib/aggregate";
import { scanUsage } from "@/lib/scan";
import { Dashboard } from "@/components/Dashboard";

/** Le rapport dépend de fichiers locaux qui changent en continu. */
export const dynamic = "force-dynamic";

export default async function Page() {
  const [scan, account] = await Promise.all([scanUsage(), readAccount()]);
  const report = buildReport(scan, "7d");

  if (scan.fileCount === 0) {
    return <NoTranscripts root={scan.root} />;
  }

  return <Dashboard initialReport={report} account={account} />;
}

function NoTranscripts({ root }: { root: string }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col justify-center px-6 py-16">
      <h1 className="text-[22px] font-semibold text-[var(--ink)]">Aucun transcript trouvé</h1>
      <p className="mt-3 text-[14px] leading-relaxed text-[var(--ink-secondary)]">
        Tempo lit l&apos;usage de Claude Code depuis les transcripts locaux, attendus dans{" "}
        <code className="rounded bg-[var(--surface-sunken)] px-1 py-0.5 text-[13px]">{root}</code>.
        Ce répertoire est vide ou introuvable.
      </p>
      <ul className="mt-4 space-y-2 text-[14px] leading-relaxed text-[var(--ink-secondary)]">
        <li>· Lance au moins une session Claude Code sur cette machine.</li>
        <li>
          · Ou pointe Tempo ailleurs avec la variable d&apos;environnement{" "}
          <code className="rounded bg-[var(--surface-sunken)] px-1 py-0.5 text-[13px]">
            CLAUDE_PROJECTS_PATH
          </code>
          .
        </li>
      </ul>
    </main>
  );
}
