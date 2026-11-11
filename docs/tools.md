# Herramientas (skills)

> Tipo: Referencia
> Última revisión: 2026-11-10 contra el commit 55a9dd9

Fragua incluye 31 skills: las carpetas de `skills/`, cada una con un `SKILL.md`. Esta página lista las 31, qué hace cada una según su `SKILL.md`, qué le entra, qué deja escrito y quién la usa. Estado del proyecto y cifras de referencia: [ESTADO-ACTUAL.md](ESTADO-ACTUAL.md). Inventario generado de cabeceras: [INVENTARIO-AGENTES-Y-SKILLS.md](INVENTARIO-AGENTES-Y-SKILLS.md).

## Qué es una skill y qué no es

Una skill es un archivo Markdown con instrucciones (a veces con bloques de shell o de Node que el modelo ejecuta con sus herramientas). **No es código que Fragua ejecute**: la carga y la sigue el modelo del anfitrión. Por eso su cumplimiento depende del modelo y no está garantizado por pruebas, salvo donde se indica. Los comandos (`commands/`) son las etapas del pipeline; una skill es un procedimiento que un comando, un agente o un hook nombra. Algunas skills no las nombra nadie (columna «Usada por»): solo actúan si el usuario o el modelo las invoca.

El motor del ciclo verificado (`forge run`, `resume`, `verificar`) no carga skills; ver [ciclo-verificado.md](ciclo-verificado.md).

## Dependencia del anfitrión

Cada `SKILL.md` se copia a `.claude/skills/` en Claude Code, y, con `fragua init --integracion <clave>`, tal cual a la carpeta de skills de otras herramientas: ver [RELACION-CON-CLAUDE-CODE.md](RELACION-CON-CLAUDE-CODE.md). Que un modelo de otra herramienta las siga con la misma fidelidad **no está verificado**. Clasificación, según lo que cada `SKILL.md` exige:

- **A, portable**: solo pide leer/escribir archivos y ejecutar comandos de shell. Funciona en cualquier anfitrión con esas capacidades.
- **CC, depende de Claude Code**: necesita la herramienta `Task` (subagentes) o un hook de `claude-hooks/` que alimenta sus datos. En otro anfitrión no hay hooks (ver [hooks.md](hooks.md)), así que los archivos que leen no se generan.

`TodoWrite` no lo declara ninguna skill; lo usa el comando `/sdd.implementar` (`allowed-tools: Read, Write, Edit, Bash, Task, TodoWrite`).

## Tabla de las 31 skills

| Skill | Qué hace | Entra → sale | Usada por | Dep. |
|---|---|---|---|---|
| `adr-indexer` | Indexa decisiones escritas en el código como `# ADR: {json}` | comentarios ADR → `.sdd/arquitectura/ADRs.jsonl` | el hook `agent-memory.js` escribe ese archivo; la skill sirve para consultarlo | CC (hook) |
| `cache-audit` | Revisa `.claude/agents/*.md` buscando bloques estables para `cache_control` y tres patrones que invalidan la caché (marcas de tiempo, UUID, JSONL embebido) | archivos de agentes → lista de recomendaciones | nadie; invocación manual | A |
| `compresion-tokens` | **Deprecada.** Solo redirige al gestor de contexto (`claude-hooks/context-manager.js`) | — | nadie | A |
| `constitucion-constraint` | Extrae de la constitución solo las reglas aplicables y comprueba un plan o código contra ellas | artefacto + `.sdd/memoria/constitucion.md` → veredicto de cumplimiento | `/sdd.planificar`, `/sdd.desplegar`, agente `arquitecto` | A |
| `critica-diseno` | Puntúa el wireframe en 5 dimensiones (1-5); si la nota es menor de 4 y van menos de 3 iteraciones, lo reescribe | wireframe HTML → wireframe refinado + `critica-wireframe.md` en `.sdd/diseño/` | `/sdd.diseñar`, `/sdd.exportar` | A |
| `decompose-to-ui-kit` | Descompone una imagen o descripción de UI en componentes del sistema de diseño | imagen o texto → `.sdd/design/components-kit.md` y `tokens.css` | agente `product-designer` | A |
| `deploy-vercel` | Alias de `vercel-deploy`: apunta a su procedimiento | — | `/forge` (rutas `/forge.desplegar vercel` y `/forge deploy`) | A |
| `descubrir-idea` | Hace 5 preguntas sobre la idea antes de interpretarla | respuestas del usuario → `.sdd/descubrimiento.md` | `/sdd.interpretar`, `/sdd.exportar` | A |
| `deteccion-stack` | Detecta lenguaje, framework, base de datos, pruebas y build leyendo archivos de configuración | árbol del proyecto → stack detectado | `/sdd.constitucion`, `/sdd.crear-app`, `/sdd.desplegar` | A |
| `effort-router` | Recomienda esfuerzo (low/medium/high/max) y modelo (Haiku/Sonnet/Opus) por fase y agente | nombre de la fase → recomendación | nadie directamente (la citan `token-budget` y `resource-selector`) | A |
| `elegir-direccion` | Propone 3 de 5 direcciones visuales según el producto y la audiencia; el usuario elige una | `.sdd/ir.json` → `design_direction` y `design_system_path` en `.sdd/estado.json` | `/sdd.diseñar`, `/sdd.exportar` | A |
| `enrutador-agentes` | Decide qué agente activa cada tarea según tipo, fase y configuración | tarea + config → agente elegido | `/sdd.implementar`, `/sdd.crear-agente` | A |
| `explicame` | Lee el estado del proyecto y lo cuenta sin jerga: qué se hizo, por qué, qué sigue | `.sdd/` → explicación en el chat | `/forge`; el instalador la menciona (`cli/comandos/instalar.js`) | A |
| `gestion-estado` | Describe cómo leer y escribir `.sdd/estado.json` y `.estado-tareas.json` para reanudar entre sesiones | estado → estado actualizado | ningún comando la nombra | A |
| `github-connect` | Crea el repositorio en GitHub, configura el remoto y hace el primer push | proyecto local → repositorio remoto | `/sdd.constitucion` | A (requiere `git`/`gh` y credenciales) |
| `indexador` | Detecta lenguajes y genera mapas estáticos (estructura, símbolos, dependencias) con expresiones regulares | proyecto → mapas en `.sdd/mapa/` | `/sdd.mapear` (lo declara en su cabecera) | A |
| `indexar-proyecto` | Genera un índice de símbolos de archivos JS/TS | proyecto → `.sdd/arquitectura/ast-index.jsonl` | `/sdd.estado` | A |
| `interpretar-idea` | Convierte la idea en un IR (JSON) en dos fases: razonamiento libre y extracción | idea + `descubrimiento.md` → `.sdd/ir.json` (tras confirmar) y `ir-analysis.md` | `/sdd.interpretar`, `/sdd.exportar` | A |
| `mejorar-prompt` | Reescribe un prompt vago con estructura (contexto, tarea, restricciones, formato, verificación) y avisa si se sale de la spec activa | prompt → prompt mejorado | nadie; invocación manual | A |
| `memory-compactor` | Deduplica y resume `.sdd/memoria/agente-*.md` cuando pasan de 50 KB | memoria de agente → memoria reducida | el `SKILL.md` dice que lo dispara `agent-memory.js`; **no verificado**: ese hook no contiene lógica de compactación | A |
| `modo-guiado` | Fija cómo hablar con quien no programa: sin jerga, qué confirmar, decisiones técnicas tomadas por el modelo | `perfil: guiado` en `estado.json` o `sdd.config.yaml` → cambia el estilo, no los controles | `/forge`, `/sdd`, `/sdd.aclarar`, `/sdd.constitucion`, `/sdd.desplegar` | A |
| `mutation-detector` | Agrupa por archivo los cambios registrados (cuántas veces y quién lo modificó) para señalar inestabilidad | `.sdd/observabilidad/mutaciones.jsonl` → informe | nadie; el archivo lo escribe el hook `agent-memory.js` | CC (hook) |
| `observabilidad-consumo` | Resume `.sdd/observabilidad/consumo.jsonl`: invocaciones por agente, archivos tocados, picos | ledger → informe | `/sdd.estado` | CC (hook) |
| `orquestacion-ptc` | Patrón de llamada programática: despachar subagentes independientes en paralelo y agregar solo resultados mínimos | lista de tareas → resultados resumidos | `/sdd.implementar`, `/sdd.analizar` | **CC** (`allowed-tools: Read, Task`) |
| `resource-selector` | Elige qué agentes y skills cargar según complejidad, tipo de producto y etapa | `ir.json`, `estado.json`, `sdd.config.yaml` → lista mínima | `/sdd.planificar`, `/sdd.implementar` | A |
| `share-progress` | Genera un resumen en Markdown del estado del pipeline (fases, tareas, agentes) | `.sdd/` → texto para compartir | `/forge` (rutas `/forge.compartir`, `/forge share`) | A |
| `token-budget` | Estima el presupuesto de tokens por fase pendiente y recomienda paralelo o serie | estado + ledger → estimación | nadie directamente | A (usa el ledger si existe) |
| `validacion-spec` | Comprueba un mínimo de calidad de la spec activa antes de pasar de fase | `spec.md` → aprobada o motivos | nadie por nombre | A |
| `vercel-deploy` | Despliega a Vercel: comprobaciones previas, build, comprobación de salud, vuelta atrás si falla | proyecto → despliegue | `/sdd.implementar`; `deploy-vercel` apunta aquí | A (requiere CLI de Vercel y cuenta) |
| `verificador-implementacion` | Contrasta el código con los criterios de aceptación de la spec leyendo código y pruebas | `spec.md` + código → `verificacion.md` | nadie por nombre | A |
| `wireframe-mvp` | Genera el wireframe HTML de la pantalla P0 con el `DESIGN.md` activo | `product-design.json` + `DESIGN.md` → `.sdd/diseño/wireframe-pantalla-principal.html` | `/sdd.diseñar`, `/sdd.exportar`, agente `product-designer` | A |

## Advertencias que se desprenden de la tabla

- **`mutation-detector` no es la medición de pruebas por mutación.** Esta skill lee un registro de cambios de archivos (`mutaciones.jsonl`). La medición que altera el código y ejecuta las pruebas es `core/ciclo/mutacion.js` y no usa skills. Ver [GLOSARIO.md](GLOSARIO.md).
- **`verificador-implementacion` no es `forge verificar`.** La skill es una instrucción para el modelo; `forge verificar` es código determinista que decide por el código de salida de las pruebas ([ciclo-verificado.md](ciclo-verificado.md)).
- Las skills de despliegue y de GitHub actúan sobre servicios externos con las credenciales del usuario; no se han probado contra esos servicios en este repositorio (**no verificado**).
- El modelo declarado en la cabecera (`model:`) existe solo en 14 de las 31 skills.
- «Usada por» sale de buscar el nombre de la skill en `commands/`, `agents/`, `claude-hooks/`, `core/` y `cli/`. Una skill sin usuario puede cargarse igualmente por su descripción cuando el modelo la considera pertinente.

## Añadir una skill

Una carpeta `skills/<nombre>/SKILL.md` con cabecera (`name`, `description`, opcionalmente `model` y `allowed-tools`). Formato y límites: [extending-forge.md](extending-forge.md).
