---
name: mutation-detector
model: claude-haiku-4-5
description: Detecta mutaciones (cambios) en archivos para tracking de calidad
allowed-tools: Read, Bash
---

# Skill: Mutation Detector

**Propósito:** Analizar patrones de cambio en archivos para detectar inestabilidad y calcular defect escape rate.

---

## Cómo Funciona

### Ledger de Mutaciones

Cada vez que un agente modifica un archivo (Write, Edit, MultiEdit), el hook registra:
```json
{
  "ts": "2026-06-14T10:30:00Z",
  "agente": "backend-dev",
  "archivo": "src/auth.ts",
  "tool": "Edit",
  "tipo": "partial"
}
```

**Campo `tipo`:**
- `full` — Write (archivo nuevamente escrito desde cero)
- `partial` — Edit (cambios parciales al archivo)

### Análisis de Estabilidad

Mutation Detector agrupa por archivo:
```
src/auth.ts:
  - Mutación 1: backend-dev (full)    2026-06-10 10:00
  - Mutación 2: backend-dev (partial) 2026-06-11 14:30
  - Mutación 3: tester-qa (partial)   2026-06-11 15:00 (test fail)
  
Análisis:
  - Total mutaciones: 3
  - Autor principal: backend-dev
  - Estabilidad: INESTABLE (3 cambios en 2 días)
  - Defect finder: tester-qa encontró 1 bug
```

---

## Defect Escape Rate

**Fórmula:**
```
Defect Escape Rate = (Bugs encontrados) / (Total bugs presentes)

Ejemplo:
- Backend Dev escribió src/auth.ts
- QA ejecutó tests, encontró 4 bugs
- En producción: 1 bug adicional

Escape Rate = 1 / 5 = 20%
```

**Tabla por agente:**
```
AGENTE         | ARCHIVOS | BUGS ENCONTRADOS | BUGS EN PROD | ESCAPE RATE
───────────────┼──────────┼──────────────────┼─────────────┼──────────
backend-dev    | 12       | 4                | 1           | 20%
frontend-dev   | 8        | 0                | 0           | N/A
tester-qa      | —        | 4 encontrados    | —           | 100% accuracy
```

---

## Output: Comando `/sdd.defect-report`

**Resumen ejecutivo:**
```
DEFECT REPORT — Sesión 2026-06-14

Archivos modificados: 12
Bugs encontrados (QA): 4
Bugs en producción (post-release): 1
─────────────────────────────────
Global Escape Rate: 20% (1 de 5)

Por agente:
  backend-dev:   4 archivos, 3 bugs encontrados → 75% quality score
  frontend-dev:  8 archivos, 1 bug encontrado   → 88% quality score
  tester-qa:     Encontró 4 bugs (100% accuracy)
```

---

## Implementación Técnica

### Ledger: `.sdd/observabilidad/mutaciones.jsonl`

Append-only JSONL donde cada línea es una mutación:
```json
{"ts":"2026-06-14T10:30:00Z","agente":"backend-dev","archivo":"src/auth.ts","tool":"Edit","tipo":"partial"}
{"ts":"2026-06-14T10:35:00Z","agente":"backend-dev","archivo":"src/auth.ts","tool":"Write","tipo":"full"}
{"ts":"2026-06-14T15:00:00Z","agente":"tester-qa","archivo":"src/auth.test.ts","tool":"Write","tipo":"full"}
```

### Agregación por archivo

```javascript
const mutacionesPorArchivo = {};
for (const mut of mutaciones) {
  if (!mutacionesPorArchivo[mut.archivo]) {
    mutacionesPorArchivo[mut.archivo] = [];
  }
  mutacionesPorArchivo[mut.archivo].push(mut);
}
```

### Cálculo de Inestabilidad

```
Si archivo tiene >2 mutaciones en <24h → INESTABLE
Si archivo tiene >5 mutaciones → CRÍTICO
```

---

## Notas

- Fase 1 (v2.6.0): Solo tracking + informe simple
- Fase 2 (v2.6.1): Dashboard con gráficos
- Ledger append-only: nunca sobrescrito, histórico completo
- Reversible: puedes recalcular estadísticas en cualquier momento

