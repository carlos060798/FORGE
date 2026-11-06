# Verificación: aprobaciones-con-identidad

> **Fecha:** 2026-11-06 · Autoevaluación de un agente tras ejecutar `node --test` sobre los archivos listados y `npm run typecheck`; no se ejecutó la suite completa. La spec sigue en **borrador**: nada de esto está aprobado por el dueño.

| Criterio | Estado | Dónde |
|---|---|---|
| CA-001-01 | Con prueba (CLI real por spawn, sin TTY: código != 0, nada escrito) | `tests/aprobaciones-identidad.test.js`, `tests/state-machine-aprobacion.test.js`, `tests/proyecto-hostil.test.js` |
| CA-001-02 | Con prueba (`--sin-tty`, `--yes`, `--force` rechazados) | `tests/aprobaciones-identidad.test.js` |
| CA-001-03 | Con prueba con lectura inyectada (código correcto, incorrecto, vacío, sin respuesta) | `tests/aprobaciones-identidad.test.js` |
| CA-002-01 | Con prueba (campos del registro); `git config` real no se prueba, se inyecta la identidad | `tests/aprobaciones-identidad.test.js` |
| CA-002-02 | Con prueba (edición, línea quitada, línea fabricada, sin clave) | `tests/aprobaciones-identidad.test.js` |
| CA-002-03 | Hecho, **sin prueba directa** del hash de la spec en `forge aprobar spec` (hace falta TTY); `hashDeArchivo` y el hash vigente se prueban en la delegación | `cli/index.js` |
| CA-003-01 | Con prueba | `tests/aprobaciones-identidad.test.js` |
| CA-003-02 | Con prueba (CLI por spawn: códigos 0 y 1) | `tests/aprobaciones-identidad.test.js` |
| CA-004-01 | Con prueba (CLI y unidad) | `tests/aprobaciones-identidad.test.js` |
| CA-004-02 | Con prueba (evento presente, firma válida, alterado inválido) | `tests/aprobaciones-identidad.test.js` |
| CA-005-01 | Hecho, **sin prueba automática** (comentarios de cabecera) | `core/aprobaciones-identidad.js`, `core/evidencia/cadena.js` |

## Límites

- **Sin separación criptográfica total** con el mismo usuario del SO (sección 3 de la spec): un proceso con ese usuario puede leer la clave, o abrir un pty y teclear el código. Es una mitigación, no una garantía.
- Ninguna prueba automática abre un TTY real: el camino con terminal se prueba inyectando `leerLinea`/`escribir`/`isTTY`. Falta la prueba manual en un terminal real (tarea T9).
- Los dos `plan.md` del repositorio con `estado: aprobado_por_delegacion` (`2026-10-03-api-http`, `2026-10-03-saneamiento`) **no tienen registro**: `forge verificar --comprobar-aprobaciones` sale con 1 en este repositorio hasta que el dueño decida (T8). Por eso la comprobación NO se enganchó a `--comprobar-evidencia`, que corre en la CI.
- El truncado de las últimas líneas de `.sdd/aprobaciones.jsonl` no se detecta.
- `core/engine-cli.js --force` y `forge reset --force` siguen sin motivo ni evento firmado (T11).
- Pruebas existentes cambiadas: las que esperaban que `forge aprobar spec` escribiera sin terminal ahora esperan el rechazo.
