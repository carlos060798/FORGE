// @ts-check
/**
 * agentes-nativos.js — Convierte un agente de `agents/` (formato de subagente de Claude Code) al formato de
 * agente propio de otra herramienta, SOLO donde ese formato está confirmado en su documentación oficial
 * (plan docs/PLAN-AGNOSTICO.md, F2; spike S0.1; formatos leídos el 2026-11-11 vía WebFetch).
 *
 * Funciones puras: no tocan el disco. Regla de seguridad: una lista de herramientas traducida solo puede ser
 * IGUAL o MÁS ESTRICTA que la del agente original. Nunca se omite una lista de herramientas si eso hiciera que
 * la herramienta de destino le diera todas por defecto; en ese caso el agente no se genera y se dice por qué.
 *
 * Sin formato confirmado (no se genera nada): Windsurf (la doc no da formato ni carpeta), la carpeta común
 * `agents` y la genérica (no son una herramienta).
 */

import { adaptarCuerpo } from './adaptar-anfitrion.js';
import { separarCabecera } from './skills-de-comandos.js';
import { AGENTES_SOLO_LECTURA } from '../evidencia/guardian-reglas.js';

const FECHA = '2026-11-11';

/**
 * @typedef {Object} FormatoNativo
 * @property {string} nombre
 * @property {string} carpeta  relativa al proyecto
 * @property {string} extension
 * @property {string} fuente
 * @property {string} consultado
 * @property {string} nota  límite conocido que se muestra al instalar
 */

/** @type {Readonly<Record<string, FormatoNativo>>} */
export const FORMATOS_NATIVOS = Object.freeze({
  copilot: {
    nombre: 'GitHub Copilot', carpeta: '.github/agents', extension: '.agent.md',
    fuente: 'https://docs.github.com/en/copilot/reference/custom-agents-configuration', consultado: FECHA,
    nota: 'sin campo model (los valores permitidos no están documentados): hereda el modelo por defecto',
  },
  cursor: {
    nombre: 'Cursor', carpeta: '.cursor/agents', extension: '.md',
    fuente: 'https://cursor.com/docs/subagents', consultado: FECHA,
    nota: 'model: inherit; los agentes que no escriben se marcan readonly',
  },
  codex: {
    nombre: 'Codex CLI', carpeta: '.codex/agents', extension: '.toml',
    fuente: 'https://learn.chatgpt.com/docs/agent-configuration/subagents', consultado: FECHA,
    nota: 'sin model (identificadores de OpenAI); sandbox_mode no se puede fijar en el archivo, así que "solo lectura" va como instrucción, no como límite',
  },
  opencode: {
    nombre: 'opencode', carpeta: '.opencode/agents', extension: '.md',
    fuente: 'https://opencode.ai/docs/agents/', consultado: FECHA,
    nota: 'mode: subagent; sin model (formato proveedor/modelo); permisos edit y shell denegados cuando el agente no los tiene',
  },
  kiro: {
    nombre: 'Kiro', carpeta: '.kiro/agents', extension: '.json',
    fuente: 'https://kiro.dev/docs/custom-agents/', consultado: FECHA,
    nota: 'forma JSON; solo se traducen las herramientas read, write y shell (los únicos nombres confirmados); los agentes de workspace solo cargan si el workspace es de confianza',
  },
  gemini: {
    nombre: 'Gemini CLI', carpeta: '.gemini/agents', extension: '.md',
    fuente: 'https://geminicli.com/docs/core/subagents/', consultado: FECHA,
    nota: 'solo se generan los agentes sin escritura (de las herramientas de Gemini solo se confirmaron read_file, grep_search y run_shell_command); la doc avisa de que Gemini CLI fue reemplazado por Antigravity CLI para el nivel gratuito',
  },
});

/** Claves con formato nativo confirmado. */
export const CLAVES_CON_AGENTE_NATIVO = Object.freeze(Object.keys(FORMATOS_NATIVOS));

const ESCRIBE = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);

/** Herramientas de la cabecera `tools: ["Read", "Grep"]` como lista. */
export function herramientasDe(valor) {
  return String(valor ?? '').replace(/[\[\]"',]/g, ' ').split(/\s+/).filter(Boolean);
}

const sinComillas = (v) => String(v ?? '').replace(/^(["'])([\s\S]*)\1$/, '$2');
const yamlCadena = (s) => JSON.stringify(String(s));
const unicos = (lista) => [...new Set(lista)];

/** Claude Code → alias de Copilot (documentados: execute, read, edit, search, agent, web, todo). */
const COPILOT = { Read: 'read', NotebookRead: 'read', Grep: 'search', Glob: 'search', Write: 'edit', Edit: 'edit', MultiEdit: 'edit', NotebookEdit: 'edit', Bash: 'execute', PowerShell: 'execute', Task: 'agent', WebFetch: 'web', WebSearch: 'web', TodoWrite: 'todo' };
/** Claude Code → herramientas de Kiro confirmadas por su ejemplo (read, write, shell). */
const KIRO = { Read: 'read', Write: 'write', Edit: 'write', MultiEdit: 'write', Bash: 'shell' };
/** Claude Code → herramientas de Gemini CLI confirmadas (read_file, grep_search, run_shell_command). */
const GEMINI = { Read: 'read_file', Grep: 'grep_search', Bash: 'run_shell_command' };

/**
 * @param {string} clave  clave de integración
 * @param {string} archivo  nombre del agente sin `.md`
 * @param {string} texto  contenido de `agents/<archivo>.md`
 * @param {{ prefijo: string, comandos: readonly string[] }} opciones
 * @returns {{ ruta: string, contenido: string } | { omitido: string } | null}  `null`: esa herramienta no tiene formato confirmado
 */
export function agenteANativo(clave, archivo, texto, opciones) {
  const formato = FORMATOS_NATIVOS[clave];
  if (!formato) return null;
  const { campos, cuerpo } = separarCabecera(texto);
  const nombre = sinComillas(campos.get('name')) || archivo;
  const descripcion = sinComillas(campos.get('description')).replace(/\s+/g, ' ').trim();
  if (!descripcion) return { omitido: `${archivo}: sin description` };
  // Fuente única de «solo lectura» (la del guardián): estos agentes nunca reciben herramientas de escritura
  const soloLectura = AGENTES_SOLO_LECTURA.includes(nombre) || AGENTES_SOLO_LECTURA.includes(archivo);
  const herramientas = herramientasDe(campos.get('tools')).filter((h) => !(soloLectura && ESCRIBE.has(h)));
  const escribe = herramientas.some((h) => ESCRIBE.has(h));
  const usaShell = herramientas.includes('Bash') || herramientas.includes('PowerShell');
  const instrucciones = adaptarCuerpo(cuerpo.replace(/^\n+/, ''), opciones).replace(/\s+$/, '') + '\n';
  const ruta = `${formato.carpeta}/${nombre}${formato.extension}`;

  if (clave === 'copilot') {
    const t = unicos(herramientas.map((h) => COPILOT[h]).filter(Boolean));
    const lineas = ['---', `name: ${yamlCadena(nombre)}`, `description: ${yamlCadena(descripcion)}`];
    // Sin `tools` Copilot habilita todas: si el agente declaraba herramientas se escribe la lista (aunque quede corta)
    if (herramientas.length) lineas.push(`tools: ${JSON.stringify(t)}`);
    lineas.push('---', '');
    return { ruta, contenido: lineas.join('\n') + '\n' + instrucciones };
  }

  if (clave === 'cursor') {
    const lineas = ['---', `name: ${nombre}`, `description: ${yamlCadena(descripcion)}`, 'model: inherit', `readonly: ${escribe ? 'false' : 'true'}`, '---', ''];
    return { ruta, contenido: lineas.join('\n') + '\n' + instrucciones };
  }

  if (clave === 'opencode') {
    const reglas = [];
    if (!escribe) reglas.push({ action: 'edit', resource: '*', effect: 'deny' });
    if (!usaShell) reglas.push({ action: 'shell', resource: '*', effect: 'deny' });
    const lineas = ['---', `description: ${yamlCadena(descripcion)}`, 'mode: subagent'];
    if (reglas.length) {
      lineas.push('permissions:');
      for (const r of reglas) lineas.push(`  - action: ${r.action}`, `    resource: ${JSON.stringify(r.resource)}`, `    effect: ${r.effect}`);
    }
    lineas.push('---', '');
    return { ruta, contenido: lineas.join('\n') + '\n' + instrucciones };
  }

  if (clave === 'kiro') {
    const t = unicos(herramientas.map((h) => KIRO[h]).filter(Boolean));
    if (herramientas.length && t.length === 0) return { omitido: `${archivo}: ninguna de sus herramientas tiene equivalente confirmado en Kiro` };
    const obj = { name: nombre, description: descripcion, ...(herramientas.length ? { tools: t } : {}), prompt: instrucciones };
    return { ruta, contenido: JSON.stringify(obj, null, 2) + '\n' };
  }

  if (clave === 'gemini') {
    // Escribir exige nombres de herramienta de Gemini que no están confirmados: ese agente no se genera
    if (escribe) return { omitido: `${archivo}: escribe archivos y los nombres de las herramientas de escritura de Gemini no están confirmados` };
    const t = unicos(herramientas.map((h) => GEMINI[h]).filter(Boolean));
    if (t.length === 0) return { omitido: `${archivo}: ninguna de sus herramientas tiene equivalente confirmado en Gemini` };
    const lineas = ['---', `name: ${nombre.replace(/[^a-z0-9_-]/g, '-')}`, `description: ${yamlCadena(descripcion)}`, 'kind: local', 'tools:', ...t.map((x) => `  - ${x}`), '---', ''];
    return { ruta, contenido: lineas.join('\n') + '\n' + instrucciones };
  }

  // codex: TOML, un archivo por agente; `developer_instructions` es obligatorio
  const avisoSoloLectura = escribe ? '' : 'Este agente es de solo lectura: no crees, modifiques ni borres archivos.\n\n';
  const cuerpoToml = avisoSoloLectura + instrucciones;
  const instruccionesToml = cuerpoToml.includes("'''")
    ? `"""\n${cuerpoToml.replace(/\\/g, '\\\\').replace(/"""/g, '\\"\\"\\"')}"""`
    : `'''\n${cuerpoToml}'''`;
  const contenido = [`name = ${JSON.stringify(nombre)}`, `description = ${JSON.stringify(descripcion)}`, `developer_instructions = ${instruccionesToml}`, ''].join('\n');
  return { ruta, contenido };
}
