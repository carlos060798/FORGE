#!/usr/bin/env node
import { createServer } from "./mcp.js";
import { analyzeDesignSystem, evaluateUIConsistency } from "./design-system-analyzer.js";
import { getFileMeta, getFileComponents, getNodeById } from "./figma-client.js";
import { mapColors, mapTypography, buildMappingReport } from "./style-mapper.js";
import { generateComponent, suggestImprovements } from "./component-generator.js";

const server = createServer({ name: "sdd-figma-mcp", version: "1.0.0" });

// ── 1. analizar_sistema_diseño ────────────────────────────────────────────────
server.tool({
  name: "analizar_sistema_diseño",
  description: "Analiza el sistema de diseño del proyecto local: framework, CSS, tokens de color, tipografía, espaciado y componentes existentes. Ejecutar SIEMPRE antes de generar código UI.",
  annotations: { readOnlyHint: true, destructiveHint: false },
  inputSchema: { type: "object", properties: { project_root: { type: "string", description: "Ruta absoluta a la raíz del proyecto (donde está package.json)" } }, required: ["project_root"] },
}, async ({ project_root }) => {
  const p = analyzeDesignSystem(project_root);
  return { content: [{ type: "text", text: JSON.stringify({ ok: true, stack: p.stack, colores: Object.keys(p.colors).length ? p.colors : "(no detectados)", tipografia: { fuentes: p.typography.fontFamilies, tamaños: Object.keys(p.typography.fontSizes).length ? p.typography.fontSizes : "(no detectados)", pesos: p.typography.fontWeights }, espaciado: Object.keys(p.spacing).length ? p.spacing : "(no detectado)", breakpoints: Object.keys(p.breakpoints).length ? p.breakpoints : "(no detectados)", borderRadius: p.borderRadius, sombras: p.shadows, componentesExistentes: p.existingComponents, fuentesLeidas: p.rawSources }, null, 2) }] };
});

// ── 2. evaluar_ui_existente ───────────────────────────────────────────────────
server.tool({
  name: "evaluar_ui_existente",
  description: "Score 0-100 de la calidad del sistema de diseño + lista de problemas y sugerencias priorizadas.",
  annotations: { readOnlyHint: true, destructiveHint: false },
  inputSchema: { type: "object", properties: { project_root: { type: "string" } }, required: ["project_root"] },
}, async ({ project_root }) => {
  const p = analyzeDesignSystem(project_root);
  const e = evaluateUIConsistency(project_root, p);
  return { content: [{ type: "text", text: JSON.stringify({ ok: true, score: `${e.score}/100`, problemas: e.issues, sugerencias: e.suggestions, coberturaComponentes: e.componentCoverage }, null, 2) }] };
});

// ── 3. conectar_figma ─────────────────────────────────────────────────────────
server.tool({
  name: "conectar_figma",
  description: "Verifica PAT y devuelve metadata del archivo Figma (nombre, versión, cantidad de componentes y estilos).",
  annotations: { readOnlyHint: true, destructiveHint: false },
  inputSchema: { type: "object", properties: { file_key: { type: "string", description: "Clave del archivo — extraída de la URL: figma.com/file/AQUI/nombre" } }, required: ["file_key"] },
}, async ({ file_key }) => {
  const meta = await getFileMeta(file_key);
  return { content: [{ type: "text", text: JSON.stringify({ ok: true, ...meta }, null, 2) }] };
});

// ── 4. listar_componentes ─────────────────────────────────────────────────────
server.tool({
  name: "listar_componentes",
  description: "Lista todos los componentes publicados en el archivo Figma. Acepta filtro opcional por nombre.",
  annotations: { readOnlyHint: true, destructiveHint: false },
  inputSchema: { type: "object", properties: { file_key: { type: "string" }, filter: { type: "string", description: "Texto para filtrar por nombre (opcional)" } }, required: ["file_key"] },
}, async ({ file_key, filter }) => {
  const all = await getFileComponents(file_key);
  const list = filter ? all.filter(c => c.name.toLowerCase().includes(filter.toLowerCase())) : all;
  return { content: [{ type: "text", text: JSON.stringify({ ok: true, total: list.length, components: list.map(c => ({ name: c.name, key: c.key, description: c.description || "(sin descripción)" })) }, null, 2) }] };
});

// ── 5. traer_componente ───────────────────────────────────────────────────────
server.tool({
  name: "traer_componente",
  description: "Trae el detalle completo de un nodo Figma: estructura, fills, estilos de texto, dimensiones e hijos directos.",
  annotations: { readOnlyHint: true, destructiveHint: false },
  inputSchema: { type: "object", properties: { file_key: { type: "string" }, node_id: { type: "string", description: "ID del nodo — visible en la URL al seleccionar un frame: ?node-id=AQUI" } }, required: ["file_key", "node_id"] },
}, async ({ file_key, node_id }) => {
  const detail = await getNodeById(file_key, node_id);
  const nd = detail.nodes[node_id];
  if (!nd) throw new Error(`Nodo ${node_id} no encontrado`);
  const n = nd.document;
  return { content: [{ type: "text", text: JSON.stringify({ ok: true, id: n.id, name: n.name, type: n.type, dimensiones: n.absoluteBoundingBox ? { ancho: n.absoluteBoundingBox.width, alto: n.absoluteBoundingBox.height } : null, fills: n.fills ?? [], estiloTexto: n.style ?? null, hijos: (n.children ?? []).map(c => ({ id: c.id, name: c.name, type: c.type, fills: c.fills ?? [] })) }, null, 2) }] };
});

// ── 6. mapear_estilos ─────────────────────────────────────────────────────────
server.tool({
  name: "mapear_estilos",
  description: "Cruza colores y tipografía de un nodo Figma con los tokens del proyecto. Devuelve mapeo con nivel de confianza y lista de tokens sin equivalente.",
  annotations: { readOnlyHint: true, destructiveHint: false },
  inputSchema: { type: "object", properties: { file_key: { type: "string" }, node_id: { type: "string" }, project_root: { type: "string" } }, required: ["file_key", "node_id", "project_root"] },
}, async ({ file_key, node_id, project_root }) => {
  const [detail, profile] = await Promise.all([getNodeById(file_key, node_id), Promise.resolve(analyzeDesignSystem(project_root))]);
  const nd = detail.nodes[node_id];
  if (!nd) throw new Error(`Nodo ${node_id} no encontrado`);
  const all = [nd.document, ...(nd.document.children ?? [])];
  const colorMappings = mapColors(all.filter(n => n.fills?.length).map(n => ({ name: n.name, fills: n.fills })), profile);
  const typographyMappings = mapTypography(all.filter(n => n.style && n.type === "TEXT").map(n => ({ name: n.name, style: n.style })), profile);
  return { content: [{ type: "text", text: JSON.stringify({ ok: true, ...buildMappingReport(colorMappings, typographyMappings) }, null, 2) }] };
});

// ── 7. generar_componente ─────────────────────────────────────────────────────
server.tool({
  name: "generar_componente",
  description: "Genera código del componente (React/Vue) usando los tokens del proyecto. No hardcodea valores de Figma.",
  annotations: { readOnlyHint: false, destructiveHint: false },
  inputSchema: { type: "object", properties: { file_key: { type: "string" }, node_id: { type: "string" }, project_root: { type: "string" } }, required: ["file_key", "node_id", "project_root"] },
}, async ({ file_key, node_id, project_root }) => {
  const [detail, profile] = await Promise.all([getNodeById(file_key, node_id), Promise.resolve(analyzeDesignSystem(project_root))]);
  const nd = detail.nodes[node_id];
  if (!nd) throw new Error(`Nodo ${node_id} no encontrado`);
  const node = nd.document;
  const all = [node, ...(node.children ?? [])];
  const colorMappings = mapColors(all.filter(n => n.fills?.length).map(n => ({ name: n.name, fills: n.fills })), profile);
  const g = generateComponent(node, profile, colorMappings);
  const cssExt = profile.stack.cssApproach === "css-modules" ? ".module.css" : ".css";
  const cssFile = g.cssSnippet ? `src/components/${g.filename.replace(/\.tsx$/, cssExt)}` : null;
  return { content: [{ type: "text", text: JSON.stringify({ ok: true, filename: g.filename, framework: profile.stack.framework, cssApproach: profile.stack.cssApproach, code: g.code, cssSnippet: g.cssSnippet, advertencias: g.warnings, instrucciones: [`Guarda en src/components/${g.filename}`, ...(cssFile ? [`Crea ${cssFile} con el CSS snippet`] : []), "Revisa los colores y agrega props de accesibilidad según el contexto"] }, null, 2) }] };
});

// ── 8. sugerir_mejoras ────────────────────────────────────────────────────────
server.tool({
  name: "sugerir_mejoras",
  description: "Lista priorizada (alta/media/baja) de mejoras al sistema de diseño del proyecto.",
  annotations: { readOnlyHint: true, destructiveHint: false },
  inputSchema: { type: "object", properties: { project_root: { type: "string" } }, required: ["project_root"] },
}, async ({ project_root }) => {
  const improvements = suggestImprovements(analyzeDesignSystem(project_root));
  return { content: [{ type: "text", text: JSON.stringify({ ok: true, total: improvements.length, porPrioridad: { alta: improvements.filter(i => i.priority === "alta"), media: improvements.filter(i => i.priority === "media"), baja: improvements.filter(i => i.priority === "baja") } }, null, 2) }] };
});
