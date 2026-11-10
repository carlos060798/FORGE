---
description: Alias de /sdd.comprimir — ciclo de ahorro de tokens (fan-out, modelo por fase, compresión de memoria, auditoría de caché y presupuesto). Úsalo cuando el contexto o el gasto se disparen.
allowed-tools: Read, Bash
---

# /sdd.optimizar — alias de `/sdd.comprimir`

Este comando es un alias: el procedimiento vive en `/sdd.comprimir` (spec `2026-11-09-puerta-de-entrada-solo-dev`, CA-003-02; antes había cuatro comandos de ahorro de contexto sin frontera clara).

| Lo que pedías | Ejecuta ahora |
|---|---|
| `/sdd.optimizar` (ciclo completo) | `/sdd.comprimir aplicar` |
| `/sdd.optimizar tokens` | `/sdd.comprimir analizar` y sigue las recomendaciones de modelo por fase |
| `/sdd.optimizar memoria` | `/sdd.comprimir aplicar` (incluye la deduplicación de memoria de agentes) |
| `/sdd.optimizar presupuesto` | `fragua status` muestra el gasto y el tope de la sesión |

---

Ejecuta ahora `/sdd.comprimir aplicar` y sigue sus instrucciones.
