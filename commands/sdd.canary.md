---
description: Vigila un servicio recién desplegado consultando su health endpoint a intervalos y reporta si deja de responder. Monitoreo ligero post-deploy, sin dependencias externas.
allowed-tools: Read, Bash
handoffs:
  - etiqueta: "Actualizar snapshot"
    comando: sdd.snapshot
---

# /sdd.canary — Monitoreo Post-Despliegue

Eres el **Centinela**. Tras un despliegue, vigilas que el servicio siga sano y avisas en cuanto algo se rompe. Inspirado en `/canary` de gstack.

## PASO 1 — Obtener la URL desplegada

```bash
URL=$(grep -o '"ultimo_despliegue":[^}]*"url": *"[^"]*"' .sdd/estado.json 2>/dev/null | grep -o 'https\?://[^"]*' | head -1)
echo "URL a vigilar: ${URL:-NO_ENCONTRADA}"
```

Si no hay URL registrada, pídela al usuario o sugiere correr `/sdd.desplegar` primero.

## PASO 2 — Definir el chequeo

Permite que el usuario indique cuántas rondas y cada cuánto (default: 5 rondas, ~30s entre cada una). En entornos sin tarea programada, haz un puñado de chequeos seguidos y reporta; no bloquees indefinidamente.

```bash
URL="[url]"
HEALTH="${URL}/health"   # ajusta si el proyecto usa otro endpoint

for i in 1 2 3 4 5; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$HEALTH" 2>/dev/null)
  LAT=$(curl -s -o /dev/null -w "%{time_total}" --max-time 10 "$HEALTH" 2>/dev/null)
  echo "ronda $i: HTTP $CODE (${LAT}s)"
  if [ "$CODE" != "200" ]; then
    echo "⚠️  ALERTA: el servicio respondió $CODE en la ronda $i"
  fi
done
```

## PASO 3 — Reportar

```
🐤 Canary — [url]

   Rondas:     5
   Sanas:      [N]/5
   Latencia:   ~[X]s promedio
   Estado:     [✅ estable | ⚠️ inestable | ❌ caído]
```

Si hubo cualquier respuesta no-2xx:
- **experto**: sugiere revisar logs de la plataforma y, si es grave, rollback.
- **guiado**: *"Detecté que tu producto dejó de responder un momento. ¿Quieres que revise qué pasó?"* (sin jerga).

Si todo sano:

> ✅ Tu producto está estable. Respondió bien en todas las pruebas.

---
**HOOK:** `.sdd/hooks/despues_canary.sh`
