# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.0.0] — 2026-06-25

### Añadido
- `forge logs [--last N]`: historial de consumo de tokens con totales USD
- Event-bus en proceso (`core/event-bus.ts`): SessionBudget y CircuitBreaker conectados al Orchestrator
- `forge doctor`: verifica `ANTHROPIC_API_KEY`, archivos de hook en disco y sintaxis via `node --check`
- `forge status`: muestra presupuesto de sesión (tokens + USD) y nivel del circuit breaker
- Stack detector: soporte Ruby (Rails/Sinatra) y PHP (Laravel/Symfony)
- Timeouts por agente configurables vía `timeout_ms` en `sdd.config.yaml`
- Snapshots automáticos de `estado.json` (retiene últimos 5)

### Mejorado
- Preset lean por defecto: 6 agentes activos (arquitecto, backend, tester, revisor, seguridad, documentador), 8 opcionales con documentación
- `pre-tool-guard`: restricciones dinámicas sandbox/local/confirmado por nivel del CircuitBreaker — nivel sandbox bloquea Bash
- `checkCoverage`: filtra comentarios JS/Python/HTML antes de buscar `REQ-NNN`
- `CLAUDE_MD_VERSION`: usa `pluginVersion()` dinámica en lugar de string hardcodeada

### Corregido
- `npx forge-sdd` → `npx forge` en README (7 ocurrencias)
- Bug in-degree negativo en ordenación topológica de Kahn del Orchestrator
- Falso positivo grep `.env` en `pre-tool-guard` (ahora solo bloquea escrituras)
- Paths hardcodeados `C:\Users\usuario\` eliminados del template `settings.json`

### Tests
- 907/907 tests pasando (antes: 848)

---

## [3.1.0] - 2026-06-21

### Added
- **`forge.config.json`** — archivo de configuración avanzada de FORGE, leído por `agent-memory.js` y `pre-tool-guard.js`. Controla umbral de compresión de memoria, routing de modelos y guardrails. Si no existe, se usan valores por defecto seguros. Ejemplo en `configuracion-ejemplo/forge.config.json`.
- **Umbral de compresión configurable** (`agent-memory.js`): el valor `memoria.umbral_compresion_bytes` de `forge.config.json` sustituye al anterior hardcode de 50KB. Default nuevo: 40KB.
- **Routing dinámico Opus→Sonnet** (`sdd.planificar.md`): en PASO 1b, lee `ir.json` para determinar `estimated_complexity`. Si es `low` o `medium`, el agente arquitecto usa Sonnet (5× más barato). Configurable con `routing.usar_complexity_ir`.
- **`verify_local_imports` opt-in** (`pre-tool-guard.js`): cuando `guardrails.verify_local_imports: true` en `forge.config.json`, advierte en stderr si un import relativo en un `.js`/`.ts` no existe en disco. Desactivado por defecto (puede dar falsos positivos con barrel files).
- **`docs/guardrails.md`** — documentación completa de todos los guardrails activos: qué bloquea, qué advierte, cómo configurar y cómo desactivar selectivamente.
- **`docs/ejemplo-todo-app.md`** — walkthrough end-to-end completo: idea → IR → diseño → spec → plan → implementación → QA, con output real de cada comando y anotaciones de qué protección activó FORGE en cada paso.
- **Sección guardrails en `README.md`** — tabla resumen de protecciones activas por defecto, visible desde la página principal.
- **Sección configuración en `QUICK-START.md`** — explica `forge.config.json` y los guardrails en lenguaje no técnico.

### Changed
- `leerConfig()` en `agent-memory.js` ahora llama primero a `leerForgeConfig()` para obtener el umbral desde `forge.config.json` antes de leer `sdd.config.yaml`. La precedencia es: `sdd.config.yaml` > `forge.config.json` > defaults.
- `pre-tool-guard.js` importa ahora `readFileSync` y `resolve`/`dirname` de `node:path` (antes no los usaba).

### Internals
- `ProjectMemory.read()` ya tenía memoización por `mtime` desde v2.8.0 — documentado explícitamente en este CHANGELOG. No se añadió código nuevo.

---

## [3.0.0] - 2026-06-21

### Added
- **`sdd-es init --guided`** — wizard interactivo que pregunta perfil (experto/guiado), modelo y modo de sesión, y pre-configura `sdd.config.yaml` automáticamente.
- **Comando `/sdd.crear-agente`** — wizard que genera `agents/{nombre}.md`, lo registra en `plugin.json`, añade a `READ_ONLY_AGENTS` si es analista, y actualiza el enrutador.
- **Dashboard de sesión en `/sdd.estado`** — muestra modo de sesión actual, estado del índice AST y entradas de memoria en el dashboard técnico.
- **`CONTRIBUTING.md`** — guía completa para añadir agentes, comandos, reportar bugs y proceso de review.
- **`.github/ISSUE_TEMPLATE/bug_report.md`** — template de bug con campos de entorno y output de doctor.
- **`.github/ISSUE_TEMPLATE/agent_proposal.md`** — template para proponer nuevos agentes con criterios de aceptación.
- Comando `/sdd.crear-agente` registrado en `plugin.json`, `sdd.ayuda.md` y enrutador `sdd.md`.

### Changed
- `package.json` y `plugin.json` bumpeados a `3.0.0` con description actualizada.

---

## [2.8.0] - 2026-06-21

### Added
- **Memoria inteligente con índice JSONL** (`agent-memory.js`): además del archivo markdown por agente, se genera `.sdd/memoria/indice.jsonl` (append-only) con metadatos resumidos para recuperación selectiva sin leer archivos completos.
- **`claude-hooks/query-memory.js`** — CLI de consulta del índice: `--ultimas N`, `--buscar término`, `--archivo path`, `--stats`.
- **Alerta proactiva de MEMORY.md**: `agent-memory.js` avisa en stderr cuando el MEMORY.md global supera 150 líneas (límite oficial: 200).
- **AST indexer con acorn** (`claude-hooks/ast-indexer.js`): genera `.sdd/arquitectura/ast-index.jsonl` con exports, imports y funciones de todos los archivos JS/TS del proyecto.
- **`claude-hooks/ast-query.js`** — CLI de consulta AST: `--archivo`, `--tipo`, `--buscar`, `--stats`, `--limite`.
- **Skill `/indexar-proyecto`** — invoca `ast-indexer.js` sobre el proyecto completo.
- **`chmod 777` en PROHIBIDOS** de `pre-tool-guard.js` — bloquea permisos inseguros en Bash.
- **Verificación de existencia antes de `Edit`** en `pre-tool-guard.js` — bloquea edición de archivos inexistentes con mensaje útil.
- **`docs/OPTIMIZACION-ENTORNO.md`** — referencia de variables de entorno, límites reales de Claude Code (CLAUDE.md 4K chars, MEMORY.md 200 líneas, hooks oficiales) y qué sobrevive a `/compact`.
- **`docs/INFORME-MEMORIA-OSS.md`** — investigación comparativa de 4 repos OSS de memoria para Claude Code vs FORGE.
- **Sección `sesion:` en `sdd.config.yaml`** — modo `normal/rapido/prototipo` y lista de pasos a omitir.
- **Flags de modo en comandos clave**: `/sdd.planificar rapido|prototipo`, `/sdd.implementar rapido|prototipo`, `/sdd.especificar rapido|prototipo`.
- **Comando `/sdd.modo`** — cambia o muestra el modo de sesión actual sin editar YAML manualmente.
- **Subcomandos `show` y `set` en `/sdd.configurar`** — `show [sección]` muestra el YAML filtrado; `set clave.subclave valor` edita un valor específico con confirmación.
- **Auditoría CLAUDE.md en `doctor`** — alerta si el CLAUDE.md local supera 3,500 chars (límite oficial: 4,000).
- **Validación de `sdd.config.yaml` en `doctor`** — verifica claves obligatorias (`agentes:`, `comportamiento:`), `umbral_bytes` positivo y modelos válidos.

### Fixed
- Corregido mismatch de versión entre `package.json` (2.7.0) y `plugin.json` (2.6.0) — ambos ahora en 2.8.0.

### Tests
- +15 tests nuevos (total: 775 → ahora consolidado en 767 post-refactor de suite).
- Nuevos describes: índice JSONL agent-memory (#8), ast-indexer, ast-query, chmod 777, Edit sobre inexistente.

---

## [2.6.0] - 2026-06-20

Consolidación del pipeline **FORGE** (idea → producto para no-programadores) y
saneamiento de ingeniería. Esta entrada agrupa el trabajo posterior a 2.3.0.

### Added
- **Pipeline FORGE** (idea → MVP): comandos `/sdd.interpretar`, `/sdd.diseñar`,
  `/sdd.construir`, `/sdd.exportar` y los agentes `product-designer` y
  `architecture-designer`.
- **Modo guiado por defecto**: el hub `/sdd` conduce sin jerga, decide lo técnico
  por el usuario y encadena el flujo FORGE automáticamente. El flujo clásico para
  desarrolladores queda como "modo avanzado" (`perfil: experto`).
- Mapper `core/ir-to-spec-mapper.js` (artefacto ejecutable) que convierte IR +
  ProductDesign en una spec borrador.
- Auto-compresión de memoria, ADR Indexer y tracking de Defect Rate.

### Fixed
- `npx sdd-es init` dejaba de funcionar: la plantilla `settings.json` se buscaba
  en una ruta inexistente. Ahora se resuelve desde `.claude-plugin/.claude/` y se
  omite con aviso si no está.
- `/sdd.construir` invocaba un mapper en `sdd-lite/core/*.js` (ruta y extensión
  inexistentes). Ahora usa el `.js` distribuido vía `$CLAUDE_PLUGIN_ROOT`.
- Comando fantasma `sdd.md` registrado en `plugin.json` (rompía la suite de tests).
- Nombre del MCP de navegador unificado a `playwright` (antes `navegador`).
- Enlaces rotos en el README (`EJEMPLO-PRACTICA.md`,
  `RESUMEN-EJECUTIVO-NO-TECNICOS.md`).

### Changed
- `QUICK-START.md` reescrito como guía real para no-programadores (el antiguo plan
  de mercado se movió a `docs/PLAN-GO-TO-MARKET.md`).

## [2.3.0] - 2026-06-13

### Added

#### Dashboard de Estado
- Página "Estado" en UI web: fase actual, progreso %, tareas completadas/totales
- Auto-refresh cada 5s: usuario ve progreso en tiempo real sin recargar
- 4 cards informativos: especificación, tareas, perfil, progreso
- Onboarding banner: si proyecto no inicializado, muestra pasos claros

#### Tracker de Tokens
- Página "Tokens" en UI web: estima tokens consumidos en contexto
- Cálculo USD: muestra costo estimado (Sonnet 4.6 @ $0.003/1K tokens)
- Desglose por tipo: constitucion.md, specs, planes, tareas
- Botón "/sdd.comprimir": atajos para comprimir si necesario

#### Recomendador de Presets Inteligente
- Wizard 4 opciones: solitario, equipo pequeño, empresa, datos sensibles
- Recomendación automática: resalta preset correcto con ⭐ badge
- Explicaciones: "Por qué recomendamos esto para tu situación"

#### Seguridad Mejorada
- `.gitignore` automático: protege .sdd/.vercel-deploy.json, .env, tokens
- Documentación SEGURIDAD-PARA-NOTECNICOS.md: guía completa para no-técnicos
- Advertencia en README: sección 🔐 SEGURIDAD visible desde inicio
- Validación inmediata de tokens: GitHub y Vercel CLI validan antes de usar

### Fixed

#### Auto-Commit Silencioso en Vercel Deploy
- Pre-checks de git ahora auto-commitean: en lugar de error mostrando `git commit`
- Usuario NO ve comandos git: "git add", "git commit", "git push" invisibles
- Cambios se guardan automáticamente: `git add -A && git commit "Auto-commit SDD-ES deploy"`
- Impacto: No-técnicos pueden completar flujo GitHub → Vercel sin fricción

#### Validación de Rutas
- PASO 4 (GitHub): path relativa correcta en invocación bash
- PASO 10 (Vercel): path relativa correcta en invocación bash

#### Sintaxis en server.js
- Línea 145: `function estimar Tokens` → `function estimarTokens`

### Security

#### Protección de Credentials
- ✅ Tokens GitHub/Vercel en variables de entorno (NO archivos)
- ✅ .gitignore creado (30+ entradas críticas)
- ✅ sdd.config.yaml NO guarda tokens (solo URLs)
- ✅ .sdd/.vercel-deploy.json ignorado automáticamente

#### Validación de Tokens
- ✅ GitHub: `gh auth status --show-token` valida antes de usar
- ✅ Vercel: `vercel whoami` valida antes de usar
- ✅ Si token inválido, sale inmediatamente

#### Documentación de Seguridad
- docs/SEGURIDAD-PARA-NOTECNICOS.md: 1000+ líneas
- docs/V2.3.0-ANALISIS-SEGURIDAD.md: análisis técnico
- Guía de recuperación si error
- Cómo generar token SEGURO (90 días expiration)

### Documentation

#### Nuevos Documentos
- docs/V2.3.0-CERTIFICACION-NONTECNICOS.md: Validación E2E
- docs/V2.3.0-ANALISIS-SEGURIDAD.md: Análisis de riesgos
- docs/V2.3.0-REPUTACION-SEGURIDAD.md: Impacto en reputación
- docs/V2.3.0-CHECKLIST-PRELANZAMIENTO.md: Checklist completo
- docs/V2.3.0-RESUMEN-EJECUTIVO-FINAL.md: Resumen ejecutivo
- docs/SEGURIDAD-PARA-NOTECNICOS.md: Guía de seguridad

#### Documentos Actualizados
- README.md: agregada sección 🔐 SEGURIDAD

### Files
- `.gitignore`: creado con protecciones críticas

## [2.1.0] - 2026-06-12

### Added
- Gate humano en `/sdd.implementar` con resumen de tareas y tokens
- Deep reasoning instructions en 4 agentes OPUS (arquitecto, crítico, seguridad, asesor-datos)
- Roadmap v2.2 documentado en docs/roadmap-v2.2.md
- Vercel deployment skill (opción A: sincrónica)
- CLI command `/sdd.config` abre UI de configuración en navegador (puerto 7842)

### Fixed
- RegExp injection vulnerability en patchYamlAgentes (SLUG_RE validation)
- Buffer DoS en parseBody (64KB limit)
- NaN validation en patchYamlCalidad
- Path traversal en leerPreset (SLUG_RE whitelist)

### Changed
- Removed `effort:` from agents (no es campo oficial de Claude Code)
- Model routing instructions en sdd.implementar y sdd.analizar

## [2.0.0] - 2026-05-15

### Added
- 26 comandos (sdd.*, especificar, planificar, implementar, analizar, verificar, etc.)
- 12 agentes especializados (arquitecto, revisor, seguridad, asesor-datos, etc.)
- 10 skills (modo-guiado, orquestacion-ptc, validacion-spec, etc.)
- 2 MCPs integrados (Figma, Playwright)
- Modo guiado para usuarios no-técnicos
- Preset enterprise con compliance (SOC2, GDPR, ISO 27001)
- QA en navegador real (Playwright)

## [1.0.0] - 2026-03-01

### Added
- Initial release
- SDD methodology foundation
- Basic command structure
