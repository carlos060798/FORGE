// @ts-check
import { existsSync, readFileSync } from "node:fs";
import { join, isAbsolute, relative } from "node:path";
import { c, info, aviso, error, paso, escribirSeguro } from "./comun.js";

/**
 * forge aprobar spec | forge aprobar delegacion <carpeta>/<archivo>.md
 *
 * Exige un terminal interactivo real y que la persona teclee un código de un solo uso; deja la aprobación en
 * `.sdd/aprobaciones.jsonl` con quién, cuándo, qué y el hash del archivo. NO existe opción para saltarse el
 * terminal. Límite: con el mismo usuario del SO no hay separación criptográfica total (ver
 * core/aprobaciones-identidad.js y la spec 2026-11-06-aprobaciones-con-identidad).
 */
export async function cmdAprobar(subArgs) {
  const objetivo = subArgs[0];
  const desconocida = subArgs.slice(1).find((a) => a.startsWith("-"));
  if (desconocida) error(`Opción desconocida: ${desconocida}. «forge aprobar» no tiene opciones: exige un terminal real y un código que tecleas tú.`);
  if (objetivo !== "spec" && objetivo !== "delegacion") {
    aviso("Uso: forge aprobar spec | forge aprobar delegacion <carpeta>/<archivo>.md");
    aviso("  spec: aprueba la spec activa para permitir avanzar a la fase de planificación.");
    aviso("  delegacion: registra que TÚ aprobaste un archivo marcado «aprobado_por_delegacion».");
    return;
  }
  const idm = await import("../../core/aprobaciones-identidad.js");
  const real = {
    stdin: process.stdin, stdout: process.stdout,
    leerLinea: (p) => idm.leerLineaDeTerminal(process.stdin, process.stdout, p),
    escribir: (t) => process.stdout.write(t),
  };
  const aprobar = async (datos) => {
    try { return await idm.aprobarConIdentidad({ cwd: process.cwd(), ...datos, ...real }); } catch (e) {
      if (e instanceof idm.ErrorIdentidad) error(e.message);
      throw e;
    }
  };

  if (objetivo === "delegacion") {
    const rel = subArgs[1];
    if (!rel || !/^[\w.-]+\/[\w.-]+\.md$/.test(rel)) { aviso("Uso: forge aprobar delegacion <carpeta>/<archivo>.md  (dentro de .sdd/especificaciones/)"); return; }
    const abs = join(process.cwd(), ".sdd", "especificaciones", rel);
    let sha = null;
    try { sha = idm.hashDeArchivo(process.cwd(), abs); } catch (e) { error(`No se lee ${rel}: ${e.message}`); }
    if (sha === null) { error(`No existe .sdd/especificaciones/${rel}`); }
    const r = await aprobar({ tipo: "delegacion", id: rel, artefacto: `.sdd/especificaciones/${rel}`, sha256: sha });
    info(`Aprobación registrada en .sdd/aprobaciones.jsonl (${r.quien.email ?? r.quien.usuarioSO}, ${r.cuando}).`);
    return;
  }

  const estadoPath = join(process.cwd(), ".sdd", "estado.json");
  if (!existsSync(estadoPath)) {
    aviso("No existe .sdd/estado.json — ejecuta primero 'forge init' y luego /forge en Claude Code");
    return;
  }
  let estado;
  try { estado = JSON.parse(readFileSync(estadoPath, "utf8")); } catch {
    aviso("estado.json malformado — borra o regenera con /sdd.estado"); return;
  }
  if (!estado.spec_activa && !estado.spec_draft_path) {
    aviso("No hay spec activa ni draft para aprobar.");
    aviso("  Ejecuta primero /sdd.diseñar en Claude Code para generar la spec.");
    return;
  }
  if (estado.spec_aprobado) {
    info("La spec ya está aprobada ✓ — puedes avanzar a la planificación.");
    return;
  }
  // Qué se aprueba: el archivo de la spec (borrador indicado, o spec.md de la spec activa) y su hash
  const rutaSpec = estado.spec_draft_path
    ? (isAbsolute(String(estado.spec_draft_path)) ? String(estado.spec_draft_path) : join(process.cwd(), String(estado.spec_draft_path)))
    : join(process.cwd(), ".sdd", "especificaciones", String(estado.spec_activa), "spec.md");
  let sha = null;
  try { sha = idm.hashDeArchivo(process.cwd(), rutaSpec); } catch (e) { error(`No se lee la spec: ${e.message}`); }
  if (sha === null) error(`No se encuentra el archivo de la spec a aprobar (${relative(process.cwd(), rutaSpec)}): no se aprueba algo que no se puede leer ni fijar con un hash.`);

  await aprobar({
    tipo: "spec", id: String(estado.spec_activa ?? estado.spec_draft_path), artefacto: relative(process.cwd(), rutaSpec).split("\\").join("/"), sha256: sha,
  });
  const nuevo = { ...estado, spec_aprobado: true, ultima_actualizacion: new Date().toISOString() };
  // Por escritura segura: no se aprueba "a través" de un enlace hacia fuera del proyecto
  if (!escribirSeguro(estadoPath, JSON.stringify(nuevo, null, 2))) {
    error("No se aprobó nada: .sdd/estado.json o su carpeta es un enlace.");
  }
  info("✅ Spec aprobada y registrada en .sdd/aprobaciones.jsonl. Ahora puedes avanzar a la fase de planificación.");
  info("   Siguiente paso: /sdd.planificar en Claude Code");
}
