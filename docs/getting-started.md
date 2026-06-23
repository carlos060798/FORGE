# Inicio rápido

Esta guía te lleva de cero a un pipeline FORGE funcionando en menos de 10 minutos.

---

## Prerrequisitos

- **Node.js ≥ 18.0.0** — verificar con `node --version`
- **Claude Code** — [instrucciones de instalación](https://claude.ai/code)
- Un directorio de proyecto (existente o nuevo)

### Matriz de compatibilidad Node.js

| Versión Node.js | Soportada | Backend recomendado | Características |
|---|---|---|---|
| 16.x o anterior | ❌ No | — | FORGE requiere Node.js ≥ 18 |
| 18.x - 20.x | ✅ Sí | **Markdown** (únicamente) | SQLite no disponible |
| 21.x - 22.4 | ✅ Sí | **Markdown** (únicamente) | SQLite no disponible |
| 22.5+ | ✅ Sí | **Markdown o SQLite** | SQLite auto-detectado si está instalado |
| 23.x+ | ✅ Sí | **Markdown o SQLite** | Mismo soporte que 22.5+ |

**Notas:**
- Si especificas `backend: sqlite` en `sdd.config.yaml` pero tu Node.js es <22.5, FORGE caerá automáticamente a Markdown y registrará un warning.
- La mayoría de usuarios deberían dejar `backend: markdown` (predeterminado) a menos que explícitamente necesiten SQLite para proyectos muy grandes.

---

## Paso 1 — Instalar FORGE

Abre una terminal en la raíz de tu proyecto y ejecuta:

```bash
npx forge-sdd init
```

FORGE se instala en el directorio `.claude/` de tu proyecto:

```
tu-proyecto/
├── .claude/
│   ├── commands/        ← 39 comandos slash
│   ├── agents/          ← 14 definiciones de agentes
│   ├── skills/          ← 30 skills
│   └── hooks/           ← 3 hooks de runtime
└── .sdd/
    ├── sdd.config.yaml  ← tu configuración
    └── estado.json      ← estado del pipeline
```

### Configuración inicial: asistente guiado

Si es tu primera vez usando FORGE, usa el instalador guiado:

```bash
npx forge-sdd init --guided
```

Te hará cuatro preguntas:

```
? Perfil: guiado (no-técnico) | experto (desarrollador)
? Stack: Node.js / Python / Go / otro
? Despliegue: Vercel / Railway / Docker / ninguno
? Calidad de modelos: alta (Opus) / equilibrada (Sonnet) / bajo costo (Haiku)
```

Luego genera un `sdd.config.yaml` preconfigurado según tus respuestas.

### Instalación con preset

Para equipos que quieren un punto de partida conocido:

```bash
npx forge-sdd init --preset startup     # recomendado para la mayoría de proyectos
npx forge-sdd init --preset lean        # bajo costo, menos verificaciones de calidad
npx forge-sdd init --preset enterprise  # máxima rigurosidad
```

---

## Paso 2 — Verificar la instalación

```bash
forge doctor
```

Salida esperada:

```
✓ Hooks de Claude Code registrados (PreToolUse, PostToolUse)
✓ Sintaxis de sdd.config.yaml válida
✓ Agentes activos: 13/14
✓ estado.json presente
✓ Node 20.x (≥18 requerido)
ℹ Backend SQLite disponible (Node ≥22.5 detectado)
```

Si alguna línea muestra `✗`, ver [Solución de problemas](TROUBLESHOOTING.md).

---

## Paso 3 — Abrir Claude Code

Abre Claude Code en tu proyecto:

```bash
claude
```

O ábrelo desde VS Code / JetBrains vía la extensión de Claude Code.

---

## Paso 4 — Iniciar tu primer pipeline

Escribe `/forge` en Claude Code. Verás el hub central:

```
FORGE v4.0.0 — ¿Qué quieres construir?

Describe tu idea o elige un punto de entrada:
  /sdd.descubrir   — empezar desde una idea vaga
  /sdd.especificar — saltar directo a la spec
  /sdd.planificar  — ya tienes una spec
  /sdd.implementar — ya tienes un plan
```

### Opción A: Empezar desde una idea (recomendado)

```
/sdd.descubrir quiero construir un gestor de tareas con equipos y notificaciones
```

FORGE ejecuta el formulario de descubrimiento — cinco preguntas para extraer tu intención — luego procede automáticamente a `/sdd.interpretar` para producir `ir.json`.

### Opción B: Empezar desde una spec que ya escribiste

```
/sdd.especificar
```

FORGE lee tus requisitos existentes y los convierte en una spec estructurada con criterios de aceptación.

### Opción C: Saltar directo a la implementación

```
/sdd.implementar
```

FORGE lee `.sdd/` para encontrar la spec y el plan activos, luego despacha agentes para implementar.

---

## Paso 5 — Recorrer el pipeline

Para un proyecto nuevo que empieza desde una idea, el pipeline completo se ejecuta así:

```
/sdd.descubrir     → captura la intención
/sdd.interpretar   → produce ir.json (puntuación de confianza)
/sdd.diseñar       → produce product-design.json + dirección visual
/sdd.especificar   → produce spec.md con criterios de aceptación
/sdd.aclarar       → resuelve marcas [NECESITA_ACLARACION]
/sdd.planificar    → produce plan.md (enfoque técnico)
/sdd.tareas        → produce tareas.md (tareas atómicas con agentes)
/sdd.implementar   → ejecuta las tareas, despacha agentes
/sdd.verificar     → verifica el resultado contra la spec
/sdd.desplegar     → despliega y ejecuta health check
```

Cada comando lee la salida de la etapa anterior desde `.sdd/` y escribe su propia salida de vuelta. Puedes detenerte entre cualquier par de etapas — el estado es duradero.

---

## Paso 6 — Reanudar tras el fin de una sesión

Si tu sesión de Claude Code termina antes de que `/sdd.implementar` finalice:

```
/sdd.implementar continuar
```

FORGE lee `.sdd/especificaciones/{id}/.estado-tareas.json`, encuentra la última tarea completada y retoma desde la siguiente.

---

## Paso 7 — Monitorear el progreso

Abre el dashboard en una terminal separada:

```bash
forge ui
```

Luego abre `http://localhost:3001` en tu navegador. Verás:

- **Pipeline** — qué etapa está activa, porcentaje de progreso general
- **Agentes** — qué agentes corrieron en los últimos 60 segundos
- **Tareas** — ✅ completadas / 🔄 en progreso / ⬜ pendientes / ❌ fallidas
- **Verificación** — resultado de verificación en lenguaje llano

El dashboard consulta `.sdd/` cada 5 segundos. No se requiere servicio externo.

---

## Patrones comunes en la primera ejecución

### "Quiero prototipar rápido, omitir las verificaciones de calidad"

```
/sdd.planificar prototipo
```

Este modo omite el agente `critico`, `seguridad` y la generación de ADRs. Úsalo solo para exploración — el plan resultante no es apto para producción.

### "Quiero ver qué piensa FORGE antes de que haga nada"

```
/sdd.especificar
```

Luego lee `.sdd/especificaciones/*/spec.md`. FORGE no invocará agentes hasta que ejecutes `/sdd.planificar`.

### "Algo salió mal. ¿Cuál es el estado del proyecto?"

```
/sdd.estado
```

Imprime un resumen en lenguaje llano de todo el estado en `.sdd/` — en qué etapa estás, cuál spec está activa, cuál fue la última tarea.

### "Quiero cambiar qué modelo usa un agente"

Edita `.sdd/sdd.config.yaml`:

```yaml
agentes:
  desarrollador-backend:
    modelo: opus   # era: sonnet
```

Luego ejecuta `/sdd.configurar show agentes` para confirmar el cambio.

---

## Qué se instala y dónde

| Ubicación | Contenido |
|-----------|-----------|
| `.claude/commands/` | 38 archivos de comandos `.md` |
| `.claude/agents/` | 14 archivos de agentes `.md` |
| `.claude/skills/` | 29 directorios de skills |
| `.claude/hooks/pre-tool-guard.js` | Bloquea comandos destructivos |
| `.claude/hooks/agent-memory.js` | Registra actividad de agentes |
| `.claude/hooks/post-write-conventions.js` | Valida archivos escritos |
| `.sdd/sdd.config.yaml` | Configuración de tu proyecto |
| `.sdd/estado.json` | Estado del pipeline |
| `.sdd/memoria/constitucion.md` | Constitución del proyecto |

Nada se instala globalmente a menos que pases `--global`.

---

## Próximos pasos

- [Conceptos fundamentales](core-concepts.md) — entender qué son realmente el IR, el estado del pipeline y la memoria de agentes
- [Agentes](agents.md) — aprender qué hace cada uno de los 14 agentes
- [Configuración](configuration.md) — ajustar FORGE para tu proyecto
- [Ejemplos](examples.md) — ver recorridos completos de extremo a extremo
