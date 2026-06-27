# Estado de Implementación — FORGE v4.2.0

> Fecha: 2026-06-27 | Propósito: clarificar qué está hecho, qué no, y qué prerequisitos necesita alguien que quiera usar FORGE hoy. Sin marketing.

---

## TL;DR

FORGE v4.2.0 tiene un núcleo sólido y probado: pipeline SDD completo, 14 agentes con enforcement real, memoria SQLite, runner CLI portable, motor de agentes agnóstico de LLM, decision store con búsqueda semántica, dashboard SSE en tiempo real, y aprobación humana obligatoria antes de planificar. **998 tests pasando, 0 fallos.**

---

## 1. Completo y probado

| Componente | Tests | Estado | Nota |
|---|---|---|---|
| Agent enforcement (agentes read-only) | ✅ | Producción | `pre-tool-guard.js` + `.sh` bloquea Write/Edit a nivel hook |
| Decision store SQLite + TF-IDF | ✅ (1 skip) | Producción | Skip: superseder cuando Node < 22.5 sin SQLite |
| State machine + guards | ✅ | Producción | Guards: `ir_generado`, `product_design_aprobado`, `spec_activa + spec_aprobado`, `plan_activo` |
| CLI runner portable | ✅ | Producción | `forge status/step/validate/reset/run/resume/aprobar` — sin LLM |
| Guard `spec → plan` con aprobación humana | ✅ | Producción | `forge aprobar spec` escribe `spec_aprobado: true` en estado |
| Motor LLM agnóstico | ✅ | Producción | Anthropic / OpenAI / Ollama / Stub — auto-detectado por env o config |
| forge doctor con diagnóstico LLM real | ✅ | Producción | Ping, latencia, JSON validation, modelo, SQLite |
| Guardrails (pre-tool-guard) | ✅ | Producción | 9 categorías de bloqueo, secrets, ADR violations |
| Hooks multi-lenguaje (.sh + .js) | ✅ | Producción | Funciona en proyectos Python/Go/Rust/PHP sin `"type":"module"` |
| Sistema de adaptadores | ✅ | Producción | `ForgeAdapter`, `AdapterRegistry`, `ClaudeCodeAdapter`, `SpecKitAdapter` |
| Memoria persistente Markdown | ✅ | Producción | Auto-compresión, índice invertido JSONL, deduplicación |
| Memoria persistente SQLite | ✅ | Producción | Auto-detectada en Node ≥22.5; fallback a Markdown |
| Memoria compartida entre agentes | ✅ | Producción | `.sdd/memoria/compartida/decisiones-clave.md` — todos los agentes leen y escriben |
| Memoria episódica TF-IDF | ✅ | Producción | Similitud coseno reemplaza grep exacto en `queryEpisodes` |
| Context manager (presupuesto USD) | ✅ | Producción | `FORGE_BUDGET_WARN_USD` / `FORGE_BUDGET_BLOCK_USD`; resumen progresivo |
| Observabilidad | ✅ | Producción | `consumo.jsonl`, `mutaciones.jsonl`, `events.jsonl`, `agent-tool-audit.jsonl` |
| Export/import artefactos | ✅ | Producción | `forge export --format=speckit\|openspec` + import con `--merge` |
| Circuit breaker (3 niveles) | ✅ | Producción | sandbox / local / confirmado — enforced en `pre-tool-guard.js` |
| Pipeline SDD (39 comandos) | ✅ | Producción | idea → discovery → ir → design → spec → plan → tasks → code → done |
| 14 agentes especializados | ✅ | Producción | 7 read-only enforced en hook, 7 con permisos de escritura |
| forge decisions list/search/add/migrate | ✅ | Producción | `cli/decisions.js` — búsqueda semántica con score % |
| forge dispatch + forge adapters | ✅ | Producción | `cli/dispatch.js` — resuelve adaptador disponible y ejecuta |
| E2E tests pipeline completo sin LLM | 24/24 ✅ | Producción | `tests/e2e/pipeline-flow.test.js` — idea→spec con fixtures estáticas |
| Dashboard UI con SSE | ✅ | Beta | SSE tiempo real (estado, consumo, eventlog) + fallback polling |
| AST Indexer con limpiarTypeScript() | 18/18 ✅ | Beta | Decoradores, genéricos, JSX, satisfies, union types |
| Templates de inicio | ✅ (3) | Beta | `api-rest`, `cli-tool`, `saas-mvp` — flujo verificado |
| Integraciones MCP (Vercel/GitHub) | Parcial | Beta | Flujo básico probado, sin E2E automatizado |

**Total tests: 998 pasando, 0 fallos.**

---

## 2. Parcialmente implementado

### AST Indexer (`claude-hooks/ast-indexer.js`)

**Qué sí hace:** parsea JS/TS con `acorn` + limpieza de 10 patrones TypeScript. Genera índice de símbolos. 18 tests cubriendo decoradores, genéricos, JSX, `satisfies`, union types.

**Limitación:** TypeScript muy avanzado (namespaces, template literal types, conditional types) puede producir errores silenciosos. `acorn` no es un parser TypeScript nativo.

**Impacto real:** el índice AST es opcional. Si falla, el agente cae a lectura directa. Sin bloqueo de pipeline.

---

### Model Routing (`claude-hooks/model-registry.js`)

**Qué sí hace:** resuelve qué modelo debería usar cada agente según `sdd.config.yaml`. Registra en observabilidad.

**Qué no hace:** cambiar el modelo que Claude Code usa en tiempo de ejecución. El modelo efectivo está determinado por el frontmatter YAML del agente. `model-registry.js` es observabilidad, no routing dinámico.

**Por qué:** la API de Claude Code no expone override de modelo por tool call. Cuando lo exponga, `model-registry.js` ya tiene la lógica preparada. El motor LLM agnóstico (`core/llm-providers/`) sí hace routing real para el runner headless.

---

### Dashboard UI (`ui/server.js`)

**Qué sí hace:** servidor HTTP loopback en `localhost:3001`, SSE en tiempo real (estado, consumo, eventlog), endpoint `/eventlog` para últimas 50 entradas.

**Qué no hace:** autenticación, escritura de estado desde la UI, WebSockets (usa SSE + fallback polling).

**Impacto real:** funcional para monitoreo local. No apto para exponer en red pública.

---

### TF-IDF en Decision Store (`core/decisions/decision-store.js`)

**Implementación real:** TF (frecuencia de términos) + similitud coseno. Sin IDF global.

**Consecuencia:** funciona muy bien con docenas o cientos de decisiones. Con miles de ADRs, términos comunes ganarían peso artificialmente. Para el caso de uso típico (proyecto individual o equipo pequeño), es correcto y suficiente.

---

## 3. No existe todavía

### Routing condicional automático por `confidence` del IR

`ir.json` tiene el campo `confidence` (float 0-1). Si es < 0.7, FORGE debería pedir aclaración antes de diseñar. Los comandos `sdd.diseñar.md` y `sdd.especificar.md` tienen el bloque Bash documentado, pero no hay lógica ejecutable en el runner que lo evalúe automáticamente.

**Impacto:** el agente `arquitecto` lo gestiona por contexto del prompt. Sin bloqueo de pipeline.

---

### Driver HTTP de inferencia headless (v2)

El motor LLM (`core/llm-providers/`) soporta Anthropic/OpenAI/Ollama/Stub. Falta un modo donde el runner ejecute tareas completas sin necesitar Claude Code instalado, solo con la API key.

**Estado:** fuera del camino crítico v1. Los artefactos portables (SpecKit) cubren el caso sin HTTP propio.

---

## 4. Deuda técnica

### Dependencias runtime — no son estrictamente cero

```json
"dependencies": {
  "@sqlite.org/sqlite-wasm": "^3.53.0-build1",
  "acorn": "^8.17.0"
}
```

- `@sqlite.org/sqlite-wasm` — fallback SQLite WebAssembly cuando `node:sqlite` no disponible
- `acorn` — parser JS para el AST indexer

**Impacto:** `npm install` añade ~8MB. No es zero-deps estricto. En Node ≥22.5, `node:sqlite` nativo se usa y el wasm no entra en juego.

---

### core/ es JS puro — no necesita compilación TypeScript

`core/` fue migrado de TypeScript a JS puro con JSDoc en commit `b117455`. No existe `dist/` ni se necesita `npm run build` para usar el runner. La referencia en `package.json` a `typecheck` apunta a `tsc` por compatibilidad, pero el runner funciona directamente con `node core/engine-cli.js`.

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

### Para usar FORGE con otro LLM (OpenAI, Ollama)

- [ ] Configurar `FORGE_LLM_PROVIDER=openai` o `ollama` en variables de entorno
- [ ] O añadir `llm.provider` en `sdd.config.yaml`
- [ ] `forge doctor` valida la conexión y latencia automáticamente

### Para contribuir / desarrollar FORGE

- [ ] Node.js ≥22.5.0
- [ ] `npm test` — 998 tests deben pasar, 0 fallos
- [ ] No se necesita `npm run build` — `core/` es JS puro

---

## 6. Arquitectura de confianza por componente

```
CONFIABLE EN PRODUCCIÓN
├── Pipeline SDD 39 comandos              ✅
├── 14 agentes + enforcement hooks        ✅
├── Hooks multi-lenguaje (.js + .sh)      ✅
├── State machine + guards + aprobación   ✅
├── CLI runner (run/resume/aprobar)       ✅
├── Motor LLM agnóstico (4 providers)     ✅
├── Memoria SQLite / Markdown             ✅
├── Memoria compartida entre agentes      ✅
├── Decision store TF-IDF                 ✅
├── Circuit breaker (3 niveles)           ✅
├── Context manager presupuesto           ✅
├── Observabilidad (4 JSONL)              ✅
├── E2E tests pipeline sin LLM (24)       ✅
└── Adaptadores (ClaudeCode + SpecKit)    ✅

FUNCIONAL CON LIMITACIONES CONOCIDAS
├── AST indexer (TS básico-medio)         🟡
├── Dashboard SSE (sin auth)              🟡
├── MCP integrations (beta)               🟡
├── TF-IDF a escala grande (>1000 ADRs)   🟡
└── model-registry.js (observabilidad)    🟡

PENDIENTE
├── Routing condicional por confidence    🔴
└── Driver HTTP headless v2               🔴
```
