/**
 * evidencia/protegidos.js — configuración de herramientas de calidad que un agente NO debe reescribir
 *
 * Spike `configuracion-protegida.md` (spec 2026-10-14-puertas-de-calidad-y-evidencia): hoy
 * `clasificarRuta` (core/ciclo/protocolo-archivos.js) deja escribir `tsconfig.json`, `mypy.ini`,
 * `ruff.toml`, `biome.json`... y con ellas un implementador puede aflojar la puerta que lo juzga
 * (quitar `strict`, añadir `exclude`). Esta lista es la que habrá que sumar a `CONFIGURACION`.
 *
 * CABLEADO (F6.6, F1.5): `clasificarRuta` (core/ciclo/protocolo-archivos.js) la consulta y devuelve
 * `configuracion`, de modo que el implementador no la escribe (ni `aplicarArchivos`, ni el servidor MCP, ni la
 * publicación). NO entra en `esVetada` ni en `vetadas`: esas listas también deciden qué se copia al contenedor
 * (core/sandbox/staging.js) y qué se lee para el contexto, y un tsconfig.json que no se copiara rompería las
 * pruebas de TypeScript. Solo APRIETA: nunca quita protección a lo que ya la tiene.
 *
 * La comparación es por nombre de archivo (último componente), sin distinguir mayúsculas (Windows y
 * macOS lo hacen: `TSConfig.json` es el mismo archivo), y tras normalizar `\` y `/`.
 */

/** Patrones del nombre de archivo. Cada uno con su herramienta, para el mensaje y la prueba de tabla. */
export const CONFIGURACION_PROTEGIDA = Object.freeze([
  { patron: /^tsconfig[^/]*\.json$/i, herramienta: 'tipos (TypeScript)' },
  { patron: /^jsconfig[^/]*\.json$/i, herramienta: 'tipos (JavaScript)' },
  { patron: /^biome\.jsonc?$/i, herramienta: 'linter y formato (Biome)' },
  { patron: /^tslint\.json$/i, herramienta: 'linter (TSLint)' },
  { patron: /^mypy\.ini$/i, herramienta: 'tipos (mypy)' },
  { patron: /^ruff\.toml$/i, herramienta: 'linter (ruff)' },
  { patron: /^\.?pylintrc$/i, herramienta: 'linter (pylint)' },
  { patron: /^semgrep[^/]*\.ya?ml$/i, herramienta: 'seguridad (semgrep)' },
  { patron: /^bandit[^/]*\.ya?ml$/i, herramienta: 'seguridad (bandit)' },
  { patron: /^codecov\.ya?ml$/i, herramienta: 'cobertura (codecov)' },
  { patron: /^sonar-project\.properties$/i, herramienta: 'calidad (Sonar)' },
  { patron: /^deno\.jsonc?$/i, herramienta: 'tipos y linter (Deno)' },
]);

/**
 * @param {unknown} ruta  ruta relativa al proyecto, venga de donde venga (puede ser hostil)
 * @returns {{ protegida: boolean, herramienta: string|null }}
 */
export function clasificarConfiguracionProtegida(ruta) {
  if (typeof ruta !== 'string' || ruta.length === 0 || ruta.length > 4096 || ruta.includes('\0')) {
    // Lo que no es una ruta utilizable no se deja escribir
    return { protegida: true, herramienta: null };
  }
  const partes = ruta.replace(/\\/g, '/').split('/').filter((p) => p !== '' && p !== '.');
  const nombre = partes[partes.length - 1];
  if (nombre === undefined) return { protegida: true, herramienta: null };
  // Windows ignora el punto y el espacio finales y trata `nombre:flujo` como el mismo archivo: se comprueban las dos formas
  const sinAdornos = nombre.replace(/:.*$/s, '').replace(/[ .]+$/, '');
  for (const { patron, herramienta } of CONFIGURACION_PROTEGIDA) {
    if (patron.test(nombre) || patron.test(sinAdornos)) return { protegida: true, herramienta };
  }
  return { protegida: false, herramienta: null };
}

/** @param {unknown} ruta @returns {boolean} */
export function esConfiguracionProtegida(ruta) {
  return clasificarConfiguracionProtegida(ruta).protegida;
}
