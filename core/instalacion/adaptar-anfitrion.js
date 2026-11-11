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
  t = t.replace(/\bClaude Code\b/g, 'tu herramienta de código');
  return t;
}

/** Cadena YAML segura en una línea (JSON es YAML válido). */
const yamlCadena = (s) => JSON.stringify(s);

/**
 * Adapta un `SKILL.md` (propio o generado de un comando) a una herramienta que no es Claude Code.
 * Quita `allowed-tools` (nombres de herramientas de Claude Code) y conserva el resto de la cabecera.
 * @param {string} skillMd
 * @param {{ prefijo: string, comandos: readonly string[], rutas?: { skills?: string|null, agentes?: string|null } }} opciones
 * @returns {string}
 */
export function adaptarSkill(skillMd, opciones) {
  const t = skillMd.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(t);
  if (!m) return notaDeAnfitrion(opciones.prefijo) + '\n' + adaptarCuerpo(t, opciones);
  const cabecera = adaptarCuerpo(m[1].split('\n').filter((l) => !/^allowed-tools:/.test(l)).join('\n'), opciones);
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
