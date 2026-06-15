// @ts-check
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
export const ROOT = join(__dirname, "..");

/**
 * Devuelve todos los archivos .md de un directorio (sin recursión).
 * @param {string} dir
 * @returns {string[]} rutas absolutas
 */
export function mdFiles(dir) {
  const abs = join(ROOT, dir);
  return readdirSync(abs)
    .filter((f) => extname(f) === ".md")
    .map((f) => join(abs, f));
}

/**
 * Devuelve los nombres de todas las skills, soportando ambos formatos:
 *  - skill plana:   skills/nombre.md
 *  - skill carpeta: skills/nombre/SKILL.md  (estándar Agent Skills)
 * @returns {string[]} nombres (slug) de skills, sin extensión
 */
export function skillNamesAll() {
  const abs = join(ROOT, "skills");
  const nombres = [];
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    if (entry.isFile() && extname(entry.name) === ".md") {
      nombres.push(basename(entry.name, ".md"));
    } else if (
      entry.isDirectory() &&
      existsSync(join(abs, entry.name, "SKILL.md"))
    ) {
      nombres.push(entry.name);
    }
  }
  return nombres;
}

/**
 * Devuelve todos los archivos .yaml de un directorio.
 * @param {string} dir
 * @returns {string[]} rutas absolutas
 */
export function yamlFiles(dir) {
  const abs = join(ROOT, dir);
  return readdirSync(abs)
    .filter((f) => extname(f) === ".yaml" || extname(f) === ".yml")
    .map((f) => join(abs, f));
}

/**
 * Parsea el bloque frontmatter YAML de un archivo Markdown.
 * Soporta: string, boolean, array, objetos simples de una línea.
 * No usa dependencias externas.
 * @param {string} filePath
 * @returns {Record<string, any>}
 */
export function parseFrontmatter(filePath) {
  const content = readFileSync(filePath, "utf8");
  if (!content.startsWith("---")) return {};

  const end = content.indexOf("---", 3);
  if (end === -1) return {};

  const block = content.slice(3, end).trim();
  const result = /** @type {Record<string, any>} */ ({});

  let currentKey = "";
  let inArray = false;
  /** @type {any[]} */
  let arrayBuffer = [];
  /** @type {Record<string,any>|null} */
  let currentObject = null; // objeto en construcción dentro de un array

  for (const rawLine of block.split("\n")) {
    const line = rawLine.trimEnd();
    const indent = line.search(/\S/);

    // Inicio de nuevo item de array (- al nivel 2)
    if (inArray && line.match(/^\s{0,2}-\s+/)) {
      // Guardar objeto anterior si había uno en construcción
      if (currentObject !== null) {
        arrayBuffer.push(currentObject);
        currentObject = null;
      }
      const val = line.replace(/^\s{0,2}-\s+/, "").trim();
      // Si el item tiene clave:valor → inicio de objeto
      const objKV = val.match(/^([a-zA-Z_-]+):\s+(.+)$/);
      if (objKV) {
        currentObject = { [objKV[1]]: parseScalar(objKV[2]) };
      } else if (val === "" || val.endsWith(":")) {
        currentObject = {};
      } else {
        arrayBuffer.push(parseScalar(val));
      }
      continue;
    }

    // Propiedad dentro de un objeto de array (indentado 4+ espacios)
    if (inArray && currentObject !== null && indent >= 4) {
      const kv = line.trim().match(/^([a-zA-Z_-]+):\s+(.+)$/);
      if (kv) {
        currentObject[kv[1]] = parseScalar(kv[2]);
      }
      continue;
    }

    // Fin de array implícito (nueva clave en columna 0)
    if (inArray && line.match(/^[a-zA-Z]/)) {
      if (currentObject !== null) {
        arrayBuffer.push(currentObject);
        currentObject = null;
      }
      result[currentKey] = arrayBuffer;
      inArray = false;
      arrayBuffer = [];
    }

    // Clave con valor vacío → posible inicio de array o objeto
    const kvMatch = line.match(/^([a-zA-Z_-][a-zA-Z0-9_-]*):\s*(.*)?$/);
    if (!kvMatch) continue;

    const key = kvMatch[1];
    const raw = (kvMatch[2] || "").trim();

    if (raw === "" || raw === "|" || raw === ">") {
      currentKey = key;
      inArray = true;
      arrayBuffer = [];
      currentObject = null;
    } else {
      currentKey = key;
      result[key] = parseScalar(raw);
    }
  }

  // Cerrar array/objeto pendiente al final del bloque
  if (inArray) {
    if (currentObject !== null) arrayBuffer.push(currentObject);
    result[currentKey] = arrayBuffer;
  }

  return result;
}

/**
 * Convierte un valor escalar YAML a JS.
 * @param {string} raw
 * @returns {string|boolean|number}
 */
function parseScalar(raw) {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (/^\d+$/.test(raw)) return Number(raw);
  // quitar comillas simples/dobles
  if ((raw.startsWith('"') && raw.endsWith('"')) ||
      (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  return raw;
}

/**
 * Lee el contenido completo de un archivo.
 * @param {string} filePath
 * @returns {string}
 */
export function readFile(filePath) {
  return readFileSync(filePath, "utf8");
}

/**
 * Nombre de archivo sin extensión, para mensajes de error.
 * @param {string} filePath
 * @returns {string}
 */
export function stem(filePath) {
  return basename(filePath, extname(filePath));
}
