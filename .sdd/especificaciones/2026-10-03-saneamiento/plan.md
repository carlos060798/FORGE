---
spec_id: 2026-10-03-saneamiento
estado: aprobado_por_delegacion
actualizado: 2026-10-04
---

# Plan: Saneamiento del motor y del instalador

Plan abreviado (spec pequeña, correcciones sobre archivos existentes). Sin decisiones de arquitectura nuevas: no hay ADR propio.

## Cambios por historia

| Historia | Archivos | Cambio |
|---|---|---|
| HU-001 Instalación | `cli/runner.js`, `cli/index.js`, `package.json` | `forge status` carga el núcleo desde `core/`; `copiarNucleo` copia `claude-hooks/shared/config.js` y los `.sh`; `files[]` sin `dist/` |
| HU-002 Motor y metodología | `core/tareas.js` (nuevo), `core/engine-cli.js`, `core/state-machine.js`, `core/orchestrator.js`, `core/execution-context.js` | Lectura de las tareas de la spec activa (`.estado-tareas.json` en formato objeto) con las dos claves de spec activa; `--cwd` respetado; la etapa se resuelve con `pipeline_step` y, si falta, se traduce `fase_actual` |
| HU-003 Suite fiable | `core/runners/runner.js`, `utils/adr-parser.js`, `claude-hooks/agent-memory.js`, `utils/episodic-memory.js`, 4 tests | `safeFiles` confina por ruta y no por prefijo; el escáner de ADR no depende de `glob`; variable de ruta del registro de modelos; tests con `os.tmpdir()` |
| HU-004 ADR | — | **No se hace** (CA-004-01): decisión del dueño |

## Verificación

`npm test` (con `FORGE_TEST_DOCKER=1` incluye Docker), `tests/saneamiento.test.js`, `tests/release-safety.test.js`.
