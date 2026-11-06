> **REEMPLAZADO (2026-10-03)**. Ya no es la fuente de verdad. Su diseño (pruebas primero, tope de 5 iteraciones, presupuesto, sandbox sin red) se adoptó corregido en la spec `2026-10-03-ciclo-verificado`. El router de la sección 3 tiene el orden equivocado (ADR-05). Ver `LEEME.md`.

# Instrucciones de Desarrollo: FORGE 2.0 MVP

**Agente:** Utiliza este documento como tu fuente de verdad arquitectónica para construir el MVP de FORGE 2.0. El objetivo es crear un flujo de trabajo agéntico usando LangGraph, LiteLLM (para control de presupuesto) y Docker (para sandboxing).

## 1. Definición del Estado (LangGraph TypedDict)
El estado compartirá la información estricta de la sesión, incluyendo el presupuesto y los intentos.

```python
# forge/graph/state.py
from typing import TypedDict, Annotated, List, Dict
import operator

class AgentState(TypedDict):
    task_description: str
    tests_code: str          # Código de pruebas generado por QA
    implementation_code: str # Código generado por Coder
    test_results: str        # Salida del contenedor Docker
    iteration_count: int     # Para evitar bucles infinitos
    budget_status: str       # "ok", "warning", "exhausted"
    messages: Annotated[List[Dict[str, str]], operator.add]
```

## 2. Nodos del Grafo (Nodes)
Debes implementar los siguientes nodos en `forge/graph/nodes/`. Cada uno debe usar LiteLLM para invocar al modelo, respetando las variables de entorno para control de costos.

1. **node_qa (Tester):** 
   - Lee `task_description`.
   - Genera scripts de pruebas unitarias exhaustivas (TDD).
   - Actualiza `tests_code`.
2. **node_coder (Programador):**
   - Lee `task_description`, `tests_code` y (si existe) `test_results`.
   - Genera o corrige el código para pasar las pruebas.
   - Actualiza `implementation_code`.
3. **node_sandbox (Ejecutor Docker):**
   - **No usa LLM.**
   - Monta `tests_code` y `implementation_code` en un volumen Docker efímero.
   - Ejecuta las pruebas.
   - Actualiza `test_results`. Suma `+1` a `iteration_count`.

## 3. Enrutamiento Condicional (Edges)
Define la lógica de transición en `forge/graph/workflow.py`:

```python
def check_test_results(state: AgentState) -> str:
    # 1. Chequeo de límite de iteraciones / presupuesto
    if state["iteration_count"] >= 5 or state["budget_status"] == "exhausted":
        return "human_review" # Pausa de seguridad
    
    # 2. Chequeo de pruebas
    if "PASS" in state["test_results"]:
        return "end" # Éxito
    else:
        return "coder" # Bucle ReAct de auto-corrección
```

## 4. Configuración de LiteLLM (Presupuesto)
En `forge/core/llm.py`, configura LiteLLM para rastrear el gasto por sesión. 

```python
import litellm

# Configurar modelo por defecto
litellm.success_callback = ["langfuse"] # Opcional para observabilidad
litellm.max_budget = 2.00 # Límite estricto de $2 USD por ejecución

def call_llm(messages, model="claude-3-5-sonnet-20240620"):
    try:
        response = litellm.completion(
            model=model,
            messages=messages,
            user="forge_session_1" # Usado para rastrear el costo de la sesión
        )
        return response
    except litellm.BudgetExceededError:
        # Aquí implementamos el "Model Downgrading" (Fallback)
        print("Presupuesto excedido, cambiando a modelo local/barato")
        return litellm.completion(model="ollama/mistral", messages=messages)
```

## 5. Tareas a Ejecutar
1. Instalar dependencias: `langgraph`, `litellm`, `docker`.
2. Crear el archivo `state.py`.
3. Implementar la función del Sandbox de Docker (`node_sandbox`). Asegúrate de usar un contenedor sin red (`network_mode="none"`) por seguridad.
4. Conectar los nodos usando `StateGraph` de LangGraph y compilar la aplicación.