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
  claude: '/', agents: '$', codex: '$', copilot: '/', cursor: '/', gemini: '', windsurf: '@', opencode: '', kiro: '/', generica: '',
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
    '> - `Task("agente", prompt)` o «invocar al agente X»: carga la skill `rol-X` y haz ese trabajo en esta misma conversación, devolviendo solo el informe. Lo que el texto pida en paralelo se hace en secuencia.',
    '> - `TodoWrite`: muestra el avance como una lista de tareas en tu respuesta.',
    '> - `/effort`, `$CLAUDE_PLUGIN_ROOT` y los hooks de Claude Code no existen aquí: ignora esas líneas. Si un paso depende de un hook (guardián, memoria de agentes), hazlo tú: respeta las reglas de `AGENTS.md` y anota tus decisiones en `.sdd/memoria/`.',
    '',
  ].join('\n');
}

/**
 * Reescribe el cuerpo para otra herramienta.
 * @param {string} cuerpo
 * @param {{ prefijo: string, comandos: readonly string[] }} opciones `comandos`: nombres de archivo sin `.md`
 */
export function adaptarCuerpo(cuerpo, { prefijo, comandos }) {
  let t = cuerpo;
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
 * @param {{ prefijo: string, comandos: readonly string[] }} opciones
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
 * @param {{ prefijo: string, comandos: readonly string[] }} opciones
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
