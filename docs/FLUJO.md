# Flujo Completo de SDD-ES

## Diagrama del flujo

```
                    ┌──────────────────────┐
                    │   /sdd.constitucion  │  ← Solo la primera vez
                    │   (principios del    │
                    │    proyecto)         │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │   /sdd.configurar    │  ← Opcional: ajustar agentes/modelos
                    └──────────┬───────────┘
                               │
                ┌──────────────▼───────────┐
                │   /sdd.especificar       │
                │   (qué + por qué)        │
                └──────────────┬───────────┘
                               │
                       ┌───────┴───────┐
                       │   ¿micro?     │
                       └───┬───────┬───┘
                  sí ─────┘       └────── no
                           │              │
                           │     ┌────────▼────────┐
                           │     │  /sdd.aclarar    │ ← Resolver [NECESITA_ACLARACION]
                           │     └────────┬────────┘
                           │              │
                           │     ┌────────▼────────┐
                           │     │  /sdd.checklist  │ ← Validar calidad
                           │     └────────┬────────┘
                           │              │
                           │     ┌────────▼────────┐
                           │     │  /sdd.planificar │ ← Plan técnico
                           │     └────────┬────────┘
                           │              │
                           │     ┌────────▼─────────┐
                           │     │  /sdd.planificar │ ← Aprobar plan
                           │     │      aprobar     │
                           │     └────────┬─────────┘
                           │              │
                           │     ┌────────▼────────┐
                           │     │  /sdd.tareas     │ ← Desglose atómico
                           │     └────────┬────────┘
                           │              │
                           │     ┌────────▼────────┐
                           │     │  /sdd.analizar   │ ← Auditoría cruzada
                           │     └────────┬────────┘
                           │              │
                           └──────────────┼──────► (las micro vuelven aquí)
                                          │
                              ┌───────────▼──────────┐
                              │  /sdd.implementar    │ ← Ejecutar con agentes
                              └───────────┬──────────┘
                                          │
                              ┌───────────▼──────────┐
                              │  /sdd.verificar      │ ← Verificación final
                              └───────────┬──────────┘
                                          │
                              ┌───────────▼──────────┐
                              │  /sdd.snapshot       │ ← Actualizar estado producto
                              └───────────┬──────────┘
                                          │
                                          ▼
                                    ✅ COMPLETADO
                                          │
                                          └─── /sdd.especificar [siguiente]
```

## Flujos según tamaño del cambio

### Micro (≤3 archivos, <10 líneas)
```
/sdd.especificar [descripción]
→ Detecta micro → genera spec+plan+tareas automáticamente → implementa
```

### Pequeño (1 feature simple)
```
/sdd.especificar [descripción]
/sdd.planificar
/sdd.planificar aprobar
/sdd.tareas
/sdd.implementar
```

### Mediano (múltiples componentes)
```
/sdd.especificar [descripción]
/sdd.aclarar
/sdd.planificar
/sdd.planificar aprobar
/sdd.tareas
/sdd.implementar
/sdd.verificar
```

### Grande (sistema nuevo, calidad máxima)
```
/sdd.constitucion          (actualizar si hay nuevos principios)
/sdd.especificar [descripción]
/sdd.aclarar
/sdd.checklist
/sdd.planificar
/sdd.planificar aprobar
/sdd.tareas
/sdd.analizar              ← clave para grandes
/sdd.implementar
/sdd.verificar
/sdd.snapshot
```

## Reanudación entre sesiones

Si cierras Claude Code y vuelves después:

```
/sdd.estado           ← muestra dashboard
/sdd.implementar continuar  ← retoma desde la última tarea
```

El estado se guarda en `.sdd/estado.json` y `.sdd/especificaciones/{ID}/.estado-tareas.json`.

## El sprint completo: de la idea al despliegue

SDD-ES implementa un sprint estructurado de extremo a extremo. Cada fase alimenta a la siguiente y nada pasa sin verificación. Mapeo de las fases a los comandos:

| Fase del sprint | Qué ocurre | Comandos SDD-ES |
|-----------------|-----------|-----------------|
| **Pensar** | Encuadrar el problema, sacar contexto de una idea vaga | `/sdd.constitucion`, `/sdd.descubrir` |
| **Planear** | Capturar requisitos, diseñar, auditar el plan | `/sdd.especificar`, `/sdd.aclarar`, `/sdd.planificar`, `/sdd.analizar` |
| **Construir** | Implementar con agentes especializados | `/sdd.implementar` |
| **Revisar** | Revisión independiente de calidad y cumplimiento | `/sdd.verificar` (+ agente `revisor`) |
| **Probar** | QA en navegador real, no solo unitarios | `/sdd.qa` |
| **Publicar** | Despliegue verificado + monitoreo | `/sdd.desplegar`, `/sdd.canary` |
| **Reflexionar** | Capturar aprendizajes, actualizar el estado del producto | `/sdd.retro`, `/sdd.snapshot` |

```
Pensar → Planear → Construir → Revisar → Probar → Publicar → Reflexionar
  │                                                                │
  └──────────────── /sdd.especificar [siguiente feature] ◄────────┘
```

La diferencia con "pídele a la IA que lo haga" es que **cada flecha tiene un control**: no se construye sin spec, no se publica sin tests verdes y QA, no se cierra sin verificación independiente. Esa es la garantía de estándar de ingeniería alto.

### Flujo "fábrica" para no-programadores (perfil guiado)

En perfil `guiado`, el usuario no ve los comandos. Describe lo que quiere, confirma con "sí", y el sistema recorre el sprint completo explicando cada paso en lenguaje natural y publicando al final. Ver [FABRICA.md](FABRICA.md).
