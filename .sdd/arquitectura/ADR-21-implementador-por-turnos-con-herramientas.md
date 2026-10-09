# ADR-21: Implementador por turnos con herramientas en proceso, como modo opcional

> Estado: aceptada  # propuesta | aceptada | obsoleta | reemplazada-por-ADR-XX
> Fecha: 2026-10-09 (aceptada por delegación del dueño, 2026-10-09)
> Spec relacionada: 2026-10-09-implementador-con-herramientas
> Autor: Claude
> Amplía: ADR-07 (salida de agentes como bloque de archivos), que queda como modo de respaldo. No cambia ADR-15.

## Contexto

En el motor headless cada agente es una llamada de completado sin herramientas (ADR-07): recibe todo en un mensaje y devuelve archivos completos en un bloque JSON (`core/ciclo/contratos.js:9-19`). El contrato de proveedor solo tiene `complete({ systemPrompt, userPrompt })` (`core/llm-providers/provider-interface.js`). Para el implementador eso implica:

- No ve nada que el recuperador no haya incluido, dentro de un tope de 64 KB de contexto.
- Reescribe entero cada archivo que toca; un archivo que no cabe en la respuesta no se puede modificar.
- Un JSON mal formado invalida la respuesta completa y cuesta un segundo intento.

Los agentes de código actuales trabajan en un bucle de herramientas: leen, buscan, editan un fragmento y ejecutan, varias veces por tarea. El repo ya tiene las piezas: `core/mcp/herramientas.js` implementa leer, escribir confinado y ejecutar en el entorno aislado, compartiendo `validarRuta`, `aplicarArchivos`, `Respaldo` y `SandboxRunner` con el ciclo.

ADR-15 descartó un cliente MCP dentro de los nodos porque no añadía seguridad y complicaba errores y reanudación. Esa razón sigue en pie y esta decisión la respeta.

## Decisión

El nodo `coder` gana un segundo modo, `turnos`, en el que el modelo pide acciones y el motor las ejecuta en proceso. El modo actual, `bloque`, sigue siendo el predeterminado.

- **Contrato de proveedor.** Se añade una operación opcional de conversación con herramientas y una propiedad que declara si el proveedor la admite. Sin ella, el ciclo avisa y usa `bloque`.
- **Cinco herramientas**, funciones del propio proceso, sin protocolo intermedio: `leer_archivo` (con tramo opcional), `listar`, `buscar`, `editar` (sustituir un fragmento exacto y único, o crear un archivo) y `ejecutar_pruebas`.
- **Un solo lugar para las reglas.** Lectura y escritura pasan por `validarRuta` y `aplicarArchivos`, con el mismo rol `coder`, los mismos vetos y el mismo respaldo que hoy. `ejecutar_pruebas` usa el `SandboxRunner` con el comando de pruebas del proyecto y nada más.
- **Turnos acotados y contabilizados.** Cada turno pasa por `invocar` (presupuesto, degradación, parada). Tope de turnos por intento, configurable. Los turnos no son iteraciones.
- **Diario por turno.** Cada respuesta del modelo y cada resultado de herramienta se guardan en el diario antes de seguir, con escritura atómica (Principio IX). Reanudar reproduce la conversación desde el diario sin volver a llamar.
- **El éxito no cambia de manos.** Cuando el modelo declara que terminó, o al agotar los turnos, el grafo sigue a `sandbox` y al router como hoy.
- **Configuración.** `motor.implementador: bloque | turnos`. Por defecto `bloque` hasta la siguiente versión MAYOR (mismo patrón que ADR-09).

## Alternativas consideradas

- **A. Mantener solo el modo de bloque y subir el tope de contexto**: rechazada. No resuelve los archivos grandes ni el costo de reescribir, y encarece cada llamada.
- **B. Pedir diferencias en lugar de archivos completos, en una sola respuesta**: rechazada como solución única. Reduce la salida, pero el modelo sigue sin poder leer lo que no se le dio, y las diferencias mal formadas fallan a menudo.
- **C. Cliente MCP en los nodos contra `forge mcp`**: rechazada por las razones de ADR-15: un proceso y un protocolo más, sin seguridad añadida, con errores sin tipo y reanudación más difícil.
- **D. Delegar el implementador en un agente de código externo**: rechazada. Fija un proveedor (Principio III) y pone el confinamiento fuera del control del ciclo.
- **E. Bucle de herramientas en proceso, opt-in**: propuesta. Reutiliza las reglas ya revisadas y no añade dependencias.

## Consecuencias

### Positivas
- El implementador ve lo que necesita y cambia solo lo necesario.
- Menos tokens de salida en tareas de edición.
- Un error de formato afecta a un turno, no a toda la respuesta.

### Negativas
- Más llamadas por tarea. El prompt de sistema y el historial se reenvían en cada turno: sin caché de prompts (spec `2026-10-09-puesta-al-dia`) el costo de entrada puede superar al del modo de bloque.
- El estado del ciclo pasa a incluir una conversación. Los puntos de guardado y el diario crecen, y la reanudación tiene más casos.
- Superficie nueva: el contenido de un archivo leído puede intentar dirigir al modelo. La frontera siguen siendo las reglas de ruta y el aislamiento, y hay que probarlo con un proyecto hostil.
- Los cuatro proveedores tienen formas distintas de llamar herramientas, y los modelos locales pequeños las usan con poca fiabilidad.
- Dos modos del mismo nodo que mantener hasta retirar uno.

### Neutrales
- `forge mcp` no cambia. Ganará `listar` y `buscar` solo si se decide exponerlas, en otra spec.
- El recuperador (ADR-08) sigue útil para el planificador y el agente de pruebas; para el implementador por turnos puede reducirse.

## Cuándo revisitar

- Si la validación con un modelo real (FASE 6) muestra que el modo de bloque falla el formato en menos del 5 % de las llamadas y las tareas reales son de archivos pequeños: esta decisión puede esperar.
- Al preparar la siguiente versión MAYOR: decidir si `turnos` pasa a ser el modo por defecto y si `bloque` se retira.

## Cómo quedó implementada

Implementada el 2026-10-09 como modo opcional. Probada solo con respuestas guionizadas y con un cliente falso del SDK: **ningún modelo real ha trabajado todavía en este modo** (ver `verificacion.md` de la spec).

**Piezas**

| Pieza | Dónde |
|---|---|
| Contrato de proveedor: `admiteHerramientas` y `conversar`, en una forma neutra | `core/llm-providers/provider-interface.js` |
| Proveedores que lo admiten: Anthropic (con clave) y el de pruebas (con guion). OpenAI y Ollama declaran que no | `core/llm-providers/` |
| Las cinco herramientas | `core/ciclo/herramientas-coder.js` |
| El bucle de turnos, la elección de modo y el prompt | `core/ciclo/turnos.js` |
| Contrato del agente en este modo | `CONTRATO_CODER_TURNOS` en `core/ciclo/contratos.js` |
| Bifurcación del nodo | principio de `coder` en `core/ciclo/nodos.js` |
| Diario y libro de gasto por turno | `_conversador` en `core/ciclo/index.js` |
| Configuración | `motor.implementador`, `motor.turnos_max` (30), `motor.turnos_pruebas_max` (5), `FORGE_IMPLEMENTADOR` |

**Diferencias con lo decidido arriba**

- *«Cada turno pasa por `invocar`»*: no literalmente. `invocar` hace llamadas de un solo mensaje y otra spec la estaba modificando a la vez. El bucle usa las mismas funciones de `presupuesto.js` (`puedeLlamar`, `modeloEfectivo`, `limitarNivel`, `registrar`, `sinPrecioConocido`) con una función propia de unas quince líneas que repite el orden de `invocar`. Es duplicación de pegamento, no de reglas; conviene unificarla cuando `invocar` se estabilice.
- *Escritura atómica*: `aplicarArchivos` gana una opción `atomica` (temporal en la misma carpeta, creado en exclusiva, y renombrado). Solo la usa este modo; el de bloque escribe como antes.
- *El recuperador*: en este modo el implementador no recibe su contexto, solo la lista de archivos.

**Diario por turno y reanudación**

El diario de un hilo guarda lo que está en vuelo dentro de un nodo y se vacía al guardar el punto de ese nodo. El modo de bloque lo indexa por la huella del prompt. Aquí el prompt de cada turno es la conversación entera, así que la clave es la posición del turno (el hilo no va en la clave: cada hilo tiene su archivo):

| Clave | Contenido | Cuándo se anota |
|---|---|---|
| `turno:<iteración>:inicio` | el primer mensaje, tal como se envió | antes del primer turno |
| `turno:<iteración>:<n>` | la respuesta del modelo | al recibirla, antes de ejecutar nada |
| `turno:<iteración>:<n>:r:<i>` | el resultado de su herramienta `i` | al terminar de ejecutarla |

Al reanudar, el nodo empieza de nuevo y recorre los mismos turnos. Los que están en el diario no se piden ni se pagan otra vez, y sus herramientas **no se vuelven a ejecutar**: se reutiliza el resultado anotado. Es necesario para la idempotencia (una sustitución ya aplicada no encontraría su fragmento) y para que la conversación reproducida sea la que el modelo vio. El primer mensaje también se guarda porque el mapa de archivos cambia con lo que el propio implementador escribe. El gasto no se cuenta dos veces porque la fuente de verdad es el libro de gasto de la sesión, que se anota una vez por llamada real.

Ventana que queda: un corte entre que una herramienta escribe y que su resultado se anota. Al reanudar se repite esa acción. Un archivo entero se reescribe igual; una sustitución ya aplicada devuelve «el fragmento no aparece» sin cambiar nada.

**El modo es del hilo**

La primera vez que el implementador trabaja en una tarea, el modo usado se anota en su estado (`estado.implementador`) y se conserva hasta que termina: lo pausado en `bloque` se reanuda en `bloque` aunque la configuración diga `turnos`, y al revés. Para un corte dentro de ese primer intento, antes de que exista ningún punto del nodo, el modo se deduce del diario (hay claves `turno:` o no). Un hilo anterior a esta versión que ya tenga implementación o ejecuciones se trata como `bloque`.

**Sin herramientas**

Si toca `turnos` y el proveedor no las admite, queda un evento `ciclo:implementador_sin_herramientas` y la tarea se implementa en `bloque`. Si la degradación por gasto lleva a un modelo local a mitad de un intento, los turnos se detienen: con algo escrito se ejecutan las pruebas finales; sin nada escrito se pide revisión, y al continuar se trabaja en `bloque`.

**Qué falta**

- Probarlo con un modelo real y medir el costo.
- Caché de prompts en `conversar`: hoy cada turno reenvía todo.
- Herramientas en OpenAI y en modelos locales.
- Revisión independiente de código y de seguridad.

## Referencias

- `.sdd/arquitectura/ADR-07-salida-de-agentes-como-archivos.md`, `ADR-15-sin-cliente-mcp-en-los-nodos.md`, `ADR-04-puntos-de-guardado-en-archivos.md`, `ADR-06-presupuesto-en-el-estado.md`
- `core/mcp/herramientas.js`, `core/ciclo/protocolo-archivos.js`
- `PLAN-CIERRE-BRECHAS.md`, FASE 8
- `.sdd/especificaciones/2026-10-09-implementador-con-herramientas/spikes/herramientas-por-proveedor.md` y `verificacion.md`
