> **REEMPLAZADO (2026-10-03)**. El stack es Node.js, no Python. Dependencias y configuración vigentes: secciones 7 y 10 de `../FORGE/.sdd/especificaciones/2026-10-03-ciclo-verificado/plan.md`. Ver `LEEME.md`.

# Configuración y Dependencias (pyproject.toml y .env)

## dependencias (pip / uv)
- langgraph
- langchain-core
- litellm
- docker
- lancedb
- fastapi
- uvicorn
- pydantic

## Variables de Entorno (.env)
```env
# Configuración LiteLLM
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
OLLAMA_API_BASE=http://localhost:11434

# Configuración Docker
DOCKER_DEFAULT_IMAGE=python:3.11-slim
DOCKER_TIMEOUT_SECONDS=30
```
