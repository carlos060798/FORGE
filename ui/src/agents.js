// @ts-check
// Módulo de agentes activos — se embebe dentro del nodo activo del grafo.
// Pollea /agentes c/3s y actualiza el slot #agents-inline en pipeline.

const MODELO_BADGE = {
  opus:   { label: "Opus",   color: "#a78bfa" },
  sonnet: { label: "Sonnet", color: "#6ea8fe" },
  haiku:  { label: "Haiku",  color: "#4ade80" },
};

function modeloBadge(modelo) {
  const m = String(modelo ?? "").toLowerCase();
  const found = Object.entries(MODELO_BADGE).find(([k]) => m.includes(k));
  if (!found) return `<span class="agent-model">${esc(modelo)}</span>`;
  const [, { label, color }] = found;
  return `<span class="agent-model" style="color:${color}">${label}</span>`;
}

function esc(str) {
  return String(str ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function formatBytes(n) {
  if (!n) return "–";
  if (n < 1024) return n + " B";
  return (n / 1024).toFixed(1) + " KB";
}

function renderAgentes(agentes) {
  const slot = document.getElementById("agents-inline");
  if (!slot) return;
  if (!agentes || agentes.length === 0) {
    slot.innerHTML = `<p class="agents-empty">Sin agentes activos en los últimos 60s</p>`;
    return;
  }
  slot.innerHTML = agentes.map(a => `
    <div class="agent-row" data-nombre="${esc(a.nombre)}" title="Ver detalle">
      <span class="agent-dot"></span>
      <span class="agent-name">${esc(a.nombre)}</span>
      ${modeloBadge(a.modelo)}
      <span class="agent-tool">${esc(a.tool)}</span>
      <span class="agent-archivo">${esc(a.archivo)}</span>
      <span class="agent-bytes">${formatBytes(a.bytes)}</span>
    </div>`).join("");

  // Emitir evento de click para que agent-panel.js lo escuche
  slot.querySelectorAll(".agent-row").forEach(row => {
    row.addEventListener("click", () => {
      const nombre = row.getAttribute("data-nombre");
      if (nombre) document.dispatchEvent(new CustomEvent("forge:open-agent", { detail: { nombre } }));
    });
  });
}

let lastHash = "";

async function fetchAgentes() {
  try {
    const res = await fetch("/agentes");
    const data = await res.json();
    const hash = JSON.stringify(data);
    if (hash !== lastHash) {
      lastHash = hash;
      renderAgentes(data);
    }
  } catch {
    // Silencioso — el error del pipeline ya lo muestra
  }
}

export function init() {
  fetchAgentes();
  setInterval(fetchAgentes, 3000);
}
