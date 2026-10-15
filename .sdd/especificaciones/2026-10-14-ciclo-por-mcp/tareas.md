# Tareas: `ciclo-por-mcp`

> Plan: `plan.md` · Cada tarea: test primero, después código. `[ ]` por hacer · `[x]` hecha.
> **Ninguna tarea empieza hasta que el dueño apruebe la spec.** Las fases F4 a F6 además esperan a las especificaciones del frente C, ya implementadas y revisadas.

## S0 — Spikes

- [ ] **S0.1** Leer `core/mcp/protocolo.js` entero: identidad del cliente, tamaño de respuesta, cancelación, llamadas largas. Salida: `spikes/protocolo-y-limites.md`.
- [ ] **S0.2** Cómo se resuelve `tope_usd` (`core/ciclo/config.js:46`, `:320-323`) y cómo aplicar `min()` sin que el repositorio pueda subirlo. Salida: `spikes/tope-efectivo.md`.
- [ ] **S0.3** Medir consumo de una verificación (tiempo, memoria, disco) para fijar topes. Salida: `spikes/consumo-verificar.md`.
- [ ] **S0.4** Cómo lanza el ciclo `fragua ciclo aprobar` sin pasar por el servidor MCP. Salida: `spikes/lanzamiento-aprobado.md`.
- [ ] **S0.5** `/v1/decisiones` con `presupuestoExtra` (`core/api/servidor.js:238-244`): ¿otro tope aguas abajo? Salida: `spikes/presupuesto-extra-api.md`, como hallazgo.

## F1 — Perfil y `verificar`

- [ ] **F1.1** `core/mcp/perfiles.js`: lista cerrada y resolución usuario ∩ proyecto. Tests: el proyecto no amplía; valor desconocido apaga. Cubre CA-002-01, CA-002-04.
- [ ] **F1.2** Herramienta `verificar` con esquema cerrado. Tests: campos extra rechazados; sin `comando` ni `cwd`. Cubre CA-001-01.
- [ ] **F1.3** Delegar en `core/verificar/index.js`. Tests con el Docker falso: cuatro veredictos; cero pruebas no es éxito. Cubre CA-001-02, CA-001-03.
- [ ] **F1.4** Sin Docker: error de herramienta, nada ejecutado. Cubre CA-001-04.
- [ ] **F1.5** Prueba estática y de proceso: sin proveedores, sin integraciones, sin claves, `fetch` interceptado. Cubre CA-001-05, CA-001-06, RF-06.
- [ ] **F1.6** `archivos` de mutación con `validarRuta`. Cubre CA-001-07.
- [ ] **F1.7** Perfil sin `escribir_archivo`, `leer_archivo` ni decisión; herramienta fuera de lista es «inexistente». Cubre CA-002-02, CA-002-03.
- [ ] **F1.8** `--perfil` en `fragua mcp` y línea en `fragua doctor`. Cubre CA-002-05.

## F2 — Topes y auditoría

- [ ] **F2.1** Candado: segunda llamada «ocupado». Cubre CA-004-01.
- [ ] **F2.2** Contadores por hora y día en el estado del usuario, con firma; contador inválido falla cerrado. Cubre CA-004-02.
- [ ] **F2.3** Tope de salida y duración. Cubre CA-004-03.
- [ ] **F2.4** Interruptor por variable y archivo; valor desconocido apaga. Cubre CA-004-04.
- [ ] **F2.5** Auditoría de cada llamada. Cubre CA-004-05.
- [ ] **F2.6** Transporte solo stdio: prueba de que no se abre ningún puerto. Cubre CA-003-01, CA-003-02, CA-003-03.

## F3 — Cierre de la fase 1

- [ ] **F3.1** Batería de textos y repositorios hostiles contra un cliente de prueba (ampliación de `tests/fixtures/integraciones/hostiles.json`).
- [ ] **F3.2** Cliente MCP real de extremo a extremo, en Windows y Linux.
- [ ] **F3.3** Documentación: configuración del cliente, qué se expone y qué no.
- [ ] **F3.4** Suite completa y tipos en 0.
- [ ] **F3.5** Revisión independiente (OWASP agentes); hallazgos altos corregidos.
- [ ] **F3.6** `verificacion.md` con cada criterio y su prueba.

## F4 — Estado del ciclo (fase 2)

- [ ] **F4.1** `estado_ciclo` solo lectura; sin `.sdd/motor/` ni rutas. Cubre CA-005-01, CA-005-02, CA-005-03.

## F5 — Solicitudes de ciclo (fase 3)

- [ ] **F5.1** Cola firmada y huella. Tests: sin firma, huella ajena, caducada, de un solo uso. Cubre CA-006-01, CA-006-07.
- [ ] **F5.2** Tope efectivo `min()`; sin `FRAGUA_MCP_TOPE_USD` apagado. Cubre CA-006-04.
- [ ] **F5.3** Tarea como dato no confiable. Cubre CA-006-02.
- [ ] **F5.4** `fragua ciclo vista|aprobar|rechazar|pendientes`; la aprobación no es herramienta. Cubre CA-006-03, CA-006-05, CA-006-06.
- [ ] **F5.5** Máximo de pendientes. Cubre CA-006-08.

## F6 — Cierre de la fase 3

- [ ] **F6.1** Prueba de extremo a extremo con ciclo real y tope de 1 USD.
- [ ] **F6.2** Revisión independiente de la fase 3.
- [ ] **F6.3** `CHANGELOG.md`, guía y `verificacion.md`.
