---
description: Pipeline completo de FORGE. Si no hay IR, interpreta primero. Si no hay diseño, diseña. Luego mapea spec → planifica → tareas → implementa. Punto de entrada único para convertir una idea en código.
allowed-tools: Read, Write, Bash, Agent
---

# /sdd.construir — Pipeline Completo

**Uso:**
```
/sdd.construir
/sdd.construir --desde-spec    ← salta directo a planificar (si ya hay spec)
/sdd.construir --solo-spec     ← genera solo la spec, no continúa
/sdd.construir --forzar        ← ignora checkpoints y vuelve a ejecutar todo
```

---

## LÓGICA DE ENTRADA

### Verificar estado del proyecto

```bash
node -e "
  const fs = require('fs');
  const estado = JSON.parse(fs.existsSync('.sdd/estado.json') ? fs.readFileSync('.sdd/estado.json', 'utf8') : '{}');
  console.log(JSON.stringify({
    tiene_ir: !!estado.ir_generado && fs.existsSync('.sdd/ir.json'),
    tiene_design: !!estado.product_design_aprobado && fs.existsSync('.sdd/product-design.json'),
    tiene_spec: !!estado.spec_activa,
    pipeline_step: estado.pipeline_step || 'inicio'
  }));
"
```

### Árbol de decisión:

```
¿Tiene IR?
  NO → invocar /sdd.interpretar
       [esperar input del usuario]
       [volver a /sdd.construir después]

  SÍ → ¿Tiene ProductDesign aprobado?
         NO → invocar /sdd.diseñar
              [después continúa automáticamente]

         SÍ → PASO 1: Mapear IR + Design → Spec draft
              PASO 2: /sdd.especificar (con spec draft como base)
              PASO 3: /sdd.planificar
              PASO 4: /sdd.tareas
              PASO 5: /sdd.implementar
```

---

## PASO 1 — Mapear IR + ProductDesign → Spec Draft

```bash
# Verificar que tenemos los inputs
if [ ! -f ".sdd/ir.json" ] || [ ! -f ".sdd/product-design.json" ]; then
  echo "Error: Falta IR o ProductDesign"
  exit 1
fi

# Ejecutar el mapper (artefacto JS distribuido junto al plugin).
# Claude Code expone $CLAUDE_PLUGIN_ROOT con la raíz del plugin instalado.
MAPPER="${CLAUDE_PLUGIN_ROOT:-.}/core/ir-to-spec-mapper.js"
if [ ! -f "$MAPPER" ]; then
  # Fallback: buscar el mapper en ubicaciones conocidas
  for p in "$HOME/.claude/plugins/sdd-es/core/ir-to-spec-mapper.js" "core/ir-to-spec-mapper.js"; do
    [ -f "$p" ] && MAPPER="$p" && break
  done
fi
node "$MAPPER"

# El mapper genera .sdd/spec-draft.json con:
# - user_stories[] ← de features.core del IR
# - functional_requirements[] ← de core_screens del ProductDesign
# - actors[] ← del IR
# - non_functional_requirements[]
# - out_of_scope[]
```

Mostrar al usuario:

```
📋 SPEC DRAFT GENERADA
─────────────────────────────
[N] historias de usuario (US-001 a US-00N)
[M] requerimientos funcionales (RF-001 a RF-00M)
Actores: [lista]

¿Continuar al plan de implementación?
  ↵ Enter → continuar
  m → ver spec completa primero
  e → editar spec antes de continuar
```

Si `--solo-spec`, terminar aquí y sugerir `/sdd.especificar`.

---

## PASO 2 — Especificación

Invocar `/sdd.especificar` con la spec-draft como base:

```bash
# El comando especificar lee .sdd/spec-draft.json si existe
# y lo usa como punto de partida en lugar de empezar de cero
/sdd.especificar
```

Después de especificar, la spec queda en `.sdd/` en el formato de sdd-lite.

---

## PASO 3 — Planificar

```bash
/sdd.planificar
```

Genera el plan de implementación basado en la spec.

---

## PASO 4 — Crear Tareas

```bash
/sdd.tareas
```

Descompone el plan en tareas atómicas implementables.

---

## PASO 5 — Implementar

```bash
/sdd.implementar
```

Genera el código base según las tareas.

---

## Progreso visual

Durante la ejecución, muestra el progreso del pipeline:

```
FORGE PIPELINE — [product.name]
═══════════════════════════════════════
  ✅ Idea interpretada (IR v1)
  ✅ Diseño aprobado (3 pantallas, stack: React + Node.js + SQLite)
  🔄 Generando spec...
  ⭕ Plan pendiente
  ⭕ Tareas pendientes
  ⭕ Implementación pendiente
═══════════════════════════════════════
```

Actualizar `.sdd/estado.json` después de cada paso:

```bash
node -e "
  const fs = require('fs');
  const e = JSON.parse(fs.readFileSync('.sdd/estado.json', 'utf8') || '{}');
  e.pipeline_step = 'spec'; // o 'plan', 'tasks', 'code', 'done'
  e.ultima_actualizacion = new Date().toISOString();
  fs.writeFileSync('.sdd/estado.json', JSON.stringify(e, null, 2));
"
```

---

## Al terminar

```
═══════════════════════════════════════════
✅ PROYECTO CONSTRUIDO
═══════════════════════════════════════════

[product.name] está listo.

Lo que se generó:
  ✅ IR → .sdd/ir.json
  ✅ Diseño → .sdd/product-design.json
  ✅ Wireframe → .sdd/diseño/wireframe-pantalla-principal.html
  ✅ Spec → .sdd/[spec].md
  ✅ Plan → .sdd/[plan].md
  ✅ Tareas → .sdd/[tareas].md
  ✅ Código base → [carpeta del proyecto]

¿Qué sigue?
  /sdd.implementar     → implementar las tareas pendientes
  /sdd.exportar        → empaquetar para compartir o desplegar
  /sdd.estado          → ver el estado completo del proyecto
```

---

## Manejo de errores

Si un paso falla:

```
⚠️ El paso [nombre] encontró un problema:
  [descripción del error]

Opciones:
  r → reintentar el paso
  s → saltar y continuar
  i → inspeccionar manualmente
  q → salir (el progreso está guardado)
```

El estado guardado en `estado.json` permite retomar donde se quedó.
