/**
 * core/adapters/speckit-adapter.js — Adaptador Spec Kit portable (sin LLM)
 *
 * Modo v1: FORGE produce artefactos Spec Kit que cualquier agente puede consumir
 * sin necesidad de tener FORGE instalado ni acceso a Claude Code.
 *
 * Flujo:
 *   1. Lee el .sdd/ actual y el estado del pipeline
 *   2. Genera un "prompt de tarea" en formato Spec Kit (spec.md + instrucción)
 *   3. Escribe los artefactos en el directorio de export
 *   4. Retorna las rutas generadas — el agente externo los consume
 *
 * Este adaptador NO llama a ningún LLM. Es determinista y testeable en CI puro.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ForgeAdapter } from './adapter-interface.js';

// Mapa de pasos del pipeline a instrucciones estándar
const INSTRUCCIONES_POR_PASO = {
  idea:      'Toma la idea inicial y genera un IR (requirements) completo en .sdd/ir.json.',
  discovery: 'Realiza el descubrimiento: valida supuestos del IR, identifica riesgos y lagunas.',
  ir:        'Refina el IR basándote en el descubrimiento. Actualiza .sdd/ir.json.',
  design:    'Diseña la arquitectura del sistema basándote en el IR. Documenta en .sdd/arquitectura/.',
  spec:      'Genera la especificación técnica completa en .sdd/spec.md.',
  plan:      'Genera el plan de implementación en .sdd/plan.md con hitos y dependencias.',
  tasks:     'Desglosa el plan en tareas atómicas en .sdd/estado-tareas.json.',
  code:      'Implementa las tareas del backlog. Actualiza el estado de cada tarea.',
  done:      'Pipeline completado. Genera el resumen final del proyecto.',
};

export class SpecKitAdapter extends ForgeAdapter {
  get nombre() { return 'speckit'; }
  get descripcion() { return 'Adaptador Spec Kit portable — genera artefactos consumibles sin FORGE ni Claude'; }

  disponible() { return true; } // siempre disponible como fallback

  async ejecutar(tarea) {
    const { valid, errors } = this.validarTarea(tarea);
    if (!valid) return this.error(`Tarea inválida: ${errors.join('; ')}`);

    const cwd = tarea.cwd ?? process.cwd();
    const outDir = join(cwd, 'speckit-handoff');

    try {
      const { estado, ir, spec } = this.#leerArtefactos(cwd);
      const artefactosGenerados = this.#generarSpecKit(tarea, estado, ir, spec, outDir);

      return this.exito({
        resultado: `Spec Kit generado en ${outDir}`,
        artefactos: artefactosGenerados,
        estado,
      });
    } catch (e) {
      return this.error(`Error generando Spec Kit: ${e.message}`);
    }
  }

  #leerArtefactos(cwd) {
    const leer = (ruta) => {
      const p = join(cwd, ruta);
      if (!existsSync(p)) return null;
      try { return readFileSync(p, 'utf8'); } catch { return null; }
    };

    const estadoRaw = leer('.sdd/estado.json');
    const irRaw     = leer('.sdd/ir.json');
    const spec      = leer('.sdd/spec.md');

    return {
      estado: estadoRaw ? JSON.parse(estadoRaw) : { pipeline_step: 'idea' },
      ir:     irRaw     ? JSON.parse(irRaw)     : null,
      spec,
    };
  }

  #generarSpecKit(tarea, estado, ir, spec, outDir) {
    mkdirSync(outDir, { recursive: true });
    const generados = [];
    const paso = estado?.pipeline_step ?? 'idea';

    // 1. TASK.md — instrucción de tarea para el agente externo
    const taskMd = this.#generarTaskMd(tarea, paso, estado);
    writeFileSync(join(outDir, 'TASK.md'), taskMd);
    generados.push('speckit-handoff/TASK.md');

    // 2. spec.md — especificación del producto (si existe)
    if (ir) {
      const specMd = this.#generarSpecMd(ir);
      writeFileSync(join(outDir, 'spec.md'), specMd);
      generados.push('speckit-handoff/spec.md');
    } else if (spec) {
      writeFileSync(join(outDir, 'spec.md'), spec);
      generados.push('speckit-handoff/spec.md');
    }

    // 3. pipeline-state.json — estado del pipeline en formato portable
    const pipelineState = {
      step: paso,
      agente: tarea.agente,
      tier:   tarea.tier ?? 'medium',
      artefactos_disponibles: this.#listarArtefactos(tarea.cwd ?? process.cwd()),
      generado_en: new Date().toISOString(),
    };
    writeFileSync(join(outDir, 'pipeline-state.json'), JSON.stringify(pipelineState, null, 2));
    generados.push('speckit-handoff/pipeline-state.json');

    // 4. README.md — instrucciones de consumo para el agente externo
    writeFileSync(join(outDir, 'README.md'), this.#generarReadme(tarea, paso));
    generados.push('speckit-handoff/README.md');

    return generados;
  }

  #generarTaskMd(tarea, paso, estado) {
    const instruccionBase = INSTRUCCIONES_POR_PASO[paso] ?? 'Ejecuta la tarea indicada.';
    return [
      `# Tarea FORGE — ${tarea.agente}`,
      '',
      `**Paso del pipeline:** \`${paso}\``,
      `**Tier de modelo:** ${tarea.tier ?? 'medium'}`,
      '',
      '## Instrucción',
      '',
      tarea.tarea,
      '',
      '## Contexto del pipeline',
      '',
      instruccionBase,
      '',
      tarea.contexto ? `## Contexto adicional\n\n\`\`\`json\n${JSON.stringify(tarea.contexto, null, 2)}\n\`\`\`` : '',
      '',
      '## Artefactos de salida esperados',
      '',
      '- Actualiza `.sdd/estado.json` con el nuevo `pipeline_step`',
      '- Genera o actualiza los artefactos correspondientes al paso actual',
      '- Si tienes dudas, revisa `pipeline-state.json` en este directorio',
    ].filter(s => s !== undefined).join('\n');
  }

  #generarSpecMd(ir) {
    const product = ir?.product ?? {};
    const features = ir?.features ?? {};

    const lineas = [
      `# ${product.name ?? 'Producto sin nombre'}`,
      '',
      product.description ? `> ${product.description}` : '',
      '',
      '## Visión general',
      '',
      `- **Tipo:** ${product.type ?? 'N/A'}`,
      `- **Usuarios objetivo:** ${product.target_users ?? 'N/A'}`,
      '',
    ];

    const core = features.core ?? [];
    if (core.length > 0) {
      lineas.push('## Características principales', '');
      core.forEach(f => lineas.push(`- **${f.nombre ?? f}**: ${f.descripcion ?? ''}`));
      lineas.push('');
    }

    const nice = features.nice_to_have ?? [];
    if (nice.length > 0) {
      lineas.push('## Características opcionales', '');
      nice.forEach(f => lineas.push(`- ${f.nombre ?? f}`));
      lineas.push('');
    }

    const constraints = ir?.constraints ?? [];
    if (constraints.length > 0) {
      lineas.push('## Restricciones', '');
      constraints.forEach(c => lineas.push(`- ${c}`));
      lineas.push('');
    }

    return lineas.join('\n');
  }

  #generarReadme(tarea, paso) {
    return [
      '# FORGE Spec Kit Handoff',
      '',
      'Este directorio contiene los artefactos necesarios para que un agente externo',
      'continúe el pipeline FORGE sin necesidad de tener FORGE instalado.',
      '',
      '## Archivos',
      '',
      '| Archivo | Contenido |',
      '|---|---|',
      '| `TASK.md` | Instrucción de tarea para el agente |',
      '| `spec.md` | Especificación del producto |',
      '| `pipeline-state.json` | Estado actual del pipeline |',
      '',
      '## Cómo usar',
      '',
      '1. Abre `TASK.md` y sigue las instrucciones',
      '2. Lee `spec.md` para entender el contexto del producto',
      '3. Actualiza los artefactos `.sdd/` en el proyecto raíz',
      '',
      `Generado por FORGE SpecKit Adapter — paso \`${paso}\` — agente \`${tarea.agente}\``,
    ].join('\n');
  }

  #listarArtefactos(cwd) {
    const candidatos = [
      '.sdd/ir.json', '.sdd/estado.json', '.sdd/spec.md',
      '.sdd/plan.md', '.sdd/estado-tareas.json',
    ];
    return candidatos.filter(p => existsSync(join(cwd, p)));
  }
}
