# Tareas: defensa frente a inyección y fuga

> Plan: `plan.md` · Cada tarea: test primero, después código. `[ ]` por hacer · `[x]` hecha.
> **Ninguna tarea empieza hasta que el dueño apruebe la spec.**

## S0 — Spikes

- [ ] **S0.1** Inventario de puntos por los que contenido del árbol llega al modelo (nodos, secciones, herramientas, recuperador). Salida: `spikes/puntos-de-entrada.md` con archivo:línea y estado.
- [ ] **S0.2** Determinismo del identificador y reanudación (diario por huella de prompt, ADR-21). Salida: `spikes/identificador-y-reanudacion.md`, con decisión.
- [ ] **S0.3** Qué es un «destino externo» en código real; corpus de falsos positivos. Salida: `spikes/destinos.md`.
- [ ] **S0.4** Efecto del delimitador con un modelo real, con pocos casos y declarado no concluyente si procede. Salida: `spikes/modelo-real.md`.

## F1 — Batería primero

- [ ] **F1.1** Casos nuevos en `hostiles.json`: comentario, README, configuración, nombre de archivo, dependencia, salida de pruebas, archivo con el identificador. Tests en rojo que demuestran el hueco. Cubre CA-003-01.
- [ ] **F1.2** Controles negativos por categoría. Cubre CA-003-03.
- [ ] **F1.3** Modelo guionizado que obedece. Cubre CA-003-04.

## F2 — Entrada como dato

- [ ] **F2.1** Test: `comoArchivo` no reescribe enlaces ni URL; el identificador no está en el contenido. Después `core/ciclo/dato-no-confiable.js`. Cubre CA-001-02, CA-001-03.
- [ ] **F2.2** Test de equivalencia del ciclo con el proveedor de pruebas. Cubre CA-001-06.
- [ ] **F2.3** Aplicar en `leer_archivo`, `buscar`, salida de pruebas. Cubre CA-001-01.
- [ ] **F2.4** Aplicar en las secciones de `nodos.js` y en el recuperador. Cubre CA-001-01, CA-001-04.
- [ ] **F2.5** Reanudación con identificador guardado. Cubre CA-001-05.
- [ ] **F2.6** Prueba estática: toda lectura hacia el prompt está registrada.

## F3 — Secretos en la escritura

- [ ] **F3.1** Tests: secretos de formato conocido y por valor rechazados en bloque y en `editar`; motivo sin el valor. Después `control-salida.js` y la llamada desde `aplicarArchivos`. Cubre CA-002-01, CA-002-02, CA-002-05.
- [ ] **F3.2** Falla cerrado ante contenido ilegible o enorme. Cubre CA-002-06.

## F4 — Destinos

- [ ] **F4.1** Tests: destino nuevo vs. presente; política del usuario fuera del árbol; el repositorio no la puede fabricar. Después `politica-destinos.js`. Cubre CA-002-03, CA-002-04.
- [ ] **F4.2** `requiereRevision` por destino y salida a `revision_humana`.

## F5 — Garantías y límites

- [ ] **F5.1** `docs/GARANTIAS-Y-LIMITES.md` con cada garantía enlazada a su prueba. Cubre CA-004-01 a CA-004-03.
- [ ] **F5.2** Prueba del catálogo: garantía sin prueba falla. Cubre CA-004-04.

## F6 — Cierre

- [ ] **F6.1** Suite completa en Windows y en el contenedor Linux; tipos en 0.
- [ ] **F6.2** Con Docker real la parte hostil (`FORGE_TEST_DOCKER=1`).
- [ ] **F6.3** Revisión independiente; hallazgos altos corregidos.
- [ ] **F6.4** `verificacion.md` con cada criterio y su prueba.
