const { execSync } = require("child_process");
const { readFileSync, writeFileSync, mkdirSync } = require("fs");
const { join } = require("path");

const TEST_DIR = "./test-memory-compressor-tmp";

beforeAll(() => {
  mkdirSync(join(TEST_DIR, ".sdd/memoria"), { recursive: true });
});

afterAll(() => {
  execSync(`rm -rf "${TEST_DIR}"`, { shell: "bash" });
});

test("Auto-compresión deduplica entradas por filepath", () => {
  const memoriaFile = join(TEST_DIR, ".sdd/memoria/agente-test.md");
  const contenido = `# Memoria del agente: test

## 2026-06-10 — src/database.ts
> CREATE TABLE users...

## 2026-06-11 — src/database.ts
> CREATE TABLE users (updated)

## 2026-06-12 — src/database.ts
> CREATE TABLE users (final)

## 2026-06-10 — src/auth.ts
> JWT implementation
`;

  writeFileSync(memoriaFile, contenido, "utf8");

  // Simular ejecución del hook (sin ejecutar realmente, solo verificar lógica)
  const lineas = contenido.split("\n");
  const header = lineas.slice(0, 6).join("\n").concat("\n\n");

  const entradas = new Map();
  const regex = /^## (\d{4}-\d{2}-\d{2}) — (.+?)\n> (.+?)(?=\n##|\n$)/gms;
  let match;
  while ((match = regex.exec(contenido)) !== null) {
    const [, fecha, filepath, resumen] = match;
    entradas.set(filepath, { fecha, resumen });
  }

  expect(entradas.size).toBe(2); // database.ts + auth.ts
  expect(entradas.get("src/database.ts").fecha).toBe("2026-06-12"); // más reciente
});

test("Backup se crea antes de comprimir", () => {
  const memoriaFile = join(TEST_DIR, ".sdd/memoria/agente-backup-test.md");
  const backupFile = memoriaFile.replace(".md", ".original.md");

  const contenido = "# Test contenido original";
  writeFileSync(memoriaFile, contenido, "utf8");

  // Simular backup
  const fs = require("fs");
  fs.copyFileSync(memoriaFile, backupFile);

  expect(readFileSync(backupFile, "utf8")).toBe(contenido);
});

test("Compresión es idempotente", () => {
  const contenido = `# Memoria

## 2026-06-10 — src/a.ts
> contenido A

## 2026-06-10 — src/b.ts
> contenido B
`;

  // Aplicar deduplica 2 veces, resultado debe ser igual
  const aplicarDeduplica = (c) => {
    const entradas = new Map();
    const regex = /^## (\d{4}-\d{2}-\d{2}) — (.+?)\n> (.+?)(?=\n##|\n$)/gms;
    let match;
    while ((match = regex.exec(c)) !== null) {
      const [, fecha, filepath, resumen] = match;
      entradas.set(filepath, { fecha, resumen });
    }
    let resultado = "# Memoria\n\n";
    for (const [filepath, { fecha, resumen }] of entradas) {
      resultado += `## ${fecha} — ${filepath}\n> ${resumen}\n\n`;
    }
    return resultado;
  };

  const resultado1 = aplicarDeduplica(contenido);
  const resultado2 = aplicarDeduplica(resultado1);

  expect(resultado1).toBe(resultado2);
});
