// Spike T001 — guardador en archivos + interrupción + reanudación entre procesos.
// Uso: node spike.mjs run | node spike.mjs resume <decision>
import fs from 'node:fs';
import path from 'node:path';
import { StateGraph, Annotation, START, END, interrupt, Command, MemorySaver } from '@langchain/langgraph';

const DIR = path.join(process.cwd(), 'estado');
const ARCHIVO = path.join(DIR, 'checkpoints.json');
const TRAZA = path.join(DIR, 'traza.log');
fs.mkdirSync(DIR, { recursive: true });
const traza = (m) => fs.appendFileSync(TRAZA, m + '\n');

// Uint8Array ↔ base64 para poder guardar en JSON
const codificar = (_k, v) => (v instanceof Uint8Array ? { __u8: Buffer.from(v).toString('base64') } : v);
const decodificar = (_k, v) => (v && typeof v === 'object' && typeof v.__u8 === 'string' ? new Uint8Array(Buffer.from(v.__u8, 'base64')) : v);

class GuardadorArchivos extends MemorySaver {
  constructor(archivo) {
    super();
    this.archivo = archivo;
    if (fs.existsSync(archivo)) {
      const { storage, writes } = JSON.parse(fs.readFileSync(archivo, 'utf8'), decodificar);
      Object.assign(this.storage, storage);
      Object.assign(this.writes, writes);
    }
  }
  _persistir() {
    const tmp = this.archivo + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ storage: this.storage, writes: this.writes }, codificar));
    fs.renameSync(tmp, this.archivo);
  }
  async put(...a) { const r = await super.put(...a); this._persistir(); return r; }
  async putWrites(...a) { await super.putWrites(...a); this._persistir(); }
  async deleteThread(...a) { await super.deleteThread(...a); this._persistir(); }
}

const Estado = Annotation.Root({
  iteracion: Annotation({ reducer: (_a, b) => b, default: () => 0 }),
  ejecuciones: Annotation({ reducer: (a, b) => a.concat(b), default: () => [] }),
  resultado: Annotation({ reducer: (_a, b) => b, default: () => 'en_curso' }),
});

const grafo = new StateGraph(Estado)
  .addNode('coder', (s) => { if (process.env.CRASH && s.iteracion === 1) { traza('coder:CORTE'); process.exit(9); } traza('coder'); return {}; })
  .addNode('sandbox', (s) => { traza('sandbox'); return { iteracion: s.iteracion + 1, ejecuciones: [{ n: s.iteracion + 1, categoria: 'fail' }] }; })
  .addNode('revision', (s) => {
    traza('revision:entrada');
    const decision = interrupt({ motivo: 'iteraciones', iteracion: s.iteracion });
    traza('revision:decidida=' + decision);
    return { resultado: decision === 'abortar' ? 'abortada' : 'aceptada_por_humano' };
  })
  .addEdge(START, 'coder')
  .addEdge('coder', 'sandbox')
  .addConditionalEdges('sandbox', (s) => (s.iteracion >= 2 ? 'revision' : 'coder'), ['revision', 'coder'])
  .addEdge('revision', END)
  .compile({ checkpointer: new GuardadorArchivos(ARCHIVO) });

const config = { configurable: { thread_id: 'run1:T001' } };
const [modo, decision] = process.argv.slice(2);
const t0 = Date.now();
const salida = modo === 'run'
  ? await grafo.invoke({}, config)
  : modo === 'continuar' ? await grafo.invoke(null, config) : await grafo.invoke(new Command({ resume: decision }), config);
const estado = await grafo.getState(config);
console.log(JSON.stringify({
  modo,
  ms: Date.now() - t0,
  interrumpido: Boolean(salida.__interrupt__),
  interrupcion: salida.__interrupt__?.[0]?.value,
  siguiente: estado.next,
  valores: { iteracion: estado.values.iteracion, ejecuciones: estado.values.ejecuciones.length, resultado: estado.values.resultado },
  bytesGuardados: fs.statSync(ARCHIVO).size,
}));
