# Tareas: guardián endurecido

> `[x]` hecha · `[ ]` por hacer.

- [x] **T1.1** `tests/guardian-reglas.test.js` (rojo) y `core/evidencia/guardian-reglas.js`. Cubre CA-001-01 a CA-001-04.
- [x] **T1.2** `claude-hooks/shared/guardian-reglas.js` (reexporta la fuente) y copia autónoma al instalar en `cli/index.js`. Cubre CA-003-01.
- [x] **T2.1** `tests/guardian-endurecido.test.js` y casos nuevos en `tests/evals/casos-guardian.json` (67 casos).
- [x] **T2.2** `claude-hooks/pre-tool-guard.js`: falla cerrado, rutas críticas, `NotebookEdit`, lectura de secretos con `Read`, nivel del CircuitBreaker primero, avisos que no cortan, solo lectura también por shell, redacción en la auditoría, vía `.sdd/adrs/` retirada. Cubre CA-002-01 a CA-002-05.
- [x] **T2.3** `claude-hooks/pre-tool-guard.sh`: sin Node bloquea (exit 2), Node >= 20.
- [x] **T2.4** `tests/pre-tool-guard.test.js` y `tests/hook-instalado.test.js` actualizados (JSON ilegible ⇒ 2; hook instalado con las reglas).
- [x] **T3.1** `SECURITY.md` con el modelo de amenaza.
- [ ] **T4.1** Quitar `Bash` de las herramientas de los agentes de solo lectura en `agents/*.md` donde no lo necesiten (hoy lo cubre el guardián, que depende de `CLAUDE_AGENT_NAME`).
- [ ] **T4.2** Probar el guardián en un proyecto real con Claude Code (a mano, por el dueño).
- [ ] **T4.3** Cobertura de variantes que el analizador no entiende (alias, funciones de shell, `eval`, `xargs` con entrada dinámica, here-docs): documentadas como límite.
