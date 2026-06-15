---
description: Convierte una descripción en lenguaje natural en un servidor MCP funcional, empaquetado como .mcpb instalable. Cada Criterio de Aceptación se convierte en una tool MCP. Orientado a no-programadores que quieren publicar capacidades.
allowed-tools: Read, Write, Edit, Bash, Task
handoffs:
  - etiqueta: "Desplegar el MCP"
    comando: sdd.desplegar
  - etiqueta: "Probar el MCP"
    comando: sdd.qa
---

# /sdd.crear-mcp — Generador de Servidor MCP

Eres el **Generador de MCP**. Tomas una descripción en lenguaje natural y produces un servidor MCP completo: tools definidas, empaquetado, instrucciones de instalación de una línea. El resultado lo puede instalar alguien que no sabe programar.

> **MCP integrado en v2.6.0:** Playwright (navegación y QA automatizado).

## PASO 1 — Entender qué capacidades se quieren publicar

Lee el argumento del comando. Si el usuario escribió algo como:
- `"quiero una herramienta que consulte el clima"`
- `"una tool para buscar en mi base de datos de recetas"`
- `"que mis notas de Obsidian sean accesibles desde Claude"`

Haz **máximo 3 preguntas** (en perfil guiado: lenguaje simple, sin jerga):

1. **¿Qué hace exactamente?** — entrada y salida esperada en términos del usuario.
2. **¿De dónde saca los datos?** — API externa / archivo local / base de datos / generación propia.
3. **¿Solo Claude lo usará, o también otros agentes?** — determina si necesita auth.

En perfil `guiado`, plantéalo así:
> "Cuéntame más: cuando uses esta herramienta desde Claude, ¿qué le dirás y qué esperas que te devuelva?"

## PASO 2 — Crear spec acotada al dominio MCP

```bash
SPEC_ID="MCP-$(date +%Y%m%d%H%M)"
mkdir -p ".sdd/especificaciones/${SPEC_ID}"
```

Genera una spec mínima con:
- **Nombre del MCP**: `mcp-[nombre-kebab]`
- **Tools a exponer** (una por CA): nombre_tool, descripción, parámetros de entrada, formato de salida.
- **Fuente de datos**: cómo accede a los datos (env var, archivo, API key).
- **Criterios de Aceptación**: uno por tool, en formato `Dado/Cuando/Entonces`.

Escribe la spec en `.sdd/especificaciones/${SPEC_ID}/spec.md`.

## PASO 3 — Scaffold del servidor MCP

Usa la plantilla `plantillas/mcp-server.md` como base. El agente `desarrollador-backend` genera la estructura:

```bash
# Estructura objetivo
MCP_DIR="mcp-$(echo "$NOMBRE" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')"
mkdir -p "${MCP_DIR}/src"
```

```
mcp-nombre/
├── package.json          ← name, version, type:module, bin
├── src/
│   └── index.js          ← servidor MCP (stdio transport)
├── README.md             ← instrucciones de uso e instalación
└── .env.example          ← variables de entorno requeridas (sin valores)
```

**Reglas del scaffold:**
- Node puro, cero dependencias externas salvo `@modelcontextprotocol/sdk` (ya declarado en plantilla).
- Cada CA → una `tool` con nombre en `snake_case`, descripción para el modelo, schema de entrada JSON Schema.
- Transport: `stdio` (compatible con Claude Code sin configuración extra).
- Sin secrets hardcodeados; las API keys van a `process.env.NOMBRE_VAR`.

## PASO 4 — Generar código de cada tool

Para cada tool identificada en el PASO 2, el agente `desarrollador-backend` implementa:

```javascript
// Patrón por tool (genera uno por CA)
server.tool(
  "nombre_tool",
  "Descripción clara para que el modelo sepa cuándo usarla",
  {
    parametro: z.string().describe("qué es este parámetro")
  },
  async ({ parametro }) => {
    // lógica de la tool
    return { content: [{ type: "text", text: resultado }] };
  }
);
```

Verificación por tool:
```bash
# Cada tool debe aparecer nombrada en src/index.js
grep -c "server.tool(" "${MCP_DIR}/src/index.js"
```

## PASO 5 — Empaquetar como .mcpb

`.mcpb` es un bundle instalable: el directorio del servidor comprimido con las instrucciones de instalación embebidas. Permite que un no-programador lo instale arrastrando o con un comando de una línea.

```bash
# Instalar dependencias antes de empaquetar
cd "${MCP_DIR}" && npm install --omit=dev

# Crear bundle .mcpb (tar.gz renombrado)
cd .. && tar -czf "${MCP_DIR}.mcpb" "${MCP_DIR}/"

echo "Bundle creado: ${MCP_DIR}.mcpb"
echo "Tamaño: $(du -sh ${MCP_DIR}.mcpb | cut -f1)"
```

## PASO 6 — Generar instrucciones de instalación de una línea

Según el destino del MCP:

**Para Claude Code (local):**
```bash
# Una línea para instalar desde el .mcpb
claude mcp add ${NOMBRE_MCP} -- node "${MCP_DIR}/src/index.js"
```

**Para publicar en npm (opcional, si el usuario quiere compartirlo):**
```bash
# Instrucción generada en el README del MCP
npx ${NOMBRE_MCP}
```

Genera el README con:
1. Qué hace el MCP (una frase).
2. Qué tools expone (tabla: nombre, qué hace, parámetros).
3. Variables de entorno requeridas (`.env.example`).
4. Instrucción de instalación para Claude Code.
5. Ejemplo de uso: "Dile a Claude: *[frase de ejemplo]*".

En perfil `guiado`, el README usa lenguaje sin jerga — el target es alguien que nunca abrió una terminal.

## PASO 7 — Verificación final

```bash
# El servidor debe arrancar sin errores
cd "${MCP_DIR}" && timeout 5 node src/index.js <<< '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' 2>&1

# Debe listar todas las tools declaradas
# Si el timeout expira sin error de sintaxis, es correcto (stdio espera input)
```

```bash
# El .mcpb debe existir y tener contenido
[ -f "${MCP_DIR}.mcpb" ] && ls -lh "${MCP_DIR}.mcpb" || echo "FALTA: bundle .mcpb"
```

## PASO 8 — Reporte final

```
🔌 MCP generado: ${NOMBRE_MCP}

   Tools expuestas:
   • nombre_tool_1  — [qué hace]
   • nombre_tool_2  — [qué hace]

   Archivos:
   📁 ${MCP_DIR}/          — código fuente editable
   📦 ${MCP_DIR}.mcpb      — bundle instalable

   Instalar en Claude Code:
   claude mcp add ${NOMBRE_MCP} -- node "$(pwd)/${MCP_DIR}/src/index.js"

   Dile a Claude: "[frase de ejemplo de uso]"
```

En perfil `guiado`:
> "¡Listo! Creé tu herramienta. Para usarla desde Claude, copia esta línea en tu terminal: [comando]. Después de eso, puedes decirle a Claude: *[ejemplo natural]* y lo hará automáticamente."

---
**HOOK:** `.sdd/hooks/despues_crear_mcp.sh`
