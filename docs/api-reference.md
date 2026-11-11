# Referencia de interfaces

> Tipo: Referencia
> Última revisión: 2026-11-10 contra el commit 55a9dd9

Qué expone Fragua para que otro programa o persona lo use, con qué garantía de estabilidad, y qué es interno. Si buscas los subcomandos de la CLI, están en [referencia-cli.md](referencia-cli.md).

## Qué es público y qué no

El paquete **no declara `main` ni `exports`** en `package.json`: no ofrece una API de JavaScript soportada. Lo único que declara es el ejecutable (`fragua`, `forge`, `sdd-es`). La regla del repositorio ([AGENTS.md](../AGENTS.md)) define la interfaz pública como **los comandos y el formato de `.sdd/`**: cambiarlos sin una versión mayor está prohibido.

| Superficie | Estabilidad | Documento |
|---|---|---|
| Subcomandos de la CLI, opciones y códigos de salida | Pública | [referencia-cli.md](referencia-cli.md) |
| Formatos de archivo con esquema versionado | Pública, con política de compatibilidad | [contrato/LEEME.md](contrato/LEEME.md) |
| Servidor MCP | Pública, perfiles de herramientas | [servidor-mcp.md](servidor-mcp.md), [mcp-verificar.md](mcp-verificar.md) |
| API HTTP local del ciclo | Pública, apagada por defecto | [api-http.md](api-http.md) |
| Servidor del panel (`fragua ui`) | **Sin contrato**: lo usa el propio panel | Esta página, más abajo |
| Archivos de registro `consumo.jsonl` y `mutaciones.jsonl` | **Sin contrato** | Esta página, más abajo |
| Módulos de `core/`, `cli/` y `claude-hooks/` | **Internos**: pueden cambiar en cualquier versión | [mapa-de-modulos.md](mapa-de-modulos.md) |

Importar un módulo con una ruta profunda (por ejemplo `fragua/core/project-memory.js`) funciona porque no hay `exports` que lo impida, pero **no está soportado**.

## Contratos versionados

`fragua esquema` lista los esquemas (solo lectura) y `fragua esquema <nombre>` imprime uno. Los esquemas y su política (qué cambio sube la versión menor y cuál la mayor, qué campos son internos) están en [contrato/LEEME.md](contrato/LEEME.md).

| Esquema | Describe |
|---|---|
| `resultado-verificar` | Salida de `fragua verificar --json` |
| `veredicto` | Vocabulario del veredicto y su mapa a otros vocabularios |
| `estado-ciclo` | Estado de una tarea del ciclo verificado |
| `estado-pipeline` | `.sdd/estado.json` |
| `tarea`, `tarea-entrada`, `tarea-sdd` | Los tres formatos de tarea |
| `evento` | Una línea de `events.jsonl` |

Una prueba (`tests/contrato-publico.test.js`) genera artefactos reales con el código y los valida contra estos esquemas; si el código y el esquema se separan, la suite falla.

## Códigos de salida

Los de `verificar` y `run` son contrato (tabla en [contrato/LEEME.md](contrato/LEEME.md)). El resto de órdenes: [referencia-cli.md](referencia-cli.md#códigos-de-salida).

## Servidor del panel

`fragua ui` arranca un servidor HTTP local (código en `ui/server.js`). **No es una API para terceros**: no tiene versión ni garantía, y puede cambiar con el panel.

| Ruta | Devuelve |
|---|---|
| `GET /` y `GET /assets/*`, `/src/*` | El panel y sus archivos estáticos |
| `GET /estado` | `.sdd/estado.json` |
| `GET /tareas` | `.sdd/estado-tareas.json`, o vacío si no existe |
| `GET /verificar` | `.sdd/verificacion.json`, o vacío |
| `GET /consumo` | Las últimas 50 líneas de `consumo.jsonl` |
| `GET /actividad` | Las últimas 50 entradas de `consumo.jsonl` en formato legible |
| `GET /eventlog` | Las últimas 50 entradas de `.sdd/events.jsonl` |
| `GET /agentes` | Agentes activos en los últimos 60 segundos |
| `GET /agente/:nombre` | Cabecera, memoria y actividad reciente de un agente |
| `GET /events` | Flujo de eventos del servidor (SSE) |

Seguridad, según la cabecera del código: escucha solo en `127.0.0.1`, valida la cabecera `Host`, rechaza peticiones con otro `Origin`, no abre CORS, valida el recorrido de rutas en los estáticos y se cierra solo tras 30 minutos sin peticiones. No tiene autenticación.

## Archivos de registro

### `.sdd/observabilidad/consumo.jsonl`

Lo escribe el hook `agent-memory.js` en cada escritura de un agente. **No mide el consumo real de tokens**: registra los bytes escritos y estima los tokens como bytes entre 3,5. Para el gasto real del ciclo verificado, ver `gasto.jsonl` en `.sdd/motor/<sesión>/` ([ciclo-verificado.md](ciclo-verificado.md)).

| Campo | Contenido |
|---|---|
| `ts` | Fecha ISO |
| `agente` | Nombre del agente, o `main` |
| `tool` | Herramienta usada (`Write`, `Edit`…) |
| `archivo` | Archivo modificado |
| `bytes` | Bytes del contenido escrito |
| `tokens_est` | `ceil(bytes / 3.5)`, una estimación |
| `provider`, `effort_level` | Proveedor y nivel resueltos para ese agente |

Rota al superar un tamaño configurable, conservando tres copias anteriores. `fragua logs` lo lee.

### `.sdd/observabilidad/mutaciones.jsonl`

Un registro por archivo modificado por un agente: `ts`, `agente`, `archivo`, `tool` y `tipo` (`partial` si fue `Edit`, `full` en otro caso). **No tiene relación** con la medición de pruebas por mutación del ciclo verificado.

## Módulos internos que se usan a menudo

Se documentan porque aparecen en el código y en los hooks, **no porque sean API**.

### `ProjectMemory` (`core/project-memory.js`)

Lee y escribe `.sdd/estado.json` de forma atómica (archivo temporal y `rename`). `SCHEMA_VERSION` es `"1.0"`.

| Método | Qué hace |
|---|---|
| `new ProjectMemory(cwd?)` | Apunta a `<cwd>/.sdd/` (por defecto, el directorio actual) |
| `read()` | Devuelve el estado, con caché por fecha y tamaño. Si el archivo no existe **o no es JSON válido, devuelve `{}`** sin avisar |
| `update(campos)` | Mezcla los campos, fija `schemaVersion` y `ultima_actualizacion`, y escribe |
| `validate()` | `{ valid, errors }`: solo comprueba que sea un objeto JSON y que `schemaVersion` sea `"1.0"` |
| `migrate()` | Añade `schemaVersion` si falta |
| `saveIR(ir)`, `loadIR()` | Guarda y lee `.sdd/ir.json` y marca `ir_generado` |
| `saveProductDesign(pd)`, `loadProductDesign()` | Lo mismo con `.sdd/product-design.json` |
| `setPipelineStep(paso, force = false)` | Cambia `pipeline_step`. Sin `force`, comprueba que la transición sea la siguiente de una tabla fija y lanza un error si no |
| `getActiveDesignSystem()` | Ruta del sistema de diseño activo, o `design-systems/neutral-modern/DESIGN.md` |
| `summary()` | Resumen de texto del estado |

**Límite importante.** `update()` y `setPipelineStep()` **no comprueban aprobaciones**: se puede escribir `spec_aprobado: true` o avanzar de `spec` a `plan` sin que nadie haya aprobado nada. La puerta de aprobación vive en `PipelineStateMachine.advance()` (`core/state-machine.js`), que usa `fragua step`, y exige el registro firmado de `fragua aprobar spec`. Quien escriba `estado.json` por otro camino se salta esa puerta: es el límite que declara [GARANTIAS-Y-LIMITES.md](GARANTIAS-Y-LIMITES.md).

### Tipos

Los tipos están en comentarios JSDoc (`ForgeEstado` en `core/project-memory.js`; `IR`, `ProductDesign` y otros en `core/ir.types.js`) y los comprueba `npm run typecheck`. **No se distribuyen archivos `.d.ts`.** El tipo `ForgeEstado` está incompleto respecto al archivo real (por ejemplo no declara `spec_aprobado`); la forma de referencia de `estado.json` es el esquema `estado-pipeline`, no el tipo.

## Variables de entorno

Todas, con su valor por defecto y quién manda sobre quién: [referencia-cli.md](referencia-cli.md#variables-de-entorno).

## Scripts de npm

Los que define `package.json`: `test`, `test:rapido`, `test:lento`, `test:cuarentena`, `test:verbose`, `coverage`, `test:cobertura`, `typecheck`, `doctor`, `generar-skills`, `init` y `build` (ambos son un `echo`: no hay compilación), y `prepublishOnly`. Para qué sirve cada uno de pruebas: [CONTRIBUTING.md](../CONTRIBUTING.md).
