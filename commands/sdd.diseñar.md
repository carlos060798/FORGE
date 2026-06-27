---
description: Fase de diseño de FORGE. Orquesta direction picker → product-designer → architecture-designer → wireframe-mvp → critica-diseno. Requiere IR previo en .sdd/ir.json.
allowed-tools: Read, Write, Bash, Agent
---

# /sdd.diseñar — Diseño de Producto

**Uso:**
```
/sdd.diseñar
/sdd.diseñar confirmar
/sdd.diseñar cambiar-direccion
/sdd.diseñar --sin-critica
```

---

## PASO 1 — Verificar IR

```bash
if [ ! -f ".sdd/ir.json" ]; then
  echo "No hay IR todavía. Primero interpreta tu idea:"
  echo "  /sdd.interpretar [tu idea]"
  exit 0
fi

cat .sdd/ir.json | node -e "
  const ir = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
  console.log('Producto:', ir.product.name);
  console.log('Tipo:', ir.product.type);
"

# Routing condicional por confidence del IR
CONFIDENCE=$(node -e "try{const ir=JSON.parse(require('fs').readFileSync('.sdd/ir.json','utf8'));console.log(ir.confidence??'0')}catch{console.log('0')}" 2>/dev/null || echo "0")
if awk "BEGIN {exit !($CONFIDENCE < 0.7)}"; then
  echo "⚠️  Confianza baja en el IR (confidence=$CONFIDENCE < 0.7)."
  echo ""
  echo "Antes de diseñar necesito aclararte algunas ambigüedades del IR:"
  node -e "
    try {
      const ir = JSON.parse(require('fs').readFileSync('.sdd/ir.json','utf8'));
      const ambig = ir.ambiguities ?? [];
      const qfu   = ir.questions_for_user ?? [];
      const puntos = [...ambig, ...qfu].slice(0, 5);
      if (puntos.length > 0) {
        puntos.forEach((p, i) => console.log('  ' + (i+1) + '. ' + p));
      } else {
        console.log('  (El IR no especifica ambigüedades — revisa raw_input)');
      }
    } catch(e) { console.log('  (No se pudo leer el IR)'); }
  " 2>/dev/null
  echo ""
  echo "Por favor responde estas preguntas y luego vuelve a ejecutar /sdd.diseñar"
  echo "O si quieres continuar de todas formas: /sdd.diseñar --forzar"
  # Salir aquí si no se pasó --forzar
  if [[ "$*" != *"--forzar"* ]]; then
    exit 0
  fi
  echo "Continuando con --forzar a pesar de la confianza baja..."
elif awk "BEGIN {exit !($CONFIDENCE >= 0.85)}"; then
  echo "✅ Confianza alta ($CONFIDENCE). Avanzo directo al diseño sin preguntas adicionales."
else
  echo "ℹ️  Confianza media ($CONFIDENCE). Diseñaré con las asunciones actuales del IR."
fi
```

Si ya hay un `product-design.json`, pregunta:

```
Ya tienes un diseño para [product.name].
¿Qué quieres hacer?
  1) Ver el diseño actual → /sdd.diseñar ver
  2) Rediseñar (conservar el IR) → /sdd.diseñar rediseñar
  3) Continuar al código → /sdd.construir
```

---

## PASO 2 — Direction Picker

Si no hay `design_direction` en `.sdd/estado.json`, invocar la skill `elegir-direccion`:

La skill muestra 3 opciones visuales y espera la elección del usuario.

Después de elegida, guarda en `.sdd/estado.json`:
```json
{ "design_direction": "[direction]", "design_system_path": "{PLUGIN_DIR}/design-systems/[direction]/DESIGN.md" }
```

Si ya hay dirección elegida, saltarla (a menos que sea `cambiar-direccion`).

---

## PASO 3 — Invocar Product Designer

Activa el agente `product-designer`.

El agente:
1. Lee `.sdd/ir.json`
2. Lee `.sdd/estado.json` (dirección y DESIGN.md)
3. Lee `{PLUGIN_DIR}/craft/anti-ai-slop.md`
4. Genera el `ProductDesign` JSON
5. Muestra resumen al usuario
6. Guarda en `.sdd/product-design.json`

---

## PASO 4 — Invocar Architecture Designer

Activa el agente `architecture-designer`.

El agente:
1. Lee `.sdd/ir.json` + `.sdd/product-design.json`
2. Propone el stack más simple viable
3. Muestra resumen en lenguaje natural
4. Agrega el campo `architecture` a `.sdd/product-design.json`

---

## PASO 5 — Generar Wireframe (pantalla P0)

Invocar la skill `wireframe-mvp`.

La skill:
1. Lee `.sdd/product-design.json` (pantalla P0)
2. Lee el DESIGN.md activo
3. Lee `{PLUGIN_DIR}/craft/anti-ai-slop.md`
4. Genera el HTML de la pantalla P0
5. Guarda en `.sdd/diseño/wireframe-pantalla-principal.html` con la tool `Write`
6. Abre el archivo en el navegador del sistema (`start`/`open`/`xdg-open`)

Si se pasa `--sin-critica`, saltar el PASO 6.

---

## PASO 6 — Crítica y Refinamiento

Invocar la skill `critica-diseno`.

La skill:
1. Lee el wireframe generado
2. Evalúa en 5 dimensiones (score 1–5 cada una)
3. Si score < 4 y iteraciones < 3: refina el wireframe y re-evalúa
4. Si score ≥ 4: aprueba y termina
5. Muestra el resultado de la crítica al usuario

---

## PASO 7 — Confirmar y guardar

Muestra resumen final del diseño:

```
═══════════════════════════════════════════
✅ DISEÑO COMPLETADO
═══════════════════════════════════════════

Producto: [product.name]
Dirección visual: [design_direction]
Pantallas: [N] pantallas ([nombres P0, P1, P2])
Stack: [frontend] + [backend] + [database]
Wireframe: .sdd/diseño/wireframe-pantalla-principal.html
Score del diseño: [X]/5

¿Listo para generar el código?
  /sdd.construir     → Pipeline completo automático
  /sdd.diseñar ver   → Ver el diseño en detalle
```

Actualizar `.sdd/estado.json`:

```bash
node -e "
  const fs = require('fs');
  const estado = JSON.parse(fs.readFileSync('.sdd/estado.json', 'utf8') || '{}');
  estado.product_design_aprobado = true;
  estado.ultima_actualizacion = new Date().toISOString();
  // artefactos_sesion — stack_decidido (A6)
  if (!estado.artefactos_sesion) estado.artefactos_sesion = {};
  try {
    const pd = JSON.parse(fs.readFileSync('.sdd/product-design.json', 'utf8'));
    estado.artefactos_sesion.stack_decidido = pd.stack?.summary ?? pd.architecture?.stack ?? null;
  } catch {}
  fs.writeFileSync('.sdd/estado.json', JSON.stringify(estado, null, 2));
"
```

---

## Sub-comandos

### `/sdd.diseñar ver`
Muestra el ProductDesign actual en formato legible (pantallas, stack, wireframe path).

### `/sdd.diseñar confirmar`
Si el diseño ya fue generado pero esperaba confirmación explícita, lo confirma y continúa.

### `/sdd.diseñar cambiar-direccion`
Vuelve al PASO 2 (direction picker) sin borrar el IR. Regenera todo lo demás.

### `/sdd.diseñar rediseñar`
Borra el ProductDesign actual y vuelve a empezar desde el PASO 2, conservando el IR.

---

## Archivos generados

```
.sdd/
  product-design.json              ← ProductDesign + ArchitectureDesign
  estado.json                      ← product_design_aprobado: true
  diseño/
    wireframe-pantalla-principal.html  ← Wireframe de P0
    critica-wireframe.md               ← Resultado de la crítica
```

---

## Integración con el pipeline

Después de `/sdd.diseñar`:

```
/sdd.construir   → Pipeline completo: spec + plan + tareas + código
/sdd.exportar    → Exportar bundle del proyecto
/sdd.estado      → Ver estado del proyecto
```

---

## SIGUIENTE PASO SUGERIDO

✅ Diseño completado y aprobado.

¿Continúo con `/sdd.especificar`?
- **`sí`** → genero la especificación técnica automáticamente
- **`no`** → me detengo para que revises el diseño primero
- **`[instrucción]`** → ajusto el diseño antes de especificar
