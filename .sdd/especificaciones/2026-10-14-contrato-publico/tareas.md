# Tareas: contrato público

> Plan: `plan.md` · Cada tarea: prueba primero, después código. `[ ]` por hacer · `[x]` hecha.
> Spec aprobada por delegación del dueño el 2026-10-17 (pendiente de ratificación). Esquemas en `docs/contrato/` y validador en `core/contrato/validar.js` (spec §16). Sin hacer: F3.4, F6.3, F7.2, F7.3, F8. F6.2 solo cubre «igual a la copia congelada o `$id` distinto» (no clasifica compatibles y rupturas).

## S0 — Spikes (solo lectura, salida en `spikes/`)

- [x] **S0.1** Volcar artefactos reales (estado tras cada categoría, resultado de cada veredicto) y compararlos con `@typedef` de `core/ciclo/estado.js:61-82`. Salida: `spikes/artefactos-reales.md`.
- [x] **S0.2** Inventario de tipos reales de evento frente a `EventType` (`core/event-log.js:9`) y de sus lectores. Salida: `spikes/eventos-reales.md`.
- [x] **S0.3** Subconjunto de JSON Schema que cubre `core/schemas/*.json` y los esquemas nuevos. Salida: `spikes/subconjunto-json-schema.md`.
- [x] **S0.4** Consumidores de `core/schemas` (`cli/export.js`, `cli/import.js`) y qué rompería endurecer `validateArtefacto`. Salida: `spikes/consumidores-de-esquemas.md`.
- [x] **S0.5** Salidas `--json` de `run` y `status`: forma real y si entran. Salida: `spikes/salidas-json.md`.

## F1 — Validador

- [x] **F1.1** Pruebas del validador: tipos, `required`, `enum`, `const`, `items`, `properties`, `additionalProperties`. Código en `core/schemas/validador.js`. Cubre CA-002-01.
- [x] **F1.2** Prueba: un esquema con palabra clave no soportada se rechaza. Cubre CA-002-01.
- [x] **F1.3** Pruebas negativas del validador (ausente, tipo, enum, adicional). Cubre CA-002-03.

## F2 — Resultado de `verificar`

- [x] **F2.1** Prueba: `crearResultado` de cada veredicto, con y sin mutación y con `registro`, valida contra el esquema. Código: `resultado-verificar.schema.json`. Cubre CA-001-02, CA-002-02.
- [x] **F2.2** Prueba: el objeto `mutacion` real de `juzgarMedicion` (`core/verificar/mutacion.js:57-86`) valida; sus campos entran o se marcan internos.
- [x] **F2.3** Prueba: la salida `--json` real de `forge verificar` (proceso hijo con Docker falso) valida. Cubre CA-002-02.

## F3 — Veredicto, tarea y estado

- [x] **F3.1** Prueba: `veredicto` con los cuatro valores y el mapa a categorías documentado. Cubre CA-001-03.
- [x] **F3.2** Prueba: las dos formas de entrada de tarea y la normalizada (`core/tareas.js:49-67`) validan. Cubre CA-001-04.
- [x] **F3.3** Prueba: `estadoInicial` y un estado tras cada categoría validan contra `estado-ciclo`. Cubre CA-001-06.
- [ ] **F3.4** Prueba: versión desconocida se rechaza con mensaje que lista las admitidas. Cubre CA-003-06.

## F4 — Eventos

- [x] **F4.1** Prueba: un evento de `EventLog.append` de cada tipo conocido valida contra el sobre. Cubre CA-001-05.
- [x] **F4.2** Prueba: `payload` no se restringe y un evento con campos extra en `payload` valida. Cubre CA-004-01.

## F5 — Dirección inversa y clasificación

- [x] **F5.1** Prueba: toda propiedad obligatoria del esquema la produce el código. Cubre CA-002-04.
- [x] **F5.2** Prueba: todo campo real está en el esquema o marcado `x-interno`. Cubre CA-004-02.

## F6 — Compatibilidad

- [x] **F6.1** Congelar v1 en `tests/fixtures/contrato/v1/`.
- [x] **F6.2** Prueba del diferencial: añadir opcional pasa, quitar o cambiar tipo rompe sin subir mayor. Cubre CA-002-05, CA-003-02.
- [ ] **F6.3** Prueba: las zonas de extensión admiten campos desconocidos. Cubre CA-003-04.

## F7 — Documentación y comando

- [x] **F7.1** `docs/CONTRATO-PUBLICO.md`: política, interno, mapa de vocabularios, códigos de salida. Cubre CA-003-01, CA-003-03, CA-003-05, CA-004-01, CA-004-03.
- [ ] **F7.2** Comando `esquema` de solo lectura y esquemas en el paquete publicado (P2). Cubre CA-001-07.
- [ ] **F7.3** `CHANGELOG.md` y guía.

## F8 — Cierre

- [ ] **F8.1** Suite completa en Windows y en el contenedor Linux; tipos en 0. Cubre CA-002-06.
- [ ] **F8.2** Revisión independiente (ver `plan.md`, sección 9); hallazgos altos corregidos.
- [ ] **F8.3** `verificacion.md` con cada criterio y su prueba.
