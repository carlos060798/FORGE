# Revisión de seguridad: 2026-10-03-ciclo-verificado

> Fecha: 2026-10-03 | Veredicto actual: **OBSERVACIONES** — la primera revisión (esta, del propio autor) fue insuficiente, la segunda (independiente) la **RECHAZÓ** y la tercera (independiente) dejó **OBSERVACIONES**: ningún hallazgo permite que la salida del modelo, por sí sola, ejecute código en el anfitrión o escriba fuera del proyecto. Sus hallazgos nuevos están corregidos (tabla siguiente) pero esas correcciones no han pasado una cuarta revisión.
> Alcance: `core/ciclo/protocolo-archivos.js`, `core/glob.js`, `core/sandbox/*`, `core/recuperacion/*`, `core/ciclo/redactar.js`.
>
> La hizo el mismo asistente que escribió el código, probando rutas y contenedores reales en Windows 11 con Docker 29.7.2. No sustituye a la revisión del agente `seguridad` ni a una auditoría externa.

## Tercera pasada (agente `seguridad`, independiente)

| # | Hallazgo (reproducido) | Estado |
|---|---|---|
| NUEVO-6 (alta) | ReDoS en `redactar`: una línea de 1 MiB de `a` en la salida de las pruebas bloquea el proceso (coste cuadrático) | **Corregido**: prefijos acotados a 64 y entrada acotada a 64 KiB antes de redactar; 1 MiB ahora tarda milisegundos |
| NUEVO-1 (media) | La guarda del modo clásico solo miraba la última sesión: tras una sesión nueva, `forge run` ejecutaba `npm test` en el anfitrión sobre código de un modelo | **Corregido**: se miran todas las sesiones del proyecto, también en `resume` |
| NUEVO-2 (media) | `.pgpass`, `.vault-token`, `kubeconfig`, `auth.json`, `*token*.txt`… se leían y se copiaban a la copia del contenedor | **Corregido** para esos nombres. **Abierto**: sigue siendo una lista negra |
| NUEVO-3 (media) | `pub -> secrets/`: `pub/app.config.json` se clasificaba como configuración por su ruta lógica y el recuperador lo leía | **Corregido**: el veto se evalúa antes sobre la ruta lógica y la real |
| NUEVO-5 (media) | La numeración de la copia se reiniciaba por proceso: un residuo bloqueaba cada `resume` | **Corregido** (nombre único) y se barren las copias anteriores al arrancar, con aviso de las que no se pueden borrar |
| NUEVO-7 (media) | LangGraph envía el estado completo a LangSmith si el usuario tiene el trazado activo | **Corregido**: se desactiva el trazado y se borra el destino antes de cargar |
| NUEVO-4 (media) | `Respaldo` confiaba en el manifiesto de disco: `../victima.txt` borraba o escribía fuera del proyecto | **Corregido**: se valida cada entrada; un manifiesto inválido falla |
| B2 / NUEVO-8 (baja) | Dos dueños del candado con 3 o más procesos | **Corregido**: reclamación aparte |
| NUEVO-9 (baja) | `core/glob.js` lanza con llaves sin cerrar y `**/` repetido es exponencial; además `protecciones.no_tocar_archivos` no estaba conectado | **Corregido**: glob robusto y lista conectada (`leerRutasProtegidas`) |
| NUEVO-10 (baja) | Los manifiestos se copian siguiendo enlaces de archivo | **Abierto** (no reproducido en Windows) |
| M2 | `process.exit(0)` falsea un éxito | **Mitigado, no cerrado**: un código 0 sin evidencia de pruebas pasadas, o con una salida forzada al comienzo de línea en lo que escribió el implementador, pausa la tarea (`exito_sospechoso`). Una salida forzada indentada o dentro de una función no se detecta |
| A1 | Lista de configuración incompleta (`jest.setup.js`, `__mocks__/`, `vitest.workspace.ts`, `tsconfig.json`, `scripts/*.sh`…) | **Abierto**: riesgo de la lista negra, documentado |
| B3 | Valores con espacios (`PASS=a b c`) sin redactar | **Corregido** para `pass`, `pwd` y valores entre comillas. **Abierto**: un valor con espacios sin comillas |
| — | El lockfile no va en `files` del paquete | **Abierto** (superficie de cadena de suministro; sin scripts de instalación hoy) |

No pudo comprobar: symlinks de archivo en Windows, macOS/APFS, sistemas de archivos sin enlaces duros, `docker build` con red hostil, llenado de disco, el ReDoS de extremo a extremo con Docker.

## Cuarta pasada (agente independiente: API HTTP, servidor MCP y correcciones de la tercera)

Veredicto: **OBSERVACIONES**. No encontró ninguna vía de ejecución en el anfitrión desde la API ni fuga del secreto. MCP: 94 mensajes hostiles, todos bien respondidos. Hallazgos reproducidos y su estado:

| # | Hallazgo | Estado |
|---|---|---|
| H1 (medio-alto) | `leerRutasProtegidas` ignoraba sin aviso las protecciones con lista en línea, BOM, comentarios en la columna 0 o claves entre comillas | **Corregido**: se aceptan esas formas, y si la lista está declarada y no se entiende, falla en lugar de dejar rutas sin proteger |
| H2 (medio) | `tarea:"--force"` en `POST /v1/decisiones` se convertía en un flag de la CLI | **Corregido**: los identificadores empiezan por letra, número o guion bajo |
| H3 (medio) | El manifiesto del respaldo aceptaba rutas dentro de `.git` o a través de una junction | **Corregido**: cada entrada pasa por `validarRuta` |
| H4 (medio) | `barrerCopias` seguía un enlace en `staging` y vaciaba su destino | **Corregido**: si `staging` es un enlace no se toca |
| H5 (bajo-medio) | ReDoS en `globARegex` con muchos `*` | **Corregido**: más de 6 `*` no coinciden con nada |
| H6 (bajo) | ReDoS cuadrático en `redactar` (credenciales en URL y nombres de secreto) | **Corregido** (de 2 s a milisegundos) |
| H7 (bajo) | DoS por muchas conexiones lentas a la API | **Abierto**: no hay `maxConnections`; la API es solo local y está documentado |
| H8 (bajo) | Un candado con marca de tiempo futura no caducaba | **Corregido** |
| H9 (bajo) | Un único punto de guardado dañado abría el modo clásico | **Corregido**: una carpeta de hilo sin punto válido cuenta como sin terminar |
| H10 (bajo) | Tareas con id `.`/`..`, `archivos` con rutas absolutas, archivos `tareas-*.json` que no se borraban | **Corregido** |
| H11 (bajo) | Lista de vetos por nombre incompleta (`config.env`, `prod.env`, `serviceaccount.json`, `wp-config.php`, `database.yml`, `*.sqlite`) y dotdirs legibles (`.config/gh/`, `.m2/`) | **Abierto**: lista negra; solo importa si la raíz del proyecto es un HOME |

Informativo sin corregir: una cabecera `Host` duplicada gana la primera; sin longitud mínima si fijas `FORGE_API_TOKEN`; el proceso hijo hereda el secreto y `cola()` no lo redacta si aparece suelto; el MCP almacena en memoria una línea de 11 MB antes de descartarla.

No pudo comprobar: el contenedor real desde el MCP, symlinks de archivo, Linux/macOS, DNS rebinding real. Las correcciones de esta pasada las probé yo (tests en `ciclo-tercera-pasada.test.js`); **no las ha revisado nadie independiente**.

## Modelo de amenaza

El adversario es **la salida de un modelo**: puede ser errónea o estar manipulada por contenido del propio repositorio (inyección de instrucciones). Controla dos cosas: las rutas y el contenido de los archivos que propone escribir, y el código que luego se ejecuta como pruebas. No se considera un atacante con acceso al equipo ni a Docker.

## Hallazgos corregidos

### S1 — Rutas vetadas eludibles con mayúsculas (alta, CWE-178)

- **Qué pasaba:** las comprobaciones distinguían mayúsculas y el sistema de archivos de Windows (y el de macOS por defecto) no. `.GIT/config` no coincidía con `.git/**` pero escribía en `.git/config`.
- **Impacto:** un agente podía sobrescribir `.git/config` o crear hooks de git (ejecución de código en el equipo anfitrión en el siguiente comando de git), reescribir las pruebas (`Tests/A.TEST.JS`) y cambiar `package.json` (`PACKAGE.JSON`) sin revisión humana.
- **Comprobado:** una sonda escribió los tres archivos antes del arreglo y ninguno después.
- **Arreglo:** todas las comparaciones (rutas vetadas, manifiestos, pruebas inmutables, exclusiones de la copia de trabajo) se hacen sin mayúsculas y con Unicode normalizado (`canonica`, `coincide`).

### S2 — Nombres que Windows resuelve a otro archivo (alta, CWE-41)

- **Qué pasaba:** `.git./config` y `.git /config` son `.git/config` en Windows; `a.js::$DATA` y `a.js:x` son flujos alternativos; `GIT~1` puede ser el nombre corto de `.git`; `CON`, `NUL` y similares son dispositivos.
- **Arreglo:** se rechaza con `ruta_no_portable` cualquier segmento que termine en punto o espacio, contenga `< > : " | ? *` o caracteres de control, contenga `~` seguido de dígito, o sea un nombre de dispositivo.

### S3 — Credenciales legibles por el planificador (media, CWE-200)

- **Qué pasaba:** el planificador propone qué archivos leer como contexto. `config/credentials.json` o `src/client_secret.json` no estaban vetados para lectura y su contenido se habría enviado al proveedor de modelos.
- **Arreglo:** la lista vetada incluye ahora `**/credentials*`, `**/*secret*`, `*.p12`, `.aws/**`, `.ssh/**` y `.claude/**`, tanto para escribir como para leer.

### S4 — El barrido de huérfanos mataba contenedores ajenos (media, disponibilidad)

- **Qué pasaba:** al arrancar se eliminaban todos los contenedores con la etiqueta `forge.sandbox=1`, incluidos los de otra sesión de FORGE en marcha en el mismo equipo.
- **Arreglo:** cada contenedor lleva además `forge.proyecto=<huella de la ruta>` y el barrido se limita a esa etiqueta.

### S5 — Un comando inexistente contaba como fallo de las pruebas (baja)

- **Qué pasaba:** con el `ENTRYPOINT` de la imagen, un ejecutable inexistente devolvía 1 en lugar de 127.
- **Arreglo:** `--entrypoint` explícito.

Todos tienen test de regresión en `tests/ciclo-protocolo.test.js`, `tests/sandbox-politica.test.js` y `tests/sandbox-real.test.js`.

## Comprobado sin hallazgos

| Aspecto | Resultado |
|---|---|
| Traversal (`../`), rutas absolutas, UNC, carpeta vecina con el mismo prefijo | Rechazados |
| Enlace simbólico dentro del proyecto que apunta fuera | Rechazado (se resuelve el antepasado real) |
| Inyección de opciones en `docker run` | Sin shell; imagen, nombre, copia y ejecutable no pueden empezar por `-`; nombres de variables de entorno validados |
| Red dentro del contenedor | Solo interfaz `lo`; comprobado con Node y con Python |
| Privilegios | uid 1000, sin capacidades, `no-new-privileges` |
| Escritura fuera de la copia | Raíz de solo lectura; `/deps` no escribible; `/tmp` sin ejecución |
| Secretos en la copia de trabajo | `.env*`, claves, `secrets/`, `.git`, `.sdd` no se copian |
| El contenedor no ve el proyecto real | Solo se monta la copia; lo que escribe se descarta |
| Contaminación de prototipos al interpretar la salida | Solo se leen `ruta` y `contenido` |

## Riesgos residuales

| # | Riesgo | Gravedad | Nota |
|---|---|---|---|
| R-A | **Un contenedor no es una frontera fuerte.** Comparte núcleo con el anfitrión; una vulnerabilidad de Docker o del núcleo rompería el aislamiento | Media | Inherente a ADR-02. La documentación ya no promete lo contrario |
| R-B | **La fase de preparación ejecuta código de terceros con red.** `pip install` ejecuta el `setup.py` de los paquetes sin rueda; `npm` va con `--ignore-scripts` | Media | Ocurre dentro del contenedor de construcción, no en el anfitrión. Solo instala lo que declara el manifiesto, que un agente no puede cambiar sin revisión |
| R-C | **Sin cuota de disco en la copia de trabajo.** El código en ejecución puede llenar el disco del anfitrión escribiendo en ella | Media | Acotado por el tiempo máximo (120 s). Mitigación posible: `--storage-opt` o un volumen con tamaño |
| R-D | **`redactar` cubre patrones comunes, no todos.** Un secreto con otro formato impreso por las pruebas llegaría a eventos, puntos de guardado y al proveedor | Baja | Los secretos del proyecto no entran en la copia, así que las pruebas no deberían tenerlos |
| R-E | **El contenido de los archivos no se inspecciona.** Un agente puede escribir código dañino dentro del proyecto en una ruta permitida; solo se ejecuta aislado, pero queda en tu repositorio | Media | Es el propósito del ciclo. La defensa es revisar el diff antes de hacer commit |
| R-F | **Inyección de instrucciones desde el repositorio.** El contexto que lee un agente puede contener texto que lo desvíe | Media | Limitado por lo anterior: lo que el agente puede hacer es proponer archivos, y esos pasan por el confinamiento |
| R-G | **Imagen base por etiqueta, no por digest.** `node:22-alpine` y `python:3.12-slim` pueden cambiar | Baja | ADR-03 pedía fijarlas por digest en la configuración; no está hecho |
| R-H | **Sistemas de archivos que distinguen mayúsculas (Linux).** Las comparaciones sin mayúsculas rechazan de más (`.GIT/` aunque sea otra carpeta) | Informativa | Rechazar de más es el lado seguro |

## Recomendaciones

1. Pasar la revisión del agente `seguridad` sobre este mismo alcance.
2. Fijar las imágenes base por digest (R-G).
3. Valorar una cuota de disco para la copia (R-C).
4. Revisar siempre el diff de una tarea completada antes de hacer commit (R-E).


---

# Segunda revisión: independiente (agente `seguridad`)

> Veredicto: **RECHAZADO**. Reprodujo ejecución de comandos en el anfitrión con rutas que pasaban la validación. La revisión anterior de este documento no lo detectó: sus arreglos S1 y S2 (mayúsculas y nombres de Windows) cerraban lo que decían, pero la lista de rutas vetadas seguía anclada a la raíz. Esto es una lección: **la revisión del propio autor no sirve como revisión de seguridad.**

## Hallazgos y estado

| # | Gravedad | Hallazgo (reproducido) | Estado |
|---|---|---|---|
| C1 | Crítica | `.git` solo vetado en la raíz. `sub/.git/config` con `fsmonitor = "echo …"`, o un archivo `.git` con `gitdir:`, hacían que `git status` ejecutara el comando en el anfitrión. También bajo `tests/` con el rol de pruebas, y para `.claude`, `node_modules`, `secrets`, `.ssh` | **Corregido**: veto por segmento a cualquier profundidad (`SEGMENTOS_VETADOS`). Tests en `tests/ciclo-hallazgos.test.js` |
| A1 | Alta | Se podían escribir archivos que el anfitrión ejecuta solo: `.husky/*`, `.npmrc`, `.yarnrc.yml`, `npm-shrinkwrap.json`, `.mcp.json`, `.vscode/tasks.json`, `.eslintrc.js`, `conftest.py`, `jest.config.js`, `.github/workflows`, `CLAUDE.md`… | **Corregido** con la lista como política: manifiestos ampliados y toda la configuración ejecutable exigen revisión humana. **Sigue siendo una lista** |
| A2 | Alta | Enlaces: un enlace roto permitía crear archivos fuera del proyecto (Linux); un enlace interno a `.env` o `.git` eludía los vetos, y el recuperador lo leía | **Corregido**: se rechaza el enlace como destino (también roto) y las reglas se aplican a la ruta real. El caso del enlace roto de archivo solo se probó en Linux por el auditor; en Windows el test se salta sin privilegios |
| A3 | Alta | Secretos no cubiertos llegaban al proveedor y a los puntos de guardado: `.npmrc`, `.netrc`, `id_rsa`, `*.pfx`, `*.tfstate`, `.docker/config.json`, `gcp-key.json`… Una prueba escrita por el agente imprimió un `.npmrc` íntegro | **Corregido**: una sola lista para escribir, leer contexto y copiar; copia ampliada |
| M1 | Media | Una prueba que creaba un enlace (`symlinkSync('..', 'x')`) rompía el borrado de la copia en Windows, lanzaba y bloqueaba las ejecuciones siguientes | **Corregido**: carpeta única por ejecución y borrado tolerante. Test con Docker real |
| M2 | Media | El "pass" es falsificable: `src/suma.js = process.exit(0);` da éxito. También por `jest.config.js`, `conftest.py` y pruebas con nombres no reconocidos | **Parcial**: cerradas la configuración del ejecutor y los nombres de prueba (`test.js`, `foo_test.js`, `tests.py`). **La vía del `process.exit(0)` sigue abierta** y está documentada. Un arreglo real exige leer un informe del ejecutor (TAP o JUnit), que cambiaría el principio de decidir solo por el código de salida |
| M3 | Media | El respaldo se corrompía con la misma ruta en otra capitalización: abortar no devolvía el original | **Corregido** |
| M4 | Media | Tras una sesión del ciclo, un `forge run` clásico ejecutaba en el anfitrión (con `execSync`) el código que dejó el modelo | **Corregido**: el modo clásico se niega sobre una sesión sin terminar y `resume` usa el ciclo si hay puntos de guardado |
| M5 | Media | El `runId` de `sesion.json` y el `cwd` de un punto de guardado se usaban sin validar: un repositorio hostil con `.sdd/motor/` podía hacer borrar carpetas fuera | **Corregido**: `runId` solo `\w[\w.-]*`, y el punto debe pertenecer a esta sesión y proyecto |
| M6 | Media | El rol de pruebas escribía más que pruebas (`src/spec/prod.js`, `tests/conftest.py`, `tests/.npmrc`) | **Corregido**: la carpeta de pruebas solo cuenta en la raíz |
| B1 | Baja | Rutas como `src` (directorio) o `src/a.js/b.js` lanzaban y abortaban `forge run` | **Corregido**: se registran como rechazo |
| B2 | Baja | Candado robable con archivo vacío; carrera al retirar un candado huérfano (27 de 150 en la prueba de la verificación) | **Corregido**: candado por enlace duro y `rename`. Prueba de carrera con 12 rondas de dos procesos: nunca lo toman los dos |
| B3 | Baja | `redactar` no cubría `DB_PASSWORD=`, JSON, `sk_live_`, `xoxb-`, JWT, `npm_`, URLs con credenciales, `Authorization: Basic`; una clave PEM cortada por el recorte pasaba | **Corregido** y se redacta antes de recortar. Sigue sin ser una frontera |
| B4 | Baja | Sin límite de disco ni de `ulimit`; `-v` roto con `:` en la ruta | **Parcial**: `--ulimit`, `--pull never` y `--mount`. **Sin cuota de disco** |

## Riesgos residuales

- **R-A** Un contenedor no es una frontera fuerte. Sin cambios.
- **R-B** La fase de preparación ejecuta código de terceros con red (`pip` ejecuta `setup.py`). npm va con `--ignore-scripts`. Sin cambios. El auditor no pudo comprobarlo con `docker build` y señala que `requirements.txt` admite `--index-url`.
- **R-C** Sin cuota de disco: 100 MB por archivo, pero no en total.
- **R-E** El contenido de un archivo permitido no se inspecciona: un agente puede escribir código dañino en `src/`.
- **R-F** La inyección de instrucciones desde el repositorio queda acotada, no eliminada.
- **R-G** Imágenes base por etiqueta, no por digest. El auditor señala además que el copiador de manifiestos sigue enlaces simbólicos.
- **R-I (nuevo)** **La lista de configuración ejecutable es incompleta por naturaleza.** Lo que no esté en ella se escribe.
- **R-J (nuevo)** **`process.exit(0)` falsifica un éxito** (M2).

## Qué no se pudo comprobar

- Enlaces simbólicos de archivo en Windows (sin privilegio); solo Linux por el auditor.
- macOS/APFS (plegado Unicode de `ſ`).
- Que VS Code, husky, ESLint o pytest ejecuten de verdad lo que se escribe en A1.
- `docker build` de `preparar-imagen.js` con red hostil.
