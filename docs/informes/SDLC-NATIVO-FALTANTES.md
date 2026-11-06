# FORGE/Fragua frente a un SDLC nativo de IA: qué hay y qué falta

Fecha: 2026-11-06. Revisión de solo lectura. Referencias: [playbook de Anthropic](https://claude.com/es/resources/articles/the-ai-native-sdlc-playbook), `docs/PLAN-FLUJO-AI-NATIVO.md`, `.sdd/especificaciones/2026-10-27-flujo-nativo-de-ia/`, `docs/informes/COMPARATIVA-DE-MERCADO.md`.

Leyenda: **Real** = código que se ejecuta y tiene pruebas · **Doc** = solo prompt o markdown (comando o agente de Claude Code) · **Falta**.

## Comandos ejecutados (solo lectura)

- `node cli/index.js ayuda` falla: «Comando desconocido: 'ayuda'». La ayuda está en `--help`. Hay `sdd.ayuda.md` (slash command), pero ningún subcomando `ayuda` en el CLI. Es una pequeña incoherencia de idioma.
- `node cli/index.js --help` lista init/update/doctor/status/step/verificar/run/resume/mcp/api/mantenimiento/probar-modelo/export/import. No hay subcomandos para desplegar, revisar ni medir evals.
- `node cli/index.js status`: pipeline `idea→discovery→ir→design→spec→plan→tasks→code→done`; «39 con prueba citada · 0 sin prueba · 0 sin tarea»; «Aislamiento: Docker…».
- `node cli/index.js mantenimiento --json` devuelve `{"senales":[],"borradores":[]}`: no hay señales porque no hay historial real.
- `tests/evals/casos-guardian.json` tiene 34 casos.

## Evaluación por fase

| Fase | Qué hay de verdad | Solo documentación | Qué falta |
|---|---|---|---|
| Descubrir | Máquina de estados con el paso `discovery` (`core/state-machine.js`, `forge step`) | `commands/sdd.descubrir.md`, `sdd.interpretar.md` | No existe un `intent.md` versionado y firmado por el dueño con su propio criterio de salida. La métrica «conversación→intent» no se mide |
| Especificar | `core/spec.js`; criterios CA-xxx en `spec.md`; export/import a Spec Kit/OpenSpec (`cli/export.js`, `cli/import.js`) | `sdd.especificar.md`, `sdd.aclarar.md` | La aprobación de la spec por el dueño no tiene registro verificable (quién, cuándo, huella). Tampoco hay un linter de calidad de criterios (que sean comprobables y no ambiguos) |
| Planificar | `core/tareas.js`; `forge status` cruza criterio→tarea→prueba («0 sin tarea») | `sdd.planificar.md`, `sdd.tareas.md`; ADR con `forge adr` | Nada bloquea que se ejecute `run` sin un plan aprobado (`step --force` lo salta) |
| Implementar | Ciclo verificado `core/ciclo/*`: rojo obligatorio, separación de roles, presupuesto (`core/ciclo/presupuesto.js:28`), pruebas confiables, guardián `claude-hooks/pre-tool-guard.js` con configuración protegida | Agentes `agents/*.md` | El guardián es un hook de Claude Code: en otras herramientas no hay barrera equivalente salvo que pasen por `forge mcp` |
| Probar | `forge verificar` decide por código de salida (`core/verificar/resultado.js:20`), mutación opcional, evals del guardián dentro de `npm test` (`tests/evals/guardian.test.js`) | `sdd.qa.md`, `sdd.verificar.md` | Faltan evals del **agente** (calidad de lo que producen los prompts/agentes ante tareas de referencia). `evals-modelo-real.yml` es manual (`workflow_dispatch`) y nunca se ha ejecutado (F7.2 sin hacer) |
| Revisar | `REVIEW.md` (3 pasadas); job CI `evidencia` con `verificar --criterios` y `--comprobar-evidencia` (`cli/verificar.js:47-59`); revisión humana con exit 3 (`core/engine-cli.js:41`) | Agentes revisores | La revisión por IA no se ejecuta en CI. No se exige aprobación humana en el PR (CODEOWNERS/branch protection). La propia spec no ha tenido revisión independiente (PLAN, Falta 1) |
| Desplegar | Nada ejecutable | `sdd.desplegar.md`, `sdd.release.md`, `sdd.canary.md`, `RELEASE-CHECKLIST.md` | Una puerta de aprobación determinista para producción, separación de credenciales y rollback. La 5.0 no está publicada en npm |
| Operar | Registros JSONL de solo adición (`core/event-log.js`), consumo (`forge logs`), indicadores en `status` (`core/ciclo/metricas.js:34-62`), dashboard `forge ui` | `.sdd/observabilidad/` | No hay telemetría de producción ni SLO, y nada conecta incidentes reales con el ciclo |
| Mantener | `forge mantenimiento`: umbrales en código y borradores de idea (`core/mantenimiento.js:4,14`) | `sdd.retro.md`, `sdd.optimizar.md` | Se ejecuta a mano, sin programar. Los umbrales (3,3,2) no tienen datos que los respalden. Falta escaneo periódico del código (dependencias, seguridad, deriva de docs) |

## Temas transversales

**Dependencia de Claude Code frente a agnosticismo.** El motor LLM es agnóstico (`core/llm-providers`: Anthropic, OpenAI, Ollama, Stub), pero OpenAI y Ollama no se han probado con modelos reales. `--integracion` admite 9 herramientas; las 8 que no son Claude Code reciben solo skills o instrucciones (COMPARATIVA:15,31). Los comandos `/forge`, los agentes con `tools` y los hooks solo existen en Claude Code. Las únicas vías comunes de verdad son el CLI (`run --motor ciclo`, `verificar`) y `forge mcp`/`forge api`. Conclusión: el *motor* es agnóstico; la *experiencia guiada y las barreras* dependen de Claude Code.

**Docker obligatorio u opcional.** Para verificar es obligatorio: sin aislamiento sale con código 4 (`core/engine-cli.js:147`, `core/verificar/resultado.js:27`), y no hay un modo degradado declarado. El CI corre con `FORGE_TEST_DOCKER=0` (`.github/workflows/ci.yml`), así que la ruta Docker real solo se ha validado en Windows 11. Falta un modo explícito «sin aislamiento, con riesgo aceptado y firmado» (o Podman/gVisor) y probar Docker en Linux y macOS.

**Evals.** Existen para la barrera (34 casos del guardián, deterministas). No existen para el comportamiento del agente: no hay un conjunto de tareas de referencia con su tasa de éxito, regresión por versión de prompt ni ejecución en CI cuando cambian `agents/`, `commands/` o `skills/` (el playbook lo pide de forma explícita).

**Métricas.** Hay tasa de primer intento, reintentos y tiempo medio (`metricas.js`). Faltan las del playbook: tiempo hasta intent, reelaboración tras empezar a construir, primer pase de CI, tiempo hasta la primera revisión y vulnerabilidades antes de fusionar. Las métricas tampoco se agregan entre ejecuciones ni proyectos.

**Trazabilidad criterio→prueba→evidencia.** Es lo más sólido: `status` cruza criterio, tarea y prueba; `verificar --criterios [--exigir-cobertura-de-criterios]`; `verificacion.md` por criterio; cadena de evidencia con imagen y digest (`core/evidencia/cadena.js`). Falta enlazar la evidencia con el commit o PR y conservarla como artefacto firmado en CI. Hoy depende de lo que haya en el disco local.

**Gobernanza.** Hay puntos de control humanos (exit 3, `resume --decision`), presupuesto, archivos protegidos y la constitución (`.sdd/memoria/constitucion.md`). Falta registrar las aprobaciones (spec, plan, despliegue) con identidad, una política de permisos por rol, un registro de excepciones (`--force`) que alguien revise, y la decisión pendiente sobre los archivos de prueba (PLAN, Falta 5).

## Prioridades

| Prio | Qué | Esfuerzo |
|---|---|---|
| P0 | Ejecutar en GitHub Actions el job `evidencia`, `evals-modelo-real.yml` y Docker real en Linux (F7.2); arreglar el fallo conocido de la suite | 2-3 d |
| P0 | Revisión independiente del cambio de flujo nativo (PLAN, Falta 1) | 1 d |
| P0 | Aprobaciones verificables: registro firmado o con huella de spec, plan y despliegue; impedir `run` sin plan aprobado salvo `--force` registrado | 3-4 d |
| P0 | Puerta de despliegue determinista (comando o CI con aprobación humana y entorno protegido), aunque sea mínima | 3-5 d |
| P1 | Evals del agente: 10-20 tareas de referencia con tasa de éxito y coste, ejecutadas en CI cuando cambien agents/commands/skills | 1-2 sem |
| P1 | Agnosticismo real: barreras equivalentes al guardián vía `forge mcp` (perfil completo) y una guía de uso del flujo entero sin Claude Code; probar OpenAI y Ollama de verdad | 1-2 sem |
| P1 | Modo sin Docker explícito (riesgo aceptado y anotado en la evidencia) o alternativa Podman; Docker validado en Linux y macOS | 4-6 d |
| P1 | Evidencia ligada al commit/PR y subida como artefacto de CI | 2-3 d |
| P1 | Revisión por IA en el PR (primer filtro) + CODEOWNERS/branch protection | 2 d |
| P2 | Métricas del playbook y su agregación histórica en `forge ui` | 1 sem |
| P2 | `forge mantenimiento` programado (cron/CI), umbrales calibrados con datos, escaneo de dependencias y seguridad | 3-5 d |
| P2 | `intent.md` versionado como artefacto de primera clase; linter de criterios | 3-4 d |
| P2 | Subcomando `ayuda` (alias de `--help`) y poda de `.claude/worktrees/` | 0,5 d |

## Veredicto

FORGE cubre de verdad la parte central (especificar → implementar → probar), con verificación determinista y trazabilidad por encima de la media del mercado. Las fases de los extremos (descubrir con un intent firmado, desplegar, operar y mantener de forma automática) son sobre todo documentación. Le faltan tres cosas para ser un SDLC nativo de IA completo y agnóstico: ejecución real en CI, evals del agente y gobernanza registrada.
