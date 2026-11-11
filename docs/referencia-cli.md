# Referencia de la CLI

> Tipo: Referencia
> Última revisión: 2026-11-10 contra el commit 7683f83

Referencia de la línea de comandos de Fragua. La fuente de verdad es el despacho de `cli/index.js` y el código de cada comando (`cli/comandos/*.js`, `cli/*.js`, `core/engine-cli.js`); lo que imprime `fragua help` es un resumen y no lista todos los subcomandos. Estado del proyecto (pre-beta, `5.0.0-beta.1` sin publicar): [ESTADO-ACTUAL.md](ESTADO-ACTUAL.md).

## Órdenes y nombres

El paquete (`package.json`, `bin`) instala tres órdenes que apuntan al mismo archivo, `cli/index.js`:

| Orden | Estado |
|---|---|
| `fragua` | nombre actual |
| `forge` | nombre antiguo, sigue funcionando |
| `sdd-es` | nombre antiguo, sigue funcionando |

La ayuda y los mensajes usan el nombre con el que se invocó el programa (`cli/index.js`, `ordenInvocada`). Si se ejecuta como `node cli/index.js`, se usa `fragua`. En esta referencia se escribe `fragua`; sustitúyelo por `forge` o `sdd-es` si prefieres.

```text
fragua <subcomando> [opciones]
```

## Convenciones

- Los subcomandos se despachan con un `switch` en `cli/index.js`. Cada uno tiene su propio analizador de argumentos: **no todos aceptan `--opcion=valor` y `--opcion valor`**. Se indica en cada caso.
- Una orden sin argumentos, `help`, `ayuda`, `--help` y `-h` muestran la ayuda y salen con 0.
- Un subcomando desconocido imprime `Comando desconocido: '<x>'. Usa '<orden> --help'.` y sale con 1.
- Los subcomandos marcados «no está en la ayuda» existen en el despacho de `cli/index.js` pero `fragua help` no los lista.

## Códigos de salida

No hay una tabla única: cada subcomando fija los suyos. Los de `run`, `resume` y `verificar` comparten estos valores (`SALIDA` en `core/engine-cli.js`; `CODIGOS` en `core/verificar/resultado.js`):

| Código | Significado |
|---|---|
| 0 | completado / pasa |
| 1 | fallo (también uso incorrecto en la mayoría de subcomandos) |
| 2 | uso incorrecto o no ejecutado, solo en `integraciones`, `mantenimiento` y `probar-modelo` (ver cada uno) |
| 3 | revisión humana pendiente (`run`, `resume`) |
| 4 | aislamiento no disponible (Docker ausente, parado o sin el mecanismo `sandbox.runtime` pedido) (`run`, `resume`, `verificar`) |

El código 5 **no** es un código de salida de Fragua. Es el que devuelve `pytest` cuando no encuentra ninguna prueba; el ciclo verificado lo interpreta como «sin pruebas» (`core/ciclo/router.js`, `core/verificar/index.js`) y no se propaga como código del proceso.

Salvo lo indicado, un subcomando que termina sin error sale con 0, incluso si lo que diagnostica es un problema (`doctor`, `config validate`).

## Variables de entorno

### Prefijos `FRAGUA_` y `FORGE_`

Las variables propias del proyecto se leen con dos prefijos: `FRAGUA_<NOMBRE>` (actual) y `FORGE_<NOMBRE>` (antiguo) (`claude-hooks/shared/entorno.js`, reexportado por `core/entorno.js`). Reglas:

- Si solo una está definida, se usa esa.
- Si las dos están definidas con el mismo valor, se usa ese valor.
- Si las dos están definidas con valores distintos, **no se elige ninguna**: las variables de política (listas, interruptores, límites) toman el valor más restrictivo, y las demás lanzan un error que nombra las dos.
- Una variable definida pero vacía cuenta como definida.
- Solo se leen del entorno del usuario, nunca de un archivo del proyecto.

La tabla usa el sufijo; antepón `FRAGUA_` (o `FORGE_`).

### Variables con prefijo

| Sufijo | Lo lee | Efecto |
|---|---|---|
| `BUDGET_USD` | `core/ciclo/config.js`, `core/session-budget.js` | Tope de gasto en USD del ciclo verificado. Manda sobre `presupuesto.tope_usd` del proyecto y es la única forma de **subir** el tope por encima de 2,00 USD |
| `BUDGET_WARN_USD`, `BUDGET_BLOCK_USD` | `claude-hooks/context-manager.js` | Umbrales del hook de contexto (aviso a 0,50 y bloqueo de agentes opus a 1,00 por defecto) |
| `TOOL_MAX_BYTES`, `LEDGER_MAX_BYTES` | `claude-hooks/context-manager.js` | Tamaño máximo de un resultado de herramienta antes de truncarlo (50 000) y del libro de consumo antes de rotarlo (5 000 000) |
| `LLM_PROVIDER` | `core/llm-providers/index.js` | Proveedor de modelos; manda sobre `llm.provider` del proyecto. Valores reconocidos en el código: `anthropic`/`claude`, `openai`/`gpt`/`codex`/`azure`/`github-models`/`cursor`, `ollama`/`local`/`deepseek`/`llama`, `stub`/`test`, o una URL `http...` (se trata como servidor Ollama); uno desconocido avisa y usa `anthropic` (`crearProvider`) |
| `LLM_HOSTS` | `core/llm-providers/index.js` | Hosts adicionales a los que el usuario permite dirigir llamadas al modelo (lista separada por comas); sin esto, un `llm.base_url` remoto del proyecto se ignora |
| `MOTOR_GRAFO` | `core/ciclo/config.js` | Sustituye a `motor.grafo` |
| `NIVEL_MAXIMO` | `core/ciclo/config.js` | Sustituye a `motor.nivel_maximo` |
| `IMPLEMENTADOR` | `core/ciclo/config.js` | Sustituye a `motor.implementador` (`bloque` o `turnos`) |
| `PERFIL_<ROL>_<CAMPO>` | `core/ciclo/perfiles.js` | Perfil de agente por rol (`PLANNER`, `QA`, `CODER`) desde el entorno del usuario. Campos: ver [GARANTIAS-Y-LIMITES.md](GARANTIAS-Y-LIMITES.md) |
| `SANDBOX_CPUS`, `SANDBOX_MEMORIA`, `SANDBOX_PIDS`, `SANDBOX_TIMEOUT_S`, `SANDBOX_SALIDA_MAX_BYTES` | `core/ciclo/config.js` | Recursos del contenedor. Mandan sobre `sandbox.*` y no tienen techo; el proyecto sí lo tiene |
| `PRECIOS_CERO` | `core/ciclo/config.js` | Identificadores de modelo (separados por comas) cuyo precio 0 acepta aunque lo declare el proyecto |
| `RUNTIMES_PERMITIDOS` | `core/sandbox/politica.js` | Mecanismos de aislamiento (`sandbox.runtime`) que el usuario autoriza además de `runc` y el de Docker por defecto |
| `PUERTAS_TIMEOUT_S`, `PUERTAS_TIMEOUT_TOTAL_S`, `PUERTAS_SALIDA_MAX_BYTES` | `core/puertas/config.js` | Topes de las puertas de calidad (ver [puertas-de-calidad.md](puertas-de-calidad.md)); el proyecto solo puede bajarlos |
| `DOCKER_TIMEOUT_S` | `core/sandbox/docker-cli.js` | Espera de cada consulta a Docker (por defecto 15 s) |
| `DESTINOS_PERMITIDOS` | `core/ciclo/politica-destinos.js` | Destinos de red que el código escrito por el agente puede usar sin revisión (dominios exactos o `*.dominio`) |
| `MCP_PERFIL` | `core/mcp/perfiles.js` | Perfil del servidor MCP si no se pasa `--perfil` (`completo` o `verificacion`) |
| `MCP_CICLO` | `core/mcp/limites.js` | Interruptor del servidor MCP: `normal`/`activo` (o vacío) lo dejan funcionar; `apagado` o cualquier otro valor lo apaga |
| `MCP_TIMEOUT_S`, `MCP_SALIDA_MAX_BYTES`, `MCP_POR_HORA`, `MCP_POR_DIA` | `core/mcp/limites.js` | Límites del servidor MCP. Por defecto 300 s, 16 384 bytes, 20 por hora y 200 por día; con techo (1800, 65 536, 1000, 10 000) |
| `API_TOKEN` | `cli/index.js` (`api`) | Fija el token de `fragua api` en lugar de generar uno aleatorio (mínimo 16 caracteres, sin espacios; ver [api-http.md](api-http.md)) |
| `API_PRESUPUESTO_EXTRA_MAX`, `API_PRESUPUESTO_EXTRA_TOTAL` | `core/api/servidor.js` | Techos del presupuesto extra por llamada (5 USD) y acumulado (20 USD) en `fragua api` |
| `UI_PORT` | `ui/server.js` | Puerto del dashboard cuando se arranca con `node ui/server.js` |
| `HOME` | `core/estado-usuario.js` | Raíz del estado del usuario (clave local, cola de integraciones). Con ella, el estado va a `<HOME>/integraciones`. Sin ella: `integraciones` dentro de `%LOCALAPPDATA%\fragua` en Windows o de `~/.fragua`; si solo existe la carpeta antigua (`forge`), se sigue usando |
| `INTEGRACIONES` | `core/integraciones/auditoria.js` | `apagado` apaga las integraciones externas |
| `INTEGRACIONES_HOSTS`, `INTEGRACIONES_ESCRITURA`, `INTEGRACIONES_DESTINOS` | `core/integraciones/` | Política del usuario para integraciones (hosts permitidos, proveedores en los que se puede escribir, destinos). Ver [INTEGRACIONES.md](INTEGRACIONES.md) |
| `<NOMBRE_DEL_TOKEN>` | `core/integraciones/config.js` | El nombre lo declara el proyecto en `integraciones.<proveedor>_token_env` (debe empezar por `FORGE_` o `FRAGUA_`); no puede coincidir con una variable reservada |

Los siguientes sufijos son de pruebas: `STUB_GUION` (guion del proveedor `stub`), `TEST_INTEGRACIONES`, `TEST_DOCKER` (activa las pruebas con Docker real).

### Variables sin prefijo doble

| Variable | Lo lee | Efecto |
|---|---|---|
| `ANTHROPIC_API_KEY`, `CLAUDE_API_KEY` | `core/engine-cli.js`, `core/llm-providers/index.js`, `cli/comandos/doctor.js` | Clave de Anthropic. `run` y `resume` usan `ANTHROPIC_API_KEY`; sin ella `run` avisa de que el engine correrá en modo `stub` |
| `OPENAI_API_KEY`, `OPENAI_BASE_URL` | `core/llm-providers/` | Clave y servidor del proveedor OpenAI o compatible |
| `OLLAMA_BASE_URL` | `core/llm-providers/` | Servidor de Ollama |
| `OLLAMA_HOST` | `core/recuperacion/embeddings.js` | Servidor de Ollama para `motor.embeddings: ollama` (por defecto `http://127.0.0.1:11434`) |
| `GOOGLE_API_KEY`, `GEMINI_API_KEY` | `claude-hooks/model-registry.js` | Solo marcan a Google como proveedor detectado en el registro de modelos del hook |
| `FIGMA_PAT` | `mcp-figma/` | Token de Figma |
| `CLAUDE_AGENT_NAME`, `CLAUDE_SESSION_ID` | hooks, `doctor`, `decisions add` | Las pone Claude Code; sirven para detectar que se ejecuta dentro de él y para atribuir una decisión a un agente |
| `FORGE_EDITAR_GUARDIAN` | `claude-hooks/pre-tool-guard.js` | Con valor `1`, permite editar los archivos del guardián; solo existe con el prefijo antiguo |

## Subcomandos

Un encabezado de tercer nivel por subcomando (o grupo de alias). Una prueba comprueba que coinciden con los `case` de `cli/index.js` (`tests/referencia-cli.test.js`).

### `init`

Instala Fragua en el proyecto actual o, con `--global`, en `~/.claude`.

```text
fragua init [--global] [--preset lean|startup|enterprise] [--ui]
            [--template api-rest|cli-tool|saas-mvp] [--guided]
            [--integracion <clave>] [--perfil esencial|completo] [--carpeta-skills <ruta>]
```

| Opción | Efecto |
|---|---|
| `--global`, `-g` | Instala en `$HOME/.claude` en vez del proyecto. Solo admite la integración `claude` |
| `--preset <nombre>` | Aplica `presets/<nombre>.yaml` a `.sdd/sdd.config.yaml` (conserva los bloques `rutas`, `protecciones`, `figma`, `mapeos`, `memoria`, `compresion` y `control_versiones`). Un nombre desconocido avisa y no aplica nada |
| `--template <nombre>` | Aplica `presets/templates/<nombre>/` (IR, spec y configuración de partida). Uno de `api-rest`, `cli-tool`, `saas-mvp`; otro valor aborta con error |
| `--ui` | Copia el dashboard a `.forge-ui/` |
| `--guided` | Asistente interactivo (perfil de conducción, modelo, modo de sesión); no está en la ayuda |
| `--integracion <clave>` | Herramienta de destino: `claude` (por defecto), `generica`, `agents`, `copilot`, `cursor`, `gemini`, `windsurf`, `opencode`, `kiro`, `codex` |
| `--perfil <nombre>` | Perfil de instalación: `esencial` (por defecto, 6 comandos) o `completo` (todos). Ver [configuration.md](configuration.md#perfil-de-instalación-y-preset-lean-por-defecto) |
| `--carpeta-skills <ruta>` | Solo con `--integracion generica`: carpeta de destino de las skills |
| `--con-hooks` | Registra el guardián (y la memoria donde existe) en los hooks de la herramienta: cursor, copilot, gemini, codex, windsurf, opencode. Nunca pisa un archivo existente. `update` lo recuerda |
| `--sin-hooks` | Desactiva lo anterior en `update` (no borra el archivo ya escrito) |

Acepta `--opcion valor` y `--opcion=valor`. Una clave de integración, perfil o carpeta inválidos paran la ejecución antes de escribir nada. Si algo no se pudo escribir, sale con 1 y dice qué faltó.

```bash
npx fragua init --preset lean
```

### `update`

Vuelve a copiar el núcleo (comandos, agentes, skills, hooks) sin tocar `.sdd/` ni los ajustes del usuario.

```text
fragua update [--global] [--integracion <clave>] [--perfil esencial|completo] [--carpeta-skills <ruta>]
```

Nunca borra comandos ya instalados. Si ni la línea de comandos ni la configuración fijan un perfil y la instalación existente ya tiene comandos fuera del perfil esencial, se actualizan todos. Sale con 1 si no existe la carpeta de destino.

```bash
npx fragua update --perfil completo
```

### `doctor`

Diagnostica la instalación: integridad del plugin, instalación en el proyecto, `sdd.config.yaml`, integración y perfil instalados, hooks de `settings.json`, `CLAUDE.md`, `estado.json`, MCP, dashboard, aislamiento del ciclo verificado, integraciones externas y proveedor de modelos. Termina con un apartado «Siguiente paso».

```text
fragua doctor [--integraciones-red]
```

`--integraciones-red` (no está en la ayuda) añade la comprobación de red de las integraciones. Con `ANTHROPIC_API_KEY` definida hace una llamada mínima (`max_tokens` 32) al modelo para comprobar la conexión (`cli/comandos/doctor.js`, apartado «Ping al LLM»). Informa de los problemas en pantalla pero **no fija un código de salida distinto de 0** por ellos.

```bash
npx fragua doctor
```

### `esquema`

Muestra los esquemas del contrato público (solo lectura). No está en la ayuda.

```text
fragua esquema [nombre]
```

Sin nombre lista los esquemas y su `$id`; con nombre imprime el esquema JSON. Lee `docs/contrato/` del paquete. Sale con 1 si el nombre no existe o se pasa más de un argumento.

```bash
npx fragua esquema veredicto
```

### `config`

Lee y modifica `.sdd/sdd.config.yaml` con un analizador por líneas (sin librería YAML).

```text
fragua config show [sección]
fragua config get <clave>
fragua config set <clave> <valor>
fragua config validate
```

- `show` sin sección imprime el archivo; con ella, solo esa sección. Sin `.sdd/sdd.config.yaml` sale con 1.
- `get` y `set` admiten claves de uno o dos niveles (`perfil`, `sesion.modo`). `get` de una clave inexistente avisa y sale con 0; `set` de una inexistente sale con 1. `set` no crea claves y no escribe a través de enlaces.
- `validate` comprueba que existan `agentes:`, `comportamiento:`, `rutas:` y `memoria:`, que `memoria.umbral_bytes` sea mayor que 0 y que los `modelo:` sean `opus`, `sonnet` o `haiku`. Informa pero sale con 0 aunque encuentre errores. **No** valida las secciones `motor`, `sandbox`, `presupuesto` ni `integraciones`; esas las validan al leerse (`fragua status`, `fragua doctor`, `fragua run`).
- Otro subcomando imprime el uso y sale con 0.

```bash
npx fragua config set sesion.modo rapido
```

### `ui`

Arranca el dashboard local.

```text
fragua ui [--port N] [--no-open]
```

Busca `.forge-ui/server.js` en el proyecto y, si no, `ui/server.js` del paquete; si no hay ninguno, sale con 1. Escucha en `127.0.0.1`, puerto 3001 por defecto, y se cierra tras 30 minutos sin peticiones. Solo atiende peticiones `GET`. Acepta `--port N` y `--port=N`. Rutas: ver [api-reference.md](api-reference.md#servidor-del-dashboard).

```bash
npx fragua ui --port 3005 --no-open
```

### `logs`

Muestra las últimas entradas de `.sdd/observabilidad/consumo.jsonl` con sus totales.

```text
fragua logs [--last N]
```

`--last N` (por defecto 20; acepta `--last=N`). Si el archivo no existe o no tiene entradas válidas, lo avisa y sale con 0.

```bash
npx fragua logs --last 5
```

### `export`

Exporta `.sdd/` a un formato portable.

```text
fragua export [--format=speckit|openspec] [--out=<dir>]
```

Solo acepta la forma `--opcion=valor`. Por defecto `--format=speckit` y la salida va a `<format>-export/`. `speckit` escribe `spec.md`, `plan.md`, `tasks.md`, `README.md` y, si hay ADR, `decisions.md`; `openspec` escribe `openspec.json`. Un formato desconocido sale con 1.

```bash
npx fragua export --format=openspec --out=./export
```

### `import`

Importa artefactos portables a `.sdd/`.

```text
fragua import --from=speckit --dir=<dir> [--merge]
fragua import --from=openspec --file=<archivo.json> [--merge]
```

Solo acepta la forma `--opcion=valor`. Sin `--from`, sin `--dir`/`--file` según el formato, o con un formato desconocido, sale con 1. Con `--merge` no sobrescribe lo que ya exista.

```bash
npx fragua import --from=speckit --dir=./speckit-export --merge
```

### `status`

Estado del pipeline y de las transiciones disponibles; muestra además, si existen, el estado del ciclo, las señales de mantenimiento, la matriz de criterios de la spec activa, las integraciones activas y el mecanismo de aislamiento que usará el ciclo.

```text
fragua status
```

Lee `.sdd/estado.json`. Los pasos del pipeline son `idea`, `discovery`, `ir`, `design`, `spec`, `plan`, `tasks`, `code`, `done` (`cli/runner.js`).

```bash
npx fragua status
```

### `step`

Avanza el pipeline al paso indicado, sin modelo.

```text
fragua step <paso> [--force --motivo "<texto>"]
```

Aplica las condiciones previas de la máquina de estados; si no se cumplen, sale con 1. `--force` omite esas condiciones y exige `--motivo` de al menos 10 caracteres (`MIN_MOTIVO`); deja un evento firmado `pipeline_step_forzado` en el registro de eventos. Un paso desconocido o la ausencia de paso salen con 1. Si ya estás en ese paso, no hace nada.

```bash
npx fragua step spec
```

### `state`

Vuelca `.sdd/estado.json` formateado. Sale con 1 si no existe.

```text
fragua state
```

```bash
npx fragua state
```

### `validate`

Verifica las precondiciones del paso actual del pipeline. Sale con 0 si se cumplen y con 1 si no, listándolas.

```text
fragua validate
```

No confundir con `validate` de `core/engine-cli.js` (validar una spec), que no se despacha desde `cli/index.js`.

```bash
npx fragua validate
```

### `reset`

Devuelve el pipeline al paso `idea` sin borrar `.sdd/`.

```text
fragua reset --force
```

Sin `--force` sale con 1. **Escribe** `.sdd/estado.json`.

```bash
npx fragua reset --force
```

### `dispatch`

Despacha una tarea a un adaptador (`speckit` o `claude-code`) de `core/adapters/`. No está en la ayuda.

```text
fragua dispatch --agente=<nombre> --tarea="<descripción>" [--tier=low|medium|high] [--adapter=speckit|claude-code]
```

Solo acepta la forma `--opcion=valor`. Sin `--agente` o `--tarea`, o con un adaptador que no existe o no está disponible, sale con 1. Con `claude-code` entrega un traspaso para Claude Code en lugar de ejecutar la tarea con un modelo. Qué hace cada adaptador al detalle: no verificado en esta revisión.

```bash
npx fragua dispatch --agente=tester --tarea="Revisa las pruebas de auth"
```

### `adapters`

Lista los adaptadores registrados. No está en la ayuda.

```text
fragua adapters
```

```bash
npx fragua adapters
```

### `decisions`

Almacén de decisiones de arquitectura (`core/decisions/decision-store.js`, sobre `.sdd/arquitectura/`). No está en la ayuda.

```text
fragua decisions [list]
fragua decisions search "<consulta>"
fragua decisions add "<texto>"
fragua decisions consolidate [días]
fragua decisions migrate
```

- `list` (por defecto): hasta 20 decisiones activas.
- `search`: búsqueda por similitud de texto (TF-IDF, según el comentario del código), 5 resultados.
- `add`: registra una decisión manual; el agente se toma de `CLAUDE_AGENT_NAME` (por defecto `main`).
- `consolidate`: elimina las obsoletas con más de N días (90 por defecto).
- `migrate`: importa `.sdd/arquitectura/ADRs.jsonl` al almacén.
- Un subcomando desconocido, o `search`/`add` sin texto, sale con 1.

```bash
npx fragua decisions add "Usar SQLite para persistencia"
```

### `aprobar`

Registra una aprobación humana.

```text
fragua aprobar spec
fragua aprobar delegacion <carpeta>/<archivo>.md
```

Exige un **terminal interactivo real** y que la persona teclee un código de un solo uso; no existe opción para saltarlo y no admite opciones (una opción desconocida sale con 1). `spec` aprueba la spec activa y habilita la planificación; `delegacion` registra que tú aprobaste un archivo de `.sdd/especificaciones/` marcado `aprobado_por_delegacion`. Deja el registro en `.sdd/aprobaciones.jsonl` con quién, cuándo, qué y el hash del archivo. Con el mismo usuario del sistema operativo no hay separación criptográfica total (límite declarado en `core/aprobaciones-identidad.js`). **Escribe** `.sdd/aprobaciones.jsonl` y `.sdd/estado.json`. Sin objetivo válido imprime el uso y sale con 0.

```bash
npx fragua aprobar spec
```

### `integraciones`

Integraciones externas con GitHub, GitLab y Jira. Todo lo que escribe en una plataforma queda pendiente hasta una aprobación explícita con huella. Ver [INTEGRACIONES.md](INTEGRACIONES.md).

```text
fragua integraciones leer <proveedor> <referencia>
fragua integraciones publicar <tarea> --proveedor <p> --referencia <r> [--tipo comentario|propuesta] [--base <rama>]
fragua integraciones pendientes
fragua integraciones vista <id> [--archivos]
fragua integraciones aprobar <id> --huella <hex>
fragua integraciones rechazar <id> [--motivo <texto>]
fragua integraciones estado
fragua integraciones doctor [--red]
fragua integraciones apagar | encender
```

Opción común: `--cwd <ruta>`. Proveedores: `github`, `gitlab`, `jira`; referencias de ejemplo: `org/repo#7`, `grupo/proyecto#7`, `ABC-7`. `aprobar` exige `--huella` (completa o de al menos 12 caracteres), que sale de `vista`. Códigos: 0 bien, 1 rechazo o fallo, 2 uso incorrecto. No está en el texto de `fragua help`.

```bash
npx fragua integraciones estado
```

### `verificar`

Veredicto de las pruebas del proyecto en un contenedor aislado, **sin llamar a ningún modelo**. No existe opción para ejecutar sin aislamiento.

```text
fragua verificar [--cwd <dir>] [--comando "<pruebas>"] [--json] [--registrar]
                 [--mutacion (--archivos <a,b> | --desde <ref>) [--mutacion-minima <0..1>]]
fragua verificar --comprobar-evidencia [--cwd <dir>] [--json]
fragua verificar --comprobar-aprobaciones [--cwd <dir>] [--json]
fragua verificar --criterios [--exigir-cobertura-de-criterios] [--cwd <dir>] [--json]
```

Acepta `--opcion valor` y `--opcion=valor`. Un argumento que no empiece por `--` o una opción desconocida salen con 1. La ayuda de `fragua help` solo muestra `--cwd`, `--comando` y `--json`; el resto (`--registrar`, `--mutacion`, `--archivos`, `--desde`, `--mutacion-minima`, `--comprobar-evidencia`, `--comprobar-aprobaciones`, `--criterios`, `--exigir-cobertura-de-criterios`) no está en la ayuda.

- `--mutacion` exige `--archivos` o `--desde`: no se muta el proyecto entero. `--mutacion-minima` es un número de 0 a 1 y con él una puntuación por debajo del mínimo (o no concluyente) da código 1.
- `--registrar` anota el resultado en la cadena de evidencia.
- `--comprobar-evidencia`, `--comprobar-aprobaciones` y `--criterios` son de solo lectura y no se combinan con `--registrar`, `--mutacion`, `--comando`, `--archivos`, `--desde` ni `--mutacion-minima`.
- `--criterios` muestra la matriz de criterios de aceptación de la spec activa; con `--exigir-cobertura-de-criterios`, un criterio sin tarea o sin prueba da código 1.

Códigos: 0 pasa, 1 falla, cero pruebas o uso incorrecto, 4 sin Docker o error de infraestructura. Ver [ciclo-verificado.md](ciclo-verificado.md) y [cadena-de-evidencia.md](cadena-de-evidencia.md).

```bash
npx fragua verificar --cwd . --comando "npm test" --json
```

### `api`

API HTTP local con token. No está descrita en `fragua help` más allá de una línea; detalle en [api-http.md](api-http.md).

```text
fragua api [--port N] [--cwd <ruta>]
```

Solo acepta `--port N` y `--cwd <ruta>` (no la forma con `=`). Escucha en `127.0.0.1` (puerto 3002 por defecto). Escribe **una línea JSON** con `{"url": ..., "token": ...}` por la salida estándar y el resto por la de errores. El token es aleatorio, salvo que se fije con `FRAGUA_API_TOKEN`. Se detiene con Ctrl+C. **Arranca un servidor.**

```bash
npx fragua api --port 3002
```

### `mantenimiento`

Detecta señales objetivas en el registro de eventos (fallos repetidos, regresiones).

```text
fragua mantenimiento [--escribir] [--json]
```

Con `--escribir` deja un borrador de idea por señal en `.sdd/mantenimiento/ideas/`. No despliega ni corrige. Códigos: 0 sin señales, 1 con señales, 2 si no se puede leer el registro de eventos.

```bash
npx fragua mantenimiento --json
```

### `probar-modelo`

Prueba mínima del ciclo con un modelo real, en un directorio temporal.

```text
fragua probar-modelo [--tope USD] [--conservar]
```

Necesita un proveedor real (`ANTHROPIC_API_KEY` o `LLM_PROVIDER`); con el proveedor `stub` no se ejecuta. Gasta como máximo el tope (0,50 USD por defecto; el código acepta un valor mayor que 0 y hasta 20) y resume formato, iteraciones y coste. Solo acepta `--tope N` y `--conservar` (no la forma con `=`). Códigos: 0 ok, 1 falló, 2 no se ejecutó (sin proveedor real o tope inválido). **Gasta dinero y exige Docker.**

```bash
npx fragua probar-modelo --tope 0.30
```

### `mcp`

Servidor MCP por stdin/stdout.

```text
fragua mcp [--cwd <ruta>] [--perfil completo|verificacion]
```

El perfil `completo` expone `ejecutar_pruebas`, `leer_archivo` y `escribir_archivo`; `verificacion` expone solo `verificar`, sin lectura, escritura ni gasto. Acepta `--opcion valor` y `--opcion=valor`; cualquier otro argumento no arranca el servidor y sale con 1. Si no se pasa `--perfil`, se usa `FRAGUA_MCP_PERFIL`. Ver [servidor-mcp.md](servidor-mcp.md) y [mcp-verificar.md](mcp-verificar.md). **Arranca un servidor.**

```json
{"mcpServers":{"forge":{"command":"npx","args":["forge","mcp"]}}}
```

### `guardian`

`fragua guardian evaluar` lee un evento de herramienta (JSON, contrato en [contrato/evento-herramienta.md](contrato/evento-herramienta.md)) por la entrada estándar y ejecuta el mismo guardián que el hook de Claude Code. Código de salida `0` permite, `2` bloquea (también si el evento no es JSON o está vacío, si `--anfitrion` no se reconoce o si no puede evaluar: falla cerrado) y `1` solo por subcomando desconocido. Solo es «impuesto» si la herramienta que lo llama puede bloquear con ese código; si no, es consultivo. La identidad del agente sale de `FRAGUA_AGENTE` o `FORGE_AGENTE`, con `CLAUDE_AGENT_NAME` de respaldo.

### `memoria`

`fragua memoria registrar` lee un evento de herramienta por la entrada estándar y lo registra en la memoria de agentes, con la misma lógica que el hook de Claude Code. Códigos de salida como en `guardian`.

### `adr`

Busca ADRs escritos como comentarios en el código y, con `--update-ledger`, los añade al registro. Delega en `utils/adr-parser.js`.

```text
fragua adr <raíz> "<glob>" [--update-ledger]
```

Devuelve el código de salida del script.

```bash
npx fragua adr . "src/**/*.ts" --update-ledger
```

### `run`

Ejecuta las tareas del proyecto. Delega en `core/engine-cli.js`.

```text
fragua run [--cwd <ruta>] [--tasks <json|archivo>] [--motor clasico|ciclo] [--force]
           [--parallel-threshold N] [--stop-on-failure false]
```

- Por defecto el motor es `ciclo` (desde 5.0.0): cada tarea de código se corrige hasta que sus pruebas pasan, en un contenedor Docker sin red. Exige Docker; sin él sale con 4.
- `--motor clasico` ejecuta las pruebas **en tu equipo, sin aislamiento**. Un `motor.modo: clasico` en `sdd.config.yaml` por sí solo no basta: hay que pedirlo en la orden.
- El ciclo solo se ejecuta en la etapa `code` (o avanza solo desde `tasks`); con `--force` se salta esa comprobación.
- `--tasks` acepta un archivo JSON o el JSON en línea. Sin él lee las tareas de `.sdd/estado-tareas.json` o de la spec activa.
- `--parallel-threshold` (por defecto 3) y `--stop-on-failure` (por defecto verdadero) no están en la ayuda. `--cwd` tampoco.
- Sin `ANTHROPIC_API_KEY`, avisa de que el engine correrá en modo `stub`.
- Un solo ciclo por proyecto a la vez (candado en el proyecto).
- `run --help` y `run -h` muestran la ayuda general.

Códigos: 0 completado, 1 fallo, 3 revisión humana pendiente (una tarea espera tu decisión), 4 aislamiento no disponible. **Puede gastar dinero** (tope de la sesión: `presupuesto.tope_usd`, 2,00 USD por defecto, o `FRAGUA_BUDGET_USD`).

```bash
npx fragua run --tasks tareas.json
```

### `resume`

Retoma lo interrumpido o lo que espera una decisión.

```text
fragua resume [--cwd <ruta>] [--decision continuar|aceptar|abortar] [--tarea <id>]
              [--iteraciones-extra N] [--presupuesto-extra USD] [--motor clasico|ciclo] [--force]
```

Si una tarea espera tu decisión, la muestra sin gastar nada hasta que indiques `--decision`: `continuar` (opcionalmente con más iteraciones o presupuesto), `aceptar` (dar la tarea por buena) o `abortar` (restaurar los archivos al estado previo). `--tarea` limita la decisión a una tarea (no está en la ayuda); sin él vale para todas las pendientes de decisión. `--decision` sin ninguna tarea en revisión sale con 1. Mismos códigos de salida que `run`.

```bash
npx fragua resume --decision continuar --presupuesto-extra 1
```

### `--version` y `-v`

Imprime la versión del paquete (`-v` es sinónimo).

```bash
npx fragua --version
```

### `help`, `ayuda`, `--help` y `-h`

Muestra la ayuda. También se activa con `ayuda`, `--help`, `-h` o sin argumentos.

```bash
npx fragua help
```

## Lo que la CLI no hace

- `init` es el único subcomando que instala; no hay un subcomando para desinstalar.
- `status` y `validate` de `core/engine-cli.js` existen pero no se despachan desde `cli/index.js`: se llega a ellos con `node core/engine-cli.js status|validate` (no verificado en esta revisión).
