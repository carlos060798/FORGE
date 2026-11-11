// @ts-check
/**
 * hooks-anfitrion.js — Guardián de Fragua en los hooks de otras herramientas (plan docs/PLAN-AGNOSTICO.md, F3).
 *
 * Dos piezas, ambas puras (no tocan el disco):
 *  - `traducirEvento`: convierte el evento que una herramienta manda a su hook en uno o varios eventos del
 *    contrato de Fragua (docs/contrato/evento-herramienta.md), que `fragua guardian evaluar` ya entiende.
 *  - `PLANTILLAS_HOOKS`: el archivo de configuración que registra `fragua guardian evaluar --anfitrion <x>`
 *    en el hook «antes de usar una herramienta» de cada herramienta que lo permite.
 *
 * Fuente de los esquemas: spike S0.2 (.sdd/especificaciones/2026-11-10-metodologia-agnostica/spikes/),
 * leído el 2026-11-10 de la documentación oficial vía WebFetch (resumen, no copia literal).
 * Lo que NO está confirmado se marca «sin confirmar» abajo y en docs/ANFITRIONES.md.
 */

/** Herramientas con adaptador de hook. */
export const ANFITRIONES_CON_HOOK = Object.freeze(['cursor', 'copilot', 'gemini', 'codex', 'windsurf', 'opencode']);

/**
 * Anfitriones que además tienen hook POSTERIOR a la herramienta para la memoria de agentes.
 * Windsurf/Devin y opencode NO: la forma de su evento posterior no se confirmó (spike hooks-windsurf-opencode-kiro.md).
 */
export const ANFITRIONES_CON_MEMORIA = Object.freeze(['cursor', 'copilot', 'gemini', 'codex']);

/**
 * Kiro (`.kiro/hooks/*.json`, `PreToolUse` bloquea con salida distinta de 0) NO tiene adaptador: la documentación
 * leída el 2026-11-11 no muestra los nombres de herramienta ni las claves de `tool_input` de sus herramientas
 * integradas (solo un ejemplo MCP), así que un guardián ahí dejaría pasar todo sin avisar.
 */
export const SIN_ADAPTADOR_POR_AHORA = Object.freeze(['kiro']);

/**
 * Nombres de herramienta de cada anfitrión → nombres del contrato (los de Claude Code).
 * Gemini: nombres de herramienta y de campos de `tool_input` (`file_path`, `content`, `command`) SIN CONFIRMAR
 * en la documentación leída (solo se confirmó `tool_name` y `tool_input` en general).
 * Copilot (CLI): nombres de herramienta SIN CONFIRMAR; se aceptan variantes comunes.
 * @type {Readonly<Record<string, Readonly<Record<string, string>>>>}
 */
const NOMBRES = Object.freeze({
  gemini: { write_file: 'Write', replace: 'Edit', run_shell_command: 'Bash', read_file: 'Read', read_many_files: 'Read' },
  copilot: { bash: 'Bash', powershell: 'PowerShell', create: 'Write', edit: 'Edit', write: 'Write', view: 'Read', read: 'Read' },
  codex: { Bash: 'Bash' },
  cursor: { Shell: 'Bash', Read: 'Read', Write: 'Write', Edit: 'Edit' },
  // Windsurf/Devin: solo `exec` (con `tool_input.command`) está confirmado en la documentación. Las herramientas de archivo, no.
  windsurf: { exec: 'Bash' },
  // opencode V1: solo `read` (con `args.filePath`) está confirmado en la documentación. bash/write/edit, no.
  opencode: { read: 'Read' },
});

/** @param {unknown} v @returns {Record<string, any>} */
function comoObjeto(v) {
  if (v && typeof v === 'object' && !Array.isArray(v)) return /** @type {any} */ (v);
  if (typeof v === 'string') { try { const o = JSON.parse(v); if (o && typeof o === 'object') return o; } catch { /* no era JSON */ } }
  return {};
}

/** Campos de entrada con nombres alternativos → los del contrato. */
function normalizarEntrada(entrada) {
  const e = comoObjeto(entrada);
  const out = { ...e };
  const ruta = e.file_path ?? e.path ?? e.filePath ?? e.absolute_path ?? e.filepath;
  if (ruta !== undefined) out.file_path = ruta;
  const contenido = e.content ?? e.file_text ?? e.new_string ?? e.newString;
  if (contenido !== undefined && out.content === undefined) out.content = contenido;
  return out;
}

/**
 * Rutas que toca un parche `apply_patch` de Codex (`*** Add File: x`, `*** Update File: x`, `*** Delete File: x`).
 * @param {string} parche
 */
export function rutasDeParche(parche) {
  const rutas = [];
  for (const m of String(parche).matchAll(/^\*\*\* (?:Add|Update|Delete) File:\s*(.+?)\s*$/gm)) rutas.push(m[1]);
  return rutas;
}

/**
 * La respuesta de la herramienta, si el evento la trae (hooks posteriores). Nombres documentados el 2026-11-11:
 * Cursor `tool_output` (cadena JSON); Copilot `toolResult` / `tool_result`; Gemini y Codex `tool_response`.
 * Solo devuelve la clave si hay valor, para no cambiar la forma de los eventos anteriores a la herramienta.
 * @param {Record<string, any>} ev
 * @returns {{ tool_response?: unknown }}
 */
function respuestaDe(ev) {
  const r = ev.tool_response ?? ev.tool_output ?? ev.toolResult ?? ev.tool_result;
  return r === undefined ? {} : { tool_response: r };
}

/**
 * Traduce el evento de un anfitrión a eventos del contrato. Una *herramienta* que no se reconoce dentro de un
 * anfitrión conocido pasa tal cual (el guardián no tiene reglas para ella: hueco conocido, ver docs/ANFITRIONES.md).
 * Un *anfitrión* que no se reconoce lanza error: quien llama debe fallar cerrado (CA-002-03).
 * @param {string} anfitrion  `cursor`, `copilot`, `gemini`, `codex` o `claude` (sin cambios)
 * @param {unknown} evento    JSON ya analizado
 * @returns {{ tool_name: string, tool_input: Record<string, any>, tool_response?: unknown }[]}
 */
export function traducirEvento(anfitrion, evento) {
  const ev = comoObjeto(evento);
  if (anfitrion === 'claude') {
    return [{ tool_name: String(ev.tool_name ?? ''), tool_input: comoObjeto(ev.tool_input), tool_response: ev.tool_response }];
  }
  if (!ANFITRIONES_CON_HOOK.includes(anfitrion)) throw new Error(`Anfitrión desconocido: "${anfitrion}"`);

  if (anfitrion === 'cursor') {
    const nombre = String(ev.hook_event_name ?? '');
    if (nombre === 'beforeShellExecution') return [{ tool_name: 'Bash', tool_input: { command: String(ev.command ?? '') } }];
    if (nombre === 'beforeReadFile') return [{ tool_name: 'Read', tool_input: { file_path: String(ev.file_path ?? '') } }];
    // Posteriores: `afterFileEdit` trae `file_path` y `edits[]` (old_string/new_string); `afterShellExecution`, `command` y `output`
    if (nombre === 'afterFileEdit') {
      const edits = Array.isArray(ev.edits) ? ev.edits : [];
      const content = edits.map((e) => String(e?.new_string ?? '')).join('\n');
      return [{ tool_name: 'Edit', tool_input: { file_path: String(ev.file_path ?? ''), ...(content ? { content } : {}) }, tool_response: 'ok' }];
    }
    if (nombre === 'afterShellExecution') return [{ tool_name: 'Bash', tool_input: { command: String(ev.command ?? '') }, ...(ev.output === undefined ? {} : { tool_response: ev.output }) }];
    // preToolUse y postToolUse: nombre y entrada genéricos
    const n = String(ev.tool_name ?? '');
    return [{ tool_name: NOMBRES.cursor[n] ?? n, tool_input: normalizarEntrada(ev.tool_input), ...respuestaDe(ev) }];
  }

  if (anfitrion === 'copilot') {
    // Dos formas documentadas: camelCase (toolName/toolArgs) y PascalCase compatible (tool_name/tool_input)
    const n = String(ev.tool_name ?? ev.toolName ?? '');
    const entrada = ev.tool_input ?? ev.toolArgs;
    return [{ tool_name: NOMBRES.copilot[n.toLowerCase()] ?? n, tool_input: normalizarEntrada(entrada), ...respuestaDe(ev) }];
  }

  if (anfitrion === 'gemini') {
    const n = String(ev.tool_name ?? '');
    return [{ tool_name: NOMBRES.gemini[n] ?? n, tool_input: normalizarEntrada(ev.tool_input), ...respuestaDe(ev) }];
  }

  // Windsurf/Devin: {hook_event_name:"PreToolUse", tool_name:"exec", tool_input:{command}}; el plugin de opencode manda {tool_name, tool_input}
  if (anfitrion === 'windsurf' || anfitrion === 'opencode') {
    const n = String(ev.tool_name ?? '');
    return [{ tool_name: NOMBRES[anfitrion][n] ?? n, tool_input: normalizarEntrada(ev.tool_input) }];
  }

  // codex: `Bash` y `apply_patch` llevan el texto en `tool_input.command`
  const n = String(ev.tool_name ?? '');
  const entrada = normalizarEntrada(ev.tool_input);
  if (n === 'apply_patch') {
    const texto = String(entrada.command ?? '');
    const rutas = rutasDeParche(texto);
    if (rutas.length === 0) return [{ tool_name: 'Write', tool_input: { content: texto }, ...respuestaDe(ev) }];
    return rutas.map((file_path) => ({ tool_name: 'Write', tool_input: { file_path, content: texto }, ...respuestaDe(ev) }));
  }
  return [{ tool_name: NOMBRES.codex[n] ?? n, tool_input: entrada, ...respuestaDe(ev) }];
}

/**
 * Archivos de configuración que registra el guardián en cada herramienta.
 * `fusionable: false`: si el archivo ya existe NO se toca (puede traer otra configuración); se avisa con el fragmento.
 * @typedef {{ nombre: string, ruta: string, contenido: (orden: string) => string, nota: string }} PlantillaHook
 * @type {Readonly<Record<string, PlantillaHook>>}
 */
export const PLANTILLAS_HOOKS = Object.freeze({
  cursor: {
    nombre: 'Cursor',
    ruta: '.cursor/hooks.json',
    // `failClosed`: si el hook falla, se bloquea (por defecto Cursor deja pasar)
    contenido: (orden) => JSON.stringify({
      version: 1,
      hooks: {
        beforeShellExecution: [{ command: orden, failClosed: true }],
        beforeReadFile: [{ command: orden, failClosed: true }],
        preToolUse: [{ command: orden, failClosed: true }],
        // Memoria de agentes: nunca bloquea (sin failClosed)
        afterFileEdit: [{ command: ordenDeMemoria(orden) }],
      },
    }, null, 2) + '\n',
    nota: 'Guardián: falla cerrado (failClosed); Cursor deja pasar un hook que falle salvo esa opción. Memoria (afterFileEdit): registra ediciones, no bloquea.',
  },
  copilot: {
    nombre: 'GitHub Copilot',
    ruta: '.github/hooks/fragua-guardian.json',
    contenido: (orden) => JSON.stringify({
      version: 1,
      hooks: {
        preToolUse: [{ type: 'command', bash: orden, powershell: orden, timeoutSec: 30 }],
        postToolUse: [{ type: 'command', bash: ordenDeMemoria(orden), powershell: ordenDeMemoria(orden), timeoutSec: 30 }],
      },
    }, null, 2) + '\n',
    nota: 'Guardián: falla cerrado ante un error del hook; ante un tiempo agotado deja pasar y avisa. Memoria (postToolUse): registra, no bloquea.',
  },
  gemini: {
    nombre: 'Gemini CLI',
    ruta: '.gemini/settings.json',
    contenido: (orden) => JSON.stringify({
      hooks: {
        BeforeTool: [{ matcher: '.*', hooks: [{ name: 'fragua-guardian', type: 'command', command: orden, timeout: 30000 }] }],
        AfterTool: [{ matcher: '.*', hooks: [{ name: 'fragua-memoria', type: 'command', command: ordenDeMemoria(orden), timeout: 30000 }] }],
      },
    }, null, 2) + '\n',
    nota: 'Guardián: FALLA ABIERTO; si `fragua` no está instalado o el hook se rompe, la acción continúa. Solo el código de salida 2 bloquea. Memoria (AfterTool): la orden sale siempre con 0, porque un 2 ocultaría el resultado de la herramienta.',
  },
  codex: {
    nombre: 'Codex CLI',
    ruta: '.codex/hooks.json',
    contenido: (orden) => JSON.stringify({
      hooks: {
        PreToolUse: [{ matcher: '.*', hooks: [{ type: 'command', command: orden, timeout: 30, statusMessage: 'Fragua: guardián' }] }],
        PostToolUse: [{ matcher: '.*', hooks: [{ type: 'command', command: ordenDeMemoria(orden), timeout: 30, statusMessage: 'Fragua: memoria' }] }],
      },
    }, null, 2) + '\n',
    nota: 'Guardián: FALLA ABIERTO ante error, tiempo agotado o respuesta mal formada. Los hooks del proyecto solo se cargan si la carpeta `.codex/` es de confianza y hay que revisarlos y aprobarlos en Codex.',
  },
  windsurf: {
    nombre: 'Windsurf (Devin)',
    ruta: '.devin/hooks.v1.json',
    // En este archivo el objeto de hooks es el archivo entero (sin clave "hooks"); `timeout` en segundos
    contenido: (orden) => JSON.stringify({
      PreToolUse: [{ matcher: '.*', hooks: [{ type: 'command', command: orden, timeout: 30 }] }],
    }, null, 2) + '\n',
    nota: 'Guardián: FALLA ABIERTO; solo la salida 2 bloquea, y un error, un tiempo agotado o `fragua` ausente dejan pasar. COBERTURA PARCIAL: solo evalúa comandos de terminal (`exec`); las herramientas de archivo no se reconocen (nombres sin confirmar) y pasan sin evaluar. No hay memoria de agentes. Los hooks no corren con el espacio de trabajo en Restricted Mode.',
  },
  opencode: {
    nombre: 'opencode',
    ruta: '.opencode/plugins/fragua-guardian.js',
    // Plugin V1 (documentado en migrate-v1): función `Plugin` con "tool.execute.before"; `throw` bloquea.
    // Falla cerrado: si `fragua` no existe o sale con código distinto de 0, se lanza.
    contenido: (orden) => [
      '// Generado por Fragua (forge init --con-hooks). Registra el guardián antes de cada herramienta.',
      '// Falla cerrado: si `fragua` no se puede ejecutar o bloquea, la herramienta no se ejecuta.',
      'import { spawnSync } from "node:child_process";',
      '',
      `const ORDEN = ${JSON.stringify(orden)};`,
      '',
      'export const FraguaGuardian = async () => ({',
      '  "tool.execute.before": async (input, output) => {',
      '    const r = spawnSync(ORDEN, {',
      '      input: JSON.stringify({ tool_name: input.tool, tool_input: output.args }),',
      '      encoding: "utf8", shell: true, timeout: 30000,',
      '    });',
      '    if (r.error || r.status !== 0) {',
      '      const motivo = (r.stderr || (r.error && r.error.message) || "el guardián no pudo ejecutarse").trim();',
      '      throw new Error(`Fragua detuvo esta acción: ${motivo}`);',
      '    }',
      '  },',
      '});',
      '',
    ].join('\n'),
    nota: 'Guardián: FALLA CERRADO (el plugin lanza si `fragua` falla). COBERTURA PARCIAL: solo la herramienta `read` está confirmada en la documentación; bash, write y edit pasan sin evaluar hasta confirmar sus nombres. Usa la API V1 de plugins; ejecutar un proceso con `node:child_process` dentro del plugin no está confirmado en la documentación. No hay memoria de agentes.',
  },
});

/** De la orden del guardián a la de la memoria del mismo anfitrión. */
export const ordenDeMemoria = (/** @type {string} */ orden) => orden.replace('guardian evaluar', 'memoria registrar');

/** Orden que ejecuta el hook de ese anfitrión. */
export const ordenDeGuardian = (/** @type {string} */ anfitrion) => `fragua guardian evaluar --anfitrion ${anfitrion}`;
