// @ts-check
/**
 * Precarga (`node --import`) que vigila lo que `forge verificar` no debe hacer: llamar a `fetch` y leer
 * variables de entorno con aspecto de clave. Anota en FORGE_VIGILANCIA (JSONL). Las lecturas que hace
 * por su cuenta el arranque de procesos hijo (copiar el entorno) no cuentan.
 */
import { appendFileSync } from "node:fs";

const destino = process.env.FORGE_VIGILANCIA;
const anotar = (/** @type {Record<string, unknown>} */ e) => { if (destino) appendFileSync(destino, JSON.stringify(e) + "\n", "utf8"); };

globalThis.fetch = /** @type {any} */ (async (/** @type {any} */ url) => { anotar({ tipo: "fetch", url: String(url) }); throw new Error("fetch interceptado"); });

const SOSPECHOSA = /(API_?KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)/i;
const copia = { ...process.env };
const vigilado = new Proxy(copia, {
  get(destinoObj, clave, receptor) {
    if (typeof clave === "string" && SOSPECHOSA.test(clave)) {
      const pila = new Error().stack ?? "";
      // El arranque de un hijo copia el entorno entero: eso no es «leer una clave»
      if (!/child_process|verificar-docker-falso|vigilar-red/.test(pila)) anotar({ tipo: "env", clave });
    }
    return Reflect.get(destinoObj, clave, receptor);
  },
});
Object.defineProperty(process, "env", { value: vigilado, configurable: true, writable: true });
