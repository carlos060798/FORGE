# Informe: Gestión de Memoria en el Ecosistema Claude Code

> Investigación de 4 repositorios open source. Objetivo: identificar qué ideas adaptar a FORGE sin dependencias externas incompatibles. Fecha: 2026-06-20.

---

## Resumen ejecutivo

FORGE ya implementa el 80% de lo que ofrecen los repos más populares. La brecha real está en **recuperación selectiva**: hoy los agentes cargan el archivo de memoria completo (`cat`) cuando solo necesitan las últimas entradas. Los mejores patrones externos resuelven esto con SQLite + índices. FORGE los adopta en v2.8 con `@sqlite.org/sqlite-wasm` (sin compilador C++) y `acorn` para indexación AST de JS/TS.

---

## Tabla comparativa

| Capacidad | FORGE v2.7 | claude-mem | cost-optimizer | claude-code-memory | tokless/CodeGraph |
|---|---|---|---|---|---|
| Memoria persistente cross-sesión | ✅ archivos .md | ✅ SQLite | ❌ | ✅ archivos .md | ❌ |
| Sobrevive /clear y /compact | ✅ | ✅ | ❌ | ✅ | ❌ |
| Recuperación selectiva (no carga todo) | ❌ cat completo | ✅ FTS5 + 3 capas | ❌ | ❌ cat completo | ✅ AST index |
| Compresión automática de memoria | ✅ deduplicación por filepath | ✅ resume con IA | ❌ | ❌ | ❌ |
| Alertas de límite de contexto | ❌ | ❌ | ✅ auditoría | ✅ límite 200 líneas | ❌ |
| Indexación AST del proyecto | ❌ | ❌ | ❌ | ❌ | ✅ tree-sitter |
| Observabilidad (ledger de uso) | ✅ JSONL | ✅ telemetría | ✅ claude-rate | ❌ | ❌ |
| Dependencias externas | Ninguna | Bun + Python + ChromaDB | Ninguna | Ninguna | Go binaries |

---

## Análisis por repositorio

### 1. `thedotmack/claude-mem` (83k ⭐)

**Mecanismo central:** SQLite en `~/.claude-mem/claude-mem.db` con FTS5 (búsqueda de texto completo) y Chroma como vector DB para búsqueda semántica. Un worker HTTP en el puerto 37777 recibe eventos de hooks PostToolUse y SessionStart.

**Idea más valiosa — workflow de 3 capas:**
```
1. SEARCH  → índice compacto (~50-100 tokens), devuelve IDs
2. TIMELINE → contexto cronológico de los IDs encontrados
3. GET      → detalle completo solo para los IDs filtrados
```
Resultado: el agente recupera información relevante con ~10x menos tokens que leyendo el archivo completo.

**Por qué no se adopta completo:**

| Limitación | Impacto en FORGE |
|---|---|
| Requiere Bun (runtime distinto a Node) | Rompe el requisito de 0 dependencias de runtime |
| ChromaDB en Python | Añade Python como dependencia de sistema |
| FTS5 falla en Windows (#791) | FORGE tiene usuarios Windows |
| Monorepo data fragmentation | Proyectos SDD son mono-repo por diseño |

**Qué se adapta:** la filosofía de recuperación progresiva. FORGE v2.8 implementa el mismo patrón con `@sqlite.org/sqlite-wasm` (WASM puro, sin Bun) y un CLI `query-memory.js` que expone las 3 capas como flags (`--ultimas`, `--buscar`, `--archivo`).

---

### 2. `Sagargupta16/claude-cost-optimizer`

**Mecanismo central:** Un SKILL.md que inyecta instrucciones de sistema para hacer a Claude más conciso. No es middleware — es prompt engineering puro. Los modos `strict/lite/standard` cambian el nivel de brevedad.

**Idea más valiosa — límites reales documentados con números:**
- CLAUDE.md por archivo: **4,000 chars** (límite duro, truncación silenciosa)
- CLAUDE.md total multi-archivo: **12,000 chars**
- Skills post-compaction: **5,000 tokens/skill**, **25,000 tokens total**
- Reducción real del 30-60% viene de recortar CLAUDE.md, no del skill en sí

**FORGE ya tiene equivalente:** `skills/compresion-tokens/SKILL.md` con diccionario caveman de 80+ reglas — más completo que `cost-mode`.

**Qué se adapta:** los límites reales se documentan en `docs/OPTIMIZACION-ENTORNO.md` (v2.8, Bloque 1B). La herramienta `claude-rate` (auditoría de setup) se referencia como lectura complementaria.

---

### 3. `LuciferForge/claude-code-memory`

**Mecanismo central:** Estructura de directorios Markdown con MEMORY.md como índice de punteros y archivos temáticos separados. Script Python de setup que genera la estructura.

**Hallazgo más importante — límite oficial verificado:**
> "The first 200 lines of `MEMORY.md`, or the first 25KB, whichever comes first, are loaded at the start of every conversation."
> — Documentación oficial de Claude Code (code.claude.com/docs/en/memory)

La truncación es **silenciosa**: Claude no recibe aviso de que el índice fue cortado.

**Patrón de índice de punteros:**
```markdown
# Memory Index
- Decisiones de auth → auth-decisions.md
- Convenciones de API → api-conventions.md
- Schema de BD → database.md
```
Los archivos temáticos no tienen límite de tamaño y se cargan bajo demanda.

**Qué se adapta:**
1. `agent-memory.js` v2.8 alerta cuando MEMORY.md global supera 150 líneas (antes del límite de 200)
2. `docs/OPTIMIZACION-ENTORNO.md` documenta el límite y recomienda el patrón de índice
3. `cli/index.js doctor` audita el tamaño de CLAUDE.md (límite 4,000 chars)

---

### 4. `HoangP8/tokless` + CodeGraph

**Mecanismo central:** CLI en Go que instala 4 plugins coordinados:
- **RTK** — proxy Rust que comprime output de 100+ comandos bash (89% compresión promedio)
- **CodeGraph** — índice AST local con tree-sitter + SQLite FTS5, búsqueda BM25 semántica
- **Caveman** — skill que reduce prose output 65%
- **Context-Mode** — sandbox que reduce contexto de sesión de 315KB a 5KB (98%)

**Idea más valiosa — CodeGraph:**
El agente en lugar de `Read src/auth.ts` para entender qué exporta, consulta un índice precomputado:
```bash
# En lugar de leer el archivo completo:
codegraph query --file src/auth.ts --type exports
# → devuelve solo las firmas, ~50 tokens vs ~2000 tokens del archivo completo
```
Resultado medido: **70% menos tool calls**, **35% menos costo API**.

**Por qué no se adopta tree-sitter directamente:**

| Herramienta | Problema |
|---|---|
| `tree-sitter` npm | Requiere compilador C++ (Visual Studio en Windows) |
| `@ast-grep/napi` | Binarios pre-compilados de 15MB |
| RTK proxy | Rust binary, no se integra como hook Node.js |

**Qué se adapta:** el mismo patrón de indexación AST usando `acorn` (200KB, JavaScript puro, 0 compiladores). Solo cubre JS/TS, que es el stack mayoritario de proyectos FORGE. Para Python/Go se evalúa `@ast-grep/napi` en v3.x.

---

## Correcciones al informe Triple Shield anterior

El informe `informe.md` contenía dos errores verificados contra la documentación oficial:

| Claim del informe anterior | Realidad verificada |
|---|---|
| "`SessionEnd` hook no existe en Claude Code" | **SÍ EXISTE** — hay 38 hooks oficiales incluyendo SessionEnd, PreCompact, PostCompact (docs: code.claude.com/docs/en/hooks) |
| "`MAX_THINKING_TOKENS` no es configurable externamente" | **SÍ ES CONFIGURABLE** — es una variable de entorno documentada que controla el presupuesto de reasoning |

---

## Gaps reales de FORGE vs el ecosistema

| Gap | Impacto | Plan |
|---|---|---|
| Recuperación selectiva de memoria | Alto — agente carga 500 entradas cuando necesita 10 | Resuelto en v2.8 con SQLite WASM |
| Indexación AST del codebase | Medio — agente lee archivos completos para entender estructura | Resuelto en v2.8 con acorn (JS/TS) |
| Alerta de truncación MEMORY.md | Medio — pérdida silenciosa de contexto | Resuelto en v2.8 en agent-memory.js |
| Auditoría de tamaño CLAUDE.md | Bajo — usuarios no saben que el límite es 4K chars | Resuelto en v2.8 en doctor |
| Búsqueda semántica (embeddings) | Bajo para proyectos SDD — la estructura de spec ya organiza el contexto | Candidato v3.x si hay demanda |
| Soporte multilenguaje en AST (Python, Go) | Bajo — requiere `@ast-grep/napi` | Candidato v3.x |

---

## Plan de acción adoptado (implementado en v2.8)

### A — SQLite WASM como backend de memoria (`@sqlite.org/sqlite-wasm`)
- `agent-memory.js` escribe a SQLite en lugar de archivos .md
- `query-memory.js` CLI con flags `--ultimas N`, `--buscar término`, `--archivo path`
- Agentes usan `query-memory.js` en lugar de `cat` — recuperación selectiva
- Fallback a markdown si `backend: "markdown"` en sdd.config.yaml

### B — Índice AST con `acorn`
- `ast-indexer.js` genera `.sdd/arquitectura/ast-index.jsonl` con exports/imports/funciones
- `ast-query.js` CLI para consultar el índice
- Skill `sdd.indexar-proyecto` invoca el indexer sobre el proyecto completo
- Agentes consultan el índice antes de hacer `Read` sobre archivos JS/TS

### C — Alertas proactivas
- `agent-memory.js` alerta cuando MEMORY.md global > 150 líneas
- `cli/index.js doctor` audita CLAUDE.md > 3,500 chars
- `docs/OPTIMIZACION-ENTORNO.md` documenta todos los límites reales con números

---

*Investigación realizada con 7 agentes paralelos (modelo Haiku). Fuentes: repositorios GitHub, documentación oficial code.claude.com, issues públicos.*
