/** Onglets du tableau de bord, dans leur ordre d'affichage. */
export const TABS = ["overview", "spend", "activity", "optimize"] as const;

export type TabKey = (typeof TABS)[number];

export function isTabKey(value: unknown): value is TabKey {
  return typeof value === "string" && (TABS as readonly string[]).includes(value);
}
