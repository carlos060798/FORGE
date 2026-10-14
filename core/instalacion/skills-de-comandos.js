// @ts-check
/**
 * skills-de-comandos.js — Convierte un comando de `commands/` en una skill con `SKILL.md` válido
 * según la especificación abierta (https://agentskills.io/specification, spike S0.2).
 *
 * Reglas:
 *  - `name`: derivado del nombre del archivo (`sdd.diseñar` → `sdd-disenar`), minúsculas/números/guiones,
 *    1-64, sin guion al inicio/fin ni `--`, e IGUAL a la carpeta.
 *  - `description`: 1-1024 caracteres (se recorta con aviso).
 *  - `allowed-tools`: la lista separada por comas del comando pasa a separada por ESPACIOS.
 *  - `handoffs` y `aliases` no tienen equivalente estándar: DECISIÓN: se conservan como cadenas en
 *    `metadata` (`forge-handoffs`, `forge-aliases`, con los nombres de comando originales) y se avisa;
 *    ninguna herramienta los interpreta, pero no se pierde información.
 *  - El cuerpo del comando se copia sin cambios.
 *
 * Funciones puras: no tocan el disco.
 */

/** Longitud máxima de `description` en la especificación. */
export const MAX_DESCRIPCION = 1024;
export const MAX_NOMBRE = 64;

const NOMBRE_VALIDO = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Nombre de skill a partir del nombre de archivo del comando (sin `.md`).
 * @param {string} comando p. ej. `sdd.diseñar`
 */
export function nombreDeSkill(comando) {
  return comando
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_NOMBRE)
    .replace(/-+$/g, '');
}

/**
 * Separa la cabecera YAML simple (`clave: valor` y listas anidadas) del cuerpo.
 * @param {string} texto
 * @returns {{ campos: Map<string,string>, bloques: Map<string,string[]>, cuerpo: string }}
 */
export function separarCabecera(texto) {
  const t = texto.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const campos = new Map(), bloques = new Map();
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(t);
  if (!m) return { campos, bloques, cuerpo: t };
  let actual = null;
  for (const linea of m[1].split('\n')) {
    const k = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(linea);
    if (k) {
      actual = k[1];
      if (k[2].trim() === '') bloques.set(actual, []); else campos.set(actual, k[2].trim());
    } else if (actual && bloques.has(actual) && linea.trim() !== '') {
      /** @type {string[]} */ (bloques.get(actual)).push(linea);
    }
  }
  return { campos, bloques, cuerpo: t.slice(m[0].length) };
}

/** Texto de un valor escalar de cabecera, sin comillas envolventes. */
function sinComillas(v) {
  return v.replace(/^(["'])([\s\S]*)\1$/, '$2');
}

/** Cadena YAML segura en una línea (JSON es YAML válido). */
const yamlCadena = (s) => JSON.stringify(s);

/**
 * Convierte un comando en una skill.
 * @param {string} comando nombre del archivo sin `.md`
 * @param {string} texto contenido del comando
 * @returns {{ nombre: string, skillMd: string, avisos: string[], errores: string[] }}
 */
export function comandoASkill(comando, texto) {
  const avisos = [], errores = [];
  const { campos, bloques, cuerpo } = separarCabecera(texto);
  const nombre = nombreDeSkill(comando);
  if (!NOMBRE_VALIDO.test(nombre) || nombre.length > MAX_NOMBRE) errores.push(`nombre inválido: "${nombre}"`);

  const propio = campos.get('name');
  if (propio !== undefined && sinComillas(propio) !== nombre) avisos.push(`name "${sinComillas(propio)}" sustituido por "${nombre}" (debe igualar la carpeta)`);

  let descripcion = sinComillas(campos.get('description') ?? '').replace(/\s+/g, ' ').trim();
  if (descripcion === '') errores.push('el comando no tiene description');
  if (descripcion.length > MAX_DESCRIPCION) {
    descripcion = descripcion.slice(0, MAX_DESCRIPCION - 1).trimEnd() + '…';
    avisos.push(`description recortada a ${MAX_DESCRIPCION} caracteres`);
  }

  const lineas = ['---', `name: ${nombre}`, `description: ${yamlCadena(descripcion)}`];

  const herramientas = sinComillas(campos.get('allowed-tools') ?? '').split(/[,\s]+/).filter(Boolean);
  if (herramientas.length) {
    lineas.push(`allowed-tools: ${herramientas.join(' ')}`);
    avisos.push('allowed-tools convertido de comas a espacios (campo experimental; no todas las herramientas lo respetan)');
  }

  /** @type {Record<string,string>} */
  const metadata = { 'forge-comando': comando };
  for (const [clave, etiqueta] of [['handoffs', 'forge-handoffs'], ['aliases', 'forge-aliases']]) {
    const bloque = bloques.get(clave);
    const escalar = campos.get(clave);
    if (!bloque && escalar === undefined) continue;
    const lista = bloque ?? [`- ${escalar}`];
    // handoffs: solo la línea `comando: x`; aliases: cada elemento `- x` de la lista
    /** @type {string[]} */
    const valores = [];
    for (const l of lista) {
      const v = clave === 'handoffs' ? /^\s*(?:-\s*)?comando:\s*(.+)$/.exec(l)?.[1] : /^\s*-\s*(.+)$/.exec(l)?.[1];
      if (v) valores.push(sinComillas(v.trim()));
    }
    if (valores.length) {
      metadata[etiqueta] = [...new Set(valores)].join(', ');
      avisos.push(`${clave} movido a metadata.${etiqueta} (sin equivalente en el estándar; ninguna herramienta lo interpreta)`);
    }
  }
  lineas.push('metadata:');
  for (const [k, v] of Object.entries(metadata)) lineas.push(`  ${k}: ${yamlCadena(v)}`);

  if (/mcp__|Task\(|subagent/i.test(cuerpo)) avisos.push('el cuerpo usa herramientas propias de Claude Code (mcp__, Task, subagentes): puede no funcionar en otras herramientas');
  if (/\$ARGUMENTS|\$[1-9]\b/.test(cuerpo)) avisos.push('el cuerpo usa argumentos posicionales ($ARGUMENTS/$1) que otras herramientas no sustituyen');

  lineas.push('---', '');
  return { nombre, skillMd: lineas.join('\n') + cuerpo.replace(/^\n+/, '\n'), avisos, errores };
}

/**
 * Valida un `SKILL.md` ya generado contra la especificación abierta.
 * @param {string} nombreCarpeta
 * @param {string} skillMd
 * @returns {string[]} errores (vacío si es válido)
 */
export function validarSkill(nombreCarpeta, skillMd) {
  const errores = [];
  const { campos } = separarCabecera(skillMd);
  const nombre = sinComillas(campos.get('name') ?? '');
  if (!NOMBRE_VALIDO.test(nombre) || nombre.length > MAX_NOMBRE) errores.push(`name inválido: "${nombre}"`);
  if (nombre !== nombreCarpeta) errores.push(`name "${nombre}" no coincide con la carpeta "${nombreCarpeta}"`);
  let d = campos.get('description') ?? '';
  try { d = JSON.parse(d); } catch { d = sinComillas(d); }
  if (!d || String(d).length > MAX_DESCRIPCION) errores.push('description vacía o de más de 1024 caracteres');
  const tools = campos.get('allowed-tools');
  if (tools !== undefined && /,/.test(tools)) errores.push('allowed-tools debe separarse por espacios');
  return errores;
}

/**
 * Convierte todos los comandos. Lanza si dos comandos dan el mismo nombre de skill.
 * @param {{ comando: string, texto: string }[]} comandos
 * @returns {{ skills: Map<string,string>, avisos: Record<string,string[]>, errores: Record<string,string[]> }}
 */
export function generarSkills(comandos) {
  const skills = new Map();
  /** @type {Record<string,string[]>} */ const avisos = {};
  /** @type {Record<string,string[]>} */ const errores = {};
  /** @type {Map<string,string>} */ const origen = new Map();
  for (const { comando, texto } of comandos) {
    const r = comandoASkill(comando, texto);
    if (origen.has(r.nombre)) throw new Error(`Los comandos "${origen.get(r.nombre)}" y "${comando}" dan la misma skill "${r.nombre}"`);
    origen.set(r.nombre, comando);
    const invalidos = validarSkill(r.nombre, r.skillMd);
    skills.set(r.nombre, r.skillMd);
    if (r.avisos.length) avisos[comando] = r.avisos;
    if (r.errores.length || invalidos.length) errores[comando] = [...r.errores, ...invalidos];
  }
  return { skills, avisos, errores };
}
