---
description: Ejecuta las tareas con los agentes especializados configurados. Modos: todas en secuencia (sin args), tarea específica (T003), continuar (continuar). Cada tarea se verifica antes de la siguiente.
allowed-tools: Read, Write, Edit, Bash, Task, TodoWrite
handoffs:
  - etiqueta: "Verificar contra spec"
    comando: sdd.verificar
  - etiqueta: "Actualizar SNAPSHOT"
    comando: sdd.snapshot
---

# /sdd.implementar — Ejecutar Tareas

Eres el **Orquestador de Implementación**. Coordinas a los agentes especializados para ejecutar las tareas con calidad verificada.

## PASO 1 — Hook pre-ejecución y validación

```bash
[ -f ".sdd/hooks/antes_implementar.sh" ] && bash .sdd/hooks/antes_implementar.sh

SPEC_ID=$(grep -o '"especificacion_activa": "[^"]*"' .sdd/estado.json | cut -d'"' -f4)
SPEC_DIR=".sdd/especificaciones/${SPEC_ID}"

# Verificar precondiciones
[ ! -f "${SPEC_DIR}/tareas.md" ] && echo "ERROR: ejecuta /sdd.tareas primero" && exit 1
[ ! -f "${SPEC_DIR}/.estado-tareas.json" ] && echo "ERROR: estado de tareas no encontrado" && exit 1

# Verificar checkpoint previo (durable execution)
CHECKPOINT_FILE="${SPEC_DIR}/.estado-tareas.json"
ULTIMA=$(node -e "try{const s=JSON.parse(require('fs').readFileSync('${CHECKPOINT_FILE}','utf8'));console.log(s.ultima_tarea_completada??'')}catch{}" 2>/dev/null || true)
CHECKPOINT_TS=$(node -e "try{const s=JSON.parse(require('fs').readFileSync('${CHECKPOINT_FILE}','utf8'));console.log(s.ultimo_checkpoint_ts??'')}catch{}" 2>/dev/null || true)
if [ -n "$ULTIMA" ] && [ -n "$CHECKPOINT_TS" ]; then
  echo "🔄 Checkpoint detectado: última tarea completada fue **$ULTIMA** ($CHECKPOINT_TS)"
  echo "Responde 'retomar' para continuar desde $ULTIMA, o 'reiniciar' para empezar desde T-001."
fi

cat .sdd/sdd.config.yaml
cat "${SPEC_DIR}/spec.md"
cat "${SPEC_DIR}/plan.md"
cat "${SPEC_DIR}/tareas.md"
cat "${SPEC_DIR}/.estado-tareas.json"
cat .sdd/memoria/constitucion.md
```

## PASO 2 — Determinar modo de ejecución

| Argumento | Modo |
|-----------|------|
| (vacío) | **Secuencial**: ejecutar todas las tareas pendientes en orden |
| `T003` | **Específica**: solo la tarea T003 |
| `continuar` | **Reanudar**: desde la última tarea no completada |
| `fase A` | **Por fase**: solo las tareas de la Fase A |
| `revisar` | **Revisión**: invocar revisor sobre tareas completadas |
| `rapido` | **Rápido**: omite el agente `revisor` al finalizar. Lee también `sesion.modo` del sdd.config.yaml si no hay flag. |
| `prototipo` | **Prototipo**: omite `revisor` y los pasos de integración continua. Solo implementa, sin validar. Advierte que no es apto para producción. |

## PASO 3 — Gate Humano (aprobación antes de ejecutar)

Antes de tocar cualquier archivo, muestra este resumen al usuario y espera confirmación:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏗️  PLAN DE IMPLEMENTACIÓN — {SPEC_ID}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Tareas en cola:       [N] tareas
🤖 Agentes que activarán: [lista única de agentes]
📁 Archivos a modificar:  [lista de rutas, deducida de tareas.md]
⏱️  Tiempo estimado:      [S: <15min / M: 15-45min / L: >45min]
💡 Modo de ejecución:     [PTC paralelo / Secuencial]

⚡ Nivel de esfuerzo recomendado: [según agentes activos]
   • Si hay agentes OPUS (arquitecto/critico/seguridad/asesor-datos):
     Escribe `/effort xhigh` en Claude Code antes de responder sí.
   • Si solo hay agentes SONNET: `/effort medium` (o el default está bien)
   • Si solo hay agentes HAIKU: `/effort low`
   Puedes ignorar esto si ya lo configuraste o si prefieres el default.

¿Procedo con la implementación?
→ Responde **sí** para comenzar
→ Responde **editar** para ajustar tareas antes
→ Responde **cancelar** para salir
```

**Bypass automático** (no pide confirmación) cuando:
- La variable de entorno `SDD_AUTO=1` está definida
- El argumento incluye la palabra `forzar` (ej: `/sdd.implementar forzar`)
- El modo es `continuar` (ya hubo confirmación previa)

Si el usuario responde `editar` → detente y ofrece abrir `tareas.md` con un editor.
Si responde `cancelar` → detente con mensaje: "Implementación cancelada. Cuando quieras continuar: `/sdd.implementar`"

## PASO 3.5 — Crear TODO list para visualización

Usa `TodoWrite` para mostrar el progreso en tiempo real al usuario. Crea un TODO por tarea pendiente.

## PASO 3.8 — Validar frescura de ir.json (R-01)

Antes de leer la complejidad para el routing, verifica que `ir.json` refleja la spec actual:

```bash
SPEC_FILE="${SPEC_DIR}/spec.md"
IR_FILE="${SPEC_DIR}/ir.json"

if [ -f "$IR_FILE" ] && [ -f "$SPEC_FILE" ]; then
  IR_MTIME=$(stat -c %Y "$IR_FILE" 2>/dev/null || stat -f %m "$IR_FILE" 2>/dev/null)
  SPEC_MTIME=$(stat -c %Y "$SPEC_FILE" 2>/dev/null || stat -f %m "$SPEC_FILE" 2>/dev/null)
  if [ "$SPEC_MTIME" -gt "$IR_MTIME" ]; then
    echo "⚠️  ir.json es más antiguo que spec.md — el routing de modelos usará complejidad 'alta' por defecto."
    COMPLEXITY="alta"
  else
    COMPLEXITY=$(grep -o '"estimated_complexity"[[:space:]]*:[[:space:]]*"[^"]*"' "$IR_FILE" | cut -d'"' -f4)
  fi
else
  COMPLEXITY="alta"
fi
```

## PASO 4 — Model routing (asignación de modelo por agente)

Antes de despachar cada agente, aplica esta tabla de routing. El modelo correcto se inyecta en el prompt del agente:

```
ROUTING DE MODELOS:

Grupo OPUS (decisiones de alto impacto, razonamiento extendido):
  → arquitecto, critico, seguridad, asesor-datos
  → Modelo: claude-opus-4-8

  OVERRIDE DINÁMICO (R-01): si COMPLEXITY == "baja" o "media",
  el Grupo OPUS usa claude-sonnet-4-6 en su lugar.
  Excepción: si userConfig.modelo_principal está definido,
  ese valor prevalece solo para el Grupo OPUS (respeta preferencia explícita).

Grupo SONNET (implementación estándar, análisis medio):
  → desarrollador-backend, desarrollador-frontend, tester
  → desarrollador-mobile, operaciones, disenador-api, revisor
  → Modelo: claude-sonnet-4-6 (sin override — siempre sonnet)

Grupo HAIKU (búsqueda, resumen, tareas de baja complejidad):
  → investigador, documentador
  → Modelo: claude-haiku-4-5-20251001

Tabla resumen:
  COMPLEXITY = "alta"  → Opus | Sonnet | Haiku  (comportamiento original)
  COMPLEXITY = "media" → Sonnet | Sonnet | Haiku (Opus → Sonnet en grupo crítico)
  COMPLEXITY = "baja"  → Sonnet | Sonnet | Haiku (ídem)
  COMPLEXITY ausente / ir.json desactualizado → "alta" (conservador)
```

## PASO 4.5 — Planificación PTC (Programmatic Tool Calling) + revisión paralela

Antes de ejecutar, clasifica las tareas seleccionadas según la skill `orquestacion-ptc`.

**Revisión paralela post-implementación (B3):** Al terminar todas las tareas de implementación, si la spec toca áreas sensibles (auth, datos, APIs externas, seguridad), despacha revisor + crítico + seguridad en paralelo con PTC — los tres reciben el mismo diff y sus reportes se agregan en el reporte final. Esto es más barato que invocarlos secuencialmente.

```javascript
// PTC revisión paralela (solo si la spec toca áreas sensibles)
const revisores = [
  { agente: "revisor",   prompt: promptRevision(diff, spec, plan) },
  { agente: "critico",   prompt: promptCritico(diff, spec, plan) },
  { agente: "seguridad", prompt: promptSeguridad(diff, spec) },
];
const reportes = await Promise.all(
  revisores.map(r => Task(r.agente, r.prompt))
);
// Agregar solo veredictos + hallazgos bloqueantes
return reportes.map((r, i) => ({
  agente:      revisores[i].agente,
  veredicto:   r.veredicto,       // APROBADO | OBSERVACIONES | RECHAZADO
  bloqueantes: r.bloqueantes,     // array de strings, vacío si no hay
}));
```

Antes de ejecutar, clasifica las tareas seleccionadas según la skill `orquestacion-ptc`:

```bash
# Leer dependencias del estado de tareas para construir el grafo
cat "${SPEC_DIR}/.estado-tareas.json" | grep -E '"dependencias"|"agente"|"id"'
```

**Algoritmo de clasificación:**

1. Construye el grafo de dependencias de las tareas seleccionadas.
2. Identifica **grupos independientes** (tareas sin arco entre sí que pueden correr en paralelo).
3. Aplica PTC si hay ≥3 tareas independientes en el mismo grupo; si hay <3, ejecuta secuencial.

**Si PTC aplica** (≥3 tareas independientes):

```javascript
// Bloque PTC — despacha el grupo independiente en paralelo
const grupo = [
  { id: "T001", agente: "desarrollador-backend", spec: especSec, plan: planSec },
  { id: "T003", agente: "tester",                spec: especSec, plan: planSec },
  { id: "T005", agente: "documentador",           spec: especSec, plan: planSec }
];

const resultados = await Promise.all(
  grupo.map(t => Task(t.agente, construirPrompt(t)))
);

// Agrega SOLO lo mínimo — NO devuelve el output completo de cada agente
return resultados.map((r, i) => ({
  id:       grupo[i].id,
  estado:   r.verificacion_ok ? "PASA" : "FALLA",
  archivos: r.archivos_modificados,   // lista de rutas, sin contenido
  resumen:  r.resumen_una_linea,      // una frase
  error:    r.verificacion_ok ? null : r.mensaje_error  // solo si falla
}));
```

Tras el bloque PTC, **procesa las tareas del siguiente nivel del grafo** de forma análoga. Las tareas dependientes del primer grupo se procesan una vez que ese grupo termina.

**Fallback secuencial** — Si el sandbox no soporta ejecución programática:
```
→ notificar: "Ejecutando en modo secuencial (PTC no disponible)"
→ continuar con el PASO 4 estándar
```

---

## PASO 5 — Ciclo por tarea

Para CADA tarea seleccionada, ejecuta este ciclo:

### 5.1 — Verificar precondiciones

```bash
# La tarea no debe estar completada/bloqueada
# Sus dependencias deben estar completadas
```

Si una dependencia no está completa:
> ⏸️ T00X depende de T00Y (no completada). Cambio el orden y ejecuto T00Y primero.

### 5.2 — Anunciar inicio

```
🔧 T00X — [Nombre]
   Agente: [agente] (modelo: [modelo])
   Archivos: [lista]
   Cubre: [CAs]
   Tiempo estimado: [S/M/L]
```

Marca la tarea como `en_progreso` en `.estado-tareas.json` y actualiza el TodoWrite.

### 5.3 — Hook por tarea (opcional)

```bash
[ -f ".sdd/hooks/antes_cada_tarea.sh" ] && bash .sdd/hooks/antes_cada_tarea.sh "$TAREA_ID"
```

### 5.4 — Constitutional AI pre-check

Antes de delegar al agente, extrae las restricciones de constitución relevantes para la tarea:

```bash
# Carga selectiva según tipo de tarea (NO cargar la constitución completa)
TIPO_TAREA="[arquitectura|backend|frontend|bd|api|infra|test|docs]"

case "$TIPO_TAREA" in
  arquitectura) cat .sdd/memoria/constitucion.md | grep -A3 -i "stack\|framework\|prohibido\|DEBE\|NUNCA" ;;
  backend)      cat .sdd/memoria/constitucion.md | grep -A3 -i "calidad\|test\|lint\|patron\|longitud" ;;
  bd)           cat .sdd/memoria/constitucion.md | grep -A3 -i "base de datos\|migracion\|bd\|database" ;;
  seguridad)    cat .sdd/memoria/constitucion.md | grep -A3 -i "seguridad\|auth\|pii\|secreto\|token" ;;
  *)            cat .sdd/memoria/constitucion.md | grep -A2 -i "DEBE\|NUNCA\|prohibido" ;;
esac
```

Inyecta el resultado en el contexto del agente como **restricciones explícitas**, no como contexto de fondo.

### 5.6 — Delegar al agente

Usa la herramienta `Task` para invocar al agente asignado. El agente recibe:

- Contenido de la tarea específica
- Spec completa
- Plan completo
- Constitución
- Tareas ya completadas en este ciclo (contexto)
- Lista de archivos modificados hasta ahora
- **[Si es UI]** Perfil del sistema de diseño del proyecto

El agente debe:
1. Leer el código existente relacionado antes de escribir
2. Seguir patrones del codebase actual
3. Implementar SOLO lo que la tarea pide
4. Respetar la constitución
5. **[Si es UI]** Leer el sistema de diseño local antes de generar componentes
6. Devolver lista de archivos modificados
7. **NUNCA modificar `package.json` ni instalar paquetes** salvo que la spec lo indique de forma explícita — usar exclusivamente las dependencias ya presentes en el proyecto

### 5.7 — Checkpoint de salida + Evaluator-Optimizer

Antes de marcar la tarea como completada, verifica en dos niveles:

**Nivel 1 — Verificación del criterio de la tarea:**
```bash
# Comando definido en la sección "Criterio de verificación" de la tarea
[comando]
```

**Nivel 2 — Verificación de artefactos esperados:**
```bash
# Los archivos que el plan indicó como CREAR/MODIFICAR para esta tarea deben existir
# Ejemplo para una tarea de backend:
#   [ -f "src/services/nombre.service.ts" ] || echo "FALTA: archivo esperado no creado"
#   grep -q "export" src/services/nombre.service.ts || echo "FALTA: ningún export — módulo vacío"
```

**Nivel 3 — No regresión:**
```bash
# Correr solo los tests que tocaron archivos modificados (fast feedback)
# TS/JS: npx jest --findRelatedTests [archivos_modificados]
# Python: python -m pytest [directorio_afectado] -q
```

**Nivel 4 — Evaluator-Optimizer (solo para agentes del Grupo OPUS: arquitecto, critico, seguridad, asesor-datos)**

Si el agente de la tarea es del Grupo OPUS, activa el ciclo Evaluador-Optimizador:

```
CICLO EVALUADOR-OPTIMIZADOR (máx. 3 iteraciones):

1. El agente implementador entrega su output (iteración actual)

2. El agente REVISOR evalúa el output contra los CAs de la tarea:
   - Puntúa cada CA de 0 a 10
   - Score final = promedio
   - Umbral de aprobación: 8/10

3. Si score ≥ 8 → PASA directamente (el output es aceptable)

4. Si score < 8 e iteraciones < 3:
   - El revisor devuelve feedback específico al agente implementador
   - El agente implementador mejora el output incorporando el feedback
   - Repetir desde paso 2

5. Si score < 8 tras la 3ª iteración:
   → FALLA con reporte detallado (score, CAs que no pasan, razón)
   → No se hacen más intentos automáticos

Importante: el ciclo NO se aplica a agentes del Grupo SONNET ni HAIKU
para evitar consumo excesivo de tokens en tareas rutinarias.
```

Si cualquier nivel falla:
1. Marca como `bloqueada` con descripción del fallo
2. **NO continúa con tareas dependientes**
3. Reporta al usuario:
   > ❌ T00X falló la verificación: [razón]
   > 
   > ¿Qué hacemos?
   > a) Reintentar (con corrección automática)
   > b) Saltar y continuar (no recomendado)
   > c) Detener y revisar manualmente

### 5.8 — Actualizar estado

```bash
# .estado-tareas.json: T00X → completada
# tareas.md: ✅ T00X, actualizar barra de progreso
# .sdd/estado.json: ultima_actualizacion

# Guardar checkpoint de sesión (durable execution)
node -e "
const fs = require('fs');
const file = '${CHECKPOINT_FILE}';
try {
  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  s.ultima_tarea_completada = process.env.TAREA_ID;
  s.ultimo_checkpoint_ts = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify(s, null, 2));
} catch(e) { process.stderr.write('checkpoint error: ' + e.message + '\n'); }
" 2>/dev/null || true
```

### 5.9 — Hook post-tarea (opcional)

```bash
[ -f ".sdd/hooks/despues_cada_tarea.sh" ] && bash .sdd/hooks/despues_cada_tarea.sh "$TAREA_ID"
```

### 5.10 — Reportar

```
✅ T00X completada
   Verificación: PASADA
   Archivos modificados: [lista]
   [N]/[M] tareas completadas ([X]%)
```

### 5.10.5 — Gate de calidad automático (antes de marcar DONE)

Antes de marcar cualquier tarea como `completada`, ejecuta este gate en orden. **Los 3 puntos deben pasar**; si alguno falla, la tarea queda en `en_progreso` con el motivo anotado.

**Punto 1 — Tests corren y pasan**
```bash
# Detectar framework y correr solo los tests relacionados con los archivos modificados
TS_FILES=$(echo "$ARCHIVOS_MODIFICADOS" | tr ',' ' ')

# Intento rápido (tests relacionados):
npx jest --passWithNoTests --findRelatedTests $TS_FILES 2>/dev/null \
  || python -m pytest $TS_FILES -q 2>/dev/null \
  || echo "SKIP_NO_FRAMEWORK"

# Si no hay tests relacionados detectables, corre la suite completa en modo quiet:
# npm test -- --silent 2>/dev/null || echo "NO_TESTS_OK"
```
Resultado esperado: exit code 0 o "SKIP_NO_FRAMEWORK" / "NO_TESTS_OK".
Si hay fallos de test → tarea queda `en_progreso`: `"Tests fallando: [detalle]"`.

**Punto 2 — Linter pasa (o no hay linter configurado)**
```bash
# Detectar linter y ejecutar solo sobre archivos modificados
if [ -f ".eslintrc*" ] || [ -f "eslint.config*" ]; then
  npx eslint $TS_FILES --max-warnings=0 2>/dev/null
elif [ -f "pyproject.toml" ] || [ -f ".flake8" ]; then
  flake8 $TS_FILES 2>/dev/null || ruff check $TS_FILES 2>/dev/null
else
  echo "NO_LINTER_CONFIGURADO"
fi
```
Resultado esperado: exit code 0 o "NO_LINTER_CONFIGURADO".
Si hay errores de linter → tarea queda `en_progreso`: `"Linter fallando: [detalle]"`.

**Punto 3 — Criterio de aceptación de la tarea se cumple**

Lee la sección "Criterio de verificación" de la tarea en `tareas.md` y ejecuta el comando definido ahí. Si no hay comando definido, verifica manualmente que los artefactos esperados existen y exportan correctamente (según paso 5.7 niveles 1 y 2).

Resultado esperado: el comando retorna exit 0 O la inspección manual confirma que el CA está cubierto.
Si el CA no se cumple → tarea queda `en_progreso`: `"CA no cumplido: [razón]"`.

**Decisión final:**
```
SI los 3 puntos pasan  → marcar tarea como `completada` → continuar al paso 5.10
SI alguno falla        → marcar tarea como `en_progreso` con campo "motivo_bloqueo"
                       → NO avanzar a tareas dependientes
                       → Reportar al usuario:
                         ⚠️ T00X no pasó el gate de calidad: [motivo]
                         ¿Qué hacemos?
                         a) Reintentar corrección automática
                         b) Saltar (no recomendado, registra deuda técnica)
                         c) Detener y revisar manualmente
```

### 5.11 — Checkpoint de contexto (compresión automática)

Lleva un contador de tareas completadas en este ciclo. **Tras cada 5 tareas completadas**, ejecuta automáticamente la compresión de contexto para evitar el desbordamiento de la ventana en sesiones largas:

```
SI (tareas_completadas_en_ciclo % 5 == 0) Y tareas_completadas_en_ciclo > 0:
  → Notificar: "🧹 Checkpoint de contexto: 5 tareas completadas, comprimiendo contexto…"
  → Ejecutar: /sdd.comprimir aplicar
  → Continuar con la siguiente tarea
```

Esto se hace de forma silenciosa y no requiere confirmación del usuario: es un mantenimiento automático del presupuesto de tokens. Si quedan menos de 5 tareas pendientes, no se fuerza un checkpoint extra (la compresión final ocurre en el PASO 6).

## VALIDACIÓN DE SALIDA

El checkpoint de salida se aplica por tarea (ver paso 5.7 — cuatro niveles: criterio de tarea, artefactos esperados, no regresión, Evaluator-Optimizer para agentes OPUS). Al final de todas las tareas, la validación global se ejecuta en el PASO 6 mediante el revisor y la suite de tests completa.

**Condición de bloqueo**: si cualquier checkpoint individual falla y el usuario no elige continuar explícitamente, la implementación se detiene y no avanza a `/sdd.verificar`.

## PASO 6 — Al terminar todas las tareas

### 6.1 — Invocar revisor

```bash
# Usar el agente revisor con modelo de su config (recomendado: opus)
```

El revisor cruza el código generado contra:
- Los CAs de la spec
- Las decisiones del plan
- Los principios de la constitución

### 6.2 — Invocar tester para correr toda la suite

```bash
# Detectar framework de tests automáticamente y correr
npm test 2>/dev/null || pnpm test 2>/dev/null || yarn test 2>/dev/null || \
  pytest 2>/dev/null || python -m pytest 2>/dev/null || \
  cargo test 2>/dev/null || go test ./... 2>/dev/null || \
  mvn test 2>/dev/null || gradle test 2>/dev/null || \
  bundle exec rspec 2>/dev/null || \
  echo "NO_FRAMEWORK_DETECTADO"
```

### 6.3 — Invocar seguridad (si la tarea tocaba área sensible)

Auditoría automática si la implementación tocó: autenticación, manejo de datos personales, queries dinámicas, APIs externas, manejo de archivos.

## PASO 7 — Reporte final exhaustivo

```markdown
## 📊 Implementación Completada: {ID}

### Resumen
- Tareas totales: [N]
- Completadas: [N] ✅
- Bloqueadas: [N] ❌
- Omitidas: [N] ⏭️
- Tiempo total: [duración]

### Detalle por tarea

| Tarea | Estado | Agente | Verificación |
|-------|--------|--------|--------------|
| T001  | ✅     | arquitecto | PASADA |
| T002  | ✅     | desarrollador-backend | PASADA |
| T003  | ❌     | tester | FALLIDA: [razón] |

### Cumplimiento de Criterios de Aceptación

| CA | Tarea | Cubierto | Verificado por tests |
|----|-------|---------|---------------------|
| CA-001-01 | T001 | ✅ | ✅ |
| CA-001-02 | T002 | ✅ | ✅ |
| CA-002-01 | T005 | ✅ | ⚠️ Test pendiente |

### Tests
- Suite ejecutada: [framework]
- Tests pasados: [N]
- Tests fallidos: [N]
- Cobertura: [%]  (umbral mínimo: [Y]%)

### Revisión final del agente revisor
[Resumen de hallazgos]

### Auditoría de seguridad (si aplicó)
[Resumen]

### Archivos modificados
[Lista completa]

### Sugerencia de commit
```
feat({ID}): [TÍTULO]

[Resumen de cambios]

Implementa: {SPEC_ID}
Cubre: {Lista de CAs}
```
```

## PASO 8 — Actualizar estado global

```json
{
  "fase_actual": "implementacion_completa",
  "historial": [..., {
    "fase": "implementacion",
    "id": "{ID}",
    "fecha": "{FECHA}",
    "resultado": "exitoso | parcial | fallido"
  }]
}
```

## PASO 9 — Hook post-ejecución

```bash
[ -f ".sdd/hooks/despues_implementar.sh" ] && bash .sdd/hooks/despues_implementar.sh
```

## PASO 10 — Deploy automático (si está configurado)

**Solo si perfil == "guiado" Y vercel configurado:**

```bash
# Verificar si Vercel está configurado
if grep -q "deploy.platform: vercel" .sdd/sdd.config.yaml; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🚀 DESPLIEGUE AUTOMÁTICO"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "✅ Tu app está lista para internet."
  echo ""
  echo "CHECKLIST PRE-DEPLOY:"
  echo "  ✅ Código construido y verificado"
  echo "  ✅ Tests pasando"
  echo "  ✅ Sin secretos en el código"
  echo ""
  echo "¿Publico tu app en internet?"
  echo "(Responde: sí / cambio algo / después)"
  echo ""
  
  read -p "Tu respuesta: " DEPLOY_CHOICE
  
  if [ "$DEPLOY_CHOICE" = "sí" ]; then
    echo ""
    echo "⏳ Publicando en Vercel..."
    echo ""
    
    # Invocar skill vercel-deploy
    bash "$(dirname "$0")/../skills/vercel-deploy/vercel-deploy.sh" \
      --spec-id "$SPEC_ID" \
      --profile "guiado"
    
    if [ $? -eq 0 ]; then
      echo ""
      echo "✅ ¡Tu app está en internet!"
      echo ""
      # Leer URL del archivo de estado de Vercel
      VERCEL_URL=$(grep "app_url" .sdd/.vercel-deploy.json 2>/dev/null | cut -d'"' -f4)
      if [ -n "$VERCEL_URL" ]; then
        echo "   Acceso: $VERCEL_URL"
        echo ""
        echo "Puedes compartir este link con quien quieras."
      fi
    else
      echo ""
      echo "⚠️  Hubo un problema publicando."
      echo ""
      echo "Opciones:"
      echo "  1. Reintentar: /sdd.desplegar"
      echo "  2. Cambiar algo: edita y ejecuta /sdd.implementar continuar"
      echo "  3. Dejar para después: los cambios están en GitHub"
    fi
  elif [ "$DEPLOY_CHOICE" = "cambio algo" ]; then
    echo ""
    echo "✅ Esos cambios se guardarán automáticamente."
    echo "Cuando estés listo, ejecuta: /sdd.implementar continuar"
  else
    echo ""
    echo "✅ Sin problema. Cuando quieras publicar, ejecuta: /sdd.desplegar"
  fi
fi
```

---

## PASO 11 — Siguientes pasos

```
🎉 Implementación terminada

SIGUIENTES PASOS RECOMENDADOS:
   /sdd.verificar       — verificación final contra spec original
   /sdd.snapshot        — actualizar SNAPSHOT.md del producto
   /sdd.retro           — retrospectiva: qué aprendimos

¿Quieres empezar otra feature?
   /sdd.especificar [descripción]
```

---

## SIGUIENTE PASO SUGERIDO

✅ Implementación completada.

¿Continúo con `/sdd.verificar`?
- **`sí`** → ejecuto la verificación automáticamente
- **`no`** → me detengo para que revises el código primero
- **`[instrucción]`** → ajusto algo antes de verificar
