# Spike S0.4: reanudación con un perfil distinto del original

> 2026-10-17. Lectura de `core/ciclo/index.js`, `estado.js`, `turnos.js`, `diario.js`, `engine-cli.js`. Sin experimento ejecutado sobre reanudación (no se ejecutó la suite ni un ciclo); lo que sigue es análisis de código. «Sin confirmar» = no ejecutado.

## 1. Qué se vuelve a leer y qué se conserva al reanudar

| Dato | Al reanudar | Evidencia |
|---|---|---|
| `estado` del nodo (iteración, ejecuciones, `implementador`, `turnos`, presupuesto…) | **Se conserva** el del último punto de guardado | `index.js:488-499`: `estado = punto.estado` |
| `config` (`turnos_max`, `contexto_max_bytes`, `mutacion`, `precios`…) | **Se vuelve a leer** de `sdd.config.yaml` en cada `forge run`/`resume` | `engine-cli.js:~78` `leerConfigCiclo(cwd, …)`; `deps.config` en `index.js:525` |
| `vetadas` (rutas protegidas) | Se vuelve a leer (`leerRutasProtegidas(cwd)`, `engine-cli.js:181`) | |
| Tarea (`prompt`, `agente`) | Del punto guardado: `estado.tarea` ya está copiada (`estado.js:93-103`); pero `ejecutar(tarea)` recibe la tarea otra vez desde el archivo de tareas (`index.js:470-474`) y sólo se usa para `id` y `estadoInicial` | La tarea de **estado** manda en los nodos (`estado.tarea.agente`, `nodos.js:482`) |
| Modo del implementador | **Se conserva** en `estado.implementador` (`turnos.js:73`): «lo empezado en un modo sigue en ese modo» | Es el precedente exacto de RNF-04 |
| Prompt del primer mensaje de turnos | Se conserva en el diario (`turnos.js:169-174`) | |
| Respuestas del modelo y resultados de herramientas | Del diario: no se vuelven a pedir ni a ejecutar (`turnos.js:245-248`) | |
| `validarEstado` | Valida un conjunto cerrado de campos; **un campo nuevo no se valida y se conserva** (`estado.js:130-186`), como `implementador` | |

## 2. Qué pasa hoy con un cambio de configuración entre cortes (precedente)

`turnos_max` y `turnos_pruebas_max` se leen de `deps.config` en cada entrada al nodo (`turnos.js:164-165`) **y** el primer mensaje ya guardado del diario contiene el texto «Como máximo N turnos» del momento original (`turnos.js:118-119`). Si el usuario baja `turnos_max` de 30 a 10 entre cortes, el bucle respeta 10 pero el modelo vio «30» en su primer mensaje. Es un desajuste menor y ya existe; con perfiles se agrava si cambia lo **permitido** en vez de un número.

## 3. Casos de reanudación con perfil distinto

Sea P0 el perfil con el que se empezó y P1 el que resolvería ahora.

| Caso | Efecto sin tratamiento especial | Gravedad | Tratamiento recomendado |
|---|---|---|---|
| P1 más laxo que P0 (el usuario amplió la política, o el proyecto cambió `sdd.config.yaml`) | Se aplica P1 en todo lo nuevo | Alta (un repositorio podría aflojar a mitad de tarea) | **Conservar P0**: tomar `min(P0, P1)` campo a campo (intersección) — RNF-04 de la spec |
| P1 más estricto que P0 | Se aplica P1 en lo nuevo | Baja | Aplicar P1 (es la intersección) |
| P1 distinto en ambos sentidos | Intersección | Media | Idem: efectivo = P0 ∩ P1 |
| **Turnos: el diario contiene un uso de herramienta que P1 ya no permite** | El diario reproduce el resultado **sin ejecutar** (`turnos.js:245-248`, la rama `if (res)` no pasa por `herramientas.ejecutar`): la verificación de perfil que se ponga en `ejecutar` **no se ejecuta** en la repetición | Media | Comprobar el perfil también en la repetición: si el uso `uso.nombre` no está en P efectivo, no anotar un resultado nuevo y pedir revisión (`pedirRevision('infraestructura', 'coder', …)`). Sin confirmar que baste: la escritura de ese uso ya se aplicó en disco antes del corte |
| El nodo se reanuda con `tarea.agente` distinto | La del estado manda | Nula | Nada |
| P0 no se guardó (punto anterior a la entrega) | No hay P0 | Media | Ver §4: guardar P0 la primera vez; los hilos antiguos reciben el perfil por defecto del rol (equivale al comportamiento actual) |
| Las pruebas ya escritas (`estado.pruebas`) están fuera de `rutasEscribir` de P1 | Siguen en el estado; el perfil sólo restringe escrituras nuevas | Baja | No retroceder lo ya escrito; avisar |

## 4. Diseño recomendado

1. **Guardar el perfil efectivo en el estado** como lo hace `implementador`: campo `perfiles: { planner, qa, refuerzo, coder }` o, mejor, resuelto **por nodo la primera vez que el nodo corre** en ese hilo (cada nodo puede empezar en un momento distinto). Debe añadirse `validarEstado` para que el campo, si está, sea un objeto de forma conocida (hoy no validaría nada: `estado.js:130`).
2. **Efectivo en cada entrada de nodo = P_guardado ∩ P_resuelto_ahora** (nunca se afloja). Se guarda el efectivo resultante, de modo que reanudar varias veces sólo puede reducir.
3. **Registrar en el diario del motor** (`log.append`, no en `diario.js`, que es de respuestas pagadas) `ciclo:perfil_resuelto` con el perfil efectivo y, si cambió, `ciclo:perfil_cambiado { campo, antes, despues }`. Así un revisor ve por qué un hilo reanudado se comporta distinto.
4. **El perfil NO entra en `claveDe`** (`diario.js:27`) ni en el texto del prompt: (a) `claveDe` es `[agente, clavePrompt, extraContext]`; los esquemas de herramientas no forman parte de la clave (en turnos la clave es posicional); (b) si P1 reduce `contexto_max_bytes` o `rutasLeer`, el **contexto recuperado cambia** y con él el `clavePrompt` de `qa`/`coder` (`nodos.js:364-368,479-482`) → el diario de bloque no reconoce la respuesta → se paga de nuevo. Es el mismo problema que ya tiene hoy un cambio de `contexto_max_bytes` entre cortes; hay que decidir si se acepta (recomendado: sí, es raro y siempre más seguro) y documentarlo.
5. **Falla cerrado antes de gastar**: si P1 no se puede resolver (clave inválida en la sección `perfiles` de `sdd.config.yaml`), el nodo devuelve `pedirRevision('infraestructura', nodo, …)` **antes de `invocar`**, no cae a P0 ni al máximo (CA-002-04). Coincide con el patrón de `invocar` (`nodos.js:72-74`).
6. **`forge doctor` y `agentes perfil`** muestran P_guardado, P_actual y el efectivo, y marcan «ampliación ignorada» cuando P1 ⊄ P0.

## 5. Qué cambia en la spec o el plan

1. **RNF-04** («salvo que el nuevo sea más estricto»): precisar a **intersección campo a campo**, no «uno u otro». Añadir el caso de la repetición del diario en turnos.
2. **Plan §3, módulo `estado.js`**: añadir el campo y su validación (`validarEstado`); el plan sólo dice «guarda el perfil efectivo». Añadir también `index.js:488-499` (cargar el punto) y los nodos (resolver al entrar).
3. **Plan §7, prueba «reanudación»**: añadir (a) P1 más laxo → se conserva P0, (b) turnos con un uso en el diario que P1 prohíbe, (c) hilo guardado **sin** campo de perfil (anterior a la entrega) → perfil por defecto del rol y misma conducta que hoy, (d) el cambio de P no rompe `claveDe` cuando no cambia lo que se lee.
4. **Spec §10, tabla de riesgos**: «Reanudar con un perfil más laxo» ya figura; añadir «turnos: reproducción del diario salta la comprobación de perfil».
5. **Pregunta nueva para el dueño**: ¿un cambio de perfil entre cortes debe obligar a revisión humana, o basta el aviso? Recomendación: aviso si P1 ⊆ P0, revisión si hay un uso del diario prohibido.

## 6. Riesgos

- Que la intersección deje al `coder` sin ninguna ruta escribible tras un cambio de política: el nodo debe pedir revisión con el motivo («el perfil no permite escribir nada») y no un genérico `salida_invalida`; hoy no existe el motivo `perfil` en `MOTIVOS` de `estado.js:9`: **añadir motivo** (el validador rechaza motivos desconocidos, `estado.js:174`).
- La reanudación entre versiones de FORGE: un hilo con `schemaVersion` 1.0 sin `perfiles` debe seguir funcionando (el campo es opcional, como `implementador`/`turnos`).
