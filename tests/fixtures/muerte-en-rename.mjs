// @ts-check
/**
 * Reemplaza un archivo con `escribirArchivo` y MUERE justo en el `rename` (como un corte de luz o un
 * SIGKILL entre escribir el temporal y ponerlo en su sitio). Uso: node muerte-en-rename.mjs <raiz> <ruta> <contenido>
 */
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";

const [raiz, ruta, contenido] = process.argv.slice(2);
// `escritura-segura.js` importa `renameSync` por nombre: se cambia en el módulo integrado y se sincroniza
// antes de cargarlo
fs.renameSync = () => process.exit(137);
syncBuiltinESMExports();

const { escribirArchivo } = await import("../../core/escritura-segura.js");
escribirArchivo(raiz, ruta, contenido);
console.log("no murió");
