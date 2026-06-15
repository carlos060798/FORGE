---
description: Verifica que cualquier artefacto generado (spec, plan, código) cumple los principios de la constitución activa. Actúa como constraint explícito, no como sugerencia. Úsalo antes de entregar cualquier salida relevante.
---

# Skill: Constitución como Constraint

## Propósito

Los agentes deben actuar **desde la constitución**, no como sugerencia de fondo sino como restricción dura. Este skill provee el mecanismo de verificación explícita: carga solo las restricciones relevantes para la tarea en curso y verifica el artefacto generado contra ellas antes de entregarlo.

## Cuándo usar este skill

- Antes de presentar un plan técnico al usuario
- Antes de marcar una tarea de implementación como completada
- Cuando un agente está a punto de tomar una decisión arquitectónica
- Siempre que el orquestador detecte: cambio de stack, nueva dependencia, modificación de patrones arquitectónicos, desviación de estándares

## Carga eficiente de restricciones (por capa)

```bash
# PASO 1 — Extraer solo las restricciones aplicables (~100-200 tokens)
# No cargar la constitución completa — extraer lo relevante al tipo de artefacto

# Para decisiones de stack/arquitectura:
cat .sdd/memoria/constitucion.md 2>/dev/null | grep -A3 -i "stack\|framework\|arquitectura\|prohibido\|DEBE\|NO DEBE\|NUNCA"

# Para código/implementación:
cat .sdd/memoria/constitucion.md 2>/dev/null | grep -A3 -i "calidad\|cobertura\|lint\|funcion\|longitud\|patron\|test"

# Para seguridad:
cat .sdd/memoria/constitucion.md 2>/dev/null | grep -A3 -i "seguridad\|auth\|pii\|secreto\|token\|gdpr"

# Para estilo de API:
cat .sdd/memoria/constitucion.md 2>/dev/null | grep -A3 -i "api\|endpoint\|rest\|graphql\|contrato\|version"
```

## Verificación del artefacto

Para cada principio de la constitución que aplique al artefacto generado, evalúa:

| Principio | Cumple | Evidencia | Acción requerida |
|-----------|--------|-----------|------------------|
| [Principio extraído] | ✅/❌/⚠️ | [línea/sección del artefacto] | — / [qué corregir] |

## Reglas de bloqueo

**Bloquea** (el artefacto NO se entrega hasta corregir):
- ❌ Cualquier principio marcado como `DEBE` o `NUNCA` en la constitución
- ❌ Uso de stack, framework o librería prohibidos explícitamente
- ❌ Código que viola restricciones de seguridad declaradas

**Advierte** (el artefacto se entrega con advertencia visible):
- ⚠️ Principio `DEBERÍA` no cumplido con justificación técnica
- ⚠️ Desviación documentada en sección "Complejidad Justificada"

**Permite**:
- ✅ Principios cumplidos
- ✅ Desviaciones explícitamente aprobadas por el usuario en este ciclo

## Formato de reporte del constraint check

```
── Constitutional AI Check ─────────────────────────────
✅ Stack: [stack] — alineado con constitución
✅ Patrones: sigue [patrón] definido en constitución  
⚠️  Longitud función: 3 funciones superan límite de [N] líneas
   → Documentado en "Complejidad Justificada": [razón]
❌ Dependencia nueva: [paquete] no está aprobada en constitución
   → Requiere aprobación explícita antes de continuar
─────────────────────────────────────────────────────────
```

## Lo que este skill NO hace

- ❌ Cargar la constitución completa en cada check (ineficiente)
- ❌ Bloquear por principios que no aplican al tipo de artefacto
- ❌ Reemplazar el juicio del agente — provee datos, el agente decide
- ❌ Rechazar desviaciones ya documentadas y aprobadas
