#!/usr/bin/env node
// @ts-check
/**
 * FORGE — CLI de instalación multiplataforma (Windows / macOS / Linux).
 * (también disponible como sdd-es para compatibilidad)
 *
 * Uso:
 *   npx forge init             instala en el proyecto actual (.claude/ + .sdd/)
 *   npx forge init --global    instala en $HOME/.claude (todos los proyectos)
 *   npx forge update           re-copia commands/agents/skills/hooks sin tocar .sdd/ ni settings
 *   npx forge doctor           diagnostica la instalación
 *   npx forge --version        muestra la versión
 */


import { fileURLToPath } from "node:url";
import { leerVariable } from "../core/entorno.js";
import { ordenInvocada, PRODUCTO } from "../core/nombres.js";
import { error, pluginVersion } from "./comandos/comun.js";
import { OPCIONES_INSTALACION, cmdInit, cmdUpdate } from "./comandos/instalar.js";
import { cmdDoctor } from "./comandos/doctor.js";
import { cmdConfig } from "./comandos/config.js";
import { cmdUi } from "./comandos/ui.js";
import { cmdLogs } from "./comandos/logs.js";
import { cmdAprobar } from "./comandos/aprobar.js";

// ─── Colores (degradan a texto plano si no hay TTY) ─────────────────────────────

// Orden con la que se invocó el programa (fragua, forge o sdd-es): la ayuda y los mensajes la usan.
const ORDEN = ordenInvocada(process.argv[1]);
const ORDEN_EN_TEXTO = /\b(npx )?forge (?=(?:init|update|doctor|ui|status|step|config|logs|export|import|reset|adr|aprobar|run|resume|api|mcp|probar-modelo|state|validate|--version|--help)\b)/g;
if (ORDEN !== 'forge') {
  for (const metodo of ['log', 'error']) {
    const original = console[metodo].bind(console);
    console[metodo] = (...partes) => original(...partes.map((p) => (typeof p === 'string' ? p.replace(ORDEN_EN_TEXTO, (_m, npx) => `${npx ?? ''}${ORDEN} `) : p)));
  }
}


function uso() {
  console.log(`
${PRODUCTO} — CLI (v${pluginVersion()})
El proyecto pasa a llamarse Fragua: el comando «fragua» ya equivale a «forge», que sigue funcionando.

Uso:
  npx forge init [--global] [--preset lean|startup|enterprise] [--ui]
                 [--template api-rest|cli-tool|saas-mvp]
                                     Instala FORGE (proyecto actual o global)
  npx forge update [--global]        Re-copia núcleo sin tocar tu .sdd/ ni settings
  Opciones de init/update: --integracion <claude|generica|agents|copilot|cursor|gemini|windsurf|opencode|kiro>
                           --perfil <esencial|completo>   --carpeta-skills <ruta> (solo generica)
  npx forge doctor                   Diagnostica la instalación y providers disponibles
  npx forge ui [--port N] [--no-open]  Abre el dashboard en el navegador
  npx forge config show [sección]    Muestra sdd.config.yaml o una sección
  npx forge config get <clave>       Obtiene el valor de una clave
  npx forge config set <clave> <v>   Cambia un valor en sdd.config.yaml
  npx forge config validate          Valida la estructura del config
  npx forge logs [--last N]          Historial de consumo de tokens (default: 20 entradas)
  npx forge export [--format=speckit|openspec] [--out=dir]
                                     Exporta .sdd/ a formato portable (Spec Kit / OpenSpec)
  npx forge import --from=speckit --dir=<dir> [--merge]
  npx forge import --from=openspec --file=<file.json> [--merge]
                                     Importa artefactos portables de vuelta a .sdd/
  npx forge verificar [--cwd <dir>] [--comando "<pruebas>"] [--json]
                                     Veredicto de las pruebas en contenedor aislado, sin modelo
  npx forge status                   Estado del pipeline + transiciones disponibles
  npx forge step <paso> [--force --motivo ".."]  Avanzar el pipeline al paso indicado (sin LLM)
  npx forge state                    Volcar estado.json formateado
  npx forge validate                 Verificar precondiciones del paso actual
  npx forge reset --force            Resetear pipeline a 'idea'
  npx forge adr <raíz> "<glob>" [--update-ledger]
                                     Busca ADRs en el código y, con --update-ledger, los añade al registro
  npx forge probar-modelo [--tope USD] [--conservar]
                                     Prueba mínima del ciclo con un modelo real (necesita ANTHROPIC_API_KEY); gasta
                                     como máximo el tope (0,50 USD por defecto) y resume formato, iteraciones y coste
  npx forge mantenimiento [--escribir] [--json]
                                     Señales del registro de eventos (fallos repetidos, regresiones); con --escribir
                                     deja un borrador de idea por señal en .sdd/mantenimiento/ideas/. Sale 1 si hay señales
  npx forge api [--port N] [--cwd <ruta>]
                                     API HTTP local (127.0.0.1) con token: lanzar el ciclo verificado, ver su
                                     estado y decidir las revisiones. Escribe en una sola línea JSON la URL y el token
  npx forge mcp [--cwd <ruta>] [--perfil completo|verificacion]
                                     Servidor MCP por stdin/stdout con tres herramientas: ejecutar pruebas
                                     en el entorno aislado, leer y escribir archivos con las reglas del ciclo.
                                     --perfil verificacion expone solo "verificar" (para otra herramienta; ver docs/mcp-verificar.md).
                                     Configúralo en tu cliente: {"mcpServers":{"forge":{"command":"npx","args":["forge","mcp"]}}}
  npx forge run [--tasks <json>] [--motor clasico|ciclo] [--force]
                                     Ejecuta las tareas. Con --motor ciclo, cada tarea de código
                                     se corrige hasta que sus pruebas pasan, en Docker y sin red
  npx forge resume [--decision continuar|aceptar|abortar]
                   [--iteraciones-extra N] [--presupuesto-extra USD]
                                     Retoma lo interrumpido. Si una tarea espera tu decisión,
                                     la muestra sin gastar nada hasta que indiques --decision
                                     Códigos de salida: 0 completado · 1 fallo ·
                                     3 revisión pendiente · 4 Docker no disponible
  npx forge --version                Muestra la versión

  (También disponible como: npx sdd-es init, npx sdd-es doctor, etc.)

Tras instalar, abre Claude Code y escribe:
  /forge "describe tu idea aquí"
`);
}

async function main() {
  const args    = process.argv.slice(2);
  const comando = args[0];
  const global  = args.includes("--global") || args.includes("-g");
  const guided  = args.includes("--guided");
  const withUi  = args.includes("--ui");
  const presetIdx = args.findIndex(a => a === "--preset" || a.startsWith("--preset="));
  const preset  = presetIdx !== -1
    ? (args[presetIdx].includes("=") ? args[presetIdx].split("=")[1] : args[presetIdx + 1])
    : null;
  const templateIdx = args.findIndex(a => a === "--template" || a.startsWith("--template="));
  const template = templateIdx !== -1
    ? (args[templateIdx].includes("=") ? args[templateIdx].split("=")[1] : args[templateIdx + 1])
    : null;

  const valorDe = (nombre) => {
    const i = args.findIndex((a) => a === nombre || a.startsWith(nombre + "="));
    return i === -1 ? null : (args[i].includes("=") ? args[i].split("=").slice(1).join("=") : (args[i + 1] ?? ""));
  };
  OPCIONES_INSTALACION.integracion = valorDe("--integracion");
  OPCIONES_INSTALACION.perfil = valorDe("--perfil");
  OPCIONES_INSTALACION.carpetaSkills = valorDe("--carpeta-skills");

  switch (comando) {
    case "init":
      cmdInit(global, guided, withUi, preset, template);
      break;
    case "update":
      cmdUpdate(global);
      break;
    case "doctor":
      await cmdDoctor();
      break;
    case "esquema":
      process.exitCode = (await import("./esquema.js")).cmdEsquema(args.slice(1));
      break;
    case "config":
      cmdConfig(args.slice(1));
      break;
    case "ui":
      cmdUi(args.slice(1)).catch(e => error(e.message));
      break;
    case "logs":
      cmdLogs(args.slice(1));
      break;
    case "export":
      import("./export.js").then(({ cmdExport }) => cmdExport(args.slice(1))).catch(e => error(e.message));
      break;
    case "import":
      import("./import.js").then(({ cmdImport }) => cmdImport(args.slice(1))).catch(e => error(e.message));
      break;
    case "status":
    case "step":
    case "state":
    case "validate":
    case "reset":
      import("./runner.js").then(({ runForgeCommand }) => runForgeCommand(comando, args.slice(1))).catch(e => error(e.message));
      break;
    case "dispatch":
      import("./dispatch.js").then(({ cmdDispatch }) => cmdDispatch(args.slice(1))).catch(e => error(e.message));
      break;
    case "adapters":
      import("./dispatch.js").then(({ cmdAdapters }) => cmdAdapters()).catch(e => error(e.message));
      break;
    case "decisions":
      import("./decisions.js").then(({ cmdDecisions }) => cmdDecisions(args.slice(1))).catch(e => error(e.message));
      break;
    case "aprobar":
      await cmdAprobar(args.slice(1));
      break;
    case "integraciones": {
      // Carga perezosa: solo quien invoca este comando importa el paquete de integraciones (HU-005)
      const { cmdIntegraciones } = await import("./integraciones.js");
      await cmdIntegraciones(args.slice(1));
      break;
    }
    case "verificar": {
      // Carga perezosa: sin modelo, sin proveedores ni integraciones (spec 2026-10-13-verificar-sin-modelo)
      const { cmdVerificar } = await import("./verificar.js");
      process.exitCode = await cmdVerificar(args.slice(1));
      break;
    }
    case "api": {
      // API HTTP local con token (spec 2026-10-03-api-http). Por stdout sale una sola línea JSON con la URL y el token.
      const valor = (flag) => { const i = args.indexOf(flag); return i !== -1 && args[i + 1] ? args[i + 1] : undefined; };
      const { crearServidorApi } = await import("../core/api/servidor.js");
      const api = crearServidorApi({ cwd: valor("--cwd") ?? process.cwd(), token: leerVariable('API_TOKEN') || undefined });
      const { url } = await api.escuchar(valor("--port") === undefined ? 3002 : Number(valor("--port")));
      console.log(JSON.stringify({ url, token: api.token }));
      process.stderr.write(`FORGE API en ${url}. Envía el token en la cabecera "Authorization: Bearer ...". Ctrl+C para parar.\n`);
      await new Promise((resolver) => { process.on("SIGINT", resolver); process.on("SIGTERM", resolver); });
      await api.cerrar();
      break;
    }
    case "mantenimiento": {
      // Señales objetivas del registro de eventos -> borradores de idea (core/mantenimiento.js). No despliega ni corrige.
      const { detectarSenales, leerEventosDe, escribirBorradores } = await import("../core/mantenimiento.js");
      let senales;
      try { senales = detectarSenales(leerEventosDe(process.cwd())); } catch (e) {
        console.error(`No se pudo leer el registro de eventos: ${e instanceof Error ? e.message : String(e)}`);
        process.exit(2);
      }
      const creados = args.includes("--escribir") ? escribirBorradores(process.cwd(), senales, new Date().toISOString()) : [];
      if (args.includes("--json")) {
        console.log(JSON.stringify({ senales, borradores: creados }, null, 2));
      } else if (senales.length === 0) {
        console.log("Sin señales de mantenimiento.");
      } else {
        for (const s of senales) console.log(`- ${s.tipo}: ${s.detalle}`);
        console.log(creados.length > 0 ? `Borradores creados:\n${creados.map((c) => `  ${c}`).join("\n")}` : "Usa --escribir para dejar un borrador por señal en .sdd/mantenimiento/ideas/.");
      }
      process.exitCode = senales.length > 0 ? 1 : 0;
      break;
    }
    case "probar-modelo": {
      // Prueba mínima del ciclo con un modelo real y un tope de gasto bajo (ver core/probar-modelo.js)
      const valor = (flag) => { const i = args.indexOf(flag); return i !== -1 && args[i + 1] ? args[i + 1] : undefined; };
      const { probarModelo, textoDelInforme } = await import("../core/probar-modelo.js");
      const informe = await probarModelo({
        tope: valor("--tope") === undefined ? undefined : Number(valor("--tope")),
        conservar: args.includes("--conservar"),
      });
      console.log(textoDelInforme(informe));
      process.exit(informe.ok ? 0 : informe.motivoNoEjecutada ? 2 : 1);
      break;
    }
    case "mcp": {
      // Servidor MCP por stdin/stdout: nada más que mensajes del protocolo debe salir por stdout
      // Un argumento mal escrito no arranca el servidor: antes se ignoraba y se exponía el perfil por defecto (completo)
      const { leerArgumentosMcp } = await import("../core/mcp/argumentos.js");
      const a = leerArgumentosMcp(args.slice(1));
      if (a.ok === false) { process.stderr.write(`[forge mcp] ${a.error}\n`); process.exitCode = 1; break; }
      const { iniciarServidor } = await import("../core/mcp/servidor.js");
      try {
        await iniciarServidor({ cwd: a.cwd, perfil: a.perfil });
      } catch (e) {
        process.stderr.write(`[forge mcp] ${e instanceof Error ? e.message : e}\n`);
        process.exitCode = 1;
      }
      break;
    }
    case "adr": {
      // forge adr <raíz> <glob> [--update-ledger]: busca ADRs en el código. Los comandos y skills del plugin
      // llaman a esto en lugar de a una ruta relativa que no existe en el proyecto del usuario.
      const { spawnSync } = await import("node:child_process");
      const script = fileURLToPath(new URL("../utils/adr-parser.js", import.meta.url));
      const r = spawnSync(process.execPath, [script, ...args.slice(1)], { stdio: "inherit" });
      process.exit(r.status ?? 1);
      break;
    }
    case "run":
    case "resume": {
      if (args.includes("--help") || args.includes("-h")) { uso(); break; }
      const { main: engineMain } = await import("../core/engine-cli.js");
      process.argv = [process.argv[0], process.argv[1], comando, ...args.slice(1)];
      await engineMain();
      break;
    }
    case "--version":
    case "-v":
      console.log(pluginVersion());
      break;
    case "--help":
    case "-h":
    case "help":
    case "ayuda":
    case undefined:
      uso();
      break;
    default:
      error(`Comando desconocido: '${comando}'. Usa 'forge --help'.`);
  }
}

main();

