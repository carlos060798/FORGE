# Guía de Modelos por Agente

## Routing dinámico desde v2.7.0

A partir de v2.7.0, `/sdd.implementar` ajusta el modelo del Grupo OPUS automáticamente según la complejidad estimada en `ir.json`:

| `estimated_complexity` | Grupo OPUS (arquitecto, critico, seguridad, asesor-datos, revisor) | Grupo SONNET | Grupo HAIKU |
|---|---|---|---|
| `alta` (o ausente) | claude-opus-4-8 | claude-sonnet-4-6 | claude-haiku-4-5 |
| `media` | claude-sonnet-4-6 | claude-sonnet-4-6 | claude-haiku-4-5 |
| `baja` | claude-sonnet-4-6 | claude-sonnet-4-6 | claude-haiku-4-5 |

Si `ir.json` no existe o es más antiguo que `spec.md`, se usa `alta` por defecto (falla segura).
Para forzar un modelo concreto en un agente, edita `.sdd/sdd.config.yaml` → `agentes.[nombre].modelo`.

## Tabla maestra de recomendaciones

| Agente | Recomendado | Aceptable | Evitar | Razón principal |
|--------|-------------|-----------|--------|-----------------|
| arquitecto | **opus** (alta) / sonnet (media/baja) | sonnet (proyectos pequeños) | haiku | Decisiones difíciles de revertir |
| disenador-api | **sonnet** | opus (APIs complejas) | haiku | Diseño estructurado pero acotado |
| asesor-datos | **opus** | sonnet (BD simple) | haiku | Errores de BD son costosos |
| desarrollador-backend | **sonnet** | opus (lógica compleja), haiku (CRUD simple) | — | Codificación general |
| desarrollador-frontend | **sonnet** | opus (UI compleja), haiku (componentes simples) | — | Codificación general |
| operaciones | **sonnet** | haiku (scripts simples), opus (infra crítica) | — | Configuración |
| tester | **sonnet** | haiku (tests simples) | opus (overkill) | Generación con patrones |
| revisor | **opus** | sonnet | haiku | Revisión profunda atrapa más bugs |
| critico | **opus** | sonnet | haiku | Requiere razonamiento abstracto |
| seguridad | **opus** | — | sonnet, haiku | Auditoría debe ser exhaustiva |
| documentador | **sonnet** | haiku | opus (overkill) | Generación estructurada |
| investigador | **sonnet** | opus (investigación profunda) | haiku | Análisis comparativo |
| product-designer | **opus** | sonnet (MVPs) | haiku | Decisiones de producto irreversibles |
| architecture-designer | **sonnet** | opus (stacks complejos) | haiku | Propuesta técnica estructurada |

## Filosofía

**Usa el modelo más pequeño que resuelva el problema bien.** Subir de tier solo si el agente falla repetidamente.

### ¿Cuándo subir a opus?

- El agente da respuestas inconsistentes
- La tarea requiere considerar múltiples restricciones simultáneamente
- El costo de un error es alto (BD, seguridad, arquitectura)
- El razonamiento requiere abstracción profunda

### ¿Cuándo bajar a haiku?

- La tarea es muy estructurada (rellenar plantilla)
- El agente funciona bien con sonnet y quieres ahorrar
- Tareas en lote (muchas similares)

## Combinaciones efectivas

### Combinación "alta calidad"
```yaml
# Diseño con opus, implementación con sonnet, calidad con opus
arquitecto: opus
disenador-api: sonnet
asesor-datos: opus
desarrollador-backend: sonnet
desarrollador-frontend: sonnet
operaciones: sonnet
tester: sonnet
revisor: opus
critico: opus
seguridad: opus
```

### Combinación "rápida y económica" (para MVPs)
```yaml
arquitecto: sonnet
disenador-api: sonnet
asesor-datos: sonnet
desarrollador-backend: sonnet
desarrollador-frontend: sonnet
operaciones: haiku
tester: haiku
revisor: sonnet
critico: sonnet
seguridad: sonnet
```

### Combinación "máxima calidad" (enterprise)
```yaml
# Todo opus en agentes de decisión, sonnet en implementación rápida
arquitecto: opus
disenador-api: opus
asesor-datos: opus
desarrollador-backend: sonnet
desarrollador-frontend: sonnet
operaciones: opus  # infra crítica
tester: sonnet
revisor: opus
critico: opus
seguridad: opus
documentador: sonnet
```

## Cambiar modelos

```
/sdd.configurar modelos
```

O edita `.sdd/sdd.config.yaml`:

```yaml
agentes:
  arquitecto:
    modelo: opus  # cambiar aquí
```

Los cambios aplican a la próxima invocación.

## Notas

- Esta guía se basa en la familia Claude (opus/sonnet/haiku) al momento de escribir esto.
- Si Anthropic publica un nuevo modelo, actualiza esta tabla en tu proyecto.
- Otros proveedores: si usas Claude Code con otros modelos, ajusta las recomendaciones.
