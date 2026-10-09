/**
 * sospecha.js — Señales de que un «las pruebas pasan» no demuestra nada
 *
 * El ciclo aprueba por código de salida. Un código 0 puede ser falso si:
 *  - la salida no muestra ninguna prueba ejecutada y pasada (`echo ok`, un comando mal elegido);
 *  - el código de producción corta el proceso antes de que las pruebas corran (`process.exit(0)`).
 *
 * Es una mitigación, no una frontera: un implementador decidido a engañar puede
 * esconder la salida forzada (indentarla, envolverla en una función). Por eso, además de buscar la
 * llamada, se compara cuántas pruebas escribió el agente de pruebas con cuántas informa el ejecutor:
 * un corte a mitad de la ejecución deja menos pruebas en el resumen, cómo se haya escondido.
 * Cuando hay señales no se da el éxito por bueno: se pide revisión humana.
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
  /^ok\s+\S+\s+\(cached\)/m,                    // go test con caché
  /^Ran [1-9]\d* tests?\b/m,                    // unittest de Python
  /^[1-9]\d* (?:examples?|specs?|tests?), 0 failures/m, // rspec, jasmine
  /^OK \([1-9]\d* tests?\b/m,                   // phpunit
  /^Tests run: [1-9]\d*, Failures: 0/m,         // maven (surefire)
];

/** Salidas forzadas al comienzo de línea: se ejecutan al importar el módulo. */
const SALIDA_FORZADA = /^(?:process\.(?:exit|abort|reallyExit)|os\._exit|sys\.exit|Deno\.exit|exit|quit)\s*\(/m;

/**
 * Pruebas que declaran unos archivos de prueba (JS/TS, Python, Go). Se cuenta por defecto: una prueba
 * parametrizada o generada en un bucle da más pruebas ejecutadas que declaradas, nunca menos.
 * @param {{ ruta: string, contenido: string }[]} archivos
 */
export function contarPruebasDeclaradas(archivos) {
  let n = 0;
  for (const { contenido } of archivos) {
    n += (contenido.match(/^[ \t]*(?:test|it)(?:\.(?:only|concurrent|skip|todo))?[ \t]*\(/gm) ?? []).length;
    n += (contenido.match(/^[ \t]*(?:async[ \t]+)?def[ \t]+test_\w*/gm) ?? []).length;
    n += (contenido.match(/^func[ \t]+Test\w*[ \t]*\(/gm) ?? []).length;
  }
  return n;
}

/**
 * Pruebas que dice haber ejecutado el ejecutor, o null si su resumen no da una cuenta que se pueda leer.
 * @param {string} texto
 */
export function contarPruebasInformadas(texto) {
  const nodo = /^(?:ℹ|#)\s*tests\s+(\d+)/m.exec(texto);
  if (nodo) return Number(nodo[1]);
  const jest = /Tests:\s+(?:\d+\s+\w+,\s+)*(\d+)\s+total/i.exec(texto);
  if (jest) return Number(jest[1]);
  const unittest = /^Ran (\d+) tests?\b/m.exec(texto);
  if (unittest) return Number(unittest[1]);
  // pytest: "3 passed, 1 failed, 2 skipped in 0.1s"
  const resumen = /^=*\s*((?:\d+ (?:passed|failed|skipped|xfailed|xpassed|errors?|deselected|warnings?)(?:, )?)+).*\bin [\d.]+s/m.exec(texto);
  if (resumen) return [...resumen[1].matchAll(/(\d+) (?:passed|failed|skipped|xfailed|xpassed|errors?)/g)].reduce((s, m) => s + Number(m[1]), 0);
  // mocha
  const mocha = [...texto.matchAll(/^\s*(\d+) (?:passing|failing|pending)\b/gm)];
  if (mocha.length > 0) return mocha.reduce((s, m) => s + Number(m[1]), 0);
  return null;
}

/**
 * @param {string} texto  stdout + stderr de la ejecución
 */
export function hayEvidenciaDePruebas(texto) {
  return EVIDENCIA.some((re) => re.test(texto));
}

/**
 * @param {{ stdout?: string, stderr?: string, archivos?: { ruta: string, contenido: string }[], pruebas?: { ruta: string, contenido: string }[] }} entrada
 * @returns {string[]} motivos legibles; vacío si no hay nada sospechoso
 */
export function detectarSospecha({ stdout = '', stderr = '', archivos = [], pruebas = [] }) {
  /** @type {string[]} */
  const motivos = [];
  if (!hayEvidenciaDePruebas(`${stdout}\n${stderr}`)) {
    motivos.push('la salida no muestra ninguna prueba ejecutada y pasada (¿el comando de pruebas ejecuta algo?)');
  }
  const declaradas = contarPruebasDeclaradas(pruebas);
  const informadas = contarPruebasInformadas(`${stdout}\n${stderr}`);
  if (declaradas > 0 && informadas !== null && informadas < declaradas) {
    motivos.push(`el agente de pruebas escribió ${declaradas} pruebas y la salida informa de ${informadas}: la ejecución pudo cortarse antes de terminar`);
  }
  for (const { ruta, contenido } of archivos) {
    if (SALIDA_FORZADA.test(contenido)) {
      motivos.push(`${ruta} corta el proceso al cargarse (process.exit, sys.exit…): las pruebas pueden no haberse ejecutado`);
    }
  }
  return motivos;
}
