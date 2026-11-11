# Extender Fragua

> Tipo: Guía
> Última revisión: 2026-11-10 contra el commit 55a9dd9

Cómo añadir un agente, un comando, una skill, un hook de proyecto o una regla de constitución, qué formato espera cada uno y qué límites tiene. Los pasos que exigen las pruebas, con los archivos exactos que hay que tocar, están en [CONTRIBUTING.md](../CONTRIBUTING.md). Aquí está el contenido de cada pieza. Para saber dónde vive cada módulo: [mapa-de-modulos.md](mapa-de-modulos.md).

## Qué se puede extender y hasta dónde

| Pieza | Dónde | Qué recibe | Límite principal |
|---|---|---|---|
| Agente | `agents/<nombre>.md` | Se invoca desde un comando con la herramienta `Task` de Claude Code | **Solo existe en Claude Code.** Otras herramientas no reciben agentes. El ciclo verificado usa tres roles fijos y un agente nuevo no entra en él |
| Comando | `commands/<nombre>.md` | Un `/<nombre>` en Claude Code, y una skill generada para otras herramientas | La skill generada copia el cuerpo sin cambios: lo que dependa de Claude Code no funciona fuera |
| Skill | `skills/<nombre>/SKILL.md` | Cualquier herramienta compatible con el formato abierto de skills | `allowed-tools` es experimental en ese formato |
| Hook de proyecto | `.sdd/hooks/<antes\|despues>_<comando>.sh` | Lo ejecuta el texto del comando | **No lo ejecuta el motor**: depende de que el modelo siga el comando. No cancela nada |
| Regla de constitución | `.sdd/memoria/constitucion.md` | Los agentes la leen; un hook aplica tres patrones | Solo tres reglas se aplican por máquina |
| Proveedor de modelos | `core/llm-providers/` | El ciclo verificado | Guía propia: [guia-anadir-proveedor.md](guia-anadir-proveedor.md) |
| Puerta de calidad | Sección `puertas:` de `sdd.config.yaml` | Se ejecuta tras las pruebas, en el mismo contenedor | [puertas-de-calidad.md](puertas-de-calidad.md) |

Cualquier cambio en el repositorio de Fragua sigue el flujo de [CONTRIBUTING.md](../CONTRIBUTING.md): una especificación en `.sdd/especificaciones/`, pruebas antes que código, y un ADR si la decisión no es trivial. Añadir un agente, comando o skill además obliga a actualizar las cifras que repiten los documentos.

## Agente

Un agente es un Markdown con una cabecera YAML y un cuerpo con su rol. No hay plantilla en `plantillas/`: copia uno existente parecido (`agents/revisor.md` para uno de solo lectura, `agents/tester.md` para uno que escribe) y respeta su cabecera.

```markdown
---
name: auditor-accesibilidad
description: Audita componentes de interfaz contra WCAG 2.1 y reporta las violaciones. Solo lee.
model: sonnet
color: orange
tools: ["Read", "Grep", "Glob"]
goal: "Que cada violación reportada lleve el criterio WCAG y el archivo"
backstory: "Una auditoría sin criterio citado no se puede corregir"
---

# Agente: Auditor de accesibilidad

## Rol
...
```

Lo que comprueban las pruebas de catálogo (`tests/catalogo.test.js`, `tests/agent-cabecera-tools.test.js`):

- `name` igual al nombre del archivo; `description` no vacía.
- `model` solo `opus`, `sonnet` o `haiku` (alias, no identificadores de modelo concretos).
- `tools` como **lista entre corchetes y entre comillas**, no vacía. `tools: Read, Write` sin corchetes, o `[Read, Grep]` sin comillas, produce un aviso de la prueba porque se leería como una lista vacía.
- Un agente que cita `skills/<x>.md` necesita que esa skill exista.

`goal` y `backstory` son campos propios de Fragua. No existe un campo `phases`.

**Solo lectura frente a escritura.** Si el agente no debe modificar archivos, añádelo a `READ_ONLY_AGENTS` en `claude-hooks/pre-tool-guard.js`: el guardián le bloquea las escrituras. Para que tenga memoria, añádelo a `AGENTES_CON_MEMORIA` en `claude-hooks/agent-memory.js`. El guardián reconoce al agente por la variable `CLAUDE_AGENT_NAME`; si Claude Code no la fija, esos bloqueos no actúan ([SECURITY.md](../SECURITY.md)).

**Asistente.** `/sdd.crear-agente` es un comando que guía la creación con preguntas (nombre, rol, tipo, herramientas) y escribe el archivo. Es un texto que sigue el modelo, no un generador determinista: ejecuta después `npm test` para ver qué se le olvidó registrar.

**El ciclo verificado no usa tus agentes.** Sus tres roles son fijos (`planner`, `qa` y `coder`, en `core/ciclo/perfiles.js`) y sus capacidades las impone el motor, no el archivo del agente. Un agente nuevo sirve para los comandos que lo invocan en Claude Code.

## Comando

Un comando es un Markdown en `commands/`. Su cabecera lleva `description` y `allowed-tools`, ambos obligatorios y no vacíos (`tests/catalogo.test.js`):

```markdown
---
description: Una línea sobre qué hace el comando.
allowed-tools: Read, Write, Edit, Bash
handoffs:
  - etiqueta: "Siguiente paso"
    comando: sdd.algo-mas
---

# /sdd.<nombre> — Título

Instrucciones para el modelo...
```

- `handoffs` es opcional: sugiere el comando que sigue.
- Cada comando genera una skill: `npm run generar-skills` escribe `skills-generadas/<nombre>/SKILL.md`. No se editan a mano, y `node scripts/generar-skills.mjs --verificar` falla si lo que hay en disco diverge.
- Declara el comando en `.claude-plugin/plugin.json`, menciónalo en `commands/sdd.ayuda.md` y mapéalo en `commands/sdd.md`.
- **Un comando es texto para el modelo.** Lo que pone lo ejecuta Claude Code interpretándolo; no hay código que lo garantice. Para que algo sea determinista, implementarlo en `core/` o en la CLI y que el comando lo invoque.

## Skill

Una skill sigue el formato abierto de Agent Skills: una carpeta con un `SKILL.md`.

- `name` igual al nombre de la carpeta (minúsculas, números y guiones, hasta 64 caracteres).
- `description` de 80 a 1024 caracteres: es lo que usa la herramienta para decidir cuándo cargarla.
- `allowed-tools` explícito.
- Declárala en `skills` de `.claude-plugin/plugin.json`.

Instalación en otras herramientas: `fragua init --integracion <clave>` copia las skills propias y las generadas de los comandos del perfil elegido a la carpeta de esa herramienta. No copia comandos, agentes ni hooks ([RELACION-CON-CLAUDE-CODE.md](RELACION-CON-CLAUDE-CODE.md)). Que una skill instalada se invoque de verdad en otra herramienta **no se ha probado a mano** ([ESTADO-ACTUAL.md](ESTADO-ACTUAL.md)).

## Hooks de proyecto (`.sdd/hooks/`)

Son scripts de shell que se ejecutan antes o después de un comando. Esto es lo que hacen y lo que **no** hacen, comprobado en el código:

- El texto del comando contiene una línea como `[ -f ".sdd/hooks/antes_implementar.sh" ] && bash .sdd/hooks/antes_implementar.sh`. **Quien lo ejecuta es Claude Code al seguir el comando.** El motor (`fragua run`, `core/`) no ejecuta estos hooks.
- **No cancelan nada.** La línea no mira el código de salida: un hook que termina con error no detiene el comando.
- **No reciben variables.** `FORGE_VERSION`, `SDD_SPEC_ACTIVA` o `SDD_PIPELINE_STEP` no se definen en ningún sitio. Si tu hook necesita el estado, léelo de `.sdd/estado.json`. Solo `antes_cada_tarea.sh` y `despues_cada_tarea.sh` reciben un argumento: el identificador de la tarea.
- Nombres que los comandos buscan: `antes_` y `despues_` de `constitucion`, `descubrir`, `especificar`, `planificar`, `tareas`, `implementar`, `cada_tarea` y `desplegar`; solo `antes_`: `importar`; solo `despues_`: `aclarar`, `analizar`, `canary`, `crear_app`, `crear_mcp`, `qa` y `retro`.
- En Unix, dale permiso de ejecución: `chmod +x`. `fragua init` deja un `.sdd/hooks/README.md` con esta lista.

Ejemplo que no depende de variables:

```bash
#!/bin/bash
# .sdd/hooks/antes_desplegar.sh
set -e
npm test
node -e "const e=require('./.sdd/estado.json'); console.log('Etapa:', e.pipeline_step)"
```

Si necesitas una barrera real antes de desplegar, no uses un hook de proyecto: usa una puerta de calidad (`puertas:` en `sdd.config.yaml`), que el motor ejecuta y de la que depende el veredicto.

## Constitución

`.sdd/memoria/constitucion.md` recoge las reglas del proyecto. Los agentes la leen como contexto. De todo lo que escribas allí, **el hook `post-write-conventions.js` solo aplica por máquina dos cosas**, que reconoce con estos patrones de texto:

| Regla | Cómo escribirla | Qué ocurre |
|---|---|---|
| Longitud máxima de función | `longitud función máxima: 50`, `max function lines: 50` o `funciones ≤ 50 líneas` | **Solo avisa**: el modelo ve el aviso y puede corregir, pero la escritura no se bloquea |
| Patrón prohibido | ``NUNCA: `patrón` ``, ``PROHIBIDO: `patrón` `` o ``NO USAR: `patrón` `` | **Bloquea** (código de salida 2) si el archivo escrito contiene ese texto, tal cual, como subcadena |

La **cobertura mínima** (`cobertura mínima: 80`, o `calidad.cobertura_tests_minima` en `sdd.config.yaml`) el hook la lee pero **ningún código la aplica**: hoy es solo una instrucción para el modelo. Si necesitas un umbral de cobertura que se cumpla, declara una puerta de calidad cuyo comando falle por debajo del umbral.

El hook también deduce estilo (comillas, punto y coma, sangría, nomenclatura) de ESLint y Prettier si existen. Cualquier otra frase de la constitución es una instrucción para el modelo, sin garantía. Además, un ADR **aceptado** de `.sdd/arquitectura/` con una sección `## Patrones prohibidos` se hace cumplir al escribir con el ciclo verificado (garantía G55 de [GARANTIAS-Y-LIMITES.md](GARANTIAS-Y-LIMITES.md)).

## Proveedores de modelos

Los que existen son Anthropic, OpenAI y compatibles (alias `gpt`, `codex`, `azure`, `github-models`, `cursor`), Ollama (alias `local`) y uno de prueba. **No hay proveedor de Gemini**: Gemini CLI es solo un destino de instalación de skills. Para añadir uno: [guia-anadir-proveedor.md](guia-anadir-proveedor.md).

## Panel (`fragua ui`)

Sirve archivos estáticos de `ui/` y un servidor de solo lectura (`ui/server.js`). Una vista nueva: un archivo en `ui/src/`, un panel en `ui/index.html` y, si necesita datos, una ruta `GET` en el servidor. El panel no tiene contrato: puede cambiar ([api-reference.md](api-reference.md)).

## Prácticas que evitan problemas

- **Agentes:** herramientas mínimas; si el agente no escribe, que no tenga `Write` ni `Edit`. Describe el formato de salida y dónde se guarda.
- **Comandos:** una responsabilidad por comando; lee y escribe en `.sdd/`; si cambia la etapa del pipeline, hazlo con `fragua step`, que es lo que comprueba la aprobación, y no escribiendo `pipeline_step` a mano.
- **Skills:** sin estado entre invocaciones; documenta qué recibe y qué produce.
- **Todo:** si afirmas una capacidad en un documento, que haya una prueba o un módulo que la respalde.
