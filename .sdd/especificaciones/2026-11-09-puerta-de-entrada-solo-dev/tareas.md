# Tareas: puerta de entrada para el desarrollador individual

> `[x]` hecha · `[ ]` por hacer. Estado de la spec: borrador (la aprueba el dueño). Rama: `fase-2-puerta-de-entrada`.

- [x] **T1** Pruebas primero: `tests/instalacion-integraciones.test.js` (perfil por defecto esencial, cursor recibe 31 + 6 skills, update conserva una instalación completa antigua), `tests/instalacion-equivalencia.test.js` (sin opciones ≡ `--perfil esencial`; `--perfil completo` ≡ todos), `tests/consistencia-cifras.test.js` (la configuración de ejemplo activa los agentes de lean), `tests/doctor-docker.test.js` (no instalado vs no arrancado; texto del siguiente paso). Cubre CA-001-01 a CA-001-03, CA-002-01, CA-002-02.
- [x] **T2** `core/instalacion/perfiles.js`: `PERFIL_POR_DEFECTO = 'esencial'`. `cli/comandos/instalar.js`: `copiarNucleo` aplica el perfil por defecto cuando no hay opciones ni configuración; mensaje final con perfil, camino y `fragua doctor`. Cubre CA-001-01, CA-001-03, CA-001-04.
- [x] **T3** `configuracion-ejemplo/sdd.config.yaml`: bloque `agentes:` igual a `presets/lean.yaml`. Cubre CA-001-02.
- [x] **T4** `core/sandbox/diagnostico.js`: `clasificarFalloDocker` (no instalado / no arrancado / otro) con acción; `cli/comandos/doctor.js`: sección «Siguiente paso» (`textoSiguientePaso`). Cubre CA-002-01, CA-002-02.
- [x] **T5** Alias: `skills/deploy-vercel/SKILL.md`, `commands/sdd.optimizar.md`, `commands/sdd.optimizar-memoria.md`; `npm run generar-skills`. Cubre CA-003-01, CA-003-02.
- [x] **T6** Borrar `__tests__/`; `scripts/pruebas.mjs`, `tests/pruebas-clasificacion.test.js`, `docs/COBERTURA.md`. Cubre CA-003-03.
- [x] **T7** `docs/PRIMEROS-15-MINUTOS.md`; enlaces desde README, `0-INDICE.md` y `getting-started.md`; planes a `docs/archivo/planes/`; `docs/agents.md` y `docs/configuration.md` coherentes; `ESTADO-ACTUAL.md` e `INDICE.md`. Cubre CA-004-01, CA-004-02.
- [x] **T8** ADR-24 «Perfil esencial y preset lean por defecto» (propuesta).
- [ ] **T9** El dueño aprueba la spec y el ADR-24 y confirma el perfil por defecto.
- [ ] **T10** **Dueño:** medir el criterio de salida en una carpeta limpia de Windows: `init` → `doctor` → ciclo de cinco comandos sobre un proyecto trivial en menos de 15 minutos, y anotar el tiempo en `docs/PRIMEROS-15-MINUTOS.md`.
- [ ] **T11** Fusionar en `main` solo cuando la Fase 1 (CI verde) esté cerrada.
