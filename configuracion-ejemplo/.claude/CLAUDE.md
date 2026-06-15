# Proyecto SDD — Instrucciones para Claude Code

Este proyecto usa el flujo **SDD-ES** (Spec-Driven Development).
El estado vive en `.sdd/` y se sincroniza con cada comando `/sdd.*`.

## Recuperación de contexto al inicio

Al comenzar cada sesión, antes de pedir nada al usuario:

1. Si existe `.sdd/estado.json`, cárgalo y léelo.
2. Muestra un resumen breve (máx. 3 líneas) con la fase actual, feature activa y tareas pendientes.
3. Si no existe, sugiere escribir `/sdd` para empezar.

Ejemplo de resumen:
```
Estás en: implementar · feature activa: login con email · 3 pasos pendientes.
```

## Reglas del proyecto

@.sdd/memoria/constitucion.md
@.sdd/memoria/reglas-proyecto.md

- No edites `.sdd/estado.json` manualmente; los comandos `/sdd.*` lo gestionan.
- Respeta la spec activa: no implementes fuera de ella sin avisar.
- La memoria de cada agente vive en `.sdd/memoria/agente-{nombre}.md`.

## Hooks activos

| Hook | Archivo | Cuándo se ejecuta |
|------|---------|-------------------|
| PreToolUse | `claude-hooks/pre-tool-guard.js` | Antes de cada comando Bash/PowerShell |
| PostToolUse | `claude-hooks/agent-memory.js` | Al finalizar cada herramienta (guarda memoria de agentes) |

Los hooks bloquean operaciones destructivas y protegen secretos automáticamente.
No es necesario configurarlos — ya están activos.

## Convención de commits

Formato: `[LAYER] ACTION: descripción breve`

| Capa | Cuándo usarla |
|------|---------------|
| `[SPEC]` | Cambios en especificaciones o plan |
| `[IMPL]` | Código de implementación |
| `[TEST]` | Tests nuevos o modificados |
| `[INFRA]` | Configuración, CI, dependencias |
| `[DOCS]` | Documentación |

Ejemplos:
```
[IMPL] ADD: login con magic link
[TEST] FIX: corrige test flaky de autenticación
[SPEC] UPDATE: aclara criterios de aceptación del módulo de pagos
```

## Comandos clave

- `/sdd` — punto de entrada: detecta contexto y te guía al siguiente paso.
- `/sdd.especificar` — define o refina una feature.
- `/sdd.implementar` — ejecuta las tareas de la feature activa.
- `/sdd.comprimir aplicar` — reduce el contexto en sesiones largas.
- `/mejorar-prompt "texto"` — transforma un prompt vago en versión profesional.

---

## Metodología de prompts

Antes de ejecutar cualquier instrucción del usuario que modifique archivos o inicie
una tarea nueva, comprueba que la petición tiene al menos **3 de los 5 componentes**
de un prompt profesional:

| Componente | Descripción | Señal de que falta |
|---|---|---|
| **Contexto** | Qué proyecto/stack/estado existe ya | El usuario no menciona el proyecto |
| **Tarea** | Qué hay que hacer exactamente | La instrucción es de 1-2 palabras |
| **Restricciones** | Qué no tocar, qué no instalar | No se especifica qué preservar |
| **Formato** | Cómo quiere el resultado | No aplica a todos los casos |
| **Verificación** | Cómo confirmar que funcionó | No hay criterio de éxito |

Si el prompt tiene **menos de 3 componentes**, responde así:

1. El componente más crítico que falta (solo uno, no todos).
2. Una pregunta concreta para obtenerlo.
3. Un ejemplo de cómo quedaría el prompt con ese componente añadido.

**No inicies la implementación sin la respuesta.**

Ejemplo de respuesta cuando falta contexto:
> "Para implementar esto con precisión necesito saber: ¿qué stack usa el proyecto
> (Express, FastAPI, Rails...)? Por ejemplo: *'Contexto: Express + TypeScript, ya tiene
> autenticación JWT, falta el módulo de perfiles de usuario.'*"

---

## Guardia de spec activa

Si existe `.sdd/estado.json` y el usuario pide algo que **no está en el alcance de la
feature activa**, advierte antes de proceder:

> "⚠️ Esto parece estar fuera de la spec activa (**{feature}**, fase: **{fase}**).
> ¿Quieres abrir una spec nueva con `/sdd.especificar`, o confirmas que esto sí
> forma parte de esta feature?"

**No ejecutes sin confirmación explícita.** La spec activa es la fuente de verdad del
alcance; salir de ella sin avisar introduce deuda técnica invisible.
