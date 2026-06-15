---
description: Ciclo completo de optimización de tokens para la sesión actual — detecta fan-out, recomienda modelos por fase, comprime memoria si supera umbral, audita oportunidades de caché y proyecta presupuesto. Punto de entrada unificado para uso eficiente de tokens en FORGE.
allowed-tools: Read, Bash
---

# /sdd.optimizar — Optimización de Tokens

## Subcomandos disponibles

| Subcomando | Qué ejecuta |
|---|---|
| `/sdd.optimizar` | Ciclo completo (PASOes 1-6) |
| `/sdd.optimizar tokens` | Solo effort-router + cache-audit |
| `/sdd.optimizar memoria` | Solo memory-compactor |
| `/sdd.optimizar presupuesto` | Solo token-budget |

---

## PASO 1 — Verificar que el proyecto está inicializado

```bash
[ ! -d .sdd ] && echo "NO_INICIALIZADO" && exit 0
[ ! -f .sdd/estado.json ] && echo "SIN_ESTADO" && exit 0
cat .sdd/estado.json
```

Si no está inicializado: mostrar `🚫 SDD-ES no inicializado. Ejecuta: /sdd.constitucion` y terminar.

---

## PASO 2 — Leer ledger de consumo (observabilidad)

```bash
if [ -f .sdd/observabilidad/consumo.jsonl ]; then
  wc -l .sdd/observabilidad/consumo.jsonl
  cat .sdd/observabilidad/consumo.jsonl
else
  echo "SIN_LEDGER"
fi
```

Si `SIN_LEDGER`: marcar PASO 2 como "Sin datos de sesión — ledger vacío" y continuar.

Si hay datos: invocar la skill `observabilidad-consumo` para obtener:
- Tabla por agente (invocaciones, bytes, archivos únicos)
- Alertas de fan-out (>5 agentes distintos, >20 invocaciones de un agente, >500KB total)

---

## PASO 3 — Routing de effort (si hay fase activa o alertas de fan-out)

Invocar la skill `effort-router` con la fase del `estado.json`.

Si el subcomando es `/sdd.optimizar presupuesto` o `/sdd.optimizar memoria`, saltar este paso.

Mostrar la tabla de modelos recomendados y el ahorro estimado.

---

## PASO 4 — Comprimir memoria si supera umbral

```bash
# Verificar tamaño de archivos de memoria
for f in .sdd/memoria/agente-*.md; do
  [ -f "$f" ] || continue
  entradas=$(grep -c "^## " "$f" 2>/dev/null || echo 0)
  bytes=$(wc -c < "$f" 2>/dev/null || echo 0)
  echo "MEMORIA:$f:$entradas:$bytes"
done
```

Si algún archivo supera **80 entradas** o **50 000 bytes**: invocar la skill `memory-compactor`.

Si el subcomando es `/sdd.optimizar tokens` o `/sdd.optimizar presupuesto`, saltar este paso.

Si ningún archivo supera el umbral: marcar "✅ Memoria dentro del umbral".

---

## PASO 5 — Auditar oportunidades de caché

```bash
# Detectar agentes instalados en el proyecto
ls .claude/agents/ 2>/dev/null || echo "SIN_AGENTES_LOCALES"

# Detectar patterns que invalidan caché silenciosamente
grep -rn "$(date +%Y-%m-%d)\|[0-9a-f]\{8\}-[0-9a-f]\{4\}\|consumo\.jsonl" .claude/agents/ 2>/dev/null || echo "SIN_INVALIDADORES"
```

Invocar la skill `cache-audit` con los resultados.

Si el subcomando es `/sdd.optimizar memoria` o `/sdd.optimizar presupuesto`, saltar este paso.

---

## PASO 6 — Proyectar presupuesto de fases restantes

```bash
# Tareas pendientes de la spec activa
SPEC_ID=$(grep -o '"especificacion_activa": "[^"]*"' .sdd/estado.json 2>/dev/null | cut -d'"' -f4)
if [ -n "$SPEC_ID" ]; then
  cat ".sdd/especificaciones/${SPEC_ID}/.estado-tareas.json" 2>/dev/null || echo "SIN_TAREAS"
fi
```

Invocar la skill `token-budget` con el estado, tareas pendientes y datos del ledger.

Si el subcomando es `/sdd.optimizar tokens` o `/sdd.optimizar memoria`, saltar este paso.

---

## PASO 7 — Reporte unificado

Generar el reporte final ordenando las acciones por impacto decreciente:

```
╔══════════════════════════════════════════════════════════════════╗
║            ⚡ SDD.OPTIMIZAR — Reporte de Eficiencia             ║
╠══════════════════════════════════════════════════════════════════╣
║  Proyecto: {nombre}  |  Fase: {fase}  |  {fecha}                ║
╠══════════════════════════════════════════════════════════════════╣
║  📊 CONSUMO DE SESIÓN                                            ║
║                                                                  ║
║  {tabla por agente o "Sin datos de sesión"}                      ║
║  {alertas de fan-out o "✅ Sin alertas"}                         ║
╠══════════════════════════════════════════════════════════════════╣
║  🎯 ROUTING DE MODELOS (fase: {fase})                            ║
║                                                                  ║
║  {tabla effort-router}                                           ║
║  Ahorro estimado vs. Opus-en-todo: ~{%}%                         ║
╠══════════════════════════════════════════════════════════════════╣
║  🧠 MEMORIA DE AGENTES                                           ║
║                                                                  ║
║  {estado por agente: OK / comprimido / pendiente}                ║
╠══════════════════════════════════════════════════════════════════╣
║  🔄 CACHÉ                                                        ║
║                                                                  ║
║  {oportunidades detectadas o "✅ Sin invalidadores detectados"}  ║
╠══════════════════════════════════════════════════════════════════╣
║  💰 PRESUPUESTO DE FASES RESTANTES                               ║
║                                                                  ║
║  {tabla por fase: costo estimado y recomendación PTC}            ║
╠══════════════════════════════════════════════════════════════════╣
║  🚀 ACCIONES RECOMENDADAS (por impacto)                          ║
║                                                                  ║
║  1. {acción de mayor impacto con comando concreto}               ║
║  2. {segunda acción}                                             ║
║  3. {tercera acción}                                             ║
╚══════════════════════════════════════════════════════════════════╝
```

### Lógica de priorización de acciones

Ordenar las recomendaciones así:
1. **Fan-out activo** (>5 agentes o >20 invocaciones) → acción inmediata con `effort-router`
2. **Memoria sobre umbral** (>50KB) → `memory-compactor`
3. **Invalidadores de caché detectados** → `cache-audit` con fix sugerido
4. **Fases costosas por delante** → `token-budget` + sugerencia de PTC

Si no hay ninguna de estas condiciones:
```
✅ La sesión está optimizada. No se detectan acciones de alto impacto.
   Próximo paso sugerido según fase: {COMANDO_SDD}
```
