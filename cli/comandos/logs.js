// @ts-check
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { c, aviso, titulo } from "./comun.js";

export function cmdLogs(args) {
  // Parsear --last N (default 20)
  const lastIdx = args.findIndex(a => a === "--last" || a.startsWith("--last="));
  let last = 20;
  if (lastIdx !== -1) {
    const raw = args[lastIdx].includes("=")
      ? args[lastIdx].split("=")[1]
      : args[lastIdx + 1];
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n > 0) last = n;
  }

  const ledgerPath = join(process.cwd(), ".sdd", "observabilidad", "consumo.jsonl");

  console.log("");
  titulo("FORGE — Historial de consumo (.sdd/observabilidad/consumo.jsonl)");

  if (!existsSync(ledgerPath)) {
    aviso("El archivo consumo.jsonl no existe todavía.");
    aviso("Se crea automáticamente cuando los agentes FORGE ejecutan tareas.");
    console.log("");
    return;
  }

  // Parsear JSONL
  const lineas = readFileSync(ledgerPath, "utf8")
    .split("\n")
    .filter(l => l.trim().length > 0);

  const entradas = [];
  for (const linea of lineas) {
    try {
      entradas.push(JSON.parse(linea));
    } catch {
      // Ignora líneas malformadas
    }
  }

  if (entradas.length === 0) {
    aviso("El archivo consumo.jsonl existe pero no contiene entradas válidas.");
    console.log("");
    return;
  }

  // Tomar las últimas N
  const muestra = entradas.slice(-last);

  // Anchos de columna fijos
  const COL = { hora: 8, agente: 20, inp: 7, out: 7, est: 7, usd: 8, archivo: 24 };

  function pad(s, w) { return String(s ?? "").padEnd(w).slice(0, w); }
  function padL(s, w) { return String(s ?? "").padStart(w).slice(-w); }

  const sep = "─".repeat(
    2 + COL.hora + 1 + COL.agente + 1 + COL.inp + 1 + COL.out + 1 + COL.est + 1 + COL.usd + 1 + COL.archivo
  );

  console.log(sep);
  console.log(
    "  " +
    pad("Hora", COL.hora) + " " +
    pad("Agente", COL.agente) + " " +
    padL("In", COL.inp) + " " +
    padL("Out", COL.out) + " " +
    padL("Est", COL.est) + " " +
    padL("USD", COL.usd) + " " +
    pad("Archivo", COL.archivo)
  );
  console.log(sep);

  let totalIn = 0, totalOut = 0, totalEst = 0, totalUsd = 0;

  for (const e of muestra) {
    // Timestamp abreviado: HH:MM:SS
    let hora = "";
    if (e.timestamp) {
      try {
        const d = new Date(e.timestamp);
        hora = d.toTimeString().slice(0, 8);
      } catch { hora = String(e.timestamp).slice(0, 8); }
    }

    const agente   = e.agente ?? e.agent ?? "";
    const inp      = e.tokens_input  ?? e.input_tokens  ?? 0;
    const out      = e.tokens_output ?? e.output_tokens ?? 0;
    const est      = e.tokens_est    ?? e.estimated_tokens ?? 0;
    const usd      = e.costo_usd     ?? e.cost_usd ?? null;
    const archivo  = e.archivo ?? e.file ?? "";

    totalIn  += Number(inp)  || 0;
    totalOut += Number(out)  || 0;
    totalEst += Number(est)  || 0;
    totalUsd += Number(usd)  || 0;

    const usdStr = usd != null ? `$${Number(usd).toFixed(3)}` : "";

    console.log(
      "  " +
      pad(hora, COL.hora) + " " +
      pad(agente, COL.agente) + " " +
      padL(inp || "", COL.inp) + " " +
      padL(out || "", COL.out) + " " +
      padL(est || "", COL.est) + " " +
      padL(usdStr, COL.usd) + " " +
      pad(archivo, COL.archivo)
    );
  }

  console.log(sep);

  const totalUsdStr = totalUsd > 0 ? `$${totalUsd.toFixed(3)}` : "";
  const label = `Total (${muestra.length} entrada${muestra.length !== 1 ? "s" : ""})`;
  console.log(
    "  " +
    pad(label, COL.hora + 1 + COL.agente) + " " +
    padL(totalIn  || "", COL.inp) + " " +
    padL(totalOut || "", COL.out) + " " +
    padL(totalEst || "", COL.est) + " " +
    padL(totalUsdStr, COL.usd)
  );
  console.log(sep);

  if (entradas.length > last) {
    console.log(`  (mostrando últimas ${last} de ${entradas.length} entradas — usa --last N para ver más)`);
  }
  console.log("");
}
