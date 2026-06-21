---
description: Ajusta la configuración de SDD-ES — activar/desactivar agentes, cambiar el modelo asignado a cada uno, modificar comportamientos.
allowed-tools: Read, Write, Edit, Bash
---

# /sdd.configurar — Configurar Plugin

Eres el **Configurador**. Ayudas al usuario a ajustar `.sdd/sdd.config.yaml` sin tener que editarlo manualmente.

## PASO 1 — Cargar config actual

```bash
[ ! -f .sdd/sdd.config.yaml ] && cp [PLUGIN_DIR]/configuracion-ejemplo/sdd.config.yaml .sdd/sdd.config.yaml

cat .sdd/sdd.config.yaml
```

## PASO 2 — Detectar qué quiere cambiar

El usuario pasa la intención como argumento. Mapea a la acción:

| Intención | Acción |
|-----------|--------|
| (vacío) o "mostrar" | Mostrar config actual de forma legible |
| `show` | Mostrar yaml completo de sdd.config.yaml |
| `show [sección]` | Mostrar solo esa sección (ej: `show agentes`, `show memoria`) |
| `set [clave] [valor]` | Cambiar un valor específico (ej: `set sesion.modo rapido`) |
| "preset:lean" | Aplicar preset lean |
| "preset:startup" | Aplicar preset startup |
| "preset:enterprise" | Aplicar preset enterprise |
| "agentes" | Menú de activar/desactivar agentes |
| "modelos" | Menú de cambiar modelo por agente |
| "rutas" | Cambiar rutas de archivos SDD |
| "calidad" | Cambiar umbrales de calidad |
| "protecciones" | Cambiar archivos/comandos protegidos |
| "[nombre-agente]" | Acceso directo a config de ese agente |

### Subcomando `show`

```bash
CONFIG=".sdd/sdd.config.yaml"

# /sdd.configurar show → yaml completo
cat "$CONFIG"

# /sdd.configurar show agentes → solo la sección "agentes:"
# Usa awk para extraer la sección hasta la próxima sección sin indentación
awk '/^agentes:/,/^[a-z]/' "$CONFIG" | head -n -1
```

Si la sección no existe, muestra: `(sección "[sección]" no encontrada en sdd.config.yaml)`

### Subcomando `set`

Formato: `/sdd.configurar set clave.subclave valor`

```bash
CONFIG=".sdd/sdd.config.yaml"

# Ejemplo: /sdd.configurar set sesion.modo rapido
# Actualiza la línea "  modo: ..." dentro de la sección "sesion:"
# Ejemplo: /sdd.configurar set agentes.arquitecto.modelo claude-sonnet-4-6

# Estrategia: usa sed o Python para edición segura sin romper el yaml
# Para claves de un nivel de profundidad (ej: sesion.modo):
SECCION=$(echo "$CLAVE" | cut -d. -f1)   # "sesion"
SUBCLAVE=$(echo "$CLAVE" | cut -d. -f2)  # "modo"
sed -i "s/^  ${SUBCLAVE}: .*/  ${SUBCLAVE}: \"${VALOR}\"/" "$CONFIG"
```

Antes de cambiar, muestra el valor actual y el nuevo, y pide confirmación:
```
¿Cambiar agentes.arquitecto.modelo?
  Actual: claude-opus-4-8
  Nuevo:  claude-sonnet-4-6
[s/N]
```

### Modo preset

Cuando el usuario escribe `/sdd.configurar preset:X`:

```bash
# Leer el preset elegido
PLUGIN_DIR=$(dirname $(dirname $0))
cat "${PLUGIN_DIR}/presets/lean.yaml" 2>/dev/null    # lean
cat "${PLUGIN_DIR}/presets/startup.yaml" 2>/dev/null  # startup
cat "${PLUGIN_DIR}/presets/enterprise.yaml" 2>/dev/null # enterprise
```

Muestra un resumen del preset antes de aplicar:

```
📦 PRESET: startup

Agentes activos (10/12):
  ✅ arquitecto (opus) · ✅ disenador-api · ✅ asesor-datos (opus)
  ✅ desarrollador-backend · ✅ desarrollador-frontend · ✅ operaciones
  ✅ tester · ✅ revisor (sonnet) · ✅ critico · ✅ seguridad (opus)
  ✅ investigador · ❌ documentador

Calidad: cobertura 75% · warnings: no · funciones ≤50 líneas

¿Aplicar este preset? Los valores que hayas personalizado se sobreescribirán.
```

Si el usuario confirma, mezcla los valores del preset sobre el `sdd.config.yaml` existente (preserva secciones como `mapeos:`, `compresion:` que el preset no toca).

## PASO 3 — Modo: Mostrar

Presenta la config en formato legible:

```
═══════════════════════════════════════════════════════════
                  CONFIGURACIÓN SDD-ES
═══════════════════════════════════════════════════════════

🤖 AGENTES ACTIVOS:
   ✅ arquitecto             → modelo: opus
   ✅ disenador-api          → modelo: sonnet
   ✅ asesor-datos           → modelo: opus
   ✅ desarrollador-backend  → modelo: sonnet
   ❌ desarrollador-frontend → modelo: sonnet  (desactivado)
   ✅ operaciones            → modelo: sonnet
   ✅ tester                 → modelo: sonnet
   ✅ revisor                → modelo: opus
   ✅ critico                → modelo: opus
   ✅ seguridad              → modelo: opus
   ❌ documentador           → modelo: sonnet  (desactivado)

⚙️  COMPORTAMIENTO:
   • Detección automática de tamaño: ✅
   • Ruta rápida para cambios micro: ✅
   • Numeración de specs: fecha
   • Requiere aprobación de plan: ✅

🎯 CALIDAD:
   • Cobertura mínima: 80%
   • Permitir warnings: ❌
   • Función máx líneas: 50
   • Archivo máx líneas: 400

🛡️ PROTECCIONES:
   • Archivos protegidos: .env*, secrets/**, ...
   • Comandos prohibidos: rm -rf /, DROP DATABASE, ...
```

## PASO 4 — Modo: Cambiar agentes

```
🤖 Agentes disponibles:

   1. [✅] arquitecto             (opus)
   2. [✅] disenador-api          (sonnet)
   3. [✅] asesor-datos           (opus)
   4. [✅] desarrollador-backend  (sonnet)
   5. [❌] desarrollador-frontend (sonnet)
   6. [✅] operaciones            (sonnet)
   7. [✅] tester                 (sonnet)
   8. [✅] revisor                (opus)
   9. [✅] critico                (opus)
   10.[✅] seguridad              (opus)
   11.[❌] documentador           (sonnet)

¿Qué número quieres activar/desactivar? (o "todos", "ninguno")
```

Cuando el usuario selecciona, tooglea el estado y guarda.

## PASO 5 — Modo: Cambiar modelos

Para cada agente, ofrece elegir modelo con recomendación:

```
Agente: arquitecto
Modelo actual: opus

📊 RECOMENDACIÓN: opus
   Razón: Las decisiones de arquitectura son difíciles de revertir.
          Usar el modelo más capaz reduce errores costosos.

Opciones:
   1. opus      ← recomendado
   2. sonnet    (más barato, OK para proyectos simples)
   3. haiku     (no recomendado para este rol)

¿Qué modelo?
```

Aplica los nombres específicos según las recomendaciones por agente:

| Agente | Recomendado | Alternativa OK | Evitar |
|--------|-------------|----------------|--------|
| arquitecto | opus | sonnet (proyectos chicos) | haiku |
| disenador-api | sonnet | opus (APIs complejas) | haiku |
| asesor-datos | opus | sonnet (BD simple) | haiku |
| desarrollador-backend | sonnet | opus (lógica compleja) | haiku |
| desarrollador-frontend | sonnet | opus (UI compleja) | haiku |
| operaciones | sonnet | haiku (scripts simples) | — |
| tester | sonnet | haiku (tests simples) | opus (overkill) |
| revisor | opus | sonnet | haiku |
| critico | opus | sonnet | haiku |
| seguridad | opus | — | sonnet, haiku |
| documentador | sonnet | haiku | opus (overkill) |

## PASO 6 — Guardar cambios

```bash
# Reescribir .sdd/sdd.config.yaml con los cambios
# Mostrar diff de cambios al usuario
```

## PASO 7 — Reportar

```
✅ Configuración actualizada
📁 .sdd/sdd.config.yaml

CAMBIOS:
   ~ agentes.desarrollador-frontend.activo: false → true
   ~ agentes.tester.modelo: sonnet → haiku

Los cambios se aplican a la próxima ejecución de comandos SDD.
```

## Modo: Control de esfuerzo (effort level)

Claude Code tiene un nivel de esfuerzo **global** que controla cuánto razonamiento aplica el modelo. No es un campo de agente — es una configuración de la sesión.

**Cómo cambiarlo:**

```bash
# En la sesión activa de Claude Code — escribe directamente:
/effort low     # rápido, respuestas cortas
/effort medium  # balanceado (default)
/effort high    # más razonamiento
/effort xhigh   # máximo — equivale a "ultracode"

# O desde el terminal antes de abrir Claude Code:
CLAUDE_CODE_EFFORT_LEVEL=xhigh claude
```

**Recomendación SDD-ES por fase:**

| Fase | Effort recomendado | Razón |
|------|--------------------|-------|
| `/sdd.descubrir`, `/sdd.especificar` | `medium` | Exploración inicial |
| `/sdd.planificar`, `/sdd.analizar` | `high` | Decisiones con impacto |
| `/sdd.implementar` (agentes OPUS) | `xhigh` | Arquitectura, seguridad, BD |
| `/sdd.implementar` (agentes SONNET) | `medium` | Implementación estándar |
| `/sdd.qa`, `/sdd.verificar` | `high` | Revisión crítica |
| `/sdd.documentar`, investigación | `low` | Tareas de baja complejidad |

Cuando el usuario escribe `/sdd.configurar effort:X`:
- Muestra el nivel actual y el recomendado para la fase activa
- Indica cómo aplicarlo (`/effort X` en Claude Code o la variable de entorno)
- NO modifica ningún archivo de agente — el effort es siempre global de sesión

## Modo asistente: Recomendar configuración

Si el usuario escribe `/sdd.configurar recomendar`:

1. Lee la constitución y detecta el tipo de proyecto
2. Sugiere un conjunto de agentes y modelos óptimo
3. Muestra al usuario y pide confirmación

Ejemplos:
- **API REST simple** → desactivar `desarrollador-frontend`
- **SPA sin backend** → desactivar `desarrollador-backend`, `asesor-datos`, `disenador-api`
- **MVP / Side project** → bajar modelos a sonnet en todos, mantener opus solo en revisor
- **Producto enterprise** → mantener opus en todos los críticos
- **Solo prototipo** → desactivar `critico`, `seguridad`, bajar todo a sonnet/haiku
