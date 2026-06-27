# Inicio rápido

Esta guía te lleva de cero a un pipeline FORGE funcionando. Tiempo estimado: 10-15 minutos.

---

## Prerequisitos

| Requisito | Mínimo | Recomendado |
|---|---|---|
| Node.js | ≥18.0.0 | ≥22.5.0 (SQLite nativo) |
| Claude Code | cualquier versión | última |
| Git | cualquier versión | — |
| ANTHROPIC_API_KEY | obligatoria | — |

Si usas Node ≥22.5, FORGE usa `node:sqlite` nativo para la memoria y el decision store. Con versiones anteriores, cae a Markdown — todo funciona pero sin búsqueda semántica.

---

## Paso 1 — Instalar FORGE

```bash
git clone https://github.com/carlos060798/FORGE
cd FORGE
npm install
```

Para tener el comando `forge` disponible globalmente:

```bash
npm install -g .
forge --version   # debe imprimir 4.2.0
```

O sin instalación global, usa `node /ruta/a/FORGE/cli/index.js` en lugar de `forge` en todos los comandos siguientes.

---

## Paso 2 — Verificar instalación

```bash
forge doctor
```

`forge doctor` verifica:
- `ANTHROPIC_API_KEY` configurada en el entorno
- Hooks en disco (`pre-tool-guard.js`, `agent-memory.js`, `post-write-conventions.js`)
- Conexión real al LLM usando `claude-haiku-4-5-20251001` (el más rápido y económico para el ping)
- Latencia de respuesta y validación del formato JSON
- SQLite disponible (Node ≥22.5)

Si aparece algún error rojo, resuélvelo antes de continuar. Los errores amarillos son advertencias — el pipeline funciona pero con capacidad reducida.

---

## Paso 3 — Inicializar en tu proyecto

```bash
cd /ruta/a/mi-proyecto
forge init
```

Esto crea el directorio `.sdd/` con el estado inicial del pipeline, la configuración y el espacio para los artefactos.

Para inicializar con un template de proyecto predefinido:

```bash
forge init --template api-rest    # API REST con autenticación
forge init --template saas-mvp    # SaaS multi-tenant con Stripe
forge init --template cli-tool    # Herramienta de línea de comandos
```

Los templates pre-rellenan el IR inicial y la configuración del stack tecnológico recomendado.

---

## Paso 4 — Primer pipeline

Abre Claude Code en tu proyecto:

```bash
cd mi-proyecto
claude
```

Dentro de Claude Code, escribe:

```
/forge
```

FORGE te pedirá tu idea. Escríbela en lenguaje natural:

```
/forge quiero construir una API REST para gestionar inventario con autenticación JWT
```

---

## Paso 5 — Seguir el pipeline

El pipeline tiene 9 etapas. FORGE avanza de una en una, produciendo artefactos en `.sdd/`:

```
idea
  └→ /sdd.descubrir      → .sdd/discovery/
       └→ /sdd.interpretar → .sdd/ir.json
            └→ /sdd.diseñar   → .sdd/product-design.json
                 └→ /sdd.especificar → .sdd/especificaciones/
```

En cada etapa, FORGE produce un artefacto y espera tu revisión antes de continuar.

### Punto de control obligatorio: aprobación de la spec

Antes de que FORGE pueda planificar, tú debes revisar y aprobar la especificación:

```bash
# Revisa .sdd/especificaciones/ — lee la spec generada
# Cuando estés conforme:
forge aprobar spec
```

Sin este comando, el pipeline bloquea. El estado de la state machine requiere `spec_aprobado: true` para avanzar a `plan`.

```
spec → [forge aprobar spec] → plan → tasks → code → done
```

---

## Paso 6 — Monitorear

Mientras el pipeline avanza, puedes ver el progreso en tiempo real:

```bash
forge ui      # abre http://localhost:3001
```

El dashboard usa SSE (Server-Sent Events) — los datos se actualizan en tiempo real sin recargar. Muestra:
- Estado actual del pipeline
- Consumo de tokens y costo en USD
- Log de eventos recientes
- Progreso de tareas

El dashboard se cierra automáticamente tras 30 minutos de inactividad.

```bash
forge status  # alternativa en terminal — estado + presupuesto USD
forge logs    # historial de consumo en .sdd/observabilidad/consumo.jsonl
```

---

## Paso 7 — Reanudar una sesión interrumpida

Si la sesión de Claude Code termina a mitad del pipeline:

```bash
forge resume
```

O dentro de Claude Code:

```
/sdd.implementar continuar
```

FORGE lee el checkpoint en `.sdd/` y retoma desde la última tarea completada.

---

## Configuración básica

FORGE crea `.sdd/sdd.config.yaml` con valores por defecto. Las opciones más comunes:

```yaml
perfil: guiado      # guiado (paso a paso con confirmaciones) | experto (más rápido)

llm:
  provider: anthropic   # anthropic | openai | ollama | stub
  model: sonnet         # sonnet | opus | haiku

memoria:
  backend: sqlite       # sqlite (Node ≥22.5) | markdown
```

→ Ver [Configuración completa](configuration.md) para todas las opciones.

---

## Próximos pasos

- [Conceptos fundamentales](core-concepts.md) — IR, pipeline, estado, memoria
- [Los 14 agentes](agents.md) — qué hace cada agente y cómo configurarlos
- [Configuración](configuration.md) — referencia completa de sdd.config.yaml
- [Arquitectura](architecture.md) — cómo funciona FORGE por dentro
- [Solución de problemas](TROUBLESHOOTING.md) — errores comunes y soluciones
