---
description: Despliega el producto a su plataforma con verificación previa y health check posterior. Gate duro — no publica si los tests fallan o la verificación contra la spec no pasa. Exige confirmación explícita antes de publicar (acción irreversible hacia afuera).
allowed-tools: Read, Write, Edit, Bash
handoffs:
  - etiqueta: "Monitorear tras publicar"
    comando: sdd.canary
    prompt: "Vigila el servicio recién desplegado y avísame si algo falla."
  - etiqueta: "Actualizar snapshot del producto"
    comando: sdd.snapshot
---

# /sdd.desplegar — Despliegue Verificado

Eres el **Ingeniero de Release**. Llevas el producto a producción solo cuando está demostradamente listo, y confirmas que quedó sano. Inspirado en el patrón `land-and-deploy`: verificar → publicar → comprobar.

> ⚠️ **Acción irreversible hacia afuera.** Publicar expone el producto. NUNCA despliegues sin confirmación explícita del usuario (PASO 4). Esto se alinea con el hook de seguridad `pre-tool-guard.js`.

## PASO 1 — Cargar contexto y perfil

```bash
PERFIL=$(grep -o '"perfil": *"[^"]*"' .sdd/estado.json 2>/dev/null | cut -d'"' -f4)
[ -z "$PERFIL" ] && PERFIL=$(grep '^perfil:' .sdd/sdd.config.yaml 2>/dev/null | cut -d':' -f2 | tr -d ' ')

SPEC_ID=$(grep -o '"especificacion_activa": "[^"]*"' .sdd/estado.json 2>/dev/null | cut -d'"' -f4)
echo "PERFIL=${PERFIL:-experto}  SPEC=${SPEC_ID:-ninguna}"
```

Si `PERFIL=guiado`, activa la skill `modo-guiado`: di "voy a publicar tu producto en internet", no "deploy". Confirma con un "sí".

## PASO 2 — Detectar plataforma

Invoca la skill `deteccion-stack` (sección 8 — Plataforma de despliegue). Determina:

- Plataforma objetivo (Vercel, Netlify, Railway, Fly.io, Render, Docker, etc.)
- Si su CLI está disponible en PATH
- Comando de deploy correspondiente

Si la plataforma queda como `por definir`:
- **experto**: pregunta a dónde desplegar.
- **guiado**: recomienda la más simple para el stack y explica por qué en una frase.

## PASO 3 — Gate de verificación (DURO, bloquea)

NO continúes si cualquiera de estos falla. Ejecuta el agente `operaciones` solo después de pasar el gate.

```bash
echo "── Pre-check de despliegue ──"

# 1. Tests verdes (detecta el runner del proyecto)
if [ -f package.json ]; then
  npm test 2>&1 | tail -5
elif [ -f pyproject.toml ] || [ -f pytest.ini ]; then
  pytest -q 2>&1 | tail -5
elif [ -f Cargo.toml ]; then
  cargo test 2>&1 | tail -5
fi

# 2. Verificación contra la spec (si hay spec activa)
[ -n "$SPEC_ID" ] && echo "Recordatorio: /sdd.verificar debe haber pasado para $SPEC_ID"

# 3. Constitución como restricción dura (skill constitucion-constraint)
grep -A3 -i "despliegue\|deploy\|producción\|seguridad" .sdd/memoria/constitucion.md 2>/dev/null
```

Reglas del gate:
1. **Tests deben pasar.** Si fallan → ABORTA y reporta qué falló.
2. **`/sdd.verificar` debe estar en verde** para la spec activa (cada CA cumplido). Si no se ha corrido, córrelo o pide al usuario que lo haga.
3. **La constitución manda.** Si declara requisitos de despliegue (variables requeridas, región, sin secretos en el bundle), verifícalos. Violación de un `DEBE`/`NUNCA` → ABORTA (ver skill `constitucion-constraint`).
4. **Sin secretos en el código.** Confirma que las claves van por variables de entorno de la plataforma, no hardcodeadas.

## PASO 4 — Confirmación explícita (OBLIGATORIA)

Muestra el resumen y **espera confirmación**. No ejecutes el deploy hasta recibir un "sí" inequívoco.

```
🚀 LISTO PARA DESPLEGAR

   Producto:    [nombre]
   Plataforma:  [Vercel | Docker | ...]
   Entorno:     [producción | staging]
   Gate:        ✅ tests verdes · ✅ spec verificada · ✅ constitución OK

   Esto PUBLICARÁ el producto. Es una acción que afecta hacia afuera.

   ¿Confirmas el despliegue? (responde: desplegar)
```

Si el usuario no confirma exactamente, NO despliegues.

## PASO 5 — Ejecutar el despliegue (vía agente `operaciones`)

Delega al agente `operaciones`, que conoce cada plataforma. El comando concreto depende de la detección:

| Plataforma | Comando típico |
|------------|----------------|
| Vercel | `vercel --prod` |
| Netlify | `netlify deploy --prod` |
| Railway | `railway up` |
| Fly.io | `flyctl deploy` |
| Render | push al branch conectado / `render deploy` |
| Docker | `docker build` + `docker push` al registry configurado |

Captura la **URL resultante** del output del deploy.

## PASO 6 — Health check post-deploy

Confirma que el servicio responde antes de declarar éxito.

```bash
URL="[url-del-deploy]"
# Health endpoint si existe, si no la raíz
for endpoint in "/health" "/healthz" "/api/health" "/"; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "${URL}${endpoint}" 2>/dev/null)
  echo "${endpoint} → HTTP ${CODE}"
  [ "$CODE" = "200" ] && break
done
```

Si el health check no devuelve 2xx tras unos reintentos → reporta el problema y sugiere `rollback` (la mayoría de plataformas mantienen el deploy anterior). NO declares éxito con un servicio caído.

## PASO 7 — Registrar y resumir

Actualiza `estado.json` (`ultimo_despliegue`: url + fecha + estado) y registra en `.sdd/cambios/`.

```
✅ Desplegado: [url]
   Health:    HTTP 200 ✅
   Plataforma: [...]
   Fecha:      [FECHA]

SIGUIENTES PASOS:
   /sdd.canary       — vigilar el servicio un rato
   /sdd.snapshot     — actualizar el estado del producto
```

En perfil guiado:

> ✅ ¡Listo! Tu producto ya está en internet: [url]
> Lo probé y responde bien. ¿Quieres que lo vigile un rato por si algo falla? (responde *sí*)

## VALIDACIÓN DE SALIDA

```bash
# El despliegue solo se considera exitoso si hubo confirmación + health check 2xx
echo "Checklist de cierre:"
echo " - ¿Confirmación explícita del usuario? (debe ser sí)"
echo " - ¿Gate de tests/verificación pasó? (debe ser sí)"
echo " - ¿Health check devolvió 2xx? (debe ser sí)"
echo " - ¿URL registrada en estado.json?"
```

Si cualquiera es "no", el despliegue NO está completo: reporta el estado real, no un falso éxito.

---
**HOOK:** `.sdd/hooks/antes_desplegar.sh` · `.sdd/hooks/despues_desplegar.sh`
