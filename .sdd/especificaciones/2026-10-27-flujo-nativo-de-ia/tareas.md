# Tareas: flujo nativo de IA

> `[x]` hecha · `[ ]` por hacer.

- [x] **F1.1** `CLAUDE.md` raíz con `@AGENTS.md` y comandos. Cubre CA-001-01.
- [x] **F1.2** `.gitignore` con `.claude/worktrees/`; `.claude/settings.json` sin rutas ajenas. Cubre CA-001-02.
- [x] **F2.1** Prueba primero y después bloqueo en `claude-hooks/pre-tool-guard.js` con `clasificarConfiguracionProtegida`. Cubre CA-002-01 y CA-002-02.
- [x] **F2.2** `claude-hooks/shared/protegidos.js` y copia autónoma al instalar (`cli/index.js`). Cubre CA-002-03.
- [x] **F3.1** `REVIEW.md`. Cubre CA-003-01.
- [x] **F3.2** Job `evidencia` en `.github/workflows/ci.yml` y prueba en `tests/consistencia-cifras.test.js`. Cubre CA-003-02.
- [x] **F4.1** `tests/evals/` (tabla + ejecutor), añadido a `npm test`. Cubre CA-004-01.
- [x] **F4.2** `.github/workflows/evals-modelo-real.yml` (`workflow_dispatch`). Cubre CA-004-02.
- [x] **F5.1** `core/mantenimiento.js`, `tests/mantenimiento.test.js` y `forge mantenimiento`. Cubre CA-005-01 a CA-005-03.
- [x] **F5.2** `lineasMantenimiento` en `core/mantenimiento.js` y aviso en `cli/runner.js` (`forge status`). Cubre CA-005-04.
- [x] **F6.1** `core/ciclo/metricas.js`, `tests/ciclo-metricas.test.js` y cableado en `lineasEstadoCiclo`. Cubre CA-006-01 a CA-006-03.
- [x] **F7.1** Prueba de la instalación del hook (`tests/hook-instalado.test.js`) y de los indicadores en `forge status`.
- [ ] **F7.2** Revisión independiente y ejecución del job `evidencia` y del workflow con modelo real en GitHub Actions.
