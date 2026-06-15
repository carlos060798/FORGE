---
description: Discovery form de 5 preguntas para entender la idea del usuario antes de interpretar. Genera contexto estructurado que alimenta el Interpreter.
model: opus
allowed-tools: Write
---

# Skill: Descubrir Idea

## Propósito

Antes de generar ningún IR, necesitamos entender el contexto de la idea. Esta skill hace **5 preguntas clave** en lenguaje natural — sin jerga técnica — y guarda las respuestas en `.sdd/descubrimiento.md`.

El objetivo no es un interrogatorio. Es una conversación breve (2–3 minutos) que permite al Interpreter generar un IR con confidence ≥ 0.8 en lugar de ≤ 0.6.

---

## Flujo

### Paso 1: Presentación

Antes de las preguntas, muestra esto:

```
Antes de entender tu idea en detalle, tengo 5 preguntas rápidas.
No hay respuestas correctas — contesta lo que se te ocurra.
```

### Paso 2: Las 5 preguntas (una a la vez)

Haz cada pregunta de forma conversacional. Espera la respuesta antes de hacer la siguiente.

**Pregunta 1 — Superficie**
```
¿Dónde va a vivir esto?
Por ejemplo: en un navegador web, en el celular, como programa de escritorio, o es algo más técnico (una API, una herramienta de línea de comandos)?
```
Acepta respuestas vagas: "web", "móvil", "app", "no sé" — todas son válidas.

**Pregunta 2 — Audiencia**
```
¿Quién lo va a usar?
Puede ser tú mismo, tus clientes, tu equipo, o el público en general.
```
No pidas detalles. Cualquier respuesta sirve.

**Pregunta 3 — Tono**
```
¿Qué sensación quieres que tenga?
Por ejemplo: profesional y sobrio, moderno y tecnológico, cálido y amigable, simple y directo...
```
Si el usuario no sabe, anota "no definido".

**Pregunta 4 — Restricciones**
```
¿Hay algo importante que debamos tener en cuenta?
Por ejemplo: presupuesto ajustado, necesita estar listo pronto, solo un desarrollador, no quieres depender de servicios de pago...
```
Si no hay restricciones, registra "ninguna mencionada".

**Pregunta 5 — Inspiración**
```
¿Hay algún producto o app que te guste y que se parezca a lo que quieres hacer?
No tiene que ser exactamente igual — solo para entender el estilo o la dirección.
```
Si el usuario no tiene referencia, anota "sin referencia".

### Paso 3: Guardar contexto

Después de las 5 respuestas, guarda en `.sdd/descubrimiento.md`:

```markdown
# Contexto de Descubrimiento

**Fecha**: [fecha actual]
**Idea original**: [texto que dio el usuario antes de la skill]

## Respuestas

**Superficie**: [respuesta 1]
**Audiencia**: [respuesta 2]
**Tono**: [respuesta 3]
**Restricciones**: [respuesta 4]
**Inspiración**: [respuesta 5]

## Notas del sistema

[Cualquier observación relevante: contradicciones, pistas, contexto adicional]
```

### Paso 4: Confirmar y pasar al Interpreter

Muestra un resumen de una línea:
```
Entendido. Voy a interpretar tu idea teniendo esto en cuenta.
```

No pidas confirmación — pasa directo al Interpreter.

---

## Reglas

- **Una pregunta a la vez** — nunca hagas 2 preguntas en el mismo mensaje
- **Sin jerga técnica** — nunca uses "frontend", "backend", "API REST", "deployment", etc.
- **Sin juzgar** — cualquier respuesta es válida, incluso "no sé"
- **Máximo 5 preguntas** — nunca hagas preguntas de seguimiento
- **Tono conversacional** — no formal, no robótico

---

## Ejemplos de respuestas aceptables

**Pregunta 1 - Superficie:**
- ✅ "web" → `web`
- ✅ "en el celular" → `mobile`
- ✅ "no sé, lo que sea más fácil" → `web` (default)
- ✅ "quiero que se use desde el navegador" → `web`

**Pregunta 2 - Audiencia:**
- ✅ "mis clientes" → `clientes del negocio`
- ✅ "yo solo" → `uso personal`
- ✅ "cualquier persona" → `público general`

**Pregunta 3 - Tono:**
- ✅ "profesional" → `profesional`
- ✅ "no sé, que se vea bien" → `moderno y limpio`
- ✅ "como Airbnb" → `cálido, accesible`

---

## Output esperado

`.sdd/descubrimiento.md` con las 5 respuestas estructuradas, listo para que `interpretar-idea` lo lea como contexto adicional.
