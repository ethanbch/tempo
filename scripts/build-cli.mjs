/**
 * Compile la commande `tempo` en un seul fichier sans dépendance, dist/tempo.mjs.
 * Il est autonome : `tempo setup` le copie tel quel dans ~/.claude/tempo/bin.
 */
import { build } from "esbuild";

await build({
  entryPoints: ["src/cli/index.ts"],
  outfile: "dist/tempo.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  banner: { js: "#!/usr/bin/env node" },
  logLevel: "warning",
});
console.log("dist/tempo.mjs");
