/**
 * Cadena de evidencia (spec 2026-10-14-puertas-de-calidad-y-evidencia, fase A).
 * Cada prueba usa un proyecto temporal y un FORGE_HOME temporal: nunca se toca el perfil real.
 */
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { registrarVerificacion } from '../core/verificar/registro.js';
import { crearResultado } from '../core/verificar/resultado.js';
import { comprobarEvidencia, hashDeInforme, texto } from '../core/evidencia/cadena.js';
import { claveLocal, directorioDeEstado, rutaDeEstado } from '../core/estado-usuario.js';

/** @type {string[]} */ const temporales = [];
const temp = (/** @type {string} */ p) => { const d = realpathSync(mkdtempSync(join(tmpdir(), `evid-${p}-`))); temporales.push(d); return d; };
after(() => { for (const d of temporales) { try { rmSync(d, { recursive: true, force: true }); } catch { /* ya no está */ } } });

const proyecto = () => temp('proy');
const entorno = () => ({ FORGE_HOME: temp('home') });
const reg = (/** @type {string} */ dir, /** @type {any} */ env, /** @type {any} */ extra = {}) => {
  const r = registrarVerificacion(dir, crearResultado({ veredicto: 'pasa', comando: 'npm test', lenguaje: 'node', ...extra }), { env });
  assert.equal(r.ok, true, JSON.stringify(r));
  return /** @type {any} */ (r);
};
const carpeta = (/** @type {string} */ dir) => join(dir, '.sdd', 'verificaciones');
const archivo = (/** @type {string} */ dir, /** @type {string} */ id) => join(carpeta(dir), `${id}.json`);
const leer = (/** @type {string} */ dir, /** @type {string} */ id) => JSON.parse(readFileSync(archivo(dir, id), 'utf8'));
const guardar = (/** @type {string} */ dir, /** @type {string} */ id, /** @type {any} */ j) => writeFileSync(archivo(dir, id), JSON.stringify(j, null, 2));
const tres = (/** @type {string} */ dir, /** @type {any} */ env) => [reg(dir, env).id, reg(dir, env).id, reg(dir, env).id];
const tipos = (/** @type {any} */ r) => r.errores.map((e) => e.tipo);

describe('cadena íntegra', () => {
  test('tres informes: encadenados, firmados, la cabeza guardada coincide', () => {
    const dir = proyecto(); const env = entorno();
    const [a, b, c] = tres(dir, env);
    const ja = leer(dir, a); const jb = leer(dir, b); const jc = leer(dir, c);
    assert.equal(ja.evidencia.anterior, null);
    assert.equal(jb.evidencia.anterior, ja.evidencia.sha256);
    assert.equal(jc.evidencia.anterior, jb.evidencia.sha256);
    assert.equal(ja.formato, 1, 'el formato del resultado no cambia');
    assert.equal(ja.evidencia.sha256, hashDeInforme(ja));
    assert.match(ja.evidencia.firma, /^[0-9a-f]{64}$/);
    const r = comprobarEvidencia(dir, { env });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.equal(r.nivel, 'firmada');
    assert.equal(r.informes, 3);
    assert.equal(r.cabeza, jc.evidencia.sha256);
    assert.equal(r.cabezaGuardada, 'coincide');
  });

  test('el bloque lleva cada campo o su null con motivo, y el aprobador es null', () => {
    const dir = proyecto(); const env = entorno();
    const j = leer(dir, reg(dir, env).id);
    const ev = j.evidencia;
    for (const k of ['version', 'fragua', 'spec', 'commit', 'pruebas', 'imagen', 'modelos', 'aprobador', 'omitidos', 'firmado', 'anterior', 'sha256', 'firma']) assert.ok(k in ev, k);
    assert.equal(ev.aprobador, null);
    assert.match(ev.omitidos.aprobador, /no registra/);
    assert.equal(ev.spec, null); assert.ok(ev.omitidos.spec);
    assert.equal(ev.commit, null); assert.ok(ev.omitidos.commit);
    assert.equal(ev.pruebas, null); assert.ok(ev.omitidos.pruebas);
    assert.equal(ev.imagen, null); assert.ok(ev.omitidos.imagen);
    assert.deepEqual(ev.modelos, []); assert.match(ev.omitidos.modelos, /sin modelo/);
    assert.equal(ev.firmado, true);
    assert.match(ev.fragua, /^\d+\.\d+\.\d+/);
  });

  test('spec, pruebas y commit se leen del proyecto (git solo con rev-parse)', () => {
    const dir = proyecto(); const env = entorno();
    mkdirSync(join(dir, '.sdd', 'especificaciones', 'mi-spec'), { recursive: true });
    writeFileSync(join(dir, '.sdd', 'especificaciones', 'mi-spec', 'spec.md'), '# spec\n');
    writeFileSync(join(dir, '.sdd', 'estado.json'), JSON.stringify({ spec_activa: 'mi-spec', spec_aprobado: true, ultima_actualizacion: '2026-10-17' }));
    mkdirSync(join(dir, 'tests'), { recursive: true });
    writeFileSync(join(dir, 'tests', 'a.test.js'), 'x');
    const ev1 = leer(dir, reg(dir, env).id).evidencia;
    assert.equal(ev1.spec.id, 'mi-spec');
    assert.equal(ev1.spec.aprobada, true);
    assert.equal(ev1.spec.sha256.length, 64);
    assert.equal(ev1.pruebas.archivos, 1);
    writeFileSync(join(dir, 'tests', 'a.test.js'), 'y');
    const ev2 = leer(dir, reg(dir, env).id).evidencia;
    assert.notEqual(ev1.pruebas.sha256, ev2.pruebas.sha256, 'cambiar una prueba cambia el hash');
    let git = true;
    try {
      execFileSync('git', ['init', '-q'], { cwd: dir, stdio: 'ignore' });
      execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'x'], { cwd: dir, stdio: 'ignore' });
    } catch { git = false; }
    if (git) {
      const esperado = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
      assert.equal(leer(dir, reg(dir, env).id).evidencia.commit, esperado);
    }
  });

  test('una spec_activa hostil (con ..) no se sigue', () => {
    const dir = proyecto(); const env = entorno();
    mkdirSync(join(dir, '.sdd'), { recursive: true });
    writeFileSync(join(dir, '.sdd', 'estado.json'), JSON.stringify({ spec_activa: '../../etc', spec_aprobado: true }));
    const ev = leer(dir, reg(dir, env).id).evidencia;
    assert.equal(ev.spec, null);
    assert.match(ev.omitidos.spec, /spec activa válida/);
  });

  test('los modelos se sanean: sin texto enorme ni caracteres de control', () => {
    const dir = proyecto(); const env = entorno();
    const r = registrarVerificacion(dir, crearResultado({ veredicto: 'pasa' }), {
      env, modelos: [{ rol: 'coder\n', agente: 'a'.repeat(100000), proveedor: 'p', modelo: 'm', llamadas: 3, prompt: 'SECRETO' }, null, 5],
    });
    const m = leer(dir, /** @type {any} */ (r).id).evidencia.modelos;
    assert.equal(m[0].rol, 'coder?');
    assert.equal(m[0].agente.length, 128);
    assert.equal('prompt' in m[0], false);
    assert.equal(JSON.stringify(m).includes('SECRETO'), false);
  });
});

describe('manipulación', () => {
  test('alterar un campo de un informe intermedio', () => {
    const dir = proyecto(); const env = entorno();
    const [, b] = tres(dir, env);
    const j = leer(dir, b); j.veredicto = 'falla'; guardar(dir, b, j);
    const r = comprobarEvidencia(dir, { env });
    assert.equal(r.ok, false);
    assert.equal(r.nivel, 'rota');
    assert.ok(tipos(r).includes('alterado'));
    assert.equal(r.rotura?.id, b, 'dice dónde se rompe');
  });

  test('borrar un informe del medio', () => {
    const dir = proyecto(); const env = entorno();
    const [, b, c] = tres(dir, env);
    rmSync(archivo(dir, b));
    const r = comprobarEvidencia(dir, { env });
    assert.equal(r.ok, false);
    assert.ok(tipos(r).includes('borrado'));
    assert.equal(r.errores.find((e) => e.tipo === 'borrado')?.id, c);
  });

  test('reordenar: intercambiar el contenido de dos archivos', () => {
    const dir = proyecto(); const env = entorno();
    const [, b, c] = tres(dir, env);
    const jb = leer(dir, b); const jc = leer(dir, c);
    guardar(dir, b, jc); guardar(dir, c, jb);
    const r = comprobarEvidencia(dir, { env });
    assert.equal(r.ok, false);
    assert.ok(tipos(r).includes('id'), JSON.stringify(r.errores));
  });

  test('reordenar de verdad: cambiar los anterior y recalcular los hash falla por la firma', () => {
    const dir = proyecto(); const env = entorno();
    const [a, b, c] = tres(dir, env);
    const ja = leer(dir, a); const jb = leer(dir, b); const jc = leer(dir, c);
    // orden nuevo: a, c, b
    jc.evidencia.anterior = ja.evidencia.sha256; jc.evidencia.sha256 = hashDeInforme(jc);
    jb.evidencia.anterior = jc.evidencia.sha256; jb.evidencia.sha256 = hashDeInforme(jb);
    guardar(dir, b, jb); guardar(dir, c, jc);
    const r = comprobarEvidencia(dir, { env });
    assert.equal(r.ok, false);
    assert.ok(tipos(r).includes('firma'), 'sin la clave no se puede refirmar');
  });

  test('truncar los últimos informes: solo se detecta con la cabeza guardada', () => {
    const dir = proyecto(); const env = entorno();
    const [, b, c] = tres(dir, env);
    rmSync(archivo(dir, c));
    // CON cabeza guardada: detectado
    const con = comprobarEvidencia(dir, { env });
    assert.equal(con.ok, false);
    assert.ok(tipos(con).includes('truncada'), JSON.stringify(con.errores));
    assert.equal(con.cabezaGuardada, 'no_coincide');
    // SIN cabeza guardada (otra máquina, estado borrado): la cadena restante es válida. Es el límite.
    rmSync(join(rutaDeEstado(dir, env), 'cadena-cabeza.json'));
    const sin = comprobarEvidencia(dir, { env });
    assert.equal(sin.ok, true, 'sin la cabeza el truncado NO se detecta');
    assert.equal(sin.cabezaGuardada, 'ausente');
    assert.ok(sin.avisos.some((a) => /NO se puede detectar/.test(a)), 'y lo dice');
    assert.equal(sin.cabeza, leer(dir, b).evidencia.sha256);
  });

  test('borrar todos los informes con cabeza guardada se detecta', () => {
    const dir = proyecto(); const env = entorno();
    for (const id of tres(dir, env)) rmSync(archivo(dir, id));
    const r = comprobarEvidencia(dir, { env });
    assert.equal(r.ok, false);
    assert.ok(tipos(r).includes('truncada'));
  });

  test('cabeza manipulada (firma inválida) es error', () => {
    const dir = proyecto(); const env = entorno();
    tres(dir, env);
    const ruta = join(rutaDeEstado(dir, env), 'cadena-cabeza.json');
    const h = JSON.parse(readFileSync(ruta, 'utf8')); h.n = 99; writeFileSync(ruta, JSON.stringify(h));
    const r = comprobarEvidencia(dir, { env });
    assert.equal(r.ok, false);
    assert.equal(r.cabezaGuardada, 'invalida');
  });

  test('bifurcación: dos informes con el mismo anterior es error, no dos válidos', () => {
    const dir = proyecto(); const env = entorno();
    const [a] = tres(dir, env);
    const ja = leer(dir, a);
    const clon = JSON.parse(JSON.stringify(ja));
    clon.id = `${ja.id}x`; // otro id, mismo anterior null
    clon.evidencia.sha256 = hashDeInforme(clon);
    guardar(dir, clon.id, clon);
    const r = comprobarEvidencia(dir, { env });
    assert.equal(r.ok, false);
    assert.ok(tipos(r).some((t) => t === 'bifurcada' || t === 'sin_firma' || t === 'firma'));
  });
});

describe('firma y clave', () => {
  test('sin clave (estado de usuario inválido): no se firma, se declara, y la cadena sigue encadenada', () => {
    const dir = proyecto();
    const env = { FORGE_HOME: join(dir, 'estado-dentro') };   // dentro del proyecto: rutaDeEstado lo rechaza
    const [a, b] = [reg(dir, env).id, reg(dir, env).id];
    const ja = leer(dir, a);
    assert.equal(ja.evidencia.firmado, false);
    assert.equal(ja.evidencia.firma, null);
    assert.match(ja.evidencia.omitidos.firma, /sin firma/);
    assert.equal(leer(dir, b).evidencia.anterior, ja.evidencia.sha256);
    assert.equal(existsSync(join(dir, 'estado-dentro')), false, 'el proyecto no obtiene clave ni estado');
    const r = comprobarEvidencia(dir, { env });
    assert.equal(r.ok, true);
    assert.equal(r.nivel, 'encadenada_sin_firma');
    assert.ok(r.avisos.some((x) => /NO firmada/.test(x)));
  });

  test('comprobar no crea la clave ni el estado', () => {
    const dir = proyecto();
    // cadena creada sin clave, luego se comprueba con un FORGE_HOME virgen
    reg(dir, { FORGE_HOME: join(dir, 'x') });
    const home = join(temp('virgen'), 'nuevo');
    const r = comprobarEvidencia(dir, { env: { FORGE_HOME: home } });
    assert.equal(r.ok, true);
    assert.equal(existsSync(home), false);
  });

  test('una firma de otra máquina no vale', () => {
    const dir = proyecto();
    const envA = entorno(); const envB = entorno();
    tres(dir, envA);
    claveLocal(directorioDeEstado(dir, envB));            // la máquina B tiene SU clave
    const r = comprobarEvidencia(dir, { env: envB });
    assert.equal(r.ok, false);
    assert.ok(tipos(r).includes('firma'));
  });

  test('sin la clave, las firmas no se pueden comprobar y se dice', () => {
    const dir = proyecto(); const envA = entorno();
    tres(dir, envA);
    const r = comprobarEvidencia(dir, { env: entorno() });
    assert.equal(r.ok, true);
    assert.equal(r.nivel, 'firmas_no_verificables');
    assert.ok(r.avisos.some((x) => /no tiene la clave/.test(x)));
  });

  test('quitar las firmas y recalcular los hash falla donde hay clave', () => {
    const dir = proyecto(); const env = entorno();
    const ids = tres(dir, env);
    let ant = null;
    for (const id of ids) {
      const j = leer(dir, id); j.evidencia.firma = null; j.evidencia.firmado = false; j.evidencia.anterior = ant;
      j.evidencia.sha256 = hashDeInforme(j); ant = j.evidencia.sha256; guardar(dir, id, j);
    }
    const r = comprobarEvidencia(dir, { env });
    assert.equal(r.ok, false);
    assert.ok(tipos(r).includes('sin_firma'));
  });

  test('el proyecto no puede aportar su propia clave ni su propia cabeza', () => {
    const dir = proyecto(); const env = entorno();
    tres(dir, env);
    // El atacante tiene el repositorio: reconstruye la cadena con SU clave y deja su clave y su cabeza en el árbol
    const falsaHome = temp('falsa');
    const claveFalsa = claveLocal(directorioDeEstado(dir, { FORGE_HOME: falsaHome }));
    mkdirSync(join(dir, '.sdd'), { recursive: true });
    writeFileSync(join(dir, '.sdd', 'clave'), `${claveFalsa.toString('hex')}\n`);
    writeFileSync(join(dir, 'clave'), `${claveFalsa.toString('hex')}\n`);
    for (const f of readdirSync(carpeta(dir))) rmSync(join(carpeta(dir), f));
    const envFalso = { FORGE_HOME: falsaHome };
    const nuevos = [reg(dir, envFalso).id, reg(dir, envFalso).id];
    writeFileSync(join(dir, '.sdd', 'cadena-cabeza.json'), readFileSync(join(rutaDeEstado(dir, envFalso), 'cadena-cabeza.json')));
    assert.equal(comprobarEvidencia(dir, { env: envFalso }).ok, true, 'con su propia clave, su cadena es coherente');
    // ...pero en la máquina del usuario no pasa: ni su clave ni su cabeza cuentan
    const r = comprobarEvidencia(dir, { env });
    assert.equal(r.ok, false);
    assert.ok(tipos(r).includes('firma'));
    assert.equal(nuevos.length, 2);
  });

  test('un FORGE_HOME dentro del proyecto no se acepta como estado', () => {
    const dir = proyecto();
    assert.throws(() => rutaDeEstado(dir, { FORGE_HOME: join(dir, 'dentro') }), /DENTRO del proyecto/);
  });
});

describe('informes anteriores a la cadena y entrada hostil', () => {
  test('un informe viejo sin evidencia es un aviso; uno posterior sin evidencia es un error', () => {
    const dir = proyecto(); const env = entorno();
    mkdirSync(carpeta(dir), { recursive: true });
    writeFileSync(archivo(dir, '20200101-000000-aaaaaaaa'), JSON.stringify({ id: '20200101-000000-aaaaaaaa', formato: 1, veredicto: 'pasa' }));
    const [a] = tres(dir, env);
    let r = comprobarEvidencia(dir, { env });
    assert.equal(r.ok, true, JSON.stringify(r.errores));
    assert.ok(r.avisos.some((x) => /anteriores a la cadena/.test(x)));
    // le quitan el bloque a un informe del medio: el siguiente ya no encuentra su anterior
    const j = leer(dir, a); delete j.evidencia; guardar(dir, a, j);
    r = comprobarEvidencia(dir, { env });
    assert.equal(r.ok, false);
    assert.ok(tipos(r).includes('borrado'));
    // un informe sin bloque con marca de tiempo posterior al inicio de la cadena
    const dir2 = proyecto(); const env2 = entorno();
    tres(dir2, env2);
    writeFileSync(archivo(dir2, '20991231-000000-bbbbbbbb'), JSON.stringify({ id: '20991231-000000-bbbbbbbb', formato: 1, veredicto: 'pasa' }));
    r = comprobarEvidencia(dir2, { env: env2 });
    assert.equal(r.ok, false);
    assert.ok(tipos(r).includes('sin_evidencia'));
  });

  test('archivo enorme, JSON roto, no-objeto y claves __proto__: error ordenado, sin lanzar', () => {
    const dir = proyecto(); const env = entorno();
    tres(dir, env);
    writeFileSync(join(carpeta(dir), 'enorme.json'), `{"x":"${'a'.repeat(3 * 1024 * 1024)}"}`);
    writeFileSync(join(carpeta(dir), 'roto.json'), '{ no es json');
    writeFileSync(join(carpeta(dir), 'lista.json'), '[1,2]');
    writeFileSync(join(carpeta(dir), 'proto.json'), '{"id":"p","__proto__":{"polluted":true},"evidencia":{"sha256":"x","anterior":"__proto__","__proto__":{"polluted":true}}}');
    const r = comprobarEvidencia(dir, { env });
    assert.equal(r.ok, false);
    assert.ok(r.errores.filter((e) => e.tipo === 'ilegible').length >= 3);
    assert.equal(/** @type {any} */ ({}).polluted, undefined, 'sin contaminación de prototipos');
  });

  test('campos enormes y caracteres de control en la entrada se acotan', () => {
    assert.equal(texto('a'.repeat(100000), 100)?.length, 100);
    assert.equal(texto('x\u0000y\u001bz'), 'x?y?z');
    assert.equal(texto({ a: 1 }), null);
    const dir = proyecto(); const env = entorno();
    const r = registrarVerificacion(dir, crearResultado({ veredicto: 'pasa', imagen: `-malo\n${'z'.repeat(5000)}` }), { env });
    const ev = leer(dir, /** @type {any} */ (r).id).evidencia;
    assert.equal(ev.imagen, null, 'una «imagen» que empieza por guion no se pasa a docker');
  });

  test('rutas con .. en el nombre de un informe no salen de la carpeta', () => {
    const dir = proyecto(); const env = entorno();
    tres(dir, env);
    const r = comprobarEvidencia(dir, { env });
    for (const e of r.errores) assert.equal(String(e.detalle).includes('..'), false);
    // un informe cuyo id intenta escapar no coincide con su nombre de archivo
    const [a] = readdirSync(carpeta(dir));
    const j = JSON.parse(readFileSync(join(carpeta(dir), a), 'utf8'));
    j.id = '../../escapado';
    writeFileSync(join(carpeta(dir), a), JSON.stringify(j));
    const r2 = comprobarEvidencia(dir, { env });
    assert.equal(r2.ok, false);
    assert.equal(existsSync(join(dir, '..', 'escapado.json')), false);
  });

  test('nada sale del equipo: el módulo no importa red ni proveedores, y solo ejecuta git (rev-parse) y docker (inspect)', () => {
    const fuente = readFileSync(new URL('../core/evidencia/cadena.js', import.meta.url), 'utf8');
    const imports = [...fuente.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
    for (const i of imports) assert.equal(/http|net|dns|tls|llm-providers|agent-registry|fetch/.test(i), false, i);
    assert.equal(/\bfetch\s*\(|XMLHttpRequest|WebSocket/.test(fuente), false);
    const ejecuta = [...fuente.matchAll(/execFileSync\(([^,]+),\s*\[([^\]]*)/g)].map((m) => `${m[1].trim()} ${m[2]}`);
    assert.equal(ejecuta.length, 2);
    assert.ok(ejecuta.some((e) => /'git'/.test(e) && /rev-parse/.test(e)));
    assert.ok(ejecuta.some((e) => /bin/.test(e) && /'image', 'inspect'/.test(e)));
  });

  test('sin carpeta de informes: cadena vacía y ok', () => {
    const r = comprobarEvidencia(proyecto(), { env: entorno() });
    assert.equal(r.ok, true);
    assert.equal(r.nivel, 'vacia');
    assert.equal(r.informes, 0);
  });
});
