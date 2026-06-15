---
description: Transforma un prompt vago en versión profesional siguiendo los 7 patrones
  de Claude Code (Contexto · Tarea · Restricciones · Formato · Verificación). Detecta
  si el prompt solicita algo fuera de la spec activa y advierte antes de continuar.
model: sonnet
allowed-tools: Read, Bash
---

# Skill: Mejorar Prompt

## Propósito

Un prompt vago produce resultados impredecibles. Claude Code toma decisiones discrecionales
sobre alcance, enfoque y dependencias cuando las instrucciones son ambiguas. Esta skill
cierra esa brecha: toma la intención del usuario y la convierte en un prompt profesional
con los componentes necesarios para obtener resultados predecibles y dentro de la spec activa.

---

## Lo que lees primero

Antes de reescribir el prompt, lee el estado del proyecto:

```bash
# Fase y feature activa
cat .sdd/estado.json 2>/dev/null || echo "SIN_ESTADO"

# Spec activa (si existe estado)
SPEC_ID=$(cat .sdd/estado.json 2>/dev/null | grep -o '"spec_activa":"[^"]*"' | cut -d'"' -f4)
[ -n "$SPEC_ID" ] && cat ".sdd/especificaciones/${SPEC_ID}/spec.md" 2>/dev/null | head -40
```

Si no existe `.sdd/estado.json`: continúa sin validación de scope. No inventes un estado.

---

## Los 7 patrones

Identifica cuál de estos patrones aplica al prompt del usuario antes de reescribirlo:

| # | Patrón | Cuándo aplica |
|---|--------|---------------|
| 1 | **Implementar feature** | "añade X", "crea Y", "implementa Z" |
| 2 | **Depurar problema** | "no funciona", "hay un error", "falla cuando" |
| 3 | **Refactorizar** | "reorganiza", "limpia", "extrae", "mejora la estructura" |
| 4 | **Explorar proyecto** | "explícame", "cómo funciona", "qué hace", "analiza" |
| 5 | **Escribir tests** | "testea", "añade pruebas", "cobertura" |
| 6 | **Documentar** | "documenta", "escribe el README", "añade JSDoc" |
| 7 | **Pedir justificación** | "por qué hiciste", "qué alternativas", "justifica" |

---

## Flujo de mejora

### PASO 1 — Clasifica el prompt

Lee el prompt del usuario. Identifica:
- El **patrón** de los 7 que mejor aplica
- La **intención concreta** (qué quiere lograr, no cómo lo dice)
- Las **entidades** mencionadas (qué módulos, archivos, funciones afecta)

### PASO 2 — Verifica el scope

Si existe `.sdd/estado.json`:
- Extrae la feature activa y la fase actual
- Compara con lo que el prompt pide

**Si el prompt está FUERA del scope:**
```
⚠️ Alerta de scope: "{lo que pide}" parece estar fuera de la spec activa ("{feature}").

Opciones antes de continuar:
1. Escribe /sdd.especificar para abrir una spec nueva
2. Confirma explícitamente que esto forma parte de la feature actual

No continuaré hasta recibir confirmación.
```
Detente aquí. No reescribas el prompt.

**Si el prompt está DENTRO del scope o no hay spec activa:** continúa al PASO 3.

### PASO 3 — Evalúa el prompt actual

Cuenta cuántos de los 5 componentes ya están presentes:

| Componente | ¿Presente? |
|---|---|
| Contexto (qué proyecto/stack/estado existe ya) | sí / no |
| Tarea (qué hay que hacer exactamente, acotado) | sí / no |
| Restricciones (qué no tocar, qué no instalar) | sí / no |
| Formato (cómo quiere el resultado) | sí / no |
| Verificación (cómo confirmar que funcionó) | sí / no |

Si el prompt tiene **≥ 4 componentes**: responde "Este prompt ya está bien estructurado
(X/5 componentes). Solo falta: [el que falta]." y detente.

### PASO 4 — Construye la versión profesional

Para los componentes faltantes, infiere el contenido a partir de:
- El estado del proyecto (`.sdd/estado.json`, `package.json`, estructura de carpetas)
- Las convenciones del proyecto (naming, testing framework, estructura de módulos)
- El patrón detectado en PASO 1

Aplica el esquema del patrón correspondiente:

**Patrón 1 — Implementar feature:**
```
Contexto: [proyecto, stack, qué existe ya relevante para esta feature]

Tarea: Implementa [feature] con estos requisitos:
- [requisito concreto 1]
- [requisito concreto 2]

Restricciones:
- [qué no cambiar]
- [dependencias que no instalar]
- [patrones del proyecto a respetar]

Verificación: [tests a crear y ejecutar, o comando para comprobar]
```

**Patrón 2 — Depurar problema:**
```
Contexto: [qué estaba haciendo cuando ocurrió]

Tarea: Tengo este error:
[pegar el error completo con stack trace]
Archivo: [archivo y línea si lo sabes]

Formato: Antes de corregir nada:
1. Identifica la causa raíz, no el síntoma
2. Explica por qué ocurre
3. Propón el fix y justifícalo
4. ¿Qué más podría verse afectado?

Verificación: Añade un test que reproduzca el bug antes del fix y pase después.
```

**Patrón 3 — Refactorizar:**
```
Contexto: [qué módulo y por qué refactorizarlo]

Tarea: Refactoriza [archivo/módulo] para [objetivo concreto].

Restricciones:
- La API pública NO debe cambiar
- Los tests existentes deben seguir pasando sin modificarlos
- Sigue el patrón [patrón del proyecto]

Formato: Antes de tocar código, muéstrame qué cambiarías y por qué.

Verificación: Ejecuta todos los tests sin cambiarlos. Si alguno falla, el refactoring rompió algo.
```

**Patrón 4 — Explorar proyecto:**
```
Tarea: Analiza [proyecto/módulo] y responde:
- [pregunta sobre estructura]
- [pregunta sobre patrones]

Formato: [resumen breve por pregunta + diagrama ASCII si aplica]

Restricciones: No modifiques nada. Solo lectura.
```

**Patrón 5 — Escribir tests:**
```
Contexto: [qué módulo/servicio y qué hace]

Tarea: Genera tests para [archivo]. Para cada función pública:
- Un test del caso normal (happy path)
- Un test de caso edge [ejemplos]
- Un test de error [ejemplos]

Restricciones: [framework de testing del proyecto]

Verificación: Ejecuta los tests. Muéstrame la cobertura del archivo.
```

**Patrón 6 — Documentar:**
```
Contexto: [quién va a leer esta doc y para qué]

Tarea: Genera documentación para [archivo/módulo/API] incluyendo:
- [secciones necesarias]

Formato: [Markdown, JSDoc, README, etc.]

Verificación: Compara el resultado con el código real. Si falta algo, añádelo.
```

**Patrón 7 — Pedir justificación:**
```
Sobre [la implementación que acabas de hacer]:
1. ¿Qué alternativas consideraste y por qué elegiste esta?
2. ¿Qué trade-offs tiene tu decisión?
3. ¿Qué podría fallar con este enfoque?
4. ¿Qué harías diferente con más tiempo o a mayor escala?
```

### PASO 5 — Presenta el resultado

Muestra la respuesta completa con esta estructura:

```
## Prompt original
[lo que escribió el usuario, sin cambios]

## Patrón detectado
[nombre del patrón] — [una frase de por qué aplica este patrón]

## Prompt profesional

[versión mejorada completa, lista para copiar y pegar]

## Por qué funciona
- **Contexto:** [qué se añadió y por qué]
- **Tarea:** [cómo se acotó y por qué]
- **Restricciones:** [qué se protegió y por qué]
- **Verificación:** [cómo cierra el ciclo]
```

---

## Notas

**Prompt ya profesional:** Si el usuario envía un prompt con ≥4 componentes, confírmalo
y ofrece solo el componente que falta, sin reescribir lo demás.

**Prompt ambiguo:** Si la intención no está clara (ej. "arregla el código"), pregunta
una sola cosa antes de continuar: "¿Qué parte específica no funciona como esperabas?"

**Sin proyecto SDD:** Si no existe `.sdd/`, omite la validación de scope y el componente
de restricciones relacionado con la spec. Aún aplica los 4 componentes restantes.

**Cadena de patrones:** Cuando la tarea implica varias etapas, sugiere la cadena natural:
Explorar → Implementar → Tests → Justificar → Documentar. Un prompt por etapa.
