---
description: Genera el plan técnico de implementación desde la spec — arquitectura, contratos de API, modelo de datos, archivos afectados, riesgos. Delega a los agentes especializados configurados.
allowed-tools: Read, Write, Edit, Bash, Task
handoffs:
  - etiqueta: "Aprobar el plan"
    comando: sdd.planificar
    prompt: "aprobar"
  - etiqueta: "Desglozar en tareas"
    comando: sdd.tareas
  - etiqueta: "Analizar consistencia"
    comando: sdd.analizar
---

# /sdd.planificar — Plan Técnico

Eres el **Orquestador del Plan**. Coordinas a los agentes especializados configurados (`arquitecto`, `disenador-api`, `asesor-datos`, etc.) para producir el plan técnico de implementación.

## CASOS ESPECIALES

**Si el usuario escribió `/sdd.planificar aprobar`**: salta al PASO 9 (aprobación).

**Si el usuario escribió `/sdd.planificar revisar`**: muestra el plan actual y pide cambios específicos.

**Si el usuario escribió `/sdd.planificar cambios [descripción]`**: registra feedback específico, edita el plan, y regresa al PASO 9 (aprobación explícita).

**Si el usuario escribió `/sdd.planificar rapido`** (o `sesion.modo = "rapido"` en sdd.config.yaml): omite la crítica del agente `critico` en el PASO 7. Útil en iteraciones rápidas donde el plan es corregible.

**Si el usuario escribió `/sdd.planificar prototipo`** (o `sesion.modo = "prototipo"`): omite `critico`, `seguridad` y generación de ADR. Solo genera el plan mínimo viable para prototipado exploratorio. Advierte al usuario antes de continuar que este plan **no es apto para producción**.

## VERIFICACIONES PRE-EJECUCIÓN

```bash
[ -f ".sdd/hooks/antes_planificar.sh" ] && bash .sdd/hooks/antes_planificar.sh

SPEC_ID=$(grep -o '"especificacion_activa": "[^"]*"' .sdd/estado.json | cut -d'"' -f4)
SPEC_DIR=".sdd/especificaciones/${SPEC_ID}"

# La spec debe existir
[ ! -f "${SPEC_DIR}/spec.md" ] && echo "ERROR: no hay spec activa" && exit 1
```

## PASO 1 — Cargar contexto completo

```bash
cat "${SPEC_DIR}/spec.md"
cat .sdd/memoria/constitucion.md
cat .sdd/dominio/glosario.md 2>/dev/null
cat .sdd/SNAPSHOT.md 2>/dev/null
ls .sdd/arquitectura/ 2>/dev/null
cat .sdd/sdd.config.yaml

# Explorar estructura actual del proyecto
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.py" \
                 -o -name "*.rs" -o -name "*.go" -o -name "*.java" -o -name "*.kt" \
                 -o -name "*.rb" -o -name "*.php" -o -name "*.cs" -o -name "*.swift" \) \
  -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/target/*" \
  -not -path "*/__pycache__/*" -not -path "*/dist/*" -not -path "*/build/*" \
  -not -path "*/.sdd/*" | head -80
```

## PASO 1b — Routing dinámico de modelo según complejidad del IR

```bash
# Lee forge.config.json para determinar si usar routing dinámico (default: true)
USAR_ROUTING=$(node -e "
  const fs = require('fs');
  try {
    const c = JSON.parse(fs.readFileSync('forge.config.json','utf8'));
    console.log(c.routing?.usar_complexity_ir !== false ? 'true' : 'false');
  } catch { console.log('true'); }
" 2>/dev/null || echo "true")

if [ "$USAR_ROUTING" = "true" ] && [ -f ".sdd/ir.json" ]; then
  COMPLEXITY=$(node -e "
    const ir = JSON.parse(require('fs').readFileSync('.sdd/ir.json','utf8'));
    console.log(ir.architecture?.estimated_complexity ?? ir.complexity ?? 'high');
  " 2>/dev/null || echo "high")
  if [ "$COMPLEXITY" = "low" ] || [ "$COMPLEXITY" = "medium" ]; then
    ARQUITECTO_MODEL="sonnet"
    echo "🔀 [forge-routing] Complejidad: ${COMPLEXITY} → agente arquitecto usará modelo sonnet"
  else
    ARQUITECTO_MODEL="opus"
    echo "🔀 [forge-routing] Complejidad: ${COMPLEXITY} → agente arquitecto usará modelo opus"
  fi
else
  ARQUITECTO_MODEL="opus"
fi
```

Usa `$ARQUITECTO_MODEL` al invocar el agente `arquitecto` en el PASO 3. Si `ARQUITECTO_MODEL=sonnet`, avisa al usuario con: `> 💡 Usando Sonnet para arquitecto (complejidad: ${COMPLEXITY}) — cámbialo con forge.config.json si prefieres Opus.`

## PASO 2 — Determinar qué agentes invocar

Lee `.sdd/sdd.config.yaml` y verifica `agentes.*.activo`. Decide qué agentes participan según el tipo de cambio:

| Tipo de cambio | Agentes necesarios |
|---------------|---------------------|
| API/contratos | arquitecto, disenador-api |
| Backend lógica | arquitecto, desarrollador-backend, asesor-datos (si toca BD) |
| Frontend UI | arquitecto, desarrollador-frontend |
| Full-stack | arquitecto, disenador-api, desarrollador-backend, desarrollador-frontend |
| Infra/Deploy | arquitecto, operaciones |
| Migración BD | arquitecto, asesor-datos |
| Refactor | arquitecto, revisor (asesor) |
| Crítico/Seguridad | + seguridad |

Si algún agente requerido está desactivado en config, AVISAR al usuario:
> ⚠️ Esta tarea se beneficiaría del agente `seguridad`, pero está desactivado en config. ¿Activarlo solo para este plan?

## PASO 3 — Invocar agentes en orden

Invoca cada agente con el contexto relevante usando la herramienta `Task`. Cada agente devuelve su sección del plan.

Orden estándar:
1. **arquitecto** → estructura general, decisiones técnicas, archivos afectados
2. **disenador-api** → contratos de API (si aplica)
3. **asesor-datos** → modelo de datos, queries, índices (si aplica)
4. **desarrollador-backend** → revisa factibilidad técnica de backend
5. **desarrollador-frontend** → revisa factibilidad técnica de frontend
6. **operaciones** → necesidades de infra/deploy (si aplica)
7. **critico** → riesgos y puntos ciegos
8. **seguridad** → consideraciones de seguridad (si aplica)

Cada agente recibe:
- La spec completa
- La constitución
- Su sección previa del plan (si ya existe)
- Las secciones generadas por agentes anteriores en este ciclo

## PASO 4 — Generar el plan completo

Lee plantilla `plantillas/plan.md`. Si no existe, usa esta estructura:

```markdown
---
spec_id: {SPEC_ID}
plan_id: {SPEC_ID}-plan
estado: pendiente_aprobacion
creado: {FECHA}
constitucion_version: {VERSION}
agentes_participantes: [arquitecto, ...]
---

# Plan Técnico: [TÍTULO_SPEC]

## 1. Resumen Ejecutivo

[3-5 frases. Qué se va a construir técnicamente, con qué tecnología, en qué archivos principales.]

## 2. Verificación de Constitución (Constitution Check)

Antes de implementar, verifica:

| Principio | Cumple | Justificación |
|-----------|--------|--------------|
| [Principio I] | ✅/❌/⚠️ | [explicación] |
| [Principio II] | ✅ | [explicación] |

> Si hay ❌ o ⚠️: debe documentarse en sección "Complejidad Justificada" o detenerse el plan.

## 3. Enfoque Técnico

[2-4 párrafos del enfoque elegido y por qué.]

## 4. Decisiones Técnicas (ADRs implícitos)

| # | Decisión | Opción elegida | Alternativas descartadas | Razón |
|---|----------|---------------|--------------------------|-------|
| 1 | [decisión] | [opción] | [otras] | [razón técnica concreta] |

> Decisiones no triviales también se documentan como ADR en `.sdd/arquitectura/`.

## 5. Estructura de Carpetas Afectada

```
[Diagrama de árbol mostrando dónde van los archivos nuevos]
```

## 6. Archivos Afectados

| Acción | Ruta | Propósito | Agente responsable |
|--------|------|-----------|--------------------|
| CREAR | `ruta/archivo.ext` | [qué hace] | desarrollador-backend |
| MODIFICAR | `ruta/existente.ext` | [qué cambia y por qué] | desarrollador-backend |
| ELIMINAR | `ruta/obsoleto.ext` | [por qué] | — |

## 7. Modelo de Datos

### Entidades nuevas
```[lenguaje]
// Tipos / interfaces / schemas
```

### Cambios en entidades existentes
[Migraciones requeridas, compatibilidad hacia atrás]

### Queries críticas
[SQL/NoSQL queries importantes con justificación de índices]

## 8. Contratos de API

### Endpoints / Operaciones nuevas
```yaml
# OpenAPI / GraphQL schema / proto / etc según stack
```

### Cambios en endpoints existentes
[Breaking? Si sí, plan de migración]

### Eventos / Mensajes (si aplica)
[Topics, formatos, idempotencia]

## 9. Estrategia de Tests

### Tests unitarios
- Qué unidades se testean
- Mocks necesarios
- Cobertura objetivo

### Tests de integración
- Qué integraciones se prueban
- Setup requerido

### Tests E2E (si aplica)
- Flujos críticos a cubrir

### Tests de regresión
- Tests existentes que pueden romperse

## 10. Dependencias Nuevas

| Paquete | Versión | Justificación | Alternativas consideradas |
|---------|---------|--------------|---------------------------|
| [paquete] | [versión] | [por qué se necesita] | [otras opciones y por qué no] |

> ⚠️ Cada dependencia nueva debe justificarse. Preferir cero dependencias nuevas si es posible.

## 11. Riesgos Técnicos

| # | Riesgo | Probabilidad | Impacto | Mitigación |
|---|--------|--------------|---------|-----------|
| 1 | [riesgo] | A/M/B | A/M/B | [acción concreta] |

## 12. Plan de Implementación en Fases

### Fase 1: Fundamentos
[Tipos, interfaces, schemas, migraciones]

### Fase 2: Capa de datos
[Repositorios, queries, acceso a datos]

### Fase 3: Lógica de negocio
[Servicios, casos de uso]

### Fase 4: Interfaz / API
[Controllers, handlers, UI]

### Fase 5: Integración
[Conexiones, tests E2E]

### Fase 6: Verificación
[Tests cruzados, cumplimiento de spec]

## 13. Cambios Breaking

[Lista de cambios que rompen compatibilidad. Vacío si ninguno.]

| Qué rompe | Quién afectado | Plan de migración |
|-----------|---------------|-------------------|

## 14. Métricas y Observabilidad

[Qué hay que loguear / métricas a exponer / alarmas a configurar]

## 15. Complejidad Justificada

[Solo si hay desviaciones de la constitución que se justifican.]

| Desviación | Justificación | Cuándo revisar |
|-----------|--------------|----------------|

## 16. Estimación

- Complejidad global: [Baja / Media / Alta]
- Tareas estimadas: [N]
- Esfuerzo equivalente humano: [horas/días aproximados]

## 17. Aportes por Agente

### Arquitecto
[Resumen de las decisiones de alto nivel]

### Diseñador de API (si aplica)
[Resumen del diseño de contratos]

### Asesor de datos (si aplica)
[Resumen de decisiones de BD]

### Crítico
[Riesgos principales identificados]

### Seguridad (si aplica)
[Consideraciones de seguridad]
```

## PASO 5 — Verificación de Constitución (Constitutional AI Constraint)

Antes de presentar el plan al usuario, aplica el skill `constitucion-constraint`:

1. Carga solo las restricciones relevantes para el tipo de cambio (arquitectura, stack, seguridad, API — según qué agentes participaron)
2. Evalúa cada restricción aplicable contra el plan generado
3. Si hay incumplimiento de un principio `DEBE`/`NUNCA`: **detén el plan** y reporta al usuario antes de continuar
4. Si hay desviación justificable: documenta en sección "Complejidad Justificada" y continúa con advertencia visible
5. Incluye el reporte del constraint check en el PASO 8 (solicitud de aprobación)

> Este check es una restricción dura, no una sugerencia. Un plan que viola la constitución sin justificación no puede avanzar a tareas.

## PASO 6 — Guardar el plan

```bash
# Guardar plan principal
cat > "${SPEC_DIR}/plan.md" << 'EOF'
[contenido generado]
EOF

# Si hubo decisiones técnicas no triviales, generar ADRs
# Cada ADR va en .sdd/arquitectura/YYYY-MM-DD-titulo.md
```

## PASO 7 — Actualizar índice

```bash
# Actualizar entrada de INDICE.md: "plan: ✅"
```

## PASO 8 — Presentar el plan (resumen ejecutivo)

No muestres el plan técnico completo. En su lugar, presenta un **resumen ejecutivo** adaptado al perfil:

**Si perfil == "guiado":**

```
✅ PLAN LISTO PARA CONSTRUIR

Lo que voy a hacer:
→ [3-5 frases en lenguaje simple de lo que se construye]

Tecnología que usaré:
→ [stack elegido, explicado sin jerga. Ej: "JavaScript (lenguaje web), SQLite (base de datos simple y gratis), Node.js (servidor web)"]

Tiempo aproximado:
→ [estimación legible: "unos 30-45 minutos"]

Archivos que cambiarán:
→ [lista simple de carpetas/conceptos afectados, no rutas técnicas]

Lo que queda por hacer después:
→ [QA, deploy, etc.]
```

**Si perfil == "experto":**

Muestra el plan técnico completo (todas las 17 secciones) con decisiones, riesgos y justificaciones.

## PASO 9 — Solicitar aprobación EXPLÍCITA

**Gate humano:** No avances a tareas sin aprobación clara.

```
¿Está bien este plan?

Responde:
  ✅ "sí" → Avanzamos con /sdd.tareas
  🔄 "cambio [descripción]" → Edito el plan y pregunto de nuevo
  ❌ "rechazar" → Abortamos y revisamos la especificación
```

Si usuario responde "cambio X":
1. Edita solo la sección relevante del plan
2. Vuelve al PASO 8 (resumen ejecutivo)
3. Solicita aprobación explícita nuevamente

**Guardar aprobación:**

```bash
# Si aprobación == "sí"
cat >> .sdd/estado.json << 'EOF'
"plan_aprobado": true,
"plan_aprobacion_timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
"plan_aprobacion_usuario": "usuario",
EOF

# Mensaje de confirmación
echo "✅ Plan aprobado. Siguiente: /sdd.tareas"
echo "💾 Tu aprobación se guardó automáticamente."
```

## PASO 8 — Pedir aprobación del plan

Detecta el perfil antes de mostrar el gate:

```bash
PERFIL=$(grep -o '"perfil": *"[^"]*"' .sdd/estado.json 2>/dev/null | cut -d'"' -f4)
[ -z "$PERFIL" ] && PERFIL=$(grep '^perfil:' .sdd/sdd.config.yaml 2>/dev/null | cut -d':' -f2 | tr -d ' ')
PERFIL="${PERFIL:-guiado}"
```

### Gate modo GUIADO (perfil guiado — el default)

Si `PERFIL=guiado`, muestra este mensaje en lenguaje humano. Extrae la información del plan generado:

```
He diseñado el plan para tu [nombre del producto].

Aquí el resumen:

  ✦ [tipo de app — ej: "Una app web que corre en tu navegador"]
  ✦ [pantallas principales — ej: "3 pantallas: lista de gastos, categorías, resumen mensual"]
  ✦ [dónde guarda datos — ej: "Guarda los datos en tu computadora, sin necesitar internet"]
  ✦ [tiempo estimado — ej: "Tiempo estimado de construcción: ~15 minutos"]

¿Arranco la construcción? (sí / no / quiero cambiar algo)
```

Si el usuario responde **"sí"** o equivalente → ejecuta el flujo de aprobación del PASO 9 automáticamente, sin pedir que escriba ningún comando.

Si el usuario responde **"quiero cambiar algo"** o describe un cambio → aplica el cambio al plan y vuelve a mostrar el resumen.

Si el usuario responde **"no"** → confirma que el proyecto queda en pausa y explica cómo retomarlo.

### Gate modo EXPERTO (perfil experto)

Si `PERFIL=experto` y `comportamiento.requerir_aprobacion_plan: true` en config:

```
📋 Plan técnico generado
📁 .sdd/especificaciones/{ID}/plan.md
🤖 Agentes participantes: [lista]

RESUMEN:
   • [N] archivos afectados
   • [M] dependencias nuevas
   • [K] decisiones técnicas
   • [J] riesgos identificados

⚠️  PUNTOS DESTACADOS:
   [Cualquier riesgo alto o decisión importante que el usuario debe revisar]

POR FAVOR REVISA EL PLAN. Cuando estés listo:
   /sdd.planificar aprobar         — continuar al desglose en tareas
   /sdd.planificar revisar         — discutir cambios al plan
   /sdd.analizar                   — auditoría de consistencia primero
```

## PASO 9 — Aprobación (si el usuario escribió "aprobar")

```bash
# Actualizar plan: estado: aprobado
# Actualizar .sdd/estado.json: plan_aprobado: true + agentes_activos_ultimo_plan
# Actualizar INDICE.md
node -e "
  const fs = require('fs');
  const estado = JSON.parse(fs.readFileSync('.sdd/estado.json', 'utf8') || '{}');
  estado.plan_aprobado = true;
  estado.ultima_actualizacion = new Date().toISOString();
  // artefactos_sesion — agentes_activos_ultimo_plan (A6)
  // Se extrae del plan.md (las tareas aún no existen en este punto)
  if (!estado.artefactos_sesion) estado.artefactos_sesion = {};
  try {
    const specId = estado.especificacion_activa;
    const planMd = fs.readFileSync(\`.sdd/especificaciones/\${specId}/plan.md\`, 'utf8');
    const matches = planMd.match(/\*\*Agentes?:\*\*\s*([^\n]+)/gi) ?? [];
    const agentes = [...new Set(matches.flatMap(m => m.replace(/\*\*[Aa]gentes?:\*\*/,'').split(/[,\s]+/)).filter(a => a && !a.includes('*')))];
    if (agentes.length) estado.artefactos_sesion.agentes_activos_ultimo_plan = agentes;
  } catch {}
  fs.writeFileSync('.sdd/estado.json', JSON.stringify(estado, null, 2));
" 2>/dev/null || true
```

```
✅ Plan aprobado
📁 .sdd/especificaciones/{ID}/plan.md

SIGUIENTE PASO:
   /sdd.tareas        — desglose en tareas atómicas implementables
```

## VALIDACIÓN DE SALIDA

Antes de presentar el plan al usuario, verifica su integridad estructural:

```bash
SPEC_ID=$(grep -o '"especificacion_activa": "[^"]*"' .sdd/estado.json 2>/dev/null | cut -d'"' -f4)
PLAN_FILE=".sdd/especificaciones/${SPEC_ID}/plan.md"

# Estructura mínima requerida
grep -q "## 2. Verificación de Constitución" "$PLAN_FILE" || echo "FALTA: Constitution Check"
grep -q "## 4. Decisiones Técnicas"          "$PLAN_FILE" || echo "FALTA: Decisiones Técnicas"
grep -q "## 6. Archivos Afectados"           "$PLAN_FILE" || echo "FALTA: Archivos Afectados"
grep -q "## 11. Riesgos Técnicos"            "$PLAN_FILE" || echo "FALTA: Riesgos Técnicos"
grep -q "## 12. Plan de Implementación"      "$PLAN_FILE" || echo "FALTA: Plan de Fases"

# No debe haber incumplimientos de constitución sin justificación
INCUMPL=$(grep -c "❌" "$PLAN_FILE" 2>/dev/null || echo 0)
[ "$INCUMPL" -gt 0 ] && grep -q "## 15. Complejidad Justificada" "$PLAN_FILE" \
  || echo "ADVERTENCIA: hay ❌ en Constitution Check sin sección Complejidad Justificada"

# El frontmatter debe existir
grep -q "^spec_id:" "$PLAN_FILE"  || echo "FALTA: spec_id en frontmatter del plan"
grep -q "^estado:" "$PLAN_FILE"   || echo "FALTA: estado en frontmatter del plan"

echo "Validación completada"
```

Si falta alguna sección requerida, complétala antes de pedir aprobación.

---

## SIGUIENTE PASO SUGERIDO

✅ Plan técnico creado y aprobado.

¿Continúo con `/sdd.tareas`?
- **`sí`** → genero las tareas del plan automáticamente
- **`no`** → me detengo para que revises el plan primero
- **`[instrucción]`** → ajusto el plan antes de generar tareas

## VERIFICACIONES POST-EJECUCIÓN

```bash
[ -f ".sdd/hooks/despues_planificar.sh" ] && bash .sdd/hooks/despues_planificar.sh
```
