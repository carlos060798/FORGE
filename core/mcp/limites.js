/**
 * limites.js — Límites propios del servidor MCP (spec 2026-10-14-ciclo-por-mcp, HU-004)
 *
 * Todo sale del ENTORNO del usuario (FRAGUA_MCP_* / FORGE_MCP_*) y del estado del usuario fuera del
 * proyecto. Ningún archivo del repositorio se lee aquí, así que un proyecto no puede aflojarlos.
 *
 *   FRAGUA_MCP_TIMEOUT_S          tiempo máximo por llamada (300 s por defecto, techo 1800)
 *   FRAGUA_MCP_SALIDA_MAX_BYTES   tamaño máximo de la respuesta (16 KiB por defecto, techo 64 KiB)
 *   FRAGUA_MCP_POR_HORA / _POR_DIA  verificaciones permitidas (20 / 200 por defecto)
 *   FRAGUA_MCP_CICLO              «apagado» (o un valor que no se reconoce) apaga toda herramienta
 *
 * Los contadores van firmados (HMAC con la clave local) en el estado del usuario. Si el archivo está
 * dañado o la firma no coincide, NO se ejecuta: falla cerrado. Es una defensa contra un llamante
 * hostil y contra el descuido; quien ya controla el equipo del usuario puede borrar su estado.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { leerVariableRestrictiva } from '../entorno.js';
import { claveLocal, firmar, firmaValida } from '../estado-usuario.js';

export const LIMITES_POR_DEFECTO = Object.freeze({ timeout_s: 300, salida_max_bytes: 16384, por_hora: 20, por_dia: 200 });
export const LIMITES_TECHO = Object.freeze({ timeout_s: 1800, salida_max_bytes: 65536, por_hora: 1000, por_dia: 10000 });

const VARIABLES = /** @type {const} */ ({
  timeout_s: 'MCP_TIMEOUT_S', salida_max_bytes: 'MCP_SALIDA_MAX_BYTES', por_hora: 'MCP_POR_HORA', por_dia: 'MCP_POR_DIA',
});

/**
 * Un número entero positivo; lo que no lo sea (vacío, texto, 0, negativo, infinito) vuelve al valor por defecto.
 * @param {Record<string, string|undefined>} [env]
 */
export function leerLimites(env = process.env) {
  /** @type {Record<string, number>} */
  const salida = {};
  for (const [clave, sufijo] of Object.entries(VARIABLES)) {
    const defecto = /** @type {any} */ (LIMITES_POR_DEFECTO)[clave];
    const texto = String(leerVariableRestrictiva(sufijo, env, undefined) ?? '').trim();
    const v = /^\d{1,9}$/.test(texto) ? Number(texto) : NaN;
    salida[clave] = Number.isFinite(v) && v > 0 ? Math.min(v, /** @type {any} */ (LIMITES_TECHO)[clave]) : defecto;
  }
  return /** @type {{ timeout_s: number, salida_max_bytes: number, por_hora: number, por_dia: number }} */ (salida);
}

/**
 * ¿Está apagado? Solo «normal», «activo» o sin definir lo deja pasar; cualquier otro valor APAGA.
 * También apaga la existencia de `<estado del usuario>/mcp/apagado`.
 * @param {Record<string, string|undefined>} env
 * @param {string|null} [dirEstado]
 * @returns {{ apagado: boolean, motivo?: string }}
 */
export function estadoInterruptor(env, dirEstado = null) {
  const v = String(leerVariableRestrictiva('MCP_CICLO', env, 'conflicto') ?? '').trim().toLowerCase();
  if (v === 'apagado') return { apagado: true, motivo: 'FRAGUA_MCP_CICLO=apagado' };
  if (v !== '' && v !== 'normal' && v !== 'activo') {
    return { apagado: true, motivo: 'FRAGUA_MCP_CICLO tiene un valor que no se reconoce (solo «normal», «activo» o «apagado»): por seguridad queda apagado' };
  }
  if (dirEstado && existsSync(join(dirEstado, 'mcp', 'apagado'))) return { apagado: true, motivo: 'existe el archivo de apagado en el estado del usuario' };
  return { apagado: false };
}

const HORA_MS = 3_600_000;
const DIA_MS = 86_400_000;

/**
 * Reserva un cupo por hora y por día. Se llama ANTES de ejecutar y se cuenta aunque la ejecución falle.
 * @param {string} dirEstado  directorio de estado del usuario ya creado
 * @param {{ por_hora: number, por_dia: number }} limites
 * @param {number} [ahora]
 * @returns {{ ok: true } | { ok: false, codigo: 'cupo'|'contador_invalido', motivo: string }}
 */
export function reservarCupo(dirEstado, limites, ahora = Date.now()) {
  const dir = join(dirEstado, 'mcp');
  const archivo = join(dir, 'cupos.json');
  let clave;
  try {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    clave = claveLocal(dirEstado);
  } catch (e) {
    return { ok: false, codigo: 'contador_invalido', motivo: `No se pudo preparar el contador de uso (${e instanceof Error ? e.message : e}); sin contador no se ejecuta nada.` };
  }
  const horaActual = Math.floor(ahora / HORA_MS);
  const diaActual = Math.floor(ahora / DIA_MS);
  let horas = { ventana: horaActual, n: 0 };
  let dias = { ventana: diaActual, n: 0 };
  if (existsSync(archivo)) {
    try {
      const j = JSON.parse(readFileSync(archivo, 'utf8'));
      const { firma, ...cuerpo } = j;
      const bien = (/** @type {any} */ x) => x && Number.isInteger(x.ventana) && Number.isInteger(x.n) && x.n >= 0;
      if (!firmaValida(clave, cuerpo, firma) || !bien(j.horas) || !bien(j.dias)) throw new Error('firma o forma no válidas');
      if (j.horas.ventana === horaActual) horas = j.horas;
      if (j.dias.ventana === diaActual) dias = j.dias;
    } catch {
      return { ok: false, codigo: 'contador_invalido', motivo: 'El contador de uso está dañado o no está firmado; sin contador válido no se ejecuta nada. Una persona debe revisarlo (borra mcp/cupos.json del estado de Fragua si fue un descuido).' };
    }
  }
  if (horas.n >= limites.por_hora) return { ok: false, codigo: 'cupo', motivo: `Se alcanzó el tope de ${limites.por_hora} verificaciones por hora. Una persona debe revisar el uso antes de seguir (FRAGUA_MCP_POR_HORA).` };
  if (dias.n >= limites.por_dia) return { ok: false, codigo: 'cupo', motivo: `Se alcanzó el tope de ${limites.por_dia} verificaciones por día. Una persona debe revisar el uso antes de seguir (FRAGUA_MCP_POR_DIA).` };
  const cuerpo = { formato: 1, horas: { ventana: horaActual, n: horas.n + 1 }, dias: { ventana: diaActual, n: dias.n + 1 } };
  try {
    const temporal = `${archivo}.${process.pid}.tmp`;
    writeFileSync(temporal, JSON.stringify({ ...cuerpo, firma: firmar(clave, cuerpo) }), { mode: 0o600 });
    renameSync(temporal, archivo);
  } catch (e) {
    return { ok: false, codigo: 'contador_invalido', motivo: `No se pudo guardar el contador de uso (${e instanceof Error ? e.message : e}); no se ejecuta nada.` };
  }
  return { ok: true };
}

const AUDITORIA_MAX_BYTES = 1024 * 1024;

/**
 * Una línea por llamada, en el estado del usuario. Nunca lanza: auditar no debe tumbar la respuesta.
 * @param {string} dirEstado
 * @param {Record<string, unknown>} registro
 */
export function auditar(dirEstado, registro) {
  try {
    const dir = join(dirEstado, 'mcp');
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const archivo = join(dir, 'auditoria.jsonl');
    try { if (statSync(archivo).size > AUDITORIA_MAX_BYTES) renameSync(archivo, join(dir, 'auditoria.1.jsonl')); } catch { /* aún no existe */ }
    appendFileSync(archivo, JSON.stringify({ ts: new Date().toISOString(), ...registro }) + '\n', { mode: 0o600 });
  } catch { /* sin auditoría no se pierde la respuesta; el contador sí es obligatorio */ }
}
