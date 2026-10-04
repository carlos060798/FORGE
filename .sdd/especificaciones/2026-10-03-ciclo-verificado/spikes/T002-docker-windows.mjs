// Spike T002 — política de aislamiento de ADR-02 con Docker Desktop en Windows.
// Lanza contenedores con spawn y argv en array (sin shell), como hará docker-cli.js.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const IMAGEN = 'node:22-alpine';
const ETIQUETA = 'forge.sandbox=1';

function docker(args, { timeoutMs = 120_000 } = {}) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const p = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', timedOut = false;
    p.stdout.on('data', (d) => (stdout += d));
    p.stderr.on('data', (d) => (stderr += d));
    const timer = setTimeout(() => { timedOut = true; p.kill(); }, timeoutMs);
    p.on('error', (e) => { clearTimeout(timer); resolve({ code: null, stdout, stderr: String(e), ms: Date.now() - t0, timedOut }); });
    p.on('close', (code) => { clearTimeout(timer); resolve({ code, stdout: stdout.trim(), stderr: stderr.trim(), ms: Date.now() - t0, timedOut }); });
  });
}

let n = 0;
const politica = (copia, extra = []) => {
  const nombre = `forge-sbx-spike-${process.pid}-${++n}`;
  return { nombre, args: [
    'run', '--rm', '--name', nombre, '--label', ETIQUETA,
    '--network', 'none', '--user', '1000:1000', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
    '--cpus', '1', '--memory', '512m', '--memory-swap', '512m', '--pids-limit', '256',
    '--read-only', '--tmpfs', '/tmp:rw,noexec,nosuid,size=64m',
    ...extra,
    ...(copia ? ['-v', `${copia}:/work:rw`, '-w', '/work'] : []),
    IMAGEN,
  ] };
};
const run = async (copia, cmd, opts) => { const { nombre, args } = politica(copia); return { nombre, ...(await docker([...args, ...cmd], opts)) }; };
const corto = (s) => s.split('\n').slice(-2).join(' | ').slice(0, 160);

const R = {};
const pull = await docker(['pull', '-q', IMAGEN], { timeoutMs: 300_000 });
R.pull = { code: pull.code, ms: pull.ms, err: corto(pull.stderr) };
if (pull.code !== 0) { console.log(JSON.stringify(R, null, 2)); process.exit(1); }

const copia = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-t002-'));
fs.writeFileSync(path.join(copia, 'entrada.txt'), 'desde el host');

// 1. Montaje bind: leer, escribir como uid 1000, y que el host vea lo escrito
const m = await run(copia, ['node', '-e', "const fs=require('fs');console.log(process.getuid(), fs.readFileSync('entrada.txt','utf8'));fs.writeFileSync('salida.txt','desde el contenedor');fs.mkdirSync('sub');fs.writeFileSync('sub/x.txt','x')"]);
R.montaje = { code: m.code, stdout: m.stdout, err: corto(m.stderr), ms: m.ms,
  hostVeSalida: fs.existsSync(path.join(copia, 'salida.txt')) && fs.readFileSync(path.join(copia, 'salida.txt'), 'utf8'),
  hostVeSub: fs.existsSync(path.join(copia, 'sub', 'x.txt')) };

// 2. Raíz de solo lectura
const ro = await run(copia, ['node', '-e', "try{require('fs').writeFileSync('/etc/x','x');console.log('ESCRIBIO')}catch(e){console.log(e.code)}"]);
R.soloLectura = { code: ro.code, stdout: ro.stdout };

// 3. /tmp escribible y sin ejecución
const tmp = await run(copia, ['sh', '-c', "echo ok > /tmp/a && cat /tmp/a; printf '#!/bin/sh\\necho EJECUTO\\n' > /tmp/s.sh; chmod +x /tmp/s.sh; /tmp/s.sh 2>&1; echo rc=$?"]);
R.tmp = { code: tmp.code, stdout: tmp.stdout.replace(/\n/g, ' | ') };

// 4. Sin red
const red = await run(copia, ['node', '-e', "fetch('https://example.com').then(()=>{console.log('CONECTO');process.exit(0)}).catch(e=>{console.log(e.cause?.code||e.message);process.exit(7)})"]);
const ifs = await run(copia, ['sh', '-c', 'ls /sys/class/net | tr "\\n" " "']);
R.red = { code: red.code, stdout: red.stdout, interfaces: ifs.stdout };

// 5. Usuario y capacidades
const usr = await run(copia, ['sh', '-c', 'id -u; id -g; grep CapEff /proc/self/status; grep NoNewPrivs /proc/self/status']);
R.usuario = usr.stdout.replace(/\s+/g, ' ');

// 6. Límite de memoria
const mem = await run(copia, ['node', '--max-old-space-size=4096', '-e', 'const a=[];for(;;)a.push(Buffer.alloc(50e6,1))']);
R.memoria = { code: mem.code, err: corto(mem.stderr) };

// 7. Límite de procesos
const pids = await run(copia, ['sh', '-c', 'i=0; while [ $i -lt 400 ]; do sleep 30 & i=$((i+1)); done 2>/tmp/err; wc -l < /tmp/err; grep -m1 -o "Resource[^:]*\\|can.t fork" /tmp/err'], { timeoutMs: 40_000 });
R.procesos = { code: pids.code, stdout: pids.stdout.replace(/\n/g, ' | '), timedOut: pids.timedOut };

// 8. Tiempo agotado: matar por nombre y comprobar que no queda nada
const { nombre, args } = politica(copia);
const largo = docker([...args, 'sleep', '120']);
await new Promise((r) => setTimeout(r, 3000));
const kill = await docker(['kill', nombre]);
const fin = await largo;
const rm = await docker(['rm', '-f', nombre]);
R.timeout = { killCode: kill.code, exitDelRun: fin.code, rmCode: rm.code, rmErr: corto(rm.stderr) };

// 9. Código de salida de las pruebas y errores de infraestructura
R.codigos = {
  exito: (await run(copia, ['node', '-e', 'process.exit(0)'])).code,
  fallo: (await run(copia, ['node', '-e', 'process.exit(1)'])).code,
  comandoInexistente: (await run(copia, ['no-existe-xyz'])).code,
  imagenInexistente: (await docker(['run', '--rm', 'forge-sbx:no-existe-abc', 'true'])).code,
};

// 10. Tiempo de arranque (5 ejecuciones vacías con la política completa)
const tiempos = [];
for (let i = 0; i < 5; i++) tiempos.push((await run(copia, ['node', '-e', '0'])).ms);
R.arranqueMs = { muestras: tiempos, mediana: [...tiempos].sort((a, b) => a - b)[2] };

// 11. Alternativa sin montaje: create + cp + start -a + cp de vuelta
const alt0 = Date.now();
const nombreAlt = `forge-sbx-spike-${process.pid}-alt`;
const c = await docker(['create', '--name', nombreAlt, '--label', ETIQUETA, '--network', 'none', '--user', '1000:1000', '--cap-drop', 'ALL',
  '--security-opt', 'no-new-privileges', '--memory', '512m', '--pids-limit', '256', '-w', '/work', IMAGEN,
  'node', '-e', "require('fs').writeFileSync('alt.txt', require('fs').readFileSync('entrada.txt','utf8')+' (alt)')"]);
const cpIn = await docker(['cp', `${copia}${path.sep}.`, `${nombreAlt}:/work`]);
const st = await docker(['start', '-a', nombreAlt]);
const destinoAlt = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-t002-alt-'));
const cpOut = await docker(['cp', `${nombreAlt}:/work/.`, destinoAlt]);
await docker(['rm', '-f', nombreAlt]);
R.alternativaCp = { create: c.code, cpIn: cpIn.code, start: st.code, startErr: corto(st.stderr), cpOut: cpOut.code,
  resultado: fs.existsSync(path.join(destinoAlt, 'alt.txt')) && fs.readFileSync(path.join(destinoAlt, 'alt.txt'), 'utf8'), msTotal: Date.now() - alt0 };

// 12. Residuos
const ps = await docker(['ps', '-aq', '--filter', `label=${ETIQUETA}`]);
R.residuos = ps.stdout === '' ? 0 : ps.stdout.split('\n').length;
R.copiaHost = fs.readdirSync(copia);

fs.rmSync(copia, { recursive: true, force: true });
fs.rmSync(destinoAlt, { recursive: true, force: true });
console.log(JSON.stringify(R, null, 2));
