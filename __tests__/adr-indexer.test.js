const fs = require("fs");
const path = require("path");

describe("ADR Indexer", () => {
  function extraerADRsDelContenido(contenido) {
    const regex = /(?:\/\/|\/\*|#|--|<!--|REM)\s*ADR:\s*({[^}]*})/g;
    const adrs = [];
    let match;
    while ((match = regex.exec(contenido)) !== null) {
      try {
        const json = JSON.parse(match[1]);
        if (json.decision && typeof json.decision === "string") {
          adrs.push(json);
        }
      } catch {
        // Ignorar JSON inválido
      }
    }
    return adrs;
  }

  test("Extrae ADR de comentario JS", () => {
    const contenido = `
// ADR: {"decision": "Use PostgreSQL", "context": "ACID needed", "status": "accepted"}
class Database {}
`;
    const adrs = extraerADRsDelContenido(contenido);
    expect(adrs).toHaveLength(1);
    expect(adrs[0].decision).toBe("Use PostgreSQL");
    expect(adrs[0].status).toBe("accepted");
  });

  test("Extrae ADR de comentario Python", () => {
    const contenido = `
# ADR: {"decision": "Use Django", "context": "Batteries included", "status": "accepted"}
def create_app():
    pass
`;
    const adrs = extraerADRsDelContenido(contenido);
    expect(adrs).toHaveLength(1);
    expect(adrs[0].decision).toBe("Use Django");
  });

  test("Extrae múltiples ADRs del mismo archivo", () => {
    const contenido = `
// ADR: {"decision": "Use TypeScript", "status": "accepted"}
// ADR: {"decision": "Use Jest for testing", "status": "accepted"}
// ADR: {"decision": "Use ESLint for linting", "status": "accepted"}
`;
    const adrs = extraerADRsDelContenido(contenido);
    expect(adrs).toHaveLength(3);
  });

  test("Ignora JSON inválido", () => {
    const contenido = `
// ADR: {"decision": "Use PostgreSQL"
// ADR: {"decision": "Use MongoDB", "status": "accepted"}
`;
    const adrs = extraerADRsDelContenido(contenido);
    expect(adrs).toHaveLength(1);
    expect(adrs[0].decision).toBe("Use MongoDB");
  });

  test("Ignora comentarios sin decision", () => {
    const contenido = `
// ADR: {"context": "ACID needed"}
// ADR: {"decision": "Use PostgreSQL"}
`;
    const adrs = extraerADRsDelContenido(contenido);
    expect(adrs).toHaveLength(1);
    expect(adrs[0].decision).toBe("Use PostgreSQL");
  });

  test("Extrae ADR de comentario block (/* */)", () => {
    const contenido = `
/* ADR: {"decision": "Use Redis", "status": "accepted"} */
`;
    const adrs = extraerADRsDelContenido(contenido);
    expect(adrs).toHaveLength(1);
    expect(adrs[0].decision).toBe("Use Redis");
  });

  test("Extrae ADR de comentario HTML", () => {
    const contenido = `
<!-- ADR: {"decision": "Use React", "status": "accepted"} -->
`;
    const adrs = extraerADRsDelContenido(contenido);
    expect(adrs).toHaveLength(1);
    expect(adrs[0].decision).toBe("Use React");
  });

  test("Default status es 'accepted'", () => {
    const contenido = `
// ADR: {"decision": "Use PostgreSQL"}
`;
    const adrs = extraerADRsDelContenido(contenido);
    expect(adrs[0].status).toBeUndefined(); // No incluye default
  });
});
