---
description: Lee .sdd/observabilidad/consumo.jsonl y genera un reporte de actividad de agentes — invocaciones por agente, archivos tocados, picos y señales de fan-out excesivo. Referencia cruzada con orquestacion-ptc y compresion-tokens.
model: haiku
allowed-tools: Read, Bash
---

# Skill: Observabilidad de Consumo

## Propósito

Convertir el ledger de consumo en información accionable: ver cuántos agentes se activaron, qué archivos tocaron, en qué momentos hubo picos de actividad y si hay señales de fan-out excesivo que conviene corregir.

El ledger es un proxy de magnitud (bytes escritos), no una facturación exacta de tokens — Claude Code no expone el conteo real de tokens al hook. Pero es suficiente para detectar patrones problemáticos.

---

## Lo que lees

```bash
# Ledger completo
cat .sdd/observabilidad/consumo.jsonl 2>/dev/null || echo "SIN_LEDGER"

# Conteo rápido de líneas
wc -l .sdd/observabilidad/consumo.jsonl 2>/dev/null || echo "0"
```

---

## Análisis que produces

### 1. Resumen por agente

```
node -e "
const fs = require('fs');
const path = '.sdd/observabilidad/consumo.jsonl';
if (!fs.existsSync(path)) { console.log('Sin datos aún.'); process.exit(0); }

const lineas = fs.readFileSync(path, 'utf8').trim().split('\n').filter(Boolean);
const porAgente = {};
for (const l of lineas) {
  try {
    const e = JSON.parse(l);
    const a = e.agente || 'main';
    if (!porAgente[a]) porAgente[a] = { invocaciones: 0, bytes: 0, archivos: new Set() };
    porAgente[a].invocaciones++;
    porAgente[a].bytes += e.bytes || 0;
    porAgente[a].archivos.add(e.archivo);
  } catch {}
}

console.log('AGENTE              | INVOC | BYTES  | ARCHIVOS ÚNICOS');
console.log('-'.repeat(60));
for (const [a, d] of Object.entries(porAgente).sort((x,y) => y[1].invocaciones - x[1].invocaciones)) {
  console.log(\`\${a.padEnd(19)} | \${String(d.invocaciones).padStart(5)} | \${String(d.bytes).padStart(6)} | \${d.archivos.size}\`);
}
console.log('');
console.log('Total eventos:', lineas.length);
"
```

### 2. Detección de fan-out excesivo

Umbrales por defecto (ajustables en `.sdd/sdd.config.yaml`):

| Señal | Umbral | Acción sugerida |
|-------|--------|-----------------|
| >5 agentes distintos en una fase | Alto | Revisar si la orquestación PTC puede colapsar en menos agentes |
| >20 invocaciones de un mismo agente | Medio | Revisar si el agente entra en loop o hace trabajo redundante |
| >500 KB de bytes escritos totales | Informativo | Considerar comprimir memoria con `compresion-tokens` |

```
node -e "
const fs = require('fs');
const path = '.sdd/observabilidad/consumo.jsonl';
if (!fs.existsSync(path)) process.exit(0);

const lineas = fs.readFileSync(path, 'utf8').trim().split('\n').filter(Boolean);
const agentes = new Set();
const invocPorAgente = {};
let bytesTotal = 0;

for (const l of lineas) {
  try {
    const e = JSON.parse(l);
    const a = e.agente || 'main';
    agentes.add(a);
    invocPorAgente[a] = (invocPorAgente[a] || 0) + 1;
    bytesTotal += e.bytes || 0;
  } catch {}
}

const alertas = [];
if (agentes.size > 5) alertas.push('⚠️  Fan-out alto: ' + agentes.size + ' agentes distintos activos');
for (const [a, n] of Object.entries(invocPorAgente)) {
  if (n > 20) alertas.push('⚠️  Agente en loop posible: ' + a + ' (' + n + ' invocaciones)');
}
if (bytesTotal > 500_000) alertas.push('ℹ️  Escritura alta: ' + Math.round(bytesTotal/1024) + ' KB — considera compresion-tokens');

if (alertas.length === 0) {
  console.log('✅ Sin alertas de fan-out');
} else {
  for (const a of alertas) console.log(a);
}
"
```

### 3. Picos de actividad (top 5 momentos)

```
node -e "
const fs = require('fs');
const path = '.sdd/observabilidad/consumo.jsonl';
if (!fs.existsSync(path)) process.exit(0);

const lineas = fs.readFileSync(path, 'utf8').trim().split('\n').filter(Boolean);
const parsed = lineas.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

// Agrupar por minuto
const porMinuto = {};
for (const e of parsed) {
  const minuto = e.ts?.slice(0,16) || 'desconocido';
  porMinuto[minuto] = (porMinuto[minuto] || 0) + 1;
}

const top = Object.entries(porMinuto).sort((a,b) => b[1] - a[1]).slice(0, 5);
console.log('TOP 5 MINUTOS DE MAYOR ACTIVIDAD:');
for (const [m, n] of top) console.log('  ' + m + '  →  ' + n + ' eventos');
"
```

---

## Formato del reporte completo

```
╔══════════════════════════════════════════════════════╗
║         📊 CONSUMO DE AGENTES — SDD-ES               ║
╠══════════════════════════════════════════════════════╣
║  AGENTE              | INVOC | BYTES  | ARCHIVOS     ║
║  [tabla generada]                                    ║
╠══════════════════════════════════════════════════════╣
║  ALERTAS DE FAN-OUT                                  ║
║  [alertas o "✅ Sin alertas"]                        ║
╠══════════════════════════════════════════════════════╣
║  TOP MOMENTOS DE ACTIVIDAD                           ║
║  [top 5 minutos]                                     ║
╠══════════════════════════════════════════════════════╣
║  RECOMENDACIONES                                     ║
║  → Si fan-out alto: revisar skill orquestacion-ptc   ║
║  → Si bytes altos:  ejecutar /sdd.comprimir          ║
║  → Si loop agente:  revisar el agente con /sdd.estado║
╚══════════════════════════════════════════════════════╝
```

---

## Notas

- El ledger se escribe en tiempo real por el hook `agent-memory.js` (PostToolUse)
- Los `bytes` miden el contenido de cada escritura — son un **proxy de magnitud**, no el consumo real de tokens del modelo
- Para vaciar el ledger al inicio de una sesión nueva: `echo "" > .sdd/observabilidad/consumo.jsonl`
- Cruzar con `orquestacion-ptc` para decidir cuándo paralelizar vs. serializar agentes
- Cruzar con `compresion-tokens` para decidir cuándo comprimir los archivos `.sdd/memoria/`
