# ADR-15: Los nodos llaman al sandbox directamente; no hay cliente MCP interno

> Estado: aceptada  # propuesta | aceptada | obsoleta | reemplazada-por-ADR-XX
> Fecha: 2026-10-05 (aceptada por delegación del dueño)
> Spec relacionada: 2026-10-03-herramientas-mcp, 2026-10-03-ciclo-verificado
> Autor: Claude

## Contexto

La FASE 2 del plan maestro preveía, además del servidor MCP (2.1), un **cliente MCP dentro de los nodos del ciclo** (2.2): que `qa`, `coder` y `sandbox` ejecutaran y escribieran a través de las herramientas MCP, tal como pedía el plan original («conectar estas herramientas a LangGraph»). El servidor MCP (`forge mcp`) existe y comparte código con el ciclo: `validarRuta`, `aplicarArchivos`, `SandboxRunner`, `Respaldo` y el candado de proyecto.

## Decisión

**No se implementa 2.2.** Los nodos siguen llamando directamente a `aplicarArchivos` y a `SandboxRunner`. El servidor MCP queda como interfaz para agentes **externos** (Claude Code u otros clientes), no como capa interna del ciclo.

## Razones

- **No añade seguridad.** Las reglas de rutas, el aislamiento y los respaldos ya son una única implementación compartida; pasar por JSON-RPC dentro del mismo proceso no la refuerza.
- **Añade fallos y coste.** Un transporte (aunque sea en memoria), serialización, límites de tamaño del protocolo y un punto más donde los errores se convierten en mensajes de herramienta. El ciclo necesita errores tipados para decidir su ruta (infraestructura frente a fallo de pruebas).
- **Rompería la reanudación.** El ciclo guarda un punto tras cada nodo y registra gasto por llamada; ponerlo detrás de una herramienta ajena complicaría ambas cosas.
- **El plan original lo pedía por otro motivo**: tenía el sandbox en Python y el grafo en otro proceso, y necesitaba un protocolo entre ellos. Aquí todo es un solo proceso Node.

## Alternativas consideradas

- **A. Cliente MCP interno (2.2 como estaba)**: rechazada por lo anterior.
- **B. Que el ciclo pueda usar herramientas MCP externas (de otros servidores) para el agente**: no se descarta, pero es una función nueva con su propia spec y revisión de seguridad (dar a un modelo herramientas arbitrarias rompe el principio de que solo escribe archivos validados). Queda fuera de alcance.
- **C. Descartar 2.2 y dejar el servidor MCP como interfaz externa**: aceptada.

## Consecuencias

### Positivas
- Un camino de ejecución menos que mantener y revisar; el ciclo conserva errores tipados y reanudación.

### Negativas / Riesgos
- Si en el futuro se quiere que los nodos se puedan sustituir por agentes externos vía MCP, habrá que hacerlo con una spec nueva.
- El criterio «los nodos usan el servidor MCP» del plan original queda sin cumplir por decisión, no por omisión.

## Cumplimiento de la constitución

Principio de reutilizar antes que reescribir: el servidor y el ciclo ya comparten el código de reglas. Sin dependencias nuevas.
