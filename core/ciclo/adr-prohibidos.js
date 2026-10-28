// @ts-check
/**
 * adr-prohibidos.js — Patrones que una decisión de arquitectura aceptada prohíbe escribir
 *
 * Es la regla que el hook de Claude Code (claude-hooks/pre-tool-guard.js) aplica al escribir, llevada al motor
 * para que valga con cualquier modelo. Fuente: `.sdd/arquitectura/ADR-NN-*.md`.
 *  - Solo cuentan los ADR con «> Estado: aceptada».
 *  - Solo los términos de la sección «## Patrones prohibidos», uno por línea y entre comillas invertidas.
 *    No se deduce nada del texto libre («evitar X» en el contexto no bloquea).
 *  - Los artefactos de `.sdd/` pueden nombrar los términos que prohíben sin bloquearse a sí mismos.
 *
 * Es una comparación de texto, no un análisis del código: una mitigación para que el agente no reintroduzca lo
 * que el proyecto decidió dejar, no una barrera contra un atacante.
 */
import * as fs from 'fs';
import * as path from 'path';

const MAX_ADR = 100;
const MAX_BYTES_ADR = 256 * 1024;

/**
 * @param {string} cwd
 * @returns {string[]} términos en minúsculas
 */
export function cargarPatronesDeArquitectura(cwd) {
  /** @type {string[]} */
  const patrones = [];
  try {
    const dir = path.join(cwd, '.sdd', 'arquitectura');
    const info = fs.lstatSync(dir);
    if (!info.isDirectory()) return [];
    const nombres = fs.readdirSync(dir).filter((f) => /^ADR-\d+.*\.md$/.test(f)).slice(0, MAX_ADR);
    for (const f of nombres) {
      let texto = '';
      try {
        const ruta = path.join(dir, f);
        const st = fs.lstatSync(ruta);
        if (!st.isFile() || st.size > MAX_BYTES_ADR) continue;   // enlaces y archivos enormes se ignoran
        texto = fs.readFileSync(ruta, 'utf8').replace(/\r\n/g, '\n');
      } catch { continue; }
      if (!/^>\s*Estado:\s*aceptada\b/m.test(texto)) continue;
      const seccion = texto.match(/^##\s+Patrones prohibidos\s*\n([\s\S]*?)(?=^##\s|(?![\s\S]))/m);
      if (!seccion) continue;
      for (const m of seccion[1].matchAll(/^\s*[-*]\s+`([^`\n]+)`/gm)) {
        const termino = m[1].trim().toLowerCase();
        if (termino.length > 2 && termino.length < 50) patrones.push(termino);
      }
    }
  } catch { return []; }
  return [...new Set(patrones)];
}

/**
 * @param {string} rutaPosix ruta del archivo que se escribe
 * @param {string} contenido
 * @param {string[]} patrones
 * @returns {string | null} el término prohibido que aparece, o null
 */
export function violacionDeArquitectura(rutaPosix, contenido, patrones) {
  if (patrones.length === 0 || /(^|\/)\.sdd\//.test(rutaPosix)) return null;
  const minus = contenido.toLowerCase();
  return patrones.find((p) => minus.includes(p)) ?? null;
}
