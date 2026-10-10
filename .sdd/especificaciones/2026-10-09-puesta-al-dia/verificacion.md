# Verificación: Puesta al día

> Spec: `2026-10-09-puesta-al-dia` · FASE 9 de `PLAN-CIERRE-BRECHAS.md`
> Fecha: 2026-10-09
> Tipo: **autoevaluación de quien implementó.** No ha pasado por una verificación ni por una revisión de seguridad independientes (la constitución las pide para los cambios en el aislamiento).
> Aprobación de la spec: por delegación del dueño, 2026-10-09.

Leyenda: ✅ con prueba automática que pasa · ⚠️ parcial (se dice qué falta) · ❌ no hecho o no medido · — no aplica.

## Resumen

| | Criterios | ✅ | ⚠️ | ❌ | — |
|---|---|---|---|---|---|
| HU-001 Caché de prompts | 5 | 5 | 0 | 0 | 0 |
| HU-002 Protocolo MCP | 5 | 3 | 1 | 0 | 1 |
| HU-003 `AGENTS.md` | 4 | 4 | 0 | 0 | 0 |
| HU-004 Aislamiento elegible | 5 | 5 | 0 | 0 | 0 |
| **Total** | **19** | **17** | **1** | **0** | **1** |

Lo que esta tabla **no** dice, y es lo más importante de este documento:

1. **El ahorro de la caché no está medido.** Ninguna prueba llama a un modelo. Los cinco ✅ de HU-001 prueban que la petición lleva la marca, que cada tipo de token se cobra a su precio y que el libro de gasto lo anota; no que el proveedor guarde y reutilice de verdad, ni cuánto se ahorra. El requisito no funcional «al menos un 30 % menos de gasto de entrada» está **sin medir** (❌).
2. **La petición con la marca de caché no se ha enviado nunca al proveedor real.** Su forma está copiada de la documentación oficial, no comprobada con una respuesta real.
3. **La revisión nueva de MCP solo se ha probado con un cliente escrito para las pruebas**, no con el cliente oficial ni con ningún cliente real.
4. **Ningún mecanismo de aislamiento más estricto que el de por defecto se ha probado.** No hay ninguno instalado en el equipo de desarrollo.

## HU-001: No pagar dos veces por lo mismo

Pruebas: `tests/cache-prompts.test.js` (32 pruebas, con un cliente falso del SDK).

| Criterio | Estado | Prueba | Qué demuestra y qué no |
|---|---|---|---|
| CA-001-01 La parte fija se marca como reutilizable | ✅ | «CA-001-01 — la parte fija de la llamada se marca como reutilizable» y «…el orden del prompt de sistema: lo fijo primero» | La petición que se entrega al SDK lleva el prompt de sistema como bloque con `cache_control: { type: "ephemeral" }`; en el ciclo, el prompt de sistema es idéntico byte a byte entre llamadas de un mismo agente. **No demuestra** que el proveedor acepte esa forma: no se envió ninguna petición real |
| CA-001-02 El gasto distingue normal, guardado y reutilizado | ✅ | «CA-001-02 y CA-001-03 — cada tipo de token a su precio» y «CA-001-02 — el libro de gasto distingue los tres tipos de entrada» | `gasto.jsonl` anota `inputTokens`, `cacheCreationTokens` y `cacheReadTokens`; el costo de cada línea es la suma de los cuatro tipos a su precio; el libro y el presupuesto del estado coinciden |
| CA-001-03 El tope usa esos precios; nunca se registra de menos | ✅ | «nunca se registra menos de lo que cobra el proveedor…», «un modelo sin precios de caché…», «un modelo desconocido…», «CA-001-03 — el acumulador del modo clásico tampoco registra de menos» | Para todos los modelos de la lista, el precio aplicado a la caché no baja del de la lista; sin precio de caché se cobra la lectura a precio de entrada y la escritura a 1,25 veces. **Depende de** que la lista de precios (copiada de la página oficial el 2026-10-09) siga vigente, y solo contempla la caché de 5 minutos, que es la única que se pide |
| CA-001-04 Con un proveedor que no lo permite, nada cambia | ✅ | «CA-001-04 — con un proveedor que no lo permite, nada cambia» y la suite anterior, sin tocar | Sin campos de caché, la respuesta del llamador, la línea de `gasto.jsonl` y los totales tienen exactamente las mismas claves que antes. Los proveedores de OpenAI y Ollama no se modificaron |
| CA-001-05 Se puede desactivar | ✅ | «CA-001-05 — la reutilización se puede desactivar» | Con `llm.cache: false` el prompt de sistema va como texto, sin `cache_control`; un valor que no sea `true` ni `false` se rechaza |

**Escenario 1** (tres iteraciones; la segunda y la tercera registran entrada a precio reducido): hay una prueba, «Escenario 1 (con caché SIMULADA)», en la que el cliente falso imita la regla de la caché. Comprueba la contabilidad de extremo a extremo (proveedor → adaptador → llamador → libro), **no el comportamiento del proveedor**. ⚠️

### Pendiente: medir el ahorro real

No se puede hacer sin un modelo de pago. Cómo hacerlo:

1. Proyecto de prueba con una tarea que necesite al menos tres iteraciones del implementador (por ejemplo, una con un caso límite que suele fallar a la primera).
2. `forge run` con el proveedor de Anthropic y `llm.cache: true` (el valor por defecto).
3. Abrir `.sdd/motor/<sesión>/gasto.jsonl`. Cada línea es una llamada. Mirar las del implementador, en orden:
   - la primera debe traer `cacheCreationTokens` > 0 y `cacheReadTokens` = 0;
   - las siguientes, `cacheReadTokens` > 0 (y aproximadamente igual al `cacheCreationTokens` de la primera) y `cacheCreationTokens` = 0;
   - si **todas** traen 0 en los dos campos, la caché no está actuando: o el prompt de sistema del agente no llega al mínimo del modelo (1024 tokens en Sonnet 4.6 y Opus 4.8; 4096 en Haiku 4.5; 512 en los modelos más recientes), o pasaron más de 5 minutos entre llamadas.
4. Gasto de entrada con caché: suma, por línea, de `inputTokens × entrada + cacheCreationTokens × escritura + cacheReadTokens × lectura`, con los precios del modelo en `core/precios.js`. Gasto de entrada sin caché: `(inputTokens + cacheCreationTokens + cacheReadTokens) × entrada`. El criterio pide que el primero sea al menos un 30 % menor.
5. Para contrastar con lo facturado, repetir la misma tarea con `llm.cache: false` y comparar los dos totales con los de la consola del proveedor.

Aviso previo, por aritmética y no por medición: la parte fija son las instrucciones del agente y el contrato de salida; la parte variable (la tarea, el contexto, las pruebas, el fallo anterior) suele ser mayor. Si la parte fija es una fracción pequeña de la entrada, el ahorro no llegará al 30 % aunque la caché funcione perfectamente.

## HU-002: Herramientas que hablan la revisión vigente

Pruebas: `tests/mcp-sin-estado.test.js` (29 pruebas; una necesita Docker) y `tests/mcp-protocolo.test.js` (24: las de antes, que ahora recorren también `2025-11-25`).

| Criterio | Estado | Evidencia | Qué demuestra y qué no |
|---|---|---|---|
| CA-002-01 Informe basado en la especificación oficial | ✅ | `spikes/mcp-revision-vigente.md` | Dice cuál es la revisión vigente (`2026-07-28`), qué cambia para un servidor por entrada y salida estándar, con las doce páginas oficiales consultadas y con lo que no se leyó (el esquema completo, entre otras cosas) |
| CA-002-02 Un cliente de la revisión nueva se conecta y usa las tres herramientas | ⚠️ | «CA-002-02 — un cliente de la revisión sin estado se conecta sin saludo» y «CA-002-02 — `forge mcp` real, sin saludo» | Un cliente **escrito para las pruebas** descubre el servidor, lista las tres herramientas y usa las tres contra el proceso real (`ejecutar_pruebas`, con Docker). **Falta**: probarlo con el cliente oficial o con cualquier cliente real que hable esa revisión, y validar las respuestas contra el esquema oficial. Quien escribió el cliente de pruebas es quien escribió el servidor: un mismo malentendido de la especificación pasaría las pruebas |
| CA-002-03 Los clientes de las revisiones aceptadas siguen funcionando igual | ✅ | «CA-002-03 — los clientes de las revisiones con saludo siguen funcionando igual»; `tests/mcp-protocolo.test.js` y `tests/mcp-e2e.test.js`, sin modificar | Las respuestas con saludo tienen exactamente la forma de antes para las cuatro revisiones. **Sin repetir**: la prueba con el cliente oficial (`CA-004-06` de la spec de herramientas) se salta porque el paquete oficial no está instalado; no se volvió a ejecutar después de este cambio |
| CA-002-04 Una revisión desconocida recibe una respuesta clara | ✅ | «CA-002-04 — una revisión desconocida recibe una respuesta clara con las admitidas» | Sin saludo: error `-32022` con la versión pedida y las admitidas, y el mensaje nombra todas. Con saludo: se responde con la más reciente de las de saludo, como manda esa época |
| CA-002-05 Si no hay nada que cambiar, se cierra con el informe | — | — | No aplica: el informe concluyó que sí había que cambiar |

Decisiones de interpretación que el dueño debería conocer (detalle en el informe): qué versiones se anuncian en el error y en `server/discover`; `subscriptions/listen` aceptado con filtro vacío; `2025-11-25` añadida a las de saludo aunque no se pedía.

## HU-003: Reglas del proyecto donde los agentes las buscan

Pruebas: `tests/agents-md.test.js` (23 pruebas; ejecutan `forge init` de verdad en directorios temporales).

| Criterio | Estado | Prueba | Qué demuestra y qué no |
|---|---|---|---|
| CA-003-01 El repositorio de FORGE tiene el archivo | ✅ | «CA-003-01 — el repositorio de FORGE tiene su archivo de instrucciones» | `AGENTS.md` dice cómo ejecutar las pruebas, dónde están los artefactos y recoge las ocho restricciones de la constitución; la prueba falla si la constitución cambia de restricciones y el archivo no. **Escrito a mano**, no generado: es un resumen, y que el resumen sea fiel lo juzga una persona |
| CA-003-02 Al inicializar se crea a partir de la constitución, si no existe | ✅ | «CA-003-02 — generar el archivo a partir de la constitución» | Con constitución: nombre, propósito, stack, restricciones, convenciones, estándares y enunciado de los principios. Sin constitución (lo habitual en un `forge init` recién hecho) o con la plantilla sin rellenar: plantilla mínima |
| CA-003-03 Si ya existe, no se sobrescribe | ✅ | «CA-003-03 — si el archivo ya existe, no se sobrescribe» | Queda igual byte a byte, también si está vacío o si lo generó FORGE antes; se informa y la propuesta va a `.sdd/AGENTS.propuesto.md` |
| CA-003-04 Sin secretos ni rutas del equipo | ✅ | «CA-003-04 — el archivo no contiene secretos ni rutas del equipo» | Lo generado no contiene la ruta del proyecto, la carpeta personal, la temporal ni el nombre de usuario. Lo copiado de la constitución pasa por el limpiador de secretos y de rutas de carpetas personales. **Límite**: el limpiador reconoce formatos comunes, no todos; un secreto con una forma inesperada escrito en la constitución pasaría |

Fuera de lo pedido y no hecho: `forge update` no crea ni propone el archivo; solo `forge init`.

## HU-004: Elegir un aislamiento más estricto

Pruebas: `tests/sandbox-runtime.test.js` (29 pruebas; 6 necesitan Docker y se ejecutaron contra Docker real en Windows).

| Criterio | Estado | Prueba | Qué demuestra y qué no |
|---|---|---|---|
| CA-004-01 Se indica en la configuración; sin indicarlo, el actual | ✅ | «CA-004-01 — el mecanismo de aislamiento se indica en la configuración»; real: «con runc las pruebas se ejecutan y pasan» | Sin `sandbox.runtime`, la orden es idéntica a la de antes. Con él, se añade `--runtime <valor>` |
| CA-004-02 Si no está disponible, no empieza y sale con el código de «aislamiento no disponible» | ✅ | «CA-004-02 — si el mecanismo indicado no está disponible, no se ejecuta nada»; real: «con un runtime inexistente se niega…» y «por la CLI: `forge run` … termina con el código 4 y nombra el runtime» | Contra Docker real: código de salida 4, el mensaje nombra el mecanismo, no se crea sesión ni se lanza ningún contenedor. Si Docker no contesta a la consulta, también se niega |
| CA-004-03 Las restricciones se mantienen con cualquier mecanismo | ✅ | «CA-004-03 — todas las restricciones se mantienen con cualquier mecanismo»; real: «con runc el código sigue sin red y sin poder escribir fuera…» | La orden con mecanismo es la de sin mecanismo más dos argumentos, ni uno menos. **Límite**: que un mecanismo alternativo real respete cada opción (límites de memoria, usuario, solo lectura) depende de ese mecanismo y no se ha probado con ninguno |
| CA-004-04 Un valor que pudiera ser una opción se rechaza | ✅ | «CA-004-04 — un valor que pudiera interpretarse como opciones se rechaza» | Se rechaza en tres sitios: al leer la configuración, al crear el ejecutor de pruebas y al construir la orden |
| CA-004-05 El estado y el diagnóstico muestran el mecanismo | ✅ | «CA-004-05 — la consulta de estado y el diagnóstico muestran el mecanismo en uso»; real: «`forge doctor` real…» | `forge status` muestra el mecanismo **configurado** (no consulta a Docker). `forge doctor` consulta a Docker cuando hay uno configurado |

No cubierto: el mecanismo no se aplica a la construcción de la imagen con las dependencias (la hace el constructor de Docker). Quien elija un mecanismo más estricto debe saber que la instalación de dependencias no corre bajo él.

## Requisitos no funcionales y criterios de éxito

| Requisito | Estado | Evidencia |
|---|---|---|
| Ahorro: al menos un 30 % menos de gasto de entrada en una tarea de tres iteraciones | ❌ sin medir | Hace falta un modelo de pago. Procedimiento arriba |
| Dependencias: ninguna nueva | ✅ | `dependencies` y `devDependencies` de `package.json` no cambian; solo se añade `AGENTS.md` a `files` |
| Compatibilidad: nada cambia sin configurar | ⚠️ | La suite anterior pasa sin modificar ninguna prueba existente. **Dos cambios de comportamiento sin configurar nada**, ambos deliberados: (1) con Anthropic la caché está activa por defecto, así que cambia la petición y el gasto calculado; (2) el prompt de sistema del modo clásico pone el contrato antes que el estado |
| Honestidad: el informe de HU-002 cita la fuente oficial | ✅ | `spikes/mcp-revision-vigente.md` |
| Los 19 criterios tienen prueba o evidencia | ⚠️ | 17 con prueba, 1 parcial (CA-002-02), 1 no aplica (CA-002-05) |
| 0 clientes actuales rotos | ⚠️ | Las pruebas de las revisiones con saludo pasan; la del cliente oficial no se pudo repetir |

## Ejecución de las pruebas

Equipo de desarrollo: Windows 11, Node 24, Docker Desktop. Otros procesos usaban el equipo a la vez.

| Orden | Resultado |
|---|---|
| `npm test` | 1658 pruebas: 1650 pasan, 0 fallan, 8 saltadas (las que piden Docker, el cliente oficial de MCP o enlaces de archivo). Antes de este cambio: 1549, 1542 y 7 |
| `FORGE_TEST_DOCKER=1 node --test tests/sandbox-real.test.js tests/sandbox-politica.test.js` | 40 pruebas: 40 pasan, 0 fallan, 0 saltadas |
| `FORGE_TEST_DOCKER=1 node --test tests/sandbox-runtime.test.js tests/mcp-sin-estado.test.js` | 58 pruebas: 58 pasan, 0 fallan, 0 saltadas |
| Las cuatro anteriores más `tests/cache-prompts.test.js` y `tests/agents-md.test.js`, con `FORGE_TEST_DOCKER=1`, tras el último cambio | 153 pruebas: 153 pasan, 0 fallan, 0 saltadas |
| `FORGE_TEST_DOCKER=1 npm test` (suite entera con Docker) | **Una ejecución, con un fallo**: 1681 pruebas, 1677 pasan, 1 falla, 3 saltadas (ejecutada antes de añadir la última prueba). Falló «Go con Docker real › con una dependencia», tras 585 segundos: la construcción de la imagen, que descarga un módulo con red, no terminó a tiempo. Ese archivo ejecutado solo justo después pasa entero (11 de 11; esa prueba, en 50 segundos). No toca código de este cambio, pero **la suite entera con Docker no se ha visto en verde en una sola pasada** y no se repitió (tarda más de diez minutos) |

Pruebas inestables observadas durante el trabajo:

- Las de `tests/performance.test.js` miden tiempos con umbrales fijos (50 ms, 150 ms). Fallaron en tres de las ocho ejecuciones de la suite completa, la primera de ellas antes de cambiar nada; ejecutadas solas pasan. Ajenas a este cambio.
- `doctor advierte cuando estado.json está malformado` (`tests/cli-config.test.js`) agotó una vez sus 10 segundos. **Esta sí pudo ser culpa de este cambio**: en ese momento `forge doctor` consultaba siempre a Docker. Se corrigió: ahora solo lo consulta si hay un `sandbox.runtime` configurado. No volvió a fallar en las tres ejecuciones siguientes, que no es prueba de que no vuelva a pasar con el equipo cargado.

`npm run typecheck` no pasa, ni antes ni después de este cambio (errores en archivos que no se tocaron); se comprobó que los archivos tocados no añaden errores nuevos, pero no se usó como criterio. No ejecutado: el job `aislamiento` de CI en Linux; nada con un modelo de pago.

## Correcciones tras la revisión independiente

Informe: `revision-independiente.md`. Pruebas nuevas: `tests/puesta-al-dia-revision.test.js`. Ninguna se ha probado con un modelo de pago ni con un daemon con un mecanismo distinto de `runc`.

| Hallazgo | Estado | Evidencia y límites |
|---|---|---|
| H-01 `init` escribe por enlaces (alta) | ✅ corregido | Batería con uniones de directorio (`mklink /J`, ejecutada en Windows): 9 directorios × {hacia fuera, colgante} y 7 archivos como unión, más enlaces duros a archivos de fuera. Enlaces simbólicos a archivos: **no ejecutables en este Windows (EPERM)**; se ejecutan en Linux con Docker (12 escenarios, `FORGE_TEST_DOCKER=1`, imagen `node:22-alpine`, sin montar el proyecto del equipo). La prueba de enlaces simbólicos nativos se salta aquí y corre donde se puedan crear. Sin doble de `fs`: la lógica es `lstat` y se cubre con los casos reales |
| H-02 limpiador | ✅ corregido, ⚠️ límites | 15 secretos y 15 rutas nuevos, 39 casos de falsos positivos (SHA-1/SHA-256, UUID, `integrity` de package-lock, identificadores `AKIA…` inocentes, rutas relativas con `Users`, URLs con `/root/`). **No es una frontera de seguridad.** Límites: con espacios en el nombre se recorta el componente completo pero una ruta a medias (`C:\Users\Juan Perez` sin más) deja `Perez`; `/c/Users/x` y `/a/Users/x` se tratan como rutas; los caracteres de ancho cero entre dos caracteres de token ASCII se eliminan de la salida (cambia ese texto, no lo destruye); las rutas solo se omiten en `AGENTS.md`, no en la salida de pruebas |
| H-03 NaN/negativos en el tope | ✅ corregido | `registrar`, `costoDe`, `_llamador`, `_conversador` y un ciclo completo que acaba en revisión; 12 valores malos × entrada y salida. Los decimales (`1.5`) también cuentan como no informados. Un proveedor sin costo con valores rotos cuenta 0 |
| H-04 estructura de `AGENTS.md` | ✅ corregido, ⚠️ límite | Constitución hostil con bloques y comentarios sin cerrar, `~~~`, títulos de nivel 1, `name` y `scripts.test` con saltos. **Las instrucciones en prosa («ignora lo anterior») no se detectan**: `AGENTS.md` hereda la confianza de la constitución y de `package.json` |
| H-05 `sandbox.runtime` | ✅ mitigado | Lista de permitidos por `FORGE_RUNTIMES_PERMITIDOS`; salida 4 en CLI, error en MCP, problema en `doctor`. **Mitigado, no eliminado**: quien la define autoriza a ojos cerrados lo que ponga. No hay `~/.forge/config.yaml` (no existe el mecanismo). Sin probar con ningún mecanismo autorizado distinto de `runc` (la prueba con Docker real usa `runc` y un nombre inexistente) |
| H-06 acumulador clásico | ✅ corregido | Caché negativa, NaN y texto no restan; respeta `precios:` si se le dan al constructor. **No hay cableado**: el acumulador global del proceso (`sessionBudget`) no recibe `precios:` del proyecto; solo se usa con `new SessionBudget(umbral, { precios })` |
| H-07 `llm.cache` | ✅ corregido | 1 espacio, tabulación y `{}` fallan con error claro. **Cambio de comportamiento**: una configuración antigua con esa sangría en `llm:` ahora no arranca (antes ignoraba esa clave). Otras claves desconocidas de `llm:` se siguen ignorando |
| H-08 petición sin `_meta` | ✅ decidido | Se conserva el comportamiento de época antigua para `tools/*` (no rompe a quien nunca saludó) y `-32602` para los métodos que solo existen sin estado. El campo `inicializado` sigue sin leerse |
| H-10 suscripciones | ✅ corregido | Tope de 64 y id repetido: `-32602` |
| H-11 `initialize` desconocido | ✅ corregido | Compara con `git show 3da91d3:core/mcp/protocolo.js`: idéntico para los casos que ya existían. **Dos pruebas anteriores se modificaron** (`mcp-protocolo` CA-004-02 y `mcp-sin-estado`) porque afirmaban la más reciente. `2025-11-25` pedida explícitamente se sigue devolviendo tal cual (el servidor antiguo no la conocía) |
| H-09 cancelación sin detener la herramienta | ❌ abierto | Límite documentado en `docs/servidor-mcp.md` |
| H-12 `supported` de `-32022` | ❌ abierto | Sin contrastar con `schema.json` |
| H-13 caché de 1 hora, Haiku 5.5 > 100 000 tokens | ❌ abierto | Hoy sin efecto (FORGE no pide `ttl: 1h`) |

Totales tras estas correcciones (Windows 11, Node 24, Docker Desktop): `node --test tests/*.test.js` → 1963 pruebas, 1956 pasan, 0 fallan, 7 saltadas. `FORGE_TEST_DOCKER=1 node --test tests/sandbox-runtime.test.js tests/puesta-al-dia-revision.test.js` → 198 pruebas, 197 pasan, 0 fallan, 1 saltada (los enlaces simbólicos a archivos en Windows, EPERM; los cubre el escenario de Docker en Linux, que sí se ejecutó). No se ejecutó la suite entera con `FORGE_TEST_DOCKER=1`.

Fuera de lo pedido que se tocó: `core/ciclo/diario.js` (el total del libro nunca resta) y `cli/index.js` (todas las escrituras de `init`, también las que no eran las de `AGENTS.md`). **No se tocaron** `forge config set` ni `forge aprobar`, que escriben en `.sdd/` fuera de `init` con `writeFileSync`: no se revisaron frente a enlaces.

## Qué se tocó fuera de lo que pedían los criterios

- `core/orchestrator.js` y `core/session-budget.js`: el acumulador del modo clásico suma los tokens de caché. Sin esto, con la caché activa habría registrado menos de lo cobrado.
- `core/ciclo/index.js`: `crearLlamador` acepta un proveedor ya creado, para poder probar la propagación sin llamar a un modelo.
- `cli/runner.js`: `forge status` muestra el mecanismo de aislamiento.
- No se tocaron `core/ciclo/router.js`, `grafo.js` ni `estado.js`. En `core/ciclo/nodos.js` solo cambia una línea de `invocar`. En los proveedores, solo `complete` del de Anthropic y dos funciones auxiliares.
