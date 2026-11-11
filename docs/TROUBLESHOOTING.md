# Resolución de problemas

> Tipo: Guía
> Última revisión: 2026-11-10 contra el commit 55a9dd9

Organizada por síntoma, causa y qué hacer. Los mensajes entre comillas se buscaron en el código (`core/`, `cli/`, `claude-hooks/`); cada uno indica su origen. Lo que depende del comportamiento del modelo no se cita como mensaje fijo.

Otras guías, para no duplicar:

- Recuperación de escenarios de proyecto (deploy fallido, cambio de idea): [QUE-PASA-SI-FALLA.md](QUE-PASA-SI-FALLA.md).
- Defectos y límites abiertos del ciclo: [PROBLEMAS-CONOCIDOS.md](PROBLEMAS-CONOCIDOS.md).
- Opciones y códigos de salida de cada subcomando: [referencia-cli.md](referencia-cli.md).
- Qué está probado y qué no: [ESTADO-ACTUAL.md](ESTADO-ACTUAL.md).

**Primer paso ante cualquier duda:** `npx fragua doctor` (diagnostica Node, Docker, hooks, configuración y proveedor; sale con 0 aunque encuentre problemas) y `npx fragua status` (paso del pipeline).

---

## Docker

### `run`, `resume` o `verificar` terminan con código de salida 4

- **Causa:** el ciclo verificado exige Docker y no lo encuentra, o `sandbox.runtime` pide un mecanismo de aislamiento que Docker no tiene (`core/engine-cli.js`, tras `comprobarEntorno`). Imprime «El ciclo verificado no ejecuta código generado fuera del entorno aislado.» y «Arranca Docker y vuelve a intentarlo.».
- **Qué hacer:** ejecuta `npx fragua doctor`; distingue tres casos (`core/sandbox/diagnostico.js`):
  - **No instalado:** instala Docker Desktop (Windows/macOS) o Docker Engine (Linux).
  - **Instalado, no arrancado:** abre Docker Desktop y espera a «Engine running», o en Linux arranca el demonio (por ejemplo `sudo systemctl start docker`).
  - **Sin permisos:** en Windows, añade tu usuario al grupo «docker-users» (como administrador) y reinicia sesión; en Linux, `sudo usermod -aG docker $USER` y reinicia sesión.
  - Si el motivo es `sandbox.runtime`, instala ese mecanismo en Docker o quita la clave de `.sdd/sdd.config.yaml`.
- **Alternativa con aviso:** `npx fragua run --motor clasico` ejecuta las pruebas en tu equipo, **sin aislamiento**. Un `motor.modo: clasico` en la configuración no basta; hay que pedirlo en la orden.
- **Límite:** Docker real solo se ha probado en Windows; Linux y macOS, no verificado (ver [ESTADO-ACTUAL.md](ESTADO-ACTUAL.md)).

### `doctor` no clasifica el fallo de Docker

`clasificarFalloDocker` devuelve `otro` si el texto de error no encaja en los tres casos anteriores (por ejemplo, tiempo agotado). El mensaje es entonces «Sin Docker el ciclo verificado no empieza (código de salida 4)…». Ejecuta `docker version` a mano para ver el error original.

---

## El ciclo se pausa (código de salida 3)

- **Síntoma:** `run` o `resume` imprime «N tarea(s) esperan tu decisión:» y sale con 3.
- **Causa:** el ciclo pide revisión humana. Los motivos que muestra (`MOTIVOS_LEGIBLES` en `core/engine-cli.js`; la decisión se toma en `core/ciclo/router.js` y `core/ciclo/nodos.js`):

| Motivo | Significado | Sugerencia (orientativa) |
|---|---|---|
| `iteraciones` | máximo de ejecuciones sin que pasen las pruebas | `--iteraciones-extra N` o revisar la tarea |
| `presupuesto` | tope de gasto de la sesión alcanzado | ver «Tope de gasto» |
| `infraestructura` | falló el entorno de ejecución o el proveedor de modelos | revisar Docker (`doctor`) y la clave |
| `sin_progreso` | las pruebas fallan igual varias veces: pueden estar rotas | revisar las pruebas a mano |
| `exito_sospechoso` | pasan, pero hay señales de que no demuestran nada | leer el detalle impreso |
| `pruebas_no_fallan` | las pruebas nuevas pasan sin implementación | reescribir las pruebas |
| `pruebas_debiles` | pasan, pero detectan pocos cambios deliberados | reforzar las pruebas |
| `dependencias` | el implementador propone cambiar dependencias | decidir a mano |
| `salida_invalida` | un agente no devolvió una salida utilizable | leer el detalle |
| `perfil`, `puerta`, `regresion` | perfil de rol no resoluble, puerta de calidad o pruebas `no_cambiar` fallan | leer el detalle impreso |

- **Qué hacer:** mientras no decidas, no se gasta nada. Elige con `npx fragua resume --decision continuar|aceptar|abortar` (`continuar` admite `--iteraciones-extra N` y `--presupuesto-extra USD`; `abortar` restaura los archivos). Aviso: `aceptar` antes de implementar cierra la tarea sin código (C-8 en [PROBLEMAS-CONOCIDOS.md](PROBLEMAS-CONOCIDOS.md)).
- **No verificado:** la columna «Sugerencia» es una recomendación de esta guía; el código solo fija el texto de la causa.

### Tope de gasto

- **Síntoma:** motivo `presupuesto`: «se alcanzó el tope de gasto de la sesión».
- **Causa:** se superó `presupuesto.tope_usd` (2,00 USD por defecto) o `FRAGUA_BUDGET_USD` ([referencia-cli.md](referencia-cli.md#run)).
- **Qué hacer:** `npx fragua resume --decision continuar --presupuesto-extra <USD>`, o cambia el tope con `npx fragua config set presupuesto.tope_usd <valor>`. Si el proveedor no devuelve datos de consumo, se anota una estimación por lo alto (`core/ciclo/index.js`), así que el tope puede cortar antes del gasto real.

### Sin clave del proveedor

- **Síntoma:** «ANTHROPIC_API_KEY no está definida — el engine correrá en modo stub.» (`core/engine-cli.js`).
- **Qué hacer:** exporta la clave en el entorno y revisa con `npx fragua doctor`. Que el proveedor no dé error sin clave es un límite conocido (C-12 en [PROBLEMAS-CONOCIDOS.md](PROBLEMAS-CONOCIDOS.md)).

---

## La spec no avanza a plan

- **Síntoma:** «La spec debe aprobarse antes de planificar — ejecuta: forge aprobar spec» (`core/state-machine.js`), o «La spec no tiene una aprobación registrada y vigente en .sdd/aprobaciones.jsonl…» (`core/aprobaciones-identidad.js`).
- **Causa:** falta la aprobación humana, o la spec cambió después de aprobarse (la aprobación guarda el hash del archivo).
- **Qué hacer:** ejecuta `npx fragua aprobar spec` en una **terminal interactiva real** y teclea el código de un solo uso que muestra. No tiene opciones para saltarlo (con una opción desconocida responde «“forge aprobar” no tiene opciones», `cli/comandos/aprobar.js`). Desde un script o desde el chat de Claude Code no funciona, por diseño. `fragua step <paso> --force --motivo ".."` existe en la CLI pero sortea la comprobación: úsalo solo si sabes por qué.

---

## Node, instalación y hooks

### Node menor que 20

- **Síntoma de `doctor`:** «Node X es < 20. Actualiza Node.» (`cli/comandos/doctor.js`). `package.json` exige `>=20.0.0`.
- **Guardián de hooks:** si no hay Node >= 20, `claude-hooks/pre-tool-guard.sh` **bloquea** la acción en vez de dejarla pasar (falla cerrado): «[pre-tool-guard] BLOQUEADO: no hay Node >= 20 (o falta pre-tool-guard.js junto a este script).».
- **Qué hacer:** instala Node 20 o superior. Con Node < 22.5 la memoria usa archivos markdown en vez de SQLite y el almacén de decisiones pierde la búsqueda semántica (aviso de `doctor`).

### Nombre del paquete y del comando

El binario se llama `fragua`, con `forge` y `sdd-es` como alias (`package.json`, `bin`). El paquete **no está publicado** (ver [ESTADO-ACTUAL.md](ESTADO-ACTUAL.md)): los `npx fragua ...` de las guías suponen una instalación futura o local. Detalle de nombres: [referencia-cli.md](referencia-cli.md#órdenes-y-nombres). Un subcomando mal escrito da «Comando desconocido: '<x>'. Usa '<orden> --help'.» y sale con 1.

### Los comandos `/sdd.*` no hacen nada en la terminal

Son instrucciones para Claude Code (archivos de `commands/`), no comandos de shell. Escríbelos en el chat de Claude Code. Para la terminal, usa los subcomandos de `fragua` ([referencia-cli.md](referencia-cli.md)).

### Los hooks no bloquean nada

- **Causa posible:** los hooks no están registrados en `.claude/settings.json` (los registra `init`/`update`) o Claude Code no recargó la configuración.
- **Qué hacer:** `npx fragua update` re-copia el núcleo sin tocar `.sdd/` ni tus ajustes; comprueba con `doctor` y reinicia la sesión de Claude Code.
- **No verificado:** que cada versión de Claude Code ejecute los hooks igual en todas las plataformas.

---

## Bloqueos del guardián (`pre-tool-guard`)

Mensajes que produce `claude-hooks/pre-tool-guard.js`. Un bloqueo sale con código 2 y Claude Code muestra el texto.

| Mensaje (extracto) | Causa | Qué hacer |
|---|---|---|
| «FORGE evitó esta acción (…)» + «Comando bloqueado» | comando de la lista prohibida (análisis por argv) | si estás seguro, ejecútalo tú en tu terminal |
| «el agente "X" solo puede leer…» | un agente de solo lectura intentó escribir, con la herramienta o por la shell | usa un agente con permiso de escritura; el rol se cambia en la configuración |
| «contiene secretos y un agente no lo lee» | lectura de `.env` u otro archivo de secretos | usa `.env.example` |
| «es parte del guardián (hooks, registro de hooks, nivel de ejecución o .git)» | un agente intentó modificar los controles | edítalo a mano si es intencional |
| «escritura fuera del proyecto bloqueada» / «CircuitBreaker activo» | nivel `sandbox` tras fallos consecutivos | resuelve los errores antes de continuar |
| «Violación de ADR: …» | el contenido contiene un patrón que un ADR prohíbe | revisa `.sdd/arquitectura/` |
| «el archivo "…" no existe» (Edit) | edición de un archivo inexistente | usa Write para crearlo |
| «incluye una contraseña o clave secreta» | el contenido a escribir parece una credencial | usa variables de entorno |
| «el guardián no pudo leer el evento…» | JSON ilegible: falla cerrado | reintenta; si persiste, ejecuta `doctor` |

Las advertencias (por ejemplo `git push`, `DROP TABLE`) no bloquean: avisan.

---

## Pruebas del propio repositorio

- **`npm test` falla de forma intermitente en una máquina lenta:** algunas pruebas dependen de tiempo y disco; el estado y la cuarentena están en [ESTADO-ACTUAL.md](ESTADO-ACTUAL.md).
- **`SyntaxError: Cannot use import statement …` o `require is not defined`:** el proyecto es ESM (`"type": "module"`); un archivo usa `require()`. Es un error de Node, no de Fragua.
- **Una prueba de consistencia falla por un comando, agente o skill sin registrar:** el archivo existe pero no está en `.claude-plugin/plugin.json`. Añádelo al array correspondiente; el mensaje exacto lo da la prueba (`tests/`).

---

## Memoria y contexto

- **La memoria de un agente crece mucho:** se guarda en `.sdd/memoria/agente-<nombre>.md` (formato markdown) y el hook comprime al superar `umbral_bytes` (`claude-hooks/agent-memory.js`, valor por defecto en `claude-hooks/shared/config.js`). Existe `/sdd.comprimir` (`commands/sdd.comprimir.md`). La clave exacta de `sdd.config.yaml` para el umbral: no verificada en esta revisión.
- **Claude no tiene contexto del proyecto:** comprueba que la sesión se abrió en la raíz del proyecto y que existe `.sdd/estado.json` (`npx fragua state`). Si no existe, el proyecto no está inicializado (`npx fragua init`).

---

## Si nada de esto explica el problema

Reúne la salida de `npx fragua doctor` y `npx fragua status`, el mensaje exacto y el comando que lo provocó, y compáralo con [PROBLEMAS-CONOCIDOS.md](PROBLEMAS-CONOCIDOS.md) antes de abrir una incidencia.

## Qué se quitó respecto a la versión de junio

Mensajes que no existen en el código: `IR validation failed: missing required field 'product.name'`, `Error: spec.md not found for spec ID`, `ConstitutionViolation`, `Task bloqueada: decisión arquitectónica…`, `Verificación fallida: CA-[N] no cubierto`, `Hook bloqueó la operación…`, `Hook bloqueó Write…`. También las entradas sobre `npx forge-sdd` (nombre de paquete incorrecto), `forge ui` solo con `--ui` y «Cannot find module 'sdd-es'», y la ruta `.sdd/observabilidad/hooks.log`, no comprobadas.
