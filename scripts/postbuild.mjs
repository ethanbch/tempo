/**
 * Complète le serveur autonome de Next : il ne copie ni les fichiers statiques
 * ni public/, qu'il faut placer à côté de server.js pour qu'il les serve.
 */
import { cp, stat } from "node:fs/promises";

await cp(".next/static", ".next/standalone/.next/static", { recursive: true });
if (await stat("public").catch(() => null)) {
  await cp("public", ".next/standalone/public", { recursive: true });
}
console.log(".next/standalone ready");
