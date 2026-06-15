---
description: Audita los archivos de agentes (.claude/agents/*.md) para detectar bloques estables susceptibles de cache_control y los 3 patrones que invalidan caché silenciosamente (timestamps dinámicos, UUIDs, contenido JSONL embebido). Produce una lista de oportunidades de caché ordenadas por impacto.
model: haiku
allowed-tools: Read, Bash
---

# Skill: Cache Audit

## Propósito

El prompt caching de Claude reduce el costo de tokens de entrada hasta un 90% para bloques de contexto que no cambian entre invocaciones. Sin embargo, tres patrones comunes invalidan el caché silenciosamente — el modelo re-paga el precio completo sin que nadie se dé cuenta.

Esta skill detecta esos patrones en los archivos de agentes del proyecto activo y produce recomendaciones concretas.

---

## Lo que lees

```bash
# Agentes instalados en el proyecto (instalados localmente, no en el plugin)
ls .claude/agents/ 2>/dev/null || echo "SIN_AGENTES_LOCALES"

# Agentes del plugin (si existe {PLUGIN_DIR})
ls {PLUGIN_DIR}/agents/ 2>/dev/null | head -20

# Contenido de cada archivo de agente
for f in .claude/agents/*.md {PLUGIN_DIR}/agents/*.md; do
  [ -f "$f" ] || continue
  echo "=== AGENTE: $f ==="
  cat "$f"
  echo "---"
done
```

---

## Los 3 invalidadores de caché

### Invalidador 1 — Timestamps dinámicos en el system prompt

Un timestamp que cambia en cada sesión rompe el caché de todo el bloque que lo contiene y todos los bloques siguientes.

**Patrones a detectar:**
```bash
grep -n "\b[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}\b" .claude/agents/*.md {PLUGIN_DIR}/agents/*.md 2>/dev/null
```

**Severidad:** ALTA — invalida el caché en cada nueva sesión (cada día).

**Fix:** Mover el timestamp al final del prompt, en un bloque marcado como dinámico separado del bloque estable. O eliminarlo si no es necesario.

---

### Invalidador 2 — UUIDs / IDs únicos por sesión

Hashes o IDs generados en cada invocación invalidan todo el bloque donde aparecen.

**Patrones a detectar:**
```bash
grep -nE "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}" \
  .claude/agents/*.md {PLUGIN_DIR}/agents/*.md 2>/dev/null
```

**Severidad:** ALTA — invalida en cada invocación.

**Fix:** Sacar el ID del bloque estable. Si el agente necesita el ID, inyectarlo como variable de entorno o como argumento de la invocación, no como parte del system prompt fijo.

---

### Invalidador 3 — Contenido JSONL o ledger embebido directamente

Si el system prompt incluye el contenido del `consumo.jsonl` u otro archivo que cambia frecuentemente, el bloque se invalida en cada escritura del hook.

**Patrones a detectar:**
```bash
grep -n "consumo\.jsonl\|\.jsonl\|\"ts\":\|\"agente\":\|\"bytes\":" \
  .claude/agents/*.md {PLUGIN_DIR}/agents/*.md 2>/dev/null
```

**Severidad:** MEDIA — invalida con cada invocación de agente.

**Fix:** En lugar de embeber el JSONL en el prompt, hacer que el agente lo lea con la tool `Read` cuando necesite esa información.

---

## Análisis de ratio estable/dinámico

Para cada archivo de agente, calcular:

```bash
node -e "
const fs = require('fs');
const archivos = process.argv.slice(1);

for (const f of archivos) {
  if (!fs.existsSync(f)) continue;
  const contenido = fs.readFileSync(f, 'utf8');
  const lineas = contenido.split('\n');
  const total = lineas.length;
  
  // Líneas sospechosas de ser dinámicas
  const dinamicas = lineas.filter(l =>
    /\d{4}-\d{2}-\d{2}/.test(l) ||           // fechas
    /[0-9a-f]{8}-[0-9a-f]{4}/.test(l) ||     // UUIDs
    /\"ts\":/.test(l) ||                       // JSONL
    /consumo\.jsonl/.test(l)
  ).length;
  
  const pct_estatico = Math.round((1 - dinamicas/total) * 100);
  console.log(f + ': ' + pct_estatico + '% estático (' + dinamicas + '/' + total + ' líneas dinámicas)');
}
" .claude/agents/*.md {PLUGIN_DIR}/agents/*.md 2>/dev/null || echo "node no disponible"
```

---

## Output que produces

```
╔══════════════════════════════════════════════════════════════════╗
║           🔄 CACHE AUDIT — Oportunidades de Caché               ║
╠══════════════════════════════════════════════════════════════════╣
║  AGENTE              | % ESTÁTICO | INVALIDADORES | SEVERIDAD   ║
║  ────────────────────┼────────────┼───────────────┼──────────── ║
║  arquitecto          | 98%        | Ninguno       | ✅ OK       ║
║  desarrollador-back  | 95%        | Ninguno       | ✅ OK       ║
║  {agente con prob}   | 72%        | Timestamp L34 | ⚠️  MEDIO  ║
║  {agente con prob}   | 45%        | UUID L12, L67 | 🔴 ALTO    ║
╠══════════════════════════════════════════════════════════════════╣
║  HALLAZGOS CONCRETOS                                             ║
║                                                                  ║
║  🔴 {agente}.md:12 — UUID detectado en bloque estable           ║
║     Fix: mover a argumento de invocación o variable de entorno   ║
║                                                                  ║
║  ⚠️  {agente}.md:34 — Timestamp 2026-06-14 en system prompt     ║
║     Fix: mover al final del prompt, separar en bloque dinámico   ║
╠══════════════════════════════════════════════════════════════════╣
║  💰 AHORRO POTENCIAL                                             ║
║                                                                  ║
║  Los agentes con >90% contenido estático son candidatos          ║
║  para cache_control: la primera invocación escribe el caché      ║
║  y las siguientes pagan ~10% del costo original de input.        ║
║                                                                  ║
║  Para activar: separar el system prompt en bloque estable        ║
║  (primero) + bloque dinámico (al final). El modelo detecta       ║
║  automáticamente el prefijo estable y lo cachea.                 ║
╚══════════════════════════════════════════════════════════════════╝
```

---

## Cuándo usar esta skill

- Antes de `/sdd.implementar` en proyectos con >5 tareas (sesiones largas = más valor del caché)
- Cuando `/sdd.estado consumo` reporta >1MB de bytes escritos (la sesión es larga)
- Cuando un agente tarda más de lo esperado en responder (el caché podría no estar activo)
- Desde `/sdd.optimizar tokens` (se ejecuta automáticamente como parte del ciclo)

## Notas

- El prompt caching es automático en Claude Code — no requiere cambios en el código del hook.
- Lo que sí requiere intervención manual son los invalidadores: un UUID en línea 1 del prompt hace que el modelo no pueda cachear nada de lo que sigue.
- Esta skill audita; no modifica archivos. Los fixes los aplica el usuario (o un agente dedicado con permiso de Edit).
