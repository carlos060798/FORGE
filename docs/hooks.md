# Hooks de Claude Code

> Tipo: Referencia
> Última revisión: 2026-11-10 contra el commit 7683f83

Inventario de los archivos de [claude-hooks/](../claude-hooks/), qué evento de Claude Code dispara cada uno y qué settings los registran. El comportamiento detallado de cada hook está en [runtime.md](runtime.md); su papel en el conjunto, en [architecture.md](architecture.md).

Dos aclaraciones previas:

- Los hooks son una integración con **Claude Code**. El motor (`forge run`, `forge resume`, `forge verificar`) no depende de ellos: sus controles viven en `core/` (aislamiento, perfiles, estado sellado).
- El guardián se describe a sí mismo en su cabecera como «una RED DE SEGURIDAD, no un límite»; la defensa principal es `permissions.deny` gestionado y el aislamiento ([SECURITY.md](../SECURITY.md)).

## Inventario

Hay 8 archivos `.js` directamente en `claude-hooks/` (contados el 2026-11-10), más la carpeta `shared/`. Solo algunos son hooks que Claude Code dispara; otros son herramientas de consulta que invocan agentes y comandos.

| Archivo | Tipo | Función | Versión `.sh` |
|---|---|---|---|
| `pre-tool-guard.js` | Hook `PreToolUse` (sin filtro de herramienta) | Guardián: bloquea comandos, rutas y escrituras prohibidos antes de la llamada | Sí, solo delega en Node |
| `agent-memory.js` | Hook `PostToolUse` (`Write\|Edit`) | Memoria de agentes, ledger de consumo, registro de mutaciones, extracción de ADR | Sí, delega en Node |
| `post-write-conventions.js` | Hook `PostToolUse` (`Write\|Edit`) | Valida el archivo escrito contra la constitución, la configuración y las convenciones detectadas | Sí, delega en Node |
| `ast-indexer.js` | Hook `PostToolUse` (`Write\|Edit`), solo en el `settings.json` de este repositorio | Índice de símbolos JS/TS en `.sdd/arquitectura/ast-index.jsonl` | No |
| `context-manager.js` | Hook `PostToolUse` (sin filtro), solo en el `settings.json` que instala el plugin | Presupuesto y contexto: umbrales de gasto, avisos de resultados voluminosos, rotación del ledger. Solo registra y evalúa gasto si el evento trae recuentos de tokens; que Claude Code los incluya en el evento de `PostToolUse`: no verificado | No |
| `ast-query.js` | Herramienta de línea de comandos | Consulta el índice AST (`--archivo`, `--tipo`, `--buscar`, `--stats`) | No |
| `query-memory.js` | Herramienta de línea de comandos | Consulta el índice de memoria (`--agente`, `--ultimas`, `--buscar`, `--archivo`, `--stats`) | No |
| `model-registry.js` | Módulo | Asigna proveedor y nivel de esfuerzo a un agente para etiquetar el consumo en el ledger; no elige el modelo del motor | No |

`shared/` contiene `config.js` (lectura de `forge.config.json` y `sdd.config.yaml`, nivel de ejecución, cola de fallos), `entorno.js` (lectura de variables `FRAGUA_*` / `FORGE_*`) y copias de las reglas del guardián (`guardian-reglas.js`, `protegidos.js`). En el repositorio estas dos últimas reexportan la fuente única, `core/evidencia/`; al instalar en un proyecto, `forge init` las sustituye por copias autónomas, porque el proyecto no tiene `core/` (prueba: `tests/hook-instalado.test.js`).

## Requisito: Node 20 o superior

**No existe un modo «sin Node» con lógica reducida.** Los `.sh` buscan Node 20 o superior y ejecutan el `.js`. Si no lo hay, `pre-tool-guard.sh` **bloquea la acción (código de salida 2)** en vez de dejarla pasar: el análisis de las órdenes se hace en JavaScript y se decidió no adivinar con `grep` (véase `claude-hooks/pre-tool-guard.sh`, informe SEGURIDAD-CIBER C-07).

Consecuencia práctica: usar FORGE con hooks en un proyecto Python, Go o Rust exige Node 20 o superior en la máquina, aunque el proyecto no lo use.

## Protocolo

Claude Code envía el evento como JSON por la entrada estándar. El código de salida `0` permite; el `2` bloquea (en `PreToolUse` la herramienta no se ejecuta; en `PostToolUse` ya se ejecutó y el mensaje de la salida de error llega al agente). El guardián **falla cerrado**: si no puede leer el evento o cargar sus módulos, sale con `2`.

La forma de los eventos que consume cada hook se fija en `tests/hooks-contract.test.js` con ejemplos estáticos; la compatibilidad con versiones de Claude Code se trata en [COMPATIBILIDAD.md](COMPATIBILIDAD.md).

## Qué bloquea el guardián

Resumen de [pre-tool-guard.js](../claude-hooks/pre-tool-guard.js) y de las reglas de [core/evidencia/guardian-reglas.js](../core/evidencia/guardian-reglas.js) (con pruebas en `tests/guardian-reglas.test.js`, `tests/guardian-endurecido.test.js` y `tests/pre-tool-guard.test.js`):

- **Escritura (`Write`, `Edit`, `MultiEdit`, `NotebookEdit`):**
  - rutas críticas del guardián: `claude-hooks/`, `.claude/settings*`, `.claude/hooks/`, `.git/`, `.sdd/execution-level.json` y `.sdd/aprobaciones.jsonl`;
  - archivos de secretos (`.env` y variantes, salvo `.env.example`, `.env.template`, `.env.sample`) y la clave de estado del usuario;
  - nombres cortos 8.3 de Windows (`ARCHIV~1.TXT`) que pueden apuntar a otro archivo;
  - configuración de calidad protegida (tipos, linter, seguridad, cobertura), según [core/evidencia/protegidos.js](../core/evidencia/protegidos.js);
  - contenido con un patrón prohibido por un ADR aceptado (sección `## Patrones prohibidos`);
  - contenido con aspecto de secreto (claves de Anthropic, OpenAI, AWS, tokens de Slack y de GitHub, clave privada, asignaciones `password=`, `api_key=`, etc.);
  - `Edit` / `MultiEdit` sobre un archivo que no existe;
  - escritura de los **agentes de solo lectura**: `arquitecto`, `asesor-datos`, `critico`, `seguridad`, `investigador`, `revisor` y `disenador-api`.
- **`Read`:** lectura de archivos de secretos.
- **`Bash` / `PowerShell`:** el comando se trocea en argumentos (se entienden `;`, `&&`, `|`, `$(…)` y `bash -c`) y se bloquean borrados recursivos de la raíz, la carpeta personal o el directorio actual, `git push` forzado, de borrado o espejo, `git reset --hard`, `git clean` destructivo, `git reflog expire`, `git gc --prune=now`, `chmod 777`, redirecciones o escrituras hacia archivos protegidos, lectura de secretos con lectores comunes y código de intérpretes (`node -e`, `python -c`…) que toque secretos. Una segunda línea de expresiones regulares cubre además `DROP DATABASE` y `DROP SCHEMA`. Los agentes de solo lectura tampoco pueden escribir por la terminal.
- **Nivel de ejecución:** si `.sdd/execution-level.json` dice `sandbox` (lo escribe el circuit breaker tras fallos consecutivos), se bloquea toda ejecución de `Bash` / `PowerShell` y las escrituras fuera del proyecto.
- **Solo avisa, sin bloquear:** `git push`, `merge`, `rebase`, `reset`, `DROP TABLE`, `DELETE FROM`, `TRUNCATE`, `npm publish`, `terraform apply` / `destroy`, `kubectl delete`, `helm uninstall`. La versión anterior de este documento listaba `DROP TABLE` como bloqueado; no lo es.

Dos advertencias de alcance:

- Las guardas por agente dependen de la variable `CLAUDE_AGENT_NAME`. Si no está definida, el hook lo avisa por la salida de error y esas guardas **quedan desactivadas**.
- Que el análisis por argumentos sea más difícil de esquivar que una expresión regular no lo convierte en infalible. Los límites de lo que se garantiza están en [GARANTIAS-Y-LIMITES.md](GARANTIAS-Y-LIMITES.md).

## Qué registra cada `settings.json`

Hay dos `settings.json` y **no registran lo mismo**:

| Archivo | Hooks registrados |
|---|---|
| `.claude/settings.json` (este repositorio) | `pre-tool-guard`, `agent-memory`, `post-write-conventions`, `ast-indexer` (rutas `claude-hooks/…`) |
| `.claude-plugin/.claude/settings.json` (plantilla que instala `forge init`) | `pre-tool-guard`, `context-manager`, `agent-memory`, `post-write-conventions` (rutas `.claude/hooks/…`) |

`forge init` copia `claude-hooks/` a `.claude/hooks/` y la plantilla a `.claude/settings.json`, sin sobrescribir uno existente ([cli/comandos/instalar.js](../cli/comandos/instalar.js)). `forge doctor` comprueba que existan en `.claude/hooks/` y tengan sintaxis válida exactamente estos cuatro: `pre-tool-guard.js`, `agent-memory.js`, `post-write-conventions.js` y `context-manager.js` ([cli/comandos/doctor.js:356](../cli/comandos/doctor.js)). Por eso, ejecutado en este repositorio —cuyo `settings.json` no registra `context-manager`— el diagnóstico no es equivalente al de un proyecto instalado. Unificar ambos `settings.json` sigue pendiente de decidir.

## Variable `FORGE_EDITAR_GUARDIAN`

Por defecto el guardián **impide** editar `.claude/settings*.json`, `.claude/hooks/**`, `claude-hooks/**`, `.sdd/execution-level.json`, `.sdd/aprobaciones.jsonl` y `.git/**`. Si eres el dueño del proyecto y necesitas modificarlos, lanza Claude Code con `FORGE_EDITAR_GUARDIAN=1` en el entorno. Desactiva solo esa protección (no desbloquea secretos) y solo debe fijarla una persona, nunca un agente. Origen: spec `2026-11-06-guardian-endurecido`; véase también [SECURITY.md](../SECURITY.md).

Nota: el guardián lee esta variable directamente de `process.env`, y la prueba `tests/entorno-fragua.test.js` la marca como violación de la regla «las variables se leen por un módulo». La propia prueba define una excepción (`EXCEPCION_GUARDIAN`) para ese archivo y esa variable; si esa prueba falla, hay que alinear prueba y código.

## Otras variables de entorno que leen los hooks

| Variable | Hook | Efecto |
|---|---|---|
| `CLAUDE_AGENT_NAME` | `pre-tool-guard`, `agent-memory` | Identifica al agente activo |
| `FRAGUA_BUDGET_WARN_USD` / `FORGE_BUDGET_WARN_USD` (0,50 por defecto) | `context-manager` | Umbral de aviso de gasto |
| `FRAGUA_BUDGET_BLOCK_USD` / `FORGE_BUDGET_BLOCK_USD` (1,00 por defecto) | `context-manager` | Umbral de gasto a partir del cual el hook termina con código 2 (según su comentario, para agentes `opus`) |
| `FRAGUA_TOOL_MAX_BYTES` / `FORGE_TOOL_MAX_BYTES` (50 000 por defecto) | `context-manager` | Tamaño a partir del cual avisa de un resultado de herramienta voluminoso |
| `FRAGUA_LEDGER_MAX_BYTES` / `FORGE_LEDGER_MAX_BYTES` (5 000 000 por defecto) | `context-manager` | Tamaño del ledger antes de rotarlo |

Si las dos formas de una variable existen con valores distintos, ninguna se elige y el hook usa su valor por defecto ([claude-hooks/shared/entorno.js](../claude-hooks/shared/entorno.js)).

## Hooks de fase del usuario (`.sdd/hooks/`)

No son hooks de Claude Code. `forge init` crea `.sdd/hooks/README.md`, que lista nombres como `antes_implementar.sh` o `despues_cada_tarea.sh`. Los ejecutan los **comandos Markdown**, no el motor ni los hooks de Claude Code: por ejemplo [commands/sdd.implementar.md](../commands/sdd.implementar.md) contiene líneas del tipo `[ -f ".sdd/hooks/antes_implementar.sh" ] && bash .sdd/hooks/antes_implementar.sh`. Es decir, el script lo lanza el modelo siguiendo las instrucciones del comando; `forge run` no los invoca.

Esa línea no detiene el comando si el script falla, y el código no define variables como `SDD_SPEC_ACTIVA` o `SDD_PIPELINE_STEP`: una versión anterior de [extending-forge.md](extending-forge.md) las documentaba y no existen. Si cancelar el flujo ante un fallo está garantizado en todos los comandos: no verificado.
