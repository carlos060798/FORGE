> **REEMPLAZADO (2026-10-03)** por `../FORGE/PLAN-MOTOR-AGENTICO.md` y la spec `2026-10-03-ciclo-verificado`. Este documento afirma que el sandbox Docker ya existe; no existe. Ver `LEEME.md`.

# FORGE v2 - Master Execution Plan

## 1. Contexto del Proyecto

**FORGE** es un framework de agentes autónomos de código. Su ventaja competitiva actual es su **sandboxing seguro con Docker** y verificación en tiempo de ejecución. El objetivo de esta iteración (v2) es modernizar el stack incorporando memoria a largo plazo (RAG), orquestación avanzada de estado y estandarización de herramientas.

**Stack Tecnológico Objetivo:**

* **Orquestación:** LangGraph (Python)

* **Model Routing:** LiteLLM (Soporte para Ollama local y APIs de frontera)

* **Herramientas (Tools):** Model Context Protocol (MCP)

* **Memoria / RAG:** LanceDB (o pgvector) local

* **API / Interfaz:** FastAPI

* **Ejecución Segura:** Docker (Ya existente, debe mantenerse)

## 2. Arquitectura del Sistema (System Architecture)

El siguiente diagrama detalla cómo interactúan los nuevos componentes con el motor Docker existente.

```
graph TD
    User([Usuario / Interfaz]) --> API[FastAPI Orchestrator]
    API --> Graph[LangGraph State Machine]
    
    subgraph "Core AI Engine"
        Graph --> Router[LiteLLM]
        Router -.-> Local[Ollama / SLM]
        Router -.-> Cloud[Claude/GPT-4 / LLM]
    \end
    
    subgraph "Memory & Context"
        Graph <--> RAG[(LanceDB Vector Store)]
        Graph <--> State[(Graph State/History)]
    \end
    
    subgraph "Execution & Environment"
        Graph <--> MCP[MCP Tool Server]
        MCP --> FileSystem[File System Read/Write]
        MCP --> DockerRunner[Docker Sandbox Execution]
    \end

```

## 3. Ciclo de Vida del Agente (LangGraph Workflow)

El antiguo enfoque basado en eventos será reemplazado por este ciclo de retroalimentación continuo que permite la auto-corrección de código si el contenedor Docker arroja errores.

```
stateDiagram-v2
    [*] --> PlanTask : Recibir Requerimiento
    PlanTask --> RetrieveContext : Buscar en LanceDB
    RetrieveContext --> WriteCode : Escribir/Modificar Código
    WriteCode --> TestInDocker : Ejecutar en Sandbox (MCP)
    
    TestInDocker --> ValidateResult
    
    ValidateResult --> FixCode : Falla (Error Logs)
    FixCode --> TestInDocker : Reintentar
    
    ValidateResult --> Success : Pasa
    Success --> [*]

```

## 4. Fases de Implementación para el Agente de Código

**Agente: Por favor, ejecuta este plan de forma secuencial. No avances a la siguiente fase sin verificar que la anterior funciona correctamente.**

### Phase 1: Setup & Abstracción de Modelos (LiteLLM)

* \[ \] Configurar entorno virtual y dependencias (`litellm`, `pydantic`).

* \[ \] Crear un módulo `llm_router.py`.

* \[ \] Implementar funciones para llamar tanto a modelos locales (Ollama) para tareas rápidas, como a modelos remotos para razonamiento.

### Phase 2: Refactorización a LangGraph (Orquestación)

* \[ \] Instalar `langgraph` y definir el `State` (Esquema de estado) usando Pydantic o TypedDict (debe incluir: `messages`, `current_task`, `code_draft`, `error_logs`).

* \[ \] Crear los nodos base: `planner`, `coder`, `reviewer`.

* \[ \] Establecer el flujo condicional (edges) que permita regresar del `reviewer` al `coder` si hay errores.

### Phase 3: Integración de Docker vía MCP

* \[ \] Adaptar la lógica actual de FORGE (Docker sandboxing) a un servidor/herramienta compatible con Model Context Protocol (MCP).

* \[ \] Exponer herramientas para el agente: `run_docker_command`, `read_file`, `write_file`.

* \[ \] Conectar estas herramientas a LangGraph.

### Phase 4: Memoria a Largo Plazo (RAG con LanceDB)

* \[ \] Instalar `lancedb` y configurar la inicialización de la base de datos local.

* \[ \] Crear una herramienta que convierta los archivos del repositorio a embeddings (usando LiteLLM) y los guarde en LanceDB.

* \[ \] Crear un nodo `retriever` en LangGraph que se ejecute antes del `coder` para inyectar contexto relevante.

### Phase 5: Exposición y API (FastAPI)

* \[ \] Instalar `fastapi` y `uvicorn`.

* \[ \] Crear endpoints principales: `POST /task` (iniciar flujo) y `GET /status/{task_id}`.

* \[ \] Asegurar que FastAPI pueda ejecutar el grafo de LangGraph de forma asíncrona.

## 5. Reglas de Codificación (System Prompt Adicional)

* **Preservar Sandboxing:** Nunca elimines la capa de ejecución de Docker. El código generado NUNCA debe ejecutarse en el host local del usuario.

* **Tipado Fuerte:** Usa type hints (`typing` / `pydantic`) en todo el código Python.

* **Modularidad:** Mantén la lógica de LangGraph separada de los adaptadores de Docker y de la API.