/**
 * recuperador-semantico.js — Contexto por similitud, además de por archivos (memoria semántica, S3)
 *
 * Primero entrega lo mismo que el recuperador por archivos (los archivos de la tarea, los del
 * plan y las líneas de la spec), con el 60 % del tope. Con el resto añade los trozos del
 * repositorio más parecidos a la tarea, buscados en un índice de vectores (indice-vectorial.js).
 *
 * Si el embedder falla (p. ej. Ollama apagado) se devuelve solo el contexto por archivos y se
 * anota el motivo en `contexto.aviso`: el ciclo no se detiene por no poder buscar.
 * El texto entregado, cabeceras incluidas, nunca supera `maxBytes`.
 */

import { recortar, bytes, recuperarPorArchivos } from './recuperador-archivos.js';
import { crearEmbedder } from './embeddings.js';
import { IndiceVectorial } from './indice-vectorial.js';

const PARTE_ARCHIVOS = 0.6;

/** @type {Map<string, IndiceVectorial>} */
const INDICES = new Map();

/**
 * @param {any} entrada  la de recuperarPorArchivos, más `tarea.descripcion`, `plan.pasos`, `embeddings`, `embeddingsModelo`, `embedder` y `k`
 * @returns {Promise<{ contexto: { fragmentos: { ruta: string, origen: string, bytes: number }[], bytesTotales: number, truncado: boolean, aviso?: string }, texto: string }>}
 */
export async function recuperarSemantico(entrada) {
  const base = recuperarPorArchivos({ ...entrada, maxBytes: Math.floor(entrada.maxBytes * PARTE_ARCHIVOS) });
  const consulta = [entrada.tarea?.descripcion, ...(entrada.plan?.pasos ?? [])].filter((x) => typeof x === 'string' && x !== '').join('\n');
  if (consulta.trim() === '') return base;

  /** @type {{ ruta: string, ini: number, fin: number, texto: string, puntuacion: number }[]} */
  let hallados;
  try {
    const embedder = entrada.embedder ?? crearEmbedder(entrada.embeddings ?? 'hash', { modelo: entrada.embeddingsModelo });
    const clave = entrada.cwd + '|' + embedder.nombre;
    let indice = INDICES.get(clave);
    if (!indice) { indice = new IndiceVectorial({ cwd: entrada.cwd, embedder, vetadas: entrada.vetadas }); INDICES.set(clave, indice); }
    await indice.actualizar();
    hallados = await indice.buscar(consulta, { k: entrada.k ?? 8, excluir: new Set(base.contexto.fragmentos.map((f) => f.ruta)) });
  } catch (e) {
    return { ...base, contexto: { ...base.contexto, aviso: 'Búsqueda semántica no disponible: ' + (e instanceof Error ? e.message : String(e)) } };
  }

  let texto = base.texto;
  const fragmentos = [...base.contexto.fragmentos];
  let truncado = base.contexto.truncado;
  for (const h of hallados) {
    const cab = (texto === '' ? '' : '\n\n') + '### ' + h.ruta + ':' + h.ini + '-' + h.fin + ' (semantico, similitud ' + h.puntuacion.toFixed(2) + ')\n';
    const restante = entrada.maxBytes - bytes(texto) - bytes(cab);
    if (restante <= 0) { truncado = true; break; }
    const contenido = recortar(h.texto, restante);
    if (contenido !== h.texto) truncado = true;
    texto += cab + contenido;
    fragmentos.push({ ruta: h.ruta, origen: 'semantico', bytes: bytes(contenido) });
    if (contenido !== h.texto) break;
  }
  return { contexto: { fragmentos, bytesTotales: bytes(texto), truncado }, texto };
}
