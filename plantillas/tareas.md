---
spec_id: [SPEC_ID]
total_tareas: 0
estado: pendiente
generado: [FECHA]
---

# Tareas: [TITULO_SPEC]

## Progreso

```
[░░░░░░░░░░░░░░░░░░░░] 0% (0/[N])
```

| Total | Pendientes | En progreso | Completadas | Bloqueadas |
|-------|------------|-------------|-------------|------------|
| [N]   | [N]        | 0           | 0           | 0          |

## Leyenda de estados
- ⬜ pendiente
- 🔧 en_progreso
- ✅ completada
- ❌ bloqueada
- ⏭️ omitida

---

## T001 — [Nombre descriptivo]

**Fase:** A (Fundamentos)
**Agente:** [agente]
**Modelo:** [modelo] (según config)
**Archivos:** `ruta/nuevo.ext` (CREAR)
**Depende de:** —
**Estado:** ⬜ pendiente
**Tiempo estimado:** S/M/L

### Qué hacer
[Descripción específica e inequívoca]

### Contexto
- CA cubierto: CA-001-01
- Decisión técnica: #1 del plan

### Criterio de verificación
```bash
[comando o assertion concreta]
```

### Notas
[Patrones a seguir, decisiones tomadas]

---

## Matriz de Cobertura de CAs

| CA | Tareas que lo cubren |
|----|----------------------|
| CA-001-01 | T001, T003 |

## Diagrama de Dependencias

```
T001 ──> T003 ──> T005
T002 ──> T004
```

## Historial de Cambios

| Tarea | Anterior | Nuevo | Fecha | Notas |
|-------|----------|-------|-------|-------|
