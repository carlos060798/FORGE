// @ts-check
import { onEstado } from "/src/sse.js";

// Vista 1 — Pipeline: grafo SVG de nodos conectados. Actualización via SSE.

const PIPELINE_STEPS = [
  { id: "idea",      label: "Idea",      emoji: "💡", cmd: "/forge" },
  { id: "discovery", label: "Discovery", emoji: "🔍", cmd: "/sdd.descubrir" },
  { id: "ir",        label: "IR",        emoji: "📝", cmd: "/sdd.interpretar" },
  { id: "design",    label: "Diseño",    emoji: "🎨", cmd: "/sdd.diseñar" },
  { id: "spec",      label: "Spec",      emoji: "📋", cmd: "/sdd.especificar" },
  { id: "plan",      label: "Plan",      emoji: "🗺️", cmd: "/sdd.planificar" },
  { id: "tasks",     label: "Tareas",    emoji: "📌", cmd: "/sdd.tareas" },
  { id: "code",      label: "Código",    emoji: "⚙️", cmd: "/sdd.implementar" },
  { id: "done",      label: "✓ Listo",   emoji: "✅", cmd: "/sdd.verificar" },
];

// ─── Layout SVG ───────────────────────────────────────────────────────────────

const NODE_W   = 80;
const NODE_H   = 44;
const NODE_R   = 8;
const GAP      = 20;
const ARROW    = 14;
const PADDING  = 16;
const LABEL_Y  = 28;
const EMOJI_Y  = 16;

function totalWidth() {
  return PADDING * 2 + PIPELINE_STEPS.length * NODE_W + (PIPELINE_STEPS.length - 1) * GAP;
}

function nodeX(i) {
  return PADDING + i * (NODE_W + GAP);
}

function nodeCenterX(i) {
  return nodeX(i) + NODE_W / 2;
}

// ─── Colores por estado ───────────────────────────────────────────────────────

function nodeColor(state) {
  if (state === "done")    return { fill: "#1a3320", stroke: "#4ade80", text: "#4ade80" };
  if (state === "active")  return { fill: "#0f1e36", stroke: "#6ea8fe", text: "#e6e9ef" };
  return { fill: "#161a21", stroke: "#272d39", text: "#6b7280" };
}

// ─── Render SVG ───────────────────────────────────────────────────────────────

function buildSVG(currentStep, estado) {
  const W   = totalWidth();
  const H   = NODE_H + PADDING * 2 + 32; // espacio para label de proyecto
  const idx = Math.max(0, PIPELINE_STEPS.findIndex(s => s.id === currentStep));

  let html = "";

  // Nombre del proyecto y badge del paso actual
  const projectName = estado?.spec_activa
    ? estado.spec_activa.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/-/g, " ")
    : "Tu proyecto";
  const step = PIPELINE_STEPS[idx];
  const progress = Math.round(((idx + 1) / PIPELINE_STEPS.length) * 100);

  html += `
    <div class="pipeline-header" style="margin-bottom:1rem">
      <h2 class="project-name" style="font-size:1.2rem;margin-bottom:.4rem">${esc(titleCase(projectName))}</h2>
      <span class="step-badge" style="font-size:.8rem">${step.emoji} ${esc(step.label)} · ${progress}%</span>
    </div>
  `;

  // SVG del grafo
  html += `<div class="pipeline-svg-wrap"><svg
    class="pipeline-svg"
    viewBox="0 0 ${W} ${H}"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="Flujo del pipeline FORGE"
    style="width:100%;height:auto;min-width:${Math.min(W, 340)}px">`;

  // Aristas (flechas entre nodos)
  for (let i = 0; i < PIPELINE_STEPS.length - 1; i++) {
    const x1 = nodeX(i) + NODE_W;
    const x2 = nodeX(i + 1);
    const cy  = PADDING + NODE_H / 2;
    const state = i < idx ? "done" : i === idx ? "active" : "pending";
    const color = i < idx ? "#4ade80" : "#272d39";

    // Línea
    html += `<line x1="${x1}" y1="${cy}" x2="${x2 - ARROW}" y2="${cy}"
      stroke="${color}" stroke-width="2" />`;

    // Punta de flecha
    html += `<polygon points="${x2 - ARROW},${cy - 4} ${x2},${cy} ${x2 - ARROW},${cy + 4}"
      fill="${color}" />`;
  }

  // Nodos
  for (let i = 0; i < PIPELINE_STEPS.length; i++) {
    const s     = PIPELINE_STEPS[i];
    const state = i < idx ? "done" : i === idx ? "active" : "pending";
    const c     = nodeColor(state);
    const x     = nodeX(i);
    const y     = PADDING;
    const cx    = nodeCenterX(i);

    // Rect con animación si activo
    const animClass = state === "active" ? ` class="node-active"` : "";
    html += `<rect${animClass} x="${x}" y="${y}" width="${NODE_W}" height="${NODE_H}"
      rx="${NODE_R}" ry="${NODE_R}"
      fill="${c.fill}" stroke="${c.stroke}" stroke-width="${state === "active" ? 2 : 1.5}" />`;

    // Emoji
    html += `<text x="${cx}" y="${y + EMOJI_Y}" text-anchor="middle"
      font-size="13" dominant-baseline="middle">${s.emoji}</text>`;

    // Label
    html += `<text x="${cx}" y="${y + LABEL_Y}" text-anchor="middle"
      font-size="10" font-family="system-ui,sans-serif"
      fill="${c.text}" dominant-baseline="middle">${esc(s.label)}</text>`;
  }

  html += `</svg></div>`;

  // Detalle del paso activo
  html += buildActiveDetail(idx, estado);

  // Última actualización
  if (estado?.ultima_actualizacion) {
    html += `<p class="last-update">Último cambio: ${formatDate(estado.ultima_actualizacion)}</p>`;
  }

  return html;
}

function buildActiveDetail(idx, estado) {
  const step = PIPELINE_STEPS[idx];
  if (!step) return "";

  const artefactos = estado?.artefactos_sesion ?? {};
  let detalles = "";

  if (artefactos.ir_confidence !== undefined && artefactos.ir_confidence !== null) {
    const conf = Number(artefactos.ir_confidence);
    const color = conf >= 0.85 ? "#4ade80" : conf >= 0.7 ? "#facc15" : "#f87171";
    detalles += `<span class="detail-chip" style="background:${color}22;border-color:${color};color:${color}">
      IR confidence: ${(conf * 100).toFixed(0)}%</span>`;
  }
  if (artefactos.stack_decidido) {
    detalles += `<span class="detail-chip">Stack: ${esc(artefactos.stack_decidido)}</span>`;
  }
  if (artefactos.complejidad_estimada) {
    detalles += `<span class="detail-chip">Complejidad: ${esc(artefactos.complejidad_estimada)}</span>`;
  }

  return `
    <div class="active-detail" id="active-agents-slot">
      <div class="active-detail-header">
        <span>${step.emoji} ${esc(step.label)}</span>
        <code class="cmd-badge">${esc(step.cmd)}</code>
      </div>
      ${detalles ? `<div class="detail-chips">${detalles}</div>` : ""}
      <div id="agents-inline"></div>
    </div>`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function titleCase(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

function formatDate(iso) {
  try { return new Date(iso).toLocaleString("es", { dateStyle: "short", timeStyle: "short" }); }
  catch { return iso; }
}

// ─── SSE + Carga inicial ─────────────────────────────────────────────────────

let lastHash = "";

function handleEstado(data) {
  const hash = JSON.stringify(data);
  if (hash !== lastHash) {
    lastHash = hash;
    render(data);
  }
}

export function init() {
  // Carga inicial
  fetch("/estado")
    .then(r => r.json())
    .then(handleEstado)
    .catch(() => {
      const c = document.getElementById("view-pipeline");
      if (c) c.innerHTML = `<p class="error">No se puede conectar con el servidor FORGE.</p>`;
    });

  // Actualizaciones en tiempo real via SSE (fallback polling gestionado en sse.js)
  onEstado(handleEstado);
}