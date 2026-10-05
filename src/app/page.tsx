import { readAccount } from "@/lib/account";
import { buildReport } from "@/lib/aggregate";
import { getMessages } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n/server";
import { attachBranchLinks } from "@/lib/git";
import { loadLimits } from "@/lib/limits";
import { scanUsage } from "@/lib/scan";
import { isTabKey } from "@/lib/tabs";
import { Dashboard } from "@/components/Dashboard";
import { I18nProvider } from "@/components/I18nProvider";

/** Le rapport dépend de fichiers locaux qui changent en continu. */
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [scan, account, locale, params] = await Promise.all([
    scanUsage(),
    readAccount(),
    getRequestLocale(),
    searchParams,
  ]);
  const tab = isTabKey(params.tab) ? params.tab : "overview";
  const limits = await loadLimits(scan);
  const report = buildReport(scan, "7d");
  report.byBranch = await attachBranchLinks(report.byBranch);

  if (scan.fileCount === 0) {
    return <NoTranscripts root={scan.root} text={getMessages(locale).noTranscripts} />;
  }

  return (
    <I18nProvider initialLocale={locale}>
      <Dashboard initialReport={report} initialLimits={limits} initialTab={tab} account={account} />
    </I18nProvider>
  );
}

function NoTranscripts({
  root,
  text,
}: {
  root: string;
  text: ReturnType<typeof getMessages>["noTranscripts"];
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col justify-center px-6 py-16">
      <h1 className="text-[22px] font-semibold text-[var(--ink)]">{text.title}</h1>
      <p className="mt-3 text-[14px] leading-relaxed text-[var(--ink-secondary)]">
        {text.body}{" "}
        <code className="rounded bg-[var(--surface-sunken)] px-1 py-0.5 text-[13px]">{root}</code>.{" "}
        {text.empty}
      </p>
      <ul className="mt-4 space-y-2 text-[14px] leading-relaxed text-[var(--ink-secondary)]">
        <li>· {text.runSession}</li>
        <li>
          · {text.pointElsewhere}{" "}
          <code className="rounded bg-[var(--surface-sunken)] px-1 py-0.5 text-[13px]">
            CLAUDE_PROJECTS_PATH
          </code>
          .
        </li>
      </ul>
    </main>
  );
}
