/**
 * cli/dispatch.js — Despacho de tareas a través del sistema de adaptadores
 *
 * Comandos:
 *   forge dispatch --agente=<nombre> --tarea="<descripción>" [--tier=low|medium|high] [--adapter=speckit|claude-code]
 *   forge adapters  → lista los adaptadores disponibles
 */

import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';

function toFileURL(p) {
  return new URL('file:///' + p.replace(/\\/g, '/')).href;
}

async function cargarAdapters(cwd) {
  const selfDir = resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'), '..', '..', 'core', 'adapters');
  const localDir = join(cwd, 'core', 'adapters');
  const base = existsSync(localDir) ? localDir : existsSync(selfDir) ? selfDir : null;

  if (!base) throw new Error('core/adapters/ no encontrado. Verifica la instalación de FORGE.');

  const { adapterRegistry } = await import(toFileURL(join(base, 'index.js')));
  return adapterRegistry;
}

export async function cmdDispatch(args, cwd = process.cwd()) {
  const agente  = args.find(a => a.startsWith('--agente='))?.split('=').slice(1).join('=');
  const tarea   = args.find(a => a.startsWith('--tarea='))?.split('=').slice(1).join('=');
  const tier    = args.find(a => a.startsWith('--tier='))?.split('=')[1];
  const adapter = args.find(a => a.startsWith('--adapter='))?.split('=')[1];

  if (!agente || !tarea) {
    console.error('✗ Uso: forge dispatch --agente=<nombre> --tarea="<descripción>" [--tier=low|medium|high] [--adapter=speckit|claude-code]');
    process.exit(1);
  }

  let registry;
  try {
    registry = await cargarAdapters(cwd);
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  }

  const adapterInstancia = adapter
    ? registry.obtener(adapter)
    : registry.resolver();

  if (!adapterInstancia) {
    console.error(`✗ Adaptador ${adapter ? `"${adapter}"` : 'disponible'} no encontrado.`);
    console.error(`  Usa 'forge adapters' para ver los disponibles.`);
    process.exit(1);
  }

  if (adapter && !adapterInstancia.disponible()) {
    console.error(`✗ El adaptador "${adapter}" no está disponible en este entorno.`);
    process.exit(1);
  }

  console.log(`\nDespachando tarea con adaptador: ${adapterInstancia.nombre}`);
  console.log(`  Agente: ${agente}`);
  console.log(`  Tier:   ${tier ?? 'medium'}`);
  console.log(`  Tarea:  ${tarea.slice(0, 80)}${tarea.length > 80 ? '...' : ''}\n`);

  const resultado = await adapterInstancia.ejecutar({ agente, tarea, tier, cwd });

  if (!resultado.ok) {
    console.error(`✗ Error: ${resultado.error}`);
    process.exit(1);
  }

  console.log(`✓ ${resultado.resultado}`);

  if (resultado.artefactos?.length > 0) {
    console.log('\nArtefactos generados:');
    resultado.artefactos.forEach(a => console.log(`  • ${a}`));
  }

  if (resultado.handoff) {
    console.log('\nHandoff para Claude Code:');
    console.log(`  Paso actual: ${resultado.handoff.paso_actual}`);
    console.log(`  Artefactos disponibles: ${resultado.handoff.artefactosDisponibles.join(', ') || 'ninguno'}`);
  }

  console.log('');
}

export async function cmdAdapters(cwd = process.cwd()) {
  let registry;
  try {
    registry = await cargarAdapters(cwd);
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  }

  console.log('\nAdaptadores FORGE registrados:\n');
  registry.listar().forEach(a => console.log(`  • ${a}`));
  console.log('');
}
