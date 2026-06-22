// @ts-check
// Panel lateral de agente — se activa con el evento forge:open-agent.
// Pide GET /agente/:nombre y renderiza en un sidebar.

function esc(str) {
  return String(str ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function formatBytes(n) {
  if (!n) return "–";
  if (n < 1024) return n + " B";
  return (n / 1024).toFixed(1) + " KB";
}

function formatTs(iso) {
  try { return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
  catch { return iso; }
}

// ─── Crear/obtener panel ──────────────────────────────────────────────────────

function getOrCreatePanel() {
  let panel = document.getElementById("agent-panel");
  if (!panel) {
    panel = document.createElement("aside");
    panel.id = "agent-panel";
    panel.setAttribute("aria-label", "Detalle de agente");
    document.body.appendChild(panel);

    // Cerrar con Escape
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") closePanel();
    });
  }
  return panel;
}

function closePanel() {
  const panel = document.getElementById("agent-panel");
  if (panel) panel.classList.remove("open");
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderPanel(data) {
  const panel = getOrCreatePanel();
  const fm = data.frontmatter ?? {};

  const modelColor = {
    opus: "#a78bfa", sonnet: "#6ea8fe", haiku: "#4ade80",
  };
  const modelKey = Object.keys(modelColor).find(k => String(fm.model ?? "").includes(k));
  const modelStyle = modelKey ? `style="color:${modelColor[modelKey]}"` : "";

  // Actividad reciente
  const actividad = (data.ultimaActividad ?? []).reverse().map(e => `
    <div class="ap-activity-row">
      <span class="ap-hora">${formatTs(e.ts)}</span>
      <span class="ap-tool">${esc(e.tool)}</span>
      <span class="ap-archivo">${esc(e.archivo ? e.archivo.split(/[\\/]/).pop() : "–")}</span>
      <span class="ap-bytes">${formatBytes(e.bytes)}</span>
    </div>`).join("") || `<p class="ap-empty">Sin actividad reciente</p>`;

  // Memoria
  const memoriaHtml = data.memoria
    ? `<pre class="ap-memoria">${esc(data.memoria)}</pre>`
    : `<p class="ap-empty">Sin memoria persistente</p>`;

  panel.innerHTML = `
    <div class="ap-header">
      <h3 class="ap-name">${esc(data.nombre)}</h3>
      <button class="ap-close" aria-label="Cerrar panel">×</button>
    </div>

    <div class="ap-section">
      <div class="ap-meta-row">
        <span class="ap-label">Modelo</span>
        <span ${modelStyle}>${esc(fm.model ?? "–")}</span>
      </div>
      ${fm.color ? `<div class="ap-meta-row"><span class="ap-label">Color</span><span class="ap-color-dot" style="background:${esc(fm.color)}"></span><span>${esc(fm.color)}</span></div>` : ""}
    </div>

    ${fm.goal ? `
    <div class="ap-section">
      <p class="ap-section-title">Objetivo</p>
      <p class="ap-body">${esc(fm.goal)}</p>
    </div>` : ""}

    ${fm.backstory ? `
    <div class="ap-section">
      <p class="ap-section-title">Perspectiva</p>
      <p class="ap-body ap-soft">${esc(fm.backstory)}</p>
    </div>` : ""}

    ${fm.description ? `
    <div class="ap-section">
      <p class="ap-section-title">Descripción</p>
      <p class="ap-body ap-soft">${esc(fm.description)}</p>
    </div>` : ""}

    <div class="ap-section">
      <p class="ap-section-title">Actividad reciente</p>
      ${actividad}
    </div>

    <div class="ap-section">
      <p class="ap-section-title">Memoria persistente</p>
      ${memoriaHtml}
    </div>
  `;

  panel.querySelector(".ap-close")?.addEventListener("click", closePanel);
  panel.classList.add("open");
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function openAgent(nombre) {
  const panel = getOrCreatePanel();
  panel.innerHTML = `<div class="ap-loading">Cargando ${esc(nombre)}…</div>`;
  panel.classList.add("open");

  try {
    const res = await fetch(`/agente/${encodeURIComponent(nombre)}`);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    renderPanel(data);
  } catch (e) {
    panel.innerHTML = `<div class="ap-error">No se pudo cargar el agente: ${esc(String(e))}</div>`;
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export function init() {
  document.addEventListener("forge:open-agent", (e) => {
    const nombre = e.detail?.nombre;
    if (nombre) openAgent(nombre);
  });
}
