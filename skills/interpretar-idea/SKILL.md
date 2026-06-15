---
description: Convierte una idea en texto libre a un IR (Interpreted Requirement) JSON validado. Trabaja en 2 fases - razonamiento libre + extracción JSON. Lee .sdd/descubrimiento.md si existe.
model: opus
allowed-tools: Read, Write
---

# Skill: Interpretar Idea → IR

## Propósito

Tomar la idea del usuario (más el contexto de discovery si existe) y convertirla en un **IR JSON válido** que alimente el pipeline FORGE. Sin que el usuario tenga que pensar en estructura, campos, o intención.

---

## Contexto que debes leer primero

Antes de empezar, lee:

```bash
cat .sdd/descubrimiento.md 2>/dev/null || echo "SIN_DISCOVERY"
```

Si existe `descubrimiento.md`, úsalo como contexto adicional para enriquecer el IR.

---

## Flujo en 2 fases

### FASE A — Razonamiento libre (sin JSON)

Analiza la idea en prosa libre. **No generes JSON todavía.** Solo piensa:

```
Analizando: "[idea del usuario]"
Contexto de discovery: [resumen de descubrimiento.md si existe]

ANÁLISIS:
- Tipo de producto: [web app / mobile / api / cli / saas / other]
- Usuarios principales: [quién lo usa]
- Problema que resuelve: [qué dolor alivia]
- Features core (los más críticos para V1): [lista priorizada]
- Features secundarios (futuro): [lista]
- Restricciones evidentes: [técnicas, de negocio, de tiempo]
- Ambigüedades detectadas: [qué no está claro]
- Asunciones que haré: [cómo resuelvo las ambigüedades]
- Confianza estimada: [0.0–1.0] por qué
```

Sé honesto con la confianza. Una idea vaga tiene confidence 0.5–0.65. Una idea clara tiene 0.8–0.9. Nunca 1.0.

### FASE B — Extracción a IR JSON

Solo después del análisis, extrae el IR JSON:

```json
{
  "id": "ir-[slug-del-producto]-001",
  "created_at": "[ISO timestamp]",
  "raw_input": "[idea literal del usuario]",
  "confidence": [0.0–1.0],

  "product": {
    "name": "[Nombre descriptivo del producto]",
    "type": "[saas|mobile|web|api|cli|other]",
    "tagline": "[Una línea que describe el valor en <10 palabras]",
    "value_proposition": "[Por qué existe este producto, en 1 oración]",
    "target_users": "[Quién lo usa, en lenguaje natural]"
  },

  "features": {
    "core": [
      "[Feature 1 — lo más esencial del MVP]",
      "[Feature 2]",
      "[Feature 3]",
      "[Feature 4 si aplica]",
      "[Feature 5 si aplica — máximo 5]"
    ],
    "nice_to_have": [
      "[Feature futuro 1]",
      "[Feature futuro 2]"
    ]
  },

  "constraints": {
    "budget": "[bajo|medio|alto|ilimitado|null]",
    "timeline": "[ASAP|semanas|meses|flexible|null]",
    "team_size": "[1 persona|equipo pequeño|equipo grande|null]",
    "tech_preference": "[React|Python|Node|null — null si no mencionó]"
  },

  "assumptions": [
    "[Asunción 1 — lo que decidiste sin que el usuario lo dijera]",
    "[Asunción 2]"
  ],

  "ambiguities": [
    {
      "field": "[campo afectado]",
      "issue": "[qué no estaba claro]",
      "resolution": "[cómo lo resolviste]"
    }
  ],

  "requires_clarification": [true|false],
  "questions_for_user": [
    "[Pregunta 1 si confidence < 0.7 — máximo 1 pregunta]"
  ]
}
```

---

## Reglas de validación del IR

El IR es válido si:

- ✅ `product.type` es uno de: `saas`, `mobile`, `web`, `api`, `cli`, `other`
- ✅ `features.core` tiene **2–5 items** (no 0, no 6+)
- ✅ `confidence` está entre `0.0` y `1.0`
- ✅ `assumptions[]` es un array (puede estar vacío)
- ✅ `ambiguities[]` es un array (puede estar vacío)
- ✅ Si `confidence < 0.7` → `requires_clarification: true` y `questions_for_user` tiene **máximo 1 pregunta**

Si el IR no cumple alguna regla, corrígelo antes de guardarlo.

---

## Cuándo preguntar vs. asumir

**Asumir siempre** cuando:
- El usuario no mencionó tecnología → asumir `tech_preference: null`
- El usuario no mencionó presupuesto → asumir `budget: null`
- Es obvio por el contexto (ej: "app de citas para peluquería" → `type: web`)

**Preguntar solo cuando**:
- `confidence < 0.7` (la idea es genuinamente ambigua)
- Y solo **1 pregunta**, la más crítica para desambiguar

**Ejemplos de preguntas válidas**:
- "¿Es para tú negocio personal o para múltiples negocios?"
- "¿Los usuarios pagan por el servicio o es gratuito?"

**Ejemplos de preguntas inválidas** (nunca hacer):
- "¿Qué tecnología prefieres?" (técnico, no relevante para el IR)
- "¿Cuántas funcionalidades quieres?" (abierto, sin respuesta útil)
- "¿Tienes algún prototipo?" (fuera de scope)

---

## Output final

### Si `confidence ≥ 0.7`:

1. Muestra el IR en formato legible:

```
═══════════════════════════════════════════
🎯 TU IDEA INTERPRETADA
═══════════════════════════════════════════

Producto: [product.name]
Tipo:     [product.type en español: "aplicación web" / "app móvil" / etc.]
Para:     [target_users]

Qué hace: [value_proposition]

Features del MVP:
  ✦ [core[0]]
  ✦ [core[1]]
  ✦ [core[2]]
  [... hasta 5]

Para más adelante:
  · [nice_to_have[0] si existe]

Confianza: [██████████░░] [confidence*100]%

Asunciones que hice:
  → [assumption[0]]
  → [assumption[1] si existe]

[Si hay ambiguities:]
Preguntas resueltas:
  ✓ [ambiguity[0].issue] → [ambiguity[0].resolution]

═══════════════════════════════════════════
¿Es esto lo que querías?
  Escribe "sí" para continuar al diseño
  Escribe "no, cambia [qué]" para corregir
═══════════════════════════════════════════
```

2. Guarda en `.sdd/ir.json` (solo tras confirmación del usuario)
3. Guarda el análisis de Fase A en `.sdd/ir-analysis.md`

### Si `confidence < 0.7`:

1. Muestra la pregunta de clarificación antes de continuar:

```
Antes de continuar, necesito una aclaración:

[questions_for_user[0]]
```

2. Espera la respuesta
3. Incorpora la respuesta al análisis
4. Re-genera el IR con la nueva información
5. Ahora confidence debería ser ≥ 0.7 → muestra el IR y pide confirmación

---

## Guardar archivos

### `.sdd/ir.json`
El IR JSON completo. Se guarda solo después de que el usuario confirme.

### `.sdd/ir-analysis.md`
El análisis de Fase A. Se guarda siempre (útil para auditoría).

```markdown
# IR Analysis — [product.name]

**Fecha**: [timestamp]
**Idea original**: [raw_input]

## Análisis libre (Fase A)

[Texto completo del análisis en prosa]

## IR generado (Fase B)

```json
[IR JSON completo]
```

## Validación

- confidence: [valor]
- requires_clarification: [true/false]
- errores de validación: [lista o "ninguno"]
```

---

## Casos de prueba esperados

| Idea | Confidence esperado | requires_clarification |
|------|---------------------|----------------------|
| "App para dentistas que gestionen citas" | 0.82–0.88 | false |
| "Quiero algo para mis pedidos" | 0.55–0.65 | true |
| "Plataforma de e-commerce con pagos, inventario y envíos" | 0.80–0.88 | false |
| "No sé bien, algo para organizar cosas" | 0.40–0.55 | true |
| "API REST para un sistema de autenticación con JWT y refresh tokens" | 0.88–0.95 | false |
