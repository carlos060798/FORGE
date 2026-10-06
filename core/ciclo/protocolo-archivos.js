/**
 * protocolo-archivos.js — De la salida de un agente a archivos en disco (ADR-07)
 *
 * Único punto donde se decide qué puede escribir un modelo y dónde.
 * Los agentes devuelven un bloque JSON: { "archivos": [{ "ruta", "contenido" }] }
 *
 * Tres clases de ruta que un agente no escribe por su cuenta:
 *   ruta_vetada    nunca, ni leer ni escribir (repositorio git, estado de FORGE, secretos)
 *   dependencias   manifiestos de dependencias: el cambio lo revisa una persona
 *   configuracion  archivos que alguna herramienta ejecuta o interpreta sola
 *                  (hooks, CI, configuración del editor o del ejecutor de pruebas)
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { coincide } from '../glob.js';

/**
 * Carpetas vetadas a cualquier profundidad. No basta con vetarlas en la raíz:
 * git trata `sub/.git/` como un repositorio y ejecuta lo que diga su `config`.
 * Un ARCHIVO llamado `.git` también cuenta (puede redirigir a otra carpeta).
 */
export const SEGMENTOS_VETADOS = ['.git', '.sdd', '.claude', 'node_modules', '.ssh', '.aws', '.docker', '.kube', 'secrets', '.gnupg', '.m2', '.gradle', '.terraform', '.password-store'];

/** Nombres de archivo que suelen contener secretos, a cualquier profundidad. */
export const NOMBRES_VETADOS = [
  '.env*', '.dev.vars', '*.pem', '*.key', '*.p12', '*.pfx', '*.jks', '*.keystore', '*.ppk',
  '.npmrc', '.netrc', '.pypirc', '.git-credentials', '.htpasswd',
  'id_rsa*', 'id_dsa*', 'id_ecdsa*', 'id_ed25519*',
  '*.env', 'wp-config*.php', '*.sqlite', '*.sqlite3', 'serviceaccount*.json', 'database.yml', 'appsettings.production.json', '.my.cnf', 'credentials', 'secrets', 'secrets.{txt,json,yml,yaml,env,cfg,ini,conf,dat,key,pem,toml,xml,properties}',
  '*.tfstate*', '*.tfvars', '*service-account*', 'key.json', '*-key.json', '*_key.json', '*.key.json',
  // Solo con extension de datos: `secrets-manager.ts` o `credentials.service.ts` son codigo
  '*credentials*.{txt,json,yml,yaml,env,cfg,ini,conf,dat,key,pem,toml,xml,properties}', '*secret*.{txt,json,yml,yaml,env,cfg,ini,conf,dat,key,pem,toml,xml,properties}',
  '.pgpass', '.vault-token', '.dockercfg', '.boto', '.s3cfg', '.*history', '*kubeconfig*', 'auth.json',
  // Solo con extension de datos: `tokenizer.js` o `password.js` son codigo
  '*token*.{txt,json,yml,yaml,env,cfg,ini,conf,dat,key,pem}', '*apikey*.{txt,json,yml,yaml,env,cfg,ini,conf,dat,key,pem}', '*api_key*.{txt,json,yml,yaml,env,cfg,ini,conf,dat,key,pem}', '*api-key*.{txt,json,yml,yaml,env,cfg,ini,conf,dat,key,pem}', '*password*.{txt,json,yml,yaml,env,cfg,ini,conf,dat,key,pem}', '*passwd*.{txt,json,yml,yaml,env,cfg,ini,conf,dat,key,pem}',
  '*adminsdk*', 'wallet*.{txt,json,yml,yaml,env,cfg,ini,conf,dat,key,pem}', '*.kdbx',
];

/** Manifiestos de dependencias: un cambio exige revisión humana (CA-008-05). */
export const MANIFIESTOS = [
  'package.json', 'package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb',
  'requirements*.txt', 'pyproject.toml', 'Pipfile', 'Pipfile.lock', 'poetry.lock', 'uv.lock', 'setup.py', 'setup.cfg',
  'go.mod', 'go.sum', 'go.work', 'go.work.sum',
];

/**
 * Archivos que una herramienta ejecuta o interpreta sin que nadie los lance:
 * el ejecutor de pruebas, el editor, otros agentes, `make`, Docker.
 * Además, cualquier ruta con un segmento que empiece por "." (.github/, .husky/,
 * .vscode/, .eslintrc.js, .gitignore…) se trata igual.
 */
export const CONFIGURACION = [
  'conftest.py', 'sitecustomize.py', 'usercustomize.py', 'pytest.ini', 'tox.ini',
  '*.config.js', '*.config.cjs', '*.config.mjs', '*.config.ts', '*.config.cts', '*.config.mts', '*.config.json',
  'Makefile', 'Dockerfile*', 'docker-compose*.yml', 'docker-compose*.yaml', 'compose.yml', 'compose.yaml',
  'CLAUDE.md', 'AGENTS.md',
];

/** Nombres que Windows trata como dispositivos, con o sin extensión. */
const DISPOSITIVOS = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/**
 * Forma de comparar rutas: sin mayúsculas ni variantes Unicode. En Windows y
 * macOS "Tests/A.TEST.JS" y "tests/a.test.js" son el mismo archivo.
 * @param {string} rutaPosix
 */
export function canonica(rutaPosix) {
  return rutaPosix.normalize('NFC').toLowerCase();
}

/**
 * Segmentos que en Windows acaban apuntando a otro archivo del que parecen:
 * ".git." y ".git " son ".git"; "a.js:x" es un flujo alternativo de "a.js";
 * "GIT~1" puede ser el nombre corto de ".git".
 * @param {string} ruta
 */
function esPortable(ruta) {
  return ruta.split(/[\\/]/).every((segmento) => {
    if (segmento === '' || segmento === '.' || segmento === '..') return true;
    if (/[<>:"|?*\u0000-\u001f]/.test(segmento)) return false;
    if (/[. ]$/.test(segmento)) return false;
    if (/~\d/.test(segmento)) return false;
    return !DISPOSITIVOS.test(segmento.split('.')[0]);
  });
}

/**
 * ¿Es una ruta que nadie debe leer ni copiar? La usan el protocolo de escritura,
 * el recuperador de contexto y la copia de trabajo: una sola lista para los tres.
 * @param {string} rutaPosix
 * @param {string[]} [extra]  patrones adicionales de la configuración
 */
export function esVetada(rutaPosix, extra = []) {
  const segmentos = canonica(rutaPosix).split('/');
  if (segmentos.some((s) => SEGMENTOS_VETADOS.includes(s))) return true;
  const nombre = segmentos[segmentos.length - 1];
  if (NOMBRES_VETADOS.some((p) => coincide(nombre, p))) return true;
  return extra.some((p) => coincide(rutaPosix, p));
}

/**
 * @param {string} rutaPosix
 * @param {string[]} [vetadasExtra]
 * @returns {null | 'ruta_vetada' | 'dependencias' | 'configuracion'}
 */
export function clasificarRuta(rutaPosix, vetadasExtra = []) {
  if (esVetada(rutaPosix, vetadasExtra)) return 'ruta_vetada';
  const segmentos = canonica(rutaPosix).split('/');
  const nombre = segmentos[segmentos.length - 1];
  if (MANIFIESTOS.some((p) => coincide(nombre, p))) return 'dependencias';
  if (segmentos.some((s) => s.startsWith('.'))) return 'configuracion';
  if (CONFIGURACION.some((p) => coincide(nombre, p))) return 'configuracion';
  return null;
}

/**
 * ¿La recogería un ejecutor de pruebas? Se usa en los dos sentidos: lo que el
 * agente de pruebas puede escribir y lo que el implementador no puede tocar.
 * Cubre las convenciones de `node --test`, jest, vitest, mocha, pytest y `go test` (`*_test.go`).
 * @param {string} rutaPosix
 */
export function esRutaDePrueba(rutaPosix) {
  rutaPosix = canonica(rutaPosix);
  const nombre = rutaPosix.split('/').pop() ?? '';
  return /^(tests?|__tests__|spec)\//.test(rutaPosix)
    || /\/__tests__\//.test(rutaPosix)
    || /[-_.](test|spec)\.[cm]?[jt]sx?$/.test(nombre)
    || /^test[-_.].*\.[cm]?[jt]sx?$/.test(nombre)
    || /^test\.[cm]?[jt]sx?$/.test(nombre)
    || /^test_.+\.py$/.test(nombre)
    || /_test\.py$/.test(nombre)
    || /_test\.go$/.test(nombre)
    || /^tests?\.py$/.test(nombre);
}

/** @param {string|Buffer} contenido */
export function huella(contenido) {
  return createHash('sha256').update(contenido).digest('hex');
}

/**
 * Extrae y valida el bloque de archivos de la salida de un agente.
 * @param {string} salida
 * @returns {{ ok: true, archivos: { ruta: string, contenido: string }[] } | { ok: false, error: string }}
 */
export function extraerBloque(salida) {
  const candidatos = [];
  for (const m of salida.matchAll(/```(?:json)?\s*\n([\s\S]*?)\n```/g)) candidatos.push(m[1]);
  const ini = salida.indexOf('{');
  const fin = salida.lastIndexOf('}');
  if (ini !== -1 && fin > ini) candidatos.push(salida.slice(ini, fin + 1));

  let ultimoError = 'la salida no contiene un bloque JSON';
  for (const texto of candidatos) {
    let json;
    try { json = JSON.parse(texto); } catch (e) { ultimoError = `JSON inválido: ${/** @type {Error} */ (e).message}`; continue; }
    if (!json || !Array.isArray(json.archivos)) { ultimoError = 'falta la lista "archivos"'; continue; }
    const mal = json.archivos.find((a) => typeof a?.ruta !== 'string' || a.ruta === '' || typeof a?.contenido !== 'string');
    if (mal) { ultimoError = 'cada archivo necesita "ruta" y "contenido" de tipo texto'; continue; }
    return { ok: true, archivos: json.archivos.map((a) => ({ ruta: a.ruta, contenido: a.contenido })) };
  }
  return { ok: false, error: ultimoError };
}

function dentroDe(raiz, ruta) {
  const rel = path.relative(raiz, ruta);
  return rel === '' || (rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel));
}

/**
 * Ruta real de `absoluta`: resuelve los enlaces de la parte que ya existe y le
 * añade el resto. Devuelve null si en el camino hay un enlace roto (apunta a
 * algo que no existe, así que escribir a través de él crearía su destino).
 * @param {string} absoluta
 * @returns {string|null}
 */
function rutaReal(absoluta) {
  const pendientes = [];
  let actual = absoluta;
  for (;;) {
    let info = null;
    try { info = fs.lstatSync(actual); } catch { /* no existe */ }
    if (info) {
      let real;
      try { real = fs.realpathSync(actual); } catch { return null; }
      return path.join(real, ...pendientes.reverse());
    }
    const padre = path.dirname(actual);
    if (padre === actual) return null;
    pendientes.push(path.basename(actual));
    actual = padre;
  }
}

/**
 * @param {string} cwd
 * @param {string} ruta                       tal como la propuso el agente
 * @param {{ vetadas?: string[] }} [opciones]
 * @returns {{ ok: true, rutaPosix: string, absoluta: string } | { ok: false, motivo: 'ruta_absoluta'|'fuera_del_proyecto'|'ruta_no_portable'|'enlace_simbolico'|'ruta_vetada'|'dependencias'|'configuracion' }}
 */
export function validarRuta(cwd, ruta, opciones = {}) {
  if (path.isAbsolute(ruta) || /^[a-zA-Z]:/.test(ruta) || ruta.startsWith('\\\\')) return { ok: false, motivo: 'ruta_absoluta' };
  if (!esPortable(ruta)) return { ok: false, motivo: 'ruta_no_portable' };

  const raiz     = path.resolve(cwd);
  const absoluta = path.resolve(raiz, ruta);
  if (!dentroDe(raiz, absoluta) || absoluta === raiz) return { ok: false, motivo: 'fuera_del_proyecto' };

  // El destino no puede ser un enlace (ni roto): escribir en él tocaría otro archivo
  try {
    if (fs.lstatSync(absoluta).isSymbolicLink()) return { ok: false, motivo: 'enlace_simbolico' };
  } catch { /* no existe: bien */ }

  // Las reglas se aplican también a la ruta real: un enlace dentro del proyecto
  // no debe servir para salir de él ni para llegar a una ruta vetada (g -> .git)
  const raizReal = fs.existsSync(raiz) ? fs.realpathSync(raiz) : raiz;
  const real     = rutaReal(absoluta);
  if (!real) return { ok: false, motivo: 'enlace_simbolico' };
  if (!dentroDe(raizReal, real)) return { ok: false, motivo: 'fuera_del_proyecto' };

  const rutaPosix     = path.relative(raiz, absoluta).split(path.sep).join('/');
  const rutaPosixReal = path.relative(raizReal, real).split(path.sep).join('/');
  // Primero los vetos de las dos rutas: si no, `pub/app.config.json` (con pub -> secrets) se
  // clasificaria como configuracion por su ruta logica y nunca se miraria la real
  const candidatas = [...new Set([rutaPosix, rutaPosixReal])];
  const clases = candidatas.map((c) => clasificarRuta(c, opciones.vetadas));
  if (clases.includes('ruta_vetada')) return { ok: false, motivo: 'ruta_vetada' };
  const clase = clases.find(Boolean);
  if (clase) return { ok: false, motivo: clase, ...(rutaPosixReal !== rutaPosix ? { rutaReal: rutaPosixReal } : {}) };

  return { ok: true, rutaPosix, absoluta };
}

/**
 * Escribe los archivos permitidos y devuelve qué se escribió y qué se rechazó.
 *
 * @param {string} cwd
 * @param {{ ruta: string, contenido: string }[]} archivos
 * @param {{ rol: 'qa'|'coder', pruebas?: string[], vetadas?: string[], antesDeEscribir?: (rutaPosix: string) => void }} opciones
 *   `pruebas`: rutas (posix) de las pruebas ya escritas; inmutables para el rol `coder`.
 *   `antesDeEscribir`: se llama con cada ruta aceptada, antes de tocar el disco (respaldo).
 * @returns {{ escritos: { ruta: string, sha256: string }[], rechazados: { ruta: string, motivo: string }[], requiereRevision: boolean }}
 *   `requiereRevision`: el agente propuso cambiar dependencias o configuración ejecutable.
 */
export function aplicarArchivos(cwd, archivos, opciones) {
  const pruebas    = new Set((opciones.pruebas ?? []).map(canonica));
  const vistas     = new Set();
  const escritos   = [];
  const rechazados = [];

  for (const { ruta, contenido } of archivos) {
    const v = validarRuta(cwd, ruta, { vetadas: opciones.vetadas });
    if (v.ok === false) { rechazados.push({ ruta, motivo: v.motivo }); continue; }

    // Dos rutas que solo difieren en mayúsculas son el mismo archivo en Windows y macOS
    const clave = canonica(v.rutaPosix);
    if (vistas.has(clave)) { rechazados.push({ ruta, motivo: 'ruta_duplicada' }); continue; }
    vistas.add(clave);

    if (opciones.rol === 'qa' && !esRutaDePrueba(v.rutaPosix)) {
      rechazados.push({ ruta, motivo: 'no_es_prueba' });
      continue;
    }
    if (opciones.rol === 'coder' && (pruebas.has(clave) || esRutaDePrueba(v.rutaPosix))) {
      rechazados.push({ ruta, motivo: 'prueba_inmutable' });
      continue;
    }

    try {
      opciones.antesDeEscribir?.(v.rutaPosix);
      fs.mkdirSync(path.dirname(v.absoluta), { recursive: true });
      fs.writeFileSync(v.absoluta, contenido, 'utf8');
    } catch {
      // p. ej. la ruta es un directorio, o un segmento intermedio es un archivo
      rechazados.push({ ruta, motivo: 'error_escritura' });
      continue;
    }
    escritos.push({ ruta: v.rutaPosix, sha256: huella(contenido) });
  }

  return { escritos, rechazados, requiereRevision: rechazados.some((r) => r.motivo === 'dependencias' || r.motivo === 'configuracion') };
}

/**
 * Rutas cuyo contenido ya no coincide con la huella registrada (o que ya no existen).
 * @param {string} cwd
 * @param {{ ruta: string, sha256: string }[]} archivos
 * @returns {string[]}
 */
export function huellasAlteradas(cwd, archivos) {
  return archivos
    .filter(({ ruta, sha256 }) => {
      const abs = path.resolve(cwd, ruta);
      return !fs.existsSync(abs) || huella(fs.readFileSync(abs)) !== sha256;
    })
    .map((a) => a.ruta);
}
