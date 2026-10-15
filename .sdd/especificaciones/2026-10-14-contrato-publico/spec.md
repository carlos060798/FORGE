---
id: 2026-10-14-contrato-publico
titulo: "Contrato público: esquemas JSON versionados de tareas, estado, veredicto, eventos y resultado de verificar, con política de compatibilidad"
tamano: mediano  # micro | pequeño | mediano | grande
estado: borrador  # borrador | en_revision | aprobada | en_implementacion | completada
creada: 2026-10-14
actualizada: 2026-10-14
autor: humano  # humano | importado
constitucion_version: 1.1.0
etiquetas: [interoperabilidad, esquemas, compatibilidad, contrato, versionado]
---

# Especificación: contrato público

> **Estado: borrador.** Redactada por un agente por encargo del dueño (2026-10-14); **no está aprobada** y no se implementa hasta que el dueño la apruebe (Principio II). Corresponde al frente E de `PLAN-MAESTRO.md` (sección 5). Cada afirmación sobre el código cita `archivo:línea` leído el 2026-10-14; lo no confirmado está marcado «sin confirmar».

## 1. Contexto y Motivación

El plan maestro quiere que otras herramientas usen Fragua «como pieza» (`PLAN-MAESTRO.md:73`, oleada 4). Para eso lo que sale de Fragua tiene que tener una forma estable y comprobable. Hoy hay formas, pero no un contrato:

- **Esquemas que ya existen** en `core/schemas/`: `ir`, `estado` y `adr`, con `schemaVersion: "1.0"` y declarados «contrato público del framework» (`core/schemas/index.js:3-5,16-20`). El esquema `estado` describe el `.sdd/estado.json` del **pipeline** (`pipeline_step`, `spec_activa`, ...), **no** el estado del ciclo verificado.
- **Validador mínimo.** `validateArtefacto` solo comprueba `schemaVersion`, campos `required` y `enum` de primer nivel (`core/schemas/index.js:41-76`): no valida tipos anidados, listas ni propiedades adicionales. Una desviación del código dentro de un objeto anidado no la detecta.
- **Estado del ciclo.** `EstadoCiclo` está descrito en un `@typedef` de JSDoc, con `SCHEMA_VERSION = '1.0'` y `validarEstado` a mano (`core/ciclo/estado.js:5,61-82,148-195`). No hay esquema JSON publicable.
- **Resultado de `verificar`.** `formato: 1` entero (`core/verificar/resultado.js:12,57`), con veredictos en español `pasa|falla|sin_pruebas|infraestructura` (`core/verificar/resultado.js:17`). El ciclo usa **otro vocabulario**: categorías `pass|fail|timeout|infra_error` (`core/ciclo/estado.js:7`) y resultados `en_curso|exito|revision_pendiente|aceptada_por_humano|abortada` (`core/ciclo/estado.js:10`). Dos estilos de versión (`"1.0"` texto y `1` entero) y dos vocabularios de veredicto.
- **Tareas.** Dos formatos de entrada: el del engine (`{ tareas: [ { id, agente, prompt, dependencias } ] }`) y el que genera `/sdd.tareas` (`{ tareas: { T001: { estado, agente, depende_de, cubre_cas } } }`), normalizados en `core/tareas.js:4-10,49-67`. Los campos opcionales (`parte_de_codigo_existente`, `modelo`, `cubre_cas`) existen en código y no en un esquema.
- **Eventos.** `events.jsonl` con `{ id, type, ts, ...meta, payload }` (`core/event-log.js:56-68`); `EventType` es una unión escrita en JSDoc (`core/event-log.js:9`). Los eventos reales incluyen tipos como `ciclo:ejecucion` y `verificar:resultado` (`core/ciclo/nodos.js:542`, `core/verificar/registro.js:37`) que no están todos en esa unión (sin confirmar el alcance: spike S0.2). Los lectores ya toleran líneas corruptas (`core/event-log.js:80-92`).

Consecuencia: quien integre Fragua hoy depende de leer el código, y un cambio interno puede romperlo sin que ninguna prueba falle.

## 2. Objetivo

Publicar **esquemas JSON versionados** de cinco artefactos (tarea, estado del ciclo, veredicto, evento y resultado de `verificar`), con una **prueba que falla si el código se aparta del esquema**, una **política de compatibilidad** y una lista de **qué no se compromete**.

## 3. Usuarios y Actores

| Actor | Rol | Necesidad principal |
|---|---|---|
| Otra herramienta o agente | Consume el resultado o el registro | Una forma estable y comprobable |
| Integración continua | Lee el veredicto | Campos que no cambien de nombre sin aviso |
| Mantenedor | Cambia el código | Saber qué cambios rompen a terceros |
| Integrador (Spec Kit, OpenSpec, MCP) | Construye un puente | Un esquema contra el que validar |

## 4. Historias de Usuario

### HU-001: Esquemas publicados y versionados
**Como** integrador
**Quiero** esquemas JSON de tarea, estado, veredicto, evento y resultado de `verificar`
**Para** validar lo que recibo sin leer el código

**Criterios de aceptación:**
- [ ] **CA-001-01**: Existe un esquema (JSON Schema 2020-12, como los de `core/schemas/*.json`) por artefacto: `tarea`, `estado-ciclo`, `veredicto`, `evento`, `resultado-verificar`. (P1)
- [ ] **CA-001-02**: El esquema `resultado-verificar` parte del `formato: 1` actual de `core/verificar/resultado.js:54-77` y describe todos sus campos: `formato`, `veredicto`, `codigoSalida`, `motivo`, `codigoPruebas`, `comando`, `lenguaje`, `imagen`, `duracionMs`, `cortePorTiempo`, `cortePorMemoria`, `salida`, `avisos`, `mutacion`, `registro`. (P1)
- [ ] **CA-001-03**: El esquema `veredicto` define **un solo vocabulario** de veredicto de verificación (`pasa|falla|sin_pruebas|infraestructura`) y un mapa documentado hacia las categorías del ciclo (`pass|fail|timeout|infra_error`) y los resultados de tarea; no se renombra ningún valor existente. (P1)
- [ ] **CA-001-04**: El esquema `tarea` cubre ambas formas de entrada y la forma normalizada que usa el ciclo (`core/ciclo/estado.js:96-105`), con `parte_de_codigo_existente`, `cas`/`cubre_cas` y `criterioCmd` como opcionales. (P1)
- [ ] **CA-001-05**: El esquema `evento` define el sobre `{ id, type, ts, agent?, taskId?, pipelineStep?, payload, envelope? }` y **no** fija los campos de `payload` de cada tipo (ver «qué no se compromete»). (P1)
- [ ] **CA-001-06**: Cada esquema lleva `$id` con su versión y un campo de versión en el artefacto (`formato` en el resultado; `schemaVersion` en el estado). La unificación del estilo de versión se decide en la pregunta abierta 1. (P1)
- [ ] **CA-001-07**: Los esquemas se publican en `core/schemas/` y se exponen con un comando de solo lectura (`fragua esquema <nombre>` o equivalente) y en el paquete publicado. (P2)

### HU-002: Una prueba que falla si el código se aparta del esquema
**Como** mantenedor
**Quiero** que la suite falle si el código produce algo que el esquema no admite
**Para** no romper a terceros sin darme cuenta

**Criterios de aceptación:**
- [ ] **CA-002-01**: Hay un validador de JSON Schema **sin dependencias nuevas** (Principio IV) que comprueba tipos, `required`, `enum`, `const`, listas, objetos anidados y `additionalProperties`; el actual no lo hace (`core/schemas/index.js:41-76`). Admite solo el subconjunto de palabras clave que usan los esquemas, y rechaza un esquema que use otra. (P1)
- [ ] **CA-002-02**: Una prueba genera artefactos **reales** con el código (un resultado de `crearResultado` de cada veredicto, un `estadoInicial`, un evento de `EventLog.append`) y los valida contra su esquema. (P1)
- [ ] **CA-002-03**: Una prueba negativa muestra que el validador detecta un campo ausente, uno de tipo erróneo, un valor fuera del `enum` y uno adicional no admitido. (P1)
- [ ] **CA-002-04**: Una prueba verifica la **dirección inversa**: cada propiedad del esquema aparece en al menos un artefacto real o está marcada opcional; un campo declarado que el código ya no produce se detecta. (P1)
- [ ] **CA-002-05**: Una prueba compara el esquema con una **copia de referencia congelada** de la versión publicada anterior y falla si un cambio es incompatible según la política (HU-003) sin subir la versión. (P1)
- [ ] **CA-002-06**: Las pruebas corren sin Docker ni red y en Windows y Linux. (P1)

### HU-003: Política de compatibilidad y versionado
**Como** integrador
**Quiero** saber qué puede cambiar y con qué aviso
**Para** poder depender de Fragua

**Criterios de aceptación:**
- [ ] **CA-003-01**: Un documento (`docs/CONTRATO-PUBLICO.md`) define: qué cambios son **compatibles** (añadir un campo opcional, añadir un valor a un `enum` si el consumidor debe ignorar desconocidos, endurecer un `avisos`) y cuáles **rompen** (quitar o renombrar un campo, cambiar un tipo, cambiar el significado de un valor, hacer obligatorio un opcional). (P1)
- [ ] **CA-003-02**: Un cambio que rompe sube la versión mayor del artefacto y exige una nota en `CHANGELOG.md`; uno compatible sube la menor. (P1)
- [ ] **CA-003-03**: Cuando se sube la versión mayor, la versión anterior se **lee** durante al menos una versión menor del paquete: el lector acepta ambas, el escritor emite la nueva. Los artefactos ya guardados no se migran en disco. (P1)
- [ ] **CA-003-04**: Un consumidor debe **ignorar campos desconocidos**; el esquema lo declara con `additionalProperties: true` en las zonas de extensión y la documentación lo exige. (P1)
- [ ] **CA-003-05**: El contrato se refiere a la versión del artefacto, **no** a la del paquete (`package.json:3`, hoy `5.0.0`). (P1)
- [ ] **CA-003-06**: Un artefacto con una versión que el lector no conoce se rechaza con un mensaje claro que dice qué versiones entiende; nunca se interpreta «lo mejor posible» (misma regla que `core/ciclo/estado.js:153`). (P1)

### HU-004: Qué NO se compromete
**Como** mantenedor
**Quiero** una lista explícita de lo interno
**Para** poder cambiarlo sin romper el contrato

**Criterios de aceptación:**
- [ ] **CA-004-01**: La documentación enumera lo que **no** es contrato: texto de `motivo`, `avisos` y `salida`; los campos de `payload` de cada tipo de evento; el orden de las claves; los campos de `estado-ciclo` marcados internos (`contexto`, `plan`, `stdoutCola`, `stderrCola`, `implementador`, `turnos`; `core/ciclo/estado.js:68-81`); los nombres de archivos y carpetas de `.sdd/motor/`; los textos de los contratos de los agentes (`core/ciclo/contratos.js`). (P1)
- [ ] **CA-004-02**: En los esquemas, los campos internos llevan `x-interno: true` y la prueba exige que **todo campo del artefacto real esté en el esquema o marcado interno** (no hay campos «sin clasificar»). (P1)
- [ ] **CA-004-03**: Los códigos de salida del proceso (0, 1, 3, 4; `core/engine-cli.js:41`, `core/verificar/resultado.js:20`) sí forman parte del contrato y se documentan junto con los esquemas. (P1)

## 5. Escenarios de Uso

### Escenario 1: Integrador valida el resultado
Una herramienta ejecuta `forge verificar --json`, valida la salida contra `resultado-verificar` v1 y, si la versión es desconocida, la rechaza con el mensaje de HU-003.

### Escenario 2: El mantenedor añade un campo
Se añade `puertas` al resultado (ver `2026-10-14-puertas-de-calidad-y-evidencia`): es un campo opcional, versión menor; la prueba pasa y el diferencial con la copia congelada lo marca como compatible.

### Escenario 3: El mantenedor renombra un campo
Se renombra `codigoSalida`. La prueba contra la copia congelada falla hasta subir la mayor y anotarlo.

### Escenario 4: Un campo nuevo sin clasificar
Alguien añade `traza` al estado del ciclo y no lo declara. La prueba falla: «campo sin clasificar».

## 6. Requisitos Funcionales

| ID | Requisito | Prioridad |
|---|---|---|
| RF-01 | Cinco esquemas JSON en `core/schemas/` con `$id` versionado | P1 |
| RF-02 | Validador de JSON Schema de subconjunto, sin dependencias | P1 |
| RF-03 | Pruebas de contrato en ambos sentidos y contra copia congelada | P1 |
| RF-04 | `docs/CONTRATO-PUBLICO.md`: política, interno y códigos de salida | P1 |
| RF-05 | Mapa de vocabularios (verificar, ciclo, tarea) documentado | P1 |
| RF-06 | Exposición de los esquemas por comando y en el paquete | P2 |
| RF-07 | Los lectores comprueban la versión y rechazan lo desconocido con un mensaje | P1 |

## 7. Requisitos No Funcionales

| ID | Requisito |
|---|---|
| RNF-01 | Sin dependencias nuevas (Principio IV): el validador es propio y de subconjunto |
| RNF-02 | Los esquemas no cambian ningún comportamiento: describen lo que ya hay (con una excepción: RF-07) |
| RNF-03 | Windows y Linux |
| RNF-04 | Los esquemas no incluyen datos del proyecto ni secretos |

## 8. Fuera de Alcance (Exclusiones Explícitas)

- Cambiar nombres o valores existentes para «limpiar» vocabularios: solo se documenta el mapa.
- Migración en disco de artefactos antiguos.
- Esquema de los `payload` de cada tipo de evento (interno).
- Contrato de la interfaz MCP (`core/mcp/`): va en la especificación del ciclo por MCP.
- Esquemas del IR y del ADR: ya existen y no cambian aquí.
- Un servicio de registro de esquemas o publicación en un sitio web.
- Contrato del formato de `tareas.md` y de las especificaciones (es un documento, no un artefacto de máquina).

## 9. Dependencias y Asunciones

### Spikes obligatorios antes de construir
- **S0.1** Inventariar qué campos produce hoy cada artefacto en la práctica (no solo el `@typedef`): ejecutar el ciclo con el Docker falso y volcar un estado por cada categoría de resultado; listar diferencias con `core/ciclo/estado.js:61-82`.
- **S0.2** Inventariar los `type` reales de eventos (grep de `log.append(` y `appendFileSync` en `core/`) frente a la unión `EventType` (`core/event-log.js:9`), y qué consumidores los leen (`cli/status`, replay en `core/event-log.js:94-`).
- **S0.3** Decidir el subconjunto de JSON Schema que cubre los esquemas actuales (`core/schemas/*.json`) y comprobar si alguno usa palabras clave fuera de él.
- **S0.4** Averiguar quién consume `core/schemas` hoy (`cli/export.js`, `cli/import.js`; sin confirmar el uso exacto) para no romperlos al endurecer `validateArtefacto`.
- **S0.5** Confirmar la estructura de las salidas `--json` de otros comandos que el plan quiere exponer (`forge run`, `forge status`) y cuáles entran en el contrato.

### Dependencias
- `core/schemas/`, `core/ciclo/estado.js`, `core/verificar/resultado.js`, `core/tareas.js`, `core/event-log.js`.
- `.sdd/especificaciones/2026-10-14-puertas-de-calidad-y-evidencia`: añade campos al resultado y el informe; ambas se versionan juntas.
- Frente E: `ciclo-por-mcp` consumirá estos esquemas.

### Asunciones
- Un esquema de subconjunto con validador propio es suficiente: los artefactos son objetos planos o con poco anidamiento.
- Los consumidores externos que ya existan son pocos o ninguno (proyecto en beta, `PLAN-MAESTRO.md:62`), por lo que el coste de fijar el contrato ahora es bajo.

## 10. Capas de seguridad

| Riesgo | Control |
|---|---|
| El esquema acepta algo que luego se interpreta como orden | El contrato describe datos; el motor sigue sin interpretar texto libre; la salida de pruebas es `salida`, dato acotado |
| Un artefacto con campos inesperados pasa por «compatible» | `additionalProperties` explícito; los campos internos clasificados (CA-004-02) |
| Un lector acepta una versión desconocida y decide mal | Rechazo explícito (CA-003-06); falla cerrado |
| Secretos en el artefacto publicado | La redacción actual no cambia (`core/verificar/resultado.js:61-71`); el esquema no añade campos de texto sin tope |
| Un esquema demasiado estricto bloquea al propio motor en producción | Los lectores validan versión y forma mínima; la validación completa corre en las pruebas, no en cada ejecución (pregunta abierta 4) |
| El validador propio tiene un hueco y la prueba pasa en falso | Pruebas negativas (CA-002-03) y revisión independiente del validador |

## 11. Términos del Dominio

- **Contrato:** lo que un tercero puede suponer estable.
- **Interno:** lo que puede cambiar sin aviso.
- **Versión del artefacto:** la del esquema (`formato` o `schemaVersion`), distinta de la del paquete.
- **Copia congelada:** esquema de una versión ya publicada, guardado para comparar.

## 12. Preguntas Abiertas

| # | Pregunta | Recomendación |
|---|---|---|
| 1 | ¿Unificar el estilo de versión (`formato: 1` entero frente a `schemaVersion: "1.0"`)? | No renombrar: en cada artefacto se queda lo que hay y se documenta; en artefactos nuevos, `schemaVersion` con «mayor.menor». El resultado de `verificar` pasa a `formato: 2` solo cuando añada campos que lo exijan |
| 2 | ¿Unificar `pasa/falla` con `pass/fail`? | No: es renombrar. Documentar el mapa; el veredicto de verificación y la categoría de ejecución son conceptos distintos |
| 3 | ¿Se acepta un validador propio de subconjunto o se añade una dependencia? | Propio: Principio IV; es pequeño y está bajo prueba |
| 4 | ¿Se valida el artefacto en tiempo de ejecución? | Solo versión y forma mínima en los lectores; validación completa en la suite |
| 5 | ¿Qué salidas `--json` de comandos entran? | Solo `verificar` en esta entrega; `run` y `status` tras el spike S0.5 |
| 6 | ¿Cuántas versiones menores se lee la mayor anterior? | Al menos una; a decidir con el dueño al publicar la primera mayor |
| 7 | ¿Los esquemas existentes `ir`, `estado`, `adr` entran en la política? | Sí: ya se declaran contrato público; se anota su versión y se les aplica la misma política sin cambiarlos |
| 8 | ¿Nombre del comando para ver esquemas? | `esquema` (en español, coherente con el resto) |

## 13. Criterios de Éxito Medibles

- Los cinco esquemas validan artefactos reales generados por el código en todos los casos de la batería.
- Un campo añadido, renombrado o quitado sin tocar el esquema hace fallar la suite en el 100 % de los casos de la batería negativa.
- Un tercero puede validar un `resultado-verificar` solo con el esquema publicado y el validador de su elección (probado con el validador propio y, opcionalmente, uno externo en una prueba que no entra en la suite).
- Ningún valor de `veredicto` ni nombre de campo existente cambia.

## 14. Referencias

- `PLAN-MAESTRO.md` (frente E, oleada 4).
- `core/schemas/index.js`, `core/schemas/*.json` (contrato existente y su validador mínimo).
- `core/verificar/resultado.js`, `core/ciclo/estado.js`, `core/tareas.js`, `core/event-log.js`.
- `.sdd/especificaciones/2026-10-13-verificar-sin-modelo/` (origen de `formato: 1`; CA-002-05 pedía el campo de versión).
- JSON Schema 2020-12 (usado por `core/schemas/*.json`).

## 15. Historial de Aclaraciones

- 2026-10-14: creada en borrador a partir del frente E del plan maestro y de la lectura de los artefactos actuales.
