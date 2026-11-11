# Hoja de ruta

Estado a 2026-11-10. Versión del árbol: `5.0.0-beta.1`, **sin publicar** en npm. Proyecto en pre-beta con un solo mantenedor ([GOVERNANCE.md](../GOVERNANCE.md)).

Esta hoja de ruta es una lista de intenciones ordenadas, **no una promesa de fechas**: no hay plazos garantizados. Las cifras y los límites detallados están en [ESTADO-ACTUAL.md](ESTADO-ACTUAL.md); si algo aquí contradice esa página, manda ella. Las fuentes de cada estado son las especificaciones de `.sdd/especificaciones/` ([.sdd/INDICE.md](../.sdd/INDICE.md)) y [RELEASE-CHECKLIST.md](../RELEASE-CHECKLIST.md).

Estados usados:

- **Hecho**: está en `main` y tiene pruebas o evidencia citada.
- **En curso**: parte hecha, parte pendiente.
- **Planificado**: especificado o previsto, sin implementar.
- **Necesita decisión del dueño**: no avanza hasta que el dueño decida.

Una especificación en `borrador` o sin aprobar no cuenta como aprobada aunque esté implementada: la aprobación es del dueño.

---

## Hecho (5.0.0)

- **Ciclo verificado** por defecto: planificación, pruebas, implementación y mutación en un contenedor sin red. [ciclo-verificado.md](ciclo-verificado.md).
- **`fragua verificar`**: veredicto aislado de un proyecto, con mutación, `--registrar`, `--criterios` y `--comprobar-evidencia`.
- **Puertas de calidad** declarables en `sdd.config.yaml`. [puertas-de-calidad.md](puertas-de-calidad.md).
- **Perfiles de agente por rol**: el proyecto solo puede apretar, nunca ampliar (faltan las tareas F6 y F7 de su especificación).
- **Estado del ciclo sellado** con una clave local del usuario y aprobaciones con registro firmado.
- **Guardián endurecido** (análisis por argv, falla cerrado). Es una red de seguridad, no un límite: ver [SECURITY.md](../SECURITY.md).
- **Servidor MCP** con perfil de verificación y **API HTTP local**. [servidor-mcp.md](servidor-mcp.md), [api-http.md](api-http.md).
- **Contrato público** versionado en `docs/contrato/`.
- **Cuarentena de pruebas** (ADR-23) y job `test-windows` en la CI escritos.

---

## Plan «marco mínimo viable para el desarrollador individual»

Cuatro fases, en orden.

### Fase 1 — CI verde en Linux y Windows: **en curso**

Spec `2026-11-09-ci-verde-y-cuarentena` (borrador, sin aprobar).

- Hecho: jobs `test` (Node 20 y 22), `test-windows`, `tipos`, `evidencia`, `aislamiento`, `pruebas-docker` y `cuarentena` (no bloqueante) en `.github/workflows/ci.yml`; acciones fijadas por SHA.
- Hecho en Windows 11, en local, el 2026-11-10: tres pasadas seguidas de la suite con 0 fallos, y una pasada de los 17 archivos con Docker real (597 pruebas, 0 fallos tras corregir un helper de pruebas).
- Pendiente: que la CI de GitHub salga **verde** en Linux. La última comprobación documentada (2026-11-09) tenía en rojo `Tests (Node 22)`, `Aislamiento con Docker real` y `Pruebas con Docker real`; leer los logs y clasificar los fallos exige autenticación del dueño (tarea T8). Tres pasadas con Docker real (hoy una) y el aislamiento en Linux siguen sin medirse.

### Fase 2 — Puerta de entrada de 15 minutos: **en curso**

Spec `2026-11-09-puerta-de-entrada-solo-dev` y ADR-24 (propuesta).

- Hecho: perfil de instalación `esencial` y preset `lean` por defecto, `doctor` con «Siguiente paso», [PRIMEROS-15-MINUTOS.md](PRIMEROS-15-MINUTOS.md).
- Pendiente: aprobación formal del dueño; comprobar con personas reales que de verdad cabe en 15 minutos.

### Fase 3 — Beta publicada con dist-tag `beta`: **necesita decisión del dueño**

- El paquete está en `5.0.0-beta.1` y no se ha publicado nada (`fragua` no existe en npm; consultado el 2026-10-14, repetir el día de publicar). Se publicaría con `npm publish --tag beta` para que `latest` no se mueva.
- Los criterios de salida B1 a B5 están en [RELEASE-CHECKLIST.md](../RELEASE-CHECKLIST.md): la CI verde (Fase 1) es B1; B2 está cumplido sin Docker en Windows y falta con Docker y en Linux; B3 (conjunto de tareas reales con su tasa de éxito, con umbral fijado por el dueño) y B4 (gasto calculado frente al facturado) no existen; B5 (cuarta revisión independiente) está pendiente.
- Decisiones del dueño: cuándo publicar, comprobar marca y dominio de «Fragua», rotar claves expuestas en conversaciones, aprobar las specs.

### Fase 4 — Uso real: **planificado**

- Hecho: una [plantilla de registro de uso real](uso-real/PLANTILLA.md).
- Pendiente: usar Fragua en proyectos reales, anotar tiempo, gasto y fallos con datos, y publicar los resultados sean cuales sean.

---

## Visión posterior

Nada de esto empieza antes de cerrar el plan anterior, salvo que el dueño decida otra cosa.

| Línea | Spec | Estado |
|---|---|---|
| **Equipos pequeños y ciclo en CI**: aprobaciones atribuibles a personas, estado compartible por git, ciclo verificado en la integración continua | `2026-11-10-equipos-y-ciclo-en-ci` | Planificado. Solo especificación (borrador), nada implementado. **Necesita decisión del dueño**: tiene cinco decisiones abiertas |
| **Aislamiento opcional**: nivel base sin Docker y nivel aislado, con el nivel usado visible en cada veredicto | `2026-11-06-aislamiento-opcional` | **Necesita decisión del dueño**: cambia una garantía. Solo especificación, nada implementado |
| **Ciclo desde otros hosts** (Cursor, Codex, etc.) por MCP | `2026-10-14-ciclo-por-mcp` | En curso: solo la fase 1 (`verificar` por MCP, sin gasto) está aprobada por delegación e implementada; las fases 2 y 3 están sin implementar |
| **Multi-proveedor real**: Anthropic, OpenAI y Ollama con herramientas y niveles neutrales | `2026-10-13-proveedores-agnosticos` | En curso: hay batería de conformidad con servidores falsos ([guia-anadir-proveedor.md](guia-anadir-proveedor.md)); **sin probar con un modelo real** en OpenAI y Ollama; spec en borrador |
| **Integraciones con GitHub, GitLab y Jira** con mínimo privilegio | `2026-10-11-integraciones-externas` | En curso; no probado con cuentas reales |
| **Despliegue con aprobación** (adaptador de AWS) | `2026-10-14-despliegue-con-aprobacion` | Planificado. Solo especificación |

### Pendientes de código ya empezados

- Perfiles de agente, tareas F6 y F7.
- Puertas de calidad, tareas F4 y F7, y el evento `ciclo:llamada` con `modeloServido`.
- Servidor MCP de edición: decidir si pasa también por el perfil de agente.
- Puertas ligadas a los `tsconfig` referenciados (`extends`).
- Revisiones independientes de las correcciones recientes.

---

## Ideas sin fecha

Venían de un roadmap anterior y no se han vuelto a verificar contra el código actual: son intenciones, no compromisos.

- Elegir el modelo por complejidad de la tarea y no fijo por agente.
- Análisis incremental del AST en proyectos grandes.
- Índice persistente para las decisiones (hoy se recalcula al arrancar).
- Marketplace de plantillas de proyecto.
- Embeddings locales (vía Ollama) para la memoria.
- Modo headless completo con repetición de sesiones.
- Carga en caliente de plugins.
- Coordinación entre repositorios en un monorepo.

## Lo que Fragua no hará

- **Un proveedor de Google/Gemini propio**: los existentes cubren los casos previstos (un proveedor nuevo puede añadirse siguiendo [guia-anadir-proveedor.md](guia-anadir-proveedor.md) si cumple la batería de conformidad).
- **Una interfaz de terminal propia**: Claude Code es la interfaz.
- **Un ORM o un cliente de base de datos propios**: Fragua genera código que usa las herramientas del proyecto.
- **WebSockets en el panel**: el flujo es unidireccional y SSE basta.

## Cómo influir en la hoja de ruta

Abre una incidencia describiendo el problema ([SUPPORT.md](../SUPPORT.md)) o propone una spec ([CONTRIBUTING.md](../CONTRIBUTING.md)). Las prioridades las fija el dueño.
