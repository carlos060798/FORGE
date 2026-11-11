// @ts-check
/**
 * herramientas-guardian.js — La herramienta MCP `guardian_evaluar` (plan docs/PLAN-AGNOSTICO.md, F3)
 *
 * Es `fragua guardian evaluar` visto desde otra herramienta: pasa el evento al MISMO guardián que usan los
 * hooks de Claude Code (`ejecutarHook` de cli/comandos/guardian.js), sin reglas duplicadas.
 *
 * CONSULTIVA, NO IMPUESTA. Un servidor MCP no puede interponerse entre el modelo y sus otras herramientas:
 * el modelo (o un texto hostil que lo guíe) puede no llamarla, o ignorar su respuesta. Solo es una barrera si
 * el anfitrión la llama desde un hook que pueda bloquear (`fragua guardian evaluar --anfitrion <x>`).
 *
 * Diseño: el llamante es un modelo que puede estar leyendo texto hostil.
 *   - Solo evalúa: no lee ni escribe archivos del proyecto, no ejecuta lo que se le describe, no llama a
 *     ningún modelo, no gasta, no usa red. No hay argumento `agente`: la identidad sale del entorno del
 *     usuario (FRAGUA_AGENTE), nunca de lo que diga el llamante.
 *   - Campos de `tool_input` cerrados y acotados; cualquier otro se rechaza.
 */

import * as path from 'path';
import { agenteActivo } from '../../claude-hooks/shared/entorno.js';

/** Herramientas del contrato (docs/contrato/evento-herramienta.md). */
export const HERRAMIENTAS_DEL_CONTRATO = Object.freeze(['Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'Read', 'Bash', 'PowerShell']);
export const MAX_CONTENIDO = 256 * 1024;
export const MAX_COMANDO = 16 * 1024;
export const MAX_MOTIVO = 2000;

/** @param {object} cuerpo @param {boolean} [error] */
const respuesta = (cuerpo, error = false) => ({ texto: JSON.stringify({ formato: 1, ...cuerpo }), error });

/**
 * @param {{ cwd: string, env?: Record<string, string|undefined>,
 *   ejecutarHook?: (cual: 'guardian'|'memoria', entrada: string, o?: { cwd?: string, env?: Record<string, string|undefined> }) => { codigo: number, stderr: string } }} opciones
 *   `ejecutarHook` solo se inyecta en pruebas; por defecto, el de la CLI.
 * @returns {import('./protocolo.js').Herramienta}
 */
export function crearHerramientaGuardian(opciones) {
  const cwd = path.resolve(opciones.cwd);
  const env = opciones.env ?? process.env;

  return {
    name: 'guardian_evaluar',
    description:
      'CONSULTIVA: te dice si el guardián de Fragua permitiría o bloquearía una acción ANTES de que la hagas. No impide nada por sí sola: '
      + 'nada te obliga a llamarla ni a hacerle caso, así que no es una barrera de seguridad. Si responde "bloquear", no hagas la acción y díselo al usuario. '
      + 'Entrada: el nombre de la herramienta que ibas a usar (Write, Edit, MultiEdit, NotebookEdit, Read, Bash o PowerShell) y su entrada '
      + '(file_path o path; content; command). Devuelve {decision: "permitir"|"bloquear", motivo}. '
      + 'No lee ni escribe archivos, no ejecuta el comando que describes, no llama a ningún modelo, no usa red y no gasta.',
    inputSchema: {
      type: 'object',
      properties: {
        tool_name: { type: 'string', enum: [...HERRAMIENTAS_DEL_CONTRATO], description: 'La herramienta que ibas a usar' },
        tool_input: {
          type: 'object',
          properties: {
            file_path: { type: 'string', maxLength: 1024 },
            path: { type: 'string', maxLength: 1024 },
            content: { type: 'string', maxLength: MAX_CONTENIDO },
            command: { type: 'string', maxLength: MAX_COMANDO },
          },
          additionalProperties: false,
        },
      },
      required: ['tool_name', 'tool_input'],
      additionalProperties: false,
    },

    async ejecutar(args) {
      // El esquema ya filtró lo evidente; aquí se vuelve a comprobar porque el servidor no debe fiarse de quien llama
      const nombre = args?.tool_name;
      const entrada = args?.tool_input;
      if (typeof nombre !== 'string' || !HERRAMIENTAS_DEL_CONTRATO.includes(nombre)) return respuesta({ decision: 'no_evaluada', motivo: 'tool_name no es una herramienta del contrato.' }, true);
      if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) return respuesta({ decision: 'no_evaluada', motivo: 'tool_input debe ser un objeto.' }, true);
      for (const [k, v] of Object.entries(entrada)) {
        if (!['file_path', 'path', 'content', 'command'].includes(k) || typeof v !== 'string') return respuesta({ decision: 'no_evaluada', motivo: `tool_input.${k} no se acepta.` }, true);
        if (/\0/.test(v)) return respuesta({ decision: 'no_evaluada', motivo: `tool_input.${k} contiene un carácter nulo.` }, true);
      }

      const hook = opciones.ejecutarHook ?? (await import('../../cli/comandos/guardian.js')).ejecutarHook;
      const identidad = agenteActivo(env);
      // El hook se ejecuta en el proyecto de este servidor; la identidad la pone el usuario, no el llamante
      const r = hook('guardian', JSON.stringify({ tool_name: nombre, tool_input: entrada }), { cwd, env: { ...env, ...(identidad ? { FRAGUA_AGENTE: identidad } : {}) } });

      const motivo = String(r.stderr ?? '').trim().slice(0, MAX_MOTIVO);
      if (r.codigo === 0) return respuesta({ decision: 'permitir', ...(motivo ? { aviso: motivo } : {}) });
      // 2 bloquea; cualquier otro código también cuenta como «no permitir» (el guardián falla cerrado)
      return respuesta({ decision: 'bloquear', codigo: r.codigo, motivo: motivo || 'El guardián no dio motivo.' });
    },
  };
}
