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
 * Windsurf/Devin sí (docs.devin.ai/cli/extensibility/hooks/lifecycle-hooks.md, leído el 2026-11-11: `PostToolUse`
 * entrega `tool_name`, `tool_input` y `tool_response`). opencode NO: la forma de su evento posterior
 * (`tool.execute.after`) no aparece en la documentación leída.
 */
export const ANFITRIONES_CON_MEMORIA = Object.freeze(['cursor', 'copilot', 'gemini', 'codex', 'windsurf']);

/**
 * Kiro NO tiene adaptador. Lo que la documentación (kiro.dev/docs/hooks/ y /docs/hooks/types/, leídas el
 * 2026-11-11) SÍ confirma: archivo `.kiro/hooks/<id>.json` con `{version:"v1", hooks:[{name, trigger, matcher,
 * action:{type:"command", command}, timeout}]}`, y que `PreToolUse` recibe `hook_event_name`, `cwd`, `session_id`,
 * `tool_name` y `tool_input`. Lo que NO confirma, y sin lo cual un guardián dejaría pasar todo sin avisar:
 *  - los nombres de las herramientas integradas (solo categorías `read`, `write`, `shell`, `web`, `spec` y el
 *    formato `mcp_<servidor>_<herramienta>`) ni las claves de su `tool_input`;
 *  - qué código de salida bloquea una herramienta en `PreToolUse` (solo dice que «puede validar y bloquear»);
 *  - la forma del evento de `PostToolUse` (solo «con acceso a los resultados»).
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
  // Windsurf/Devin (lifecycle-hooks.md, 2026-11-11): nombres `read`, `write`, `edit`, `apply_patch`, `exec` confirmados.
  // Claves de `tool_input` confirmadas SOLO para `exec` (`command`, `shell_id`); las de archivo no se documentan.
  windsurf: { exec: 'Bash', read: 'Read', write: 'Write', edit: 'Edit', apply_patch: 'Write' },
  // opencode (opencode.ai/docs/tools, 2026-11-11): herramientas `read` (path), `edit` (path, oldString, newString),
  // `write` (path, content), `patch` (patchText) y `shell` (workdir, timeout, background; el parámetro del comando
  // NO aparece en la página). `bash` es el nombre de versiones anteriores: no confirmado, se acepta por compatibilidad.
  opencode: { read: 'Read', edit: 'Edit', write: 'Write', patch: 'Write', shell: 'Bash', bash: 'Bash' },
});

/** Nombres de herramienta que llevan un parche con rutas dentro (se evalúa una escritura por archivo). */
const HERRAMIENTAS_DE_PARCHE = Object.freeze({ windsurf: ['apply_patch'], opencode: ['patch'], codex: ['apply_patch'] });

/** @param {unknown} v @returns {Record<string, any>} */
function comoObjeto(v) {
  if (v && typeof v === 'object' && !Array.isArray(v)) return /** @type {any} */ (v);
  if (typeof v === 'string') { try { const o = JSON.parse(v); if (o && typeof o === 'object') return o; } catch { /* no era JSON */ } }
  return {};
}

/**
 * Ruta de archivo por heurística, para herramientas cuyos nombres de campo la documentación no fija: la primera
 * cadena de una sola línea cuya clave habla de ruta o de archivo y no de contenido (`target_file`, `filename`...).
 * Solo se usa cuando ninguna clave conocida trae la ruta.
 * @param {Record<string, any>} e
 */
function rutaPorHeuristica(e) {
  for (const [k, v] of Object.entries(e)) {
    if (typeof v !== 'string' || v === '' || /[\r\n]/.test(v)) continue;
    if (/path|file/i.test(k) && !/text|content|string|patch/i.test(k)) return v;
  }
  return undefined;
}

/** Claves donde una herramienta puede llevar la orden de terminal. */
const CLAVES_DE_ORDEN = Object.freeze(['command', 'cmd', 'script', 'commandLine']);

/**
 * La orden como texto: un texto tal cual, o una lista de textos (`["bash", "-lc", "rm -rf /"]`, la forma habitual de
 * un shell) unida con espacios. Cualquier otra cosa no es una orden. Sin esto, una orden en lista llegaba al guardián
 * como lista y pasaba sin evaluar (revisión del 2026-11-24).
 * @param {unknown} v
 * @returns {string|undefined}
 */
function ordenComoTexto(v) {
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === 'string')) return v.join(' ');
  return undefined;
}

/** Campos de entrada con nombres alternativos → los del contrato. */
function normalizarEntrada(entrada) {
  const e = comoObjeto(entrada);
  const out = { ...e };
  // Una orden en lista pasa a texto, en la clave en que venga (la que lee el guardián es `command`)
  for (const k of CLAVES_DE_ORDEN) {
    const t = ordenComoTexto(e[k]);
    if (t !== undefined && Array.isArray(e[k])) out[k] = t;
  }
  const ruta = e.file_path ?? e.path ?? e.filePath ?? e.absolute_path ?? e.filepath ?? rutaPorHeuristica(e);
  if (ruta !== undefined) out.file_path = ruta;
  const contenido = e.content ?? e.file_text ?? e.new_string ?? e.newString;
  if (contenido !== undefined && out.content === undefined) out.content = contenido;
  return out;
}

/**
 * Herramienta cuyo nombre no está en la tabla del anfitrión: se clasifica por lo que trae su entrada, para que una
 * orden de terminal o una escritura no pasen sin reglas solo porque la herramienta se llame de otra forma
 * (auditoría del 2026-11-11: en Codex, `shell rm -rf /` y `write_file .env` salían con 0).
 *  - trae una orden (`command`, `cmd`, `script`, `commandLine`) → `Bash`, con `command` normalizado;
 *  - trae ruta y contenido → `Write`;
 *  - trae solo ruta → `Read`;
 *  - no trae ni orden ni ruta (búsquedas, web, MCP) → pasa tal cual: no hay regla que aplicar.
 * @param {string} nombre
 * @param {Record<string, any>} entrada ya normalizada
 * @returns {{ tool_name: string, tool_input: Record<string, any> }}
 */
export function clasificarDesconocida(nombre, entrada) {
  // Si la orden o la ruta no están en el primer nivel, se baja hasta dos niveles (`{ action: { command: [...] } }`)
  const e = subirAlNivelConOrdenOCamino(entrada, 2);
  const orden = CLAVES_DE_ORDEN.map((k) => ordenComoTexto(e[k])).find((v) => v !== undefined);
  if (orden !== undefined) return { tool_name: 'Bash', tool_input: { ...e, command: orden } };
  if (typeof e.file_path === 'string' && e.file_path !== '') {
    return { tool_name: e.content !== undefined ? 'Write' : 'Read', tool_input: e };
  }
  return { tool_name: nombre, tool_input: entrada };
}

/** ¿Trae esta entrada una orden o una ruta que el guardián pueda evaluar? */
const traeOrdenOCamino = (/** @type {Record<string, any>} */ e) =>
  CLAVES_DE_ORDEN.some((k) => ordenComoTexto(e[k]) !== undefined) || (typeof e.file_path === 'string' && e.file_path !== '');

/**
 * La entrada misma si ya trae orden o ruta; si no, la de un objeto anidado (normalizada) que la traiga, hasta `niveles`
 * niveles de profundidad. Si no hay ninguna, la entrada original.
 * @param {Record<string, any>} entrada @param {number} niveles
 * @returns {Record<string, any>}
 */
function subirAlNivelConOrdenOCamino(entrada, niveles) {
  if (traeOrdenOCamino(entrada) || niveles === 0) return entrada;
  for (const v of Object.values(entrada)) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
    const interna = subirAlNivelConOrdenOCamino(normalizarEntrada(v), niveles - 1);
    if (traeOrdenOCamino(interna)) return interna;
  }
  return entrada;
}

/**
 * Nombre del contrato para `n` en el anfitrión, o la clasificación por entrada si no está en la tabla.
 * Solo cuentan las claves propias de la tabla: `toString`, `constructor` o `__proto__` no son herramientas conocidas
 * (heredadas de Object, devolvían una función y `tool_name` desaparecía del evento, con lo que el guardián dejaba pasar).
 */
function traducirNombre(anfitrion, n, entrada) {
  const tabla = NOMBRES[anfitrion];
  if (tabla !== undefined && Object.hasOwn(tabla, n)) return { tool_name: tabla[n], tool_input: entrada };
  return clasificarDesconocida(n, entrada);
}

/**
 * Texto de un parche dentro de la entrada de una herramienta: las claves que se conocen (`command` en Codex,
 * `patchText` en opencode) y, si no, la primera cadena con cabeceras de parche (`*** Update File: x`).
 * @param {Record<string, any>} entrada
 */
function textoDeParche(entrada) {
  for (const k of ['patchText', 'command', 'patch', 'input']) if (typeof entrada[k] === 'string') return entrada[k];
  for (const v of Object.values(entrada)) if (typeof v === 'string' && /^\*\*\* (?:Add|Update|Delete) File:/m.test(v)) return v;
  return '';
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
 * anfitrión conocido se clasifica por su entrada (`clasificarDesconocida`): orden → `Bash`, ruta y contenido →
 * `Write`, ruta → `Read`; sin nada de eso pasa tal cual. Un *anfitrión* que no se reconoce lanza error: quien llama
 * debe fallar cerrado (CA-002-03).
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
    return [{ ...traducirNombre('cursor', n, normalizarEntrada(ev.tool_input)), ...respuestaDe(ev) }];
  }

  if (anfitrion === 'copilot') {
    // Dos formas documentadas: camelCase (toolName/toolArgs) y PascalCase compatible (tool_name/tool_input)
    const n = String(ev.tool_name ?? ev.toolName ?? '');
    const entrada = ev.tool_input ?? ev.toolArgs;
    return [{ ...traducirNombre('copilot', n.toLowerCase(), normalizarEntrada(entrada)), ...respuestaDe(ev) }];
  }

  if (anfitrion === 'gemini') {
    const n = String(ev.tool_name ?? '');
    return [{ ...traducirNombre('gemini', n, normalizarEntrada(ev.tool_input)), ...respuestaDe(ev) }];
  }

  // Windsurf/Devin: {hook_event_name:"PreToolUse"|"PostToolUse", tool_name, tool_input, tool_response?}; el plugin
  // de opencode manda {tool_name, tool_input}. Las dos pueden traer un parche (`apply_patch`, `patch`).
  // Codex: `Bash` y `apply_patch` llevan el texto en `tool_input.command`.
  const n = String(ev.tool_name ?? '');
  const entrada = normalizarEntrada(ev.tool_input);
  if (HERRAMIENTAS_DE_PARCHE[anfitrion]?.includes(n)) {
    const texto = textoDeParche(entrada);
    const rutas = rutasDeParche(texto);
    if (rutas.length === 0) return [{ tool_name: 'Write', tool_input: { content: texto }, ...respuestaDe(ev) }];
    return rutas.map((file_path) => ({ tool_name: 'Write', tool_input: { file_path, content: texto }, ...respuestaDe(ev) }));
  }
  // opencode `shell`: el nombre del parámetro del comando no lo da la documentación; se aceptan los habituales
  if (anfitrion === 'opencode' && NOMBRES.opencode[n] === 'Bash' && entrada.command === undefined) {
    const comando = entrada.cmd ?? entrada.script;
    if (typeof comando === 'string') entrada.command = comando;
  }
  return [{ ...traducirNombre(anfitrion, n, entrada), ...respuestaDe(ev) }];
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
      // Memoria de agentes: solo tras escribir o editar; la orden de memoria sale siempre con 0
      PostToolUse: [{ matcher: 'write|edit|apply_patch', hooks: [{ type: 'command', command: ordenDeMemoria(orden), timeout: 30 }] }],
    }, null, 2) + '\n',
    nota: 'Guardián: FALLA ABIERTO; solo la salida 2 bloquea, y un error, un tiempo agotado o `fragua` ausente dejan pasar (documentado). Los nombres de herramienta `read`, `write`, `edit`, `apply_patch` y `exec` están confirmados, pero las claves de `tool_input` solo para `exec`: en las herramientas de archivo la ruta se busca por heurística (clave con «path» o «file») y, si la herramienta usa otra, esa acción pasa sin evaluar. Memoria (PostToolUse): registra, no bloquea. Los hooks no corren con el espacio de trabajo en Restricted Mode.',
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
    nota: 'Guardián: FALLA CERRADO (el plugin lanza si `fragua` falla). Evalúa `read`, `edit`, `write`, `patch` y `shell` (nombres y argumentos de opencode.ai/docs/tools, salvo el parámetro del comando de `shell`, que la página no da: se buscan `command`, `cmd` y `script`; si es otro, los comandos pasan sin evaluar). NO CONFIRMADO en la documentación leída: la forma del evento del plugin (`tool.execute.before` con `input.tool` y `output.args`) y que `node:child_process` funcione dentro de un plugin; si no es así, el plugin fallará cerrado y bloqueará toda herramienta. No hay memoria de agentes (el evento posterior no está documentado).',
  },
});

/** De la orden del guardián a la de la memoria del mismo anfitrión. */
export const ordenDeMemoria = (/** @type {string} */ orden) => orden.replace('guardian evaluar', 'memoria registrar');

/** Orden que ejecuta el hook de ese anfitrión. */
export const ordenDeGuardian = (/** @type {string} */ anfitrion) => `fragua guardian evaluar --anfitrion ${anfitrion}`;
