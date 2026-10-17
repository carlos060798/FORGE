# Spike S0.3: origen de los agentes (plugin frente a proyecto) y relación con `READ_ONLY_AGENTS` / `CLAUDE_AGENT_NAME`

> 2026-10-17. Lectura de código y `grep`; sin experimento. «Sin confirmar» = no ejecutado.

## 1. Quién carga qué

| Pregunta | Respuesta | Evidencia |
|---|---|---|
| ¿De dónde carga agentes el ciclo propio? | **Sólo** de `<forgeRoot>/agents/*.md`, donde `forgeRoot` es el directorio del plugin (padre de `core/`) | `core/engine-cli.js:87,91` → `createAgentRegistry(forgeRoot)` → `agent-registry.js:339-343` (`registry.load(path.join(forgeRoot,'agents'))`) |
| ¿Puede un proyecto aportar sus propios `agents/*.md` al ciclo? | **No hoy.** Ningún módulo de `core/` ni `cli/` llama a `registry.load` con una ruta del proyecto (`grep` de `registry.load`, `createAgentRegistry`, `'agents'` en `core/` y `cli/`) | único sitio: `agent-registry.js:341`. Los demás `agents` son rutas de instalación (`cli/index.js:261` copia del plugin a `.claude/agents`) |
| ¿Quién usa `.claude/agents/` del proyecto? | **Claude Code** (modo plugin/subagentes), no el motor. FORGE los **copia allí** (`cli/index.js:261`, `copyMd`), y `core/instalacion/herramientas-destino.js:35` documenta la carpeta | Un proyecto sí puede traer subagentes propios para Claude Code, fuera del ciclo |
| ¿Quién define el nombre del agente del implementador? | La tarea (`estado.tarea.agente`, `nodos.js:482`), tomada del archivo de tareas del proyecto. Se resuelve contra el registro del **plugin**; si no existe, el llamador devuelve «Agente desconocido» (`ciclo/index.js:117,142`) | Es decir, el proyecto **elige** entre los 14 agentes del plugin, pero no puede **definir** uno |
| ¿Quién fija `aliasDe`/modelo? | `registry.get(agente)?.model` (`ciclo/index.js:134`) más `modelos:` de `sdd.config.yaml` | El proyecto influye en el **modelo** (hasta `nivel_maximo`, `nodos.js:69`) |

**Consecuencia para la spec:** la «capa 3 — `agents/*.md` del proyecto» (spec §10 y HU-003) **no existe para el ciclo**. No hay una superficie por la que un repositorio hostil amplíe permisos desde `agents/*.md`: el escenario 1 de la spec («un `agents/revisor.md` del proyecto declara `Write`») solo tiene sentido para Claude Code, donde manda Claude Code, no el motor. La superficie real que el proyecto controla hoy en el ciclo es: `sdd.config.yaml` (topes, modelos, `protecciones.no_tocar_archivos`) y el archivo de tareas (nombre del agente, `archivos`, `parte_de_codigo_existente`).

## 2. El gancho `pre-tool-guard.js` (modo plugin)

- `READ_ONLY_AGENTS` (`claude-hooks/pre-tool-guard.js:130-133`): 7 nombres; el resto de agentes (p. ej. `desarrollador-backend`) quedan fuera. La lista está duplicada del criterio de `tools:` en los agentes (ambas a mano; sin confirmar que coincidan: p. ej. `tester` tiene `Write` y no está en la lista, correcto; `arquitecto` está en la lista y su cabecera dice `Bash`, que puede escribir con redirección: el gancho sólo cubre `Write/Edit/MultiEdit` en esa rama, `:222-238`).
- Se aplica **sólo si** `CLAUDE_AGENT_NAME` está definida (`:206,:236-241`); sin ella emite un aviso y deja pasar (`:209-216`). `forge doctor` ya comprueba la variable (`cli/index.js:1430`).
- El ciclo propio **no depende** del gancho ni establece `CLAUDE_AGENT_NAME` (`grep` en `core/`: sin resultados; el ciclo no pasa por Claude Code). Son dos mecanismos separados, como dice la spec; confirmado.
- `Bash` no está cubierto por `READ_ONLY_AGENTS`: sólo `isWriteTool`. Fuera del alcance de esta spec (declarado); anotarlo en la lista de límites.

## 3. Relación con los perfiles

| Elemento | Modo | Quién impone |
|---|---|---|
| Techo del rol (capa 1) | Ciclo propio | Motor (`core/ciclo/perfiles.js`, nuevo) |
| `tools:` de `agents/*.md` | Ciclo propio | Nadie (solicitud sin efecto) |
| `tools:` de `agents/*.md` copiado a `.claude/agents` | Claude Code | Claude Code |
| `READ_ONLY_AGENTS` | Claude Code con la variable | Gancho `pre-tool-guard.js` |

No hay ninguna fuente común hoy. Unificarlas (pregunta 7 de la spec) exigiría que el gancho (un script Node suelto, sin dependencias, `claude-hooks/`) importara la tabla de `core/ciclo/perfiles.js`; el gancho se copia al proyecto del usuario (`cli/index.js:1229` lista `claude-hooks`), de modo que importar del plugin añade una dependencia de ruta que hoy no existe (sin confirmar si el gancho copiado puede resolver `../core/`).

## 4. Qué cambia en la spec o el plan

1. **HU-003 / CA-003-03**: reescribir la capa 3 como «`sdd.config.yaml` del proyecto» (y, para Claude Code, sin tocar). Retirar «`agents/*.md` del proyecto» de la capa 3 del ciclo; mantener la `tools:` de `agents/*.md` como solicitud para el modo plugin.
2. **Escenario 1 de la spec**: reescribir. En el ciclo, el equivalente es: `sdd.config.yaml` declara `perfiles.coder_rutas_escribir: ["**"]` (más amplio que el techo) y se ignora con aviso.
3. **Plan §3, módulo `agent-registry.js`**: ya no lee perfiles. Su único cambio es validar que `tools:` bien formado se interprete como lista (ver `formato-del-perfil.md` §4.5).
4. **Nueva superficie a tratar**: `estado.tarea.agente` (nombre elegido por el proyecto; `nodos.js:482`). El perfil del `coder` debe imponerse **por rol**, no por nombre; con eso, nombrar `agente: arquitecto` no recorta ni amplía nada (consecuencia de `roles-del-ciclo.md` §1). Definir además qué pasa con un nombre inexistente: hoy falla en la primera llamada (`ciclo/index.js:142`), tras haber gastado el planner y el qa; con perfiles puede fallar antes (validar el agente al arrancar la tarea).
5. **Pregunta 7 (unificar `READ_ONLY_AGENTS`)**: confirmada la recomendación («después, en entrega aparte»): el coste de acoplar el gancho al módulo del motor es mayor que el beneficio inmediato; y la spec ya lo declara fuera de alcance.
6. **Límites a documentar** (spec §10): (a) `Bash` no está cubierto por el gancho de lectura; (b) el gancho no actúa sin `CLAUDE_AGENT_NAME`; (c) el proyecto elige qué agente del plugin implementa y puede, con `modelos:`, elegir el modelo.

## 5. Riesgos

- Si en el futuro se añade la carga de agentes del proyecto (otra spec), la capa 3 por cabecera aparece y hay que aplicar la regla «sólo reducir» con una prueba de propiedad ya existente en la spec (CA-003-05). Hoy no hay nada que probar en ese sentido.
- La descripción de la spec («`agents/*.md` del proyecto» como vector) puede llevar a implementar una defensa contra algo que no existe y dejar sin cubrir lo que sí: la elección de `agente` y los topes en `sdd.config.yaml`.
