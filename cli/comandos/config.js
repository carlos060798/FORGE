// @ts-check
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { c, info, aviso, titulo, error, escribirSeguro } from "./comun.js";

// ─── Config CLI (B3) ───────────────────────────────────────────────────────────

/**
 * Lee sdd.config.yaml como texto plano (sin parser YAML — cero deps).
 * @returns {string} contenido del archivo
 */
function leerConfigYaml() {
  const configPath = join(process.cwd(), ".sdd", "sdd.config.yaml");
  if (!existsSync(configPath)) {
    error("No se encontró .sdd/sdd.config.yaml — ejecuta 'npx sdd-es init' primero.");
  }
  return readFileSync(configPath, "utf8");
}

/**
 * Extrae el bloque de una sección YAML dado su nombre (línea a línea).
 * Funciona incluso si la sección es la última del archivo.
 * @param {string[]} lineas
 * @param {string} seccion
 * @returns {string[]} líneas del bloque (sin la cabecera de sección)
 */
function extraerBloqueSeccion(lineas, seccion) {
  const inicio = lineas.findIndex((l) => l.match(new RegExp(`^${seccion}:\\s*$`)) ||
    l.match(new RegExp(`^${seccion}:\\s+`)));
  if (inicio === -1) return [];
  const bloque = [];
  for (let i = inicio + 1; i < lineas.length; i++) {
    const l = lineas[i];
    if (l.length > 0 && !l.startsWith(" ") && !l.startsWith("\t") && !l.startsWith("#")) break;
    bloque.push(l);
  }
  return bloque;
}

/**
 * Extrae el valor de una clave YAML simple (un nivel o dos niveles separados por punto).
 * Soporta: "sesion.modo", "memoria.umbral_bytes", "perfil"
 * @param {string} yaml
 * @param {string} clave  e.g. "sesion.modo" o "perfil"
 * @returns {string|null}
 */
export function yamlGet(yaml, clave) {
  const lineas = yaml.split("\n");
  const partes = clave.split(".");
  if (partes.length === 1) {
    const m = yaml.match(new RegExp(`^${partes[0]}:\\s*(.+)$`, "m"));
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
  }
  const [seccion, sub] = partes;
  const bloque = extraerBloqueSeccion(lineas, seccion);
  if (!bloque.length) return null;
  const subRe = new RegExp(`^\\s+${sub}:\\s*(.+)$`);
  for (const l of bloque) {
    const m = subRe.exec(l);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return null;
}

/**
 * Cambia el valor de una clave YAML de uno o dos niveles.
 * Estrategia: reemplazo línea a línea, preserva indentación y comentarios.
 * @param {string} yaml
 * @param {string} clave
 * @param {string} valor
 * @returns {string|null} yaml modificado, o null si clave no encontrada
 */
function yamlSet(yaml, clave, valor) {
  const partes = clave.split(".");
  if (partes.length === 1) {
    const re = new RegExp(`^(${partes[0]}:\\s*).*$`, "m");
    if (!re.test(yaml)) return null;
    return yaml.replace(re, `$1${valor}`);
  }
  const [seccion, sub] = partes;
  const lineas = yaml.split("\n");
  const inicioSeccion = lineas.findIndex((l) =>
    l.match(new RegExp(`^${seccion}:\\s*$`)) || l.match(new RegExp(`^${seccion}:\\s+`))
  );
  if (inicioSeccion === -1) return null;
  const subRe = new RegExp(`^(\\s+${sub}:\\s*)(.+)$`);
  for (let i = inicioSeccion + 1; i < lineas.length; i++) {
    const l = lineas[i];
    // Si llegamos a otra sección de nivel raíz, no encontramos la subclave
    if (l.length > 0 && !l.startsWith(" ") && !l.startsWith("\t") && !l.startsWith("#")) break;
    const m = subRe.exec(l);
    if (m) {
      lineas[i] = `${m[1]}${valor}`;
      return lineas.join("\n");
    }
  }
  return null; // subclave no encontrada en la sección
}

/**
 * Extrae y muestra una sección del YAML de forma legible.
 * Una sección va desde "nombre:" hasta la siguiente línea no indentada.
 */
function mostrarSeccion(yaml, seccion) {
  const lineas = yaml.split("\n");
  const inicio = lineas.findIndex((l) => l.match(new RegExp(`^${seccion}:\\s*`)));
  if (inicio === -1) {
    console.log(`(sección "${seccion}" no encontrada en sdd.config.yaml)`);
    return;
  }
  const bloque = [lineas[inicio]];
  for (let i = inicio + 1; i < lineas.length; i++) {
    const l = lineas[i];
    // Una nueva sección de nivel raíz empieza con un carácter no-espacio y no-#
    if (l.length > 0 && !l.startsWith(" ") && !l.startsWith("\t") && !l.startsWith("#")) break;
    bloque.push(l);
  }
  console.log(bloque.join("\n").trimEnd());
}

export function cmdConfig(args) {
  const sub = args[0] ?? "show";
  const configPath = join(process.cwd(), ".sdd", "sdd.config.yaml");

  if (sub === "show") {
    const yaml = leerConfigYaml();
    const seccion = args[1];
    if (seccion) {
      titulo(`Sección: ${seccion}`);
      mostrarSeccion(yaml, seccion);
    } else {
      titulo("sdd.config.yaml completo:");
      console.log(yaml);
    }
    return;
  }

  if (sub === "get") {
    const clave = args[1];
    if (!clave) { error("Uso: npx sdd-es config get <clave>  (ej: sesion.modo)"); }
    const yaml = leerConfigYaml();
    const valor = yamlGet(yaml, clave);
    if (valor === null) {
      aviso(`Clave "${clave}" no encontrada en sdd.config.yaml`);
    } else {
      console.log(`${clave}: ${c.verde(valor)}`);
    }
    return;
  }

  if (sub === "set") {
    const clave = args[1];
    const valor = args[2];
    if (!clave || valor === undefined) {
      error("Uso: npx sdd-es config set <clave> <valor>  (ej: sesion.modo rapido)");
    }
    const yaml = leerConfigYaml();
    const actual = yamlGet(yaml, clave);
    if (actual === null) {
      aviso(`Clave "${clave}" no encontrada — verifica el nombre exacto con 'npx sdd-es config show'`);
      process.exit(1);
    }
    if (actual === valor) {
      info(`"${clave}" ya tiene el valor "${valor}" — sin cambios.`);
      return;
    }
    const yamlNuevo = yamlSet(yaml, clave, valor);
    if (!yamlNuevo) {
      error(`No se pudo actualizar "${clave}". Verifica que la clave existe en sdd.config.yaml`);
    }
    console.log(`${c.amarillo("~")}  ${clave}: ${c.rojo(actual)} → ${c.verde(valor)}`);
    // Por escritura segura: si `.sdd` o el archivo son un enlace (o un enlace duro a otro lugar), no se escribe a través de él
    if (!escribirSeguro(configPath, yamlNuevo)) {
      error("No se cambió nada: el archivo de configuración o su carpeta es un enlace.");
    }
    info(`Actualizado en .sdd/sdd.config.yaml`);
    return;
  }

  if (sub === "validate") {
    const yaml = leerConfigYaml();
    titulo("Validando sdd.config.yaml...");
    let ok = true;
    const obligatorias = ["agentes:", "comportamiento:", "rutas:", "memoria:"];
    for (const clave of obligatorias) {
      if (yaml.includes(clave)) {
        info(`${clave} presente ✓`);
      } else {
        aviso(`Falta clave obligatoria: ${clave}`); ok = false;
      }
    }
    const umbral = yaml.match(/umbral_bytes:\s*(\d+)/);
    if (umbral && parseInt(umbral[1], 10) <= 0) {
      aviso("memoria.umbral_bytes debe ser > 0"); ok = false;
    }
    const modeloInvalido = yaml.match(/modelo:\s*((?!opus|sonnet|haiku)\S+)/);
    if (modeloInvalido) {
      aviso(`modelo desconocido: "${modeloInvalido[1]}" (válidos: opus, sonnet, haiku)`); ok = false;
    }
    console.log("");
    if (ok) info("sdd.config.yaml válido ✓");
    else aviso("Hay errores en sdd.config.yaml — revisa arriba");
    return;
  }

  // subcomando desconocido
  console.log(`
Uso: npx sdd-es config <subcomando>

  show [sección]         Muestra la config completa o solo una sección
                         Ej: npx sdd-es config show agentes
  get <clave>            Obtiene el valor de una clave
                         Ej: npx sdd-es config get sesion.modo
  set <clave> <valor>    Cambia el valor de una clave
                         Ej: npx sdd-es config set sesion.modo rapido
                         Ej: npx sdd-es config set memoria.umbral_bytes 40000
  validate               Valida la estructura del archivo
`);
}
