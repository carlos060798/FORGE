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
export const ANFITRIONES_CON_HOOK = Object.freeze(['cursor', 'copilot', 'gemini', 'codex']);

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
    if (nombre === 'afterFileEdit') return [{ tool_name: 'Edit', tool_input: { file_path: String(ev.file_path ?? '') } }];
    // preToolUse: nombre e entrada genéricos
    const n = String(ev.tool_name ?? '');
    return [{ tool_name: NOMBRES.cursor[n] ?? n, tool_input: normalizarEntrada(ev.tool_input) }];
  }

  if (anfitrion === 'copilot') {
    // Dos formas documentadas: camelCase (toolName/toolArgs) y PascalCase compatible (tool_name/tool_input)
    const n = String(ev.tool_name ?? ev.toolName ?? '');
    const entrada = ev.tool_input ?? ev.toolArgs;
    return [{ tool_name: NOMBRES.copilot[n.toLowerCase()] ?? n, tool_input: normalizarEntrada(entrada) }];
  }

  if (anfitrion === 'gemini') {
    const n = String(ev.tool_name ?? '');
    return [{ tool_name: NOMBRES.gemini[n] ?? n, tool_input: normalizarEntrada(ev.tool_input) }];
  }

  // codex: `Bash` y `apply_patch` llevan el texto en `tool_input.command`
  const n = String(ev.tool_name ?? '');
  const entrada = normalizarEntrada(ev.tool_input);
  if (n === 'apply_patch') {
    const texto = String(entrada.command ?? '');
    const rutas = rutasDeParche(texto);
    if (rutas.length === 0) return [{ tool_name: 'Write', tool_input: { content: texto } }];
    return rutas.map((file_path) => ({ tool_name: 'Write', tool_input: { file_path, content: texto } }));
  }
  return [{ tool_name: NOMBRES.codex[n] ?? n, tool_input: entrada }];
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
      },
    }, null, 2) + '\n',
    nota: 'Falla cerrado (failClosed). Cursor deja pasar un hook que falle salvo esa opción.',
  },
  copilot: {
    nombre: 'GitHub Copilot',
    ruta: '.github/hooks/fragua-guardian.json',
    contenido: (orden) => JSON.stringify({
      version: 1,
      hooks: { preToolUse: [{ type: 'command', bash: orden, powershell: orden, timeoutSec: 30 }] },
    }, null, 2) + '\n',
    nota: 'Falla cerrado ante un error del hook; ante un tiempo agotado deja pasar y avisa.',
  },
  gemini: {
    nombre: 'Gemini CLI',
    ruta: '.gemini/settings.json',
    contenido: (orden) => JSON.stringify({
      hooks: { BeforeTool: [{ matcher: '.*', hooks: [{ name: 'fragua-guardian', type: 'command', command: orden, timeout: 30000 }] }] },
    }, null, 2) + '\n',
    nota: 'FALLA ABIERTO: si `fragua` no está instalado o el hook se rompe, la acción continúa. Solo el código de salida 2 bloquea.',
  },
  codex: {
    nombre: 'Codex CLI',
    ruta: '.codex/hooks.json',
    contenido: (orden) => JSON.stringify({
      hooks: { PreToolUse: [{ matcher: '.*', hooks: [{ type: 'command', command: orden, timeout: 30, statusMessage: 'Fragua: guardián' }] }] },
    }, null, 2) + '\n',
    nota: 'FALLA ABIERTO ante error, tiempo agotado o respuesta mal formada. Los hooks del proyecto solo se cargan si la carpeta `.codex/` es de confianza y hay que revisarlos y aprobarlos en Codex.',
  },
});

/** Orden que ejecuta el hook de ese anfitrión. */
export const ordenDeGuardian = (/** @type {string} */ anfitrion) => `fragua guardian evaluar --anfitrion ${anfitrion}`;
