# Hoja de ruta

Este documento describe el estado actual de FORGE y las mejoras planificadas, derivadas del análisis del código existente, los planes en `PLAN-V280-V300.md` y la deuda técnica identificada.

---

## Estado actual: v4.0.0

La versión 4.0.0 completó cuatro fases de desarrollo:

| Fase | Descripción | Estado |
|------|-------------|--------|
| Identidad y orientación | Nombre `forge-sdd`, hub `/forge`, modo guiado, onboarding | ✅ Completo |
| Esquema `.sdd/` versionado | `schemaVersion`, `validate()`, `migrate()`, campos de observabilidad | ✅ Completo |
| Dashboard vanilla JS | Servidor loopback, 6 vistas, polling 5s, auto-cierre 30min | ✅ Completo |
| Multi-LLM + empaquetado | `model-registry.js`, presets, `forge doctor` extendido | ✅ Completo |

**Tests:** 848 pasando (8 con fallos conocidos en entorno de test — no afectan uso real)

---

## Próximo: v2.8.0

Las siguientes mejoras están planificadas y documentadas en `PLAN-V280-V300.md`:

### Bloque 1 — Seguridad del runtime

**1C: Verificar existencia de archivo antes de Edit**
- Estado: ya implementado en la versión actual
- `pre-tool-guard.js` bloquea `Edit`/`MultiEdit` sobre rutas inexistentes

**1A: `chmod 777` en PROHIBIDOS**
- Estado: ya implementado
- Los patrones `chmod 777` y `chmod -R 777` están en la lista de bloqueo

**1B: Documentación de variables de entorno recomendadas**
- Estado: ya implementado
- `docs/OPTIMIZACION-ENTORNO.md` documenta `DISABLE_AUTOUPDATER`, `CLAUDE_CODE_DISABLE_1M_CONTEXT`

---

### Bloque 2 — Flujos condicionales

**2A: Sección `sesion:` en sdd.config.yaml**
- Estado: ya implementado en v4.0.0

**2B: Flags `rapido`/`prototipo` en comandos clave**
- Estado: implementado en `sdd.planificar`, `sdd.implementar`, `sdd.especificar`

**2C: Comando `/sdd.modo`**
- Estado: implementado

---

### Bloque 3 — `sdd.configurar` mejorado

**3A: Subcomandos `show` y `set`**
- Estado: implementado

**3B: Validación de YAML en `doctor`**
- Estado: implementado

---

## Roadmap: v3.0.0

La versión 3.0.0 se enfocará en la experiencia del usuario y en reducir la barrera de entrada para nuevos proyectos.

### 5A — `forge init --guided` wizard más completo

**Objetivo:** Ampliar el wizard interactivo para cubrir más configuraciones de proyecto comunes.

**Mejoras planificadas:**
- Más opciones de stack (Django, Rails, FastAPI, Spring Boot)
- Detección automática de entorno CI (GitHub Actions, GitLab CI)
- Configuración de calidad según industria (startup vs. fintech vs. gobierno)

**Estado:** En planificación

---

### 5B — `sdd.estado` con dashboard ASCII mejorado

**Objetivo:** Mejorar el dashboard de texto plano para incluir más información útil sin abrir el browser.

```
╔══════════════════════════════════════════════╗
║  FORGE v4.0.0 — Estado del Proyecto          ║
╠══════════════════════════════════════════════╣
║  Fase:      implementar                      ║
║  Feature:   auth-jwt                         ║
║  Progreso:  T007/T012 (58%)  ████████░░░░   ║
║  Modo:      normal                           ║
║  Tests:     52/52 ✅                          ║
║  Último:    desarrollador-backend (3min)     ║
╚══════════════════════════════════════════════╝
```

**Estado:** En planificación

---

### 5C — Community framework

**Objetivo:** Facilitar la contribución de agentes, comandos y skills por la comunidad.

**Entregables:**
- `CONTRIBUTING.md` con guía detallada (ya existe la versión inicial)
- `.github/ISSUE_TEMPLATE/bug_report.md` (ya existe)
- `.github/ISSUE_TEMPLATE/agent_proposal.md` (ya existe)
- Proceso de revisión de contribuciones
- Tests de contrato para extensiones comunitarias

**Estado:** Parcialmente implementado

---

### 5D — `/sdd.crear-agente` mejorado

**Objetivo:** El asistente de creación de agentes actual es funcional. En v3.0 se añadirán:

- Plantillas por tipo de agente (backend, frontend, data, devops, seguridad)
- Validación del agente creado contra el sistema de tipos
- Test de integración automático generado para el nuevo agente
- Preview del comportamiento antes de registrar

**Estado:** El comando básico está implementado; las mejoras están en planificación

---

## Backlog técnico

Estas son mejoras técnicas identificadas que no están en el roadmap inmediato pero que resuelven limitaciones conocidas:

### Migración automática Markdown → SQLite

**Problema:** Al cambiar `memoria.backend: sqlite` en un proyecto existente, el historial en archivos `.md` no se migra.

**Solución planificada:** Comando `forge migrate-memory` que lee todos los archivos `.md` de memoria y los importa al backend SQLite.

**Prioridad:** Media

---

### Corrección de los 8 tests fallidos en agent-memory

**Problema:** 8 tests en `tests/agent-memory.test.js` fallan en ciertos entornos de test relacionados con timing y mock de filesystem.

**Solución planificada:** Refactorizar los tests para usar mocks más estables y añadir timeouts apropiados.

**Prioridad:** Alta

---

### Activación automática de `cache-audit`

**Problema:** La skill `cache-audit` debe invocarse manualmente.

**Solución planificada:** Integrarla en el flujo de `/sdd.optimizar-memoria` y ejecutarla automáticamente al inicio de sesiones largas.

**Prioridad:** Baja

---

### Comando `/sdd.preset cargar`

**Problema:** Los presets solo se pueden aplicar durante `forge init`, no en proyectos existentes.

**Solución planificada:** Comando `/sdd.preset cargar startup` que aplica las claves del preset sobre el `sdd.config.yaml` existente, preservando los valores personalizados.

**Prioridad:** Media

---

### Integración Figma completa

**Problema:** `mcp-figma/` está en estado esquelético — el código fuente del servidor MCP no está implementado.

**Solución planificada:** Implementar el servidor MCP de Figma como un `.mcpb` empaquetado que se puede instalar con un solo comando.

**Prioridad:** Media-Alta (bloquea la integración declarada en `sdd.config.yaml → figma`)

---

## Visión a largo plazo: v5.0.0

Las siguientes ideas están en fase de consideración pero no tienen implementación planificada:

### WebSockets en el dashboard

Reemplazar el polling de 5 segundos por WebSockets para actualizaciones en tiempo real del dashboard. Requeriría cambiar la arquitectura del servidor UI de HTTP puro a un servidor con upgrade a WS.

### Presets personalizados por equipo

Permitir que equipos publiquen sus propios presets de configuración como paquetes npm (`forge-preset-fintech`, `forge-preset-saas-b2b`), instalables con `forge init --preset @mi-empresa/fintech`.

### Soporte para Ollama y modelos locales

Añadir soporte en `model-registry.js` para proveedores locales como Ollama, LM Studio o llamadas a modelos HuggingFace. Útil para equipos con restricciones de privacidad de datos que no pueden enviar código a APIs externas.

### Integración con sistemas de gestión de proyectos

Sincronización bidireccional entre las tareas de `.sdd/` y herramientas como Linear, Jira o GitHub Issues — de forma que las tareas creadas por FORGE aparezcan en el board del equipo y los cambios de estado se reflejen en `.estado-tareas.json`.

### GUI para no-técnicos

Una aplicación Electron o web que envuelva el pipeline de FORGE con una interfaz gráfica completa — sin necesidad de terminal ni Claude Code instalado directamente. Esto está en la categoría "Fase C" del plan original.

---

## Cómo contribuir al roadmap

Si encuentras un bug o quieres proponer una mejora:

1. **Bug:** `.github/ISSUE_TEMPLATE/bug_report.md` — incluye versión, comando, error y salida de `npm test`
2. **Nuevo agente:** `.github/ISSUE_TEMPLATE/agent_proposal.md` — nombre, rol, modelo, herramientas, casos de uso
3. **Mejora de feature:** Abre un issue con título `[RFC] Nombre de la mejora` y describe el problema que resuelve

Ver [CONTRIBUTING.md](../CONTRIBUTING.md) para el proceso completo.
