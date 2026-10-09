/**
 * herramientas.js — Las tres herramientas MCP de FORGE (spec 2026-10-03-herramientas-mcp)
 *
 *   ejecutar_pruebas   las pruebas del proyecto, en el entorno aislado
 *   leer_archivo       un archivo del proyecto, con las reglas de rutas del ciclo
 *   escribir_archivo   un archivo del proyecto, con las reglas de rutas del ciclo
 *
 * No hay una segunda implementación de las reglas: se usan validarRuta y
 * aplicarArchivos de core/ciclo/protocolo-archivos.js, el mismo código que
 * protege al ciclo verificado. Ninguna herramienta ejecuta nada en el anfitrión.
 */

import * as fs from 'fs';
import * as path from 'path';
import { adquirir, ErrorBloqueado } from '../ciclo/candado.js';
import { aplicarArchivos, validarRuta } from '../ciclo/protocolo-archivos.js';
import { cola } from '../ciclo/redactar.js';
import { Respaldo } from '../ciclo/respaldo.js';
import { clasificar } from '../ciclo/router.js';

export const MAX_LECTURA_BYTES = 256 * 1024;
export const MAX_ESCRITURA_BYTES = 1024 * 1024;

export const MOTIVOS = {
  ruta_absoluta: 'la ruta debe ser relativa a la raíz del proyecto',
  fuera_del_proyecto: 'la ruta sale del proyecto',
  ruta_no_portable: 'el nombre contiene algo que Windows resuelve a otro archivo (punto o espacio final, ":", "~1", nombres de dispositivo…)',
  enlace_simbolico: 'la ruta es, o pasa por, un enlace simbólico',
  ruta_vetada: 'la ruta está vetada (repositorio git, estado de FORGE, secretos, node_modules…)',
  dependencias: 'es un manifiesto de dependencias: un cambio requiere revisión humana y no se aplica',
  configuracion: 'es configuración que alguna herramienta ejecuta o interpreta sola: un cambio requiere revisión humana y no se aplica',
  ruta_duplicada: 'ruta repetida',
  no_es_prueba: 'con el rol "pruebas" solo se pueden escribir archivos de prueba',
  prueba_inmutable: 'con el rol "implementacion" no se pueden escribir archivos de prueba',
  error_escritura: 'no se pudo escribir (¿la ruta es un directorio o cuelga de un archivo?)',
};

const error = (texto) => ({ texto, error: true });

/** @param {string} tipo */
function ocupado(tipo) {
  return error(`El proyecto está ocupado: ${tipo}. Espera a que termine y vuelve a intentarlo.`);
}

/**
 * `runner` es el entorno aislado ya creado; `crearRunner` lo crea al primer uso
 * (por defecto, Docker: ver servidor.js).
 *
 * @param {{
 *   cwd: string,
 *   runner?: { test: (cwd: string) => Promise<any> },
 *   crearRunner?: () => Promise<{ test: (cwd: string) => Promise<any> }>,
 *   dirMotor?: string,
 *   vetadas?: string[],
 * }} opciones
 * @returns {import('./protocolo.js').Herramienta[]}
 */
export function crearHerramientas(opciones) {
  const cwd = path.resolve(opciones.cwd);
  const dirMotor = opciones.dirMotor ?? path.join(cwd, '.sdd', 'motor', `mcp-${Date.now()}`);
  const respaldo = new Respaldo(cwd, path.join(dirMotor, 'respaldo', 'mcp'));
  /** @type {{ test: (cwd: string) => Promise<any> } | null} */
  let runner = opciones.runner ?? null;

  return [
    {
      name: 'ejecutar_pruebas',
      description:
        'Ejecuta las pruebas del proyecto en un entorno aislado (contenedor sin red, sin privilegios y con límites). '
        + 'No acepta comandos: ejecuta el comando de pruebas que FORGE detecta en el proyecto. '
        + 'Devuelve si pasan, fallan, agotan el tiempo o si falló el entorno, el código de salida y el final de la salida. '
        + 'Si hay un ciclo verificado en marcha sobre el proyecto, responde que está ocupado.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      async ejecutar() {
        let liberar;
        try {
          liberar = adquirir(path.join(cwd, '.sdd', 'motor', 'proyecto.lock'), 'El entorno aislado de este proyecto');
        } catch (e) {
          if (e instanceof ErrorBloqueado) return ocupado(e.message);
          throw e;
        }
        try {
          if (!runner) {
            if (!opciones.crearRunner) return error('No hay un entorno aislado configurado.');
            try { runner = await opciones.crearRunner(); } catch (e) { return error(e instanceof Error ? e.message : String(e)); }
          }
          const r = await runner.test(cwd);
          const categoria = clasificar(
            { exitCode: r.exitCode ?? null, timedOut: r.timedOut, infraError: r.infraError },
            { hayPruebas: true, pruebasIntactas: true },
          );
          const resumen = {
            pass: 'Las pruebas PASAN.',
            fail: 'Las pruebas FALLAN.',
            timeout: 'Las pruebas superaron el tiempo máximo.',
            infra_error: 'El entorno aislado no pudo ejecutar las pruebas.',
          }[categoria];
          const salida = cola(`${r.stdout ?? ''}${r.stderr ? `\n${r.stderr}` : ''}`, 8192);
          // Un fallo del entorno es un error de la herramienta: el agente no puede corregirlo editando código
          return {
            texto: `${resumen}\ncategoría: ${categoria}\ncódigo de salida: ${r.exitCode ?? 'ninguno'}\nduración: ${((r.durationMs ?? 0) / 1000).toFixed(1)} s\n\n--- salida (final) ---\n${salida || '(vacía)'}`,
            ...(categoria === 'infra_error' ? { error: true } : {}),
          };
        } finally {
          liberar();
        }
      },
    },

    {
      name: 'leer_archivo',
      description:
        'Lee un archivo de texto del proyecto. Rutas relativas a la raíz del proyecto. '
        + 'Rechaza rutas que salgan del proyecto, el repositorio git, el estado de FORGE, secretos y enlaces simbólicos. '
        + `Devuelve como mucho ${MAX_LECTURA_BYTES / 1024} KB y avisa si recorta.`,
      inputSchema: {
        type: 'object',
        properties: { ruta: { type: 'string', maxLength: 1024, description: 'Ruta relativa a la raíz del proyecto, con "/"' } },
        required: ['ruta'],
        additionalProperties: false,
      },
      async ejecutar({ ruta }) {
        const v = validarRuta(cwd, ruta, { vetadas: opciones.vetadas });
        let rutaPosix = null;
        if (v.ok === false) {
          // Los manifiestos y la configuración se pueden leer aunque no se puedan escribir
          if (v.motivo !== 'dependencias' && v.motivo !== 'configuracion') return error(`No se puede leer "${ruta}": ${MOTIVOS[v.motivo] ?? v.motivo}.`);
          rutaPosix = path.relative(cwd, path.resolve(cwd, ruta)).split(path.sep).join('/');
        } else {
          rutaPosix = v.rutaPosix;
        }
        const abs = path.resolve(cwd, rutaPosix);
        let info;
        try { info = fs.statSync(abs); } catch { return error(`No existe: ${rutaPosix}`); }
        if (!info.isFile()) return error(`"${rutaPosix}" no es un archivo.`);

        const fd = fs.openSync(abs, 'r');
        try {
          const buffer = Buffer.alloc(Math.min(info.size, MAX_LECTURA_BYTES));
          fs.readSync(fd, buffer, 0, buffer.length, 0);
          if (buffer.includes(0)) return error(`"${rutaPosix}" parece un archivo binario: no se devuelve.`);
          const recortado = info.size > MAX_LECTURA_BYTES;
          const texto = buffer.toString('utf8').replace(/�+$/, '');
          return { texto: texto + (recortado ? `\n\n[archivo recortado: se muestran ${MAX_LECTURA_BYTES} de ${info.size} bytes]` : '') };
        } finally {
          fs.closeSync(fd);
        }
      },
    },

    {
      name: 'escribir_archivo',
      description:
        'Escribe un archivo del proyecto (lo crea o lo sustituye entero). Rutas relativas a la raíz del proyecto. '
        + 'Aplica las reglas del ciclo verificado: no escribe fuera del proyecto, ni en el repositorio git, el estado de FORGE, secretos o enlaces simbólicos, '
        + 'y no aplica cambios en dependencias (package.json, requirements.txt…) ni en configuración que otras herramientas ejecutan solas (.github/, .husky/, conftest.py, *.config.js…): '
        + 'esos cambios requieren revisión humana. '
        + 'El rol "implementacion" (por defecto) no puede escribir archivos de prueba; el rol "pruebas" solo puede escribir archivos de prueba. '
        + 'Guarda un respaldo del contenido anterior.',
      inputSchema: {
        type: 'object',
        properties: {
          ruta: { type: 'string', maxLength: 1024, description: 'Ruta relativa a la raíz del proyecto, con "/"' },
          contenido: { type: 'string', maxLength: MAX_ESCRITURA_BYTES, description: 'Contenido completo del archivo' },
          rol: { type: 'string', enum: ['implementacion', 'pruebas'], description: 'Qué clase de archivo se escribe (por defecto, implementacion)' },
        },
        required: ['ruta', 'contenido'],
        additionalProperties: false,
      },
      async ejecutar({ ruta, contenido, rol = 'implementacion' }) {
        if (Buffer.byteLength(contenido, 'utf8') > MAX_ESCRITURA_BYTES) {
          return error(`El contenido supera el máximo de ${MAX_ESCRITURA_BYTES / 1024} KB.`);
        }
        const r = aplicarArchivos(cwd, [{ ruta, contenido }], {
          rol: rol === 'pruebas' ? 'qa' : 'coder',
          vetadas: opciones.vetadas,
          antesDeEscribir: (rutaPosix) => respaldo.registrar(rutaPosix),
        });
        if (r.rechazados.length > 0) {
          const { motivo } = r.rechazados[0];
          return error(`No se escribió "${ruta}": ${MOTIVOS[motivo] ?? motivo}.${r.requiereRevision ? ' Pide a una persona que lo revise y lo aplique.' : ''}`);
        }
        const [e] = r.escritos;
        return { texto: `Escrito: ${e.ruta}\nsha256: ${e.sha256}\nbytes: ${Buffer.byteLength(contenido, 'utf8')}` };
      },
    },
  ];
}
