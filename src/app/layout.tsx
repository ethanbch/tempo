import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Tempo — usage Claude",
  description:
    "Suivi local de ton usage de Claude Code : coût équivalent API, tokens, cache, fenêtres de quota.",
};

export const viewport: Viewport = {
  // La page s'adapte aux deux thèmes ; la barre du navigateur suit la surface.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf9f5" },
    { media: "(prefers-color-scheme: dark)", color: "#1f1e1d" },
  ],
};

/**
 * Pose `data-theme` avant l'hydratation, depuis la préférence stockée.
 *
 * Doit s'exécuter en tant que script bloquant dans `<head>`, pas dans un effet
 * React qui arriverait trop tard et laisserait un flash du mauvais thème.
 */
const THEME_INIT_SCRIPT = `
  try {
    var t = localStorage.getItem("tempo-theme");
    if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
  } catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Le script de thème modifie `data-theme` avant l'hydratation : l'écart avec
    // le rendu serveur est voulu, on le signale à React.
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
