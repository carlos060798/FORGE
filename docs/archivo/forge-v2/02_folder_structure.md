> **REEMPLAZADO (2026-10-03)**. La estructura vigente está en la sección 5 de `../FORGE/.sdd/especificaciones/2026-10-03-ciclo-verificado/plan.md` (`core/ciclo`, `core/sandbox`, `core/recuperacion`, en JavaScript). Ver `LEEME.md`.

# Estructura del Proyecto FORGE v2

```text
forge-v2/
├── pyproject.toml
├── .env.example
├── README.md
├── forge/
│   ├── __init__.py
│   ├── api/                  # Capa FastAPI (opcional para consumo REST)
│   ├── graph/                # Orquestación de LangGraph
│   │   ├── __init__.py
│   │   ├── state.py          # Definición del TypedDict del grafo
│   │   ├── nodes/            # Nodos: planner.py, coder.py, reviewer.py
│   │   └── edges.py          # Lógica condicional de enrutamiento
│   ├── docker/               # Motor central de FORGE v1
│   │   ├── __init__.py
│   │   ├── sandbox.py        # Gestión de contenedores y volúmenes
│   │   └── executor.py       # Ejecución y recolección de logs
│   ├── mcp/                  # Servidores de herramientas MCP
│   └── memory/               # LanceDB RAG (embeddings e indexación)
```
