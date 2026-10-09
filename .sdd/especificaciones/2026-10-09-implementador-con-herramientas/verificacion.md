# Verificación: Implementador con herramientas

> Spec: `2026-10-09-implementador-con-herramientas` · ADR-21 · Fecha: 2026-10-09
> Tipo: **autoevaluación** de quien implementó. No ha pasado por los agentes `revisor` ni `seguridad`, que la constitución exige para cambios en confinamiento. No es una verificación independiente.

## Qué se ejecutó y qué no

**Ejecutado (2026-10-09, Windows 11, Node del equipo de desarrollo):**

- `node --test tests/herramientas-coder.test.js`: 33 pruebas, 33 pasan.
- `node --test tests/ciclo-turnos.test.js`: 37 pruebas, 37 pasan.
- `npm test` completo: 1619 pruebas, 1612 pasan, 0 fallan, 7 omitidas (las mismas 7 que antes de este cambio). Antes eran 1549; las 70 nuevas son las de los dos archivos de arriba. Ninguna prueba anterior se modificó, y la suite anterior sigue en verde con el modo `bloque` por defecto. Una prueba de rendimiento ajena (`tests/performance.test.js`, umbral de 50 ms) falló una vez en la medición previa al cambio, con el equipo cargado, y no ha vuelto a fallar.
- `npm run typecheck`: sin errores en los archivos nuevos. El comando ya terminaba con errores antes de este cambio, en otros archivos, y sigue haciéndolo.
- Diez mutaciones a mano sobre `turnos.js`, `index.js` y `herramientas-coder.js` (quitar la reutilización de resultados del diario, la parada por gasto, el tope de pruebas, la unicidad del fragmento, la lista de pruebas inmutables…): las diez hacen fallar algún test.

**NO ejecutado:**

- **Ningún modelo real.** Todo el modo por turnos se probó con respuestas guionizadas y con un cliente falso del SDK. No se sabe cómo se comporta un modelo de verdad con estas cinco herramientas: si las usa bien, cuántos turnos necesita, si respeta el contrato.
- **La API de Anthropic.** La traducción de mensajes se comprueba contra la forma descrita en la documentación oficial (spike), no contra la API.
- **Docker real.** `ejecutar_pruebas` se probó con un ejecutor guionizado; llama al mismo `deps.runner.test(cwd)` que el nodo `sandbox`.
- **Linux y macOS.** Solo Windows. Los enlaces se probaron como uniones de directorio.
- **Revisión independiente** de código y de seguridad.

## Criterios de aceptación (24)

Estados: ✅ con test que pasa · ⚠️ parcial (lee la nota) · ❌ no hecho.
`H` = `tests/herramientas-coder.test.js`, `T` = `tests/ciclo-turnos.test.js`.

| Criterio | Estado | Test | Nota |
|---|---|---|---|
| CA-001-01 leer (entero o por tramos), listar, buscar | ✅ | H «lee un archivo entero…», «lee un tramo por líneas», «lista una carpeta…», «busca un texto literal…» | `listar` y `buscar` solo ven lo que ve el índice de búsqueda: extensiones de código y texto, archivos no vacíos y de tamaño acotado |
| CA-001-02 nada vetado se lee, lista ni encuentra | ✅ | H «lo vetado no se lee…», «un enlace que sale del proyecto no se sigue», «ni secretos, ni carpetas internas… aparecen al listar», «busca…» (lo vetado no se encuentra), ««leer_archivo» no entrega ninguna de esas rutas…» | Los vetos son por nombre, como en el resto del ciclo: un secreto con un nombre inesperado se leería (límite ya documentado) |
| CA-001-03 tamaño máximo por resultado, con aviso | ✅ | H «un archivo grande se recorta y se avisa», «la búsqueda tiene tope de resultados y avisa», «la salida se recorta por el final» | 32 KB por resultado; 50 coincidencias (200 como mucho); 8 KB de salida de pruebas |
| CA-001-04 la consulta rechazada devuelve el motivo, queda registrada y no detiene la tarea | ✅ | H «lo vetado no se lee; el rechazo da el motivo y queda registrado»; T «CA-007-02…» (la tarea termina en éxito tras los rechazos) | Evento `ciclo:lectura_rechazada` |
| CA-002-01 sustituir un fragmento exacto; crear un archivo | ✅ | H «crea un archivo nuevo y reemplaza uno entero», «sustituye un fragmento exacto y único sin tocar el resto»; T «Escenario 1» | |
| CA-002-02 fragmento ausente o repetido: se rechaza sin cambiar nada, con motivo | ✅ | H «un fragmento que no aparece o aparece más de una vez…» | |
| CA-002-03 mismas reglas de escritura: pruebas, dependencias y configuración, no salir del proyecto | ✅ | H «no toca las pruebas…», «dependencias y configuración no se aplican…», «0 rutas aceptadas por «editar» que el modo de bloque rechace», «un lote hostil no deja nada fuera…»; T «tocar dependencias no se aplica, termina el intento…» | Toda escritura pasa por `aplicarArchivos` con rol `coder` |
| CA-002-04 respaldo antes de la primera modificación; abortar restaura | ✅ | H «hay respaldo antes de la primera modificación…», «una edición rechazada no deja respaldo…»; T «abortar restaura lo que el implementador tocó por turnos» | |
| CA-003-01 pedir las pruebas y recibir el resultado resumido | ✅ | H «usa el entorno aislado del ciclo y devuelve el resultado resumido y redactado» | |
| CA-003-02 en el entorno aislado, con los mismos límites que la ejecución final | ⚠️ | H mismo test (se llama a `runner.test(cwd)` con la carpeta del proyecto) | Es el mismo objeto ejecutor que usa el nodo `sandbox`, así que los límites son los mismos por construcción. **No se ejecutó con Docker real** |
| CA-003-03 el éxito lo decide solo la ejecución final | ✅ | T «las pruebas que pidió el implementador pasan, la ejecución final falla: no hay éxito, hay otra iteración» | `router.js` y `grafo.js` no se tocaron |
| CA-003-04 ningún otro comando | ✅ | H «no existe ninguna herramienta que ejecute otra cosa», «ejecutar_pruebas no acepta un comando» | |
| CA-004-01 cada paso cuenta para el tope, con degradación y parada | ✅ | T «cada turno cuenta para el tope de gasto; agotado, no se inicia otro turno», «sin nada escrito y con el gasto agotado…», «al cruzar el umbral, el turno siguiente usa el modelo más barato…», «un proveedor que no informa del consumo…» | Con `degradar_a: local` los turnos se detienen (Ollama no admite herramientas): T «degradar a un modelo local sin herramientas…» |
| CA-004-02 máximo de pasos; al alcanzarlo, pruebas finales con lo escrito | ✅ | T «al alcanzar motor.turnos_max se ejecutan las pruebas finales…» | |
| CA-004-03 los pasos no consumen iteraciones | ✅ | T «Escenario 1» (cuatro turnos, iteración 1) | |
| CA-004-04 el registro muestra por tarea pasos y gasto | ✅ | T «forge status muestra, por tarea, los turnos y el gasto»; «un evento por turno y uno por acción» | Se prueba la función que usa `forge status` (`lineasEstadoCiclo`), no el comando de terminal |
| CA-005-01 reanudar desde el último paso completado sin repetir llamadas | ✅ | T «un corte entre el turno 4 y el 5…», «un corte después de recibir una respuesta y antes de ejecutar sus herramientas…» | El corte se simula con una excepción que sale del ciclo y un `CicloVerificado` nuevo sobre la misma carpeta; no se mató ningún proceso |
| CA-005-02 una escritura a medias no deja un archivo corrupto | ⚠️ | H «la escritura es atómica: no quedan temporales, y un corte antes de terminar deja el archivo anterior intacto» | Escritura en temporal + renombrado. El corte se simula haciendo fallar el renombrado; **no se probó matando el proceso** ni un corte de corriente (no se fuerza el volcado a disco) |
| CA-005-03 lo pausado en bloque se reanuda en bloque aunque cambie la configuración | ✅ | T «lo pausado en modo de bloque se reanuda en modo de bloque…», «un intento en modo de bloque cortado a medias…», «modoImplementador: el estado manda…» | El modo queda en `estado.implementador` |
| CA-006-01 configurable; sin configurar, la forma actual | ✅ | T «sin configurar, el modo es bloque; se lee de sdd.config.yaml y de FORGE_IMPLEMENTADOR, y se valida» | |
| CA-006-02 proveedor sin trabajo por pasos: avisa y usa la forma actual | ✅ | T «el proveedor declara que no admite herramientas…», «el ciclo no tiene ninguna forma de conversar…», «OpenAI y Ollama declaran que no la admiten» | El aviso es un evento `ciclo:implementador_sin_herramientas` en `.sdd/events.jsonl`; **no se imprime en la terminal** |
| CA-006-03 con la forma actual, el comportamiento no cambia | ⚠️ | T «con bloque, el implementador hace una sola llamada con el contrato de siempre…»; la suite anterior completa, en verde | Un cambio observable: el estado guardado de cada tarea lleva un campo nuevo, `implementador: "bloque"`. `forge status` no cambia. Ninguna prueba anterior tuvo que modificarse. «No cambia» se apoya en la suite, no en una comparación byte a byte con la versión anterior |
| CA-007-01 lo leído no cambia rutas, comandos ni topes | ✅ | H «un archivo que «ordena»…»; T «aunque el modelo siga pidiendo acciones, el tope de turnos no se mueve» | Las reglas se fijan al crear las herramientas; ningún resultado se interpreta |
| CA-007-02 proyecto hostil: ambas acciones rechazadas y registradas | ✅ | T «un archivo «ordena» leer .env y escribir en ../fuera.txt; el modelo obedece…»; H ídem a nivel de herramienta | El «modelo» es un guion que obedece al archivo. No dice nada de lo que haría un modelo real, y no hace falta: la frontera no es el modelo |

**Resumen:** 21 ✅, 3 ⚠️ (CA-003-02, CA-005-02, CA-006-03), 0 ❌.

## Requisitos funcionales y no funcionales

| Requisito | Estado | Nota |
|---|---|---|
| RF-001 mismas reglas de ruta, desde un único lugar | ✅ | `validarRuta` y `aplicarArchivos` (`protocolo-archivos.js`), `listarArchivosIndexables` (`indice-vectorial.js`). Ninguna regla de ruta nueva |
| RF-002 guardar cada paso completado antes del siguiente | ✅ | La respuesta se anota al recibirla; el resultado de cada herramienta, al ejecutarla |
| RF-003 ninguna otra capacidad de ejecución | ✅ | |
| RF-004 sin proveedor fijo: la capacidad se declara por proveedor | ⚠️ | El contrato es neutro, pero **hoy solo Anthropic lo implementa** (y el proveedor de pruebas). OpenAI y Ollama declaran que no |
| RF-005 la decisión de éxito sigue en la ejecución final y el router | ✅ | `router.js`, `grafo.js` y el nodo `sandbox` sin cambios |
| Costo: ≥ 50 % menos tokens de salida en el Escenario 1 | ❌ **pendiente** | **No se puede medir sin un modelo de pago.** Ver abajo |
| Seguridad: la suite de confinamiento pasa a través de las acciones por pasos | ✅ | H «confinamiento: lo que el modo de bloque rechaza, las herramientas también» recorre los casos de `tests/ciclo-protocolo.test.js` y compara, ruta a ruta, con `aplicarArchivos`: 52 rutas rechazadas por el modo de bloque, 0 aceptadas por `editar`, y el mismo motivo. `leer_archivo` rechaza todas salvo manifiestos, configuración no vetada y archivos de prueba, que el recuperador y el servidor MCP también leen |
| Dependencias: ninguna nueva | ✅ | `package.json` sin cambios |
| Compatibilidad: opt-in | ✅ | Suite anterior en verde con `bloque` |
| Auditabilidad: un evento por acción, con su resultado | ✅ | `ciclo:turno`, `ciclo:herramienta`, `ciclo:lectura_rechazada`, `ciclo:escritura_rechazada`, `ciclo:turnos_agotados`, `ciclo:implementador_sin_herramientas` |

## Criterios de éxito de la spec (§12)

| Criterio | Estado | Nota |
|---|---|---|
| Los 24 criterios de aceptación tienen test | ✅ | Tabla de arriba; tres con la reserva indicada |
| La misma tarea termina en éxito en las dos formas, con gasto e iteraciones comparados | ❌ pendiente | Con guiones, las dos formas terminan en éxito, pero comparar gasto e iteraciones solo tiene sentido con un modelo real |
| 0 rutas aceptadas por pasos que la forma de bloque rechace | ✅ | |
| 0 dependencias nuevas | ✅ | |

## Cómo medir el costo (pendiente)

Hace falta una clave de un proveedor de pago. Gasta dinero real, como máximo el tope.

1. Prueba mínima de que un modelo real completa una tarea por turnos (la tarea trivial de `probar-modelo`, que crea un archivo nuevo):

   ```bash
   export ANTHROPIC_API_KEY=...
   FORGE_IMPLEMENTADOR=turnos npx forge probar-modelo --tope 0.50 --conservar
   ```

   En PowerShell: `$env:ANTHROPIC_API_KEY='...'; $env:FORGE_IMPLEMENTADOR='turnos'; npx forge probar-modelo --tope 0.50 --conservar`

   Mirar en el proyecto conservado: `.sdd/events.jsonl` (eventos `ciclo:turno` y `ciclo:herramienta`) y `.sdd/motor/<sesión>/gasto.jsonl`.

2. Para el criterio de costo hace falta el Escenario 1, que `probar-modelo` no cubre: un proyecto con un archivo de unas 2000 líneas y una tarea que cambie tres. Ejecutar la misma tarea dos veces, desde dos copias idénticas del proyecto, con `forge run --motor ciclo --tasks tareas.json` y `FORGE_IMPLEMENTADOR=bloque` en una y `FORGE_IMPLEMENTADOR=turnos` en la otra, y comparar en `gasto.jsonl` de cada una la suma de `outputTokens` de las llamadas del implementador, además del gasto total, los `inputTokens` y las iteraciones.

Qué esperar, sin haberlo medido: menos tokens de salida por turnos, y **más tokens de entrada**, porque el prompt de sistema, las herramientas y el historial se reenvían en cada turno y `conversar` no usa caché de prompts. El gasto total puede salir mayor que en modo de bloque.

## Límites conocidos de lo entregado

- **Sin caché de prompts** en `conversar` (ver arriba).
- **Solo Anthropic** entre los proveedores reales.
- **Ventana entre escribir y anotar.** Si el proceso muere después de que `editar` escriba y antes de anotar su resultado en el diario, al reanudar la acción se repite. Un archivo entero se reescribe igual; una sustitución ya aplicada devuelve «el fragmento no aparece» sin cambiar nada, y el modelo recibe ese error aunque el cambio está hecho.
- **Una respuesta cortada por longitud** no ejecuta sus herramientas, pero su turno se paga.
- **Un fallo del proveedor a mitad del trabajo** pausa la tarea; al continuar, el intento empieza una conversación nueva (lo escrito sigue en disco y se lista en el prompt, pero los turnos anteriores no se reutilizan).
- **El implementador no ve el contexto del recuperador** en este modo: recibe el mapa de archivos y lee lo que necesita. Con más de 200 archivos el mapa se recorta.
- **No puede borrar archivos** ni renombrarlos.
- **Tiempo máximo por turno**: el de cualquier llamada a un modelo (120 s). No hay tiempo máximo para el intento completo, solo tope de turnos y de gasto.
- **El aviso de «proveedor sin herramientas»** solo queda en el registro de eventos.
- `forge status` cuenta los turnos de los intentos que llegaron a guardar su punto; los de un intento en vuelo aparecen al terminar ese intento.
