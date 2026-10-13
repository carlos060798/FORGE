# Pruebas de ejecución en proyectos independientes

Esta guía explica cómo comprobar FORGE sobre proyectos que **no** son su repositorio, instalado como lo haría un usuario. Sirve para ver, antes de publicar, si el ciclo verificado funciona fuera del entorno donde se desarrolló.

## Qué comprueba y qué no

| Comprueba | No comprueba |
|---|---|
| Que el paquete empaquetado con `npm pack` contiene lo necesario y se instala | La integración continua en Linux (eso lo hace GitHub al abrir la solicitud de cambio) |
| Que `forge run --motor ciclo` arranca en un proyecto ajeno, usa Docker y termina o se pausa con un motivo | Proyectos grandes: los cinco de prueba son pequeños |
| Con modelo real: que un modelo resuelve la tarea, cuántas iteraciones y cuánto cuesta | Las integraciones con GitHub, GitLab y Jira (necesitan cuentas reales; ver `docs/integraciones-externas.md`) |
| Lo que ocurre con código existente, dos tareas encadenadas, Python y Go | Que el gasto calculado coincida con la factura: eso lo miras tú en la consola del proveedor |

## Requisitos

- Node 20 o superior y Docker en marcha (el ciclo no ejecuta código generado fuera de un contenedor).
- Para el modo real: una clave de un proveedor de pago en `ANTHROPIC_API_KEY`. **No la guardes en ningún archivo**; ponla solo en el entorno de la sesión.
- Conexión a internet la primera vez: se descargan las imágenes base de los contenedores y las dependencias del paquete.

## Paso 1: humo, sin gasto

```
node scripts/pruebas-independientes.mjs --modelo humo
```

Empaqueta FORGE, lo instala en una carpeta temporal, crea cinco proyectos y lanza el ciclo con el proveedor de pruebas. **No se espera «éxito»**: ese proveedor no resuelve tareas. Se comprueba que todo arranca y que cada proyecto termina con un motivo explicado, no con un error sin explicar. Cuesta 0.

Si falla aquí, no tiene sentido gastar: corrige primero. Los fallos típicos están en la sección «Si algo falla».

## Paso 2: una prueba real pequeña

```
set ANTHROPIC_API_KEY=...            (PowerShell: $env:ANTHROPIC_API_KEY='...')
node scripts/pruebas-independientes.mjs --modelo real --proyectos js-nuevo --tope 0.15
```

Un proyecto, nivel económico, tope de 0.15 USD. Si termina en `exito`, sigue con los demás.

## Paso 3: la tanda completa

```
node scripts/pruebas-independientes.mjs --modelo real --tope 0.30
```

Los cinco proyectos con tope de 0.30 USD cada uno. **El gasto máximo posible es el tope por el número de proyectos** (1.50 USD con los valores anteriores); en la práctica, con el nivel económico, cada proyecto cuesta entre 0.02 y 0.15 USD. Para tareas más difíciles usa `--nivel sonnet`.

## Los proyectos de prueba

| Nombre | Qué ejercita |
|---|---|
| `js-nuevo` | JavaScript desde cero: una función con casos borde |
| `js-existente` | Código existente: un cambio que toca dos archivos sin nombrarlos y no debe romper las pruebas que ya había |
| `py-pytest` | Python con `pytest` declarado en `requirements.txt` |
| `go-modulo` | Go con módulo, Unicode y pruebas de tabla |
| `dos-tareas` | Dos tareas encadenadas: la segunda usa el módulo de la primera |

## Cómo leer el informe

El script escribe `informe.md` e `informe.json` en la carpeta de salida y los muestra en pantalla.

| Resultado | Qué significa | Qué hacer |
|---|---|---|
| `exito` | El ciclo terminó y las pruebas pasaron en el contenedor | Revisa el código generado en la carpeta del proyecto |
| `pausa: iteraciones` | Se agotaron las iteraciones sin que pasen | Mira las pruebas que escribió el agente: con el nivel económico a veces tienen valores esperados erróneos. Prueba `--nivel sonnet` |
| `pausa: sin_progreso` | La misma salida varias veces seguidas | Probablemente pruebas rotas por sí mismas |
| `pausa: presupuesto` | Se alcanzó el tope | Sube `--tope` o revisa el gasto |
| `pausa: infraestructura` | Docker, la red o el proveedor fallaron | Mira el detalle del informe |
| `pausa: salida_invalida` | El modelo no devolvió el formato esperado | Repítelo; si se repite, es un hallazgo |

Cada carpeta de proyecto conserva `.sdd/events.jsonl` (qué pasó, paso a paso) y `.sdd/motor/` (puntos de guardado y libro de gasto). Se puede reanudar una pausa con `forge resume --cwd <carpeta>`.

## Si algo falla

| Síntoma | Causa probable |
|---|---|
| «Docker es obligatorio… no responde» | Docker no está en marcha; arráncalo y repite |
| `npm install del paquete falló` | Sin internet o registro bloqueado; comprueba la red |
| `pausa: infraestructura` con «Request was aborted» | El proveedor tardó más del tiempo máximo (120 s por defecto): configurable con `llm.timeout_s`. La llamada pudo cobrarse: el informe marca las llamadas con gasto estimado |
| Sin resultado en `go-modulo` y mucho tiempo | La primera vez, la imagen de Go se prepara con red y tarda varios minutos |
| Los proyectos fallan todos igual | Mira `informe.md`: la última salida de cada uno suele nombrar la causa |

## Después de las pruebas

- Compara el gasto calculado total con el saldo del proveedor, antes y después.
- Borra la carpeta de salida cuando termines (el script no la borra, para que puedas inspeccionarla).
- **Rota la clave** si la usaste en un equipo o sesión que no controlas.
- Si encuentras algo, guarda `informe.json` y el `.sdd/events.jsonl` del proyecto afectado (revisa antes que no lleven datos tuyos) y abre una incidencia con la plantilla `fallo.md`.
