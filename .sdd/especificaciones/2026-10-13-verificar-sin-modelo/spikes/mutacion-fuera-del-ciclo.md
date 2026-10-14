# Spike S0.1: `medirMutacion` fuera de un ciclo en curso

Fecha: 2026-10-13. Solo lectura de código. Archivos: `core/ciclo/mutacion.js` (1216-1505), `core/ciclo/pruebas-confiables.js` (nodo `mutacion`), `core/ciclo/nodos.js`, `core/ciclo/index.js`, `core/engine-cli.js`.

## Conclusión

**Sí se puede llamar sola.** `medirMutacion(entrada)` es una función exportada y autónoma. No lee ni escribe el estado del ciclo, ni el diario, ni el presupuesto, ni la configuración: eso lo hace el nodo `mutacion` (`pruebas-confiables.js`), su único llamador en `core/` (los tests la llaman directo: `tests/ciclo-mutacion.test.js`, `tests/mutacion-cobertura.test.js`). Se cumple la asunción de la spec (sección 9); HU-003 no hay que recortarla.

## Qué recibe

| Campo | Obligatorio | Qué es | Qué dar en `verificar` |
|---|---|---|---|
| `cwd` | sí | proyecto real | `--cwd` resuelto |
| `archivos` | sí | rutas relativas a mutar | `--archivos` o resultado de `--desde` |
| `runner` | sí | `{ test(cwd) }` | un `SandboxRunner` (ver abajo) |
| `max` | no (10) | alteraciones a probar | `motor.mutacion_max` |
| `maxArchivos` | no (5) | tope de archivos | `motor.mutacion_max_archivos` |
| `timeoutMs` | no (300 s) | tiempo desde que la copia está lista | `motor.mutacion_timeout_s * 1000` |
| `vetadas` | no | rutas protegidas | `leerRutasProtegidas(cwd)` (como `engine-cli`) |
| `originalDe(ruta)` | no | contenido previo del archivo | ver riesgo 2 |
| `excluir`, `cobertura`, `huellasPruebas`, `avance`, `alProbar`, `alAcotar`, `ahora`, `dirTemporal` | no | | omitir; `alProbar` solo para progreso |

Devuelve `ResultadoMutacion` (`probadas`, `detectadas`, `noConcluyentes`, `puntuacion`, `parcial`, `motivoParcial`, `lineaBase`, `sinCobertura`, `sobrevivientes`, `porArchivo`, `rechazadas`...) o **`null`** si no hay ninguna alteración posible.

## Qué necesita de cada cosa

- **Estado del ciclo**: nada. El nodo solo extrae `estado.cwd`, `estado.implementacion.archivos`, `estado.pruebas.archivos` (huellas) y `estado.mutacion.refuerzos`.
- **Diario**: nada. `alProbar` es un callback opcional (el nodo lo conecta a `log.append('ciclo:mutante', ...)`).
- **Presupuesto**: nada. No hay llamadas a modelo; el coste es tiempo de contenedor (`timeoutMs`).
- **Sandbox**: el `runner`. La función lee `runner.o` (`testCmd`, `lenguaje`, `runId`, `cli`, `dirMotor`) para clonar el runner con el reporter TAP de node:test (`comandoConReporterTap`) y con el comando de cobertura (`ejecutorConComando`). **Debe ser un `SandboxRunner` real** (o un doble con `o` y `conComando`); un objeto `{ test }` pelado funciona, pero mide sin TAP ni cobertura (falla cerrado: `sinCobertura: true`).
- **Configuración**: nada directamente; los topes llegan como parámetros. `leerConfigCiclo` tolera la ausencia de `.sdd/sdd.config.yaml` (valores por defecto).
- **Disco**: crea `mkdtemp(os.tmpdir()/forge-mutacion-*)` con marca y la borra siempre; al empezar llama `barrerMutacionesHuerfanas`. No escribe en el proyecto. Sus importaciones (`acorn`, `router`, `redactar`, `protocolo-archivos`, `staging`, `sandbox-runner` solo para `dividirComando`) no tocan proveedores de modelo; la prueba estática de F1.5 lo confirmará.

## Qué hay que proporcionar

1. Un `SandboxRunner` con `lenguaje` y `testCmd` (de `--comando` o detectado).
2. Archivos ya resueltos (relativos, con `/`).
3. Topes `motor.*` (o sus valores por defecto).
4. Qué significa `null`, `lineaBase !== 'ok'` y `parcial` para el veredicto (el router usa `decidirTrasMutacion`; reutilizar `detalleMedicionInsuficiente` y `detallePruebasDebiles`).
5. Aplicar `mutacion_min_concluyentes` fuera de la función: ella no lo conoce.

## Detección de lenguaje y comando

- `core/stack-detector.js` `detectStack(cwd)`: determinista, sin dependencia del ciclo. `package.json` -> js/ts (`npx vitest run`, `npx jest`, `npx mocha` o `npm test`); `pyproject/setup.py/requirements.txt` -> python (`python -m pytest` si `usaPytest(cwd)`, si no `python -m unittest discover`); `go.mod` -> go; `unknown` si no reconoce.
- `comprobarProyecto(cwd, lenguaje, testCmd)` (`core/sandbox/preparar-imagen.js:53`) devuelve el texto de rechazo (lenguaje no cubierto, Go sin `go.mod`, Python solo con `pyproject.toml`, pytest sin instalar) o `null`. Es exactamente CA-001-06: **`verificar` la llama tal cual**, con `--comando` como `testCmd`.
- `core/runners/` no interviene en el ciclo verificado.
- `comandoDePruebas`/`dividirComando` (en `sandbox-runner.js`) ya separan argumentos sin intérprete: `SandboxRunner.test` garantiza CA-001-02 si se le pasa `testCmd`.

## Cómo construye `engine-cli.js` el `SandboxRunner` (líneas 137-205)

1. `leerConfigCiclo(cwd)` -> `config.sandbox.{runtime,cpus,memoria,pids,timeout_s,salida_max_bytes}`.
2. `comprobarProyecto(...)`.
3. `runtimePermitido(config.sandbox.runtime)`; si `ok === false`, salida 4.
4. `cli = new DockerCli()`; `cli.disponible()`; si no, salida 4.
5. Con `runtime`: `cli.runtimeDisponible(runtime)`; si no, salida 4 (nunca el de por defecto).
6. `new SandboxRunner({ runId, dirMotor, cli, lenguaje, testCmd, descargarBase: true, limites: { cpus, memoria, pids }, timeoutMs: timeout_s*1000, salidaMaxBytes, runtime })`. **No pasa `excluir` ni `imagenBase`.**
7. `await sandbox.barrerHuerfanos()`, `sandbox.barrerCopias()`, `barrerMutacionesDeProcesosMuertos()`.

**Para no duplicar**: extraer de `prepararCiclo` una función `crearSandbox({ cwd, config, lenguaje, testCmd, cli, runId, dirMotor })` (p. ej. `core/ciclo/crear-sandbox.js`) con los pasos 2-7 y error tipado; `prepararCiclo` y `verificar` la usan. Refactor pequeño con test de equivalencia (hoy nada de esto está exportado). Alternativa mínima: copiar ~15 líneas con un test que compare las opciones. Recomendada la extracción.

## Riesgos

1. **Identidad del proyecto en el sandbox.** `SandboxRunner.proyectoId = sha256(resolve(dirMotor, '../../..'))` supone `dirMotor = <proyecto>/.sdd/motor/<runId>`. El plan (sección 5) pone la sesión en el temporal cuando no hay `.sdd/`; con `dirMotor = <tmp>/forge-verificar-X`, el `../../..` es común a todas las ejecuciones y `barrerHuerfanos()` de una **mataría los contenedores vivos de otra**. Solución: `dirMotor = <tmp>/forge-verificar-<hash(cwd)>/.sdd/motor/<runId>` (id estable por proyecto) y candado por proyecto antes de barrer (CA-004-03); probarlo.
2. **`originalDe`.** Sin él se altera el archivo entero (con `--archivos` es aceptable). Con `--desde` hay que darlo leyendo el blob de la referencia sin filtros (ver S0.2) para mutar solo lo cambiado; `null` si el archivo es nuevo.
3. **`null`**: nada que alterar (lenguaje sin cobertura de mutación, archivos sin nada alterable, todo fuera de lo cambiado). Debe ser "no concluyente", nunca éxito.
4. **Línea base**: se ejecuta otra vez dentro de la función (coste duplicado, aceptable). Si falla, `lineaBase: 'falla'`.
5. **Tiempo**: cada alteración es un `docker run`; `max=10` más reserva y cobertura son minutos. `timeoutMs` da `parcial: 'tiempo'`; con `--mutacion-minima` debe contar como no concluyente si `probadas < mutacion_min_concluyentes`.
6. **`sinCobertura`**: la muestra no se filtra por lo que ejecutan las pruebas. El ciclo solo lo trata como sin evidencia con `motor.mutacion: exigir`; en `verificar --mutacion-minima` debe tratarse igual (falla cerrado).
7. **Copias en el temporal** con código ajeno (0700): llamar `barrerMutacionesDeProcesosMuertos()` al empezar, como el ciclo.
8. **Carga**: `mutacion.js` es pesado (acorn); importarlo perezosamente solo con `--mutacion`.
9. **`runner.o`**: el clon usa `constructor` y `cli` del runner; un `SandboxRunner` con Docker falso funciona igual (los tests existentes lo usan).

## Cambios que sugiero

- Spec 9: convertir la asunción en hecho confirmado (citar este spike).
- Spec HU-003: añadir CA: `null` (nada que alterar) es "no concluyente"; CA-003-04: `sinCobertura` y `parcial` por tiempo también fallan cerrado con `--mutacion-minima`.
- Plan 3: añadir `core/ciclo/crear-sandbox.js` (extracción desde `engine-cli.js`) y una tarea previa a F1.2 con test de equivalencia.
- Plan 5: sustituir "carpeta de sesión en el temporal" por `dirMotor = <tmp>/forge-verificar-<hash(cwd)>/.sdd/motor/<runId>` + candado; añadir el riesgo 1 a la tabla de riesgos.
- Plan 4: hacer explícitos `comprobarProyecto`, `runtimePermitido` y `runtimeDisponible` en los pasos 2-3.
