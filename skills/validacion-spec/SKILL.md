---
description: Valida silenciosamente que la spec activa cumple el mínimo de calidad antes de pasar a la siguiente fase. Se invoca internamente.
---

# Skill: Validación de Spec

## Checks mínimos (bloquean si fallan)

1. **Objetivo presente**: Sección "Objetivo" no vacía
2. **Mínimo 1 CA**: Al menos 1 ítem en criterios de aceptación
3. **Mínimo 1 escenario**: Al menos 1 bloque Dado/Cuando/Entonces
4. **Sin críticos pendientes**: 0 marcadores `[NECESITA_ACLARACION]` en preguntas críticas
5. **Frontmatter válido**: YAML bien formado con `id`, `titulo`, `estado`

## Checks de calidad (warnings, no bloquean)

- CAs con palabras vagas ("rápido", "fácil", "bueno", "intuitivo")
- Escenarios de error ausentes
- Más de 5 preguntas abiertas sin resolver
- Sin sección "Fuera de Alcance"
- Sin métricas de éxito medibles
- Sin actores definidos

## Implementación (pseudocódigo)

```bash
SPEC_FILE=".sdd/especificaciones/$(spec_activa)/spec.md"

# Check 1: objetivo
grep -A2 "## 2. Objetivo" "$SPEC_FILE" | tail -1 | grep -q '\w' || echo "FALTA_OBJETIVO"

# Check 2: CAs
grep -c "CA-[0-9]" "$SPEC_FILE" | grep -qv '^0$' || echo "SIN_CAS"

# Check 3: escenarios
grep -c "**Dado**" "$SPEC_FILE" | grep -qv '^0$' || echo "SIN_ESCENARIOS"

# Check 4: marcadores críticos
N_CRITICOS=$(grep -c "\[NECESITA_ACLARACION\]" "$SPEC_FILE")
[ "$N_CRITICOS" -gt 0 ] && echo "$N_CRITICOS pendientes"

# Check 5: frontmatter
head -20 "$SPEC_FILE" | grep -q '^id:' || echo "FRONTMATTER_INCOMPLETO"
```

## Output

Si pasa todos los críticos: continúa silenciosamente, no muestra nada.

Si falla algún crítico:
> ❌ La spec no está lista: [razón específica]
> Usa `/sdd.aclarar` o `/sdd.checklist`.
