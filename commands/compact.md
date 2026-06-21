---
description: Alias de /sdd.comprimir — comprime el contexto de la sesión actual. Úsalo cuando el indicador de contexto supere el 60%.
allowed-tools: Read, Bash
---

# /compact — Comprimir contexto

Este comando es un alias de `/sdd.comprimir aplicar`.

Ejecuta la compresión completa del contexto actual:
- Resume artefactos SDD verbosos (spec, plan, tareas) en versiones compactas
- Deduplica la memoria de agentes
- Descarta contexto de herramientas ya cerradas

**Cuándo usarlo:** cuando el indicador de uso de contexto de Claude Code supere el 60%, o si notas que las respuestas se vuelven más lentas o menos precisas.

---

Ejecuta ahora `/sdd.comprimir aplicar` y sigue sus instrucciones.
