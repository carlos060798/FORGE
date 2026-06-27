/**
 * cli/decisions.js — Gestión del store de decisiones arquitectónicas
 *
 * Comandos:
 *   forge decisions list                → lista decisiones activas
 *   forge decisions search "<consulta>" → búsqueda semántica TF-IDF
 *   forge decisions add "<texto>"       → registra decisión manual
 *   forge decisions consolidate         → elimina obsoletas antiguas
 *   forge decisions migrate             → importa ADRs.jsonl existente al store SQLite
 */

import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';

function toFileURL(p) {
  return new URL('file:///' + p.replace(/\\/g, '/')).href;
}

async function cargarStore(cwd) {
  const selfDir = resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'), '..', '..', 'core', 'decisions');
  const localDir = join(cwd, 'core', 'decisions');
  const base = existsSync(localDir) ? localDir : existsSync(selfDir) ? selfDir : null;
  if (!base) throw new Error('core/decisions/ no encontrado. Verifica la instalación de FORGE.');

  const { DecisionStore } = await import(toFileURL(join(base, 'decision-store.js')));
  const adrDir = join(cwd, '.sdd', 'arquitectura');
  return new DecisionStore(adrDir);
}

const COLORES = {
  verde:   (s) => `\x1b[32m${s}\x1b[0m`,
  cyan:    (s) => `\x1b[36m${s}\x1b[0m`,
  gris:    (s) => `\x1b[90m${s}\x1b[0m`,
  amarillo:(s) => `\x1b[33m${s}\x1b[0m`,
  negrita: (s) => `\x1b[1m${s}\x1b[0m`,
};

export async function cmdDecisions(args, cwd = process.cwd()) {
  const subcomando = args[0] ?? 'list';

  let store;
  try {
    store = await cargarStore(cwd);
  } catch (e) {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  }

  switch (subcomando) {
    case 'list': {
      const decisiones = store.listar({ soloActivas: true, limite: 20 });
      if (decisiones.length === 0) {
        console.log(COLORES.gris('\nNo hay decisiones registradas aún.\n'));
        console.log(`  Registra una: forge decisions add "Usar SQLite para persistencia"\n`);
        return;
      }
      console.log(`\n${COLORES.negrita('Decisiones arquitectónicas activas')}\n`);
      decisiones.forEach((d, i) => {
        const ts = d.ts?.slice(0, 10) ?? '?';
        const agente = d.agente ?? 'main';
        console.log(`${COLORES.cyan(`${i + 1}.`)} ${d.decision}`);
        console.log(`   ${COLORES.gris(`${ts} · ${agente}`)}`);
        if (d.context) console.log(`   ${COLORES.gris('Contexto: ' + d.context.slice(0, 80))}`);
        console.log('');
      });
      break;
    }

    case 'search': {
      const consulta = args.slice(1).join(' ');
      if (!consulta) {
        console.error('✗ Uso: forge decisions search "<consulta>"');
        process.exit(1);
      }
      const resultados = store.buscar(consulta, { top: 5 });
      if (resultados.length === 0) {
        console.log(COLORES.gris(`\nSin resultados para: "${consulta}"\n`));
        return;
      }
      console.log(`\n${COLORES.negrita(`Resultados para: "${consulta}"`)}\n`);
      resultados.forEach((r, i) => {
        const score = r.score ? `[${(r.score * 100).toFixed(0)}%]` : '';
        console.log(`${COLORES.cyan(`${i + 1}.`)} ${COLORES.verde(score)} ${r.decision}`);
        if (r.context) console.log(`   ${COLORES.gris(r.context.slice(0, 80))}`);
        console.log('');
      });
      break;
    }

    case 'add': {
      const texto = args.slice(1).join(' ');
      if (!texto) {
        console.error('✗ Uso: forge decisions add "<texto de la decisión>"');
        process.exit(1);
      }
      const agente = process.env.CLAUDE_AGENT_NAME ?? 'main';
      const id = store.registrar({ decision: texto, agente });
      console.log(`${COLORES.verde('✓')} Decisión registrada${id !== null ? ` (ID: ${id})` : ''}: ${texto.slice(0, 60)}`);
      break;
    }

    case 'consolidate': {
      const dias = Number(args[1] ?? 90);
      const eliminadas = store.consolidar({ diasAntiguedad: dias });
      if (eliminadas > 0) {
        console.log(`${COLORES.verde('✓')} ${eliminadas} decisión(es) obsoletas eliminadas (> ${dias} días).`);
      } else {
        console.log(COLORES.gris(`No hay decisiones obsoletas con más de ${dias} días.`));
      }
      break;
    }

    case 'migrate': {
      const jsonlPath = join(cwd, '.sdd', 'arquitectura', 'ADRs.jsonl');
      if (!existsSync(jsonlPath)) {
        console.log(COLORES.gris('No hay ADRs.jsonl para migrar.'));
        return;
      }
      const importadas = store.importarDesdeJSONL(jsonlPath);
      console.log(`${COLORES.verde('✓')} ${importadas} ADR(s) migrados de JSONL a SQLite.`);
      break;
    }

    default:
      console.error(`✗ Subcomando desconocido: "${subcomando}". Usa list, search, add, consolidate o migrate.`);
      process.exit(1);
  }
}
