# Migración de 4.2.0 a 5.0.0

> Estado: **5.0.0 no está publicada.** En npm, `forja-mvp` sigue en 4.2.0 (`latest`), consultado el 2026-10-10. Este documento describe la rama `feature/motor-agentico` en el commit `9180814`.
> La 4.3.0 tampoco se publicó: quien actualiza desde 4.2.0 recibe de una vez sus cambios y los de 5.0.0. Aquí están juntos.
> Cada punto se comprobó en el código o en una prueba el 2026-10-10; la última columna dice dónde. Lo que no se pudo comprobar está marcado.

Este documento lista lo que cambia **sin que toques tu configuración**. Lo nuevo que solo actúa si lo activas (implementador por turnos, `mutacion: exigir`, servidor MCP, API HTTP, memoria semántica) está en el [CHANGELOG](../CHANGELOG.md) y en [ciclo-verificado.md](ciclo-verificado.md).

## Lo primero: cómo quedarte como en 4.2.0

```bash
forge run --motor clasico
```

o, de forma permanente, en `.sdd/sdd.config.yaml`:

```yaml
motor:
  modo: clasico
```

El modo clásico **ejecuta las pruebas en tu equipo, sin aislamiento**, como en 4.2.0. Con él no se aplican las secciones 2, 3 y 4, ni los puntos 1.2 (Docker), 5.1 (medición por mutación), 5.5 (imagen de Docker) y 6.4 (`sandbox.runtime`). Todo lo demás se aplica también en modo clásico.

**Atención a la sangría.** Las secciones `motor:`, `sandbox:`, `presupuesto:`, `modelos:` y `precios:` solo se leen si cada clave lleva **exactamente dos espacios**. Con cuatro espacios, con uno o con una tabulación, la clave se ignora sin aviso y se aplica el valor por defecto: escribirías `mutacion: no` y seguiría midiendo. Comprobado el 2026-10-10 llamando a `leerConfigCiclo` con cada sangría (`core/ciclo/config.js`, función `leerSeccion`). La sección `llm:` es distinta: ver el punto 6.1.

## 1. Requisitos que cambian

| # | Cambio | A quién afecta | Cómo evitarlo | Dónde se comprueba |
|---|---|---|---|---|
| 1.1 | **Node ≥20** (antes ≥18). `instalar.sh`, `instalar.ps1` y `forge doctor` lo comprueban | A quien use Node 18 | No se puede: actualiza Node | `package.json` (`engines`), `cli/index.js:887` |
| 1.2 | **`forge run` y `forge resume` exigen Docker en marcha.** Sin él salen con el código 4 y no ejecutan nada | A todos los que usen `forge run` | `--motor clasico` o `motor.modo: clasico` | `core/engine-cli.js:139-140`; `tests/ciclo-hallazgos.test.js` («sin --motor el ciclo es el modo por defecto…») |
| 1.3 | **`@anthropic-ai/sdk` pasa a ser dependencia** y se instala con el paquete. Son tres dependencias, no dos | A quien audite dependencias | No se puede | `package.json` |
| 1.4 | LangGraph.js ya no existe. `motor.grafo: langgraph` se acepta con un aviso y usa el motor propio | A quien lo configuró en una versión de desarrollo | Quita la clave | `core/ciclo/motores/index.js` |

## 2. El ciclo verificado es el modo por defecto

Todo lo de esta sección se evita con `--motor clasico` o `motor.modo: clasico`.

| # | Cambio | A quién afecta | Cómo ajustarlo sin salir del ciclo | Dónde se comprueba |
|---|---|---|---|---|
| 2.1 | Cada tarea de código se corrige hasta que sus pruebas pasan, en un contenedor Docker sin red, en lugar de ejecutarse una vez en tu equipo | A todos | — | `core/ciclo/config.js` (`modo: 'ciclo'`) |
| 2.2 | **Solo JavaScript/TypeScript, Python y Go.** Con otro lenguaje no empieza (código 1) y lo explica | Proyectos en Java, Rust, C#, Ruby, PHP… | Solo el modo clásico | `core/sandbox/preparar-imagen.js` (`comprobarProyecto`) |
| 2.3 | **Solo en la etapa `code`.** Desde `tasks` avanza solo; en cualquier otra etapa no empieza | Quien lanzaba `forge run` en otra etapa | `--force` | `core/engine-cli.js:126-129` |
| 2.4 | **Tope de gasto de 2,00 USD por sesión**, con cambio a un modelo más barato al llegar a 1,50 USD. Al llegar al tope no se inicia ninguna llamada más y la tarea espera tu decisión | Sesiones largas o con modelos caros | `presupuesto.tope_usd` y `presupuesto.umbral_degradacion_usd`, o la variable `FORGE_BUDGET_USD` | `core/ciclo/config.js` (`presupuesto`) |
| 2.5 | **Códigos de salida nuevos:** 3 (hay tareas que esperan tu decisión) y 4 (Docker no disponible) | Scripts y CI que solo distinguen 0 y 1 | Trata el 3 y el 4 aparte | `core/engine-cli.js:42` |
| 2.6 | Como mucho 5 ejecuciones de pruebas por tarea; después, la tarea se pausa (`iteraciones`) | Tareas difíciles | `motor.max_iteraciones`, o `forge resume --decision continuar --iteraciones-extra N` | `core/ciclo/config.js` |
| 2.7 | Las tareas de código se ejecutan de una en una, y una tarea en revisión detiene la ejecución | Quien contaba con paralelismo | — | `CHANGELOG.md` (4.3.0); no lo comprobé de nuevo en el código |
| 2.8 | Un solo ciclo a la vez por proyecto: el segundo se rechaza mientras el primero siga en marcha | Quien lance dos `forge run` | — | `core/ciclo/candado.js` |
| 2.9 | Los agentes ya no pueden escribir donde quieran: lo vetado (`.git`, `.sdd`, secretos…) se rechaza, y un cambio en dependencias o en configuración que otras herramientas ejecutan solas (`package.json`, `requirements*.txt`, `.github/`, `conftest.py`, `*.config.js`, `jest.setup.*`, `__mocks__/`, `Makefile`, `Dockerfile`, `AGENTS.md`…) **no se aplica y pausa la tarea** (`dependencias`) | Tareas que necesitan añadir una dependencia o tocar configuración | Hazlo tú y continúa, o decide en la pausa | `core/ciclo/protocolo-archivos.js`; `tests/ciclo-protocolo.test.js` |
| 2.10 | `protecciones.no_tocar_archivos` de `sdd.config.yaml` se aplica de verdad: esas rutas ni se leen ni se escriben. Si la lista no se entiende, el ciclo no empieza | Quien tenga esa sección con un formato que no sea `- "patrón"` o `["a", "b"]` | Corrige el formato | `core/ciclo/config.js` (`leerRutasProtegidas`) |

## 3. Cuándo te pide una decisión (y antes no)

En todos los casos `forge run` termina con el código 3 y `forge resume` muestra el motivo sin gastar nada.

| # | Cambio | A quién afecta | Cómo desactivarlo | Dónde se comprueba |
|---|---|---|---|---|
| 3.1 | **Rojo obligatorio.** Si las pruebas recién escritas pasan sin que exista la implementación, el agente de pruebas las reescribe una vez (una llamada más, que cuenta para el tope). Si vuelven a pasar, la tarea se pausa con `pruebas_no_fallan` y no se llama al implementador | Tareas sobre código que ya existe: refactors, pruebas para código heredado | **No hay interruptor global.** Por tarea: `"parte_de_codigo_existente": true` en su definición (`.sdd/estado-tareas.json`, el `.estado-tareas.json` de la spec o el archivo de `--tasks`) | `core/ciclo/nodos.js` (nodo `qa`); `tests/ciclo-rojo-obligatorio.test.js` |
| 3.2 | **Sin progreso.** Tres ejecuciones fallidas seguidas con la misma salida pausan la tarea (`sin_progreso`) en la tercera, no en la quinta | Tareas que repiten el mismo fallo | `motor.sin_progreso: 0` | `core/ciclo/config.js`; `tests/ciclo-sin-progreso.test.js` |
| 3.3 | **Éxito sospechoso.** Un código de salida 0 no basta: sin ninguna prueba pasada en la salida, con menos pruebas informadas que escritas, o con `process.exit`/`sys.exit` al cargarse el código, la tarea se pausa (`exito_sospechoso`) | Ejecutores de pruebas cuya salida FORGE no sabe contar | No se desactiva. `forge resume --decision aceptar` | `core/ciclo/sospecha.js`; `tests/sospecha-conteo.test.js` |
| 3.4 | **Python sin pruebas encontradas** (código de salida 5 al escribirlas): se pausa con la explicación, sin gastar iteraciones | Proyectos Python que acaban en `unittest discover` | Declara `pytest` (ver 4.1) | `core/ciclo/nodos.js` (`sinPruebasEjecutadas`) |
| 3.5 | Una respuesta de un proveedor de pago **sin datos de consumo**, o con tokens que no sean enteros mayores o iguales que cero, es un error y lleva a revisión. Antes un NaN o un negativo dejaban el tope sin efecto | Proveedores compatibles o intermediarios que no informan bien del consumo | No se desactiva | `core/ciclo/presupuesto.js:65-89`; `tests/puesta-al-dia-revision.test.js` |
| 3.6 | Un agente que no devuelve el formato pedido, tras un reintento, pausa la tarea (`salida_invalida`) | Modelos que cortan la respuesta: en modo de bloque, un archivo muy largo no cabe en la salida | `motor.implementador: turnos` (opcional, solo Anthropic) | `evidencia-2026-10-09.md`, ejecución 18 |

## 4. Proyectos Python

| # | Cambio | A quién afecta | Cómo evitarlo | Dónde se comprueba |
|---|---|---|---|---|
| 4.1 | **pytest tiene que estar en `requirements.txt`.** El contenedor solo instala lo que declara ese archivo. Si el proyecto se prueba con pytest (por `pytest.ini`, `conftest.py`, `setup.cfg`, `tox.ini`, `pyproject.toml` u otro archivo de requisitos) y `requirements.txt` no lo instala, **el ciclo no empieza** y dice qué añadir. Vale una línea `pytest` o un plugin que lo trae (`pytest-cov`, `pytest-django`…); `pytest-runner` no | Proyectos con pytest solo en `requirements-dev.txt` o en `pyproject.toml` | Añade `pytest` a `requirements.txt` | `core/pytest-deteccion.js`; `tests/validacion-modelo-real.test.js`; `evidencia-2026-10-09.md`, ejecución 14 |
| 4.2 | **Las dependencias solo se leen de `requirements.txt`.** Un proyecto que las declara solo en `pyproject.toml` se rechaza antes de empezar | Proyectos con `pyproject.toml` y sin `requirements.txt` | Añade un `requirements.txt` | `core/sandbox/preparar-imagen.js` (`comprobarProyecto`) |
| 4.3 | La detección de pytest lee líneas reales, no subcadenas: se detectan más proyectos que en 4.2.0 (antes solo `pytest.ini` y `pyproject.toml`) | Proyectos que en 4.2.0 se probaban con `unittest discover` | — | `core/pytest-deteccion.js` (`usaPytest`) |

## 5. Tiempo y gasto

| # | Cambio | A quién afecta | Cómo desactivarlo | Dónde se comprueba |
|---|---|---|---|---|
| 5.1 | **Medición de las pruebas por mutación, en modo `informar`.** Tras cada pase se ejecutan las pruebas una vez más sin cambios y luego una vez por cada cambio pequeño en el código (10 como mucho, más los que sustituyen a los no concluyentes), con un tope de 300 s. **No llama a ningún modelo ni cambia el resultado de la tarea; cuesta tiempo.** Medido solo en un proyecto JavaScript mínimo con Docker Desktop en Windows: entre 40 y 67 s para 9 cambios. En un proyecto real cada cambio cuesta lo que tarde su suite; no está medido | Todas las tareas que terminan bien | `motor.mutacion: no` | `core/ciclo/config.js` (`mutacion: 'informar'`); `pruebas-confiables/verificacion.md` («Tiempo de la medición») |
| 5.2 | **Caché de prompts activa con Anthropic.** La petición lleva `cache_control` en el prompt de sistema. El gasto calculado separa entrada normal, guardada (1,25 veces el precio de entrada) y reutilizada. Una tarea de una sola llamada paga algo más por la parte fija. Los demás proveedores no cambian | Quien use el proveedor de Anthropic | `llm.cache: false` | `core/llm-providers/anthropic-provider.js`; `tests/cache-prompts.test.js` |
| 5.3 | **Cambia el gasto calculado.** La lista de precios se rehízo el 2026-10-09 con la tarifa publicada: `claude-opus-4-8` pasa de 15/75 a 5/25 USD por millón y `claude-haiku-4-5-20251001` de 0,80/4 a 1/5. Un modelo sin precio se cobra al más caro de la lista, ahora 10/50 (antes 15/75) | Quien compare gasto entre versiones o use un modelo que no esté en la lista | Fija tus precios en `precios:` | `core/precios.js` |
| 5.4 | Un `precios:` o un `modelos:` mal escrito (precio no numérico, negativo, sin su pareja; nivel desconocido) impide empezar, también en modo clásico | Quien añada esas secciones | Corrige la clave que nombra el mensaje | `core/ciclo/config.js` (`leerPrecios`, `leerModelos`) |
| 5.5 | La primera ejecución de un proyecto con dependencias prepara una imagen de Docker **con red**. En Go tarda alrededor de 90 s | Primera ejecución de cada proyecto | — | `docs/ciclo-verificado.md` («Requisitos»); no lo medí |
| 5.6 | En modo clásico, el prompt de sistema pone el contrato de salida antes que el estado. El contenido es el mismo; cambia el orden | Quien compare respuestas entre versiones | No se desactiva | `puesta-al-dia/verificacion.md` («Compatibilidad») |

## 6. Configuración que antes se ignoraba y ahora impide empezar

| # | Cambio | A quién afecta | Cómo evitarlo | Dónde se comprueba |
|---|---|---|---|---|
| 6.1 | **Sangría estricta en `llm:`.** Una clave con un solo espacio o con tabulación, o la sección escrita entre llaves (`llm: { … }`), da un error que nombra la línea. Antes la clave se ignoraba en silencio. Con dos o más espacios se lee bien | Configuraciones con esa sangría | Usa dos espacios o más, sin tabulaciones | `core/llm-providers/index.js` (`leerConfigLlm`); comprobado el 2026-10-10 con 1, 2 y 4 espacios, tabulación y llaves |
| 6.2 | Un `motor.modo`, `motor.grafo` o `motor.embeddings` no válido hace fallar también el modo clásico | Configuraciones con un valor mal escrito | Corrige el valor | `core/ciclo/config.js` |
| 6.3 | `motor.mutacion`, `motor.sin_progreso`, `motor.implementador`, `motor.nivel_maximo` y los topes numéricos se validan: un valor mal escrito impide empezar, con un mensaje que nombra la clave | Configuraciones nuevas con un error | Corrige el valor | `core/ciclo/config.js` |
| 6.4 | `sandbox.runtime` (clave nueva): cualquier valor distinto de `runc` exige estar en la variable de entorno **`FORGE_RUNTIMES_PERMITIDOS`** (lista separada por comas). Si no, el ciclo, `forge doctor` y `ejecutar_pruebas` del servidor MCP lo rechazan (código 4) | Solo quien configure `sandbox.runtime` | Define la variable en tu equipo, o quita la clave | `core/sandbox/politica.js` (`runtimePermitido`); `tests/sandbox-runtime.test.js` |

## 7. `forge init`, hooks y modo clásico

| # | Cambio | A quién afecta | Cómo evitarlo | Dónde se comprueba |
|---|---|---|---|---|
| 7.1 | **`forge init` no escribe a través de enlaces simbólicos ni uniones.** Si `CLAUDE.md`, `AGENTS.md`, `.claudeignore`, `.sdd/`, `.claude/` o algo dentro de ellos es un enlace, se avisa y no se escribe | Quien tenga `CLAUDE.md` enlazado a otro archivo: **ya no se actualiza** | Sustituye el enlace por el archivo, o actualízalo a mano | `core/escritura-segura.js`, `cli/index.js`; `tests/puesta-al-dia-revision.test.js` |
| 7.2 | `forge init` **crea `AGENTS.md`** en el proyecto. Si ya existe no lo toca y deja la propuesta en `.sdd/AGENTS.propuesto.md` | Todos los que ejecuten `forge init` | Borra el archivo si no lo quieres | `cli/index.js:391-451`; `tests/agents-md.test.js` |
| 7.3 | `forge init` copia también `claude-hooks/shared/config.js` y los envoltorios `.sh` (en 4.2.0 los hooks instalados fallaban al importar) | Todos | — | `tests/saneamiento.test.js` («forge init instala hooks que cargan») |
| 7.4 | **La guarda de escritura** (hook `pre-tool-guard.js`) bloquea además cualquier escritura cuyo contenido incluya un término de la sección `## Patrones prohibidos` de un ADR **aceptado** de `.sdd/arquitectura/`. Esos términos no se aplican al escribir dentro de `.sdd/` | Proyectos con ADR en `.sdd/arquitectura/` que tengan esa sección | Quita el término de la sección | `claude-hooks/pre-tool-guard.js` (`cargarPatronesDeArquitectura`); `tests/guarda-adr-arquitectura.test.js` |
| 7.5 | El `.mcp.json` del plugin fija `@playwright/mcp@0.0.83` (antes `@latest`) | Quien use ese servidor a través del plugin | Edita tu `.mcp.json` | `.mcp.json` |
| 7.6 | Modo clásico: `forge run` y `forge resume` leen también las tareas de la spec activa (`.sdd/especificaciones/<id>/.estado-tareas.json`), no solo `.sdd/estado-tareas.json` | Quien tenga tareas en los dos sitios: manda `.sdd/estado-tareas.json` | — | `core/tareas.js`; `tests/saneamiento.test.js` |
| 7.7 | Modo clásico: se niega a ejecutar si alguna sesión tiene tareas del ciclo sin terminar (el código de un modelo estaría en tu proyecto y se ejecutaría en tu equipo) | Quien alterne los dos modos | `--force`, bajo tu responsabilidad | `core/engine-cli.js:357`; `tests/ciclo-hallazgos.test.js` («M4…») |
| 7.8 | `forge resume` reanuda con el ciclo una tarea que tiene puntos de guardado del ciclo, aunque pidas el clásico | Igual que 7.7 | `--force` | `tests/ciclo-hallazgos.test.js` |
| 7.9 | Modo clásico: un flag sin valor ya no se come al siguiente; un error sale con mensaje y código 1, no con traza; `forge resume --decision` sin tareas esperando, o `--tarea` sin identificador, se rechazan | Scripts que dependían del comportamiento anterior | — | `docs/ciclo-verificado.md` («Cambios en el modo clásico»); no lo comprobé de nuevo |
| 7.10 | Los agentes leen el `sdd.config.yaml` del proyecto indicado con `--cwd`, y el interruptor de circuito escribe en ese proyecto, no en el directorio actual | Quien use `--cwd` | — | `tests/saneamiento.test.js` («forzarNivel persiste en cwd…») |
| 7.11 | La etapa del proyecto se entiende también si la escribieron los comandos `/sdd.*` (`fase_actual`, `especificacion_activa`) | — | — | `core/state-machine.js`; `tests/saneamiento.test.js` |
| 7.12 | `forge status`, `step`, `validate` y `reset` vuelven a funcionar (en 4.2.0 fallaban con «dist/core/ no encontrado») | Todos | — | `tests/saneamiento.test.js` («forge status funciona sin dist/») |

## Lo que no cambia si no lo activas

- El implementador sigue trabajando en modo de bloque (`motor.implementador: bloque`). El modo por turnos es opcional.
- La medición por mutación nunca bloquea una tarea con el valor por defecto. Solo `motor.mutacion: exigir` puede pausarla.
- No se usa ningún mecanismo de aislamiento distinto del de Docker por defecto.
- `forge mcp` y `forge api` no arrancan solos.

## Comprobar que tu configuración se lee como esperas

1. `forge doctor`: Node, proveedor, clave y, si lo hay, `sandbox.runtime`. **No comprueba que Docker esté en marcha** salvo que haya un `sandbox.runtime` configurado (`cli/index.js:1181-1183`): para eso, `docker info`.
2. `forge status`: sesión, gasto, mecanismo de aislamiento configurado y, tras una ejecución, la puntuación de mutación de cada tarea. Si pusiste `mutacion: no` y aparece una puntuación, la clave no se está leyendo: revisa la sangría.
3. Con una tarea pequeña, `forge run` y después `forge resume` sin más: muestra el motivo de cualquier pausa sin gastar.

## Lo que este documento no cubre

- No se ha ejecutado una migración real de un proyecto de 4.2.0 a esta rama. La lista sale de leer el código, las pruebas y el CHANGELOG.
- La comparación se hizo contra lo que el CHANGELOG dice de 4.2.0, no contra el paquete 4.2.0 publicado.
- Los límites conocidos de cada cambio están en [PROBLEMAS-CONOCIDOS.md](PROBLEMAS-CONOCIDOS.md).
