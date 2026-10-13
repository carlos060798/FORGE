/**
 * rutas.js — Qué rutas no puede proponer `proponerCambio` (revisión independiente 1, R3, R8, R14)
 *
 * Una lista COMÚN a los adaptadores de GitHub y GitLab. Es una constante congelada: la configuración
 * del proyecto no puede reducirla ni saltarla. Rechaza (sin normalizar en silencio, para que lo que
 * se aprobó sea lo que se envía):
 *
 *   - rutas absolutas, con «\», con «:» (letra de unidad, flujos alternativos de NTFS), segmentos
 *     vacíos, «.» o «..», o más de 255 caracteres;
 *   - controles, caracteres de formato (ancho cero, bidi, etiquetas), de uso privado, sin asignar, y
 *     los «rellenos» invisibles (U+3164, U+2800, U+034F…), en cualquier posición;
 *   - segmentos que empiezan o acaban en espacio o terminan en «.» (Windows los descarta);
 *   - nombres cortos 8.3 (`GIT~1`) y nombres reservados de Windows (`CON`, `NUL.txt`, `COM1`…);
 *   - todo lo que ejecuta código en la plataforma o cambia quién revisa: `.github/`, `.gitlab/`,
 *     `.circleci/`, `.husky/`, `.gitlab-ci.yml|yaml`, `Jenkinsfile`, `azure-pipelines.yml`,
 *     `.travis.yml`, `bitbucket-pipelines.yml`, `.gitmodules`, `.gitattributes`, `.gitignore`,
 *     `CODEOWNERS`, en cualquier carpeta y sin distinguir mayúsculas;
 *   - cualquier segmento `.git` (y sus variantes `.git `, `.git.`, `.git` con ancho cero, `.GIT`,
 *     `GIT~1`, la forma de ancho completo).
 *
 * Es código puro.
 */

export const MAX_RUTA = 255;

const PROHIBIDOS = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}\u2028\u2029\u3164\u2800\u034F\u115F\u1160\uFFA0\u180E\u2000-\u200F\u2060-\u206F\u00A0\u1680\u202F\u205F\u3000]/u;
const RESERVADO_WINDOWS = /^(?:con|prn|aux|nul|conin\$|conout\$|clock\$|com[0-9¹²³]|lpt[0-9¹²³])(?:\..*)?$/i;

/** Directorios completos vetados (en cualquier posición de la ruta). */
export const DIRECTORIOS_VETADOS = Object.freeze(['.github', '.gitlab', '.circleci', '.husky']);
/** Nombres de archivo vetados (en cualquier carpeta). */
export const ARCHIVOS_VETADOS = Object.freeze([
  '.gitlab-ci.yml', '.gitlab-ci.yaml', 'jenkinsfile', 'azure-pipelines.yml', '.travis.yml',
  'bitbucket-pipelines.yml', '.gitmodules', '.gitattributes', '.gitignore', 'codeowners',
]);

/**
 * @param {unknown} ruta
 * @returns {string|null}  motivo del rechazo, o null si la ruta se puede proponer
 */
export function motivoRutaVetada(ruta) {
  if (typeof ruta !== 'string' || ruta === '') return 'la ruta está vacía o no es un texto';
  if (ruta.length > MAX_RUTA) return `la ruta supera ${MAX_RUTA} caracteres`;
  if (PROHIBIDOS.test(ruta)) return 'la ruta tiene caracteres de control, de formato o invisibles';
  if (ruta.includes('\\')) return 'la ruta contiene «\\»';
  if (ruta.includes(':')) return 'la ruta contiene «:» (unidad de disco o flujo alternativo de NTFS)';
  if (ruta.startsWith('/')) return 'la ruta es absoluta';
  const segmentos = ruta.split('/');
  for (const original of segmentos) {
    if (original === '') return 'la ruta tiene un segmento vacío';
    if (original === '.' || original === '..') return 'la ruta sale del proyecto («.» o «..»)';
    // Plegado de compatibilidad: «．git» de ancho completo es «.git»
    const s = original.normalize('NFKC').toLowerCase();
    const sinCola = s.replace(/[ .]+$/, '');
    if (sinCola === '.git' || /^git~\d/.test(sinCola) || s === '.git') return 'la ruta toca el directorio .git';
    if (original !== original.trim() || /\.$/.test(original)) return 'un segmento empieza o acaba por espacio, o acaba en «.»';
    if (/~\d/.test(s)) return 'un segmento parece un nombre corto 8.3 («~1»)';
    if (RESERVADO_WINDOWS.test(s)) return 'un segmento es un nombre reservado de Windows';
    if (s.startsWith('.git') && sinCola === '.git') return 'la ruta toca el directorio .git';
    if (DIRECTORIOS_VETADOS.includes(s)) return `la ruta está bajo ${original}/ (flujos de CI y configuración de la plataforma: no se proponen cambios ahí)`;
  }
  const ultimo = segmentos[segmentos.length - 1].normalize('NFKC').toLowerCase();
  if (ARCHIVOS_VETADOS.includes(ultimo)) return `${segmentos[segmentos.length - 1]} es un archivo de CI o de configuración de la plataforma: no se proponen cambios ahí`;
  return null;
}

// ── Manifiestos y archivos que ejecutan código al instalar, construir o abrir el proyecto ───────
//
// Revisión independiente 2 (H2). No son «vetados» (no se vuelven imposibles de proponer): son
// EXCLUIDOS POR DEFECTO de una propuesta, con la aprobación aparte por archivo que ya existe. Se
// suman a lo que ya clasifica `clasificarRuta` del ciclo (package.json, .npmrc, .env*, Makefile,
// setup.py, pyproject.toml, go.mod, cualquier segmento que empiece por «.»…): si esa lista cambia
// o se queda corta, esta cubre lo que un manifiesto o un script puede ejecutar.

/** Manifiestos de dependencias o de construcción. */
const NOMBRES_DEPENDENCIAS = [
  /^cargo\.(?:toml|lock)$/, /^gemfile(?:\.lock)?$/, /^composer\.(?:json|lock)$/, /^pom\.xml$/, /^build\.gradle(?:\.kts)?$/,
  /^settings\.gradle(?:\.kts)?$/, /^package\.swift$/, /^mix\.exs$/, /^pubspec\.yaml$/, /^deno\.jsonc?$/, /^npm-shrinkwrap\.json$/,
  /^pipfile(?:\.lock)?$/, /^poetry\.lock$/, /^requirements[^/]*\.txt$/, /^pyproject\.toml$/, /^setup\.(?:py|cfg)$/,
  /^go\.(?:mod|sum|work)$/, /^package(?:-lock)?\.json$/, /^yarn\.lock$/, /^pnpm-lock\.yaml$/, /^bun\.lockb?$/,
  /^[^/]+\.(?:csproj|fsproj|vbproj|sln|gemspec)$/, /^packages\.config$/, /^nuget\.config$/, /^directory\.build\.(?:props|targets)$/,
];
/** Archivos que una herramienta de construcción o un editor ejecuta sin que nadie los lance. */
const NOMBRES_CONFIGURACION = [
  /^makefile$/, /^gnumakefile$/, /^justfile$/, /^rakefile$/, /^taskfile\.ya?ml$/, /^cmakelists\.txt$/, /^vagrantfile$/,
  /^dockerfile/, /^docker-compose.*\.ya?ml$/, /^compose\.ya?ml$/, /^procfile$/, /^tsconfig.*\.json$/, /^gruntfile/, /^gulpfile/,
  /^\.[^/]+$/,
  /^[^/]+\.(?:config|conf)\.[cm]?[jt]s$/, /^conftest\.py$/, /^sitecustomize\.py$/, /^pytest\.ini$/, /^tox\.ini$/,
  /^claude\.md$/, /^agents\.md$/,
];
/** Extensiones de scripts y binarios que se ejecutan solos. */
const EXTENSIONES_EJECUTABLES = /\.(?:sh|bash|zsh|fish|ps1|psm1|psd1|bat|cmd|vbs|vbe|wsf|command|run|jar|exe|dll|so|dylib|com|scr|msi)$/;
/** Carpetas cuyo contenido son scripts de proyecto (se ejecutan con `npm run`, `make`, hooks…). */
const CARPETAS_DE_SCRIPTS = new Set(['scripts', 'script', 'bin', 'tools', 'hooks', 'githooks', 'devcontainer']);
const EXTENSIONES_DE_SCRIPT = /\.(?:[cm]?js|ts|py|rb|pl|php|lua|go|rs)$/;

/**
 * ¿Es un manifiesto o un archivo de configuración o de ejecución que no se propone sin aprobación
 * expresa por archivo? Sin red ni disco.
 * @param {string} ruta  relativa y con «/»
 * @returns {null | 'dependencias' | 'configuracion'}
 */
export function clasificarManifiesto(ruta) {
  if (typeof ruta !== 'string') return null;
  const segmentos = ruta.normalize('NFKC').toLowerCase().split('/');
  const nombre = segmentos[segmentos.length - 1];
  if (NOMBRES_DEPENDENCIAS.some((r) => r.test(nombre))) return 'dependencias';
  if (NOMBRES_CONFIGURACION.some((r) => r.test(nombre))) return 'configuracion';
  if (EXTENSIONES_EJECUTABLES.test(nombre)) return 'configuracion';
  const carpetas = segmentos.slice(0, -1);
  if (carpetas.some((s) => s.startsWith('.'))) return 'configuracion';
  if (carpetas.some((s) => CARPETAS_DE_SCRIPTS.has(s)) && EXTENSIONES_DE_SCRIPT.test(nombre)) return 'configuracion';
  return null;
}
