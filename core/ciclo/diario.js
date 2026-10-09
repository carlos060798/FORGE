/**
 * diario.js — Diario de las llamadas a modelos de un nodo en curso
 *
 * El punto de guardado se escribe al terminar un nodo. Si el proceso se corta
 * dentro de un nodo, después de que el modelo ya respondió, la respuesta pagada
 * se perdería y habría que pagarla otra vez. Este diario la guarda en cuanto
 * llega; al reanudar, el mismo nodo la recupera en lugar de volver a llamar.
 * Se vacía al guardar el punto del nodo: solo cubre lo que está en vuelo.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

const nombre = (threadId) => threadId.replace(/[^\w.-]/g, '_') + '.jsonl';

/**
 * Misma petición, misma clave. No incluye el modelo: la degradación de modelo la decide el gasto
 * acumulado, que cambia justo con la respuesta que se quiere recuperar (si la respuesta cruzo el
 * umbral, al reanudar el alias seria otro y se pagaria dos veces).
 */
export function claveDe({ agente, userPrompt, extraContext, clavePrompt }) {
  // `clavePrompt`: la parte del prompt que no cambia por lo que el propio nodo escribe en el disco.
  // Sin ella, un corte tras escribir y antes de guardar el punto daba otro prompt al reanudar y la
  // llamada se pagaba dos veces (R3 de la revisión independiente).
  return createHash('sha256')
    .update(JSON.stringify([agente, clavePrompt ?? userPrompt, extraContext ?? '']))
    .digest('hex');
}

export class Diario {
  /** @param {string} dirMotor */
  constructor(dirMotor) {
    this.dir = path.join(dirMotor, 'diario');
  }

  _archivo(threadId) { return path.join(this.dir, nombre(threadId)); }

  /** @returns {any|null} la respuesta guardada, o null */
  obtener(threadId, clave) {
    let texto;
    try { texto = fs.readFileSync(this._archivo(threadId), 'utf8'); } catch { return null; }
    for (const linea of texto.split('\n')) {
      if (!linea) continue;
      try {
        const e = JSON.parse(linea);
        if (e.clave === clave) return e.respuesta;
      } catch { /* línea cortada por un fallo: se ignora */ }
    }
    return null;
  }

  anotar(threadId, clave, respuesta) {
    fs.mkdirSync(this.dir, { recursive: true });
    fs.appendFileSync(this._archivo(threadId), JSON.stringify({ clave, respuesta }) + '\n', 'utf8');
  }

  limpiar(threadId) {
    try { fs.unlinkSync(this._archivo(threadId)); } catch { /* no había nada */ }
  }
}

/**
 * Gasto de la sesión, sumado llamada a llamada. Es la fuente de verdad del
 * presupuesto: no depende de que ninguna tarea llegue a guardar su estado.
 */
export class LibroDeGasto {
  /** @param {string} dirMotor */
  constructor(dirMotor) {
    this.archivo = path.join(dirMotor, 'gasto.jsonl');
    this.extra   = path.join(dirMotor, 'tope.json');
  }

  anotar({ taskId, usd, inputTokens, outputTokens }) {
    fs.mkdirSync(path.dirname(this.archivo), { recursive: true });
    fs.appendFileSync(this.archivo, JSON.stringify({ ts: new Date().toISOString(), taskId, usd, inputTokens, outputTokens }) + '\n', 'utf8');
  }

  /** @returns {{ usd: number, llamadas: number, tokens_in: number, tokens_out: number }} */
  total() {
    const t = { usd: 0, llamadas: 0, tokens_in: 0, tokens_out: 0 };
    let texto = '';
    try { texto = fs.readFileSync(this.archivo, 'utf8'); } catch { return t; }
    for (const linea of texto.split('\n')) {
      if (!linea) continue;
      try {
        const e = JSON.parse(linea);
        t.usd += Number(e.usd) || 0;
        t.llamadas++;
        t.tokens_in += Number(e.inputTokens) || 0;
        t.tokens_out += Number(e.outputTokens) || 0;
      } catch { /* línea cortada */ }
    }
    return t;
  }

  /** Tope ampliado por una persona; vale para toda la sesión. */
  tope() {
    try { return Number(JSON.parse(fs.readFileSync(this.extra, 'utf8')).tope_usd) || null; } catch { return null; }
  }

  guardarTope(tope_usd) {
    fs.mkdirSync(path.dirname(this.extra), { recursive: true });
    const tmp = this.extra + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ tope_usd }), 'utf8');
    fs.renameSync(tmp, this.extra);
  }
}
