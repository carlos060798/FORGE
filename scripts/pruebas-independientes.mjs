#!/usr/bin/env node
// @ts-check
/**
 * pruebas-independientes.mjs — Ejecuta el ciclo verificado de FORGE sobre proyectos independientes.
 *
 * Crea proyectos pequeños en una carpeta que NO es este repositorio, instala FORGE como lo haría un
 * usuario (paquete empaquetado con `npm pack`, o la copia de trabajo con --desde-repo), lanza el ciclo
 * en cada uno y escribe un informe. El código que genera el modelo se ejecuta dentro del contenedor
 * aislado del ciclo (Principio V): este script nunca lo ejecuta en el equipo.
 *
 * Uso:
 *   node scripts/pruebas-independientes.mjs --modelo humo                      # sin gasto: comprueba instalación y arranque
 *   node scripts/pruebas-independientes.mjs --modelo real --tope 0.30         # con un proveedor de pago
 *   node scripts/pruebas-independientes.mjs --proyectos js-nuevo,py-pytest     # solo algunos
 *   node scripts/pruebas-independientes.mjs --desde-repo                       # sin empaquetar: usa este repositorio
 *
 * Opciones: --modelo humo|real (humo)   --proyectos lista (todos)   --tope USD por proyecto (0.30)
 *           --nivel haiku|sonnet|opus (haiku)   --salida carpeta (temporal)   --conservar   --desde-repo
 *           --proveedor anthropic|openai|ollama|stub (stub en humo, anthropic en real)
 *           --modelo-alto / --modelo-medio / --modelo-economico id (los del proveedor por defecto)
 * Con --modelo real hace falta la clave del proveedor elegido en el ENTORNO (ANTHROPIC_API_KEY, OPENAI_API_KEY;
 * Ollama no usa clave): nunca por la línea de comandos, y nunca se imprime ni se guarda.
 * El modo humo es siempre el proveedor stub: sin gasto y sin claves.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analizarOpciones, configDeModelos, descripcionDeProveedor, entornoDelCiclo } from './opciones-independientes.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ── Argumentos ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : (args[i + 1] ?? d); };
const flag = (n) => args.includes(`--${n}`);
const analisis = analizarOpciones(args, process.env);
if (!analisis.ok) salir(2, analisis.error);
const OPC = analisis.opciones;
const MODELO = OPC.modelo;
const TOPE = OPC.tope;
const NIVEL = OPC.nivel;
const DESDE_REPO = OPC.desdeRepo;
const CONSERVAR = OPC.conservar;
const PROVEEDOR = OPC.proveedor;

function salir(codigo, mensaje) { console.error(mensaje); process.exit(codigo); }

// ── Proyectos de prueba ─────────────────────────────────────────────────────
const JS_PKG = JSON.stringify({ name: 'proyecto-prueba', type: 'module', scripts: { test: 'node --test' } }, null, 2) + '\n';

/** @type {Record<string, { descripcion: string, archivos: Record<string,string>, tareas: any[] }>} */
const PROYECTOS = {
  'js-nuevo': {
    descripcion: 'JavaScript, proyecto vacío: una función con casos borde',
    archivos: { 'package.json': JS_PKG },
    tareas: [{ id: 'T1', agente: 'desarrollador-backend', prompt: 'Crea src/texto.js que exporte capitalizar(frase): pone en mayuscula la primera letra de cada palabra y el resto en minuscula, conserva los espacios multiples, y lanza TypeError si no recibe un string. Exporta tambien contarPalabras(frase): numero de palabras separadas por espacios, 0 para cadena vacia o solo espacios. Pruebas con node:test en tests/texto.test.js.' }],
  },
  'js-existente': {
    descripcion: 'JavaScript con código existente: cambio en dos archivos sin nombrarlos',
    archivos: {
      'package.json': JS_PKG,
      'src/inventario.js': "const existencias = new Map();\n\nexport function registrar(sku, cantidad) {\n  if (!Number.isInteger(cantidad) || cantidad < 0) throw new Error('cantidad invalida');\n  existencias.set(sku, (existencias.get(sku) ?? 0) + cantidad);\n}\n\nexport function disponible(sku) {\n  return existencias.get(sku) ?? 0;\n}\n\nexport function reiniciar() {\n  existencias.clear();\n}\n",
      'src/pedidos.js': "import { disponible } from './inventario.js';\n\nconst pedidos = [];\n\nexport function crearPedido(sku, cantidad) {\n  if (disponible(sku) < cantidad) throw new Error('sin existencias');\n  const pedido = { id: pedidos.length + 1, sku, cantidad, estado: 'creado' };\n  pedidos.push(pedido);\n  return pedido;\n}\n\nexport function listar() {\n  return [...pedidos];\n}\n",
      'tests/inventario.test.js': "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { registrar, disponible, reiniciar } from '../src/inventario.js';\n\ntest('registrar acumula', () => {\n  reiniciar();\n  registrar('A', 2); registrar('A', 3);\n  assert.equal(disponible('A'), 5);\n});\n",
    },
    tareas: [{ id: 'T1', agente: 'desarrollador-backend', prompt: 'En este proyecto de tienda, crearPedido no descuenta existencias del inventario. Corrigelo: anade al modulo de inventario una funcion retirar(sku, cantidad) que descuenta y lanza Error con mensaje sin existencias si no alcanza, y haz que crearPedido la use, de modo que dos pedidos seguidos no puedan superar las existencias. Anade tambien al modulo de pedidos reiniciarPedidos() para las pruebas. No rompas las pruebas existentes. Pruebas nuevas con node:test.' }],
  },
  'py-pytest': {
    descripcion: 'Python con pytest declarado en requirements.txt',
    archivos: { 'requirements.txt': 'pytest>=7\n' },
    tareas: [{ id: 'T1', agente: 'desarrollador-backend', prompt: 'Crea el modulo romanos.py con la funcion a_romano(n) que convierte un entero entre 1 y 3999 a numeros romanos y lanza ValueError fuera de ese rango o si no es entero. Pruebas con pytest en tests/test_romanos.py.' }],
  },
  'go-modulo': {
    descripcion: 'Go con módulo: texto Unicode con pruebas de tabla',
    archivos: { 'go.mod': 'module ejemplo/texto\n\ngo 1.22\n' },
    tareas: [{ id: 'T1', agente: 'desarrollador-backend', prompt: 'Crea el paquete texto en la raiz del modulo (archivo texto.go, package texto) con la funcion Invertir(s string) string que invierte una cadena respetando caracteres Unicode (runas), y EsPalindromo(s string) bool que ignora mayusculas, espacios y signos de puntuacion. Pruebas en texto_test.go con el paquete testing, usando tablas de casos.' }],
  },
  'dos-tareas': {
    descripcion: 'JavaScript, dos tareas encadenadas: la segunda usa el módulo de la primera',
    archivos: { 'package.json': JS_PKG },
    tareas: [
      { id: 'T1', agente: 'desarrollador-backend', prompt: 'Crea src/moneda.js que exporte formatear(centimos): recibe un entero de centimos y devuelve un texto como 1.234,56 EUR (punto de miles, coma decimal); lanza TypeError si no es un entero. Pruebas con node:test en tests/moneda.test.js.' },
      { id: 'T2', agente: 'desarrollador-backend', dependencias: ['T1'], prompt: 'Crea src/factura.js que exporte total(lineas): recibe un array de objetos con precioCentimos y cantidad, suma los importes, aplica 21 por ciento de IVA redondeando al centimo, y devuelve un objeto con base, iva y total formateados usando formatear de src/moneda.js. Lanza Error si el array esta vacio. Pruebas con node:test en tests/factura.test.js.' },
    ],
  },
};

const elegidos = OPC.proyectos ?? Object.keys(PROYECTOS);
for (const n of elegidos) if (!PROYECTOS[n]) salir(2, `Proyecto desconocido: ${n}. Disponibles: ${Object.keys(PROYECTOS).join(', ')}`);

// ── Utilidades ──────────────────────────────────────────────────────────────
const sh = (cmd, a, o = {}) => spawnSync(cmd, a, { encoding: 'utf8', shell: process.platform === 'win32' && /^npm|^npx/.test(cmd), ...o });
const sinSecretos = (t) => String(t ?? '').replace(/sk-ant-[A-Za-z0-9_-]+/g, '[clave]');
const escribir = (dir, ruta, contenido) => { const a = join(dir, ruta); mkdirSync(dirname(a), { recursive: true }); writeFileSync(a, contenido); };

const SALIDA = resolve(opt('salida', mkdtempSync(join(tmpdir(), 'forge-independientes-'))));
mkdirSync(SALIDA, { recursive: true });
if (SALIDA.startsWith(RAIZ)) salir(2, 'La carpeta de salida no puede estar dentro del repositorio de FORGE: debe ser independiente.');

// ── Instalación de FORGE como lo haría un usuario ───────────────────────────
let CLI;
let version = 'copia de trabajo';
if (DESDE_REPO) {
  CLI = join(RAIZ, 'cli', 'index.js');
} else {
  const empaquetar = sh('npm', ['pack', '--silent', '--pack-destination', SALIDA], { cwd: RAIZ });
  if (empaquetar.status !== 0) salir(1, `npm pack falló:\n${sinSecretos(empaquetar.stderr)}`);
  const tgz = join(SALIDA, empaquetar.stdout.trim().split(/\r?\n/).pop() ?? '');
  const prefijo = join(SALIDA, '_forge');
  mkdirSync(prefijo, { recursive: true });
  writeFileSync(join(prefijo, 'package.json'), '{"name":"instalacion-de-prueba","private":true}\n');
  const instalar = sh('npm', ['install', '--no-audit', '--no-fund', '--silent', tgz], { cwd: prefijo });
  if (instalar.status !== 0) salir(1, `npm install del paquete falló:\n${sinSecretos(instalar.stderr)}`);
  const nombrePaquete = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8')).name;
  const pkgDir = join(prefijo, 'node_modules', nombrePaquete);
  if (!existsSync(join(pkgDir, 'cli', 'index.js'))) salir(1, 'El paquete instalado no contiene cli/index.js');
  CLI = join(pkgDir, 'cli', 'index.js');
  version = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')).version;
}

// ── Comprobaciones previas ──────────────────────────────────────────────────
const docker = sh('docker', ['version', '--format', '{{.Server.Version}}'], { timeout: 15000 });
const previo = [
  ['FORGE', `${version} (${DESDE_REPO ? 'copia de trabajo' : 'paquete instalado'})`],
  ['Docker', docker.status === 0 ? `servidor ${docker.stdout.trim()}` : 'NO disponible'],
  ['Proveedor', descripcionDeProveedor(OPC)],
  ['Modelo', MODELO === 'real' ? `real, nivel máximo ${NIVEL}, tope ${TOPE} USD por proyecto` : 'humo (sin gasto)'],
  ['Carpeta', SALIDA],
];
for (const [k, v] of previo) console.log(`${k.padEnd(8)} ${v}`);
if (docker.status !== 0) salir(4, 'Docker es obligatorio para el ciclo verificado y no responde.');

// ── Ejecución ───────────────────────────────────────────────────────────────
const entorno = entornoDelCiclo(OPC, process.env);
const CONFIG_MODELOS = configDeModelos(OPC.modelos);

/** @param {string} dir */
function leerRegistro(dir) {
  const r = { eventos: /** @type {any[]} */ ([]), gasto: { usd: 0, llamadas: 0, entrada: 0, salida: 0 }, estimado: 0 };
  const ev = join(dir, '.sdd', 'events.jsonl');
  if (existsSync(ev)) {
    for (const l of readFileSync(ev, 'utf8').split(/\r?\n/)) {
      if (!l.trim()) continue;
      try { r.eventos.push(JSON.parse(l)); } catch { /* línea parcial */ }
    }
  }
  const base = join(dir, '.sdd', 'motor');
  if (existsSync(base)) {
    for (const s of readdirSync(base)) {
      const g = join(base, s, 'gasto.jsonl');
      if (!existsSync(g)) continue;
      for (const l of readFileSync(g, 'utf8').split(/\r?\n/)) {
        if (!l.trim()) continue;
        try {
          const x = JSON.parse(l);
          r.gasto.usd += x.usd ?? 0; r.gasto.llamadas += 1; r.gasto.entrada += x.inputTokens ?? 0; r.gasto.salida += x.outputTokens ?? 0;
          if (x.estimado) r.estimado += 1;
        } catch { /* línea parcial */ }
      }
    }
  }
  return r;
}

const informe = [];
for (const nombre of elegidos) {
  const def = PROYECTOS[nombre];
  const dir = join(SALIDA, nombre);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const [ruta, contenido] of Object.entries(def.archivos)) escribir(dir, ruta, contenido);
  escribir(dir, '.sdd/estado.json', '{"pipeline_step":"code"}\n');
  if (CONFIG_MODELOS) escribir(dir, '.sdd/sdd.config.yaml', CONFIG_MODELOS);
  escribir(dir, 'tareas.json', JSON.stringify(def.tareas, null, 2) + '\n');

  const t0 = Date.now();
  const r = sh(process.execPath, [CLI, 'run', '--motor', 'ciclo', '--tasks', join(dir, 'tareas.json'), '--cwd', dir], { cwd: dir, env: entorno, timeout: 20 * 60 * 1000 });
  const reg = leerRegistro(dir);
  const pausa = [...reg.eventos].reverse().find((e) => e.type === 'task_paused');
  const fin = reg.eventos.filter((e) => e.type === 'task_completed');
  const ejecuciones = reg.eventos.filter((e) => e.type === 'ciclo:ejecucion');
  const escritos = (readdirSync(dir, { recursive: true }) ?? []).map(String).filter((f) => /\.(js|py|go)$/.test(f) && !f.startsWith('.sdd') && f !== 'tareas.json');
  informe.push({
    proyecto: nombre,
    descripcion: def.descripcion,
    codigoSalida: r.status,
    resultado: r.status === 0 && fin.length >= def.tareas.length ? 'exito' : pausa ? `pausa: ${pausa.payload?.motivo ?? '?'}` : `salida ${r.status}`,
    tareasCompletadas: fin.length,
    tareasEsperadas: def.tareas.length,
    iteraciones: ejecuciones.length,
    llamadas: reg.gasto.llamadas,
    gastoUsd: Number(reg.gasto.usd.toFixed(4)),
    llamadasEstimadas: reg.estimado,
    segundos: Math.round((Date.now() - t0) / 1000),
    archivos: escritos,
    detalle: sinSecretos(pausa?.payload?.detalle ?? '').slice(0, 300),
    salida: sinSecretos(`${r.stdout ?? ''}${r.stderr ?? ''}`).split(/\r?\n/).filter(Boolean).slice(-6),
  });
  const u = informe[informe.length - 1];
  console.log(`${nombre.padEnd(14)} ${u.resultado.padEnd(26)} it=${u.iteraciones} llamadas=${u.llamadas} gasto=${u.gastoUsd} USD ${u.segundos}s`);
}

// ── Informe ─────────────────────────────────────────────────────────────────
const totalUsd = Number(informe.reduce((s, x) => s + x.gastoUsd, 0).toFixed(4));
const md = [
  '# Informe de pruebas en proyectos independientes',
  '',
  `- FORGE: ${version} (${DESDE_REPO ? 'copia de trabajo' : 'paquete instalado con npm'})`,
  `- Proveedor y modelos: ${descripcionDeProveedor(OPC)}`,
  `- Modelo: ${MODELO === 'real' ? `real, nivel máximo ${NIVEL}, tope ${TOPE} USD por proyecto` : 'humo (sin gasto, proveedor de pruebas)'}`,
  `- Fecha: ${new Date().toISOString()}`,
  `- Sistema: ${process.platform} · Node ${process.version} · Docker ${docker.stdout.trim()}`,
  '',
  '| Proyecto | Resultado | Tareas | Iteraciones | Llamadas | Gasto calculado | Tiempo |',
  '|---|---|---|---|---|---|---|',
  ...informe.map((x) => `| ${x.proyecto} | ${x.resultado} | ${x.tareasCompletadas}/${x.tareasEsperadas} | ${x.iteraciones} | ${x.llamadas} | ${x.gastoUsd} USD | ${x.segundos} s |`),
  '',
  `**Gasto calculado total: ${totalUsd} USD.** Es una cifra de FORGE, no de tu factura: compárala con la consola del proveedor.`,
  '',
  ...(MODELO === 'humo'
    ? ['> En modo **humo** no se espera «exito»: el proveedor de pruebas no resuelve tareas. Lo que se comprueba es que FORGE se instala, arranca, usa Docker, ejecuta el ciclo y se detiene con un motivo explicado.', '']
    : []),
  ...informe.flatMap((x) => [
    `## ${x.proyecto}`, '', `${x.descripcion}.`, '',
    `- Resultado: **${x.resultado}** (código de salida ${x.codigoSalida})`,
    ...(x.detalle ? [`- Detalle: ${x.detalle}`] : []),
    ...(x.llamadasEstimadas ? [`- Llamadas con gasto estimado (canceladas o sin consumo informado): ${x.llamadasEstimadas}`] : []),
    `- Archivos: ${x.archivos.join(', ') || '(ninguno)'}`,
    '- Últimas líneas de la salida:', '', '```', ...x.salida, '```', '',
  ]),
].join('\n');
writeFileSync(join(SALIDA, 'informe.md'), md);
writeFileSync(join(SALIDA, 'informe.json'), JSON.stringify({ version, proveedor: PROVEEDOR, modelos: OPC.modelos, modelo: MODELO, nivel: NIVEL, tope: TOPE, totalUsd, informe }, null, 2));
console.log(`\nInforme: ${join(SALIDA, 'informe.md')}`);
if (!CONSERVAR) console.log('Las carpetas de los proyectos se conservan para que puedas inspeccionarlas; bórralas cuando termines.');

const fallos = informe.filter((x) => MODELO === 'real' ? !x.resultado.startsWith('exito') : x.codigoSalida === null);
process.exit(fallos.length > 0 ? 1 : 0);
