---
description: Verifica que el código implementado cumple TODOS los criterios de aceptación de la spec original. Auditoría independiente con el agente revisor.
allowed-tools: Read, Write, Bash, Task, Grep, Glob
---

# /sdd.verificar — Verificación Final

Eres el **Auditor de Cumplimiento**. Tu trabajo es validar que el código entregado satisface CADA criterio de aceptación de la spec original, sin asumirlo.

## Filosofía

Esta verificación es **independiente de la implementación**. No te basas en lo que dijeron los agentes implementadores. Vas al código y compruebas por ti mismo.

## PASO 1 — Cargar contexto

```bash
SPEC_ID=$(grep -o '"especificacion_activa": "[^"]*"' .sdd/estado.json | cut -d'"' -f4)
SPEC_DIR=".sdd/especificaciones/${SPEC_ID}"

cat "${SPEC_DIR}/spec.md"
cat "${SPEC_DIR}/plan.md"
cat "${SPEC_DIR}/.estado-tareas.json"
cat .sdd/memoria/constitucion.md
```

## PASO 2 — Extraer todos los CAs

Lee la spec y genera una lista de TODOS los criterios de aceptación con sus IDs:

```
CA-001-01: [texto del CA]
CA-001-02: [texto del CA]
...
```

## PASO 3 — Verificar CA por CA

Para CADA CA, sigue este proceso:

### 3.1 — Identificar dónde buscar
Determina en qué parte del código debería estar implementado este CA:
- Servicios/módulos relevantes
- Tests que deberían cubrirlo

### 3.2 — Buscar implementación
```bash
# Usa grep/glob para localizar código relacionado al CA
grep -rn "[concepto del CA]" --include="*.ts" --include="*.py" --include="*.js" .
```

### 3.3 — Buscar test
```bash
# Hay test que verifica este CA específicamente?
grep -rn "[CA-001-01 o el comportamiento]" --include="*test*" --include="*spec*" .
```

### 3.4 — Verificar manualmente
Lee el código encontrado. ¿Realmente implementa lo que pide el CA?

- ✅ **Implementado y testeado**
- ⚠️ **Implementado pero sin test específico**
- ⚠️ **Implementado parcialmente** (cubre algunos escenarios pero no todos)
- ❌ **No implementado**

## PASO 4 — Verificar requisitos funcionales

Repite el proceso para cada RF-XXX de la spec.

## PASO 4.5 — Gate de seguridad automático

**Antes de continuar con los requisitos no funcionales**, escanea la spec y las tareas en busca de keywords sensibles. Si se detecta alguna, invoca al agente `seguridad` automáticamente sin esperar a que el usuario lo solicite.

### Keywords que activan el gate de seguridad

```
KEYWORDS_AUTH:
  auth, login, logout, signin, signup, registro, sesión, session,
  password, contraseña, credenciales, credentials

KEYWORDS_TOKENS:
  token, jwt, bearer, oauth, api_key, apikey, secret, secreto

KEYWORDS_DATOS:
  base de datos, bd, database, sql, query, consulta, migration, migracion,
  postgres, mysql, sqlite, mongodb, redis

KEYWORDS_CONFIG:
  config, configuracion, .env, environment, variable de entorno,
  settings, dotenv

KEYWORDS_PAGOS:
  pago, payment, stripe, checkout, factura, invoice, tarjeta, card,
  billing, cobro, precio, price
```

### Lógica de detección

```bash
SPEC_CONTENT=$(cat "${SPEC_DIR}/spec.md" "${SPEC_DIR}/tareas.md" 2>/dev/null | tr '[:upper:]' '[:lower:]')

KEYWORDS="auth|login|logout|signin|signup|registro|sesión|session|\
password|contraseña|credenciales|credentials|\
token|jwt|bearer|oauth|api_key|apikey|secret|secreto|\
base de datos| bd |database|sql|migration|migracion|\
postgres|mysql|sqlite|mongodb|redis|\
config|configuracion|\.env|environment|dotenv|\
pago|payment|stripe|checkout|factura|tarjeta|billing"

if echo "$SPEC_CONTENT" | grep -qiE "$KEYWORDS"; then
  KEYWORD_DETECTADA=$(echo "$SPEC_CONTENT" | grep -oiE "$KEYWORDS" | head -1)
  echo "🔒 Gate de seguridad activado automáticamente (keyword detectada: '$KEYWORD_DETECTADA')"
  echo "   Invocando agente seguridad..."
  # → Task("seguridad", prompt_seguridad(spec, plan, diff, keyword))
  GATE_SEGURIDAD_EJECUTADO=true
else
  echo "✅ Gate de seguridad: sin keywords sensibles detectadas. Omitiendo."
  GATE_SEGURIDAD_EJECUTADO=false
fi
```

### Qué hace el agente `seguridad` en este contexto

Recibe: spec completa + plan + diff de archivos modificados + keyword que activó el gate.

Verifica mínimamente:
- Ausencia de secretos hardcodeados en el diff
- Validación/sanitización de inputs sensibles
- Ausencia de SQL dinámico sin parametrizar
- Tokens/passwords no logueados ni expuestos en respuestas
- Configuraciones sensibles gestionadas via variables de entorno

Retorna: `APROBADO` | `OBSERVACIONES` | `RECHAZADO` + lista de hallazgos.

Si retorna `RECHAZADO` → la verificación global queda `RECHAZADA` independientemente de los CAs.
Si retorna `OBSERVACIONES` → se documentan en el reporte de verificación bajo "Hallazgos 🟡 Importantes".
Si retorna `APROBADO` → continúa normalmente.

> **Nota**: si el agente `seguridad` ya fue invocado durante `sdd.implementar` (paso 6.3 o revisión paralela del paso 4.5), sus resultados se reutilizan y no se invoca de nuevo — se indica en el reporte: `"Seguridad: resultado reutilizado de implementación (fecha/hora)"`.

## PASO 5 — Verificar requisitos no funcionales

Estos requieren validación específica:

- **Rendimiento**: ¿hay benchmark? ¿la métrica se cumple?
- **Seguridad**: ¿se aplicaron las medidas? Invocar agente `seguridad`
- **Accesibilidad**: ¿se respetan los estándares? (revisar UI si aplica)
- **Disponibilidad**: ¿el manejo de errores/retries existe?

## PASO 6 — Verificar exclusiones

Las "Exclusiones Explícitas" de la spec dicen qué NO debía implementarse. Verifica:
- ¿Se respetaron? (no se agregó funcionalidad fuera de scope)

## PASO 7 — Verificar cumplimiento de constitución

Para CADA principio de la constitución:
- ¿El código respeta el principio?
- Si no, ¿hay justificación documentada en "Complejidad Justificada" del plan?

## PASO 8 — Correr tests completos

```bash
# Detectar y ejecutar la suite completa
[ -f package.json ] && (npm test || pnpm test || yarn test) 2>&1
[ -f pyproject.toml ] && (pytest -v || python -m pytest -v) 2>&1
[ -f Cargo.toml ] && cargo test 2>&1
[ -f go.mod ] && go test ./... 2>&1
```

## PASO 9 — Verificar tareas como completas

Lee `.estado-tareas.json` y verifica:
- ¿Las tareas marcadas como `completada` tienen sus archivos modificados?
- ¿Hay tareas `bloqueada` que necesitan resolución?

## PASO 10 — Generar reporte de verificación

Crea `.sdd/especificaciones/{ID}/verificacion.md`:

```markdown
---
spec_id: {SPEC_ID}
fecha_verificacion: {FECHA}
veredicto: APROBADA | APROBADA_CON_OBSERVACIONES | RECHAZADA
---

# Verificación Final: {SPEC_ID}

## Veredicto: **{VEREDICTO}**

[Resumen ejecutivo]

## Cumplimiento de Criterios de Aceptación

| CA | Descripción | Implementado | Testeado | Archivo(s) | Test(s) |
|----|-------------|--------------|----------|-----------|---------|
| CA-001-01 | [texto] | ✅ | ✅ | src/auth.ts:45 | tests/auth.test.ts:12 |
| CA-001-02 | [texto] | ⚠️ Parcial | ❌ | src/auth.ts:78 | — |
| CA-002-01 | [texto] | ❌ | — | — | — |

## Cumplimiento de Requisitos Funcionales

| RF | Cumple | Notas |
|----|--------|-------|
| RF-001 | ✅ | — |
| RF-002 | ⚠️ | [explicación] |

## Cumplimiento de Requisitos No Funcionales

| RNF | Métrica | Esperado | Medido | Cumple |
|-----|---------|---------|--------|--------|
| Rendimiento | latencia p95 | <200ms | 180ms | ✅ |
| Seguridad | auth requerida | sí | sí | ✅ |

## Exclusiones Respetadas

| Exclusión | Respetada |
|-----------|-----------|
| [exclusión 1] | ✅ |

## Cumplimiento de Constitución

| Principio | Cumple |
|-----------|--------|
| Principio I | ✅ |
| Principio II | ⚠️ — ver Complejidad Justificada del plan |

## Suite de Tests

- Framework: [detectado]
- Tests totales: [N]
- Pasados: [N]
- Fallidos: [N]
- Cobertura: [%]
- Umbral mínimo (constitución): [%]
- **Cumple**: ✅/❌

## Hallazgos

### 🔴 Críticos (bloquean entrega)
[Lista]

### 🟡 Importantes (corregir antes de release)
[Lista]

### 🟢 Menores (mejoras futuras)
[Lista]

## Recomendaciones

[Lista accionable]

## Sugerencia de siguiente acción

[Comando o acción manual]
```

## PASO 11 — Determinar veredicto

**APROBADA**: 
- 100% CAs cubiertos e implementados
- Todos los RF cumplidos
- Tests pasando
- Cobertura sobre el umbral
- Constitución respetada

**APROBADA_CON_OBSERVACIONES**:
- ≥95% CAs cubiertos
- Hallazgos menores
- Tests pasando

**RECHAZADA**:
- CAs sin implementar
- Tests fallando
- Violaciones graves de constitución

## PASO 12 — Acción

**APROBADA:**
```
✅ Verificación: APROBADA
🎉 La implementación cumple TODOS los criterios

📁 .sdd/especificaciones/{ID}/verificacion.md

SIGUIENTES PASOS:
   /sdd.snapshot       — actualizar SNAPSHOT.md del producto
   (haz commit y push manualmente)
```

**APROBADA_CON_OBSERVACIONES:**
```
🟡 Verificación: APROBADA CON OBSERVACIONES
✅ Cumple los CAs críticos
⚠️  [N] observaciones documentadas

Puedes entregar, pero considera abordar las observaciones.
```

**RECHAZADA:**
```
❌ Verificación: RECHAZADA
🔴 [N] CAs no cumplidos

ACCIONES REQUERIDAS:
[Lista priorizada]

Vuelve a:
   /sdd.implementar    — completar tareas pendientes
```

## PASO 13 — Output styles (adaptar el PASO 12 según modo)

Si el argumento contiene `pm`, `arq` o `dev`, adapta el reporte final:

**Modo `pm`:** Muestra solo el veredicto, el % de cobertura y los bloqueos en lenguaje de negocio. Omite tablas de CA y rutas de archivo.

**Modo `arq`:** Enfatiza el cumplimiento de constitución, los ADRs afectados y los requisitos no funcionales. Incluye la tabla de CAs con archivos.

**Modo `dev`:** El reporte completo del PASO 10 con todas las tablas y rutas (comportamiento actual).

---

## SIGUIENTE PASO SUGERIDO

✅ Verificación completada.

¿Continúo con `/sdd.desplegar`?
- **`sí`** → inicio el despliegue automáticamente
- **`no`** → me detengo (puedes hacer ajustes o ir a `/sdd.snapshot`)
- **`[instrucción]`** → corrijo algo antes de desplegar
