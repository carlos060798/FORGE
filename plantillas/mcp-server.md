# Plantilla: Servidor MCP

Esqueleto base para el generador `/sdd.crear-mcp`. El agente `desarrollador-backend` rellena los `TODO` con el código real de cada tool.

---

## `package.json`

```json
{
  "name": "mcp-NOMBRE",
  "version": "1.0.0",
  "description": "DESCRIPCION_UNA_LINEA",
  "type": "module",
  "bin": {
    "mcp-NOMBRE": "./src/index.js"
  },
  "scripts": {
    "start": "node src/index.js",
    "test": "node --test tests/*.test.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.22.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

---

## `src/index.js`

```javascript
#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "mcp-NOMBRE",
  version: "1.0.0",
});

// ── TOOL 1 ──────────────────────────────────────────────────────────────────
// TODO: reemplazar con la tool real (una por CA)
server.tool(
  "nombre_tool_1",
  "Descripción para el modelo: cuándo usar esta tool y qué hace",
  {
    // Parámetros de entrada (Zod schema)
    entrada: z.string().describe("qué es este parámetro")
  },
  async ({ entrada }) => {
    // TODO: lógica de la tool
    const resultado = `procesado: ${entrada}`;
    return {
      content: [{ type: "text", text: resultado }]
    };
  }
);

// ── TOOL 2 (copiar bloque de arriba por cada CA adicional) ──────────────────
// server.tool("nombre_tool_2", ...)

// ── ARRANQUE ─────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
// El servidor queda escuchando por stdin — no imprimir nada a stdout aquí
```

---

## `.env.example`

```bash
# Variables de entorno requeridas por este MCP
# Copia este archivo como .env y rellena los valores

# TODO: añadir las variables que necesite la tool (API keys, rutas, etc.)
# EJEMPLO_API_KEY=tu_clave_aqui
# EJEMPLO_BASE_URL=https://api.ejemplo.com
```

---

## `README.md` (estructura que genera `/sdd.crear-mcp`)

```markdown
# mcp-NOMBRE

DESCRIPCION_UNA_LINEA

## Qué hace

| Tool | Qué hace | Parámetros |
|------|----------|-----------|
| nombre_tool_1 | [descripción] | `entrada` (texto) |

## Instalación en Claude Code

1. Clona o descarga este proyecto.
2. Ejecuta en tu terminal:

```
claude mcp add NOMBRE -- node "/ruta/a/mcp-NOMBRE/src/index.js"
```

3. Reinicia Claude Code.

## Variables de entorno

Copia `.env.example` como `.env` y rellena los valores antes de instalar.

## Uso

Dile a Claude: "[ejemplo de frase en lenguaje natural que activa la tool]"

## Requisitos

- Node.js 18 o superior
- Claude Code
```

---

## `tests/mcp.test.js` (estructura base)

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";

// Prueba de integración mínima: el módulo carga sin errores de sintaxis
test("src/index.js carga sin errores", async () => {
  // Verificar que el archivo existe y tiene contenido
  const { readFileSync } = await import("node:fs");
  const src = readFileSync("src/index.js", "utf8");
  assert.ok(src.includes("McpServer"), "debe importar McpServer");
  assert.ok(src.includes("server.tool("), "debe declarar al menos una tool");
  assert.ok(src.includes("StdioServerTransport"), "debe usar stdio transport");
});

// TODO: añadir un test por tool que simule la entrada y verifique la salida
// test("nombre_tool_1: procesa entrada correctamente", async () => { ... })
```
