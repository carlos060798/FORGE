---
name: memory-compactor
model: claude-haiku-4-5
description: Comprime archivos de memoria de agentes cuando superan umbral (>50KB)
allowed-tools: Read, Write, Bash
---

# Skill: Memory Compactor

**Propósito:** Comprimir automáticamente archivos de memoria de agentes (`.sdd/memoria/agente-*.md`) cuando superan 50KB, eliminando entradas duplicadas y aplicando técnicas de reducción de contexto.

---

## Cuándo Usar

1. **Automático:** Hook `agent-memory.js` la dispara cuando memoria > 50KB
2. **Manual:** Usuario ejecuta `/sdd.optimizar memoria` en proyectos largos

---

## Qué Hace

### Deduplicación
Elimina entradas duplicadas del mismo archivo.

### Compresión por Caveman (Nivel Full)
Aplica diccionario de reemplazos: `CREATE TABLE` → `CT`, `SELECT * FROM` → `SF`, etc.

### Backup Automático
Crea `.original.md` antes de comprimir.

---

## Output

**Antes:** `.sdd/memoria/agente-arquitecto.md = 150KB (80 entradas)`

**Después:** `.sdd/memoria/agente-arquitecto.md = 15KB (8 entradas únicas)`

Mensaje: `✨ [auto-compress] arquitecto: 150KB → 15KB (10%)`

---

## Detalles Técnicos

- Deduplicación por `## YYYY-MM-DD — filepath`
- Reutiliza diccionario de `skills/compresion-tokens/SKILL.md`
- Backup `.original.md` siempre
- Performance: <100ms
- Trigger automático >50KB en `agent-memory.js`

---

## API (Internal)

```javascript
triggerAutoCompresion(cwd, agente, memoriaFile)
```

Ejecuta compresión automáticamente cuando se excede umbral.

---

## Notas

- Idempotente (ejecutar 2 veces = mismo resultado)
- Nunca pierdes datos (backup existe siempre)
- No interrumpe flujos (solo stderr messages)
