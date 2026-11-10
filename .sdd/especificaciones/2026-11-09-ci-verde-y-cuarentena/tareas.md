# Tareas: CI verde en Linux y Windows

> `[x]` hecha · `[ ]` por hacer. Estado de la spec: borrador (la aprueba el dueño). Plan de referencia: Fase 1 del plan «Marco Mínimo Viable para el desarrollador individual» (2026-11-09).

- [x] **T1** Pruebas primero: `tests/pruebas-clasificacion.test.js` (formato de `cuarentena.txt`, exclusión, modo `cuarentena`, caducidad a 30 días, tope de 5, partición exacta) y `tests/consistencia-cifras.test.js` (jobs `cuarentena` y `test-windows`; archivos con Docker dentro de `clasificar().todos`). Cubre CA-001-01 a CA-001-05, CA-002-01, CA-003-02.
- [x] **T2** `scripts/pruebas.mjs`: `clasificar()` devuelve `cuarentena`, `sobrantesCuarentena` y `erroresCuarentena`; modo `cuarentena`; `todo`/`rapido`/`lento` excluyen la cuarentena. `tests/cuarentena.txt` creado vacío con el formato en comentarios. Cubre CA-001-01, CA-001-02, CA-001-04, CA-001-05.
- [x] **T3** `package.json`: `test`, `test:verbose` y `coverage` pasan por el clasificador; `test:cuarentena` nuevo. Cubre CA-001-03.
- [x] **T4** `.github/workflows/ci.yml`: jobs `cuarentena` (`continue-on-error`, artefacto) y `test-windows` (`windows-latest`, Node 22, `timeout-minutes: 45`). Cubre CA-001-06, CA-002-01.
- [x] **T5** `AGENTS.md`: regla de cuarentena. `docs/ESTADO-ACTUAL.md`: estado real de la CI (último run rojo, qué jobs) y la cuarentena. `RELEASE-CHECKLIST.md`: B1 nombra `test-windows`. Cubre CA-003-01, CA-002-02.
- [x] **T6** ADR-23 «Cuarentena de pruebas inestables» (propuesta).
- [ ] **T7** El dueño aprueba la spec (`fragua aprobar spec`) y el ADR-23.
- [ ] **T8** **Dueño:** `gh auth login` y leer los logs del último run rojo de `main`; clasificar cada fallo (carga, rutas/enlaces, Docker, otro) en `docs/ESTADO-ACTUAL.md`. Lo que sea código de producción va a su propia spec; lo que sea inestable entra en `cuarentena.txt` con incidencia.
- [x] **T8b** (2026-11-10, sin el dueño) Docker real en Windows: 17 archivos con `FORGE_TEST_DOCKER=1`, 597 pruebas, 0 fallos tras corregir `tests/fixtures/ciclo-guionizado.mjs` (etiquetas `forge.*` → `fragua.*`); `sandbox-real` 11/11; `corte-real` 25/25; sin contenedores residuales. Evidencia en `docs/ESTADO-ACTUAL.md`. Es una hipótesis fuerte para el rojo de `pruebas-docker` en Linux; `aislamiento` sigue sin explicar.
- [ ] **T9** **Dueño:** instalar WSL2 (Ubuntu) con la integración de Docker Desktop y reproducir `npm test` y `FORGE_TEST_DOCKER=1` en Linux (Fase 1.B y 1.E del plan).
- [ ] **T10** **Dueño:** cuando `main` esté verde, proteger la rama con los checks requeridos (decisión abierta 2) y crear el tag `v5.0.0-beta.1`.
