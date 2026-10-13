# ADR-20: Rojo obligatorio y medición de las pruebas por mutación propia, sin dependencias

> Estado: aceptada  # propuesta | aceptada | obsoleta | reemplazada-por-ADR-XX
> Fecha: 2026-10-09 (aceptada el 2026-10-09, por delegación del dueño)
> Spec relacionada: 2026-10-09-pruebas-confiables
> Autor: Claude (pendiente de aceptación por el dueño)

## Contexto

El ciclo aprueba por código de salida (ADR-05). `core/ciclo/sospecha.js` evita los falsos pases más burdos: salida sin ninguna prueba pasada, proceso cortado al cargar, menos pruebas informadas que escritas. No mide si las pruebas comprueban algo. Dos huecos concretos:

- Si las pruebas recién escritas pasan sin implementación, el nodo `qa` solo deja un aviso (`pruebas_no_fallan`) y sigue.
- Unas pruebas que ejecutan el código sin comprobar su resultado pasan igual que unas buenas.

La forma habitual de medir lo segundo es alterar el código a propósito y ver si las pruebas lo notan (pruebas de mutación). Las herramientas existentes son una por lenguaje, pesadas, y varias necesitan red para instalarse; el ciclo cubre tres lenguajes y ejecuta sin red (ADR-03).

## Decisión

Se añaden al grafo dos comprobaciones deterministas, hechas con código propio:

1. **Rojo obligatorio.** Tras `qa`, si las pruebas pasan sin implementación, `qa` se repite una vez con ese resultado; si vuelven a pasar, la tarea va a revisión humana con motivo `pruebas_no_fallan`. Una tarea puede declararse exenta.
2. **Mutación propia.** Tras un pase, un módulo nuevo (`core/ciclo/mutacion.js`) genera alteraciones de los archivos que escribió el implementador y ejecuta las pruebas contra cada una con el `SandboxRunner` actual, sobre la copia de trabajo, nunca sobre el proyecto.
   - Operadores: invertir una comparación, cambiar una constante numérica o booleana, negar una condición, sustituir un valor devuelto.
   - En JavaScript y TypeScript las posiciones se localizan con `acorn`, que ya es dependencia. En Python y Go, con patrones de texto acotados a esos cuatro operadores.
   - Selección por reglas fijas (orden de archivo y de posición, con salto uniforme hasta el tope): misma entrada, mismas alteraciones.
   - Tope por defecto: 10 alteraciones y 5 minutos por tarea.
3. **Tres modos**, `motor.mutacion: no | informar | exigir`, con `informar` por defecto. Solo `exigir` cambia la ruta: bajo el umbral, una ronda de refuerzo de `qa` con la lista de alteraciones no detectadas y, si no basta, revisión humana con motivo `pruebas_debiles`.

El router recibe dos motivos nuevos y una ruta nueva (`refuerzo`). Sigue decidiendo por código de salida, puntuación y estado de control (Principio VI).

**Ajustes al implementar (2026-10-09).**

- La medición es un nodo propio del grafo, `mutacion`, entre `sandbox` y el final, y el refuerzo es otro, `refuerzo`. Un nodo propio tiene su punto de guardado (el resultado no se repite al reanudar), su evento `ciclo:nodo_completado` con la duración, y deja el nodo `sandbox` y la función `decidirRuta` como estaban. La decisión posterior es una función pura aparte, `decidirTrasMutacion`.
- La alteración no se aplica sobre la copia de trabajo del `SandboxRunner`, sino sobre una copia temporal propia del proyecto (creada con la misma función y los mismos vetos); el `SandboxRunner` se usa sin cambios y hace de ella su copia de siempre. Es una copia más por medición, a cambio de no tocar el código de aislamiento.
- El rojo obligatorio no es una arista nueva: el reintento ocurre dentro del nodo `qa`, así que no hace falta la ruta `refuerzo` para él. El router no cambia para HU-001; la pausa la pide el propio nodo, como ya hacían `salida_invalida` y `dependencias`.
- TypeScript: si `acorn` no puede analizar el archivo (sintaxis de tipos), se usan los patrones de texto. JavaScript que `acorn` no entiende no se altera.
- En Go, el valor devuelto solo se sustituye si es `true` o `false`: sin conocer el tipo, cualquier otra sustitución no compilaría y contaría como detectada.
- Se guarda el avance de la medición (resultado de cada alteración probada) fuera del punto de guardado, en `.sdd/motor/<sesión>/mutacion/`, para que un corte no obligue a repetirla entera.
- Queda sin hacer la consecuencia neutral sobre `skills/mutation-detector` (renombrar o aclarar).

## Correcciones tras la revisión independiente (2026-10-09)

La revisión (`.sdd/especificaciones/2026-10-09-pruebas-confiables/revision-independiente.md`) encontró que «cualquier fallo = detectada» no es una medida fiable. Decisiones:

- **Alteraciones concluyentes y no concluyentes (H-02, H-03, H-11).** Cada ejecución con una alteración se juzga por la salida del ejecutor: *detectada* si informa del fallo de una prueba con nombre propio (TAP/spec de node:test donde el nombre no es un archivo, `●`/`Tests: N failed` de jest, `FAIL … >` de vitest, `FAILED`/`FAIL:` de pytest y unittest, `--- FAIL:` y `panic:` de Go) o si agotó el tiempo; *sobrevive* si pasa; *no concluyente* en cualquier otro caso (error de compilación o de sintaxis, módulo que no carga, sin señal reconocible, código 137 o 139). Las no concluyentes quedan fuera del denominador y las sustituye una reserva ordenada de hasta `mutacion_max` alteraciones más, de modo que la misma entrada da la misma medición. Se eligió reconocer la salida, y no validar antes con `go build`/`py_compile`/`tsc`, porque no añade contenedores ni dependencias y funciona igual para cualquier ejecutor; el precio es que una salida no reconocida se descarta (se pierde señal, nunca se infla). Esto lee el texto de la salida, pero solo para decidir qué *cuenta como medición*, no la ruta del ciclo: la decisión del router sigue dependiendo de números (puntuación, mínimo, concluyentes, refuerzos), sin cambio para el Principio VI.
- **Reparto por archivo (H-02).** `seleccionarPorArchivo` reparte el tope por rondas entre los archivos y, dentro de cada uno, con salto uniforme.
- **Mínimo de concluyentes (H-04).** Clave nueva `motor.mutacion_min_concluyentes` (3). Con `exigir`, por debajo o sin puntuación, o con entorno o línea base en rojo, se pide revisión humana (`pruebas_debiles` con `insuficiente`, o `infraestructura`); nunca éxito. Con `informar` nada cambia. Cambia el comportamiento de `exigir` ante «nada que alterar», que antes daba éxito.
- **Línea base (H-05).** Se ejecuta la copia sin alterar; si no pasa, no se mide (`motivoParcial: linea_base`). 137 y 139 son entorno: en la línea base cortan la medición; en una alteración, la hacen no concluyente. **Tiempo agotado:** cuenta como detectado solo si el ejecutor lo clasifica como tiempo de pruebas (`timedOut` sin error de entorno); la línea base ya demostró que terminan a tiempo.
- **Copia privada (H-06).** Carpeta madre `forge-mutacion-XXXXXX` (0700, con archivo de marca) y la copia dentro con permisos 0700/0600 (`crearCopia` con `privada`). El `SandboxRunner` hace su propia copia abierta para el contenedor, así que la nuestra no necesita permisos abiertos. Barrido al empezar de carpetas con nombre exacto, marca, sin enlace y de más de 6 horas.
- **Rutas y secretos (H-08, H-09).** `medirMutacion` valida con `validarRuta`; `antes`/`despues` se redactan antes de recortar.
- **Visibilidad de la exención (H-07).** `forge status` cuenta y lista las tareas con `parte_de_codigo_existente` (el registro ya anotaba cada exención aplicada). No se impide la exención: la declara quien define la tarea.
- **Abierto.** No se descartan archivos que las pruebas no llaman (cobertura); un implementador que detecte el entorno de medición puede seguir sesgándola; Python/TypeScript no se midieron con Docker real; el reconocimiento de salida cubre node:test, jest, vitest, pytest, unittest y go test (otros ejecutores caen en «no concluyente»).

## Cobertura, tope de archivos y límite de la garantía (N-02 de la tercera revisión; N4-01, N4-02 y N4-06 de la cuarta)

- **Cobertura de la línea base.** Tras la línea base se ejecuta una vez la variante con cobertura del comando de pruebas, con lo que el ejecutor ya trae y sin instalar nada: `node --test --experimental-test-coverage`, `go test -coverprofile=/dev/stdout` y, para Python (pytest o unittest), el módulo `coverage` solo si la imagen ya lo tiene. Se descartan las alteraciones en líneas que ninguna prueba ejecuta y en archivos que ninguna prueba carga. Esto NO contradice la alternativa C: la cobertura no es la medida, solo filtra la muestra; la medida sigue siendo detectar cambios.
- **Sin cobertura.** jest, vitest y cualquier ejecutor que no la ofrezca (o un comando de cobertura que falle) dejan la medición como antes, marcada `sinCobertura: true` en el resultado, el evento `ciclo:mutacion` y `forge status`. Con `exigir`, una medición sin cobertura NO cuenta como evidencia: la tarea se pausa con `pruebas_debiles` y el detalle lo dice; `aceptar` la da por buena.
- **Tope de archivos.** `motor.mutacion_max_archivos` (5): solo se miden los archivos con más líneas cambiadas; el resto queda anotado (`archivosOmitidos`). El resultado también trae `porArchivo` (concluyentes y detectadas de cada uno) para ver de dónde sale la puntuación.
- **Reporter fijado (N4-06).** Con node:test la medición ejecuta siempre con `--test-reporter=tap` (sustituye al del proyecto) y solo reconoce un fallo de prueba si el ejecutor imprime su resumen `# fail N` con N ≥ 1 y al menos N bloques `not ok` con su YAML. El reporter spec, dot o junit ya no se reconocen (sin señal: nada cuenta como detectado). Con TAP, el ejecutor antepone `# ` a la salida del módulo y no se puede suplantar.
- **Barrido (N4-01, N4-02).** El barrido de procesos muertos del arranque usa la misma marca JSON y la misma comprobación de pid que la medición (antes exigía un pid pelado y nunca borraba una copia real). Una copia cuyo proceso sigue vivo no se borra nunca por antigüedad; un pid reutilizado solo retrasa el barrido.
- **N-02, resuelto en lo que la cobertura no alcanzaba: solo una ASERCIÓN cuenta como detección.** La cobertura mide ejecución, no comprobación: un «cable trampa» (`if (K !== N) throw ...`) dentro de una función que el código bajo prueba llama está cubierto y su excepción se registraba como «fallo de prueba» real (nueve archivos de guardia llamados desde `suma()`, pruebas SIN aserciones: 9/10 = 90 % con cobertura y con el tope de 5 archivos). Decisión del dueño, más estricta y nunca más permisiva: una alteración es «detectada» solo si el ejecutor clasifica el fallo como de **aserción**. Una excepción que no es de aserción (un `Error` del código bajo prueba, un `TypeError`, un `panic`) pasa a «no concluyente» con motivo `excepcion_no_asercion` y sale del denominador. Razón: una prueba sin aserciones no puede detectar nada; que el código reviente al ejecutarse no demuestra que la prueba lo compruebe. Cómo se distingue (comprobado con capturas reales de cada ejecutor, `tests/fixtures/salidas-ejecutores/*/excepcion-en-prueba.txt` y `guardia-en-llamada.txt`):
  - node:test (TAP): el YAML del ejecutor lleva `code: 'ERR_ASSERTION'` en aserciones y `code: 'ERR_TEST_FAILURE'` con `name: 'TypeError'`/`Error` en otras excepciones; solo se lee la clave de primer nivel del bloque, no el texto del mensaje.
  - pytest: la primera línea `E ` del fallo empieza por `assert`/`AssertionError` (aserción) o por otra clase (`RuntimeError`, `AttributeError`); sin traza se usa el texto tras `FAILED ruta::prueba - `. unittest: `FAIL:` es aserción y `ERROR:` es excepción.
  - jest y vitest: el mensaje del fallo empieza por `expect(`, `assert`, `AssertionError`, `Expected`/`Received` (aserción) o por `Error:`/`TypeError:` (excepción).
  - Go: `--- FAIL` con salida de `t.Error`/`t.Fatal` es aserción; un `--- FAIL` al que sigue `panic:` es excepción; un `panic` en la goroutine 1 sigue siendo fallo de carga.
  - Si la salida no permite distinguirlo con certeza (sin mensaje legible, resumen sin bloques), no es detección: falla cerrado (`sin_senal`).

  **Consecuencia que hay que conocer.** Un mutante que cambia un valor y la prueba espera un valor concreto falla por aserción y se detecta. Un mutante que hace reventar al código ANTES de llegar a la aserción (p. ej. devuelve `null` y la prueba llama a un método suyo) ya no cuenta como detectado: queda no concluyente. Por eso hay menos concluyentes que antes; con `exigir` y `mutacion_min_concluyentes` (3) la tarea puede pausarse por «pocas concluyentes» en lugar de dar éxito. Es el lado seguro. Medido: el caso de la revisión pasa de 9/10 (90 %) a 0 detectadas: las alteraciones de las guardias son no concluyentes y la `suma` real sobrevive (puntuación 0); el control con aserciones fuertes sigue dando 100 %.
- **LÍMITE EXPLÍCITO que queda: el adversario deliberado.** Una guardia que lanza un `AssertionError` a propósito (`throw new assert.AssertionError(...)`, o un `assert` de Python en el código bajo prueba) es indistinguible por clase de una aserción de la prueba y SÍ cuenta como detección (`tests/mutacion-cobertura.test.js`, «LÍMITE DOCUMENTADO», lo fija: si esa prueba cambia hay que revisar este ADR). Es un implementador que conoce el criterio y lo falsea a propósito; para eso sigue haciendo falta revisión humana del código. El implementador no puede tocar las pruebas, pero sí escribir el código que se mide. Tampoco se distingue una aserción en un auxiliar compartido, y jest/vitest no ofrecen cobertura. Con esta defensa, `exigir` frente a un implementador adversario sigue sin ser una garantía; frente a un descuido o a un modelo que no entiende cómo se mide, sí protege.

## Alternativas consideradas

- **A. Integrar una herramienta de mutación por lenguaje**: rechazada. Serían tres dependencias pesadas que habría que meter en la imagen preparada de cada proyecto, contra el Principio IV y ADR-03.
- **B. Que un modelo juzgue la calidad de las pruebas**: rechazada por el Principio VI. Tampoco es reproducible.
- **C. Exigir cobertura de líneas**: rechazada. Unas pruebas sin comprobaciones alcanzan cobertura alta; mide ejecución, no detección.
- **D. Contar aserciones en el texto de las pruebas**: rechazada como única medida. Es fácil de satisfacer con comprobaciones vacías. Puede añadirse a `sospecha.js` como señal barata.
- **E. Mutación propia con pocos operadores**: propuesta. Sin dependencias, independiente del ejecutor de pruebas y acotada.

## Consecuencias

### Positivas
- Un pase con pruebas vacías deja de ser un éxito silencioso.
- La puntuación da al dueño un dato para decidir en la revisión.
- No se añade ninguna dependencia.

### Negativas
- Cada alteración es una ejecución completa de las pruebas: hasta diez ejecuciones más por tarea.
- Las alteraciones por patrones de texto en Python y Go son más toscas que un análisis sintáctico y pueden producir código que no compila. *(Corregido en la revisión independiente: ese cambio ya no cuenta como detectado; ver «Correcciones tras la revisión independiente».)*
- Hay alteraciones que no cambian el comportamiento y aparecerán como no detectadas. Por eso el modo por defecto solo informa.
- El refuerzo de pruebas ocurre después de implementar. Lo hace otro rol y el implementador sigue sin poder tocarlas, pero roza la letra del Principio VII: necesita ratificación del dueño.
- Las huellas de las pruebas (CA-002-03 del ciclo) deben volver a tomarse tras el refuerzo.

### Neutrales
- `skills/mutation-detector` no tiene relación: registra qué archivos cambian los agentes. Conviene renombrarlo o aclararlo en su descripción para evitar la confusión.

## Cuándo revisitar

- Si la medición con un proyecto real supera el tope de tiempo en más de la mitad de las tareas.
- Si muchas alteraciones de Python o Go resultan no concluyentes (la muestra queda corta con frecuencia): entonces se valora un análisis sintáctico propio para esos lenguajes, con su ADR.

## Referencias

- `.sdd/arquitectura/ADR-05-router-determinista.md`, `ADR-03-dependencias-sin-red.md`, `ADR-18-motor-unico-y-alcance-diferido.md` (punto 4)
- `docs/ciclo-verificado.md`, «Límites conocidos»
- `PLAN-CIERRE-BRECHAS.md`, FASE 7
