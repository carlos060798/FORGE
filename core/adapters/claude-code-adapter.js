/**
 * core/adapters/claude-code-adapter.js — Adaptador para Claude Code como host
 *
 * Envuelve el sistema actual (hooks JS + artefactos .sdd/) como adaptador formal.
 * No lanza inferencia directamente — Claude Code (el proceso padre) es el motor.
 * Este adaptador prepara el contexto y los artefactos para que Claude Code
 * los consuma de forma estructurada.
 *
 * Disponible cuando: CLAUDE_AGENT_NAME está definido O existe .claude/settings.json
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ForgeAdapter } from './adapter-interface.js';

export class ClaudeCodeAdapter extends ForgeAdapter {
  get nombre() { return 'claude-code'; }
  get descripcion() { return 'Adaptador para Claude Code — usa hooks JS + artefactos .sdd/'; }

  disponible() {
    // Disponible si hay variable de entorno de Claude Code O existe .claude/settings.json en CWD
    if (process.env.CLAUDE_AGENT_NAME) return true;
    if (process.env.CLAUDE_SESSION_ID) return true;
    const settingsPath = join(process.cwd(), '.claude', 'settings.json');
    const pluginSettingsPath = join(process.cwd(), '.claude-plugin', '.claude', 'settings.json');
    return existsSync(settingsPath) || existsSync(pluginSettingsPath);
  }

  async ejecutar(tarea) {
    const { valid, errors } = this.validarTarea(tarea);
    if (!valid) return this.error(`Tarea inválida: ${errors.join('; ')}`);

    const cwd = tarea.cwd ?? process.cwd();

    // Leer estado actual del pipeline
    const estadoPath = join(cwd, '.sdd', 'estado.json');
    let estadoActual = null;
    if (existsSync(estadoPath)) {
      try { estadoActual = JSON.parse(readFileSync(estadoPath, 'utf8')); } catch { /* ignorar */ }
    }

    // Claude Code es el motor real — este adaptador prepara el handoff
    // construyendo el contexto que el agente necesita para ejecutar la tarea.
    const contextoHandoff = this.#construirContextoHandoff(tarea, estadoActual, cwd);

    return this.exito({
      resultado: `Tarea encolada para ${tarea.agente} vía Claude Code`,
      artefactos: contextoHandoff.artefactosDisponibles,
      estado: estadoActual,
      handoff: contextoHandoff,
    });
  }

  #construirContextoHandoff(tarea, estado, cwd) {
    const artefactos = [
      ['.sdd/ir.json',        'ir'],
      ['.sdd/estado.json',    'estado'],
      ['.sdd/spec.md',        'spec'],
      ['.sdd/plan.md',        'plan'],
      ['.sdd/estado-tareas.json', 'tareas'],
    ];

    const artefactosDisponibles = artefactos
      .filter(([p]) => existsSync(join(cwd, p)))
      .map(([p]) => p);

    return {
      agente: tarea.agente,
      tarea: tarea.tarea,
      tier: tarea.tier ?? 'medium',
      paso_actual: estado?.pipeline_step ?? 'idea',
      artefactosDisponibles,
      instruccion: this.#generarInstruccion(tarea, estado),
    };
  }

  #generarInstruccion(tarea, estado) {
    const paso = estado?.pipeline_step ?? 'idea';
    return [
      `# Tarea FORGE — Agente: ${tarea.agente}`,
      `## Paso actual del pipeline: ${paso}`,
      `## Tarea`,
      tarea.tarea,
      tarea.contexto ? `## Contexto adicional\n${JSON.stringify(tarea.contexto, null, 2)}` : '',
    ].filter(Boolean).join('\n\n');
  }
}
