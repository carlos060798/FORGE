# Spike S0.2: qué admite `parseFrontmatter` y dónde va el perfil

> 2026-10-17. Lectura de `core/agent-registry.js:64-83` y **experimento ejecutado** con el `AgentRegistry` real sobre agentes de prueba en un directorio temporal fuera del repositorio (`scratchpad/e1.mjs`, `e2.mjs`).

## 1. Cómo funciona el lector

`parseFrontmatter` (`agent-registry.js:64-83`): separa el bloque `---`, recorre **línea a línea**, toma lo anterior al primer `:` como clave (con `trim()`) y lo posterior como valor. Si el valor empieza por `[`, hace `JSON.parse(value.replace(/'/g,'"'))`; si falla, guarda el **texto** (no la lista). El resto: texto sin comillas.

No tiene noción de sangría, de listas con guion ni de claves anidadas.

## 2. Resultados del experimento

| Entrada | `tools` resultante | Observación |
|---|---|---|
| `tools: ["Read","Grep"]` | `["Read","Grep"]` | Único formato admitido |
| `tools:` + `  - Read` + `  - Write` (lista YAML) | `[]` | **Se pierde sin aviso** |
| `tools: [Read, Grep]` (sin comillas) | `[]` | JSON.parse falla → queda texto → `Array.isArray` falso (`:112`) → `[]` **sin aviso** |
| `tools: ['Read']` | `["Read"]` | Comillas simples toleradas |
| Fin de línea `\r\n` | `["Read"]` | Correcto en Windows |
| Clave mal escrita (`herramientsa: [x]`) | — | Se acepta como clave de `meta` y se ignora **sin aviso** |
| Bloque anidado `perfil:` con `  model: haiku` y `  tools: ["Write"]` | `model` efectivo **haiku**, `tools` **["Write"]** | **Las claves anidadas se aplanan y pisan las de primer nivel** (`model: opus` del mismo archivo queda anulado) |

Este último punto es el que importa: **un perfil anidado con el lector actual no sólo se ignoraría; machacaría `model`, `name`, `description` o `tools` del agente** (el orden manda: gana la última línea). Cualquier clave del perfil que coincida con una de primer nivel (`tools`, `model`, `goal`) tiene ese efecto.

Consecuencias de lo que ya existe: los errores del archivo (clave desconocida, valor mal formado) hoy **no se detectan nunca** en agentes, a diferencia de `sdd.config.yaml`, donde `leerSeccion` (`config.js:93-132`) falla con línea y clave para sangrías no admitidas.

## 3. Opciones

| Opción | Qué implica | A favor | En contra |
|---|---|---|---|
| A. Perfil anidado en la cabecera, ampliando `parseFrontmatter` | Escribir un lector con estructura y validación estricta | Un solo archivo por agente | Cambia el lector que carga **todos** los agentes del plugin; el aplanado actual es un riesgo de regresión; es el parser que usa también la ruta clásica. Requiere versionar. |
| B. Claves **planas** con prefijo en la cabecera (`perfil_herramientas: [...]`, `perfil_rutas_escribir: [...]`) | Lector del mismo tipo (`[...]` JSON) + validación de claves `perfil_*` conocidas | Cabe en el formato actual; sin anidar; no pisa claves existentes | Estilo menos legible; el lector sigue ignorando las erratas fuera de `perfil_*` |
| C. Archivo hermano `agents/<nombre>.perfil.json` | JSON estricto con `JSON.parse` (error con posición); un validador único | Validación completa sin tocar el lector de agentes; el filtro `.endsWith('.md')` (`agent-registry.js:100`) ya lo ignora al cargar | Dos archivos por agente; la copia de agentes a `.claude/agents/` es sólo `.md` (`cli/index.js:261`, `copyMd`) → el perfil **no viaja** al proyecto del usuario (lo cual es una ventaja: el perfil del plugin no se copia a un árbol editable) |
| D. Capa 1 en código (`core/ciclo/perfiles.js`); definición del agente sólo como **solicitud** (`tools:`); capa 3 en `sdd.config.yaml` | Nada nuevo en `agents/` | Coincide con la regla «el motor impone»; la capa 1 no es un archivo editable (CA-003-01) | La capa 3 necesita una sección nueva en la configuración |

## 4. Decisión recomendada

1. **Capa 1 en código** (D) indexada por rol del nodo (ver `roles-del-ciclo.md` §1). No hay archivo que parsear; no hay lector que ampliar.
2. **Capa 3 (proyecto, sólo reducir) en `sdd.config.yaml`**, sección nueva `perfiles:` con claves planas `<rol>_herramientas`, `<rol>_rutas_escribir`, `<rol>_contexto_max_bytes`, `<rol>_pasos_max`. `leerSeccion` ya da error con línea y clave para sangrías malas (`config.js:104-114`), aunque sólo para claves **conocidas** (`claveConocida`, `:84-91`): una errata en una clave desconocida de la sección nueva se ignoraría igual. Hay que añadir validación de claves desconocidas para `perfiles` (sin confirmar si `leerConfigCiclo` ya rechaza claves desconocidas en otras secciones; no se ejecutó).
3. **Capa 3 alternativa o complementaria (agente)**: la cabecera `tools:` sigue siendo «solicitud» (CA-001-03). Si se quiere que un agente reduzca su perfil, usar la opción B (claves planas `perfil_*`) con **error en errata**, aplicado sólo a claves con prefijo `perfil_`.
4. **No hacer** la opción A en la primera entrega.
5. Arreglar de forma separada y barata el fallo silencioso de `tools`: si `tools:` está presente y no produce una lista, `AgentRegistry.load` debería lanzar con archivo y clave. Hoy `tools: [Read, Grep]` da `[]`. Es una mejora de la spec CA-001-02 para la cabecera ya existente.

## 5. Qué cambia en la spec o el plan

1. **CA-001-01/02 y pregunta 1**: la respuesta es «ni cabecera anidada ni archivo hermano del agente: capa 1 en código, capa 3 en `sdd.config.yaml`, cabecera sólo como solicitud». La spec asumía que el perfil «viaja con el rol» en la definición del agente; con esta decisión **viaja en el código** (el rol es del motor, no del agente: `roles-del-ciclo.md`).
2. **CA-002-04 / CA-001-02** («error con archivo y clave»): se cumple con `JSON.parse`/`leerSeccion` extendido; para la cabecera existente añadir el error de `tools` mal formado.
3. **Plan §3**: eliminar «`core/agent-registry.js` lee y valida el perfil de la definición»; sustituir por «`core/ciclo/config.js` lee la sección `perfiles`» y «`agent-registry.js` valida `tools:`».
4. **Riesgo nuevo en la spec §10**: el aplanado de claves anidadas del lector actual (ver §2); cualquier agente del proyecto con sangrías puede pisar `model` o `tools`. Sólo relevante si un proyecto aporta agentes (ver `origen-y-gancho.md`: hoy no los carga el ciclo).

## 6. Riesgos

- Ampliar el lector (opción A) rompe silenciosamente los 14 agentes si alguno ya tiene líneas indentadas dentro del bloque (sin confirmar: no se revisaron los 14 `agents/*.md` buscando sangrías).
- Una errata en `sdd.config.yaml` en una clave de perfil que reduce (`herramientas` vs `herramientsa`) **no reduce nada**: falla abierto hacia el techo de la capa 1, que es el comportamiento actual. Aceptable (capa 3 sólo reduce), pero `forge doctor` debe avisar (CA-003-04).
