// @ts-check
/**
 * evidencia/guardian-reglas.js — reglas del guardián PreToolUse como módulo puro y autónomo
 *
 * Spec 2026-11-06-guardian-endurecido (informe SEGURIDAD-CIBER C-01, C-02, C-04, C-06).
 *
 * Antes el guardián comparaba el texto del comando con regex: `rm -r -f /`, `rm -fr /`, `git push origin +main`
 * o `sed -i … .env` pasaban. Aquí el comando se trocea en argv (respetando comillas, `;`, `&&`, `||`, `|`,
 * `$(…)`, comillas invertidas y `bash -c '…'`) y se razona sobre el verbo, las banderas normalizadas y los
 * objetivos. Es una red de seguridad, NO un límite: la defensa principal es `permissions.deny` y el sandbox.
 *
 * Sin imports a propósito: el instalador copia este archivo tal cual a `.claude/hooks/shared/`
 * (igual que `protegidos.js`), así que no puede depender del resto del paquete.
 */

const MAX_TEXTO = 20000;
const MAX_PROFUNDIDAD = 4;

/**
 * @typedef {{ argv: string[], redirs: string[] }} Segmento
 */

/**
 * Trocea un comando en segmentos {argv, redirs}. No lanza nunca: lo que no entiende lo deja como palabras.
 * @param {string} cmd
 * @param {number} [profundidad]
 * @returns {Segmento[]}
 */
export function segmentar(cmd, profundidad = 0) {
  const texto = String(cmd ?? '').slice(0, MAX_TEXTO);
  /** @type {Segmento[]} */
  const segmentos = [];
  /** @type {string[]} */
  let argv = [];
  /** @type {string[]} */
  let redirs = [];
  let palabra = '';
  let hayPalabra = false;
  /** @type {string|null} */
  let comilla = null;
  let esperaRedir = false;

  const cerrarPalabra = () => {
    if (!hayPalabra) return;
    if (esperaRedir) { redirs.push(palabra); esperaRedir = false; } else argv.push(palabra);
    palabra = ''; hayPalabra = false;
  };
  const cerrarSegmento = () => {
    cerrarPalabra();
    if (argv.length > 0 || redirs.length > 0) segmentos.push({ argv, redirs });
    argv = []; redirs = []; esperaRedir = false;
  };

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comilla) {
      if (c === comilla) comilla = null;
      else if (c === '\\' && comilla === '"' && i + 1 < texto.length) { palabra += texto[++i]; }
      else palabra += c;
      continue;
    }
    if (c === '"' || c === "'") { comilla = c; hayPalabra = true; continue; }
    if (c === '#' && !hayPalabra) { while (i < texto.length && texto[i] !== '\n') i++; i--; continue; }   // comentario: no es parte del comando
    if (c === '\n' || c === ';' || c === '(' || c === ')' || c === '`') { cerrarSegmento(); continue; }
    if (c === '&' || c === '|') {
      if (texto[i + 1] === c) i++;
      // `>&` y `2>&1` no separan: el & va pegado a una redirección
      if (c === '&' && (texto[i - 1] === '>' || texto[i + 1] === '>')) { palabra += c; hayPalabra = true; continue; }
      cerrarSegmento(); continue;
    }
    if (c === '$' && texto[i + 1] === '(') { cerrarSegmento(); i++; continue; }
    if (c === '>' || c === '<') {
      // `2>` / `1>`: el dígito pegado es el descriptor, no una palabra
      if (hayPalabra && /^\d$/.test(palabra)) { palabra = ''; hayPalabra = false; }
      else cerrarPalabra();
      while (texto[i + 1] === '>' || texto[i + 1] === '|') i++;
      if (c === '>') {
        if (texto[i + 1] === '&') { i++; while (/[\d-]/.test(texto[i + 1] ?? '')) i++; continue; }   // 2>&1
        esperaRedir = true;
      } else esperaRedir = false;
      continue;
    }
    if (/\s/.test(c)) { cerrarPalabra(); continue; }
    // La barra invertida NO escapa fuera de comillas: en Windows es separador de ruta (`C:\ -Recurse` son dos palabras)
    palabra += c; hayPalabra = true;
  }
  cerrarSegmento();

  // Sustituciones dentro de comillas dobles: también se ejecutan
  if (profundidad < MAX_PROFUNDIDAD) {
    for (const m of texto.matchAll(/\$\(([^()]*)\)|`([^`]*)`/g)) {
      const dentro = m[1] ?? m[2] ?? '';
      if (dentro.trim() !== '') segmentos.push(...segmentar(dentro, profundidad + 1));
    }
  }
  return segmentos;
}

// ── Utilidades de rutas ──────────────────────────────────────────────────────────────────────

/** @param {string} t */
const posix = (t) => String(t).replace(/\\/g, '/');

/**
 * ¿Es un archivo con secretos (.env, salvo los de ejemplo) o la clave de estado de usuario?
 * @param {string} ruta
 */
export function esSecreto(ruta) {
  const p = posix(ruta);
  const nombre = p.split('/').filter(Boolean).pop() ?? '';
  const limpio = nombre.replace(/:.*$/s, '').replace(/[ .]+$/, '') || nombre;
  if (/^\.env(\..*)?$/i.test(limpio) && !/^\.env\.(example|template|sample)$/i.test(limpio)) return true;
  // Clave HMAC de aprobaciones y evidencia (core/estado-usuario.js)
  if (/(^|\/)\.?fragua\/.*(^|\/)clave$/i.test(p)) return true;
  return false;
}

/**
 * Rutas que, si el agente las reescribe, apagan el propio guardián: su registro, sus archivos, su nivel y .git.
 * @param {string} rutaRelativa  relativa al proyecto
 */
export function esRutaCriticaDelGuardian(rutaRelativa) {
  const segs = posix(rutaRelativa).toLowerCase().split('/')
    .map((s) => s.replace(/:.*$/s, '').replace(/[ .]+$/, '') || s)
    .filter((s) => s !== '' && s !== '.');
  if (segs.length === 0) return false;
  if (segs.includes('.git')) return true;
  if (segs[0] === 'claude-hooks') return true;
  if (segs[0] === '.claude' && segs[1] !== undefined && (segs[1].startsWith('settings') || segs[1] === 'hooks')) return true;
  // El nivel del CircuitBreaker y el registro firmado de aprobaciones: un agente no tiene motivo para escribirlos
  if (segs.length === 2 && segs[0] === '.sdd' && (segs[1] === 'execution-level.json' || segs[1] === 'aprobaciones.jsonl')) return true;
  return false;
}

/** Nombres cortos 8.3 (`TSCONF~1.JSO`): apuntan a otro archivo del que parecen. */
const esNombreCorto = (/** @type {string} */ ruta) => posix(ruta).split('/').some((s) => /~\d/.test(s));

/**
 * @param {string} ruta
 * @param {(rutaTal: string) => string} aRelativa
 * @param {(ruta: string) => boolean} [protegidaConfig]  decide si es configuración de calidad protegida (protegidos.js)
 */
export function motivoDestinoProtegido(ruta, aRelativa, protegidaConfig) {
  if (typeof ruta !== 'string' || ruta === '' || ruta.startsWith('&') || ruta === '/dev/null' || ruta.toLowerCase() === 'nul' || ruta === '$null') return null;
  const rel = aRelativa(ruta);
  if (esSecreto(rel) || esSecreto(ruta)) return 'un archivo de secretos';
  if (esRutaCriticaDelGuardian(rel)) return 'la configuración o los archivos del propio guardián';
  if (esNombreCorto(ruta)) return 'un nombre corto 8.3 que puede apuntar a un archivo protegido';
  if (protegidaConfig && protegidaConfig(rel)) return 'la configuración protegida de calidad';
  return null;
}

// ── Análisis por verbo ──────────────────────────────────────────────────────────────────────

const ENVOLTORIOS = new Set(['sudo', 'doas', 'command', 'builtin', 'nohup', 'time', 'exec', 'env', 'nice', 'xargs', 'call', 'start', 'cmd.exe']);
const SHELLS_C = new Set(['bash', 'sh', 'zsh', 'dash', 'ksh', 'powershell', 'pwsh', 'cmd']);
const INTERPRETES = new Set(['node', 'nodejs', 'python', 'python3', 'py', 'ruby', 'perl', 'php', 'deno', 'bun', 'osascript', ...SHELLS_C]);
const LECTORES = new Set(['cat', 'type', 'less', 'more', 'head', 'tail', 'bat', 'nl', 'strings', 'xxd', 'od', 'base64', 'grep', 'egrep', 'fgrep', 'rg', 'ag', 'awk', 'sed', 'sort', 'cut', 'uniq', 'tac', 'get-content', 'gc', 'select-string', 'sls', 'cp', 'copy', 'copy-item', 'cpi', 'scp', 'curl', 'wget', 'source', '.']);
const ESCRITORES_TODOS = new Set(['tee', 'mv', 'move', 'move-item', 'mi', 'ren', 'rename-item', 'rni', 'rm', 'del', 'erase', 'ri', 'remove-item', 'rmdir', 'rd', 'touch', 'truncate', 'ln', 'install', 'shred', 'unlink',
  'set-content', 'sc', 'add-content', 'ac', 'out-file', 'clear-content', 'clc', 'new-item', 'ni', 'chmod', 'chown', 'mkdir', 'md', 'chattr', 'set-itemproperty']);
const ESCRITORES_ULTIMO = new Set(['cp', 'copy', 'copy-item', 'cpi', 'curl', 'wget']);
const MARCAS_ESCRITURA = /writeFile|appendFile|createWriteStream|copyFile|rename|unlink|rmSync|\bopen\s*\(|\.write\(|Set-Content|Add-Content|Out-File|\bcopy\b|>>?|\bsed\b|\btee\b|\bmv\b|\bcp\b|\brm\b/i;

/** @param {string} v */
const normalizarVerbo = (v) => posix(v).split('/').pop()?.toLowerCase().replace(/\.(exe|cmd|bat|ps1)$/, '') ?? '';

/** Banderas cortas (`-rf`) y largas (`--force`) de una lista de tokens; los objetivos son lo que no es bandera. */
function banderas(/** @type {string[]} */ args) {
  const cortas = new Set(); const largas = new Set(); const objetivos = [];
  let finOpciones = false;
  for (const a of args) {
    if (!finOpciones && a === '--') { finOpciones = true; continue; }
    if (!finOpciones && a.startsWith('--') && a.length > 2) largas.add(a.slice(2).split('=')[0].toLowerCase());
    else if (!finOpciones && /^-[A-Za-z]+/.test(a)) for (const l of a.slice(1)) cortas.add(l);
    else objetivos.push(a);
  }
  return { cortas, largas, objetivos };
}

/** Objetivos de borrado que arrasan: raíz, casa, cwd, comodines, discos, carpetas del sistema. */
function objetivoPeligroso(/** @type {string} */ t) {
  const p = posix(t).trim();
  if (['/', '/*', '~', '~/', '~/*', '*', '.', './', './*', '..', '../', '../*', '.*', '$HOME', '$HOME/', '${HOME}', '%USERPROFILE%', '%HOMEPATH%', '$env:USERPROFILE', '\\', '/.'].includes(p)) return true;
  if (/^[A-Za-z]:\/?\*?$/.test(p)) return true;
  if (/^\/(etc|usr|bin|sbin|boot|lib|lib64|var|home|root|opt|sys|proc|dev|windows)(\/|$)/i.test(p)) return true;
  if (/^[A-Za-z]:\/(windows|program files|users|programdata)(\/|$)/i.test(p)) return true;
  return false;
}

const RECURSE_PS = /^-r(e(c(u(r(se?)?)?)?)?)?$/i;

/**
 * @param {string[]} argv  ya sin envoltorios
 * @param {Segmento} seg
 * @param {{ aRelativa: (t: string) => string, protegidaConfig?: (r: string) => boolean }} ctx
 * @returns {string|null}
 */
function evaluarVerbo(argv, seg, ctx) {
  const verbo = normalizarVerbo(argv[0] ?? '');
  const args = argv.slice(1);
  const { cortas, largas, objetivos } = banderas(args);

  // ── Borrado masivo ──
  if (verbo === 'rm' || verbo === 'del' || verbo === 'erase' || verbo === 'ri' || verbo === 'remove-item' || verbo === 'rmdir' || verbo === 'rd') {
    const recursivo = cortas.has('r') || cortas.has('R') || largas.has('recursive')
      || args.some((a) => RECURSE_PS.test(a) || /^\/s$/i.test(a));
    if (recursivo && objetivos.some(objetivoPeligroso)) return 'borrado recursivo de la raíz, la carpeta personal, el directorio actual o un disco';
  }
  if (verbo === 'find' && args.includes('-delete') && !args.some((a) => /^-(i?name|i?path|i?regex|type|newer|mtime|mmin|empty|size|user|perm)$/.test(a))) {
    return 'find -delete sin filtros';
  }

  // ── Git destructivo ──
  if (verbo === 'git') {
    let i = 0;
    while (i < args.length && args[i].startsWith('-')) { i += (args[i] === '-c' || args[i] === '-C' || args[i] === '--git-dir' || args[i] === '--work-tree') ? 2 : 1; }
    const sub = args[i]; const resto = args.slice(i + 1);
    const f = banderas(resto);
    if (sub === 'push') {
      if (f.largas.has('force') || f.largas.has('delete') || f.largas.has('mirror') || f.largas.has('prune') || f.cortas.has('f') || f.cortas.has('d')) return 'git push forzado, de borrado o espejo';
      if (f.objetivos.some((o) => /^\+./.test(o) || /^:[^:\s]/.test(o))) return 'git push con refspec forzado (+ref) o de borrado (:ref)';
    }
    if (sub === 'reset' && f.largas.has('hard')) return 'git reset --hard';
    if (sub === 'clean' && (f.cortas.has('f') || f.largas.has('force')) && (f.cortas.has('d') || f.cortas.has('x') || f.cortas.has('X'))) return 'git clean que borra archivos sin versionar';
    if (sub === 'reflog' && f.objetivos[0] === 'expire') return 'git reflog expire';
    if (sub === 'gc' && resto.some((a) => /^--prune=now$/.test(a))) return 'git gc --prune=now';
  }
  if (verbo === 'chmod' && objetivos.some((o) => /^(0?777|a\+rwx)$/.test(o))) return 'chmod 777';

  // ── Escritura sobre archivos protegidos ──
  for (const r of seg.redirs) {
    const p = motivoDestinoProtegido(r, ctx.aRelativa, ctx.protegidaConfig);
    if (p) return `redirección hacia ${p}`;
  }
  /** @type {string[]} */
  let destinos = [];
  const sedInPlace = (verbo === 'sed' || verbo === 'perl' || verbo === 'ruby') && (cortas.has('i') || largas.has('in-place'));
  if (ESCRITORES_TODOS.has(verbo) || sedInPlace) destinos = objetivos;
  else if (ESCRITORES_ULTIMO.has(verbo)) destinos = objetivos.length > 0 ? [objetivos[objetivos.length - 1]] : [];
  if (verbo === 'dd') destinos = args.filter((a) => a.startsWith('of=')).map((a) => a.slice(3));
  for (const d of destinos) {
    const p = motivoDestinoProtegido(d, ctx.aRelativa, ctx.protegidaConfig);
    if (p) return `escritura sobre ${p}`;
  }
  // PowerShell: el valor de -Path/-FilePath/-LiteralPath ya está entre los objetivos; -Value no se mira

  // ── Lectura de secretos ──
  if (LECTORES.has(verbo)) {
    for (const o of objetivos) if (esSecreto(o) || esSecreto(ctx.aRelativa(o))) return 'lectura de un archivo de secretos';
  }

  // ── Intérpretes: el código va dentro de una cadena ──
  if (INTERPRETES.has(verbo)) {
    for (const a of args) {
      if (a.length < 3) continue;
      const escribe = MARCAS_ESCRITURA.test(a);
      for (const trozo of a.split(/[\s'"`;(),=]+/)) {
        if (trozo === '' ) continue;
        if (esSecreto(trozo)) return 'un intérprete que toca un archivo de secretos';
        if (escribe) { const p = motivoDestinoProtegido(trozo, ctx.aRelativa, ctx.protegidaConfig); if (p) return `un intérprete que escribe sobre ${p}`; }
      }
    }
  }
  return null;
}

/**
 * Quita envoltorios (sudo, env X=1, xargs…) y expande `bash -c '…'` en comandos aparte.
 * @param {string[]} argv
 * @param {number} profundidad
 * @returns {{ argv: string[], internos: Segmento[] }}
 */
function desenvolver(argv, profundidad) {
  let a = [...argv];
  /** @type {Segmento[]} */
  const internos = [];
  for (let vueltas = 0; vueltas < 8 && a.length > 0; vueltas++) {
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(a[0])) { a = a.slice(1); continue; }
    const v = normalizarVerbo(a[0]);
    if (ENVOLTORIOS.has(v)) { a = a.slice(1); while (a.length > 0 && a[0].startsWith('-')) a = a.slice(1); continue; }
    break;
  }
  const v = normalizarVerbo(a[0] ?? '');
  if (SHELLS_C.has(v) && profundidad < MAX_PROFUNDIDAD) {
    for (let i = 1; i < a.length; i++) {
      if (/^(-[a-z]*c|-command|\/c|\/k)$/i.test(a[i]) && a[i + 1] !== undefined) { internos.push(...segmentar(a.slice(i + 1).join(' '), profundidad + 1)); break; }
    }
  }
  return { argv: a, internos };
}

/**
 * Evalúa un comando de shell. Devuelve el motivo si hay que bloquearlo, o null.
 * @param {string} cmd
 * @param {{ aRelativa?: (rutaTal: string) => string, protegidaConfig?: (rutaRelativa: string) => boolean }} [opciones]
 * @returns {{ motivo: string, segmento: string } | null}
 */
export function evaluarComando(cmd, opciones = {}) {
  const ctx = { aRelativa: opciones.aRelativa ?? posix, protegidaConfig: opciones.protegidaConfig };
  /** @param {Segmento[]} segs @param {number} prof @returns {{motivo:string, segmento:string}|null} */
  const recorrer = (segs, prof) => {
    for (const seg of segs) {
      const { argv, internos } = desenvolver(seg.argv, prof);
      if (argv.length > 0 || seg.redirs.length > 0) {
        const motivo = evaluarVerbo(argv.length > 0 ? argv : [''], { argv, redirs: seg.redirs }, ctx);
        if (motivo) return { motivo, segmento: [...seg.argv, ...seg.redirs.map((r) => '> ' + r)].join(' ').slice(0, 120) };
      }
      if (internos.length > 0) { const r = recorrer(internos, prof + 1); if (r) return r; }
    }
    return null;
  };
  return recorrer(segmentar(cmd), 0);
}

const VERBOS_GIT_QUE_ESCRIBEN = new Set(['commit', 'add', 'apply', 'checkout', 'switch', 'restore', 'reset', 'merge', 'rebase', 'push', 'pull', 'stash', 'rm', 'mv', 'clean', 'cherry-pick', 'revert', 'tag', 'am', 'init', 'clone']);

/**
 * ¿Escribe algo este comando? Lo usa el guardián para los agentes que solo pueden leer (C-06).
 * @param {string} cmd
 * @returns {boolean}
 */
export function escribeAlgo(cmd) {
  /** @param {Segmento[]} segs @param {number} prof @returns {boolean} */
  const recorrer = (segs, prof) => {
    for (const seg of segs) {
      if (seg.redirs.some((r) => r !== '/dev/null' && r.toLowerCase() !== 'nul' && r !== '$null' && !r.startsWith('&'))) return true;
      const { argv, internos } = desenvolver(seg.argv, prof);
      const verbo = normalizarVerbo(argv[0] ?? '');
      const { cortas, largas } = banderas(argv.slice(1));
      if (ESCRITORES_TODOS.has(verbo) || ESCRITORES_ULTIMO.has(verbo) && verbo !== 'curl' && verbo !== 'wget') return true;
      if ((verbo === 'sed' || verbo === 'perl' || verbo === 'ruby') && (cortas.has('i') || largas.has('in-place'))) return true;
      if (verbo === 'dd' && argv.some((a) => a.startsWith('of='))) return true;
      if (verbo === 'git') {
        let i = 1; while (i < argv.length && argv[i].startsWith('-')) i += (argv[i] === '-c' || argv[i] === '-C') ? 2 : 1;
        if (VERBOS_GIT_QUE_ESCRIBEN.has(argv[i])) return true;
      }
      if (INTERPRETES.has(verbo) && !SHELLS_C.has(verbo) && argv.slice(1).some((a) => a.length > 3 && MARCAS_ESCRITURA.test(a))) return true;
      if (internos.length > 0 && recorrer(internos, prof + 1)) return true;
    }
    return false;
  };
  return recorrer(segmentar(cmd), 0);
}
