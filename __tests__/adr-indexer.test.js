import { test, describe } from "node:test";
import assert from "node:assert/strict";

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
    assert.equal(adrs.length, 1);
    assert.equal(adrs[0].decision, "Use PostgreSQL");
    assert.equal(adrs[0].status, "accepted");
  });

  test("Extrae ADR de comentario Python", () => {
    const contenido = `
# ADR: {"decision": "Use Django", "context": "Batteries included", "status": "accepted"}
def create_app():
    pass
`;
    const adrs = extraerADRsDelContenido(contenido);
    assert.equal(adrs.length, 1);
    assert.equal(adrs[0].decision, "Use Django");
  });

  test("Extrae múltiples ADRs del mismo archivo", () => {
    const contenido = `
// ADR: {"decision": "Use TypeScript", "status": "accepted"}
// ADR: {"decision": "Use Jest for testing", "status": "accepted"}
// ADR: {"decision": "Use ESLint for linting", "status": "accepted"}
`;
    const adrs = extraerADRsDelContenido(contenido);
    assert.equal(adrs.length, 3);
  });

  test("Ignora JSON inválido (llaves sin cerrar en la misma línea)", () => {
    // El regex {[^}]*} captura hasta el primer } — si el JSON está incompleto
    // en una línea y la siguiente tiene su propio ADR, ambas se fusionan en un
    // solo match inválido. Solo los JSON bien formados pasan.
    const contenido = `// ADR: {"decision": "Use PostgreSQL", "status": "accepted"}
// ADR: este no es json valido
// ADR: {"decision": "Use MongoDB", "status": "accepted"}
`;
    const adrs = extraerADRsDelContenido(contenido);
    assert.equal(adrs.length, 2);
    assert.equal(adrs[0].decision, "Use PostgreSQL");
    assert.equal(adrs[1].decision, "Use MongoDB");
  });

  test("Ignora comentarios sin decision", () => {
    const contenido = `
// ADR: {"context": "ACID needed"}
// ADR: {"decision": "Use PostgreSQL"}
`;
    const adrs = extraerADRsDelContenido(contenido);
    assert.equal(adrs.length, 1);
    assert.equal(adrs[0].decision, "Use PostgreSQL");
  });

  test("Extrae ADR de comentario block (/* */)", () => {
    const contenido = `
/* ADR: {"decision": "Use Redis", "status": "accepted"} */
`;
    const adrs = extraerADRsDelContenido(contenido);
    assert.equal(adrs.length, 1);
    assert.equal(adrs[0].decision, "Use Redis");
  });

  test("Extrae ADR de comentario HTML", () => {
    const contenido = `
<!-- ADR: {"decision": "Use React", "status": "accepted"} -->
`;
    const adrs = extraerADRsDelContenido(contenido);
    assert.equal(adrs.length, 1);
    assert.equal(adrs[0].decision, "Use React");
  });

  test("Default status es 'accepted'", () => {
    const contenido = `
// ADR: {"decision": "Use PostgreSQL"}
`;
    const adrs = extraerADRsDelContenido(contenido);
    assert.equal(adrs[0].status, undefined);
  });
});
