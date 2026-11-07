// @ts-check
import { readdirSync, readFileSync, realpathSync } from "node:fs";
import { join, dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { execSync } from "node:child_process";
import { copiarArbol, copiarArchivo, crearArchivo, crearDirectorio, ErrorEnlace, escribirArchivo, leerArchivo } from "../../core/escritura-segura.js";


const __dirname = dirname(fileURLToPath(import.meta.url));
/** Raíz del plugin (un nivel arriba de cli/). */
export const PLUGIN_DIR = join(__dirname, "..", "..");

const tty = process.stdout.isTTY;
export const c = {
  verde: (s) => (tty ? `\x1b[0;32m${s}\x1b[0m` : s),
  amarillo: (s) => (tty ? `\x1b[1;33m${s}\x1b[0m` : s),
  rojo: (s) => (tty ? `\x1b[0;31m${s}\x1b[0m` : s),
  azul: (s) => (tty ? `\x1b[0;34m${s}\x1b[0m` : s),
};

export const info = (msg) => console.log(`${c.verde("✓")} ${msg}`);
export const aviso = (msg) => console.log(`${c.amarillo("⚠")}  ${msg}`);
export const titulo = (msg) => console.log(`${c.azul("❯")} ${msg}`);
export function error(msg) {
  console.error(`${c.rojo("✗")} ${msg}`);
  process.exit(1);
}

// ─── Escritura segura (revisión independiente de la fase 9, H-01) ───────────────────
//
// `forge init` corre dentro de un repositorio que puede ser ajeno. Todo lo que escribe pasa por
// core/escritura-segura.js: no sigue enlaces simbólicos ni uniones (tampoco colgantes), no sale de
// la raíz de escritura y no sobrescribe a través de un enlace. Si el destino es un enlace, se
// informa y no se escribe.

/**
 * Raíces de escritura. Con `--global` hay dos destinos: `~/.claude` (comandos, agentes, skills, hooks
 * y settings) y el proyecto (`.sdd`, `.forge-ui`, ...). Cada ruta se escribe con la raíz que la contiene;
 * una ruta fuera de las dos se rechaza. Sin `fijarRaices`, la única raíz es el directorio actual.
 * @type {{ raiz: string, enlacesPermitidos?: string[] }[] | null}
 */
export let raices = null;

/** Directorio del proyecto, con las uniones ya resueltas (se fija en `fijarRaices`). */
export let PROYECTO = process.cwd();

/** Rutas que no se pudieron escribir en esta ejecución: el comando no puede acabar diciendo «listo». */
export const sinEscribir = /** @type {string[]} */ ([]);

/** Subcarpetas de `~/.claude` que pueden ser una unión del usuario (p. ej. a un repositorio de dotfiles). */
export const CARPETAS_GLOBALES_ENLAZABLES = ["commands", "agents", "skills", "hooks"];

/**
 * Fija las raíces de escritura y devuelve la carpeta `.claude` de destino.
 * @param {{ global?: boolean }} [o]
 * @returns {string}
 */
export function fijarRaices(o = {}) {
  // Una raíz que es una unión (el proyecto abierto a través de una) se resuelve una sola vez y se usa esa
  try { PROYECTO = realpathSync(process.cwd()); } catch { PROYECTO = process.cwd(); }
  raices = [{ raiz: PROYECTO }];
  const claudeDir = o.global ? join(homedir(), ".claude") : join(PROYECTO, ".claude");
  if (o.global) {
    // Decisión (N-14): `~/.claude/commands` como unión a los dotfiles del usuario es un caso común y es
    // SUYA: solo esas cuatro subcarpetas, solo en lo global y solo si el enlace ya existía (FORGE nunca
    // crea enlaces). En un proyecto, ningún enlace se sigue.
    raices.push({ raiz: claudeDir, enlacesPermitidos: CARPETAS_GLOBALES_ENLAZABLES.map((d) => join(claudeDir, d)) });
  }
  return claudeDir;
}

/** La raíz de escritura que contiene `ruta`: la más específica. */
export function raizPara(ruta) {
  const todas = raices ?? [{ raiz: process.cwd() }];
  const abs = resolve(ruta);
  const minus = (s) => (process.platform === "win32" ? s.toLowerCase() : s);
  const contiene = (r) => { const rel = relative(minus(resolve(r.raiz)), minus(abs)); return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel)); };
  const candidatas = todas.filter(contiene).sort((a, b) => resolve(b.raiz).length - resolve(a.raiz).length);
  return candidatas[0] ?? todas[todas.length - 1];
}

/** Ejecuta una escritura o lectura; un enlace o un error del sistema de archivos se informa y se sigue con lo demás. @returns {any} */
export function protegido(fn, ruta = "") {
  try { return fn(); } catch (e) {
    const codigo = /** @type {any} */ (e)?.code;
    if (e instanceof ErrorEnlace) {
      aviso(`No se escribe: ${e.message}`);
      sinEscribir.push(e.ruta);
      return undefined;
    }
    // EISDIR, ENOTDIR, EBUSY, EPERM, EACCES, EEXIST...: un destino raro no tumba `init` con una traza
    if (typeof codigo === "string" && /^E[A-Z]+$/.test(codigo)) {
      const donde = ruta || /** @type {any} */ (e).path || "";
      aviso(`No se escribe${donde ? ` ${donde}` : ""}: ${codigo} (${/** @type {Error} */ (e).message.split(", ")[0]})`);
      sinEscribir.push(String(donde || codigo));
      return undefined;
    }
    throw e;
  }
}

/** Un paso de `init` o `update` que no puede tumbar el resto. */
export function paso(nombre, fn) {
  try { return fn(); } catch (e) {
    aviso(`${nombre}: ${e instanceof Error ? e.message : e}`);
    sinEscribir.push(nombre);
    return undefined;
  }
}

/**
 * Cierre de `init`/`update`: con rutas sin escribir NO se dice que quedó listo.
 * @returns {boolean} true si todo se escribió
 */
export function cerrarSiFalto(que) {
  if (sinEscribir.length === 0) return true;
  const unicas = [...new Set(sinEscribir)];
  console.log("");
  aviso(`${que} NO terminó bien: ${unicas.length} ruta(s) sin escribir (avisos «No se escribe» de arriba):`);
  for (const r of unicas.slice(0, 15)) console.log(`    - ${r}`);
  if (unicas.length > 15) console.log(`    ... y ${unicas.length - 15} más`);
  console.log("  Cada una es un enlace, una unión o un archivo que FORGE no escribe a través de; resuélvelo y vuelve a ejecutar el comando.");
  console.log("  Para instalar a mano, copia el contenido de commands/, agents/, skills/ y claude-hooks/ del plugin a la carpeta que no se pudo escribir.");
  process.exitCode = 1;
  return false;
}

/** Crea un directorio dentro de la raíz de escritura. */
export function crearDir(dir) { return protegido(() => crearDirectorio(raizPara(dir), dir), dir); }

/** Crea un archivo que no existe (nunca sobrescribe). true si lo creó. */
export function crearNuevo(ruta, contenido) { return protegido(() => crearArchivo(raizPara(ruta), ruta, contenido), ruta) === true; }

/** Deja el archivo con este contenido (lo crea o lo reemplaza si es un archivo normal). true si lo escribió. */
export function escribirSeguro(ruta, contenido) { return protegido(() => { escribirArchivo(raizPara(ruta), ruta, contenido); return true; }, ruta) === true; }

/** Lee un archivo del proyecto sin seguir enlaces ni abrir tuberías. null si no existe o no se puede leer (con aviso). */
export function leerSeguro(ruta) {
  try { return leerArchivo(raizPara(ruta), ruta); } catch (e) {
    if (e instanceof ErrorEnlace) { aviso(`No se lee: ${e.message}`); return null; }
    const codigo = /** @type {any} */ (e)?.code;
    if (typeof codigo === "string") { aviso(`No se lee ${ruta}: ${codigo}`); return null; }
    throw e;
  }
}

// ─── Utilidades de copia ────────────────────────────────────────────────────────

/** Copia todos los .md de un directorio origen a uno destino. Devuelve cuántos. */
export function copyMd(srcDir, destDir, incluir = null) {
  if (crearDir(destDir) === undefined) return 0;
  const archivos = readdirSync(srcDir).filter((f) => f.endsWith(".md") && (incluir === null || incluir(f)));
  let n = 0;
  for (const f of archivos) {
    if (protegido(() => { copiarArchivo(raizPara(destDir), join(srcDir, f), join(destDir, f)); return true; }, join(destDir, f))) n++;
  }
  return n;
}

/** Copia un directorio completo (recursivo). */
export function copyDir(srcDir, destDir) {
  const { bloqueados } = copiarArbol(raizPara(destDir), srcDir, destDir);
  for (const b of bloqueados) { aviso(`No se escribe: es un enlace o pasa por uno: ${b}`); sinEscribir.push(b); }
}

/** Copia un archivo suelto del plugin. true si lo copió. */
export function copiarSeguro(origen, destino) {
  return protegido(() => { copiarArchivo(raizPara(destino), origen, destino); return true; }, destino) === true;
}

export function pluginVersion() {
  try {
    const pkg = JSON.parse(
      readFileSync(join(PLUGIN_DIR, "package.json"), "utf8")
    );
    return pkg.version || "desconocida";
  } catch {
    return "desconocida";
  }
}

/** ¿Está `claude` en el PATH? */
export function claudeEnPath() {
  try {
    execSync(process.platform === "win32" ? "where claude" : "command -v claude", {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}
