// @ts-check
/**
 * puertas/ciclo.js — Decisión de las puertas declarables dentro del ciclo (fase B2).
 *
 * Función pura: recibe los resultados de `ejecutarPuertas` y dice si la tarea puede darse por buena. No
 * ejecuta nada ni lee configuración. La llama el nodo de QA tras una ejecución `pass`: una puerta que
 * falla impide aprobar; una herramienta ausente (`no_ejecutable`) no es aprobación silenciosa y pide
 * revisión humana, porque reintentar no la arregla.
 */

/**
 * @param {{ resultados: { nombre: string, categoria: string, exitCode?: number|null }[] }} o
 * @returns {{ pasa: boolean, revision: boolean, motivo: string|null }}
 */
export function decidirTrasPuertas(o) {
  const malas = o.resultados.filter((r) => r.categoria !== 'pasa');
  if (malas.length === 0) return { pasa: true, revision: false, motivo: null };
  const ausentes = malas.filter((r) => r.categoria === 'no_ejecutable');
  if (ausentes.length > 0) {
    return {
      pasa: false, revision: true,
      motivo: `La puerta ${ausentes.map((r) => r.nombre).join(', ')} no es ejecutable en la imagen (la herramienta no está instalada). No se da la tarea por buena: revisa la sección puertas: o prepara la imagen.`,
    };
  }
  return {
    pasa: false, revision: false,
    motivo: `Las pruebas pasan, pero la puerta ${malas.map((r) => r.nombre).join(', ')} no pasa (${malas.map((r) => r.categoria).join(', ')}). La tarea no se da por buena.`,
  };
}

/**
 * Lo que el nodo de QA aplica a la categoría de sus pruebas. Solo mira las puertas si las pruebas pasaron:
 * ejecutar puertas sobre un código que ya falla no aporta nada y gasta tiempo.
 * @param {{ categoria: string, puertas: null | (() => Promise<{ nombre: string, categoria: string, exitCode?: number|null }[]>) }} o
 * @returns {Promise<{ categoria: string, revision: boolean, motivo: string|null }>}
 */
export async function ejecucionQaConPuertas(o) {
  if (o.categoria !== 'pass' || o.puertas === null) return { categoria: o.categoria, revision: false, motivo: null };
  const d = decidirTrasPuertas({ resultados: await o.puertas() });
  if (d.pasa) return { categoria: 'pass', revision: false, motivo: null };
  return { categoria: 'fail', revision: d.revision, motivo: d.motivo };
}
