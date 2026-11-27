#!/usr/bin/env node
// @ts-check
/**
 * Ejecuta la suite de Fragua en Linux desde Windows (o cualquier sistema).
 *
 *   node scripts/probar-en-linux.mjs [--via docker|wsl] [--archivo <ruta>] [--node 20|22]
 *                                    [--solo-comprobar] [--con-docker-real]
 *
 * Trabaja sobre una COPIA del último commit (git archive HEAD), nunca sobre el
 * árbol de trabajo en vivo: así no se mezcla node_modules de Windows con Linux.
 * Eso implica que NO prueba cambios sin commitear. Sin dependencias.
 *
 * Códigos de salida: 0 pasó; el de la prueba si falló; 2 prerrequisito ausente
 * (Docker apagado, sin distro de WSL); 64 opciones inválidas; 70 error propio.
 */
import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * @param {string[]} argv
 * @returns {{via:string,archivo:string|null,node:string,soloComprobar:boolean,conDockerReal:boolean,ayuda:boolean,errores:string[]}}
 */
export function parsearOpciones(argv) {
  const o = { via: "docker", archivo: null, node: "22", soloComprobar: false, conDockerReal: false, ayuda: false, errores: /** @type {string[]} */ ([]) };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const valor = () => {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith("--")) {
        o.errores.push(`Falta el valor de ${a}.`);
        return null;
      }
      i++;
      return v;
    };
    if (a === "--via") {
      const v = valor();
      if (v === "docker" || v === "wsl") o.via = v;
      else if (v !== null) o.errores.push(`--via debe ser docker o wsl (recibido: ${v}).`);
    } else if (a === "--node") {
      const v = valor();
      if (v === "20" || v === "22") o.node = v;
      else if (v !== null) o.errores.push(`--node debe ser 20 o 22 (recibido: ${v}).`);
    } else if (a === "--archivo") {
      const v = valor();
      if (v !== null) {
        const ruta = v.replace(/\\/g, "/");
        if (!/^[\w./@-]+$/.test(ruta) || ruta.split("/").includes("..") || ruta.startsWith("/")) {
          o.errores.push(`--archivo debe ser una ruta relativa dentro del repositorio, sin espacios ni «..» (recibido: ${v}).`);
        } else o.archivo = ruta;
      }
    } else if (a === "--solo-comprobar") o.soloComprobar = true;
    else if (a === "--con-docker-real") o.conDockerReal = true;
    else if (a === "--ayuda" || a === "-h" || a === "--help") o.ayuda = true;
    else o.errores.push(`Opción desconocida: ${a}`);
  }
  return o;
}

/** @param {string|null} archivo */
function ordenDePrueba(archivo) {
  return archivo ? `npm ci && node --test ${archivo}` : "npm ci && npm test";
}

/**
 * Orden de `docker run` como arreglo de argumentos (sin intérprete de órdenes en el anfitrión).
 * @param {{node:string,archivo:string|null,directorioCopia:string,conDockerReal:boolean}} p
 */
export function construirOrdenDocker({ node, archivo, directorioCopia, conDockerReal }) {
  const args = ["run", "--rm", "-v", `${directorioCopia}:/work`, "-w", "/work", "-e", "CI=true"];
  if (conDockerReal) args.push("-v", "/var/run/docker.sock:/var/run/docker.sock", "-e", "FORGE_TEST_DOCKER=1");
  args.push(`node:${node}`, "sh", "-c", ordenDePrueba(archivo));
  return { cmd: "docker", args };
}

/** C:\a\b -> /mnt/c/a/b (las rutas que ya son POSIX se dejan). @param {string} ruta */
export function rutaWindowsAWsl(ruta) {
  const m = /^([A-Za-z]):[\\/](.*)$/.exec(ruta);
  return m ? `/mnt/${m[1].toLowerCase()}/${m[2].replace(/\\/g, "/")}` : ruta.replace(/\\/g, "/");
}

/**
 * Orden de `wsl`: extrae el tar en ~/fragua-prueba de la distro y ejecuta ahí.
 * @param {{distro:string,archivo:string|null,rutaTar:string}} p
 */
export function construirOrdenWsl({ distro, archivo, rutaTar }) {
  const tar = rutaWindowsAWsl(rutaTar).replace(/'/g, "'\\''");
  const guion =
    `set -e; D="$HOME/fragua-prueba"; rm -rf "$D"; mkdir -p "$D"; ` +
    `tar -xf '${tar}' -C "$D"; cd "$D"; ${ordenDePrueba(archivo)}`;
  return { cmd: "wsl", args: ["-d", distro, "--", "sh", "-c", guion] };
}

/** `wsl -l -q` sale en UTF-16: quita los NUL y las líneas vacías. @param {string} texto */
export function listarDistros(texto) {
  return String(texto ?? "")
    .replace(/\0/g, "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/** @param {string[]} distros */
export function distroUtilizable(distros) {
  return distros.find((d) => !d.toLowerCase().startsWith("docker-desktop")) ?? null;
}

/**
 * @typedef {(cmd:string,args:string[],opts?:object)=>{status:number|null,stdout?:string,stderr?:string,error?:Error}} Ejecutor
 */

/** @param {Ejecutor} ejecutor */
export function comprobarDocker(ejecutor) {
  const r = ejecutor("docker", ["info"]);
  if (!r.error && r.status === 0) return { ok: true, codigo: 0, mensaje: "Docker responde." };
  return {
    ok: false,
    codigo: 2,
    mensaje:
      "Docker no responde. Arranca Docker Desktop, espera a que diga «Engine running» y vuelve a ejecutar. " +
      "(Si no lo tienes instalado, usa --via wsl o la CI de GitHub: docs/PRUEBAS-EN-LINUX.md.)",
  };
}

/** @param {Ejecutor} ejecutor */
export function comprobarWsl(ejecutor) {
  const r = ejecutor("wsl", ["-l", "-q"]);
  const distro = r.error || r.status !== 0 ? null : distroUtilizable(listarDistros(r.stdout ?? ""));
  if (distro) return { ok: true, codigo: 0, distro, mensaje: `WSL: distro «${distro}».` };
  return {
    ok: false,
    codigo: 2,
    distro: null,
    mensaje:
      "No hay una distro de WSL utilizable (docker-desktop no cuenta). Instala una desde PowerShell: " +
      "wsl --install -d Ubuntu. Reinicia si lo pide, crea el usuario de Linux y vuelve a ejecutar.",
  };
}

/** Totales de la salida del ejecutor de Node (formato spec «ℹ tests N» o TAP «# tests N»). @param {string} texto */
export function resumirRegistro(texto) {
  /** @type {Record<string,number>} */
  const t = {};
  for (const m of String(texto).matchAll(/^(?:#|ℹ)\s*(tests|pass|fail|skipped)\s+(\d+)/gm)) t[m[1]] = Number(m[2]);
  if (t.tests === undefined) return null;
  return { tests: t.tests, pass: t.pass ?? 0, fail: t.fail ?? 0, skipped: t.skipped ?? 0 };
}

/** Ejecutor real, síncrono y corto. @type {Ejecutor} */
function ejecutorReal(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", timeout: 60_000, windowsHide: true, ...opts });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, error: r.error };
}

/** Ejecutor largo: transmite la salida a pantalla y a un archivo de registro. */
function ejecutarLargoReal(cmd, args, { registro }) {
  return new Promise((resolver) => {
    const log = createWriteStream(registro);
    const hijo = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    const volcar = (flujo, destino) =>
      flujo.on("data", (d) => {
        log.write(d);
        destino.write(d);
      });
    volcar(hijo.stdout, process.stdout);
    volcar(hijo.stderr, process.stderr);
    hijo.on("error", (e) => {
      log.end(`\nError al lanzar ${cmd}: ${e.message}\n`);
      resolver({ status: 70, registro });
    });
    hijo.on("close", (codigo) => log.end(() => resolver({ status: codigo ?? 70, registro })));
  });
}

/** Copia del último commit en un directorio temporal. */
function prepararCopiaReal() {
  const base = mkdtempSync(join(tmpdir(), "fragua-linux-"));
  const tar = join(base, "repo.tar");
  const directorio = join(base, "copia");
  mkdirSync(directorio);
  const a = spawnSync("git", ["archive", "--format=tar", "-o", tar, "HEAD"], { cwd: RAIZ, encoding: "utf8" });
  if (a.status !== 0) throw new Error(`git archive falló: ${a.stderr || a.error?.message}`);
  const x = spawnSync("tar", ["-xf", tar, "-C", directorio], { encoding: "utf8" });
  if (x.status !== 0) throw new Error(`tar falló: ${x.stderr || x.error?.message}`);
  return { base, directorio, tar, limpiar: () => rmSync(directorio, { recursive: true, force: true }) };
}

const AYUDA = `Uso: node scripts/probar-en-linux.mjs [opciones]
  --via docker|wsl     Dónde correr (por defecto docker)
  --archivo <ruta>     Un solo archivo de prueba, p. ej. tests/sandbox.test.js
  --node 20|22         Versión de Node del contenedor (por defecto 22; solo docker)
  --solo-comprobar     Verifica prerrequisitos y sale
  --con-docker-real    Monta el socket de Docker en el contenedor (RIESGO: ver docs/PRUEBAS-EN-LINUX.md)
Prueba el último commit, no los cambios sin commitear.`;

/**
 * @param {string[]} argv
 * @param {{ejecutor?:Ejecutor,salida?:{escribir:(t:string)=>void},prepararCopia?:Function,ejecutarLargo?:Function,leerRegistro?:(ruta:string)=>string}} [deps]
 * @returns {Promise<number>}
 */
export async function principal(argv, deps = {}) {
  const ejecutor = deps.ejecutor ?? ejecutorReal;
  const salida = deps.salida ?? { escribir: (t) => console.log(t) };
  const prepararCopia = deps.prepararCopia ?? prepararCopiaReal;
  const ejecutarLargo = deps.ejecutarLargo ?? ejecutarLargoReal;
  const leerRegistro = deps.leerRegistro ?? ((r) => readFileSync(r, "utf8"));

  const o = parsearOpciones(argv);
  if (o.ayuda) {
    salida.escribir(AYUDA);
    return 0;
  }
  if (o.errores.length) {
    salida.escribir(o.errores.join("\n") + "\n\n" + AYUDA);
    return 64;
  }

  const pre = o.via === "docker" ? comprobarDocker(ejecutor) : comprobarWsl(ejecutor);
  if (!pre.ok) {
    salida.escribir(pre.mensaje);
    return pre.codigo;
  }
  salida.escribir(pre.mensaje);
  if (o.soloComprobar) {
    salida.escribir("Prerrequisitos correctos. No se ha ejecutado nada.");
    return 0;
  }
  if (o.conDockerReal) {
    salida.escribir("AVISO: --con-docker-real da al contenedor control sobre el Docker de tu equipo. Úsalo solo con código en el que confíes.");
  }

  let copia;
  try {
    copia = prepararCopia();
  } catch (e) {
    salida.escribir(`No se pudo preparar la copia: ${e instanceof Error ? e.message : e}`);
    return 70;
  }
  const registro = join(copia.base ?? dirname(copia.tar), "registro-linux.log");
  const orden =
    o.via === "docker"
      ? construirOrdenDocker({ node: o.node, archivo: o.archivo, directorioCopia: copia.directorio, conDockerReal: o.conDockerReal })
      : construirOrdenWsl({ distro: /** @type {string} */ (/** @type {any} */ (pre).distro), archivo: o.archivo, rutaTar: copia.tar });

  salida.escribir(`Ejecutando en Linux (${o.via}${o.via === "docker" ? ", node:" + o.node : ""}) sobre una copia de HEAD. Registro: ${registro}`);
  const r = await ejecutarLargo(orden.cmd, orden.args, { registro });
  try {
    copia.limpiar?.();
  } catch {
    /* la copia está en el directorio temporal; no es crítico */
  }

  let texto = "";
  try {
    texto = leerRegistro(registro);
  } catch {
    /* sin registro: se informa solo el código */
  }
  const t = resumirRegistro(texto);
  salida.escribir(
    t
      ? `Resumen. Pruebas: ${t.tests}, pasan: ${t.pass}, fallan: ${t.fail}, saltadas: ${t.skipped}. Código de salida: ${r.status}.`
      : `Sin totales en el registro. Código de salida: ${r.status}.`,
  );
  return r.status ?? 70;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  principal(process.argv.slice(2)).then(
    (c) => process.exit(c),
    (e) => {
      console.error(e);
      process.exit(70);
    },
  );
}
