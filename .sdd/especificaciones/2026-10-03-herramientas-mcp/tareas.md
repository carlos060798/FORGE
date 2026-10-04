---
spec_id: 2026-10-03-herramientas-mcp
total_tareas: 9
estado: completada
generado: 2026-10-03
---

# Tareas: Herramientas de FORGE para agentes externos

## Progreso

```
[████████████████████] 100% (9/9)
```

| Total | Pendientes | En progreso | Completadas | Bloqueadas |
|-------|------------|-------------|-------------|------------|
| 9     | 0          | 0           | 9           | 0          |

---

## T001 — Decidir SDK oficial o protocolo propio

**Fase:** D (Lógica de negocio)
**Agente:** arquitecto
**Archivos:** `.sdd/arquitectura/ADR-12-servidor-mcp-sin-dependencias.md`
**Depende de:** —
**Estado:** ✅ completada

### Contexto
- CA cubierto: ninguno de forma directa (tarea de soporte)

### Notas
El SDK trae 17 dependencias directas para un transporte que no usa HTTP; se implementa el protocolo y se verifica contra el cliente oficial

---

## T002 — Protocolo MCP por stdio

**Fase:** D (Lógica de negocio)
**Agente:** desarrollador-backend
**Archivos:** `core/mcp/protocolo.js`, `tests/mcp-protocolo.test.js`
**Depende de:** T001
**Estado:** ✅ completada

### Contexto
- CA cubierto: CA-004-01, CA-004-02, CA-004-03, CA-004-04, CA-004-05

### Notas
JSON-RPC 2.0, tres versiones, errores estándar, sin agrupado

---

## T003 — Herramienta ejecutar_pruebas

**Fase:** D (Lógica de negocio)
**Agente:** desarrollador-backend
**Archivos:** `core/mcp/herramientas.js`, `tests/mcp-herramientas.test.js`
**Depende de:** T002
**Estado:** ✅ completada

### Contexto
- CA cubierto: CA-001-01, CA-001-02, CA-001-03, CA-001-04

### Notas
Reutiliza SandboxRunner y el candado de proyecto del ciclo

---

## T004 — Herramienta leer_archivo

**Fase:** D (Lógica de negocio)
**Agente:** desarrollador-backend
**Archivos:** `core/mcp/herramientas.js`
**Depende de:** T002
**Estado:** ✅ completada

### Contexto
- CA cubierto: CA-002-01, CA-002-02, CA-002-03, CA-002-04

### Notas
validarRuta del ciclo; manifiestos y configuración legibles

---

## T005 — Herramienta escribir_archivo

**Fase:** D (Lógica de negocio)
**Agente:** desarrollador-backend
**Archivos:** `core/mcp/herramientas.js`
**Depende de:** T002
**Estado:** ✅ completada

### Contexto
- CA cubierto: CA-003-01, CA-003-02, CA-003-03, CA-003-04, CA-003-05, CA-003-06

### Notas
aplicarArchivos del ciclo y Respaldo; test que compara con validarRuta

---

## T006 — Arranque y comando forge mcp

**Fase:** D (Lógica de negocio)
**Agente:** desarrollador-backend
**Archivos:** `core/mcp/servidor.js`, `cli/index.js`, `tests/mcp-e2e.test.js`
**Depende de:** T003, T004, T005
**Estado:** ✅ completada

### Contexto
- CA cubierto: CA-005-01

### Notas
Docker se comprueba al primer uso, no al arrancar

---

## T007 — Interoperabilidad con el cliente oficial

**Fase:** D (Lógica de negocio)
**Agente:** tester
**Archivos:** `tests/mcp-e2e.test.js`
**Depende de:** T006
**Estado:** ✅ completada

### Contexto
- CA cubierto: CA-004-06

### Notas
SDK instalado fuera del repositorio (FORGE_MCP_SDK)

---

## T008 — Documentación de uso

**Fase:** D (Lógica de negocio)
**Agente:** documentador
**Archivos:** `docs/servidor-mcp.md`
**Depende de:** T006
**Estado:** ✅ completada

### Contexto
- CA cubierto: CA-005-02

### Notas
Configuración para el cliente, herramientas, reglas, límites

---

## T009 — Verificación

**Fase:** D (Lógica de negocio)
**Agente:** revisor
**Archivos:** `.sdd/especificaciones/2026-10-03-herramientas-mcp/verificacion.md`
**Depende de:** T007, T008
**Estado:** ✅ completada

### Contexto
- CA cubierto: ninguno de forma directa (tarea de soporte)

### Notas
Hecha por quien implementó; falta la independiente

---

## Matriz de Cobertura de CAs

| CA | Tareas que lo cubren |
|----|----------------------|
| CA-001-01 | T003 |
| CA-001-02 | T003 |
| CA-001-03 | T003 |
| CA-001-04 | T003 |
| CA-002-01 | T004 |
| CA-002-02 | T004 |
| CA-002-03 | T004 |
| CA-002-04 | T004 |
| CA-003-01 | T005 |
| CA-003-02 | T005 |
| CA-003-03 | T005 |
| CA-003-04 | T005 |
| CA-003-05 | T005 |
| CA-003-06 | T005 |
| CA-004-01 | T002 |
| CA-004-02 | T002 |
| CA-004-03 | T002 |
| CA-004-04 | T002 |
| CA-004-05 | T002 |
| CA-004-06 | T007 |
| CA-005-01 | T006 |
| CA-005-02 | T008 |
