// @ts-check
import { existsSync } from "node:fs";
import { join } from "node:path";
import { PLUGIN_DIR, c, aviso, titulo } from "./comun.js";
import { instalado } from "./instalar.js";

export async function cmdUi(args) {
  const portArg  = args.find(a => a.startsWith("--port"));
  const noOpen   = args.includes("--no-open");
  const port     = portArg
    ? parseInt(portArg.split("=")[1] ?? args[args.indexOf(portArg) + 1] ?? "3001", 10)
    : 3001;

  // Busca server.js: primero en .forge-ui/ (instalado con --ui), luego en el paquete
  const localUi  = join(process.cwd(), ".forge-ui", "server.js");
  const bundleUi = join(PLUGIN_DIR, "ui", "server.js");
  const serverJs = existsSync(localUi) ? localUi : existsSync(bundleUi) ? bundleUi : null;

  if (!serverJs) {
    console.log("");
    aviso("El dashboard no está instalado.");
    console.log("  Instálalo con:  npx forge init --ui");
    console.log("");
    process.exit(1);
  }

  console.log("");
  titulo(`Iniciando FORGE Dashboard en http://localhost:${port}`);
  console.log("  Presiona Ctrl+C para detener.");
  console.log("");

  // Importa y arranca el servidor
  const { startServer } = await import(serverJs);
  startServer(port);

  if (!noOpen) {
    const url = `http://localhost:${port}`;
    // Abrir navegador multiplataforma
    const { platform } = await import("node:os");
    const { spawn }    = await import("node:child_process");
    const cmds = { win32: ["cmd", ["/c", "start", url]], darwin: ["open", [url]], linux: ["xdg-open", [url]] };
    const [cmd, cmdArgs] = cmds[platform()] ?? cmds.linux;
    spawn(cmd, cmdArgs, { stdio: "ignore", detached: true }).unref();
  }
}
