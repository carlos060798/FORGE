// @ts-check
/**
 * Vista Actividad — feed en tiempo real del consumo de agentes FORGE
 * Polling cada 3 segundos contra /actividad
 */

import { onConsumo } from "/src/sse.js";

function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "–";
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

const AGENTE_EMOJI = {
  arquitecto: "🏗️",
  critico: "🔍",
  revisor: "🔎",
  seguridad: "🛡️",
  "asesor-datos": "📊",
  "product-designer": "🎨",
  "desarrollador-backend": "⚙️",
  "desarrollador-frontend": "🖥️",
  tester: "🧪",
  documentador: "📝",
  operaciones: "🚀",
  "disenador-api": "🔌",
  main: "🤖",
};

function agenteEmoji(agente) {
  return AGENTE_EMOJI[agente] || "🤖";
}

let ultimoTs = null;
let hayNuevo = false;

function renderFeed(actividad) {
  const container = document.getElementById("actividad-feed");
  const indicador = document.getElementById("actividad-indicador");
  if (!container) return;

  if (!actividad || actividad.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>Aún no hay actividad registrada.</p>
        <p>Escribe <code>/forge "tu idea"</code> en Claude Code para comenzar.</p>
      </div>
    `;
    if (indicador) indicador.textContent = "";
    return;
  }

  // Detectar nuevo si el último ts cambió
  const primerTs = actividad[actividad.length - 1]?.ts;
  if (ultimoTs && primerTs !== ultimoTs) hayNuevo = true;
  ultimoTs = primerTs;

  if (indicador) {
    const agenteActivo = actividad[actividad.length - 1]?.agente;
    indicador.innerHTML = hayNuevo
      ? `🔄 <strong>En ejecución:</strong> ${esc(agenteActivo || "–")}`
      : "";
  }

  // Renderizar feed en orden cronológico inverso (más reciente arriba)
  const reversed = [...actividad].reverse();
  container.innerHTML = reversed.map(entry => `
    <div class="actividad-entry">
      <span class="actividad-hora">[${esc(entry.hora)}]</span>
      <span class="actividad-agente">${agenteEmoji(entry.agente)} ${esc(entry.agente)}</span>
      <span class="actividad-sep">→</span>
      <span class="actividad-tool">${esc(entry.tool)}</span>
      <span class="actividad-archivo">${esc(entry.archivo)}</span>
      <span class="actividad-bytes">${formatBytes(entry.bytes)}</span>
    </div>
  `).join("");
}

async function actualizarActividad() {
  try {
    const res = await fetch("/actividad");
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    renderFeed(data);
  } catch {
    const container = document.getElementById("actividad-feed");
    if (container && container.innerHTML === "") {
      container.innerHTML = '<p class="error-state">No se pudo conectar con el servidor FORGE.</p>';
    }
  }
}

// Arranque via SSE (fallback polling gestionado en sse.js)
actualizarActividad();
onConsumo(actualizarActividad);
