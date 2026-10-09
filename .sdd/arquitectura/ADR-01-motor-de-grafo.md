# ADR-01: Motor de grafo opcional detrás de un puerto

> Estado: reemplazada-por-ADR-18  # propuesta | aceptada | obsoleta | reemplazada-por-ADR-XX
> Fecha: 2026-10-03 (aceptada el 2026-10-05, por delegación del dueño)
> Spec relacionada: 2026-10-03-ciclo-verificado
> Autor: Claude (pendiente de aceptación por el dueño)

## Contexto

El ciclo verificado necesita un flujo con ciclos, puntos de guardado y pausa para revisión humana. El dueño eligió LangGraph.js. Dos hechos condicionan esa elección:

- `@langchain/langgraph` declara Node ≥18, pero su dependencia obligatoria `@langchain/core` declara Node ≥20. El repo declara `>=18` (`package.json:19-21`) y CI prueba 18, 20 y 22.
- El repo tiene dos dependencias y presume de instalación ligera.

## Decisión

Los nodos y el router se escriben como funciones puras `(estado, deps) => actualización`. El grafo se declara una vez, sin framework, en `core/ciclo/grafo.js`, y lo ejecutan dos motores intercambiables: `motores/langgraph.js` (carga perezosa, dependencia opcional) y `motores/propio.js` (sin dependencias). En Node <20, o si la carga falla, se usa el motor propio y se avisa.

**Estado tras implementar (2026-10-03).** Hay dos motores y los dos están hechos y probados con la misma suite:

- `motores/propio.js` (unas 50 líneas, sin dependencias): ciclos, punto de guardado tras cada nodo, pausa en revisión y reanudación.
- `motores/langgraph.js`: el mismo grafo sobre LangGraph.js, que es una **dependencia opcional** (`optionalDependencies`, `~1.4.19`) cargada de forma perezosa. `motor.grafo: auto` lo usa si está instalado y se puede cargar; si no (Node 18, o sin instalar), usa el propio sin avisar. `langgraph` lo exige y avisa si no puede; `propio` fuerza el propio.

Los dos comparten los puntos de guardado: una tarea pausada con uno se reanuda con el otro (probado en los dos sentidos). La suite del ciclo corre contra los dos (`FORGE_MOTOR_GRAFO`).

La decisión de integrar LangGraph la tomó el asistente interpretando una frase ambigua del dueño, y se revisó: el spike la dejó viable y la dependencia es opcional, así que su coste es ~59 MB solo para quien lo instale. Es reversible sin tocar nodos ni router: basta con quitar `motores/langgraph.js` y la dependencia.

## Alternativas consideradas

- **A. Solo LangGraph.js, subiendo `engines` a ≥20**: rechazada porque rompe la compatibilidad y exige versión MAYOR (Principio X).
- **B. Solo motor propio**: rechazada como opción principal porque obliga a escribir y mantener a mano interrupciones y reanudación. Se conserva como reserva.
- **C. Reescritura en Python con LangGraph**: rechazada por decisión del dueño (mejora incremental) y porque los docs del repo descartan Python como dependencia de sistema (`docs/INFORME-MEMORIA-OSS.md:47`).
- **D. LangGraph.js opcional detrás de un puerto, con motor propio de reserva**: aceptada porque respeta Node 18, el Principio IV y deja abierta la retirada.

## Decisión final (2026-10-05)

El dueño delegó esta decisión y se resuelve así: **LangGraph.js se queda como dependencia opcional**, con el motor propio como reserva, y se vuelve a evaluar en la FASE 5 (ciclo por defecto, 5.0.0).

Razones:
- Quitarlo no elimina ningún riesgo: es opcional, se carga de forma perezosa y con Node 18 se usa el motor propio sin avisos.
- Los dos motores comparten puntos de guardado, pasan las mismas suites y se reanudan entre sí; eso ya está probado.
- Hacerlo obligatorio obligaría a retirar Node 18 antes de haber probado el ciclo con un modelo de pago.

Coste asumido: mantener dos motores y su suite cruzada. Si en la FASE 5 solo se usa uno, se elimina el otro (5.2).

**Actualización (2026-10-09, ADR-18):** se cumplieron las dos condiciones de revisión y LangGraph.js se retiró en 5.0.0; queda el motor propio. Este ADR se conserva como historia.

## Consecuencias

### Positivas
- Node 18 sigue funcionando en modo clásico y con el motor propio.
- La lógica del ciclo se prueba sin el framework.
- Cambiar o retirar LangGraph no toca nodos ni router.

### Negativas
- Dos motores que mantener; la misma suite de comportamiento debe correr contra ambos.
- `optionalDependencies` puede emitir avisos de versión en Node 18 (sin verificar).

### Neutrales
- El formato del punto de guardado en disco es el mismo para ambos motores (ADR-04).

## Cuándo revisitar

- Si el spike T001 muestra que el motor propio cubre interrupciones y reanudación con poco código: valorar retirar LangGraph.
- Al retirar Node 18 (hito 5.0.0): valorar quedarse con un solo motor.

## Referencias

- `package.json:19-21`, `.github/workflows/ci.yml`
- Registro npm: `@langchain/langgraph@1.4.19`, `@langchain/core` (consultado el 2026-10-03)
