# Puertas de calidad en `fragua verificar`
> Tipo: Referencia
> Última revisión: 2026-11-10 contra el commit 55a9dd9

Una **puerta** es una comprobación adicional que el proyecto declara (tipos, linter, seguridad, cobertura) y que corre en el **mismo contenedor sin red** que las pruebas. Decide solo el **código de salida** de su comando. Spec: `.sdd/especificaciones/2026-10-14-puertas-de-calidad-y-evidencia/` (fase B1). Corren en `fragua verificar` y, en el ciclo, dentro del nodo `sandbox`, tras las pruebas. Si una puerta no pasa, la tarea vuelve al implementador con la salida de la puerta; solo una herramienta ausente (código 127) pide revisión humana. Todavía no hay un evento `ciclo:puerta`.

## Declararlas

En `.sdd/sdd.config.yaml`, sección `puertas:` con una clave por puerta, dos espacios de sangría y un comando:

```yaml
puertas:
  tipos: tsc --noEmit
  linter: eslint . --max-warnings 0
  seguridad: semgrep --config policy.yml --error
  cobertura: c8 --check-coverage --lines 80 node --test
  timeout_s: 60            # opcional; solo puede BAJAR el tope
```

- Claves de comando, en este orden fijo de ejecución: `tipos`, `linter`, `seguridad`, `cobertura`. Máximo cuatro puertas.
- Claves de tope (opcionales, **solo bajan**): `timeout_s` (cada puerta), `timeout_total_s` (todas juntas), `salida_max_bytes`.
- **Cualquier otra clave es un error con su línea**, no se ignora. No existe clave para quitar, relajar o sustituir las pruebas, el aislamiento sin red, el rojo obligatorio, la redacción ni el tope de gasto: una puerta solo añade exigencias.
- No hay `cobertura_minima`: el umbral va dentro del comando de `cobertura` (la herramienta lo hace cumplir y sale distinto de 0 si no llega). No hay forma genérica de pasar un umbral a cualquier herramienta, y no se lee un número de la salida.
- El comando se divide en palabras respetando comillas (`dividirComando`): **sin intérprete de órdenes**, sin `&&`, `|`, `;`, `>`, `<`, `&`. Un intérprete como primera palabra (`sh -c "a && b"`, `bash`, `cmd`, `powershell`) se rechaza aunque la comilla agrupe.
- Comentarios: `# nota` separado por un espacio se descarta. Un `#` pegado al comando (`--config a#b`) es un **error** (el lector plano de `core/ciclo/config.js` lo truncaría en silencio); si lo necesitas, pon el valor entero entre comillas: `seguridad: 'semgrep --config a#b'`. Las comillas del valor se quitan solo si envuelven **todo** el valor; `tsc -p "dir con espacios/tsconfig.json"` conserva sus comillas.

## Qué hace `fragua verificar` con ellas

1. Lee `puertas:` **antes** de tocar Docker. Un error de la sección es un rechazo (`falla`, código 1) y no se ejecuta nada.
2. Ejecuta las pruebas. **Solo si pasan** corren las puertas, **una a una**, en el orden fijo, cada una como un clon del ejecutor de las pruebas que cambia solo el comando. `argvRun` fija sin red, sin privilegios, sin capacidades y los límites: la puerta aporta únicamente un comando.
3. Cada puerta se clasifica por su código de salida (nunca por el texto): `pass`, `fail`, `timeout`, `infra_error` y `no_ejecutable` (código 127: la herramienta no está en la imagen; sin red no se instala, debe estar en las dependencias del proyecto). Si el aislamiento falla en una puerta no se lanzan las demás (`no_ejecutada`); si se agota el tiempo total, tampoco.
4. Nada que no sea `pass` es éxito. Una puerta rota da `falla` (código 1) con el nombre de la puerta en el motivo; un fallo del aislamiento da `infraestructura` (código 4). Con una puerta rota no se mide la mutación.
5. El resultado lleva un bloque opcional `puertas` (esquema `resultado-verificar` 1.2; `formato` sigue siendo 1): `declaradas`, `topes`, `ejecutadas`, `motivo`, `resultados[]` con nombre, comando redactado, categoría, código de salida, duración y salida acotada y redactada. Sin sección `puertas:` el bloque no aparece y el resultado es el de siempre.
6. Con `--registrar`, el bloque `puertas` y un resumen en `evidencia.puertas` entran en el informe y en su `sha256`: retocar una puerta rompe la cadena (ver `docs/cadena-de-evidencia.md`).

## Criterios de aceptación sin prueba

`fragua verificar --criterios` cruza los identificadores `CA-xxx-yy` de la `spec.md` activa con los `cubre_cas` de las tareas y con los archivos de prueba del proyecto. Solo lee archivos y compara texto: no llama a ningún modelo y no ejecuta nada.

- **sin tarea**: ninguna tarea cubre el criterio.
- **sin prueba**: una tarea lo cubre, pero ningún archivo de prueba contiene su identificador (en un comentario o en el nombre de la prueba). El agente de pruebas recibe en su prompt los criterios de la tarea y la instrucción de citarlos.
- Por defecto solo informa (código 0). Con `--exigir-cobertura-de-criterios`, un criterio sin tarea o sin prueba da el código 1. `--json` devuelve la matriz.
- **Límite:** citar un identificador no demuestra que la prueba lo compruebe; solo que alguien la enlazó. La calidad de la prueba la mide la mutación. A nivel de proyecto cuenta **cualquier** archivo de prueba que lo cite, aunque sea de otra especificación (los identificadores se repiten entre especificaciones). Se leen como máximo 2000 archivos de hasta 1 MiB, se omiten `node_modules`, `vendor`, `.venv` y similares y no se siguen enlaces. Lee las dos fuentes de tareas del ciclo (`.sdd/estado-tareas.json` y el de la especificación). Una especificación sin criterios con la forma `CA-xxx-yy` no tiene nada que cruzar: con `--exigir-cobertura-de-criterios` eso es un error, no un éxito.

## Lo que no debe cambiar (`no_cambiar`)

Una tarea puede declarar `no_cambiar`: una lista de archivos de prueba que ya existen y deben pasar antes y después del cambio (`.estado-tareas.json`: `"no_cambiar": ["tests/legado.test.js"]`).

1. Se validan al empezar: lista de textos no vacía, hasta 20 rutas relativas con caracteres seguros, que existan dentro del proyecto sin pasar por enlaces, que sean archivos de prueba y que contengan alguna prueba reconocible (un archivo sin ninguna saldría con 0 sin comprobar nada). Un comando de pruebas con `--passWithNoTests` o similares no vale. Algo distinto no se acepta en silencio: la tarea pide revisión humana (motivo `regresion`) con el mensaje.
2. **Antes de implementar** se ejecutan en el mismo contenedor sin red (el comando de pruebas del proyecto con esas rutas añadidas; con `npm`, tras `--`). Si ya fallan, la tarea pide revisión humana: no se parte de una línea base roja. Una vez en verde queda anotado en el estado.
3. **Después de implementar**, y solo si pasan las pruebas de la tarea, se vuelven a ejecutar como una puerta más. Si alguna falla, la ejecución es `fail` con el motivo «Regresión» y la lista de lo declarado, y vuelve al implementador.
4. Ni el implementador ni el agente de pruebas (ni el refuerzo) pueden modificar esos archivos (`prueba_inmutable`). Si tras implementar la declaración deja de ser válida (p. ej. se borró un archivo), la ejecución también es `fail`. Una herramienta ausente (127) pide revisión humana en vez de gastar iteraciones.
- **Límite:** la lista dice qué archivos se ejecutan, no cuál de ellos se rompió; la salida acotada lo indica. Declarar una lista irrelevante oculta regresiones: revisa la lista al aprobar la tarea. Probado con un ejecutor falso; con Docker real, sin medir.

## Topes

Valor por defecto / techo (ni el entorno del usuario lo supera): `timeout_s` 120 / 600, `timeout_total_s` 300 / 900, `salida_max_bytes` 262144 / 1048576. Además, cada puerta respeta el `sandbox.timeout_s` del ejecutor. El usuario los fija con `FRAGUA_PUERTAS_TIMEOUT_S`, `FRAGUA_PUERTAS_TIMEOUT_TOTAL_S` y `FRAGUA_PUERTAS_SALIDA_MAX_BYTES` (o `FORGE_...`). El proyecto solo puede bajarlos: si pide más, se ignora y se avisa.

## Por qué no hay `--sin-puertas`

Decisión con evidencia (`tests/puertas-verificar.test.js` «no existe forma de saltarlas desde la línea de comandos»): `fragua verificar` ya rechaza cualquier opción desconocida con código 1 sin ejecutar nada, igual que no existe `--sin-aislamiento`. Quien declara una puerta la exige a todos, incluido un agente que ejecute el comando; si el dueño quiere verificar sin ella, edita la sección. Tampoco hay variable de entorno que las desactive (el entorno del usuario solo fija topes). `--comando` cambia las pruebas, no las puertas.

## Límites (sin adornos)

- Una puerta mide lo que su herramienta mide. Un comando que siempre sale con 0 pasa; la revisión humana de la sección `puertas:` es el control.
- El implementador no puede escribir `tsconfig.json`, `biome.json`, `mypy.ini`… (lista en `core/evidencia/protegidos.js`, cableada a `clasificarRuta`). Sí puede escribir lo que esos archivos extienden o referencian si la lista no lo conoce (p. ej. un tsconfig que se extiende con `extends`).
- Un envoltorio que no esté en la lista de intérpretes (`env sh`, `xargs sh`) no se rechaza; dentro del contenedor sigue sin red ni privilegios.
- Probado con el Docker falso. El 127 de Docker real y el tiempo de varias ejecuciones en serie no están medidos (`FORGE_TEST_DOCKER=1`, fase F8.2).
- Una puerta que necesita red (descargar reglas) falla por diseño.
- `core/ciclo/mutacion.js` conserva su propia copia del patrón «mismo ejecutor, otro comando»; unificarlas queda para cuando se libere ese archivo.
