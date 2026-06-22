---
description: Punto de entrada de FORGE. Convierte una idea en texto libre a un IR JSON validado. Orquesta discovery + interpreter + validación. Primer comando para cualquier proyecto nuevo.
allowed-tools: Read, Write, Bash
---

# /sdd.interpretar — Entrada a FORGE

**Uso:**
```
/sdd.interpretar [idea en texto libre]
```

**Ejemplos:**
```
/sdd.interpretar Quiero una app para que mis clientes reserven citas
/sdd.interpretar Necesito algo para organizar los pedidos de mi restaurante
/sdd.interpretar Plataforma de cursos online con pagos y certificados
/sdd.interpretar confirmar
/sdd.interpretar corregir "es para múltiples negocios, no solo uno"
```

---

## PASO 1 — Detectar modo de invocación

```bash
ARGS="$*"
```

Detecta el caso:

| Argumento | Modo |
|-----------|------|
| `confirmar` o `sí` | Confirmar IR pendiente → guardar |
| `corregir [qué]` | Corregir campo del IR pendiente |
| `ver` | Mostrar IR actual en `.sdd/ir.json` |
| `[texto libre]` | Nueva idea → flujo completo |
| *(vacío)* | Pedir que escriba su idea |

---

## PASO 2 — Si es texto libre: flujo completo

### 2.1 — Verificar si hay IR anterior

```bash
if [ -f ".sdd/ir.json" ]; then
  echo "HAY_IR_ANTERIOR"
  cat .sdd/ir.json | grep '"name"' | head -1
fi
```

Si hay IR anterior, pregunta:
```
Ya tienes un proyecto en curso: [product.name]

¿Qué quieres hacer?
  1) Continuar con ese proyecto → escribe /sdd.diseñar
  2) Actualizar la idea de ese proyecto → escribe /sdd.interpretar corregir [qué]
  3) Empezar un proyecto nuevo → escribe /sdd.interpretar nuevo [idea]
```

Si no hay IR anterior, continúa.

### 2.2 — Crear carpeta .sdd/

```bash
mkdir -p .sdd
```

### 2.3 — Invocar skill `descubrir-idea`

Activa la skill de discovery. La skill hace las 5 preguntas y guarda `.sdd/descubrimiento.md`.

Después de que el usuario responda las 5 preguntas, continúa al paso 2.4.

### 2.4 — Invocar skill `interpretar-idea`

Activa la skill con la idea original del usuario + contexto de `.sdd/descubrimiento.md`.

La skill genera el IR JSON en 2 fases (razonamiento libre + extracción JSON) y lo muestra al usuario.

**Si la skill requiere clarificación** (`confidence < 0.7`): el usuario responde la pregunta, y la skill re-genera el IR. Luego continúa.

---

## PASO 3 — Si es `confirmar` o `sí`

```bash
# Verificar que hay un IR pendiente de confirmar
if [ ! -f ".sdd/ir-pendiente.json" ] && [ ! -f ".sdd/ir.json" ]; then
  echo "No hay ningún IR pendiente. Escribe tu idea primero:"
  echo "  /sdd.interpretar [tu idea]"
  exit 0
fi
```

Guarda el IR:

```bash
cp .sdd/ir-pendiente.json .sdd/ir.json 2>/dev/null || true
```

Actualiza `.sdd/estado.json`:

```bash
# Leer estado actual o crear si no existe
if [ -f ".sdd/estado.json" ]; then
  # Agregar campo ir_generado: true
  node -e "
    const fs = require('fs');
    const estado = JSON.parse(fs.readFileSync('.sdd/estado.json', 'utf8'));
    const ir = JSON.parse(fs.readFileSync('.sdd/ir.json', 'utf8'));
    estado.ir_generado = true;
    estado.ir_id = ir.id;
    estado.ultima_actualizacion = new Date().toISOString();
    // artefactos_sesion (A6)
    if (!estado.artefactos_sesion) estado.artefactos_sesion = {};
    estado.artefactos_sesion.ir_confidence = ir.confidence ?? null;
    estado.artefactos_sesion.complejidad_estimada = ir.complexity ?? null;
    fs.writeFileSync('.sdd/estado.json', JSON.stringify(estado, null, 2));
  " 2>/dev/null || echo "{ \"ir_generado\": true, \"ultima_actualizacion\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\" }" > .sdd/estado.json
fi
```

Muestra confirmación y siguiente paso:

```
✅ IR guardado en .sdd/ir.json

Siguiente paso → Diseño de pantallas y arquitectura:
  /sdd.diseñar

O si quieres ir directo al código (diseño automático):
  /sdd.construir
```

---

## PASO 4 — Si es `corregir [qué]`

Extrae la corrección del argumento. Por ejemplo:
- `/sdd.interpretar corregir "es para múltiples negocios"` → actualizar `product.target_users` y/o `assumptions`

Lee el IR actual:

```bash
cat .sdd/ir.json 2>/dev/null || cat .sdd/ir-pendiente.json 2>/dev/null
```

Aplica la corrección al campo correspondiente del IR. Re-valida. Muestra el IR actualizado y pide confirmación de nuevo.

---

## PASO 5 — Si es `ver`

```bash
cat .sdd/ir.json 2>/dev/null || echo "No hay IR guardado todavía."
```

Muestra el IR en formato legible (igual que la skill `interpretar-idea`).

---

## PASO 6 — Si argumento vacío

```
¿Cuál es tu idea?

Cuéntamela en una frase o párrafo. No te preocupes por el formato.

Ejemplos:
  /sdd.interpretar Quiero una app para gestionar turnos de mi peluquería
  /sdd.interpretar Sistema para que mis empleados registren sus horas de trabajo
  /sdd.interpretar Marketplace de servicios para freelancers
```

---

## Estructura de archivos generados

```
.sdd/
  descubrimiento.md      ← Respuestas del discovery (5 preguntas)
  ir-analysis.md         ← Análisis libre de la Fase A del Interpreter
  ir-pendiente.json      ← IR generado, esperando confirmación del usuario
  ir.json                ← IR confirmado (se crea solo tras "confirmar")
  estado.json            ← Estado global del proyecto (ir_generado: true)
```

---

## Integración con el pipeline

Después de `/sdd.interpretar confirmar`:

```
/sdd.diseñar     → Diseña pantallas, elige dirección visual, genera wireframe
/sdd.construir   → Pipeline completo: diseño + spec + plan + tareas + código
/sdd.estado      → Ver estado actual del proyecto
```

---

## Opciones avanzadas

### Modo silencioso (sin discovery)

Si el usuario ya dio suficiente contexto en la idea:

```
/sdd.interpretar --rapido [idea detallada]
```

Salta el discovery y va directo al Interpreter.

### Actualizar proyecto existente

```
/sdd.interpretar actualizar "quiero agregar pagos en línea"
```

1. Lee IR actual
2. Interpreta el cambio
3. Fusiona (agrega feature, actualiza assumptions)
4. Re-valida y pide confirmación

### Nuevo proyecto (ignorar IR anterior)

```
/sdd.interpretar nuevo [idea]
```

Archiva el IR anterior en `.sdd/ir-anterior-[timestamp].json` y empieza desde cero.

---

## Notas de implementación

- Este comando es el **único punto de entrada** para usuarios no técnicos
- El IR es la **fuente de verdad** del proyecto — todo lo demás se deriva de él
- La skill `descubrir-idea` y la skill `interpretar-idea` son los módulos reales — este comando las orquesta
- Si el usuario dice "sí" o "confirmar" en cualquier momento durante el flujo, se guarda el IR actual
- El modelo **nunca inventa** datos del usuario — todo en `assumptions[]` debe ser explícito
