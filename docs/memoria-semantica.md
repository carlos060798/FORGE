# Memoria semántica del ciclo

Con `motor.recuperador: semantico`, el ciclo verificado da a los agentes, además de los archivos que la tarea o el plan nombran, los **trozos del repositorio más parecidos a la tarea**. Spec `2026-10-04-memoria-semantica`, decisión en `ADR-14`.

## Activarla

En `.sdd/sdd.config.yaml`:

```yaml
motor:
  recuperador: semantico
  embeddings: hash                     # o: ollama
  embeddings_modelo: nomic-embed-text  # solo con ollama
```

## Cómo funciona

1. Recorre el proyecto y parte cada archivo de texto en trozos de 40 líneas (10 de solape).
2. Calcula un vector por trozo y lo guarda en `.sdd/indice/<embedder>.json`. Solo vuelve a calcular los archivos que cambiaron.
3. Busca los trozos más parecidos a la descripción de la tarea y a los pasos del plan, por similitud del coseno.
4. Entrega primero lo de siempre (los archivos de la tarea y del plan, con el 60 % del tope de contexto) y rellena con los trozos hallados, sin repetir archivos y sin superar nunca el tope.

Si el embedder falla (Ollama apagado, modelo sin descargar), el ciclo sigue con el contexto por archivos y lo anota en el registro de eventos.

## Los dos cálculos de vectores

| `embeddings` | Qué es | Requisitos | Calidad |
|---|---|---|---|
| `hash` (por defecto) | Local, sin red. Cuenta palabras (separa `camelCase` y `snake_case`) y las proyecta a 256 dimensiones | Ninguno | **Léxica, no semántica**: encuentra código que comparte palabras con la tarea, no código que significa lo mismo con otras palabras |
| `ollama` | Pide los vectores a un Ollama local (`/api/embeddings`) | Ollama en marcha y el modelo descargado (`ollama pull nomic-embed-text`) | Semántica de verdad. **Solo se ha probado con un servidor simulado**, no con un Ollama real |

La dirección de Ollama es `http://127.0.0.1:11434`, o la de `OLLAMA_HOST`. Nada del proyecto se envía a otra parte.

## Qué no se indexa

Lo que un modelo no puede leer: carpetas vetadas (`.git`, `.sdd`, `node_modules`, `secrets`…), archivos de credenciales por nombre, los de `protecciones.no_tocar_archivos`, enlaces simbólicos, archivos de más de 200 KB o binarios, y solo ciertas extensiones de texto (código, Markdown, JSON, YAML…). Máximo 3000 archivos.

## Límites

- **`hash` no entiende significado.** Si necesitas búsqueda semántica real, usa `ollama` y comprueba el resultado.
- La búsqueda recorre todos los vectores: pensada para repositorios de hasta unos miles de trozos. Para más, el puerto `Recuperador` admite sustituirla (LanceDB, por ejemplo).
- El índice se guarda en `.sdd/indice/`, que git ignora, y contiene vectores derivados de tu código.
- No sustituye al indexador de `utils/hybrid-indexer.js`, que sigue como estaba.
- Autoevaluada: sin verificación ni revisión de seguridad independientes.
