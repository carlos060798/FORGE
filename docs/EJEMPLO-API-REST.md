# Caso completo: API REST con autenticación

Este ejemplo muestra un flujo FORGE para un proyecto mediano con backend real, base de datos y autenticación JWT. Está orientado a desarrolladores que quieren entender qué produce cada agente en detalle.

Para el caso introductorio (app de lista de tareas, perfil guiado), ver [CASO-COMPLETO.md](CASO-COMPLETO.md).

---

## Contexto del proyecto

**Idea**: API REST para una agenda de contactos con cuentas de usuario.

**Stack**: Node.js + TypeScript, PostgreSQL, JWT para autenticación.

**Perfil**: `experto` (el usuario ve los comandos y toma decisiones técnicas).

---

## Paso 1 — Inicializar y configurar

```bash
npx sdd-es init
```

Esto copia los archivos de FORGE al proyecto. Luego configura la constitución:

```
/sdd.constitucion
```

El agente `arquitecto` hace preguntas sobre los principios del proyecto. Ejemplo de constitución resultante (`.sdd/memoria/constitucion.md`):

```markdown
## Principios técnicos

- **Sin ORMs pesados**: usa el driver nativo de PostgreSQL (`pg`)
- **Tipado estricto**: TypeScript strict mode, sin `any`
- **Errores como valores**: Result type en lugar de excepciones en lógica de negocio
- **Tests obligatorios**: toda función no trivial tiene test unitario
- **Sin dependencias innecesarias**: solo lo que la spec pide hoy
```

---

## Paso 2 — Interpretar la idea

```
/sdd.interpretar "API REST para agenda de contactos con cuentas de usuario, autenticación JWT"
```

El agente `investigador` lee el directorio actual (solo existe `package.json` vacío) y hace 4 preguntas:

```
¿Qué base de datos? → PostgreSQL
¿Operaciones sobre contactos? → CRUD + búsqueda por nombre
¿Roles de usuario? → todos los usuarios son iguales (sin admin)
¿Paginación en listas? → sí, por cursor
```

Produce `.sdd/ir.json`:

```json
{
  "id": "ir-agenda-contactos-001",
  "product": {
    "name": "Agenda de Contactos",
    "type": "api",
    "estimated_complexity": "media"
  },
  "features": {
    "core": [
      "registro de usuario",
      "login con JWT",
      "CRUD de contactos",
      "búsqueda de contactos por nombre",
      "paginación por cursor"
    ],
    "nice_to_have": ["importar contactos desde CSV", "compartir agenda entre usuarios"]
  },
  "constraints": {
    "tech_preference": "TypeScript, PostgreSQL, sin ORM",
    "auth": "JWT",
    "api_style": "REST"
  }
}
```

El campo `estimated_complexity: "media"` activa el routing dinámico: el grupo OPUS usará `sonnet` en lugar de `opus` (ahorra ~40% de costo sin perder calidad para complejidad media).

---

## Paso 3 — Especificar

```
/sdd.especificar "API REST agenda de contactos con JWT"
```

Produce `.sdd/especificaciones/2026-06-20-agenda-contactos/spec.md` con criterios de aceptación:

```markdown
## Autenticación
- CA-001: POST /auth/register acepta email + password, crea usuario, retorna JWT
- CA-002: POST /auth/login valida credenciales, retorna JWT con expiración 24h
- CA-003: Rutas de contactos requieren JWT válido; sin JWT retorna 401

## Contactos
- CA-004: GET /contactos retorna lista paginada por cursor (≤20 por página)
- CA-005: POST /contactos crea contacto asociado al usuario autenticado
- CA-006: GET /contactos/:id retorna contacto solo si pertenece al usuario
- CA-007: PUT /contactos/:id actualiza contacto; 403 si no es del usuario
- CA-008: DELETE /contactos/:id elimina contacto; 403 si no es del usuario
- CA-009: GET /contactos?q=nombre filtra por nombre (case-insensitive, parcial)
```

---

## Paso 4 — Verificar la spec con aclarar y checklist

```
/sdd.aclarar
```

El agente detecta `[NECESITA_ACLARACION]` en la spec: ¿qué campos tiene un contacto?

```
El usuario responde: nombre (requerido), email (opcional), teléfono (opcional), notas (opcional)
```

```
/sdd.checklist
```

Verifica que la spec tiene criterios de aceptación testeables, sin ambigüedades. Resultado: `8/8 ítems OK, 1 advertencia`.

Advertencia: `CA-009 no especifica qué pasa si q está vacío`. El usuario añade: `q vacío retorna todos los contactos (comportamiento de CA-004)`.

---

## Paso 5 — Planificar

```
/sdd.planificar
```

Los agentes activos durante esta fase:

**`arquitecto`** produce el diseño técnico:

```markdown
## Estructura de capas

src/
  routes/          ← Express routers, sin lógica de negocio
  services/        ← lógica de negocio pura, testeables sin HTTP
  repositories/    ← acceso a PostgreSQL, interfaces + implementaciones
  middleware/       ← auth JWT, manejo de errores
  types/           ← tipos compartidos

## Decisiones técnicas

| Decisión | Elegida | Alternativa descartada | Razón |
|---|---|---|---|
| Hash de contraseñas | bcrypt (salt rounds: 12) | argon2 | bcrypt es más estable en ecosistema Node |
| JWT library | jsonwebtoken | jose | jsonwebtoken tiene más años en producción |
| Paginación | por cursor (id) | por offset | offset degrada con tablas grandes |
| Pool de conexiones | pg.Pool nativo | pgBouncer | suficiente para escala inicial |

## Riesgos identificados (delego a crítico)
- Concurrencia en registro con mismo email
- Expiración de JWT sin refresh token en scope
```

**`asesor-datos`** produce el schema de BD:

```sql
CREATE TABLE usuarios (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE contactos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre      TEXT NOT NULL,
  email       TEXT,
  telefono    TEXT,
  notas       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para búsqueda por nombre (case-insensitive)
CREATE INDEX idx_contactos_nombre ON contactos USING gin(to_tsvector('simple', nombre));

-- Índice para paginación por cursor
CREATE INDEX idx_contactos_cursor ON contactos(usuario_id, id);
```

**`critico`** reporta:

```markdown
### 🔴 Riesgos altos

**R1 — Race condition en registro: dos requests con mismo email simultáneos**
- Probabilidad: Media (cualquier cliente que hace doble-click)
- Impacto: Alto (dos usuarios con el mismo email — corrupción de datos)
- Mitigación: El UNIQUE constraint en BD lo captura; el service debe manejar
  el error de violación de constraint y retornar 409 Conflict, no 500.
- Costo: Bajo — manejo de error ya planificado

### 🟡 Riesgos medios

**R2 — JWT sin refresh token**
- Probabilidad: Alta (expiración a las 24h es corta para apps móviles)
- Impacto: Medio (UX degradada, no un bug de seguridad)
- Mitigación: Documentar como limitación conocida; añadir refresh en v2
```

Usuario revisa y aprueba:

```
/sdd.planificar aprobar
```

---

## Paso 6 — Desglose de tareas

```
/sdd.tareas
```

El skill `enrutador-agentes` genera tareas atómicas y asigna el agente correcto:

```
T001 [arquitecto]         → Tipos TypeScript: Usuario, Contacto, JWTPayload, Result<T>
T002 [desarrollador-backend] → Repository: UsuarioRepository (interfaz + implementación pg)
T003 [desarrollador-backend] → Repository: ContactoRepository (CRUD + búsqueda + cursor)
T004 [desarrollador-backend] → Service: AuthService (register, login, verifyToken)
T005 [desarrollador-backend] → Service: ContactoService (crear, leer, actualizar, eliminar, buscar)
T006 [desarrollador-backend] → Middleware: authMiddleware (verifica JWT, añade usuario al request)
T007 [desarrollador-backend] → Routes: /auth/register, /auth/login
T008 [desarrollador-backend] → Routes: /contactos (GET lista, POST crear)
T009 [desarrollador-backend] → Routes: /contactos/:id (GET, PUT, DELETE)
T010 [tester]             → Tests de integración: flujo completo register→login→CRUD
T011 [operaciones]        → Docker Compose con PostgreSQL + migrations
```

---

## Paso 7 — Implementar

```
/sdd.analizar   ← auditoría cruzada antes de implementar (recomendado para proyectos medianos)
/sdd.implementar
```

FORGE ejecuta las tareas en secuencia. Ejemplo de output por tarea:

**T001 — arquitecto (tipos)**:
```typescript
// src/types/index.ts
export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: number };

export interface Usuario {
  id: string;
  email: string;
  created_at: Date;
}

export interface Contacto {
  id: string;
  usuario_id: string;
  nombre: string;
  email?: string;
  telefono?: string;
  notas?: string;
  created_at: Date;
}

export interface JWTPayload {
  sub: string;  // usuario_id
  email: string;
  iat: number;
  exp: number;
}
```

**T004 — desarrollador-backend (AuthService)**:
```typescript
// src/services/auth.service.ts
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import type { UsuarioRepository } from '../repositories/usuario.repository.js';
import type { Result } from '../types/index.js';

const JWT_SECRET = process.env.JWT_SECRET!;
const SALT_ROUNDS = 12;

export async function register(
  email: string,
  password: string,
  repo: UsuarioRepository
): Promise<Result<{ token: string }>> {
  const existing = await repo.findByEmail(email);
  if (existing) return { ok: false, error: 'Email ya registrado', code: 409 };

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
  const usuario = await repo.create({ email, password_hash });

  const token = jwt.sign({ sub: usuario.id, email }, JWT_SECRET, { expiresIn: '24h' });
  return { ok: true, data: { token } };
}
```

El `critico` evalúa T004 en el ciclo Evaluator-Optimizer:

```
EVALUACION: PASA (score: 9.2/10)
- CA-001: cubierto — register crea usuario y retorna JWT ✓
- Race condition R1: manejada — findByEmail antes de create; el UNIQUE constraint
  como fallback produce error que el service retorna como 409 ✓
- Observación menor: el error de UNIQUE constraint de pg debería caparse
  explícitamente en lugar de depender de findByEmail (no es bloqueante)
```

---

## Paso 8 — Verificar y desplegar

```
/sdd.verificar
```

Output:
```
Verificación de spec: 2026-06-20-agenda-contactos

CA-001 ✓  POST /auth/register → cubierto en AuthService + ruta + test T010
CA-002 ✓  POST /auth/login    → cubierto
CA-003 ✓  JWT requerido       → cubierto en authMiddleware + test T010
CA-004 ✓  Paginación cursor   → cubierto en ContactoRepository + ruta
CA-005 ✓  POST /contactos     → cubierto
CA-006 ✓  GET /contactos/:id  → cubierto + verificación de ownership
CA-007 ✓  PUT /contactos/:id  → cubierto + 403 si no es del usuario
CA-008 ✓  DELETE /contactos/:id → cubierto
CA-009 ✓  Búsqueda por nombre → cubierto con índice GIN

Tests: 47/47 pasando
Constitución: sin violaciones
Secrets: ninguno en el código

Gate: ✅ PASA — listo para desplegar
```

```
/sdd.desplegar
```

El usuario confirma escribiendo `desplegar`. El agente `operaciones` hace deploy a Railway (o Render, o cualquier plataforma configurada en la constitución), verifica el health check y registra la URL en `.sdd/estado.json`.

---

## Resumen de lo que produce cada agente

| Agente | Tarea | Artefacto producido |
|---|---|---|
| `investigador` | Interpretar idea | `.sdd/ir.json` |
| `arquitecto` | Planificar | Decisiones técnicas, estructura de capas |
| `asesor-datos` | Planificar | Schema SQL + índices + estrategia de migración |
| `critico` | Planificar | Reporte de riesgos con mitigaciones |
| `arquitecto` | T001 implementar | `src/types/index.ts` |
| `desarrollador-backend` | T002-T009 implementar | Código de producción + unit tests |
| `tester` | T010 implementar | Tests de integración |
| `operaciones` | T011 implementar | `docker-compose.yml` + migration SQL |
| `revisor` | Verificar | Score por CA + deuda técnica identificada |

---

## Diferencias con el caso introductorio (lista de tareas)

| Aspecto | Todo app | Agenda de contactos |
|---|---|---|
| Complejidad estimada | `baja` | `media` |
| Modelos usados (grupo OPUS) | `sonnet` | `sonnet` (igual — media y baja usan sonnet) |
| Agentes activos | 4 | 8 (incluye `asesor-datos`, `disenador-api`, `operaciones`) |
| Ciclo Evaluator-Optimizer | no (complejidad baja) | sí (tareas de auth y repositories) |
| Tests generados | 5 unitarios | 47 (unitarios + integración) |
| Fases del flujo | 4 (interpretar, diseñar, implementar, desplegar) | 7 (+ aclarar, checklist, analizar) |
