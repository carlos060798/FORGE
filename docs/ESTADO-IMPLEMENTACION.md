# Estado de Implementación — FORGE v4.2.0

> Fecha: 2026-06-27 | Propósito: clarificar qué está hecho, qué no, y qué prerequisitos necesita alguien que quiera usar FORGE hoy. Sin marketing.

---

## TL;DR

FORGE v4.2.0 tiene un núcleo sólido y probado: pipeline SDD, 14 agentes con enforcement real, memoria SQLite, runner CLI portable, decision store con búsqueda semántica, y observabilidad completa. Hay tres áreas genuinamente incompletas: E2E tests del pipeline sin LLM, routing real de modelo en runtime, y memoria compartida entre agentes. El resto funciona y está testeado.

---

## 1. Completo y probado

| Componente | Tests | Estado | Nota |
|---|---|---|---|
| Agent enforcement (agentes read-only) | 10/10 ✅ | Producción | `pre-tool-guard.js` bloquea Write/Edit a nivel hook — no configurable |
| Decision store SQLite + TF-IDF | 8/8 ✅ (1 skip) | Producción | Skip: superseder cuando Node < 22.5 sin SQLite |
| State machine + transiciones guardadas | ✅ | Producción | `core/state-machine.ts` compilado; guards: `ir_generado`, `product_design_aprobado`, `spec_activa`, `plan_activo` |
| CLI runner portable | ✅ | Producción | `forge status/step/validate/reset/state` — sin LLM |
| Guardrails (pre-tool-guard) | 10/10 ✅ | Producción | 9 categorías de bloqueo, detección de secrets, ADR violations |
| Sistema de adaptadores | ✅ | Producción | `ForgeAdapter`, `AdapterRegistry`, `ClaudeCodeAdapter`, `SpecKitAdapter` |
| Spec Kit handoff portable | ✅ | Producción | Genera `TASK.md + spec.md + pipeline-state.json + README.md` en `speckit-handoff/` |
| Memoria persistente Markdown | ✅ | Producción | Auto-compresión, índice invertido JSONL, deduplicación |
| Memoria persistente SQLite | ✅ | Producción | Auto-detectada en Node ≥22.5; fallback a Markdown |
| Memoria episódica TF-IDF | ✅ | Producción | Similitud coseno reemplaza grep exacto en `queryEpisodes` |
| Context manager (presupuesto USD) | ✅ | Producción | `FORGE_BUDGET_WARN_USD` / `FORGE_BUDGET_BLOCK_USD`; resumen progresivo |
| Observabilidad | ✅ | Producción | `consumo.jsonl` (5KB real), `mutaciones.jsonl` (33KB real), `agent-tool-audit.jsonl` (10.5KB real) |
| Export/import artefactos | ✅ | Producción | `forge export --format=speckit\|openspec` + import con `--merge` |
| Circuit breaker (3 niveles) | ✅ | Producción | sandbox / local / confirmado |
| Pipeline SDD (39 comandos) | ✅ | Producción | idea → discovery → ir → design → spec → plan → tasks → code → done |
| 14 agentes especializados | ✅ | Producción | 7 read-only enforced en hook, 7 con permisos de escritura |
| forge decisions list/search/add/migrate | ✅ | Producción | `cli/decisions.js` — búsqueda semántica con score % |
| forge dispatch + forge adapters | ✅ | Producción | `cli/dispatch.js` — resuelve adaptador disponible y ejecuta |
| Templates de inicio | ✅ (3) | Beta | `api-rest`, `cli-tool`, `saas-mvp` — flujo verificado |
| Dashboard UI | ✅ | Beta | HTTP loopback, 6 endpoints, polling 5s |
| Integraciones MCP (Vercel/GitHub) | Parcial | Beta | Flujo básico probado, sin E2E automatizado |

**Total tests:** 963 pasando, 1 fallo (ver sección 4).

---

## 2. Parcialmente implementado

### AST Indexer (`claude-hooks/ast-indexer.js`)

**Qué sí hace:** parsea JS/TS básico con `acorn`, genera índice de símbolos para recuperación rápida.

**Qué no hace:** TypeScript avanzado (genéricos, decoradores, namespaces) puede producir errores silenciosos — `acorn` no es un parser TypeScript nativo. JSX también puede fallar.

**Impacto real:** el índice AST es opcional en el pipeline. Si falla, el agente cae de vuelta a lectura directa de archivos. Sin bloqueo de pipeline.

---

### Model Routing (`claude-hooks/model-registry.js`)

**Qué sí hace:** resuelve qué modelo debería usar cada agente según `sdd.config.yaml` y el frontmatter del agente. Registra en observabilidad.

**Qué no hace:** cambiar el modelo que Claude Code usa en tiempo de ejecución. El modelo efectivo está determinado por el frontmatter YAML del agente (`model: claude-opus-4-8`). `model-registry.js` es observabilidad, no routing real.

**Por qué:** la API de Claude Code no expone todavía un mecanismo de override de modelo por tool call. Cuando lo exponga, `model-registry.js` ya tiene la lógica lista.

---

### Dashboard UI (`ui/server.js`)

**Qué sí hace:** servidor HTTP loopback en `localhost:3001`, 6 endpoints read-only, visualización del estado del pipeline.

**Qué no hace:** WebSockets (polling cada 5s), autenticación, escritura de estado desde la UI.

**Impacto real:** funcional para monitoreo local. No apto para exponer en red.

---

### TF-IDF en Decision Store (`core/decisions/decision-store.js`)

**Implementación real:** TF (frecuencia de términos) + similitud coseno. Sin IDF global (frecuencia inversa de documentos). Sin embeddings de LLM.

**Consecuencia:** funciona muy bien con docenas o cientos de decisiones. Con miles de ADRs, términos comunes ganarían peso artificialmente (no hay IDF para penalizarlos). Para el caso de uso típico (proyecto individual o equipo pequeño), es correcto y suficiente.

---

## 3. No existe todavía

### E2E pipeline tests sin LLM

Los 963 tests actuales cubren infraestructura (hooks, memory, state machine, adapters) pero **no el flujo completo de usuario**: idea → ir → spec → plan → code.

Una regresión en `sdd.interpretar` que cambie el formato de `ir.json` puede pasar desapercibida hasta que un usuario real lo encuentre.

**Impacto:** prioridad P1 de mejoras. Sin este test, la suite de CI no valida el pipeline end-to-end.

**Qué se necesita:** `tests/e2e/pipeline-flow.test.js` que use fixtures estáticas de `ir.json`/`spec.md`/`estado.json` y el CLI runner — sin llamar a ningún LLM.

---

### Routing condicional automático por `confidence` del IR

`ir.json` tiene el campo `confidence` (float 0-1). Si es < 0.7, la especificación dice que FORGE debe pedir aclaración antes de diseñar.

**Estado actual:** la condición existe documentada pero no hay código que la evalúe automáticamente. El agente `arquitecto` lo hace por contexto del prompt, no por lógica ejecutable.

**Qué se necesita:** en `commands/sdd.diseñar.md`, añadir bloque bash que lea `confidence` del IR y haga branch antes de continuar. Esfuerzo: horas.

---

### Memoria compartida entre agentes

Cada agente tiene su propia `agente-{nombre}.md` o registro en SQLite. Si `seguridad` quiere ver las decisiones de `arquitecto`, debe releer los archivos — no hay canal directo.

**Estado actual:** convención no implementada. El análisis comparativo con CrewAI identifica esto como gap.

**Qué se necesita:** convención de archivo `.sdd/memoria/compartida/decisiones-clave.md` + entrada en `agent-memory.js` que escriba ahí cuando el agente registra un ADR. Esfuerzo: horas.

---

### Driver HTTP de inferencia (v2)

El adaptador `SpecKitAdapter` genera artefactos que cualquier agente externo puede consumir. Pero no existe un adaptador que haga la llamada HTTP directamente a Anthropic/OpenAI/Gemini desde el runner portable.

**Estado actual:** fuera del camino crítico v1. La solución actual (artefactos portables) cubre el caso de uso sin necesitar HTTP propio.

---

## 4. Deuda técnica identificada

### Test fallando — `performance.test.js:120`

```
Test: "leer SKILL.md de las 30 skills < 80ms"  [Etiqueta real del test]
Actual: 386.53ms
Umbral: 250ms
Razón: lectura secuencial de 31 skills en disco Windows con Node fs.readFileSync
```

**Impacto:** bajo en producción (la lectura de skills solo ocurre en `forge init` y `forge doctor`). El umbral puede estar calibrado para Linux SSD y ser demasiado estricto en Windows HDD. Sin embargo, el test da señal real de que la lectura secuencial de 31 archivos es lenta.

**Solución posible:** lectura lazy (solo leer el skill cuando se necesita) o leer en paralelo con `Promise.all`. Esfuerzo: horas.

---

### Dependencias runtime — NO son cero

El README menciona "zero dependencias en runtime". No es exactamente correcto:

```json
"dependencies": {
  "@sqlite.org/sqlite-wasm": "^3.53.0-build1",
  "acorn": "^8.17.0"
}
```

- `@sqlite.org/sqlite-wasm` — fallback de SQLite WebAssembly (cuando `node:sqlite` no está disponible)
- `acorn` — parser JS para el AST indexer

**Impacto:** el `npm install` añade ~8MB. No es zero-deps estricto. Para el caso de uso típico (Node ≥22.5), `node:sqlite` nativo se usa y `@sqlite.org/sqlite-wasm` no entra en juego.

---

### Compilación TypeScript necesaria para el runner portable

`core/state-machine.ts` es TypeScript. Para que `forge step` funcione, necesita existir `dist/core/` compilado.

**Estado actual:** `tsconfig.json` tiene `"noEmit": false` y `package.json` tiene `"prepublishOnly": "npm run build && npm test"`. La compilación ocurre antes de publicar en npm.

**Para contribuidores locales:** ejecutar `npm run build` antes de probar `forge step`. Sin este paso, el runner falla al no encontrar `dist/core/`.

---

## 5. Checklist de prerequisitos

### Para usar FORGE en modo plugin (Claude Code)

- [ ] Node.js ≥18.0.0 (recomendado ≥22.5)
- [ ] Claude Code CLI instalado y con API key configurada
- [ ] `npx forge init` ejecutado en el directorio del proyecto
- [ ] `npx forge doctor` sin errores críticos

### Para usar FORGE con SQLite (memoria y decision store completos)

- [ ] Node.js ≥22.5.0 (módulo `node:sqlite` experimental activado)
- [ ] Si Node < 22.5: la memoria cae a Markdown y las decisiones a JSONL — funciona, pero sin búsqueda semántica

### Para usar el runner CLI portable (sin Claude Code)

- [ ] `npm run build` ejecutado una vez (compila `core/` a `dist/core/`)
- [ ] `forge status` funciona sin Claude Code instalado
- [ ] `forge dispatch --adapter=speckit` genera artefactos sin LLM

### Para contribuir / desarrollar FORGE

- [ ] Node.js ≥22.5.0
- [ ] `npm run build` antes de probar cambios en `core/`
- [ ] `npm test` — 963 tests deben pasar (1 fallo conocido de performance es aceptable)
- [ ] `npx tsc --noEmit` sin errores de tipo

---

## 6. Arquitectura de confianza por componente

```
CONFIABLE EN PRODUCCIÓN (no necesita cambio para usarlo)
├── Pipeline SDD 39 comandos          ✅
├── 14 agentes + enforcement hooks    ✅
├── State machine + CLI runner        ✅
├── Memoria SQLite / Markdown         ✅
├── Decision store TF-IDF             ✅
├── Context manager presupuesto       ✅
├── Observabilidad (3 JSONL)          ✅
└── Adaptadores (ClaudeCode + SpecKit)✅

FUNCIONAL PERO CON LIMITACIONES CONOCIDAS
├── AST indexer (solo JS básico)      🟡
├── Dashboard (polling, sin auth)     🟡
├── MCP integrations (beta)           🟡
└── TF-IDF a escala grande            🟡

PENDIENTE DE IMPLEMENTACIÓN
├── E2E pipeline tests                🔴
├── Routing condicional por confidence🔴
├── Memoria compartida entre agentes  🔴
└── Driver HTTP inferencia (v2)       🔴

OBSERVABILIDAD SOLAMENTE (no es routing real)
└── model-registry.js                 ℹ️
```
