# Problemas conocidos

> Fecha: **2026-10-10**. Describe la rama `feature/motor-agentico` en el commit `9180814`. La versión 5.0.0 **no está publicada**.
> Reúne los límites que estaban repartidos por las verificaciones y revisiones del 2026-10-09, más los que se comprobaron al escribir este documento (marcados «comprobado el 2026-10-10»).
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
| PLAN | `PLAN-CIERRE-BRECHAS.md`, secciones «Estado de ejecución» y «Pendiente para las próximas sesiones» |

## Antes de nada

1. **El aislamiento solo se ha probado en Windows con Docker Desktop.** En Linux con Docker real no se ha ejecutado nunca (A-1).
2. **El gasto que muestra FORGE nunca se ha comparado con una factura** (G-1).
3. **Las pruebas que pasan no demuestran que el código sea correcto.** Con el valor por defecto, unas pruebas que no comprueban resultados terminan en éxito (P-1), y un implementador puede falsear un pase (C-2). Revisa el diff y ejecuta las pruebas tú.
4. **Toda la evidencia con un modelo real son unas veinte ejecuciones de tareas pequeñas en un día**, con un solo proveedor (EVID enumera 20; PLAN dice 21).
5. **Las correcciones de la última tanda no tienen revisión independiente** (PLAN, «Verificación»).

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

- **Qué pasa.** Se rechazan los nombres habituales (`.env*`, `.npmrc`, `.yarnrc*`, `id_rsa*`, `*.pem`, `.config/`, `secrets/`…). Un secreto en un archivo con un nombre inesperado se lee, se copia al contenedor y **se envía al proveedor del modelo**. El modo por turnos pasa además lo leído por un limpiador de formatos conocidos, que no los cubre todos.
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

- **Qué pasa.** La lista de archivos descarta los nombres con letras no ASCII (`señal.py`, `módulo.py`), se corta en 200 entradas y, con más de 3000 archivos, deja carpetas enteras fuera sin avisar. El texto del repositorio (nombres de archivo, nombres de dependencia, `scripts.test`) entra en el prompt sin separar datos de instrucciones. Los nombres con letras no ASCII y el tope de 256 KiB para `package.json` y `go.mod` se corrigieron el 2026-10-12 (quedan el corte en 200 entradas y las carpetas fuera con más de 3000 archivos).
- **A quién afecta.** Proyectos grandes, proyectos con nombres en español, y quien ejecute el ciclo sobre un repositorio ajeno.
- **Cómo evitarlo hoy.** Nombra en la tarea los archivos que importan. No ejecutes el ciclo sobre un repositorio que no conoces.
- **Evidencia.** REV-2, N8, N9, N6 y tabla ASI01/ASI07. PLAN, «Abierto». La expresión que descarta los nombres está en `core/ciclo/nodos.js` (`seccionMapa`), comprobada el 2026-10-10. Ningún efecto de esto se ha probado con un modelo real.

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

- **Qué pasa.** Con Docker real solo se midió en JavaScript y en Go. Los formatos de salida de pytest, unittest, jest y vitest se reconocen con patrones escritos de memoria, no capturados de esas herramientas. Si un formato no se reconoce, el cambio queda como «no concluyente» (se pierde señal; no se infla).
- **A quién afecta.** Proyectos en Python y TypeScript.
- **Cómo evitarlo hoy.** No uses `exigir` en esos lenguajes hasta que se mida.
- **Evidencia.** PC-V, «Lo que no se ha hecho… en esta pasada». PLAN, estado de C6 y «Verificación».

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
- **Evidencia.** EVID, ronda 7. PD-V, «Pendiente: medir el ahorro real». PLAN, 9.1.

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

---

## 5. Aislamiento

### A-1 · El aislamiento no se ha ejecutado nunca en Linux con Docker real (sin comprobar)

- **Qué pasa.** Todo lo probado con Docker real es en Windows 11 con Docker Desktop. El job `aislamiento` de la integración continua, que lo probaría en Linux, **no ha corrido nunca**. Y cuando corra solo ejecuta `tests/sandbox-real.test.js`: las demás pruebas que piden Docker (Go, `sandbox.runtime`, medición por mutación, recorrido completo, API, MCP, enlaces en Linux) no las ejecuta ningún job.
- **A quién afecta.** Usuarios de Linux, que son el destino habitual de un contenedor.
- **Cómo evitarlo hoy.** En Linux, ejecuta antes `FORGE_TEST_DOCKER=1 npm test` en una copia del repositorio.
- **Evidencia.** PLAN, estado de C2. GUÍA («Linux solo probado sin Docker dentro de Docker»). `.github/workflows/ci.yml` (comprobado el 2026-10-10).

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
| M-8 | El ciclo no usa servidores MCP ajenos (GitHub, GitLab): no hay cliente MCP en los nodos | Quien lo espere | — | PLAN, «Abierto»; ADR-12 y ADR-15 |
| M-9 | API HTTP: solo local y de un usuario; sin TLS, sin caducidad del secreto, sin límite de intentos fallidos. No probada con clientes externos ni en Linux | Quien la use desde otro programa | No la expongas fuera de `127.0.0.1` | `docs/api-http.md`, «Límites» |

---

## 7. Plataformas y suite de pruebas de FORGE

### PL-1 · Solo se ha probado en Windows 11 (sin comprobar en lo demás)

- **Qué pasa.** Todo el desarrollo, las ejecuciones reales y las mediciones son de un equipo con Windows 11, Docker Desktop y Node 24.20. Lo único ejecutado en Linux fue dentro de contenedores lanzados desde ese equipo: la suite sin Docker en una imagen Alpine (en 4.3.0, antes de los cambios de 5.0.0) y las pruebas de enlaces de `forge init`. En macOS no se ha ejecutado nada. La matriz de integración continua (Node 20 y 22, en Linux) no ha corrido sobre esta rama.
- **A quién afecta.** Linux, macOS, y Node 20 y 22.
- **Cómo evitarlo hoy.** Ejecuta `npm test` en tu equipo antes de usarlo.
- **Evidencia.** PLAN, estado de C2. Cabeceras de EVID, PC-V, IH-V y PD-V. GUÍA («Linux solo probado sin Docker dentro de Docker»). PD-V, H-01.

### PL-2 · En Windows se omiten pruebas que sí importan (abierto, comprobado el 2026-10-10)

- **Qué pasa.** Con `npm test` en Windows sin Docker se omiten 10 pruebas y varios bloques enteros. De las 17 omisiones de `tests/*.test.js`, 11 piden Docker, 4 piden enlaces simbólicos de archivo (Windows no deja crearlos sin privilegios), 1 comprueba permisos POSIX y 1 pide el cliente oficial de MCP.
- **A quién afecta.** A quien lea «0 fallos» como «todo probado».
- **Cómo evitarlo hoy.** `FORGE_TEST_DOCKER=1 npm test` con Docker, y otra pasada en Linux.
- **Evidencia.** `docs/COBERTURA.md`.

### PL-3 · La suite entera con Docker no se ha visto en verde en una sola pasada (abierto)

- **Qué pasa.** La única pasada completa registrada con `FORGE_TEST_DOCKER=1` tuvo un fallo por tiempo (construcción de una imagen de Go con red). Bajo carga han fallado alguna vez pruebas con umbrales de tiempo fijos (`tests/performance.test.js`, tres de ocho pasadas el 2026-10-09) y dos pruebas que esperan a un proceso (`tests/pre-tool-guard.test.js`, `tests/cli-config.test.js`). Ejecutadas solas, pasan. El 2026-10-10, las pasadas sin Docker anotadas en el registro de `RELEASE-CHECKLIST.md` (tres de ellas seguidas) dieron 0 fallos.
- **A quién afecta.** A quien contribuya, y a la integración continua.
- **Cómo evitarlo hoy.** Repite la pasada con el equipo sin carga antes de buscar un fallo.
- **Evidencia.** PD-V, «Ejecución de las pruebas». PC-V, «Pruebas ejecutadas». IH-V. PLAN, «Verificación», primer punto.

### PL-4 · La comprobación de tipos no pasa (abierto, comprobado el 2026-10-10)

- **Qué pasa.** `npm run typecheck` termina con error: 36 errores en 14 archivos de `core/` (TypeScript 6.0.3). `npm run build` es un `echo` y no comprueba nada. Ningún job de integración continua ejecuta la comprobación de tipos.
- **A quién afecta.** A quien contribuya.
- **Cómo evitarlo hoy.** Compara el número de errores antes y después de tu cambio.
- **Evidencia.** Salida de `npm run typecheck` sobre `9180814`. `package.json`. `.github/workflows/ci.yml`. PD-V y PC-V ya lo anotaban.

### PL-5 · `npx forge` sin instalar descarga otro paquete (abierto)

- **Qué pasa.** El paquete se llama `forja-mvp` y el comando, `forge`. En npm existe otro paquete llamado `forge`.
- **A quién afecta.** A quien copie `npx forge …` sin haber instalado antes.
- **Cómo evitarlo hoy.** `npm install -g forja-mvp`, o `npx -p forja-mvp forge <comando>`.
- **Evidencia.** `README.md`, «Inicio rápido». `tests/empaquetado.test.js`.

---

## 8. Documentos que se contradicen

Encontrados al reunir este documento. No se han corregido en su sitio; se listan para que nadie se apoye en la frase desfasada.

| Dónde | Qué dice | Qué es cierto hoy | Evidencia |
|---|---|---|---|
| `docs/ciclo-verificado.md`, «Implementador por turnos» y «Probarlo con un modelo real»; `CHANGELOG.md`, 5.0.0 | El modo por turnos está «sin probar con un modelo real» y «no usa caché de prompts» | Se ejecutó con un modelo real en dos ocasiones y usa la caché: `conversar` marca el prompt de sistema y el final de la conversación | EVID, rondas 6 y 7; `core/llm-providers/anthropic-provider.js:159-164`. La propia guía lo dice bien en «Límites conocidos» salvo lo de la caché |
| `docs/ciclo-verificado.md`, «Reanudación» | Si el proceso muere entre que una acción por turnos escribe y que su resultado se anota, la acción se repite | Desde `90596cb` se anota antes la huella del archivo y la acción no se repite si ya se aplicó | `core/ciclo/turnos.js:250-259` |
| `docs/ciclo-verificado.md`, «Límites conocidos» | Dos entradas aparecen dos veces con textos distintos. La primera versión de una dice que unas pruebas que pasan sin implementación dejan «un aviso… pero no se bloquea»; la primera de la otra, que `jest.setup.js` y `__mocks__/` no exigen revisión. En «Qué hace con cada tarea», los pasos 3 y 4 también están repetidos | Se bloquean (`pruebas_no_fallan`) y sí la exigen, como dicen las segundas versiones | La misma sección; comprobado el 2026-10-10 con `validarRuta` |
| `docs/ciclo-verificado.md`, «Límites conocidos» | «Proyectos sin `pytest`… las pruebas fallarán en todas las iteraciones hasta el tope» | Con pytest sin declarar el ciclo ya no empieza, o se pausa sin gastar iteraciones | `core/pytest-deteccion.js`; REV-2, N10 |
| `docs/ciclo-verificado.md`, «Rutas rechazadas de más» | «Un agente no podrá escribir `src/secret-santa.js`» | Se acepta: solo se vetan esos nombres con extensión de datos | Comprobado el 2026-10-10 con `validarRuta` |
| `docs/ciclo-verificado.md` (línea 345) y `CHANGELOG.md` | «17 ejecuciones» y «ocho tareas pequeñas» con un modelo real | La evidencia enumera 20 ejecuciones; el plan dice 21 | EVID (su cabecera aún dice «ocho»); PLAN, estado de C1 |
| `docs/servidor-mcp.md`, «Requisitos y comportamiento» | «Proyectos en JavaScript/TypeScript o Python (los mismos que el ciclo)» | El ciclo cubre también Go, y el servidor usa la misma comprobación | `core/mcp/servidor.js:47-48` |
| `CHANGELOG.md`, 4.3.0, «API HTTP local» | «Sin revisión independiente ni de seguridad» | Más abajo, la misma sección dice que la API y el MCP tuvieron verificación independiente, aprobadas con observaciones | `CHANGELOG.md`, «Corregido tras la tercera ronda…» |
| `.sdd/memoria/constitucion.md`, razón del Principio IV | «El paquete tiene dos dependencias» | Tiene tres desde que `@anthropic-ai/sdk` pasó a `dependencies` | `package.json` |
| `.sdd/especificaciones/2026-10-09-implementador-con-herramientas/verificacion.md` | No recoge las correcciones H-01 a H-04 de su revisión independiente | Están en el commit `90596cb`, con pruebas | `git show 90596cb` |
| `docs/roadmap.md` | La memoria semántica (con LanceDB) está «no empezada» y `forge probar-modelo` «sin ejecutar con uno de pago» | La memoria semántica se hizo con un índice propio (ADR-14; LanceDB quedó diferido) y `probar-modelo` se ejecutó el 2026-10-09 | `CHANGELOG.md`, 4.3.0 y 5.0.0; EVID, ejecución 17 |
| `docs/ESTADO-IMPLEMENTACION.md` | Describe 4.3.0 y dice que el ciclo está «sin probar con un modelo de pago» | Ver la fila anterior. Solo se pusieron al día sus cifras | Aviso al comienzo de ese archivo |
