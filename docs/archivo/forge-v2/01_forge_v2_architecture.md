> **REEMPLAZADO (2026-10-03)** por `../FORGE/PLAN-MOTOR-AGENTICO.md` y `../FORGE/.sdd/especificaciones/2026-10-03-ciclo-verificado/plan.md`. El sandbox Docker no es "heredado de la v1": no existe. Ver `LEEME.md`.

# FORGE V2 - Arquitectura y Plan de Ejecución
Este documento define la especificación principal para reconstruir FORGE como un marco de trabajo multi-agente moderno.

## 1. Visión General
FORGE es un framework de ejecución de software agéntico. Su principal fortaleza (heredada de la v1) es el sandboxing con Docker y la verificación en tiempo de ejecución. Esta versión 2.0 acopla ese motor seguro a una arquitectura de razonamiento con LangGraph.

## 2. Stack Tecnológico
- **Orquestación:** LangGraph (grafos de estado cíclicos).
- **Enrutamiento de Modelos:** LiteLLM (permite usar Ollama para tareas rápidas y Claude/OpenAI para lógica pesada).
- **Memoria de Largo Plazo (RAG):** LanceDB o pgvector.
- **Interacción con Entorno:** Model Context Protocol (MCP).
- **Ejecución y Sandboxing:** Docker (aislamiento de código generado).

## 3. Flujo de Trabajo (Grafo de Estado)
1. **Planificador:** Lee el requerimiento y el contexto de RAG. Define el enfoque.
2. **Desarrollador (Coder):** Escribe el código.
3. **Ejecutor (Docker):** Monta el código en el contenedor y ejecuta pruebas/linting.
4. **Revisor (Reviewer):** Analiza los logs de Docker. Si hay error, devuelve el estado al Coder. Si pasa, finaliza el nodo.
