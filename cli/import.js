/**
 * cli/import.js — Importador simétrico al export.js
 *
 * Lee artefactos portables (Spec Kit o OpenSpec) y los traduce de vuelta
 * al formato .sdd/ interno de FORGE, permitiendo retomar el trabajo
 * desde cualquier host que produjo o modificó la spec.
 *
 * Uso:
 *   forge import --from=speckit --dir=./speckit-export
 *   forge import --from=openspec --file=./openspec.json
 *   forge import --from=speckit --dir=./speckit-export --merge   ← no sobreescribe lo que exista
 */

import {
  existsSync, mkdirSync, readFileSync, writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { validateArtefacto } from '../core/schemas/index.js';

const FORGE_VERSION = '4.0.0';

// ── Parsers de Spec Kit ────────────────────────────────────────────────────────

function parsearSpecMd(contenido) {
  const lines = contenido.split('\n');
  const ir = {
    schemaVersion: '1.0',
    id: `imported-${Date.now()}`,
    created_at: new Date().toISOString(),
    raw_input: '',
    confidence: 0.7,
    product: { name: '', type: 'other', tagline: '', value_proposition: '', target_users: '' },
    features: { core: [], nice_to_have: [] },
    constraints: { budget: null, timeline: null, team_size: null, tech_preference: null },
    assumptions: [],
    ambiguities: [],
    requires_clarification: false,
    questions_for_user: [],
  };

  let section = null;
  for (const line of lines) {
    const trimmed = line.trim();

    // Título del producto
    if (trimmed.startsWith('# ') && !ir.product.name) {
      ir.product.name = trimmed.slice(2).trim();
      continue;
    }
    // Tagline (blockquote al principio)
    if (trimmed.startsWith('> ') && !ir.product.tagline) {
      ir.product.tagline = trimmed.slice(2).trim();
      continue;
    }

    // Detectar secciones
    if (trimmed === '## Overview') { section = 'overview'; continue; }
    if (trimmed === '## Requirements') { section = 'requirements'; continue; }
    if (trimmed === '### Core Features') { section = 'core'; continue; }
    if (trimmed === '### Nice to Have') { section = 'nice'; continue; }
    if (trimmed === '## Constraints') { section = 'constraints'; continue; }
    if (trimmed === '## Assumptions') { section = 'assumptions'; continue; }
    if (trimmed.startsWith('## ')) { section = null; continue; }

    if (section === 'overview') {
      if (trimmed.startsWith('**Type:**')) ir.product.type = trimmed.replace('**Type:**', '').trim();
      if (trimmed.startsWith('**Value Proposition:**')) ir.product.value_proposition = trimmed.replace('**Value Proposition:**', '').trim();
      if (trimmed.startsWith('**Target Users:**')) ir.product.target_users = trimmed.replace('**Target Users:**', '').trim();
    }

    if (section === 'core' && trimmed.startsWith('- ') && !trimmed.includes('_No hay')) {
      ir.features.core.push(trimmed.slice(2).trim());
    }
    if (section === 'nice' && trimmed.startsWith('- ') && !trimmed.includes('_Pendiente')) {
      ir.features.nice_to_have.push(trimmed.slice(2).trim());
    }

    if (section === 'constraints') {
      if (trimmed.startsWith('- **Budget:**')) ir.constraints.budget = trimmed.replace('- **Budget:**', '').trim();
      if (trimmed.startsWith('- **Timeline:**')) ir.constraints.timeline = trimmed.replace('- **Timeline:**', '').trim();
      if (trimmed.startsWith('- **Team size:**')) ir.constraints.team_size = trimmed.replace('- **Team size:**', '').trim();
      if (trimmed.startsWith('- **Tech preference:**')) ir.constraints.tech_preference = trimmed.replace('- **Tech preference:**', '').trim();
    }

    if (section === 'assumptions' && trimmed.startsWith('- ') && !trimmed.includes('_No hay')) {
      ir.assumptions.push(trimmed.slice(2).trim());
    }
  }

  ir.raw_input = `Importado desde Spec Kit: ${ir.product.name}`;
  // Normalizar tipo
  const tiposValidos = ['saas', 'mobile', 'web', 'api', 'cli', 'other'];
  if (!tiposValidos.includes(ir.product.type)) ir.product.type = 'other';

  return ir;
}

function parsearADRsMd(contenido) {
  const adrs = [];
  const bloques = contenido.split(/^### ADR-\d+:/m).slice(1);
  for (const bloque of bloques) {
    const lines = bloque.split('\n').map(l => l.trim());
    const decision = lines[0]?.trim() ?? '';
    const adr = {
      ts: new Date().toISOString(),
      decision,
      context: '',
      alternatives: [],
      status: 'accepted',
      agente: 'importado',
    };
    for (const line of lines) {
      if (line.startsWith('- **Status:**')) adr.status = line.replace('- **Status:**', '').trim();
      if (line.startsWith('- **Agent:**')) adr.agente = line.replace('- **Agent:**', '').trim();
      if (line.startsWith('- **Date:**')) adr.ts = line.replace('- **Date:**', '').trim() + 'T00:00:00Z';
      if (line.startsWith('- **Context:**')) adr.context = line.replace('- **Context:**', '').trim();
      if (line.startsWith('- **Alternatives:**')) {
        const alts = line.replace('- **Alternatives:**', '').trim();
        if (alts && alts !== 'n/a') adr.alternatives = alts.split(',').map(s => s.trim());
      }
    }
    if (decision) adrs.push(adr);
  }
  return adrs;
}

// ── Escritura en .sdd/ ────────────────────────────────────────────────────────

function escribirIR(cwd, ir, merge) {
  const path = join(cwd, '.sdd', 'ir.json');
  if (merge && existsSync(path)) {
    const existente = JSON.parse(readFileSync(path, 'utf8'));
    // En modo merge: preservar datos existentes, completar los vacíos
    const fusionado = {
      ...ir,
      ...existente,
      product: { ...ir.product, ...existente.product },
      features: {
        core: existente.features?.core?.length ? existente.features.core : ir.features.core,
        nice_to_have: existente.features?.nice_to_have?.length ? existente.features.nice_to_have : ir.features.nice_to_have,
      },
    };
    writeFileSync(path, JSON.stringify(fusionado, null, 2));
    return;
  }
  writeFileSync(path, JSON.stringify(ir, null, 2));
}

function escribirADRs(cwd, adrs, merge) {
  if (!adrs.length) return;
  const path = join(cwd, '.sdd', 'arquitectura', 'ADRs.jsonl');
  mkdirSync(join(cwd, '.sdd', 'arquitectura'), { recursive: true });

  if (merge && existsSync(path)) {
    // En merge: solo añadir ADRs que no existan (por decisión)
    const existentes = readFileSync(path, 'utf8')
      .split('\n').filter(Boolean)
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean)
      .map(a => a.decision);
    const nuevos = adrs.filter(a => !existentes.includes(a.decision));
    if (nuevos.length) {
      writeFileSync(path, readFileSync(path, 'utf8') + nuevos.map(a => JSON.stringify(a)).join('\n') + '\n');
    }
    return;
  }
  writeFileSync(path, adrs.map(a => JSON.stringify(a)).join('\n') + '\n');
}

function actualizarEstado(cwd, pipeline_step, ir) {
  const path = join(cwd, '.sdd', 'estado.json');
  const estadoActual = existsSync(path)
    ? JSON.parse(readFileSync(path, 'utf8'))
    : { schemaVersion: '1.0' };

  const actualizado = {
    ...estadoActual,
    schemaVersion: '1.0',
    pipeline_step: pipeline_step ?? estadoActual.pipeline_step ?? 'ir',
    ir_generado: true,
    ir_path: '.sdd/ir.json',
    ultima_actualizacion: new Date().toISOString(),
    artefactos_sesion: {
      ...(estadoActual.artefactos_sesion ?? {}),
      ir_confidence: ir?.confidence ?? null,
    },
  };
  writeFileSync(path, JSON.stringify(actualizado, null, 2));
}

// ── Importar desde Spec Kit ───────────────────────────────────────────────────

async function importarSpecKit(dir, cwd, merge) {
  const specPath = join(dir, 'spec.md');
  if (!existsSync(specPath)) {
    throw new Error(`No se encontró spec.md en: ${dir}`);
  }

  const ir = parsearSpecMd(readFileSync(specPath, 'utf8'));

  // Validar resultado
  const v = validateArtefacto('ir', ir);
  if (!v.valid) {
    console.warn('⚠️  IR importado tiene advertencias:', v.errors.join('; '));
  }

  mkdirSync(join(cwd, '.sdd'), { recursive: true });
  escribirIR(cwd, ir, merge);

  // Importar plan.md si existe y hay contenido real
  const planPath = join(dir, 'plan.md');
  if (existsSync(planPath)) {
    const planContent = readFileSync(planPath, 'utf8');
    const esVacio = planContent.includes('no ha sido generado');
    if (!esVacio) {
      mkdirSync(join(cwd, '.sdd', 'arquitectura'), { recursive: true });
      const planDest = join(cwd, '.sdd', 'arquitectura', `plan-importado.md`);
      if (!merge || !existsSync(planDest)) {
        writeFileSync(planDest, planContent);
        console.log('   plan.md importado → .sdd/arquitectura/plan-importado.md');
      }
    }
  }

  // Importar decisions.md → ADRs.jsonl
  const decisionsPath = join(dir, 'decisions.md');
  if (existsSync(decisionsPath)) {
    const adrs = parsearADRsMd(readFileSync(decisionsPath, 'utf8'));
    if (adrs.length) {
      escribirADRs(cwd, adrs, merge);
      console.log(`   decisions.md → ${adrs.length} ADR(s) importados`);
    }
  }

  actualizarEstado(cwd, 'ir', ir);

  console.log(`✅ Importado desde Spec Kit → .sdd/`);
  console.log(`   Producto: ${ir.product.name}`);
  console.log(`   Features core: ${ir.features.core.length}`);
  console.log(`   ir.json · estado.json actualizados`);
  if (merge) console.log('   (modo --merge: datos existentes preservados)');
  return ir;
}

// ── Importar desde OpenSpec ───────────────────────────────────────────────────

async function importarOpenSpec(filePath, cwd, merge) {
  if (!existsSync(filePath)) {
    throw new Error(`No se encontró: ${filePath}`);
  }

  const data = JSON.parse(readFileSync(filePath, 'utf8'));

  if (!data.openspec_version) {
    throw new Error('El archivo no parece ser un OpenSpec válido (falta openspec_version)');
  }

  const ir = {
    schemaVersion: '1.0',
    id: data.meta?.ir_id ?? `imported-openspec-${Date.now()}`,
    created_at: data.exported_at ?? new Date().toISOString(),
    raw_input: `Importado desde OpenSpec: ${data.product?.name ?? 'desconocido'}`,
    confidence: data.confidence ?? 0.7,
    product: data.product ?? { name: '', type: 'other', tagline: '', value_proposition: '', target_users: '' },
    features: data.features ?? { core: [], nice_to_have: [] },
    constraints: data.constraints ?? {},
    assumptions: data.assumptions ?? [],
    ambiguities: data.ambiguities ?? [],
    requires_clarification: false,
    questions_for_user: [],
  };

  const v = validateArtefacto('ir', ir);
  if (!v.valid) {
    console.warn('⚠️  IR OpenSpec tiene advertencias:', v.errors.join('; '));
  }

  mkdirSync(join(cwd, '.sdd'), { recursive: true });
  escribirIR(cwd, ir, merge);

  // Importar ADRs si existen
  if (data.adrs?.length) {
    escribirADRs(cwd, data.adrs, merge);
    console.log(`   ${data.adrs.length} ADR(s) importados`);
  }

  // Importar tareas si existen
  if (data.tasks?.length) {
    const tareasPath = join(cwd, '.sdd', 'estado-tareas.json');
    if (!merge || !existsSync(tareasPath)) {
      writeFileSync(tareasPath, JSON.stringify({ tareas: data.tasks }, null, 2));
      console.log(`   ${data.tasks.length} tarea(s) importadas → .sdd/estado-tareas.json`);
    }
  }

  actualizarEstado(cwd, data.pipeline_step ?? 'ir', ir);

  console.log(`✅ Importado desde OpenSpec v${data.openspec_version} → .sdd/`);
  console.log(`   Producto: ${ir.product.name}`);
  console.log(`   Features core: ${ir.features.core.length}`);
  if (merge) console.log('   (modo --merge: datos existentes preservados)');
  return ir;
}

// ── Punto de entrada ──────────────────────────────────────────────────────────

export async function cmdImport(args, cwd = process.cwd()) {
  const from = args.find(a => a.startsWith('--from='))?.split('=')[1];
  const dirArg = args.find(a => a.startsWith('--dir='))?.split('=')[1];
  const fileArg = args.find(a => a.startsWith('--file='))?.split('=')[1];
  const merge = args.includes('--merge');

  if (!from) {
    console.error('✗ Falta --from=speckit|openspec');
    process.exit(1);
  }

  if (from === 'speckit') {
    if (!dirArg) {
      console.error('✗ Speckit requiere --dir=<directorio>');
      process.exit(1);
    }
    await importarSpecKit(resolve(cwd, dirArg), cwd, merge);
    return;
  }

  if (from === 'openspec') {
    if (!fileArg) {
      console.error('✗ OpenSpec requiere --file=<archivo.json>');
      process.exit(1);
    }
    await importarOpenSpec(resolve(cwd, fileArg), cwd, merge);
    return;
  }

  console.error(`✗ Formato desconocido: "${from}". Usa: speckit, openspec`);
  process.exit(1);
}
