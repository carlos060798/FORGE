# Spike T001 — Guardador e interrupción con LangGraph.js

> Fecha: 2026-10-03 | Entorno: Windows 11, Node 24.20.0 | Resultado: **viable**
> Código: `T001-langgraph.mjs` (junto a este archivo). Se ejecutó en un directorio temporal, fuera del repo.

## Qué se probó

Un grafo `coder → sandbox → (coder | revision)` con un guardador en archivos, en tres situaciones:

1. Ejecución hasta la interrupción del nodo `revision`.
2. Reanudación **en otro proceso** con `Command({ resume })`.
3. Corte del proceso (`process.exit`) a mitad del ciclo y reanudación con `invoke(null, config)`.

## Resultados

| Pregunta | Resultado | Evidencia |
|---|---|---|
| ¿Versiones y requisitos? | `@langchain/langgraph` 1.4.19 (Node ≥18), `@langchain/core` 1.2.14 (**Node ≥20**), `@langchain/langgraph-checkpoint` 1.1.5 | `package.json` de cada paquete instalado |
| ¿Peso de la instalación? | 22 paquetes, 59 MB en `node_modules` | `npm install @langchain/langgraph` en directorio vacío |
| ¿Costo de carga? | Alrededor de 1,1 s el primer `import()` | Medido una vez; justifica la carga perezosa |
| ¿Interrumpe y devuelve el motivo? | Sí: `invoke` devuelve `__interrupt__[0].value` con el objeto pasado a `interrupt()` y `getState().next` vale `["revision"]` | Salida del modo `run` |
| ¿Reanuda en otro proceso? | Sí. Los nodos anteriores no se repiten | Traza: `coder, sandbox, coder, sandbox, revision:entrada` y, tras reanudar, solo `revision:entrada, revision:decidida=abortar` |
| ¿El nodo que interrumpe se reejecuta desde el principio? | **Sí.** `revision:entrada` aparece dos veces | Confirma lo que asume ADR-11: el nodo no debe tener efectos antes de `interrupt()` |
| ¿Sobrevive a un corte del proceso? | Sí. Tras cortar en el segundo `coder`, `invoke(null, config)` repite solo ese nodo y sigue | Traza: `coder, sandbox, coder:CORTE, coder, sandbox, revision:entrada` |
| ¿Tamaño del punto de guardado? | Entre 5,9 y 7,3 KB para un estado pequeño tras 5 pasos | `bytesGuardados` |

## Contrato del guardador

`BaseCheckpointSaver` declara cinco métodos abstractos: `getTuple`, `list`, `put`, `putWrites` y `deleteThread`. `MemorySaver` añade lógica no trivial (migración de envíos pendientes, historial de canales delta).

La forma más barata de persistir resultó ser **heredar de `MemorySaver`** y volcar sus dos mapas (`storage` y `writes`) a un archivo con escritura atómica después de `put`, `putWrites` y `deleteThread`. Los valores serializados son `Uint8Array`, así que hay que codificarlos (aquí, en base64) para guardarlos como JSON. Son unas 25 líneas.

## Qué cambia en las decisiones

- **ADR-01 se mantiene.** LangGraph.js cubre ciclos, interrupción y reanudación sin código propio.
- **ADR-04 se ajusta.** El guardador no implementa `BaseCheckpointSaver` desde cero: hereda de `MemorySaver`. Consecuencia: depende de dos campos (`storage`, `writes`) que no son API documentada. Hay que fijar la versión menor y cubrirlo con un test que falle si cambian.
- **ADR-11 se mantiene.** El nodo `revision_humana` no debe escribir nada antes de `interrupt()`.
- **Motor propio.** Tiene que ofrecer la misma semántica comprobada aquí: guardar tras cada nodo, repetir solo el nodo interrumpido o cortado.

## Sin verificar

- Comportamiento en **Node 18**: en este equipo solo hay Node 24. Falta comprobar en CI que `npm install` termina (se espera solo un aviso de versión) y que el `import()` perezoso falla de forma controlada.
- Dos reanudaciones simultáneas del mismo hilo: el guardador de este spike no bloquea. El bloqueo por hilo es trabajo de T014.
- Tamaño del punto de guardado con el estado real del ciclo.

## Tareas afectadas

- **T006**: versiones a declarar en `optionalDependencies`: `@langchain/langgraph` `~1.4.19`. Suma 59 MB a la instalación, así que conviene añadirla junto con T027 y no antes.
- **T014**: implementar el guardador como subclase de `MemorySaver` para el motor LangGraph y como JSON por transición para el motor propio, con el mismo directorio.
- **T027**: sigue adelante.
