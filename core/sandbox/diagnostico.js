/**
 * diagnostico.js — Comprobación de Docker para `forge doctor`
 *
 * Docker es obligatorio para el ciclo verificado (ADR-02), así que `forge doctor` lo comprueba
 * siempre, haya o no `sandbox.runtime`: disponibilidad, versión, tiempo de respuesta e imágenes
 * base. Cada consulta tiene un tiempo máximo corto para que el diagnóstico no se cuelgue.
 */

import { DockerCli } from './docker-cli.js';
import { IMAGENES_BASE } from './preparar-imagen.js';

/** Espera por consulta; `DockerCli` repite una vez, así que el peor caso son dos esperas. */
export const TIMEOUT_DOCTOR_MS = 5_000;

/**
 * @typedef {{ nivel: 'info'|'aviso', texto: string, problema?: boolean }} LineaDiagnostico
 */

/**
 * @param {{ docker?: Pick<DockerCli, 'disponible'|'existeImagen'>, ahora?: () => number }} [opciones]
 *   `docker`: cliente inyectable (pruebas). Por defecto, uno real con espera corta.
 * @returns {Promise<{ ok: boolean, version?: string, ms?: number, lineas: LineaDiagnostico[] }>}
 */
export async function diagnosticarDocker(opciones = {}) {
  const docker = opciones.docker ?? new DockerCli({ timeoutConsultaMs: TIMEOUT_DOCTOR_MS });
  const ahora = opciones.ahora ?? Date.now;
  /** @type {LineaDiagnostico[]} */
  const lineas = [];

  const t0 = ahora();
  const disp = await docker.disponible();
  const ms = Math.max(0, ahora() - t0);

  if (disp.ok === false) {
    lineas.push({ nivel: 'aviso', problema: true, texto: `${disp.error} — es obligatorio para el ciclo verificado (código de salida 4)` });
    return { ok: false, ms, lineas };
  }

  lineas.push({ nivel: 'info', texto: `Docker ${disp.version} disponible ✓ (respondió en ${ms} ms)` });
  if (ms > 2_000) {
    lineas.push({ nivel: 'aviso', texto: `Docker tardó ${ms} ms en responder: el ciclo puede ir lento o agotar tiempos de consulta` });
  }

  for (const imagen of [...new Set(Object.values(IMAGENES_BASE))]) {
    let presente = false;
    try { presente = await docker.existeImagen(imagen); } catch { /* sin respuesta: se trata como ausente */ }
    lineas.push(presente
      ? { nivel: 'info', texto: `Imagen base ${imagen} presente ✓` }
      : { nivel: 'info', texto: `Imagen base ${imagen} no está en el equipo: se descargará (necesita red) la primera vez que un proyecto la use` });
  }
  return { ok: true, version: disp.version, ms, lineas };
}
