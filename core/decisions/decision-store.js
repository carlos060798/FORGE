/**
 * core/decisions/decision-store.js — Store SQLite para decisiones arquitectónicas
 *
 * Reemplaza el append a ADRs.jsonl con un store estructurado que permite:
 *   - Recuperación semántica por similitud léxica (TF-IDF)
 *   - Versionado de decisiones (accepted → superseded)
 *   - Búsqueda por agente, estado, etiquetas y fechas
 *   - Consolidación: olvido ponderado por relevancia + antigüedad
 *
 * Requiere Node >= 22.5 (node:sqlite experimental).
 * Degrada a JSONL cuando SQLite no está disponible.
 */

import { existsSync, mkdirSync, readFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const _require = createRequire(import.meta.url);

// ── SQLite lazy loader ────────────────────────────────────────────────────────

let _sqlite = undefined;
function cargarSQLite() {
  if (_sqlite !== undefined) return _sqlite;
  try {
    const [major, minor] = process.versions.node.split('.').map(Number);
    if (major < 22 || (major === 22 && minor < 5)) { _sqlite = null; return null; }
    _sqlite = _require('node:sqlite');
    return _sqlite;
  } catch {
    _sqlite = null;
    return null;
  }
}

// ── TF-IDF simplificado (sin deps externas) ────────────────────────────────

function tokenizar(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quitar acentos
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

const STOPWORDS = new Set([
  'que', 'con', 'para', 'por', 'como', 'pero', 'sin', 'sobre',
  'entre', 'desde', 'hasta', 'los', 'las', 'del', 'una', 'uno',
  'the', 'and', 'for', 'are', 'not', 'this', 'that', 'with',
]);

function filtrarStopwords(tokens) {
  return tokens.filter(t => !STOPWORDS.has(t));
}

/**
 * Calcula similitud coseno entre dos conjuntos de tokens usando TF.
 * Retorna valor entre 0 (sin similitud) y 1 (idéntico).
 */
function similitudCoseno(tokensA, tokensB) {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const tfA = frecuencias(tokensA);
  const tfB = frecuencias(tokensB);

  const vocab = new Set([...Object.keys(tfA), ...Object.keys(tfB)]);
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const term of vocab) {
    const a = tfA[term] ?? 0;
    const b = tfB[term] ?? 0;
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function frecuencias(tokens) {
  const freq = {};
  for (const t of tokens) freq[t] = (freq[t] ?? 0) + 1;
  return freq;
}

// ── DecisionStore ─────────────────────────────────────────────────────────────

export class DecisionStore {
  #db = null;
  #fallbackPath;
  #disponible = false;

  /**
   * @param {string} storePath — directorio donde guardar la DB (.sdd/arquitectura/)
   */
  constructor(storePath) {
    mkdirSync(storePath, { recursive: true });
    this.#fallbackPath = join(storePath, 'ADRs.jsonl');

    const sqlite = cargarSQLite();
    if (sqlite) {
      try {
        const { DatabaseSync } = sqlite;
        this.#db = new DatabaseSync(join(storePath, 'decisions.db'));
        this.#inicializarEsquema();
        this.#disponible = true;
      } catch (e) {
        process.stderr.write(`[decision-store] SQLite no disponible: ${e.message} — usando JSONL\n`);
      }
    }
  }

  get disponible() { return this.#disponible; }

  #inicializarEsquema() {
    this.#db.exec(`
      CREATE TABLE IF NOT EXISTS decisions (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        ts         TEXT NOT NULL,
        decision   TEXT NOT NULL,
        context    TEXT DEFAULT '',
        rationale  TEXT DEFAULT '',
        alternatives TEXT DEFAULT '[]',
        status     TEXT DEFAULT 'accepted' CHECK(status IN ('accepted','rejected','deprecated','superseded')),
        agente     TEXT DEFAULT 'main',
        tags       TEXT DEFAULT '[]',
        superseded_by INTEGER REFERENCES decisions(id),
        tokens     TEXT DEFAULT ''
      );
      CREATE INDEX IF NOT EXISTS idx_status ON decisions(status);
      CREATE INDEX IF NOT EXISTS idx_agente ON decisions(agente);
      CREATE INDEX IF NOT EXISTS idx_ts     ON decisions(ts);
    `);
  }

  /**
   * Registra una decisión.
   * @param {{ decision: string, context?: string, rationale?: string, alternatives?: string[], status?: string, agente?: string, tags?: string[] }} adr
   * @returns {number|null} ID insertado (SQLite) o null (fallback)
   */
  registrar(adr) {
    const entrada = {
      ts:           new Date().toISOString(),
      decision:     adr.decision ?? '',
      context:      adr.context ?? '',
      rationale:    adr.rationale ?? '',
      alternatives: JSON.stringify(adr.alternatives ?? []),
      status:       adr.status ?? 'accepted',
      agente:       adr.agente ?? 'main',
      tags:         JSON.stringify(adr.tags ?? []),
      tokens:       JSON.stringify(filtrarStopwords(tokenizar(
        `${adr.decision} ${adr.context ?? ''} ${adr.rationale ?? ''}`
      ))),
    };

    if (this.#disponible) {
      const stmt = this.#db.prepare(`
        INSERT INTO decisions (ts, decision, context, rationale, alternatives, status, agente, tags, tokens)
        VALUES (:ts, :decision, :context, :rationale, :alternatives, :status, :agente, :tags, :tokens)
      `);
      const result = stmt.run(entrada);
      return Number(result.lastInsertRowid);
    }

    // Fallback JSONL
    appendFileSync(this.#fallbackPath, JSON.stringify({
      ts: entrada.ts, decision: entrada.decision, context: entrada.context,
      status: entrada.status, agente: entrada.agente,
    }) + '\n');
    return null;
  }

  /**
   * Busca decisiones por similitud semántica con la consulta.
   * @param {string} consulta
   * @param {{ top?: number, soloActivas?: boolean }} opciones
   * @returns {Array<{id, ts, decision, context, status, agente, score}>}
   */
  buscar(consulta, { top = 5, soloActivas = true } = {}) {
    const tokensConsulta = filtrarStopwords(tokenizar(consulta));

    if (this.#disponible) {
      const whereStatus = soloActivas ? "WHERE status = 'accepted'" : '';
      const rows = this.#db.prepare(`SELECT * FROM decisions ${whereStatus} ORDER BY ts DESC`).all();

      return rows
        .map(row => {
          let tokensDoc;
          try { tokensDoc = JSON.parse(row.tokens); } catch { tokensDoc = tokenizar(row.decision); }
          const score = similitudCoseno(tokensConsulta, tokensDoc);
          return { ...row, score };
        })
        .filter(r => r.score > 0 || tokensConsulta.length === 0)
        .sort((a, b) => b.score - a.score || new Date(b.ts) - new Date(a.ts))
        .slice(0, top)
        .map(({ tokens: _t, ...resto }) => resto); // omitir tokens en output
    }

    // Fallback: grep en JSONL
    if (!existsSync(this.#fallbackPath)) return [];
    const lines = readFileSync(this.#fallbackPath, 'utf8')
      .split('\n').filter(Boolean);
    return lines
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean)
      .filter(r => !soloActivas || r.status !== 'rejected')
      .map(r => ({
        ...r,
        score: similitudCoseno(tokensConsulta, filtrarStopwords(tokenizar(r.decision ?? ''))),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, top);
  }

  /**
   * Marca una decisión como superseded y registra la nueva.
   * @param {number} idAnterior
   * @param {object} nuevaDecision
   */
  superseder(idAnterior, nuevaDecision) {
    if (!this.#disponible) return this.registrar({ ...nuevaDecision, status: 'accepted' });

    const nuevaId = this.registrar({ ...nuevaDecision, status: 'accepted' });
    this.#db.prepare(
      'UPDATE decisions SET status = ?, superseded_by = ? WHERE id = ?'
    ).run('superseded', nuevaId, idAnterior);
    return nuevaId;
  }

  /**
   * Consolida: elimina decisiones obsoletas (superseded/rejected) con > 90 días
   * y score de similitud bajo respecto a las decisiones activas.
   * @param {{ diasAntiguedad?: number }} opciones
   * @returns {number} Decisiones eliminadas
   */
  consolidar({ diasAntiguedad = 90 } = {}) {
    if (!this.#disponible) return 0;

    const corte = new Date(Date.now() - diasAntiguedad * 24 * 3600 * 1000).toISOString();
    const obsoletas = this.#db.prepare(`
      SELECT id FROM decisions
      WHERE status IN ('superseded', 'rejected', 'deprecated')
        AND ts < ?
    `).all(corte);

    if (obsoletas.length === 0) return 0;

    const ids = obsoletas.map(r => r.id);
    this.#db.prepare(
      `DELETE FROM decisions WHERE id IN (${ids.map(() => '?').join(',')})`
    ).run(...ids);

    return ids.length;
  }

  /**
   * Importa ADRs desde un archivo JSONL existente (migración one-shot).
   * @param {string} jsonlPath
   * @returns {number} entradas importadas
   */
  importarDesdeJSONL(jsonlPath) {
    if (!existsSync(jsonlPath)) return 0;
    const lines = readFileSync(jsonlPath, 'utf8').split('\n').filter(Boolean);
    let importadas = 0;
    for (const line of lines) {
      try {
        const adr = JSON.parse(line);
        if (adr.decision) { this.registrar(adr); importadas++; }
      } catch { /* línea malformada */ }
    }
    return importadas;
  }

  /**
   * Lista todas las decisiones activas.
   * @returns {Array}
   */
  listar({ soloActivas = true, limite = 50 } = {}) {
    if (this.#disponible) {
      const where = soloActivas ? "WHERE status = 'accepted'" : '';
      return this.#db.prepare(`
        SELECT id, ts, decision, context, status, agente, tags
        FROM decisions ${where}
        ORDER BY ts DESC LIMIT ?
      `).all(limite);
    }

    if (!existsSync(this.#fallbackPath)) return [];
    return readFileSync(this.#fallbackPath, 'utf8')
      .split('\n').filter(Boolean)
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean)
      .filter(r => !soloActivas || r.status !== 'rejected')
      .slice(0, limite);
  }
}
