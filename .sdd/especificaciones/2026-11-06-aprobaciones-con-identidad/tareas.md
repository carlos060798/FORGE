# Tareas: aprobaciones con identidad

> `[x]` hecha · `[ ]` por hacer. Estado de la spec: borrador (la aprueba el dueño).

- [x] **T1** Pruebas primero: `tests/aprobaciones-identidad.test.js` (TTY, código, registro, delegación, `--force`). Cubre CA-001-01 a CA-004-02.
- [x] **T2** `core/aprobaciones-identidad.js`: `exigirTerminal`, `generarCodigo`, `confirmarConCodigo`, `identidadDelAprobador`, registro firmado y encadenado, `comprobarDelegaciones`, `firmarEvento`. Cubre CA-001-01, CA-001-03, CA-002-01, CA-002-02, CA-003-01, CA-005-01.
- [x] **T3** `cmdAprobar` en `cli/index.js` (`spec` y `delegacion`, sin opciones, hash de la spec). Cubre CA-001-02, CA-002-03.
- [x] **T4** `forge verificar --comprobar-aprobaciones` en `cli/verificar.js`. Cubre CA-003-02.
- [x] **T5** `PipelineStateMachine.advance(..., { motivo, quien, firmar })`, `forge step --force --motivo` en `cli/runner.js` y tipo de evento `pipeline_step_forzado`. Cubre CA-004-01, CA-004-02.
- [x] **T6** Límite en la cabecera de `core/evidencia/cadena.js`. Cubre CA-005-01.
- [x] **T7** Actualizar pruebas existentes que aprobaban sin terminal (`state-machine-aprobacion`, `proyecto-hostil`).
- [ ] **T8** El dueño aprueba la spec y decide qué hacer con los dos planes `aprobado_por_delegacion` (registrarlos con `forge aprobar delegacion` o reaprobarlos).
- [ ] **T9** Probar `forge aprobar spec` a mano en un terminal real (Windows y POSIX); ninguna prueba automática abre un TTY.
- [ ] **T10** (Futuro, ADR aparte) Llavero del SO para la clave. No se implementa aquí.
- [ ] **T11** Decidir si `core/engine-cli.js --force` y `forge reset --force` también exigen motivo y evento firmado.
