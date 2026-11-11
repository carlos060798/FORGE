# Evaluación independiente: ¿es Fragua agnóstica del anfitrión?

> Tipo: Informe de auditoría · Fecha: 2026-11-11 · Rama: `feature/anfitriones` · Auditor: independiente, solo lectura (el producto no se modificó; las instalaciones de prueba fueron a carpetas temporales con `HOME`/`USERPROFILE` falsos y `FORGE_LLM_PROVIDER=stub`).

## 1. Veredicto global

**Parcialmente.**

- El **motor** (`fragua run`, `resume`, `verificar`, MCP) sí es agnóstico de forma efectiva, con dos restos de sesgo hacia Anthropic.
- La **metodología** llega a las otras herramientas en forma degradada: skills y comandos como skills (solo 6 de 39 por defecto), agentes como roles que se ejecutan en la misma conversación, y una nota de equivalencias en lugar de una traducción real.
- La **garantía** (guardián y memoria) no llega impuesta a ninguna herramienta. Existe un hook opcional en 6 de 9 herramientas, sin probar en real, que en la práctica es consultivo.
- La **documentación** es en lo esencial honesta: ninguna herramienta figura como «probada». Tiene contradicciones internas y una afirmación que el código desmiente.

«Parcialmente» es un veredicto justo porque el proyecto dice con claridad qué no se recibe (criterio del encargo, segunda mitad). La primera mitad (misma metodología y garantías) no se cumple.

## 2. Método y alcance

1. Lectura de `AGENTS.md`, `README.md`, `docs/ANFITRIONES.md`, `docs/PLAN-AGNOSTICO.md`, `core/instalacion/*`.
2. Instalación real con `node cli/index.js init --integracion <clave> --con-hooks` para las 10 claves de `core/instalacion/herramientas-destino.js`: `claude, generica (con --carpeta-skills .gen/skills), agents, codex, copilot, cursor, gemini, windsurf, opencode, kiro`. Las 10 terminaron con código 0.
3. Búsqueda de sintaxis de Claude Code en lo instalado.
4. `grep` de claude/anthropic en `core/` y `cli/`.
5. Contraste de `docs/ANFITRIONES.md` con código y pruebas.
6. Búsqueda de afirmaciones de «probado».

Limitación: no se probó ninguna herramienta real (Codex, Cursor, etc.). Todo lo dicho sobre su comportamiento viene de lo que Fragua genera, no de lo que la herramienta hace con ello.

Limitación 2: durante la auditoría los archivos de `core/instalacion/` y de dos pruebas se modificaron (marcas 15:52-15:58 del 2026-11-11), es decir, el repositorio estaba siendo editado. La primera ejecución de pruebas dio más fallos que la segunda. Las cifras de pruebas son de un instante.

## 3. Puntuación por capa (0 = no hay, 1 = nominal, 2 = funcional con huecos, 3 = equivalente o con límites declarados)

| Capa | Nota | Evidencia resumida |
|---|---|---|
| Motor (`core/`, `cli/`) | **2** | Los proveedores están aislados en `core/llm-providers/`. Quedan sesgos: ver H4 y H9 |
| Skills | **2** | 31 propias instaladas en las 9 carpetas no nativas. Con restos de Claude Code (H3) |
| Comandos | **1** | Como skills `sdd-*`, solo 6 de 39 con el perfil por defecto. Adaptación por nota y reemplazo textual (H2, H5) |
| Agentes | **2** | 14 roles `rol-*` en todas. Nativos en Codex (TOML), Copilot, Cursor, opencode, Kiro (14) y Gemini (7). Sin aislamiento de contexto (H6) |
| Guardián | **1** | Hook solo con `--con-hooks`, en 6 de 9; ninguno probado en real; falla abierto en Codex, Gemini y Windsurf (H1) |
| Memoria | **1** | Solo hay hook de memoria en Codex, Copilot, Cursor y Gemini. El resto: ninguna. `post-write-conventions` y `context-manager` no tienen equivalente (H7) |
| Instalador | **2** | Funciona en las 10 claves y escribe en la carpeta correcta. Mensajes finales contradictorios y dependencia de `fragua` en el PATH (H8, H10) |
| Documentación | **2** | Honesta en lo central. Contradicciones y una afirmación sin respaldo (H11, H12) |

## 4. Resultados de la instalación real (paso 2)

Árbol instalado por clave, perfil `esencial` por defecto:

| Clave | Carpeta de skills | Hooks / guardián instalado | Agentes nativos |
|---|---|---|---|
| claude | `.claude/skills` (+ `.claude/commands` 6, `.claude/agents` 14, `.claude/hooks`, `settings.json`, `CLAUDE.md`) | `.claude/settings.json` (Pre/PostToolUse) | 14 subagentes |
| generica | `.gen/skills` | ninguno | no |
| agents | `.agents/skills` | ninguno | no |
| codex | `.agents/skills` (31 + 6 + 14 roles = 51) | `.codex/hooks.json` (Pre y Post) | `.codex/agents/*.toml` (14) |
| copilot | `.github/skills` | `.github/hooks/fragua-guardian.json` | `.github/agents` |
| cursor | `.cursor/skills` | `.cursor/hooks.json` (`failClosed`) | `.cursor/agents` |
| gemini | `.gemini/skills` | `.gemini/settings.json` | `.gemini/agents` (7) |
| windsurf | `.devin/skills` | `.devin/hooks.v1.json` (solo PreToolUse) | no |
| opencode | `.opencode/skills` | `.opencode/plugins/fragua-guardian.js` | `.opencode/agents` |
| kiro | `.kiro/skills` | ninguno (sin adaptador) | `.kiro/agents` |

Se creó siempre `AGENTS.md` y `.sdd/`. No se escribió nada en el `HOME` falso (correcto).

Pruebas funcionales del guardián instalado (`fragua guardian evaluar --anfitrion codex`, stdin JSON):

| Evento | Resultado |
|---|---|
| `tool_name: Bash`, `rm -rf /` | bloqueado (2) |
| `tool_name: Bash`, `cat .env` | bloqueado (2) |
| `tool_name: shell`, `rm -rf /` | **pasa (0)** |
| `tool_name: shell`, `cat .env` | **pasa (0)** |
| `tool_name: local_shell`, `cat .env` | **pasa (0)** |
| `tool_name: Write`, `.sdd/memoria/constitucion.md` | **pasa (0)** |
| `tool_name: write_file`, `.env` | **pasa (0)** |
| `tool_name: apply_patch`, `*** Update File: .env` | bloqueado (2) |

Contraste: el hook de Claude Code bloquea `rm -rf /` y escribir `.env` (ambos 2). Para Codex solo se traducen los nombres que el adaptador conoce; el resto pasa. La documentación lo admite («lo desconocido pasa»), pero no lo cuantifica.

## 5. Incumplimientos, de mayor a menor gravedad

**H1 (grave) El guardián no es impuesto en ninguna herramienta no nativa y su cobertura es parcial.**
- Sin `--con-hooks`: ninguno instalado. Con él: Codex, Gemini y Windsurf fallan abierto (`docs/ANFITRIONES.md:22`, matriz). Windsurf solo evalúa terminal (`.devin/hooks.v1.json` solo contiene `PreToolUse`). opencode solo tiene confirmado `read` (`core/instalacion/hooks-anfitrion.js`). Kiro: ninguno.
- Prueba directa (sección 4): con nombres de herramienta no traducidos (`shell`, `local_shell`, `Write`, `write_file`) el guardián de Codex deja pasar `rm -rf /` y la lectura de `.env`.
- Los hooks invocan `fragua ...` en el PATH. En esta máquina `which fragua` no encuentra nada. Si falta el comando, Codex, Gemini y Windsurf siguen sin guardián sin avisar; Cursor, con `failClosed`, bloquea todas las herramientas.
- El guardián de agentes de solo lectura queda desactivado sin `FRAGUA_AGENTE` (salida real: «los guardias de agentes read-only están desactivados»). Ninguna herramienta lo define por sí misma, así que esa protección no existe fuera de Claude Code.

**H2 (grave) Los comandos se reducen a 6 de 39 por defecto y su cuerpo conserva sintaxis de Claude Code.**
- Perfil `esencial` por defecto (`core/instalacion/perfiles.js:20-23`). Codex recibe 6 skills `sdd-*`; el README anuncia «39 comandos» (README.md:14). `--perfil completo` existe, pero la línea de instalación documentada no lo menciona como necesario para equiparar.
- El cuerpo de `sdd-implementar` (el comando central) conserva `Task(r.agente, r.prompt)` (`.agents/skills/sdd-implementar/SKILL.md:195, 229`), `TodoWrite` (125, 276) y `/effort xhigh|medium|low` (77-79). Se salvan con una nota que pide al modelo «ignorar» o «traducir». Cumple la tarea en la mayoría de los casos, pero no es una traducción: depende de que el modelo obedezca la nota.

**H3 (alto) Skills instaladas que apuntan a archivos que no existen en un proyecto no nativo.**
- `cache-audit` lee `.claude/agents/*.md` y `{PLUGIN_DIR}` (`SKILL.md:3, 27, 33`). `indexar-proyecto` ejecuta `node claude-hooks/ast-indexer.js` y `ast-query.js` (`SKILL.md:45-79`). `compresion-tokens` y `effort-router` remiten a `claude-hooks/...`. `deploy-vercel` lee `.claude/skills/vercel-deploy/SKILL.md`.
- En `p-codex` no existe `claude-hooks/` ni `.claude/`. Esos pasos fallan. En un proyecto Claude, `ast-indexer.js` está en `.claude/hooks/`, así que la ruta `claude-hooks/...` tampoco coincide ahí: el defecto es previo al agnosticismo.
- Recuento en `p-codex` fuera de `.sdd`: `Task(` 39 líneas, `TodoWrite` 39, `/effort` 40, `CLAUDE_` 37, `.claude/` 8, `claude-hooks` 13. La mayoría son la propia nota de anfitrión (37 archivos la llevan); lo que queda fuera de la nota son los ejemplos citados.

**H4 (alto) Restos de proveedor Anthropic en el motor y la CLI.**
- `core/engine-cli.js:262, 377`: `cmdRun` y `cmdResume` leen `ANTHROPIC_API_KEY` directamente y avisan «el engine correrá en modo stub» sin considerar `FORGE_LLM_PROVIDER`. Esto choca con la restricción de `AGENTS.md` «NO fijar un proveedor de modelos en ningún módulo».
- `core/orchestrator.js:168` y `core/session-budget.js:14`: valor por defecto `claude-sonnet-4-6`.
- `core/probar-modelo.js:36`: sin proveedor, asume Anthropic si hay clave de Anthropic.
- `cli/comandos/doctor.js:14, 152` y `cli/comandos/instalar.js:887`: lista de modelos válidos y asistente con identificadores de Claude fijos. El plan (F4) declara el `doctor` como hecho, pero el código sigue con `VARIABLES_DE_CLAVE` y la lista de Claude. Se vio solo en lectura de código; no se ejecutó el `doctor`.
- Atenuante: `core/precios.js` y `core/llm-providers/` son tablas legítimas.

**H5 (medio) La adaptación es textual y frágil.** `adaptarCuerpo` sustituye con expresiones regulares `/sdd.x` y «Claude Code» (`core/instalacion/adaptar-anfitrion.js:67-87`). Sin tokens en la fuente (el plan lo proponía) no hay prueba que impida que un comando nuevo introduzca sintaxis ajena. No se halló una prueba de lint de «ninguna salida no-Claude contiene tokens de la lista» (el plan F1 la exigía). Hay pruebas de equivalencia y del instalador (`tests/instalacion-*.test.js`, 138 de 140 pasaron en la segunda ejecución).

**H6 (medio) La delegación pierde el subagente.** Los roles se ejecutan en la misma conversación y lo paralelo pasa a secuencial (`adaptar-anfitrion.js` nota; `docs/ANFITRIONES.md:30`). El plugin `orquestacion-ptc` y los flujos de revisores independientes pierden su propiedad de independencia: el «revisor» comparte contexto con quien implementó. Está documentado, pero es una merma real de la garantía de revisión independiente. Los agentes nativos (Codex, Cursor, etc.) mitigan esto en parte, sin probar. Codex: `sandbox_mode` no se puede fijar, así que «solo lectura» es una instrucción.

**H7 (medio) Memoria y convenciones.** Solo `agent-memory` tiene equivalente (`fragua memoria registrar`, 4 herramientas). `post-write-conventions.js` y `context-manager.js` no tienen traducción en ninguna herramienta no nativa. `docs/ANFITRIONES.md:23` dice «No instalados» para memoria en el resto de claves, pero la matriz (Codex, Copilot, Cursor, Gemini: «guardián y memoria») la contradice parcialmente. La fila general debería decir «Solo con `--con-hooks`».

**H8 (medio) Mensajes del instalador contradictorios y avisos fuera de lugar.**
- En Codex el instalador imprime primero «Guardián registrado en .codex/hooks.json» y al final «No instalado: hooks (guardián, memoria de agentes)». Engaña sobre el estado real.
- Imprime «Claude Code CLI no detectado en PATH» al instalar para Codex.
- Crea `.claudeignore` («excluye ... del contexto de Claude Code») en `codex` y `agents`. No debería existir ahí; Codex y las demás no lo leen.

**H9 (bajo) `core/agent-registry.js:7` detecta proveedor por `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` etc. Es una detección múltiple, aceptable. Se anota para ser explícito.**

**H10 (bajo) El `AGENTS.md` generado para un proyecto nuevo no explica el flujo Fragua en esa herramienta** (por dónde empezar, cómo se invoca, qué no está activo). El plan (F2) lo prometía como «Flujo Fragua en esta herramienta». Se inspeccionó el `AGENTS.md` de `p-codex`: es la plantilla mínima genérica, sin mención a Fragua, `$forge`, ni a qué falta. Para un usuario de Codex, el único aviso de qué no recibe está en la salida de la terminal al instalar y en `.sdd/docs/ANFITRIONES.md`.

**H11 (bajo) Documentación desactualizada que contradice a `ANFITRIONES.md`.** `docs/extending-forge.md:90` afirma que `--integracion` «No copia comandos, agentes ni hooks». El código copia comandos como skills, roles, agentes nativos y hooks con `--con-hooks`. `docs/RELACION-CON-CLAUDE-CODE.md:32` dice que «No» recibe guardián ni memoria, lo cual choca con `--con-hooks`. Cualquier lector que llegue por esos archivos recibe un mapa falso, y `AGENTS.md` exige «Ningún documento afirma una capacidad que el código no tiene».

**H12 (bajo) Pruebas en rojo al auditar.** Segunda ejecución: 138/140; fallan una prueba de Gemini (`un agente que escribe recibe write_file y replace`, el resultado no contenía `- replace`) y `cuerpoSinShell`. La primera ejecución mostró más fallos. La rama estaba en edición, pero hoy no está verde. Nada de lo anterior se corrigió.

## 6. Afirmaciones de `docs/ANFITRIONES.md` sin respaldo o con respaldo parcial

| Afirmación | Estado |
|---|---|
| «Skills propias (31)» | Respaldada (31 carpetas propias contadas; 51 en total con 6 + 14) |
| «Comandos ... solo los del perfil elegido» | Respaldada (6 con `esencial`) |
| «Agentes ... 14 roles» | Respaldada (14 `rol-*` en `p-codex`) |
| «Agentes nativos: Codex (TOML), Copilot, Cursor, opencode, Kiro (14), Gemini 7 de 14» | Generación respaldada (archivos creados). Que cada herramienta los cargue: **sin respaldo** (el documento lo dice «sin probar») |
| «Agentes nativos del anfitrión: No instalados» (tabla superior, columna «Resto de claves») | **Contradicha por el código y por la matriz inferior** (que dice «Sí» para varias). Frase obsoleta en la línea 21 |
| «Hooks: memoria... No instalados» para el resto | **Contradicha** por la matriz (Codex, Copilot, Cursor y Gemini sí tienen memoria con `--con-hooks`) |
| «Cursor: `failClosed` en el guardián» | Respaldada (`.cursor/hooks.json`). Lo que ocurre si falta `fragua` en el PATH no se menciona |
| «Copilot: falla cerrado ante error» | **Sin respaldo en lo instalado**: `fragua-guardian.json` no declara ninguna clave de fallo cerrado. Se apoya en la lectura de la documentación de Copilot, sin prueba |
| «opencode: falla cerrado» | Respaldada por el código (el plugin lanza error si `r.error` o `r.status !== 0`); que opencode ejecute un proceso externo desde el plugin figura «no confirmado» |
| «Windsurf: falla abierto, solo terminal» | Respaldada |
| «Gemini: si el archivo existe no se toca» | No se comprobó con un `settings.json` previo |
| «Kiro sin adaptador» | Respaldada (no hay hook instalado) |
| «Ninguna herramienta está probada» | Respaldada (`verificacion.md` F4.2 «no hecha») |
| «El motor no depende de ninguno» | **Parcialmente**: ver H4 |
| «La adaptación es textual ... lo que recibe Claude Code tampoco cambia» | Respaldada por `tests/instalacion-equivalencia.test.js` (pasa) |
| «Forma de invocar: tabla de prefijos» | Respaldada en `PREFIJO_INVOCACION`. Que la herramienta acepte el prefijo no se ha comprobado |
| Sección «Lo que está en curso», F4 «en curso» | **Desfasada**: `PLAN-AGNOSTICO.md` §8 la da por «Hecha» |

## 7. Afirmaciones de «probado» (paso 6)

No se encontró ninguna doc que afirme «probado» para una herramienta que no sea Claude Code.
- `docs/ANFITRIONES.md:10` y `:69`, `docs/USO-EN-OTRAS-HERRAMIENTAS.md:5-7, 157`, `README.md:14, 67`, `PLAN-AGNOSTICO.md:127` dicen explícitamente «sin probar» o «ninguna probada».
- `.sdd/especificaciones/2026-10-13-instalacion-agnostica/verificacion.md:31` registra «F4.2 ... no hecha».
- La palabra «probado» aparece en el README solo para Docker en Windows y el modelo de Anthropic.
- Un lector atento nota que la matriz usa «Confirmado en doc» para Claude Code, la única para la que existe uso real. Es una etiqueta modesta, no un exceso.

## 8. Qué falta para llegar al «sí»

1. **Prueba real por herramienta** (F5): instalar, invocar `forge` y `sdd.especificar`, cargar un rol, disparar el hook, y registrar versión y fecha. Sin esto ninguna fila puede pasar de «sin probar». Es el mayor hueco y lo hace una persona.
2. **Guardián que no deje pasar lo desconocido** en las herramientas con hook: traducir los nombres reales de herramientas de escritura y terminal de cada una, o negar por defecto lo no traducido (fallo cerrado), con una prueba por herramienta con eventos reales capturados, no inventados.
3. **Garantizar que `fragua` esté en el PATH** o que el hook use `npx`/ruta absoluta, y que `doctor` compruebe el hook instalado. Evitar el fallo silencioso.
4. **Definir `FRAGUA_AGENTE`** (o equivalente) por herramienta, o declarar que los agentes de solo lectura no tienen guardia fuera de Claude Code.
5. **Quitar el sesgo de proveedor** (H4): `engine-cli.js`, `orchestrator.js`, `session-budget.js`, `probar-modelo.js`, `doctor.js`, `instalar.js` deben usar `crearProvider()` y los niveles `alto/medio/economico`.
6. **Corregir las skills con rutas de Claude** (H3), instalando `claude-hooks/` como utilidad neutral o reescribiendo esas skills.
7. **Prueba de lint de salida**: que ninguna salida no-Claude contenga `Task(`, `TodoWrite`, `/effort`, `CLAUDE_`, `.claude/`, `claude-hooks` fuera del bloque de nota, o que se resuelvan con tokens como proponía el plan F1.
8. **Perfil de comandos**: avisar en la instalación no nativa de que se instalan 6 de 39 y cómo obtener el resto, o instalar `completo` por defecto en estas herramientas.
9. **Unificar los mensajes y la documentación**: corregir el resumen final del instalador (H8), no crear `.claudeignore` fuera de Claude, actualizar `docs/extending-forge.md`, `docs/RELACION-CON-CLAUDE-CODE.md` y la fila obsoleta de `docs/ANFITRIONES.md`, y añadir al `AGENTS.md` generado una sección «Flujo Fragua aquí / qué no está activo».
10. **Dejar la rama en verde** (H12).

Cuando 1, 2, 3 y 5 estén hechos y 7 proteja contra regresiones, «sí» sería defendible para Codex, Cursor y Copilot. Para Kiro, Windsurf y opencode, solo con la salvedad de que el guardián no cubre todas las herramientas.
