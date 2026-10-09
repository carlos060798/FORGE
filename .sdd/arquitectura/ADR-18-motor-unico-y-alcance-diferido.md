# ADR-18: Un solo motor de grafo, y qué se difiere (LanceDB, Java, Rust, monorepos)

> Estado: aceptada  # propuesta | aceptada | obsoleta | reemplazada-por-ADR-XX
> Fecha: 2026-10-09 (aceptada por delegación del dueño)
> Spec relacionada: 2026-10-03-ciclo-verificado, 2026-10-04-memoria-semantica
> Autor: Claude
> Reemplaza: ADR-01 (motor de grafo con LangGraph.js opcional)

## Contexto

Al cerrar la FASE 5 quedaban cuatro puntos abiertos. El dueño delegó la decisión «según la documentación»:

1. ¿Se queda uno solo de los dos motores de grafo (el propio o LangGraph.js)?
2. ¿Se añaden Java, Rust y monorepos al ciclo?
3. ¿Se añade LanceDB como alternativa al índice vectorial?
4. ¿Se detecta mejor el `process.exit` escondido en el código generado?

## Decisión

### 1. Un solo motor: el propio. LangGraph.js se retira (5.0.0)
La documentación fijaba cuándo revisar esto (ADR-01, «Cuándo revisitar»): *«si el spike T001 muestra que el motor propio cubre interrupciones y reanudación con poco código»* y *«al retirar Node 18»*. Las dos condiciones se cumplen: el motor propio son 56 líneas, cubre reanudación, pausa y abortar, y Node 18 se retiró en ADR-17. Además el Principio IV pide dependencias mínimas, y LangGraph.js era una dependencia de unos 25 MB de la que el ciclo no usaba ninguna función propia (puntos de guardado, interrupciones y reanudación son nuestros). El único argumento a favor era la compatibilidad con el ecosistema (Studio, LangSmith), que nadie ha pedido y que costaba además desactivar el envío de estado a LangSmith.

Qué cambia: se elimina `core/ciclo/motores/langgraph.js` y la dependencia opcional; `motor.grafo` sigue aceptando `auto` y `propio`, y acepta `langgraph` con un aviso («se retiró en 5.0.0») para que una configuración antigua no falle. Los puntos de guardado en disco no cambian (ADR-04), así que lo pausado con cualquiera de los dos motores se reanuda.

Que la prueba con un modelo real no cambia esta decisión: los dos motores ejecutaban los mismos nodos con los mismos resultados.

### 2. Java, Rust y monorepos: se difieren
Cada lenguaje exige una imagen de Docker preparada con sus dependencias (como en Go, ADR-03), un modo de ejecutar las pruebas sin red y una verificación con Docker real que tarda minutos. Los monorepos exigen además decidir qué paquete se prueba. Ninguno estaba en la primera entrega acordada (JavaScript/TypeScript y Python; Go se añadió por sí mismo). Añadirlos sin verificar justo antes de un cambio de modo por defecto que ya está sin probar con un modelo real sumaría riesgo sin evidencia. Con un lenguaje no cubierto el ciclo se niega a empezar, lo explica y ofrece `--motor clasico`: es un fallo claro, no silencioso. Se retoman si hay un proyecto real que los necesite.

### 3. LanceDB: se descarta por ahora
ADR-14 eligió un índice vectorial propio en un archivo, sin dependencias, precisamente porque LanceDB exige un módulo nativo y Node ≥22, por encima del mínimo (Principio IV). Esa razón sigue siendo válida: Node 20 es el mínimo. El índice propio está acotado a 3000 archivos y 20 000 trozos; si un repositorio real lo supera, entonces habrá un caso para la alternativa, a través del puerto `Recuperador` (ADR-08), con su propia especificación. El embedder `hash` es léxico, no semántico: eso es un límite documentado, que LanceDB tampoco resolvería sin un modelo de embeddings.

### 4. `process.exit` escondido: se mejora con la cuenta de pruebas
Buscar la llamada solo se esquiva indentándola o metiéndola en una función. En lugar de perseguir cada forma, se compara lo que el agente de pruebas **escribió** (cuántas pruebas declara: `test(`, `it(`, `def test_`, `func Test`) con lo que el ejecutor **informa** (resúmenes de node:test, jest, unittest, pytest y mocha). Si informa menos de las escritas, la ejecución se cortó antes de terminar, sea cual sea la técnica, y el ciclo pide revisión humana. Si el ejecutor no da una cuenta legible (p. ej. `go test` sin `-v`), no se opina. La búsqueda de la llamada a nivel de módulo se mantiene.

## Alternativas consideradas

- **Mantener los dos motores**: rechazada, es mantenimiento doble sin ninguna función que solo uno ofrezca.
- **Hacer LangGraph.js el único**: rechazada, es una dependencia pesada y el motor propio ya cubre todo.
- **Implementar Rust o Java ahora**: rechazada por lo anterior (sin verificación, más superficie).
- **Perseguir cada forma de `process.exit` con análisis sintáctico (`acorn` ya es dependencia)**: no se hace; un análisis de JS no cubre Python ni Go, y un implementador decidido siempre encuentra otra forma. La cuenta de pruebas es independiente del lenguaje.

## Consecuencias

### Positivas
- Un solo camino de ejecución y una dependencia opcional menos (22 paquetes).
- Detección independiente de cómo esté escondido el corte.

### Negativas / Riesgos
- Se pierde la vía hacia LangGraph Studio y LangSmith. Recuperarla exigiría rehacer el motor en una spec nueva.
- La cuenta de pruebas puede dar falsos positivos (p. ej. una función `test_` auxiliar en Python) o falsos negativos (si el implementador no corta la ejecución sino que falsea el resumen). Un falso positivo solo pide revisión humana, no rompe nada.
- Java, Rust y monorepos siguen sin cubrirse.

## Cumplimiento de la constitución

Principio IV (dependencias mínimas): mejora, se retira una. Principio VI (decisiones deterministas): la comprobación es por reglas, sin modelo. Principio XI (honestidad documental): los límites quedan escritos.
