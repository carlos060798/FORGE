# Ejemplos de Código: API de Memoria y Observabilidad

Esta guía muestra cómo interactuar con el sistema de memoria persistente de FORGE desde tu propio código.

## 1. Leer la memoria de un agente

### Backend SQLite (Node >= 22.5)

Si tu proyecto usa SQLite (auto-detectado en Node >= 22.5), puedes consultarla así:

```javascript
// Leer memoria con node:sqlite
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';

function leerMemoriaSQLite(cwd, agente) {
  const dbPath = join(cwd, '.sdd', 'memoria', 'memoria.db');
  const db = new DatabaseSync(dbPath);
  
  // Obtener todas las entradas del agente
  const entradas = db.prepare(
    'SELECT ts, archivo, resumen, bytes FROM entradas WHERE agente = ? ORDER BY ts DESC'
  ).all(agente);
  
  db.close();
  return entradas;
}

// Uso:
const memoria = leerMemoriaSQLite(process.cwd(), 'arquitecto');
console.log(`${memoria.length} entradas encontradas:`);
memoria.forEach(e => console.log(`  ${e.ts}: ${e.archivo}`));
```

**Tabla:** `entradas`  
**Campos:**
- `id` (INTEGER PRIMARY KEY)
- `ts` (TEXT, ISO 8601 timestamp)
- `fecha` (TEXT, YYYY-MM-DD)
- `agente` (TEXT)
- `archivo` (TEXT, ruta modificada)
- `resumen` (TEXT, primeras líneas del contenido)
- `bytes` (INTEGER, tamaño en bytes)

**Índices disponibles:**
- `idx_agente` — búsqueda rápida por agente
- `idx_fecha` — búsqueda rápida por fecha
- `idx_archivo` — búsqueda rápida por archivo

### Backend Markdown (Node < 22.5)

Si tu proyecto usa Markdown (fallback en Node < 22.5), la memoria está en:

```
.sdd/memoria/agente-{nombre}.md
```

Ejemplo de contenido:

```markdown
# Memoria del agente: arquitecto

Este archivo registra automáticamente las decisiones y cambios del agente.

---

## 2026-06-21 — .sdd/especificaciones/auth/spec.md
> # Especificación: Autenticación con magic link — Decisión: usar Resend

## 2026-06-20 — .sdd/plan/plan.md
> Plan de 12 tareas: backend (4), frontend (5), testing (3)
```

Para leerla desde código:

```javascript
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function leerMemoriaMarkdown(cwd, agente) {
  const path = join(cwd, '.sdd', 'memoria', `agente-${agente}.md`);
  const contenido = readFileSync(path, 'utf8');
  
  // Parsear entradas: formato "## FECHA — ARCHIVO\n> RESUMEN"
  const regex = /^## (\d{4}-\d{2}-\d{2}) — (.+?)\n> (.+?)(?=\n##|\n$)/gm;
  const entradas = [];
  let match;
  
  while ((match = regex.exec(contenido)) !== null) {
    const [, fecha, archivo, resumen] = match;
    entradas.push({ fecha, archivo, resumen });
  }
  
  return entradas;
}

// Uso:
const memoria = leerMemoriaMarkdown(process.cwd(), 'desarrollador-backend');
memoria.forEach(e => console.log(`${e.fecha}: ${e.archivo}`));
```

---

## 2. Consultar el índice invertido (rápido)

El índice invertido `.sdd/memoria/indice.jsonl` permite búsquedas sin cargar tablas grandes.

**Formato:** Una línea JSON por entrada

```json
{"ts":"2026-06-21T14:32:07.123Z","fecha":"2026-06-21","agente":"arquitecto","archivo":".sdd/especificaciones/auth/spec.md","resumen":"# Auth con magic link","bytes":4821}
{"ts":"2026-06-21T14:33:15.456Z","fecha":"2026-06-21","agente":"desarrollador-backend","archivo":".sdd/codigo/auth/login.ts","resumen":"POST /auth/login — valida email","bytes":2103}
```

**Lectura desde código:**

```javascript
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function leerIndice(cwd, filtroAgente = null) {
  const indicePath = join(cwd, '.sdd', 'memoria', 'indice.jsonl');
  const lineas = readFileSync(indicePath, 'utf8').trim().split('\n');
  
  const entradas = lineas.map(l => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(e => e && (!filtroAgente || e.agente === filtroAgente));
  
  return entradas;
}

// Buscar entradas de un agente en fecha específica
function buscarPorFecha(cwd, agente, fecha) {
  const entradas = leerIndice(cwd, agente);
  return entradas.filter(e => e.fecha === fecha);
}

// Uso:
const hoy = new Date().toISOString().slice(0, 10);
const cambiosDeLaFecha = buscarPorFecha(process.cwd(), 'arquitecto', hoy);
console.log(`Cambios hoy: ${cambiosDeLaFecha.length}`);
```

**Ventaja:** 90% menos tokens que leer el archivo `.md` completo.

---

## 3. Analizar consumo (ledger)

El archivo `.sdd/observabilidad/consumo.jsonl` registra **cada escritura de archivo**.

**Formato:** Una línea JSON por evento

```json
{"ts":"2026-06-21T14:32:07.123Z","agente":"arquitecto","tool":"Write","archivo":".sdd/especificaciones/auth/spec.md","bytes":4821,"provider":"anthropic","effort_level":"opus"}
{"ts":"2026-06-21T14:32:15.456Z","agente":"desarrollador-backend","tool":"Edit","archivo":"src/auth.ts","bytes":821,"provider":"anthropic","effort_level":"sonnet"}
```

**Campos:**
- `ts` — Timestamp ISO 8601
- `agente` — Nombre del agente (o "main" si sesión principal)
- `tool` — Herramienta: Write, Edit, MultiEdit
- `archivo` — Ruta modificada
- `bytes` — Tamaño en bytes del contenido
- `provider` — Proveedor de LLM ("anthropic", etc.)
- `effort_level` — Tier del modelo usado ("opus", "sonnet", "haiku", o null)

**Análisis desde código:**

```javascript
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function analizarConsumo(cwd) {
  const consumoPath = join(cwd, '.sdd', 'observabilidad', 'consumo.jsonl');
  const lineas = readFileSync(consumoPath, 'utf8').trim().split('\n');
  
  const eventos = lineas.map(l => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(e => e);
  
  // Agrupar por agente
  const porAgente = {};
  for (const e of eventos) {
    if (!porAgente[e.agente]) {
      porAgente[e.agente] = { count: 0, bytes: 0, por_tool: {} };
    }
    porAgente[e.agente].count++;
    porAgente[e.agente].bytes += e.bytes;
    if (!porAgente[e.agente].por_tool[e.tool]) {
      porAgente[e.agente].por_tool[e.tool] = 0;
    }
    porAgente[e.agente].por_tool[e.tool]++;
  }
  
  return porAgente;
}

// Uso:
const consumo = analizarConsumo(process.cwd());
for (const [agente, datos] of Object.entries(consumo)) {
  const mbytes = (datos.bytes / 1024 / 1024).toFixed(2);
  console.log(`${agente}: ${datos.count} writes, ${mbytes}MB`);
  console.log(`  ${JSON.stringify(datos.por_tool)}`);
}
```

**Casos de uso:**
- Auditoría de consumo por agente
- Alertas si un agente escribe demasiado
- Correlacionar writes con effort levels
- Detectar loops infinitos de escritura

---

## 4. Detectar e invocar auto-compresión

Cuando la memoria supera un umbral, FORGE muestra una alerta:

```
⚠️ [agent-memory] Memoria de arquitecto supera 52KB — considera ejecutar /sdd.optimizar memoria
```

**Desde código, detectar manualmente:**

```javascript
import { statSync } from 'node:fs';
import { join } from 'node:path';

function necesitaCompresion(cwd, agente, umbralBytes = 40000) {
  const markdownPath = join(cwd, '.sdd', 'memoria', `agente-${agente}.md`);
  try {
    const { size } = statSync(markdownPath);
    return { necesita: size > umbralBytes, tamanio: size };
  } catch {
    return { necesita: false, tamanio: 0 };
  }
}

// Uso:
const check = necesitaCompresion(process.cwd(), 'arquitecto');
if (check.necesita) {
  console.log(`Memoria > ${check.tamanio / 1024}KB — ejecuta: /sdd.optimizar memoria`);
}
```

**Lo que hace `/sdd.optimizar memoria`:**
1. Deduplica entradas del mismo archivo (conserva solo la más reciente)
2. Aplica compresión caveman (tokens)
3. Genera backup `.original.md`
4. Reduce tamaño típicamente al 30-40% de lo original

---

## 5. Configuración de backends

### Detectar backend actual

```javascript
function detectarBackend(cwd) {
  const configPath = join(cwd, '.sdd', 'sdd.config.yaml');
  const nodeSoportaSQLite = () => {
    const [major, minor] = process.versions.node.split('.').map(Number);
    return major > 22 || (major === 22 && minor >= 5);
  };
  
  // Por defecto: SQLite si Node >= 22.5, Markdown si no
  const backendDefault = nodeSoportaSQLite() ? 'sqlite' : 'markdown';
  
  if (!existsSync(configPath)) {
    return backendDefault; // Auto-detectado
  }
  
  const yaml = readFileSync(configPath, 'utf8');
  const match = yaml.match(/backend:\s*"?(sqlite|markdown)"?/);
  return match ? match[1] : backendDefault;
}
```

### Forzar backend específico

En `.sdd/sdd.config.yaml`:

```yaml
memoria:
  backend: "sqlite"  # o "markdown"
  umbral_bytes: 40000
  recuperacion_por_defecto: 10
```

Si usas Markdown a propósito:
```yaml
memoria:
  backend: "markdown"
```

Si fuerza SQLite pero Node < 22.5, la librería fallará silenciosamente y caerá a Markdown.

---

## 6. Esquema completo de tabla SQLite

Para crear tu propia lógica de consulta avanzada:

```sql
-- Tabla principal
CREATE TABLE IF NOT EXISTS entradas (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  ts    TEXT NOT NULL,                    -- "2026-06-21T14:32:07.123Z"
  fecha TEXT NOT NULL,                    -- "2026-06-21"
  agente TEXT NOT NULL,                   -- "arquitecto", "desarrollador-backend", etc.
  archivo TEXT NOT NULL,                  -- ".sdd/especificaciones/auth/spec.md"
  resumen TEXT NOT NULL,                  -- Primeras líneas del contenido (max 120 chars)
  bytes INTEGER NOT NULL DEFAULT 0        -- Tamaño en bytes
);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_agente  ON entradas(agente);
CREATE INDEX IF NOT EXISTS idx_fecha   ON entradas(fecha);
CREATE INDEX IF NOT EXISTS idx_archivo ON entradas(archivo);

-- Ejemplos de queries útiles:

-- Entradas de hoy por agente
SELECT agente, COUNT(*) as cantidad
FROM entradas
WHERE fecha = DATE('now')
GROUP BY agente;

-- Archivos más modificados
SELECT archivo, COUNT(*) as veces, SUM(bytes) as total_bytes
FROM entradas
GROUP BY archivo
ORDER BY veces DESC
LIMIT 10;

-- Consumo de bytes por día
SELECT fecha, SUM(bytes) / 1024.0 / 1024.0 as mb
FROM entradas
GROUP BY fecha
ORDER BY fecha DESC;

-- Últimas 3 entradas por agente
SELECT agente, ts, archivo, resumen
FROM entradas
WHERE agente = 'arquitecto'
ORDER BY ts DESC
LIMIT 3;
```

---

## 7. Integración con hooks personalizados

Si quieres extender la memoria desde tus propios hooks de Claude Code:

```javascript
// my-hook.js
import { existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

export async function PostToolUse(event) {
  const { tool_name, result, project_root } = event;
  
  if (tool_name !== 'Write' && tool_name !== 'Edit') return;
  
  // Tu lógica personalizada
  const memoriaDir = join(project_root, '.sdd', 'memoria', 'custom');
  mkdirSync(memoriaDir, { recursive: true });
  
  const entrada = {
    timestamp: new Date().toISOString(),
    tool: tool_name,
    custom_data: result.some_field,
  };
  
  appendFileSync(
    join(memoriaDir, 'custom-log.jsonl'),
    JSON.stringify(entrada) + '\n'
  );
}
```

Registra en `settings.json`:

```json
{
  "hooks": {
    "post-tool-use": [".claude/hooks/my-hook.js"]
  }
}
```

---

## 8. Troubleshooting

### "Error: Cannot find module 'node:sqlite'"

Causa: Node < 22.5 o `node:sqlite` no habilitado.

**Solución:**
```bash
node --version  # Debe ser >= 22.5.0
# Si >= 22.5, fuerza Markdown en .sdd/sdd.config.yaml:
# memoria.backend: "markdown"
```

### Memoria crece sin límite

**Síntoma:** `.sdd/memoria/agente-XXX.md` supera 50MB+  
**Causa:** No se ejecutó compresión  
**Solución:**
```bash
/sdd.optimizar memoria
```

### Índice desincronizado

**Síntoma:** El índice JSON Lines está vacío o desfasado  
**Solución:** El hook lo regenera automáticamente. Si sigue vacío:
```javascript
// Regenerar manualmente
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function regenerarIndice(cwd) {
  const memoriaDir = join(cwd, '.sdd', 'memoria');
  for (const archivo of readdirSync(memoriaDir)) {
    if (!archivo.startsWith('agente-')) continue;
    // Re-leer archivo markdown y grabar en indice.jsonl
  }
}
```

---

## Resumen

| Tarea | Backend | Archivo | Función |
|-------|---------|---------|---------|
| Leer memoria | SQLite | `memoria.db` | `db.prepare(...).all()` |
| Leer memoria | Markdown | `agente-*.md` | Regex + split |
| Búsqueda rápida | Ambos | `indice.jsonl` | `JSON.parse` línea a línea |
| Consumo | Ambos | `consumo.jsonl` | `JSON.parse` + agrupar |
| Compresión | Markdown | `agente-*.md` | Deduplicar + comprimir |
| Detectar | Ambos | `sdd.config.yaml` | Regex para `backend:` |

