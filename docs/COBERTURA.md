# Cobertura de pruebas

> Medida el **2026-10-10** sobre el commit `9180814` de `feature/motor-agentico` (más el script nuevo de `package.json`, que no cambia código).
> Equipo: Windows 11, **Node v24.20.0**. Sin `FORGE_TEST_DOCKER`: las pruebas que piden Docker real no se ejecutaron.
> Una sola pasada. Es una foto de ese día: repite la medición antes de citarla.

## Cómo se mide

Sin dependencias nuevas. Node trae la medición integrada en su ejecutor de pruebas (opción `--experimental-test-coverage`, todavía marcada como experimental en Node 24).

```bash
npm run test:cobertura
```

que ejecuta exactamente:

```bash
node --test --experimental-test-coverage tests/*.test.js
```

El informe sale al final de la salida, entre `start of coverage report` y `end of coverage report`.

`npm run coverage`, que ya existía, mide lo mismo sobre la suite entera (`tests/`, `tests/e2e/` y `__tests__/`). No se usó para este documento.

## Resultado de la pasada

| | |
|---|---|
| Pruebas ejecutadas | 2004 |
| Pasan | 1996 |
| Fallan | 0 |
| Omitidas | 8 pruebas, más 9 bloques enteros cuyas pruebas no entran en el total |
| Duración | 143 s |
| Cobertura de todo lo cargado | 87,49 % de líneas · 82,47 % de ramas · 83,30 % de funciones |

De las 17 omisiones, 11 piden `FORGE_TEST_DOCKER=1` con Docker en marcha, 4 piden crear enlaces simbólicos de archivo (este Windows no lo permite), 1 comprueba permisos POSIX y 1 pide el cliente oficial de MCP instalado.

## Qué dice y qué no dice esta medición

- **Solo cuenta los archivos que alguna prueba llegó a cargar.** Un archivo que ninguna prueba importa no aparece con un 0 %: no aparece. En esta pasada no aparecieron 11 archivos de `core/`: los cuatro de `core/adapters/`, `checkpoint.js`, `complexity-reader.js`, `evaluator-optimizer.js`, `ir.types.js`, `project-memory.js`, `quality-gate.js` y `schemas/index.js`. No se midió si `tests/e2e/` o `__tests__/` los cargan.
- **El total del 87,49 % incluye archivos que no son del producto**: `tests/helpers.js` y dos scripts temporales que crean las propias pruebas.
- **Los 36 archivos de las cuatro carpetas de abajo sí aparecen todos.**
- **Una línea ejecutada no es una línea comprobada.** La cobertura dice que el código corrió durante las pruebas, no que una prueba fallaría si estuviera mal.
- **Sin Docker real.** Lo que en `core/sandbox/` y `core/mcp/servidor.js` solo se alcanza con un contenedor de verdad se ejercitó aquí con un ejecutor de Docker simulado, o no se ejercitó. Con `FORGE_TEST_DOCKER=1` las cifras de esas carpetas serán distintas; no se midieron.
- **En Windows.** Las ramas que solo corren en un sistema POSIX (permisos de la copia de trabajo) quedan sin cubrir en esta pasada.
- **No hay umbral.** La constitución deja la herramienta de cobertura y el umbral como decisión pendiente; este documento no fija ninguno.

## `core/ciclo/`

| Archivo | Líneas % | Ramas % | Funciones % | Líneas sin cubrir |
|---|---|---|---|---|
| `candado.js` | 97,96 | 76,92 | 100,00 | 81-82, 143 |
| `checkpoint-archivos.js` | 100,00 | 100,00 | 100,00 | |
| `config.js` | 99,03 | 97,08 | 100,00 | 292-294 |
| `contratos.js` | 100,00 | 100,00 | 100,00 | |
| `diario.js` | 100,00 | 88,89 | 100,00 | |
| `estado.js` | 100,00 | 83,87 | 100,00 | |
| `grafo.js` | 100,00 | 100,00 | 100,00 | |
| `herramientas-coder.js` | 99,55 | 89,90 | 100,00 | 246-247 |
| `huella.js` | 100,00 | 100,00 | 100,00 | |
| `index.js` | 98,03 | 93,04 | 97,50 | 74-78, 170-171, 354-355 |
| `motores/index.js` | 100,00 | 100,00 | 50,00 | |
| `motores/propio.js` | 96,49 | 94,74 | 100,00 | 33-34 |
| `mutacion.js` | 100,00 | 92,82 | 100,00 | |
| `nodos.js` | 98,74 | 91,28 | 100,00 | 176-178, 339-340, 455-456 |
| `presupuesto.js` | 100,00 | 98,15 | 100,00 | |
| `protocolo-archivos.js` | 100,00 | 95,42 | 100,00 | |
| `pruebas-confiables.js` | 98,87 | 69,77 | 100,00 | 164-165 |
| `redactar.js` | 100,00 | 90,00 | 100,00 | |
| `respaldo.js` | 100,00 | 95,12 | 100,00 | |
| `router.js` | 100,00 | 92,22 | 100,00 | |
| `sospecha.js` | 100,00 | 100,00 | 100,00 | |
| `turnos.js` | 99,36 | 90,43 | 100,00 | 138-139 |

## `core/sandbox/`

| Archivo | Líneas % | Ramas % | Funciones % | Líneas sin cubrir |
|---|---|---|---|---|
| `docker-cli.js` | 98,37 | 94,00 | 89,47 | 160-162 |
| `politica.js` | 100,00 | 97,56 | 100,00 | |
| `preparar-imagen.js` | 94,92 | 86,00 | 100,00 | 90-93, 98-99, 152-154 |
| `sandbox-runner.js` | 98,28 | 94,20 | 88,89 | 178-179, 230-231 |
| `staging.js` | 93,75 | 83,33 | 100,00 | 28-31, 94-95 |

## `core/mcp/`

| Archivo | Líneas % | Ramas % | Funciones % | Líneas sin cubrir |
|---|---|---|---|---|
| `herramientas.js` | 100,00 | 90,38 | 100,00 | |
| `protocolo.js` | 100,00 | 97,56 | 91,30 | |
| `servidor.js` | 80,85 | 55,56 | 80,00 | 28-29, 60-75 |

## `core/llm-providers/`

| Archivo | Líneas % | Ramas % | Funciones % | Líneas sin cubrir |
|---|---|---|---|---|
| `anthropic-provider.js` | 98,17 | 90,00 | 88,24 | 153-154, 194-195 |
| `index.js` | 95,68 | 87,23 | 100,00 | 130-135 |
| `ollama-provider.js` | 91,57 | 70,00 | 83,33 | 68-74 |
| `openai-provider.js` | 61,36 | 85,71 | 80,00 | 54-87 |
| `provider-interface.js` | 100,00 | 100,00 | 20,00 | |
| `stub-provider.js` | 85,84 | 88,89 | 100,00 | 90-100, 102-106 |

De los 36 archivos, 18 tienen el 100 % de líneas y 33 superan el 90 %.

## Los cinco archivos con peor cobertura de líneas

| # | Archivo | Líneas % | Qué queda sin cubrir |
|---|---|---|---|
| 1 | `core/llm-providers/openai-provider.js` | 61,36 | Líneas 54-87: **todo el cuerpo de `complete`**, es decir, la petición a `/chat/completions`, el tratamiento de una respuesta de error y la lectura del texto y del consumo (`usage`). Ninguna prueba llama a `complete` de este proveedor, ni contra un servidor simulado: el único uso en `tests/` comprueba que declara no admitir herramientas (`tests/ciclo-turnos.test.js`). El proveedor de OpenAI no tiene ninguna prueba automática de su llamada |
| 2 | `core/mcp/servidor.js` | 80,85 | Líneas 60-75: en la creación del ejecutor de `ejecutar_pruebas`, lo que viene después de comprobar que Docker responde, es decir, la comprobación de `sandbox.runtime` contra Docker y la construcción del ejecutor aislado. Solo se alcanzan con Docker real (prueba omitida sin `FORGE_TEST_DOCKER=1`). Líneas 28-29: la versión de reserva cuando no se puede leer `package.json`. Es también el archivo con menos ramas cubiertas de los 36 (55,56 %) |
| 3 | `core/llm-providers/stub-provider.js` | 85,84 | Líneas 90-100 y 102-106: dos de las respuestas enlatadas de `complete` del proveedor de pruebas (cuando el prompt habla de un IR o de una spec). Es código de apoyo a las pruebas del modo clásico, no del producto en uso real |
| 4 | `core/llm-providers/ollama-provider.js` | 91,57 | Líneas 68-74: el tratamiento de una respuesta de error de Ollama y la lectura de la respuesta. `complete` se llega a llamar, pero ninguna prueba de `tests/` simula el servidor de chat de Ollama (`/api/chat`). El informe no marca las líneas 75-82, que van justo después y devuelven el texto y el consumo: **la cifra de este archivo puede estar inflada**. Ramas: 70,00 % |
| 5 | `core/sandbox/staging.js` | 93,75 | Líneas 28-31: el cambio de permisos POSIX de la copia de trabajo (en Windows la función sale antes; la prueba que lo comprueba se omite). Líneas 94-95: el caso en que borrar la copia lanza un error |

El sexto es `core/sandbox/preparar-imagen.js` (94,92 %): quedan sin cubrir la detección de dependencias en `go.mod` y en un `package.json` ilegible (90-93, 98-99) y la descarga de la imagen base cuando falta (152-154).

Otras dos ordenaciones señalan archivos distintos:

- **Por ramas:** `core/mcp/servidor.js` (55,56 %), `core/ciclo/pruebas-confiables.js` (69,77 %, con el 98,87 % de líneas; las líneas 164-165 son el caso en que el agente de pruebas no escribe nada al reforzar, y el informe no dice qué otras ramas faltan), `core/llm-providers/ollama-provider.js` (70,00 %), `core/ciclo/candado.js` (76,92 %) y `core/sandbox/staging.js` (83,33 %).
- **Por funciones:** `core/llm-providers/provider-interface.js` (20,00 %: es la clase base y los proveedores redefinen casi todo lo que declara, así que solo una de sus cinco funciones se llega a ejecutar) y `core/ciclo/motores/index.js` (50,00 %: la función de aviso por defecto, que no hace nada, no llega a llamarse).

## Qué haría falta para subirla

Solo se describe; no se escribió ninguna prueba para este documento.

1. Una prueba de `OpenAIProvider.complete` y otra de `OllamaProvider.complete` contra un servidor HTTP local de pega, como las que ya existen para el proveedor de Anthropic con un cliente falso.
2. Ejecutar la medición con `FORGE_TEST_DOCKER=1` en un equipo con Docker, para saber la cobertura real de `core/sandbox/` y de `core/mcp/servidor.js`.
3. Ejecutarla en Linux, donde corren las ramas de permisos POSIX y las pruebas de enlaces simbólicos.
4. Decidir si se mide también con `npm run coverage` (suite entera) y si se fija un umbral, que hoy la constitución deja pendiente.
