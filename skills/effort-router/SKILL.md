---
description: Dado el nombre de la fase SDD actual, recomienda effort (low/medium/high/max) y modelo (Haiku/Sonnet/Opus) para cada agente. Evita pagar Opus cuando Sonnet o Haiku son suficientes — ahorro típico del 60-75% en fases mecánicas.
model: haiku
allowed-tools: Read
---

# Skill: Effort Router

## Propósito

Los agentes de FORGE usan modelos fijos declarados en su frontmatter. Pero no toda fase requiere el mismo nivel de razonamiento. Esta skill lee la fase actual del proyecto y produce una tabla de configuración recomendada: qué modelo usar en cada agente y con qué nivel de `effort`, para evitar gastar Opus donde Haiku es suficiente.

**Ahorro estimado por fase:**
- Fases mecánicas (tests, docs, deploy): 75-80% vs. Opus en todo
- Fases de verificación: 50-60%
- Fases de decisión (spec, plan, análisis): 0% — estas SÍ necesitan Opus

---

## Lo que lees primero

```bash
# Fase actual y spec activa
cat .sdd/estado.json 2>/dev/null | head -20 || echo "SIN_ESTADO"
```

---

## Tabla de routing por fase

### GRUPO A — Siempre Opus (decisiones críticas, no degradar)

| Fase SDD | Agente principal | Effort | Modelo | Razón |
|---|---|---|---|---|
| `especificacion` | arquitecto | high | claude-opus-4-8 | Define restricciones del sistema entero |
| `planificacion` | arquitecto, critico | high | claude-opus-4-8 | Decisiones de arquitectura irreversibles |
| `analisis` (7 dimensiones) | critico, seguridad | high | claude-opus-4-8 | Auditoría de riesgos — falsos negativos son costosos |
| `aclaracion` (cuando hay `[MARCADOR]`) | arquitecto | high | claude-opus-4-8 | Ambigüedades de spec → decisiones de arquitectura |

### GRUPO B — Sonnet suficiente (trabajo técnico estándar)

| Fase SDD | Agente principal | Effort | Modelo | Razón |
|---|---|---|---|---|
| `checklist` | (sin agente dedicado) | medium | claude-sonnet-4-6 | Verificación mecánica contra criterios conocidos |
| `tareas` | (sin agente dedicado) | medium | claude-sonnet-4-6 | Descomposición mecánica de plan → tareas |
| `implementacion` (backend/API) | desarrollador-backend, disenador-api | medium | claude-sonnet-4-6 | Implementación con spec clara |
| `implementacion` (frontend) | desarrollador-frontend | medium | claude-sonnet-4-6 | Implementación con spec clara |
| `verificacion` | verificador-implementacion | medium | claude-sonnet-4-6 | Cruzar CAs — bien definido |
| `qa` | tester | medium | claude-sonnet-4-6 | Orquestar Playwright — mecánico pero con estado |
| `snapshot` | (sin agente dedicado) | low | claude-sonnet-4-6 | Serializar estado actual |

### GRUPO C — Haiku suficiente (operaciones mecánicas puras)

| Fase SDD | Agente principal | Effort | Modelo | Razón |
|---|---|---|---|---|
| `aclaracion` (sin marcadores) | (sin agente dedicado) | low | claude-haiku-4-5-20251001 | Solo formatear preguntas conocidas |
| `implementacion` (tests) | tester | low | claude-haiku-4-5-20251001 | Tests unitarios con spec y código claros |
| `implementacion` (docs) | documentador | low | claude-haiku-4-5-20251001 | Documentar código ya escrito |
| `deploy` | operaciones | low | claude-haiku-4-5-20251001 | Ejecutar scripts CI/CD predefinidos |
| `canary` | operaciones | low | claude-haiku-4-5-20251001 | Igual que deploy |
| `release` | (sin agente dedicado) | low | claude-haiku-4-5-20251001 | Actualizar versiones y CHANGELOG |
| `retro` | (sin agente dedicado) | low | claude-haiku-4-5-20251001 | Formato de retrospectiva estructurado |

---

## Output que produces

Dado el JSON de `.sdd/estado.json`, imprime el bloque de configuración recomendada:

```
╔══════════════════════════════════════════════════════════════╗
║          🎯 EFFORT ROUTER — Configuración recomendada        ║
╠══════════════════════════════════════════════════════════════╣
║  Fase detectada: {FASE}                                      ║
╠══════════════════════════════════════════════════════════════╣
║  AGENTE               | MODELO          | EFFORT   | GRUPO  ║
║  ─────────────────────┼─────────────────┼──────────┼─────── ║
║  {agente}             | {modelo}        | {effort} | {A/B/C}║
╠══════════════════════════════════════════════════════════════╣
║  💰 AHORRO ESTIMADO vs. Opus-en-todo                         ║
║                                                              ║
║     Agentes en Grupo B:  {N} × ~60% ahorro por token        ║
║     Agentes en Grupo C:  {N} × ~80% ahorro por token        ║
║     Ahorro total estimado de la fase: ~{%}%                  ║
╠══════════════════════════════════════════════════════════════╣
║  ⚠️  ATENCIÓN                                                ║
║                                                              ║
║  Estos son defaults para la fase "{FASE}".                   ║
║  Si la tarea actual tiene ambigüedad estructural →           ║
║  sube a Opus para el agente afectado.                        ║
╚══════════════════════════════════════════════════════════════╝
```

### Cálculo del ahorro estimado

Precios de referencia (por millón de tokens):
- Opus 4.8: $5 input / $25 output
- Sonnet 4.6: $3 input / $15 output  ← 40% más barato en input, 40% en output
- Haiku 4.5: $1 input / $5 output   ← 80% más barato en input, 80% en output

Para la fase actual, suma los agentes activos y calcula el delta respecto a "todos Opus".

**Ejemplo — fase `implementacion`:**
```
Grupo A (Opus):    0 agentes
Grupo B (Sonnet):  3 agentes (backend, frontend, disenador-api) → ~40% ahorro c/u
Grupo C (Haiku):   2 agentes (tester, documentador) → ~80% ahorro c/u

Ahorro total estimado: ((3×0.40) + (2×0.80)) / 5 = ~56%
```

---

## Cómo aplicar las recomendaciones

Las recomendaciones son de sesión (no tocan los archivos `.md` de los agentes). Para aplicar en la sesión actual:

1. Cuando Claude Code invoca un agente vía `/sdd.implementar`, puedes prefixar la invocación con el modelo sugerido si el runtime lo permite.
2. Para cambios permanentes en el frontmatter del agente, edita `{PLUGIN_DIR}/agents/{nombre}.md` y cambia la línea `model:` del frontmatter.
3. Para registrar que usaste el router en esta sesión, añadir al ledger: `/sdd.estado consumo`.

---

## Notas

- Esta skill se invoca automáticamente desde `/sdd.optimizar` como PASO 2 cuando hay alertas de fan-out.
- Para proyectos con presupuesto de tokens restringido, usa junto con `token-budget` para ver el impacto económico real.
- La regla de oro: **si el agente toma una decisión que no se puede deshacer → Opus. Si ejecuta una decisión ya tomada → Sonnet o Haiku.**
