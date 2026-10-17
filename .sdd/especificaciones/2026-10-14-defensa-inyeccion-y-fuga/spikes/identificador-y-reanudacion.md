# Spike S0.2: determinismo del identificador y reanudación

> 2026-10-17, rama `feature/motor-agentico` (`1fe136d`). Lectura de código + un experimento mínimo (`claveDe` real importado desde un script fuera del repositorio; resultados en §3).

## 1. Cómo reconoce el motor una respuesta ya pagada

Dos mecanismos conviven en el mismo diario (`core/ciclo/diario.js:10-12`):

| Modo | Clave | Qué contiene | Efecto de un identificador aleatorio nuevo al reanudar |
|---|---|---|---|
| Bloque (planner, qa, coder bloque, refuerzo) | `claveDe` = sha256 de `[agente, clavePrompt ?? userPrompt, extraContext]` (`diario.js:27-34`) | Sólo la **respuesta** (`diario.js:70-73`). El prompt **no** se guarda | La clave cambia → no hay respuesta previa → **se paga otra vez** (`index.js:289-291`, `nodos.js:71`) |
| Turnos (coder) | Posición: `turno:<it>:inicio`, `turno:<it>:<n>`, `turno:<it>:<n>:r:<i>` (`turnos.js:17-20,47`) | El primer mensaje **entero** (`turnos.js:169-174`), la respuesta del modelo y el texto de cada resultado de herramienta (`:244-245,280`) | Ninguno: la conversación se reproduce desde lo guardado |

Consecuencia: **el modo de turnos ya es inmune** a un identificador aleatorio, siempre que el delimitador se aplique *antes* de anotar `inicio` y dentro del `texto` que devuelve cada herramienta (que es lo que se anota). **El modo de bloque no lo es.**

## 2. Qué parte del prompt entra en la clave

`clavePrompt` existe precisamente para sacar de la clave lo que el propio nodo cambia en disco (`nodos.js:46,364-368,479-482`; origen: R3 de la revisión independiente, `diario.js:28-30`).

| Nodo | `userPrompt` | `clavePrompt` | Contenido del árbol dentro de la clave |
|---|---|---|---|
| planner | `nodos.js:308` | = `userPrompt` (no se pasa) | descripción, mapa, manifiestos |
| qa | `partes(mapa, extra)` `:366` | `partes('', extra)` `:368` | contexto del recuperador, manifiestos, salida de pruebas, pruebas anteriores. **Sin** mapa |
| coder bloque | `partes(true)` `:479` | `partes(false)` `:482` | pruebas, contexto, manifiestos, salida anterior. **Sin** mapa ni implementación actual |
| refuerzo | `pruebas-confiables.js:178-181` | `= userPrompt` `:185` | pruebas, sobrevivientes, manifiestos |

Hay un segundo requisito que no estaba en la spec: **el identificador no puede depender de lo que queda fuera de la clave.** Si se usara un único bloque con un único identificador para «sección volátil + sección estable», el identificador (que está en el texto estable) cambiaría cuando cambia el mapa y la clave se rompería de nuevo (el problema que `clavePrompt` resuelve hoy).

## 3. Experimento

Script fuera del repositorio (`scratchpad/e1.mjs`), importa `claveDe` real:

```
aleatorio igual clave tras reanudar: false      <- un nonce nuevo rompe el diario de bloque
hash-de-contenido igual clave:       true       <- id = sha256("forge-dato\0" + contenido)[0:24]
id aparece en su contenido:          false
```

Es decir, la opción de la spec («guardado en el diario junto al prompt», pregunta 4) **no funciona tal cual en bloque**: para buscar el identificador guardado hace falta la clave, y la clave depende del identificador (círculo). Habría que sacar el identificador de la clave (normalizarlo antes de `claveDe`) o guardarlo bajo otra clave estable; ambas añaden superficie.

## 4. Opciones

| Opción | Reanudación en bloque | Reanudación en turnos | Superficie nueva | Falsificable por el contenido |
|---|---|---|---|---|
| A. Aleatorio por llamada (como `comoDato`) | **Rompe** (doble pago) | Bien (si se anota después de envolver) | Ninguna | No |
| B. Aleatorio, guardado en el diario | Círculo con la clave (§3); exige normalizar el id fuera de `claveDe` | Bien | Nuevo tipo de entrada en el diario, versionado de diarios antiguos | No |
| **C. Derivado del contenido**: `id = sha256("forge-dato:v1\0" + etiqueta + "\0" + texto_final)[0:24]` | **Bien**: mismo contenido, mismo prompt, misma clave | Bien | **Ninguna** (no se guarda nada) | No: un contenido que incluyese su propio hash es un punto fijo de sha256 (inviable) |
| D. Derivado con semilla de sesión (HMAC) | Bien | Bien | Semilla en el estado o libro | No, y además impide precalcular |

**Decisión recomendada: C**, con estas reglas para que sea seguro:

1. El hash se calcula sobre el **texto final que se muestra** (después de truncar, redactar y sanear). Si se hasheara antes de truncar, el contenido mostrado podría incluir otro identificador.
2. **Un identificador por fragmento** (por archivo, por resultado de herramienta), nunca uno por sección mezclada con volátiles (§2).
3. La comprobación «el identificador no aparece en el contenido» (CA-001-02) se conserva como aserción (si aparece, es una colisión o un error: se lanza, no se reintenta).
4. Un atacante que escriba `<<<…:H(Y) fin>>>` dentro del archivo X sólo cierra un bloque cuyo id sea H(Y); mientras X está abierto, el id abierto es H(X) ≠ H(Y) salvo punto fijo. Misma propiedad que con un nonce, sin estado.
5. D es mejora opcional si el revisor prefiere no depender de que sha256 no tenga puntos fijos explotables; coste: una semilla por sesión (en `estado-usuario`, fuera del árbol). No se recomienda en la primera entrega.

La «ventana en la que el contenido conozca el identificador» (revisión independiente, punto 3 de la spec) no existe con C: el contenido no puede conocer su hash.

## 5. Efecto en diarios existentes y en la huella

- **Una vez**, al desplegar: toda `clave` de un nodo en vuelo cambia (cambia el texto del prompt: marcadores y cabecera). El diario «se vacía al guardar el punto del nodo» (`diario.js:7-9`), así que sólo afecta a un nodo cortado justo durante la actualización: se paga una vez de más. Aceptable; documentarlo en las notas de versión. Sin confirmar si existe un caso en las pruebas de reanudación con un diario escrito por la versión anterior (`tests/` no se ejecutó).
- La cabecera fija larga debe ir al **contrato** (`extraContext`, ya en la clave y constante: `contratos.js:20,34,46,61`), no repetirse por fragmento. Con C, cada fragmento sólo lleva dos marcadores de 55 caracteres.
- En turnos, `promptTurnos` envuelve antes de `deps.diario?.anotar(claveInicio, inicio)` (`turnos.js:171-173`): sin cambios de orden.
- `huellasAlteradas` y las huellas de archivos escritos (`protocolo-archivos.js:309,321-327`) son sha256 del contenido en disco: el delimitador no toca los archivos, sólo el prompt. **No cambian.**

## 6. Qué cambia en la spec o el plan

1. **CA-001-05 y plan §5 («Identificador guardado en el diario»)**: sustituir por «identificador derivado del contenido final (opción C); no se guarda nada». Retirar el riesgo «el identificador guardado rompe diarios antiguos».
2. **Pregunta abierta 4**: respondida (derivado, no guardado). La spec recomendaba guardarlo; el experimento muestra el círculo con `claveDe`.
3. **RF-01**: la «generación del identificador compartida con `confianza.js`» ya no aplica a la función hermana (el nonce de `comoDato` es aleatorio a propósito, `confianza.js:277-284`; ese módulo no debe cambiar). Se comparte la **cabecera/forma del marcador**, no la generación.
4. **Prueba nueva** (plan §7): «dos construcciones del mismo prompt dan la misma `claveDe`» y «cambiar un byte del archivo cambia el identificador».
5. **Plan §6, F2** debe precederse de un cambio en `recuperar()` para devolver fragmentos (ver `puntos-de-entrada.md` §3).

## 7. Riesgos

- Si alguien construye el delimitador con un identificador aleatorio «por seguridad» en una refactorización, el modo de bloque vuelve a pagar doble sin que falle ninguna prueba existente → la prueba de la clave estable (punto 4) es obligatoria.
- Dos archivos con contenido idéntico comparten identificador: inocuo.
- Truncar después de calcular el hash (regla 1) es el error más probable en la implementación.
