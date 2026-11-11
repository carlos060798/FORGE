# Tareas: usuario del contenedor en Linux

> `[x]` hecha · `[ ]` por hacer. Estado de la spec: borrador (la aprueba el dueño).

- [x] **T1** Pruebas primero: `tests/sandbox-politica.test.js` (usuarioContenedor y `--user`) y `tests/sandbox-real.test.js` (la copia se borra tras crear archivos). Cubre CA-001-01, CA-001-02, CA-002-01.
- [x] **T2** `core/sandbox/politica.js`: `usuarioContenedor()` y `argvRun` lo usa. Cubre CA-001-01 a CA-001-03.
- [x] **T3** Comprobar en un Docker de Linux limpio con usuario 1001. Cubre CA-002-01 y CA-002-02.
- [ ] **T4** El dueño aprueba la spec.
