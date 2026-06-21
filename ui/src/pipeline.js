// @ts-check
// Vista 1 — Pipeline: fase actual + barra de progreso. Refresco cada 5 s.

const PIPELINE_STEPS = [
  { id: "idea",      label: "Idea recibida",           emoji: "💡" },
  { id: "discovery", label: "Explorando el proyecto",  emoji: "🔍" },
  { id: "ir",        label: "Entendiendo la idea",     emoji: "📝" },
  { id: "design",    label: "Diseñando la app",        emoji: "🎨" },
  { id: "spec",      label: "Escribiendo la especificación", emoji: "📋" },
  { id: "plan",      label: "Planificando la construcción",  emoji: "🗺️" },
  { id: "tasks",     label: "Preparando las tareas",   emoji: "📌" },
  { id: "code",      label: "Construyendo tu app",     emoji: "⚙️" },
  { id: "done",      label: "¡Tu app está lista!",     emoji: "✅" },
];

function stepIndex(stepId) {
  return PIPELINE_STEPS.findIndex(s => s.id === stepId);
}

function render(estado) {
  const container = document.getElementById("view-pipeline");
  if (!container) return;

  if (!estado || Object.keys(estado).length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No hay ningún proyecto activo todavía.</p>
        <p>Abre Claude Code y escribe <code>/forge "tu idea"</code> para empezar.</p>
      </div>`;
    return;
  }

  const currentStep = estado.pipeline_step ?? "idea";
  const currentIdx  = Math.max(0, stepIndex(currentStep));
  const progress    = Math.round(((currentIdx + 1) / PIPELINE_STEPS.length) * 100);
  const step        = PIPELINE_STEPS[currentIdx];
  const projectName = estado.spec_activa
    ? estado.spec_activa.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/-/g, " ")
    : "Tu proyecto";

  container.innerHTML = `
    <div class="pipeline-header">
      <h2 class="project-name">${esc(titleCase(projectName))}</h2>
      <span class="step-badge">${step.emoji} ${esc(step.label)}</span>
    </div>

    <div class="progress-wrap">
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${progress}%"></div>
      </div>
      <span class="progress-label">${progress}% completado</span>
    </div>

    <ol class="step-list">
      ${PIPELINE_STEPS.map((s, i) => {
        const cls = i < currentIdx ? "done" : i === currentIdx ? "active" : "pending";
        const icon = i < currentIdx ? "✅" : i === currentIdx ? "🔄" : "⬜";
        return `<li class="step-item step-${cls}">
          <span class="step-icon">${icon}</span>
          <span class="step-label">${esc(s.label)}</span>
        </li>`;
      }).join("")}
    </ol>

    ${estado.ultima_actualizacion ? `
    <p class="last-update">Último cambio: ${formatDate(estado.ultima_actualizacion)}</p>` : ""}
  `;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function titleCase(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString("es", { dateStyle: "short", timeStyle: "short" });
  } catch { return iso; }
}

// ─── Polling ─────────────────────────────────────────────────────────────────

let lastHash = "";

async function refresh() {
  try {
    const res = await fetch("/estado");
    const data = await res.json();
    const hash = JSON.stringify(data);
    if (hash !== lastHash) {
      lastHash = hash;
      render(data);
    }
  } catch {
    const container = document.getElementById("view-pipeline");
    if (container) container.innerHTML = `<p class="error">No se puede conectar con el servidor FORGE.</p>`;
  }
}

export function init() {
  refresh();
  setInterval(refresh, 5000);
}
