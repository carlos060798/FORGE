---
description: Dashboard del estado actual del flujo SDD — qué fase, qué spec activa, progreso de tareas, próximo paso recomendado.
allowed-tools: Read, Bash
---

# /sdd.estado — Dashboard de Estado

## PASO 1 — Cargar todo el contexto

```bash
[ ! -d .sdd ] && echo "NO_INICIALIZADO" && exit 0

cat .sdd/estado.json
cat .sdd/sdd.config.yaml | head -50
ls .sdd/especificaciones/ 2>/dev/null

SPEC_ID=$(grep -o '"especificacion_activa": "[^"]*"' .sdd/estado.json | cut -d'"' -f4)
if [ -n "$SPEC_ID" ]; then
  cat ".sdd/especificaciones/${SPEC_ID}/.estado-tareas.json" 2>/dev/null
fi
```

## PASO 2 — Si no está inicializado

```
🚫 SDD-ES no está inicializado en este proyecto.

   Ejecuta:  /sdd.constitucion
```

## PASO 2.5 — Detectar perfil y elegir formato de dashboard

```bash
PERFIL=$(grep -o '"perfil": *"[^"]*"' .sdd/estado.json 2>/dev/null | cut -d'"' -f4)
[ -z "$PERFIL" ] && PERFIL=$(grep '^perfil:' .sdd/sdd.config.yaml 2>/dev/null | cut -d':' -f2 | tr -d ' ')
echo "PERFIL=${PERFIL:-guiado}"
```

- Si `PERFIL=guiado` (o no hay perfil): mostrar **dashboard de producto** (PASO 3A).
- Si `PERFIL=experto` y no hay modo explícito `pm`/`arq`/`dev`: mostrar **dashboard técnico** (PASO 3B).

## PASO 3A — Dashboard de producto (modo guiado, por defecto)

Muestra el estado en lenguaje natural, sin jerga técnica:

```
Tu proyecto: [Nombre del proyecto]

[Si hay feature activa:]
Estás trabajando en: [título de la spec en lenguaje natural]
Progreso: [N]% listo ([N] de [M] pasos completados)
[████████████░░░░░░░░]

¿Qué queda por hacer?
  ✅ [descripción natural del paso completado más reciente]
  → Próximo paso: [descripción natural de lo que sigue]

[Si hay bloqueos:]
  ⚠️  Hay un problema que necesita tu atención: [descripción natural del bloqueo]

[Si no hay feature activa:]
¡Listo para empezar! ¿Qué quieres construir ahora?
```

Reglas para el dashboard de producto:
- Nunca mostrar IDs internos (`2026-06-14-auth`, `pipeline_step`, `T003`).
- Nunca mencionar nombres de comandos a menos que el usuario los pida.
- Usar "feature", "funcionalidad" o "lo que estás construyendo" en vez de "spec" o "especificación".
- Traducir las fases del pipeline a lenguaje natural:
  | Fase interna | Texto para usuario |
  |---|---|
  | `especificacion` | "Definiendo los detalles" |
  | `plan` | "Planificando cómo construirlo" |
  | `plan_aprobado` | "Plan listo, preparando tareas" |
  | `tareas_generadas` | "Tareas listas, empezando a construir" |
  | `implementacion` | "Construyendo..." |
  | `implementacion_completa` | "Construcción lista, verificando" |
  | `verificada` | "Verificado y funcionando" |
  | `completado` | "¡Listo! Feature entregada" |

## PASO 3B — Dashboard técnico (modo experto o modo `dev`)

```
╔════════════════════════════════════════════════════════════════╗
║                  SDD-ES — Dashboard del Proyecto               ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║  📌 PROYECTO                                                   ║
║     Nombre:       [del estado]                                 ║
║     Inicializado: [fecha]                                      ║
║     Constitución: v[X.Y.Z]                                     ║
║     Stack:        [LENGUAJE] / [FRAMEWORK]                     ║
║                                                                ║
╠════════════════════════════════════════════════════════════════╣
║  🎯 ESPECIFICACIÓN ACTIVA                                      ║
║                                                                ║
║     ID:           {SPEC_ID}                                    ║
║     Título:       [título]                                     ║
║     Fase actual:  {FASE}                                       ║
║     Tamaño:       {TAMAÑO}                                     ║
║                                                                ║
║     ESTADO POR ARTEFACTO:                                      ║
║     • Spec:       ✅ generada                                  ║
║     • Aclarada:   ✅ / ⏸ / ❌                                  ║
║     • Checklist:  ✅ APROBADA / ⚠️ obs / ❌                    ║
║     • Plan:       ✅ aprobado / ⏸ pendiente                   ║
║     • Tareas:     ✅ {N} generadas / ⏸                         ║
║     • Análisis:   ✅ APROBADO / ⚠️ obs / 🔴 BLOQUEADO          ║
║     • Implementa: 🔧 en progreso / ✅ / ⏸                     ║
║     • Verificada: ✅ / ⏸                                       ║
║                                                                ║
║     PROGRESO DE TAREAS:                                        ║
║     [████████████░░░░░░░░] 60% ({N}/{M})                       ║
║                                                                ║
║     ✅ Completadas: {N}                                        ║
║     🔧 En progreso: 1 (T00X)                                   ║
║     ⬜ Pendientes:  {N}                                        ║
║     ❌ Bloqueadas:  {N}                                        ║
║                                                                ║
╠════════════════════════════════════════════════════════════════╣
║  🤖 AGENTES CONFIGURADOS                                       ║
║                                                                ║
║     [✅] arquitecto              (opus)                        ║
║     [✅] disenador-api           (sonnet)                      ║
║     [✅] asesor-datos            (opus)                        ║
║     [✅] desarrollador-backend   (sonnet)                      ║
║     [❌] desarrollador-frontend  (sonnet) — desactivado        ║
║     [✅] operaciones             (sonnet)                      ║
║     [✅] tester                  (sonnet)                      ║
║     [✅] revisor                 (opus)                        ║
║                                                                ║
╠════════════════════════════════════════════════════════════════╣
║  📚 HISTORIAL DEL PROYECTO                                     ║
║                                                                ║
║     Especificaciones totales: [N]                              ║
║                                                                ║
║     Últimas 5:                                                 ║
║     ✅ 2026-06-01-auth-magic-link  (completada)                ║
║     ✅ 2026-06-03-perfiles-usuario (completada)                ║
║     🔄 2026-06-08-pagos-stripe     (en progreso)               ║
║     ⏸  2026-06-09-export-csv      (en borrador)                ║
║                                                                ║
╠════════════════════════════════════════════════════════════════╣
║  ➡️  PRÓXIMO PASO RECOMENDADO                                  ║
║                                                                ║
║     {COMANDO_SUGERIDO}                                         ║
║                                                                ║
║     Razón: {EXPLICACIÓN}                                       ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
```

## PASO 4 — Determinar próximo paso según fase (para ambos modos)

| Fase actual | Próximo paso |
|-------------|--------------|
| Sin inicializar | `/sdd.constitucion` |
| `constitucion_completa` | `/sdd.especificar [descripción]` |
| `especificacion` (con marcadores) | `/sdd.aclarar` |
| `especificacion` (limpia, no verificada) | `/sdd.checklist` o `/sdd.planificar` |
| `plan` (no aprobado) | `/sdd.planificar aprobar` |
| `plan_aprobado` | `/sdd.tareas` |
| `tareas_generadas` (no analizadas) | `/sdd.analizar` o `/sdd.implementar` |
| `implementacion` (en progreso) | `/sdd.implementar continuar` |
| `implementacion_completa` | `/sdd.verificar` |
| `verificada` (sin snapshot) | `/sdd.snapshot` |
| `completado` | `/sdd.especificar [nueva feature]` |

## PASO 5 — Consumo de agentes (observabilidad)

Si existe `.sdd/observabilidad/consumo.jsonl`, invocar la skill `observabilidad-consumo` y añadir una sección al dashboard:

```bash
[ -f .sdd/observabilidad/consumo.jsonl ] && wc -l .sdd/observabilidad/consumo.jsonl
```

Si hay datos, mostrar al final del dashboard:

```
╠════════════════════════════════════════════════════════════════╣
║  📊 CONSUMO DE AGENTES (sesión actual)                         ║
║                                                                ║
║     [resumen de invocaciones por agente]                       ║
║     [alertas de fan-out si las hay]                            ║
║                                                                ║
║     Ver detalle completo: /sdd.estado consumo                  ║
╚════════════════════════════════════════════════════════════════╝
```

`/sdd.estado consumo` — invoca `observabilidad-consumo` y muestra el reporte completo.

## PASO 6 — Modos adicionales

`/sdd.estado historial` — muestra solo el historial completo de specs
`/sdd.estado tareas` — muestra solo el detalle de tareas de la spec activa
`/sdd.estado agentes` — muestra solo la config de agentes
`/sdd.estado consumo` — muestra el reporte de observabilidad de agentes
`/sdd.estado todo` — muestra TODO lo de arriba más detalles extendidos

## PASO 7 — Output styles (modos de presentación)

Si el argumento contiene `pm`, `arq` o `dev`, adapta el output del dashboard:

**Modo `pm` (Product Manager):**
```
📊 ESTADO DEL PROYECTO — [Nombre]

✅ Feature en curso: [título de la spec activa en lenguaje natural]
📈 Progreso: [N]% completado ([N] de [M] tareas listas)
🎯 Próximo hito: [descripción en lenguaje natural del siguiente paso]
🚦 Estado general: [Verde / Amarillo / Rojo]

¿Qué necesitas saber?
- Avance → responde "avance"
- Bloqueos → responde "problemas"
- Cuándo termina → responde "estimado"
```

**Modo `arq` (Arquitecto):**
```
📐 ESTADO TÉCNICO — [Nombre]

Stack: [lenguaje/framework]
Spec activa: [ID] — [título]
Fase: [fase actual]

Artefactos:
  spec.md        → [✅/⏸/❌]
  plan.md        → [✅/⏸/❌] — [versión/fecha]
  tareas.md      → [N] tareas ([distribución por agente])
  analisis.md    → [veredicto]

Decisiones de arquitectura pendientes: [N ADRs sin cerrar]
Riesgos abiertos: [N del último análisis]
Deuda técnica registrada: [N items]

Próxima decisión técnica requerida: [descripción]
```

**Modo `dev` (Desarrollador) — default:**
El dashboard completo con la barra de progreso de tareas (formato actual del PASO 3).
