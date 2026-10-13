# Problemas conocidos

> Fecha: **2026-10-12**. Describe la rama `feature/motor-agentico` en el commit `82815b4`. La versión 5.0.0 **no está publicada**.
> Reúne los límites que estaban repartidos por las verificaciones y revisiones del 2026-10-09, los que se comprobaron el 2026-10-10 (marcados «comprobado el 2026-10-10»), lo que dejó la tercera revisión independiente (2026-10-11) y las integraciones externas (sección 9). **Lo corregido desde el 2026-10-10 se quitó de las secciones 1 a 7**; la sección 10 dice qué se quitó y por qué commit.
> Solo hay límites documentados o comprobados. Si algo no aparece aquí, no quiere decir que funcione: quiere decir que nadie lo ha mirado.

Cada entrada dice **qué pasa**, **a quién afecta**, **cómo evitarlo hoy** y **dónde está la evidencia**. El estado va en el título: *abierto* (sin corregir), *mitigado* (reducido, no cerrado) o *sin comprobar* (nadie lo ha ejecutado).

Abreviaturas de la evidencia (rutas del repositorio; el paquete de npm no incluye `.sdd/`):

| Sigla | Documento |
|---|---|
| GUÍA | `docs/ciclo-verificado.md`, sección «Límites conocidos» salvo que se indique otra |
| EVID | `.sdd/especificaciones/2026-10-09-validacion-modelo-real/evidencia-2026-10-09.md` |
| REV-1, REV-2 | `revision-independiente.md` y `revision-independiente-2.md` de esa misma carpeta |
| PC-V, PC-R | `verificacion.md` y `revision-independiente.md` de `.sdd/especificaciones/2026-10-09-pruebas-confiables/` |
| IH-V, IH-R | lo mismo, de `2026-10-09-implementador-con-herramientas/` |
| PD-V, PD-R | lo mismo, de `2026-10-09-puesta-al-dia/` |
| REV-3 | `revision-independiente-3.md` de `2026-10-09-validacion-modelo-real/` (tercera revisión, 2026-10-11): hallazgos N-01 a N-14 |
| INT-V, INT-S | `verificacion.md` y `spikes/` de `.sdd/especificaciones/2026-10-11-integraciones-externas/` |
| PLAN | `PLAN-CIERRE-BRECHAS.md`, secciones «Estado de ejecución» y «Pendiente para las próximas sesiones» |

## Antes de nada

1. **El aislamiento solo se ha probado en Windows con Docker Desktop.** En Linux con Docker real no se ha ejecutado nunca (A-1).
2. **El gasto que muestra FORGE nunca se ha comparado con una factura** (G-1).
3. **Las pruebas que pasan no demuestran que el código sea correcto.** Con el valor por defecto, unas pruebas que no comprueban resultados terminan en éxito (P-1), y un implementador puede falsear un pase (C-2). Revisa el diff y ejecuta las pruebas tú.
4. **Toda la evidencia con un modelo real son 24 ejecuciones de tareas pequeñas en dos días** (2026-10-09 y 2026-10-10), con un solo proveedor, Anthropic (EVID, rondas 1 a 8; PLAN, estado de C1).
5. **Las correcciones posteriores a la tercera revisión independiente no tienen una cuarta** (`1aaf169`, `f70e641`, `27ea407`; PLAN, «Verificación»), y **las integraciones externas (sección 9) no tienen ninguna revisión independiente ni se han ejecutado contra una plataforma real**.

---

## 1. Ciclo

### C-1 · Con el nivel de modelo económico, el agente de pruebas escribe a veces valores esperados erróneos (abierto)

- **Qué pasa.** Las pruebas piden un resultado equivocado y ninguna implementación correcta puede pasarlas. El ciclo no distingue eso de una implementación que falla. La detección de «sin progreso» corta el gasto, pero la tarea acaba en revisión.
- **A quién afecta.** A quien limite el nivel con `motor.nivel_maximo: haiku` o `FORGE_NIVEL_MAXIMO=haiku`.
- **Cómo evitarlo hoy.** No limites al nivel económico: con el nivel medio la misma tarea pasó a la primera. Si la tarea se pausa por `sin_progreso`, lee las pruebas antes de pulsar `continuar`.
- **Evidencia.** EVID, hallazgo H10, ejecuciones 10, 11 y 16. PLAN, «Abierto, sin asignar».

### C-2 · Un pase se puede falsear (mitigado)

- **Qué pasa.** El ciclo aprueba por código de salida. Un código 0 solo vale si la salida muestra alguna prueba pasada, si el ejecutor informa de tantas pruebas como se escribieron y si el código no corta el proceso al cargarse. No se detecta un `process.exit(0)` indentado o dentro de una función, un resumen falseado por el propio código, ni un ejecutor sin cuenta legible (`go test` sin `-v`).
- **A quién afecta.** A cualquiera que dé una tarea por buena sin mirar.
- **Cómo evitarlo hoy.** Revisa el diff y ejecuta las pruebas tú antes de hacer commit.
- **Evidencia.** GUÍA («El ciclo no mide la calidad de las pruebas…»). `CHANGELOG.md`, 4.3.0, «Seguridad», «Sigue abierto».

### C-3 · «Sin progreso» solo ve salidas idénticas (abierto)

- **Qué pasa.** La tarea se pausa si tres ejecuciones seguidas fallan con la misma salida. No se detecta si la salida cambia cada vez (valores aleatorios, rutas temporales, orden no determinista), si las ejecuciones no imprimen nada, ni si lo que se repite es un tiempo agotado. En esos casos se gastan las cinco iteraciones. Las dos primeras repeticiones se pagan siempre.
- **A quién afecta.** Proyectos con pruebas de salida no determinista o que se cuelgan.
- **Cómo evitarlo hoy.** Baja `motor.max_iteraciones` o el tope de gasto en esos proyectos.
- **Evidencia.** GUÍA («Unas pruebas rotas por sí mismas…»). PLAN, «Abierto» («Los tiempos de espera repetidos no cuentan»).

### C-4 · La lista de archivos de configuración que exigen revisión es una lista (abierto)

- **Qué pasa.** Se pausa la tarea si un agente quiere tocar los archivos conocidos (`package.json`, `.github/`, `conftest.py`, `*.config.js`, `jest.setup.*`, `__mocks__/`…). Uno que no esté en la lista (`tsconfig.json`, `scripts/*.sh`, `Procfile`, un archivo de preparación de jest con otro nombre) **se escribe sin preguntar**. El contenido de un archivo permitido no se inspecciona.
- **A quién afecta.** A todos.
- **Cómo evitarlo hoy.** Protege lo tuyo con `protecciones.no_tocar_archivos` y revisa el diff.
- **Evidencia.** GUÍA («Lista de archivos de configuración incompleta»). PC-V, CA-004-01. Comprobado el 2026-10-10: `validarRuta` acepta `tsconfig.json`, `scripts/build.sh` y `Procfile`.

### C-5 · Los secretos se vetan por nombre (mitigado)

- **Qué pasa.** Se rechazan los nombres habituales (`.env*`, `.npmrc`, `.yarnrc*`, `id_rsa*`, `*.pem`, `.config/`, `secrets/`…). Un secreto en un archivo con un nombre inesperado se lee, se copia al contenedor y **se envía al proveedor del modelo**. El modo por turnos pasa además lo leído por un limpiador de formatos conocidos, que no los cubre todos. Desde `1aaf169` (N-03) redacta solo por formato de secreto, no por el nombre de la clave: ya no daña `auth: true` ni `const token = jwt.sign(…)`.
- **A quién afecta.** Proyectos con credenciales en archivos de nombre poco común.
- **Cómo evitarlo hoy.** Añade esas rutas a `protecciones.no_tocar_archivos`, o sácalas del proyecto.
- **Evidencia.** GUÍA («Las credenciales se vetan por nombre»). IH-R, hallazgo H-04 (corregido en parte en el commit `90596cb`).

### C-6 · Se rechazan rutas legítimas (abierto)

- **Qué pasa.** Para cerrar trucos de Windows y secretos se rechazan los archivos de datos (`.json`, `.yml`, `.txt`…) con `secret`, `credentials`, `token` o `password` en el nombre, los que terminan en `key.json`, y las rutas con punto o espacio final, `~1` o `:`. Un agente no puede escribir `data/secret-santa.json`, `tokens.json`, `src/key.json` ni `config/database.yml`. El código con esos nombres (`src/secret-santa.js`, `src/tokenizer.js`) sí se acepta.
- **A quién afecta.** Proyectos con archivos de datos con esos nombres.
- **Cómo evitarlo hoy.** Renombra el archivo o quítalo de la tarea.
- **Evidencia.** GUÍA («Las credenciales se vetan por nombre»). Comprobado el 2026-10-10 llamando a `validarRuta` (`core/ciclo/protocolo-archivos.js`) con esas rutas.

### C-7 · Reanudar puede pagar una llamada de más o servir una respuesta antigua (abierto)

- **Qué pasa.** (a) Si el proceso muere entre que el implementador escribe sus archivos y que se guarda el punto del nodo, y el archivo estaba en el contexto, la llamada se paga otra vez. (b) Si una persona edita la implementación entre un corte y la reanudación, el implementador recibe la respuesta guardada para el estado anterior.
- **A quién afecta.** A quien corte un ciclo a mitad de una tarea.
- **Cómo evitarlo hoy.** No edites los archivos de una tarea con la reanudación pendiente; si lo haces, `forge resume --decision abortar` y relánzala.
- **Evidencia.** GUÍA, sección «Reanudación» (caso a). REV-2, R3 y «Clave del diario», «Residuo por diseño» (caso b, que la guía no recoge).

### C-8 · `aceptar` antes de implementar cierra la tarea sin código (abierto)

- **Qué pasa.** En una pausa que ocurre antes de que el implementador trabaje (`pruebas_no_fallan`, pruebas no encontradas), `aceptar` marca la tarea como completada con cero archivos de implementación. Aparte, si el agente de pruebas reescribe sus pruebas con otro nombre de archivo, el anterior queda huérfano.
- **A quién afecta.** A quien responda `aceptar` sin leer el motivo.
- **Cómo evitarlo hoy.** Lee el motivo con `forge resume` (no gasta nada). En esas pausas, `continuar` o `abortar`.
- **Evidencia.** REV-1, R11 y R5. EVID, tabla de la revisión (R5 y R11 «Abierto»).

### C-9 · El mapa del proyecto que reciben los agentes es parcial (abierto)

- **Qué pasa.** La lista de archivos se corta en 200 entradas y, con más de 3000 archivos, deja carpetas enteras fuera sin avisar. Ya no descarta los nombres con acentos u otros alfabetos (`señal.py`, `módulo.py`; corregido, ver la sección 10); sí deja fuera los que llevan caracteres de control, invisibles o de cambio de dirección. El texto del repositorio (nombres de archivo, nombres de dependencia, `scripts.test`) entra en el prompt sin separar datos de instrucciones. `package.json` y `go.mod` se leen enteros, sin tope de tamaño.
- **A quién afecta.** Proyectos grandes, proyectos con nombres en español, y quien ejecute el ciclo sobre un repositorio ajeno.
- **Cómo evitarlo hoy.** Nombra en la tarea los archivos que importan. No ejecutes el ciclo sobre un repositorio que no conoces.
- **Evidencia.** REV-2, N9, N6 y tabla ASI01/ASI07. PLAN, «Abierto». `nombreListable` y `seccionMapa` en `core/ciclo/nodos.js`, comprobado el 2026-10-12. Ningún efecto de esto se ha probado con un modelo real.

### C-10 · Una clave de `sdd.config.yaml` mal sangrada se ignora sin aviso (corregido el 2026-10-12)

- **Corregido.** Una clave conocida de `motor`, `sandbox`, `presupuesto`, `modelos` o `precios` con sangría distinta de dos espacios (o con tabulación) lanza un error que nombra la clave y la línea; `llm:` ya avisaba. Antes: en las secciones `motor:`, `sandbox:`, `presupuesto:`, `modelos:` y `precios:` solo se leían las claves con **exactamente dos espacios**. Con cuatro, con uno o con tabulación, la clave se ignora y se aplica el valor por defecto, sin mensaje. `mutacion: no`, `modo: clasico` o `tope_usd: 0.5` con cuatro espacios no hacen nada. La sección `llm:` sí avisa.
- **A quién afecta.** A quien edite el archivo a mano con otra sangría. Es más grave en los controles de gasto: `nivel_maximo` o `tope_usd` mal sangrados dejan el valor más caro.
- **Cómo evitarlo hoy.** Dos espacios. Comprueba el efecto con `forge status` tras una ejecución pequeña.
- **Evidencia.** `core/ciclo/config.js` (`leerSeccion`). REV-1, R10, observación 1. Reproducido llamando a `leerConfigCiclo` con cada sangría.

### C-11 · `forge doctor` no comprueba que Docker esté en marcha (corregido el 2026-10-12)

- **Corregido.** `forge doctor` comprueba Docker siempre (versión, tiempo de respuesta con tope de 5 s por consulta, imágenes base presentes o por descargar) mediante `core/sandbox/diagnostico.js`. Antes: Docker es obligatorio para el modo por defecto, pero `forge doctor` solo lo consultaba si hay un `sandbox.runtime` configurado. Puede salir sin problemas y `forge run` terminar después con el código 4.
- **A quién afecta.** A quien instale FORGE y se fíe del diagnóstico.
- **Cómo evitarlo hoy.** `docker info` antes de `forge run`.
- **Evidencia.** `cli/index.js:1174-1183`. PD-V, «Pruebas inestables», cuenta que antes lo consultaba siempre y se quitó porque una prueba del diagnóstico agotó su tiempo.

### C-12 · Sin clave, el proveedor de Anthropic no da error (abierto, comprobado el 2026-10-10)

- **Qué pasa.** Sin `ANTHROPIC_API_KEY`, `complete` devuelve el texto `[stub-anthropic] sin SDK o API key…` en lugar de fallar, sin datos de consumo. En el ciclo, una respuesta sin datos de consumo de un proveedor de pago se trata como error y la tarea va a revisión. No se comprobó para este documento qué hace el modo clásico con ese texto.
- **A quién afecta.** A quien lance `forge run` sin clave.
- **Cómo evitarlo hoy.** `forge doctor` valida la clave y la conexión.
- **Evidencia.** `core/llm-providers/anthropic-provider.js:192`; lo fija `tests/cache-prompts.test.js:154`. GUÍA, «Presupuesto».

### C-13 · Qué proyectos no cubre (abierto)

- **Qué pasa.** Java, Rust, C#, Ruby y PHP: el ciclo no empieza. Monorepos: solo se leen los manifiestos de la raíz. Python: solo se instala `requirements.txt`; si ese archivo incluye otro con `-r` o `-c`, la imagen no puede construirse (comprobado con Docker real) y desde el 2026-10-12 la comprobación previa lo dice antes de gastar; `pytest \` con continuación de línea y `#egg=pytest` ya se reconocen. El comando de pruebas se ejecuta sin shell: un `&&`, `|` o `;` es un error.
- **A quién afecta.** Esos proyectos.
- **Cómo evitarlo hoy.** Un `requirements.txt` plano con todo lo necesario. Para un comando complejo, un script de `package.json` o un Makefile. Para lo demás, `--motor clasico`.
- **Evidencia.** GUÍA. REV-2, N4. La expresión de `requierePytest` (`core/pytest-deteccion.js`) se comprobó el 2026-10-10.

### C-14 · `motor.nivel_maximo` solo actúa en el ciclo (abierto)

- **Qué pasa.** El límite de nivel de modelo no se aplica en modo clásico, aunque el CHANGELOG dice que limita «todos los agentes».
- **A quién afecta.** A quien use `--motor clasico` creyendo haber limitado el nivel.
- **Cómo evitarlo hoy.** En modo clásico, fija el modelo en la definición de cada agente.
- **Evidencia.** REV-1, R10, observación 6 (por lectura del código; no se ejecutó). EVID, R10 «Abierto».

### C-15 · Lo que no se ha probado del ciclo (sin comprobar)

- **Qué pasa.** No hay evidencia con proyectos grandes (todo fueron proyectos de pocos archivos), ni de una tarea resuelta con el nivel alto en más de una iteración. `forge config set` y `forge aprobar` escriben en `.sdd/` sin comprobar enlaces simbólicos.
- **A quién afecta.** A quien lo use en un proyecto real.
- **Cómo evitarlo hoy.** Empieza con una tarea pequeña y un tope de gasto bajo.
- **Evidencia.** EVID, «Lo que sigue sin demostrarse». PLAN, «Abierto». PD-V, «Fuera de lo pedido que se tocó».

### C-16 · El planificador a veces no nombra ningún archivo objetivo (abierto)

- **Qué pasa.** En una ejecución real el planificador devolvió `archivosObjetivo` vacío y el recuperador no aportó contexto. Lo compensa el implementador (recibe su versión anterior y el mapa de archivos), no el agente de pruebas.
- **A quién afecta.** A tareas sobre código existente cuyos archivos no declara la tarea.
- **Cómo evitarlo hoy.** Declara en la tarea los archivos que importan.
- **Evidencia.** EVID, hallazgo H9 (abierto).

---

## 2. Pruebas y mutación

### P-1 · Con el valor por defecto, unas pruebas que no comprueban nada terminan en éxito (abierto)

- **Qué pasa.** `motor.mutacion: informar` mide y anota la puntuación, pero nunca cambia el resultado. Unas pruebas que fallan sin implementación y luego pasan sin comprobar resultados dan éxito, con una puntuación baja en el registro.
- **A quién afecta.** A todos los que no cambien el valor por defecto.
- **Cómo evitarlo hoy.** Mira la puntuación en `forge status`. Si quieres que bloquee, `motor.mutacion: exigir` (lee antes P-6 y P-8).
- **Evidencia.** PC-V, «Criterios de éxito medibles», segunda fila.

### P-2 · El rojo obligatorio solo mira el código de salida, y no se puede apagar (abierto)

- **Qué pasa.** Unas pruebas que fallan por un motivo equivocado (un error de sintaxis en la propia prueba, un nombre de archivo mal escrito) cuentan como «fallan». No hay una clave de configuración que lo desactive: solo la exención por tarea.
- **A quién afecta.** Tareas sobre código existente, que se pausarán con `pruebas_no_fallan` si no declaran la exención.
- **Cómo evitarlo hoy.** `"parte_de_codigo_existente": true` en la tarea. Lo declara quien escribe la tarea, también si es un agente: `forge status` lista las exentas, revísalas.
- **Evidencia.** GUÍA («El rojo obligatorio solo mira el código de salida»). PC-R, H-07 (mitigado). `core/ciclo/config.js` no tiene clave para el rojo (comprobado el 2026-10-10).

### P-3 · La puntuación de mutación es una muestra con ruido (abierto)

- **Qué pasa.** Son cuatro tipos de cambio y diez por tarea. Los cambios que no alteran el comportamiento cuentan como «no detectados» y bajan la puntuación de unas pruebas buenas; también los cambios inútiles (un índice de arreglo, el tamaño de un arreglo en Go). Un 100 % dice que las pruebas notaron esos cambios, no que el código sea correcto.
- **A quién afecta.** A quien lea la puntuación como una nota.
- **Cómo evitarlo hoy.** Léela como una señal. Mira la lista de cambios no detectados, no solo el porcentaje.
- **Evidencia.** GUÍA («Límites de la medición por mutación»). PC-R y PC-V, H-10 (abierto).

### P-4 · Python, Go y TypeScript con tipos se alteran por patrones de texto; JSX no se altera (abierto)

- **Qué pasa.** Solo JavaScript se analiza con un analizador sintáctico. En los demás lenguajes parte del código queda sin alterar y algunos cambios no compilan (esos se descartan, no cuentan). Un archivo con JSX no se altera: la medición se omite.
- **A quién afecta.** Proyectos en esos lenguajes y proyectos con JSX. Con `exigir`, una medición omitida o con menos de tres cambios concluyentes pausa la tarea.
- **Cómo evitarlo hoy.** Con `exigir` en esos proyectos, espera pausas; `aceptar` las desbloquea, o baja `motor.mutacion_min_concluyentes`.
- **Evidencia.** GUÍA. PC-R, H-03, H-04 y H-10.

### P-5 · La medición no se ha ejecutado con Docker real en Python ni en TypeScript (sin comprobar)

- **Qué pasa.** Con Docker real solo se midió en JavaScript y en Go. Los formatos de salida de pytest, unittest, jest y vitest se reconocen ya con salidas reales capturadas de esas herramientas (`tests/fixtures/salidas-ejecutores/`), no con patrones escritos de memoria, pero esa captura no es una medición con Docker real. `tests/mutacion-docker-lenguajes.test.js` está escrito y **sin resultado confirmado**. Si un formato no se reconoce, el cambio queda como «no concluyente» (se pierde señal; no se infla).
- **A quién afecta.** Proyectos en Python y TypeScript.
- **Cómo evitarlo hoy.** No uses `exigir` en esos lenguajes hasta que se mida.
- **Evidencia.** PC-V, «Lo que no se ha hecho… en esta pasada». PLAN, estado de C6 y «Verificación», «Pendiente».

### P-6 · Un implementador puede sesgar la puntuación (abierto)

- **Qué pasa.** No se detecta código que se comporte distinto cuando lo están midiendo, ni se descartan los archivos que las pruebas no llaman.
- **A quién afecta.** A quien use `exigir` como garantía.
- **Cómo evitarlo hoy.** No la trates como garantía. Revisa el diff.
- **Evidencia.** PC-R, H-02; PC-V, «H-02 (c)» sin hacer.

### P-7 · Cada tarea que termina bien tarda más (abierto)

- **Qué pasa.** Una ejecución de las pruebas por cambio, más una de referencia. Medido solo en un proyecto JavaScript mínimo con Docker Desktop en Windows: entre 40 y 67 s para 9 cambios. El tope de 300 s se comprueba antes de cada cambio, así que puede pasarse en lo que dure una ejecución (120 s como mucho). En un proyecto real no está medido.
- **A quién afecta.** A todos, con el valor por defecto.
- **Cómo evitarlo hoy.** `motor.mutacion: no`, o baja `motor.mutacion_max`.
- **Evidencia.** PC-V, «Tiempo de la medición con Docker real» y CA-002-04.

### P-8 · `exigir` no se ha ejecutado con un modelo real (sin comprobar)

- **Qué pasa.** El refuerzo de pruebas y los tres modos se probaron con respuestas guionizadas. No se sabe cómo de bien refuerza un modelo las pruebas a partir de la lista de cambios no detectados. Además, el refuerzo ocurre después de implementar, lo que tensiona el Principio VII de la constitución; el dueño no lo ha ratificado.
- **A quién afecta.** A quien active `exigir`.
- **Cómo evitarlo hoy.** Úsalo sabiendo que es experimental.
- **Evidencia.** PLAN, «Verificación» y «Necesita algo tuyo». PC-V, «Lo que no se ha hecho».

### P-9 · Otros límites de las pruebas (abierto)

| Qué pasa | A quién afecta | Cómo evitarlo hoy | Evidencia |
|---|---|---|---|
| El agente de pruebas tampoco puede escribir en `__mocks__/`: la tarea se pausa | Pruebas que necesitan un módulo simulado ahí | Créalo tú antes | GUÍA |
| La copia temporal de la medición vive en la carpeta temporal del sistema. Sus permisos `0700` no se han comprobado en un Linux real, y una copia que deja un proceso matado no se barre hasta pasadas 6 horas. No lleva secretos vetados; sí el código del proyecto | Equipos Linux compartidos | Borra `forge-mutacion-*` de la carpeta temporal tras un corte | PC-V, H-06; PLAN, «Verificación» |
| La skill `mutation-detector` **no** hace pruebas de mutación: registra qué archivos cambian los agentes. No se ha renombrado | Quien busque la medición por su nombre | La medición está en `core/ciclo/mutacion.js` | PLAN, «Corrección al análisis previo»; PC-V |

### P-10 · La puntuación se infla con funciones trampa que el código llama (abierto, N-02)

- **Qué pasa.** Un implementador (o un modelo que no entiende cómo se mide) puede poner comprobaciones que se autodisparan **dentro de funciones** que el código bajo prueba llama. Al alterar esos archivos, las pruebas fallan de verdad y la alteración cuenta como «detectada» aunque las pruebas no comprueben nada. En la reproducción con Docker real, nueve archivos de una línea dieron 9 de 10, el 90 %. El reparto de la muestra por archivo lo facilita, y el mínimo de tres cambios concluyentes se cumple con tres de esos archivos. No se filtra por cobertura (qué líneas ejecutan las pruebas).
- **A quién afecta.** A quien use `motor.mutacion: exigir` como garantía, sobre todo frente a un implementador adversario.
- **Cómo evitarlo hoy.** No trates la puntuación como garantía; revisa el diff. Es la razón por la que `exigir` no es el valor por defecto.
- **Evidencia.** REV-3, N-02 (`core/ciclo/mutacion.js`, `seleccionarPorArchivo`). PLAN, «Pendiente», primera casilla de Verificación.

---

## 3. Implementador por turnos (`motor.implementador: turnos`, opcional)

### T-1 · Solo funciona con Anthropic, y el aviso no sale en la terminal (abierto)

- **Qué pasa.** Con OpenAI (y compatibles) u Ollama, el ciclo trabaja en modo de bloque y solo deja un evento `ciclo:implementador_sin_herramientas` en `.sdd/events.jsonl`. Con `degradar_a: local`, al cruzar el umbral de gasto los turnos se detienen.
- **A quién afecta.** Quien active `turnos` con otro proveedor: creerá que lo está usando.
- **Cómo evitarlo hoy.** Busca ese evento en `.sdd/events.jsonl`.
- **Evidencia.** IH-V, CA-006-02 y RF-004. GUÍA, «Implementador por turnos».

### T-2 · La evidencia con un modelo real son dos ejecuciones de una misma tarea (sin comprobar)

- **Qué pasa.** Una tarea (cambiar una función en un archivo de 1812 líneas), con el nivel económico, una vez sin caché y otra con ella. Sin probar con un modelo real: la reanudación tras un corte entre turnos, el tope de turnos y la vuelta al modo de bloque. Las correcciones de la revisión independiente (commit `90596cb`) no se han vuelto a ejecutar con un modelo real ni tienen segunda revisión.
- **A quién afecta.** A quien lo active.
- **Cómo evitarlo hoy.** Tope de gasto bajo y revisión del diff.
- **Evidencia.** EVID, rondas 6 y 7. IH-V, último apartado. PLAN, «Verificación».

### T-3 · El gasto de un turno no tiene tope propio (abierto)

- **Qué pasa.** El tope se comprueba antes del turno y el costo se conoce después. Cada turno reenvía toda la conversación (hasta 30 turnos, 32 KB por resultado, sin compactar): el exceso máximo sobre el tope es un turno con la conversación entera. Si el corte llega antes de anotar la respuesta de un turno, ese turno se paga dos veces. Una respuesta cortada por longitud se paga y no ejecuta nada.
- **A quién afecta.** Tareas largas por turnos.
- **Cómo evitarlo hoy.** Baja `motor.turnos_max` y deja margen en el tope.
- **Evidencia.** IH-R, H-07 y H-10. IH-V, «Límites conocidos de lo entregado».

### T-4 · Trabaja con menos contexto y no puede borrar (abierto)

- **Qué pasa.** No recibe el contexto del recuperador: recibe el mapa de archivos (recortado a 200) y lee lo que necesita. No puede borrar ni renombrar archivos.
- **A quién afecta.** Tareas de reorganización de archivos.
- **Cómo evitarlo hoy.** Para esas tareas, modo de bloque.
- **Evidencia.** IH-V, «Límites conocidos». PLAN, «Abierto».

### T-5 · `abortar` puede no restaurar el original si hay una unión de directorios dentro del proyecto (abierto)

- **Qué pasa.** El respaldo no reconoce dos rutas distintas que llevan al mismo archivo. Si se edita por las dos, la segunda copia de respaldo es la ya modificada y es la que se restaura.
- **A quién afecta.** Proyectos con uniones o enlaces de directorio internos (el modelo no puede crearlos).
- **Cómo evitarlo hoy.** Usa `git` para volver atrás en esos proyectos.
- **Evidencia.** IH-R, H-05. Sigue en `core/ciclo/respaldo.js` (comprobado el 2026-10-10).

### T-6 · Otros límites del modo por turnos (abierto)

| Qué pasa | A quién afecta | Cómo evitarlo hoy | Evidencia |
|---|---|---|---|
| Si una acción del turno pide revisión (dependencias o configuración), las siguientes acciones **del mismo turno** se ejecutan igual antes de pausar | Tareas que tocan configuración | `abortar` restaura lo escrito | IH-R, H-11; `core/ciclo/turnos.js:271-276` (comprobado el 2026-10-10) |
| Nombres de archivo que Windows trata como dispositivos (`COM¹`, `CONIN$`) o con caracteres invisibles se aceptan | Windows | Revisa los nombres nuevos en el diff | IH-R, H-06 |
| Un proceso matado en mitad de una escritura deja un `*.forge-tmp-<pid>` que nadie borra | Tras un corte | Bórralo a mano | IH-R, H-09 |
| `buscar` cuenta apariciones sin solapar: puede sustituir un fragmento que no es único | Ediciones sobre texto repetitivo | Fragmentos más largos | IH-R, H-13 |
| Un fallo del proveedor a mitad de un intento empieza una conversación nueva al continuar; no hay tiempo máximo para el intento completo | Tareas largas | Tope de turnos y de gasto | IH-V, «Límites conocidos» |

---

## 4. Gasto y precios

### G-1 · El gasto calculado nunca se ha comparado con lo facturado (sin comprobar)

- **Qué pasa.** El tope de gasto se calcula multiplicando tokens por una lista de precios. La lista se contrastó el 2026-10-09 con la tarifa publicada, no con una factura. El criterio de la spec (diferencia menor del 5 %) está sin medir.
- **A quién afecta.** A todos: el tope es tan bueno como los precios.
- **Cómo evitarlo hoy.** Compara `.sdd/motor/<sesión>/gasto.jsonl` con la consola de tu proveedor tras las primeras sesiones. Pon un límite de gasto también en el proveedor.
- **Evidencia.** PLAN, estado de C4 y «Necesita algo tuyo». EVID, H5. `RELEASE-CHECKLIST.md`.

### G-2 · Las cifras de gasto de la evidencia mezclan dos listas de precios (abierto)

- **Qué pasa.** Las primeras ejecuciones reales se calcularon con la lista antigua, que cobraba el nivel económico un 20 % por debajo del precio publicado y el nivel alto al triple. Los totales (unos 1,85 USD en 20 ejecuciones) suman líneas de las dos.
- **A quién afecta.** A quien use esas cifras para estimar costos.
- **Cómo evitarlo hoy.** No las uses como referencia de costo.
- **Evidencia.** EVID, H5 y totales de las rondas 5 a 7.

### G-3 · OpenAI: sin ninguna prueba automática de su llamada (abierto; precios contrastados el 2026-10-12)

- **Qué pasa.** Los precios de OpenAI (gpt-4o, gpt-4o-mini) se contrastaron el 2026-10-12 con https://developers.openai.com/api/docs/pricing (nivel Standard) y coinciden. Ninguna prueba ejecuta la llamada del proveedor de OpenAI, ni contra un servidor simulado. Y todas las ejecuciones registradas con un modelo real son con Anthropic: no hay ninguna con OpenAI ni con Ollama.
- **A quién afecta.** A quien use OpenAI, un compatible u Ollama.
- **Cómo evitarlo hoy.** Fija sus precios en `precios:` y prueba primero con una tarea trivial y un tope bajo.
- **Evidencia.** `CHANGELOG.md`, 5.0.0; PLAN, «Abierto». `docs/COBERTURA.md` (61,36 % de líneas en `openai-provider.js`; todo `complete` sin cubrir). EVID, cabecera («Proveedor: Anthropic por API»).

### G-4 · Tramos de precio que no se contemplan (abierto)

- **Qué pasa.** Claude Haiku 5.5 cuesta cinco veces más en peticiones de más de 100 000 tokens de entrada, y FORGE cobra siempre el tramo bajo. Las escrituras de caché de 1 hora se cobrarían como las de 5 minutos (hoy FORGE no las pide).
- **A quién afecta.** Quien fije Haiku 5.5 y suba `motor.contexto_max_bytes`, o use el modo por turnos con conversaciones largas.
- **Cómo evitarlo hoy.** Con Haiku 5.5, no subas el contexto.
- **Evidencia.** `core/precios.js` (comentario de `claude-haiku-5-5`). PD-R, H-13. GUÍA, «Modelos y precios».

### G-5 · El ahorro de la caché de prompts está medido una sola vez, y no en el modo por defecto (sin comprobar)

- **Qué pasa.** En el modo por turnos, una ejecución con caché costó un 55 % menos que otra sin ella (no eran idénticas). En el modo de bloque, que es el de por defecto, no hay ninguna medida: el criterio de la spec (30 % menos de entrada en tres iteraciones) sigue pendiente. Una tarea de una sola llamada paga un 25 % más por la parte fija. Si la parte fija no llega al mínimo del modelo (4096 tokens en Haiku 4.5), no se guarda nada.
- **A quién afecta.** Quien use Anthropic.
- **Cómo evitarlo hoy.** `llm.cache: false` si tus tareas suelen resolverse en una llamada. Para medirlo: GUÍA, «Caché de prompts».
- **Evidencia.** EVID, ronda 7 y hallazgo H14 (en modo de bloque cada agente tiene su propio prompt de sistema, así que solo hay lecturas cuando el mismo agente repite en menos de cinco minutos; con el nivel económico por defecto no se guarda nada). PD-V, «Pendiente: medir el ahorro real». PLAN, 9.1.

### G-9 · Una llamada cortada o sin consumo informado se cuenta por estimación (abierto)

- **Qué pasa.** (a) Una llamada cancelada por tiempo, o con el proceso cortado mientras estaba en vuelo, pudo cobrarse sin que FORGE sepa cuánto: se anota una estimación por lo alto de la **entrada** (`estimado: true` en `gasto.jsonl`; eventos `ciclo:llamada_abortada` y `ciclo:llamada_huerfana`); la salida no se conoce. Tras un corte la petición se repite y se paga otra vez (inherente: el proveedor no permite saber si la primera se procesó). (b) Una respuesta sin datos de consumo válidos se anota con una estimación de entrada y salida (`ciclo:consumo_estimado`) para que el tope siga mordiendo. (c) Cada intento cancelado por tiempo se estima aparte; solo se reintenta una vez. (d) Se desconoce por qué algunas llamadas no responden en 120 s (H13).
- **A quién afecta.** A quien tenga proveedores lentos o corte el proceso a mitad de una llamada.
- **Cómo evitarlo hoy.** Ajusta `llm.timeout_s` si tu proveedor es lento y compara el gasto con la consola del proveedor. El texto no ASCII se estima por bytes; es una cota, no una medida.
- **Evidencia.** Hallazgos H13, N-06, N-11 y H-10 de la fase 8. `tests/gasto-robustez.test.js`.

### G-6 · El tope se puede superar en una llamada, y un precio mal puesto lo falsea (abierto)

- **Qué pasa.** Al llegar al tope no se inicia otra llamada: el exceso máximo es el costo de la última. Un modelo sin precio se cobra al más caro conocido (el tope llega antes de lo real). Un precio configurado por debajo del real hace que se gaste más de lo que FORGE cree.
- **A quién afecta.** A todos.
- **Cómo evitarlo hoy.** Deja margen y revisa el evento `ciclo:precio_desconocido`.
- **Evidencia.** GUÍA, «Presupuesto» y «Modelos y precios».

### G-7 · En modo clásico no hay parada dura de gasto (abierto)

- **Qué pasa.** El acumulador del modo clásico es una alerta, no un tope, y no recibe los `precios:` del proyecto.
- **A quién afecta.** A quien use `--motor clasico`.
- **Cómo evitarlo hoy.** Límite de gasto en el proveedor.
- **Evidencia.** PD-R, H-06 («Solo es alerta, no el tope»). PD-V, H-06 («No hay cableado»).

### G-8 · Sin comprobar

| Qué pasa | A quién afecta | Cómo evitarlo hoy | Evidencia |
|---|---|---|---|
| Los reintentos de red (tres por llamada) podrían cobrar respuestas perdidas que el libro de gasto no ve | Redes inestables | Límite en el proveedor | IH-R, respuesta (g): «no comprobado» |
| `degradar_a: local` no se ha probado contra un Ollama en marcha | Quien lo configure | Pruébalo con un tope bajo | GUÍA |

### G-9 · Una llamada cancelada por tiempo se cobra y solo se estima su entrada (abierto, H12, H13, N-11)

- **Qué pasa.** Si el proveedor no responde en el tiempo máximo del agente (120 s), el ciclo cancela la espera, pero el proveedor puede haber procesado y cobrado la petición. Desde `39d86e6` se anota una estimación de la **entrada** (tres caracteres por token), marcada `estimado` en el libro, con el evento `ciclo:llamada_abortada`. La **salida no se estima**: el gasto real puede superar al calculado. La estimación subcuenta el texto no ASCII (un carácter CJK es más de un token), sobrecuenta un tercio el ASCII y no descuenta lecturas de caché. Se desconoce por qué ocurren esas cancelaciones (con la máquina cargada; llamadas directas en el mismo momento respondieron en un segundo), y los reintentos del adaptador no sirven tras una cancelación por tiempo.
- **A quién afecta.** A todos, sobre todo con la máquina cargada.
- **Cómo evitarlo hoy.** Si ves ese aviso varias veces, compara con la factura y fija un límite de gasto en el proveedor.
- **Evidencia.** EVID, H12 (corregido en parte) y H13 (abierto). REV-3, N-11 (`core/agent-registry.js`, `estimarTokens`).

### G-10 · Con un consumo inválido, cada `continuar` paga una llamada con el libro en cero (abierto, N-06)

- **Qué pasa.** Con un proveedor que nunca informa un consumo válido (NaN, negativo, decimal o ausente) cada llamada se paga y el libro anota 0 USD. El ciclo lo lleva a revisión (`infraestructura`), pero no hay contador de reintentos ni gasto estimado: cada `continuar` humano paga otra llamada y el tope no salta nunca. Requiere una persona en cada vuelta. No es el caso del proveedor real de Anthropic, que informa enteros.
- **A quién afecta.** A quien use un proveedor compatible poco común.
- **Cómo evitarlo hoy.** Límite de gasto en el proveedor; no pulses `continuar` repetidamente ante `infraestructura`.
- **Evidencia.** REV-3, N-06 (`core/ciclo/index.js`, `core/ciclo/presupuesto.js`). PLAN, «Abierto, sin asignar».

---

## 5. Aislamiento

### A-1 · El aislamiento no se ha ejecutado nunca en Linux con Docker real (sin comprobar)

- **Qué pasa.** Todo lo probado con Docker real es en Windows 11 con Docker Desktop. Los jobs `aislamiento` (solo `tests/sandbox-real.test.js`) y `pruebas-docker` (todos los archivos de `tests/` que mencionan `FORGE_TEST_DOCKER`, descubiertos por `grep`: Go, `sandbox.runtime`, medición por mutación, recorrido completo, API, MCP, enlaces en Linux) de la integración continua, que lo probarían en Linux, **no han corrido nunca**: el segundo se añadió el 2026-10-12 y, como el primero, no se puede ejecutar fuera de GitHub Actions.
- **A quién afecta.** Usuarios de Linux, que son el destino habitual de un contenedor.
- **Cómo evitarlo hoy.** En Linux, ejecuta antes `FORGE_TEST_DOCKER=1 npm test` en una copia del repositorio.
- **Evidencia.** PLAN, estado de C2. GUÍA («Linux solo probado sin Docker dentro de Docker»). `.github/workflows/ci.yml` (comprobado el 2026-10-12).

### A-2 · Un contenedor reduce el riesgo; no lo elimina (abierto)

- **Qué pasa.** Comparte el núcleo del sistema con tu equipo. No hay cuota de disco para la copia de trabajo: el límite es el tiempo máximo y 100 MB por archivo.
- **A quién afecta.** A todos.
- **Cómo evitarlo hoy.** No ejecutes el ciclo sobre repositorios que no conoces.
- **Evidencia.** GUÍA, «Aislamiento». `CHANGELOG.md`, 4.3.0, «Sigue abierto».

### A-3 · `sandbox.runtime` solo se ha probado con `runc` (sin comprobar)

- **Qué pasa.** Ningún mecanismo más estricto (gVisor, Kata) se ha probado. No se aplica a la construcción de la imagen con las dependencias. `FORGE_RUNTIMES_PERMITIDOS` autoriza lo que pongas, sin más comprobación.
- **A quién afecta.** Quien configure un mecanismo distinto.
- **Cómo evitarlo hoy.** Pruébalo tú con una tarea trivial antes de fiarte.
- **Evidencia.** PD-V, HU-004 y H-05. PLAN, estado de C11.

### A-4 · La instalación de dependencias usa la red (abierto)

- **Qué pasa.** Las dependencias se instalan una vez, con red, al construir la imagen. En JavaScript, sin scripts de instalación. En Python, `pip` puede ejecutar el `setup.py` de un paquete sin rueda.
- **A quién afecta.** Proyectos Python con dependencias poco conocidas.
- **Cómo evitarlo hoy.** Revisa `requirements.txt` antes de la primera ejecución.
- **Evidencia.** GUÍA, «Aislamiento». REV-2, tabla ASI04.

### A-5 · El modo clásico no aísla nada (abierto)

- **Qué pasa.** `--motor clasico` ejecuta las pruebas, y con ellas el código que escribió un modelo, en tu equipo. Es además la salida que el propio FORGE sugiere cuando no hay Docker.
- **A quién afecta.** A quien no tenga Docker.
- **Cómo evitarlo hoy.** Instala Docker, o usa el modo clásico en una máquina desechable.
- **Evidencia.** `CHANGELOG.md`, guía de migración. Constitución, Principio V.

### A-6 · Otros límites del aislamiento

| Qué pasa | A quién afecta | Cómo evitarlo hoy | Evidencia |
|---|---|---|---|
| Rutas de proyecto con espacios o en una unidad distinta de `C:` no se han probado con el montaje de Docker | Windows | Proyecto en `C:` y sin espacios | GUÍA |
| Go: sin cgo; un proyecto grande puede quedarse sin sitio en `/tmp` (128 MB); probado solo en Windows | Proyectos Go | — | GUÍA |
| Una copia de trabajo que Windows no puede borrar queda en `.sdd/motor/<sesión>/staging/` | Windows | Bórrala a mano cuando FORGE avise | GUÍA, «Aislamiento» |
| La redacción de secretos de la salida de las pruebas cubre formatos comunes, no todos | A todos | No imprimas secretos en las pruebas | GUÍA; PD-V, H-02 |
| Un candado de más de 6 horas se da por abandonado aunque su proceso siga vivo | Ciclos de más de 6 horas | No lances otro mientras dure | GUÍA, «Reanudación» |
| `forge init` no escribe a través de enlaces, pero los enlaces simbólicos **de archivo** no se pudieron crear en Windows para probarlo: se probaron en Linux dentro de Docker | Windows | — | PD-V, H-01 |

---

## 6. Servidor MCP y API HTTP

| Id | Qué pasa | A quién afecta | Cómo evitarlo hoy | Evidencia |
|---|---|---|---|---|
| M-1 | La revisión `2026-07-28` del protocolo solo se ha probado con un cliente escrito por quien escribió el servidor. Un malentendido común de la especificación pasaría las pruebas (sin comprobar) | Clientes que hablen esa revisión | Las revisiones con saludo son las probadas con el cliente oficial | PD-V, CA-002-02; `docs/servidor-mcp.md` |
| M-2 | La prueba con el cliente oficial de las revisiones con saludo no se repitió después de los últimos cambios: se omite si el paquete oficial no está instalado. El 2026-10-10 se omitió | Todos los clientes | — | PD-V, CA-002-03; `docs/COBERTURA.md` |
| M-3 | Cancelar una petición no detiene la herramienta en marcha: `ejecutar_pruebas` y `escribir_archivo` terminan y sus efectos se aplican (abierto; desde 2026-10-12 la herramienta recibe una señal abortada y una cancelación previa al inicio no la ejecuta, pero ninguna herramienta la usa aún) | Clientes que cancelan | No des por deshecho lo cancelado | PD-R, H-09 |
| M-4 | El error `-32022` lista como admitida solo `2026-07-28`; el ejemplo oficial lista más (abierto) | Clientes que negocian por ese campo | — | PD-R, H-12 |
| M-5 | Sin autenticación: el servidor confía en el proceso que lo lanza | Quien lo exponga por otro canal | No lo expongas | `docs/servidor-mcp.md` |
| M-6 | Guarda respaldos de lo que escribe, pero no hay herramienta para restaurarlos | Quien quiera deshacer | Están en `.sdd/motor/mcp-<n>/respaldo/mcp/archivos/` | `docs/servidor-mcp.md` |
| M-7 | No probado con Claude Code ni con otros clientes, ni en Linux con Docker | — | — | `docs/servidor-mcp.md`; `CHANGELOG.md`, 4.3.0 |
| M-8 | El ciclo no usa servidores MCP ajenos (GitHub, GitLab): no hay cliente MCP en los nodos. Las integraciones externas usan REST directo con adaptadores propios (ADR-22), no un cliente MCP | Quien lo espere | — | PLAN, «Abierto»; ADR-12, ADR-15 y ADR-22 |
| M-10 | `initialize` con una versión desconocida o superior a las admitidas (por ejemplo `2026-07-28` con saludo) se contesta con `2025-06-18`, no con la más reciente que el servidor soporta (`2025-11-25`) (abierto) | Clientes que dependen de esa negociación | Pide una revisión de las admitidas | REV-3, N-10; `core/mcp/protocolo.js` (`VERSION_POR_DEFECTO`) |
| M-9 | API HTTP: solo local y de un usuario; sin TLS, sin caducidad del secreto, sin límite de intentos fallidos. No probada con clientes externos ni en Linux | Quien la use desde otro programa | No la expongas fuera de `127.0.0.1` | `docs/api-http.md`, «Límites» |

---

## 7. Plataformas y suite de pruebas de FORGE

### PL-1 · Solo se ha probado en Windows 11 (sin comprobar en lo demás)

- **Qué pasa.** Todo el desarrollo, las ejecuciones reales y las mediciones son de un equipo con Windows 11, Docker Desktop y Node 24.20. Lo único ejecutado en Linux fue dentro de contenedores lanzados desde ese equipo: la suite sin Docker en una imagen Alpine (en 4.3.0, antes de los cambios de 5.0.0) y las pruebas de enlaces de `forge init`. En macOS no se ha ejecutado nada. La matriz de integración continua (Node 20 y 22, en Linux) y los jobs `tipos`, `aislamiento` y `pruebas-docker` no han corrido sobre esta rama.
- **A quién afecta.** Linux, macOS, y Node 20 y 22.
- **Cómo evitarlo hoy.** Ejecuta `npm test` en tu equipo antes de usarlo.
- **Evidencia.** PLAN, estado de C2. Cabeceras de EVID, PC-V, IH-V y PD-V. GUÍA («Linux solo probado sin Docker dentro de Docker»). PD-V, H-01.

### PL-2 · En Windows se omiten pruebas que sí importan (abierto, comprobado el 2026-10-10)

- **Qué pasa.** Con `npm test` en Windows sin Docker se omiten pruebas (10 el 2026-10-10; 12 en la pasada del 2026-10-11, PLAN) y varios bloques enteros. De las 17 omisiones de `tests/*.test.js` contadas el 2026-10-10, 11 piden Docker, 4 piden enlaces simbólicos de archivo (Windows no deja crearlos sin privilegios), 1 comprueba permisos POSIX y 1 pide el cliente oficial de MCP. Las pruebas opt-in de las integraciones con cuentas reales (`FORGE_TEST_INTEGRACIONES`, `FORGE_PRUEBA_GITHUB_REAL`) se omiten siempre.
- **A quién afecta.** A quien lea «0 fallos» como «todo probado».
- **Cómo evitarlo hoy.** `FORGE_TEST_DOCKER=1 npm test` con Docker, y otra pasada en Linux.
- **Evidencia.** `docs/COBERTURA.md`.

### PL-3 · La suite entera con Docker no se ha visto en verde en una sola pasada (abierto)

- **Qué pasa.** La única pasada completa registrada con `FORGE_TEST_DOCKER=1` tuvo un fallo por tiempo (construcción de una imagen de Go con red). Bajo carga han fallado alguna vez pruebas con umbrales de tiempo fijos (`tests/performance.test.js`, tres de ocho pasadas el 2026-10-09) y dos pruebas que esperan a un proceso (`tests/pre-tool-guard.test.js`, `tests/cli-config.test.js`). Ejecutadas solas, pasan. El 2026-10-10, las pasadas sin Docker anotadas en el registro de `RELEASE-CHECKLIST.md` (tres de ellas seguidas) dieron 0 fallos. La tercera revisión (REV-3) vio tres fallos por tiempo y por un reloj saltado con el equipo cargado en `9180814`; no los repitió aislados. Después se estabilizaron pruebas frágiles (`139d59c`) y la pasada del 2026-10-11 anotada en PLAN dio 2202 de 2214 con 0 fallos y 12 omitidas. INT-V (§8.5) anota 2468 pruebas, 2456 pasan, 0 fallan y 12 omitidas, con las pruebas de Jira y antes de las de GitHub y del contrato común. **No hay una pasada completa registrada sobre `82815b4`.**
- **A quién afecta.** A quien contribuya, y a la integración continua.
- **Cómo evitarlo hoy.** Repite la pasada con el equipo sin carga antes de buscar un fallo.
- **Evidencia.** PD-V, «Ejecución de las pruebas». PC-V, «Pruebas ejecutadas». IH-V. PLAN, «Verificación», primer punto.

### PL-4 · El job de tipos de la integración continua no ha corrido (sin comprobar)

- **Qué pasa.** `npm run typecheck` termina con **0 errores** (TypeScript 6.0.3; comprobado el 2026-10-12 en `82815b4`; eran 36 el 2026-10-10). El job `tipos` de `ci.yml`, que lo ejecuta en Node 22, se añadió el 2026-10-12 y no ha corrido. `npm run build` sigue siendo un `echo` y no comprueba nada.
- **A quién afecta.** A quien contribuya: sin ese job, una regresión de tipos no la detectaría nadie.
- **Cómo evitarlo hoy.** Ejecuta `npm run typecheck` antes de proponer un cambio.
- **Evidencia.** `.github/workflows/ci.yml`. `package.json`. PLAN, «Cerrado en esta tanda».

### PL-5 · `npx forge` sin instalar descarga otro paquete (abierto)

- **Qué pasa.** El paquete se llama `forja-mvp` y el comando, `forge`. En npm existe otro paquete llamado `forge`.
- **A quién afecta.** A quien copie `npx forge …` sin haber instalado antes.
- **Cómo evitarlo hoy.** `npm install -g forja-mvp`, o `npx -p forja-mvp forge <comando>`.
- **Evidencia.** `README.md`, «Inicio rápido». `tests/empaquetado.test.js`.

---

## 8. Documentos que se contradicen

Encontrados al reunir este documento. **El 2026-10-12 se corrigieron en su sitio todos los puramente documentales** (la lista, en la sección 10); aquí quedan los que no lo son. Se listan para que nadie se apoye en la frase desfasada.

| Dónde | Qué dice | Qué es cierto hoy | Evidencia |
|---|---|---|---|
| `.sdd/memoria/constitucion.md`, razón del Principio IV | «El paquete tiene dos dependencias» | Tiene **tres** desde que `@anthropic-ai/sdk` pasó a `dependencies` (`@anthropic-ai/sdk`, `@sqlite.org/sqlite-wasm` y `acorn`). **No se ha editado: la constitución es decisión del dueño (Principio II)**; la corrección es una enmienda PATCH de la razón, sin tocar el principio | `package.json`, `dependencies` |
| `docs/ESTADO-IMPLEMENTACION.md` | Describe 4.3.0 entero | Solo se pusieron al día sus cifras y la fila del ciclo verificado; el resto del documento sigue siendo el estado de 4.3.0, como avisa su cabecera | Aviso al comienzo de ese archivo |
| `.sdd/especificaciones/2026-10-03-herramientas-mcp/verificacion.md` | Cabecera: «sin verificación independiente todavía» | `CHANGELOG.md` (4.3.0, «Corregido tras la tercera ronda») dice que el MCP tuvo verificación independiente, aprobada con observaciones. No se ha podido comprobar cuál de las dos describe la carpeta, porque no guarda ese informe | `CHANGELOG.md`; esa cabecera |

## 9. Integraciones externas (en construcción)

Guía completa: [integraciones-externas.md](integraciones-externas.md). Spec `2026-10-11-integraciones-externas` (en implementación por instrucción del dueño, **pendiente de ratificación**) y ADR-22. Todo es opcional y está **apagado por defecto**.

### I-1 · Ninguna integración se ha ejecutado contra una plataforma real (sin comprobar)

- **Qué pasa.** Los tres adaptadores (GitHub, GitLab y Jira Cloud) se probaron contra servidores HTTP falsos locales cuyas respuestas son ejemplos de `spikes/contratos-respuesta.md`, no capturas. Las pruebas con cuentas reales (`FORGE_TEST_INTEGRACIONES=1`, `FORGE_PRUEBA_GITHUB_REAL=1`) están escritas y **no se han ejecutado**. Siguen sin confirmar: los cuerpos de la API Git Data de GitHub, si `draft: true` funciona en un repositorio privado de plan gratuito, el parámetro `draft` de GitLab (el adaptador usa el prefijo `Draft:` y rechaza una respuesta no marcada), el rol mínimo de GitLab para comentar, los ámbitos por endpoint, y si Jira acepta el cuerpo mínimo de un comentario.
- **A quién afecta.** A quien active una integración.
- **Cómo evitarlo hoy.** Empieza con `solo_lectura`, un destino de prueba y un token de alcance mínimo.
- **Evidencia.** INT-V, secciones 7 a 9. INT-S, «sin confirmar».

### I-2 · La publicación, la aprobación y la línea de comandos no existen todavía (en construcción)

- **Qué pasa.** Están hechos el núcleo (configuración, capa de confianza, cliente HTTP, auditoría) y los tres adaptadores. **Faltan** la cola de pendientes con vista previa y aprobación (F3), el comando `forge integraciones` y las comprobaciones de `forge doctor` y `forge status` (F4), y la prueba de no filtración, la prueba de que ningún camino lleva del modelo a la red y la revisión independiente (F5). Hoy ningún comando usa estos módulos.
- **A quién afecta.** A quien lea la spec creyendo que ya se puede usar.
- **Cómo evitarlo hoy.** No se puede activar desde la línea de comandos; no hay nada que evitar. No cuentes con esto para una publicación.
- **Evidencia.** `tareas.md`, F3 a F5.

### I-3 · El alcance del token no se puede comprobar en GitHub ni en Jira (abierto)

- **Qué pasa.** Ninguna de las dos APIs documentadas informa de lo que un token puede hacer; `comprobarAlcance` devuelve `no_comprobable`. Solo GitLab con token personal lo informa. El control real es el modo y la lista cerrada de destinos. En Jira, `write:jira-work` es mucho más amplio que «comentar» y la API no tiene un permiso más estrecho que «Add comments» a nivel de proyecto. Solo se admite token sin ámbitos contra `<sitio>.atlassian.net`.
- **A quién afecta.** A quien use GitHub o Jira.
- **Cómo evitarlo hoy.** Token de grano fino por repositorio (GitHub) o usuario de servicio con acceso solo a los proyectos permitidos (Jira, GitLab Free).
- **Evidencia.** INT-S, `permisos-minimos.md` secciones 1.5, 2.6 y 3.5.

### I-4 · Otros límites de las integraciones (abierto)

| Qué pasa | A quién afecta | Cómo evitarlo hoy | Evidencia |
|---|---|---|---|
| El cliente valida el nombre del host, no la dirección a la que resuelve: un nombre de la lista que apunte a una IP interna llegaría a ella | Redes con DNS no confiable | Lista de hosts mínima | INT-V, §5 |
| El apagado (`FORGE_INTEGRACIONES=apagado`) detiene lo que venga después, no una petición ya enviada | Contención de un incidente | Revoca el token | INT-V, §5 |
| El contador de operaciones no tiene candado: dos procesos a la vez pueden pasarse del tope por una unidad; y vale por sesión solo si quien llama pasa el identificador de sesión (nadie lo pasa todavía) | Uso concurrente | Tope bajo | INT-V, §5 |
| El texto de la plataforma se neutraliza, no se «detecta»: puede seguir pidiendo cosas; no puede parecer una instrucción de FORGE ni traer enlaces activos. Se pierden los caracteres de formato y las cabeceras markdown se reescriben | Quien espere un filtro | Revisa lo que el ciclo hace con una incidencia ajena | INT-V, §5 |
| Quien pueda comentar puede pegar el marcador de idempotencia y hacer que FORGE **omita** una publicación (no puede falsearla ni duplicarla) | Repositorios con colaboradores no confiables | — | INT-V, §7, §8.4, §9 |
| Con más de 1000 comentarios (GitHub, Jira) o 500 notas (GitLab) la lectura devuelve los primeros sin avisar en el elemento, y publicar se niega | Incidencias enormes | — | INT-V, §7 a §9 |
| GitHub: máximo 20 archivos y 1 MiB por propuesta, todos con modo `100644`; `.github/workflows/` rechazado. GitLab: no distingue `.gitlab-ci.yml`, y una solicitud en borrador que lo cambie ejecuta pipelines en la rama (filtro pendiente en F3.2) | Quien use `proponer` | Revisa la rama antes de que corra CI | INT-V, §7 y §9 |
| Jira: las marcas del formato (negrita, código…) se pierden salvo el enlace; un 403 por falta de permiso solo se descubre al publicar | Quien use Jira | — | INT-V, §8.4 |
| Un revisor que apruebe sin leer anula la barrera de aprobación | A todos | Leer la vista previa; el borrador de la plataforma es la segunda barrera | `plan.md`, «Riesgos del plan» |

---

## 10. Corregido desde el 2026-10-10 (ya no es un problema)

Estas entradas estaban en la versión del 2026-10-10 de este documento, o eran hallazgos abiertos de las revisiones, y se corrigieron. Cada una dice dónde está la prueba. «Corregido» significa que la reproducción original dejó de reproducirse; no significa revisión independiente de la corrección (ver «Antes de nada», 5).

**Tercera revisión (REV-3), hallazgos N-01 a N-14**

| Id | Qué era | Corregido en | Prueba |
|---|---|---|---|
| N-01 | La intención del diario daba por aplicada una edición que no se había aplicado si el archivo cambiaba entre el corte y la reanudación | `1aaf169` (la intención lleva la huella de después) | `tests/revision3-correcciones.test.js` |
| N-03 | El limpiador de secretos corrompía código corriente (`auth: true`, `const token = …`) | `1aaf169` (redacta solo por formato) | `tests/revision3-correcciones.test.js` |
| N-04 | `update --global`, `init --global --template` e `init --global --ui` no escribían y decían que sí | `f70e641` (raíz por destino; sin éxito si faltó algo) | `tests/escritura-global.test.js` |
| N-05 | «Borrar y recrear» perdía el archivo si el proceso moría en medio | `f70e641` (temporal y `rename`) | `tests/escritura-global.test.js` |
| N-07 | `init` leía a través de enlaces (contenido ajeno acababa en `AGENTS.md`) | `f70e641` | `tests/escritura-global.test.js` |
| N-08 | Un proyecto abierto a través de una unión no recibía `CLAUDE.md`, `AGENTS.md` ni `.claudeignore` | `f70e641` | `tests/escritura-global.test.js` |
| N-09 | El reconocimiento de «fallo de prueba» por texto dependía del reporter | `27ea407` (mutación con salidas reales) | `tests/mutacion-salidas-reales.test.js` |
| N-12 | El barrido de huérfanos borraba una carpeta con marca puesta a mano | `27ea407` (`marcaValida`) | `tests/mutacion-revision.test.js` |
| N-13 | `init` acababa con una traza ante destinos raros (directorio, archivo, tubería) | `f70e641` | `tests/escritura-global.test.js` |
| N-14 | `init --global` con `~/.claude/commands` como unión a los dotfiles no instalaba nada | `f70e641` (solo en lo global, por decisión explícita y avisándolo; en un proyecto no se sigue ningún enlace) | `tests/escritura-global.test.js` |

**Cuarta revisión (REV-4), hallazgos N4-03 a N4-09** (los N4-01, N4-02, N4-06 y N4-10 los lleva otra tarea)

| Id | Qué era | Estado | Prueba |
|---|---|---|---|
| N4-03 | `redactarFormatos` dejaba pasar 17 de 24 secretos realistas en código | **Mitigado**: regla por valor (nombre de secreto Y literal largo, sin espacios, con 3 clases de caracteres o hexadecimal largo) y contraseñas de cadenas de conexión (`password=`/`Pwd=` tras otro par, `redis://:clave@`, `Authorization: Basic`). Sigue sin cubrir contraseñas cortas o de una sola clase (`"supersecret"`); no es una frontera | `tests/revision4-correcciones.test.js` (20 secretos, 20 códigos legítimos) |
| N4-04 | El cuerpo de una clave privada llegaba al modelo por tramo, sin `END` o con `buscar` | **Corregido** en `leer_archivo` y `buscar`: se oculta sobre el archivo entero, antes del tramo | `tests/revision4-correcciones.test.js` |
| N4-05 | Un archivo con BOM perdía el BOM al editarse y tras un corte se informaba «no se sabe» | **Corregido**: un solo decodificador que conserva el BOM | `tests/revision4-correcciones.test.js` |
| N4-07 | Un corte durante `escribirArchivo` dejaba temporales `.forge-tmp-*` | **Mitigado**: se barren al escribir en ese directorio si tienen más de 1 h y nombre exacto; entre medias siguen ahí y no están en `.gitignore` | `tests/revision4-correcciones.test.js` |
| N4-08 | `import`, `export` y `runner` escribían directo, a través de enlaces | **Corregido**: pasan por `escritura-segura`; prueba estática que impide volver a escribir directo en `cli/` | `tests/revision4-correcciones.test.js` |
| N4-09 | `editar` rechazaba cualquier texto con `[REDACTADO`, aunque fuera contenido del archivo | **Corregido**: se permite lo que el archivo ya contiene; los marcadores nuevos siguen rechazados | `tests/revision4-correcciones.test.js` |

**Siguen abiertos de esa revisión:** N-02 (P-10), N-06 (G-10), N-10 (M-10) y N-11 (G-9).

**Hallazgos de las ejecuciones con un modelo real (EVID, H1 a H14)**

| Id | Estado | Detalle |
|---|---|---|
| H1, H2, H4, H6, H7, H8 | Corregidos | pytest declarado fuera de `requirements.txt`; código 5 sin gastar iteraciones; `motor.nivel_maximo`; sección «Proyecto» en los prompts; «Tu implementación actual» al corregir; «sin progreso» |
| H3 | Mitigado | Los contratos piden no devolver las pruebas ni escribir la implementación; el agente de pruebas aún lo intenta a veces |
| H5 | Corregido en parte | Precios contrastados con la tarifa publicada; falta contrastarlos con una factura (G-1, G-2) |
| H11 | Corregido | La medición por mutación se limita a las líneas que la tarea cambió (`tests/mutacion-lineas-cambiadas.test.js`) |
| H12 | Corregido en parte | Se anota una estimación de la entrada de una llamada cancelada; la salida no (G-9) |
| H9, H10, H13, H14 | Abiertos | C-16, C-1, G-9 y G-5 |

**Otros**

- La lista de archivos del mapa descartaba los nombres con acentos u otros alfabetos (REV-2, N8): corregido (`nombreListable`).
- Las contradicciones puramente documentales de la sección 8 de la versión del 2026-10-10: `docs/ciclo-verificado.md` (pasos 3 y 4 repetidos, tres entradas duplicadas de «Límites conocidos», el límite de pytest, la frase «todavía no se ha ejecutado con un modelo de pago» y la medición del ahorro de caché), `docs/servidor-mcp.md` (decía que no cubría Go), `CHANGELOG.md` 4.3.0 (dos afirmaciones opuestas sobre la revisión de la API), `docs/roadmap.md`, `docs/ESTADO-IMPLEMENTACION.md`, `docs/0-INDICE.md` (enlaces a archivos que no existen o con otra capitalización: rotos en Linux), `VERSIONING.md` (nombre antiguo del paquete, `sdd-es`) y `docs-site/assets/data.js` (decía que 6 agentes son de solo lectura y 8 escriben; son 7 y 7).
- La comprobación de tipos: de 36 errores a 0 (PL-4).
- `forge config set` y `forge aprobar` escriben por el módulo de escritura segura.
- Pruebas frágiles estabilizadas (`docker info`, rendimiento, doctor).


## Integraciones externas: revisión de seguridad 1 (2026-10-12)

- **Corregido**: R1 a R15 (ver `verificacion.md` de la especificación de integraciones). Para usar un GitLab autoalojado o Jira hay que definir `FORGE_INTEGRACIONES_HOSTS` en tu entorno; las variables de token deben llamarse `FORGE_*`.
- **Sigue abierto**: no hay segunda revisión independiente; HTTPS real, DNS y proxies no se han probado (solo servidores falsos); el recuento atómico se probó en Windows; la lista de rutas vetadas puede dar falsos positivos (`docs/.github/`).