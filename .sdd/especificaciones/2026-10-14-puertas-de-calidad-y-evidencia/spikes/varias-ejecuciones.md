# Spike S0.1: varias puertas con una sola preparación de imagen, y paralelismo

> Investigación de solo lectura (2026-10-17). Docker NO está disponible en el equipo de la investigación (`docker version` falla: no hay daemon), así que nada de lo que toca contenedores está medido: va marcado «sin confirmar».

## Lo que hace hoy `SandboxRunner`

- El comando va fijo en el constructor: `this.o.testCmd` (`core/sandbox/sandbox-runner.js:182`). `test(cwd)` no recibe comando.
- Cada `test()` repite: `disponible()` (`:146`), `prepararImagen` (`:159`), copia de trabajo nueva (`:173-176`) y `docker run` (`:197`). `prepararImagen` solo construye si `existeImagen` falla (`core/sandbox/preparar-imagen.js:164`); con la imagen ya hecha son un `docker image inspect` y poco más. La imagen se identifica por la huella de Dockerfile + manifiestos (`:159-162`), no por el comando: **varias puertas comparten imagen sin cambiar nada**.
- Ya existe el patrón «mismo ejecutor, otro comando»: `ejecutorConComando` en `core/ciclo/mutacion.js:1106-1113` (y `:1268`) clona `new runner.constructor({ ...o, testCmd: comando, runId: o.runId + '-cob', cli })`. Hereda límites, `runtime`, `timeout_s`, `imagenBase`; solo cambia el comando.

## Dónde y cómo ejecutar una puerta (decisión de diseño)

1. Un clon por puerta con `runId` distinto (`${runId}-puerta-tipos`, etc.). Nombre de contenedor único (`nombreContenedor`, `politica.js:324`); `proyectoId` sale de `dirMotor` (`sandbox-runner.js:131`), así que el barrido de huérfanos (`barrerHuerfanos`) de la sesión padre sigue alcanzándolos.
2. El comando de la puerta pasa por `dividirComando` (`sandbox-runner.js:42-63`): rechaza `&&`, `|`, `;`, `>`, `<`, `&` como palabra suelta. Cubre CA-001-05. Aviso: `sh -c "a && b"` produce `['sh','-c','a && b']` y NO se rechaza (la comilla agrupa). No rompe el aislamiento (sigue sin red, sin capacidades), pero la regla «sin shell» es de forma, no de fondo. Recomendación: documentarlo, o vetar como primer token `sh|bash|cmd|powershell` en puertas (sin confirmar si merece el coste).
3. **Las garantías fijas no son parametrizables por la puerta**: `argvRun` (`politica.js:350-402`) fija `--network none`, `--cap-drop ALL`, `no-new-privileges`, `--read-only`, usuario 1000, `--pull never`, `--ulimit`. La sección `puertas:` solo aportaría una cadena de comando (y un número de cobertura), nunca `limites`, `runtime`, `env` ni red. Basta con que `puertas.js` NO lea más claves que las cuatro/cinco y las pase al clon solo como `testCmd`.
4. **Hallazgo que afecta al plan (pre-existente)**: los límites del contenedor SÍ los fija el proyecto y no tienen techo. Experimento: un `sdd.config.yaml` con `sandbox: cpus: 64, memoria: 64g, pids: 99999, timeout_s: 99999, salida_max_bytes: 999999999` se lee sin aviso y llega tal cual a `argvRun` (`config.js` solo clampa `tope_usd`, `:389`; `sandbox` va por `convertir`). Un repositorio hostil afloja ya hoy CPU, memoria y tiempo. Para que «ninguna clave afloje una garantía fija» (CA-001-03) sea verdad hay que **poner techos a `sandbox.*`** (p. ej. cpus ≤ 4, memoria ≤ 2g, pids ≤ 1024, timeout_s ≤ 600), como se hizo con el tope de gasto, o la prueba exhaustiva de F1.2 miente por omisión.

## Serie o paralelo

- Serie, recomendado. Razones por código: `ultimaImagen` y `n` son estado del runner (`:133`, `:127`); dos construcciones simultáneas de la misma imagen (primera vez) competirían (`existeImagen` falso en ambas, `:164-171`); cada `docker run` ya pide `--cpus 1` (`LIMITES_POR_DEFECTO`, `politica.js:260`), así que paralelo multiplica la carga del equipo sin tope; y cada ejecución copia el proyecto entero a `staging` (`crearCopia`), N copias a la vez.
- El coste de la serie es N copias + N arranques (sin confirmar en tiempo). Mitigación sin cambiar el modelo: **tiempo total acotado** para las puertas (p. ej. `puertas.timeout_total_s`, nunca mayor que 600) además del `timeout_s` de cada una; sin él el peor caso es 4 × 120 s.

## Cómo clasificar el resultado de una puerta

- `clasificar` (`core/ciclo/router.js:19-29`) mapea 125, 126, 127 a `infra_error` (`CODIGOS_INFRA`, `router.js:12`). Con `--entrypoint <herramienta>` (`politica.js:398`), una herramienta ausente da 127 («executable file not found»): hoy sería `infra_error`, indistinguible de un Docker roto. Para CA-002-04 («puerta no ejecutable») hay que mirar el código 127 **antes** de `clasificar` y devolver `no_ejecutable` (sin confirmar que Docker devuelva 127 y no 125 en todas las plataformas: probar con Docker real, F8.2).
- `npx x` se reduce a `x` (`sandbox-runner.js:84`) y el PATH de la imagen incluye `/deps/node_modules/.bin` (`preparar-imagen.js:121`): `tsc`, `eslint` funcionan **solo si están en las dependencias del proyecto**; `node:22-alpine` no los trae. Herramientas externas (semgrep, bandit) no existirán: su puerta dará `no_ejecutable`. `npm ci --ignore-scripts` sí enlaza los binarios de `.bin` (sin confirmar con Docker).

## Qué cambia en la spec o el plan

- Plan §3/§4: la puerta es «un clon de `SandboxRunner` por puerta con `testCmd` = comando de la puerta» (reutiliza `ejecutorConComando`, mover esa función a un módulo común, no copiarla). Ejecución en serie, orden fijo.
- Plan §8 (riesgo coste): fijar `puertas.timeout_total_s` con techo; el paralelo se descarta, ya no es «solo si el spike lo permite».
- Spec RF de configuración: añadir como requisito previo el **techo de `sandbox.*`** (es cambio en `core/ciclo/config.js`, no en el sandbox).
- Mapeo de resultado: categoría nueva `no_ejecutable` fuera de `clasificar` (sin tocar `CODIGOS_INFRA` para no alterar el ciclo actual).

## Riesgos

- Medir tiempo y consumo real exige Docker: no medido. Una puerta que necesita red (descargar reglas) falla por diseño; debe quedar dicho en la guía.
- Cobertura: pasar «mínimo» a la herramienta depende de cada una (`c8 --check-coverage --lines N`, `pytest --cov-fail-under`); no hay forma genérica. Recomendación: en v1 la puerta de cobertura es un comando completo del usuario que ya incluye su umbral; `cobertura_minima` se difiere (sin confirmar si la spec lo exige).
