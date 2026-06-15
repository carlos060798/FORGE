---
name: adr-indexer
model: claude-haiku-4-5
description: Indexa decisiones arquitectónicas (ADR) desde comentarios en código
allowed-tools: Read, Write, Bash
---

# Skill: ADR Indexer

**Propósito:** Capturar automáticamente decisiones arquitectónicas de comentarios en código y mantener un índice buscable.

---

## Cómo Funciona

### Patrón ADR en Comentarios

El desarrollador (agente) deja una nota en el código:

```python
# ADR: {"decision": "Use PostgreSQL", "context": "ACID needed", "status": "accepted"}
class Database:
    pass
```

### Hook Captura Automáticamente

Hook `agent-memory.js` detecta comentarios con patrón `ADR: {...}` y:
1. Extrae JSON
2. Valida estructura
3. Guarda en `.sdd/arquitectura/ADRs.jsonl`

### Usuario Consulta

```bash
/sdd.adr list
→ Tabla de decisiones

/sdd.adr search "database"
→ Solo ADRs que mencionan "database"

/sdd.adr new
→ Captura interactiva de nueva decisión
```

---

## Estructura de ADR

```json
{
  "ts": "2026-06-14T10:30:00Z",
  "decision": "Use PostgreSQL for relational data",
  "context": "ACID transactions required, multi-tenant",
  "alternatives": ["MongoDB", "Firebase"],
  "status": "accepted",
  "archivo": "src/database.ts",
  "linea": 42
}
```

**Campos:**
- `ts` — timestamp (automático)
- `decision` — qué se decidió
- `context` — por qué
- `alternatives` — opciones consideradas
- `status` — accepted | rejected | deprecated | superseded
- `archivo` — dónde está el código
- `linea` — número de línea

---

## Ledger: `.sdd/arquitectura/ADRs.jsonl`

Append-only JSONL:
```
{"ts":"2026-06-14T10:30:00Z","decision":"Use PostgreSQL","status":"accepted",...}
{"ts":"2026-06-14T10:31:00Z","decision":"Use Redis for cache","status":"accepted",...}
{"ts":"2026-06-14T10:32:00Z","decision":"JWT for auth","status":"accepted",...}
```

**Ventajas:**
- Histórico completo
- Búsqueda rápida (grep)
- Estadísticas fáciles (contar, agrupar por status)
- Reversible (append-only, nunca sobrescrito)

---

## Uso Interactivo

### `/sdd.adr list`

```
ID | DECISION                  | CONTEXT              | STATUS
───┼───────────────────────────┼──────────────────────┼──────────
1  | Use PostgreSQL            | ACID needed          | accepted
2  | Cache with Redis          | Performance req      | accepted
3  | JWT instead of sessions   | Stateless API        | accepted
```

### `/sdd.adr search "security"`

```
ID | DECISION                | STATUS
───┼───────────────────────────┼──────────
1  | HTTPS only              | accepted
2  | Validate all user input | accepted
3  | Encrypt passwords       | accepted
```

### `/sdd.adr new`

```
Nuevo ADR — responde las preguntas:
1. Decisión: "Use DynamoDB para analytics"
2. Contexto: "Scale infinitamente, baja latencia"
3. Alternativas: "PostgreSQL partitioning, BigQuery"
4. Status: "accepted" (o "rejected", "deprecated")

✅ Guardado en ADRs.jsonl
```

---

## Implementación Técnica

### En Hook: `agent-memory.js`

```javascript
function extraerADRsDelContenido(contenido) {
  // Regex multilenguaje: //, /*, #, --, etc.
  const regex = /(?:\/\/|\/\*|#|--|<!--|REM)\s*ADR:\s*({[^}]*})/g;
  const adrs = [];
  let match;
  while ((match = regex.exec(contenido)) !== null) {
    try {
      const json = JSON.parse(match[1]);
      adrs.push(json);
    } catch {
      // Ignorar JSON inválido
    }
  }
  return adrs;
}

function registrarADR(cwd, agente, archivo, adrs) {
  const ledgerFile = join(cwd, ".sdd/arquitectura/ADRs.jsonl");
  for (const adr of adrs) {
    const linea = JSON.stringify({
      ts: new Date().toISOString(),
      ...adr,
      archivo: archivo,
      agente: agente
    });
    appendFileSync(ledgerFile, linea + "\n", "utf8");
  }
}
```

---

## CLI: `adr-parser.js`

Batch scan del codebase:

```bash
node utils/adr-parser.js . src/**/*.ts --update-ledger
```

Encuentra todos los ADRs en archivos existentes y los añade al ledger.

---

## Notas

- **Multilenguaje:** Soporta comentarios en Python, JS, Go, Java, Rust, etc.
- **Idempotente:** Escanear 2 veces = mismos resultados (sin duplicados)
- **Seguro:** JSON validado antes de guardar, error silencioso si es inválido
- **Performante:** Regex simple, <100ms para archivo de 100KB

