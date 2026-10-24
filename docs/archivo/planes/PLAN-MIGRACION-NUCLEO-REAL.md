# Plan de migración — FORGE: framework agnóstico spec-driven (estilo Spec Kit / OpenSpec / Kiro)

> **Estado:** propuesta para revisión. No se ha tocado código de implementación.
> **Fecha:** 2026-06-26
> **Visión:** FORGE como framework **local-first, agnóstico de host (consola/agente), agnóstico de provider LLM y agnóstico de lenguaje de programación**. El núcleo produce un **contrato de artefactos portable** que cualquier agente (Claude Code, Copilot, Cursor, Gemini CLI, o API directa) puede consumir — el mismo modelo que Spec Kit (GitHub), OpenSpec y Kiro (AWS).

---

## Decisiones de arquitectura tomadas

| Decisión | Elección | Implicación |
|---|---|---|
| **Modo de ejecución v1** | **Artefactos portables (estilo Spec Kit)** | FORGE NO construye un driver de inferencia propio en v1. Produce el *contrato* (specs/planes/tasks neutrales); el LLM/agente lo ejecuta. Robusto, alcanzable, es lo que hacen los 3 referentes. Driver de inferencia HTTP queda como capa v2 opcional. |
| **Fuente de verdad portable** | **Híbrido**: `.sdd/` interno + exportador a formato estándar | Se mantiene `.sdd/` como fuente de verdad (ya local-first, casi neutral) y se añade una **capa de export** a formato Spec Kit/OpenSpec para interoperar hacia afuera. |

---

## Contexto — la brecha real

FORGE tiene **el modelo de datos correcto** pero **el runtime equivocado**:

- ✅ **Correcto:** los artefactos `.sdd/` (`estado.json`, `ir.json`, `spec.md`, `plan`, `ADRs.jsonl`) ya son local-first, versionables en git y casi neutrales — exactamente el patrón Spec Kit/OpenSpec.
- ✅ **Correcto:** `model-registry.js` ya es provider-agnostic *en diseño* (anthropic/openai/google, tiers high/medium/low, detección por env vars).
- ✅ **Correcto:** ya es agnóstico de lenguaje de programación (el `arquitecto.md` opera sobre specs con tablas de patrones para Node/Python/Rust/Go/Java/.NET/Ruby/PHP).
- ✅ **Ya existe** `/sdd.exportar` (bundle portable) + `docs/COMPATIBILIDAD.md` + `docs/ANALISIS-COMPARATIVO-FRAMEWORKS.md` — base para reusar.

**Las 4 brechas que impiden el agnosticismo real:**

| # | Brecha | Evidencia |
|---|---|---|
| **G1** | Runtime casado a Claude Code (agentes/comandos `.md` con `allowed-tools`, hooks `PreToolUse/PostToolUse`, `CLAUDE_AGENT_NAME`) | 131 referencias a Claude en 89 archivos |
| **G2** | `model-registry.js` *decide* modelo pero NO lo *invoca*; 6 agentes hard-locked a Anthropic (`ANTHROPIC_ONLY_AGENTS`) | `model-registry.js:50-57,67` |
| **G3** | No hay interfaz de adaptador de agente independiente del host; la orquestación (PTC) es pseudocódigo | `invocarAgente()` no existe |
| **G4** | Comandos son slash-commands de Claude Code, no un CLI portable; `cli/index.js` solo *instala*, no *ejecuta* el pipeline | `package.json#bin` → instalador |

**Resultado buscado:** el pipeline spec-driven de FORGE corre y produce artefactos consumibles por cualquier host, sin depender de Claude Code como único ejecutor — preservando todo lo que ya funciona.

---

## Arquitectura objetivo (3 capas)

```
CAPA 1 — NÚCLEO PORTABLE (local-first, sin LLM)
  • Artefactos .sdd/ (existe) — contrato versionable
  • State machine (core/project-memory.ts — existe, hay que conectar)
  • CLI portable real: forge spec | plan | tasks | export
  • Memoria + observabilidad (hooks JS — existen)
  → CERO dependencia de Claude. Corre en terminal puro.
        ▲
        │ interfaz de adaptador (contrato neutral)
   ┌────┴────┬──────────────┬──────────────────┐
   ▼         ▼              ▼                  ▼
CAPA 2/3 — ADAPTADORES DE HOST (intercambiables)
 Claude Code   API directa    Otra consola      Export estándar
 (existe)      (v2, opcional) (Cursor/Copilot/  (Spec Kit/OpenSpec
               HTTP)          Gemini vía        format)
                              artefactos)
```

**Principio rector:** lo que hoy es "agente = prompt markdown ejecutado por Claude" se separa en **(a) definición declarativa del agente** (rol, tier, tools) en el núcleo + **(b) adaptador** que sabe ejecutarlo en cada host.

---

## Principios

1. **Local-first.** El núcleo opera sin red. Los providers son opcionales.
2. **El artefacto es el producto.** El host/LLM es intercambiable (modelo Spec Kit).
3. **Reusar > reescribir.** `.sdd/`, hooks JS, `model-registry.js`, `/sdd.exportar` ya existen.
4. **Agnóstico por capas, no de golpe.** Artefactos portables v1 → driver de inferencia v2.
5. **Tests como contrato.** Nada se declara "portable" sin un test que lo verifique fuera de Claude.

---

## FASE 0 — Limpieza y fuente de verdad única (bajo riesgo)

- **0.1** Eliminar el duplicado `FORGE/` (previo `diff -rq` + commit de respaldo).
- **0.2** Conectar `core/*.ts` (hoy muerto: `noEmit`, no importado) o eliminarlo. `project-memory.ts` se conecta en Fase 2; el resto se decide pieza a pieza.
- **0.3** Triar los 5 tests `.skip`: reactivar los que describan algo que haremos real; borrar los aspiracionales.

**Verificación:** `npm test` verde; `forge doctor` sin regresiones.

---

## FASE 1 — Formalizar el CONTRATO de artefactos `.sdd/` (corazón del agnosticismo)

**Objetivo:** convertir `.sdd/` de "convención implícita" a **contrato público versionado** — el formato que viaja entre hosts.

- **1.1** Documentar y versionar el esquema de cada artefacto (`estado.json` ya tiene `schemaVersion:"1.0"` — extender a `ir.json`, `spec.md`, `plan`, `ADRs.jsonl`).
- **1.2** Definir la **capa de export híbrida** (decisión tomada): `forge export --format=speckit` y `--format=openspec` que traducen `.sdd/` → `spec.md`/`plan.md`/`tasks.md` estándar. **Reusar `/sdd.exportar`** (ya detecta qué se usó desde `estado.json`) como base.
- **1.3** Importador simétrico (`forge import`) para consumir specs externas → `.sdd/`. Ya existe `commands/sdd.importar.md` para reusar.

**Reuso:** `commands/sdd.exportar.md` (bundle portable existente), `docs/COMPATIBILIDAD.md`.

**Verificación:** dado un `.sdd/` real, exportar a formato Spec Kit y verificar que un agente externo (p.ej. abrir el `spec.md` en otro editor) lo entiende sin contexto FORGE.

---

## FASE 2 — Núcleo ejecutable portable (CLI sin Claude)

**Objetivo:** que el pipeline spec-driven avance desde terminal puro, sin Claude Code como motor.

- **2.1** Empaquetar `core/` (quitar `noEmit`, añadir a `package.json#files[]`) y conectar la state machine `PIPELINE_TRANSITIONS` de `project-memory.ts` como dueña real de `estado.json`.
- **2.2** Promover `cli/index.js` de *instalador* a *runner*: añadir `forge spec`, `forge plan`, `forge tasks`, `forge state`, `forge export` — comandos que manipulan artefactos y validan transiciones **sin LLM**.
- **2.3** Las partes del pipeline que SÍ requieren LLM (generar la spec desde una idea) se delegan vía el **adaptador de host** (Fase 3), no se hardcodean a Claude.

**Reuso:** clase `ProjectMemory` completa (`core/project-memory.ts:60-158` — cache, validación, migración, escritura atómica ya implementadas).

**Verificación:** test que ejecute `forge plan` en CI (sin Claude Code) y verifique que `estado.json` transicionó correctamente.

---

## FASE 3 — Capa de adaptadores de host (desacoplar de Claude)

**Objetivo:** definir el contrato "ejecuta agente X con contexto Y" y tener ≥2 adaptadores.

- **3.1** Definir la **interfaz de adaptador** (neutral): entrada = `{agente, tarea, contexto, tier}`; salida = `{resultado, artefactos_modificados, estado}`.
- **3.2** **Adaptador Claude Code** = el sistema actual (hooks + slash-commands), envuelto tras la interfaz. No se tira nada.
- **3.3** **Adaptador "artefactos portables"** (el de v1 según tu decisión): no ejecuta LLM; emite los prompts/specs que otro agente (Copilot/Cursor/Gemini CLI) consume. Es el modo Spec Kit.
- **3.4** Desacoplar agentes de `CLAUDE_AGENT_NAME`: la identidad del agente pasa a ser un parámetro del contrato, no una env var de Claude. `agent-memory.js:69` se adapta para recibir el agente del adaptador.

**Verificación:** correr la misma tarea por el adaptador Claude y por el adaptador portable; ambos producen artefactos `.sdd/` equivalentes.

---

## FASE 4 — Provider-agnostic real (cerrar G2) — *capa v2, opcional*

**Objetivo:** que el modo "API directa" exista de verdad (driver de inferencia HTTP).

- **4.1** Conectar `model-registry.js` a **drivers de inferencia reales** (HTTP a Anthropic/OpenAI/Gemini) — hoy solo resuelve IDs, no invoca.
- **4.2** Revisar `ANTHROPIC_ONLY_AGENTS`: convertir el hard-lock en *política configurable* (`sdd.config.yaml`), no en código.

> Marcada explícitamente como **v2 opcional** según tu decisión (v1 = artefactos portables). No bloquea el agnosticismo de host.

---

## FASE 5 — Honestidad documental

- **5.1** Alinear README/CHANGELOG con la arquitectura de 3 capas.
- **5.2** Documentar la matriz de compatibilidad: qué corre en cada host (Claude Code / terminal puro / otro agente vía export). Extender `docs/COMPATIBILIDAD.md` y `docs/ANALISIS-COMPARATIVO-FRAMEWORKS.md`.

---

## Orden y dependencias

```
FASE 0 (limpieza) ─→ FASE 1 (contrato artefactos) ─→ FASE 2 (CLI portable) ─→ FASE 3 (adaptadores) ─→ FASE 5 (docs)
                                                                                      │
                                                                                      └─→ FASE 4 (drivers LLM, v2 opcional)
```

- **FASE 1 es ahora la prioritaria** (no la limpieza): el contrato de artefactos es la esencia del agnosticismo estilo Spec Kit.
- FASE 4 es opcional y no bloquea el objetivo v1.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| El formato Spec Kit/OpenSpec evoluciona | La capa de export aísla el cambio; `.sdd/` interno permanece estable |
| Desacoplar `CLAUDE_AGENT_NAME` rompe la memoria por agente | El adaptador inyecta la identidad; `agent-memory.js` ya tiene fallback `"main"` |
| Driver de inferencia v2 se vuelve un agujero negro | Está fuera del camino crítico de v1; se aborda solo si v1 lo justifica |

## Verificación global (end-to-end)

1. `npm test` verde en cada fase.
2. **Prueba de agnosticismo:** generar un `.sdd/` con FORGE, exportarlo a formato Spec Kit, y verificar que es consumible sin ningún binario de FORGE ni Claude Code.
3. `forge plan` corre en CI puro (sin Claude) y transiciona `estado.json` vía la state machine real.
4. La misma tarea produce artefactos equivalentes por el adaptador Claude y por el adaptador portable.
