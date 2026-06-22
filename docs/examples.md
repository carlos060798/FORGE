# Ejemplos

Recorridos completos de extremo a extremo que ilustran FORGE en escenarios reales.

---

## Ejemplo 1 — API REST con autenticación JWT

**Escenario:** Un desarrollador necesita construir una API REST con Node.js, JWT y PostgreSQL para una aplicación de gestión de tareas.

**Nivel de complejidad:** Medio  
**Tiempo estimado:** 2–3 sesiones

---

### Sesión 1: Descubrimiento y planificación

```
/sdd.descubrir necesito una API REST para gestión de tareas de equipos
```

FORGE ejecuta el formulario de discovery:

```
FORGE: ¿Para quién es esta API? ¿Quiénes serán los usuarios principales?
Usuario: Equipos de desarrollo, de 3 a 20 personas por equipo

FORGE: ¿Qué problema resuelve que las alternativas actuales no cubren bien?
Usuario: Los equipos usan Jira pero es muy complejo. Queremos algo simple
         con API limpia para integrar con nuestras herramientas internas.

FORGE: ¿Qué debería poder hacer alguien en su primera sesión con esta API?
Usuario: Crear una tarea, asignarla a alguien del equipo, marcarla como hecha.
```

Tras las cinco preguntas, FORGE procede automáticamente:

```
/sdd.interpretar
```

Resultado en `.sdd/ir.json`:
```json
{
  "confidence": 0.89,
  "product": {
    "name": "TaskAPI",
    "type": "api",
    "target_users": "Equipos de desarrollo 3-20 personas"
  },
  "features": {
    "core": [
      "gestión de tareas (CRUD)",
      "equipos y membresía",
      "asignación de tareas",
      "estados (pendiente/en progreso/completada)",
      "autenticación JWT"
    ]
  }
}
```

```
/sdd.diseñar
```

El agente `architecture-designer` recomienda:
- Backend: Node.js 20 + Fastify + TypeScript
- Base de datos: PostgreSQL 16
- Autenticación: JWT con RS256
- Despliegue: Railway
- Complejidad estimada: `medium`

```
/sdd.especificar
```

El agente `arquitecto` + `disenador-api` producen `spec.md` con criterios como:

```markdown
## AC-001: Autenticación
- DADO un usuario con email y contraseña registrados
- CUANDO POST /auth/login con credenciales correctas
- ENTONCES recibe { token: JWT, expires_in: 900 }
- Y el token es válido por 15 minutos

## AC-007: Crear tarea
- DADO un usuario autenticado y miembro de un equipo
- CUANDO POST /teams/{id}/tasks con { title, assignee_id }
- ENTONCES la tarea se crea con estado "pending"
- Y se devuelve 201 con el objeto tarea completo
```

```
/sdd.planificar
```

El agente `arquitecto` diseña el plan. El agente `critico` identifica un riesgo:

> *"El plan no contempla el caso de tokens expirados durante una operación larga. ¿Se renovará automáticamente o el cliente debe manejar 401?"*

Se resuelve la ambigüedad y se añade a la spec. El plan se aprueba.

---

### Sesión 2: Implementación

```
/sdd.tareas
```

FORGE genera 11 tareas atómicas:

```
T-001: Schema BD (asesor-datos)          ← sin dependencias
T-002: Migrations (asesor-datos)         ← depende T-001
T-003: Config Fastify + env (dev-backend) ← sin dependencias
T-004: Auth middleware JWT (dev-backend)  ← depende T-003
T-005: Endpoints /auth/* (dev-backend)   ← depende T-004
T-006: Endpoints /teams/* (dev-backend)  ← depende T-004
T-007: Endpoints /tasks/* (dev-backend)  ← depende T-006
T-008: Tests unitarios auth (tester)     ← depende T-005
T-009: Tests integración API (tester)    ← depende T-007
T-010: Dockerfile + Railway config (ops) ← depende T-003
T-011: Revisión final (revisor)          ← depende T-009
```

```
/sdd.implementar
```

FORGE despacha agentes en orden de dependencias. La sesión termina tras T-007.

---

### Sesión 3: Tests, verificación y despliegue

```
/sdd.implementar continuar
```

FORGE reanuda desde T-008. El agente `tester` escribe 43 tests. El agente `revisor` aprueba.

```
/sdd.verificar
```

Resultado: 11/11 criterios de aceptación cumplidos. Cobertura: 84%.

```
/sdd.desplegar
```

El agente `seguridad` hace auditoría final. El agente `operaciones` despliega a Railway. Health check: `200 OK`.

---

## Ejemplo 2 — Modo guiado para no-programadores

**Escenario:** Un emprendedor sin conocimientos técnicos quiere construir una landing page para su producto SaaS.

**Nivel de complejidad:** Bajo  
**Tiempo estimado:** 1 sesión

---

```bash
npx forge-sdd init --guided --preset lean
```

El wizard guiado pregunta:
```
? Perfil: guiado
? Stack: otro (no sé de tecnología)
? Despliegue: Vercel
? Calidad de modelos: equilibrada (Sonnet)
```

---

```
/forge
```

```
FORGE: ¡Hola! Cuéntame qué quieres construir. Puedes describirlo
       como si se lo explicaras a un amigo.

Usuario: Quiero una página web para mostrar mi app de meditación.
         Que tenga una sección de qué es, para quién es, precios
         y un botón para unirse a la lista de espera.

FORGE: Perfecto. Solo necesito entender un poco más para construir
       algo que realmente funcione para ti...
```

Tras el discovery, FORGE produce el IR y continúa:

```
FORGE: He entendido tu idea. Voy a proponer el diseño de la página.
       ¿Qué estilo visual te gusta más?

       1. Minimalista — simple y limpia
       2. Bold — impactante y moderna
       3. Cálida — acogedora y amigable ← recomendada para apps de bienestar
       4. Editorial — inspirada en revistas
       5. Brutalist — sin decoraciones, muy directa

Usuario: La 3, la cálida
```

FORGE genera el wireframe y la spec en lenguaje llano:

```
FORGE: Aquí está lo que voy a construir:

  ✦ Sección hero: título, subtítulo, botón "Únete a la lista de espera"
  ✦ Sección "Para quién es": 3 perfiles de usuario con iconos
  ✦ Sección de precios: 2 planes (gratis y premium)
  ✦ Formulario de lista de espera: email + botón
  ✦ Footer simple

  ¿Esto es lo que tenías en mente? (sí/no/cambiar algo)

Usuario: sí, perfecto
```

```
/sdd.implementar
```

FORGE genera la landing completa como HTML + CSS. Sin frameworks, sin dependencias.

```
/sdd.desplegar
```

El agente `operaciones` despliega a Vercel. URL activa en 3 minutos.

---

## Ejemplo 3 — Prototipar rápido con modo prototipo

**Escenario:** Un desarrollador quiere explorar una idea de API de reportes sin comprometerse a producción.

```
/sdd.modo prototipo
/sdd.especificar API de reportes analíticos para dashboard
```

En modo `prototipo`:
- ❌ Sin agente `critico`
- ❌ Sin agente `seguridad`
- ❌ Sin generación de ADRs
- ✅ Solo los pasos esenciales

```
FORGE: ⚠️ Modo prototipo activo.
       Este plan no es apto para producción.
       Los agentes de crítica y seguridad están desactivados.
```

La spec se genera en ~3 minutos. La implementación en ~20 minutos.

Para convertir el prototipo en producción:

```
/sdd.modo normal
/sdd.analizar    ← auditoría de lo que se construyó
/sdd.planificar  ← re-planificación con todos los agentes
```

---

## Ejemplo 4 — Reanudar una implementación interrumpida

**Escenario:** La implementación de una feature se interrumpió en T-006 de 12. El desarrollador abre Claude Code al día siguiente.

```
/sdd.estado
```

```
FORGE v4.0.0 — Estado del proyecto

  Pipeline:     implementar (etapa 6/10)
  Spec activa:  2026-06-20-user-notifications
  Progreso:     T-006 / T-012 (50%)
  Última acción: desarrollador-backend — src/notifications/email.service.ts
                 (ayer a las 18:42)
  Modo:         normal
```

```
/sdd.implementar continuar
```

FORGE reanuda desde T-007 automáticamente. No hay que repetir contexto ni explicar dónde se quedó.

---

## Ejemplo 5 — Añadir un agente especializado

**Escenario:** El equipo necesita un agente que genere tests de accesibilidad con `axe-core`.

```
/sdd.crear-agente
```

```
FORGE: ¿Nombre del agente? accessibility-tester
FORGE: ¿Modelo? sonnet
FORGE: ¿Herramientas? Read, Write, Edit, Bash
FORGE: ¿Fase de activación? implementar
FORGE: ¿Descripción? Tests de accesibilidad con axe-core y WCAG 2.1 AA
```

FORGE crea `agents/accessibility-tester.md` y actualiza `plugin.json`.

Editar `sdd.config.yaml`:

```yaml
agentes:
  accessibility-tester:
    activo: true
    modelo: sonnet
```

Desde el siguiente `/sdd.tareas`, el nuevo agente aparece como opción para tareas de tipo `accesibilidad`.

---

## Ejemplo 6 — Ver el historial de un agente

**Escenario:** El desarrollador quiere entender qué cambió el agente `asesor-datos` en las últimas dos sesiones.

```bash
# Abrir el dashboard
forge ui
# Navegar a localhost:3001 → panel de agentes → asesor-datos
```

O directamente:

```bash
cat .sdd/memoria/agente-asesor-datos.md
```

```markdown
# Memoria — asesor-datos

## 2026-06-21T14:20:00Z
**Archivo:** db/migrations/002_add_indexes.sql
**Acción:** Añadió índice en users.email y tasks.assignee_id
**Contexto:** Query de búsqueda de tareas por usuario era O(n) sin índice

## 2026-06-20T18:30:00Z
**Archivo:** db/migrations/001_init.sql
**Acción:** Schema inicial — tablas users, teams, team_members, tasks
**Decisión:** Sin ORM — SQL directo via pg (ver constitución)
```

---

## Ejemplo 7 — Auditoría antes del despliegue

**Escenario:** Antes de un despliegue importante, el equipo quiere asegurarse de que todo es consistente.

```
/sdd.analizar
```

El agente `revisor` hace auditoría cruzada entre constitución, spec, plan y código:

```
FORGE: Auditoría completada.

  ✅ Spec: 11/11 criterios con implementación correspondiente
  ✅ Constitución: sin violaciones detectadas
  ⚠️  Plan: ADR-002 referencia 'connection pooling' pero no hay config visible
  ⚠️  Tests: cobertura en src/auth/ es 71% (mínimo: 80%)

  Recomendación: resolver las advertencias antes del despliegue
```

El equipo decide resolver las advertencias:

```
/sdd.implementar    ← agente tester añade tests en auth/
/sdd.configurar set calidad.cobertura_tests_minima 75    ← ajuste temporal documentado
```

---

## Patrones de uso recomendados

### Para proyectos nuevos

```bash
npx forge-sdd init --guided   # configuración adaptada al proyecto
/sdd.constitucion              # establecer principios antes de cualquier código
/sdd.descubrir                 # empezar desde la idea
```

### Para proyectos existentes

```bash
npx forge-sdd init            # instalación sin --guided
/sdd.mapear                   # indexar el código existente
/sdd.constitucion             # documentar las convenciones actuales
/sdd.especificar              # especificar la siguiente feature
```

### Para iteraciones rápidas

```
/sdd.modo rapido
/sdd.especificar [feature]
/sdd.planificar
/sdd.implementar
/sdd.modo normal              ← restaurar para el merge final
```

### Para features de alto riesgo

```
/sdd.constitucion             ← actualizar si cambia el stack
/sdd.especificar
/sdd.checklist                ← validar calidad de la spec
/sdd.planificar               ← critico + seguridad activos
/sdd.analizar                 ← auditoría pre-implementación
/sdd.implementar
/sdd.verificar
/sdd.desplegar
```
