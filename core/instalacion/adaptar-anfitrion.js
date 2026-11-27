// @ts-check
/**
 * adaptar-anfitrion.js — Adapta comandos, skills y agentes de Claude Code a otra herramienta.
 * Plan docs/PLAN-AGNOSTICO.md, fases F1 y F2.
 *
 * Funciones puras (no tocan el disco). La fuente sigue siendo `commands/`, `agents/` y `skills/`:
 * lo que recibe Claude Code no cambia. Para las demás herramientas se hace en la instalación:
 *  - las referencias `/sdd.x` y `/forge` pasan a la forma de invocación de esa herramienta;
 *  - `allowed-tools` (nombres de herramientas de Claude Code) se quita de la cabecera;
 *  - «Claude Code» en prosa pasa a «tu herramienta de código»;
 *  - se antepone una nota con las equivalencias de lo que solo existe en Claude Code
 *    (`Task`, `TodoWrite`, `/effort`, `$CLAUDE_PLUGIN_ROOT`, hooks);
 *  - cada agente se instala como una skill de rol `rol-<agente>`.
 */

import { nombreDeSkill, separarCabecera } from './skills-de-comandos.js';
import { PLANTILLAS_HOOKS } from './hooks-anfitrion.js';

/**
 * Prefijo con el que cada herramienta invoca una skill por nombre (spike S0.1).
 * Claves de `INTEGRACIONES`. Sin prefijo: se invoca en lenguaje natural («usa la skill X»).
 * @type {Readonly<Record<string, string>>}
 */
export const PREFIJO_INVOCACION = Object.freeze({
  claude: '/', agents: '$', codex: '$', copilot: '/', cursor: '/', gemini: '', windsurf: '@', opencode: '', kiro: '/', zed: '/', goose: '', generica: '',
});

/** Nivel neutral (ADR-19) a partir del nombre de modelo de la cabecera de un agente. */
export function nivelDeModelo(modelo) {
  const m = String(modelo ?? '').toLowerCase();
  if (m.includes('opus')) return 'alto';
  if (m.includes('haiku')) return 'economico';
  return 'medio';
}

/** Cómo se nombra una skill al pedirla en esta herramienta. */
function referencia(prefijo, nombreSkill) {
  return prefijo ? `${prefijo}${nombreSkill}` : `la skill \`${nombreSkill}\``;
}

/**
 * Nota que se antepone al cuerpo en herramientas que no son Claude Code.
 * @param {string} prefijo
 */
export function notaDeAnfitrion(prefijo) {
  const como = prefijo ? `con \`${prefijo}<nombre>\`` : 'pidiendo «usa la skill <nombre>»';
  return [
    '> **Nota de anfitrión (no es Claude Code).** Este texto se escribió para Claude Code; aquí se aplican estas equivalencias:',
    `> - Las órdenes \`/sdd.x\` son skills: se invocan ${como}, con el punto cambiado por guion (\`sdd.planificar\` → \`sdd-planificar\`).`,
    '> - `delegar_a_rol("agente", prompt)` (o «invocar al agente X»): es pseudocódigo. Carga la skill `rol-X` y haz ese trabajo en esta misma conversación, devolviendo solo el informe. Lo que el texto pida en paralelo se hace en secuencia.',
    '> - `mostrar_lista_de_tareas`: muestra el avance como una lista de tareas en tu respuesta.',
    '> - El ajuste de esfuerzo (`/effort` en Claude Code) y `$CLAUDE_PLUGIN_ROOT` no existen aquí: usa el ajuste de tu herramienta o ignora esas líneas.',
    '> - Los scripts `claude-hooks/*.js` (índice de símbolos, consulta de memoria, context-manager, model-registry) son de Claude Code y no se instalan: si un paso los pide y no existen, sáltalo. El guardián sí está disponible como `fragua guardian evaluar` si instalaste con `--con-hooks`; si no, respeta tú las reglas de `AGENTS.md` y anota tus decisiones en `.sdd/memoria/`.',
    '',
  ].join('\n');
}

/**
 * Skills cuyo núcleo es un script de Claude Code (`claude-hooks/`) o una función de esfuerzo de Claude: no se instalan en otras
 * herramientas. Las fuentes no cambian (informe de agnosticismo del 2026-11-24, H-B3 y H-B4).
 */
export const SKILLS_SOLO_CLAUDE = Object.freeze(["indexar-proyecto", "compresion-tokens", "cache-audit", "deploy-vercel", "effort-router", "sdd-crear-agente"]);

const NIVEL_DE_FAMILIA = { opus: "alto", sonnet: "medio", haiku: "economico" };

/**
 * Reescribe el cuerpo para otra herramienta.
 * @param {string} cuerpo
 * @param {{ prefijo: string, comandos: readonly string[], rutas?: { skills?: string|null, agentes?: string|null } }} opciones
 *   `comandos`: nombres de archivo sin `.md`. `rutas`: carpetas (relativas al proyecto, con `/`) donde esta herramienta
 *   tiene las skills y los agentes; sustituyen a `.claude/skills/` y `.claude/agents/` del texto.
 */
export function adaptarCuerpo(cuerpo, { prefijo, comandos, rutas }) {
  let t = cuerpo;
  // Rutas de instalación de Claude Code: en otra herramienta esas carpetas no existen (hallazgo de scripts/emular-instalacion.mjs)
  if (rutas?.skills) t = t.replace(/\.claude\/skills\//g, `${rutas.skills}/`);
  if (rutas?.agentes) t = t.replace(/\.claude\/agents\//g, `${rutas.agentes}/`);
  if (comandos.length) {
    const alternativas = [...comandos].sort((a, b) => b.length - a.length).map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    // `/sdd.planificar` suelto: no `.sdd/…`, no rutas `a/sdd.config.yaml` ni `/forge/dir`, no `/sdd.planificar.md`
    const r = new RegExp(`(?<![\\w./-])/(${alternativas})(?![\\w/-]|\\.\\w)`, 'g');
    // Cómo se escribe la referencia según dónde cae. En un bloque de código un `$sdd-x` se expandiría como
    // variable de shell y una referencia con comillas invertidas ejecutaría una sustitución de comando
    // (`echo "ejecuta $sdd-x"`); en un span en línea las comillas se anidarían. Por eso, en bloques solo se
    // conserva el prefijo `/` (inerte) y en el resto va el nombre desnudo; en un span en línea no se usa la
    // forma con comillas.
    const enBloque = (c) => (prefijo === '/' ? `/${nombreDeSkill(c)}` : nombreDeSkill(c));
    const enSpan = (c) => (prefijo ? `${prefijo}${nombreDeSkill(c)}` : nombreDeSkill(c));
    t = t.split(/(```[\s\S]*?```|`[^`\n]+`)/g).map((trozo, i) => {
      if (i % 2 === 0) return trozo.replace(r, (_, c) => referencia(prefijo, nombreDeSkill(c)));
      return trozo.startsWith('```') ? trozo.replace(r, (_, c) => enBloque(c)) : trozo.replace(r, (_, c) => enSpan(c));
    }).join('');
  }
  // Pseudocódigo de Claude Code (solo en otras herramientas; Claude recibe los archivos sin tocar). Ninguna de
  // estas sustituciones cambia cómo se ejecuta un bloque bash: `Task(` y `TodoWrite` son pseudocódigo, no órdenes.
  t = t.replace(/\bTask\(/g, 'delegar_a_rol(');
  t = t.replace(/\bTodoWrite\b/g, 'mostrar_lista_de_tareas');
  // Una orden `/effort X` al inicio de línea (bloque de código) pasa a un comentario; en el texto, a una referencia neutral
  t = t.replace(/^([ \t]*)\/effort[ \t]+(\S+)([^\n]*)$/gm, (_m, sangria, nivel, resto) => `${sangria}# esfuerzo «${nivel}»: ajústalo en tu herramienta (esa orden es de Claude Code)${resto}`);
  t = t.replace(/(?<![\w./-])\/effort[ \t]+(\w+)/g, 'el esfuerzo «$1» de tu herramienta');
  t = t.replace(/(^|[ \t])[^.\n]*\bhook `agent-memory\.js`[^.\n]*\./gm, (_m, antes) => antes + 'En esta herramienta no hay hook de memoria: al terminar, anota tus decisiones en `.sdd/memoria/`.');
  // Identificadores de modelo de Claude: en otra herramienta se dice el nivel, no el modelo
  t = t.replace(/\bclaude-(opus|sonnet|haiku)-\d[\w.-]*/g, (_m, f) => `«${NIVEL_DE_FAMILIA[f]}»`);
  t = t.replace(/\bClaude Code\b/g, 'tu herramienta de código');
  return t;
}

/** Cadena YAML segura en una línea (JSON es YAML válido). */
const yamlCadena = (s) => JSON.stringify(s);

/**
 * Adapta un `SKILL.md` (propio o generado de un comando) a una herramienta que no es Claude Code.
 * Quita `allowed-tools` (nombres de herramientas de Claude Code) y `model` (el nombre de un modelo de Claude: no es un campo del
 * estándar, otras herramientas lo ignoran y la API de Skills de Claude lo rechaza) y conserva el resto de la cabecera.
 * Solo se quitan los campos de primer nivel: una clave `model` dentro de `metadata` no se toca. Las fuentes no cambian.
 * @param {string} skillMd
 * @param {{ prefijo: string, comandos: readonly string[], rutas?: { skills?: string|null, agentes?: string|null } }} opciones
 * @returns {string}
 */
export function adaptarSkill(skillMd, opciones) {
  const t = skillMd.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(t);
  if (!m) return notaDeAnfitrion(opciones.prefijo) + '\n' + adaptarCuerpo(t, opciones);
  const cabecera = adaptarCuerpo(m[1].split('\n').filter((l) => !/^(?:allowed-tools|model):/.test(l)).join('\n'), opciones);
  const cuerpo = adaptarCuerpo(t.slice(m[0].length).replace(/^\n+/, ''), opciones);
  return `---\n${cabecera}\n---\n\n${notaDeAnfitrion(opciones.prefijo)}\n${cuerpo}`;
}

/**
 * Convierte un agente de `agents/` en una skill de rol `rol-<agente>`.
 * @param {string} archivo nombre sin `.md`
 * @param {string} texto contenido del agente
 * @param {{ prefijo: string, comandos: readonly string[], rutas?: { skills?: string|null, agentes?: string|null } }} opciones
 * @returns {{ nombre: string, skillMd: string, errores: string[] }}
 */
export function agenteARol(archivo, texto, opciones) {
  const errores = [];
  const { campos, cuerpo } = separarCabecera(texto);
  const sinComillas = (v) => String(v ?? '').replace(/^(["'])([\s\S]*)\1$/, '$2');
  const nombre = `rol-${nombreDeSkill(archivo)}`.slice(0, 64).replace(/-+$/, '');
  let descripcion = sinComillas(campos.get('description')).replace(/\s+/g, ' ').trim();
  if (!descripcion) errores.push(`el agente ${archivo} no tiene description`);
  if (descripcion.length > 1024) descripcion = descripcion.slice(0, 1023).trimEnd() + '…';
  descripcion = `Rol «${archivo}» de Fragua. ${descripcion}`.slice(0, 1024);
  const herramientas = sinComillas(campos.get('tools')).replace(/[\[\]"',]/g, ' ').split(/\s+/).filter(Boolean);
  const metadata = {
    'forge-agente': archivo,
    'forge-nivel': nivelDeModelo(campos.get('model')),
    ...(herramientas.length ? { 'forge-herramientas': herramientas.join(' ') } : {}),
  };
  const lineas = ['---', `name: ${nombre}`, `description: ${yamlCadena(descripcion)}`, 'metadata:',
    ...Object.entries(metadata).map(([k, v]) => `  ${k}: ${yamlCadena(v)}`), '---', ''];
  const meta = [campos.get('goal') && `**Objetivo:** ${sinComillas(campos.get('goal'))}`, campos.get('backstory') && `**Criterio:** ${sinComillas(campos.get('backstory'))}`].filter(Boolean);
  const aviso = '> Este es un **rol**: carga estas instrucciones y trabaja como este agente en la conversación actual. Respeta las herramientas y los límites que indica (los agentes de solo lectura no escriben).';
  const cuerpoAdaptado = adaptarCuerpo(cuerpo.replace(/^\n+/, ''), opciones);
  return { nombre, skillMd: lineas.join('\n') + aviso + '\n\n' + (meta.length ? meta.join('\n\n') + '\n\n' : '') + cuerpoAdaptado, errores };
}

/**
 * Adapta el `AGENTS.md` generado para un proyecto instalado en una herramienta que no es Claude Code: las órdenes `/sdd.x`
 * del texto pasan a la forma de invocar de esa herramienta y se añade un bloque «Flujo Fragua en esta herramienta» con
 * cómo se usa Fragua allí y qué NO está activo (guardián, guardias de solo lectura, prueba en la herramienta real).
 * Es determinista: `init` compara el resultado con el archivo existente para decir «ya está al día».
 * Con Claude Code no se llama: ese archivo no cambia.
 * @param {string} texto el `AGENTS.md` ya generado (constitución o plantilla mínima)
 * @param {{ integracion: { clave: string, nombre: string }, prefijo: string, comandos: readonly string[], conHooks: boolean }} opciones
 * @returns {string}
 */
export function adaptarAgentsMd(texto, { integracion, prefijo, comandos, conHooks }) {
  const { clave, nombre } = integracion;
  const ref = (/** @type {string} */ skill) => referencia(prefijo, skill);
  const cuerpo = adaptarCuerpo(texto.replace(/\r\n/g, '\n'), { prefijo, comandos }).replace(/\n+$/, '\n');
  const plantilla = PLANTILLAS_HOOKS[clave];
  const guardian = !plantilla
    ? `${nombre} no tiene adaptador de hook en Fragua: el guardián no está instalado, así que las reglas de este archivo se piden al modelo y nada las hace cumplir.`
    : conHooks
      ? `El guardián de Fragua está registrado en \`${plantilla.ruta}\`. Es una red de seguridad, no un límite: donde la herramienta falla abierto (Gemini CLI, Codex y Windsurf) es consultivo. Un agente no puede reescribir ese archivo.`
      : `El guardián de Fragua (el que bloquea comandos destructivos y escrituras de secretos) **no está instalado** en esta herramienta: las reglas de este archivo se piden al modelo y nada las hace cumplir. \`fragua init --integracion ${clave} --con-hooks\` lo registra.`;
  const bloque = [
    `## Flujo Fragua en esta herramienta (${nombre})`,
    '',
    `Este proyecto usa Fragua, una metodología de desarrollo guiado por especificaciones. Así se usa en ${nombre}:`,
    '',
    `- **Empezar:** pide ${ref('forge')} con tu idea y sigue con ${ref('sdd-especificar')}, ${ref('sdd-planificar')}, ${ref('sdd-tareas')} y ${ref('sdd-implementar')}; ${ref('sdd-estado')} dice en qué punto estás. Son los comandos del perfil esencial; el resto se instala con \`fragua init --integracion ${clave} --perfil completo\`.`,
    '- **Roles:** los agentes de Fragua son skills `rol-<agente>` (por ejemplo `rol-revisor`). Se cargan y trabajan en esta misma conversación, sin contexto aislado.',
    '- **Aprobar:** la especificación y el plan los aprueba una persona con `fragua aprobar spec` en una terminal real. Ningún agente marca una aprobación.',
    '- **Verificar:** `fragua run` (el ciclo verificado, que necesita Docker) y `fragua verificar` funcionan igual en cualquier herramienta.',
    '',
    '### Qué no está activo en esta herramienta',
    '',
    `- ${guardian}`,
    '- Las guardias de agentes de solo lectura y la memoria por agente no corren fuera de Claude Code: ninguna herramienta define `FRAGUA_AGENTE`. Un rol «de solo lectura» lo es por su instrucción, no por una barrera.',
    `- Esta instalación **no está probada** en ${nombre}: lo que se instala sale de la documentación de la herramienta, no de haberlo visto funcionar. Detalle en \`.sdd/docs/ANFITRIONES.md\`.`,
    '',
  ].join('\n');
  return `${cuerpo}\n${bloque}`;
}
