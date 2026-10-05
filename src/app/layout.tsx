import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";

import { getMessages } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n/server";

import "./globals.css";

/** Texte courant : un sans-serif technique et lisible en petit corps. */
const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-plex",
  display: "swap",
});

/** Chiffres, repères et logo : la police mono porte l'identité terminal. */
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const { meta } = getMessages(await getRequestLocale());
  return { title: meta.title, description: meta.description };
}

export const viewport: Viewport = {
  // La page s'adapte aux deux thèmes ; la barre du navigateur suit la surface.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f6f4" },
    { media: "(prefers-color-scheme: dark)", color: "#111213" },
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getRequestLocale();
  return (
    // Le script de thème modifie `data-theme` avant l'hydratation : l'écart avec
    // le rendu serveur est voulu, on le signale à React.
    <html lang={locale} className={`${plex.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
