/**
 * cli/export.js — Exportador de artefactos FORGE a formatos portables
 *
 * Traduce .sdd/ interno → formato Spec Kit o OpenSpec para interoperar
 * con cualquier host (Claude Code, Cursor, Copilot, Gemini CLI, terminal).
 *
 * Uso:
 *   forge export                          → formato speckit por defecto
 *   forge export --format=speckit         → spec.md + plan.md + tasks.md (GitHub Spec Kit)
 *   forge export --format=openspec        → openspec.json (OpenSpec)
 *   forge export --format=speckit --out=./export-dir
 */

import {
  existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { validateArtefacto } from '../core/schemas/index.js';

const FORGE_VERSION = '4.0.0';

// ── Leer artefactos .sdd/ ─────────────────────────────────────────────────────

function leerEstado(cwd) {
  const path = join(cwd, '.sdd', 'estado.json');
  if (!existsSync(path)) return {};
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return {}; }
}

function leerIR(cwd) {
  const path = join(cwd, '.sdd', 'ir.json');
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

function leerSpec(cwd, estado) {
  const specId = estado.spec_activa;
  if (!specId) return null;
  const path = join(cwd, '.sdd', 'especificaciones', specId, 'spec.md');
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf8');
}

function leerPlan(cwd, estado) {
  const planId = estado.plan_activo;
  if (!planId) return null;
  const path = join(cwd, '.sdd', 'arquitectura', `${planId}.md`);
  if (!existsSync(path)) {
    // Buscar cualquier plan en arquitectura/
    const archDir = join(cwd, '.sdd', 'arquitectura');
    if (!existsSync(archDir)) return null;
    const planes = readdirSync(archDir).filter(f => f.endsWith('.md') && !f.startsWith('ADR'));
    if (planes.length === 0) return null;
    return readFileSync(join(archDir, planes[0]), 'utf8');
  }
  return readFileSync(path, 'utf8');
}

function leerTareas(cwd) {
  const path = join(cwd, '.sdd', 'estado-tareas.json');
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

function leerADRs(cwd) {
  const path = join(cwd, '.sdd', 'arquitectura', 'ADRs.jsonl');
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

// ── Formato Spec Kit (GitHub) ──────────────────────────────────────────────────
// Convención: spec.md + plan.md + tasks.md
// https://github.com/github/spec-kit

function irASpecKit(ir, estado) {
  const producto = ir?.product?.name ?? 'Proyecto';
  const tipo = ir?.product?.type ?? 'app';
  const tagline = ir?.product?.tagline ?? '';
  const features = (ir?.features?.core ?? []).map(f => `- ${f}`).join('\n');
  const niceToHave = (ir?.features?.nice_to_have ?? []).map(f => `- ${f}`).join('\n');
  const assumptions = (ir?.assumptions ?? []).map(a => `- ${a}`).join('\n');
  const constraints = ir?.constraints ?? {};

  return `# ${producto}

> ${tagline}

## Overview

**Type:** ${tipo}
**Value Proposition:** ${ir?.product?.value_proposition ?? ''}
**Target Users:** ${ir?.product?.target_users ?? ''}

## Requirements

### Core Features

${features || '_No hay features definidas todavía_'}

### Nice to Have

${niceToHave || '_Pendiente_'}

## Constraints

${constraints.budget ? `- **Budget:** ${constraints.budget}` : ''}
${constraints.timeline ? `- **Timeline:** ${constraints.timeline}` : ''}
${constraints.team_size ? `- **Team size:** ${constraints.team_size}` : ''}
${constraints.tech_preference ? `- **Tech preference:** ${constraints.tech_preference}` : ''}

## Assumptions

${assumptions || '_No hay asunciones registradas_'}

---

_Generado por FORGE v${FORGE_VERSION} · Pipeline step: ${estado.pipeline_step ?? 'n/a'} · ${new Date().toISOString().slice(0, 10)}_
_Formato: [Spec Kit](https://github.com/github/spec-kit)_
`;
}

function planASpecKit(planMd, ir) {
  if (planMd) return planMd + `\n\n---\n_Exportado por FORGE v${FORGE_VERSION}_\n`;
  const producto = ir?.product?.name ?? 'Proyecto';
  return `# Plan — ${producto}

_El plan no ha sido generado todavía. Ejecuta \`/sdd.planificar\` en FORGE para generarlo._

---
_Generado por FORGE v${FORGE_VERSION}_
`;
}

function tareasASpecKit(tareas, ir) {
  const producto = ir?.product?.name ?? 'Proyecto';
  if (!tareas?.tareas?.length) {
    return `# Tasks — ${producto}

_Las tareas no han sido generadas todavía. Ejecuta \`/sdd.tareas\` en FORGE para generarlas._

---
_Generado por FORGE v${FORGE_VERSION}_
`;
  }

  const porEstado = { pendiente: [], en_progreso: [], completada: [] };
  for (const t of tareas.tareas) {
    const bucket = porEstado[t.estado] ?? porEstado.pendiente;
    bucket.push(t);
  }

  const fmtTarea = (t) =>
    `- [ ] **${t.id ?? '?'}** ${t.descripcion ?? t.titulo ?? '(sin descripción)'}`
    + (t.agente ? ` _(${t.agente})_` : '');

  return `# Tasks — ${producto}

## Pending

${porEstado.pendiente.map(fmtTarea).join('\n') || '_Ninguna_'}

## In Progress

${porEstado.en_progreso.map(fmtTarea).join('\n') || '_Ninguna_'}

## Completed

${porEstado.completada.map(fmtTarea).join('\n') || '_Ninguna_'}

---
_Generado por FORGE v${FORGE_VERSION} · ${new Date().toISOString().slice(0, 10)}_
`;
}

function adrsAMarkdown(adrs) {
  if (!adrs.length) return '';
  const entries = adrs.map((adr, i) => `
### ADR-${String(i + 1).padStart(3, '0')}: ${adr.decision}

- **Status:** ${adr.status}
- **Agent:** ${adr.agente}
- **Date:** ${adr.ts?.slice(0, 10) ?? 'n/a'}
- **Context:** ${adr.context || 'n/a'}
- **Alternatives:** ${(adr.alternatives ?? []).join(', ') || 'n/a'}
`).join('\n');

  return `# Architecture Decision Records

${entries}

---
_Exportado por FORGE v${FORGE_VERSION}_
`;
}

// ── Formato OpenSpec (JSON) ────────────────────────────────────────────────────

function exportarOpenSpec(ir, estado, tareas, adrs) {
  return {
    openspec_version: '1.0',
    forge_version: FORGE_VERSION,
    exported_at: new Date().toISOString(),
    pipeline_step: estado.pipeline_step ?? null,
    product: ir?.product ?? null,
    features: ir?.features ?? null,
    constraints: ir?.constraints ?? null,
    assumptions: ir?.assumptions ?? [],
    ambiguities: ir?.ambiguities ?? [],
    confidence: ir?.confidence ?? null,
    tasks: tareas?.tareas ?? [],
    adrs,
    meta: {
      ir_id: ir?.id ?? null,
      spec_activa: estado.spec_activa ?? null,
      plan_activo: estado.plan_activo ?? null,
    },
  };
}

// ── Punto de entrada ──────────────────────────────────────────────────────────

export async function cmdExport(args, cwd = process.cwd()) {
  const format = (args.find(a => a.startsWith('--format='))?.split('=')[1]) ?? 'speckit';
  const outArg = args.find(a => a.startsWith('--out='))?.split('=')[1];
  const outDir = resolve(cwd, outArg ?? `${format}-export`);

  const estado = leerEstado(cwd);
  const ir     = leerIR(cwd);
  const spec   = leerSpec(cwd, estado);
  const plan   = leerPlan(cwd, estado);
  const tareas = leerTareas(cwd);
  const adrs   = leerADRs(cwd);

  // Validar IR si existe
  if (ir) {
    const v = validateArtefacto('ir', ir);
    if (!v.valid) {
      console.warn('⚠️  IR tiene advertencias de esquema:', v.errors.join('; '));
    }
  }

  mkdirSync(outDir, { recursive: true });

  if (format === 'speckit') {
    writeFileSync(join(outDir, 'spec.md'),  irASpecKit(ir, estado));
    writeFileSync(join(outDir, 'plan.md'),  planASpecKit(spec ?? plan, ir));
    writeFileSync(join(outDir, 'tasks.md'), tareasASpecKit(tareas, ir));
    if (adrs.length > 0) {
      writeFileSync(join(outDir, 'decisions.md'), adrsAMarkdown(adrs));
    }
    writeFileSync(join(outDir, 'README.md'), `# ${ir?.product?.name ?? 'Proyecto'} — Spec Kit Export

Exportado desde FORGE v${FORGE_VERSION} el ${new Date().toISOString().slice(0, 10)}.

## Archivos

| Archivo | Contenido |
|---|---|
| \`spec.md\` | Requisitos y overview del producto |
| \`plan.md\` | Plan técnico y decisiones de arquitectura |
| \`tasks.md\` | Lista de tareas del pipeline |
${adrs.length > 0 ? '| `decisions.md` | Architecture Decision Records |\n' : ''}

## Cómo usar en otro agente

1. Abre \`spec.md\` en tu editor/agente favorito (Cursor, Copilot, Gemini CLI, etc.)
2. El agente puede leer la spec y continuar el trabajo sin necesitar FORGE instalado
3. Para volver a FORGE: \`forge import --from=${format} --dir=.\`
`);

    console.log(`✅ Exportado en formato Spec Kit → ${outDir}/`);
    console.log(`   spec.md · plan.md · tasks.md${adrs.length > 0 ? ' · decisions.md' : ''} · README.md`);
    return outDir;
  }

  if (format === 'openspec') {
    const data = exportarOpenSpec(ir, estado, tareas, adrs);
    writeFileSync(join(outDir, 'openspec.json'), JSON.stringify(data, null, 2));
    console.log(`✅ Exportado en formato OpenSpec → ${outDir}/openspec.json`);
    return outDir;
  }

  console.error(`✗ Formato desconocido: "${format}". Usa: speckit, openspec`);
  process.exit(1);
}
