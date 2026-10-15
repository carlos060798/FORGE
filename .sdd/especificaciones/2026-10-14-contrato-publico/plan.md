# Plan de implementación: contrato público

> Spec: `spec.md` · Estado: **borrador, sin aprobar** · Redactado por un agente por encargo del dueño; no se implementa hasta que la apruebe (Principio II) · Decisiones existentes: ADR-05 (enrutador determinista), `formato: 1` de `core/verificar/resultado.js:12`

## 1. Suposiciones tomadas (corregibles)

| # | Pregunta de la spec | Suposición del plan | Qué cambia si se invierte |
|---|---|---|---|
| 1 | Estilo de versión | Se respeta cada uno; artefactos nuevos con `schemaVersion` | Un campo más por artefacto |
| 2 | Vocabularios | No se renombra; se documenta el mapa | Migración y cambio mayor |
| 3 | Validador | Propio, de subconjunto | Dependencia nueva (Principio IV) |
| 4 | Validación en ejecución | Versión y forma mínima | Más coste y riesgo de bloquear |
| 5 | Alcance de `--json` | Solo `verificar` | Más esquemas |

## 2. Principios del diseño

- **Describir, no cambiar:** los esquemas recogen lo que el código produce. Ningún campo ni valor se renombra.
- **Doble sentido:** el código no puede apartarse del esquema, y el esquema no puede prometer lo que el código no produce.
- **Todo clasificado:** cada campo es contrato o interno, nunca «sin decidir».
- **Falla cerrado ante versión desconocida.**
- **Mínimo:** un validador pequeño que entiende solo lo que los esquemas usan.

## 3. Módulos

| Módulo | Responsabilidad |
|---|---|
| `core/schemas/tarea.schema.json` (nuevo) | Tarea de entrada (dos formas) y normalizada |
| `core/schemas/estado-ciclo.schema.json` (nuevo) | `EstadoCiclo` (`core/ciclo/estado.js:61-82`), con `x-interno` |
| `core/schemas/veredicto.schema.json` (nuevo) | Veredicto de verificación y mapa a categorías |
| `core/schemas/evento.schema.json` (nuevo) | Sobre del evento, sin fijar `payload` |
| `core/schemas/resultado-verificar.schema.json` (nuevo) | Resultado de `verificar`, `formato: 1` |
| `core/schemas/validador.js` (nuevo) | Subconjunto de JSON Schema: tipos, `required`, `enum`, `const`, `items`, `properties`, `additionalProperties`, `oneOf` simple |
| `core/schemas/index.js` (cambio) | Registra los esquemas nuevos y usa el validador; mantiene `validateArtefacto` para `ir`, `estado`, `adr` mientras haya consumidores (spike S0.4) |
| `tests/contrato-publico.test.js` (nuevo) | Pruebas de contrato en ambos sentidos |
| `tests/fixtures/contrato/v1/` (nuevo) | Copia congelada de los esquemas publicados |
| `docs/CONTRATO-PUBLICO.md` (nuevo) | Política, interno, códigos de salida, mapa de vocabularios |
| `cli/index.js` (cambio, P2) | Comando `esquema` de solo lectura |

## 4. Flujo

1. **Spike:** volcar artefactos reales de cada tipo y comparar con los `@typedef`.
2. Escribir los esquemas a partir de lo observado; marcar interno lo que no se quiera comprometer.
3. Escribir el validador con pruebas negativas.
4. Pruebas de contrato: generar artefactos con el código, validar, y comprobar la inversa.
5. Congelar la v1 en `tests/fixtures/contrato/v1/`; la prueba compara el esquema vigente con la copia y clasifica el cambio.
6. Documentar la política y los límites.
7. Lectores: rechazo claro de versión desconocida.

## 5. Datos

- Versión: `$id` con `…/schemas/<nombre>/<mayor>.<menor>` (como los existentes, `core/schemas/estado.schema.json`).
- Marca de interno: palabra clave `x-interno: true`; el validador la ignora pero la prueba de clasificación la lee.
- Mapa de vocabularios (sujeto a spike):

| Concepto | Valores | Dónde |
|---|---|---|
| Veredicto de verificación | `pasa`, `falla`, `sin_pruebas`, `infraestructura` | `core/verificar/resultado.js:17` |
| Categoría de ejecución | `pass`, `fail`, `timeout`, `infra_error` | `core/ciclo/estado.js:7` |
| Resultado de tarea | `en_curso`, `exito`, `revision_pendiente`, `aceptada_por_humano`, `abortada` | `core/ciclo/estado.js:10` |
| Motivo de revisión | `iteraciones`, `presupuesto`, `infraestructura`, ... | `core/ciclo/estado.js:8` |

- Códigos de salida: 0, 1, 3, 4 (`core/engine-cli.js:41`); `verificar` usa 0, 1, 4 (`core/verificar/resultado.js:20`).

## 6. Fases

| Fase | Contenido | Sale con |
|---|---|---|
| S0 | Inventario de campos y eventos reales; subconjunto de JSON Schema; consumidores | `spikes/` |
| F1 | Validador de subconjunto con pruebas negativas | CA-002-01, CA-002-03 |
| F2 | Esquema `resultado-verificar` y su prueba (es el de mayor uso) | CA-001-02, CA-002-02 |
| F3 | `veredicto`, `tarea`, `estado-ciclo` | CA-001-03, CA-001-04 |
| F4 | `evento` y política de `payload` | CA-001-05 |
| F5 | Dirección inversa y clasificación de internos | CA-002-04, CA-004-02 |
| F6 | Copia congelada y diferencial de compatibilidad | CA-002-05 |
| F7 | Documentación y comando `esquema` | HU-003, HU-004 |
| F8 | Revisión independiente | Cierre |

## 7. Pruebas

- Validador: cada palabra clave soportada, un esquema con palabra clave no soportada se rechaza, anidamiento de tres niveles.
- Artefactos reales: un `crearResultado` por veredicto y con y sin mutación; `estadoInicial` y un estado tras cada categoría; eventos de `EventLog.append` de cada tipo conocido.
- Negativas: campo ausente, tipo erróneo, valor fuera del `enum`, campo adicional, versión desconocida.
- Inversa: propiedad del esquema que ningún artefacto real produce y no es opcional.
- Compatibilidad: a una copia del esquema se le añade un campo opcional (permitido), se le quita un campo (rompe) y se le cambia un tipo (rompe).
- Sin Docker ni red.

## 8. Riesgos del plan

| Riesgo | Señal | Respuesta |
|---|---|---|
| El estado real difiere del `@typedef` | Spike S0.1 | El esquema describe lo real; la diferencia se anota como hallazgo, no se «arregla» aquí |
| Los eventos reales no están en `EventType` | Spike S0.2 | El sobre es estable; los tipos y sus `payload` son internos |
| Endurecer `validateArtefacto` rompe `export`/`import` | Spike S0.4 | Mantener el actual para los tres esquemas viejos y usar el nuevo solo para los nuevos |
| El contrato congela algo que se quería cambiar (p. ej. vocabularios) | Revisión del dueño | Marcar interno lo dudoso; todo lo que no esté seguro empieza como interno |
| Dos estilos de versión confunden a los integradores | Pregunta abierta 1 | Documentarlo en el contrato y no mezclarlo en un mismo artefacto |
| Un validador propio con un hueco da falsa confianza | Revisión | Pruebas negativas, revisión independiente y, opcional, contraste con un validador externo fuera de la suite |
| Solapamiento con `puertas-de-calidad-y-evidencia` al añadir campos | Orden de entrega | Esa especificación declara sus campos como opcionales y este contrato los incorpora en versión menor |

## 9. Revisión

Es de riesgo bajo para el aislamiento, pero **fija una promesa pública**: necesita revisión independiente de (1) la lista de lo comprometido y lo interno, (2) el validador de subconjunto, (3) que ningún valor existente cambie, y (4) la política de compatibilidad. No toca contenedor, red ni credenciales.
