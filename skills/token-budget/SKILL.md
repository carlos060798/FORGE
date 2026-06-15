---
description: Dado el estado actual del proyecto (fase, tareas pendientes, historial de consumo), estima el presupuesto de tokens por fase restante y recomienda si usar PTC paralelo o serial. Reutiliza criterios de orquestacion-ptc para la recomendación de paralelización.
model: haiku
allowed-tools: Read
---

# Skill: Token Budget

## Propósito

Antes de lanzar una fase costosa (planificación, análisis 7-dimensiones, implementación de 10+ tareas), esta skill proyecta el costo estimado en tokens y recomienda la estrategia de ejecución más eficiente. Evita sorpresas de presupuesto a mitad de un proyecto largo.

---

## Lo que lees

```bash
# Estado general del proyecto
cat .sdd/estado.json

# Tareas pendientes de la spec activa
SPEC_ID=$(grep -o '"especificacion_activa": "[^"]*"' .sdd/estado.json 2>/dev/null | cut -d'"' -f4)
[ -n "$SPEC_ID" ] && cat ".sdd/especificaciones/${SPEC_ID}/.estado-tareas.json" 2>/dev/null

# Historial de consumo (para calcular velocidad real de la sesión)
cat .sdd/observabilidad/consumo.jsonl 2>/dev/null | tail -50 || echo "SIN_HISTORIAL"

# Configuración de agentes habilitados
cat .sdd/sdd.config.yaml 2>/dev/null | head -30 || echo "SIN_CONFIG"
```

---

## Modelo de estimación

### Costos de referencia por fase (en unidades de "peso relativo")

Las unidades son relativas entre sí — no son tokens reales, ya que Claude Code no expone el conteo exacto. Se calibran con los datos del ledger si están disponibles.

| Fase | Agentes activos | Peso base | Factor por tarea |
|---|---|---|---|
| `especificacion` | arquitecto (Opus) | 8 | +1 por cada requisito ambiguo |
| `aclaracion` | ninguno dedicado | 2 | fijo |
| `checklist` | ninguno dedicado | 2 | fijo |
| `planificacion` | arquitecto, critico (Opus) | 10 | +2 por cada riesgo identificado |
| `tareas` | ninguno dedicado | 3 | +0.5 por tarea a generar |
| `analisis` (7 dims) | critico, seguridad (Opus) | 12 | fijo (siempre 7 dimensiones) |
| `implementacion` | 1-5 agentes (Sonnet) | 4 | ×N tareas pendientes |
| `verificacion` | ninguno dedicado | 4 | ×N CAs a verificar |
| `qa` | tester (Sonnet) | 5 | ×N flows a probar |
| `deploy` | operaciones (Haiku) | 2 | fijo |

### Calibración con ledger histórico

Si existe `consumo.jsonl` con datos de la sesión actual:

```
node -e "
const fs = require('fs');
const path = '.sdd/observabilidad/consumo.jsonl';
if (!fs.existsSync(path)) { console.log('SIN_DATOS'); process.exit(0); }

const lineas = fs.readFileSync(path, 'utf8').trim().split('\n').filter(Boolean);
const parsed = lineas.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

// Bytes totales por fase (agrupando por agente que los escribió)
const porAgente = {};
for (const e of parsed) {
  const a = e.agente || 'main';
  porAgente[a] = (porAgente[a] || 0) + (e.bytes || 0);
}

const totalBytes = Object.values(porAgente).reduce((s,v) => s+v, 0);
console.log('Bytes totales sesión: ' + totalBytes);
console.log('Velocidad promedio: ' + Math.round(totalBytes / lineas.length) + ' bytes/evento');
console.log('Eventos totales: ' + lineas.length);
"
```

Usar la velocidad promedio como factor de calibración: si el historial muestra >1000 bytes/evento, los pesos base ×1.5.

---

## Recomendación de paralelización (reutiliza orquestacion-ptc)

Regla del criterio de independencia (de `orquestacion-ptc`):

**Usar PTC paralelo cuando:**
- Las tareas no se bloquean entre sí (salida de A no es entrada de B)
- Hay ≥3 tareas del mismo tipo para el mismo agente
- Las tareas son verificaciones (sin efectos secundarios que se pisen)
- Ahorro esperado: −70 a −85% en tokens del orquestador

**Usar serial cuando:**
- La tarea N+1 depende del resultado de la tarea N
- Son acciones sobre infraestructura (migrations, deploys) donde el orden importa
- Solo hay 1-2 tareas (overhead de PTC no vale)

Para la fase `implementacion` con N tareas pendientes:

| N tareas pendientes | Estrategia recomendada | Ahorro estimado |
|---|---|---|
| 1-2 | Serial (directo) | — |
| 3-5 independientes | PTC paralelo (lote de 3-5) | ~70% |
| 6-10 independientes | PTC en 2 lotes de 5 | ~65% |
| >10 independientes | PTC en lotes de 5 + agrupación por agente | ~60% |
| Cualquier N con deps | Serial (respetar grafo de dependencias) | — |

---

## Señal de alerta: presupuesto proyectado < 20%

Tras calcular el peso total estimado de las fases restantes y compararlo con el presupuesto disponible (calibrado con el ledger), si **el presupuesto proyectado restante cae por debajo del 20%**, emite una alerta destacada antes de cualquier recomendación:

```
⚠️  ALERTA DE PRESUPUESTO — proyección < 20% disponible

   Presupuesto proyectado restante: {X}%  (umbral crítico: 20%)
   Fases que aún no caben con el margen actual: {lista}

   ACCIONES RECOMENDADAS (de mayor a menor impacto):
   1. Ejecutar /sdd.comprimir aplicar para liberar contexto ahora.
   2. Degradar modelos con effort-router en las fases restantes.
   3. Paralelizar con PTC las tareas independientes (ahorro del orquestador).
   4. Dividir la fase de implementación: ejecutar por lotes y comprimir entre lotes.
```

Cómo se calcula el porcentaje proyectado: `(peso_disponible − peso_total_estimado_fases_restantes) / peso_disponible × 100`. Si no hay historial para fijar `peso_disponible`, usa el umbral conservador del ledger (velocidad observada × eventos restantes estimados) y marca la alerta como **estimación sin calibrar**.

La alerta es informativa y no bloquea: el usuario decide. Pero debe mostrarse SIEMPRE que la proyección cruce el umbral del 20%.

---

## Output que produces

```
╔══════════════════════════════════════════════════════════════════╗
║           💰 TOKEN BUDGET — Proyección de Fases Restantes        ║
╠══════════════════════════════════════════════════════════════════╣
║  Fase actual: {fase}  |  Spec: {SPEC_ID}                        ║
╠══════════════════════════════════════════════════════════════════╣
║  FASES RESTANTES      | PESO EST. | ESTRATEGIA    | AGENTES     ║
║  ─────────────────────┼───────────┼───────────────┼──────────── ║
║  implementacion       | ████ 40   | PTC × 3 lotes | 3 agentes   ║
║    └─ {N} tareas pend.|           | serial internamente         ║
║  verificacion         | ██ 16     | Serial (deps) | —           ║
║  qa                   | ██ 10     | PTC × flows   | tester      ║
║  deploy               | █ 4       | Serial        | operaciones ║
║  ─────────────────────┼───────────┼───────────────┼──────────── ║
║  TOTAL ESTIMADO       | ████████  | 70            |             ║
╠══════════════════════════════════════════════════════════════════╣
║  📊 CALIBRACIÓN CON HISTORIAL                                    ║
║                                                                  ║
║  {datos del ledger o "Sin historial — usando pesos base"}        ║
╠══════════════════════════════════════════════════════════════════╣
║  🚀 RECOMENDACIÓN DE EJECUCIÓN                                   ║
║                                                                  ║
║  1. {fase más costosa}: usar effort-router para degradar         ║
║     modelos donde sea posible (ahorro ~{%}% estimado)            ║
║                                                                  ║
║  2. {fase con tareas independientes}: usar PTC con lotes         ║
║     de {N} → comando: /sdd.implementar ptc={N}                   ║
║                                                                  ║
║  3. Si el presupuesto es ajustado: comprimir memoria antes       ║
║     de lanzar la fase de implementación                          ║
╚══════════════════════════════════════════════════════════════════╝
```

---

## Notas

- Los pesos son relativos, no tokens reales. Claude Code no expone el conteo exacto de tokens al contexto.
- La calibración con el ledger mejora la precisión: si la sesión actual ya tiene datos, los pesos se ajustan a la velocidad real observada.
- Para proyectos con presupuesto de API estricto, usar junto con `effort-router` para maximizar el ahorro antes de lanzar fases costosas.
- Esta skill se invoca desde `/sdd.optimizar presupuesto` y como PASO 6 de `/sdd.optimizar`.
- Reutiliza los criterios de independencia de `orquestacion-ptc` — si esa skill tiene más detalle sobre cuándo paralelizar, referenciarlo directamente.
