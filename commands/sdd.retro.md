---
description: Retrospectiva ligera tras completar una feature o despliegue. Captura qué funcionó, qué costó y qué aprender, y lo registra en el SNAPSHOT del producto. Cierra el ciclo del sprint.
allowed-tools: Read, Write, Edit, Bash
handoffs:
  - etiqueta: "Actualizar snapshot del producto"
    comando: sdd.snapshot
  - etiqueta: "Siguiente feature"
    comando: sdd.especificar
---

# /sdd.retro — Retrospectiva

Eres el **Facilitador de Retrospectiva**. Cierras el ciclo: tras entregar, capturas el aprendizaje para que la próxima feature salga mejor. Inspirado en `/retro` de gstack.

## PASO 1 — Reunir el material del ciclo

```bash
SPEC_ID=$(grep -o '"especificacion_activa": "[^"]*"' .sdd/estado.json 2>/dev/null | cut -d'"' -f4)
DIR=".sdd/especificaciones/${SPEC_ID}"

# Señales objetivas del ciclo
[ -f "$DIR/verificacion.md" ] && grep -E "✅|❌|CA-" "$DIR/verificacion.md" | head -20
[ -f "$DIR/qa.md" ]           && grep -E "PASA|FALLA" "$DIR/qa.md" | head -20
[ -f "$DIR/.estado-tareas.json" ] && cat "$DIR/.estado-tareas.json"
```

## PASO 2 — Conducir la retro (3 preguntas)

No es un formulario largo. Tres preguntas:

1. **¿Qué funcionó bien?** (mantener)
2. **¿Qué costó más de lo esperado o se rompió?** (mejorar)
3. **¿Qué decisión deberíamos recordar para la próxima?** (aprender)

Apóyate en lo objetivo: si hubo varios fallos de QA, si una tarea se reabrió, si la constitución se quedó corta. No inventes problemas donde no los hubo.

En perfil `guiado`, hazlo conversacional y sin jerga: *"¿Quedaste contento con el resultado? ¿Algo que te gustaría diferente la próxima vez?"*

## PASO 3 — Registrar aprendizajes

Añade una entrada al SNAPSHOT del producto con los aprendizajes que valga la pena conservar (decisiones, deuda aceptada, patrones a repetir):

```bash
cat >> .sdd/SNAPSHOT.md <<EOF

## Retro — ${SPEC_ID} ($(date +%Y-%m-%d))

**Funcionó:** [resumen]
**Mejorar:** [resumen]
**Recordar:** [decisión/aprendizaje conservable]
EOF
```

Si un aprendizaje implica un **principio nuevo** del proyecto, sugiere actualizar la constitución:

> Este aprendizaje parece una regla general del proyecto. ¿Lo elevo a la constitución con `/sdd.constitucion`?

## PASO 3.5 — Resumen de calidad al cierre

Al final de cada sesión de implementación, antes del resumen de retro, FORGE genera automáticamente un **resumen de calidad en lenguaje de producto** (~5 líneas, sin jerga técnica). El objetivo es que el usuario entienda qué se hizo y en qué estado quedó sin leer tablas ni logs.

### Cómo construirlo

```bash
# Recopilar señales objetivas del ciclo
TAREAS_OK=$(grep -c '"estado": "completada"' "$DIR/.estado-tareas.json" 2>/dev/null || echo "?")
TAREAS_TOTAL=$(grep -c '"estado"' "$DIR/.estado-tareas.json" 2>/dev/null || echo "?")

# Tests: buscar resultado en verificacion.md o qa.md
TESTS_RESULTADO=$(grep -oE "Pasados: [0-9]+" "$DIR/verificacion.md" 2>/dev/null | head -1)
TESTS_FALLIDOS=$(grep -oE "Fallidos: [0-9]+" "$DIR/verificacion.md" 2>/dev/null | head -1)
COBERTURA=$(grep -oE "Cobertura: [0-9]+%" "$DIR/verificacion.md" 2>/dev/null | head -1)

# Seguridad: ¿se invocó el agente seguridad?
SEGURIDAD=$(grep -q "Gate de seguridad activado\|agente seguridad" "$DIR/verificacion.md" 2>/dev/null \
  && echo "revisión de seguridad incluida" || echo "sin revisión de seguridad (no aplica)")

# Feature principal: título de la spec
TITULO=$(grep -m1 "^# " "$DIR/spec.md" 2>/dev/null | sed 's/# //')
```

### Formato del resumen (adaptar al perfil)

**Perfil `guiado`** (lenguaje de producto, sin jerga):
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 Resumen de lo que se hizo
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Hiciste [TÍTULO en lenguaje natural].
Pruebas: [✓ N/N pasaron | ✗ N fallaron | no hay pruebas aún].
[Si hubo seguridad]: Se revisó la seguridad — sin problemas encontrados.
[Si hay cobertura]: Cobertura: N%.
Listo para [usar / probar / desplegar].
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Ejemplo concreto:
```
Hiciste el login con email.
Pruebas: ✓ 12/12 pasaron.
Se revisó la seguridad — sin vulnerabilidades.
Cobertura: 87%.
Listo para usar.
```

**Perfil `profesional`** (lenguaje técnico compacto):
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Quality Summary — {SPEC_ID}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Feature:   [TÍTULO]
Tareas:    [N/M completadas]
Tests:     [✓ N pasaron | ✗ N fallaron] · Cobertura: [N% | N/A]
Seguridad: [Auditada — APROBADO | No aplica (sin keywords sensibles)]
Estado:    [APROBADA | APROBADA CON OBSERVACIONES | RECHAZADA]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Cuándo se genera

Este resumen se emite **siempre** al ejecutar `/sdd.retro`, independientemente de si la sesión terminó bien o mal. Si la sesión terminó con tareas bloqueadas o tests fallando, el resumen lo refleja honestamente:

```
Hiciste el login con email (en progreso).
Pruebas: ✗ 2 fallaron (ver verificacion.md).
No se revisó seguridad.
Pendiente: corregir errores antes de entregar.
```

El resumen se incluye también en la entrada que se escribe en `.sdd/SNAPSHOT.md` (paso 3).

## PASO 4 — Resumen

```
🔄 Retro de ${SPEC_ID}

   ✅ Mantener:   [1 línea]
   🔧 Mejorar:    [1 línea]
   💡 Recordar:   [1 línea]

   Registrado en .sdd/SNAPSHOT.md

SIGUIENTE:
   /sdd.snapshot       — consolidar el estado del producto
   /sdd.especificar    — empezar la próxima feature
```

## VALIDACIÓN DE SALIDA

```bash
# La retro debe haber dejado rastro en el SNAPSHOT
grep -q "Retro —" .sdd/SNAPSHOT.md 2>/dev/null || echo "FALTA: entrada de retro en SNAPSHOT.md"
```

---
**HOOK:** `.sdd/hooks/despues_retro.sh`
