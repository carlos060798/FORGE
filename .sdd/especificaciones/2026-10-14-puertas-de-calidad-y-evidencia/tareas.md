# Tareas: puertas de calidad y evidencia

> Plan: `plan.md` · Cada tarea: prueba primero, después código. `[ ]` por hacer · `[x]` hecha.
> **Aprobada por delegación del dueño el 2026-10-17: fase A (evidencia: S0, F5 y F6 parciales) y fase B1 (puertas en `fragua verificar`: F1 y F2).** Redactada por un agente por encargo del dueño. Las demás fases esperan.

## S0 — Spikes (solo lectura, salida en `spikes/`)

- [x] **S0.1** Cómo ejecutar varias puertas con una sola preparación de imagen y si pueden ir en paralelo. Salida: `spikes/varias-ejecuciones.md`.
- [x] **S0.2** Digest de la imagen construida en local (`{{.Id}}` frente a `RepoDigests`) y cómo pedirlo sin red. Salida: `spikes/digest-de-imagen.md`.
- [x] **S0.3** Dónde constan aprobador, fecha y hash de la spec aprobada. Salida: `spikes/aprobacion-de-spec.md`.
- [x] **S0.4** Identidad de modelo y rol por llamada: de dónde se obtiene y qué falta. Salida: `spikes/identidad-de-modelo.md`.
- [x] **S0.5** Formato de `events.jsonl` y tipos admitidos; qué consumidores leen los tipos. Salida: `spikes/eventos.md`.
- [x] **S0.6** Qué configuraciones de herramientas (tipos, linter) puede reescribir un agente hoy (lista de `docs/ciclo-verificado.md:210-226`) y comportamiento del lector con `#` y comillas. Salida: `spikes/configuracion-protegida.md`.

## F1 — Configuración

> **Fase B1 (2026-10-17, aprobada por delegación del dueño, "avanzar"): puertas declarables dentro de `fragua verificar`.** Módulos propios `core/puertas/{config,ejecutar}.js` (el lector plano de `core/ciclo/config.js` no sirve: ver `spikes/configuracion-protegida.md`). Pruebas: `tests/puertas-config.test.js`, `tests/puertas-ejecutar.test.js`, `tests/puertas-verificar.test.js`. Guía: `docs/puertas-de-calidad.md`. Esquema `resultado-verificar` 1.2 (copia congelada `tests/fixtures/contrato/v1.2/`). La integración con el ciclo (F3, `router.js`, `nodos.js`) espera a que termine el frente de perfiles.

- [x] **F1.1** Prueba: `puertas:` con claves válidas se lee; clave desconocida es error con su línea. Código en `core/puertas/config.js` (no en `core/ciclo/config.js`). Cubre CA-001-01 (sin `cobertura_minima`: el umbral va en el comando), CA-001-02.
- [x] **F1.2** Prueba exhaustiva: ninguna clave aceptada afloja una garantía fija; los topes solo bajan; límite al número de puertas. Cubre CA-001-03.
- [x] **F1.3** Prueba: sin sección, el resultado es idéntico al de hoy (no aparece `puertas`). Cubre CA-001-04.
- [x] **F1.4** Prueba: comando con `&&`, `|`, `;`, `>`, `<`, `&` o un intérprete como primera palabra rechazado; `#` pegado y comilla final. Cubre CA-001-05.
- [ ] **F1.5** (fase siguiente) Ampliar `CONFIGURACION` de `protocolo-archivos.js` con `tsconfig*.json`, `biome.json`… (ver F6.6; mismo archivo del frente de perfiles).

## F2 — Ejecución en `forge verificar`

- [x] **F2.1** Prueba con Docker falso: cada puerta pass/fail/timeout/infra; código de salida del proceso. Código `core/puertas/ejecutar.js` (no `core/ciclo/puertas.js`). Cubre CA-002-01, CA-002-02.
- [x] **F2.2** Prueba: pruebas en verde y puerta en rojo da `falla`; infra y timeout nunca éxito. Cubre CA-002-03.
- [x] **F2.3** Prueba: herramienta ausente (127, mirado antes de `clasificar`) da «no ejecutable». Cubre CA-002-04.
- [x] **F2.4** Prueba: el resultado nombra la puerta y redacta su salida. Cubre CA-002-05.
- [x] **F2.5** Decisión: sin `cobertura_minima`; el umbral va dentro del comando de `cobertura` y lo hace cumplir la herramienta (CA-002-06 cumplido en su espíritu: no se lee un número de la salida). Documentado en `docs/puertas-de-calidad.md`.
- [x] **F2.6** Prueba: `--json` incluye las puertas y los códigos 0, 1 y 4 no cambian; `--registrar` las lleva a `evidencia`. Cubre CA-002-07. Sin `--sin-puertas` (decisión documentada).

## F3 — Puertas en el ciclo

> F3 es la fase siguiente (tras el frente de perfiles): el nodo `puertas` entre `sandbox` y `mutacion` (`nodos.js`, `grafo.js`), `decidirTrasPuertas` en `router.js`, el motivo `puerta` en `estado.js`, el evento `ciclo:puerta` (`core/event-log.js`, `docs/contrato/tipos-evento.json`) y la reutilización de `core/puertas/ejecutar.js` (ya expone `ejecutarPuertas` y `juzgarPuertas`). Esta fase NO emite eventos nuevos.

- [ ] **F3.1** Prueba de `decidirTrasPuertas` (función pura) en `router.js`. Cubre RF-03.
- [ ] **F3.2** Prueba del nodo y del grafo: sin sección, mismo recorrido que hoy; con puerta fallida, vuelve al implementador con su salida. Cubre CA-001-04, RF-04.
- [ ] **F3.3** Prueba: motivo `puerta` en el estado y en `validarEstado` (`core/ciclo/estado.js:8,167`).
- [ ] **F3.4** Prueba de regresión del ciclo completo con el Docker falso y un modelo falso.

## F4 — Criterios enlazados a pruebas

- [ ] **F4.1** Prueba: extrae los `CA-xxx-yy` de una spec de ejemplo. Cubre CA-003-01.
- [ ] **F4.2** Prueba: CA sin tarea y CA con tarea sin prueba citada. Cubre CA-003-02.
- [ ] **F4.3** Prueba estática: el módulo no importa proveedores de modelo ni ejecuta procesos. Cubre CA-003-03.
- [ ] **F4.4** Salida en `forge status`/`verificar --criterios` y `--exigir-cobertura-de-criterios`. Cubre CA-003-04, CA-003-05.
- [ ] **F4.5** Instrucción al agente de pruebas de citar el identificador (cambio en `core/ciclo/contratos.js:34-44`; prueba de regresión del ciclo).

## F5 — Informe de evidencia

- [x] **F5.1** Prueba: el informe contiene cada campo o su `null` con motivo. Cubre CA-004-01, CA-004-02.
- [x] **F5.2** Prueba: redacción de un secreto en cualquier campo. Cubre CA-004-03.
- [x] **F5.3** Prueba: `sha256` canónico estable ante el orden de claves. Cubre CA-004-04.
- [x] **F5.4** Prueba: guardado exclusivo y con escritura segura (enlace en la ruta, colisión de id). Cubre CA-004-05.
- [x] **F5.5** Prueba: nada sale del equipo (red interceptada). Cubre CA-004-06.

## F6 — Cadena y firma

- [x] **F6.1** Prueba: encadenado con `anterior`; alterar, borrar o reordenar rompe. Cubre CA-005-01.
- [x] **F6.2** Comando de comprobación y sus códigos. Cubre CA-005-02.
- [x] **F6.3** Firma y verificación opcionales con `node:crypto`; sin clave, «encadenado, no firmado». Cubre CA-005-03.
- [x] **F6.4** Impresión de la cabeza y texto del límite en la guía. Cubre CA-005-04, CA-005-05.

- [x] **F6.5** (añadida) `core/evidencia/protegidos.js` con su prueba (`tests/evidencia-protegidos.test.js`): lista de configuración que el agente no debe reescribir.
- [ ] **F6.6** (fase siguiente) Cablear `protegidos.js` a `clasificarRuta` de `core/ciclo/protocolo-archivos.js` y a `leerRutasProtegidas`; prueba F8.1 «el implementador reescribe tsconfig.json».
- [ ] **F6.7** (fase siguiente) Candado de proyecto (`ciclo/candado.js`) al leer la cabeza y escribir; `ciclo:llamada`/`modeloServido` para poblar `modelos`; `DockerCli.identidadImagen` en `prepararImagen`.

> Fase A hecha en `core/evidencia/cadena.js`, `core/verificar/registro.js`, `cli/verificar.js` (`--comprobar-evidencia`), esquema `resultado-verificar` 1.1 y `docs/cadena-de-evidencia.md`. Pruebas: `tests/evidencia-cadena.test.js`, `tests/evidencia-comando.test.js`, `tests/evidencia-protegidos.test.js`. CA-005-04 se cumple con la cabeza guardada y la guía; CA-005-03 ya no es opcional con clave.

## F7 — Regresión (`no_cambiar`)

- [ ] **F7.1** Prueba y código: campo opcional de tarea y su validación. Cubre CA-006-01, CA-006-05.
- [ ] **F7.2** Prueba: línea base verde antes de implementar; si no, revisión humana. Cubre CA-006-02.
- [ ] **F7.3** Prueba: regresión tras el cambio da `falla` con la lista. Cubre CA-006-03.
- [ ] **F7.4** Prueba: el implementador no puede modificar lo declarado. Cubre CA-006-04.

## F8 — Cierre

- [ ] **F8.1** Prueba de proyecto hostil: comando de puerta malicioso, salida con secretos, informe retocado.
- [ ] **F8.2** Con Docker real, una puerta de tipos y otra de linter (`FORGE_TEST_DOCKER=1`).
- [ ] **F8.3** Documentación: `docs/ciclo-verificado.md`, guía, `README.md`, `CHANGELOG.md`, ayuda.
- [ ] **F8.4** Suite completa en Windows y en el contenedor Linux; tipos en 0.
- [ ] **F8.5** Revisión independiente (ver `plan.md`, sección 9); hallazgos altos corregidos.
- [ ] **F8.6** `verificacion.md` con cada criterio y su prueba.
