// @ts-check
/**
 * Proceso hijo de la prueba de idempotencia entre procesos: ejecuta `forge integraciones aprobar <id>`
 * en-proceso (ejecutarIntegraciones) contra un servidor GitHub FALSO local, con una barrera por reloj
 * y una espera tras cada respuesta para ensanchar la ventana entre «buscar el marcador» y «escribir».
 *
 * Argumentos: cwd baseUrl id arranque(ms epoch) esperaMs
 * Salida estándar: una línea JSON { codigo, salida, error }.
 */

const [cwd, baseUrl, id, arranque, esperaMs] = process.argv.slice(2);
const { ejecutarIntegraciones } = await import(new URL('../../../cli/integraciones.js', import.meta.url).href);
const { crearProveedorGitHub } = await import(new URL('../../../core/integraciones/proveedores/github.js', import.meta.url).href);
const { BASE_LOCAL } = await import(new URL('../../../core/integraciones/pruebas-internas.js', import.meta.url).href);

const real = globalThis.fetch;
globalThis.fetch = /** @type {any} */ (async (/** @type {any[]} */ ...a) => {
  const r = await real(.../** @type {[any, any]} */ (a));
  await new Promise((ok) => setTimeout(ok, Number(esperaMs)));
  return r;
});

/** @type {string[]} */ const sal = [];
/** @type {string[]} */ const err = [];
const fabrica = (/** @type {any} */ cfg, /** @type {any} */ { token, auditoria }) => crearProveedorGitHub({
  token, destinos: cfg.destinos, modo: cfg.modo, auditoria, [BASE_LOCAL]: baseUrl,
});
while (Date.now() < Number(arranque)) { /* barrera por reloj */ }
const codigo = await ejecutarIntegraciones(['aprobar', id, '--cwd', cwd], {
  fabrica: /** @type {any} */ (fabrica), salida: (l) => sal.push(l), error: (l) => err.push(l),
});
process.stdout.write(`${JSON.stringify({ codigo, salida: sal.join('\n'), error: err.join('\n') })}\n`);
