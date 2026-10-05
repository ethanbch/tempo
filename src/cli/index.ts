import { cliText } from "./env";
import { doctor } from "./doctor";
import { sessionEnd } from "./session-end";
import { install, remove } from "./setup";
import { start } from "./start";
import { status } from "./status";

/** Point d'entrée de la commande `tempo`. */
async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  const flags = new Set(rest.filter((arg) => arg.startsWith("--")));

  switch (command) {
    case undefined:
    case "start": {
      const args = command === undefined ? argv : rest;
      const portIndex = args.indexOf("--port");
      const port = portIndex !== -1 ? Number(args[portIndex + 1]) : undefined;
      return start({ port: Number.isFinite(port) ? port : undefined, open: !args.includes("--no-open") });
    }
    case "status":
      return status();
    case "doctor":
      return doctor();
    case "setup":
      return flags.has("--remove") ? remove() : install(flags.has("--force"));
    case "session-end":
      return sessionEnd();
    case "help":
    case "--help":
    case "-h":
      console.log(cliText().t.cli.help.join("\n"));
      return 0;
    default:
      // `tempo --port 4400` et `tempo --no-open` démarrent aussi le tableau de bord.
      if (command.startsWith("--")) return main(["start", ...argv]);
      console.error(cliText().t.cli.unknown(command));
      console.log(cliText().t.cli.help.join("\n"));
      return 1;
  }
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
