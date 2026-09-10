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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
