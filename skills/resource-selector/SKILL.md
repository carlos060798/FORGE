---
description: Decide autónomamente qué agentes y skills son necesarios para la spec activa, basándose en complejidad, tipo de producto y etapa del pipeline. Evita cargar recursos innecesarios en contexto.
---

# Skill: resource-selector

## Propósito

Evalúa el contexto real del proyecto (ir.json, estado.json, sdd.config.yaml) y produce una lista mínima de agentes y skills necesarios para la sesión actual. Claude lo invoca automáticamente al inicio de `/sdd.planificar`, `/sdd.tareas` y `/sdd.implementar`.

## Cuándo invocar

- Al inicio de `/sdd.planificar` — antes de decidir qué agentes participan
- Al inicio de `/sdd.tareas` — para saber qué agentes pueden ser asignados
- Al inicio de `/sdd.implementar` — para saber qué skills están disponibles
- Cuando `estado.json → pipeline_step` cambia de etapa

## Proceso

### PASO 1 — Leer contexto disponible

```bash
# Complejidad estimada
COMPLEXITY=$(grep -o '"estimated_complexity"[[:space:]]*:[[:space:]]*"[^"]*"' .sdd/ir.json 2>/dev/null | cut -d'"' -f4)
[ -z "$COMPLEXITY" ] && COMPLEXITY=$(grep 'complejidad_estimada' .sdd/estado.json 2>/dev/null | cut -d'"' -f4)
[ -z "$COMPLEXITY" ] && COMPLEXITY="high"   # conservador si no hay dato

# Tipo de producto
TIPO=$(grep -o '"type"[[:space:]]*:[[:space:]]*"[^"]*"' .sdd/ir.json 2>/dev/null | head -1 | cut -d'"' -f4)
[ -z "$TIPO" ] && TIPO="other"

# Etapa actual
STEP=$(grep -o '"pipeline_step"[[:space:]]*:[[:space:]]*"[^"]*"' .sdd/estado.json 2>/dev/null | cut -d'"' -f4)
[ -z "$STEP" ] && STEP="plan"

# Features mencionadas (para detectar dominios sensibles)
FEATURES=$(grep -A20 '"core"' .sdd/ir.json 2>/dev/null | tr -d '\n "[]' | tr ',' '\n')
MENCIONA_AUTH=$(echo "$FEATURES" | grep -iE "auth|login|jwt|oauth|sesion|usuario" | wc -l | tr -d ' ')
MENCIONA_PAGOS=$(echo "$FEATURES" | grep -iE "pago|stripe|factura|suscripcion|billing" | wc -l | tr -d ' ')
MENCIONA_BD=$(echo "$FEATURES" | grep -iE "base de datos|database|sql|postgres|mysql|mongo" | wc -l | tr -d ' ')
MENCIONA_DEPLOY=$(echo "$FEATURES" | grep -iE "deploy|ci|cd|docker|kubernetes|railway|vercel" | wc -l | tr -d ' ')
TIENE_FRONTEND=$(echo "$TIPO" | grep -iE "saas|web|mobile" | wc -l | tr -d ' ')
```

### PASO 2 — Aplicar manifiesto de activación

Evalúa cada agente y skill contra estas reglas. El manifiesto canónico está en `configuracion-ejemplo/agent-manifest.yaml` pero las reglas base son:

#### Agentes — Tabla de activación

| Agente | Condición de activación |
|--------|------------------------|
| `arquitecto` | **SIEMPRE** |
| `desarrollador-backend` | **SIEMPRE** (toda spec tiene lógica de servidor) |
| `tester` | **SIEMPRE** |
| `revisor` | SIEMPRE en `high`; en `medium`/`low` solo si `STEP == verify` o `STEP == code` |
| `critico` | `complexity == high` O `MENCIONA_AUTH > 0` O `MENCIONA_PAGOS > 0` |
| `seguridad` | `MENCIONA_AUTH > 0` O `MENCIONA_PAGOS > 0` O `complexity == high` |
| `asesor-datos` | `MENCIONA_BD > 0` O `complexity in [medium, high]` |
| `disenador-api` | `TIPO in [api, saas]` O `complexity in [medium, high]` |
| `desarrollador-frontend` | `TIENE_FRONTEND > 0` O `TIPO in [saas, web, mobile]` |
| `product-designer` | `STEP in [design]` O `TIPO in [saas, web, mobile]` |
| `architecture-designer` | `STEP in [design, plan]` Y `complexity in [medium, high]` |
| `operaciones` | `MENCIONA_DEPLOY > 0` O `complexity == high` O `STEP in [deploy]` |
| `investigador` | `complexity == high` O `STEP in [discovery]` |
| `documentador` | `complexity == high` Y configurado como `activo: true` en sdd.config.yaml |

#### Skills — Tabla de activación

| Skill | Condición de activación |
|-------|------------------------|
| `gestion-estado` | **SIEMPRE** |
| `enrutador-agentes` | **SIEMPRE** |
| `effort-router` | **SIEMPRE** |
| `deteccion-stack` | `STEP in [discovery, plan]` |
| `validacion-spec` | `STEP in [spec, plan]` |
| `constitucion-constraint` | **SIEMPRE** (la constitución aplica siempre) |
| `verificador-implementacion` | `STEP in [verify, code]` |
| `memory-compactor` | **SIEMPRE** (gestión de memoria es siempre relevante) |
| `mutation-detector` | `STEP in [code, verify]` |
| `adr-indexer` | `complexity in [medium, high]` |
| `orquestacion-ptc` | `complexity == high` O número de tareas > 6 |
| `token-budget` | **SIEMPRE** |
| `descubrir-idea` | `STEP in [discovery, idea]` |
| `interpretar-idea` | `STEP in [discovery, ir]` |
| `elegir-direccion` | `STEP in [design]` Y `TIENE_FRONTEND > 0` |
| `wireframe-mvp` | `STEP in [design]` Y `TIENE_FRONTEND > 0` |
| `critica-diseno` | `STEP in [design]` Y `TIENE_FRONTEND > 0` |
| `modo-guiado` | `perfil == guiado` (leer de sdd.config.yaml) |
| `explicame` | `perfil == guiado` |
| `compresion-tokens` | `sesion.modo in [rapido, prototipo]` |
| `deploy-vercel` | `MENCIONA_DEPLOY > 0` Y destino Vercel |
| `vercel-deploy` | igual que `deploy-vercel` |
| `github-connect` | `STEP in [deploy]` Y repo no conectado |
| `indexador` | `STEP in [plan, code]` Y `complexity in [medium, high]` |
| `indexar-proyecto` | igual que `indexador` |
| `observabilidad-consumo` | `complexity == high` O `STEP in [verify, deploy]` |
| `share-progress` | `complexity == high` |
| `mejorar-prompt` | `STEP in [discovery, idea]` |
| `cache-audit` | `complexity == high` (optimización avanzada) |

### PASO 3 — Filtrar por sdd.config.yaml

Para cada agente en la lista activa resultante, verificar que `activo: true` en `.sdd/sdd.config.yaml`. Si está explícitamente en `activo: false`, excluir aunque la condición se cumpla.

```bash
for AGENTE in $AGENTES_ACTIVOS; do
  ACTIVO=$(grep -A3 "^  ${AGENTE}:" .sdd/sdd.config.yaml 2>/dev/null | grep 'activo:' | grep -c 'true')
  [ "$ACTIVO" -eq 0 ] && AGENTES_ACTIVOS=$(echo "$AGENTES_ACTIVOS" | grep -v "^${AGENTE}$")
done
```

### PASO 4 — Producir el manifiesto de sesión

Escribe `.sdd/recursos-sesion.json` con los recursos activos para esta sesión:

```json
{
  "generado": "2026-06-22T10:00:00Z",
  "contexto": {
    "complexity": "medium",
    "tipo_producto": "saas",
    "pipeline_step": "plan",
    "dominios_sensibles": ["auth"]
  },
  "agentes_activos": [
    "arquitecto",
    "desarrollador-backend",
    "desarrollador-frontend",
    "tester",
    "revisor",
    "critico",
    "seguridad",
    "asesor-datos",
    "disenador-api"
  ],
  "skills_activas": [
    "gestion-estado",
    "enrutador-agentes",
    "effort-router",
    "validacion-spec",
    "constitucion-constraint",
    "token-budget",
    "memory-compactor",
    "adr-indexer"
  ],
  "agentes_excluidos": ["product-designer", "operaciones", "investigador", "documentador", "architecture-designer"],
  "skills_excluidas": ["descubrir-idea", "interpretar-idea", "elegir-direccion", "wireframe-mvp", "critica-diseno", "deploy-vercel", "vercel-deploy", "github-connect", "cache-audit", "orquestacion-ptc", "share-progress", "observabilidad-consumo", "explicame", "compresion-tokens", "mejorar-prompt", "indexador", "indexar-proyecto", "mutation-detector", "verificador-implementacion"]
}
```

### PASO 5 — Reportar al usuario (modo guiado) o silencioso (modo experto)

**Modo guiado:**
```
FORGE cargó 9 de 14 agentes y 8 de 29 skills para esta spec.
Recursos excluidos: product-designer, operaciones, investigador,
documentador, architecture-designer (no necesarios para API medium).
```

**Modo experto:** solo escribe `.sdd/recursos-sesion.json` sin mensaje.

## Salida

- Archivo `.sdd/recursos-sesion.json` con la selección activa
- Variable implícita `$AGENTES_ACTIVOS` y `$SKILLS_ACTIVAS` para el comando que invocó esta skill

## Estimación de ahorro por escenario

| Escenario | Agentes | Skills | vs. carga total |
|-----------|---------|--------|-----------------|
| Landing page (web, low) | 3/14 | 6/29 | −79% agentes, −79% skills |
| API REST (api, medium) | 7/14 | 8/29 | −50% agentes, −72% skills |
| SaaS con auth+pagos (saas, high) | 11/14 | 16/29 | −21% agentes, −45% skills |
| Sistema enterprise (high, todos los dominios) | 14/14 | 22/29 | 0% — carga completa solo cuando realmente aplica |

## Limitaciones

- Requiere que `ir.json` exista y tenga `estimated_complexity` y `product.type`. Si no existe, activa todos los agentes (comportamiento conservador).
- La detección de dominios sensibles (auth, pagos) es heurística basada en keywords en `features.core`. Puede fallar si la spec usa términos no estándar.
- No detecta cambios mid-session: si la spec evoluciona durante la implementación, el manifiesto no se recalcula automáticamente. Invocar `/sdd.mapear` para forzar recálculo.
