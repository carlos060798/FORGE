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
    nota: 'nombres de herramienta confirmados en geminicli.com/docs/tools (read_file, write_file, replace, glob, grep_search, run_shell_command, web_fetch, google_web_search); Task, TodoWrite y NotebookEdit no tienen equivalente y se omiten; la doc avisa de que Gemini CLI fue reemplazado por Antigravity CLI para el nivel gratuito',
  },
});

/** Claves con formato nativo confirmado. */
export const CLAVES_CON_AGENTE_NATIVO = Object.freeze(Object.keys(FORMATOS_NATIVOS));

const ESCRIBE = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
const SHELL = new Set(['Bash', 'PowerShell']);

/**
 * Agentes de solo lectura que CONSERVAN el shell en los formatos nativos, con el motivo (comprobado leyendo `agents/`).
 * Los demás agentes de solo lectura solo usaban el shell para `cat`, `ls` y `find` (lectura) y para anexar a la memoria
 * compartida con un heredoc; fuera de Claude Code no hay guardián que impida escribir por la terminal, así que en el
 * formato nativo se les quita el shell y sus bloques bash pasan a instrucciones de lectura.
 * @type {Readonly<Record<string, string>>}
 */
export const SOLO_LECTURA_CON_SHELL = Object.freeze({
  revisor: 'ejecuta las pruebas del proyecto (npx jest, python -m pytest) en la capa de cobertura',
  investigador: 'consulta las versiones instaladas de node y python (node --version, python --version)',
});

/**
 * Cuerpo para un agente SIN terminal: los bloques bash de lectura pasan a una lista de archivos que leer con las
 * herramientas de lectura/búsqueda; el bloque que anexa a la memoria compartida pasa a «devuélvelo en tu respuesta».
 * Función pura, solo para el formato nativo (lo que recibe Claude Code no cambia).
 * @param {string} cuerpo
 * @returns {string}
 */
export function cuerpoSinShell(cuerpo) {
  // El hook de memoria registraba los cambios del agente; sin hook y sin escritura, lo devuelve en su respuesta
  const sinHook = cuerpo.replace(/(^|[ \t])[^.\n]*\bhook `agent-memory\.js`[^.\n]*\./gm, (_m, antes) => antes + 'Este agente no escribe archivos: devuelve en tu respuesta lo que habrías anotado en la memoria.');
  return sinHook.replace(/```bash\r?\n([\s\S]*?)```/g, (_m, bloque) => {
    const texto = String(bloque);
    const anexo = /cat\s*>>\s*(\S+)\s*<<\s*['"]?(\w+)['"]?\r?\n([\s\S]*?)\r?\n\2\s*$/m.exec(texto);
    if (anexo) {
      const plantilla = anexo[3].replace(/\$\(date[^)]*\)/g, '<fecha UTC>').trim();
      return 'Este agente no tiene terminal ni escribe archivos. Al terminar, incluye al final de tu respuesta este bloque para que quien te invocó lo registre en `' + anexo[1] + '`:\n\n```\n' + plantilla + '\n```';
    }
    const items = [];
    for (const crudo of texto.split(/\r?\n/)) {
      const linea = crudo.trim();
      if (!linea || linea.startsWith('#') || /^(SPEC_ID=|mkdir\b|echo\b)/.test(linea)) continue;
      const limpia = linea.replace(/\$\{SPEC_ID\}/g, '<id-spec-activa>').replace(/\s*2>\/dev\/null/g, '');
      const cat = /\bcat\s+((?:[^\s|&;]+\s*)+)/.exec(limpia);
      if (cat && !/\bfind\b|\bls\b/.test(limpia.slice(0, cat.index))) {
        for (const ruta of cat[1].trim().split(/\s+/)) if (!ruta.startsWith('-')) items.push('`' + ruta.replace(/^"|"$/g, '') + '`');
      } else {
        items.push('buscar o listar: `' + limpia.replace(/\s*\|\s*(head|sort|tail)\b[^|]*/g, '').replace(/\s*\|\|\s*.*$/, '') + '`');
      }
    }
    if (items.length === 0) return '';
    return 'Este agente no tiene terminal: consulta con las herramientas de lectura y búsqueda de tu entorno (si un archivo no existe, sigue):\n\n' + [...new Set(items)].map((x) => '- ' + x).join('\n');
  });
}

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
/**
 * Claude Code → herramientas integradas de Gemini CLI, confirmadas el 2026-11-11 en geminicli.com/docs/tools/
 * (file-system: read_file, write_file, replace, glob, grep_search, list_directory; shell: run_shell_command;
 * web-fetch: web_fetch; web-search: google_web_search). Sin equivalente (se omiten, lista más estricta):
 * Task, TodoWrite, NotebookEdit, NotebookRead.
 */
const GEMINI = {
  Read: 'read_file', Grep: 'grep_search', Glob: 'glob', Write: 'write_file', Edit: 'replace', MultiEdit: 'replace',
  Bash: 'run_shell_command', PowerShell: 'run_shell_command', WebFetch: 'web_fetch', WebSearch: 'google_web_search',
};

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
  // Sin guardián fuera de Claude Code, un agente de solo lectura no conserva el shell salvo que lo necesite de verdad
  const sinShell = soloLectura && !Object.hasOwn(SOLO_LECTURA_CON_SHELL, nombre) && !Object.hasOwn(SOLO_LECTURA_CON_SHELL, archivo);
  const herramientas = herramientasDe(campos.get('tools')).filter((h) => !(soloLectura && ESCRIBE.has(h)) && !(sinShell && SHELL.has(h)));
  const escribe = herramientas.some((h) => ESCRIBE.has(h));
  const usaShell = herramientas.some((h) => SHELL.has(h));
  const base = sinShell ? cuerpoSinShell(cuerpo.replace(/^\n+/, '')) : cuerpo.replace(/^\n+/, '');
  const instrucciones = adaptarCuerpo(base, opciones).replace(/\s+$/, '') + '\n';
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
