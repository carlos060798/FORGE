# Tareas: `forge verificar`

> Plan: `plan.md` · Cada tarea: test primero, después código. `[ ]` por hacer · `[x]` hecha.
> **Ninguna tarea empieza hasta que el dueño apruebe la spec.**

## S0 — Spikes

- [x] **S0.1** Leer `core/ciclo/mutacion.js` (`medirMutacion`) y quién la llama: qué recibe, qué necesita del estado del ciclo y si puede llamarse sola. Salida: `spikes/mutacion-fuera-del-ciclo.md`.
- [x] **S0.2** Cómo obtener los archivos cambiados desde una referencia sin que `git` ejecute ganchos, filtros ni configuración del repositorio. Salida: `spikes/cambios-sin-ejecutar.md`, con la decisión: invocación neutralizada o solo `--archivos`.

## F1 — Comando mínimo

- [x] **F1.1** `core/verificar/index.js`: detectar lenguaje y comando. Tests: proyecto sin `.sdd/`; lenguaje no admitido rechazado sin ejecutar. Cubre CA-001-01, CA-001-06.
- [x] **F1.2** Ejecución con `SandboxRunner` y clasificación con el enrutador. Tests con el Docker falso: pasa, falla, infraestructura. Cubre CA-001-04, CA-002-01.
- [x] **F1.3** `--comando` sin intérprete de órdenes. Tests: un comando con `&&` o redirección no se interpreta. Cubre CA-001-02.
- [x] **F1.4** Sin Docker: código 4 y mensaje; ninguna opción para saltarlo. Cubre CA-001-05.
- [x] **F1.5** `cli/verificar.js` y entrada con carga perezosa en `cli/index.js`. Test estático y en proceso hijo: no se carga ningún proveedor de modelo ni módulo de integraciones; `fetch` interceptado; ninguna clave de API leída. Cubre CA-001-03, RF-03.
- [x] **F1.6** Barrido de copias y contenedores huérfanos al empezar. Cubre RF-04.

## F2 — Salida estable

- [x] **F2.1** `core/verificar/resultado.js`: forma del resultado con versión. Cubre CA-002-02, CA-002-05.
- [x] **F2.2** Cero pruebas ejecutadas no es éxito. Cubre CA-002-03.
- [x] **F2.3** Redacción y tope de la salida. Test con una salida que contiene un secreto con forma conocida. Cubre CA-002-04.

## F3 — Mutación

- [ ] **F3.1** `--mutacion --archivos`. Tests: detección alta y baja; rechazo sin `--archivos` ni `--desde`. Cubre CA-003-01, CA-003-02.
- [ ] **F3.2** `--desde`, según la decisión de S0.2. Cubre CA-003-01.
- [ ] **F3.3** `--mutacion-minima` y «no concluyente» que falla cerrado. Cubre CA-003-03, CA-003-04.
- [ ] **F3.4** Aviso del límite del adversario en el informe. Cubre CA-003-05.

## F4 — Evidencia y concurrencia

- [ ] **F4.1** `--registrar`: evento y archivo, con escritura segura. Test: sin la opción no aparece nada en el proyecto. Cubre CA-004-01, CA-004-02.
- [ ] **F4.2** Dos verificaciones a la vez. Cubre CA-004-03.

## F5 — Cierre

- [ ] **F5.1** Prueba de proyecto hostil: uniones hacia fuera, script de pruebas malicioso, salida con secretos.
- [ ] **F5.2** Con Docker real, los cinco proyectos de `scripts/pruebas-independientes.mjs`, sin clave de API.
- [ ] **F5.3** Documentación: guía, `README.md`, `CHANGELOG.md`, `forge --help`.
- [ ] **F5.4** Suite completa en Windows y en el contenedor Linux; tipos en 0.
- [ ] **F5.5** Revisión independiente con la guía OWASP de agentes; hallazgos altos corregidos.
- [ ] **F5.6** `verificacion.md` con cada criterio y su prueba.

> **2026-10-14:** S0, F1 y F2 implementadas (`core/verificar/`, `cli/verificar.js`, `core/sandbox/crear-sandbox.js`). Mutación (F3), `--desde`, `--registrar` y cierre pendientes. Sin probar con Docker real.
