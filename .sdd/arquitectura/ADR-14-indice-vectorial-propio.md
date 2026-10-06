# ADR-14: Índice vectorial propio en un archivo, en lugar de LanceDB

> Estado: aceptada  # propuesta | aceptada | obsoleta | reemplazada-por-ADR-XX
> Fecha: 2026-10-04 (aceptada el 2026-10-05, por delegación del dueño)
> Spec relacionada: 2026-10-04-memoria-semantica
> Autor: Claude (pendiente de aceptación por el dueño)

## Contexto

La FASE 3 del plan maestro preveía un recuperador sobre LanceDB (opcional: su SDK exige Node ≥22) con embeddings de un proveedor local. LanceDB es una dependencia nativa pesada, no se puede instalar aquí sin Node 22 y, sobre todo, no hay un proveedor de embeddings disponible en este equipo para comprobar nada con vectores reales. El Principio IV exige un ADR por dependencia y que las pesadas sean opcionales.

## Decisión

Se implementa la memoria semántica sin dependencias nuevas, tras el puerto `Recuperador` (ADR-08):

- **Índice en un archivo** (`.sdd/indice/<embedder>.json`): trozos de 40 líneas con 10 de solape, un vector por trozo, búsqueda por similitud del coseno sobre todos. Incremental por tamaño y fecha. Suficiente para repositorios de hasta unos miles de trozos.
- **Dos embedders** detrás de una interfaz mínima: `hash` (local, sin red, **léxico, no semántico**: comparte palabras, no significado) y `ollama` (`/api/embeddings` de un Ollama local; vectores semánticos de verdad).
- **Un recuperador `semantico`** que entrega primero lo mismo que el de archivos (60 % del tope) y rellena con los trozos más parecidos. Si el embedder falla, entrega solo lo de archivos y lo anota: nunca detiene el ciclo.
- El puerto admite ahora recuperadores asíncronos.

LanceDB queda como una implementación posible del mismo puerto, sin comprometer nada ahora.

## Alternativas consideradas

- **A. LanceDB como dependencia opcional**: rechazada por ahora (Node ≥22, binarios nativos, imposible de probar aquí con embeddings reales).
- **B. Un servicio de embeddings en la nube**: rechazada: enviaría código del proyecto a un tercero sin que nadie lo haya decidido.
- **C. Índice propio en un archivo con embedders enchufables**: aceptada.

## Consecuencias

### Positivas
- Cero dependencias nuevas; funciona sin red con `hash`; todo el mecanismo (índice, incremental, tope de bytes, vetos) se prueba en la suite.
- Cambiar a LanceDB u otro motor no toca el ciclo.

### Negativas / Riesgos
- **`hash` no es semántica real.** Encuentra código relacionado por nombres y palabras, no por significado. Hay que decirlo siempre que se ofrezca.
- **`ollama` solo está probado con un servidor simulado**, no con un Ollama real ni con un modelo descargado.
- La búsqueda recorre todos los vectores: no escala a repositorios muy grandes.
- El índice contiene vectores derivados del código del proyecto en `.sdd/indice/` (ignorado por git). Lo vetado no se indexa.

## Cumplimiento de la constitución

Principio IV (dependencias): sin dependencias nuevas. Seguridad: lo que un modelo no puede leer no se indexa ni se devuelve; no se siguen enlaces; las peticiones de embeddings solo van a la dirección configurada (por defecto 127.0.0.1).
