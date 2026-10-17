# Spike S0.1: qué hace hoy cada rol del ciclo (capa 1 de referencia)

> 2026-10-17, rama `feature/motor-agentico` (`1fe136d`). Lectura de código; sin experimento (no hace falta). «Sin confirmar» = no ejecutado.

## 1. Hallazgo que cambia el diseño: el perfil es del ROL, no del nombre del agente

El motor decide el rol por el **nodo**, no por la definición del agente:

| Nodo | Agente (nombre) | Rol en `aplicarArchivos` | Fuente del nombre |
|---|---|---|---|
| `planner` | `'arquitecto'` fijo | (no escribe) | `nodos.js:307` |
| `qa` | `'tester'` fijo | `'qa'` | `nodos.js:366,290` |
| `refuerzo` | `'tester'` fijo | `'qa'` | `pruebas-confiables.js:185` |
| `coder` (bloque y turnos) | **`estado.tarea.agente`**, variable | `'coder'` | `nodos.js:482`, `turnos.js:166` |

`tarea.agente` sale de la tarea (es decir, del archivo de tareas del proyecto; `estado.js:97`). Un `agente: seguridad` o `agente: arquitecto` en una tarea ejecuta el nodo `coder` con las cinco herramientas y escritura. Por tanto **la cabecera `tools:` del agente no puede ser la fuente del techo del implementador**: un proyecto podría nombrar un agente «de sólo lectura» y el implementador quedaría sin herramientas (rompe el ciclo), o nombrar uno con `Write` y no ganaría nada. El techo (capa 1) se indexa por **rol del nodo** (`planner`, `qa`, `refuerzo`, `coder`); la definición del agente sólo puede reducirlo.

## 2. Tabla de referencia (lo que ocurre hoy)

| Aspecto | `arquitecto` (planner) | `tester` (qa y refuerzo) | Implementador, bloque | Implementador, turnos |
|---|---|---|---|---|
| Llamada | Un mensaje, sin herramientas (`nodos.js:306`) | Un mensaje, sin herramientas (`:365-369`) | Un mensaje (`:481`) | Conversación con 5 herramientas (`turnos.js:204-207`) |
| Recibe | descripción, mapa, manifiestos (`:308`) + `CONTRATO_PLANNER` | descripción, plan, contexto recuperado ≤ `contexto_max_bytes`, manifiestos, `testCmd`, pruebas anteriores/«pasaban antes» (`:354-361`) + `CONTRATO_QA`; refuerzo: pruebas actuales y cambios no detectados (`pruebas-confiables.js:178-183`) | descripción, plan, **pruebas**, contexto, manifiestos, implementación actual, salida anterior (`:466-478`) | descripción, plan, pruebas, manifiestos, mapa, lista de archivos escritos, salida anterior, límites (`turnos.js:104-122`); **sin** contexto del recuperador (`:97`) |
| Lee (directo) | Nada | Nada; el recuperador lee por él `tarea.archivos`, `plan.archivosObjetivo` y la spec (`nodos.js:133`, `recuperador-archivos.js`) | Igual que `tester` (recuperador) y archivos de su implementación (`:252-268`) | `leer_archivo`, `listar`, `buscar` sobre todo lo no vetado, **incluidos manifiestos y configuración, que se leen aunque no se escriban** (`herramientas-coder.js:241-247`) |
| Escribe | Nada. Su salida se interpreta como `{pasos, archivosObjetivo}` (`nodos.js:315-325`) | Archivos que cumplan `esRutaDePrueba` (`protocolo-archivos.js:290,133-145`); **cualquier** ruta de prueba, también una ya existente del proyecto (la lista `pruebas` va vacía: `nodos.js:366`) | Cualquier ruta válida que no sea prueba ni `pruebas` de la tarea (`:294-296`) | Igual, vía `editar`→`aplicarArchivos` con `atomica: true` (`herramientas-coder.js:430-433`) |
| Ejecuta | Nada | Nada (el nodo ejecuta `runner.test`, no el modelo: `nodos.js:386`) | Nada | Sólo `ejecutar_pruebas`, sin parámetros, tope `turnos_pruebas_max` (`:443-466`) |
| Topes que le afectan | `maxTokens` 8192 de la llamada (`agent-registry.js`); **no** `contexto_max_bytes` (prompt ≈ mapa ≤ 200 nombres + manifiestos) | `contexto_max_bytes` (65 536, `config.js:27`) | Igual | `turnos_max` (30, `config.js:29`), `turnos_pruebas_max`, `MAX_ARCHIVO_BYTES` 1 MiB y `MAX_RESULTADO_BYTES` 32 KiB (`herramientas-coder.js:30-35`) |
| Cabecera `tools:` actual | `["Read","Grep","Glob","Bash"]` (`agents/arquitecto.md:6`) | `["Read","Write","Grep","Glob","Bash"]` (`agents/tester.md:6`) | la del agente nombrado | la del agente nombrado |
| Efecto de `tools:` | **Ninguno** | **Ninguno** | **Ninguno** | **Ninguno** |

Confirmado en el código: la única lectura de `tools` en `core/` es `agent-registry.js:112` (se guarda) y nada la consulta (`grep` de `.tools` en `core/` y `cli/`; el resto son cuerpos de petición de proveedores). Se verificó ejecutando el lector: `tools: [Read, Grep]` sin comillas devuelve `[]` (ver `formato-del-perfil.md`).

## 3. Reglas comunes a todos los roles (no dependen del perfil)

Aplicadas por `validarRuta` (`protocolo-archivos.js:212-243`) para escribir y para leer del recuperador: ruta absoluta, no portable, fuera del proyecto, enlace simbólico, ruta vetada, `dependencias` y `configuracion`. Para escribir, dependencias y configuración detienen el trabajo (`requiereRevision`, `:312`); para leer se permiten (`herramientas-coder.js:244-246`, `recuperador-archivos.js` rama `dependencias|configuracion`). Las rutas protegidas del usuario llegan por `deps.vetadas` = `leerRutasProtegidas(cwd)` (`engine-cli.js:181`): vive en `sdd.config.yaml` del proyecto, es decir **en el árbol**; sólo puede añadir vetos.

## 4. Dónde se podría imponer un perfil sin tocar la lógica de rutas

| Dimensión | Punto de imposición | Cambio | Riesgo para `arquitecto`/`tester`/implementador |
|---|---|---|---|
| Herramientas ofrecidas | `crearHerramientasCoder` devuelve `esquemas: ESQUEMAS_HERRAMIENTAS` (`herramientas-coder.js:471`) y `turnos.js:206` los pasa | Filtrar por `perfil.herramientas`; `ejecutar` rechaza si el nombre no está en el perfil, además de `POR_NOMBRE.get` (`:482-483`) | Con el perfil por defecto del `coder` = las cinco, resultado idéntico |
| Herramientas del `arquitecto`/`tester` | No existen: no hay conversación | El perfil **vacío** ya es lo que ocurre; sólo se registra | Ninguno |
| Rutas escribibles | `aplicarArchivos` (`protocolo-archivos.js:275-313`): insertar un predicado `rutasEscribir` después de `validarRuta` y antes de la regla de rol (`:290`); motivo `fuera_de_perfil` | Parámetro opcional en `opciones` | Un único punto; los cuatro caminos de escritura (bloque `generarArchivos` `nodos.js:119`, `editar` `herramientas-coder.js:430`) ya pasan por aquí. **Integraciones no escriben archivos del árbol por esta vía** (sin confirmar: `cli/integraciones.js`) |
| Rutas legibles (coder turnos) | `legible()` (`herramientas-coder.js:241-247`), más `listar`/`buscar` (filtro de prefijo) | Predicado `rutasLeer` en `legible` y filtro en los listados | Mantener `ejecutar_pruebas` y lectura de pruebas del implementador |
| Rutas legibles (recuperador) | `anadirArchivo` (`recuperador-archivos.js:~74`) | Pasar `rutasLeer` al recuperador desde `textoDeContexto` (`nodos.js:133-137`) | `qa` necesita leer lo que el plan nombre |
| Topes | `contexto_max_bytes` en `nodos.js:135`; `turnos_max`/`turnos_pruebas_max` en `turnos.js:164-165` | `min(config, perfil)` | Ninguno si el perfil por defecto = config |
| Resolución del perfil | Una función pura llamada en el arranque del nodo, antes de `invocar` (`nodos.js:68`) | `resolverPerfil(rol, definicion, politica, config)`; si lanza, el nodo devuelve `pedirRevision` **antes** de llamar al modelo | Falla cerrado (CA-002-04) |

## 5. Qué cambia en la spec o el plan

1. **CA-001-01 y la capa 1**: tabla indexada por **rol del nodo** (`planner|qa|refuerzo|coder`), no por nombre de agente. El plan (§5, «Garantías fijas por rol») lo dice por nombre de agente: corregir. `refuerzo` no tiene perfil propio en la spec; usa el de `qa` (un solo rol `'qa'`).
2. **CA-005-02 (tester)**: el techo actual del `qa` **permite sobrescribir cualquier archivo de prueba existente**, también los que no escribió la tarea. Reproducir esto en el perfil por defecto es lo que pide la regresión (RNF-03); apretarlo (p. ej. «sólo pruebas nuevas o las de la tarea») es una mejora **de comportamiento**, no un perfil equivalente, y debe ir como decisión explícita del dueño. Marcar en la spec como riesgo conocido, no corregirlo en silencio.
3. **CA-005-01 (arquitecto)**: «sin herramientas, sin escritura» ya es lo que hace; añadir que su salida alimenta `plan.archivosObjetivo`, que el recuperador **lee** (`nodos.js:133`): el arquitecto controla indirectamente qué se lee. El perfil de lectura del `qa`/`coder` debe aplicar también a esas rutas.
4. **Plan §3, módulo `nodos.js`/`turnos.js`**: añadir `core/recuperacion/recuperador-archivos.js` (lectura) y `core/ciclo/pruebas-confiables.js` (nodo `refuerzo`, `:185`) a los archivos tocados; el plan no los nombra.
5. **Plan §4, paso 1** («Cargar definición del agente con su perfil»): para `planner`/`qa`/`refuerzo` el nombre del agente es fijo y debe resolverse al arrancar el nodo; para `coder`, `tarea.agente` puede no existir en el registro (`index.js:141-142` ya devuelve «Agente desconocido»); definir si eso es un error de perfil (recomendado: sí, antes de gastar).

## 6. Riesgos

- Confundir la intención del perfil con `tools:` actual (`Bash` en `arquitecto` es una declaración sin efecto): documentarlo como «solicitud» (CA-001-03).
- `qa` y `coder` construyen su prompt dos veces; si el perfil cambia lo que se lee (`rutasLeer`), el prompt cambia y también la clave del diario (`reanudacion.md`).
- No hay prueba de regresión E2E aún (tarea F1 de la spec): hasta entonces cualquier cambio en `nodos.js` es sin red.

## 7. Recomendaciones sobre las preguntas abiertas

- **Pregunta 2** (agente sin perfil): perfil mínimo **del rol**, no del agente. Confirmado y precisado.
- **Pregunta 5** (alcance de la primera entrega): los tres agentes; pero el implementador es el rol `coder`, no un agente.
