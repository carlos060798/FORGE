/**
 * diagnostico.js — Comprobación de Docker para `forge doctor`
 *
 * Docker es obligatorio para el ciclo verificado (ADR-02), así que `forge doctor` lo comprueba
 * siempre, haya o no `sandbox.runtime`: disponibilidad, versión, tiempo de respuesta e imágenes
 * base. Cada consulta tiene un tiempo máximo corto para que el diagnóstico no se cuelgue.
 *
 * Cuando no está disponible, distingue «no instalado» de «instalado pero no arrancado» y dice qué
 * hacer en cada caso (spec 2026-11-09-puerta-de-entrada-solo-dev, CA-002-02).
 */

import { DockerCli } from './docker-cli.js';
import { IMAGENES_BASE } from './preparar-imagen.js';

/** Espera por consulta; `DockerCli` repite una vez, así que el peor caso son dos esperas. */
export const TIMEOUT_DOCTOR_MS = 5_000;

/**
 * @typedef {{ nivel: 'info'|'aviso', texto: string, problema?: boolean }} LineaDiagnostico
 */

/**
 * Clasifica el texto de error de `DockerCli.disponible()`.
 * - `no_instalado`: el ejecutable `docker` no existe (ENOENT, «not found», «no se reconoce»).
 * - `no_arrancado`: el ejecutable responde pero el demonio no (tubería o socket cerrados, «Is the docker daemon running»).
 * - `otro`: tiempo agotado u otra causa.
 * @param {string} error
 * @param {string} [plataforma]  `process.platform` por defecto (inyectable en pruebas)
 * @returns {{ causa: 'no_instalado'|'no_arrancado'|'otro', accion: string }}
 */
export function clasificarFalloDocker(error, plataforma = process.platform) {
  const e = error.toLowerCase();
  if (/enoent|not found|no se reconoce|no such file|command not found|is not recognized/.test(e)) {
    return {
      causa: 'no_instalado',
      accion: plataforma === 'win32'
        ? 'Docker no está instalado: instala Docker Desktop (https://www.docker.com/products/docker-desktop/) y vuelve a ejecutar forge doctor'
        : 'Docker no está instalado: instala Docker Engine o Docker Desktop y vuelve a ejecutar forge doctor',
    };
  }
  if (/daemon|dockerdesktoplinuxengine|docker_engine|\/var\/run\/docker\.sock|pipe|socket|cannot connect|connection refused|error during connect/.test(e)) {
    return {
      causa: 'no_arrancado',
      accion: plataforma === 'win32'
        ? 'Docker está instalado pero no arrancado: abre Docker Desktop, espera a que diga «Engine running» y vuelve a ejecutar forge doctor'
        : 'Docker está instalado pero el demonio no responde: arráncalo (p. ej. `sudo systemctl start docker`, o abre Docker Desktop) y vuelve a ejecutar forge doctor',
    };
  }
  return { causa: 'otro', accion: 'Sin Docker el ciclo verificado no empieza (código de salida 4). Para trabajar sin aislamiento, con aviso: forge run --motor clasico' };
}

/**
 * @param {{ docker?: Pick<DockerCli, 'disponible'|'existeImagen'>, ahora?: () => number, plataforma?: string }} [opciones]
 *   `docker`: cliente inyectable (pruebas). Por defecto, uno real con espera corta.
 * @returns {Promise<{ ok: boolean, version?: string, ms?: number, causa?: 'no_instalado'|'no_arrancado'|'otro', lineas: LineaDiagnostico[] }>}
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
    const { causa, accion } = clasificarFalloDocker(disp.error, opciones.plataforma);
    lineas.push({ nivel: 'aviso', problema: true, texto: `${disp.error} — es obligatorio para el ciclo verificado (código de salida 4)` });
    lineas.push({ nivel: 'aviso', texto: `  Solución: ${accion}` });
    return { ok: false, ms, causa, lineas };
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

/**
 * Texto de la sección «Siguiente paso» de `forge doctor` (CA-002-01): el camino de cinco comandos y qué
 * hacer si falta Docker. Puro, para probarlo sin ejecutar el diagnóstico.
 * @param {{ dockerOk: boolean }} estado
 * @returns {string[]}
 */
export function textoSiguientePaso({ dockerOk }) {
  const lineas = [
    'Abre Claude Code en este proyecto y sigue el camino de cinco comandos:',
    '  /sdd.especificar  → la idea se convierte en una spec que apruebas tú (fragua aprobar spec)',
    '  /sdd.planificar   → plan técnico',
    '  /sdd.tareas       → tareas pequeñas y verificables',
    '  /sdd.implementar  → el ciclo verificado escribe pruebas y código y las ejecuta en un contenedor sin red',
    '  /sdd.estado       → dónde va el proyecto y qué espera de ti',
  ];
  if (!dockerOk) {
    lineas.push('Sin Docker, /sdd.implementar no arranca (código 4). Para seguir SIN aislamiento, con aviso en cada paso: forge run --motor clasico');
  }
  lineas.push('Guía: docs/PRIMEROS-15-MINUTOS.md');
  return lineas;
}
