# Tareas: perfiles de agente

> Plan: `plan.md` · Cada tarea: test primero, después código. `[ ]` por hacer · `[x]` hecha.
> **Ninguna tarea empieza hasta que el dueño apruebe la spec.**

## S0 — Spikes

- [ ] **S0.1** Qué hace hoy cada rol del ciclo (`arquitecto`, `tester`, implementador): lee, escribe, recibe. Salida: `spikes/roles-del-ciclo.md` con archivo:línea; será la capa 1.
- [ ] **S0.2** Qué admite `parseFrontmatter` (estructura anidada o solo listas). Salida: `spikes/formato-del-perfil.md`, con decisión: cabecera o archivo hermano.
- [ ] **S0.3** Origen de los agentes (plugin frente a proyecto) y relación con `READ_ONLY_AGENTS` y `CLAUDE_AGENT_NAME`. Salida: `spikes/origen-y-gancho.md`.
- [ ] **S0.4** Reanudación con perfil distinto. Salida: `spikes/reanudacion.md`.

## F1 — Referencia de regresión

- [ ] **F1.1** Prueba del ciclo verificado completo (proveedor guionizado, Docker falso, `bloque` y `turnos`) que registra archivos, huellas, eventos y veredicto. Debe pasar sobre el código **actual**. Cubre CA-005-04.

## F2 — Formato

- [ ] **F2.1** Tests: perfil válido; clave desconocida; herramienta inexistente; valor mal formado con archivo y clave. Después lector en `agent-registry.js`. Cubre CA-001-01, CA-001-02.
- [ ] **F2.2** `tools:` como solicitud. Cubre CA-001-03.

## F3 — Resolución de capas

- [ ] **F3.1** Test de propiedad (efectivo ⊆ garantías, topes mínimos). Después `perfiles.js`. Cubre CA-003-01, CA-003-03, CA-003-05.
- [ ] **F3.2** Política del usuario fuera del árbol; la fabricada en el árbol se ignora. Cubre CA-003-02.
- [ ] **F3.3** Intento de ampliación ignorado y anotado. Cubre CA-003-04.

## F4 — Implementador

- [ ] **F4.1** Tests: esquemas filtrados por perfil; por defecto, cinco herramientas idénticas. Cubre CA-004-01.
- [ ] **F4.2** Topes `maxPruebas` y turnos desde el perfil. Cubre CA-004-02, CA-002-03.
- [ ] **F4.3** `aplicarArchivos` con rutas escribibles del perfil y `fuera_de_perfil`; mismo resultado en `bloque`. Cubre CA-002-02, CA-004-03.
- [ ] **F4.4** Herramienta pedida sin estar ofrecida. Cubre CA-002-01.

## F5 — Arquitecto y tester

- [ ] **F5.1** Perfil de `arquitecto`; regresión verde. Cubre CA-005-01.
- [ ] **F5.2** Perfil de `tester`; regresión verde. Cubre CA-005-02.
- [ ] **F5.3** Perfil del implementador; regresión verde. Cubre CA-005-03, CA-005-05.
- [ ] **F5.4** Rol de solo lectura no escribe por ninguna vía. Cubre CA-002-05.
- [ ] **F5.5** Falla cerrado con perfil irresoluble. Cubre CA-002-04.

## F6 — Visibilidad y documentación

- [ ] **F6.1** `forge agentes perfil` y aviso en `doctor`. Cubre CA-001-04.
- [ ] **F6.2** Documentación: guía, `README.md`, `CHANGELOG.md`; renombrar el concepto «tools» como solicitud.

## F7 — Cierre

- [ ] **F7.1** Suite completa en Windows y en el contenedor Linux; tipos en 0.
- [ ] **F7.2** Revisión independiente; hallazgos altos corregidos.
- [ ] **F7.3** `verificacion.md` con cada criterio y su prueba.
- [ ] **F7.4** Segunda entrega (aparte): resto del catálogo según `docs/ADECUACION-DEL-CATALOGO.md` §4.
