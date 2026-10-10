/**
 * agents-md.js — Genera `AGENTS.md`, el archivo de instrucciones que leen los agentes de código
 *
 * Spec 2026-10-09-puesta-al-dia, HU-003. Los agentes de código que no conocen FORGE buscan
 * las reglas del proyecto en `AGENTS.md`, en la raíz. Aquí se compone a partir de la
 * constitución del proyecto (`.sdd/memoria/constitucion.md`) o, si aún no existe, de una
 * plantilla mínima.
 *
 * Funciones puras: no leen ni escriben archivos, y no conocen la ruta del proyecto. Lo único
 * que entra en el resultado es texto de la constitución (pasado por el limpiador de secretos
 * y de rutas locales), la plantilla y nombres de carpetas relativos.
 */

import { redactar } from './ciclo/redactar.js';

/** Marca de la primera línea útil: permite reconocer un AGENTS.md que generó FORGE. */
export const MARCA = '<!-- Generado por FORGE';

/** Secciones de la constitución que se copian, con el título que llevan en AGENTS.md. */
const SECCIONES = [
  ['Stack Técnico', 'Stack técnico'],
  ['Restricciones Arquitectónicas', 'Restricciones (no negociables)'],
  ['Convenciones', 'Convenciones'],
  ['Estándares de Calidad', 'Estándares de calidad'],
];

/** Un corchete que no es un enlace ni una casilla: un hueco de la plantilla sin rellenar. */
const HUECO = /\[(?![ xX]\])[^\]\n]+\](?!\()/;

/**
 * Rutas absolutas del equipo de quien escribió la constitución (carpetas personales).
 * No aportan nada a otro agente y revelan el nombre de usuario.
 *
 * Cubre: `C:\Users\x`, `c:\users\x`, `C:/Users/x`, `C:\\Users\\x` (JSON escapado), `/mnt/c/Users/x`
 * (WSL), `/c/Users/x` (Git Bash), `/home/x`, `/Users/x`, `/root`, `~/`, y UNC (`\\servidor\recurso`).
 * El nombre de usuario puede llevar espacios (`C:\Users\Juan Perez\Docs`): se recorta hasta el
 * final de ese componente, que es el que identifica a la persona.
 */
const SEP = String.raw`(?:\\{1,4}|/)`;
const FIN = String.raw`[^\s\\/"'` + '`' + String.raw`<>|*?)\]]*`;                 // un componente sin espacios
// El primero tras Users/home no puede empezar por un signo de puntuación: `/^C:\\Users/;` es código, no una ruta
const PRIMERO = String.raw`[^\s\\/"'` + '`' + String.raw`<>|*?)\];,:(\[{}]` + FIN;
const NOMBRE_CON_ESPACIOS = String.raw`[^\\/\r\n"'` + '`' + String.raw`<>|*?:]{1,64}(?=[\\/])`;
const RESTO = String.raw`(?:${SEP}${FIN})*`;
const RUTAS_LOCALES = [
  new RegExp(String.raw`\b[A-Za-z]:${SEP}(?:Users|Usuarios|Documents and Settings)${SEP}(?:${NOMBRE_CON_ESPACIOS}|${PRIMERO})${RESTO}`, 'gi'),
  new RegExp(String.raw`(?<![\w.\\/])/(?:mnt/[a-z]|[a-z])/(?:Users|Usuarios)/(?:${NOMBRE_CON_ESPACIOS}|${PRIMERO})${RESTO.replace(SEP, '/')}`, 'gi'),
  new RegExp(String.raw`(?<![\w.])/(?:home|Users)/(?:${NOMBRE_CON_ESPACIOS}|${PRIMERO})(?:/${FIN})*`, 'g'),
  new RegExp(String.raw`(?<![\w.])/root(?:/${FIN})*(?![\w-])`, 'g'),
  new RegExp(String.raw`(?<![\w.])~/${PRIMERO}(?:/${FIN})*`, 'g'),
  // UNC: dos o más barras invertidas (4 si vienen escapadas en JSON), servidor y recurso
  new RegExp(String.raw`(?<![\\\w])\\{2,4}[A-Za-z0-9_.$-]{2,}\\{1,2}[A-Za-z0-9_.$-]{2,}(?:\\{1,2}${FIN})*`, 'g'),
];

/**
 * Quita secretos con formato reconocible y rutas de carpetas personales.
 * @param {string} texto
 */
export function limpiar(texto) {
  let limpio = redactar(texto);
  for (const patron of RUTAS_LOCALES) limpio = limpio.replace(patron, '[ruta local omitida]');
  return limpio;
}

/**
 * La estructura del archivo la deciden las secciones fijas, no el texto copiado. Para que el
 * contenido de la constitución no pueda abrir lo que no cierra (un bloque de código, un
 * comentario HTML) ni crear encabezados de nivel 1, cada trozo copiado pasa por aquí.
 * No juzga el sentido del texto: AGENTS.md hereda la confianza de la constitución.
 * @param {string} texto
 */
export function neutralizar(texto) {
  const lineas = texto.replace(/\r\n?/g, '\n').split('\n');
  /** @type {{ car: string, largo: number } | null} */
  let valla = null;
  const salida = [];
  for (let linea of lineas) {
    const f = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(linea);
    if (valla) {
      // Cierra una valla del mismo carácter, al menos igual de larga y sin texto detrás
      if (f && f[1][0] === valla.car && f[1].length >= valla.largo && f[2].trim() === '') valla = null;
    } else if (f && !(f[1][0] === '`' && f[2].includes('`'))) {
      valla = { car: f[1][0], largo: f[1].length };
    } else {
      // Fuera de un bloque de código: sin encabezados de nivel 1 (los de nivel 2 ya los separó leerConstitucion)
      linea = linea.replace(/^( {0,3})#(?=\s|$)/, '$1\\#');
    }
    salida.push(linea);
  }
  // Un bloque sin cerrar se cierra aquí, con una valla más larga que la que lo abrió
  if (valla) salida.push(valla.car.repeat(valla.largo));
  // Comentarios HTML: los cerrados ya se descartaron; un `<!--` suelto abriría uno sin fin
  return salida.join('\n').replaceAll('<!--', '&lt;!--').replaceAll('-->', '--&gt;');
}

/** Una sola línea: sin saltos ni caracteres de control, y sin poder abrir un comentario HTML. */
export function unaLinea(texto) {
  return String(texto ?? '')
    .replace(/[\u0000-\u001F\u007F\u0085\u2028\u2029]+/g, ' ')
    .replaceAll('<!--', '&lt;!--').replaceAll('-->', '--&gt;')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Bloque de código para un texto de una línea: la valla es más larga que cualquier racha de ` del contenido. */
export function bloqueDeCodigo(linea) {
  const rachas = (linea.match(/`+/g) ?? []).map((r) => r.length);
  const valla = '`'.repeat(Math.max(3, ...rachas.map((n) => n + 1)));
  return `${valla}\n${linea}\n${valla}`;
}

/**
 * Trocea la constitución por sus títulos de segundo nivel. Ignora los comentarios HTML
 * (el informe de sincronización del principio).
 * @param {string} constitucion
 * @returns {{ nombre: string, version: string, secciones: Map<string, string> }}
 */
export function leerConstitucion(constitucion) {
  const texto = constitucion.replace(/\r\n/g, '\n').replace(/<!--[\s\S]*?-->/g, '');
  const nombre = (/^#\s+Constitución del Proyecto:\s*(.+?)\s*$/m.exec(texto)?.[1] ?? '').trim();
  const version = (/\*\*Versión:\*\*\s*([0-9]+\.[0-9]+\.[0-9]+)/.exec(texto)?.[1] ?? '').trim();
  const secciones = new Map();
  let actual = null;
  for (const linea of texto.split('\n')) {
    const titulo = /^##\s+(.+?)\s*$/.exec(linea);
    if (titulo) { actual = titulo[1]; secciones.set(actual, ''); continue; }
    if (actual !== null) secciones.set(actual, secciones.get(actual) + linea + '\n');
  }
  return { nombre: HUECO.test(nombre) ? '' : nombre, version, secciones };
}

/** Cuerpo de una sección sin las líneas que son huecos de plantilla; '' si no queda nada útil. */
function cuerpoUtil(cuerpo) {
  const lineas = cuerpo.split('\n').filter((l) => !HUECO.test(l));
  // Sin contenido: solo títulos, separadores de tabla o líneas vacías
  const conContenido = lineas.some((l) => l.trim() !== '' && !/^\s*(#{1,6}\s|\|[\s|:-]*\|?\s*$|>\s*$)/.test(l));
  return conContenido ? lineas.join('\n').replace(/\n{3,}/g, '\n\n').trim() : '';
}

/**
 * ¿Sirve esta constitución para generar el archivo? No, si es la plantilla sin rellenar:
 * ni el nombre del proyecto ni su propósito están escritos todavía. (La plantilla trae
 * algunas reglas de ejemplo ya redactadas; por sí solas no son la constitución de nadie.)
 * @param {string} constitucion
 */
export function constitucionUtil(constitucion) {
  const c = leerConstitucion(constitucion);
  return c.nombre !== '' || cuerpoUtil(c.secciones.get('Propósito y Misión') ?? '') !== '';
}

/** Sección fija: dónde están los artefactos y la regla de que todo cambio empieza por una spec. */
function seccionesFijas(pruebasCrudo) {
  const pruebas = unaLinea(pruebasCrudo);
  return [
    '## Cómo ejecutar las pruebas',
    '',
    pruebas
      ? `${bloqueDeCodigo(pruebas)}\n\nEjecútalas antes de dar un cambio por terminado. Si fallan, el cambio no está terminado.`
      : 'Usa el comando de pruebas del proyecto (míralo en su manifiesto o en su README) antes de dar un cambio por terminado. Si fallan, el cambio no está terminado.',
    '',
    '## Dónde está cada cosa',
    '',
    '| Qué | Dónde |',
    '|-----|-------|',
    '| Reglas del proyecto (constitución) | `.sdd/memoria/constitucion.md` |',
    '| Especificaciones: qué se pidió y por qué | `.sdd/especificaciones/<id>/spec.md` |',
    '| Decisiones de arquitectura (ADR) | `.sdd/arquitectura/ADR-NN-*.md` |',
    '| Índice de especificaciones | `.sdd/INDICE.md` |',
    '',
    '## Cómo se cambia algo',
    '',
    '1. **Todo cambio empieza por una especificación** en `.sdd/especificaciones/`. Si no existe una para lo que vas a hacer, escríbela antes de tocar el código: dice qué y por qué, sin nombrar herramientas.',
    '2. La especificación y el plan los **aprueba una persona**. No marques una aprobación por tu cuenta.',
    '3. Las pruebas se escriben antes que la implementación.',
    '4. Una decisión técnica que no sea trivial se deja escrita como ADR en `.sdd/arquitectura/`.',
    '5. No escribas secretos en el repositorio, ni en registros, ni en este archivo.',
  ];
}

/**
 * Compone `AGENTS.md` a partir de la constitución del proyecto.
 * @param {{ constitucion: string, nombre?: string, pruebas?: string }} datos
 *        `nombre`: el del proyecto si la constitución no lo trae; `pruebas`: comando de pruebas detectado
 * @returns {string}
 */
export function desdeConstitucion({ constitucion, nombre, pruebas }) {
  const c = leerConstitucion(constitucion);
  const titulo = unaLinea(c.nombre || nombre) || 'este proyecto';
  const partes = [
    `# AGENTS.md — ${titulo}`,
    '',
    `${MARCA} a partir de .sdd/memoria/constitucion.md${c.version ? ` (versión ${c.version})` : ''}.`,
    '     Es un resumen para agentes de código: la constitución es la fuente y manda si hay diferencias. -->',
    '',
    'Instrucciones para agentes de código que trabajan en este repositorio. Léelas antes de cambiar nada.',
    '',
  ];

  const proposito = neutralizar(cuerpoUtil(c.secciones.get('Propósito y Misión') ?? ''));
  if (proposito) partes.push('## Qué es este proyecto', '', proposito, '');

  for (const [origen, destino] of SECCIONES) {
    const cuerpo = neutralizar(cuerpoUtil(c.secciones.get(origen) ?? ''));
    if (cuerpo) partes.push(`## ${destino}`, '', cuerpo, '');
  }

  // De los principios, solo el enunciado: el detalle y su razón están en la constitución
  const principios = [...(c.secciones.get('Principios Fundamentales') ?? '').matchAll(/^###\s+(.+?)\s*$/gm)].map((m) => unaLinea(m[1])).filter((p) => p !== '' && !HUECO.test(p));
  if (principios.length > 0) {
    partes.push('## Principios', '', ...principios.map((p) => `- ${p}`), '', 'El texto completo de cada uno, con su razón, está en `.sdd/memoria/constitucion.md`.', '');
  }

  partes.push(...seccionesFijas(pruebas), '');
  return limpiar(partes.join('\n')).replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

/**
 * Compone `AGENTS.md` a partir de la plantilla mínima (`plantillas/AGENTS.md`), para un
 * proyecto que todavía no tiene constitución.
 * @param {{ plantilla: string, nombre?: string, pruebas?: string }} datos
 * @returns {string}
 */
export function desdePlantilla({ plantilla, nombre, pruebas }) {
  const unaPrueba = unaLinea(pruebas) || 'el comando de pruebas del proyecto (míralo en su manifiesto o en su README)';
  let texto = plantilla.replace(/\r\n/g, '\n');
  // El hueco de las pruebas va dentro de un bloque de código de tres acentos: se sustituye el bloque
  // entero, con una valla que el comando no pueda cerrar
  texto = texto.replace(/^```[^\n]*\n\{\{PRUEBAS\}\}\n```$/m, () => bloqueDeCodigo(unaPrueba));
  texto = texto
    .replaceAll('{{NOMBRE}}', () => unaLinea(nombre) || 'este proyecto')
    .replaceAll('{{PRUEBAS}}', () => unaPrueba.replaceAll('`', "'"));
  return limpiar(texto).trimEnd() + '\n';
}

/**
 * @param {{ constitucion?: string|null, plantilla: string, nombre?: string, pruebas?: string }} datos
 * @returns {{ contenido: string, origen: 'constitucion'|'plantilla' }}
 */
export function generarAgentsMd({ constitucion, plantilla, nombre, pruebas }) {
  if (typeof constitucion === 'string' && constitucionUtil(constitucion)) {
    return { contenido: desdeConstitucion({ constitucion, nombre, pruebas }), origen: 'constitucion' };
  }
  return { contenido: desdePlantilla({ plantilla, nombre, pruebas }), origen: 'plantilla' };
}
