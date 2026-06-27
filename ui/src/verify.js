// @ts-check
import { onEstado } from "/src/sse.js";

// Vista 3 — Verificación: resultado del último /sdd.verificar en lenguaje simple.

// Traduce mensajes técnicos de criterios fallidos a lenguaje humano.
function humanizeCriterio(criterio) {
  if (!criterio) return criterio;
  const s = String(criterio);
  const map = [
    [/test.*fail/i,         "Una prueba automática no pasó"],
    [/assertion.*error/i,   "El resultado no coincidió con lo esperado"],
    [/timeout/i,            "La operación tardó demasiado"],
    [/coverage.*below/i,    "Falta cobertura de pruebas en alguna parte"],
    [/lint.*error/i,        "Hay un problema de formato en el código"],
    [/type.*error/i,        "Hay un problema de tipos en el código"],
    [/build.*fail/i,        "La construcción no se completó"],
    [/missing.*field/i,     "Falta información requerida"],
    [/unauthorized/i,       "No tienes permiso para realizar esta acción"],
    [/not found/i,          "No se encontró lo que se buscaba"],
  ];
  for (const [pattern, msg] of map) {
    if (pattern.test(s)) return msg;
  }
  return s; // Devuelve el original si no hay mapeo
}

function render(data) {
  const container = document.getElementById("view-verify");
  if (!container) return;

  if (!data) {
    container.innerHTML = `
      <div class="empty-state">
        <p>Aún no se ha verificado nada.</p>
        <p>La verificación aparecerá aquí después de que FORGE construya y pruebe tu app.</p>
      </div>`;
    return;
  }

  const passed    = data.passed ?? data.success ?? data.estado === "ok";
  const timestamp = data.timestamp ?? data.ts ?? data.ultima_actualizacion;
  const criterios = data.criterios_fallidos ?? data.failures ?? data.errores ?? [];
  const resumen   = data.resumen ?? data.summary ?? "";

  container.innerHTML = `
    <div class="verify-result ${passed ? "verify-ok" : "verify-fail"}">
      <div class="verify-badge">
        ${passed ? "✅" : "❌"}
        <span>${passed ? "Tu app funciona como pediste" : "Hay algo que no funcionó bien"}</span>
      </div>

      ${timestamp ? `<p class="verify-date">Verificado: ${formatDate(timestamp)}</p>` : ""}

      ${resumen ? `<p class="verify-summary">${esc(resumen)}</p>` : ""}

      ${!passed && criterios.length > 0 ? `
      <div class="verify-failures">
        <h3>Qué no funcionó:</h3>
        <ul>
          ${criterios.map(c => `<li>${esc(humanizeCriterio(c))}</li>`).join("")}
        </ul>
        <p class="verify-hint">FORGE está corrigiendo estos problemas automáticamente.</p>
      </div>` : ""}
    </div>
  `;
}

function esc(str) {
  return String(str ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString("es", { dateStyle: "short", timeStyle: "short" });
  } catch { return String(iso); }
}

// ─── SSE + Carga inicial ─────────────────────────────────────────────────────

let lastHash = "";

function recargarVerificacion() {
  fetch("/verificar")
    .then(r => r.json())
    .then(data => {
      const hash = JSON.stringify(data);
      if (hash !== lastHash) { lastHash = hash; render(data); }
    })
    .catch(() => {
      const container = document.getElementById("view-verify");
      if (container) container.innerHTML = `<p class="error">No se puede conectar con el servidor FORGE.</p>`;
    });
}

export function init() {
  recargarVerificacion();
  // Refrescar verificación cuando cambia estado.json (via SSE o fallback polling)
  onEstado(recargarVerificacion);
}