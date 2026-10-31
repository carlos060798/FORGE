# Verificación: flujo-nativo-de-ia

> **Fecha:** 2026-10-27 · Autoevaluación escrita a mano tras ejecutar `npm test` y `npm run typecheck`; no es la matriz generada por `forge verificar --criterios`.

| Criterio | Estado | Dónde |
|---|---|---|
| CA-001-01 | Hecho, **sin prueba automática** | `CLAUDE.md` |
| CA-001-02 | Hecho, **sin prueba automática** | `.gitignore`, `.claude/settings.json` |
| CA-002-01 | Con prueba | `tests/pre-tool-guard.test.js`, `tests/evals/guardian.test.js` |
| CA-002-02 | Con prueba (ruta ausente); que los archivos de prueba no se bloqueen es una decisión, no una comprobación | `tests/pre-tool-guard.test.js` |
| CA-002-03 | Con prueba: instala en un proyecto temporal con `init` y comprueba que el hook instalado bloquea `tsconfig.json` | `tests/hook-instalado.test.js` |
| CA-003-01 | Hecho, **sin prueba automática** | `REVIEW.md` |
| CA-003-02 | Con prueba de la forma del workflow; **no ejecutado en GitHub Actions** | `tests/consistencia-cifras.test.js` |
| CA-004-01 | Con prueba | `tests/evals/guardian.test.js` |
| CA-004-02 | Hecho, **no ejecutado** (necesita clave y GitHub Actions) | `.github/workflows/evals-modelo-real.yml` |
| CA-005-01 a 04 | Con prueba (CA-005-04: la función; el cableado en `cli/runner.js` lo probé a mano con `forge status`, sin prueba automática) | `tests/mantenimiento.test.js` |
| CA-006-01 y 02 | Con prueba | `tests/ciclo-metricas.test.js` |
| CA-006-03 | Con prueba: un ciclo completo con ejecutor falso muestra los indicadores en `lineasEstadoCiclo` | `tests/ciclo-mutacion.test.js` |

## Límites

- No hay revisión independiente.
- «Primer intento» = `iteracion ≤ 1`. Comprobado: `iteracion` sube tras cada ejecución de pruebas, así que un éxito a la primera guarda 1 (`core/ciclo/nodos.js`, y `T1: iteración 1/5 · exito` en `tests/ciclo-mutacion.test.js`).
- El hook se probó con `init` en local, no en un proyecto real de usuario con Claude Code.
- El disparador de mantenimiento se ejecuta a mano (`forge mantenimiento`); nada lo invoca solo todavía.
- Los umbrales (3 fallos, 3 verificaciones, 2 regresiones) son valores por defecto sin respaldo en datos.
