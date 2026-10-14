// @ts-check
/**
 * integraciones.js — Tabla de integraciones del instalador (spec 2026-10-13-instalacion-agnostica).
 *
 * Una integración es una herramienta de código a la que `forge init --integracion <clave>` le
 * instala FORGE. Añadir una herramienta es añadir una fila: nada de código por herramienta.
 *
 * Solo entran herramientas con carpeta de skills CONFIRMADA en su documentación oficial
 * (spikes/carpetas-de-skills.md, consultado el 2026-10-13). Zed y Goose quedan fuera: sin confirmar.
 *
 * Funciones puras: no leen ni escriben archivos. La escritura segura es del instalador.
 */

import { isAbsolute, relative, resolve } from 'node:path';

/**
 * @typedef {Object} Integracion
 * @property {string} clave
 * @property {string} nombre
 * @property {string|null} carpetaSkills Carpeta de skills relativa al proyecto (null: la da `--carpeta-skills`).
 * @property {boolean} nativa true: comandos, agentes y hooks con cabecera de Claude Code (solo `claude`).
 * @property {string} invocacion Cómo se invoca una skill instalada.
 * @property {string} ejemplo Ejemplo de invocación de la primera skill (`forge`).
 * @property {string} fuente URL de la documentación oficial de la carpeta.
 * @property {string} consultado Fecha de consulta de la fuente (AAAA-MM-DD).
 */

const FECHA = '2026-10-13';

/** @type {Readonly<Record<string, Integracion>>} */
export const INTEGRACIONES = Object.freeze({
  claude: {
    clave: 'claude', nombre: 'Claude Code', carpetaSkills: '.claude/skills', nativa: true,
    invocacion: '/<comando> en Claude Code', ejemplo: '/forge "describe tu idea"',
    fuente: 'https://docs.claude.com/en/docs/claude-code/skills', consultado: FECHA,
  },
  generica: {
    clave: 'generica', nombre: 'Genérica (carpeta a elegir)', carpetaSkills: null, nativa: false,
    invocacion: 'según tu herramienta: skill por nombre', ejemplo: 'skill forge',
    fuente: 'https://agentskills.io/specification', consultado: FECHA,
  },
  agents: {
    clave: 'agents', nombre: 'Carpeta común .agents/skills', carpetaSkills: '.agents/skills', nativa: false,
    invocacion: 'según la herramienta (Codex: $nombre; Gemini, Cursor, opencode, Copilot, Windsurf leen esta carpeta)', ejemplo: '$forge',
    fuente: 'https://developers.openai.com/codex/skills', consultado: FECHA,
  },
  copilot: {
    clave: 'copilot', nombre: 'GitHub Copilot', carpetaSkills: '.github/skills', nativa: false,
    invocacion: 'automática por descripción; /<nombre> en el chat', ejemplo: '/forge',
    fuente: 'https://code.visualstudio.com/docs/copilot/customization/agent-skills', consultado: FECHA,
  },
  cursor: {
    clave: 'cursor', nombre: 'Cursor', carpetaSkills: '.cursor/skills', nativa: false,
    invocacion: '/<nombre> en el chat del agente; automática', ejemplo: '/forge',
    fuente: 'https://cursor.com/docs/context/skills', consultado: FECHA,
  },
  gemini: {
    clave: 'gemini', nombre: 'Gemini CLI', carpetaSkills: '.gemini/skills', nativa: false,
    invocacion: 'la herramienta activate_skill la activa por descripción; /skills la gestiona', ejemplo: 'pide "usa la skill forge"',
    fuente: 'https://geminicli.com/docs/cli/skills/', consultado: FECHA,
  },
  windsurf: {
    clave: 'windsurf', nombre: 'Windsurf', carpetaSkills: '.devin/skills', nativa: false,
    invocacion: '@<nombre> en Cascade; automática', ejemplo: '@forge',
    fuente: 'https://docs.windsurf.com/windsurf/cascade/skills', consultado: FECHA,
  },
  opencode: {
    clave: 'opencode', nombre: 'opencode', carpetaSkills: '.opencode/skills', nativa: false,
    invocacion: 'herramienta skill({name}); /<nombre> solo con opencode/slash', ejemplo: 'skill({ name: "forge" })',
    fuente: 'https://opencode.ai/docs/skills/', consultado: FECHA,
  },
  kiro: {
    clave: 'kiro', nombre: 'Kiro', carpetaSkills: '.kiro/skills', nativa: false,
    invocacion: '/<nombre>; automática', ejemplo: '/forge',
    fuente: 'https://kiro.dev/docs/skills/', consultado: FECHA,
  },
});

/** Integración por defecto: el camino de siempre de `forge init`. */
export const INTEGRACION_POR_DEFECTO = 'claude';

/** Claves válidas, en el orden de la tabla. */
export const CLAVES = Object.freeze(Object.keys(INTEGRACIONES));

/**
 * Valida una clave de integración.
 * @param {unknown} clave
 * @returns {{ ok: true, integracion: Integracion } | { ok: false, error: string }}
 */
export function resolverIntegracion(clave) {
  if (typeof clave === 'string' && Object.hasOwn(INTEGRACIONES, clave)) {
    return { ok: true, integracion: INTEGRACIONES[clave] };
  }
  return {
    ok: false,
    error: `Integración desconocida: ${JSON.stringify(clave)}. Las válidas son: ${CLAVES.join(', ')}.`,
  };
}

/** ¿`ruta` está dentro de `raiz` (o es la propia raíz)? */
function dentro(raiz, ruta) {
  const mm = (s) => (process.platform === 'win32' ? s.toLowerCase() : s);
  const rel = relative(mm(resolve(raiz)), mm(resolve(ruta)));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

/**
 * Valida la carpeta de la integración genérica: debe quedar dentro del proyecto o de la carpeta
 * personal del usuario, y no puede ser la raíz de ninguna de las dos.
 * @param {unknown} ruta Valor de `--carpeta-skills` (relativo al proyecto o absoluto).
 * @param {{ proyecto: string, personal: string }} contexto
 * @returns {{ ok: true, ruta: string, raiz: string } | { ok: false, error: string }}
 */
export function validarCarpetaSkills(ruta, { proyecto, personal }) {
  if (typeof ruta !== 'string' || ruta.trim() === '' || ruta.includes('\0')) {
    return { ok: false, error: 'La integración genérica necesita --carpeta-skills <ruta> (dentro del proyecto o de tu carpeta personal).' };
  }
  const abs = resolve(proyecto, ruta);
  if (resolve(abs) === resolve(proyecto) || resolve(abs) === resolve(personal)) {
    return { ok: false, error: `--carpeta-skills no puede ser la raíz del proyecto ni tu carpeta personal: ${ruta}` };
  }
  if (dentro(proyecto, abs)) return { ok: true, ruta: abs, raiz: resolve(proyecto) };
  if (dentro(personal, abs)) return { ok: true, ruta: abs, raiz: resolve(personal) };
  return { ok: false, error: `--carpeta-skills debe quedar dentro del proyecto o de tu carpeta personal; "${ruta}" queda fuera.` };
}
