# Contrato público de Fragua

Esta carpeta publica la forma **estable** de lo que Fragua entrega a otras herramientas, como esquemas JSON y una política de compatibilidad. Spec: `.sdd/especificaciones/2026-10-14-contrato-publico/`.

## Qué esquemas hay

| Archivo | Describe | Versión del artefacto |
|---|---|---|
| `resultado-verificar.schema.json` | Salida de `fragua verificar --json` y el archivo de `--registrar` | campo `formato` (entero `1`) |
| `veredicto.schema.json` | Vocabulario del veredicto de verificación y su mapa a otros vocabularios | `$id` |
| `estado-ciclo.schema.json` | Estado de una tarea del ciclo verificado (puntos de guardado) | campo `schemaVersion` (`"1.0"`) |
| `estado-pipeline.schema.json` | `.sdd/estado.json` real del proyecto | `schemaVersion` opcional (`"1.0"`) |
| `tarea.schema.json` | Tarea normalizada (campo `tarea` del estado del ciclo) | `$id` |
| `tarea-entrada.schema.json` | Tarea de entrada del engine (`{ tareas: [...] }`) | `$id` |
| `tarea-sdd.schema.json` | `.estado-tareas.json` que genera `/sdd.tareas` (`{ tareas: { T001: ... } }`) | `$id` |
| `evento.schema.json` | Una línea de `events.jsonl` (el sobre) | `$id` |
| `tipos-evento.json` | Los tipos de evento, cuáles son contrato y en qué archivo viven | — |

La versión de un esquema es la de su `$id` (`.../contrato/<nombre>/<mayor>.<menor>`). **No** es la del paquete (`package.json`). Hay dos estilos de versión dentro de los artefactos (`formato: 1` entero en el resultado; `schemaVersion: "1.0"` texto en el estado). No se unifican: renombrarlos rompería a los consumidores. Los artefactos nuevos usarán `schemaVersion` con «mayor.menor».

Los esquemas usan un **subconjunto** de JSON Schema: `type`, `properties`, `required`, `additionalProperties`, `items`, `enum`, `const`, `minimum`, `maximum`, `minLength`, `maxLength`, `minItems`, `maxItems`, `pattern`, más anotaciones (`$schema`, `$id`, `title`, `description`, `default`, `format`, `x-*`). `format` es solo anotación: **no se valida** (`date-time` incluido). El validador propio (`core/contrato/validar.js`, sin dependencias) lanza ante cualquier otra palabra clave. Cualquier validador estándar de JSON Schema 2020-12 también sirve.

`x-interno: true` marca un campo que **no** es contrato.

## Política de compatibilidad

**Un consumidor debe ignorar los campos que no conoce** y los valores nuevos de listas cerradas que no use para decidir.

Cambios **compatibles** (suben la versión *menor*): añadir un campo opcional; añadir un valor a un `enum` de un campo que el consumidor ya debe tratar como abierto; endurecer o ampliar el texto de `avisos`; marcar como interno algo antes no documentado.

Cambios que **rompen** (suben la versión *mayor* y exigen una nota en `CHANGELOG.md`): quitar o renombrar un campo; cambiar un tipo; cambiar el significado de un valor; hacer obligatorio un campo opcional; quitar un valor de un `enum`.

Reglas:

- Cuando se sube la mayor, el lector acepta **la anterior y la nueva** durante al menos una versión menor del paquete; el escritor emite la nueva. Los artefactos ya guardados no se migran en disco.
- Un artefacto con una versión que el lector no conoce se **rechaza** con un mensaje que dice qué versiones entiende; nunca se interpreta «lo mejor posible» (`core/ciclo/estado.js`, `validarEstado`).
- Un esquema ya publicado no cambia sin subir su `$id`: `tests/fixtures/contrato/v1/` guarda la copia congelada y la suite falla si el esquema vigente difiere de ella con el mismo `$id`. Al subir la versión se congela la nueva en una carpeta nueva (`v2/`, ...).
- La suite (`tests/contrato-publico.test.js`) genera artefactos reales con el código y los valida; y comprueba la inversa: toda propiedad opcional declarada la produce alguna muestra real. Un campo nuevo sin declarar, uno quitado o uno renombrado hacen fallar la suite.

## Qué NO se compromete (interno)

- El texto de `motivo`, `avisos` y `salida` de `verificar`; los campos marcados `x-interno` en los esquemas (en `resultado-verificar`: casi todo el detalle de `mutacion` salvo `solicitada`, `archivos`, `probadas`, `detectadas`, `concluyentes`, `puntuacion`, `concluyente`, `veredicto`, `minima`, `sobrevivientes`).
- Del estado del ciclo: `plan`, `contexto`, `implementador`, `turnos`, `stdoutCola`, `stderrCola`, `sospecha`, `huellaSalida`, `descripcion` de la tarea y el detalle de la revisión.
- El `payload` de cada evento (salvo los campos que `tipos-evento.json` lista para un tipo con `contrato: true`) y todos los tipos `ciclo:*`, `integracion:*`, `agent_*`, `runner_*` (internos).
- El orden de las claves, los nombres de archivos y carpetas de `.sdd/motor/`, los textos de los contratos de los agentes.
- **Las salidas de texto** de cualquier orden (colores, tablas). `fragua run` y `fragua status` **no tienen `--json`**: no hay salida estructurada que congelar.
- El campo `id` de un evento: no es único entre procesos.

## Códigos de salida (sí son contrato)

| Orden | Código | Significado |
|---|---|---|
| `fragua verificar` | 0 | `pasa` |
| | 1 | `falla`, `sin_pruebas` o uso incorrecto |
| | 4 | `infraestructura`: no hay aislamiento; no se ejecutó nada en tu equipo |
| `fragua run` | 0 / 1 / 3 / 4 | ok / fallo / revisión pendiente / sin aislamiento (`core/engine-cli.js`, `SALIDA`) |

`codigoSalida` del resultado coincide con el código del proceso.

## Mapa de vocabularios (no se renombra ninguno)

| Concepto | Valores | Dónde |
|---|---|---|
| Veredicto de verificación | `pasa`, `falla`, `sin_pruebas`, `infraestructura` | `resultado-verificar.veredicto` |
| Categoría de una ejecución | `pass`, `fail`, `timeout`, `infra_error` | `estado-ciclo.ejecuciones[].categoria` |
| Resultado de la tarea | `en_curso`, `exito`, `revision_pendiente`, `aceptada_por_humano`, `abortada` | `estado-ciclo.resultado` |
| Motivo de revisión | `iteraciones`, `presupuesto`, `infraestructura`, `dependencias`, `salida_invalida`, `exito_sospechoso`, `sin_progreso`, `pruebas_no_fallan`, `pruebas_debiles` | `estado-ciclo.revision.motivo` |
| Veredicto de la medición por mutación | `medida`, `cumple_el_minimo`, `bajo_el_minimo`, `no_concluyente` | `resultado-verificar.mutacion.veredicto` |

Aproximación categoría → veredicto: `pass`→`pasa`, `fail`/`timeout`→`falla`, `infra_error`→`infraestructura`. `sin_pruebas` no tiene categoría propia en el ciclo. La categoría describe **una ejecución**; el resultado, **la tarea entera**; el veredicto, **una verificación**: son conceptos distintos. El mapa legible por máquina está en `veredicto.schema.json` (`x-mapa`) y una prueba lo contrasta con el código.

## Eventos: dos archivos y tipos declarados

Hay **dos** archivos `events.jsonl` con el mismo sobre:

- `.sdd/events.jsonl`: `run`, `resume`, la API HTTP, las integraciones y `verificar --registrar`.
- `.sdd/observabilidad/events.jsonl`: `status`, `step`, `state` (`cli/runner.js`).

`pipeline_step_changed` puede estar en cualquiera (la API HTTP escribe en el principal). Los lectores toleran líneas corruptas y tipos desconocidos. `tipos-evento.json` declara cada tipo con `contrato: true|false`. Estaban emitidos y sin declarar en el tipo `EventType` de `core/event-log.js`, y ahora lo están: `ciclo:llamada_huerfana`, `ciclo:consumo_estimado` y `verificar:resultado` (este último lo escribe `core/verificar/registro.js` a mano, con `id` `<ms>-<pid>`). Una prueba exige que todo tipo que el código emite esté en `tipos-evento.json` y en el tipo.

## `estado-pipeline` frente a `core/schemas/estado.schema.json`

El esquema antiguo exige `schemaVersion`; el `.sdd/estado.json` real **no lo tiene** y trae claves que el esquema antiguo no conoce, así que el propio estado del proyecto no lo cumple (nadie lo valida hoy). Decisión con evidencia: **no se toca** el esquema antiguo (su `$id` está publicado) y el contrato describe el archivo real en `estado-pipeline` (`schemaVersion` opcional, sin obligatorios, claves desconocidas admitidas). Una prueba valida el `.sdd/estado.json` del repositorio contra él.

## Pendiente

- `fragua run --json` y `fragua status --json` no existen; añadirlos es una función nueva con su propia especificación.
- Comando de solo lectura `fragua esquema <nombre>` (CA-001-07, P2). Los esquemas ya van en el paquete (`docs/`).
- Que `validateArtefacto` y `validarArgumentos` del MCP deleguen en `core/contrato/validar.js` (se deja a otros frentes: tocan `core/mcp/`).
- Lectores con rechazo explícito de versión desconocida para el resultado y los eventos (hoy solo lo hace el estado del ciclo).
