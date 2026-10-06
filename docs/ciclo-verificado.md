# Ciclo verificado

> Disponible desde la versión en desarrollo posterior a 4.2.0. **Desactivado por defecto.**
> Especificación: `.sdd/especificaciones/2026-10-03-ciclo-verificado/`. Decisiones: `.sdd/arquitectura/ADR-01` a `ADR-11`.

Con el ciclo verificado, `forge run` no ejecuta cada tarea de código una sola vez: la corrige hasta que sus pruebas pasan, ejecutando el código generado en un contenedor Docker sin red, sin superar un tope de gasto y pidiéndote una decisión cuando no puede terminar solo.

## Requisitos

- **Docker** instalado y en marcha. Sin Docker, el ciclo no arranca (código de salida 4): nunca ejecuta código generado en tu equipo.
- **Node ≥18.** LangGraph.js, que ejecuta el grafo cuando está instalado, exige Node ≥20; en Node 18 se usa el motor propio, que hace lo mismo.
- Un proveedor de modelos que informe del consumo de cada llamada (Anthropic u OpenAI con clave, u Ollama).
- El proyecto debe estar en la etapa de tareas generadas o de construcción. Desde "tareas generadas" se avanza solo; en cualquier otra etapa hace falta `--force`.
- Proyectos en **JavaScript/TypeScript, Python o Go**. Con otro lenguaje, `forge run --motor ciclo` se niega a empezar y lo explica, antes de gastar nada. En Python, las dependencias deben estar en `requirements.txt`: un proyecto que las declara solo en `pyproject.toml` se rechaza con ese mensaje. En Go hace falta `go.mod` en la raíz (y `go.sum` si hay dependencias); el comando de pruebas es `go test ./...`. **La primera ejecución de un proyecto Go prepara una imagen (alrededor de 90 segundos, con red)**: descarga los módulos y compila de antemano la biblioteca estándar; las siguientes la reutilizan.

## Cómo activarlo

Por ejecución:

```bash
forge run --motor ciclo
```

O de forma permanente en `.sdd/sdd.config.yaml`:

```yaml
motor:
  modo: ciclo              # clasico (por defecto) | ciclo
  grafo: auto              # auto | langgraph | propio
  recuperador: archivos    # fuente de contexto de los agentes
  max_iteraciones: 5
  contexto_max_bytes: 65536

sandbox:
  cpus: 1
  memoria: 512m
  pids: 256
  timeout_s: 120

presupuesto:
  tope_usd: 2.00
  umbral_degradacion_usd: 1.50
  degradar_a: escalon
```

`FORGE_BUDGET_USD` sustituye a `presupuesto.tope_usd`. Solo puede haber **un ciclo a la vez por proyecto**: un segundo `forge run --motor ciclo` se rechaza mientras el primero siga en marcha.

## Qué hace con cada tarea

```
planner → retriever → qa → coder → sandbox ─┬─ las pruebas pasan ──▶ tarea completada
                              ▲             ├─ fallan y quedan topes ▶ vuelve a coder
                              └─────────────┘
                                            └─ tope, gasto o fallo del entorno ▶ te pregunta
```

1. **planner** (agente `arquitecto`): descompone la tarea en pasos.
2. **retriever**: reúne los archivos que declara la tarea y las líneas de la spec que citan sus criterios, sin superar `contexto_max_bytes` (cabeceras incluidas).
3. **qa** (agente `tester`): escribe las pruebas antes de que exista la implementación.
4. **coder** (el agente de la tarea): implementa. No puede modificar ni crear pruebas.
5. **sandbox**: ejecuta las pruebas en un contenedor.
6. El **router** decide por el código de salida. El éxito se comprueba antes que los topes: pasar en la quinta ejecución es un éxito.

Las tareas de código se ejecutan de una en una. Las que no son de código (arquitecto, revisor, documentador…) siguen el camino clásico.

## Aislamiento

Cada ejecución lanza un contenedor con:

- sin red (`--network none`) y sin descargar imágenes (`--pull never`);
- usuario sin privilegios, sin capacidades y sin posibilidad de ganarlas;
- 1 CPU, 512 MB de memoria y 256 procesos como máximo; como mucho 1024 archivos abiertos y archivos de 100 MB;
- sistema de archivos de solo lectura, salvo `/tmp` y la copia del proyecto;
- 120 s de tiempo máximo.

El contenedor no ve tu proyecto, sino una **copia desechable**. La copia no lleva `.git` ni ningún repositorio anidado, `.sdd`, `.claude`, `node_modules`, ni nada que parezca un secreto (`.env*`, `.npmrc`, `.netrc`, claves SSH, certificados, `*.tfstate`, `*credentials*`, `*secret*`…), a cualquier profundidad. Lo que el código escribe en ella se descarta. Cada ejecución usa su propia carpeta, con un nombre único por proceso; si el código de pruebas deja algo que Windows no puede borrar (enlaces, por ejemplo), no impide las siguientes, pero la copia queda en `.sdd/motor/<sesión>/staging/`. Al arrancar el ciclo se intenta borrar las copias anteriores y se avisa de las que no se pudieron borrar para que las borres a mano.

Las dependencias declaradas en `package.json`, `requirements.txt` o `go.mod`/`go.sum` se instalan una vez, con red, en una imagen `forge-sbx:<huella>` construida solo a partir de esos manifiestos. En JavaScript, sin ejecutar scripts de instalación; en Python, `pip` sí puede ejecutar el `setup.py` de paquetes sin rueda. El código generado corre después sobre esa imagen, sin red.

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
- **Configuración**: cualquier ruta con un segmento que empiece por punto (`.github/`, `.husky/`, `.vscode/`, `.eslintrc.js`, `.gitignore`…), `conftest.py`, `pytest.ini`, `*.config.js` (jest, vitest, babel, eslint…), `Makefile`, `Dockerfile`, `docker-compose.yml`, `CLAUDE.md`, `AGENTS.md`.

Esto es una lista, no una garantía: **una configuración que no esté en ella se escribirá**. Y el contenido de un archivo permitido no se inspecciona: un agente puede escribir código dañino en `src/`. Revisa el diff antes de hacer commit.

## Presupuesto

El tope es **por sesión** (un `forge run` y sus reanudaciones), no por tarea. El gasto se suma llamada a llamada en `.sdd/motor/<sesión>/gasto.jsonl`, así que cuenta también lo que gastó una tarea que se cortó, y una ampliación del tope vale para el resto de la sesión.

- Al llegar al umbral, las llamadas siguientes usan un modelo un escalón más barato (`opus → sonnet → haiku`), o un modelo local de Ollama si `degradar_a: local`.
- Al llegar al tope, no se inicia ninguna llamada más. El exceso máximo es el costo de una llamada.
- Si el implementador ya escribió código cuando se agota el presupuesto, las pruebas se ejecutan igualmente (no cuestan dinero): si pasan, la tarea termina bien.
- Una respuesta sin datos de consumo de un proveedor de pago se trata como error, no como gasto cero.

## Cuando te pregunta

El ciclo se pausa y `forge run` termina con código 3 en cinco casos:

| Motivo | Qué pasó |
|---|---|
| `iteraciones` | 5 ejecuciones sin que las pruebas pasen |
| `presupuesto` | Se alcanzó el tope de gasto |
| `infraestructura` | Falló Docker o el proveedor de modelos, o las pruebas cambiaron en disco; la causa va en el detalle |
| `dependencias` | El implementador propone cambiar dependencias o configuración que alguna herramienta ejecuta sola |
| `salida_invalida` | Un agente no devolvió el formato pedido, tras un reintento |

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

Un punto de guardado dañado se detecta por su huella y se usa el anterior válido. Un punto de otra sesión o de otro proyecto no se obedece. Dos procesos no pueden trabajar a la vez en la misma tarea ni en el mismo proyecto (candados con enlace duro; la retirada de un candado huérfano exige una reclamación aparte). Probado con 2 y con 3 procesos. Un candado de más de 6 horas se considera abandonado aunque su proceso siga vivo, y en sistemas de archivos sin enlaces duros el candado falla en modo seguro (no arranca).

Si una tarea tiene puntos de guardado del ciclo, `forge resume` la reanuda con el ciclo aunque no lo pidas: relanzarla en modo clásico ejecutaría en tu equipo, sin aislamiento, código que escribió un modelo. Por la misma razón, `forge run` sin `--motor ciclo` se niega a ejecutar sobre una sesión del ciclo sin terminar; `--force` lo permite bajo tu responsabilidad.

`forge status` muestra la sesión, el gasto y la situación de cada tarea.

## Probarlo con un modelo real

```bash
export ANTHROPIC_API_KEY=...
npx forge probar-modelo [--tope 0.50] [--conservar]
```

Crea un proyecto desechable con una tarea trivial (una función `suma` y sus pruebas), lanza el ciclo con un tope de gasto bajo y resume: resultado, iteraciones, gasto y llamadas, y si el modelo devolvió el formato de archivos que el ciclo espera (`salida_invalida` indica que no). Gasta dinero real: como máximo el tope (0,50 USD por defecto). Sale con 0 si la tarea terminó con éxito, 1 si no, 2 si no se pudo ejecutar (sin clave, tope no válido). Es la prueba que falta en la verificación del ciclo.

## Códigos de salida

| Código | Significado |
|---|---|
| 0 | Todas las tareas completadas, o la tarea se abortó por decisión humana (no es un fallo) |
| 1 | Fallo, o no se puede empezar (etapa, lenguaje, ciclo ya en marcha, decisión no válida) |
| 3 | Hay tareas que esperan tu decisión |
| 4 | Docker no está disponible |

## Límites conocidos

- **No probado con un modelo real.** El recorrido completo está probado con respuestas guionizadas y con Docker real, pero no con un proveedor de pago: no había clave disponible al desarrollarlo. No se sabe con qué frecuencia un modelo real devuelve el formato que el ciclo espera.
- **El ciclo no mide la calidad de las pruebas, y un implementador decidido puede falsear el resultado.** Aprueba por código de salida, pero **un código 0 solo se da por bueno si la salida muestra al menos una prueba pasada y el código escrito no corta el proceso al cargarse** (`process.exit`, `sys.exit`… al comienzo de línea). Si no, la tarea se pausa con el motivo `exito_sospechoso` y tú decides (`aceptar` si es correcto). Es una mitigación: una salida forzada indentada o escondida en una función no se detecta, y unas pruebas triviales que sí imprimen un resumen tampoco. Se cierran los nombres de prueba y la configuración del ejecutor, pero no esta vía. Si las pruebas recién escritas ya pasan sin implementación, queda un aviso en el registro, pero no se bloquea. **Revisa el diff y ejecuta las pruebas tú antes de dar una tarea por buena.**
- **Lista de archivos de configuración incompleta.** Se exige revisión humana para los que conocemos (`conftest.py`, `jest.config.*`, `.husky/`, `.github/`…), no para otros que alguna herramienta también interpreta (`jest.setup.js`, `__mocks__/`, `vitest.workspace.ts`, `karma.conf.js`, `tsconfig.json`, `scripts/*.sh`, `Procfile`…). Si no está en la lista, se escribirá.
- **Las credenciales se vetan por nombre.** Se rechazan los nombres habituales (`.pgpass`, `.vault-token`, `.dockercfg`, `kubeconfig`, `auth.json`, `*token*.json`, `*apikey*.txt`, `*.env`, `wp-config*.php`, `*.sqlite`, `database.yml`, `.gnupg/`, `.m2/`…), pero un secreto con un nombre inesperado se leería y se copiaría. `tokenizer.js` o `password.js` (código) no se vetan.
- **`protecciones.no_tocar_archivos` de `sdd.config.yaml` se aplica** (se leen los elementos `- "patrón"` de esa sección): esas rutas ni se escriben ni se leen. Es un lector de YAML mínimo: una lista en otro formato (en línea, `[a, b]`) no se reconoce.
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
- Un `motor.modo`, `motor.grafo` o `motor.recuperador` no válido en `sdd.config.yaml` hace fallar también el modo clásico.
- Los agentes leen el `sdd.config.yaml` del proyecto indicado con `--cwd`, no el del directorio actual; el circuit breaker escribe en ese proyecto.
- La etapa del proyecto se entiende también si la escribieron los comandos `/sdd.*` (`fase_actual`).
- `forge run` sin `--motor ciclo` se niega a ejecutar sobre una sesión del ciclo sin terminar.
