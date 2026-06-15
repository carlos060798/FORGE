const fs = require("fs");

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
    expect(Object.keys(agrupadas)).toHaveLength(2);
    expect(agrupadas["src/auth.ts"]).toHaveLength(2);
    expect(agrupadas["src/ui.tsx"]).toHaveLength(1);
  });

  test("Calcula escape rate correctamente", () => {
    // Total 5 bugs, encontrados 4 → 1 escapó → 20%
    expect(calcularEscapeRate(5, 4)).toBe(20);

    // Total 10 bugs, encontrados 9 → 1 escapó → 10%
    expect(calcularEscapeRate(10, 9)).toBe(10);

    // Total 4 bugs, encontrados 4 → 0 escaparon → 0%
    expect(calcularEscapeRate(4, 4)).toBe(0);

    // Total 4 bugs, encontrados 0 → 4 escaparon → 100%
    expect(calcularEscapeRate(4, 0)).toBe(100);
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

    expect(inestables).toHaveLength(1);
    expect(inestables[0]).toBe("src/auth.ts");
  });

  test("Calcula quality score por agente", () => {
    const mutPorAgente = {
      "backend-dev": [
        { found: true },
        { found: true },
        { found: true },
        { found: false },
      ], // 3/4 bugs encontrados = 75%
      "frontend-dev": [{ found: true }, { found: true }], // 2/2 = 100%
    };

    for (const [agente, muts] of Object.entries(mutPorAgente)) {
      const encontrados = muts.filter((m) => m.found).length;
      const score = Math.round((encontrados / muts.length) * 100);
      console.log(`${agente}: ${score}%`);
    }

    expect(
      Math.round((mutPorAgente["backend-dev"].filter((m) => m.found).length / 4) * 100)
    ).toBe(75);
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

    expect(mejoraNeeded).toHaveLength(1);
    expect(mejoraNeeded[0]).toBe("revisor");
  });
});
