# Changelog

Todos los cambios notables de FORGE se documentan aquí.
Formato: [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).

---

## [4.3.0] — Sin publicar

Dos trabajos, cada uno con su spec en `.sdd/especificaciones/`: el saneamiento previo (`2026-10-03-saneamiento`) y el Ciclo Verificado (`2026-10-03-ciclo-verificado`). Ver `PLAN-MOTOR-AGENTICO.md`.

### Memoria semántica — `motor.recuperador: semantico` (spec `2026-10-04-memoria-semantica`)

El ciclo puede añadir al contexto los trozos del repositorio más parecidos a la tarea. Índice de vectores propio en un archivo (`.sdd/indice/`), **sin dependencias nuevas** (ADR-14; LanceDB queda como alternativa futura). Guía: `docs/memoria-semantica.md`.

- Dos embedders: `hash` (local, sin red, **léxico, no semántico**) y `ollama` (servidor local; probado solo con un servidor simulado)
- Incremental, respeta el tope de bytes y las rutas vetadas; si la búsqueda falla, el ciclo sigue y lo anota
- Autoevaluada, sin revisión independiente

### Ciclo verificado — opt-in

`forge run --motor ciclo` corrige cada tarea de código hasta que sus pruebas pasan, en un contenedor Docker sin red, con tope de gasto y revisión humana. **Desactivado por defecto.** Guía y límites: `docs/ciclo-verificado.md`.

Probado con respuestas guionizadas y con Docker real en Windows, en proyectos JavaScript y Python; la suite también pasa en Node 18 y 20 dentro de contenedores. **No probado con un proveedor de modelos de pago.**

- `forge run --motor clasico|ciclo [--force]` y `forge resume --decision continuar|aceptar|abortar [--iteraciones-extra N] [--presupuesto-extra USD] [--tarea ID]`
- Códigos de salida: 0 completado, 1 fallo o no se puede empezar, 3 revisión humana pendiente, 4 Docker no disponible
- `forge status` muestra la sesión, el gasto y la situación de cada tarea
- Dos motores para el mismo grafo: el propio (sin dependencias) y LangGraph.js (`optionalDependencies`, carga perezosa, solo con Node ≥20). `motor.grafo: auto | langgraph | propio`. Comparten puntos de guardado
- Aislamiento con la CLI de Docker, sin dependencias nuevas: sin red, sin privilegios, límites de recursos, copia desechable sin secretos, imagen con las dependencias preparada por huella de manifiesto
- Gasto por sesión sumado llamada a llamada; degradación de modelo (`escalon` o `local` a Ollama) y parada dura
- Reanudación sin repetir llamadas pagadas cuando el corte cae dentro de un paso (queda una ventana de milisegundos en el nodo `coder`, entre escribir y guardar, documentada); un solo ciclo por proyecto
- Una persona decide cuando se alcanza un tope, falla el entorno, se propone cambiar dependencias o configuración ejecutable, o un agente no devuelve el formato pedido
- `core/orchestrator.js`: en modo ciclo las tareas de código van en secuencia y una tarea en revisión detiene la ejecución; una abortada queda como omitida
- Job `aislamiento` en CI (sin ejecutar todavía: nada está commiteado)

### Servidor MCP — `forge mcp` (spec `2026-10-03-herramientas-mcp`)

Servidor del protocolo MCP por entrada y salida estándar, **sin dependencias nuevas** (el SDK oficial trae 17 directas; ADR-12), para que otro agente use el aislamiento y las reglas de escritura del ciclo verificado. Guía y límites: `docs/servidor-mcp.md`.

- Tres herramientas: `ejecutar_pruebas` (en el entorno aislado, sin argumentos: no acepta comandos), `leer_archivo` y `escribir_archivo` (con las mismas reglas de rutas que el ciclo, una sola implementación; dependencias y configuración ejecutable exigen revisión humana)
- Versiones del protocolo 2024-11-05, 2025-03-26 y 2025-06-18
- Comprobado con el cliente oficial del SDK y con Docker real en Windows. **No probado con Claude Code ni con otros clientes**
- Comparte el candado de proyecto con el ciclo: no pueden ejecutar a la vez

### API HTTP local — `forge api` (spec `2026-10-03-api-http`)

API para que un programa del mismo equipo lance el ciclo verificado, consulte el estado y decida las revisiones. **Servidor aparte del panel** (ADR-13): el panel responde a cualquier origen y no sirve para operaciones que escriben. Sin dependencias nuevas. Guía y límites: `docs/api-http.md`.

- Solo `127.0.0.1`; secreto aleatorio en cada petición; rechaza `Origin` y `Host` ajeno; sin CORS
- Siempre ejecuta el ciclo verificado (el modo no se elige); una ejecución a la vez; cuerpos de hasta 64 KB con validación estricta
- Rutas: `GET /v1/estado`, `POST /v1/ejecuciones`, `GET /v1/ejecuciones/<id>`, `POST /v1/decisiones`
- Autoevaluada, probada con Docker real en Windows. **Sin revisión independiente ni de seguridad**

### Seguridad

Las dos revisiones independientes de seguridad y verificación (2026-10-03) **rechazaron** la primera versión del ciclo. Se corrigieron antes de publicar, así que ninguno de estos fallos estuvo nunca en una versión. Detalle y riesgos residuales: `.sdd/especificaciones/2026-10-03-ciclo-verificado/revision-seguridad.md`.

- Un agente podía escribir `sub/.git/config` con un comando y `git status` lo ejecutaba en el equipo: el veto de `.git` solo cubría la raíz. Ahora se veta por segmento a cualquier profundidad (también `.claude`, `.ssh`, `node_modules`, `secrets`…)
- Variantes de mayúsculas (`.GIT/config`) y nombres que Windows resuelve a otro archivo (`.git./config`, `a.js::$DATA`, `GIT~1`) saltaban los vetos
- Enlaces simbólicos, también rotos, permitían escribir fuera del proyecto o dentro de `.git`
- Archivos que otras herramientas ejecutan solas (hooks, CI, `conftest.py`, `jest.config.js`…) y más manifiestos de dependencias exigen ahora revisión humana
- Secretos (`.npmrc`, claves SSH, `*.tfstate`…) llegaban al proveedor de modelos y a la copia de trabajo; hay una sola lista de rutas vetadas para escribir, leer y copiar
- El modo clásico ejecutaba en el equipo, sin aislamiento, el código que había dejado una sesión del ciclo; ahora se niega
- Un `sesion.json` o un punto de guardado ajeno podía hacer borrar carpetas fuera de `.sdd/motor`
- **Sigue abierto**: un `process.exit(0)` en el código del implementador falsea un éxito, y no hay cuota de disco para la copia de trabajo

### Corregido tras la tercera ronda de revisiones independientes

- `redactar` ya no se cuelga con una línea de 1 MiB en la salida de las pruebas (ReDoS)
- Una sesión nueva ya no desactiva la guarda que impide ejecutar en tu equipo, en modo clásico, código que dejó un modelo
- Más credenciales vetadas por nombre (`.pgpass`, `.vault-token`, `kubeconfig`, `auth.json`, `*token*.json`…); un enlace de directorio ya no sirve para leer lo vetado
- El respaldo valida su manifiesto; la copia de trabajo tiene nombre único; LangGraph ya no puede enviar el estado a LangSmith
- Una respuesta de modelo ya pagada no se paga de nuevo si cruzó el umbral de degradación o agotó el tope
- El candado entre procesos resiste a tres procesos sobre un huérfano; abortar una tarea sale con código 0
- `forge probar-modelo`: prueba mínima del ciclo con un modelo real y un tope de gasto bajo (0,50 USD por defecto); resume formato, iteraciones y coste. Sin clave se niega. Probado con el proveedor de pruebas; **no se ha ejecutado con un modelo real**
- Verificación independiente de la API y del MCP (aprobadas con observaciones): la API rechaza `Host` repetido y URL absoluta, mata ejecuciones colgadas (2 h), exige entero en `iteracionesExtra`, secreto de 16+ caracteres, no pasa el secreto al hijo y acota las ejecuciones guardadas
- Huecos menores: más nombres de credenciales y carpetas vetadas (`*.env`, `wp-config*.php`, `*.sqlite`, `.gnupg/`, `.m2/`…), el MCP ya no acumula en memoria una línea enorme, y la API limita a 64 las conexiones simultáneas
- Éxito sospechoso: un código de salida 0 ya no basta. Sin una prueba pasada en la salida del ejecutor, o con `process.exit`/`sys.exit` al cargarse en lo que escribió el implementador, la tarea se pausa (`exito_sospechoso`) para que decidas. Mitigación, no cierre: ver `docs/ciclo-verificado.md`
- Cuarta revisión independiente (API, MCP y correcciones): la lista `no_tocar_archivos` ya no se ignora en silencio con listas en línea, BOM o comentarios (y falla si no se entiende); la API rechaza ids de tarea con guion inicial (inyección de flags) y rutas absolutas; el respaldo y el barrido de copias no siguen enlaces ni tocan rutas vetadas; menos coste en `glob` y `redactar`
- `protecciones.no_tocar_archivos` de `sdd.config.yaml` ahora se aplica en el ciclo, y `core/glob.js` no lanza con patrones mal formados
- Se avisa de las copias de trabajo que no se pueden borrar y se barren al arrancar; más patrones de secretos redactados (`PASS=`, `pwd=`, valores entre comillas)

### Corregido

Saneamiento previo (`2026-10-03-saneamiento`):

- `forge status | step | validate | reset` fallaban con "dist/core/ no encontrado": `cli/runner.js` carga ahora el núcleo desde `core/`
- `forge init` no copiaba `claude-hooks/shared/config.js` ni los wrappers `.sh`; los hooks instalados fallaban al importar
- `agent-memory.js` nunca cargaba `model-registry.js` (variable mal escrita y ruta sin `file://` en Windows)
- `safeFiles` aceptaba rutas de carpetas vecinas con el mismo prefijo (`/proy-malo` frente a `/proy`)
- El orquestador y el circuit breaker usaban `process.cwd()` en lugar del `--cwd` indicado
- `utils/adr-parser.js` no arrancaba: usaba `require` en un paquete ESM, dependía de `glob` sin declararlo y un comentario cerraba el bloque antes de tiempo
- `utils/episodic-memory.js` calculaba el directorio de salida partiendo por `/`, lo que fallaba en Windows
- `package.json` listaba `dist/` en `files[]` aunque no existe
- `forge run` y `forge resume` leen las tareas de la spec activa en el formato que genera `/sdd.tareas` (`core/tareas.js`)

### Cambios de comportamiento en el modo clásico

Activar o no el ciclo no cambia nada, pero el saneamiento sí cambió el modo clásico respecto a 4.2.0 (lista completa en `docs/ciclo-verificado.md`): lee también las tareas de la spec activa; un flag sin valor ya no se come al siguiente; los errores salen con mensaje y código 1, no con traza; un `motor.modo` inválido en `sdd.config.yaml` hace fallar también el modo clásico; los agentes leen la configuración del proyecto indicado con `--cwd`; la etapa se entiende también si la escribieron los comandos `/sdd.*`; y `forge run` clásico se niega a ejecutar sobre una sesión del ciclo sin terminar.

### Añadido

- `.sdd/` del propio repositorio: constitución, specs, plan, tareas, análisis, verificación, revisión de seguridad y ADR-01 a ADR-11

### Tests

- 1378 de 1381 (3 saltados) pasando / 0 fallos en Windows con `FORGE_TEST_DOCKER=1` (antes de empezar: 975 de 1014). Las cifras de Node 18/20/22 de abajo son anteriores a las últimas correcciones
- Node 18: 1266 de 1274 pasan, 8 saltados (los que necesitan Docker); Node 20 y 22 también, con LangGraph instalado
- 38 tests escribían en `/tmp` fijo; ahora usan el directorio temporal del sistema

---

## [4.2.0] — 2026-06-27

### Añadido
- Motor LLM agnóstico (`core/llm-providers/`): Anthropic, OpenAI (+ Azure/GitHub Models/Cursor), Ollama, Stub — auto-detectado por variable de entorno o configuración
- Hooks multi-lenguaje: `pre-tool-guard.sh`, `agent-memory.sh`, `post-write-conventions.sh` — permiten usar FORGE en proyectos Python, Go, Rust, PHP sin `"type":"module"`
- Guard `spec → plan` requiere aprobación humana explícita (`spec_aprobado: true`)
- Comando `forge aprobar spec` — escribe `spec_aprobado: true` en estado; idempotente
- SSE en tiempo real en dashboard (`/events`): emite estado, consumo y eventlog; fallback polling si EventSource no disponible
- Endpoint `GET /eventlog` — últimas 50 entradas de `events.jsonl`
- Memoria compartida entre agentes: `.sdd/memoria/compartida/decisiones-clave.md`
- `forge doctor` con diagnóstico real del LLM: ping, latencia, validación JSON, modelo, SQLite
- `forge run` y `forge resume` expuestos en CLI principal (delegaban a `engine-cli.js` sin exportar)
- Fix bug silencioso: `await` faltante en `_runTests()` del orchestrator

### Tests
- 998 pasando / 0 fallos
- 16 tests nuevos: orchestrator-runner (3), state-machine-aprobacion (9), cli-run (4)
- 24 tests E2E: `tests/e2e/pipeline-flow.test.js` — pipeline completo sin LLM

---

## [4.0.0] — 2026-06-22

### Añadido
- Motor ejecutable completo en `core/` — JS puro con JSDoc, sin compilación TypeScript
- State machine formal (`core/state-machine.js`) con 8 transiciones y guards
- Orchestrator con topological sort de tareas y retry automático (`core/orchestrator.js`)
- Circuit breaker por agente: sandbox / local / confirmado (`core/execution-context.js`)
- Event log append-only (`core/event-log.js`) — registro de todos los eventos del pipeline
- Session budget con precios reales por modelo (`core/session-budget.js`)
- Quality gate automático: tests → lint → criterios de aceptación (`core/quality-gate.js`)
- Stack detector para 18 lenguajes y frameworks (`core/stack-detector.js`)
- Runners para Node.js, Python, Go, Rust (`core/runners/`)
- Decision store SQLite + TF-IDF con búsqueda semántica (`core/decisions/`)
- IR-to-spec mapper: convierte IR + ProductDesign → spec (`core/ir-to-spec-mapper.js`)
- Adaptadores: ClaudeCodeAdapter, SpecKitAdapter (`core/adapters/`)
- Dashboard UI con servidor Node (`ui/server.js`) en localhost:3001
- Agente `architecture-designer` (14 agentes totales)
- Tests E2E del AST indexer: 18 tests, `limpiarTypeScript()` exportada

### Migración
- `core/` migrado de TypeScript a JS puro con JSDoc — no se necesita `npm run build` ni `dist/`

---

## [3.x] — 2026-06 (histórico resumido)

- Pipeline SDD completo: 39 comandos (`commands/`), 30+ skills (`skills/`)
- 13 agentes especializados con enforcement a nivel hook
- `pre-tool-guard.js`: 9 categorías de bloqueo, detección de secrets, ADR violations
- `agent-memory.js`: memoria persistente con SQLite (Node ≥22.5) o Markdown
- Context manager con presupuesto USD (`FORGE_BUDGET_WARN_USD`, `FORGE_BUDGET_BLOCK_USD`)
- Export/import de artefactos portables (formatos: speckit, openspec)
- `forge decisions` con búsqueda semántica TF-IDF
- Dashboard de observabilidad (`consumo.jsonl`, `mutaciones.jsonl`, `agent-tool-audit.jsonl`)
- Presets: lean, startup, enterprise
- Templates: api-rest, cli-tool, saas-mvp
- Integración MCP: Vercel, GitHub (beta)
- Modo guiado y modo experto
