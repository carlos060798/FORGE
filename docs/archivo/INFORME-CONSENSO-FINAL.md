# Informe de Consenso Final — FORGE v4.2.0

> Fecha: 2026-06-27 | Propósito: documento ejecutivo de cierre. Estado real, recomendaciones priorizadas, hoja de ruta. Para leer en 10 minutos.

---

## Veredicto ejecutivo

**Qué es FORGE hoy:** Un framework SDD+TDD para desarrolladores técnicos individuales o equipos pequeños que quieren construir software con IA de forma estructurada. Combina metodología de proceso (pipeline de 9 fases con gates de aprobación), orquestación de 14 agentes especializados con enforcement real, y persistencia de spec y decisiones en el repositorio. Ningún competidor cubre estas tres dimensiones simultáneamente. El núcleo está completo, probado (963 tests pasando) y en producción.

**Qué problema resuelve:** El "vibe coding" sin estructura — donde se empieza a codificar directamente con el LLM sin spec, el contexto se pierde entre sesiones, las decisiones de arquitectura se repiten, y el código crece sin dirección. FORGE fuerza el ciclo completo: idea → especificación aprobada → plan aprobado → implementación con TDD → verificación → deploy. Y mantiene todo el historial de decisiones accesible y buscable localmente.

**¿Es fácil de usar?** El camino principal (`/forge "idea"` en Claude Code) es genuinamente simple — 10 minutos para el primer proyecto. La curva aparece en personalización de agentes, recuperación de estados de error, y uso del runner portable sin Claude Code. La documentación cubre todos estos casos. No es más complejo que configurar un pipeline de CI por primera vez.

---

## Semáforo de madurez por capa

| Capa | Estado | Justificación |
|---|---|---|
| **Núcleo portable** (CLI, state machine, adapters, decision store) | 🟢 Producción | 963 tests, guards verificados, sin deps externas para el core |
| **Guardrails y enforcement** (pre-tool-guard, read-only agents) | 🟢 Producción | 10/10 tests de enforcement, 9 categorías de bloqueo, determinista |
| **Memoria SQLite + TF-IDF episódica** | 🟢 Producción | Auto-detectada en Node ≥22.5, fallback a Markdown, 8/8 tests decision-store |
| **Observabilidad** (consumo.jsonl, mutaciones.jsonl, audit) | 🟢 Producción | 3 JSONL activos con datos reales, rotación automática |
| **Export/import artefactos** (Spec Kit, OpenSpec) | 🟢 Producción | Round-trip verificado, `--merge` no-destructivo |
| **Pipeline SDD** (39 comandos, 14 agentes) | 🟢 Producción | Flujo completo verificado, gates aprobados |
| **Dashboard UI** | 🟡 Beta | Funcional, polling cada 5s, sin auth, sin WebSockets |
| **Integración MCP** (Vercel, GitHub) | 🟡 Beta | Flujo básico probado, sin E2E automatizado |
| **AST indexer** | 🟡 Beta | JS básico con acorn; TypeScript avanzado puede fallar |
| **E2E pipeline tests** | 🔴 Pendiente | No existe suite que valide el flujo completo sin LLM |
| **Routing real de modelo** | 🔴 Pendiente | `model-registry.js` es observabilidad, no routing; API de Claude Code no lo expone |
| **Memoria compartida entre agentes** | 🔴 Pendiente | Convención definida pero no implementada en `agent-memory.js` |

---

## Recomendaciones finales priorizadas

Filtro aplicado: **máximo impacto con mínimo riesgo para el núcleo funcional existente**. Todas las P1-P4 son cambios en archivos `.md` o JS de pocos días de trabajo. Las P5-P8 son cambios más profundos o dependencias de factores externos.

### P1 — E2E pipeline tests sin LLM

**Impacto: Alto | Esfuerzo: Medio (2-3 días)**

Los 963 tests actuales cubren infraestructura pero no el flujo completo de usuario. Una regresión en el formato de `ir.json` puede pasar sin detectarse en CI.

```
Crear: tests/e2e/pipeline-flow.test.js
  → Lee fixtures de .sdd/ (ir.json, spec.md, estado.json estáticos)
  → Ejecuta forge step con la state machine real
  → Verifica transiciones y artefactos generados
  → Sin llamadas LLM — 100% determinista
```

Este test es la única garantía real de que el pipeline funciona end-to-end después de cualquier cambio.

---

### P2 — Routing condicional por `confidence` del IR

**Impacto: Alto | Esfuerzo: Bajo (horas)**

`ir.json` tiene el campo `confidence` (float 0-1) pero ningún código lo evalúa automáticamente. Si el IR tiene baja confianza, el agente `arquitecto` debería pedir aclaración antes de diseñar — hoy eso depende del contexto del prompt.

```
Modificar: commands/sdd.diseñar.md
  → Añadir bloque bash al inicio:
    CONFIDENCE=$(jq -r '.confidence' .sdd/ir.json 2>/dev/null || echo "0")
    if awk "BEGIN {exit !($CONFIDENCE < 0.7)}"; then
      # Branch: solicitar aclaración antes de diseñar
    fi
```

Impacto directo en calidad del output: elimina diseños basados en especificaciones ambiguas.

---

### P3 — Chaining automático entre fases SDD

**Impacto: Alto | Esfuerzo: Bajo (horas)**

Hoy el usuario debe escribir manualmente `/sdd.tareas` después de `/sdd.planificar`. Esto introduce fricción y dependencia de que el usuario recuerde el orden correcto.

```
Modificar: commands/sdd.planificar.md, commands/sdd.especificar.md, commands/sdd.diseñar.md
  → Añadir al final de cada comando:
    ## SIGUIENTE PASO SUGERIDO
    El [paso] está listo. ¿Ejecuto /sdd.[siguiente] automáticamente?
    Responde: `sí` · `no` · `revisar [aspecto]`
```

Este cambio elimina la necesidad de que el usuario memorice el pipeline. La aprobación explícita se mantiene (human-in-the-loop), pero la sugerencia es automática.

---

### P4 — Memoria compartida entre agentes

**Impacto: Medio | Esfuerzo: Bajo (horas)**

Cada agente tiene memoria aislada. Si `seguridad` necesita saber qué decidió `arquitecto` sobre la autenticación, debe releer archivos manualmente. CrewAI tiene shared memory como primera clase.

```
Convención a implementar:
  .sdd/memoria/compartida/
    └── decisiones-clave.md   ← cualquier agente puede leer/escribir

Modificar: claude-hooks/agent-memory.js
  → Al registrar un ADR, además de escribir en memoria del agente,
    append al archivo compartido con formato estructurado

Modificar: agents/arquitecto.md, agents/seguridad.md, etc.
  → Añadir instrucción: "Lee .sdd/memoria/compartida/decisiones-clave.md al inicio"
```

---

### P5 — TypeScript/JSX en AST indexer

**Impacto: Medio | Esfuerzo: Medio (1-2 días)**

El indexer actual usa `acorn` (parser JS). Proyectos TypeScript avanzados o React con JSX pueden producir errores silenciosos en el índice.

```
Modificar: claude-hooks/ast-indexer.js
  → Detectar extensión del archivo (.ts, .tsx, .jsx)
  → Para TS/TSX: usar @babel/parser como alternativa a acorn
    (o pre-strip de tipos con una regex simple antes de parsear con acorn)
```

---

### P6 — SSE en dashboard (reemplaza polling)

**Impacto: Bajo-Medio | Esfuerzo: Medio (1 día)**

El dashboard hace polling cada 5s. Server-Sent Events (SSE) es una alternativa zero-dep que da actualización en tiempo real.

```
Modificar: ui/server.js
  → Añadir endpoint GET /events con Content-Type: text/event-stream
  → Usar fs.watch() en estado.json y consumo.jsonl para emitir eventos

Modificar: ui/assets/app.js (dashboard client)
  → Reemplazar setInterval(poll, 5000) por new EventSource('/events')
```

---

### P7 — CursorAdapter (segundo host adapter)

**Impacto: Alto — adopción externa | Esfuerzo: Alto (semanas)**

Hay un `SpecKitAdapter` que genera artefactos portables. El siguiente paso es un adaptador específico para Cursor que inyecte el contexto de FORGE vía la API de extensión de Cursor/VS Code.

```
Crear: core/adapters/cursor-adapter.js
  → Detecta Cursor por proceso o archivos .cursor/
  → Escribe el contexto en .cursorrules o en un archivo de instrucciones
  → Abre automáticamente el archivo de tarea en el editor
```

Desbloqueará a usuarios de Cursor que no quieren o no pueden usar Claude Code.

---

### P8 — Driver HTTP de inferencia real (v2)

**Impacto: Alto — agnosticismo completo | Esfuerzo: Alto (semanas)**

Permite que `forge dispatch` haga la llamada LLM directamente, sin necesitar Claude Code como host. Es la arquitectura v2 completa.

```
Crear: core/adapters/http-provider.js
  → Interfaz: { model, messages } → { content }
  → Implementaciones: AnthropicHTTP, OpenAIHTTP, GeminiHTTP
  → Selección automática por variables de entorno:
    ANTHROPIC_API_KEY → AnthropicHTTP
    OPENAI_API_KEY → OpenAIHTTP
    GEMINI_API_KEY → GeminiHTTP
```

Este es el único cambio que convierte FORGE en verdaderamente agnóstico de Claude Code. Es v2 — el v1 (Spec Kit portable) ya cubre el caso de uso sin necesitar este HTTP driver.

---

## Árbol de decisión: ¿Es FORGE para mí?

```
¿Eres desarrollador técnico o ingeniero?
├── NO → Usa Bolt.new o v0 (sin curva de aprendizaje técnico)
└── SÍ → ¿Tus proyectos duran más de una semana?
           ├── NO → Usa directamente Claude Code sin framework
           └── SÍ → ¿Valoras que las decisiones de arquitectura no se pierdan entre sesiones?
                      ├── NO → FORGE puede ser overhead para ti
                      └── SÍ → ¿Usas Claude Code o estás dispuesto a usarlo?
                                 ├── NO → Usa el runner portable de FORGE + Spec Kit handoff
                                 └── SÍ → FORGE es para ti
                                           → npx forge init
                                           → /forge "tu idea"
```

---

## Hoja de ruta trimestral

### Q3 2026 — Completar el núcleo (P1-P4)
Todas estas mejoras son cambios en archivos `.md` o JS simples. Sin riesgo para el núcleo existente.

| Semana | Entregable |
|---|---|
| 1 | `tests/e2e/pipeline-flow.test.js` — E2E tests sin LLM (P1) |
| 2 | Routing condicional por `confidence` en `sdd.diseñar.md` (P2) |
| 2 | Chaining automático en `sdd.planificar.md` + `sdd.especificar.md` (P3) |
| 3 | Memoria compartida entre agentes — convención + `agent-memory.js` (P4) |
| 4 | Actualizar docs + tests de los cambios anteriores |

**Criterio de done Q3:** `npm test` verde con E2E, chaining sugerido en las 3 fases principales, ADRs accesibles para todos los agentes.

### Q4 2026 — Pulir la experiencia (P5-P6)
Mejoras de calidad que no bloquean el uso pero mejoran la experiencia.

| Mes | Entregable |
|---|---|
| Oct | TypeScript/JSX en AST indexer (P5) |
| Nov | SSE en dashboard — reemplaza polling (P6) |
| Dic | Documentación actualizada + video de onboarding |

### 2027 — Expansión de host (P7-P8)
Dependen de factores externos (API de Cursor, decisión de arquitectura sobre HTTP driver).

| Q | Entregable |
|---|---|
| Q1 2027 | CursorAdapter — si la API de Cursor lo permite (P7) |
| Q2 2027 | HTTP provider driver (P8) — convierte FORGE en agnóstico de Claude Code |
| Q3 2027 | Marketplace de templates de la comunidad |

---

## Checklist de cierre

### Lo que está hecho y no necesita más trabajo

- [x] Pipeline SDD de 9 fases con gates de aprobación
- [x] 14 agentes especializados con enforcement de permisos
- [x] State machine compilada con CLI runner portable
- [x] Memoria SQLite auto-detectada + fallback a Markdown
- [x] Decision store con búsqueda TF-IDF semántica
- [x] Adaptadores de host (ClaudeCode + SpecKit)
- [x] Export/import de artefactos portables
- [x] Context manager con presupuesto USD enforced
- [x] Observabilidad completa (consumo, mutaciones, audit)
- [x] Guardrails con 9 categorías de bloqueo
- [x] Documentación técnica completa (docs-site v4.2.0)

### Lo que queda para v4.3.0 (Q3 2026)

- [ ] E2E pipeline tests sin LLM (P1)
- [ ] Routing condicional por `confidence` (P2)
- [ ] Chaining automático entre fases (P3)
- [ ] Memoria compartida entre agentes (P4)

### Lo que es v2.0 (2027)

- [ ] CursorAdapter (P7)
- [ ] HTTP provider driver (P8)

---

## Nota final

FORGE v4.2.0 es un sistema completo y funcional para el desarrollador técnico que quiere construir con IA de manera estructurada. No es el camino más rápido para un prototipo de fin de semana. Sí es el sistema más completo para proyectos que duran semanas o meses, donde la persistencia de contexto y decisiones entre sesiones marca la diferencia entre un proyecto que llega a producción y uno que se abandona a medias.

Las 4 mejoras de P1-P4 (Q3 2026) son las que cierran las brechas más importantes con la competencia. Las de P7-P8 (2027) son las que completan la visión de agnosticismo de host. El núcleo ya está listo para ser usado hoy.
