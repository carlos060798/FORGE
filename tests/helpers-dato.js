// @ts-check
/**
 * helpers-dato.js — Ayudante de las pruebas de la defensa frente a inyección (spec 2026-10-14).
 * No es una prueba: lo importan tests/defensa-inyeccion.test.js y tests/proyecto-hostil.test.js.
 */
import { MARCA_DATO } from "../core/ciclo/dato-no-confiable.js";

export const ABRE = new RegExp(`^<<<${MARCA_DATO}:([0-9a-f]{24}) inicio · (.*)>>>$`);

/**
 * Lo que queda de un texto al quitar los bloques delimitados válidos (apertura con id y cierre con el
 * mismo id). Si algo hostil sigue ahí, estaba FUERA de un bloque. Un bloque sin cerrar no protege nada.
 * @param {string} texto
 */
export function fueraDeBloques(texto) {
  const lineas = texto.split("\n");
  const fuera = [];
  for (let i = 0; i < lineas.length; i++) {
    const m = ABRE.exec(lineas[i]);
    if (!m) { fuera.push(lineas[i]); continue; }
    const cierre = `<<<${MARCA_DATO}:${m[1]} fin>>>`;
    let j = i + 1;
    while (j < lineas.length && lineas[j] !== cierre) j++;
    if (j >= lineas.length) { fuera.push(...lineas.slice(i)); break; }
    i = j;
  }
  return fuera.join("\n");
}
