---
description: Comprimir manualmente la memoria de agentes (deduplicación + compresión)
allowed-tools: Read, Write, Bash
---

# /sdd.optimizar memoria

Comprime automáticamente los archivos de memoria de agentes (`.sdd/memoria/agente-*.md`) cuando superan 50KB.

## Uso

```
/sdd.optimizar memoria
```

## Qué Hace

1. **Lee** archivos en `.sdd/memoria/`
2. **Deduplica** entradas por filepath (guarda solo la más reciente)
3. **Comprime** aplicando diccionario Caveman Level Full
4. **Crea backup** `.original.md` antes de sobrescribir
5. **Reporta** bytes salvados

## Ejemplo

```
ANTES: agente-arquitecto.md = 150KB (80 entradas)

/sdd.optimizar memoria

✨ [compress] arquitecto: 150KB → 15KB (10%), backup en .original.md
✨ [compress] critico: 87KB → 8.7KB (10%)

DESPUÉS: memoria total = 24KB
```

## Seguridad

- Nunca pierdes datos (backup siempre)
- Idempotente (ejecutar 2 veces = mismo resultado)
- Reversible: `.original.md` contiene datos originales

## Notas

- Se ejecuta automáticamente vía hook cuando memoria > 50KB
- Puedes ejecutarla manualmente cuando quieras
- Segura para ejecutar frecuentemente (sin riesgos)
