// @ts-check
/**
 * Módulo SSE — conexión centralizada a /events
 *
 * Conecta a EventSource en /events y distribuye los eventos `estado` y `consumo`
 * a los listeners registrados. Si EventSource no está disponible o la conexión
 * falla, activa fallback de polling con los intervalos originales.
 *
 * Uso:
 *   import { onEstado, onConsumo, connected } from "/src/sse.js";
 *   onEstado(data => render(data));
 *   onConsumo(data => renderFeed(data));
 */

const estadoListeners  = new Set();
const consumoListeners = new Set();

let sseActivo = false;
let fallbackTimers = [];

/**
 * Registra un callback para eventos `estado` (cambios en estado.json).
 * @param {(data: object) => void} fn
 */
export function onEstado(fn) {
  estadoListeners.add(fn);
}

/**
 * Registra un callback para eventos `consumo` (nuevas entradas en consumo.jsonl).
 * El callback recibe el feed completo de /actividad, igual que hacía el polling.
 * @param {(data: object[]) => void} fn
 */
export function onConsumo(fn) {
  consumoListeners.add(fn);
}

/** Devuelve true si la conexión SSE está activa. */
export function connected() {
  return sseActivo;
}

// ─── Dispatchers internos ─────────────────────────────────────────────────────

function dispatchEstado(data) {
  for (const fn of estadoListeners) {
    try { fn(data); } catch { /* no propagar errores de listeners */ }
  }
}

function dispatchConsumo(data) {
  for (const fn of consumoListeners) {
    try { fn(data); } catch { /* no propagar errores de listeners */ }
  }
}

// ─── Fallback polling ─────────────────────────────────────────────────────────

function iniciarFallback() {
  if (sseActivo) return;
  fallbackTimers.forEach(clearInterval);
  fallbackTimers = [];

  // Polling de estado cada 5 s (igual que el intervalo original)
  fallbackTimers.push(setInterval(async () => {
    try {
      const res = await fetch("/estado");
      if (res.ok) dispatchEstado(await res.json());
    } catch { /* sin conexión */ }
  }, 5000));

  // Polling de actividad cada 3 s (igual que el intervalo original)
  fallbackTimers.push(setInterval(async () => {
    try {
      const res = await fetch("/actividad");
      if (res.ok) dispatchConsumo(await res.json());
    } catch { /* sin conexión */ }
  }, 3000));
}

// ─── Conexión SSE ─────────────────────────────────────────────────────────────

function conectarSSE() {
  if (typeof EventSource === "undefined") {
    iniciarFallback();
    return;
  }

  const es = new EventSource("/events");

  es.addEventListener("estado", (e) => {
    try {
      sseActivo = true;
      dispatchEstado(JSON.parse(e.data));
    } catch { /* dato malformado */ }
  });

  es.addEventListener("consumo", () => {
    // El servidor emite la última línea de consumo.jsonl (1 entrada).
    // Pedimos /actividad para obtener el feed formateado completo.
    fetch("/actividad")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) dispatchConsumo(data); })
      .catch(() => {});
  });

  es.addEventListener("open", () => {
    sseActivo = true;
    fallbackTimers.forEach(clearInterval);
    fallbackTimers = [];
  });

  es.addEventListener("error", () => {
    sseActivo = false;
    // EventSource reintenta solo. Mientras tanto activamos fallback.
    iniciarFallback();
  });
}

// Arrancar al cargar el módulo
conectarSSE();
