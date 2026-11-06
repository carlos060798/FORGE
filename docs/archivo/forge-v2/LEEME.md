# Documentos de "FORGE v2" — reemplazados

> **Fecha:** 2026-10-03
> Estos siete documentos quedan como antecedente. La fuente de verdad es ahora:
>
> - Plan maestro: `../FORGE/PLAN-MOTOR-AGENTICO.md`
> - Especificación: `../FORGE/.sdd/especificaciones/2026-10-03-ciclo-verificado/spec.md`
> - Plan técnico: `../FORGE/.sdd/especificaciones/2026-10-03-ciclo-verificado/plan.md`
> - Decisiones: `../FORGE/.sdd/arquitectura/ADR-01` a `ADR-11`

## Por qué se reemplazan

1. **Parten de una premisa falsa.** Afirman que FORGE ya tiene un sandbox Docker. No lo tiene: es un plugin de Claude Code en Node.js (v4.2.0) que ejecuta el código generado en el equipo anfitrión.
2. **Proponen un stack Python** (LangGraph, LiteLLM, FastAPI) para un repo que es JavaScript y que descartó Python en su propia documentación.
3. **Describen dos grafos incompatibles**: `planner → coder → reviewer` y `qa → coder → sandbox`. Solo comparten el campo `messages` del estado.
4. **No siguen la metodología SDD del proyecto**: sin constitución, criterios de aceptación, ADR ni tareas.

## Qué se corrige y qué se conserva

| Documento | Estado | Qué se corrige | Qué se conserva |
|---|---|---|---|
| `plan_de_ejecuci_n_forge_v2.md` | Reemplazado por el plan maestro | "Docker ya existente" (líneas 5, 19); stack Python (9-17); MCP como única vía al sandbox (90-96); ciclo de corrección sin tope | La regla "nunca en el host" (116), la modularidad (120), el retriever antes del coder (104), el orden de fases como base del roadmap |
| `01_forge_v2_architecture.md` | Reemplazado | "Heredada de la v1" (5); revisor con modelo (18), sustituido por un router determinista | El flujo de cuatro pasos como antecedente |
| `02_folder_structure.md` | Reemplazado | Árbol Python y "motor central de FORGE v1" (16) | La separación grafo / sandbox / memoria / API, que pasa a `core/ciclo`, `core/sandbox` y `core/recuperacion` |
| `03_system_prompts.md` | Semilla para `core/ciclo/prompts/` | Falta el nodo de pruebas; el Reviewer emite "PASS" (18), incompatible con el router | Los prompts de Planner y Coder, adaptados al contrato de salida |
| `04_setup_and_dependencies.md` | Reemplazado | Dependencias pip (3-11); imagen mínima sin red, que no puede instalar nada (21); tiempo máximo de 30 s (22) | Imagen y tiempo máximo configurables; variables de proveedor |
| `estructura_de_implementaci_n_para_el_agente_cursor_claude.md` | Reemplazado; fuente principal del diseño adoptado | Orden del router: evalúa el tope antes que el éxito (46-51); `"PASS" in` (50); `human_review` sin nodo (47); `budget_status` sin quien lo actualice (19); modelo fijo de 2024 (66); degradación solo por excepción (74-77) | El estado base (13-20), los tres nodos (26-38), el sandbox sin red (83), el tope de 5 iteraciones y de $2 |
| `documento_de_soporte_t_cnico_y_comercial.md` | Se conserva como visión, con nota de vigencia | "Integra nativamente LiteLLM" (19); LanceDB en el flujo de pruebas (14) y MCP en contenedores (24), que son specs posteriores; "ningún código malicioso… puede afectar el sistema host" (24) es una garantía absoluta que un contenedor no da; ambigüedad sesión/tarea en el presupuesto (20-21) | El TDD asimétrico (12-16), la degradación a $1.50, la parada con punto de guardado y revisión humana (20-21), el enfoque local |

## Cómo quedó repartido el plan original

| Fase del plan v2 | Dónde está ahora |
|---|---|
| Phase 1: LiteLLM | No se hace: `core/llm-providers` ya enruta cuatro proveedores. El presupuesto va en S1 (ADR-06) |
| Phase 2: LangGraph | S1 "Ciclo Verificado", con LangGraph.js opcional (ADR-01) |
| Phase 3: Docker vía MCP | El aislamiento, en S1 como desarrollo nuevo (ADR-02); MCP, en S2 |
| Phase 4: RAG con LanceDB | El punto de extensión, en S1 (ADR-08); LanceDB, en S3 |
| Phase 5: FastAPI | S4, extendiendo `ui/server.js` |
| (no estaba) | S0 "Saneamiento": defectos previos que impiden usar el motor con el flujo SDD |
