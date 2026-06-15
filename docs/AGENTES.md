# Guía de Agentes Especializados

SDD-ES incluye 14 agentes con roles bien definidos. Esta guía explica cuándo se activa cada uno.

## Tabla rápida

| Agente | Modelo recomendado | Cuándo se activa | Para qué |
|--------|--------------------|------------------|----------|
| arquitecto | opus | `/sdd.planificar`, fase A | Decisiones técnicas de alto nivel |
| disenador-api | sonnet | `/sdd.planificar` (si hay contratos) | OpenAPI, GraphQL, gRPC, eventos |
| asesor-datos | opus | `/sdd.planificar` (si toca BD) | Schemas, queries, índices, migraciones |
| desarrollador-backend | sonnet | `/sdd.implementar` (servidor) | Servicios, controllers, lógica |
| desarrollador-frontend | sonnet | `/sdd.implementar` (UI) | Componentes, vistas, estado cliente |
| operaciones | sonnet | `/sdd.implementar` (infra) | CI/CD, Docker, IaC, deploy |
| tester | sonnet | `/sdd.implementar` (tests) | Unitarios, integración, E2E |
| revisor | opus | Al final de `/sdd.implementar` | Revisión cruzada de calidad |
| critico | opus | `/sdd.planificar`, `/sdd.analizar` | Riesgos y puntos ciegos |
| seguridad | opus | Cambios sensibles automáticamente | Auditoría de vulnerabilidades |
| documentador | sonnet | Bajo demanda (desactivado por defecto) | Docs útiles (no obvias) |
| investigador | sonnet | Bajo demanda | Investigación técnica, benchmarks, comparativas |
| product-designer | opus | `/sdd.diseñar` (fase de producto) | Pantallas P0/P1/P2, user flow, mvp_scope |
| architecture-designer | sonnet | `/sdd.diseñar` (fase de stack) | Stack más simple viable, decisión técnica en lenguaje llano |

## Cuándo activar/desactivar agentes

### Proyectos típicos

**API REST sin frontend:**
```yaml
disenador-api: activo
desarrollador-backend: activo
desarrollador-frontend: desactivado  ← no necesario
asesor-datos: activo
operaciones: activo
```

**SPA sin backend propio (consume APIs externas):**
```yaml
desarrollador-frontend: activo
desarrollador-backend: desactivado
asesor-datos: desactivado
disenador-api: desactivado
```

**MVP / Side project / Prototipo:**
```yaml
critico: desactivado          ← acelera el flujo
seguridad: desactivado        ← no es producto público aún
documentador: desactivado
# todos los modelos a sonnet o haiku
```

**Producto enterprise / Crítico:**
```yaml
# Todos activos
# Modelos opus en: arquitecto, asesor-datos, revisor, critico, seguridad
```

## Cómo se invocan los agentes

Los agentes NO se invocan manualmente por el usuario. El plugin los orquesta:

- **Durante `/sdd.planificar`**: el orquestador llama a `arquitecto`, `disenador-api`, `asesor-datos`, `critico` (y `seguridad` si es sensible). Cada uno aporta su sección al plan.

- **Durante `/sdd.implementar`**: por cada tarea, el skill `enrutador-agentes` decide qué agente la ejecuta según el tipo de tarea.

- **Al final de `/sdd.implementar`**: el `revisor` cruza el código contra la spec; el `tester` ejecuta la suite; el `seguridad` audita si tocó algo sensible.

## Personalizar un agente

Los agentes son archivos Markdown plano. Edita `.claude/agents/[nombre].md` para:
- Cambiar la personalidad/tono
- Añadir restricciones específicas de tu proyecto
- Cambiar el formato de salida
- Agregar conocimiento de domain específico

Cambios al frontmatter `model:` se sobreescriben con la config en `.sdd/sdd.config.yaml`.
