---
description: Generar reporte de calidad con escape rate y mutaciones
allowed-tools: Read, Bash
---

# /sdd.defect-report

Genera un reporte de calidad basado en mutaciones (cambios) de archivos encontrados por QA.

## Uso

```
/sdd.defect-report
```

## Qué Muestra

### Resumen Ejecutivo

```
╔═══════════════════════════════════════════════════════════╗
║         DEFECT ESCAPE RATE REPORT — 2026-06-14           ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  Archivos modificados:  12                                ║
║  Bugs encontrados (QA): 4                                 ║
║  Bugs en producción:    1                                 ║
║  ─────────────────────────────────────                    ║
║  Global Escape Rate:    20% (1 de 5)                      ║
║                                                           ║
║  Interpretación:                                          ║
║    ✅ Muy bien  (1-10%): Calidad excelente               ║
║    ⚠️  OK       (11-30%): Calidad buena                  ║
║    🔴 Malo     (31%+):   Calidad baja                    ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

### Por Agente

```
AGENTE         | ARCHIVOS | MUTACIONES | BUGS ENCONTRADOS | QUALITY
───────────────┼──────────┼────────────┼──────────────────┼─────────
backend-dev    | 12       | 15         | 3                | 75%
frontend-dev   | 8        | 12         | 1                | 88%
tester-qa      | 5        | 8          | 4 (encontrados)  | QA
revisor        | 3        | 4          | 2                | 67%
```

### Archivos Inestables

```
🚨 CRÍTICOS (>5 mutaciones):
  - src/auth.ts         (7 mutaciones en 2 días)
  - src/database.ts     (6 mutaciones en 3 días)

⚠️  INESTABLES (2-5 mutaciones):
  - src/validators.ts   (3 mutaciones)
  - src/payments.ts     (4 mutaciones)
```

### Agentes con Mejora Necesaria

```
📊 ESCALA DE CALIDAD:
  backend-dev:    ████████░ 75% — Aumentar coverage de tests
  frontend-dev:   █████████ 88% — Excelente
  revisor:        ██████░░░ 67% — Revisar proceso de verificación
```

---

## Interpretación de Resultados

### Escape Rate Bajo (1-10%)
```
✅ QA es efectivo, código es estable
  → Confiable para producción
  → Clientes confían en calidad
```

### Escape Rate Medio (11-30%)
```
⚠️  QA encuentra mayoría de bugs, pero algunos escapan
  → Aumentar cobertura de tests
  → Mejorar criterios de aceptación
```

### Escape Rate Alto (31%+)
```
🔴 Problemas serios de calidad
  → Tests insuficientes
  → Falta validación
  → Riesgo de producción
```

---

## Ejemplo Real

**Sesión 1 (2026-06-10):**
- Backend Dev escribe src/auth.ts (Write)
- Frontend Dev modifica src/ui.tsx (Edit)
- Tester QA ejecuta tests, encuentra 2 bugs en auth.ts

**Sesión 2 (2026-06-11):**
- Backend Dev reescribe src/auth.ts (Write) — 2 bugs solucionados + 1 nuevo
- Tester QA ejecuta tests, encuentra 2 bugs (1 viejo, 1 nuevo)
- 1 bug anterior escapó a producción

**Reporte Final:**
```
Archivos: 2
Bugs encontrados: 4
Bugs en prod: 1
─────────────────
Escape Rate: 25%

Por agente:
  backend-dev: 6 mutaciones, 3 bugs encontrados → 50% quality
  frontend-dev: 1 mutación, 0 bugs → 100% quality
  tester-qa: 100% accuracy (encontró todos excepto 1 que escapó)
```

---

## Datos Fuente

Utiliza:
- `.sdd/observabilidad/mutaciones.jsonl` — cambios a archivos
- `.sdd/observabilidad/consumo.jsonl` — timestamps de eventos

**Nota:** En v2.6.1 se agregará integración con resultados reales de QA (Playwright).

