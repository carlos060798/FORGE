# Plan: volver Fragua agnóstica del anfitrión

> Tipo: Plan · Fecha: 2026-11-10 · Árbol: `5.0.0-beta.1` (commit `05e74da`) · Estado: **propuesta sin aprobar por el dueño; F1, F2 y F3 ya implementadas por su instrucción (ver §8), F4 parcial, F0 y F5 pendientes**.
> Convención del repositorio: nada de esto se implementa sin su especificación en `.sdd/especificaciones/` aprobada por el dueño (AGENTS.md, «Cómo se cambia algo»). Este documento es el diagnóstico y el orden de trabajo; cada fase se convierte en una spec.

## 1. Diagnóstico: qué está amarrado a Claude Code y qué no

Medido sobre el árbol actual con `grep` y lectura de los módulos. «Agnóstico» aquí significa: *otra herramienta de código (Codex, Cursor, Copilot, Gemini CLI, opencode, Kiro, Windsurf) recibe la misma capacidad que Claude Code, o el documento dice con claridad qué no recibe*.

| Capa | Archivos | Estado | Evidencia |
|---|---|---|---|
| **Motor** (`core/`, `cli/`) | ciclo, sandbox, proveedores, MCP, API HTTP, instalador | **Agnóstico** | Proveedores Anthropic/OpenAI/Ollama/stub con conformidad común (`core/llm-providers/`); niveles neutrales `alto/medio/economico` (ADR-19); la constitución prohíbe fijar proveedor; `forge init --integracion` instala en 9 carpetas de herramientas confirmadas (`core/instalacion/herramientas-destino.js`). |
| **Skills propias** (31, `skills/`) | `SKILL.md` | **Casi agnóstico** | Formato abierto Agent Skills (agentskills.io). Residuos: 7 de 41 archivos mencionan «Claude Code» en el cuerpo; `allowed-tools` es experimental en el estándar; 3 skills traen cabeceras fuera del estándar (`id`, `nombre`, `descripcion`, `version`, `inputs`, `outputs`, `requisitos`); `orquestacion-ptc` describe un patrón que solo existe con subagentes de Claude Code. |
| **Comandos** (39, `commands/`) | slash commands | **Nativos de Claude Code**; se exportan como skills con avisos | Cabecera propia (`allowed-tools` con comas, `handoffs`, `aliases`). Cuerpos con unas 900 referencias a la sintaxis `/sdd.x`, 4 usos de `Task(`, 3 de `TodoWrite`, `/effort`, `$CLAUDE_PLUGIN_ROOT`, `$1`. El generador (`core/instalacion/skills-de-comandos.js`) los convierte a `SKILL.md` **copiando el cuerpo sin cambios** y solo avisa de lo que no funcionará fuera. |
| **Agentes** (14, `agents/`) | subagentes | **Solo Claude Code** | Cabecera de subagente (`model: opus`, `color`, `tools: [...]`) más campos propios (`goal`, `backstory`). **No se instalan en ninguna otra herramienta**: `copiarNucleo` los omite cuando la integración no es nativa (`cli/comandos/instalar.js:50`). La spec de instalación agnóstica lo dejó fuera de alcance explícitamente («Convertir los 14 agentes a un formato neutral: es otra especificación»). Los comandos los invocan con la herramienta `Task`. 4 agentes citan el hook `agent-memory.js` en su cuerpo. |
| **Hooks** (`claude-hooks/`) | guardián, memoria, convenciones, contexto | **Solo Claude Code** | Protocolo `PreToolUse`/`PostToolUse` por stdin, registro en `.claude/settings.json`, identidad del agente por `CLAUDE_AGENT_NAME`. Fuera de Claude Code **no hay guardián, ni memoria de agentes, ni validación de convenciones**. Las reglas sí tienen fuente única agnóstica en `core/evidencia/` (`guardian-reglas.js`, `protegidos.js`). |
| **Adaptadores** (`core/adapters/`) | `claude-code`, `speckit` | **Incompletos** | `speckit` solo escribe archivos de traspaso (`speckit-handoff/`); no hay adaptador real de ninguna otra herramienta. `forge dispatch` resuelve siempre a Claude Code o al traspaso. |
| **Vocabulario de modelos** | agentes, presets, `plugin.json` | **Dos vocabularios** | `core/` habla de `alto/medio/economico`; agentes y presets dicen `opus/sonnet/haiku`; `plugin.json → userConfig` lista identificadores concretos de Claude. |
| **Diagnóstico** (`cli/comandos/doctor.js`) | | **Sesgado a Anthropic** | Hace ping con `claude-haiku-4-5-20251001` fijo, trata `ANTHROPIC_API_KEY` como «la» clave, habla de «Modo Claude Code detectado» y audita `CLAUDE.md`; no usa `crearProvider()` ni `core/probar-modelo.js`. |
| **Metadatos y documentación** | `package.json`, `plugin.json`, `README.md`, `docs/`, `docs-site/` | **Se presenta como producto de Claude Code** | `package.json`: «Tu equipo técnico completo en Claude Code»; README: «SDD para Claude Code»; requisito «Claude Code» en la tabla; `docs/RELACION-CON-CLAUDE-CODE.md`: «FORGE no es un reemplazo de Claude Code. Es una capa de opinión… sobre las primitivas nativas de Claude Code». 82 menciones en `docs-site/assets/data.js`. |

**Veredicto.** El motor ya es agnóstico y el repositorio lo documenta con honestidad: «Los comandos, agentes y hooks son nativos de Claude Code. Otras herramientas reciben solo skills» (README, Requisitos). Lo que sigue amarrado es **la capa de metodología que el usuario toca**: comandos, agentes y hooks. Para otra herramienta, Fragua hoy es un conjunto de 70 skills sin agentes, sin guardián y con cuerpos que hablan de `/sdd.x` y `Task`.

Lo que ya está hecho y no hay que repetir: tabla de integraciones con fuente oficial y fecha, generador comando→skill con prueba de divergencia, perfiles `esencial`/`completo`, `AGENTS.md` generado, escritura segura en todos los destinos, `doctor` que informa integración y perfil. Lo pendiente de esa misma spec: **F4.2 (prueba manual por herramienta) y F5.4 (`verificacion.md`)**; nunca se ha comprobado que una skill instalada se invoque de verdad en otra herramienta.

## 2. Decisión previa del dueño: hasta dónde

Tres niveles posibles. El plan asume el **nivel B**, con el C donde la herramienta lo permita.

| Nivel | Qué recibe otra herramienta | Costo | Estado |
|---|---|---|---|
| A | Skills + `AGENTS.md` (lo de hoy) | — | Hecho, sin verificar en real |
| **B** | A + comandos y agentes **utilizables** (sin sintaxis ajena, con el agente como rol cargable) + guardián y memoria **invocables** desde la CLI/MCP | Medio | Propuesto |
| C | B + guardián y memoria **impuestos** por el sistema de hooks de cada herramienta que tenga uno | Alto, por herramienta | Solo donde haya hooks confirmados en doc oficial |

Reglas que no se negocian (constitución): sin dependencias nuevas; ninguna herramienta entra sin fuente oficial con fecha; lo no verificado se marca; `forge init` sin opciones sigue produciendo el mismo árbol; no se degrada en silencio (si una herramienta no puede imponer el guardián, el documento y `doctor` lo dicen).

## 3. Fases

Cada fase = una spec + pruebas antes que código + ADR si hay decisión técnica. Orden por valor/riesgo: primero lo que hace utilizable lo que ya se instala (F1, F2), después la seguridad (F3), después la limpieza (F4) y la verificación real (F5), y la documentación cierra cada fase.

### F0 — Spikes (sin código de producto)

- **S0.1 Agentes nativos por herramienta.** Qué herramientas tienen un formato propio de agente/rol y en qué carpeta (candidatas a confirmar en doc oficial: Copilot `.github/agents/*.agent.md`, opencode `agents`, Cursor, Gemini CLI, Kiro). Salida: tabla con URL y fecha, «sin confirmar» donde no se pueda. **Nada de esto se afirma hasta el spike.**
- **S0.2 Hooks por herramienta.** Qué herramientas exponen hooks pre/post herramienta, protocolo (stdin JSON, código de salida) y si pueden **bloquear**. Mismo criterio de confirmación.
- **S0.3 Sustitución de argumentos.** Qué herramientas sustituyen `$ARGUMENTS`/`$1` en skills y cuáles no.
- **S0.4 Inventario de sintaxis ajena** en `commands/`, `skills/`, `agents/`: lista cerrada de tokens a neutralizar (`/sdd.x`, `Task(`, `TodoWrite`, `/effort`, `$CLAUDE_PLUGIN_ROOT`, `mcp__`, `CLAUDE_AGENT_NAME`, «Claude Code» en prosa). Se convierte en la prueba de lint de F1.

### F1 — Fuente única neutral para comandos y agentes

Objetivo: que cada comando y cada agente se escriba **una vez** en un formato propio de Fragua y se **genere** la variante de cada anfitrión, incluido Claude Code. Es la inversa de hoy (comando de Claude Code → skill con avisos).

1. **Cabecera neutral de comando.** `description` (estándar), y bajo `metadata:` lo propio: `fragua-herramientas` (vocabulario neutral: `leer buscar escribir terminal web delegar`), `fragua-handoffs`, `fragua-aliases`. El generador emite para Claude Code la cabecera actual (`allowed-tools` con nombres de Claude, `handoffs`, `aliases`) y para el resto `SKILL.md` estándar.
2. **Tokens en el cuerpo, resueltos por integración.** El generador ya conoce la forma de invocación de cada herramienta (`INTEGRACIONES[x].invocacion`); se usa:
   - `{{cmd:sdd.especificar}}` → `/sdd.especificar` (Claude Code), `$sdd-especificar` (Codex), `/sdd-especificar` (Cursor, Copilot, Kiro), «activa la skill sdd-especificar» (Gemini)…
   - `{{delegar:revisor|prompt}}` → en Claude Code, la herramienta `Task` con el subagente; donde no haya subagentes, «carga la skill `rol-revisor` y ejecuta este encargo en esta misma conversación, devolviendo solo el informe»; como tercera vía, `fragua dispatch`. La revisión paralela (PTC) **degrada a secuencial** y el texto generado lo dice.
   - `{{tareas-visibles}}` → `TodoWrite` en Claude Code; tabla en la respuesta en el resto.
   - `{{esfuerzo:alto}}` → `/effort high` en Claude Code; nota neutral en el resto.
   - `{{raiz-plugin}}` → `$CLAUDE_PLUGIN_ROOT` en Claude Code; `fragua ruta` (orden nueva de la CLI, agnóstica) en el resto.
   - `{{arg:1}}` → `$1` donde se sustituye (S0.3); instrucción «el usuario te dará X» donde no.
3. **Cabecera neutral de agente.** `name`, `description`, `nivel: alto|medio|economico` (vocabulario ADR-19, en lugar de `model: opus`), `herramientas` neutrales, `solo-lectura: true|false` (hoy esa lista vive duplicada en el guardián), `metadata: { goal, backstory, color }`. Salidas: subagente de Claude Code (`.claude/agents/`, idéntico byte a byte al actual: prueba de equivalencia), skill `rol-<agente>/SKILL.md` para cualquier herramienta, y el formato nativo de cada herramienta que S0.1 haya confirmado.
4. **Cuerpos.** Quitar las 4 citas a `agent-memory.js` en agentes (la memoria se describe por su efecto, no por el hook) y las menciones a «Claude Code» que no sean una instrucción condicional por anfitrión.
5. **Pruebas.** (a) Equivalencia: lo generado para Claude Code es idéntico a `commands/` y `agents/` de hoy. (b) Lint: ninguna salida no-Claude contiene un token de la lista S0.4. (c) Validez: toda skill pasa `validarSkill`. (d) `generar-skills.mjs --verificar` cubre comandos **y** agentes.

Decisión técnica (ADR): dónde vive la fuente. Propuesta: `commands/` y `agents/` pasan a ser la fuente neutral y las salidas van a `generadas/<integracion>/`; `skills-generadas/` desaparece en favor de eso. Alternativa de menor cambio: mantener los nombres y generar solo lo no-Claude. Decide el dueño.

### F2 — Instalador: lo generado llega a cada herramienta

- `forge init --integracion <x>` instala comandos-como-skills, **agentes-como-roles** y, si S0.1 lo confirmó, agentes nativos en su carpeta. El mensaje final deja de decir «No instalado: comandos, agentes…» cuando ya no sea cierto.
- `AGENTS.md` generado gana una sección «Flujo Fragua en esta herramienta»: por dónde empezar, cómo se invoca cada paso (con la sintaxis de esa herramienta) y qué **no** está activo (guardián, memoria) hasta F3.
- `forge update` respeta integración y perfil (ya lo hace) y añade lo nuevo sin borrar.
- `doctor` por integración: comprueba que la carpeta de skills exista, que haya N skills y M roles, y enumera lo que esa herramienta no recibe.
- Pruebas: equivalencia de `init` sin opciones (ya existe, se mantiene), árbol esperado por integración, proyecto hostil (ya existe) sobre las carpetas nuevas.

### F3 — Guardián y memoria fuera de los hooks de Claude Code

Las reglas ya son agnósticas (`core/evidencia/`); lo que falta es el **punto de entrada**.

1. **Contrato propio de evento.** Documentar en `docs/contrato/` el JSON que hoy entra por stdin (`tool_name`, `tool_input`, `tool_response`) como **contrato de Fragua**, con versión, y una capa de traducción por anfitrión. El de Claude Code queda como adaptador número uno (hoy es el único).
2. **CLI:** `fragua guardian evaluar` (stdin JSON → código 0/2 y mensaje) y `fragua memoria registrar`. Mismo código que los hooks; los hooks de Claude Code pasan a ser envoltorios finos.
3. **Adaptadores de hook por herramienta** (nivel C) solo para las que S0.2 confirme con capacidad de bloquear. Cada uno: plantilla de configuración que `init` instala, traducción de su evento al contrato, pruebas con ejemplos estáticos (como `hooks-contract.test.js`).
4. **Vía MCP** para herramientas sin hooks: herramienta `guardian_evaluar` en el servidor MCP existente (perfil `verificacion`). Es **consultiva**: el modelo puede no llamarla. `GARANTIAS-Y-LIMITES.md` lo dice con una matriz «impuesto / consultivo / no disponible» por herramienta.
5. **Identidad del agente:** `FRAGUA_AGENTE` (con `FORGE_AGENTE`) leída por `claude-hooks/shared/entorno.js`; `CLAUDE_AGENT_NAME` sigue como respaldo en el adaptador de Claude Code. Sin identidad, las guardas por agente quedan desactivadas y se avisa (como hoy).
6. Renombrar `claude-hooks/` → `anfitriones/claude-code/` con hermanos `anfitriones/<herramienta>/`. Toca instalador, plantilla de `settings.json`, `doctor`, `docs/hooks.md` y pruebas: **última tarea de la fase, con ADR**, o se deja para F4 si el dueño prefiere menos ruido.

### F4 — Vocabulario, diagnóstico y metadatos neutrales

- **Niveles de modelo:** `agents/` y `presets/*.yaml` pasan a `alto/medio/economico`; `plugin.json → userConfig.modelo_principal` deja de listar identificadores de Claude (o se deriva del generador). Solo el generador de Claude Code y cada proveedor traducen a nombres concretos. `claude-hooks/model-registry.js` consume el nivel neutral.
- **`doctor.js`:** el ping usa `crearProvider()` + `core/probar-modelo.js` con el proveedor configurado; «Modo Claude Code detectado» → «Anfitrión detectado: <x> / ninguno»; la auditoría de `CLAUDE.md` solo si la integración es `claude`; la clave que busca es la del proveedor activo.
- **Metadatos:** `package.json` y `plugin.json` describen Fragua por lo que hace, no por dónde corre («…en Claude Code» pasa a «…para Claude Code, Codex, Cursor, Copilot…» con la lista real confirmada). Palabras clave: se añaden las herramientas verificadas en F5, no antes.
- **`.claude-plugin/` se conserva:** es el canal de distribución para Claude Code; agnóstico no significa dejar de ser plugin de Claude Code.
- **Skills propias:** quitar cabeceras fuera del estándar (moverlas a `metadata`), neutralizar las 7 menciones en prosa, y marcar `orquestacion-ptc` como «solo con subagentes» o reescribirla con `{{delegar}}`.

### F5 — Verificación real por herramienta (deuda ya abierta: F4.2 y F5.4 de la spec 2026-10-13)

Por cada integración de la tabla: instalar en un proyecto vacío, invocar `forge` y un paso (`sdd.especificar`), cargar un rol, y anotar en `verificacion.md` qué funcionó, con versión de la herramienta y fecha. Sin esto, ninguna herramienta pasa de «carpeta confirmada en doc» a «probada». **Es manual y la hace una persona**; es la única fase que no puede cerrarse con la suite.

### F6 — Documentación honesta (transversal, cierra cada fase)

- `docs/RELACION-CON-CLAUDE-CODE.md` → `docs/ANFITRIONES.md`: matriz herramienta × capacidad (skills, comandos, roles, agentes nativos, guardián impuesto/consultivo, memoria, hooks de fase) con estado «probado / confirmado en doc / no disponible».
- README: la fila «Claude Code» de Requisitos pasa a «Una herramienta de código compatible» con enlace a la matriz; el párrafo de cabecera deja de decir «sobre Claude Code».
- `ESTADO-ACTUAL.md`, `roadmap.md`, `COMPATIBILIDAD.md` (hoy solo habla del esquema de hooks de Claude Code), `docs-site/assets/data.js`, `GLOSARIO.md` («anfitrión», «integración», «rol»).
- `CHANGELOG.md`: todo lo anterior es compatible hacia atrás para quien instala sin opciones; lo que cambie el formato de `commands/`/`agents/` en el paquete publicado se anuncia como cambio de la interfaz pública (VERSIONING.md).

## 4. Tamaño y orden sugerido

| Fase | Tamaño (escala del repo) | Depende de | Entregable visible |
|---|---|---|---|
| F0 | pequeño | — | 4 informes de spike con fuentes y fechas |
| F1 | grande | F0 | comandos y agentes neutrales; generador multi-anfitrión; pruebas de equivalencia y lint |
| F2 | mediano | F1 | `init` instala roles y agentes nativos; `doctor` por integración |
| F3 | grande | F0 (S0.2) | `fragua guardian`, contrato de evento, adaptadores de hook confirmados, herramienta MCP consultiva, matriz de garantías |
| F4 | mediano | F1 | niveles neutrales en todo el árbol; `doctor` por proveedor; metadatos |
| F5 | pequeño pero manual | F2 | `verificacion.md` por herramienta |
| F6 | pequeño, continuo | cada fase | matriz de anfitriones; README y estado al día |

Si solo cabe una cosa: **F1 + F2 para Codex y Cursor** (las dos de más uso previsible) más la línea de F6 que lo documente. Eso convierte «70 skills sin agentes» en «el flujo completo, con roles, sin guardián impuesto», que es el salto de valor mayor por unidad de trabajo.

## 5. Riesgos

| Riesgo | Mitigación |
|---|---|
| Sustituir unas 900 referencias `/sdd.x` a mano introduce errores | Sustitución por tokens hecha por script una sola vez, con la prueba de lint como red; la prueba de equivalencia garantiza que Claude Code no cambia |
| Sin subagentes, la delegación pierde aislamiento de contexto y el paralelismo | Se dice en el texto generado y en la matriz; el ciclo verificado (`forge run`) no depende de ello |
| Un guardián «consultivo» da falsa sensación de seguridad | Matriz impuesto/consultivo por herramienta en `GARANTIAS-Y-LIMITES.md`; `doctor` lo imprime; nunca se usa la palabra «protegido» para el modo consultivo |
| Doble fuente de verdad durante la transición | La prueba de divergencia existente se amplía a agentes desde el primer commit de F1 |
| Afirmar compatibilidad con herramientas no probadas | Ninguna herramienta pasa a `package.json`, README o matriz como «probada» sin su fila en `verificacion.md` (F5) |
| Churn de renombrar `claude-hooks/` | Última tarea, con ADR, o se pospone sin bloquear el resto |

## 6. Qué no se hace

- No se abandona el plugin de Claude Code ni `.claude-plugin/`.
- No se escribe un adaptador que **ejecute** otra herramienta desde Fragua (`forge dispatch` real hacia Codex/Cursor): fuera de alcance, como en la spec de 2026-10-13.
- No se añaden dependencias (parsers YAML, SDKs de otras herramientas).
- No se afirma soporte de una herramienta sin spike con fuente oficial y sin prueba manual registrada.

## 7. Siguiente paso

1. El dueño decide el nivel (sección 2) y la ubicación de la fuente (ADR de F1).
2. Se redacta `.sdd/especificaciones/2026-11-10-metodologia-agnostica/spec.md` con las historias HU de F1 y F2 (F3 merece spec propia por tocar seguridad).
3. Se ejecutan los spikes de F0 antes de escribir código.

## 8. Estado de ejecución (2026-11-11)

| Fase | Estado | Qué quedó |
|---|---|---|
| F0 | Hecha | Informe en `.sdd/especificaciones/2026-11-10-metodologia-agnostica/spikes/agentes-hooks-argumentos.md`. Los resúmenes salen de WebFetch, no de lectura literal; Windsurf y parte de opencode y Kiro quedan «sin confirmar». |
| F1 | Hecha en versión práctica | La adaptación se hace al instalar (`core/instalacion/adaptar-anfitrion.js`), no con tokens en la fuente. Claude Code recibe los archivos de siempre. |
| F2 | Hecha | `forge init --integracion <x>` instala skills, comandos adaptados, 14 roles `rol-*` y agentes nativos (Copilot, Cursor, Codex, opencode, Kiro; Gemini 7 de 14). Sin probar en real. |
| F3 | Hecha, sin probar en real | Hecho: `fragua guardian evaluar [--anfitrion]`, `fragua memoria registrar`, contrato de evento, identidad `FRAGUA_AGENTE` en los hooks y adaptadores de hook para Cursor, Copilot, Gemini y Codex (`--con-hooks`, 2026-11-11), con esquemas leídos de la documentación oficial. Memoria posterior a la herramienta en las mismas cuatro, y MCP consultivo como perfil `guardian`. **Pendiente:** probar los hooks en una instalación real; adaptadores de Windsurf, opencode y Kiro (esquemas dudosos, ver el spike `hooks-windsurf-opencode-kiro.md`). |
| F4 | Hecha | `doctor`, metadatos y cabeceras de skills. **Niveles de modelo: no hace falta cambiar nada.** `core/llm-providers/niveles.js` trata `opus/sonnet/haiku` como alias exactos de `alto/medio/economico`, y los roles ya llevan el nivel neutral. Cambiar `model:` en `agents/` rompería a Claude Code sin beneficio. |
| F5 | Pendiente | Prueba manual por herramienta; la hace una persona. |
| F6 | Hecha | `docs/ANFITRIONES.md`, README, estado, roadmap, changelog, spec en borrador. |

Fuera de alcance por riesgo: renombrar `claude-hooks/` (toca guardián, instalador y pruebas; ganancia solo de nombre).
