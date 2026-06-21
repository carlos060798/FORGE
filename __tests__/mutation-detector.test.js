import { test, describe } from "node:test";
import assert from "node:assert/strict";

describe("Mutation Detector", () => {
  function agruparMutacionesPorArchivo(mutaciones) {
    const agrupar = {};
    for (const mut of mutaciones) {
      if (!agrupar[mut.archivo]) {
        agrupar[mut.archivo] = [];
      }
      agrupar[mut.archivo].push(mut);
    }
    return agrupar;
  }

  function calcularEscapeRate(totalBugs, bugsEncontrados) {
    if (totalBugs === 0) return 0;
    return Math.round(((totalBugs - bugsEncontrados) / totalBugs) * 100);
  }

  test("Agrupa mutaciones por archivo", () => {
    const mutaciones = [
      { archivo: "src/auth.ts", agente: "backend" },
      { archivo: "src/auth.ts", agente: "backend" },
      { archivo: "src/ui.tsx", agente: "frontend" },
    ];

    const agrupadas = agruparMutacionesPorArchivo(mutaciones);
    assert.equal(Object.keys(agrupadas).length, 2);
    assert.equal(agrupadas["src/auth.ts"].length, 2);
    assert.equal(agrupadas["src/ui.tsx"].length, 1);
  });

  test("Calcula escape rate correctamente", () => {
    assert.equal(calcularEscapeRate(5, 4), 20);
    assert.equal(calcularEscapeRate(10, 9), 10);
    assert.equal(calcularEscapeRate(4, 4), 0);
    assert.equal(calcularEscapeRate(4, 0), 100);
  });

  test("Detecta archivos inestables (>2 mutaciones)", () => {
    const archivos = {
      "src/auth.ts": [
        { ts: "2026-06-10" },
        { ts: "2026-06-10" },
        { ts: "2026-06-10" },
      ],
      "src/ui.tsx": [{ ts: "2026-06-10" }],
    };

    const inestables = Object.entries(archivos)
      .filter(([_, muts]) => muts.length > 2)
      .map(([archivo]) => archivo);

    assert.equal(inestables.length, 1);
    assert.equal(inestables[0], "src/auth.ts");
  });

  test("Calcula quality score por agente", () => {
    const mutPorAgente = {
      "backend-dev": [
        { found: true },
        { found: true },
        { found: true },
        { found: false },
      ],
      "frontend-dev": [{ found: true }, { found: true }],
    };

    assert.equal(
      Math.round((mutPorAgente["backend-dev"].filter((m) => m.found).length / 4) * 100),
      75
    );
    assert.equal(
      Math.round((mutPorAgente["frontend-dev"].filter((m) => m.found).length / 2) * 100),
      100
    );
  });

  test("Identifica agentes con mejora necesaria", () => {
    const scores = {
      "backend-dev": 75,
      "frontend-dev": 88,
      "revisor": 67,
    };

    const mejoraNeeded = Object.entries(scores)
      .filter(([_, score]) => score < 75)
      .map(([agente]) => agente);

    assert.equal(mejoraNeeded.length, 1);
    assert.equal(mejoraNeeded[0], "revisor");
  });
});
