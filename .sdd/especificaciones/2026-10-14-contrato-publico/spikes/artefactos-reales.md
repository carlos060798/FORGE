# Spike S0.1: artefactos reales frente a los `@typedef`

> Experimento ejecutado (2026-10-17): script fuera del repositorio que importa `core/ciclo/estado.js` y `core/verificar/{resultado,mutacion}.js` y vuelca las formas reales. Sin Docker, así que **no se volcó el estado tras cada categoría de ejecución** (necesita el ciclo con un runner falso; ver «Sin confirmar»).

## Estado del ciclo (`core/ciclo/estado.js`)

- `estadoInicial` produce las claves: `schemaVersion, runId, threadId, taskId, cwd, tarea, plan, contexto, pruebas, implementacion, rojo, mutacion, ejecuciones, iteracion, maxIteraciones, presupuesto, revision, resultado` (volcado real). El `@typedef` (`estado.js:61-82`) las lista todas, más los opcionales `implementador` y `turnos` (solo con el modo por turnos), que no están en el estado inicial: son los «opcionales» del esquema.
- `tarea` real: `{ id, descripcion, agente, archivos, cas }`, normalizada: la entrada `cubre_cas` pasa a `cas` y `prompt` a `descripcion`. `criterioCmd` y `parte_de_codigo_existente` solo aparecen si se dan.
- `validarEstado(e)` sobre un estado inicial devuelve `[]` (válido). Ya es un validador estructural; el esquema nuevo debe **coincidir** con él y no divergir (hoy comprueba, p. ej., `umbral_degradacion_usd <= tope_usd`, `estado.js:189-192`, que JSON Schema no puede expresar → va como «regla adicional», fuera del esquema).
- Vocabularios (exportados): `CATEGORIAS` = `pass|fail|timeout|infra_error`; `MOTIVOS` = `iteraciones|presupuesto|infraestructura|dependencias|salida_invalida|exito_sospechoso|sin_progreso|pruebas_no_fallan|pruebas_debiles`; `ESTADOS_ROJO` = `fallan|pasan|exenta|sin_comprobar`; `RESULTADOS` = `en_curso|exito|revision_pendiente|aceptada_por_humano|abortada`; `ESTADOS_GASTO` = `ok|degradado|agotado`.
- `SCHEMA_VERSION = '1.0'` (`estado.js:5`) **es la misma cadena** que `SCHEMA_VERSION` de `core/schemas/index.js:14` para artefactos distintos (IR/estado del pipeline/ADR). Dos contadores de versión con el mismo valor sin relación: confusión segura al hablar de «versión 1.0». Hay que nombrarlas por artefacto (`estado-ciclo/1`, `ir/1`…).

## Resultado de `verificar` (`core/verificar/resultado.js`)

- Claves reales de `crearResultado` (idénticas para los cuatro veredictos, volcado real): `formato, veredicto, codigoSalida, motivo, codigoPruebas, comando, lenguaje, imagen, duracionMs, cortePorTiempo, cortePorMemoria, salida, avisos, mutacion, registro`. `codigoSalida`: pasa 0, falla 1, sin_pruebas 1, infraestructura 4.
- `formato` es **entero** (`1`), mientras el estado usa `schemaVersion` **cadena** `'1.0'`: dos estilos de versión en el mismo producto.
- `registro` siempre es `null` en `crearResultado` (`resultado.js:75`) y `verificar()` lo reemplaza por `{id,archivo}` o `{error}` (`verificar/index.js:92`); además `registro.js:25-26` escribe `{ id, ...resultado }`: **el archivo guardado lleva un `id` que el objeto de `--json` no lleva** (solo lo tiene si hubo `--registrar`, dentro de `registro`). El esquema debe prever las dos variantes (`id` opcional en el nivel raíz del registro).
- `mutacion` (objeto de `juzgarMedicion`, volcado real con `omitida`): `solicitada, archivos, probadas, detectadas, concluyentes, descartadas, puntuacion, puntuacionBruta, concluyente, veredicto, minima, minConcluyentes, motivos, parcial, motivoParcial, sinCobertura, lineaBase, infraestructura, candidatas, fueraDeLoCambiado, rechazadas, sobrevivientes, copiaSinBorrar, aviso`. `veredicto` ∈ `medida|cumple_el_minimo|bajo_el_minimo|no_concluyente`. Muchos son internos (`candidatas`, `descartadas`, `puntuacionBruta`, `lineaBase`…): candidatos a `x-interno`.
- Tres vocabularios para «cómo salió»: veredicto de verificar (`pasa|falla|sin_pruebas|infraestructura`), categoría del ciclo (`pass|fail|timeout|infra_error`), resultado del ciclo (`exito|revision_pendiente|…`). El mapa debe documentarse; no se unifican (se rompería a los consumidores).

## Qué cambia en la spec o el plan

- Esquema `estado-ciclo`: opcionales `implementador`, `turnos`, `rojo`, `mutacion`, `plan` (nulos permitidos: `type:["object","null"]`); `tarea.criterioCmd`, `tarea.parte_de_codigo_existente` opcionales.
- Esquema `resultado-verificar`: `registro` ∈ null | `{id,archivo}` | `{error}`; `mutacion` ∈ null | objeto con campos públicos y `x-interno`.
- Reglas de coherencia que el esquema no puede expresar (umbral ≤ tope; `codigoSalida` consistente con `veredicto`) → lista «reglas adicionales» probadas por código, no por esquema.
- Versionado: elegir UN estilo (propuesta: entero `formato` en artefactos nuevos; mantener `schemaVersion: '1.0'` del estado tal como está por compatibilidad y documentarlo).

## Sin confirmar

- Volcar `ejecuciones[]` tras cada categoría y `revision` poblada requiere el ciclo con Docker falso (hay uno en las pruebas del ciclo; no se ejecutó la suite). Las formas de `Ejecucion`/`revision` salen del `@typedef` (`estado.js:11-20,70`) y de `validarEstado`, no del volcado.
