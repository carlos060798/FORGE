/**
 * herramientas-coder.js — Las cinco herramientas del implementador por turnos (ADR-21)
 *
 *   leer_archivo       un archivo del proyecto, entero o por tramos de líneas
 *   listar             el contenido de una carpeta
 *   buscar             un texto literal en los archivos del proyecto
 *   editar             sustituir un fragmento exacto y único, o escribir un archivo entero
 *   ejecutar_pruebas   las pruebas del proyecto, en el entorno aislado
 *
 * Son funciones de este proceso, sin protocolo intermedio (ADR-15). No hay una segunda
 * implementación de las reglas: leer pasa por `validarRuta`, listar y buscar por
 * `listarArchivosIndexables` (los mismos vetos que el recuperador) y escribir SIEMPRE por
 * `aplicarArchivos` con el rol `coder`, igual que el modo de bloque. Lo único que se ejecuta
 * es `runner.test(cwd)`: no existe ninguna herramienta que acepte un comando.
 *
 * Las reglas y los topes se fijan al crear las herramientas. Nada de lo que devuelven (el
 * contenido de un archivo, la salida de las pruebas) se interpreta: es texto para el modelo.
 */

import * as fs from 'fs';
import * as path from 'path';
import { aplicarArchivos, validarRuta } from './protocolo-archivos.js';
import { cola } from './redactar.js';
import { clasificar } from './router.js';
import { MOTIVOS as MOTIVOS_RUTA } from '../mcp/herramientas.js';
import { listarArchivosIndexables } from '../recuperacion/indice-vectorial.js';

/** Tamaño máximo del texto de un resultado. Lo que no cabe se recorta, con aviso. */
export const MAX_RESULTADO_BYTES = 32 * 1024;
/** Coincidencias que devuelve `buscar` si no se pide otra cosa, y el máximo que se puede pedir. */
export const MAX_COINCIDENCIAS = 50;
export const TOPE_COINCIDENCIAS = 200;
/** Tamaño máximo de un archivo que se lee o se escribe con estas herramientas. */
export const MAX_ARCHIVO_BYTES = 1024 * 1024;
const MAX_LINEA_BUSQUEDA = 200;
const MAX_ENTRADAS_LISTADO = 300;

const MOTIVOS = {
  ...MOTIVOS_RUTA,
  prueba_inmutable: 'es un archivo de prueba: el implementador no puede crearlos ni modificarlos',
  fragmento_no_encontrado: 'el fragmento de "buscar" no aparece en el archivo (debe coincidir carácter a carácter, con su sangría)',
  fragmento_repetido: 'el fragmento de "buscar" aparece más de una vez: amplíalo con líneas vecinas hasta que sea único',
  archivo_inexistente: 'el archivo no existe: para crearlo usa "contenido" en lugar de "buscar" y "reemplazar"',
  no_es_texto: 'no es un archivo de texto',
  demasiado_grande: `supera el máximo de ${MAX_ARCHIVO_BYTES / 1024} KB`,
};

const RUTA = { type: 'string', maxLength: 1024, description: 'Ruta relativa a la raíz del proyecto, con "/"' };

/** Forma neutra del contrato de proveedor: { nombre, descripcion, esquema }. */
export const ESQUEMAS_HERRAMIENTAS = [
  {
    nombre: 'leer_archivo',
    descripcion:
      'Lee un archivo de texto del proyecto. Sin "desde" ni "hasta" devuelve el archivo entero; con ellos, solo ese tramo de líneas (la primera es la 1, ambas incluidas). '
      + `Cada resultado tiene un máximo de ${MAX_RESULTADO_BYTES / 1024} KB: si el archivo no cabe se recorta y se indica qué líneas se muestran, para pedir el resto por tramos. `
      + 'No lee secretos, el repositorio git, el estado de FORGE, node_modules ni nada de fuera del proyecto.',
    esquema: {
      type: 'object',
      properties: {
        ruta: RUTA,
        desde: { type: 'integer', minimum: 1, description: 'Primera línea del tramo (opcional)' },
        hasta: { type: 'integer', minimum: 1, description: 'Última línea del tramo, incluida (opcional)' },
      },
      required: ['ruta'],
      additionalProperties: false,
    },
  },
  {
    nombre: 'listar',
    descripcion:
      'Lista los archivos y subcarpetas de una carpeta del proyecto (solo el primer nivel). Sin "carpeta" lista la raíz. '
      + 'Solo aparecen archivos de código y de texto; quedan fuera secretos, carpetas internas, dependencias instaladas y rutas protegidas.',
    esquema: {
      type: 'object',
      properties: { carpeta: { ...RUTA, description: 'Carpeta relativa a la raíz del proyecto (opcional; por defecto, la raíz)' } },
      additionalProperties: false,
    },
  },
  {
    nombre: 'buscar',
    descripcion:
      'Busca un texto literal (no es una expresión regular; distingue mayúsculas) en los archivos del proyecto y devuelve cada coincidencia como "ruta:línea: texto". '
      + `Devuelve como mucho ${MAX_COINCIDENCIAS} coincidencias (hasta ${TOPE_COINCIDENCIAS} con "max") y avisa si hay más. `
      + 'Úsala para localizar dónde se define o se usa algo antes de leer o editar.',
    esquema: {
      type: 'object',
      properties: {
        texto: { type: 'string', minLength: 1, maxLength: 400, description: 'Texto exacto que se busca, en una sola línea' },
        carpeta: { ...RUTA, description: 'Limita la búsqueda a esta carpeta (opcional)' },
        max: { type: 'integer', minimum: 1, maximum: TOPE_COINCIDENCIAS, description: 'Máximo de coincidencias (opcional)' },
      },
      required: ['texto'],
      additionalProperties: false,
    },
  },
  {
    nombre: 'editar',
    descripcion:
      'Modifica un archivo del proyecto. Dos formas, que no se mezclan: '
      + '(1) "buscar" y "reemplazar": sustituye un fragmento del archivo. "buscar" debe coincidir carácter a carácter con el archivo y aparecer UNA sola vez; si no aparece o aparece varias veces, no se cambia nada. Es la forma preferida para cambios pequeños. '
      + '(2) "contenido": crea el archivo, o lo reemplaza entero si ya existe. '
      + 'No puede crear ni modificar archivos de prueba, ni escribir fuera del proyecto o en rutas protegidas. '
      + 'Un cambio en dependencias (package.json, requirements.txt…) o en configuración que otras herramientas ejecutan solas no se aplica: detiene el trabajo para que lo revise una persona.',
    esquema: {
      type: 'object',
      properties: {
        ruta: RUTA,
        buscar: { type: 'string', description: 'Fragmento exacto que se sustituye (con "reemplazar")' },
        reemplazar: { type: 'string', description: 'Texto que ocupa el lugar del fragmento (puede estar vacío para borrarlo)' },
        contenido: { type: 'string', description: 'Contenido completo del archivo (sin "buscar" ni "reemplazar")' },
      },
      required: ['ruta'],
      additionalProperties: false,
    },
  },
  {
    nombre: 'ejecutar_pruebas',
    descripcion:
      'Ejecuta las pruebas del proyecto en el entorno aislado (sin red y con límites) y devuelve si pasan, el código de salida y el final de la salida. '
      + 'No acepta parámetros ni comandos: ejecuta el comando de pruebas del proyecto. '
      + 'Tiene un número máximo de usos por intento. Sirve para comprobar tu trabajo; el resultado de la tarea lo decide la ejecución final que hace el ciclo cuando terminas.',
    esquema: { type: 'object', properties: {}, additionalProperties: false },
  },
];

const POR_NOMBRE = new Map(ESQUEMAS_HERRAMIENTAS.map((e) => [e.nombre, e]));

/**
 * @typedef {Object} ResultadoHerramienta
 * @property {string} texto                                   lo que recibe el modelo
 * @property {boolean} error
 * @property {{ ruta: string, sha256: string }[]} [escritos]  archivos escritos por esta acción
 * @property {{ ruta: string, motivo: string }} [rechazo]     ruta rechazada y por qué
 * @property {boolean} [requiereRevision]                     intentó tocar dependencias o configuración
 * @property {boolean} [pruebas]                              ejecutó las pruebas (cuenta para el tope)
 */

/** @param {string} texto @returns {ResultadoHerramienta} */
const fallo = (texto, extra = {}) => ({ texto, error: true, ...extra });

const esTexto = (v) => typeof v === 'string';
const esLinea = (v) => v === undefined || (Number.isInteger(v) && v >= 1);

/** Recorta por una frontera de línea para que el texto quepa en `maxBytes`. */
function recortarLineas(lineas, maxBytes) {
  let bytes = 0;
  let n = 0;
  for (; n < lineas.length; n++) {
    const b = Buffer.byteLength(lineas[n], 'utf8') + 1;
    if (bytes + b > maxBytes) break;
    bytes += b;
  }
  return n;
}

/**
 * @param {{
 *   cwd: string,
 *   vetadas?: string[],
 *   pruebas?: string[],
 *   respaldo: { registrar: (rutaPosix: string) => void },
 *   runner: { test: (cwd: string) => Promise<any> },
 *   log: { append: Function },
 *   taskId?: string,
 *   maxPruebas?: number,
 *   pruebasEjecutadas?: number,
 * }} opciones
 *   `pruebas`: rutas de las pruebas de la tarea, inmutables. `maxPruebas`: tope de ejecuciones de
 *   pruebas de este intento. `pruebasEjecutadas`: las ya hechas antes de un corte.
 */
export function crearHerramientasCoder(opciones) {
  // Copias propias: nada de lo que ocurra después (ni lo que lea el modelo) cambia reglas ni topes
  const cwd        = path.resolve(opciones.cwd);
  const vetadas    = Object.freeze([...(opciones.vetadas ?? [])]);
  const pruebas    = Object.freeze([...(opciones.pruebas ?? [])]);
  const maxPruebas = Number.isInteger(opciones.maxPruebas) ? Number(opciones.maxPruebas) : 5;
  const meta       = { taskId: opciones.taskId };
  let ejecutadas   = opciones.pruebasEjecutadas ?? 0;

  const explicar = (motivo) => MOTIVOS[motivo] ?? motivo;

  /** @returns {ResultadoHerramienta} */
  function lecturaRechazada(herramienta, ruta, motivo) {
    opciones.log.append('ciclo:lectura_rechazada', { herramienta, ruta, motivo }, meta);
    return fallo(`No se puede leer "${ruta}": ${explicar(motivo)}.`, { rechazo: { ruta, motivo } });
  }

  /** @returns {ResultadoHerramienta} */
  function escrituraRechazada(ruta, motivo) {
    opciones.log.append('ciclo:escritura_rechazada', { nodo: 'coder', herramienta: 'editar', ruta, motivo }, meta);
    const revision = motivo === 'dependencias' || motivo === 'configuracion';
    return fallo(
      `No se modificó "${ruta}": ${explicar(motivo)}.${revision ? ' El cambio NO se aplicó y requiere revisión humana: el trabajo se detiene aquí.' : ''}`,
      { rechazo: { ruta, motivo }, ...(revision ? { requiereRevision: true } : {}) },
    );
  }

  /**
   * Ruta legible: la misma regla que el servidor MCP y `seccionProyecto`. Los manifiestos y la
   * configuración se pueden leer aunque no se puedan escribir; lo vetado y lo de fuera, no.
   * @returns {{ ok: true, rutaPosix: string, absoluta: string } | { ok: false, motivo: string }}
   */
  function legible(ruta) {
    const v = validarRuta(cwd, ruta, { vetadas: [...vetadas] });
    if (v.ok === true) return v;
    if (v.motivo !== 'dependencias' && v.motivo !== 'configuracion') return v;
    const absoluta = path.resolve(cwd, ruta);
    return { ok: true, rutaPosix: path.relative(cwd, absoluta).split(path.sep).join('/'), absoluta };
  }

  /** Carpeta para listar o buscar: '' es la raíz. */
  function carpetaDe(herramienta, carpeta) {
    if (carpeta === undefined || carpeta === '' || carpeta === '.' || carpeta === './') return { ok: true, prefijo: '' };
    if (!esTexto(carpeta)) return { ok: false, resultado: fallo('"carpeta" debe ser un texto.') };
    const v = legible(carpeta);
    if (v.ok === false) return { ok: false, resultado: lecturaRechazada(herramienta, carpeta, v.motivo) };
    return { ok: true, prefijo: v.rutaPosix + '/' };
  }

  const HERRAMIENTAS = {
    /** @returns {Promise<ResultadoHerramienta>} */
    async leer_archivo({ ruta, desde, hasta }) {
      if (!esTexto(ruta) || ruta === '') return fallo('Falta "ruta" (texto).');
      if (!esLinea(desde) || !esLinea(hasta)) return fallo('"desde" y "hasta" son números de línea enteros, a partir de 1.');
      if (desde !== undefined && hasta !== undefined && hasta < desde) return fallo('"hasta" no puede ser menor que "desde".');

      const v = legible(ruta);
      if (v.ok === false) return lecturaRechazada('leer_archivo', ruta, v.motivo);
      let info;
      try { info = fs.statSync(v.absoluta); } catch { return fallo(`No existe: ${v.rutaPosix}`); }
      if (!info.isFile()) return fallo(`"${v.rutaPosix}" no es un archivo.`);
      if (info.size > MAX_ARCHIVO_BYTES) return fallo(`"${v.rutaPosix}" ${MOTIVOS.demasiado_grande}: no se lee.`);
      const buffer = fs.readFileSync(v.absoluta);
      if (buffer.includes(0)) return fallo(`"${v.rutaPosix}" parece un archivo binario: no se devuelve.`);

      const lineas = buffer.toString('utf8').replace(/^﻿/, '').split(/\r?\n/);
      if (lineas.length > 1 && lineas[lineas.length - 1] === '') lineas.pop();
      const total  = lineas.length;
      const inicio = Math.min(desde ?? 1, Math.max(total, 1));
      const fin    = Math.min(hasta ?? total, total);
      const tramo  = lineas.slice(inicio - 1, fin);
      const caben  = recortarLineas(tramo, MAX_RESULTADO_BYTES);
      if (caben === 0 && tramo.length > 0) {
        return fallo(`La línea ${inicio} de "${v.rutaPosix}" no cabe en un resultado (${MAX_RESULTADO_BYTES / 1024} KB). Usa "buscar" para localizar lo que necesitas.`);
      }
      const mostradas = tramo.slice(0, caben);
      const ultima    = inicio + mostradas.length - 1;
      const cabecera  = `[${v.rutaPosix} · líneas ${inicio}-${Math.max(ultima, inicio)} de ${total}]`;
      const aviso     = caben < tramo.length
        ? `\n[recortado: se muestran las líneas ${inicio}-${ultima} de ${total}; pide el resto con "desde": ${ultima + 1} y "hasta"]`
        : '';
      return { texto: `${cabecera}\n${mostradas.join('\n')}${aviso}`, error: false };
    },

    /** @returns {Promise<ResultadoHerramienta>} */
    async listar({ carpeta }) {
      const c = carpetaDe('listar', carpeta);
      if (c.ok === false) return c.resultado;
      const archivos = [];
      const carpetas = new Map();
      for (const a of listarArchivosIndexables(cwd, [...vetadas])) {
        if (!a.ruta.startsWith(c.prefijo)) continue;
        const resto = a.ruta.slice(c.prefijo.length);
        const barra = resto.indexOf('/');
        if (barra === -1) archivos.push(`${a.ruta} (${a.size} bytes)`);
        else carpetas.set(resto.slice(0, barra), (carpetas.get(resto.slice(0, barra)) ?? 0) + 1);
      }
      const entradas = [
        ...[...carpetas.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([nombre, n]) => `${c.prefijo}${nombre}/ (${n} archivo${n === 1 ? '' : 's'})`),
        ...archivos.sort(),
      ];
      const donde = c.prefijo === '' ? 'la raíz del proyecto' : `"${c.prefijo}"`;
      if (entradas.length === 0) return { texto: `No hay archivos visibles en ${donde}.`, error: false };
      const visibles = entradas.slice(0, MAX_ENTRADAS_LISTADO);
      const aviso = entradas.length > visibles.length ? `\n[recortado: ${entradas.length - visibles.length} entradas más; lista una subcarpeta]` : '';
      return { texto: `Contenido de ${donde}:\n${visibles.join('\n')}${aviso}`, error: false };
    },

    /** @returns {Promise<ResultadoHerramienta>} */
    async buscar({ texto, carpeta, max }) {
      if (!esTexto(texto) || texto === '') return fallo('Falta "texto": el texto literal que se busca.');
      if (/[\r\n]/.test(texto)) return fallo('"texto" debe caber en una sola línea.');
      if (max !== undefined && !(Number.isInteger(max) && max >= 1)) return fallo('"max" debe ser un entero mayor que 0.');
      const c = carpetaDe('buscar', carpeta);
      if (c.ok === false) return c.resultado;

      const tope = Math.min(max ?? MAX_COINCIDENCIAS, TOPE_COINCIDENCIAS);
      const lineas = [];
      let bytes = 0;
      let hayMas = false;
      const archivos = listarArchivosIndexables(cwd, [...vetadas]).filter((a) => a.ruta.startsWith(c.prefijo)).sort((a, b) => (a.ruta < b.ruta ? -1 : 1));
      busqueda:
      for (const a of archivos) {
        let contenido;
        try { contenido = fs.readFileSync(a.abs, 'utf8'); } catch { continue; }
        if (!contenido.includes(texto)) continue;
        const partes = contenido.split(/\r?\n/);
        for (let i = 0; i < partes.length; i++) {
          if (!partes[i].includes(texto)) continue;
          const linea = `${a.ruta}:${i + 1}: ${partes[i].trim().slice(0, MAX_LINEA_BUSQUEDA)}`;
          bytes += Buffer.byteLength(linea, 'utf8') + 1;
          if (lineas.length >= tope || bytes > MAX_RESULTADO_BYTES) { hayMas = true; break busqueda; }
          lineas.push(linea);
        }
      }
      if (lineas.length === 0) return { texto: `Sin coincidencias de "${texto}"${c.prefijo ? ` en "${c.prefijo}"` : ''}.`, error: false };
      const aviso = hayMas ? `\n[recortado: hay más coincidencias; se muestran las ${lineas.length} primeras. Acota con "carpeta" o con un texto más específico]` : '';
      return { texto: `${lineas.join('\n')}${aviso}`, error: false };
    },

    /** @returns {Promise<ResultadoHerramienta>} */
    async editar({ ruta, buscar, reemplazar, contenido }) {
      if (!esTexto(ruta) || ruta === '') return fallo('Falta "ruta" (texto).');
      const sustituir = buscar !== undefined || reemplazar !== undefined;
      if (sustituir && contenido !== undefined) return fallo('Usa "buscar" y "reemplazar", o "contenido": no las dos formas a la vez. No se cambió nada.');
      if (!sustituir && contenido === undefined) return fallo('Indica qué cambiar: "buscar" y "reemplazar" para sustituir un fragmento, o "contenido" para escribir el archivo entero.');

      let nuevo = contenido;
      if (sustituir) {
        if (!esTexto(buscar) || !esTexto(reemplazar)) return fallo('"buscar" y "reemplazar" van juntos y los dos son textos. No se cambió nada.');
        if (buscar === '') return fallo('"buscar" no puede estar vacío. No se cambió nada.');
        if (buscar === reemplazar) return fallo('"buscar" y "reemplazar" son iguales: no hay nada que cambiar.');
        // El archivo solo se lee si se podría escribir: las mismas reglas de ruta, antes de abrir nada
        const v = validarRuta(cwd, ruta, { vetadas: [...vetadas] });
        if (v.ok === false) return escrituraRechazada(ruta, v.motivo);
        let actual;
        try {
          const info = fs.statSync(v.absoluta);
          if (!info.isFile()) return escrituraRechazada(ruta, 'archivo_inexistente');
          if (info.size > MAX_ARCHIVO_BYTES) return escrituraRechazada(ruta, 'demasiado_grande');
          const buffer = fs.readFileSync(v.absoluta);
          if (buffer.includes(0)) return escrituraRechazada(ruta, 'no_es_texto');
          actual = buffer.toString('utf8');
        } catch { return escrituraRechazada(ruta, 'archivo_inexistente'); }

        // Un archivo con finales de línea de Windows y un fragmento escrito con "\n" son el mismo texto
        let desde = buscar;
        let hacia = reemplazar;
        if (actual.includes('\r\n') && !desde.includes('\r')) {
          desde = desde.replace(/\n/g, '\r\n');
          hacia = hacia.replace(/\r?\n/g, '\r\n');
        }
        const primera = actual.indexOf(desde);
        if (primera === -1) return escrituraRechazada(ruta, 'fragmento_no_encontrado');
        let veces = 0;
        for (let i = primera; i !== -1; i = actual.indexOf(desde, i + desde.length)) veces++;
        if (veces > 1) {
          const r = escrituraRechazada(ruta, 'fragmento_repetido');
          return { ...r, texto: `${r.texto} (aparece ${veces} veces)` };
        }
        nuevo = actual.slice(0, primera) + hacia + actual.slice(primera + desde.length);
      } else if (!esTexto(contenido)) {
        return fallo('"contenido" debe ser un texto. No se cambió nada.');
      }
      if (Buffer.byteLength(nuevo, 'utf8') > MAX_ARCHIVO_BYTES) return escrituraRechazada(ruta, 'demasiado_grande');

      // El único camino de escritura: el mismo que el modo de bloque (ADR-07)
      const aplicado = aplicarArchivos(cwd, [{ ruta, contenido: nuevo }], {
        rol: 'coder', pruebas: [...pruebas], vetadas: [...vetadas], atomica: true,
        antesDeEscribir: (rutaPosix) => opciones.respaldo.registrar(rutaPosix),
      });
      if (aplicado.rechazados.length > 0) return escrituraRechazada(ruta, aplicado.rechazados[0].motivo);
      const [e] = aplicado.escritos;
      return {
        texto: sustituir ? `Fragmento sustituido en ${e.ruta}.` : `Escrito ${e.ruta} (${Buffer.byteLength(nuevo, 'utf8')} bytes).`,
        error: false, escritos: [e],
      };
    },

    /** @returns {Promise<ResultadoHerramienta>} */
    async ejecutar_pruebas() {
      if (ejecutadas >= maxPruebas) {
        return fallo(`Ya se alcanzó el máximo de ${maxPruebas} ejecuciones de pruebas de este intento. Termina tu trabajo: el ciclo ejecutará las pruebas al final.`);
      }
      ejecutadas++;
      const r = await opciones.runner.test(cwd);
      const categoria = clasificar(
        { exitCode: r.exitCode ?? null, timedOut: r.timedOut, infraError: r.infraError },
        { hayPruebas: true, pruebasIntactas: true },
      );
      const resumen = {
        pass: 'Las pruebas PASAN.',
        fail: 'Las pruebas FALLAN.',
        timeout: 'Las pruebas superaron el tiempo máximo.',
        infra_error: 'El entorno aislado no pudo ejecutar las pruebas (no es un fallo de tu código).',
      }[categoria];
      const salida = cola(`${r.stdout ?? ''}${r.stderr ? `\n${r.stderr}` : ''}`, 8192);
      return {
        texto: `${resumen}\ncódigo de salida: ${r.exitCode ?? 'ninguno'}\nejecución ${ejecutadas} de ${maxPruebas} de este intento\n`
          + 'Esta ejecución no decide el resultado de la tarea: lo decide la ejecución final del ciclo.\n\n'
          + `--- salida (final) ---\n${salida || '(vacía)'}`,
        error: categoria === 'infra_error',
        pruebas: true,
      };
    },
  };

  return {
    esquemas: ESQUEMAS_HERRAMIENTAS,
    /** Ejecuciones de pruebas hechas en este intento. */
    pruebasEjecutadas: () => ejecutadas,
    /** Al reproducir desde el diario una ejecución de pruebas ya hecha: cuenta, pero no se repite. */
    contarPrueba: () => { ejecutadas++; },
    /**
     * @param {string} nombre
     * @param {any} entrada
     * @returns {Promise<ResultadoHerramienta>}
     */
    async ejecutar(nombre, entrada) {
      const esquema = POR_NOMBRE.get(nombre);
      if (!esquema) return fallo(`Herramienta desconocida: "${String(nombre).slice(0, 80)}". Las únicas son: ${ESQUEMAS_HERRAMIENTAS.map((e) => e.nombre).join(', ')}.`);
      const datos = entrada ?? {};
      if (typeof datos !== 'object' || Array.isArray(datos)) return fallo(`La entrada de "${nombre}" debe ser un objeto.`);
      const sobran = Object.keys(datos).filter((k) => !(k in esquema.esquema.properties));
      if (sobran.length > 0) {
        return fallo(`"${nombre}" no acepta ${sobran.map((k) => `"${k.slice(0, 40)}"`).join(', ')}. ${Object.keys(esquema.esquema.properties).length === 0 ? 'No tiene parámetros.' : `Parámetros: ${Object.keys(esquema.esquema.properties).join(', ')}.`} No se hizo nada.`);
      }
      return HERRAMIENTAS[nombre](datos);
    },
  };
}
