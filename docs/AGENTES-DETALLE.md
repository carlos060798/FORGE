# Referencia detallada de agentes

Cada agente es un archivo Markdown en `.claude/agents/` que Claude Code carga bajo demanda. Esta guía explica qué produce cada uno, cómo depurarlo y cómo personalizarlo.

Para la tabla rápida de activación y modelos recomendados, ver [AGENTES.md](AGENTES.md).

---

## arquitecto

**Rol**: diseñador de la solución técnica. Toma las decisiones difíciles de revertir.

**Se activa en**: `/sdd.planificar` (fase A) y en tareas de tipos/interfaces durante `/sdd.implementar`.

**Herramientas**: Read, Grep, Glob, Bash — **solo lectura** (L5 bloquea Write/Edit).

**Qué produce**:
- Tabla de decisiones técnicas con alternativas evaluadas y justificación
- Estructura de carpetas propuesta
- Lista de archivos afectados (alto nivel)
- Riesgos técnicos identificados

**Formato de salida**:
```markdown
## Decisión: [Nombre]
**Opciones consideradas:** A (pros/contras), B (pros/contras)
**Elegida:** A
**Justificación:** [razón técnica concreta]
**Trade-off aceptado:** [qué sacrificamos]
**Cuándo revisitar:** [condición específica]
```

**Cómo depurarlo**:
- Si propone una decisión contraria a tu constitución: revisa `.sdd/memoria/constitucion.md`. El agente debe respetar esos principios; si los viola, edita la constitución para hacerlos más explícitos.
- Si sobre-ingenia: añade en tu constitución `sin abstracciones especulativas` o `YAGNI estricto`.
- Si usa un stack que no querías: especifica el stack en el IR (`ir.json`) antes de planificar.

**Personalización**:
```yaml
# .sdd/sdd.config.yaml
agentes:
  arquitecto:
    modelo: sonnet   # para proyectos pequeños
```

O edita `.claude/agents/arquitecto.md` para añadir restricciones de dominio específicas de tu proyecto.

---

## disenador-api

**Rol**: diseña contratos de API (REST, GraphQL, gRPC, eventos asíncronos).

**Se activa en**: `/sdd.planificar` cuando la spec menciona endpoints, contratos o integraciones externas.

**Qué produce**:
- Especificación OpenAPI 3.x o schema GraphQL
- Decisión de protocolo con justificación
- Convenciones de naming y paginación
- Lista de endpoints con verbos HTTP, payloads y códigos de respuesta

**Depuración**:
- Si genera demasiados endpoints: añade en la spec `principio YAGNI — solo endpoints que la UI necesita hoy`.
- Si elige REST cuando querías GraphQL: especifícalo en el IR bajo `constraints.tech_preference`.

---

## asesor-datos

**Rol**: diseña schemas de base de datos, queries y estrategias de migración.

**Se activa en**: `/sdd.planificar` cuando la spec toca persistencia de datos.

**Herramientas**: Read, Grep, Glob, Bash — **solo lectura** (L5 bloquea Write/Edit).

**Qué produce**:
- Schema de tablas/colecciones con tipos y constraints
- Decisión de motor de BD con justificación (PostgreSQL, SQLite, MongoDB, Redis…)
- Índices recomendados
- Plan de migración si hay datos existentes
- Advertencias sobre volumen y rendimiento

**Depuración**:
- Si sugiere un motor distinto al que ya usas: decláralo en la constitución (`base de datos: PostgreSQL`).
- Si genera migraciones demasiado agresivas: pide en la spec `migraciones incrementales sin downtime`.

---

## desarrollador-backend

**Rol**: implementa la lógica de servidor — servicios, controllers, casos de uso, validaciones.

**Se activa en**: `/sdd.implementar` para tareas de fases C (lógica), D (integración) y E (datos).

**Stacks**: TypeScript/Node, Python, Rust, Go, Java/Kotlin, .NET, Ruby, PHP.

**Qué produce**:
- Código de producción siguiendo los patrones existentes del proyecto
- Tests unitarios para funciones no triviales (TDD ligero)
- Lista de archivos modificados
- Confirmación de que los tests pasan

**Depuración**:
- Si rompe patrones del proyecto: el agente lee código existente para inferir convenciones. Si el proyecto es nuevo y no hay convenciones, declara el estilo en la constitución.
- Si deja `console.log` de debug: está en su lista de prohibiciones. Si ocurre, es un bug del agente — reporta en GitHub.
- Si escala una tarea como bloqueada: es intencional. No improvisa decisiones de arquitectura; el orquestador debe resolverlo.

---

## desarrollador-frontend

**Rol**: implementa componentes de UI, estado del cliente y experiencia de usuario.

**Se activa en**: `/sdd.implementar` para tareas de tipo UI/UX.

**Frameworks**: React, Vue, Svelte, Angular, HTML/CSS/JS vanilla.

**Qué produce**:
- Componentes siguiendo el sistema de diseño del proyecto
- Manejo de estado (local, contexto o store según el proyecto)
- Tests de componente donde aplican
- Accesibilidad básica (aria-labels, roles semánticos)

**Depuración**:
- Si genera componentes con el framework equivocado: especifica el stack en `sdd.config.yaml` o en la constitución.
- Si ignora el sistema de diseño: asegúrate de que existe un `design-systems/` con un `DESIGN.md` activo.

---

## operaciones

**Rol**: infraestructura, CI/CD, contenedores, deploy y monitoreo.

**Se activa en**: `/sdd.implementar` para tareas de tipo infra/deploy.

**Qué produce**:
- Dockerfiles y docker-compose
- Pipelines de CI (GitHub Actions, GitLab CI)
- IaC (Terraform, Pulumi) si está en scope
- Scripts de deploy
- Variables de entorno documentadas (nunca valores reales)

**Depuración**:
- Si genera pipelines para el CI equivocado: especifica `ci: github-actions` en la constitución.
- Si pone secretos en el código: el hook L5 lo bloquea y reporta el archivo. Revisa el log del hook.

---

## tester

**Rol**: suite de tests de integración, E2E y QA automatizado.

**Se activa en**: al final de `/sdd.implementar` para la cobertura de integración y E2E.

**Qué produce**:
- Tests de integración (API, BD, servicios externos)
- Tests E2E con Playwright o Cypress si hay frontend
- Reporte de cobertura
- Lista de casos borde no cubiertos

**Depuración**:
- Si genera tests con el framework equivocado: declara `test_framework: vitest` (u otro) en `sdd.config.yaml`.
- Si los tests fallan en CI pero pasan local: suele ser una variable de entorno faltante. Revisa `.sdd/estado.json` y los logs del hook.

---

## revisor

**Rol**: revisión cruzada de calidad al final de la implementación.

**Se activa en**: automáticamente al finalizar `/sdd.implementar`.

**Qué produce**:
- Verificación de cada criterio de aceptación del spec (cubierto / parcialmente / no cubierto)
- Lista de deuda técnica introducida
- Score de calidad (0-10 por CA)
- Recomendaciones de mejora con prioridad

**Depuración**:
- Si marca CAs como no cubiertos cuando sí lo están: el agente es conservador por diseño. Puedes ignorar si tienes cobertura de tests que lo demuestra.
- Si el ciclo Evaluator-Optimizer se repite más de 3 veces: el orquestador cierra la tarea. Investiga el CA que no pasa.

---

## critico

**Rol**: abogado del diablo. Detecta riesgos, asunciones implícitas y puntos ciegos antes de implementar.

**Se activa en**: `/sdd.planificar` y `/sdd.analizar`. También automático cuando la spec toca auth, dinero, datos sensibles o migraciones de BD.

**Herramientas**: Read, Grep, Glob, Bash — **solo lectura** (L5 bloquea Write/Edit).

**Qué produce**:
```
🔴 Riesgos altos   → probabilidad alta × impacto alto
🟡 Riesgos medios  → uno de los dos factores es bajo
🟢 Asunciones      → no son riesgos, pero deben ser explícitas
Veredicto          → nivel de riesgo general del plan
```

**Depuración**:
- Si bloquea el plan con riesgos teóricos: el `critico` debe proponer mitigación para cada riesgo. Si no lo hace, reporta en GitHub. Puedes overridear desactivándolo en `sdd.config.yaml` para prototipos.
- Si no detecta riesgos obvios: sube el modelo a `opus` en `sdd.config.yaml`. Con `sonnet` o `haiku` pierde profundidad de análisis adversarial.

---

## seguridad

**Rol**: auditoría de vulnerabilidades. Revisa código y diseño contra OWASP Top 10 y amenazas específicas del stack.

**Se activa en**: automáticamente cuando la spec toca: autenticación, autorización, pagos, datos personales, uploads, APIs externas.

**Qué produce**:
- Lista de vulnerabilidades encontradas (severidad: crítica / alta / media / baja)
- Evidencia concreta (archivo, línea, payload de ejemplo)
- Remediación propuesta
- Checklist de seguridad completado

**Depuración**:
- Si reporta falsos positivos: añade una nota en la spec explicando el contexto (ej: "el endpoint X es interno, no expuesto a internet").
- Si no se activa en cambios sensibles: verifica que el hook `pre-tool-guard.js` está instalado y activo.

---

## documentador

**Rol**: genera documentación útil (no obvia). Desactivado por defecto para no generar ruido.

**Se activa en**: bajo demanda explícita o cuando el plan lo incluye.

**Qué produce**:
- READMEs con ejemplos de uso
- Documentación de API (si no la produce `disenador-api`)
- Guías de contribución
- Changelogs

**Activar**:
```yaml
# .sdd/sdd.config.yaml
agentes:
  documentador:
    activo: true
```

---

## investigador

**Rol**: investiga alternativas técnicas, benchmarks y comparativas antes de tomar decisiones.

**Se activa en**: bajo demanda, o cuando el plan incluye una fase de investigación.

**Qué produce**:
- Comparativa de opciones con criterios ponderados
- Benchmarks si están disponibles públicamente
- Recomendación con justificación
- Referencias a fuentes

---

## product-designer

**Rol**: diseño de producto — flujos de usuario, pantallas P0/P1/P2, MVP scope.

**Se activa en**: `/sdd.diseñar` (fase de producto), antes del stack técnico.

**Qué produce**:
- Definición de pantallas priorizadas (P0 = crítico, P1 = importante, P2 = nice-to-have)
- User flow completo
- MVP scope (qué entra y qué no)
- `product-design.json` que alimenta al `architecture-designer`

---

## architecture-designer

**Rol**: elige el stack técnico más simple viable para el producto definido.

**Se activa en**: `/sdd.diseñar` (fase de stack), después del `product-designer`.

**Qué produce**:
- Decisión de stack con justificación en lenguaje llano
- Alternativas descartadas y por qué
- Diagrama de componentes de alto nivel
- Estimación de complejidad (`baja` / `media` / `alta`) que alimenta el routing dinámico de modelos

---

## Preguntas frecuentes

**¿Puedo invocar un agente manualmente?**
Sí. En Claude Code escribe `@arquitecto analiza el schema de la base de datos`. Pero para flujos completos usa los comandos `/sdd.*` — el orquestador los invoca en el orden correcto.

**¿Por qué un agente no escribe código?**
`arquitecto`, `critico` y `asesor-datos` son read-only por diseño (L5 Governance). Analizan y recomiendan; los agentes desarrollador-* ejecutan los cambios. Esto evita que el analizador también sea el ejecutor — separación de responsabilidades.

**¿Cómo sé qué agente ejecutó una tarea?**
El log de `/sdd.implementar` muestra `[agente] → tarea → resultado`. También puedes ver la memoria del agente en `.sdd/memoria/agente-{nombre}.md`.

**¿Puedo añadir un agente propio?**
Sí: crea `.claude/agents/mi-agente.md` con frontmatter `name`, `description`, `model` y `tools`. No necesita estar en `plugin.json` para usarse manualmente con `@mi-agente`. Para que el orquestador lo invoque automáticamente, edita el skill `enrutador-agentes`.
