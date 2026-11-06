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

## Revisión con dos agentes independientes (2026-11-05)

Dos agentes revisaron el código y los workflows/documentos, solo lectura. No sustituye una revisión humana.

**Corregido (con prueba nueva que fallaba antes)**
- `core/evidencia/protegidos.js`: Windows ignora el punto y el espacio finales y trata `nombre:flujo` como el mismo archivo; `tsconfig.json.`, `tsconfig.json ` y `tsconfig.json::$DATA` se escapaban del bloqueo.
- `core/mantenimiento.js`: el `taskId` entraba al detalle sin sanear (`forge status` y la CLI lo imprimen); y dos tareas cuyo nombre saneaba igual compartían archivo de borrador, perdiéndose la segunda sin aviso (el nombre lleva ahora una huella).
- `cli/index.js`: `forge mantenimiento` ya no vuelca un stack si el registro es un enlace o demasiado grande (sale con 2 y un mensaje).
- `core/ciclo/metricas.js`: una iteración ausente o infinita, o un gasto NaN o negativo, ya no falsean los totales.
- Workflows: `permissions: contents: read` en CI y en el de modelo real; el `tope` pasa por `env`, no interpolado en `run:`.

**Abierto (decisión tuya o fuera de alcance)**
- El job `evidencia` comprueba la spec activa de `.sdd/estado.json`, que sigue siendo `2026-10-03-ciclo-verificado`, no esta. Los criterios de esta spec no pasan por `--criterios` en CI mientras no sea la activa.
- `--comprobar-evidencia` responde «cadena vacía» y sale con 0: hoy no verifica nada porque no hay informes.
- El guardián solo ve Write/Edit/MultiEdit. Por Bash (`sed -i`, `echo >`) se puede reescribir `tsconfig.json`; tampoco sigue enlaces simbólicos. Cubrirlo cambia el comportamiento del guardián.
- La lista de configuración protegida no incluye `pyproject.toml`, `.eslintrc*`, `eslint.config.*`, `jest/vitest.config.*`, `pytest.ini`, `tox.ini` ni `.github/workflows`. Ampliarla cambia lo que el ciclo deja escribir al implementador.
- El nombre corto 8.3 de Windows (`TSCONF~1.JSON`) no se detecta.
- Sin clave, el workflow de modelo real termina en verde sin haber ejecutado nada.
- `.claude/settings.json` conserva dos permisos con el nombre antiguo `forge-sdd`.
- La tabla de evals no tiene un caso que permita editar un archivo de prueba, ni uno con ruta absoluta.
- `forge mantenimiento` sale con código 1 cuando hay señales (decisión de diseño; un script con `set -e` lo verá como fallo).
