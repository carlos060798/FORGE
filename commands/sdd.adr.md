---
description: Indexar, listar y gestionar decisiones arquitectónicas (ADRs)
allowed-tools: Read, Write, Bash
---

# /sdd.adr

Gestiona Architecture Decision Records (ADRs) — registro de decisiones arquitectónicas.

## Modos

### `/sdd.adr list`

Lista todas las decisiones registradas.

```
ID | DECISION                  | CONTEXT            | STATUS
───┼───────────────────────────┼────────────────────┼──────────
1  | Use PostgreSQL            | ACID needed        | accepted
2  | Cache with Redis          | Performance        | accepted
3  | JWT for auth              | Stateless API      | accepted
4  | Validate user input       | Security           | accepted
5  | HTTPS only                | Compliance         | accepted
```

**Opciones:**
```
/sdd.adr list --status=accepted      # Solo aceptadas
/sdd.adr list --status=rejected       # Solo rechazadas
/sdd.adr list --status=deprecated     # Obsoletas
```

---

### `/sdd.adr new`

Captura una nueva decisión de forma interactiva.

```
Pregunta 1: ¿Cuál es la decisión?
> Use DynamoDB para analytics

Pregunta 2: ¿Por qué? (contexto)
> Scale infinitamente, baja latencia de queries

Pregunta 3: ¿Qué alternativas consideraste?
> PostgreSQL partitioning, BigQuery, Redshift

Pregunta 4: ¿Status? (accepted/rejected/deprecated/superseded)
> accepted

✅ ADR guardado en .sdd/arquitectura/ADRs.jsonl
```

---

### `/sdd.adr search "patrón"`

Busca ADRs por palabra clave.

```
/sdd.adr search "database"

RESULTADO:
ID | DECISION              | CONTEXT
───┼───────────────────────┼────────────────
1  | Use PostgreSQL        | ACID needed
2  | Use Redis cache       | Performance

/sdd.adr search "security"

RESULTADO:
ID | DECISION                  | CONTEXT
───┼───────────────────────────┼──────────────────
3  | Validate user input       | Prevent injection
4  | HTTPS only                | Compliance
```

---

### `/sdd.adr edit [ID]`

Editar una decisión existente.

```
/sdd.adr edit 1

ADR #1: Use PostgreSQL
Context: ACID needed
Alternatives: MongoDB, Firebase
Status: accepted

¿Modificar? (y/n) > y
Nuevo status: deprecated

✅ ADR #1 actualizado
```

---

## Ficheros

**Ledger:** `.sdd/arquitectura/ADRs.jsonl` (append-only)

Cada línea es un ADR en JSON:
```json
{
  "ts": "2026-06-14T10:30:00Z",
  "decision": "Use PostgreSQL",
  "context": "ACID transactions required",
  "alternatives": ["MongoDB", "Firebase"],
  "status": "accepted",
  "archivo": "src/database.ts",
  "linea": 42,
  "agente": "arquitecto"
}
```

---

## Uso en Auditoría

**Para auditor externo:**

```bash
/sdd.adr list --status=accepted
→ Todas las decisiones aceptadas documentadas

/sdd.adr search "security"
→ Todas las decisiones de seguridad con contexto

/sdd.adr search "compliance"
→ Todas las decisiones de compliance (GDPR, PCI-DSS, etc.)
```

**Resultado:** Auditor confía porque ve trazabilidad completa.

---

## Batch Scan

Para proyectos existentes, scan automático:

```bash
node utils/adr-parser.js . src/**/*.ts --update-ledger
→ Encuentra todos los ADRs en codebase
→ Añade al ledger si no existen
```

---

## Ejemplo Real

### Código con ADR Incrustado

```typescript
// ADR: {"decision": "Use TypeScript", "context": "Type safety, IDE support", "status": "accepted"}
import * as express from "express";

// ADR: {"decision": "Use dependency injection", "context": "Testability", "status": "accepted"}
class Database {
  constructor(private config: Config) {}
}

// ADR: {"decision": "Validate all inputs with Zod", "context": "Security", "status": "accepted"}
const userSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});
```

### Ejecutar Scan

```bash
/sdd.adr new  (o node utils/adr-parser.js . src/**/*.ts)
↓
✅ 3 ADRs encontrados y registrados
```

### Verificar

```bash
/sdd.adr list
→ Ver todas las decisiones documentadas
```

---

## Notas

- **Automático:** Hook captura ADRs al escribir código
- **Manual:** `/sdd.adr new` para decisiones no en código
- **Buscable:** `/sdd.adr search` por palabra clave
- **Auditables:** Cada ADR tiene timestamp, autor, contexto
- **Seguro:** JSON validado, error silencioso si inválido

