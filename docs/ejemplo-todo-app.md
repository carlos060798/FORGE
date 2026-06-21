# Ejemplo end-to-end: app de lista de tareas

Este walkthrough muestra el flujo completo de FORGE, desde una idea expresada en lenguaje natural hasta una aplicación probada y lista para producción. Usamos una app de gestión de tareas como caso de uso — simple pero con suficiente complejidad para mostrar todos los pasos.

**Stack resultante:** Node.js · Express · SQLite · HTML vanilla  
**Duración estimada:** 15–25 min (sin contar tiempo de modelo)

---

## Paso 0 — Instalar FORGE (una sola vez)

```bash
npx sdd-es init
```

Output esperado:
```
✅ FORGE instalado en .claude/
✅ Hooks registrados: pre-tool-guard.js + agent-memory.js
✅ Estructura .sdd/ creada
📖 Próximo paso: /sdd.constitucion
```

*Protección activa: el hook `pre-tool-guard.js` ya está registrado.*

---

## Paso 1 — Constitución del proyecto

```
/sdd.constitucion
```

FORGE te hace preguntas guiadas:

```
FORGE: ¿Cuál es el objetivo principal del proyecto?
Tú:    Una app web para gestionar tareas de equipo

FORGE: ¿Qué stack tecnológico prefieres?
Tú:    Node.js con Express, SQLite para la BD, frontend sencillo sin frameworks

FORGE: ¿Hay restricciones de seguridad o privacidad?
Tú:    Los usuarios solo pueden ver sus propias tareas
```

Output generado en `.sdd/memoria/constitucion.md`:
```markdown
## Objetivo
App de gestión de tareas de equipo.

## Stack
- Backend: Node.js + Express
- BD: SQLite (vía better-sqlite3)
- Frontend: HTML/CSS/JS vanilla

## Restricciones
- Aislamiento por usuario: un usuario no puede ver tareas de otro
- Sin frameworks de frontend — máxima simplicidad de despliegue
```

*Protección activa: el agente `arquitecto` leyó la constitución pero no modificó ningún archivo de código.*

---

## Paso 2 — Interpretar la idea

```
/sdd.interpretar Una app web donde un equipo pueda crear, asignar y completar tareas con prioridades
```

FORGE genera el IR (Intermediate Representation) en `.sdd/ir.json`:

```json
{
  "entities": [
    { "name": "User", "fields": ["id", "email", "name", "created_at"] },
    { "name": "Task", "fields": ["id", "title", "description", "status", "priority", "owner_id", "assignee_id", "due_date"] },
    { "name": "Comment", "fields": ["id", "task_id", "user_id", "body", "created_at"] }
  ],
  "api_endpoints": [
    "POST /auth/register", "POST /auth/login",
    "GET /tasks", "POST /tasks", "PUT /tasks/:id", "DELETE /tasks/:id",
    "GET /tasks/:id/comments", "POST /tasks/:id/comments"
  ],
  "architecture": {
    "pattern": "REST API + SPA",
    "estimated_complexity": "medium",
    "security_concerns": ["auth", "row-level isolation"]
  }
}
```

*Routing activo: `complexity = medium` → el agente arquitecto usará Sonnet en lugar de Opus.*

---

## Paso 3 — Diseño (opcional pero recomendado)

```
/sdd.diseñar
```

El agente `disenador-api` define los contratos de API con tipos exactos. El agente `asesor-datos` propone el schema de SQLite:

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT CHECK(status IN ('todo','in_progress','done')) DEFAULT 'todo',
  priority TEXT CHECK(priority IN ('low','medium','high')) DEFAULT 'medium',
  owner_id INTEGER NOT NULL REFERENCES users(id),
  assignee_id INTEGER REFERENCES users(id),
  due_date TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

*Protección activa: `asesor-datos` es read-only — generó el schema pero no escribió ningún archivo.*

---

## Paso 4 — Especificación

```
/sdd.especificar
```

Output en `.sdd/especificaciones/001-todo-app/spec.md`:

```markdown
## Criterios de Aceptación

CA-01: Un usuario puede registrarse con email y contraseña
CA-02: Un usuario solo puede ver sus propias tareas (aislamiento por owner_id)
CA-03: Al crear una tarea, el campo title es obligatorio; priority default = "medium"
CA-04: El endpoint DELETE /tasks/:id solo funciona si el caller es el owner
CA-05: Los comentarios se listan en orden cronológico
CA-06: Las contraseñas se almacenan como bcrypt hash (nunca en texto plano)
```

*Guardrail activo: CA-06 referencia bcrypt — el agente de seguridad fue invocado automáticamente.*

---

## Paso 5 — Planificación

```
/sdd.planificar
```

```
🔀 [forge-routing] Complejidad: medium → agente arquitecto usará modelo sonnet
💡 Usando Sonnet para arquitecto — cámbialo con forge.config.json si prefieres Opus.
```

Plan generado con archivos objetivo:
```
src/
  db/
    schema.sql         ← CREATE TABLE statements
    connection.js      ← singleton better-sqlite3
  routes/
    auth.js            ← POST /auth/register, POST /auth/login
    tasks.js           ← CRUD de tareas con aislamiento
    comments.js        ← GET y POST de comentarios
  middleware/
    auth.js            ← JWT verify
  public/
    index.html         ← SPA vanilla
    app.js             ← fetch calls + render
  server.js            ← Express app entry point
```

---

## Paso 6 — Tareas

```
/sdd.tareas
```

Genera `.sdd/tareas/001-todo-app.md` con 18 tareas atómicas estimadas en 3 sprints. Cada tarea tiene agente asignado, criterio de aceptación referenciado, y estimación.

---

## Paso 7 — Implementación

```
/sdd.implementar
```

Los agentes escriben el código por capas. Ejemplo de lo que registra `agent-memory.js` durante este paso:

```jsonl
{"ts":"2026-06-21T10:03:12Z","agente":"desarrollador-backend","archivo":"src/db/schema.sql","resumen":"Schema SQLite con 3 tablas: users, tasks, comments. Índice en tasks.owner_id.","bytes":1240}
{"ts":"2026-06-21T10:05:44Z","agente":"desarrollador-backend","archivo":"src/routes/auth.js","resumen":"POST /register y /login con bcrypt + JWT. Validación de email único.","bytes":2180}
{"ts":"2026-06-21T10:11:22Z","agente":"seguridad","archivo":"src/middleware/auth.js","resumen":"Middleware JWT verify. Rechaza tokens expirados con 401.","bytes":890}
```

*Guardrail activo: durante la implementación del middleware, el hook detectó un intento de escribir `SECRET_KEY = "abc123"` hardcodeado y lo bloqueó. El agente usó `process.env.JWT_SECRET` en su lugar.*

---

## Paso 8 — QA y verificación

```
/sdd.qa
/sdd.verificar
```

```
✅ CA-01: registro funciona con email válido
✅ CA-02: GET /tasks retorna solo tareas del usuario autenticado
✅ CA-03: POST /tasks sin title → 400 Bad Request
✅ CA-04: DELETE /tasks/:id con otro usuario → 403 Forbidden
✅ CA-05: GET /tasks/:id/comments ordenados por created_at ASC
✅ CA-06: hash en BD comienza con $2b$ (bcrypt confirmado)

Cobertura: 87% · Warnings: 0 · Tests: 24 pass, 0 fail
```

---

## Paso 9 — Revisión de guardrails activados durante el proyecto

Al final, revisa qué protecciones actuaron:

```bash
cat .sdd/observabilidad/agent-tool-audit.jsonl | node -e "
  const rl = require('readline').createInterface({ input: process.stdin });
  rl.on('line', l => {
    const e = JSON.parse(l);
    if (e.blocked) console.log('[BLOQUEADO]', e.agente, e.tool, e.target);
  });
"
```

Ejemplo de salida:
```
[BLOQUEADO] desarrollador-backend Write src/server.js  ← secret hardcodeado
[BLOQUEADO] arquitecto Edit src/routes/tasks.js        ← agente read-only
```

---

## Estructura final del proyecto

```
.
├── src/
│   ├── db/schema.sql
│   ├── db/connection.js
│   ├── routes/auth.js
│   ├── routes/tasks.js
│   ├── routes/comments.js
│   ├── middleware/auth.js
│   ├── public/index.html
│   ├── public/app.js
│   └── server.js
├── tests/
│   ├── auth.test.js
│   ├── tasks.test.js
│   └── comments.test.js
├── .sdd/                      ← gestionado por FORGE
├── forge.config.json          ← config opcional de FORGE
└── package.json
```

**Tiempo total de modelo:** ~12 min · **Tokens estimados:** ~180K · **Archivos generados:** 11

---

## Notas sobre qué protección activó FORGE en cada paso

| Paso | Protección | Resultado |
|------|-----------|-----------|
| 3 (Diseño) | Agente read-only (`asesor-datos`) | Schema generado como texto, no escrito directamente |
| 7 (Implementación) | Secret detector | `SECRET_KEY = "abc123"` bloqueado → usa env var |
| 7 (Implementación) | Read-only (`arquitecto`) | Intento de Edit bloqueado correctamente |
| 7 (Implementación) | `agent-memory.js` | 8 decisiones de arquitectura capturadas en `indice.jsonl` |
| 7 (Implementación) | ADR automático | 1 ADR capturado: `// ADR: {"decision": "bcrypt sobre argon2 por compatibilidad Node 18"}` |
