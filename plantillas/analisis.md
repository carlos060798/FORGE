---
spec_id: [SPEC_ID]
fecha_analisis: [FECHA]
veredicto: APROBADO  # APROBADO | OBSERVACIONES | BLOQUEADO
---

# Análisis de Consistencia: [SPEC_ID]

## Veredicto: **[VEREDICTO]**

[Resumen ejecutivo, 1-2 frases]

## Hallazgos

### 🔴 Bloqueantes
#### B1 — [Título]
- **Dimensión:** [Constitución/Plan/Tareas/etc.]
- **Descripción:** [qué inconsistencia]
- **Ubicación:** [archivo:sección]
- **Impacto si se ignora:** [consecuencia]
- **Acción sugerida:** [qué hacer]

### 🟡 Observaciones
[mismo formato]

### 🟢 Buenas señales
[áreas correctas]

## Matriz de Cobertura: CAs → Tareas

| CA | Descripción | Tareas | Estado |
|----|-------------|--------|--------|
| CA-001-01 | [texto] | T001, T005 | ✅ |

## Matriz de Cobertura: Riesgos → Mitigaciones

| Riesgo | Prob × Imp | Mitigación | Estado |
|--------|-----------|-----------|--------|
| R1 | A × A | T004 | ✅ |

## Cumplimiento de Constitución

| Principio | Plan | Tareas | Notas |
|-----------|------|--------|-------|
| Principio I | ✅ | ✅ | — |

## Distribución de Agentes

| Agente | Tareas | % |
|--------|--------|---|
| arquitecto | [N] | [%] |

## Recomendaciones
1. [Acción priorizada]

## Siguiente comando sugerido
`/sdd.[comando]`
