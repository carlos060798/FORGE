// @ts-check
/**
 * Las pruebas con Docker real que llaman al ejecutor directamente necesitan la imagen base en el equipo: el ejecutor
 * usa `--pull never` a propósito (el código generado nunca descarga nada). La CLI de Fragua la descarga antes cuando hace
 * falta (`descargarBase`); estas pruebas no pasan por la CLI. Sin este paso funcionaban solo en equipos que ya tenían la
 * imagen en caché, y fallaban en un Docker recién instalado, como el de la integración continua (comprobado el 2026-11-11
 * en un Docker de Linux limpio: `No such image: node:22-alpine@sha256:…`, 7 de 11 pruebas en rojo).
 */

import { IMAGENES_BASE } from "../../core/sandbox/preparar-imagen.js";

/**
 * Descarga, si no están, las imágenes base de los lenguajes pedidos. Lanza si no puede.
 * @param {import("../../core/sandbox/docker-cli.js").DockerCli} cli
 * @param {Array<keyof typeof IMAGENES_BASE>} [lenguajes]
 */
export async function asegurarImagenesBase(cli, lenguajes = ["javascript"]) {
  for (const imagen of new Set(lenguajes.map((l) => IMAGENES_BASE[l]))) {
    if (!imagen || (await cli.existeImagen(imagen))) continue;
    const r = await cli.descargar(imagen);
    if (!r.ok) throw new Error(`No se pudo descargar la imagen base ${imagen}: ${r.error}`);
  }
}
