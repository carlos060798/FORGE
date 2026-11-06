> **NOTA DE VIGENCIA (2026-10-03)**. Se conserva como visión. Describe capacidades que todavía no existen: no hay LiteLLM (el gasto lo controla el propio motor), y LanceDB y MCP llegan en specs posteriores. La frase "ningún código malicioso puede afectar el sistema host" es más fuerte de lo que un contenedor garantiza. Ver `LEEME.md`.

# FORGE 2.0: El Futuro de las Fábricas de Software Autónomas (Estado del Arte 2026)

## 1. El Problema del Ecosistema Actual (2026)
Hoy en día, herramientas como Cursor, Claude Code y OpenHands dominan el mercado de la programación asistida por IA. Sin embargo, cuando se intentan escalar a nivel empresarial (Enterprise), presentan tres fallas críticas:
1. **Fugas de Capital (Budget Runaways):** Los agentes autónomos utilizan el ciclo *ReAct (Reasoning and Acting)*. Si un agente no logra resolver un error en un contenedor, seguirá consumiendo llamadas a la API de modelos costosos (como GPT-4o o Claude 3.5) indefinidamente.
2. **Síndrome de Auto-Complacencia:** Los agentes tienden a escribir el código y luego escribir pruebas unitarias débiles diseñadas específicamente para que su propio código pase, ignorando las reglas de negocio reales.
3. **Pérdida de Contexto:** Inyectar todo el repositorio en la ventana de contexto del LLM (incluso con ventanas de 1 millón de tokens) diluye la atención del modelo y aumenta drásticamente la latencia y el costo.

## 2. La Solución FORGE 2.0: Arquitectura de "Human-on-the-loop"
FORGE 2.0 no es un autocompletador de código; es un orquestador estricto de ingeniería de software. 

### A. TDD Asimétrico (Separación de Poderes)
En FORGE, el flujo de LangGraph divide las tareas de manera estricta:
* **El Agente Analista/QA** recibe el requerimiento, consulta la base de datos vectorial (LanceDB) y **escribe las pruebas unitarias (Tests) primero**.
* **El Agente Programador** se despierta *después*, con un solo objetivo: escribir código que haga pasar las pruebas escritas por el QA en el contenedor Docker.
* *Beneficio:* Garantiza software robusto y auditable, eliminando la auto-complacencia de la IA.

### B. Control Financiero Estricto con LiteLLM (Agent Iteration Budgets)
FORGE integra nativamente el enrutador **LiteLLM** con políticas de presupuesto por sesión (`Session Budget Caps`).
* **Degradación Elegante:** Si la tarea "Módulo de Login" tiene un presupuesto de $2.00 USD, y el agente consume $1.50 intentando arreglar un error en Docker, FORGE enruta automáticamente las siguientes llamadas a un modelo más barato (ej. Gemini 2.0 Flash o un modelo local en Ollama) para intentar una última corrección.
* **Hard Stop:** Si el presupuesto se agota o se superan las 5 iteraciones en LangGraph, el sistema pausa la ejecución, guarda el estado (Checkpointing) y pide intervención humana.

### C. Aislamiento y Seguridad (Sandboxing)
A diferencia de agentes en la nube que requieren acceso total a los repositorios corporativos, FORGE 2.0 es **Local-First**. Todo el ciclo de compilación, ejecución de herramientas MCP (Model Context Protocol) y validación ocurre en contenedores Docker efímeros en la infraestructura del cliente. Ningún código malicioso generado por alucinaciones de la IA puede afectar el sistema host.

## 3. Resumen para Inversores o Stakeholders
FORGE 2.0 toma la autonomía de los agentes modernos y le aplica el gobierno, la seguridad y el control de costos que exigen los directores de TI (CIOs). Transforma un "chat inteligente" en una **cadena de montaje de software predecible, auditable y financieramente controlada**.