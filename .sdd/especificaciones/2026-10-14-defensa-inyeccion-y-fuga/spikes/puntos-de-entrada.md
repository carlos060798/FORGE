# Spike S0.1: puntos por los que contenido del árbol llega al modelo

> Hecho sobre la rama `feature/motor-agentico` (commit `1fe136d`), 2026-10-17. Método: lectura de código; ningún experimento necesario. Todo lo marcado «sin confirmar» no se ejecutó.

## 1. Resultado corto

Hay **16 puntos de entrada** de contenido controlable por el árbol (o derivado de él) hacia un prompt o un resultado de herramienta. **Ninguno está delimitado hoy** (`comoDato` no se llama desde `core/`; sólo desde `cli/integraciones.js:253`). Cuatro de ellos no figuraban en la spec (marcados ★). Dos tienen un hueco propio además de la falta de delimitador (marcados ⚠).

El directorio del recuperador es `core/recuperacion/`, no `core/ciclo/recuperacion/`.

## 2. Inventario

Columnas: nodo = quién arma el prompt; «hoy» = saneamiento/limite existente; «delimitado» = va dentro de un bloque de dato (siempre no).

| # | Punto | Dónde se arma (archivo:línea) | Nodos / modos que lo reciben | Qué controla el árbol | Saneado hoy |
|---|---|---|---|---|---|
| 1 | Descripción de la tarea (`tarea.descripcion`) ★ | `core/ciclo/estado.js:98` (viene de `tarea.prompt`), usada en `nodos.js:308,354,467`, `turnos.js:106`, `pruebas-confiables.js:178` | planner, qa, coder (bloque y turnos), refuerzo | La tarea sale de `tareas.md`/spec del proyecto (sin confirmar el origen exacto en `engine-cli`; el campo `prompt` lo trae el cargador de tareas) | Ninguno |
| 2 | Plan (`plan.pasos`) ★ | `nodos.js:144` `seccionPlan`, usado en `:354,:467`, `turnos.js:106` | qa, coder | Segundo orden: lo escribe el modelo del planner leyendo #1, #3, #4 | Sólo `typeof === 'string'` (`nodos.js:319`) |
| 3 | Mapa de archivos (nombres) | `nodos.js:233-244` `seccionMapa`; filtro `nombreListable` `:216-222` | planner (`:308`), qa sin contexto (`:366`), coder bloque (`:469`, sólo `volatil`), coder turnos (`turnos.js:109`) | Nombres de archivo | Sí: lista cerrada de caracteres, tope 200 |
| 4 | Resumen de manifiestos | `nodos.js:167-208` `seccionProyecto`; `unaLinea` `:182`, `nombreDependencia` `:156` | planner, qa, coder (ambos modos), refuerzo (`pruebas-confiables.js:181`) | `package.json` (type, dependencias, `scripts.test`), `go.mod` | Sí: una línea, sin `#` ni backticks, redactado, dependencias con lista cerrada |
| 5 | Contexto del recuperador (archivos) | `core/recuperacion/recuperador-archivos.js:63-` (cuerpo entero de archivos, cabecera `### ruta (origen)` con `etiqueta` `:103-104`); se inserta en `nodos.js:353,355,460,469` | qa, coder bloque. **No** en turnos (`turnos.js:97-98` lo declara) | Contenido íntegro de archivos y de la spec | Sólo `validarRuta` + binarios; contenido sin redactar ni delimitar |
| 6 | Contexto semántico ⚠ | `core/recuperacion/recuperador-semantico.js:49` | qa, coder bloque cuando `motor.recuperador` es semántico | Contenido y **nombre** del archivo | La cabecera usa `'### ' + h.ruta` **sin** `etiqueta()` ni `nombreListable`: un nombre con salto de línea o `## Tarea` entra tal cual (sin confirmar con un nombre real; en Windows no existen saltos de línea en nombres, en Linux sí) |
| 7 | Líneas de la spec ★ | `recuperador-archivos.js:99` (`candidatos.push({ ruta: 'spec.md', origen: 'spec', ...})`) | los mismos que #5 | Texto de `spec.md` que cita los CA | Ninguno |
| 8 | Pruebas leídas (`leerPruebas`) | `nodos.js:435-440`; usado en `:283,:468`, `turnos.js:107` | coder, qa (`seccionPruebasAnteriores`) | Las escribió el modelo del tester, pero pueden contener texto copiado del árbol | Ninguno (no pasa por `redactar`) |
| 9 | Pruebas en reintentos | `pruebas-confiables.js:24-31` `textoDeArchivos`, `:40-48`, `:53-61`; `refuerzo` `:179` | qa (reintento «pasan sin implementación», «pasaban antes»), refuerzo | Igual que #8 | Ninguno |
| 10 | Implementación actual | `nodos.js:252-268` `seccionImplementacionActual` | coder bloque (`:473`) | Archivos que el coder escribió antes; el disco pudo cambiar (`:257-259` revalida ruta) | Sólo ruta; contenido sin redactar |
| 11 | Salida de pruebas (stdout/stderr) | `sandbox` guarda `cola(...)` en `nodos.js:527`; entra en `:284`, `:475`, `turnos.js:116` | qa (sin progreso), coder bloque, coder turnos | La emite el código bajo prueba | `redactar` + tope 8 KiB (`redactar.js:262-273`); sin delimitar |
| 12 | Cambios no detectados (mutación) ★ | `pruebas-confiables.js:161-168` `seccionSobrevivientes` | refuerzo | Líneas de la implementación (`antes`/`despues`) y ruta | Ninguno (sin confirmar si `mutacion.js` recorta la línea) |
| 13 | Resultado de `leer_archivo` | `herramientas-coder.js:314` | coder turnos | Contenido íntegro (≤ 32 KiB) | Cabecera propia + `redactarFormatos` + `ocultarCuerposDeClave`; sin delimitar |
| 14 | Resultado de `buscar` | `herramientas-coder.js:363,371` | coder turnos | Líneas con coincidencias + ruta | `redactarFormatos`; sin delimitar |
| 15 | Resultado de `listar` ⚠ | `herramientas-coder.js:327,331,338` | coder turnos | **Nombres de archivo y de carpeta** | **No pasa por `nombreListable`** (lo hace sólo `seccionMapa`, `nodos.js:237`). `listarArchivosIndexables` no filtra caracteres de nombre (`indice-vectorial.js:44-75`) |
| 16 | Resultado de `ejecutar_pruebas` | `herramientas-coder.js:459-463` | coder turnos | Salida del código bajo prueba | `cola(…, 8192)`; sin delimitar |


Canales que **no** llevan contenido del árbol: `CONTRATO_*` (`core/ciclo/contratos.js:20,34,46,61`, texto fijo), `extraContext`, mensajes de rechazo de herramientas (repiten la ruta que **pidió el modelo**, no el árbol: `herramientas-coder.js:223,231`) y `detalle` de las revisiones (van a la persona, no al modelo).

## 3. Dónde delimitar exactamente

Principio: **delimitar al armar el prompt o al devolver el resultado, nunca dentro del recuperador ni en el estado guardado.**

Razones:
1. `contexto_max_bytes` se aplica dentro del recuperador (`recuperador-archivos.js` calcula `maxBytes` incluyendo cabeceras). Si el recuperador envolviera, el marcador comería presupuesto de contenido; si se envuelve fuera, el prompt supera el tope en ~110 B por fragmento. Decisión: envolver fuera y **documentar** que el tope aplica al contenido, no al marcador (RNF-04).
2. El estado guarda `stdoutCola`/`stderrCola` (`nodos.js:527`) y `implementacion`/`pruebas` sólo con ruta y huella. Envolver al guardar cambiaría el estado persistido y los puntos de guardado existentes; envolver al leer no.

Puntos de cambio (uno por canal; una función `comoArchivo` por fragmento):

| Cambio | Archivo:línea |
|---|---|
| Envolver cada ejemplar de #5, #6, #7 en el sitio donde `textoDeContexto` devuelve `r.texto` | `nodos.js:132-141` (pero el texto ya viene concatenado: **hace falta que el recuperador devuelva los fragmentos por separado**; hoy devuelve `contexto.fragmentos` sólo con ruta/bytes y `texto` plano) |
| #3 (mapa) y #4 (manifiestos): bloque único por sección | `nodos.js:243` y `:207` |
| #8, #9, #10: envolver por archivo | `nodos.js:438`, `:265`; `pruebas-confiables.js:29` |
| #11: envolver salida y errores en cada punto de uso | `nodos.js:284`, `:475`; `turnos.js:116` |
| #12 | `pruebas-confiables.js:162-163` |
| #13 a #16: envolver `texto` de la herramienta | `herramientas-coder.js:314` (y `:371`, `:338`, `:461-463`) |
| #1 y #2 | `nodos.js:308,354,467`, `turnos.js:106`, `pruebas-confiables.js:178`: **decisión abierta** (ver §5) |

**Cambio de diseño que conviene registrar en la spec:** el punto único de entrada (CA-001-01) no puede ser sólo una función de envoltura; hace falta que `recuperar()` devuelva los fragmentos (`{ruta, origen, contenido}`) en vez de un texto ya pegado, porque envolver el texto pegado pondría contenido de varios archivos bajo un solo identificador (y el saneado de #6 sigue siendo necesario).

## 4. Qué cambia en la spec o el plan

1. **RF-02 / CA-001-01**: ampliar la lista con #1, #2, #7, #12 (omitidos). Añadir «y los nombres que devuelve `listar`» (CA-001-04 hoy sólo habla del mapa).
2. **Defecto previo a la delimitación (⚠)**: #6 (cabecera semántica con ruta sin filtrar) y #15 (`listar` sin `nombreListable`) son fugas de nombres que delimitar no arregla si el nombre contiene la propia cadena de cierre. Aplicar `nombreListable`/`etiqueta` primero. Esto es un hallazgo de seguridad independiente de la spec: se entrega aunque ésta no se apruebe (F2.0).
3. **Plan, módulos**: `core/recuperacion/*` entra en la lista de archivos tocados (hoy el plan no los nombra).
4. **Plan §7, prueba estática** (riesgo «punto nuevo sin delimitar»): sirve esta lista como registro; la prueba debe comprobar que cada llamada a `readFileSync`/`leerComoTexto`/`listarArchivosIndexables` dentro de `core/ciclo` y `core/recuperacion` esté en el registro. Sin confirmar si bastan 14 sitios (`grep readFileSync` en `core/ciclo` da más usos que no van al modelo).
5. **Fuera de la delimitación (decisión que reclama el dueño)**: #1 y #2 (descripción y plan). Si la descripción de la tarea la escribe el dueño, no es hostil; si viene de una spec importada de un tercero, sí. Recomendación: delimitar #1 sólo cuando la tarea provenga de una integración (ya pasa por `comoDato`, ADR-22) y dejar #2 sin delimitar, documentándolo como límite.

## 5. Riesgos

- Envolver #5 sin romper el reconocimiento de huella: ver `identificador-y-reanudacion.md` (`clavePrompt` y volátiles).
- `qa` y `coder` construyen el prompt **dos veces** (`partes(mapa)` y `partes('')`, `nodos.js:354-369,466-479`): cualquier envoltura debe ser pura y determinista en ambas.
- Coste: ~110 B (≈ 35 tokens, estimación sin tokenizador) por fragmento más una cabecera; en turnos, un par de marcadores por resultado de herramienta (hasta `turnos_max` = 30 turnos × varias herramientas). Mover la cabecera larga al contrato (system) y dejar sólo el marcador en cada fragmento evita multiplicarla.

## 6. Recomendación sobre las preguntas abiertas de la spec

- **Pregunta 1 (reutilizar `comoDato` o función hermana):** función hermana confirmada. Además de reescribir enlaces, `comoDato` fija una cabecera con `proveedor` y estructura de «incidencia» (referencia, título, cuerpo, comentarios) que no corresponde a un archivo.
- **Pregunta 5 (salida de pruebas):** sí, y es el canal más fácil de falsificar (la emite código hostil, no una persona): #11 y #16.
