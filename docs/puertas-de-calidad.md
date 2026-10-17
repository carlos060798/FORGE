# Puertas de calidad en `fragua verificar`

Una **puerta** es una comprobación adicional que el proyecto declara (tipos, linter, seguridad, cobertura) y que corre en el **mismo contenedor sin red** que las pruebas. Decide solo el **código de salida** de su comando. Spec: `.sdd/especificaciones/2026-10-14-puertas-de-calidad-y-evidencia/` (fase B1). En esta fase las puertas viven en `fragua verificar`; su integración en el ciclo (nodo y enrutador) es la fase siguiente.

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

## Topes

Valor por defecto / techo (ni el entorno del usuario lo supera): `timeout_s` 120 / 600, `timeout_total_s` 300 / 900, `salida_max_bytes` 262144 / 1048576. Además, cada puerta respeta el `sandbox.timeout_s` del ejecutor. El usuario los fija con `FRAGUA_PUERTAS_TIMEOUT_S`, `FRAGUA_PUERTAS_TIMEOUT_TOTAL_S` y `FRAGUA_PUERTAS_SALIDA_MAX_BYTES` (o `FORGE_...`). El proyecto solo puede bajarlos: si pide más, se ignora y se avisa.

## Por qué no hay `--sin-puertas`

Decisión con evidencia (`tests/puertas-verificar.test.js` «no existe forma de saltarlas desde la línea de comandos»): `fragua verificar` ya rechaza cualquier opción desconocida con código 1 sin ejecutar nada, igual que no existe `--sin-aislamiento`. Quien declara una puerta la exige a todos, incluido un agente que ejecute el comando; si el dueño quiere verificar sin ella, edita la sección. Tampoco hay variable de entorno que las desactive (el entorno del usuario solo fija topes). `--comando` cambia las pruebas, no las puertas.

## Límites (sin adornos)

- Una puerta mide lo que su herramienta mide. Un comando que siempre sale con 0 pasa; la revisión humana de la sección `puertas:` es el control.
- El implementador aún puede debilitar `tsconfig.json`, `biome.json`, `mypy.ini`… en el ciclo: `core/evidencia/protegidos.js` existe pero no está cableado a `protocolo-archivos.js` (fase siguiente).
- Un envoltorio que no esté en la lista de intérpretes (`env sh`, `xargs sh`) no se rechaza; dentro del contenedor sigue sin red ni privilegios.
- Probado con el Docker falso. El 127 de Docker real y el tiempo de varias ejecuciones en serie no están medidos (`FORGE_TEST_DOCKER=1`, fase F8.2).
- Una puerta que necesita red (descargar reglas) falla por diseño.
- `core/ciclo/mutacion.js` conserva su propia copia del patrón «mismo ejecutor, otro comando»; unificarlas queda para cuando se libere ese archivo.
