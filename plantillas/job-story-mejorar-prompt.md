---
id: JS-PROMPT-001
tipo: job-story
estado: aprobada
fecha: 2026-06-14
versión: 1.0.0
autor: SDD-ES
---

# Job Story — Mejorar Prompts con Claude Code

## Historia principal

**Cuando** estoy a punto de pedirle algo a Claude Code y no sé cómo formularlo con precisión,
**quiero** una guía que transforme mi intención vaga en un prompt profesional paso a paso,
**para** obtener resultados predecibles, manteniendo el trabajo dentro del plan de la spec activa.

---

## Contexto del problema

Un prompt vago produce resultados impredecibles porque Claude toma decisiones discrecionales
sobre el alcance, el enfoque y las dependencias. El mismo prompt puede generar desde un
try-catch de 3 líneas hasta un sistema de logging con Winston, rotación de archivos y niveles
de severidad — dependiendo del momento y el contexto de la sesión.

La diferencia entre un resultado útil y uno que hay que descartar no está en Claude Code,
está en la calidad de las instrucciones. Esta job story captura la necesidad de cerrar esa
brecha de forma sistemática, sin depender de la experiencia del usuario.

---

## Criterios de Aceptación

- **CA-001:** dado un prompt vago de 1-2 frases, la skill produce una versión profesional
  con los 5 componentes (Contexto, Tarea, Restricciones, Formato, Verificación) cuando aplican
- **CA-002:** la versión mejorada incluye siempre una restricción explícita sobre el alcance
  de la spec activa (`No salgas de lo definido en .sdd/especificaciones/`)
- **CA-003:** si el prompt solicita algo fuera de la fase o feature actual (según
  `.sdd/estado.json`), la skill lo detecta y advierte antes de reescribir
- **CA-004:** el output muestra la justificación de cada componente añadido, no solo el
  prompt mejorado
- **CA-005:** la skill se puede invocar con `/mejorar-prompt "texto del prompt vago"`
- **CA-006:** si el prompt ya es profesional (tiene ≥4 de los 5 componentes), la skill lo
  confirma y no reescribe innecesariamente

---

## Escenarios BDD

### Escenario 1 — Prompt de implementación vago

```
Dado:  el usuario escribe "añade autenticación"
Cuando: invoca /mejorar-prompt "añade autenticación"
Entonces: obtiene una versión profesional con:
  - Contexto del stack actual (Express + TypeScript, endpoints existentes)
  - Tarea acotada (qué tipo de autenticación, qué endpoints proteger)
  - Restricciones (no romper endpoints existentes, no instalar dependencias no aprobadas)
  - Verificación con tests que cubran el happy path y el rechazo de tokens inválidos
Y: cada componente va acompañado de una línea explicando por qué se añadió
```

### Escenario 2 — Prompt fuera de spec

```
Dado:  la spec activa en .sdd/estado.json es "login con email"
  Y:   el usuario escribe "añade un sistema de pagos con Stripe"
Cuando: invoca /mejorar-prompt
Entonces: la skill emite una advertencia:
  "⚠️ 'pagos con Stripe' parece estar fuera de la spec activa (login con email).
   Para continuar tienes dos opciones:
   1. Escribe /sdd.especificar para abrir una nueva spec de pagos
   2. Confirma que este cambio sí forma parte de la feature actual"
Y: no reescribe el prompt hasta recibir confirmación
```

### Escenario 3 — Prompt de debug vago

```
Dado:  el usuario escribe "no funciona el login"
Cuando: invoca /mejorar-prompt
Entonces: la skill detecta el patrón "depurar problema" y produce:
  - Contexto: qué estaba haciendo cuando falló
  - Tarea: el error exacto (pegar stack trace) y el archivo/línea
  - Formato: "antes de corregir: (1) causa raíz (2) por qué ocurre (3) fix propuesto"
  - Verificación: test que reproduce el bug antes del fix y pasa después
```

### Escenario 4 — Prompt ya profesional

```
Dado:  el usuario escribe un prompt con contexto, tarea, restricciones y verificación
Cuando: invoca /mejorar-prompt
Entonces: la skill responde "Este prompt ya tiene 4/5 componentes. Está bien estructurado."
  Y opcionalmente sugiere el único componente que falta (si hay alguno)
  Y no reescribe el prompt
```

---

## Notas de implementación

- La skill vive en `skills/mejorar-prompt/SKILL.md`
- El agente que la ejecuta es `sonnet` (balance razonamiento / coste)
- Lee `.sdd/estado.json` antes de reescribir para detectar el scope de la spec activa
- Los 7 patrones de referencia están documentados en `docs-site/` bajo la sección Prompts
