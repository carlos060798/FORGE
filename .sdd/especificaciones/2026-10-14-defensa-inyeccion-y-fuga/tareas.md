# Tareas: defensa frente a inyección y fuga

> Plan: `plan.md` · Cada tarea: test primero, después código. `[ ]` por hacer · `[x]` hecha.
> **Aprobada por delegación del dueño el 2026-10-17** (pidió avanzar). Los informes de `spikes/` mandan sobre la spec. Quedan abiertas: S0.4 (sin credenciales ni presupuesto), F6.1 a F6.4 (revisión independiente, suite completa en Linux y contenedor, Docker real).

## S0 — Spikes

- [x] **S0.1** Inventario de puntos por los que contenido del árbol llega al modelo. Salida: `spikes/puntos-de-entrada.md` (16 puntos).
- [x] **S0.2** Determinismo del identificador y reanudación. Salida: `spikes/identificador-y-reanudacion.md` (decisión: derivado del contenido).
- [x] **S0.3** Qué es un «destino externo». Salida: `spikes/destinos.md` (corpus de un solo proyecto).
- [ ] **S0.4** Efecto del delimitador con un modelo real. Salida: `spikes/modelo-real.md` con el **protocolo**, **sin ejecutar** (sin credenciales ni presupuesto aprobado). Pendiente del dueño; se ejecuta después de F2 con tope de 60 llamadas.

## F1 — Batería primero

- [x] **F1.1** Casos nuevos en `tests/fixtures/integraciones/hostiles-proyecto.json` (13 casos, 10 categorías); `hostiles.json` se reutiliza sin modificar. Cubre CA-003-01.
- [x] **F1.2** Controles negativos por categoría (`fueraDeBloques` sobre el texto sin delimitar). Cubre CA-003-03.
- [x] **F1.3** Modelo guionizado que obedece (escribe `.env`, fuera del proyecto, `.ssh`, `.git/hooks`, `secrets/`). Cubre CA-003-04.

## F2 — Entrada como dato

- [x] **F2.1** `tests/dato-no-confiable.test.js` primero (en rojo) y después `core/ciclo/dato-no-confiable.js`. Cubre CA-001-02, CA-001-03.
- [x] **F2.2** Equivalencia: el ciclo hostil termina igual que el limpio (resultado, archivos, eventos); `tests/ciclo-*.test.js` en verde, con cuatro aserciones de formato de prompt ajustadas. Cubre CA-001-06.
- [x] **F2.3** Aplicado en `leer_archivo`, `listar`, `buscar` y la salida de `ejecutar_pruebas`; `editar` rechaza el marcador. Cubre CA-001-01, CA-001-07.
- [x] **F2.4** Aplicado en las secciones de `nodos.js`, `pruebas-confiables.js`, `turnos.js` y en el recuperador (`recuperar()` devuelve fragmentos; el ciclo los delimita). Incluye las dos fugas previas (F2.0): `listar` y la cabecera semántica. Cubre CA-001-01, CA-001-04.
- [x] **F2.5** Reanudación (identificador derivado, no guardado): misma clave y sin llamadas repetidas. Cubre CA-001-05.
- [x] **F2.6** Prueba estática `tests/entradas-registradas.test.js`: toda lectura hacia el prompt está registrada.

## F3 — Secretos en la escritura

- [x] **F3.1** Secretos de formato, por valor y clave privada rechazados en bloque, `editar` y MCP; motivo sin el valor. `control-salida.js` y llamada desde `aplicarArchivos`. Cubre CA-002-01, CA-002-02, CA-002-05.
- [x] **F3.2** Falla cerrado ante binario o más de 1 MiB. Cubre CA-002-06.

## F4 — Destinos

- [x] **F4.1** Destino nuevo frente al mismo archivo y a la política del usuario (`FORGE_DESTINOS_PERMITIDOS`); el repositorio no la fabrica. Cubre CA-002-03, CA-002-04.
- [x] **F4.2** `requiereRevision` por destino (y contenido ilegible); sale a `revision_humana` con el detalle. El motivo de la revisión sigue siendo `dependencias` (límite declarado).

## F5 — Garantías y límites

- [x] **F5.1** `docs/GARANTIAS-Y-LIMITES.md`. Cubre CA-004-01 a CA-004-03.
- [x] **F5.2** `tests/garantias-documentadas.test.js`: garantía sin prueba falla. Cubre CA-004-04.

## F6 — Cierre

- [ ] **F6.1** Suite completa en Windows y en el contenedor Linux; tipos en 0. (Hecho parcialmente: las pruebas afectadas y `npm run typecheck`; la suite completa **no** se ejecutó.)
- [ ] **F6.2** Con Docker real la parte hostil (`FORGE_TEST_DOCKER=1`).
- [ ] **F6.3** Revisión independiente; hallazgos altos corregidos.
- [ ] **F6.4** `verificacion.md` con cada criterio y su prueba.
