// @ts-check
import { onEstado } from "/src/sse.js";

// Vista 2 — Tareas: tablero de estado ✅/🔄/⬜/❌. Las 🔄 primero.

const STATUS_ICON  = { done: "✅", in_progress: "🔄", pending: "⬜", failed: "❌" };
const STATUS_LABEL = { done: "Completada", in_progress: "En progreso", pending: "Pendiente", failed: "Falló" };
const STATUS_ORDER = { in_progress: 0, failed: 1, pending: 2, done: 3 };

function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const oa = STATUS_ORDER[a.status] ?? 99;
    const ob = STATUS_ORDER[b.status] ?? 99;
    if (oa !== ob) return oa - ob;
    return (a.id ?? "").localeCompare(b.id ?? "");
  });
}

function render(data) {
  const container = document.getElementById("view-tasks");
  if (!container) return;

  const tasks = data?.tareas ?? [];

  if (tasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>El plan aún no se ha generado.</p>
        <p>Las tareas aparecerán aquí una vez que FORGE planifique tu proyecto.</p>
      </div>`;
    return;
  }

  const sorted   = sortTasks(tasks);
  const total    = sorted.length;
  const done     = sorted.filter(t => t.status === "done").length;
  const inProg   = sorted.filter(t => t.status === "in_progress").length;

  container.innerHTML = `
    <div class="tasks-header">
      <h2>Tareas del proyecto</h2>
      <div class="tasks-stats">
        <span class="stat">${done}/${total} completadas</span>
        ${inProg > 0 ? `<span class="stat active">${inProg} en progreso</span>` : ""}
      </div>
    </div>

    <ul class="task-list">
      ${sorted.map(task => {
        const status = task.status ?? "pending";
        const icon   = STATUS_ICON[status]  ?? "⬜";
        const label  = STATUS_LABEL[status] ?? status;
        const desc   = task.description ?? task.content ?? task.id ?? "Tarea sin nombre";
        return `
        <li class="task-item task-${esc(status)}">
          <span class="task-icon" title="${esc(label)}">${icon}</span>
          <span class="task-id">${esc(task.id ?? "")}</span>
          <span class="task-desc">${esc(desc)}</span>
        </li>`;
      }).join("")}
    </ul>
  `;
}

function esc(str) {
  return String(str ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// ─── SSE + Carga inicial ─────────────────────────────────────────────────────

let lastHash = "";

function recargarTareas() {
  fetch("/tareas")
    .then(r => r.json())
    .then(data => {
      const hash = JSON.stringify(data);
      if (hash !== lastHash) { lastHash = hash; render(data); }
    })
    .catch(() => {});
}

export function init() {
  recargarTareas();
  // Refrescar tareas cuando cambia estado.json (via SSE o fallback polling)
  onEstado(recargarTareas);
}