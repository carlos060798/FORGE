# Configuración

> Tipo: Referencia
> Última revisión: 2026-11-10 contra el commit 7683f83

Referencia de `.sdd/sdd.config.yaml`, el archivo de configuración de cada proyecto, y de lo que el entorno del usuario puede decidir por encima de él. Cada clave documentada existe en `configuracion-ejemplo/sdd.config.yaml` o en un lector del código (se indica cuál). Estado del proyecto: [ESTADO-ACTUAL.md](ESTADO-ACTUAL.md). Variables de entorno y opciones de la CLI: [referencia-cli.md](referencia-cli.md).

## Cómo se lee el archivo

`fragua init` copia `configuracion-ejemplo/sdd.config.yaml` a `.sdd/sdd.config.yaml` si no existe (no lo sobrescribe). **No hay un analizador YAML completo**: cada parte del código lee las secciones que le interesan con expresiones regulares por líneas. Consecuencias que el código impone:

- Las claves leídas por el ciclo (`motor`, `sandbox`, `presupuesto`, `modelos`, `precios`, `perfiles`, `integraciones`, `puertas`) son **claves escalares de un nivel, con exactamente 2 espacios de sangría**. Una clave conocida con otra sangría lanza un error en vez de ignorarse (`core/ciclo/config.js`, `leerSeccion`).
- La sección `llm:` debe escribirse como bloque, no `llm: { cache: false }`; una sangría de un espacio o con tabulación lanza un error (`core/llm-providers/index.js`).
- Un valor con dos puntos (por ejemplo `qwen2.5-coder:7b`) va entre comillas.
- `fragua config get|set` solo maneja claves de uno o dos niveles (`perfil`, `sesion.modo`); no llega a `agentes.arquitecto.modelo` (tres niveles).

### Qué lee cada clave

No todas las claves del archivo de ejemplo tienen un lector en código. Las tablas siguientes marcan cada clave con una de estas etiquetas:

| Etiqueta | Significado |
|---|---|
| **código** | La lee y la valida código del repositorio (se indica el módulo) |
| **hook** | La lee un hook de `claude-hooks/` |
| **prompt** | La lee el texto de un comando (`commands/*.md`), es decir, la aplica el modelo que sigue ese comando, no código determinista |
| **declarativa** | Ningún archivo del repositorio la lee (búsqueda en `cli/`, `core/`, `claude-hooks/`, `commands/`, `agents/`, `skills/`, `utils/`, `ui/`). Existe como convención del archivo de ejemplo; cambiarla no tiene efecto comprobable |

## Quién manda sobre quién

Un archivo del proyecto puede venir de un repositorio ajeno, así que lo que protege al usuario (gasto, recursos, destinos, credenciales) no puede decidirlo ese archivo. Reglas que el código aplica:

| Asunto | Reglas | Dónde |
|---|---|---|
| Tope de gasto | `FRAGUA_BUDGET_USD` (o `FORGE_BUDGET_USD`) manda sobre `presupuesto.tope_usd`. Sin la variable, el archivo puede **bajar** el tope pero no subirlo por encima de 2,00 USD: lo que pase de ahí se ignora con un aviso. Ampliar durante una ejecución: `fragua resume --presupuesto-extra` | `core/ciclo/config.js` |
| Precios | Para un modelo de la tabla incluida vale el **mayor** entre el precio del proyecto y el de la tabla. Un modelo que no está en la tabla y declara precio 0 se ignora (se cobra al precio más alto conocido), salvo que el usuario lo nombre en `FRAGUA_PRECIOS_CERO` | `core/ciclo/config.js` (`limitarPreciosDelProyecto`) |
| Recursos del contenedor | `FRAGUA_SANDBOX_CPUS`, `_MEMORIA`, `_PIDS`, `_TIMEOUT_S`, `_SALIDA_MAX_BYTES` mandan sobre `sandbox.*` y no tienen techo. El proyecto sí lo tiene: 4 CPU, 4096 MB, 1024 procesos, 1800 s y 16 MiB de salida; lo que pase se recorta con un aviso | `core/ciclo/config.js` (`TECHOS_SANDBOX`) |
| Mecanismo de aislamiento | `sandbox.runtime` distinto de `runc` (o vacío, el de Docker por defecto) exige que el usuario lo autorice en `FRAGUA_RUNTIMES_PERMITIDOS`; si no, el ciclo no empieza (código de salida 4). Un valor que Docker pudiera leer como opción se rechaza | `core/sandbox/politica.js` |
| Modo de ejecución | `motor.modo: clasico` en el archivo **no basta**: ejecutar en el equipo, sin aislamiento, hay que pedirlo en la orden con `--motor clasico` | `core/engine-cli.js` |
| Motor, nivel máximo e implementador | `FRAGUA_MOTOR_GRAFO`, `FRAGUA_NIVEL_MAXIMO` y `FRAGUA_IMPLEMENTADOR` sustituyen a `motor.grafo`, `motor.nivel_maximo` y `motor.implementador` | `core/ciclo/config.js` |
| Proveedor de modelos | `FRAGUA_LLM_PROVIDER` manda sobre `llm.provider`. Las credenciales (`api_key`, `api_version`) del archivo se ignoran: solo valen en el entorno. Un `llm.base_url` solo se acepta si es una dirección de la propia máquina que el usuario pidió o un host que el usuario permite (`FRAGUA_LLM_HOSTS`); `OPENAI_BASE_URL` u `OLLAMA_BASE_URL` del entorno mandan sobre el archivo | `core/llm-providers/index.js` |
| Perfiles de agente por rol | Dos capas: el entorno del usuario (`FRAGUA_PERFIL_<ROL>_<CAMPO>`) y el proyecto (sección `perfiles:`). El proyecto **solo puede apretar** (menos herramientas, menos pasos); lo que intente ampliar se ignora y se anota | `core/ciclo/perfiles.js` |
| Integraciones externas | El archivo declara proveedor, modo y destinos; el token va en una variable de entorno cuyo nombre declara el archivo. El usuario puede reducir el modo y limitar hosts, destinos y escritura con `FRAGUA_INTEGRACIONES*` | `core/integraciones/config.js` |
| Puertas de calidad | La sección `puertas:` solo añade exigencias; sus topes de tiempo y salida solo pueden bajar. El usuario fija el techo con `FRAGUA_PUERTAS_*` | `core/puertas/config.js` |
| Rutas protegidas | `protecciones.no_tocar_archivos` la lee el ciclo (`leerRutasProtegidas`): si la lista está declarada pero no se entiende, el ciclo para en vez de dejar rutas sin proteger | `core/ciclo/config.js` |

Resumen: **entorno del usuario > orden de la CLI > archivo del proyecto** para todo lo que afecta a gasto, recursos, credenciales y destinos. El detalle de las garantías está en [GARANTIAS-Y-LIMITES.md](GARANTIAS-Y-LIMITES.md) y [MIGRACION-5.0.md](MIGRACION-5.0.md).

## Perfil de instalación y preset lean por defecto

Esta sección explica lo que `fragua init` hace sin opciones (ADR-24, `.sdd/arquitectura/ADR-24-perfil-esencial-y-preset-lean-por-defecto.md`, estado «propuesta, pendiente de aceptación formal del dueño»).

**Perfil de instalación.** Decide qué comandos recibe la instalación (`core/instalacion/perfiles.js`):

| Perfil | Comandos | Cómo se pide |
|---|---|---|
| `esencial` (por defecto) | 6: `forge`, `sdd.especificar`, `sdd.planificar`, `sdd.tareas`, `sdd.implementar`, `sdd.estado` | sin opciones, o `--perfil esencial` |
| `completo` | todos los de `commands/` (39) | `--perfil completo` |

El perfil se guarda en `.sdd/sdd.config.yaml`, sección `instalacion`:

| Clave | Valores | Quién la lee |
|---|---|---|
| `instalacion.integracion` | `claude` (por defecto), `generica`, `agents`, `copilot`, `cursor`, `gemini`, `windsurf`, `opencode`, `kiro` | código (`cli/comandos/instalar.js`); la escribe `init` cuando se pidió integración o perfil |
| `instalacion.perfil` | `esencial`, `completo` | código (`cli/comandos/instalar.js`) |
| `instalacion.carpeta_skills` | ruta | código; solo con la integración `generica` (la guardada en el proyecto solo vale dentro del proyecto) |

Orden de precedencia: opción de la línea de comandos > configuración guardada > por defecto. `fragua update` no borra comandos ya instalados; si la instalación ya tiene comandos fuera del perfil esencial y nadie fija un perfil, actualiza todos. Los comandos de la CLI (`aprobar`, `verificar`, `doctor`) no dependen del perfil.

**Preset de agentes `lean` por defecto.** El bloque `agentes:` de `configuracion-ejemplo/sdd.config.yaml` es el de `presets/lean.yaml`: seis agentes activos, todos con `modelo: sonnet`: `arquitecto`, `disenador-api`, `asesor-datos`, `desarrollador-backend`, `desarrollador-frontend` y `tester`. Los otros ocho aparecen con `activo: false`. Para otro conjunto: `fragua init --preset startup|enterprise`, o cambia `activo` a mano. Consecuencia declarada en el ADR: con lean no hay revisor ni crítico activos; la revisión la hace la persona.

Limitación importante: ver la sección `agentes` más abajo. Los valores `activo` y `modelo` de ese bloque no tienen lector en el código del repositorio, de modo que el preset describe una intención de configuración; no está verificado en esta revisión que el pipeline la aplique.

## Referencia por sección

Columna «Defecto»: el valor del archivo de ejemplo, o el del código si es distinto (se indica).

### Raíz

| Clave | Valores | Defecto | Lectura |
|---|---|---|---|
| `idioma` | texto libre | `español` | declarativa |
| `perfil` | `guiado` \| `experto` | `guiado` | prompt: `/forge` y `/sdd.aclarar` lo leen con `grep '^perfil:'`; `/sdd.constitucion` lo escribe. Sin la clave, el modo es `guiado` según el comentario del archivo |

`perfil` (modo de conducción: `guiado` o `experto`) no es el perfil de instalación ni los perfiles de agente.

### `llm`

Proveedor de modelos para el motor (`core/llm-providers/index.js`). Un solo nivel, 2 o más espacios.

| Clave | Valores | Defecto | Lectura |
|---|---|---|---|
| `llm.provider` | `anthropic`, `openai`, `ollama`, `stub` (y los alias que reconoce `crearProvider`: ver [referencia-cli.md](referencia-cli.md)) | `anthropic` | código; `FRAGUA_LLM_PROVIDER` manda |
| `llm.model` | texto | `sonnet` | se lee con la sección, pero ningún proveedor la consulta (búsqueda en `core/llm-providers/`): el modelo de cada agente sale de su cabecera `model:` en `agents/*.md` y de la sección `modelos`. Trátala como declarativa |
| `llm.cache` | `true` \| `false` | `true` | código (`cacheActiva` en `anthropic-provider.js`); solo Anthropic. Otro valor lanza un error |
| `llm.base_url` | URL | no está en el ejemplo | código; sujeta a las reglas de «Quién manda» |
| `llm.timeout_s` | número de 1 a 3600 | 120 s en el código | código (`leerTimeoutLlmMs`); no está en el ejemplo |
| `llm.api_key`, `llm.api_version` | — | — | se **ignoran** con un aviso: las credenciales solo valen en el entorno |

### `agentes`

Un bloque por agente (14 en el ejemplo: `arquitecto`, `architecture-designer`, `product-designer`, `disenador-api`, `asesor-datos`, `desarrollador-backend`, `desarrollador-frontend`, `operaciones`, `tester`, `revisor`, `critico`, `seguridad`, `documentador`, `investigador`).

| Clave | Valores | Lectura |
|---|---|---|
| `agentes.<nombre>.activo` | `true` \| `false` | declarativa. `fragua config validate` y `fragua doctor` solo comprueban que exista la clave `agentes:` (`cli/comandos/config.js`, `cli/comandos/doctor.js`) |
| `agentes.<nombre>.modelo` | `opus` \| `sonnet` \| `haiku` | `fragua config validate` comprueba que cualquier `modelo:` del archivo sea uno de esos tres; ningún código lo aplica a la ejecución. El modelo real de cada agente sale de la cabecera `model:` de `agents/<nombre>.md` (`core/agent-registry.js`). Ejemplo de la diferencia: `agents/arquitecto.md` declara `model: opus` y el ejemplo de configuración `sonnet` |
| `agentes.<nombre>.descripcion` | texto | declarativa |
| `agentes.<nombre>.timeout_ms` | entero (ms) | el ejemplo lo muestra comentado. `core/agent-registry.js` usa `definition.timeout_ms`, pero la definición se construye solo con las cabeceras de `agents/*.md` (`name`, `description`, `model`, `tools`, `goal`, `backstory`), así que **esta clave del archivo de configuración no se lee** |

Para cambiar el tiempo de las llamadas al modelo, la clave con lector es `llm.timeout_s`.

### `rutas`

Todas **declarativas**: `raiz_sdd`, `constitucion`, `estado_global`, `especificaciones`, `cambios`, `arquitectura`, `dominio`, `indice`, `snapshot`. Los valores del ejemplo (`.sdd`, `.sdd/estado.json`, `.sdd/especificaciones`, `.sdd/arquitectura`, …) son los que el código usa fijos; cambiarlos en el archivo no mueve nada.

### `comportamiento`

| Clave | Valores | Defecto | Lectura |
|---|---|---|---|
| `deteccion_tamano_automatica` | booleano | `true` | declarativa |
| `ruta_rapida_micro` | booleano | `true` | declarativa |
| `marcador_clarificacion`, `marcador_pendiente`, `marcador_decidir` | texto | `[NECESITA_ACLARACION]`, `[PENDIENTE]`, `[POR_DECIDIR]` | declarativa |
| `numeracion_especificaciones` | `fecha` \| `secuencial` \| `ambos` | `fecha` | prompt (`/sdd.especificar`) |
| `requerir_aprobacion_plan` | booleano | `true` | prompt (`/sdd.planificar`, solo con perfil `experto`) |
| `requerir_aprobacion_tareas` | booleano | `false` | declarativa |
| `versionado_constitucion` | booleano | `true` | declarativa |

Las claves `flujo_minimo`, `requiere_analizar` y `requiere_verificar` aparecen en los presets pero no en el ejemplo ni tienen lector.

La aprobación de la spec no depende de esta sección: `fragua aprobar spec` y la máquina de estados la exigen (ver [referencia-cli.md](referencia-cli.md)).

### `control_versiones`

`sistema` (`git`), `crear_ramas` (`false`), `hacer_commits` (`false`): **declarativas**. El propio ejemplo dice que sirven para que hooks personalizados del usuario lean la preferencia.

### `calidad`

| Clave | Defecto | Lectura |
|---|---|---|
| `cobertura_tests_minima` | `80` | hook (`claude-hooks/post-write-conventions.js`) |
| `longitud_funcion_maxima` | `50` | hook (mismo archivo) |
| `permitir_warnings_lint`, `permitir_codigo_comentado`, `longitud_archivo_maxima` | `false`, `false`, `400` | declarativas |

Para exigir comprobaciones en el ciclo existe la sección `puertas:` (más abajo), que es la que sí ejecuta código.

### `protecciones`

| Clave | Lectura |
|---|---|
| `no_tocar_archivos` | código (`leerRutasProtegidas` en `core/ciclo/config.js`, usado por `core/engine-cli.js` como rutas vetadas del ciclo) y el hook de ejemplo `configuracion-ejemplo/hooks-ejemplo/guardia-seguridad.sh`, que hay que copiar a `.sdd/hooks/` para activarlo |
| `comandos_prohibidos`, `requerir_confirmacion`, `ramas_protegidas` | declarativas: ningún archivo del repositorio las lee |

El encabezado del ejemplo lo dice así: «Esta sección es DECLARATIVA».

### `figma`

`enabled` (`false`), `file_key`, `archivos`, `auto_analizar_sistema_diseño`, `auto_mapear_si_file_key`, `bloquear_si_tokens_sin_mapear`: **declarativas**. El servidor `mcp-figma/` lee el token de la variable de entorno `FIGMA_PAT`, no de esta sección.

### `mapeos`

`enabled`, `modo_actualizacion` (`perezoso`), `validacion_perezosa`, `lenguajes`, `ignorar`: **declarativas**. `fragua init --preset` conserva este bloque; `/sdd.configurar` también.

### `memoria`

| Clave | Valores | Defecto | Lectura |
|---|---|---|---|
| `umbral_bytes` | entero | 50000 en el ejemplo; el código usa 40000 si falta (`forge.config.json`) | hook (`claude-hooks/shared/config.js`); `fragua config validate` exige > 0 |
| `backend` | `sqlite` \| `markdown` | `sqlite` en el ejemplo; sin la clave, `sqlite` si Node ≥ 22.5 y `markdown` si no | hook |
| `recuperacion_por_defecto` | entero | `10` | hook |
| `consumo_max_mb` | entero | 10 en el código; no está en el ejemplo | hook (rotación de `consumo.jsonl`) |

Los hooks leen estas claves con una expresión que exige sangría (`^[ \t]+clave:`), por eso deben ir dentro de `memoria:`.

### `sesion`

| Clave | Valores | Defecto | Lectura |
|---|---|---|---|
| `modo` | `normal` \| `rapido` \| `prototipo` | `normal` | prompt: `/sdd.planificar`, `/sdd.implementar` y `/sdd.modo` lo leen y escriben |
| `omitir_pasos` | lista | `[]` | declarativa |

### `compresion`

`enabled`, `modo_salida_usuario`, `modo_agentes_internos`, `comprimir_plugin`, `preservar_terminos`, `patrones_protegidos`: **declarativas**. La compresión de prosa se hace con `/sdd.comprimir` (y `bin/comprimir.sh`), que no leen estas claves.

### `motor`

Motor del ciclo verificado (`core/ciclo/config.js`, todas **código**). Varias claves validan y lanzan un error si el valor no es válido (`sin_progreso`, `mutacion*`, `turnos_*`, `grafo`, `nivel_maximo`, `embeddings`, `modo`); en las numéricas restantes un valor no numérico vuelve al defecto sin aviso.

| Clave | Valores | Defecto | Efecto |
|---|---|---|---|
| `modo` | `ciclo` \| `clasico` | `ciclo` | `ciclo` corrige cada tarea hasta que sus pruebas pasan, en Docker sin red; `clasico` ejecuta en el equipo (ver «Quién manda») |
| `grafo` | `auto` \| `propio` (también se acepta `langgraph`, retirado en 5.0.0, que solo avisa) | `auto` | `FRAGUA_MOTOR_GRAFO` manda |
| `recuperador` | `archivos` \| `semantico` | `archivos` | fuente de contexto de los agentes |
| `embeddings` | `hash` \| `ollama` | `hash` | con `semantico`; `hash` es local y léxico |
| `embeddings_modelo` | texto | `nomic-embed-text` | modelo de Ollama |
| `nivel_maximo` | `opus` \| `sonnet` \| `haiku` | `opus` | nivel más alto que puede usar un agente; `FRAGUA_NIVEL_MAXIMO` manda |
| `max_iteraciones` | entero | `5` | ejecuciones fallidas antes de pedir revisión humana |
| `sin_progreso` | entero ≥ 0 | `3` | fallos seguidos con la misma salida antes de pedir revisión; `0` lo desactiva |
| `mutacion` | `no` \| `informar` \| `exigir` | `informar` | medición de mutación tras un pase |
| `mutacion_minima` | 0 a 1 | `0.6` | con `exigir` |
| `mutacion_max` | entero ≥ 1 | `10` | alteraciones por tarea |
| `mutacion_timeout_s` | entero ≥ 1 | `300` | tiempo máximo de la medición por tarea |
| `mutacion_max_archivos` | entero ≥ 1 | `5` | no está en el ejemplo |
| `mutacion_min_concluyentes` | entero ≥ 1 | `3` | no está en el ejemplo; con `exigir` |
| `contexto_max_bytes` | entero | `65536` | tope del contexto entregado a cada agente |
| `implementador` | `bloque` \| `turnos` | `bloque` | `turnos` (ADR-21) lee, busca y edita por pasos; según el comentario del ejemplo, hoy solo con el proveedor `anthropic`. `FRAGUA_IMPLEMENTADOR` manda |
| `turnos_max` | entero 1 a 200 | `30` | con `turnos` |
| `turnos_pruebas_max` | entero 0 a 200 | `5` | con `turnos` |

### `sandbox`

Contenedor del ciclo (todas **código**, con los techos de «Quién manda»).

| Clave | Defecto | Techo del proyecto | Variable del usuario |
|---|---|---|---|
| `cpus` | `1` | 4 | `FRAGUA_SANDBOX_CPUS` |
| `memoria` | `512m` | 4096 MB | `FRAGUA_SANDBOX_MEMORIA` |
| `pids` | `256` | 1024 | `FRAGUA_SANDBOX_PIDS` |
| `timeout_s` | `120` | 1800 | `FRAGUA_SANDBOX_TIMEOUT_S` |
| `salida_max_bytes` | `1048576` | 16 MiB | `FRAGUA_SANDBOX_SALIDA_MAX_BYTES` |
| `runtime` | vacío (el de Docker) | ver «Quién manda» | `FRAGUA_RUNTIMES_PERMITIDOS` autoriza |

`sandbox.requerido` **no existe**: no hay forma de exigir por configuración que el ciclo falle si no hay aislamiento más allá de lo que el modo `ciclo` ya hace (sin Docker, sale con código 4).

### `presupuesto`

| Clave | Valores | Defecto | Efecto |
|---|---|---|---|
| `tope_usd` | número ≥ 0 | `2.00` | al alcanzarlo no se inicia ninguna llamada más. Manda `FRAGUA_BUDGET_USD`; el archivo no puede subirlo de 2,00 |
| `umbral_degradacion_usd` | número | `1.50` | a partir de aquí se usa un modelo más barato; si supera el tope, se baja al tope |
| `degradar_a` | `escalon` \| `local` | `escalon` | `escalon`: opus → sonnet → haiku |
| `sin_precio` | `avisar` \| `rechazar` | `avisar` | qué hacer con un modelo sin precio conocido; no está en el ejemplo |

### `modelos` y `precios`

Opcionales; comentadas en el ejemplo. Sin ellas se usa la lista incluida en `core/precios.js`, cuya fecha de revisión muestran `fragua status` y `fragua doctor`.

- `modelos`: identificador de modelo de cada nivel. Las únicas claves válidas son `opus`, `sonnet`, `haiku`; otra lanza un error.
- `precios`: USD por millón de tokens, claves planas `<identificador>_entrada` y `<identificador>_salida` (obligatorias en pareja) y, opcionales, `<identificador>_cache_escritura` y `<identificador>_cache_lectura`. Un precio no numérico, negativo o sin su pareja impide empezar. Reglas de precedencia: «Quién manda».

### Secciones que el ejemplo no trae

Tienen lector en el código y se añaden a mano:

| Sección | Qué es | Referencia |
|---|---|---|
| `perfiles` | Perfil de agente por rol, claves `<rol>_<campo>` con rol en `planner`, `qa`, `coder` y campo en `herramientas`, `rutas_escribir`, `pasos_max`, `pruebas_max`, `contexto_max_bytes`. Solo puede apretar. Una clave desconocida es un error | `core/ciclo/perfiles.js`, [GARANTIAS-Y-LIMITES.md](GARANTIAS-Y-LIMITES.md) |
| `puertas` | Comprobaciones adicionales que corren en el contenedor: `tipos`, `linter`, `seguridad`, `cobertura` (cada una un comando) y topes `timeout_s`, `timeout_total_s`, `salida_max_bytes`. Cualquier otra clave es un error con su línea | [puertas-de-calidad.md](puertas-de-calidad.md) |
| `integraciones` | `github_*`, `gitlab_*`, `jira_*` (`_modo`: `apagado`, `solo_lectura`, `comentar` o `proponer`; `_token_env`, `_destinos`, `_alcance`; `gitlab_host`; `jira_sitio`, `jira_usuario_env`) y `topes_operaciones_por_sesion` (1 a 1000, 20 por defecto). Con un proveedor activo, `_destinos` y `_token_env` son obligatorias | [INTEGRACIONES.md](INTEGRACIONES.md) |
| `instalacion` | Integración y perfil de instalación; ver arriba | `cli/comandos/instalar.js` |

## `forge.config.json` (raíz del proyecto)

Archivo aparte, de los hooks (`claude-hooks/shared/config.js`, `leerForgeConfig`). Si falta o es inválido se usan los valores por defecto. La plantilla está en `configuracion-ejemplo/forge.config.json`.

| Clave | Defecto | Lectura |
|---|---|---|
| `memoria.umbral_compresion_bytes` | `40000` | hook |
| `memoria.max_archivos_agente` | `3` | hook |
| `routing.usar_complexity_ir` | `true` | hook |
| `routing.complexity_umbral_opus` | `"high"` | hook |
| `guardrails.write_safety` | `true` | `claude-hooks/pre-tool-guard.js` |
| `guardrails.verify_local_imports` | `false` | `claude-hooks/pre-tool-guard.js` |
| `ignore_patterns` | `[]` | hook |

Los efectos concretos de `memoria.max_archivos_agente`, `routing.*` e `ignore_patterns` no se han verificado en esta revisión; solo consta que el lector los devuelve.

## Presets

`fragua init --preset <nombre>` **reemplaza** `.sdd/sdd.config.yaml` por `presets/<nombre>.yaml` y le añade los bloques `rutas`, `protecciones`, `figma`, `mapeos`, `memoria`, `compresion` y `control_versiones` del archivo anterior. Eso significa que las secciones `motor`, `sandbox`, `presupuesto`, `llm`, `sesion` y `perfil` del archivo anterior **se pierden** y vuelven a sus valores por defecto del código. Los presets definen `preset`, `agentes`, `comportamiento` y `calidad`.

| Preset | Agentes activos | `requerir_aprobacion_plan` | `cobertura_tests_minima` |
|---|---|---|---|
| `lean` | 6 (sonnet) | `false` | 60 |
| `startup` | 13 | `true` | 75 |
| `enterprise` | 14 | `true` (y `requerir_aprobacion_tareas: true`) | 85 |

(Conteo de líneas `activo: true` en cada archivo de `presets/`.)

## Modificar la configuración

```bash
npx fragua config show agentes          # una sección
npx fragua config get sesion.modo      # una clave
npx fragua config set sesion.modo rapido
npx fragua config validate
```

`config set` reemplaza el valor de una clave que ya existe, conservando sangría y comentarios; no crea claves nuevas. Dentro de Claude Code, `/sdd.configurar` hace lo mismo con más claves y presets. `config validate` solo comprueba lo descrito en [referencia-cli.md](referencia-cli.md#config); las secciones del ciclo se validan al ejecutar `fragua status`, `doctor` o `run`.

## No verificado

- Si el pipeline aplica `agentes.<nombre>.activo` de algún modo no determinista (por ejemplo, porque un comando le pida al modelo leerlo): no hay referencia en `commands/` más allá de `/sdd.configurar`.
- Los efectos de `forge.config.json` indicados arriba como no verificados.
- Que Claude Code aplique las claves marcadas «prompt» siempre que se ejecuta el comando: depende del modelo.
