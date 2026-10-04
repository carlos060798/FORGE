/**
 * sospecha.js — Señales de que un «las pruebas pasan» no demuestra nada
 *
 * El ciclo aprueba por código de salida. Un código 0 puede ser falso si:
 *  - la salida no muestra ninguna prueba ejecutada y pasada (`echo ok`, un comando mal elegido);
 *  - el código de producción corta el proceso antes de que las pruebas corran (`process.exit(0)`).
 *
 * Es una mitigación, no una frontera: un implementador decidido a engañar puede
 * esconder la salida forzada (indentarla, envolverla en una función). Cuando hay
 * señales no se da el éxito por bueno: se pide revisión humana.
 */

/** Resúmenes de ejecutores conocidos que indican al menos una prueba pasada. */
const EVIDENCIA = [
  /^#\s*pass\s+[1-9]\d*/m,                      // node:test (TAP)
  /^ℹ\s*pass\s+[1-9]\d*/m,                      // node:test (reporter por defecto)
  /^ok\s+\d+\b/m,                               // TAP genérico
  /\bTests?:?\s+(?:\d+\s+\w+,\s+)*[1-9]\d*\s+passed\b/i, // jest y vitest
  /\b[1-9]\d*\s+passed\b/i,                     // pytest, jest
  /\b[1-9]\d*\s+passing\b/i,                    // mocha
  /^ok\s+\S+\s+[\d.]+s/m,                       // go test
];

/** Salidas forzadas al comienzo de línea: se ejecutan al importar el módulo. */
const SALIDA_FORZADA = /^(?:process\.(?:exit|abort|reallyExit)|os\._exit|sys\.exit|Deno\.exit|exit|quit)\s*\(/m;

/**
 * @param {string} texto  stdout + stderr de la ejecución
 */
export function hayEvidenciaDePruebas(texto) {
  return EVIDENCIA.some((re) => re.test(texto));
}

/**
 * @param {{ stdout?: string, stderr?: string, archivos?: { ruta: string, contenido: string }[] }} entrada
 * @returns {string[]} motivos legibles; vacío si no hay nada sospechoso
 */
export function detectarSospecha({ stdout = '', stderr = '', archivos = [] }) {
  /** @type {string[]} */
  const motivos = [];
  if (!hayEvidenciaDePruebas(`${stdout}\n${stderr}`)) {
    motivos.push('la salida no muestra ninguna prueba ejecutada y pasada (¿el comando de pruebas ejecuta algo?)');
  }
  for (const { ruta, contenido } of archivos) {
    if (SALIDA_FORZADA.test(contenido)) {
      motivos.push(`${ruta} corta el proceso al cargarse (process.exit, sys.exit…): las pruebas pueden no haberse ejecutado`);
    }
  }
  return motivos;
}
