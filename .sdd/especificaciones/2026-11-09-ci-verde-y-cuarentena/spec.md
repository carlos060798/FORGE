---
id: 2026-11-09-ci-verde-y-cuarentena
titulo: "CI verde en Linux y Windows: cuarentena honesta de pruebas inestables y pata de Windows en la matriz"
tamano: pequeño  # micro | pequeño | mediano | grande
estado: borrador  # borrador | en_revision | aprobada | en_implementacion | completada
creada: 2026-11-09
actualizada: 2026-11-09
autor: humano  # humano | importado
constitucion_version: 1.1.0
etiquetas: [ci, pruebas, calidad, mvp]
---

# Especificación: CI verde en Linux y Windows

> **Estado (2026-11-09): borrador.** La redactó un agente dentro del plan «Marco Mínimo Viable para el desarrollador individual» (Fase 1); **la aprueba el dueño** con `fragua aprobar spec`. El código y las pruebas se escriben en el mismo cambio para que el dueño los revise junto con esta spec; eso no sustituye su aprobación.

## 1. Contexto y Motivación

La integración continua de GitHub en `main` **nunca ha estado verde**: en el último run (commit `8cc2e58`, 2026-11-06) fallan `Tests (Node 22)`, `Aislamiento con Docker real` y `Pruebas con Docker real`; `Tests (Node 20)` se cancela. La única pasada completa verde es en el equipo del dueño (Windows 11). `docs/ESTADO-ACTUAL.md` documenta pruebas que fallan solo bajo carga o por la velocidad del disco y que pasan aisladas, y hoy la única forma de que no bloqueen es subir su tiempo límite a ciegas o borrarlas. Además, las pruebas que distinguen rutas de Windows (`\`, mayúsculas, `::$DATA`) solo corren cuando alguien lanza la suite en su PC: la CI es solo Ubuntu, mientras que los usuarios del MVP están en Windows.

Sin una CI verde, nada de lo que el proyecto afirma sobre su suite es verificable por otra persona, y `prepublishOnly` (que ejecuta `npm test`) bloquea la publicación.

## 2. Objetivo

Que exista una forma honesta y acotada de apartar una prueba inestable sin ocultarla, que `npm test` siga siendo una sola orden que ejecuta todo lo que no está en cuarentena, y que la suite corra también en Windows en la CI. Lo que esta spec **no** hace es arreglar las pruebas que fallan en Linux: eso exige leer los logs (tarea del dueño) y, si es código de producción, su propia spec.

## 3. Criterios de aceptación

### Cuarentena
- **CA-001-01** Existe `tests/cuarentena.txt`. Cada línea no vacía ni comentario (`#`) tiene cuatro campos separados por `|`: ruta del archivo de prueba relativa a la raíz, referencia a una incidencia (`#` seguido de dígitos), fecha ISO `AAAA-MM-DD` y motivo. Una línea que no cumpla el formato hace fallar la prueba del clasificador.
- **CA-001-02** `scripts/pruebas.mjs` excluye las rutas en cuarentena de los modos `todo`, `rapido` y `lento`, y ofrece el modo `cuarentena`, que ejecuta solo esas. Una entrada que nombre un archivo inexistente es un error (como ya ocurre con `tests/lentos.txt`).
- **CA-001-03** `npm test` ejecuta `scripts/pruebas.mjs todo`, así que la cuarentena se respeta en la CI y en `prepublishOnly`. `rapido` + `lento` + `cuarentena` = todos los archivos, sin solaparse.
- **CA-001-04** Una entrada en cuarentena **caduca**: si su fecha tiene más de 30 días, la prueba del clasificador falla y hay que renovarla (con fecha nueva) o sacarla. Un archivo de cuarentena vacío es válido.
- **CA-001-05** La cuarentena no puede vaciar la suite: como mucho 5 entradas a la vez; más, falla la prueba del clasificador.
- **CA-001-06** La CI tiene un job `cuarentena` (ubuntu, Node 22) que ejecuta `npm run test:cuarentena` con `continue-on-error: true`, no es comprobación requerida, y publica su salida como artefacto para que el fallo se vea.

### Windows en la CI
- **CA-002-01** La CI tiene un job `test-windows` (`windows-latest`, Node 22) que ejecuta `npm test` completo sin Docker real (`FORGE_TEST_DOCKER=0`), con `timeout-minutes` de al menos 40 (los runners de Windows son más lentos).
- **CA-002-02** Las pruebas que se saltan por no poder crear enlaces (`t.skip` por EPERM; en la pasada del 2026-11-10 en Windows, 3 de las 46 omitidas) siguen saltándose; esta spec no las cambia, solo lo anota.

### Documentación
- **CA-003-01** `AGENTS.md` explica la cuarentena en «Cómo ejecutar las pruebas»: cómo entra una prueba (incidencia abierta + fecha), cómo sale (tres pasadas verdes seguidas en el job `cuarentena`) y que caduca a los 30 días.
- **CA-003-02** `tests/consistencia-cifras.test.js` conoce los jobs nuevos y comprueba que los archivos con Docker real siguen dentro de lo que ejecuta `npm test` a través del clasificador, no del texto del script.

## 4. Fuera de alcance

- Diagnosticar o corregir las pruebas que fallan en la CI de Linux (depende de los logs, que exigen autenticación; Fase 1.A y 1.E del plan).
- Reintentos automáticos de pruebas que fallan (ocultan el problema; ver ADR-23).
- Cambiar las pruebas que se saltan en Windows por enlaces simbólicos (Fase 4 del plan).
- Hacer requerido el job `cuarentena` o los jobs de Docker (decisión del dueño al proteger `main`, Fase 1.F).

## 5. Cambios de comportamiento visibles

`npm test` pasa de un glob fijo a `node scripts/pruebas.mjs todo`: ejecuta los mismos archivos salvo los que estén en `tests/cuarentena.txt` (hoy ninguno) y añade una línea de resumen al principio. `npm run test:cuarentena` es nuevo. La CI tiene dos jobs nuevos, `cuarentena` (no bloqueante) y `test-windows`.

## 6. Decisiones abiertas (del dueño)

1. Aprobar esta spec con `fragua aprobar spec`.
2. Al proteger `main` (Fase 1.F): qué jobs son requeridos. Propuesta: `test` (Node 20 y 22), `test-windows`, `tipos`, `evidencia`; los de Docker solo si llegan a verde.
