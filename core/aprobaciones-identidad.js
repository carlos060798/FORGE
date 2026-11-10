/**
 * aprobaciones-identidad.js — Aprobaciones con identidad, hash del artefacto y registro firmado
 * (spec 2026-11-06-aprobaciones-con-identidad; hallazgo C-03 de docs/informes/SEGURIDAD-CIBER.md)
 *
 * Qué hace:
 *   1. `exigirTerminal`        una aprobación exige un terminal interactivo real (stdin y stdout son TTY).
 *   2. `confirmarConCodigo`    muestra un código de un solo uso en el terminal y exige que la persona lo
 *                              teclee. El código se genera en cada intento y no se guarda en ningún sitio.
 *   3. `registrarAprobacion`   deja en `.sdd/aprobaciones.jsonl` (solo adición) quién (git config
 *                              user.email / user.name, o el usuario del SO), cuándo (ISO), qué (tipo + id)
 *                              y el SHA-256 del artefacto aprobado. Cada línea lleva un HMAC-SHA256 con la
 *                              clave local del usuario (core/estado-usuario.js, la misma de la cadena de
 *                              evidencia y de la cola de integraciones) y el HMAC de la línea anterior, así
 *                              que borrar, reordenar o editar una línea del medio se detecta.
 *   4. `comprobarDelegaciones` un artefacto con `estado: aprobado_por_delegacion` solo vale si hay un
 *                              registro verificable (firma, cadena y hash vigente del archivo).
 *   5. `firmarEvento`          firma los eventos de `forge step --force` (motivo obligatorio).
 *
 * LÍMITE (dicho sin adornos). El agente de código corre con el MISMO usuario del sistema operativo que la
 * persona. Esa clave HMAC es un archivo que ese usuario puede leer, así que un proceso con sus permisos
 * puede, en teoría, (a) leer la clave y fabricar registros firmados, o (b) abrir un seudoterminal
 * (pty), leer el código en pantalla y teclearlo. NO hay separación criptográfica total entre «la persona» y
 * «el agente» mientras compartan usuario del SO. Lo que sí consigue esta mitigación:
 *   - un agente que ejecuta `forge aprobar` desde una herramienta sin terminal (el caso normal de Claude
 *     Code, scripts, CI) es rechazado; no existe ninguna opción para saltarse el terminal;
 *   - el humano ve y teclea un código: una aprobación accidental o automática por flujo es imposible;
 *   - lo aprobado queda atribuido, fechado y atado al hash del archivo: cambiar el archivo después
 *     invalida la aprobación y editar el registro a mano rompe la firma;
 *   - el truncado de las ÚLTIMAS líneas del registro no se detecta (como en la cadena de evidencia).
 * Cerrar el límite de verdad exige guardar la clave fuera del alcance del agente: llavero del SO (DPAPI en
 * Windows, Keychain en macOS) o firma asimétrica con una clave que pida confirmación. Es una decisión
 * futura (ADR); aquí NO se implementa. Sin dependencias nuevas, sin red.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { appendFileSync, lstatSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { userInfo } from 'node:os';
import { join, isAbsolute } from 'node:path';
import { createInterface } from 'node:readline';
import { leerArchivo } from './escritura-segura.js';
import { claveLocal, directorioDeEstado, existeEstado, firmar, firmaValida } from './estado-usuario.js';

export const VERSION_REGISTRO = 1;
export const ARCHIVO_REGISTRO = '.sdd/aprobaciones.jsonl';
export const TIPOS = Object.freeze(['spec', 'delegacion']);
export const MIN_MOTIVO = 10;
const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O/1/I
const LARGO_CODIGO = 6;
const MAX_REGISTRO_BYTES = 4 * 1024 * 1024;

export class ErrorIdentidad extends Error {
  /** @param {string} codigo @param {string} mensaje */
  constructor(codigo, mensaje) {
    super(mensaje);
    this.name = 'ErrorIdentidad';
    this.codigo = codigo;
  }
}

/** @typedef {Record<string, string|undefined>} Entorno */
/** @typedef {{ email: string|null, nombre: string|null, usuarioSO: string }} Quien */
/**
 * @typedef {Object} Registro
 * @property {number} version
 * @property {'spec'|'delegacion'} tipo
 * @property {string} id           identificador de lo aprobado (spec activa, o «<carpeta>/<archivo>.md»)
 * @property {string} artefacto    ruta relativa al proyecto del archivo aprobado
 * @property {string} sha256       SHA-256 del contenido del artefacto en el momento de aprobar
 * @property {Quien} quien
 * @property {string} cuando       ISO 8601
 * @property {string|null} anterior HMAC de la línea previa (null en la primera)
 * @property {string} hmac
 */

// ── Terminal y código de un solo uso ─────────────────────────────────────────────────────────

/**
 * Rechaza si no hay un terminal interactivo real. No hay variable de entorno ni opción que lo salte.
 * @param {{ isTTY?: boolean }} stdin @param {{ isTTY?: boolean }} stdout
 */
export function exigirTerminal(stdin, stdout) {
  if (stdin?.isTTY === true && stdout?.isTTY === true) return;
  throw new ErrorIdentidad('sin_tty',
    'Aprobar exige un terminal interactivo real (stdin y stdout deben ser un TTY) y que una persona teclee el código que se muestra. '
    + 'No hay forma de saltarse este requisito: ejecuta «forge aprobar» tú, en tu propia terminal, no desde un agente, un script ni la CI.');
}

/** Código de un solo uso: 6 caracteres de un alfabeto sin ambigüedades. @param {(n: number) => Buffer} [aleatorio] */
export function generarCodigo(aleatorio = randomBytes) {
  const b = aleatorio(LARGO_CODIGO);
  let c = '';
  for (let i = 0; i < LARGO_CODIGO; i++) c += ALFABETO_CODIGO[b[i] % ALFABETO_CODIGO.length];
  return c;
}

/**
 * Lector real: una línea del terminal. Rechaza si el flujo se cierra sin respuesta.
 * @param {NodeJS.ReadableStream} stdin @param {NodeJS.WritableStream} stdout @param {string} pregunta
 * @returns {Promise<string>}
 */
export function leerLineaDeTerminal(stdin, stdout, pregunta) {
  return new Promise((resolver, rechazar) => {
    const rl = createInterface({ input: stdin, output: stdout, terminal: true });
    let respondida = false;
    rl.on('close', () => { if (!respondida) rechazar(new ErrorIdentidad('sin_respuesta', 'No se recibió ninguna respuesta; no se aprueba nada.')); });
    rl.question(pregunta, (r) => { respondida = true; rl.close(); resolver(r); });
  });
}

/**
 * Muestra un código nuevo y exige que se teclee igual. Un solo intento: si falla, hay que volver a lanzar el
 * comando (y saldrá un código distinto).
 * @param {{ escribir: (t: string) => void, leerLinea: (pregunta: string) => Promise<string>, codigo?: string }} o
 * @returns {Promise<void>}
 */
export async function confirmarConCodigo(o) {
  const codigo = o.codigo ?? generarCodigo();
  o.escribir(`\nPara confirmar que eres una persona y has revisado esto, teclea el código: ${codigo}\n`);
  const dado = String((await o.leerLinea('Código: ')) ?? '').trim().toUpperCase();
  const a = Buffer.from(dado);
  const b = Buffer.from(codigo);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new ErrorIdentidad('codigo_incorrecto', 'El código no coincide: no se aprueba nada. Vuelve a ejecutar el comando (el código cambia en cada intento).');
  }
}

// ── Identidad y hash ────────────────────────────────────────────────────────────────────────

/**
 * Quién aprueba: `git config user.email` / `user.name`; si no hay, el usuario del SO (siempre se anota).
 * @param {string} cwd @param {(cmd: string, args: string[], o: any) => string} [ejecutar]
 * @returns {Quien}
 */
export function identidadDelAprobador(cwd, ejecutar = (c, a, o) => execFileSync(c, a, o)) {
  /** @param {string} clave */
  const git = (clave) => {
    try {
      const v = String(ejecutar('git', ['config', '--get', clave], { cwd, encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] })).trim();
      return v === '' ? null : v.replace(/[\p{Cc}\p{Cf}]/gu, ' ').slice(0, 200);
    } catch { return null; }
  };
  let usuarioSO = 'desconocido';
  try { usuarioSO = userInfo().username || usuarioSO; } catch { /* sin usuario */ }
  return { email: git('user.email'), nombre: git('user.name'), usuarioSO };
}

/** SHA-256 hex de un texto o buffer. @param {string|Buffer} contenido */
export const sha256De = (contenido) => createHash('sha256').update(contenido).digest('hex');

/** Hash del archivo del proyecto sin seguir enlaces; null si no existe. @param {string} cwd @param {string} rutaAbs */
export function hashDeArchivo(cwd, rutaAbs) {
  const t = leerArchivo(cwd, rutaAbs, { maxBytes: MAX_REGISTRO_BYTES });
  return t === null ? null : sha256De(t);
}

// ── Registro firmado ────────────────────────────────────────────────────────────────────────

/** @param {string} cwd */
const rutaRegistro = (cwd) => join(cwd, '.sdd', 'aprobaciones.jsonl');

/**
 * Lee y verifica el registro. Solo lectura: no crea clave ni carpeta de estado.
 * @param {string} cwd @param {Entorno} [env]
 * @returns {{ registros: Registro[], errores: string[], existe: boolean }}
 */
export function leerRegistro(cwd, env = process.env) {
  /** @type {string|null} */
  let texto = null;
  try { texto = leerArchivo(cwd, rutaRegistro(cwd), { maxBytes: MAX_REGISTRO_BYTES }); } catch (e) {
    return { registros: [], errores: [`${ARCHIVO_REGISTRO} no se pudo leer de forma segura: ${e instanceof Error ? e.message : e}`], existe: true };
  }
  if (texto === null) return { registros: [], errores: [], existe: false };
  if (!existeEstado(cwd, env)) {
    return { registros: [], errores: [`${ARCHIVO_REGISTRO} existe pero este usuario no tiene clave local para este proyecto: no se puede verificar nada (¿otro equipo o estado borrado?)`], existe: true };
  }
  const clave = claveLocal(directorioDeEstado(cwd, env));
  /** @type {Registro[]} */
  const registros = [];
  /** @type {string[]} */
  const errores = [];
  let previo = null;
  texto.split('\n').forEach((linea, i) => {
    if (linea.trim() === '') return;
    let v;
    try { v = JSON.parse(linea); } catch { errores.push(`línea ${i + 1}: no es JSON`); return; }
    if (!v || typeof v !== 'object' || Array.isArray(v)) { errores.push(`línea ${i + 1}: forma no válida`); return; }
    const { hmac, ...sin } = v;
    if (!firmaValida(clave, sin, hmac)) { errores.push(`línea ${i + 1}: la firma no vale (editada o creada sin la clave de este usuario)`); return; }
    if ((sin.anterior ?? null) !== previo) { errores.push(`línea ${i + 1}: la cadena no encaja (falta o sobra una línea anterior)`); }
    previo = hmac;
    if (sin.version !== VERSION_REGISTRO || !TIPOS.includes(sin.tipo) || typeof sin.id !== 'string' || !/^[0-9a-f]{64}$/.test(String(sin.sha256))) {
      errores.push(`línea ${i + 1}: campos no válidos`); return;
    }
    registros.push(/** @type {Registro} */ (v));
  });
  return { registros, errores, existe: true };
}

/**
 * Añade una aprobación al registro (solo adición). Quien llama ya comprobó TTY y código.
 * @param {string} cwd
 * @param {{ tipo: 'spec'|'delegacion', id: string, artefacto: string, sha256: string, quien: Quien }} d
 * @param {{ env?: Entorno, ahora?: Date }} [o]
 * @returns {Registro}
 */
export function registrarAprobacion(cwd, d, o = {}) {
  const env = o.env ?? process.env;
  if (!TIPOS.includes(d.tipo)) throw new ErrorIdentidad('tipo_no_valido', `Tipo de aprobación no válido: ${d.tipo}`);
  if (!/^[0-9a-f]{64}$/.test(d.sha256)) throw new ErrorIdentidad('hash_no_valido', 'Falta el hash del artefacto aprobado.');
  const ruta = rutaRegistro(cwd);
  try {
    const st = lstatSync(ruta);
    if (!st.isFile() || st.isSymbolicLink()) throw new ErrorIdentidad('registro_no_normal', `${ARCHIVO_REGISTRO} no es un archivo normal; no se escribe.`);
    if (st.nlink > 1) throw new ErrorIdentidad('registro_no_normal', `${ARCHIVO_REGISTRO} es un enlace duro; no se escribe.`);
  } catch (e) { if (e instanceof ErrorIdentidad) throw e; }
  const previo = leerRegistro(cwd, env);
  if (previo.errores.length > 0) {
    throw new ErrorIdentidad('registro_roto', `${ARCHIVO_REGISTRO} no es íntegro (${previo.errores[0]}); no se añade nada encima. Revísalo antes.`);
  }
  const clave = claveLocal(directorioDeEstado(cwd, env));
  const ultimo = previo.registros.at(-1);
  const sin = {
    version: VERSION_REGISTRO, tipo: d.tipo, id: d.id, artefacto: d.artefacto, sha256: d.sha256, quien: d.quien,
    cuando: (o.ahora ?? new Date()).toISOString(), anterior: ultimo?.hmac ?? null,
  };
  const registro = /** @type {Registro} */ ({ ...sin, hmac: firmar(clave, sin) });
  appendFileSync(ruta, `${JSON.stringify(registro)}\n`, { encoding: 'utf8', flag: 'a' });
  return registro;
}

/**
 * ¿Hay una aprobación verificable de `id` con ese hash? (la más reciente que coincida)
 * @param {string} cwd @param {{ tipo?: string, id: string, sha256: string }} q @param {Entorno} [env]
 */
export function buscarAprobacion(cwd, q, env = process.env) {
  const { registros, errores } = leerRegistro(cwd, env);
  if (errores.length > 0) return null;
  return [...registros].reverse().find((r) => r.id === q.id && r.sha256 === q.sha256 && (q.tipo === undefined || r.tipo === q.tipo)) ?? null;
}

/**
 * Archivo de la spec que se aprueba (el borrador indicado o el spec.md de la spec activa) y el id con el que se registra.
 * @param {string} cwd @param {Record<string, any>} estado
 * @returns {{ ruta: string, id: string }}
 */
export function specDeEstado(cwd, estado) {
  const ruta = estado.spec_draft_path
    ? (isAbsolute(String(estado.spec_draft_path)) ? String(estado.spec_draft_path) : join(cwd, String(estado.spec_draft_path)))
    : join(cwd, '.sdd', 'especificaciones', String(estado.spec_activa), 'spec.md');
  return { ruta, id: String(estado.spec_activa ?? estado.spec_draft_path) };
}

/**
 * Puerta real de la spec: el booleano `spec_aprobado` de `.sdd/estado.json` lo puede escribir cualquiera con acceso al
 * archivo (informe REVERIFICACION-SEGURIDAD, C-03), así que pasar de `spec` a `plan` exige además el registro firmado
 * por `forge aprobar spec` con el hash VIGENTE del archivo: si la spec cambió después de aprobarse, hay que aprobarla de nuevo.
 * @param {string} cwd @param {Record<string, any>} estado @param {Entorno} [env]
 * @returns {string|null}  el motivo del rechazo, o null si hay aprobación verificable
 */
export function verificarAprobacionDeSpec(cwd, estado, env = process.env) {
  const { ruta, id } = specDeEstado(cwd, estado);
  let sha = null;
  try { sha = hashDeArchivo(cwd, ruta); } catch { sha = null; }
  if (sha === null) return 'No se puede leer la spec para comprobar su aprobación.';
  if (buscarAprobacion(cwd, { tipo: 'spec', id, sha256: sha }, env) === null) {
    return 'La spec no tiene una aprobación registrada y vigente en .sdd/aprobaciones.jsonl (nadie la aprobó con `forge aprobar spec` en un terminal, o el archivo cambió después). Ejecuta: forge aprobar spec';
  }
  return null;
}

// ── Aprobación completa (todo menos el efecto sobre estado.json) ────────────────────────────

/**
 * Flujo de una aprobación humana: terminal real → vista de lo que se aprueba → código → registro.
 * Las dependencias de entrada/salida se inyectan para poder probarlo sin un terminal; el CLI usa las reales.
 * @param {Object} o
 * @param {string} o.cwd
 * @param {'spec'|'delegacion'} o.tipo
 * @param {string} o.id
 * @param {string} o.artefacto        ruta relativa al proyecto
 * @param {string} o.sha256
 * @param {{ isTTY?: boolean }} o.stdin
 * @param {{ isTTY?: boolean }} o.stdout
 * @param {(pregunta: string) => Promise<string>} o.leerLinea
 * @param {(t: string) => void} o.escribir
 * @param {string} [o.codigo]          solo pruebas
 * @param {Entorno} [o.env]
 * @param {Date} [o.ahora]
 * @param {(cwd: string) => Quien} [o.identidad]
 * @returns {Promise<Registro>}
 */
export async function aprobarConIdentidad(o) {
  exigirTerminal(o.stdin, o.stdout);
  const quien = (o.identidad ?? identidadDelAprobador)(o.cwd);
  o.escribir(`\nVas a aprobar (${o.tipo}): ${o.id}\n  Archivo: ${o.artefacto}\n  SHA-256: ${o.sha256}\n  Como:    ${quien.nombre ?? '(sin user.name)'} <${quien.email ?? 'sin user.email'}> · usuario del SO: ${quien.usuarioSO}\n`);
  await confirmarConCodigo({ escribir: o.escribir, leerLinea: o.leerLinea, codigo: o.codigo });
  return registrarAprobacion(o.cwd, { tipo: o.tipo, id: o.id, artefacto: o.artefacto, sha256: o.sha256, quien }, { env: o.env, ahora: o.ahora });
}

// ── aprobado_por_delegacion ─────────────────────────────────────────────────────────────────

const ESTADO_DELEGADO = /^estado:\s*["']?aprobado_por_delegacion["']?\s*(?:#.*)?$/m;

/**
 * Busca en `.sdd/especificaciones/<id>/*.md` los archivos cuya cabecera dice `estado: aprobado_por_delegacion`
 * y exige, para cada uno, un registro verificable de tipo `delegacion` con ese id y el hash VIGENTE del
 * archivo. Solo lectura.
 * @param {string} cwd @param {Entorno} [env]
 * @returns {{ ok: boolean, delegaciones: { id: string, ok: boolean, motivo?: string }[], errores: string[] }}
 */
export function comprobarDelegaciones(cwd, env = process.env) {
  const base = join(cwd, '.sdd', 'especificaciones');
  /** @type {{ id: string, ok: boolean, motivo?: string }[]} */
  const delegaciones = [];
  /** @param {string} d */
  const listar = (d) => { try { return readdirSync(d, { withFileTypes: true }); } catch { return []; } };
  const registro = leerRegistro(cwd, env);
  for (const carpeta of listar(base)) {
    if (!carpeta.isDirectory()) continue;
    for (const f of listar(join(base, carpeta.name))) {
      if (!f.isFile() || !f.name.endsWith('.md')) continue;
      const abs = join(base, carpeta.name, f.name);
      let texto = null;
      try { texto = leerArchivo(cwd, abs, { maxBytes: MAX_REGISTRO_BYTES }); } catch { continue; }
      if (texto === null) continue;
      const cabecera = /^---\r?\n([\s\S]*?)\r?\n---/.exec(texto)?.[1] ?? '';
      if (!ESTADO_DELEGADO.test(cabecera)) continue;
      const id = `${carpeta.name}/${f.name}`;
      const sha = sha256De(texto);
      if (registro.errores.length > 0) { delegaciones.push({ id, ok: false, motivo: 'el registro de aprobaciones no es íntegro o no se puede verificar' }); continue; }
      const aprobacion = [...registro.registros].reverse().find((r) => r.tipo === 'delegacion' && r.id === id);
      if (!aprobacion) delegaciones.push({ id, ok: false, motivo: `sin registro verificable: la persona debe ejecutar «forge aprobar delegacion ${id}» en su terminal` });
      else if (aprobacion.sha256 !== sha) delegaciones.push({ id, ok: false, motivo: 'el archivo cambió después de la aprobación registrada (el hash no coincide)' });
      else delegaciones.push({ id, ok: true });
    }
  }
  return { ok: delegaciones.every((d) => d.ok), delegaciones, errores: registro.errores };
}

// ── Eventos firmados (step --force) ─────────────────────────────────────────────────────────

/**
 * Firma un evento con la clave local. Crea la clave si no existe.
 * @param {string} cwd @param {Record<string, unknown>} payload @param {Entorno} [env] @returns {string}
 */
export function firmarEvento(cwd, payload, env = process.env) {
  return firmar(claveLocal(directorioDeEstado(cwd, env)), payload);
}

/**
 * Comprueba la firma de un evento `pipeline_step_forzado`.
 * @param {string} cwd @param {{ payload?: Record<string, any> }} evento @param {Entorno} [env]
 */
export function eventoForzadoValido(cwd, evento, env = process.env) {
  const { firma, ...resto } = evento?.payload ?? {};
  if (!existeEstado(cwd, env)) return false;
  return firmaValida(claveLocal(directorioDeEstado(cwd, env)), resto, firma);
}

/** Lee `--motivo "x"` o `--motivo=x`. @param {string[]} args @returns {string|null} */
export function motivoDeArgs(args) {
  const i = args.findIndex((a) => a === '--motivo' || a.startsWith('--motivo='));
  if (i === -1) return null;
  const v = args[i].includes('=') ? args[i].split('=').slice(1).join('=') : (args[i + 1] ?? '');
  return v.trim() === '' ? null : v.trim();
}
