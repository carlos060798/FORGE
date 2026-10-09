# Ciclo verificado

> Desde la versión 5.0.0 es el modo por defecto de `forge run`. En 4.3.0 (no publicada) era opt-in.
> Especificación: `.sdd/especificaciones/2026-10-03-ciclo-verificado/`. Decisiones: `.sdd/arquitectura/ADR-01` a `ADR-18`. Rojo obligatorio y medición de las pruebas: spec `2026-10-09-pruebas-confiables` y `ADR-20`.

Con el ciclo verificado, `forge run` no ejecuta cada tarea de código una sola vez: la corrige hasta que sus pruebas pasan, ejecutando el código generado en un contenedor Docker sin red, sin superar un tope de gasto y pidiéndote una decisión cuando no puede terminar solo.

## Requisitos

- **Docker** instalado y en marcha. Sin Docker, el ciclo no arranca (código de salida 4): nunca ejecuta código generado en tu equipo.
- **Node ≥20** (desde 5.0.0). El grafo lo ejecuta un motor propio, sin dependencias (LangGraph.js se retiró en 5.0.0, ADR-18).
- Un proveedor de modelos que informe del consumo de cada llamada (Anthropic u OpenAI con clave, u Ollama).
- El proyecto debe estar en la etapa de tareas generadas o de construcción. Desde "tareas generadas" se avanza solo; en cualquier otra etapa hace falta `--force`.
- Proyectos en **JavaScript/TypeScript, Python o Go**. Con otro lenguaje, `forge run --motor ciclo` se niega a empezar y lo explica, antes de gastar nada. En Python, las dependencias deben estar en `requirements.txt`: un proyecto que las declara solo en `pyproject.toml` se rechaza con ese mensaje. En Go hace falta `go.mod` en la raíz (y `go.sum` si hay dependencias); el comando de pruebas es `go test ./...`. **La primera ejecución de un proyecto Go prepara una imagen (alrededor de 90 segundos, con red)**: descarga los módulos y compila de antemano la biblioteca estándar; las siguientes la reutilizan.

## Cómo activarlo

Es el modo por defecto desde 5.0.0. Para usar el modo de 4.x, que ejecuta las pruebas en tu equipo sin aislamiento, por ejecución:

```bash
forge run --motor clasico
```

O de forma permanente en `.sdd/sdd.config.yaml`:

```yaml
motor:
  modo: ciclo              # ciclo (por defecto) | clasico
  grafo: auto              # auto | propio (langgraph se acepta, con un aviso: se retiró en 5.0.0)
  recuperador: archivos    # fuente de contexto de los agentes
  nivel_maximo: opus       # nivel de modelo más alto que puede usar un agente: opus (sin límite) | sonnet | haiku
  max_iteraciones: 5
  sin_progreso: 3          # fallos seguidos con la misma salida antes de preguntarte; 0 lo desactiva
  mutacion: informar       # medir cuánto detectan las pruebas tras un pase: no | informar | exigir
  mutacion_minima: 0.6     # con exigir: proporción mínima de cambios detectados (de 0 a 1)
  mutacion_max: 10         # cambios probados por tarea, como mucho
  mutacion_timeout_s: 300  # tiempo máximo de la medición por tarea
  contexto_max_bytes: 65536
  implementador: bloque    # bloque (por defecto) | turnos (opcional: ver «Implementador por turnos»)
  turnos_max: 30           # con turnos: respuestas del modelo por intento
  turnos_pruebas_max: 5    # con turnos: ejecuciones de pruebas que puede pedir el implementador por intento

sandbox:
  cpus: 1
  memoria: 512m
  pids: 256
  timeout_s: 120
  # runtime: runsc         # mecanismo de aislamiento de Docker; sin indicar, el de Docker por defecto

presupuesto:
  tope_usd: 2.00
  umbral_degradacion_usd: 1.50
  degradar_a: escalon
```

### Modelos y precios (ADR-19)

El gasto se calcula multiplicando tokens por un precio. FORGE trae una lista de modelos y precios (`core/precios.js`) con la **fecha de su última revisión** contra la página oficial del proveedor; `forge status` y `forge doctor` muestran esa fecha. Si un precio o un modelo cambia, no hace falta esperar una versión: indícalo en `.sdd/sdd.config.yaml` y **lo que indiques manda sobre la lista incluida**.

```yaml
modelos:                         # identificador de modelo de cada nivel
  opus: claude-opus-5-5
  sonnet: claude-sonnet-5-5
  haiku: claude-haiku-5-5

precios:                         # USD por millón de tokens
  claude-sonnet-5-5_entrada: 2
  claude-sonnet-5-5_salida: 10
  "qwen2.5-coder:7b_entrada": 0  # un identificador con dos puntos va entre comillas
  "qwen2.5-coder:7b_salida": 0
```

- **`modelos:`** solo admite las claves `opus`, `sonnet` y `haiku`. Un nivel sin indicar conserva el que trae el proveedor. Se aplica al proveedor que esté en uso (también al local de `degradar_a: local`), así que indica identificadores que ese proveedor conozca. El proveedor de pruebas (`stub`) no lo usa.
- **`precios:`** usa claves planas porque el lector de configuración es mínimo y no entiende anidamiento: `<identificador>_entrada` y `<identificador>_salida`, siempre las dos. El identificador es el que el proveedor recibe, tal cual.
- **Un precio no numérico, negativo, vacío o sin su pareja, o un nivel desconocido en `modelos:`, impide empezar** (`forge run` y `forge resume`, en los dos modos), con un mensaje que nombra la clave.
- **Un modelo sin precio** (ni en tu configuración ni en la lista incluida) **se cobra al precio más alto conocido** y deja en el registro un evento `ciclo:precio_desconocido` con su nombre. El tope se alcanzará antes de lo real: añade su precio.
- Los proveedores locales (`ollama`) y el de pruebas siguen costando 0 aunque les pongas precio.
- El gasto cuenta cuatro tipos de token, cada uno a su precio: entrada, salida y, con la caché de prompts, lo guardado y lo reutilizado (ver abajo). No contempla el tramo caro de Claude Haiku 5.5 (peticiones de más de 100 000 tokens de entrada, 5 veces más caras).
- Un precio más bajo que el real hace que el ciclo gaste más de lo que cree: el tope es tan bueno como los precios.

`motor.sin_progreso` debe ser un entero mayor o igual que 0; con otro valor el ciclo no arranca. Lo mismo con `motor.mutacion` (solo `no`, `informar` o `exigir`), `motor.mutacion_minima` (un número entre 0 y 1) y `motor.mutacion_max` y `motor.mutacion_timeout_s` (enteros mayores o iguales que 1): un valor mal escrito impide empezar, con un mensaje que nombra la clave. `FORGE_BUDGET_USD` sustituye a `presupuesto.tope_usd`. Solo puede haber **un ciclo a la vez por proyecto**: un segundo `forge run --motor ciclo` se rechaza mientras el primero siga en marcha.

### Caché de prompts

En cada iteración de una tarea, el ciclo envía al modelo las mismas instrucciones: las del agente y el contrato de salida. Con el proveedor de Anthropic, esa **parte fija** se marca como reutilizable (`cache_control: { type: "ephemeral" }` sobre el prompt de sistema, caché de 5 minutos). La primera llamada la guarda y las siguientes, si llegan antes de 5 minutos, la reutilizan a precio reducido. Fuente: <https://platform.claude.com/docs/en/build-with-claude/prompt-caching>.

```yaml
llm:
  provider: anthropic
  cache: true              # por defecto; con false no se envía la marca y la petición es la de antes
```

- **Cómo se cobra.** El proveedor informa de tres cantidades de entrada que no se solapan: a precio normal, guardada (1,25 veces el precio de entrada) y reutilizada (0,1 veces o menos, según el modelo). El ciclo cobra cada una al precio de `core/precios.js` y las anota por separado en `.sdd/motor/<sesión>/gasto.jsonl` (`inputTokens`, `cacheCreationTokens`, `cacheReadTokens`). `forge status` muestra los totales cuando los hay. El tope de gasto se calcula con esos precios.
- **Un modelo sin precios de caché** (ni en la lista ni en tu configuración) cobra lo reutilizado al precio de entrada normal y lo guardado a 1,25 veces: nunca por debajo de lo que cobra el proveedor. Puedes fijarlos en `precios:` con `<identificador>_cache_escritura` y `<identificador>_cache_lectura` (opcionales, en USD por millón).
- **Guardar cuesta más que no guardar.** Una tarea que se resuelve en una sola llamada paga ese 25 % de más por la parte fija y no reutiliza nada. Compensa a partir de la segunda llamada con las mismas instrucciones dentro de los 5 minutos.
- **Tamaño mínimo.** El proveedor no guarda un prefijo demasiado corto, y no da error: los dos contadores llegan a cero y se cobra como siempre. El mínimo depende del modelo: 512 tokens en los modelos más recientes (Opus 5.5, Sonnet 5.5, Haiku 5.5…), 1024 en Opus 4.8 y Sonnet 4.6, 4096 en Haiku 4.5. Los niveles por defecto de FORGE apuntan hoy a Opus 4.8, Sonnet 4.6 y Haiku 4.5: con Haiku 4.5, unas instrucciones de menos de 4096 tokens no se guardan.
- **Los demás proveedores no cambian**: ni la petición ni el gasto.
- **El ahorro real no está medido.** Las pruebas usan un cliente falso: comprueban la marca, los precios y el libro de gasto, no lo que el proveedor guarda de verdad. Para medirlo con un modelo de pago, ejecuta una tarea que necesite varias iteraciones y mira en `gasto.jsonl` las líneas del implementador: la primera debe traer `cacheCreationTokens` mayor que cero y `cacheReadTokens` a cero; las siguientes, `cacheReadTokens` mayor que cero. Si todas traen ceros, el prefijo no llega al mínimo del modelo o pasaron más de 5 minutos. El gasto de entrada de una llamada es `inputTokens × entrada + cacheCreationTokens × escritura + cacheReadTokens × lectura`; compáralo con `(inputTokens + cacheCreationTokens + cacheReadTokens) × entrada`, que es lo que habría costado sin caché, y repite la misma tarea con `cache: false` para contrastarlo con lo facturado.

## Qué hace con cada tarea

```
planner → retriever → qa → coder → sandbox ─┬─ las pruebas pasan ──▶ mutacion ─┬─▶ tarea completada
                              ▲             ├─ fallan y quedan topes ▶ coder    ├─ exigir y bajo el mínimo ▶ refuerzo ▶ sandbox
                              └─────────────┘                                   └─ sigue bajo el mínimo ▶ te pregunta
                                            └─ tope, gasto o fallo del entorno ▶ te pregunta
```

1. **planner** (agente `arquitecto`): descompone la tarea en pasos.
2. **retriever**: reúne los archivos que declara la tarea y las líneas de la spec que citan sus criterios, sin superar `contexto_max_bytes` (cabeceras incluidas).
3. **qa** (agente `tester`): escribe las pruebas antes de que exista la implementación.
4. **coder** (el agente de la tarea): implementa. No puede modificar ni crear pruebas. Por defecto responde con los archivos completos; opcionalmente trabaja por turnos, con herramientas (ver «Implementador por turnos»).
3. **qa** (agente `tester`): escribe las pruebas antes de que exista la implementación y las ejecuta: **tienen que fallar** (ver «Pruebas confiables»).
4. **coder** (el agente de la tarea): implementa. No puede modificar ni crear pruebas.
5. **sandbox**: ejecuta las pruebas en un contenedor.
6. El **router** decide por el código de salida. El éxito se comprueba antes que los topes: pasar en la quinta ejecución es un éxito.
7. **mutacion** (sin modelo): tras un pase, mide cuánto detectan las pruebas. Con `motor.mutacion: no` este paso no existe.
8. **refuerzo** (agente `tester`, solo con `exigir`): añade comprobaciones a partir de lo que las pruebas no detectaron.

Las tareas de código se ejecutan de una en una. Las que no son de código (arquitecto, revisor, documentador…) siguen el camino clásico.

## Pruebas confiables

Que las pruebas pasen solo vale algo si esas pruebas comprueban algo. El ciclo hace dos comprobaciones, las dos con reglas fijas y sin preguntar a ningún modelo (ADR-20).

### Las pruebas tienen que fallar antes de implementar

Justo después de escribirlas, las pruebas se ejecutan en el contenedor, cuando la implementación todavía no existe:

- **Fallan** (o agotan el tiempo): es lo esperado, y el ciclo sigue.
- **Pasan**: el agente de pruebas recibe ese resultado y sus pruebas, y las reescribe **una vez**. Esa llamada cuenta para el tope de gasto como cualquier otra.
- **Vuelven a pasar**: la tarea se pausa con el motivo `pruebas_no_fallan` y **no se llama al implementador**. `continuar` hace que el agente de pruebas las reescriba sabiendo qué pasó.
- **Falla el entorno** (Docker no responde, por ejemplo): no cuenta ni como «fallan» ni como «pasan». La tarea se pausa con el motivo `infraestructura` y `continuar` repite solo la comprobación, sin volver a pagar las pruebas.

Una tarea que parte de un comportamiento que ya existe (un refactor, unas pruebas para código heredado) puede declararlo y queda **exenta**: sus pruebas pueden pasar antes de implementar. Se declara en la definición de la tarea, con `"parte_de_codigo_existente": true` (en `.sdd/estado-tareas.json`, en el `.estado-tareas.json` de la spec o en el archivo de `--tasks`). La exención se anota en el registro (evento `ciclo:rojo` con `resultado: exenta`). Lo declara quien escribe la tarea: el ciclo no lo deduce de que los archivos ya existan.

### Cuánto detectan las pruebas

Tras un pase, el ciclo hace cambios pequeños y deliberados en los archivos que el implementador escribió en esa tarea, **de uno en uno**, y ejecuta las pruebas contra cada uno. Si las pruebas fallan (o agotan el tiempo), el cambio está **detectado**; si siguen pasando, no. Hay cuatro tipos de cambio:

| Cambio | Ejemplo |
|---|---|
| Invertir una comparación | `a < b` → `a >= b`, `a === b` → `a !== b` |
| Cambiar una constante | `0` → `1`, `41` → `42`, `true` → `false` |
| Negar la condición de un `if` o un `while` | `if (a)` → `if (!(a))` |
| Sustituir el valor devuelto | `return a + b` → `return null` |

- **Nunca se toca tu proyecto.** Cada cambio se aplica sobre una copia temporal (con los mismos vetos que la copia de trabajo del contenedor: sin secretos, sin `.git`, sin `node_modules`) y las pruebas se ejecutan en el mismo contenedor aislado de siempre. La copia se borra al terminar, también si algo falla.
- **Es determinista.** Los cambios posibles se ordenan por archivo y posición; si hay más que el tope, se toma uno de cada tantos, repartidos por todo el código. El mismo código da siempre los mismos cambios.
- **No llama a ningún modelo y no gasta presupuesto.** Cuesta tiempo: una ejecución de las pruebas por cambio.
- **Está acotada**: como mucho `mutacion_max` cambios (10) y `mutacion_timeout_s` segundos (300). Si no se prueban todos los cambios posibles, la puntuación se marca como **parcial**.
- **Si no hay nada que cambiar** (el implementador no escribió código en un lenguaje cubierto, o su código no tiene comparaciones, constantes, condiciones ni valores devueltos), la medición **se omite** y queda anotado (evento `ciclo:mutacion_omitida`). No se inventa una puntuación.

El resultado es una **puntuación** (cambios detectados entre cambios probados) y la lista de los no detectados, con archivo, línea y el texto antes y después. Queda en `.sdd/events.jsonl` (un evento `ciclo:mutante` por cambio probado y un `ciclo:mutacion` con el resumen) y `forge status` la muestra junto a cada tarea: `T1: iteración 1/5 · exito · mutación: 7/10 detectadas (70 %)`.

Tres modos, en `motor.mutacion`:

| Modo | Qué hace |
|---|---|
| `no` | No mide. El ciclo se comporta como antes de esta función (el rojo obligatorio sigue activo) |
| `informar` (por defecto) | Mide y deja la puntuación en el registro y en `forge status`. **Nunca cambia el resultado**: la tarea termina en éxito con la puntuación que sea |
| `exigir` | Si la puntuación queda por debajo de `mutacion_minima`, el agente de pruebas recibe la lista de cambios no detectados y **refuerza las pruebas una vez**. Las pruebas reforzadas se ejecutan contra la implementación: si fallan, el ciclo vuelve al implementador, como en cualquier fallo; si pasan, se mide otra vez. Si sigue por debajo, la tarea se pausa con el motivo `pruebas_debiles` y la lista, para que decidas |

La decisión entre éxito, refuerzo y pausa depende solo de la puntuación, del mínimo y de cuántos refuerzos se han hecho. El implementador sigue sin poder tocar las pruebas, tampoco las reforzadas: sus huellas se vuelven a tomar tras el refuerzo y, si cambian en disco, no se ejecutan.

**Cuánto tarda.** Medido el 2026-10-09 en Windows con Docker Desktop, en un proyecto JavaScript sin dependencias: 9 cambios tardaron entre 40 y 67 segundos en seis mediciones (entre 4,5 y 7,5 segundos cada uno, lo mismo que una ejecución normal de las pruebas). Son mediciones en un solo equipo y en un proyecto mínimo: en un proyecto real cada cambio cuesta lo que tarde su suite, hasta el tope de tiempo.

## Aislamiento

Cada ejecución lanza un contenedor con:

- sin red (`--network none`) y sin descargar imágenes (`--pull never`);
- usuario sin privilegios, sin capacidades y sin posibilidad de ganarlas;
- 1 CPU, 512 MB de memoria y 256 procesos como máximo; como mucho 1024 archivos abiertos y archivos de 100 MB;
- sistema de archivos de solo lectura, salvo `/tmp` y la copia del proyecto;
- 120 s de tiempo máximo.

El contenedor no ve tu proyecto, sino una **copia desechable**. La copia no lleva `.git` ni ningún repositorio anidado, `.sdd`, `.claude`, `node_modules`, ni nada que parezca un secreto (`.env*`, `.npmrc`, `.netrc`, claves SSH, certificados, `*.tfstate`, `*credentials*`, `*secret*`…), a cualquier profundidad. Lo que el código escribe en ella se descarta. Cada ejecución usa su propia carpeta, con un nombre único por proceso; si el código de pruebas deja algo que Windows no puede borrar (enlaces, por ejemplo), no impide las siguientes, pero la copia queda en `.sdd/motor/<sesión>/staging/`. Al arrancar el ciclo se intenta borrar las copias anteriores y se avisa de las que no se pudieron borrar para que las borres a mano.

Las dependencias declaradas en `package.json`, `requirements.txt` o `go.mod`/`go.sum` se instalan una vez, con red, en una imagen `forge-sbx:<huella>` construida solo a partir de esos manifiestos. En JavaScript, sin ejecutar scripts de instalación; en Python, `pip` sí puede ejecutar el `setup.py` de paquetes sin rueda. El código generado corre después sobre esa imagen, sin red.

### Elegir el mecanismo de aislamiento

Docker puede lanzar los contenedores con distintos mecanismos (lo que Docker llama *runtime*). Si tu equipo tiene uno más estricto que el de por defecto, indícalo:

```yaml
sandbox:
  runtime: runsc           # el nombre con el que está registrado en Docker
```

- Sin indicarlo, se usa el de Docker por defecto, como siempre.
- **Solo se elige uno ya instalado**: FORGE no instala ni configura ninguno. Los que conoce tu Docker salen en `docker info`.
- **Si el indicado no está disponible, el ciclo no empieza**: lo explica, nombra el mecanismo y termina con el código 4. Nunca usa el de por defecto en su lugar.
- **Todas las restricciones de arriba se mantienen** con cualquier mecanismo: solo se añade `--runtime <valor>` a la orden.
- El valor solo admite letras, cifras, `_`, `.` y `-`, y no puede empezar por `-`. Con otro valor, el ciclo no arranca.
- `forge status` muestra el mecanismo configurado y `forge doctor` comprueba además que Docker lo conoce.
- Se aplica a la ejecución de las pruebas (también a `ejecutar_pruebas` del servidor MCP), **no a la construcción de la imagen** con las dependencias, que usa el constructor de Docker.
- **Probado solo con `runc`**, que es el de por defecto, y con un nombre inexistente. Ningún mecanismo más estricto (gVisor, Kata…) se ha probado: no hay ninguno instalado en el equipo de desarrollo.

**Un contenedor reduce el riesgo; no lo elimina.** Comparte el núcleo del sistema con tu equipo, y un fallo de Docker o del propio núcleo podría romper el aislamiento. No hay cuota de disco para la copia de trabajo: el único límite es el tiempo máximo y los 100 MB por archivo.

## Qué puede escribir un agente

Los agentes devuelven un bloque JSON con archivos, y FORGE decide qué se escribe. Se rechaza, y queda en `.sdd/events.jsonl` como `ciclo:escritura_rechazada`:

- **Lo vetado, a cualquier profundidad**: `.git`, `.sdd`, `.claude`, `node_modules`, `.ssh`, `.aws`, `.docker`, `.kube`, `secrets`, y los nombres típicos de secretos (`.env*`, `.npmrc`, `id_rsa*`, `*.pem`, `*.tfstate*`, `*key.json`, `*credentials*`, `*secret*`…). Sin distinguir mayúsculas, y también cuando se llega por un enlace.
- **Lo que no es portable**: nombres que Windows resuelve a otro archivo (`.git.`, `a.js::$DATA`, `GIT~1`, `CON`…), rutas absolutas y rutas que salen del proyecto.
- **Enlaces simbólicos**, también rotos: no se escribe a través de ellos.
- **El agente de pruebas** solo escribe pruebas, y solo en `tests/`, `test/`, `spec/` o `__tests__/`, o con nombres como `*.test.js` o `test_*.py`.
- **El implementador** no puede tocar las pruebas (aunque cambie las mayúsculas del nombre). Si cambian en disco, no se ejecutan.

Dos clases de archivo **no se aplican y pausan la tarea** para que decidas tú, porque alguna herramienta los ejecuta o interpreta sin que nadie lo pida:

- **Dependencias**: `package.json`, `requirements*.txt`, `pyproject.toml`, los `*.lock`, `setup.py`…
- **Configuración**: cualquier ruta con un segmento que empiece por punto (`.github/`, `.husky/`, `.vscode/`, `.eslintrc.js`, `.gitignore`…), `conftest.py`, `pytest.ini`, `*.config.js` (jest, vitest, babel, eslint…), `jest.setup.*`, `vitest.workspace.*`, `karma.conf.*`, cualquier archivo dentro de una carpeta `__mocks__/`, `Makefile`, `Dockerfile`, `docker-compose.yml`, `CLAUDE.md`, `AGENTS.md`.

Esto es una lista, no una garantía: **una configuración que no esté en ella se escribirá**. Y el contenido de un archivo permitido no se inspecciona: un agente puede escribir código dañino en `src/`. Revisa el diff antes de hacer commit.

## Implementador por turnos (opcional)

> **Estado: opcional y sin probar con un modelo real.** Está probado con respuestas guionizadas (`tests/ciclo-turnos.test.js`, `tests/herramientas-coder.test.js`). No se sabe todavía cuánto cuesta ni qué tal lo usa un modelo de verdad. El modo por defecto sigue siendo `bloque`.

Por defecto el implementador recibe todo en un mensaje y responde con cada archivo completo (`motor.implementador: bloque`). Con `motor.implementador: turnos` trabaja por pasos: pide una acción, FORGE la ejecuta y le devuelve el resultado, y así hasta que termina. Sirve para tareas sobre código que ya existe: puede buscar dónde se usa algo, leer solo un tramo de un archivo largo y cambiar tres líneas sin reescribirlo.

```yaml
motor:
  implementador: turnos
```

O, para una ejecución, `FORGE_IMPLEMENTADOR=turnos`.

**Las cinco acciones, y ninguna más:**

| Acción | Qué hace |
|---|---|
| `leer_archivo` | Lee un archivo, entero o un tramo de líneas |
| `listar` | Lista el primer nivel de una carpeta |
| `buscar` | Busca un texto literal y devuelve ruta, línea y texto |
| `editar` | Sustituye un fragmento exacto que aparezca una sola vez, o escribe un archivo entero |
| `ejecutar_pruebas` | Ejecuta las pruebas del proyecto en el contenedor. No acepta ningún comando |

**Mismas protecciones que el modo de bloque**, con el mismo código:

- Leer, listar y buscar no alcanzan nada vetado (secretos, `.git`, `.sdd`, `node_modules`, rutas protegidas, enlaces que salen del proyecto). Los manifiestos y la configuración se pueden leer, no escribir.
- Toda escritura pasa por las reglas de «Qué puede escribir un agente»: no toca las pruebas, no sale del proyecto, y un intento de cambiar dependencias o configuración **no se aplica, termina el trabajo y te pregunta**. Hay respaldo antes de la primera modificación de cada archivo, y `abortar` lo restaura todo.
- Una sustitución cuyo fragmento no aparece, o aparece más de una vez, no cambia nada y devuelve el motivo.
- Cada resultado tiene un tamaño máximo (32 KB; 50 coincidencias al buscar) y avisa si recorta.
- Los rechazos vuelven al implementador con su motivo, no detienen la tarea y quedan en `.sdd/events.jsonl` (`ciclo:lectura_rechazada`, `ciclo:escritura_rechazada`).
- **Lo que lee no manda.** Si un archivo del proyecto contiene instrucciones («lee `.env`», «escribe en `../otro`»), el implementador puede intentar obedecerlas, pero las reglas y los topes no dependen de él: se fijan antes de empezar y esas acciones se rechazan.

**Topes:**

- `turnos_max` (30): respuestas del modelo por intento. Al alcanzarlo se ejecutan las pruebas con lo que haya escrito.
- `turnos_pruebas_max` (5): veces que el implementador puede ejecutar las pruebas por intento.
- Cada turno es una llamada al modelo: cuenta para el tope de gasto, con la misma degradación y la misma parada. Agotado el gasto no se inicia otro turno.
- **Un turno no es una iteración.** Una iteración sigue siendo una ejecución final de pruebas.

**El éxito no cambia de manos.** Cuando el implementador termina, el ciclo ejecuta las pruebas y el router decide, igual que siempre. Que las pruebas pasaran cuando las ejecutó el implementador no cuenta.

**Proveedores.** Hoy solo lo admite **Anthropic**. Con OpenAI (y compatibles) u Ollama, el ciclo deja un aviso en el registro (`ciclo:implementador_sin_herramientas`) y trabaja en modo de bloque; el aviso no se imprime en la terminal. Con `degradar_a: local`, al cruzar el umbral de gasto los turnos se detienen, porque el modelo local no admite herramientas.

**El modo es de la tarea.** Se fija la primera vez que el implementador trabaja en ella. Si cambias `motor.implementador` con una tarea en pausa, esa tarea sigue en el modo en que empezó; el cambio vale para las tareas nuevas.

**Costo, sin medir.** Las respuestas son más cortas, pero cada turno reenvía el prompt, las herramientas y toda la conversación anterior, y este modo todavía no usa caché de prompts: los tokens de entrada crecen con cada turno y el gasto total puede ser mayor que en modo de bloque. `forge status` muestra los turnos y el gasto de cada tarea que trabaja en este modo.

**Otras diferencias.** El implementador no recibe el contexto del recuperador: recibe la lista de archivos del proyecto y lee lo que necesita. No puede borrar ni renombrar archivos.

## Presupuesto

El tope es **por sesión** (un `forge run` y sus reanudaciones), no por tarea. El gasto se suma llamada a llamada en `.sdd/motor/<sesión>/gasto.jsonl`, así que cuenta también lo que gastó una tarea que se cortó, y una ampliación del tope vale para el resto de la sesión.

- Al llegar al umbral, las llamadas siguientes usan un modelo un escalón más barato (`opus → sonnet → haiku`), o un modelo local de Ollama si `degradar_a: local`.
- Al llegar al tope, no se inicia ninguna llamada más. El exceso máximo es el costo de una llamada.
- Si el implementador ya escribió código cuando se agota el presupuesto, las pruebas se ejecutan igualmente (no cuestan dinero): si pasan, la tarea termina bien.
- Una respuesta sin datos de consumo de un proveedor de pago se trata como error, no como gasto cero.

## Cuando te pregunta

El ciclo se pausa y `forge run` termina con código 3 en nueve casos:

| Motivo | Qué pasó |
|---|---|
| `iteraciones` | 5 ejecuciones sin que las pruebas pasen |
| `presupuesto` | Se alcanzó el tope de gasto |
| `infraestructura` | Falló Docker o el proveedor de modelos, o las pruebas cambiaron en disco; la causa va en el detalle. Si cambiaron las pruebas, `continuar` hace que el agente de pruebas las vuelva a escribir. Si Docker falló al comprobar que las pruebas fallan sin implementación, o al medirlas con `exigir`, `continuar` repite solo esa comprobación |
| `dependencias` | El implementador propone cambiar dependencias o configuración que alguna herramienta ejecuta sola |
| `salida_invalida` | Un agente no devolvió el formato pedido, tras un reintento |
| `exito_sospechoso` | Las pruebas pasan (código 0), pero la salida no muestra pruebas ejecutadas, informa de menos pruebas de las que escribió el agente de pruebas, o el código escrito corta el proceso. Si el resultado es correcto, `aceptar` |
| `sin_progreso` | Las últimas 3 ejecuciones (`motor.sin_progreso`) fallaron con la misma salida aunque la implementación cambió: puede que las pruebas estén rotas por sí mismas. `continuar` hace que el agente de pruebas las reescriba; `aceptar` da la tarea por buena; `abortar` restaura los archivos |
| `pruebas_no_fallan` | Las pruebas recién escritas pasan sin que exista la implementación, también tras pedir al agente de pruebas que las corrigiera. No se ha llamado al implementador. `continuar` hace que las reescriba; `aceptar` da la tarea por buena sin implementar; `abortar` las retira. Si la tarea parte de código que ya existe, declárala con `parte_de_codigo_existente` |
| `pruebas_debiles` | Solo con `motor.mutacion: exigir`: las pruebas pasan, pero detectan menos cambios deliberados que el mínimo, también tras reforzarlas una vez. El detalle lista los no detectados. `continuar` pide otro refuerzo; `aceptar` da la tarea por buena; `abortar` restaura los archivos |

`forge resume` sin más muestra el motivo y **no gasta nada**. Si además hay tareas fallidas, las relanza y te avisa de las pausadas. Para decidir:

```bash
forge resume --decision continuar --iteraciones-extra 3
forge resume --decision continuar --presupuesto-extra 1.50
forge resume --decision aceptar     # dar la tarea por buena tal como está
forge resume --decision abortar     # restaurar los archivos al estado previo a la tarea
forge resume --decision abortar --tarea T3   # solo para T3; sin --tarea vale para todas las pausadas
```

Una decisión que no pueda cumplirse (por ejemplo, ampliar el presupuesto cuando ya se agotaron las iteraciones) se rechaza sin dejar rastro y sin gastar. Una tarea abortada queda como omitida: `forge resume` no la vuelve a lanzar.

## Reanudación

El estado se guarda tras cada paso en `.sdd/motor/<sesión>/checkpoints/`. Si el proceso se corta, `forge resume` continúa en el paso pendiente. Además, cada respuesta de un modelo se anota en `.sdd/motor/<sesión>/diario/` en cuanto llega: si el corte cae dentro de un paso, después de pagar la respuesta, al reanudar se recupera del diario y **no se vuelve a pagar**, también si esa respuesta cruzó el umbral de degradación o agotó el tope. El diario solo cubre lo que está en vuelo y se vacía al guardar el punto del paso. **Excepción conocida:** si el proceso muere en los milisegundos entre escribir los archivos del implementador y guardar el punto del nodo, la petición cambia (su contexto incluye archivos que acaba de reescribir) y la llamada se paga de nuevo.

Con el implementador por turnos se anota cada turno por su posición: la respuesta del modelo, antes de ejecutar nada, y el resultado de cada acción, al terminarla. Al reanudar se reproduce la conversación desde el diario: los turnos ya respondidos no se pagan otra vez y sus acciones no se repiten (una sustitución ya aplicada no se reintenta). **Excepción conocida:** si el proceso muere entre que una acción escribe un archivo y que su resultado se anota, esa acción se repite; una sustitución ya aplicada devuelve entonces «el fragmento no aparece», sin cambiar nada. Las escrituras de este modo son atómicas: un corte no deja un archivo a medias.

Un punto de guardado dañado se detecta por su huella y se usa el anterior válido. Un punto de otra sesión o de otro proyecto no se obedece. Dos procesos no pueden trabajar a la vez en la misma tarea ni en el mismo proyecto (candados con enlace duro; la retirada de un candado huérfano exige una reclamación aparte). Probado con 2 y con 3 procesos. Un candado de más de 6 horas se considera abandonado aunque su proceso siga vivo, y en sistemas de archivos sin enlaces duros el candado falla en modo seguro (no arranca).

Si una tarea tiene puntos de guardado del ciclo, `forge resume` la reanuda con el ciclo aunque no lo pidas: relanzarla en modo clásico ejecutaría en tu equipo, sin aislamiento, código que escribió un modelo. Por la misma razón, `forge run --motor clasico` se niega a ejecutar sobre una sesión del ciclo sin terminar; `--force` lo permite bajo tu responsabilidad.

`forge status` muestra la sesión, el gasto y la situación de cada tarea.

## Probarlo con un modelo real

```bash
export ANTHROPIC_API_KEY=...
npx forge probar-modelo [--tope 0.50] [--conservar]
```

Crea un proyecto desechable con una tarea trivial (una función `suma` y sus pruebas), lanza el ciclo con un tope de gasto bajo y resume: resultado, iteraciones, gasto y llamadas, y si el modelo devolvió el formato de archivos que el ciclo espera (`salida_invalida` indica que no). Gasta dinero real: como máximo el tope (0,50 USD por defecto). Sale con 0 si la tarea terminó con éxito, 1 si no, 2 si no se pudo ejecutar (sin clave, tope no válido). Es la prueba que falta en la verificación del ciclo.

Para probar el implementador por turnos, la misma orden con `FORGE_IMPLEMENTADOR=turnos`. **Todavía no se ha ejecutado con un modelo de pago.**

## Códigos de salida

| Código | Significado |
|---|---|
| 0 | Todas las tareas completadas, o la tarea se abortó por decisión humana (no es un fallo) |
| 1 | Fallo, o no se puede empezar (etapa, lenguaje, ciclo ya en marcha, decisión no válida) |
| 3 | Hay tareas que esperan tu decisión |
| 4 | Docker no está disponible, o no tiene el mecanismo de aislamiento pedido en `sandbox.runtime` |

## Límites conocidos

- **Probado con un modelo real en 17 ejecuciones de tareas pequeñas** (2026-10-09, JavaScript, Python y Go; proyectos vacíos y uno con código existente; corte y reanudación; pausa por presupuesto y por falta de progreso). Las respuestas se interpretaron siempre al primer intento y el bucle de corrección convergió cuando las pruebas eran correctas. Esas ejecuciones y una revisión independiente destaparon defectos ya corregidos, y dejan cosas sin probar: proyectos grandes, Linux, y la comparación del gasto calculado con el facturado. Detalle en `.sdd/especificaciones/2026-10-09-validacion-modelo-real/evidencia-2026-10-09.md`.
- **El implementador por turnos solo se ha probado con un modelo real en una tarea** (2026-10-09): cambiar una función en un archivo de 1812 líneas. El modo de bloque no pudo (la respuesta se cortó en el máximo de salida) y el modo por turnos lo hizo en 8 turnos, con un 83 % menos de tokens de salida. El gasto total no bajó: cada turno reenvía la conversación entera y este modo no usa caché de prompts. Solo funciona con el proveedor de Anthropic; con los demás el ciclo avisa en el registro y usa el modo de bloque. No tiene revisión independiente.
- **Unas pruebas rotas por sí mismas se detectan solo si la salida se repite.** Si el agente de pruebas escribe un archivo que no carga (por ejemplo, con un sistema de módulos equivocado), el implementador no puede arreglarlo, porque no puede tocar las pruebas. El ciclo compara la salida de cada ejecución fallida con las anteriores (sin duraciones, marcas de tiempo ni direcciones de memoria) y, si es idéntica 3 veces seguidas (`motor.sin_progreso`), se pausa con el motivo `sin_progreso` en lugar de seguir hasta el tope. Es una comparación de igualdad, no un diagnóstico: no sabe si la culpa es de las pruebas o de un implementador que repite el mismo error, así que decides tú. No se detecta si la salida cambia en cada ejecución (valores aleatorios, rutas temporales, orden no determinista), si las ejecuciones no imprimen nada, ni los fallos por tiempo agotado; en esos casos el ciclo sigue hasta el tope de iteraciones. Las dos primeras ejecuciones repetidas se pagan igual. Tras `continuar`, si las pruebas reescritas vuelven a dar la misma salida, la tarea se pausa de nuevo en la primera ejecución. Comprobado con pruebas automáticas, no con un modelo real.
- **Python: pytest tiene que estar en `requirements.txt`.** El entorno aislado solo instala lo que declara ese archivo. Si el proyecto se prueba con pytest (por `pytest.ini`, `conftest.py`, `setup.cfg`, `tox.ini`, `pyproject.toml` u otro archivo de requisitos) y `requirements.txt` no tiene una línea `pytest`, el ciclo no empieza y te dice qué añadir. Sin ninguna señal de pytest se usa `unittest discover`, que no encuentra pruebas en `tests/` sin `__init__.py`: si pasa, el ciclo lo detecta al escribir las pruebas (código de salida 5), no llama al implementador y te lo explica.
- **Con el nivel de modelo económico, el agente de pruebas escribe a veces pruebas con valores esperados erróneos.** El ciclo no puede distinguirlas de una implementación que falla; la detección de «sin progreso» acota el gasto, pero la tarea acaba en revisión. Si limitas el nivel con `motor.nivel_maximo`, tenlo en cuenta.
- **El ciclo no mide la calidad de las pruebas, y un implementador decidido puede falsear el resultado.** Aprueba por código de salida, pero **un código 0 solo se da por bueno si la salida muestra al menos una prueba pasada y el código escrito no corta el proceso al cargarse** (`process.exit`, `sys.exit`… al comienzo de línea). Además se compara cuántas pruebas escribió el agente de pruebas con cuántas informa el ejecutor (node:test, jest, unittest, pytest, mocha): si informa menos, se pausa aunque el corte esté escondido. Si no, la tarea se pausa con el motivo `exito_sospechoso` y tú decides (`aceptar` si es correcto). Es una mitigación: un implementador que falsee el resumen, o un ejecutor sin cuenta legible (`go test` sin `-v`), no se detecta, y unas pruebas triviales que sí imprimen un resumen tampoco. Se cierran los nombres de prueba y la configuración del ejecutor, pero no esta vía. Si las pruebas recién escritas ya pasan sin implementación, queda un aviso en el registro, pero no se bloquea. **Revisa el diff y ejecuta las pruebas tú antes de dar una tarea por buena.**
- **Lista de archivos de configuración incompleta.** Se exige revisión humana para los que conocemos (`conftest.py`, `jest.config.*`, `.husky/`, `.github/`…), no para otros que alguna herramienta también interpreta (`jest.setup.js`, `__mocks__/`, `vitest.workspace.ts`, `karma.conf.js`, `tsconfig.json`, `scripts/*.sh`, `Procfile`…). Si no está en la lista, se escribirá.
- **Python sin pytest declarado usa `unittest discover`**, que no encuentra pruebas en `tests/` sin `__init__.py`. El ciclo lo detecta por el código de salida 5, no gasta iteraciones y te lo explica; declara `pytest` en `requirements.txt` o añade un `pytest.ini` para evitarlo.
- **La medición de las pruebas es una muestra, no una garantía, y un implementador decidido puede falsear el resultado.** El ciclo aprueba por código de salida, pero **un código 0 solo se da por bueno si la salida muestra al menos una prueba pasada y el código escrito no corta el proceso al cargarse** (`process.exit`, `sys.exit`… al comienzo de línea). Además se compara cuántas pruebas escribió el agente de pruebas con cuántas informa el ejecutor (node:test, jest, unittest, pytest, mocha): si informa menos, se pausa aunque el corte esté escondido. Si no, la tarea se pausa con el motivo `exito_sospechoso` y tú decides (`aceptar` si es correcto). Es una mitigación: un implementador que falsee el resumen, o un ejecutor sin cuenta legible (`go test` sin `-v`), no se detecta, y unas pruebas triviales que sí imprimen un resumen tampoco. Se cierran los nombres de prueba y la configuración del ejecutor, pero no esta vía. Unas pruebas que pasan sin implementación ya no se dan por buenas (motivo `pruebas_no_fallan`) y, desde ADR-20, se mide cuánto detectan; pero por defecto esa medición solo informa. **Revisa el diff, mira la puntuación y ejecuta las pruebas tú antes de dar una tarea por buena.**
- **Límites de la medición por mutación.**
  - *Cambios equivalentes.* Algunos cambios no alteran el comportamiento (cambiar una constante que no se usa, por ejemplo) y ninguna prueba puede detectarlos: aparecen como «no detectados» y bajan la puntuación. Por eso el modo por defecto solo informa, y `exigir` acaba en una persona, no en un fallo.
  - *Es una muestra.* Cuatro tipos de cambio y, por defecto, diez por tarea. Una puntuación del 100 % dice que las pruebas notaron esos diez cambios, no que el código sea correcto. Una puntuación parcial se usa tal cual para decidir en `exigir`.
  - *Python, Go y TypeScript con tipos se alteran por patrones de texto*, no con un análisis sintáctico. Es conservador (solo líneas completas, solo comparaciones con espacios a los lados, solo enteros sueltos; nada dentro de cadenas ni comentarios), así que deja sin alterar parte del código, y puede producir código que no compila: eso cuenta como «detectado» e **infla la puntuación en esos lenguajes**. En Go solo se sustituye un valor devuelto si es `true` o `false`. JavaScript (y TypeScript que no usa sintaxis de tipos) se analiza con `acorn`. Un archivo JavaScript que `acorn` no entiende (JSX, por ejemplo) no se altera.
  - *Solo se alteran los archivos que escribió el implementador en la tarea.* Si no escribió código alterable, la medición se omite.
  - *Tiempo.* El tope de tiempo se comprueba antes de empezar cada cambio: la medición puede pasarse del tope en lo que tarde una ejecución (120 s como mucho, por `sandbox.timeout_s`).
  - *Reanudación.* El resultado de cada cambio probado se guarda en `.sdd/motor/<sesión>/mutacion/`: si el proceso se corta a mitad de la medición, al reanudar no se repiten los ya probados. El cambio que estaba en curso sí se repite (no cuesta dinero). Si entre tanto cambian el código o las pruebas, la medición empieza de cero.
  - *Un fallo del entorno durante la medición* la detiene y la marca como parcial. Con `informar` la tarea termina en éxito igual; con `exigir`, si no se llegó a probar ningún cambio, te pregunta.
  - *No probado con un modelo real.* El rojo obligatorio, el refuerzo y los tres modos se han probado con respuestas guionizadas, y la medición con Docker real solo en un proyecto JavaScript mínimo. No se ha medido cuánto tarda en un proyecto real ni cómo de bien refuerza las pruebas un modelo a partir de la lista.
- **El rojo obligatorio solo mira el código de salida.** Unas pruebas que fallan por un motivo equivocado (un error de sintaxis en la propia prueba, un nombre de archivo mal escrito) cuentan como «fallan». Que fallen no demuestra que sean buenas; eso lo estima la medición posterior.
- **El agente de pruebas tampoco puede escribir en `__mocks__/`.** La regla que impide al implementador sustituir módulos desde esa carpeta se aplica a todos los agentes: si unas pruebas necesitan un módulo simulado ahí, la tarea se pausará para que lo decidas.
- **Lista de archivos de configuración incompleta.** Se exige revisión humana para los que conocemos (`conftest.py`, `jest.config.*`, `.husky/`, `.github/`…), también `jest.setup.*`, `__mocks__/`, `vitest.workspace.*` y `karma.conf.*` desde ADR-20), no para otros que alguna herramienta también interpreta (`tsconfig.json`, `scripts/*.sh`, `Procfile`, un archivo de preparación de jest con otro nombre declarado en `package.json`…). Si no está en la lista, se escribirá.
- **Las credenciales se vetan por nombre.** Se rechazan los nombres habituales (`.pgpass`, `.vault-token`, `.dockercfg`, `kubeconfig`, `auth.json`, `*token*.json`, `*apikey*.txt`, `*.env`, `wp-config*.php`, `*.sqlite`, `database.yml`, `.gnupg/`, `.m2/`…), pero un secreto con un nombre inesperado se leería y se copiaría. Los nombres con `secret`, `credentials`, `token` o `password` solo se vetan con extensión de datos (`.json`, `.yml`, `.txt`, `.env`, `.pem`…): `tokenizer.js`, `password.js`, `secrets-manager.ts` o `credentials.service.ts` (código) no se vetan. Siguen vetados por prudencia los datos que parecen credenciales aunque sean otra cosa (`tokens.json`, `key.json`, `database.yml`): si el agente necesita uno, renómbralo o quítalo de la tarea.
- **`protecciones.no_tocar_archivos` de `sdd.config.yaml` se aplica** (se leen los elementos `- "patrón"` de esa sección): esas rutas ni se escriben ni se leen. Es un lector de YAML mínimo: reconoce la lista con guiones y la lista en línea (`[a, b]`); cualquier otro formato hace que el ciclo se niegue a empezar.
- **Una sola vía de ejecución en tu equipo**: con el ciclo activado, nada generado se ejecuta fuera del contenedor. Pero lo que el ciclo deja escrito en tu proyecto sí lo ejecutarán después tus herramientas (tu editor, tu ejecutor de pruebas, `git`).
- **Linux solo probado sin Docker dentro de Docker.** La suite pasa en un contenedor Alpine, pero el aislamiento real solo se ha probado en Windows con Docker Desktop; lo cubrirá el job `aislamiento` de CI cuando se ejecute por primera vez.
- **Sin cuota de disco** para la copia de trabajo (ver Aislamiento).
- **La redacción de secretos** de la salida de las pruebas cubre formatos comunes, no todos. La frontera real es lo que entra en la copia.
- **`degradar_a: local`** cambia a Ollama al cruzar el umbral, pero no se ha probado contra un Ollama en marcha.
- **Rutas rechazadas de más.** Para cerrar trucos de Windows y secretos, se rechaza cualquier archivo cuyo nombre contenga `secret`, `credentials` o termine en `key.json`, y las rutas con punto o espacio final, `~1` o `:`. Un agente no podrá escribir `src/secret-santa.js`.
- **El comando de pruebas se ejecuta sin shell.** Las comillas se respetan (`--grep "a b"` es un argumento), pero no hay variables, sustituciones ni operadores: un `&&`, `|` o `;` es un error claro de infraestructura. El ciclo usa el comando que detecta FORGE (`npm test`, `pytest`, `go test ./...`…); para algo más complejo, ponlo en un script de `package.json` o un Makefile.
- **Go:** solo `go test` con módulos descargados al preparar la imagen y `GOPROXY=off` al ejecutar. Sin cgo (`CGO_ENABLED=0`). Un proyecto Go grande puede quedarse sin sitio en `/tmp` (128 MB, en memoria). Probado con Docker real en Windows con y sin dependencias, aislamiento incluido; **no en Linux**.
- **Java, Rust, C#, Ruby y PHP no están cubiertos**: el ciclo se niega a empezar y lo explica.
- **Proyectos sin `pytest` o sin ejecutor de pruebas** entre sus dependencias: las pruebas fallarán en todas las iteraciones hasta el tope.
- **Monorepos**: solo se leen los manifiestos de la raíz.
- Rutas de proyecto con espacios o en una unidad distinta de `C:` no se han probado con el montaje de Docker.

## Cambios en el modo clásico

Activar el ciclo no cambia nada, pero las correcciones previas (spec `2026-10-03-saneamiento`) sí cambiaron el modo clásico respecto a 4.2.0:

- `forge run` y `forge resume` leen también las tareas de la spec activa (`.sdd/especificaciones/<id>/.estado-tareas.json`); antes solo `.sdd/estado-tareas.json`.
- Un flag sin valor ya no se come al siguiente (`--force --motor ciclo`).
- `forge run` y `forge resume` en modo clásico se niegan a ejecutar mientras alguna sesión del proyecto tenga tareas del ciclo sin terminar (el código de un modelo estaría en tu proyecto y el modo clásico lo ejecutaría en tu equipo), salvo `--force`.
- `forge resume --decision` sin ninguna tarea esperando una decisión, o `--tarea` sin identificador, se rechazan.
- Un error al ejecutar sale con mensaje y código 1, no con una traza.
- Un `motor.modo`, `motor.grafo` o `motor.embeddings` no válido en `sdd.config.yaml` hace fallar también el modo clásico. Un `motor.recuperador` no válido solo falla al empezar un ciclo.
- Los agentes leen el `sdd.config.yaml` del proyecto indicado con `--cwd`, no el del directorio actual; el circuit breaker escribe en ese proyecto.
- La etapa del proyecto se entiende también si la escribieron los comandos `/sdd.*` (`fase_actual`).
- `forge run --motor clasico` se niega a ejecutar sobre una sesión del ciclo sin terminar.
