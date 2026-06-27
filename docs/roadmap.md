# Hoja de ruta

Este documento describe el estado actual de FORGE v4.2.0 y las mejoras planificadas para versiones futuras.

---

## Completado en v4.2.0

Todos los ítems siguientes están implementados y verificados contra el código fuente:

- **998 tests pasando / 0 fallos** — node:test, sin mocks del sistema de archivos
- **Motor LLM agnóstico** — Anthropic, OpenAI (+ Azure/GitHub Models), Ollama, Stub
- **Hooks multi-lenguaje** — `.sh` equivalentes de los 3 hooks principales; funcionan en proyectos sin Node
- **Aprobación humana obligatoria** — guard `spec_aprobado` en state machine; `forge aprobar spec`
- **SSE en tiempo real** — dashboard en localhost:3001 con Server-Sent Events; fallback polling
- **EventLog streaming** — `/events` emite `events.jsonl` en tiempo real; `/eventlog` últimas 50 entradas
- **Memoria compartida entre agentes** — `.sdd/memoria/compartida/decisiones-clave.md`
- **`forge run` y `forge resume`** — expuestos en CLI principal, delegan a `engine-cli.js`
- **`forge doctor` completo** — ping real al LLM, latencia, validación JSON, SQLite
- **Fix await orchestrator** — bug silencioso en `_runTests()` corregido
- **24 tests E2E** — `tests/e2e/pipeline-flow.test.js`, pipeline completo sin LLM
- **Decision store TF-IDF** — búsqueda semántica de ADRs con similitud coseno
- **Circuit breaker por agente** — sandbox / local / confirmado en `core/execution-context.js`
- **Stack detector 18 lenguajes** — auto-detecta Node, Python, Go, Rust, PHP, etc.
- **SQLite auto-detect** — `node:sqlite` nativo si Node ≥22.5, fallback Markdown
- **Migración core/ a JS puro** — eliminado TypeScript, no se necesita `npm run build` ni `dist/`

---

## En desarrollo activo

Estas funcionalidades tienen trabajo iniciado pero no están disponibles en v4.2.0:

### Routing por confidence score
Asignar el modelo por agente según la complejidad estimada de la tarea. Tareas simples → haiku, decisiones arquitectónicas → opus. Hoy el modelo por agente es fijo en la configuración.

### AST delta incremental
El indexer AST hoy reindexea el archivo completo en cada write. El objetivo es calcular solo el delta de símbolos afectados para reducir latencia en proyectos grandes (>50k LOC).

### TF-IDF distribuido para decision store
Hoy el índice TF-IDF se recalcula completo al iniciar. Con cientos de ADRs, la startup se ralentiza. La mejora es carga incremental + cache persistente.

---

## Backlog (sin fecha)

Funcionalidades planificadas pero no iniciadas. El orden no implica prioridad:

- **Marketplace de templates**: publicar templates de proyectos (`api-rest`, `saas-mvp`, `cli-tool`) como paquetes instalables vía `forge template add`
- **Embeddings para memory**: reemplazar TF-IDF por embeddings locales (via Ollama) para recuperación semántica más precisa en proyectos con >1000 entradas de memoria
- **Driver headless v2**: modo completamente no interactivo para pipelines en CI — hoy el modo `stub` funciona para tests, pero el driver headless completo (con replay de sesiones) no está implementado
- **Plugin hot-reload**: hoy añadir un comando o agente requiere reiniciar Claude Code. El objetivo es cargar plugins en caliente sin reiniciar la sesión
- **Workspace multi-proyecto**: coordinar agentes entre repositorios en un monorepo o proyecto distribuido
- **Dashboard persistente**: hoy el dashboard cierra a los 30 min sin actividad (IDLE_TIMEOUT_MS). La opción de hacerlo persistente como proceso daemon está en evaluación

---

## Lo que FORGE deliberadamente no hará

Estas funcionalidades fueron evaluadas y descartadas:

- **Integración con Google/Gemini**: no hay roadmap para añadir este provider. Los cuatro existentes cubren los casos de uso principales.
- **CLI interactivo tipo TUI**: FORGE usa Claude Code como interfaz. No se construirá una TUI propia.
- **ORM o cliente de base de datos**: FORGE genera código que usa ORMs del proyecto, pero no incluye ni gestiona dependencias de bases de datos propias.
- **WebSockets en el dashboard**: SSE es suficiente para el caso de uso (flujo unidireccional servidor → cliente). No se migrará a WebSockets.
