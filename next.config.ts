import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * Tempo lit les transcripts sous le répertoire personnel de l'utilisateur.
   * Ce chemin est dynamique par nature, ce qui fait émettre à la compilation un
   * avertissement sur le traçage des fichiers : il concerne la taille du bundle
   * lors d'un déploiement serverless, sans objet pour une application qu'on
   * exécute sur sa propre machine. Rien à corriger ici.
   */
};

export default nextConfig;
