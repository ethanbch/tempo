import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * Tempo lit les transcripts sous le répertoire personnel de l'utilisateur.
   * Ce chemin est dynamique par nature, ce qui fait émettre à la compilation un
   * avertissement sur le traçage des fichiers : il concerne la taille du bundle
   * lors d'un déploiement serverless, sans objet pour une application qu'on
   * exécute sur sa propre machine. Rien à corriger ici.
   */

  /*
   * Masque le badge Next.js en bas de page en développement. Les erreurs de
   * compilation et d'exécution restent affichées.
   */
  devIndicators: false,

  /*
   * Serveur autonome : `npx tempo` le lance sans installer les dépendances de
   * développement ni passer par `next start`.
   */
  output: "standalone",
  images: { unoptimized: true },
  // Les chemins lus dépendent du dossier personnel : sans cette liste, le traçage
  // embarquerait tout le dépôt (docs, marque, tests) dans le serveur autonome.
  outputFileTracingExcludes: {
    "*": [
      "brand/**",
      "docs/**",
      "tests/**",
      "scripts/**",
      "bin/**",
      "dist/**",
      "*.md",
      "package-lock.json",
      "tsconfig.tsbuildinfo",
      "src/**",
      "*.config.mjs",
      "*.config.mts",
      // Optimisation d'images (inutilisée ici) : binaires propres à la machine de build.
      "node_modules/sharp/**",
      "node_modules/@img/**",
    ],
  },
};

export default nextConfig;
