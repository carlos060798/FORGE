/**
 * marcador.js — Marcadores de idempotencia derivados (R7)
 *
 * El marcador oculto de un comentario lo puede copiar cualquiera que pueda comentar. Los adaptadores
 * solo dan por válido el comentario que escribió la cuenta del propio token. Si el marcador aparece en
 * un comentario AJENO (o no se puede comprobar de quién es), se publica un comentario propio con un
 * marcador DERIVADO y determinista. Consecuencia, y límite documentado: quien escribe el marcador solo
 * puede provocar UNA publicación adicional; nunca suprimirla ni hacer que FORGE dé por publicado
 * algo que no escribió.
 */

import { createHash } from 'node:crypto';

/**
 * Marcador derivado: mismo alfabeto y tope (64) que los marcadores normales.
 * @param {string} marcador
 */
export function derivarMarcador(marcador) {
  const h = createHash('sha256').update(`forge-derivado:${marcador}`).digest('hex').slice(0, 8);
  return `${marcador.slice(0, 53)}.r${h}`;
}
