# Memoria, Observabilidad y Optimización de Tokens en SDD-ES

Este documento explica cómo SDD-ES mantiene continuidad entre sesiones (memoria por agente), cómo monitorizar el consumo de agentes sin depender del conteo de tokens del modelo, y cómo usar las nuevas técnicas de optimización de tokens (v2.6.0).

---

## 1. Memoria por agente

### Qué es

> **Desde v2.6.0, todos los agentes activos tienen memoria persistente.** Además del Grupo OPUS, los agentes `desarrollador-backend`, `desarrollador-frontend`, `tester`, `documentador` y `operaciones` registran sus cambios en su propio archivo de memoria, lo que garantiza continuidad entre sesiones para todo el pipeline SDD.

Cada agente activo (Grupo OPUS — arquitecto, asesor-datos, disenador-api, critico — más desarrollador-backend, desarrollador-frontend, tester, documentador y operaciones) tiene un archivo de memoria persistente en:

```
.sdd/memoria/agente-{nombre}.md
```

Este archivo crece automáticamente durante la sesión: cada vez que el agente escribe un archivo, el hook `PostToolUse` registra la fecha, el archivo modificado y un resumen del contenido.

### Para qué sirve

Claude Code no mantiene contexto entre sesiones. El archivo de memoria resuelve este problema: al inicio de una nueva sesión, el agente lee su archivo de memoria y recupera las decisiones tomadas en sesiones anteriores — qué arquitectura se eligió, qué restricciones aplican, qué se acordó con el usuario.

### Cómo funciona el hook

El hook `claude-hooks/agent-memory.js` se ejecuta como `PostToolUse` tras cada `Write` o `Edit`. Lee la variable de entorno `CLAUDE_AGENT_NAME` que Claude Code inyecta cuando hay un subagente activo, y si el agente es uno de los cuatro del Grupo OPUS, añade una entrada al archivo de memoria correspondiente.

Desde v2.6.0, el hook también emite una alerta por stderr cuando la memoria de un agente supera 50KB:

```
⚠️  [agent-memory] Memoria de arquitecto supera 52KB — considera ejecutar /sdd.optimizar memoria
```

### Formato de una entrada de memoria

```markdown
## 2026-06-13 — .sdd/especificaciones/2026-06-13-auth/spec.md
> # Especificación: Autenticación con magic link — Decisión: usar Resend para emails
```

### Cuándo leer la memoria

Los agentes leen su archivo de memoria al inicio de cada invocación. No necesitas hacer nada manualmente: si el archivo existe, el agente lo lee.

### Cuándo comprimir la memoria

Cuando la memoria supera 80 entradas o 50KB, empieza a consumir ventana de contexto sin aportar valor (entradas antiguas del mismo archivo son redundantes). Usa:

```
/sdd.optimizar memoria
```

Esto invoca `memory-compactor`, que deduplica entradas del mismo archivo (conserva solo la más reciente) y aplica compresión caveman (Nivel Full de `compresion-tokens`). Siempre guarda un backup `.original`.

---

## 2. Ledger de consumo (observabilidad)

### Qué es

`.sdd/observabilidad/consumo.jsonl` es un archivo de líneas JSON (una por evento) que registra cada escritura de archivo por cualquier agente, incluyendo el agente principal. Se escribe en tiempo real por el mismo hook `agent-memory.js`.

Ejemplo de una línea del ledger:

```json
{"ts":"2026-06-13T14:32:07.123Z","agente":"arquitecto","tool":"Write","archivo":".sdd/especificaciones/2026-06-13-auth/spec.md","bytes":4821}
```

### Campos

| Campo | Descripción |
|-------|-------------|
| `ts` | Timestamp ISO 8601 del momento de escritura |
| `agente` | Nombre del agente (`CLAUDE_AGENT_NAME`) o `"main"` si es la sesión principal |
| `tool` | Herramienta usada: `Write`, `Edit`, `MultiEdit` |
| `archivo` | Ruta del archivo modificado |
| `bytes` | Tamaño en bytes del contenido escrito |

### Limitación importante

Los `bytes` miden el tamaño del contenido escrito en cada invocación — **no el consumo real de tokens del modelo**. Claude Code no expone el conteo de tokens al hook. Los bytes son un **proxy de magnitud**: escrituras grandes correlacionan con más trabajo, pero no son equivalentes a la facturación de la API.

Para costos exactos, usa el dashboard de Anthropic Console o la API de usage.

### Cómo usar el ledger

```
/sdd.estado consumo
```

Esto invoca `observabilidad-consumo` y produce:
- Tabla de invocaciones y bytes por agente
- Alertas de fan-out (>5 agentes distintos, >20 invocaciones de un mismo agente)
- Top momentos de actividad por minuto

### Vaciar el ledger entre sesiones

```bash
echo "" > .sdd/observabilidad/consumo.jsonl
```

---

## 3. Técnicas de optimización de tokens (v2.6.0)

### El comando unificado

```
/sdd.optimizar
```

Ejecuta el ciclo completo de 6 pasos: consumo → routing → compresión de memoria → auditoría de caché → presupuesto → reporte con acciones ordenadas por impacto.

Subcomandos disponibles:

| Subcomando | Qué hace |
|---|---|
| `/sdd.optimizar` | Ciclo completo |
| `/sdd.optimizar tokens` | Solo effort-router + cache-audit |
| `/sdd.optimizar memoria` | Solo memory-compactor |
| `/sdd.optimizar presupuesto` | Solo token-budget |

---

### Técnica 1 — Effort routing (mayor impacto)

La skill `effort-router` recomienda el modelo y nivel de esfuerzo correcto para cada agente según la fase actual. Evita pagar Opus cuando la tarea es mecánica.

**Regla de oro:** si el agente toma una decisión que no se puede deshacer → Opus. Si ejecuta una decisión ya tomada → Sonnet o Haiku.

| Grupo | Fases | Ahorro vs. Opus-en-todo |
|---|---|---|
| A — Opus siempre | especificacion, planificacion, analisis | 0% |
| B — Sonnet suficiente | implementacion (backend/frontend), verificacion, qa | ~40% |
| C — Haiku suficiente | tests, docs, deploy, retro | ~80% |

Ahorro típico en una fase de `implementacion` completa: **~56%**.

---

### Técnica 2 — Compresión de memoria (previene degradación de contexto)

La skill `memory-compactor` actúa sobre `.sdd/memoria/agente-*.md`:

1. **Deduplica**: misma ruta modificada en fechas distintas → conserva solo la más reciente (reduce 40-60% en proyectos largos)
2. **Comprime**: aplica el diccionario caveman de `compresion-tokens` (Nivel Full, 80+ pares de reemplazos) sobre el texto de cada entrada
3. **Backup**: guarda `.original` antes de tocar nada

Cuándo actúa: cuando hay >80 entradas O >50KB en algún archivo de memoria.

---

### Técnica 3 — Auditoría de caché

La skill `cache-audit` detecta los 3 patrones que invalidan el prompt caching silenciosamente:

| Invalidador | Severidad | Fix |
|---|---|---|
| Timestamps dinámicos en el system prompt (`2026-06-13`) | Alta | Mover al final del prompt, en bloque separado |
| UUIDs / IDs de sesión embebidos en el prompt | Alta | Pasar como argumento, no como parte del system prompt |
| Contenido JSONL (`consumo.jsonl`) embebido en el prompt | Media | Leer con tool `Read` cuando se necesite |

El prompt caching reduce hasta un 90% el costo de tokens de entrada para bloques estables. Un solo invalidador en el sistema prompt anula el beneficio completo.

---

### Técnica 4 — Presupuesto por fase

La skill `token-budget` proyecta el costo relativo de las fases restantes y recomienda cuándo usar PTC paralelo vs. serial. Si hay historial en `consumo.jsonl`, calibra los pesos con la velocidad real de la sesión.

Regla de paralelización (de `orquestacion-ptc`):

| Tareas pendientes | Estrategia | Ahorro estimado |
|---|---|---|
| 1-2 | Serial directo | — |
| 3-5 independientes | PTC paralelo | ~70% |
| 6-10 independientes | PTC en 2 lotes | ~65% |
| Con dependencias | Serial (respetar grafo) | — |

---

## 4. Cómo controlar los agentes con estos datos

### Detectar paralelización innecesaria

Si el ledger muestra >5 agentes activos en una sola fase, revisar `orquestacion-ptc`. Si los agentes se bloquean entre sí (uno necesita el output del otro), paralelizarlos desperdicia tokens.

Señal del ledger: muchos agentes distintos con pocas invocaciones cada uno → fan-out excesivo.

### Detectar agentes en loop

Si un agente tiene >20 invocaciones en el ledger de una sesión, está probablemente en un ciclo de auto-corrección.

Solución: `/sdd.estado agentes` y verificar condiciones de salida claras.

### Detectar memoria que conviene comprimir

La alerta del hook (`⚠️ Memoria supera 50KB`) es la señal principal. También visible desde `/sdd.optimizar`.

---

## 5. Arquitectura del sistema (v2.6.0)

```
claude-hooks/
  agent-memory.js          ← Hook PostToolUse (Write/Edit/MultiEdit)
                             → .sdd/memoria/agente-{nombre}.md  (4 agentes OPUS)
                             → .sdd/observabilidad/consumo.jsonl (todos los agentes)
                             → stderr: alerta si memoria supera 50KB

skills/
  observabilidad-consumo/  ← Lee consumo.jsonl, produce reporte, detecta fan-out
  effort-router/           ← Routing Haiku/Sonnet/Opus por fase (v2.6.0)
  memory-compactor/        ← Deduplicación + compresión de .sdd/memoria/ (v2.6.0)
  cache-audit/             ← Detecta invalidadores silenciosos de caché (v2.6.0)
  token-budget/            ← Proyecta costo por fase + recomendación PTC (v2.6.0)
  compresion-tokens/       ← Diccionario caveman — reutilizado por memory-compactor
  orquestacion-ptc/        ← Criterios PTC — reutilizados por token-budget

commands/
  sdd.estado.md            ← /sdd.estado consumo
  sdd.optimizar.md         ← Ciclo completo de optimización (v2.6.0)
  sdd.comprimir.md         ← /sdd.comprimir memoria → memory-compactor
```

---

## 6. Tabla completa de skills de eficiencia

| Skill | Qué hace | Cuándo usarla |
|-------|----------|---------------|
| `observabilidad-consumo` | Reporte del ledger JSONL | Siempre, o desde `/sdd.estado consumo` |
| `effort-router` | Recomienda Haiku/Sonnet/Opus por fase | Al inicio de cada fase o desde `/sdd.optimizar` |
| `memory-compactor` | Deduplica y comprime `.sdd/memoria/` | Cuando hay alerta de 50KB o desde `/sdd.optimizar memoria` |
| `cache-audit` | Detecta invalidadores de caché | Antes de `/sdd.implementar` en proyectos grandes |
| `token-budget` | Proyecta costo de fases restantes | Antes de fases costosas (analisis, implementacion larga) |
| `orquestacion-ptc` | Explica cuándo paralelizar agentes | Fan-out alto en el ledger |
| `compresion-tokens` | Comprime cualquier archivo `.sdd/` | Memoria muy larga, specs verbosas |
