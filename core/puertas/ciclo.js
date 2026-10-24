// @ts-check
/**
 * puertas/ciclo.js — Decisión de las puertas declarables dentro del ciclo (fase B2).
 *
 * Función pura: recibe los resultados de `ejecutarPuertas` y dice si la tarea puede darse por buena. No
 * ejecuta nada ni lee configuración. La llama el nodo `sandbox` tras una ejecución `pass` de las pruebas.
 * Una puerta que no pasa convierte la ejecución en `fail`: la tarea vuelve al implementador con la salida de
 * la puerta. Solo una herramienta ausente (127) pide revisión humana, porque reintentar no la arregla.
 *
 * Las categorías son las de `ejecutarPuertas` (core/puertas/ejecutar.js): `pass` es la única aprobación.
 */

import { CLAVES_PUERTAS } from './config.js';

/** Orden fijo de presentación: el de CLAVES_PUERTAS; las desconocidas, al final. */
const posicion = (/** @type {{ nombre: string }} */ r) => {
  const i = CLAVES_PUERTAS.indexOf(r.nombre);
  return i < 0 ? CLAVES_PUERTAS.length : i;
};

/**
 * @param {{ resultados: { nombre: string, categoria: string, exitCode?: number|null }[] }} o
 * @returns {{ pasa: boolean, revision: boolean, motivo: string|null }}
 */
export function decidirTrasPuertas(o) {
  const malas = o.resultados.filter((r) => r.categoria !== 'pass').sort((a, b) => posicion(a) - posicion(b));
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
 * Lo que el nodo `sandbox` aplica a la categoría de sus pruebas. Solo mira las puertas si las pruebas pasaron:
 * ejecutar puertas sobre un código que ya falla no aporta nada y gasta tiempo.
 *
 * `salida` es la salida de las puertas que no pasan (ya acotada y redactada por `ejecutarPuertas`): es lo que
 * el implementador ve en la siguiente iteración, en lugar de la salida de unas pruebas que sí pasaron.
 *
 * @param {{ categoria: string, puertas: null | (() => Promise<{ nombre: string, categoria: string, exitCode?: number|null, salida?: string }[]>) }} o
 * @returns {Promise<{ categoria: string, revision: boolean, motivo: string|null, salida?: string }>}
 */
export async function ejecucionQaConPuertas(o) {
  if (o.categoria !== 'pass' || o.puertas === null) return { categoria: o.categoria, revision: false, motivo: null };
  const resultados = await o.puertas();
  const d = decidirTrasPuertas({ resultados });
  if (d.pasa) return { categoria: 'pass', revision: false, motivo: null };
  const salida = resultados
    .filter((r) => r.categoria !== 'pass')
    .sort((a, b) => posicion(a) - posicion(b))
    .map((r) => `== puerta ${r.nombre} (${r.categoria}) ==\n${r.salida ?? ''}`)
    .join('\n');
  return { categoria: 'fail', revision: d.revision, motivo: d.motivo, salida };
}
