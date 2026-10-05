import { describe, expect, it } from "vitest";

import { parseMergeSubjects, webUrl } from "@/lib/git";

describe("webUrl", () => {
  it("turns SSH and HTTPS remotes into a web address", () => {
    expect(webUrl("git@github.com:owner/repo.git")).toBe("https://github.com/owner/repo");
    expect(webUrl("https://github.com/owner/repo.git\n")).toBe("https://github.com/owner/repo");
    expect(webUrl("https://token@github.com/owner/repo")).toBe("https://github.com/owner/repo");
    expect(webUrl("/some/local/path")).toBeNull();
  });
});

describe("parseMergeSubjects", () => {
  it("maps branches to PR numbers from GitHub merge commits", () => {
    const log = [
      "Merge pull request #49 from owner/feat/telemetry",
      "Merge branch 'main' into feat/x",
      "Merge pull request #12 from owner/fix/typo",
      "Merge pull request #3 from owner/fix/typo",
    ].join("\n");
    const prs = parseMergeSubjects(log);
    expect(prs.get("feat/telemetry")).toBe(49);
    // L'historique est du plus récent au plus ancien : la première PR trouvée l'emporte.
    expect(prs.get("fix/typo")).toBe(12);
    expect(prs.has("feat/x")).toBe(false);
  });
});
