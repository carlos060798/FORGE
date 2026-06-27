/* ============================================================
   FORGE Docs — datos v4.2.0 (bilingüe ES/EN)
   Actualizado: 2026-06-27 — refleja Etapas 0-5 completadas
   ============================================================ */

const UI = {
  es: {
    brand_tag: "v4.2.0",
    search_placeholder: "Buscar…",
    search_input_placeholder: "Buscar en la documentación…",
    search_navigate: "navegar",
    search_open: "abrir",
    search_close: "cerrar",
    footer_text: "FORGE v4.2.0 · Spec-Driven · MIT License",
    search_no_results: "Sin resultados",
    groups: {
      overview:  "◈ El framework",
      technical: "⬡ Arquitectura",
      operate:   "▶ Operación",
      extend:    "✦ Extensibilidad"
    }
  },
  en: {
    brand_tag: "v4.2.0",
    search_placeholder: "Search…",
    search_input_placeholder: "Search the docs…",
    search_navigate: "navigate",
    search_open: "open",
    search_close: "close",
    footer_text: "FORGE v4.2.0 · Spec-Driven · MIT License",
    search_no_results: "No results",
    groups: {
      overview:  "◈ The framework",
      technical: "⬡ Architecture",
      operate:   "▶ Operation",
      extend:    "✦ Extensibility"
    }
  }
};

const GROUP_ORDER = ["overview", "technical", "operate", "extend"];

const PAGES = {

/* ─────────────────────────────────────────────────────────────
   GRUPO 1 — El framework
───────────────────────────────────────────────────────────── */

"vision-general": {
  seccion: "overview",
  es: {
    titulo: "Visión General",
    html: `
      <h1>Visión General</h1>
      <p class="lead">FORGE es un framework de <strong>Spec-Driven Development (SDD) + Test-Driven Development (TDD)</strong> para Claude Code. Convierte ideas en lenguaje natural en software especificado, planificado e implementado por un equipo de 14 agentes de IA — y produce artefactos portables que cualquier otro agente puede consumir.</p>

      <div class="callout tip">
        <p><strong>Instalación rápida (npm):</strong> <code>npm install -g forja-mvp</code> · <code>forge doctor</code></p>
        <p><strong>Desde el repositorio:</strong> <code>git clone https://github.com/carlos060798/FORGE &amp;&amp; cd FORGE &amp;&amp; npm install</code></p>
      </div>

      <h2>Qué es FORGE (v4.2.0)</h2>
      <p>Tiene dos modos de uso:</p>
      <table>
        <thead><tr><th>Modo</th><th>Cómo se usa</th><th>Requiere Claude Code</th></tr></thead>
        <tbody>
          <tr><td><strong>Plugin Claude Code</strong></td><td>Slash commands <code>/forge</code>, <code>/sdd.*</code> dentro de Claude Code</td><td>Sí</td></tr>
          <tr><td><strong>Runner portable</strong></td><td>CLI de terminal: <code>forge status</code>, <code>forge run</code>, <code>forge aprobar spec</code></td><td>No</td></tr>
        </tbody>
      </table>

      <table>
        <thead><tr><th>Dimensión</th><th>Descripción</th></tr></thead>
        <tbody>
          <tr><td><strong>Categoría</strong></td><td>Framework SDD+TDD con runner CLI portable</td></tr>
          <tr><td><strong>Host principal</strong></td><td>Claude Code CLI (Anthropic)</td></tr>
          <tr><td><strong>Runner standalone</strong></td><td><code>forge status</code>, <code>forge run</code>, <code>forge aprobar spec</code> — sin Claude Code</td></tr>
          <tr><td><strong>Distribución</strong></td><td><code>npm install -g forja-mvp</code> · o git clone desde el repo</td></tr>
          <tr><td><strong>Dependencias runtime</strong></td><td>2 (<code>acorn</code> + <code>@sqlite.org/sqlite-wasm</code>)</td></tr>
          <tr><td><strong>Lenguaje</strong></td><td>Node.js ESM + JS puro con JSDoc (sin compilación)</td></tr>
          <tr><td><strong>Tests</strong></td><td>998/998 pasando (Node test runner nativo)</td></tr>
        </tbody>
      </table>

      <h2>Misión</h2>
      <blockquote>Hacer que cualquier persona técnica pueda construir software propio con el mismo rigor metodológico que un equipo de ingeniería profesional — sin depender de un host específico.</blockquote>

      <h2>Posicionamiento</h2>
      <pre><code class="text">                  CONTROL DEL OUTPUT
                  Alto ◄──────────────────────► Bajo

Developer     Cursor/Copilot   [FORGE]    Lovable    Bubble
tools          (asistencia)  (orquesta) (GUI SaaS) (no-code)

COMPLEJIDAD:    Alta            Media       Baja      Mínima
AUDIENCIA:      Dev prof.    Técnico-MVP  No técnico  No técnico
PORTABLE:       —               ✅          —          —</code></pre>

      <div class="callout tip">
        <p><strong>Próximo paso:</strong> Lee <a href="#capacidades">Capacidades</a> para ver qué puede hacer FORGE en detalle.</p>
      </div>
    `
  },
  en: {
    titulo: "Overview",
    html: `
      <h1>Overview</h1>
      <p class="lead">FORGE is a <strong>Spec-Driven Development (SDD) + Test-Driven Development (TDD)</strong> framework for Claude Code. It turns natural-language ideas into specified, planned, and implemented software — and produces portable artifacts any agent can consume.</p>

      <div class="callout tip">
        <p><strong>Quick install:</strong> <code>npm install -g forja-mvp</code> · or <code>git clone https://github.com/carlos060798/FORGE &amp;&amp; npm install</code></p>
      </div>

      <h2>Two modes of use</h2>
      <table>
        <thead><tr><th>Mode</th><th>How to use</th><th>Requires Claude Code</th></tr></thead>
        <tbody>
          <tr><td><strong>Claude Code plugin</strong></td><td>Slash commands <code>/forge</code>, <code>/sdd.*</code> inside Claude Code</td><td>Yes</td></tr>
          <tr><td><strong>Portable runner</strong></td><td>Terminal CLI: <code>forge status</code>, <code>forge run</code>, <code>forge aprobar spec</code></td><td>No</td></tr>
        </tbody>
      </table>

      <div class="callout tip">
        <p><strong>Next:</strong> Read <a href="#capacidades">Capabilities</a> for full details.</p>
      </div>
    `
  }
},

"capacidades": {
  seccion: "overview",
  es: {
    titulo: "Capacidades",
    html: `
      <h1>Capacidades</h1>
      <p class="lead">Lo que FORGE puede hacer hoy, con qué madurez y qué componentes están involucrados.</p>

      <h2>Pipeline SDD+TDD completo</h2>
      <p>39 comandos que implementan el ciclo completo de desarrollo de software, desde la idea hasta el despliegue. La state machine valida las transiciones — ningún paso puede saltarse sin <code>--force</code>.</p>

      <table>
        <thead><tr><th>Fase</th><th>Paso pipeline</th><th>Artefacto</th><th>CLI runner</th></tr></thead>
        <tbody>
          <tr><td>Interpretación</td><td><code>ir</code></td><td><code>.sdd/ir.json</code></td><td><code>forge step ir</code></td></tr>
          <tr><td>Descubrimiento</td><td><code>discovery</code></td><td>Contexto enriquecido</td><td><code>forge step discovery</code></td></tr>
          <tr><td>Diseño</td><td><code>design</code></td><td><code>product-design.json</code></td><td><code>forge step design</code></td></tr>
          <tr><td>Especificación</td><td><code>spec</code></td><td><code>spec.md</code> con HUs, CAs, RF, NFR</td><td><code>forge step spec</code></td></tr>
          <tr><td>Planificación</td><td><code>plan</code></td><td>Plan técnico + ADRs en SQLite</td><td><code>forge step plan</code></td></tr>
          <tr><td>Tareas</td><td><code>tasks</code></td><td><code>estado-tareas.json</code></td><td><code>forge step tasks</code></td></tr>
          <tr><td>Implementación</td><td><code>code</code></td><td>Código + tests TDD</td><td><code>forge step code</code></td></tr>
          <tr><td>Completado</td><td><code>done</code></td><td>Proyecto entregado</td><td><code>forge step done</code></td></tr>
        </tbody>
      </table>

      <h2>14 Agentes especializados</h2>
      <table>
        <thead><tr><th>Agente</th><th>Modelo</th><th>Rol</th><th>Permisos</th></tr></thead>
        <tbody>
          <tr><td><code>arquitecto</code></td><td>Opus</td><td>Decisiones técnicas, ADRs, diseño de sistema</td><td>Read-only</td></tr>
          <tr><td><code>product-designer</code></td><td>Opus</td><td>UX, user flow, pantallas, alcance MVP</td><td>Read-only</td></tr>
          <tr><td><code>critico</code></td><td>Opus</td><td>Riesgos, puntos ciegos, deuda técnica</td><td>Read-only</td></tr>
          <tr><td><code>seguridad</code></td><td>Opus</td><td>Auditoría de vulnerabilidades</td><td>Read-only</td></tr>
          <tr><td><code>asesor-datos</code></td><td>Opus</td><td>Modelado BD, queries, migraciones</td><td>Read-only</td></tr>
          <tr><td><code>revisor</code></td><td>Opus</td><td>Code review contra spec y calidad</td><td>Read-only</td></tr>
          <tr><td><code>desarrollador-backend</code></td><td>Sonnet</td><td>Implementación servidor, APIs</td><td>Write</td></tr>
          <tr><td><code>desarrollador-frontend</code></td><td>Sonnet</td><td>UI, componentes, estado cliente</td><td>Write</td></tr>
          <tr><td><code>tester</code></td><td>Sonnet</td><td>Tests unitarios, integración, E2E</td><td>Write</td></tr>
          <tr><td><code>operaciones</code></td><td>Sonnet</td><td>CI/CD, deploy, infraestructura</td><td>Write</td></tr>
          <tr><td><code>disenador-api</code></td><td>Sonnet</td><td>Contratos OpenAPI/GraphQL/gRPC</td><td>Read-only</td></tr>
          <tr><td><code>investigador</code></td><td>Sonnet</td><td>Análisis de contexto técnico existente</td><td>Read-only</td></tr>
          <tr><td><code>architecture-designer</code></td><td>Sonnet</td><td>Stack técnico para MVP</td><td>Read-only</td></tr>
          <tr><td><code>documentador</code></td><td>Sonnet</td><td>Documentación técnica (opt-in)</td><td>Write</td></tr>
        </tbody>
      </table>

      <h2>Capacidades del runner portable (sin LLM)</h2>
      <p>Desde v4.1.0, el pipeline puede gestionarse desde cualquier terminal, sin Claude Code instalado:</p>
      <pre><code class="bash">forge status              # Visual del pipeline con colores
forge step discovery      # Avanza con guards de la state machine
forge step ir --force     # Fuerza sin guards (recuperación)
forge validate            # Verifica precondiciones del paso actual
forge export --format=speckit   # Exporta artefactos portables
forge dispatch --agente=arquitecto --tarea="Diseñar API REST"
forge decisions search "autenticación"   # Búsqueda semántica TF-IDF</code></pre>

      <h2>Otras capacidades clave</h2>
      <ul>
        <li><strong>Guardrails en tiempo real</strong> — Hook <code>pre-tool-guard.js</code> bloquea comandos destructivos, detecta secrets y ADR violations</li>
        <li><strong>Enforcement de agentes</strong> — 7 agentes read-only: el hook bloquea cualquier Write/Edit aunque se intente</li>
        <li><strong>Memoria persistente por agente</strong> — SQLite (Node ≥22.5) o Markdown (Node ≥18), auto-seleccionado</li>
        <li><strong>Store de decisiones SQLite</strong> — ADRs con búsqueda semántica TF-IDF, versionado y consolidación por antigüedad</li>
        <li><strong>Context manager</strong> — Presupuesto USD enforced por sesión, resumen progresivo, alerta de tier</li>
        <li><strong>Adaptadores de host</strong> — Claude Code adapter + Spec Kit portable adapter (consumible por Cursor, Copilot, Gemini)</li>
        <li><strong>Artefactos portables</strong> — <code>forge export --format=speckit|openspec</code> genera artefactos sin FORGE instalado</li>
        <li><strong>Observabilidad completa</strong> — <code>consumo.jsonl</code> + <code>budget-state.json</code> registran cada acción y gasto</li>
        <li><strong>Templates de inicio rápido</strong> — <code>api-rest</code>, <code>cli-tool</code>, <code>saas-mvp</code></li>
        <li><strong>Circuit breaker</strong> — 3 niveles: sandbox / local / confirmado</li>
      </ul>
    `
  },
  en: {
    titulo: "Capabilities",
    html: `
      <h1>Capabilities</h1>
      <p class="lead">What FORGE can do today, at what maturity, and which components are involved.</p>

      <h2>Portable runner (no LLM required)</h2>
      <pre><code class="bash">forge status              # Visual pipeline with colors
forge step discovery      # Advance with state machine guards
forge step ir --force     # Force without guards (recovery)
forge validate            # Check current step preconditions
forge export --format=speckit   # Export portable artifacts
forge dispatch --agente=main --tarea="Design REST API"
forge decisions search "authentication"  # TF-IDF semantic search</code></pre>

      <h2>14 specialized agents</h2>
      <p>6 agents are strictly read-only (enforced at hook level — not configurable). 8 agents can write files.</p>

      <h2>Key capabilities</h2>
      <ul>
        <li><strong>Real-time guardrails</strong> — <code>pre-tool-guard.js</code> blocks destructive commands, detects secrets and ADR violations</li>
        <li><strong>Agent enforcement</strong> — 7 read-only agents blocked at hook level from Write/Edit</li>
        <li><strong>Persistent agent memory</strong> — SQLite (Node ≥22.5) or Markdown (Node ≥18), auto-selected</li>
        <li><strong>Decision store SQLite</strong> — ADRs with TF-IDF semantic search, versioning and consolidation</li>
        <li><strong>Host adapters</strong> — Claude Code + Spec Kit portable (consumable by Cursor, Copilot, Gemini)</li>
        <li><strong>Portable artifacts</strong> — <code>forge export --format=speckit|openspec</code> works without FORGE installed</li>
        <li><strong>Complete observability</strong> — <code>consumo.jsonl</code> + <code>budget-state.json</code></li>
      </ul>
    `
  }
},

"limitaciones": {
  seccion: "overview",
  es: {
    titulo: "Limitaciones",
    html: `
      <h1>Limitaciones</h1>
      <p class="lead">Lo que FORGE <strong>no puede hacer</strong> hoy, restricciones técnicas conocidas, y dependencias que debes tener en cuenta.</p>

      <div class="callout warning">
        <p><strong>Lee esto primero.</strong> Conocer los límites evita sorpresas desagradables durante el pipeline.</p>
      </div>

      <h2>Restricciones funcionales</h2>

      <table>
        <thead><tr><th>Limitación</th><th>Detalle</th><th>Alternativa disponible</th></tr></thead>
        <tbody>
          <tr><td><strong>Sin routing real de modelos</strong></td><td><code>model-registry.js</code> registra qué modelo usaría, pero no lo cambia en tiempo de ejecución. El modelo efectivo está en el frontmatter del agente.</td><td>Cambiar frontmatter del agente manualmente</td></tr>
          <tr><td><strong>Sin apps móviles nativas</strong></td><td>No genera proyectos Swift, Kotlin ni Jetpack Compose.</td><td>—</td></tr>
          <tr><td><strong>Sin colaboración multi-usuario</strong></td><td><code>estado.json</code> es un archivo único sin locking. Dos sesiones simultáneas pueden producir conflictos.</td><td>Git branching por usuario</td></tr>
          <tr><td><strong>Sin fallback entre providers</strong></td><td>Si la API de Anthropic falla, la sesión se interrumpe. No hay fallback automático a OpenAI o Google.</td><td>Adaptador Spec Kit exporta para continuar con otro agente</td></tr>
          <tr><td><strong>Indexación AST limitada</strong></td><td><code>ast-indexer.js</code> usa <code>acorn</code> con limpieza de tipos básica. Proyectos TypeScript avanzados o JSX pueden tener errores silenciosos en el índice.</td><td>El índice AST es opcional — el pipeline funciona sin él</td></tr>
          <tr><td><strong>LLM para fases de generación</strong></td><td>El runner CLI puede avanzar pasos y validar transiciones sin LLM, pero la generación de contenido (IR, spec, código) requiere un agente LLM.</td><td>Usar adaptador Spec Kit para pasar artefactos a otro agente externo</td></tr>
        </tbody>
      </table>

      <h2>Dependencias requeridas</h2>
      <table>
        <thead><tr><th>Dependencia</th><th>Versión mínima</th><th>Uso</th><th>Obligatoria</th></tr></thead>
        <tbody>
          <tr><td>Node.js</td><td>≥18 (≥22.5 para SQLite nativo)</td><td>CLI, hooks, runner, dashboard</td><td>Sí</td></tr>
          <tr><td>Claude Code CLI</td><td>Última</td><td>Modo plugin — slash commands y agentes</td><td>Solo en modo plugin</td></tr>
          <tr><td>Cuenta Anthropic</td><td>Con créditos API</td><td>Generación de contenido con agentes LLM</td><td>Solo para generación</td></tr>
        </tbody>
      </table>

      <h2>Límites de escala</h2>
      <ul>
        <li>Proyectos con &gt;500 archivos pueden degradar la velocidad de recuperación de memoria en el backend Markdown (O(n) vs O(log n) de SQLite)</li>
        <li><code>consumo.jsonl</code> rota automáticamente al superar 10 MB</li>
        <li><code>decisions.db</code> (SQLite) soporta millones de entradas con índices — sin límite práctico</li>
        <li>Costo real de API: ~$10–25 por proyecto mediano con todos los agentes activos</li>
      </ul>

      <div class="callout tip">
        <p><strong>Para proyectos grandes:</strong> Usa Node ≥22.5 para activar SQLite automáticamente. El modo <code>sesion: rapido</code> en <code>sdd.config.yaml</code> omite agentes de revisión y ahorra ~30% de tokens.</p>
      </div>
    `
  },
  en: {
    titulo: "Limitations",
    html: `
      <h1>Limitations</h1>
      <p class="lead">What FORGE <strong>cannot do</strong> today, known technical restrictions, and dependencies to be aware of.</p>

      <div class="callout warning">
        <p><strong>Read this first.</strong> Knowing the limits prevents unpleasant surprises during the pipeline.</p>
      </div>

      <h2>Functional restrictions</h2>
      <table>
        <thead><tr><th>Limitation</th><th>Detail</th><th>Available alternative</th></tr></thead>
        <tbody>
          <tr><td><strong>No real model routing</strong></td><td><code>model-registry.js</code> records which model would be used, but does not change it at runtime.</td><td>Edit agent frontmatter manually</td></tr>
          <tr><td><strong>No native mobile apps</strong></td><td>Does not generate Swift, Kotlin or Jetpack Compose projects.</td><td>—</td></tr>
          <tr><td><strong>No multi-user collaboration</strong></td><td><code>estado.json</code> has no locking — two concurrent sessions may conflict.</td><td>Git branching per user</td></tr>
          <tr><td><strong>LLM required for content generation</strong></td><td>The CLI runner manages pipeline state without an LLM, but generating IR, spec, and code requires an LLM agent.</td><td>Spec Kit adapter exports artifacts for external agents</td></tr>
          <tr><td><strong>AST indexing limited</strong></td><td><code>ast-indexer.js</code> uses <code>acorn</code> with basic type stripping. Advanced TypeScript or JSX may produce silent errors.</td><td>AST index is optional — pipeline works without it</td></tr>
        </tbody>
      </table>

      <h2>Required dependencies</h2>
      <table>
        <thead><tr><th>Dependency</th><th>Min version</th><th>Use</th><th>Required</th></tr></thead>
        <tbody>
          <tr><td>Node.js</td><td>≥18 (≥22.5 for native SQLite)</td><td>CLI, hooks, runner, dashboard</td><td>Yes</td></tr>
          <tr><td>Claude Code CLI</td><td>Latest</td><td>Plugin mode — slash commands and agents</td><td>Plugin mode only</td></tr>
          <tr><td>Anthropic account</td><td>With API credits</td><td>LLM agent content generation</td><td>Generation only</td></tr>
        </tbody>
      </table>
    `
  }
},

"madurez": {
  seccion: "overview",
  es: {
    titulo: "Análisis de Madurez",
    html: `
      <h1>Análisis de Madurez</h1>
      <p class="lead">Estado real de cada área de FORGE v4.2.0. Basado en análisis estático del repositorio y la suite de tests (998/998 pasando).</p>

      <table>
        <thead><tr><th>Área</th><th>Estado</th><th>Justificación</th></tr></thead>
        <tbody>
          <tr><td>Pipeline SDD (39 comandos)</td><td>✅ Producción</td><td>Implementación completa, handoffs probados, gates funcionales</td></tr>
          <tr><td>14 agentes especializados</td><td>✅ Producción</td><td>Frontmatter estable, memoria operativa, restricciones enforced en hook</td></tr>
          <tr><td>Guardrails (pre-tool-guard)</td><td>✅ Producción</td><td>9 categorías de bloqueo, ADR violations, detección de secrets, 10 tests pasando</td></tr>
          <tr><td>Enforcement de agentes read-only</td><td>✅ Producción</td><td>7 agentes bloqueados a nivel hook — 10/10 tests de enforcement pasando</td></tr>
          <tr><td>Memoria persistente (Markdown)</td><td>✅ Producción</td><td>Auto-compresión, índice invertido JSONL, recuperación selectiva</td></tr>
          <tr><td>Memoria persistente (SQLite)</td><td>✅ Producción</td><td>Auto-activado en Node ≥22.5, fallback automático a Markdown</td></tr>
          <tr><td>Store de decisiones SQLite</td><td>✅ Producción</td><td>TF-IDF para búsqueda semántica, superseder(), consolidar(), 8/8 tests</td></tr>
          <tr><td>Memoria episódica (TF-IDF)</td><td>✅ Producción</td><td>Similitud coseno reemplaza grep exacto, 10/10 tests pasando</td></tr>
          <tr><td>Observabilidad (consumo.jsonl)</td><td>✅ Producción</td><td>Rotación automática, campos estables, telemetría completa</td></tr>
          <tr><td>Context manager (presupuesto)</td><td>✅ Producción</td><td>Presupuesto USD enforced por sesión, alertas configurables, bloqueo en exit 2</td></tr>
          <tr><td>CLI runner portable (state machine)</td><td>✅ Producción</td><td>forge status/step/validate/reset sin LLM, guards verificados, tests pasando</td></tr>
          <tr><td>Esquemas JSON de artefactos</td><td>✅ Producción</td><td>ir.json, estado.json, ADRs.jsonl con validación lightweight</td></tr>
          <tr><td>Export/import de artefactos</td><td>✅ Producción</td><td>Spec Kit + OpenSpec, round-trip verificado, --merge no destructivo</td></tr>
          <tr><td>Adaptador Claude Code</td><td>✅ Producción</td><td>Detecta host, construye contexto de handoff, integrado en forge dispatch</td></tr>
          <tr><td>Adaptador Spec Kit portable</td><td>✅ Producción</td><td>Genera TASK.md + spec.md + pipeline-state.json consumibles sin FORGE</td></tr>
          <tr><td>Circuit breaker (3 niveles)</td><td>✅ Producción</td><td>sandbox / local / confirmado — protección en cascada</td></tr>
          <tr><td>CLI (forge init/doctor/status/logs)</td><td>✅ Producción</td><td>Zero-deps, multiplataforma, diagnósticos con verificación de API key y hooks</td></tr>
          <tr><td>Dashboard UI</td><td>🔵 Beta</td><td>Funcional pero sin autenticación ni WebSockets (polling cada 5s)</td></tr>
          <tr><td>Templates de inicio rápido</td><td>🔵 Beta</td><td>3 templates (api-rest, cli-tool, saas-mvp), flujo verificado</td></tr>
          <tr><td>Integración CLAUDE.md</td><td>🔵 Beta</td><td>Idempotente, versionada, edge cases no exhaustivamente probados</td></tr>
          <tr><td>AST indexer</td><td>🔵 Beta</td><td>JS/TS básico con acorn — TypeScript avanzado puede fallar silenciosamente</td></tr>
          <tr><td>Integraciones MCP (Vercel/GitHub)</td><td>🔵 Beta</td><td>Flujo básico probado, pendiente E2E automatizado</td></tr>
          <tr><td>Registro multi-LLM</td><td>🧪 Experimental</td><td>Observabilidad solo. Routing real pendiente de la API de Claude Code</td></tr>
        </tbody>
      </table>

      <div class="callout tip">
        <p><strong>Para producción:</strong> Usa las áreas marcadas ✅. Las 🔵 son estables pero pueden cambiar su API. Las 🧪 son para exploración.</p>
      </div>
    `
  },
  en: {
    titulo: "Maturity Analysis",
    html: `
      <h1>Maturity Analysis</h1>
      <p class="lead">Real status of each FORGE v4.2.0 area. Based on static repository analysis and test suite (998/998 passing).</p>

      <table>
        <thead><tr><th>Area</th><th>Status</th><th>Justification</th></tr></thead>
        <tbody>
          <tr><td>SDD Pipeline (39 commands)</td><td>✅ Production</td><td>Complete implementation, tested handoffs, functional gates</td></tr>
          <tr><td>14 specialized agents</td><td>✅ Production</td><td>Stable frontmatter, operative memory, restrictions enforced at hook level</td></tr>
          <tr><td>Guardrails (pre-tool-guard)</td><td>✅ Production</td><td>9 block categories, ADR violations, secret detection, 10 tests passing</td></tr>
          <tr><td>Read-only agent enforcement</td><td>✅ Production</td><td>7 agents blocked at hook level — 10/10 enforcement tests passing</td></tr>
          <tr><td>Persistent memory (SQLite)</td><td>✅ Production</td><td>Auto-selected on Node ≥22.5, auto-fallback to Markdown</td></tr>
          <tr><td>Decision store SQLite</td><td>✅ Production</td><td>TF-IDF semantic search, superseder(), consolidate(), 8/8 tests</td></tr>
          <tr><td>Portable CLI runner</td><td>✅ Production</td><td>forge status/step/validate/reset without LLM, verified guards</td></tr>
          <tr><td>Artifact export/import</td><td>✅ Production</td><td>Spec Kit + OpenSpec, round-trip verified, --merge non-destructive</td></tr>
          <tr><td>Host adapters</td><td>✅ Production</td><td>Claude Code + Spec Kit portable (Cursor/Copilot/Gemini compatible)</td></tr>
          <tr><td>Context manager (budget)</td><td>✅ Production</td><td>USD budget enforced per session, configurable alerts</td></tr>
          <tr><td>Dashboard UI</td><td>🔵 Beta</td><td>Functional but no auth or WebSockets (polling)</td></tr>
          <tr><td>Quick-start templates</td><td>🔵 Beta</td><td>3 templates available, flow verified</td></tr>
          <tr><td>Multi-LLM registry</td><td>🧪 Experimental</td><td>Observability only. Real routing pending Claude Code API</td></tr>
        </tbody>
      </table>
    `
  }
},

/* ─────────────────────────────────────────────────────────────
   GRUPO 2 — Arquitectura
───────────────────────────────────────────────────────────── */

"arquitectura": {
  seccion: "technical",
  es: {
    titulo: "Arquitectura del Sistema",
    html: `
      <h1>Arquitectura del Sistema</h1>
      <p class="lead">Referencia técnica de la arquitectura de 3 capas de FORGE v4.2.0. Basada en análisis estático del repositorio.</p>

      <h2>Arquitectura de 3 capas</h2>
      <pre><code class="text">╔══════════════════════════════════════════════════════════════════╗
║  CAPA 1 — NÚCLEO PORTABLE (sin LLM)                              ║
║                                                                  ║
║  Artefactos .sdd/ (contrato) · State machine compilada (JS puro)   ║
║  CLI runner  · Esquemas JSON · Exportador/importador portable     ║
║  Context manager · Decision store SQLite · Memoria episódica     ║
╚══════════════════════╤═══════════════════════════════════════════╝
                       │  interfaz de adaptador (contrato neutral)
              ┌────────┴──────────────────────────────┐
              ▼                                       ▼
╔══════════════════════════╗           ╔══════════════════════════╗
║  CAPA 2 — ADAPTADOR      ║           ║  CAPA 2 — ADAPTADOR      ║
║  Claude Code             ║           ║  Spec Kit portable        ║
║                          ║           ║                          ║
║  hooks JS (PreToolUse,   ║           ║  TASK.md + spec.md +     ║
║  PostToolUse) · 14 agentes║          ║  pipeline-state.json     ║
║  39 comandos .md          ║           ║  Cursor / Copilot /      ║
║  slash commands           ║           ║  Gemini / cualquier LLM  ║
╚══════════════════════════╝           ╚══════════════════════════╝</code></pre>

      <h2>Capa 1 — Núcleo portable en detalle</h2>
      <pre><code class="text">cli/
  index.js        ← instalador + router principal
  runner.js       ← forge status/step/validate/reset (state machine real)
  dispatch.js     ← forge dispatch (sistema de adaptadores)
  decisions.js    ← forge decisions list/search/add/migrate
  export.js       ← forge export --format=speckit|openspec
  import.js       ← forge import --from=speckit|openspec

core/
  state-machine.js  ← PipelineStateMachine con PIPELINE_TRANSITIONS
  state-store.js    ← FileSystemStateStore (escritura atómica .tmp→rename)
  event-log.js      ← EventLog (append structured events)
  event-bus.js      ← EventBus pub/sub interno
  orchestrator.js   ← Orchestrator — coordina agentes por paso
  execution-context.js ← contexto compartido entre módulos del core
  session-budget.js ← presupuesto USD ($FORGE_BUDGET_USD)
  stack-detector.js ← detección automática del stack tecnológico
  quality-gate.js   ← validaciones de calidad antes de avanzar
  ir-to-spec-mapper.js ← mapea ir.json → spec.md estructurada
  project-memory.js ← memoria de proyecto persistente
  adapters/
    adapter-interface.js  ← ForgeAdapter + AdapterRegistry
    claude-code-adapter.js
    speckit-adapter.js
  decisions/
    decision-store.js  ← SQLite TF-IDF, superseder(), consolidar()

claude-hooks/
  pre-tool-guard.js     ← PreToolUse: 9 categorías bloqueo, read-only agents
  agent-memory.js       ← PostToolUse: memoria + ledger + ADR dual-write
  post-write-conventions.js
  context-manager.js    ← PostToolUse: presupuesto USD, resumen progresivo
  ast-indexer.js
  shared/config.js

utils/
  episodic-memory.js   ← TF-IDF coseno, indexación, query semántico</code></pre>

      <h2>Capa 2 Claude Code — flujo de tool call</h2>
      <pre><code class="text">Agente ejecuta Write .sdd/ir.json
│
├── Claude Code → PreToolUse → pre-tool-guard.js
│   ├── exit 2: BLOQUEADO (rm -rf, push --force, DROP DB, agente read-only, secrets, ADR violation)
│   └── exit 0: PERMITIDO → archivo escrito
│
└── Claude Code → PostToolUse
    ├── [todos los tools] context-manager.js
    │   ├── Acumula tokens/costo en budget-state.json
    │   ├── Append a consumo.jsonl con rotación
    │   ├── exit 2 si supera presupuesto bloque
    │   └── stderr warning si supera presupuesto warning
    └── [Write|Edit] agent-memory.js
        ├── Detecta agente (CLAUDE_AGENT_NAME)
        ├── Actualiza .sdd/memoria/ (SQLite o Markdown)
        ├── Dual-write ADRs → JSONL + SQLite
        └── post-write-conventions.js (valida convenciones)</code></pre>

      <h2>Módulos principales</h2>
      <table>
        <thead><tr><th>Módulo</th><th>Tipo</th><th>Responsabilidad</th><th>Estado</th></tr></thead>
        <tbody>
          <tr><td><code>cli/runner.js</code></td><td>CLI portable</td><td>forge status/step/validate/reset sin LLM</td><td>✅ Core</td></tr>
          <tr><td><code>cli/dispatch.js</code></td><td>CLI portable</td><td>forge dispatch — sistema de adaptadores</td><td>✅ Core</td></tr>
          <tr><td><code>cli/decisions.js</code></td><td>CLI portable</td><td>forge decisions — store SQLite + búsqueda</td><td>✅ Core</td></tr>
          <tr><td><code>core/state-machine.js</code></td><td>Core JS puro</td><td>PipelineStateMachine, guards por transición</td><td>✅ Core</td></tr>
          <tr><td><code>core/adapters/</code></td><td>Core JS</td><td>ForgeAdapter, AdapterRegistry, ClaudeCode, SpecKit</td><td>✅ Core</td></tr>
          <tr><td><code>core/decisions/</code></td><td>Core JS</td><td>DecisionStore SQLite, TF-IDF, superseder</td><td>✅ Core</td></tr>
          <tr><td><code>claude-hooks/pre-tool-guard.js</code></td><td>PreToolUse</td><td>Bloqueos, agentes read-only, secrets, ADRs</td><td>✅ Core</td></tr>
          <tr><td><code>claude-hooks/agent-memory.js</code></td><td>PostToolUse</td><td>Memoria persistente + ledger + ADR dual-write</td><td>✅ Core</td></tr>
          <tr><td><code>claude-hooks/context-manager.js</code></td><td>PostToolUse</td><td>Presupuesto USD enforced, resumen progresivo</td><td>✅ Core</td></tr>
          <tr><td><code>utils/episodic-memory.js</code></td><td>Librería</td><td>Indexación episódica, similitud coseno TF-IDF</td><td>✅ Core</td></tr>
          <tr><td><code>core/orchestrator.js</code></td><td>Core JS</td><td>Coordina agentes por paso del pipeline, gestiona handoffs</td><td>✅ Core</td></tr>
          <tr><td><code>core/event-bus.js</code></td><td>Core JS</td><td>Pub/sub interno entre módulos del core (desacoplado)</td><td>✅ Core</td></tr>
          <tr><td><code>core/event-log.js</code></td><td>Core JS</td><td>Append estructurado de eventos — fuente del SSE dashboard</td><td>✅ Core</td></tr>
          <tr><td><code>core/session-budget.js</code></td><td>Core JS</td><td>Presupuesto USD por sesión ($FORGE_BUDGET_USD, default 1.00)</td><td>✅ Core</td></tr>
          <tr><td><code>core/execution-context.js</code></td><td>Core JS</td><td>Contexto compartido entre módulos durante ejecución</td><td>✅ Core</td></tr>
          <tr><td><code>core/stack-detector.js</code></td><td>Core JS</td><td>Detección automática de stack tecnológico del proyecto</td><td>✅ Core</td></tr>
          <tr><td><code>core/quality-gate.js</code></td><td>Core JS</td><td>Validaciones de calidad antes de transiciones de paso</td><td>✅ Core</td></tr>
          <tr><td><code>core/ir-to-spec-mapper.js</code></td><td>Core JS</td><td>Convierte ir.json a estructura spec.md (HUs, CAs, RF, NFR)</td><td>✅ Core</td></tr>
          <tr><td><code>core/project-memory.js</code></td><td>Core JS</td><td>Memoria de proyecto compartida entre agentes</td><td>✅ Core</td></tr>
          <tr><td><code>core/checkpoint.js</code></td><td>Core JS</td><td>Snapshots atómicos del estado — permite forge resume</td><td>✅ Core</td></tr>
          <tr><td><code>core/agent-registry.js</code></td><td>Core JS</td><td>Registro de agentes disponibles, sus modelos y permisos</td><td>✅ Core</td></tr>
          <tr><td><code>core/evaluator-optimizer.js</code></td><td>Core JS</td><td>Evalúa calidad del output de agentes y propone optimizaciones</td><td>🔵 Beta</td></tr>
          <tr><td><code>model-registry.js</code></td><td>Librería hook</td><td>Resolución de provider/modelo (observabilidad, no routing)</td><td>🧪 Experimental</td></tr>
          <tr><td><code>cli/index.js</code></td><td>CLI</td><td>forge init/update/doctor/logs/ui/config</td><td>✅ Core</td></tr>
          <tr><td><code>ui/server.js</code></td><td>Dashboard</td><td>HTTP loopback, SSE /events, 6 endpoints read-only</td><td>🔵 Beta</td></tr>
        </tbody>
      </table>

      <h2>Patrones de diseño</h2>
      <table>
        <thead><tr><th>Patrón</th><th>Dónde</th><th>Propósito</th></tr></thead>
        <tbody>
          <tr><td>Pipeline con gates</td><td>39 comandos SDD + state machine</td><td>Transiciones validadas, guards por paso</td></tr>
          <tr><td>Observer (hooks)</td><td>PreToolUse / PostToolUse</td><td>Interceptar cada tool call sin modificar el agente</td></tr>
          <tr><td>Strategy</td><td>Backends memoria + adaptadores host</td><td>SQLite/Markdown intercambiables; Claude Code/SpecKit intercambiables</td></tr>
          <tr><td>Registry</td><td><code>AdapterRegistry</code>, <code>model-registry.js</code></td><td>Resolución de adaptador por disponibilidad</td></tr>
          <tr><td>Chain of Responsibility</td><td><code>pre-tool-guard.js</code></td><td>Reglas de guardrail evaluadas en cascada</td></tr>
          <tr><td>Append-only log + rotación</td><td><code>consumo.jsonl</code>, <code>ADRs.jsonl</code></td><td>Trazabilidad bounded sin pérdida de historial reciente</td></tr>
          <tr><td>Dual-write</td><td><code>agent-memory.js</code> → ADRs</td><td>JSONL como respaldo + SQLite para búsqueda semántica</td></tr>
        </tbody>
      </table>
    `
  },
  en: {
    titulo: "System Architecture",
    html: `
      <h1>System Architecture</h1>
      <p class="lead">Technical reference for FORGE v4.2.0's 3-layer architecture.</p>

      <h2>3-layer architecture</h2>
      <pre><code class="text">╔══════════════════════════════════════════════════════════════╗
║  LAYER 1 — PORTABLE CORE (no LLM required)                   ║
║  .sdd/ artifacts · State machine · CLI runner                ║
║  Context manager · Decision store SQLite · Episodic memory   ║
╚══════════════╤═══════════════════════════════════════════════╝
               │  adapter interface (neutral contract)
      ┌────────┴──────────────────────────────┐
      ▼                                       ▼
╔════════════════════════╗     ╔════════════════════════╗
║  Claude Code adapter   ║     ║  Spec Kit adapter       ║
║  hooks + 14 agents     ║     ║  TASK.md + spec.md      ║
║  39 commands .md       ║     ║  Cursor / Copilot /     ║
╚════════════════════════╝     ║  Gemini / any LLM       ║
                               ╚════════════════════════╝</code></pre>

      <h2>Key modules</h2>
      <table>
        <thead><tr><th>Module</th><th>Type</th><th>Responsibility</th><th>Status</th></tr></thead>
        <tbody>
          <tr><td><code>cli/runner.js</code></td><td>Portable CLI</td><td>forge status/step/validate/reset without LLM</td><td>✅ Core</td></tr>
          <tr><td><code>core/adapters/</code></td><td>Core JS</td><td>ForgeAdapter, AdapterRegistry, Claude Code, SpecKit</td><td>✅ Core</td></tr>
          <tr><td><code>core/decisions/</code></td><td>Core JS</td><td>DecisionStore SQLite, TF-IDF, versioning</td><td>✅ Core</td></tr>
          <tr><td><code>claude-hooks/pre-tool-guard.js</code></td><td>PreToolUse</td><td>Blocks, read-only agents, secrets, ADR violations</td><td>✅ Core</td></tr>
          <tr><td><code>claude-hooks/context-manager.js</code></td><td>PostToolUse</td><td>USD budget enforced, progressive summary</td><td>✅ Core</td></tr>
        </tbody>
      </table>
    `
  }
},

"componentes": {
  seccion: "technical",
  es: {
    titulo: "Componentes del Sistema",
    html: `
      <h1>Componentes del Sistema</h1>
      <p class="lead">Descripción detallada de cada módulo: propósito, entradas, salidas, y dependencias.</p>

      <h2>State machine — <code>core/state-machine.js</code> (JS puro, sin compilación)</h2>
      <p>La fuente de verdad del pipeline. Controla qué transiciones son válidas y bloquea saltos ilegales.</p>
      <pre><code class="text">Pasos del pipeline:
idea → discovery → ir → design → spec → plan → tasks → code → done

Transiciones válidas (extracto):
  idea      → discovery
  discovery → ir
  ir        → design
  design    → spec
  spec      → plan
  plan      → tasks
  tasks     → code
  code      → done</code></pre>
      <table>
        <thead><tr><th>Método</th><th>Descripción</th></tr></thead>
        <tbody>
          <tr><td><code>advance(paso, force?)</code></td><td>Avanza al paso indicado. Retorna <code>{ ok, error }</code>. Con <code>force=true</code> omite guards.</td></tr>
          <tr><td><code>currentStep()</code></td><td>Retorna el paso actual del pipeline</td></tr>
          <tr><td><code>availableTransitions()</code></td><td>Retorna los pasos válidos desde el actual</td></tr>
          <tr><td><code>validateCurrentStep()</code></td><td>Retorna array de precondiciones incumplidas (ej: ir_generado=false)</td></tr>
          <tr><td><code>forceStep(paso)</code></td><td>Fuerza un paso directamente (usado por forge reset)</td></tr>
        </tbody>
      </table>

      <h2>Sistema de adaptadores — <code>core/adapters/</code></h2>
      <p>Desacopla el pipeline del host. Permite ejecutar la misma tarea en Claude Code o exportarla como artefactos portables.</p>
      <pre><code class="js">// Contrato de adaptador
{ agente, tarea, contexto?, tier?, cwd? }  →  { ok, resultado, artefactos, estado, error? }

// Uso desde CLI
forge dispatch --agente=arquitecto --tarea="Diseñar sistema de auth" --adapter=speckit
forge dispatch --agente=main --tarea="Revisar pipeline" --adapter=claude-code
forge adapters  // lista adaptadores disponibles</code></pre>
      <table>
        <thead><tr><th>Adaptador</th><th>Disponible</th><th>Qué hace</th></tr></thead>
        <tbody>
          <tr><td><code>claude-code</code></td><td>Si CLAUDE_AGENT_NAME existe o hay .claude/settings.json</td><td>Prepara contexto de handoff para Claude Code</td></tr>
          <tr><td><code>speckit</code></td><td>Siempre (fallback)</td><td>Genera TASK.md + spec.md + pipeline-state.json en <code>speckit-handoff/</code></td></tr>
        </tbody>
      </table>

      <h2>Store de decisiones — <code>core/decisions/decision-store.js</code></h2>
      <p>Reemplaza el append a ADRs.jsonl con SQLite estructurado. Los ADRs detectados por <code>agent-memory.js</code> se escriben a ambos (dual-write).</p>
      <pre><code class="bash">forge decisions list                    # Lista decisiones activas
forge decisions search "autenticación"  # TF-IDF semántico con score
forge decisions add "Usar JWT stateless"# Registro manual
forge decisions consolidate 90          # Elimina obsoletas &gt;90 días
forge decisions migrate                 # Importa ADRs.jsonl existente</code></pre>
      <pre><code class="js">// TF-IDF: tokeniza → filtra stopwords → similitud coseno
// Resultado ordenado por score + recencia
store.buscar("seguridad JWT", { top: 5, soloActivas: true })
// → [{ decision, context, status, agente, score }, ...]</code></pre>

      <h2>Context manager — <code>claude-hooks/context-manager.js</code></h2>
      <p>Hook PostToolUse que aplica las estrategias de reducción de contexto de mayor impacto real:</p>
      <table>
        <thead><tr><th>Estrategia</th><th>Impacto real</th><th>Cómo funciona</th></tr></thead>
        <tbody>
          <tr><td>Presupuesto USD enforced</td><td>Bloqueo proactivo</td><td>Acumula tokens por modelo en <code>budget-state.json</code>. exit 2 al superar umbral.</td></tr>
          <tr><td>Resumen progresivo</td><td>50–80% en historial</td><td>Genera <code>context-summary.md</code> cuando costo &gt; 50% del umbral</td></tr>
          <tr><td>Auditoría de tools pesadas</td><td>Alerta</td><td>Avisa cuando Read/Bash/WebFetch devuelve &gt;50KB</td></tr>
          <tr><td>Ledger detallado</td><td>Trazabilidad</td><td>Append a <code>consumo.jsonl</code> con rotación automática</td></tr>
        </tbody>
      </table>
      <pre><code class="bash"># Configurar presupuesto
export FORGE_BUDGET_WARN_USD=0.50    # Alerta a $0.50
export FORGE_BUDGET_BLOCK_USD=1.00   # Bloqueo a $1.00</code></pre>

      <h2>Hook de guardrails — <code>claude-hooks/pre-tool-guard.js</code></h2>
      <ul>
        <li><strong>Bloqueos duros (exit 2):</strong> <code>rm -rf /</code>, <code>git push --force</code>, <code>DROP DATABASE</code>, <code>chmod 777</code>, secrets hardcodeados, escritura en .env, ADR violations</li>
        <li><strong>Agentes read-only bloqueados:</strong> arquitecto, asesor-datos, critico, seguridad, investigador, revisor, disenador-api</li>
        <li><strong>Advertencias (exit 0 + stderr):</strong> <code>git push</code>, <code>npm publish</code>, <code>terraform apply</code>, <code>DROP TABLE</code></li>
        <li><strong>Circuit breaker:</strong> En modo sandbox, Bash queda bloqueado hasta resolver los errores</li>
      </ul>

      <h2>Hook de memoria — <code>claude-hooks/agent-memory.js</code></h2>
      <table>
        <thead><tr><th>Node.js</th><th>Backend activo</th><th>Consulta</th><th>Storage</th></tr></thead>
        <tbody>
          <tr><td>≥ 22.5</td><td>SQLite nativo (<code>node:sqlite</code>)</td><td>O(log n)</td><td><code>.sdd/memoria/memoria.db</code></td></tr>
          <tr><td>&lt; 22.5</td><td>Markdown append-only</td><td>O(n)</td><td><code>.sdd/memoria/agente-{nombre}.md</code></td></tr>
        </tbody>
      </table>
      <p>Dual-write de ADRs: JSONL (respaldo) + SQLite (búsqueda semántica). El patrón ADR en código:</p>
      <pre><code class="js">// ADR: {"decision":"usar JWT stateless","context":"Sin BD de sesiones","status":"accepted"}</code></pre>

      <h2>CLI — <code>cli/index.js</code> completo</h2>
      <pre><code class="bash">forge init                    # Instala FORGE en el proyecto
forge init --global           # Instala para todos los proyectos
forge init --template &lt;name&gt;  # api-rest | cli-tool | saas-mvp
forge init --preset &lt;name&gt;    # lean | startup | enterprise
forge update                  # Actualiza núcleo sin tocar .sdd/
forge doctor                  # Diagnóstico: hooks, API key, sintaxis
forge status                  # Visual del pipeline (state machine)
forge step &lt;paso&gt;             # Avanza en el pipeline con guards
forge step &lt;paso&gt; --force     # Fuerza sin guards (recuperación)
forge validate                # Verifica precondiciones del paso actual
forge reset --force           # Resetea a 'idea' (conserva .sdd/)
forge state                   # Vuelca estado.json formateado
forge export --format=speckit|openspec [--out=dir]
forge import --from=speckit|openspec [--merge]
forge dispatch --agente=X --tarea="Y" [--adapter=speckit|claude-code]
forge adapters                # Lista adaptadores disponibles
forge decisions list          # Lista decisiones activas
forge decisions search "&lt;consulta&gt;"  # Búsqueda semántica
forge decisions add "&lt;texto&gt;"       # Registra decisión manual
forge decisions migrate       # Importa ADRs.jsonl a SQLite
forge decisions consolidate [días]  # Elimina obsoletas antiguas
forge logs [--last N]         # Últimas entradas consumo.jsonl
forge ui [--port N]           # Dashboard en localhost:3001
forge config show|get|set     # Configuración
forge --version               # Versión instalada</code></pre>
    `
  },
  en: {
    titulo: "System Components",
    html: `
      <h1>System Components</h1>
      <p class="lead">Detailed description of each module: purpose, inputs, outputs, and dependencies.</p>

      <h2>State machine — <code>core/state-machine.js</code></h2>
      <p>The pipeline source of truth. Controls which transitions are valid and blocks illegal jumps.</p>
      <table>
        <thead><tr><th>Method</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><code>advance(step, force?)</code></td><td>Advances to the given step. Returns <code>{ ok, error }</code>. With <code>force=true</code> skips guards.</td></tr>
          <tr><td><code>currentStep()</code></td><td>Returns the current pipeline step</td></tr>
          <tr><td><code>availableTransitions()</code></td><td>Returns valid next steps from the current one</td></tr>
          <tr><td><code>validateCurrentStep()</code></td><td>Returns unmet preconditions array</td></tr>
        </tbody>
      </table>

      <h2>Adapter system — <code>core/adapters/</code></h2>
      <pre><code class="js">// Adapter contract
{ agente, tarea, contexto?, tier?, cwd? }  →  { ok, resultado, artefactos, estado, error? }

// CLI usage
forge dispatch --agente=main --tarea="Design auth system" --adapter=speckit
forge adapters  // list available adapters</code></pre>

      <h2>Decision store — <code>core/decisions/decision-store.js</code></h2>
      <pre><code class="bash">forge decisions search "authentication"  # TF-IDF with score
forge decisions add "Use JWT stateless"  # Manual registration
forge decisions migrate                  # Import existing ADRs.jsonl</code></pre>

      <h2>Full CLI reference</h2>
      <pre><code class="bash">forge init                    # Install FORGE
forge status                  # Visual pipeline (state machine)
forge step &lt;step&gt;             # Advance with guards
forge step &lt;step&gt; --force     # Force without guards
forge validate                # Check current step preconditions
forge export --format=speckit|openspec
forge dispatch --agente=X --tarea="Y" [--adapter=speckit|claude-code]
forge decisions list|search|add|migrate
forge logs [--last N]
forge doctor</code></pre>
    `
  }
},

"contratos": {
  seccion: "technical",
  es: {
    titulo: "Contratos de Artefactos",
    html: `
      <h1>Contratos de Artefactos</h1>
      <p class="lead">Esquemas JSON que cada fase del pipeline produce y consume. Son los contratos estables entre componentes — validados por <code>core/schemas/</code>.</p>

      <h2><code>ir.json</code> — Intermediate Representation</h2>
      <p>Esquema validado. El campo <code>confidence</code> (0–1) es orientativo — generado por el agente para indicar cuánta información hay disponible. No es un guard automático de la state machine. Si es &lt; 0.7, se recomienda ejecutar <code>/sdd.aclarar</code> antes de continuar.</p>
      <pre><code class="json">{
  "schemaVersion": "1.0",
  "id": "string",
  "created_at": "ISO 8601",
  "raw_input": "string",
  "confidence": 0.85,
  "product": {
    "name": "string",
    "type": "api | saas | web | cli | mobile | other",
    "description": "string",
    "target_users": "string"
  },
  "features": {
    "core": [{ "nombre": "string", "descripcion": "string" }],
    "nice_to_have": ["string"]
  },
  "constraints": ["string"],
  "assumptions": ["string"],
  "ambiguities": ["string"],
  "requires_clarification": false
}</code></pre>

      <h2><code>estado.json</code> — Estado del pipeline</h2>
      <pre><code class="json">{
  "schemaVersion": "1.0",
  "pipeline_step": "idea | discovery | ir | design | spec | plan | tasks | code | done",
  "ir_generado": true,
  "spec_activa": "string | null",
  "ultima_actualizacion": "ISO 8601"
}</code></pre>

      <h2><code>ADRs.jsonl</code> — Decisiones arquitectónicas</h2>
      <p>Formato dual: JSONL como respaldo + <code>.sdd/arquitectura/decisions.db</code> SQLite para búsqueda semántica.</p>
      <pre><code class="json">{ "ts": "ISO 8601", "decision": "string", "context": "string",
  "alternatives": [], "status": "accepted | rejected | deprecated | superseded",
  "agente": "string", "archivo": "string" }</code></pre>

      <h2><code>consumo.jsonl</code> — Telemetría</h2>
      <pre><code class="json">{ "ts": "ISO 8601", "agente": "arquitecto", "tool": "Write",
  "archivo": "src/api.js", "bytes": 1024,
  "modelo": "claude-sonnet-4-6", "tokens_input": 500, "tokens_output": 200,
  "costo_usd": 0.000450 }</code></pre>

      <h2><code>budget-state.json</code> — Estado del presupuesto</h2>
      <pre><code class="json">{
  "tokens_input": 45000,
  "tokens_output": 12000,
  "costo_usd": 0.3150,
  "llamadas": 23,
  "session_start": "ISO 8601",
  "updated_at": "ISO 8601"
}</code></pre>

      <h2>Formato Spec Kit (export portable)</h2>
      <p>Generado por <code>forge export --format=speckit</code> o <code>forge dispatch --adapter=speckit</code>. Consumible sin FORGE ni Claude Code instalados.</p>
      <pre><code class="text">speckit-export/
  spec.md        ← Visión general, características, restricciones
  plan.md        ← Plan de implementación
  tasks.md       ← Lista de tareas con estados
  decisions.md   ← Decisiones registradas (ADRs)
  README.md      ← Instrucciones de consumo

speckit-handoff/           ← Generado por forge dispatch
  TASK.md                  ← Instrucción de tarea para el agente externo
  spec.md                  ← Especificación del producto
  pipeline-state.json      ← Paso actual, tier, artefactos disponibles
  README.md                ← Cómo usar este handoff</code></pre>

      <h2>Contrato de hooks (Claude Code)</h2>
      <pre><code class="json">// PreToolUse — stdin al hook
{ "tool_name": "Bash", "tool_input": { "command": "..." } }

// PostToolUse — stdin al hook
{ "tool_name": "Write",
  "tool_input": { "file_path": "...", "content": "..." },
  "tool_response": "File written successfully",
  "usage": { "input_tokens": 500, "output_tokens": 200 },
  "model": "claude-sonnet-4-6" }

// Exit codes
// 0 → permitido / procesado
// 2 → bloqueado (stderr contiene el motivo)</code></pre>

      <h2>Contrato de adaptador</h2>
      <pre><code class="js">// Input (TareaForge)
{ agente: string, tarea: string, contexto?: object, tier?: 'low'|'medium'|'high', cwd?: string }

// Output (ResultadoForge)
{ ok: boolean, resultado?: string, artefactos?: string[], estado?: object,
  error?: string, adapter: string }</code></pre>
    `
  },
  en: {
    titulo: "Artifact Contracts",
    html: `
      <h1>Artifact Contracts</h1>
      <p class="lead">JSON schemas each pipeline phase produces and consumes — validated by <code>core/schemas/</code>.</p>

      <h2><code>ir.json</code></h2>
      <pre><code class="json">{
  "schemaVersion": "1.0",
  "id": "string",
  "confidence": 0.85,
  "product": { "name": "string", "type": "api | saas | web | cli | mobile | other" },
  "features": { "core": [{ "nombre": "string", "descripcion": "string" }] },
  "requires_clarification": false
}</code></pre>

      <h2><code>estado.json</code></h2>
      <pre><code class="json">{
  "schemaVersion": "1.0",
  "pipeline_step": "idea | discovery | ir | design | spec | plan | tasks | code | done",
  "ir_generado": true,
  "ultima_actualizacion": "ISO 8601"
}</code></pre>

      <h2>Spec Kit format (portable export)</h2>
      <pre><code class="text">speckit-export/
  spec.md · plan.md · tasks.md · decisions.md · README.md</code></pre>

      <h2>Adapter contract</h2>
      <pre><code class="js">// Input: { agente, tarea, tier?, cwd? }
// Output: { ok, resultado?, artefactos?, estado?, error?, adapter }</code></pre>
    `
  }
},

/* ─────────────────────────────────────────────────────────────
   GRUPO 3 — Operación
───────────────────────────────────────────────────────────── */

"instalacion": {
  seccion: "operate",
  es: {
    titulo: "Instalación y Primer Uso",
    html: `
      <h1>Instalación y Primer Uso</h1>

      <div class="callout tip">
        <p><strong>Requisitos previos:</strong> Node.js ≥18 (≥22.5 recomendado para SQLite). Claude Code solo es necesario para el modo plugin.</p>
      </div>

      <h2>Instalación</h2>

      <h3>Opción A — npm (recomendada)</h3>
      <pre><code class="bash">npm install -g forja-mvp
forge doctor   # verifica instalación</code></pre>

      <h3>Opción B — desde el repositorio</h3>
      <pre><code class="bash">git clone https://github.com/carlos060798/FORGE
cd FORGE
npm install
npm install -g .   # instala el comando forge globalmente
forge doctor</code></pre>

      <h2>Con template (recomendado para empezar rápido)</h2>
      <pre><code class="bash"># API REST con autenticación JWT
forge init --template api-rest

# CLI con subcomandos y output coloreado
forge init --template cli-tool

# SaaS MVP con auth y dashboard
forge init --template saas-mvp</code></pre>

      <h2>Con preset de configuración</h2>
      <pre><code class="bash">forge init --preset lean        # 6 agentes activos (arquitecto, asesor-datos, disenador-api, backend, frontend, tester)
forge init --preset startup     # MVPs ágiles (Sonnet default, Opus para arquitecto y crítico)
forge init --preset enterprise  # Corporativo (todos los agentes, ADR obligatorio)</code></pre>

      <h2>Qué instala <code>forge init</code></h2>
      <pre><code class="text">.claude/
  ├── commands/       (39 archivos .md — slash commands)
  ├── agents/         (14 archivos .md — definición de agentes)
  ├── skills/         (31 directorios — capacidades adicionales)
  └── hooks/          (enlace a claude-hooks/)

.sdd/
  ├── estado.json     (pipeline_step: "idea")
  ├── sdd.config.yaml
  ├── memoria/
  ├── arquitectura/   (ADRs.jsonl + decisions.db)
  └── observabilidad/ (budget-state.json)

CLAUDE.md             (sección ## FORGE añadida/actualizada)</code></pre>

      <h2>Primer uso — modo plugin (Claude Code)</h2>
      <p>Después de <code>forge init</code>, abre Claude Code en el directorio:</p>
      <pre><code class="text">/forge "describe tu idea aquí"

# Ejemplos:
/forge "una API para que mi equipo registre sus horas de trabajo"
/forge "una CLI que convierta archivos CSV a JSON con validación de esquema"
/forge "un dashboard web donde mis clientes vean el estado de sus pedidos"</code></pre>

      <h2>Primer uso — runner portable (sin Claude Code)</h2>
      <pre><code class="bash"># Ver el estado actual del pipeline
forge status

# Avanzar manualmente un paso
forge step discovery

# Verificar precondiciones del paso actual
forge validate

# Exportar artefactos para otro agente
forge export --format=speckit

# Despachar tarea al adaptador portable
forge dispatch --agente=arquitecto --tarea="Diseña la arquitectura" --adapter=speckit</code></pre>
    `
  },
  en: {
    titulo: "Installation and First Use",
    html: `
      <h1>Installation and First Use</h1>

      <div class="callout tip">
        <p><strong>Prerequisites:</strong> Node.js ≥18 (≥22.5 recommended for SQLite). Claude Code only required for plugin mode.</p>
      </div>

      <h2>Installation</h2>

      <h3>Option A — npm (recommended)</h3>
      <pre><code class="bash">npm install -g forja-mvp
forge doctor</code></pre>

      <h3>Option B — from repository</h3>
      <pre><code class="bash">git clone https://github.com/carlos060798/FORGE
cd FORGE
npm install && npm install -g .
forge doctor</code></pre>

      <h2>With template</h2>
      <pre><code class="bash">forge init --template api-rest
forge init --template cli-tool
forge init --template saas-mvp</code></pre>

      <h2>Plugin mode (Claude Code)</h2>
      <pre><code class="text">/forge "describe your idea here"</code></pre>

      <h2>Portable runner mode (no Claude Code)</h2>
      <pre><code class="bash">forge status          # View pipeline state
forge step discovery  # Advance a step
forge validate        # Check preconditions
forge export --format=speckit         # Export portable artifacts
forge dispatch --agente=main --tarea="Design API" --adapter=speckit</code></pre>
    `
  }
},

"configuracion": {
  seccion: "operate",
  es: {
    titulo: "Configuración",
    html: `
      <h1>Configuración</h1>
      <p class="lead">Todas las opciones de configuración de FORGE, sus valores por defecto y recomendaciones.</p>

      <h2><code>sdd.config.yaml</code> — Opciones principales</h2>
      <table>
        <thead><tr><th>Clave</th><th>Tipo</th><th>Default</th><th>Descripción</th></tr></thead>
        <tbody>
          <tr><td><code>idioma</code></td><td>string</td><td><code>"español"</code></td><td>Idioma de los mensajes de agentes</td></tr>
          <tr><td><code>perfil</code></td><td>enum</td><td><code>"guiado"</code></td><td><code>guiado</code> | <code>experto</code></td></tr>
          <tr><td><code>sesion.modo</code></td><td>enum</td><td><code>"normal"</code></td><td><code>normal</code> | <code>rapido</code> | <code>prototipo</code></td></tr>
          <tr><td><code>memoria.backend</code></td><td>enum</td><td>auto</td><td><code>sqlite</code> | <code>markdown</code> (auto-detectado por versión Node)</td></tr>
          <tr><td><code>memoria.umbral_bytes</code></td><td>number</td><td><code>50000</code></td><td>Tamaño máximo antes de auto-compresión</td></tr>
          <tr><td><code>observabilidad.consumo_max_mb</code></td><td>number</td><td><code>10</code></td><td>Tamaño máximo de consumo.jsonl antes de rotar</td></tr>
          <tr><td><code>calidad.cobertura_tests_minima</code></td><td>number</td><td><code>80</code></td><td>% mínimo de cobertura de tests</td></tr>
          <tr><td><code>calidad.longitud_funcion_maxima</code></td><td>number</td><td><code>50</code></td><td>Líneas máximas por función</td></tr>
          <tr><td><code>comportamiento.requerir_aprobacion_plan</code></td><td>boolean</td><td><code>true</code></td><td>Gate de aprobación del plan</td></tr>
          <tr><td><code>protecciones.no_tocar_archivos</code></td><td>string[]</td><td><code>[".env*", "*.key"]</code></td><td>Archivos que FORGE nunca modifica</td></tr>
        </tbody>
      </table>

      <h2>Modos de sesión</h2>
      <table>
        <thead><tr><th>Modo</th><th>Agentes activos</th><th>Uso recomendado</th></tr></thead>
        <tbody>
          <tr><td><code>normal</code></td><td>Todos (14 agentes)</td><td>Pipeline completo con crítico, seguridad y ADRs</td></tr>
          <tr><td><code>rapido</code></td><td>Sin <code>critico</code></td><td>Ahorra ~30% tokens en proyectos pequeños</td></tr>
          <tr><td><code>prototipo</code></td><td>Solo developers y tester</td><td>Iteración rápida, sin revisores</td></tr>
        </tbody>
      </table>

      <h2>Variables de entorno</h2>
      <table>
        <thead><tr><th>Variable</th><th>Propósito</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>FORGE_LLM_PROVIDER</code></td><td>Proveedor LLM: <code>anthropic</code>, <code>openai</code>, <code>ollama</code>, <code>stub</code></td><td>anthropic</td></tr>
          <tr><td><code>FORGE_BUDGET_USD</code></td><td>Presupuesto total de la sesión en USD</td><td>1.00</td></tr>
          <tr><td><code>FORGE_BUDGET_WARN_USD</code></td><td>Umbral de alerta de presupuesto</td><td>0.50</td></tr>
          <tr><td><code>FORGE_BUDGET_BLOCK_USD</code></td><td>Umbral de bloqueo de agentes opus</td><td>1.00</td></tr>
          <tr><td><code>FORGE_TOOL_MAX_BYTES</code></td><td>Bytes máximos de tool-result antes de advertir</td><td>50000</td></tr>
          <tr><td><code>FORGE_LEDGER_MAX_BYTES</code></td><td>Tamaño máximo del ledger antes de compresión</td><td>5000000</td></tr>
          <tr><td><code>FORGE_UI_PORT</code></td><td>Puerto del dashboard SSE</td><td>3001</td></tr>
          <tr><td><code>CLAUDE_AGENT_NAME</code></td><td>Identidad del agente (inyectada por Claude Code)</td><td>—</td></tr>
        </tbody>
      </table>

      <h2><code>forge.config.json</code> — Guardrails</h2>
      <pre><code class="json">{
  "guardrails": {
    "write_safety": true,
    "verify_local_imports": false
  },
  "observabilidad": {
    "consumo_max_mb": 10
  },
  "ignore_patterns": ["dist/**", "coverage/**"]
}</code></pre>
    `
  },
  en: {
    titulo: "Configuration",
    html: `
      <h1>Configuration</h1>
      <p class="lead">All FORGE configuration options, defaults and recommendations.</p>

      <h2>Environment variables</h2>
      <table>
        <thead><tr><th>Variable</th><th>Purpose</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>FORGE_LLM_PROVIDER</code></td><td>LLM provider: <code>anthropic</code>, <code>openai</code>, <code>ollama</code>, <code>stub</code></td><td>anthropic</td></tr>
          <tr><td><code>FORGE_BUDGET_USD</code></td><td>Total session budget in USD</td><td>1.00</td></tr>
          <tr><td><code>FORGE_BUDGET_WARN_USD</code></td><td>Budget warning threshold</td><td>0.50</td></tr>
          <tr><td><code>FORGE_BUDGET_BLOCK_USD</code></td><td>Budget block threshold for opus agents</td><td>1.00</td></tr>
          <tr><td><code>FORGE_TOOL_MAX_BYTES</code></td><td>Max tool-result bytes before warning</td><td>50000</td></tr>
          <tr><td><code>FORGE_LEDGER_MAX_BYTES</code></td><td>Max ledger size before compression</td><td>5000000</td></tr>
          <tr><td><code>FORGE_UI_PORT</code></td><td>Dashboard SSE port</td><td>3001</td></tr>
        </tbody>
      </table>

      <h2>Session modes</h2>
      <table>
        <thead><tr><th>Mode</th><th>Active agents</th><th>Recommended for</th></tr></thead>
        <tbody>
          <tr><td><code>normal</code></td><td>All (14 agents)</td><td>Full pipeline with critic, security and ADRs</td></tr>
          <tr><td><code>rapido</code></td><td>Without <code>critico</code></td><td>Saves ~30% tokens on small projects</td></tr>
          <tr><td><code>prototipo</code></td><td>Developers + tester only</td><td>Fast iteration, no reviewers</td></tr>
        </tbody>
      </table>
    `
  }
},

"planes-uso": {
  seccion: "operate",
  es: {
    titulo: "Planes de Uso",
    html: `
      <h1>Planes de Uso</h1>
      <p class="lead">Guía de decisión: qué preset, template, proveedor LLM y modo de sesión usar según tu proyecto. Una tabla por decisión, con criterios concretos.</p>

      <h2>¿Qué preset usar?</h2>
      <table>
        <thead><tr><th>Preset</th><th>Agentes activos</th><th>Cuándo usarlo</th><th>Costo estimado</th></tr></thead>
        <tbody>
          <tr>
            <td><code>lean</code></td>
            <td>6: arquitecto, asesor-datos, disenador-api, backend, frontend, tester</td>
            <td>MVP personal, hackathon, PoC rápido. Quieres velocidad sobre exhaustividad.</td>
            <td>$3–8 / proyecto mediano</td>
          </tr>
          <tr>
            <td><code>startup</code></td>
            <td>8: lean + critico + product-designer</td>
            <td>Producto con usuarios reales, equipo pequeño. Necesitas validación UX y revisión de riesgos.</td>
            <td>$8–15 / proyecto mediano</td>
          </tr>
          <tr>
            <td><code>enterprise</code></td>
            <td>14: todos los agentes</td>
            <td>Producto con compliance, auditoría o multi-equipo. ADR obligatorio, security audit en cada paso.</td>
            <td>$15–30 / proyecto mediano</td>
          </tr>
        </tbody>
      </table>

      <h2>¿Qué template usar?</h2>
      <table>
        <thead><tr><th>Template</th><th>Stack pre-configurado</th><th>Cuándo usarlo</th></tr></thead>
        <tbody>
          <tr>
            <td><code>api-rest</code></td>
            <td>Node.js + Express/Fastify + JWT + tests unitarios</td>
            <td>Backend de servicio, microservicio, integración con frontend externo. El IR ya viene con autenticación y CRUD pre-definidos.</td>
          </tr>
          <tr>
            <td><code>cli-tool</code></td>
            <td>Node.js ESM + commander.js + output coloreado + tests</td>
            <td>Herramienta de línea de comandos para uso propio o npm publish. Incluye subcomandos, flags y manejo de errores.</td>
          </tr>
          <tr>
            <td><code>saas-mvp</code></td>
            <td>Next.js + Auth.js + Stripe + PostgreSQL + dashboard</td>
            <td>Producto SaaS con autenticación, pagos y panel de admin. El IR incluye pricing tiers, onboarding y métricas.</td>
          </tr>
          <tr>
            <td>(ninguno)</td>
            <td>Libre — el arquitecto define el stack según el IR</td>
            <td>Proyecto no convencional, stack propio o migración de sistema existente.</td>
          </tr>
        </tbody>
      </table>

      <h2>¿Qué proveedor LLM usar?</h2>
      <table>
        <thead><tr><th>Proveedor</th><th>Variable</th><th>Fortaleza</th><th>Limitación</th><th>Cuándo usarlo</th></tr></thead>
        <tbody>
          <tr>
            <td><strong>anthropic</strong> (default)</td>
            <td><code>ANTHROPIC_API_KEY</code></td>
            <td>Máxima calidad en razonamiento y código. Soporte nativo de Claude Code hooks.</td>
            <td>Costo por token más alto. Requiere cuenta.</td>
            <td>Pipeline de producción. Primera elección siempre.</td>
          </tr>
          <tr>
            <td><strong>openai</strong></td>
            <td><code>OPENAI_API_KEY</code></td>
            <td>GPT-4o para tareas de código. Buena relación calidad/precio.</td>
            <td>Sin integración nativa con Claude Code — usa Spec Kit adapter.</td>
            <td>Cuando tienes créditos OpenAI y quieres comparar resultados o probar con otro modelo.</td>
          </tr>
          <tr>
            <td><strong>ollama</strong></td>
            <td>—</td>
            <td>100% local, sin costo de API, privacidad total.</td>
            <td>Calidad inferior en razonamiento complejo. Requiere GPU o CPU potente.</td>
            <td>Proyectos con datos sensibles (no pueden salir de tu máquina). Desarrollo offline.</td>
          </tr>
          <tr>
            <td><strong>stub</strong></td>
            <td>—</td>
            <td>Sin llamadas LLM reales — respuestas mock instantáneas.</td>
            <td>No genera contenido real. Solo para pruebas.</td>
            <td>Tests automatizados de CI, verificar que el pipeline avanza sin gastar tokens.</td>
          </tr>
        </tbody>
      </table>
      <pre><code class="bash"># Cambiar proveedor en una sesión
FORGE_LLM_PROVIDER=openai forge run

# O en sdd.config.yaml:
# llm:
#   provider: ollama</code></pre>

      <h2>¿Qué modo de sesión usar?</h2>
      <table>
        <thead><tr><th>Modo</th><th>Agentes omitidos</th><th>Ahorro tokens</th><th>Cuándo usarlo</th></tr></thead>
        <tbody>
          <tr><td><code>normal</code></td><td>Ninguno</td><td>—</td><td>Proyectos donde la calidad es crítica. Pipeline completo con critico, seguridad, revisor y ADRs.</td></tr>
          <tr><td><code>rapido</code></td><td><code>critico</code></td><td>~30%</td><td>Iteraciones ágiles en proyecto ya validado. Reduce costo sin sacrificar demasiado calidad.</td></tr>
          <tr><td><code>prototipo</code></td><td>critico, seguridad, revisor, operaciones</td><td>~50%</td><td>Demos, PoCs, exploración de ideas. Sin garantías de calidad ni seguridad — no usar en producción.</td></tr>
        </tbody>
      </table>

      <h2>¿SQLite o Markdown para la memoria?</h2>
      <table>
        <thead><tr><th>Backend</th><th>Cuándo se activa</th><th>Ventaja</th><th>Limitación</th></tr></thead>
        <tbody>
          <tr><td><strong>SQLite</strong> (auto)</td><td>Node ≥22.5</td><td>Búsqueda semántica TF-IDF, O(log n), millones de entradas</td><td>Requiere Node ≥22.5</td></tr>
          <tr><td><strong>Markdown</strong> (fallback)</td><td>Node &lt;22.5</td><td>Sin dependencias extra, legible directamente</td><td>Búsqueda O(n), sin scoring semántico</td></tr>
        </tbody>
      </table>
      <p>Para proyectos grandes (+200 archivos, +50 decisiones), actualiza a Node ≥22.5 para activar SQLite.</p>

      <h2>¿Qué elijo si...?</h2>
      <table>
        <thead><tr><th>Situación</th><th>Recomendación</th></tr></thead>
        <tbody>
          <tr><td>Quiero hacer un MVP en un fin de semana</td><td><code>lean</code> + <code>api-rest</code> o <code>cli-tool</code> + modo <code>rapido</code></td></tr>
          <tr><td>Voy a lanzar un SaaS con usuarios reales</td><td><code>startup</code> + <code>saas-mvp</code> + modo <code>normal</code> + Anthropic</td></tr>
          <tr><td>Trabajo con datos confidenciales que no pueden salir de mi máquina</td><td><code>lean</code> + <code>ollama</code> + modo <code>prototipo</code></td></tr>
          <tr><td>Quiero usar FORGE en CI para verificar el pipeline</td><td><code>stub</code> como proveedor + <code>lean</code> — sin costo de API</td></tr>
          <tr><td>Tengo un proyecto existente y quiero incorporar FORGE</td><td><code>forge init</code> (sin template) + <code>forge import --from=speckit --merge</code></td></tr>
        </tbody>
      </table>
    `
  },
  en: {
    titulo: "Usage Plans",
    html: `
      <h1>Usage Plans</h1>
      <p class="lead">Decision guide: which preset, template, LLM provider and session mode to use for your project.</p>

      <h2>Which preset?</h2>
      <table>
        <thead><tr><th>Preset</th><th>Active agents</th><th>When to use</th><th>Est. cost</th></tr></thead>
        <tbody>
          <tr><td><code>lean</code></td><td>6: arquitecto, asesor-datos, disenador-api, backend, frontend, tester</td><td>MVP, hackathon, PoC. Speed over exhaustiveness.</td><td>$3–8 / med. project</td></tr>
          <tr><td><code>startup</code></td><td>8: lean + critico + product-designer</td><td>Product with real users. Needs UX validation and risk review.</td><td>$8–15 / med. project</td></tr>
          <tr><td><code>enterprise</code></td><td>14: all agents</td><td>Compliance, audit, multi-team. Mandatory ADR, security audit at each step.</td><td>$15–30 / med. project</td></tr>
        </tbody>
      </table>

      <h2>Which template?</h2>
      <table>
        <thead><tr><th>Template</th><th>Pre-configured stack</th><th>When to use</th></tr></thead>
        <tbody>
          <tr><td><code>api-rest</code></td><td>Node.js + Express/Fastify + JWT + unit tests</td><td>Backend service, microservice, external frontend integration.</td></tr>
          <tr><td><code>cli-tool</code></td><td>Node.js ESM + commander.js + colored output + tests</td><td>Command-line tool for personal use or npm publish.</td></tr>
          <tr><td><code>saas-mvp</code></td><td>Next.js + Auth.js + Stripe + PostgreSQL + dashboard</td><td>SaaS product with auth, payments and admin panel.</td></tr>
        </tbody>
      </table>

      <h2>Which LLM provider?</h2>
      <table>
        <thead><tr><th>Provider</th><th>Strength</th><th>When to use</th></tr></thead>
        <tbody>
          <tr><td><strong>anthropic</strong></td><td>Best reasoning and code quality. Native Claude Code hooks.</td><td>Production pipeline. Always first choice.</td></tr>
          <tr><td><strong>openai</strong></td><td>GPT-4o for code tasks. Good cost/quality ratio.</td><td>When you have OpenAI credits or want to compare models.</td></tr>
          <tr><td><strong>ollama</strong></td><td>100% local, no API cost, total privacy.</td><td>Sensitive data projects (can't leave your machine). Offline development.</td></tr>
          <tr><td><strong>stub</strong></td><td>No real LLM calls — instant mock responses.</td><td>CI automated tests, verify pipeline advances without spending tokens.</td></tr>
        </tbody>
      </table>

      <h2>Quick guide: what do I choose if...?</h2>
      <table>
        <thead><tr><th>Situation</th><th>Recommendation</th></tr></thead>
        <tbody>
          <tr><td>I want an MVP over a weekend</td><td><code>lean</code> + <code>api-rest</code> or <code>cli-tool</code> + <code>rapido</code> mode</td></tr>
          <tr><td>I'm launching a SaaS with real users</td><td><code>startup</code> + <code>saas-mvp</code> + <code>normal</code> mode + Anthropic</td></tr>
          <tr><td>Confidential data that can't leave my machine</td><td><code>lean</code> + <code>ollama</code> + <code>prototipo</code> mode</td></tr>
          <tr><td>I want to use FORGE in CI without API cost</td><td><code>stub</code> provider + <code>lean</code></td></tr>
          <tr><td>I have an existing project and want to add FORGE</td><td><code>forge init</code> (no template) + <code>forge import --from=speckit --merge</code></td></tr>
        </tbody>
      </table>
    `
  }
},

"flujos-operativos": {
  seccion: "operate",
  es: {
    titulo: "Flujos Operativos",
    html: `
      <h1>Flujos Operativos</h1>
      <p class="lead">Cómo funciona FORGE en la práctica: pipeline en Claude Code, uso del runner portable, y recuperación de errores.</p>

      <h2>Flujo en Claude Code (modo plugin)</h2>
      <pre><code class="text">Usuario: /forge "quiero una API para gestionar tareas"
│
├── Hub /forge detecta: "crear nuevo"
│
├── sdd.interpretar
│   ├── arquitecto analiza la idea
│   ├── Genera .sdd/ir.json (confidence ≥0.7)
│   └── [GATE] ¿Apruebas la interpretación? → Sí
│
├── sdd.diseñar
│   ├── product-designer define UX y pantallas
│   └── architecture-designer define stack técnico
│
├── sdd.especificar
│   └── [GATE] ¿Apruebas la spec? → Sí
│
├── sdd.planificar
│   ├── arquitecto diseña plan técnico + ADRs en SQLite
│   └── [GATE] ¿Apruebas el plan? → Sí
│
├── sdd.implementar
│   ├── desarrollador-backend + tester (TDD)
│   └── seguridad: auditoría de cambios sensibles
│
├── sdd.verificar
│   └── [GATE] ✅ Todos pasan / ❌ Itera
│
└── sdd.desplegar</code></pre>

      <h2>Flujo con runner portable (sin Claude Code)</h2>
      <pre><code class="bash"># 1. Ver estado actual
forge status
#   💡 idea ◄  →  🔍 discovery  →  📋 ir  →  ...

# 2. Avanzar manualmente (genera handoff para agente externo)
forge step discovery
forge dispatch --agente=investigador --tarea="Analiza el contexto" --adapter=speckit
# → crea speckit-handoff/TASK.md para Cursor/Copilot/Gemini

# 3. Una vez el agente externo generó el IR, importarlo
forge import --from=speckit --merge

# 4. Buscar decisiones previas relacionadas
forge decisions search "auth JWT"

# 5. Continuar el pipeline
forge step ir
forge validate   # verifica precondiciones antes de seguir</code></pre>

      <h2>Flujo de búsqueda semántica de decisiones</h2>
      <pre><code class="bash">forge decisions search "autenticación seguridad"
# → 1. [52%] Usar JWT stateless — Sin BD de sesiones (arquitecto)
#   2. [31%] Implementar rate limiting en endpoints públicos (seguridad)
#   3. [18%] Usar bcrypt para hashing de contraseñas (seguridad)

# Registrar nueva decisión
forge decisions add "Usar refresh tokens con rotación automática"

# Marcar como superseded si se cambia de opinión (via API)
# forge decisions list → obtener ID → store.superseder(id, nuevaDecision)</code></pre>

      <h2>Gates de aprobación (modo Claude Code)</h2>
      <ul>
        <li><strong>"sí"</strong> → FORGE continúa a la siguiente fase</li>
        <li><strong>"cambia esto"</strong> → FORGE revisa y vuelve a presentar</li>
        <li><strong>"no me convence X"</strong> → FORGE aplica la retroalimentación</li>
      </ul>

      <h2>Recuperación de errores</h2>
      <table>
        <thead><tr><th>Error</th><th>Acción</th></tr></thead>
        <tbody>
          <tr><td>Transición inválida de pipeline</td><td><code>forge step &lt;paso&gt; --force</code> para forzar; <code>forge status</code> para ver transiciones válidas</td></tr>
          <tr><td>Estado corrupto (estado.json)</td><td><code>forge doctor</code> detecta; <code>forge reset --force</code> para empezar desde idea</td></tr>
          <tr><td>Hook bloqueó acción (exit 2)</td><td>El stderr explica el motivo — corregir la causa o aprobar manualmente si es legítimo</td></tr>
          <tr><td>Presupuesto agotado</td><td><code>export FORGE_BUDGET_BLOCK_USD=2.0</code> para ampliar, o nueva sesión para resetear</td></tr>
          <tr><td>consumo.jsonl supera 10MB</td><td>Rotación automática a .1/.2/.3 — sin intervención</td></tr>
        </tbody>
      </table>

      <h2>Comandos de diagnóstico</h2>
      <pre><code class="bash">forge doctor         # API key, hooks en disco y sintaxis válida
forge status         # Visual del pipeline + paso actual + artefactos
forge validate       # Precondiciones del paso actual
forge state          # Vuelca estado.json completo
forge logs           # Últimas entradas de consumo.jsonl
forge logs --last 20 # Últimas 20 entradas</code></pre>
    `
  },
  en: {
    titulo: "Operational Flows",
    html: `
      <h1>Operational Flows</h1>
      <p class="lead">How FORGE works in practice: plugin pipeline, portable runner usage, and error recovery.</p>

      <h2>Portable runner flow (no Claude Code)</h2>
      <pre><code class="bash">forge status          # View current pipeline state
forge step discovery  # Advance step
forge dispatch --agente=main --tarea="Analyze context" --adapter=speckit
# → creates speckit-handoff/TASK.md for Cursor/Copilot/Gemini

forge import --from=speckit --merge  # Import back when done
forge decisions search "auth JWT"    # Semantic search in decisions
forge validate                       # Check preconditions before advancing</code></pre>

      <h2>Error recovery</h2>
      <table>
        <thead><tr><th>Error</th><th>Action</th></tr></thead>
        <tbody>
          <tr><td>Invalid pipeline transition</td><td><code>forge step &lt;step&gt; --force</code> to force; <code>forge status</code> to see valid transitions</td></tr>
          <tr><td>Corrupt state</td><td><code>forge doctor</code> detects; <code>forge reset --force</code> to restart from idea</td></tr>
          <tr><td>Hook blocked action (exit 2)</td><td>stderr explains the reason — fix cause or manually approve if legitimate</td></tr>
          <tr><td>Budget exceeded</td><td><code>export FORGE_BUDGET_BLOCK_USD=2.0</code> or start a new session</td></tr>
        </tbody>
      </table>
    `
  }
},

"ejemplos": {
  seccion: "operate",
  es: {
    titulo: "Ejemplos de Uso",
    html: `
      <h1>Ejemplos de Uso</h1>
      <p class="lead">Casos concretos con comandos reales y artefactos esperados. Cada ejemplo muestra un camino distinto a través de FORGE.</p>

      <h2>Ejemplo 1 — API REST con JWT (modo plugin, Claude Code)</h2>
      <p><strong>Contexto:</strong> Quieres una API para gestionar tareas de equipo con autenticación. Usas el template <code>api-rest</code> y el preset <code>lean</code>.</p>
      <pre><code class="bash"># 1. Instalar y preparar
git clone https://github.com/carlos060798/FORGE && cd FORGE && npm install
cd ~/mi-proyecto
forge init --template api-rest --preset lean
forge doctor         # ✅ API key OK · ✅ hooks OK · ✅ LLM ping OK</code></pre>
      <pre><code class="text"># 2. Iniciar en Claude Code
/forge "quiero una API para que mi equipo registre horas de trabajo con autenticación JWT"

# FORGE responde con el IR generado:
</code></pre>
      <pre><code class="json">// .sdd/ir.json (extracto)
{
  "confidence": 0.87,
  "product": {
    "name": "TimeTrack API",
    "type": "api",
    "description": "API REST para registro de horas con JWT y roles"
  },
  "features": {
    "core": [
      { "nombre": "Autenticación JWT", "descripcion": "Login, refresh token, logout" },
      { "nombre": "Registro de horas", "descripcion": "CRUD de entradas por usuario" },
      { "nombre": "Roles", "descripcion": "admin vs employee — vistas distintas" }
    ]
  }
}</code></pre>
      <pre><code class="text"># 3. Gate de aprobación de spec
forge aprobar spec

# 4. Pipeline continúa automáticamente: plan → tasks → code
# El tester genera tests TDD antes que el backend los implementa

# 5. Ver progreso
forge status
# ✅ idea → ✅ discovery → ✅ ir → ✅ design → ✅ spec → ✅ plan → ▶ tasks → … code → done

forge ui   # dashboard en localhost:3001 con SSE tiempo real</code></pre>

      <h2>Ejemplo 2 — CLI tool (preset lean + modo rapido)</h2>
      <p><strong>Contexto:</strong> Herramienta para convertir CSV a JSON con validación de esquema. Quieres ir rápido.</p>
      <pre><code class="bash">forge init --template cli-tool --preset lean

# En sdd.config.yaml, activar modo rápido:
# sesion:
#   modo: rapido

/forge "una CLI que lea un CSV, valide su estructura contra un esquema JSON y exporte a JSON con errores marcados"

# Sin agente 'critico', el pipeline es ~30% más rápido
# Output esperado:
#   .sdd/ir.json              ← idea interpretada
#   .sdd/especificaciones/    ← spec con 3 HUs y 8 CAs
#   src/index.js              ← CLI con commander.js
#   src/validator.js          ← lógica de validación
#   tests/validator.test.js   ← tests TDD (pasan en verde)</code></pre>

      <h2>Ejemplo 3 — Runner portable sin Claude Code</h2>
      <p><strong>Contexto:</strong> Tu empresa no tiene Claude Code. Tienes Cursor. Quieres que FORGE gestione el pipeline y pase tareas a Cursor.</p>
      <pre><code class="bash"># 1. Inicializar y avanzar sin LLM
forge init
forge status
# ⬜ idea (actual)

forge step discovery   # avanza con guards de la state machine

# 2. Despachar tarea al adaptador Spec Kit (portable)
forge dispatch \
  --agente=investigador \
  --tarea="Analiza el proyecto existente y extrae el contexto técnico" \
  --adapter=speckit

# FORGE genera speckit-handoff/ con:
ls speckit-handoff/
# TASK.md            ← instrucción para Cursor/Copilot/Gemini
# spec.md            ← especificación del producto
# pipeline-state.json← paso actual y artefactos disponibles
# README.md          ← cómo consumir este handoff</code></pre>
      <pre><code class="text"># 3. Abrir TASK.md en Cursor y dejar que lo ejecute
# Cursor genera el IR y lo escribe en speckit-handoff/output/

# 4. Importar el resultado de vuelta a FORGE
forge import --from=speckit --dir=speckit-handoff/output --merge

# 5. Continuar el pipeline
forge step ir
forge validate   # verifica precondiciones
forge decisions search "arquitectura"   # busca decisiones previas relevantes</code></pre>

      <h2>Ejemplo 4 — Proyecto existente (import + merge)</h2>
      <p><strong>Contexto:</strong> Tienes un proyecto Node.js en producción. Quieres usar FORGE para spec y planificar una nueva feature sin romper lo que hay.</p>
      <pre><code class="bash"># 1. Inicializar en el proyecto existente (no borra nada)
cd ~/mi-proyecto-existente
forge init

# 2. El investigador analiza el contexto existente
/sdd.descubrir

# 3. Definir la feature a añadir
/forge "añadir sistema de notificaciones en tiempo real (WebSockets) al proyecto existente"

# 4. El arquitecto detecta el stack existente automáticamente
#    (core/stack-detector.js lee package.json, estructura de carpetas)
#    y genera la spec adaptada al stack real

# 5. Ver decisiones previas antes de planificar
forge decisions list
# → [JWT stateless] [PostgreSQL sin ORM] [REST over GraphQL]

# 6. Aprobar spec y continuar
forge aprobar spec
# forge plan → plan toma en cuenta las decisiones existentes</code></pre>

      <div class="callout tip">
        <p><strong>Consejo:</strong> En proyectos existentes, <code>forge import --from=speckit --merge</code> es no-destructivo: solo rellena los huecos del estado que faltan, nunca sobreescribe artefactos ya existentes.</p>
      </div>
    `
  },
  en: {
    titulo: "Usage Examples",
    html: `
      <h1>Usage Examples</h1>
      <p class="lead">Concrete cases with real commands and expected artifacts. Each example shows a different path through FORGE.</p>

      <h2>Example 1 — REST API with JWT (plugin mode)</h2>
      <pre><code class="bash">forge init --template api-rest --preset lean
forge doctor

/forge "I want an API for my team to log work hours with JWT authentication"

# After IR review:
forge aprobar spec

# Pipeline continues: plan → tasks → code → done
forge status  # visual progress
forge ui      # SSE dashboard at localhost:3001</code></pre>

      <h2>Example 2 — CLI tool (fast mode)</h2>
      <pre><code class="bash">forge init --template cli-tool --preset lean
# sdd.config.yaml: sesion.modo: rapido  (skips 'critico' agent, ~30% fewer tokens)

/forge "a CLI that reads CSV, validates against JSON schema and exports with error markers"</code></pre>

      <h2>Example 3 — Portable runner (no Claude Code)</h2>
      <pre><code class="bash">forge init
forge step discovery
forge dispatch --agente=investigador --tarea="Analyze existing context" --adapter=speckit
# → generates speckit-handoff/TASK.md for Cursor/Copilot/Gemini

# After the external agent runs:
forge import --from=speckit --dir=speckit-handoff/output --merge
forge step ir
forge validate</code></pre>

      <h2>Example 4 — Existing project</h2>
      <pre><code class="bash">cd ~/my-existing-project
forge init   # non-destructive, adds .sdd/ alongside existing code

/forge "add real-time WebSocket notifications to the existing project"
# stack-detector.js reads package.json and folder structure automatically

forge decisions list   # review existing decisions before planning
forge aprobar spec     # proceed to plan</code></pre>
    `
  }
},

"api-comandos": {
  seccion: "operate",
  es: {
    titulo: "Referencia de Comandos",
    html: `
      <h1>Referencia de Comandos</h1>
      <p class="lead">Todos los slash commands disponibles en Claude Code y comandos completos del CLI.</p>

      <h2>Slash commands (Claude Code)</h2>
      <table>
        <thead><tr><th>Comando</th><th>Descripción</th></tr></thead>
        <tbody>
          <tr><td><code>/forge "idea"</code></td><td>Inicia o continúa el pipeline</td></tr>
          <tr><td><code>/forge.explicame</code></td><td>Explica el estado en lenguaje humano</td></tr>
          <tr><td><code>/forge.desplegar vercel</code></td><td>Despliega en Vercel via MCP</td></tr>
          <tr><td><code>/forge.compartir</code></td><td>Genera resumen Markdown del progreso</td></tr>
          <tr><td><code>/sdd.interpretar [texto]</code></td><td>Interpreta una idea y genera IR</td></tr>
          <tr><td><code>/sdd.diseñar</code></td><td>Diseño de producto y stack técnico</td></tr>
          <tr><td><code>/sdd.especificar</code></td><td>Genera spec.md desde IR activo</td></tr>
          <tr><td><code>/sdd.planificar</code></td><td>Plan técnico + ADRs</td></tr>
          <tr><td><code>/sdd.implementar</code></td><td>Implementación con TDD</td></tr>
          <tr><td><code>/sdd.verificar</code></td><td>Verifica criterios de aceptación</td></tr>
          <tr><td><code>/sdd.desplegar</code></td><td>Despliega el proyecto</td></tr>
          <tr><td><code>/sdd.estado</code></td><td>Estado actual del pipeline</td></tr>
          <tr><td><code>/sdd.snapshot</code></td><td>Guarda snapshot del estado</td></tr>
          <tr><td><code>/sdd.ayuda</code></td><td>Ayuda contextual del paso actual</td></tr>
          <tr><td><code>/sdd.exportar</code></td><td>Exporta artefactos a Spec Kit</td></tr>
          <tr><td><code>/sdd.importar</code></td><td>Importa artefactos desde Spec Kit</td></tr>
        </tbody>
      </table>

      <h2>CLI de terminal — Referencia completa</h2>
      <pre><code class="bash"># Instalación y mantenimiento
forge init                            # Instala FORGE en el proyecto
forge init --global                   # Instala para todos los proyectos
forge init --template api-rest|cli-tool|saas-mvp
forge init --preset lean|startup|enterprise
forge update                          # Actualiza núcleo sin tocar .sdd/
forge doctor                          # Diagnóstico: hooks, API key, LLM (ping con haiku), SQLite
forge --version                       # Versión instalada

# Pipeline
forge status                          # Visual del pipeline con ANSI
forge run                             # Ejecuta tareas pendientes del pipeline
forge resume                          # Reanuda ejecución interrumpida
forge aprobar spec                    # Aprueba la spec (desbloquea spec→plan)
forge step &lt;paso&gt;                     # Avanza en el pipeline con guards
forge step &lt;paso&gt; --force             # Fuerza sin guards (recuperación)
forge validate                        # Verifica precondiciones del paso actual
forge state                           # Vuelca estado.json formateado
forge reset --force                   # Resetea a 'idea' (conserva .sdd/)

# Artefactos portables
forge export --format=speckit         # Exporta a Spec Kit (GitHub)
forge export --format=openspec        # Exporta a OpenSpec (JSON único)
forge export --format=speckit --out=./mi-export
forge import --from=speckit --dir=./mi-export
forge import --from=openspec --file=./openspec.json
forge import --from=speckit --merge   # No-destructivo: solo llena huecos

# Adaptadores
forge dispatch --agente=&lt;nombre&gt; --tarea="&lt;descripción&gt;"
forge dispatch --agente=main --tarea="X" --adapter=speckit
forge dispatch --agente=main --tarea="X" --adapter=claude-code
forge dispatch --agente=main --tarea="X" --tier=low|medium|high
forge adapters                        # Lista adaptadores disponibles

# Decisiones arquitectónicas
forge decisions list                  # Lista decisiones activas
forge decisions search "&lt;consulta&gt;"  # Búsqueda semántica TF-IDF con score
forge decisions add "&lt;texto&gt;"        # Registra decisión manual
forge decisions consolidate [días]    # Elimina obsoletas antiguas (default: 90)
forge decisions migrate               # Importa ADRs.jsonl existente a SQLite

# Observabilidad
forge logs                            # Últimas entradas de consumo.jsonl
forge logs --last 20                  # Últimas N entradas
forge ui [--port N]                   # Dashboard en localhost:3001

# Configuración
forge config show                     # Muestra sdd.config.yaml completo
forge config get &lt;key&gt;               # Lee valor específico
forge config set &lt;key&gt; &lt;val&gt;         # Modifica valor
forge config validate                 # Valida estructura del config</code></pre>
    `
  },
  en: {
    titulo: "Command Reference",
    html: `
      <h1>Command Reference</h1>
      <p class="lead">All slash commands and full CLI reference.</p>

      <h2>Full CLI reference</h2>
      <pre><code class="bash"># Install
forge init --template api-rest|cli-tool|saas-mvp
forge init --preset lean|startup|enterprise
forge doctor

# Pipeline
forge status
forge run                     # execute pending tasks
forge resume                  # resume interrupted execution
forge aprobar spec            # approve spec (unlocks spec→plan)
forge step &lt;step&gt; [--force]
forge validate
forge reset --force

# Portable artifacts
forge export --format=speckit|openspec
forge import --from=speckit|openspec [--merge]

# Adapters
forge dispatch --agente=&lt;name&gt; --tarea="&lt;task&gt;" [--adapter=speckit|claude-code]
forge adapters

# Decisions
forge decisions list|search "&lt;query&gt;"|add "&lt;text&gt;"|migrate|consolidate

# Observability
forge logs [--last N]
forge ui [--port N]</code></pre>
    `
  }
},

/* ─────────────────────────────────────────────────────────────
   GRUPO 4 — Extensibilidad
───────────────────────────────────────────────────────────── */

"extensibilidad": {
  seccion: "extend",
  es: {
    titulo: "Cómo Extender FORGE",
    html: `
      <h1>Cómo Extender FORGE</h1>
      <p class="lead">FORGE está diseñado para ser extensible: puedes añadir agentes, skills, comandos, adaptadores de host e integraciones MCP sin tocar el núcleo.</p>

      <div class="callout tip">
        <p><strong>Regla de oro:</strong> Nunca añadas dependencias npm al runtime (<code>cli/</code>, <code>claude-hooks/</code>, <code>core/</code>). FORGE es zero-deps por diseño.</p>
      </div>

      <h2>Añadir un nuevo agente</h2>
      <pre><code class="markdown">---
name: mi-agente
description: "Descripción de una línea del rol"
model: claude-sonnet-4-6
color: "#ff6b6b"
tools: ["Read", "Glob", "Grep"]
---

# Mi Agente

## Rol
Descripción de responsabilidad en el pipeline

## Proceso
1. Cargar memoria: cat .sdd/memoria/agente-mi-agente.md
2. [Pasos de trabajo]
3. Registrar decisión: // ADR: {"decision":"...","context":"..."}</code></pre>

      <p>Registrar en <code>.claude-plugin/plugin.json</code> bajo <code>"agents"</code>. Si el agente debe ser read-only, añadir su nombre a <code>READ_ONLY_AGENTS</code> en <code>claude-hooks/pre-tool-guard.js</code>.</p>

      <h2>Añadir un nuevo adaptador de host</h2>
      <pre><code class="js">// core/adapters/mi-adaptador.js
import { ForgeAdapter } from './adapter-interface.js';

export class MiAdaptador extends ForgeAdapter {
  get nombre() { return 'mi-adaptador'; }

  disponible() {
    // Retorna true si el adaptador puede usarse en el entorno actual
    return !!process.env.MI_AGENTE_ENV;
  }

  async ejecutar(tarea) {
    const { valid, errors } = this.validarTarea(tarea);
    if (!valid) return this.error(errors.join('; '));

    // ... lógica de ejecución ...

    return this.exito({
      resultado: 'Tarea completada',
      artefactos: ['ruta/al/artefacto'],
    });
  }
}

// Registrar en core/adapters/index.js:
// adapterRegistry.registrar(new MiAdaptador());</code></pre>

      <h2>Añadir un nuevo skill</h2>
      <pre><code class="markdown">---
id: mi-skill
nombre: Mi Skill
descripcion: "Qué hace en una línea"
aliases: ["/forge.mi-skill"]
version: 1.0.0
---

# Skill: Mi Skill

## Propósito
[Qué problema resuelve]

## Instrucciones para el agente
[Pasos concretos]</code></pre>

      <h2>Añadir un nuevo comando SDD</h2>
      <pre><code class="markdown">---
description: "Descripción del comando"
allowed-tools: [Read, Write, Bash]
---

# /sdd.nombre

## VERIFICACIONES PRE-EJECUCIÓN
\`\`\`bash
[ -f ".sdd/estado.json" ] || { echo "FORGE no inicializado"; exit 1; }
\`\`\`

## INSTRUCCIONES
[Qué debe hacer el agente]

[HANDOFF: → sdd.siguiente]</code></pre>

      <h2>Integrar un MCP externo</h2>
      <pre><code class="json">// .mcp.json
{
  "mcpServers": {
    "mi-servicio": {
      "command": "npx",
      "args": ["@mi-org/mcp-servidor@latest"]
    }
  }
}</code></pre>
      <p>Luego crear el skill que usa las herramientas del MCP y documentar en <code>docs/INTEGRACIONES.md</code>.</p>
    `
  },
  en: {
    titulo: "How to Extend FORGE",
    html: `
      <h1>How to Extend FORGE</h1>
      <p class="lead">You can add agents, skills, commands, host adapters and MCP integrations without touching the core.</p>

      <div class="callout tip">
        <p><strong>Golden rule:</strong> Never add npm dependencies to the runtime. FORGE is zero-deps by design.</p>
      </div>

      <h2>Add a host adapter</h2>
      <pre><code class="js">import { ForgeAdapter } from './adapter-interface.js';

export class MyAdapter extends ForgeAdapter {
  get nombre() { return 'my-adapter'; }
  disponible() { return !!process.env.MY_AGENT_ENV; }
  async ejecutar(tarea) {
    const { valid, errors } = this.validarTarea(tarea);
    if (!valid) return this.error(errors.join('; '));
    // ... execution logic ...
    return this.exito({ resultado: 'Done', artefactos: [] });
  }
}</code></pre>

      <h2>Add an agent</h2>
      <pre><code class="markdown">---
name: my-agent
model: claude-sonnet-4-6
tools: ["Read", "Glob", "Grep"]
---</code></pre>
      <p>Register in <code>.claude-plugin/plugin.json</code> under <code>"agents"</code>. If read-only, add name to <code>READ_ONLY_AGENTS</code> in <code>pre-tool-guard.js</code>.</p>
    `
  }
},

"integraciones": {
  seccion: "extend",
  es: {
    titulo: "Integraciones MCP",
    html: `
      <h1>Integraciones MCP</h1>
      <p class="lead">MCPs externos que FORGE puede usar para extender sus capacidades. Las integraciones MCP solo aplican al modo plugin (Claude Code).</p>

      <table>
        <thead><tr><th>MCP</th><th>Skill</th><th>Capacidad</th><th>Estado</th></tr></thead>
        <tbody>
          <tr><td><strong>Vercel</strong></td><td><code>deploy-vercel</code></td><td>Deploy automático desde el pipeline</td><td>🔵 Beta</td></tr>
          <tr><td><strong>GitHub</strong></td><td><code>github-connect</code></td><td>Repos, PRs, workflows</td><td>🔵 Beta</td></tr>
          <tr><td><strong>Playwright</strong></td><td>(en .mcp.json)</td><td>Browser testing E2E</td><td>🔵 Beta</td></tr>
          <tr><td><strong>Figma</strong></td><td>(referenciado en docs)</td><td>Importar especificaciones de diseño</td><td>🧪 Experimental</td></tr>
          <tr><td><strong>Slack</strong></td><td>Roadmap</td><td>Notificaciones de pipeline</td><td>🗺️ Roadmap</td></tr>
          <tr><td><strong>Linear</strong></td><td>Roadmap</td><td>Sync de tareas con tickets</td><td>🗺️ Roadmap</td></tr>
        </tbody>
      </table>

      <div class="callout warning">
        <p><strong>Nota:</strong> Las integraciones MCP requieren Claude Code como host. En modo runner portable, usa <code>forge dispatch --adapter=speckit</code> para generar artefactos que otro sistema puede consumir.</p>
      </div>

      <h2>Cómo activar Vercel</h2>
      <ol>
        <li>Instala el MCP de Vercel en Claude Code</li>
        <li>Autentica con tu cuenta de Vercel</li>
        <li>Escribe: <code>/forge.desplegar vercel</code> o <code>/sdd.desplegar</code></li>
        <li>El skill <code>deploy-vercel</code> verifica que el paso del pipeline sea <code>code</code> o <code>done</code></li>
      </ol>

      <h2>Verificar MCPs detectados</h2>
      <pre><code class="bash">forge doctor
# Muestra:
#   API key Anthropic: ✅ configurada
#   Hooks en disco:    ✅ pre-tool-guard.js, agent-memory.js, context-manager.js
#   Sintaxis de hooks: ✅ sin errores
#   Vercel MCP:        ✅ detectado
#   GitHub MCP:        ✅ detectado
#   Figma MCP:         ⚠️  no instalado (opcional)</code></pre>
    `
  },
  en: {
    titulo: "MCP Integrations",
    html: `
      <h1>MCP Integrations</h1>
      <p class="lead">External MCPs that extend FORGE capabilities. MCP integrations only apply to plugin mode (Claude Code).</p>

      <div class="callout warning">
        <p><strong>Note:</strong> MCP integrations require Claude Code as host. In portable runner mode, use <code>forge dispatch --adapter=speckit</code> to generate artifacts for other systems.</p>
      </div>

      <table>
        <thead><tr><th>MCP</th><th>Skill</th><th>Capability</th><th>Status</th></tr></thead>
        <tbody>
          <tr><td><strong>Vercel</strong></td><td><code>deploy-vercel</code></td><td>Auto-deploy from pipeline</td><td>🔵 Beta</td></tr>
          <tr><td><strong>GitHub</strong></td><td><code>github-connect</code></td><td>Repos, PRs, workflows</td><td>🔵 Beta</td></tr>
          <tr><td><strong>Playwright</strong></td><td>(in .mcp.json)</td><td>E2E browser testing</td><td>🔵 Beta</td></tr>
          <tr><td><strong>Figma</strong></td><td>—</td><td>Import design specs</td><td>🧪 Experimental</td></tr>
        </tbody>
      </table>
    `
  }
},

"recomendaciones": {
  seccion: "extend",
  es: {
    titulo: "Recomendaciones",
    html: `
      <h1>Recomendaciones</h1>
      <p class="lead">Qué cambios tendrían mayor impacto en FORGE v4.2.0, ordenados por prioridad.</p>

      <h2>Completado en v4.2.0</h2>
      <ul>
        <li>✅ <strong>Tests E2E del pipeline</strong> — <code>tests/e2e/pipeline-flow.test.js</code>, 24 tests, idea→spec sin LLM</li>
        <li>✅ <strong>SSE en dashboard</strong> — estado, consumo y eventlog en tiempo real; fallback polling</li>
        <li>✅ <strong>Motor LLM agnóstico</strong> — Anthropic, OpenAI, Ollama, Stub via <code>core/llm-providers/</code></li>
        <li>✅ <strong>Hooks multi-lenguaje</strong> — <code>.js</code> + <code>.sh</code>; funciona sin Node en el proyecto destino</li>
        <li>✅ <strong>Aprobación humana obligatoria</strong> — guard <code>spec → plan</code> requiere <code>forge aprobar spec</code></li>
        <li>✅ <strong>Memoria compartida entre agentes</strong> — <code>.sdd/memoria/compartida/decisiones-clave.md</code></li>
      </ul>

      <h2>Alta prioridad</h2>

      <div class="callout warning">
        <p><strong>Routing condicional por confidence del IR</strong></p>
        <p><code>ir.json</code> tiene un campo <code>confidence</code> (0-1). Si es &lt; 0.7, FORGE debería pedir aclaración antes de diseñar. La lógica está documentada en <code>commands/sdd.diseñar.md</code> pero no hay guard ejecutable en el runner.</p>
        <p><strong>Acción:</strong> Añadir guard en la transición <code>ir → design</code> de la state machine que evalúe <code>ir_confidence</code> del estado.</p>
      </div>

      <div class="callout warning">
        <p><strong>Routing real de modelo por agente</strong></p>
        <p><code>model-registry.js</code> registra qué modelo usaría cada agente, pero no puede cambiarlo en tiempo de ejecución. El modelo efectivo está fijo en el frontmatter YAML del agente.</p>
        <p><strong>Acción:</strong> Monitorear la API de Claude Code. Cuando exponga override de modelo por tool call, <code>model-registry.js</code> ya tiene la lógica lista.</p>
      </div>

      <h2>Media prioridad</h2>

      <div class="callout tip">
        <p><strong>Indexación de TypeScript avanzado</strong></p>
        <p><code>acorn</code> cubre JS y TS básico-medio (decoradores, genéricos, JSX — 18 tests). TypeScript avanzado (namespaces, conditional types, template literal types) puede fallar silenciosamente.</p>
        <p><strong>Acción:</strong> Añadir <code>@typescript-eslint/typescript-estree</code> como parser alternativo para archivos <code>.ts</code>.</p>
      </div>

      <div class="callout tip">
        <p><strong>Segundo adaptador de host (Cursor / Copilot)</strong></p>
        <p>El adaptador Spec Kit ya genera handoff portable. El siguiente paso es un adaptador específico para Cursor o VS Code.</p>
        <p><strong>Acción:</strong> Extender <code>ForgeAdapter</code> con un <code>CursorAdapter</code> que use el protocolo de extensión de Cursor.</p>
      </div>

      <h2>Baja prioridad</h2>
      <ul>
        <li><strong>Marketplace de templates</strong> — El formato es estable; crear repositorio de templates de la comunidad</li>
        <li><strong>Embeddings semánticos reales</strong> — El TF-IDF funciona bien sin deps externas; embeddings locales mejorarían la recall en colecciones grandes</li>
        <li><strong>Driver HTTP headless v2</strong> — Runner completo sin Claude Code instalado, solo con API key</li>
      </ul>

      <h2>Para contribuir</h2>
      <pre><code class="bash">git checkout -b feature/mi-contribucion
npm test           # 998/998 en verde antes de PR</code></pre>
    `
  },
  en: {
    titulo: "Recommendations",
    html: `
      <h1>Recommendations</h1>
      <p class="lead">What changes would have the greatest impact on FORGE v4.2.0, ordered by priority.</p>

      <h2>Completed in v4.2.0</h2>
      <ul>
        <li>✅ <strong>E2E pipeline tests</strong> — <code>tests/e2e/pipeline-flow.test.js</code>, 24 tests, idea→spec without LLM</li>
        <li>✅ <strong>SSE dashboard</strong> — real-time state, consumption and eventlog; polling fallback</li>
        <li>✅ <strong>LLM-agnostic engine</strong> — Anthropic, OpenAI, Ollama, Stub via <code>core/llm-providers/</code></li>
        <li>✅ <strong>Multi-language hooks</strong> — <code>.js</code> + <code>.sh</code>; works without Node in target project</li>
        <li>✅ <strong>Mandatory human approval</strong> — <code>spec → plan</code> guard requires <code>forge aprobar spec</code></li>
        <li>✅ <strong>Shared agent memory</strong> — <code>.sdd/memoria/compartida/decisiones-clave.md</code></li>
      </ul>

      <h2>High priority</h2>

      <div class="callout warning">
        <p><strong>Conditional routing by IR confidence</strong></p>
        <p><code>ir.json</code> has a <code>confidence</code> field (0-1). If &lt; 0.7, FORGE should request clarification before designing. Logic is documented in <code>commands/sdd.diseñar.md</code> but there's no executable guard in the runner.</p>
        <p><strong>Action:</strong> Add a guard on the <code>ir → design</code> transition that checks <code>ir_confidence</code> from state.</p>
      </div>

      <div class="callout warning">
        <p><strong>Real per-agent model routing</strong></p>
        <p><code>model-registry.js</code> records the intended model but cannot override it at runtime. Effective model is set in agent YAML frontmatter.</p>
        <p><strong>Action:</strong> Monitor Claude Code API for per-tool-call model override. <code>model-registry.js</code> already has the logic ready.</p>
      </div>

      <h2>Medium priority</h2>
      <ul>
        <li><strong>Advanced TypeScript AST indexing</strong> — Add <code>@typescript-eslint/typescript-estree</code> as alternative parser for <code>.ts</code> files</li>
        <li><strong>Second host adapter</strong> — <code>CursorAdapter</code> extending <code>ForgeAdapter</code></li>
      </ul>

      <h2>Low priority</h2>
      <ul>
        <li><strong>Template marketplace</strong> — Format is stable; create community template repository</li>
        <li><strong>Real semantic embeddings</strong> — TF-IDF works well; local embeddings would improve recall at scale</li>
        <li><strong>Headless HTTP driver v2</strong> — Full runner without Claude Code, API key only</li>
      </ul>
    `
  }
}

}; // fin PAGES
