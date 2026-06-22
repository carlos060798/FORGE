/* ============================================================
   FORGE Docs — datos v5.0.0 (bilingüe ES/EN)
   12 secciones de documentación oficial
   ============================================================ */

const UI = {
  es: {
    brand_tag: "v5.0.0",
    search_placeholder: "Buscar…",
    search_input_placeholder: "Buscar en la documentación…",
    search_navigate: "navegar",
    search_open: "abrir",
    search_close: "cerrar",
    footer_text: "FORGE v5.0.0 · Claude Code-native · MIT License",
    search_no_results: "Sin resultados",
    groups: {
      overview:  "◈ El framework",
      technical: "⬡ Arquitectura",
      operate:   "▶ Operación",
      extend:    "✦ Extensibilidad"
    }
  },
  en: {
    brand_tag: "v5.0.0",
    search_placeholder: "Search…",
    search_input_placeholder: "Search the docs…",
    search_navigate: "navigate",
    search_open: "open",
    search_close: "close",
    footer_text: "FORGE v5.0.0 · Claude Code-native · MIT License",
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
      <p class="lead">FORGE es un framework de <strong>Spec-Driven Development (SDD) + Test-Driven Development (TDD)</strong> que opera exclusivamente dentro de Claude Code (Anthropic). Convierte ideas en lenguaje natural en software real: especificado, planificado, implementado y verificado por un equipo de 14 agentes de IA especializados.</p>

      <div class="callout tip">
        <p><strong>Instalación inmediata:</strong> <code>npx forge init</code> — zero dependencias en runtime.</p>
      </div>

      <h2>Qué es FORGE</h2>
      <p>No es un asistente conversacional. No es un generador de código simple. Es un <strong>sistema de ingeniería de software completo</strong>, donde cada fase del pipeline produce artefactos verificables y cada decisión queda registrada.</p>

      <table>
        <thead><tr><th>Dimensión</th><th>Descripción</th></tr></thead>
        <tbody>
          <tr><td><strong>Categoría</strong></td><td>Plugin de Claude Code / Framework SDD+TDD</td></tr>
          <tr><td><strong>Interfaz principal</strong></td><td>Slash commands (<code>/forge</code>, <code>/sdd.*</code>) dentro de Claude Code</td></tr>
          <tr><td><strong>Runtime host</strong></td><td>Claude Code CLI (Anthropic)</td></tr>
          <tr><td><strong>Distribución</strong></td><td>npm — <code>npx forge init</code></td></tr>
          <tr><td><strong>Dependencias en runtime</strong></td><td>Zero</td></tr>
          <tr><td><strong>Lenguaje</strong></td><td>Node.js ESM + TypeScript (type-check)</td></tr>
        </tbody>
      </table>

      <h2>Misión</h2>
      <blockquote>Hacer que cualquier persona técnica —sin ser developer de oficio— pueda construir software propio con el mismo rigor metodológico que un equipo de ingeniería profesional.</blockquote>

      <h2>Perfil de usuario objetivo</h2>
      <table>
        <thead><tr><th>Perfil</th><th>Ejemplo concreto</th></tr></thead>
        <tbody>
          <tr><td>CTO / fundador técnico</td><td>Prototipar una API antes de contratar developers</td></tr>
          <tr><td>Data scientist</td><td>Exponer modelos como servicio REST verificado</td></tr>
          <tr><td>Product manager técnico</td><td>MVP verificado antes de pasar a producción</td></tr>
          <tr><td>DevOps engineer</td><td>Automatizar tareas complejas con lógica de negocio</td></tr>
          <tr><td>Developer junior</td><td>Aplicar SDD+TDD sin diseñar el proceso desde cero</td></tr>
        </tbody>
      </table>

      <h2>Posicionamiento</h2>
      <pre><code class="text">                  CONTROL DEL OUTPUT
                  Alto ◄──────────────► Bajo

Developer     Cursor/Copilot   [FORGE]    Lovable    Bubble
tools          (asistencia)  (orquesta) (GUI SaaS) (no-code)

COMPLEJIDAD:    Alta           Media       Baja      Mínima
AUDIENCIA:      Dev prof.   No-developer  No técnico  No técnico</code></pre>

      <div class="callout tip">
        <p><strong>Próximo paso:</strong> Lee <a href="#capacidades">Capacidades</a> para ver qué puede hacer FORGE en detalle.</p>
      </div>
    `
  },
  en: {
    titulo: "Overview",
    html: `
      <h1>Overview</h1>
      <p class="lead">FORGE is a <strong>Spec-Driven Development (SDD) + Test-Driven Development (TDD)</strong> framework that runs exclusively inside Claude Code (Anthropic). It turns natural-language ideas into real software: specified, planned, implemented, and verified by a team of 14 specialized AI agents.</p>

      <div class="callout tip">
        <p><strong>Quick install:</strong> <code>npx forge init</code> — zero runtime dependencies.</p>
      </div>

      <h2>What FORGE is</h2>
      <p>Not a conversational assistant. Not a simple code generator. It is a <strong>complete software engineering system</strong> where each pipeline phase produces verifiable artifacts and every decision is recorded.</p>

      <table>
        <thead><tr><th>Dimension</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><strong>Category</strong></td><td>Claude Code plugin / SDD+TDD Framework</td></tr>
          <tr><td><strong>Main interface</strong></td><td>Slash commands (<code>/forge</code>, <code>/sdd.*</code>) in Claude Code</td></tr>
          <tr><td><strong>Runtime host</strong></td><td>Claude Code CLI (Anthropic)</td></tr>
          <tr><td><strong>Distribution</strong></td><td>npm — <code>npx forge init</code></td></tr>
          <tr><td><strong>Runtime dependencies</strong></td><td>Zero</td></tr>
          <tr><td><strong>Language</strong></td><td>Node.js ESM + TypeScript (type-check only)</td></tr>
        </tbody>
      </table>

      <h2>Mission</h2>
      <blockquote>Enable any technical person — without being a professional developer — to build their own software with the same methodological rigor as a professional engineering team.</blockquote>

      <div class="callout tip">
        <p><strong>Next:</strong> Read <a href="#capacidades">Capabilities</a> to see what FORGE can do.</p>
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
      <p>38 comandos que implementan el ciclo completo de desarrollo de software, desde la idea hasta el despliegue.</p>

      <table>
        <thead><tr><th>Fase</th><th>Comando</th><th>Artefacto</th><th>Estado</th></tr></thead>
        <tbody>
          <tr><td>Interpretación</td><td><code>/sdd.interpretar</code></td><td><code>.sdd/ir.json</code></td><td>✅ Producción</td></tr>
          <tr><td>Descubrimiento</td><td><code>/sdd.descubrir</code></td><td>Contexto enriquecido</td><td>✅ Producción</td></tr>
          <tr><td>Diseño de producto</td><td><code>/sdd.diseñar</code></td><td><code>product-design.json</code></td><td>✅ Producción</td></tr>
          <tr><td>Especificación</td><td><code>/sdd.especificar</code></td><td><code>spec.md</code> con HUs, CAs, RF, NFR</td><td>✅ Producción</td></tr>
          <tr><td>Planificación</td><td><code>/sdd.planificar</code></td><td>Plan técnico + ADRs</td><td>✅ Producción</td></tr>
          <tr><td>Desglose de tareas</td><td><code>/sdd.tareas</code></td><td><code>estado-tareas.json</code></td><td>✅ Producción</td></tr>
          <tr><td>Implementación</td><td><code>/sdd.implementar</code></td><td>Código + tests TDD</td><td>✅ Producción</td></tr>
          <tr><td>QA</td><td><code>/sdd.qa</code></td><td>Reporte de calidad</td><td>✅ Producción</td></tr>
          <tr><td>Verificación</td><td><code>/sdd.verificar</code></td><td><code>verificacion.json</code></td><td>✅ Producción</td></tr>
          <tr><td>Despliegue</td><td><code>/sdd.desplegar</code></td><td>App en producción</td><td>🔵 Beta</td></tr>
        </tbody>
      </table>

      <h2>14 Agentes especializados</h2>
      <table>
        <thead><tr><th>Agente</th><th>Modelo</th><th>Rol</th></tr></thead>
        <tbody>
          <tr><td><code>arquitecto</code></td><td>Opus</td><td>Decisiones técnicas, ADRs, diseño de sistema</td></tr>
          <tr><td><code>product-designer</code></td><td>Opus</td><td>UX, user flow, pantallas, alcance MVP</td></tr>
          <tr><td><code>critico</code></td><td>Opus</td><td>Riesgos, puntos ciegos, deuda técnica</td></tr>
          <tr><td><code>seguridad</code></td><td>Opus</td><td>Auditoría de vulnerabilidades</td></tr>
          <tr><td><code>asesor-datos</code></td><td>Opus</td><td>Modelado BD, queries, migraciones</td></tr>
          <tr><td><code>revisor</code></td><td>Opus</td><td>Code review contra spec y calidad</td></tr>
          <tr><td><code>desarrollador-backend</code></td><td>Sonnet</td><td>Implementación servidor, APIs</td></tr>
          <tr><td><code>desarrollador-frontend</code></td><td>Sonnet</td><td>UI, componentes, estado cliente</td></tr>
          <tr><td><code>tester</code></td><td>Sonnet</td><td>Tests unitarios, integración, E2E</td></tr>
          <tr><td><code>operaciones</code></td><td>Sonnet</td><td>CI/CD, deploy, infraestructura</td></tr>
          <tr><td><code>disenador-api</code></td><td>Sonnet</td><td>Contratos OpenAPI/GraphQL/gRPC</td></tr>
          <tr><td><code>investigador</code></td><td>Sonnet</td><td>Análisis de contexto técnico existente</td></tr>
          <tr><td><code>architecture-designer</code></td><td>Sonnet</td><td>Stack técnico para MVP</td></tr>
          <tr><td><code>documentador</code></td><td>Sonnet</td><td>Documentación técnica (opt-in)</td></tr>
        </tbody>
      </table>

      <h2>Otras capacidades clave</h2>
      <ul>
        <li><strong>Guardrails en tiempo real</strong> — Hook <code>pre-tool-guard.js</code> bloquea comandos destructivos y detecta secrets</li>
        <li><strong>Memoria persistente por agente</strong> — SQLite (Node ≥22.5) o Markdown (Node ≥18)</li>
        <li><strong>Observabilidad completa</strong> — <code>consumo.jsonl</code> registra cada acción; dashboard en <code>localhost:3001</code></li>
        <li><strong>Templates de inicio rápido</strong> — <code>api-rest</code>, <code>cli-tool</code>, <code>saas-mvp</code></li>
        <li><strong>Integración CLAUDE.md</strong> — Registro idempotente en el archivo de instrucciones del proyecto</li>
        <li><strong>26 skills especializadas</strong> — <code>explicame</code>, <code>deploy-vercel</code>, <code>share-progress</code>, y más</li>
      </ul>
    `
  },
  en: {
    titulo: "Capabilities",
    html: `
      <h1>Capabilities</h1>
      <p class="lead">What FORGE can do today, at what maturity level, and which components are involved.</p>

      <h2>Complete SDD+TDD Pipeline</h2>
      <p>38 commands implementing the full software development cycle, from idea to deployment.</p>

      <table>
        <thead><tr><th>Phase</th><th>Command</th><th>Artifact</th><th>Status</th></tr></thead>
        <tbody>
          <tr><td>Interpretation</td><td><code>/sdd.interpretar</code></td><td><code>.sdd/ir.json</code></td><td>✅ Production</td></tr>
          <tr><td>Discovery</td><td><code>/sdd.descubrir</code></td><td>Enriched context</td><td>✅ Production</td></tr>
          <tr><td>Product design</td><td><code>/sdd.diseñar</code></td><td><code>product-design.json</code></td><td>✅ Production</td></tr>
          <tr><td>Specification</td><td><code>/sdd.especificar</code></td><td><code>spec.md</code> with HUs, CAs, RF, NFR</td><td>✅ Production</td></tr>
          <tr><td>Planning</td><td><code>/sdd.planificar</code></td><td>Technical plan + ADRs</td><td>✅ Production</td></tr>
          <tr><td>Task breakdown</td><td><code>/sdd.tareas</code></td><td><code>estado-tareas.json</code></td><td>✅ Production</td></tr>
          <tr><td>Implementation</td><td><code>/sdd.implementar</code></td><td>Code + TDD tests</td><td>✅ Production</td></tr>
          <tr><td>Verification</td><td><code>/sdd.verificar</code></td><td><code>verificacion.json</code></td><td>✅ Production</td></tr>
          <tr><td>Deployment</td><td><code>/sdd.desplegar</code></td><td>App in production</td><td>🔵 Beta</td></tr>
        </tbody>
      </table>

      <h2>Key capabilities</h2>
      <ul>
        <li><strong>Real-time guardrails</strong> — <code>pre-tool-guard.js</code> blocks destructive commands and detects secrets</li>
        <li><strong>Persistent agent memory</strong> — SQLite (Node ≥22.5) or Markdown (Node ≥18)</li>
        <li><strong>Complete observability</strong> — <code>consumo.jsonl</code> records every action; dashboard at <code>localhost:3001</code></li>
        <li><strong>Quick-start templates</strong> — <code>api-rest</code>, <code>cli-tool</code>, <code>saas-mvp</code></li>
        <li><strong>26 specialized skills</strong> — <code>explicame</code>, <code>deploy-vercel</code>, <code>share-progress</code>, and more</li>
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
        <thead><tr><th>Limitación</th><th>Detalle</th><th>Roadmap</th></tr></thead>
        <tbody>
          <tr><td><strong>Sin routing real de modelos</strong></td><td><code>model-registry.js</code> registra qué modelo usaría, pero no lo cambia. El modelo efectivo está en el frontmatter del agente.</td><td>v5.1 cuando Claude Code lo exponga</td></tr>
          <tr><td><strong>Sin apps móviles nativas</strong></td><td>No genera proyectos Swift, Kotlin ni Jetpack Compose.</td><td>v3.0</td></tr>
          <tr><td><strong>Sin ejecución fuera de Claude Code</strong></td><td>FORGE es un plugin del host. Sin Claude Code instalado y autenticado, nada funciona.</td><td>No planeado</td></tr>
          <tr><td><strong>Sin colaboración multi-usuario</strong></td><td><code>estado.json</code> es un archivo único sin locking. Dos sesiones simultáneas pueden producir conflictos.</td><td>v5.2</td></tr>
          <tr><td><strong>Sin fallback entre providers</strong></td><td>Si la API de Anthropic falla, la sesión se interrumpe. No hay fallback automático a OpenAI o Google.</td><td>v5.1</td></tr>
          <tr><td><strong>Indexación AST solo para JS</strong></td><td><code>ast-indexer.js</code> usa <code>acorn</code>. Proyectos TypeScript o JSX fallan silenciosamente en indexación.</td><td>v5.1</td></tr>
        </tbody>
      </table>

      <h2>Dependencias requeridas</h2>
      <table>
        <thead><tr><th>Dependencia</th><th>Versión mínima</th><th>Uso</th></tr></thead>
        <tbody>
          <tr><td>Claude Code CLI</td><td>Última</td><td>Host runtime — sin esto, FORGE no existe</td></tr>
          <tr><td>Cuenta Anthropic</td><td>Con créditos API</td><td>Todos los agentes usan Anthropic</td></tr>
          <tr><td>Node.js</td><td>≥18 (≥22.5 para SQLite)</td><td>CLI, hooks, dashboard</td></tr>
        </tbody>
      </table>

      <h2>Límites de escala</h2>
      <ul>
        <li>Proyectos con &gt;500 archivos o &gt;100K líneas pueden degradar la velocidad de recuperación de memoria en el backend Markdown (O(n) vs O(log n) de SQLite)</li>
        <li><code>consumo.jsonl</code> rota automáticamente al superar 10MB — se mantienen 3 archivos de backup</li>
        <li>Costo real de API: ~$10–25 por proyecto mediano con todos los agentes activos</li>
      </ul>

      <div class="callout tip">
        <p><strong>Para proyectos grandes:</strong> Usa Node ≥22.5 para activar el backend SQLite y el modo <code>sesion: rapido</code> en <code>sdd.config.yaml</code>.</p>
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
        <thead><tr><th>Limitation</th><th>Detail</th><th>Roadmap</th></tr></thead>
        <tbody>
          <tr><td><strong>No real model routing</strong></td><td><code>model-registry.js</code> records which model would be used, but doesn't change it. The effective model is in the agent frontmatter.</td><td>v5.1</td></tr>
          <tr><td><strong>No native mobile apps</strong></td><td>Does not generate Swift, Kotlin or Jetpack Compose projects.</td><td>v3.0</td></tr>
          <tr><td><strong>Requires Claude Code</strong></td><td>FORGE is a host plugin. Without Claude Code installed and authenticated, nothing works.</td><td>Not planned</td></tr>
          <tr><td><strong>No multi-user collaboration</strong></td><td><code>estado.json</code> is a single file with no locking. Two simultaneous sessions may conflict.</td><td>v5.2</td></tr>
          <tr><td><strong>AST indexing JS-only</strong></td><td><code>ast-indexer.js</code> uses <code>acorn</code>. TypeScript/JSX projects fail silently on indexing.</td><td>v5.1</td></tr>
        </tbody>
      </table>

      <h2>Required dependencies</h2>
      <table>
        <thead><tr><th>Dependency</th><th>Min version</th><th>Use</th></tr></thead>
        <tbody>
          <tr><td>Claude Code CLI</td><td>Latest</td><td>Host runtime — without this, FORGE doesn't exist</td></tr>
          <tr><td>Anthropic account</td><td>With API credits</td><td>All agents use Anthropic</td></tr>
          <tr><td>Node.js</td><td>≥18 (≥22.5 for SQLite)</td><td>CLI, hooks, dashboard</td></tr>
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
      <p class="lead">Estado real de cada área de FORGE: qué está listo para producción, qué está en beta, y qué es experimental.</p>

      <table>
        <thead><tr><th>Área</th><th>Estado</th><th>Justificación</th></tr></thead>
        <tbody>
          <tr><td>Pipeline SDD (38 comandos)</td><td>✅ Producción</td><td>Implementación completa, handoffs probados, gates funcionales</td></tr>
          <tr><td>14 agentes especializados</td><td>✅ Producción</td><td>Frontmatter estable, memoria operativa, restricciones implementadas</td></tr>
          <tr><td>Guardrails (pre-tool-guard)</td><td>✅ Producción</td><td>Patrones de detección exhaustivos, configurables, probados</td></tr>
          <tr><td>Memoria persistente (Markdown)</td><td>✅ Producción</td><td>Auto-compresión, índice invertido, recuperación selectiva</td></tr>
          <tr><td>Observabilidad (consumo.jsonl)</td><td>✅ Producción</td><td>Rotación automática, campos estables, telemetría completa</td></tr>
          <tr><td>CLI (forge init/doctor/ui)</td><td>✅ Producción</td><td>Zero-deps, multiplataforma, diagnósticos exhaustivos</td></tr>
          <tr><td>Tests de contrato (hooks)</td><td>✅ Producción</td><td>15 tests que detectan cambios en la API de Claude Code</td></tr>
          <tr><td>Memoria persistente (SQLite)</td><td>✅ Producción</td><td>Auto-activado en Node ≥22.5 sin configuración manual. Fallback automático a Markdown en Node &lt;22.5.</td></tr>
          <tr><td>Dashboard UI</td><td>🔵 Beta</td><td>Funcional pero sin autenticación ni WebSockets (polling cada 5s)</td></tr>
          <tr><td>Templates de inicio rápido</td><td>🔵 Beta</td><td>3 templates disponibles (<code>api-rest</code>, <code>cli-tool</code>, <code>saas-mvp</code>), flujo verificado</td></tr>
          <tr><td>Integración CLAUDE.md</td><td>🔵 Beta</td><td>Idempotente, versionada, edge cases no exhaustivamente probados</td></tr>
          <tr><td>TypeScript type-check</td><td>🔵 Beta</td><td><code>tsconfig.json --noEmit</code> funcional — sin compilación ni output de runtime</td></tr>
          <tr><td>Integración Vercel MCP</td><td>🔵 Beta</td><td>Skill documentada con flujo completo, pendiente de pruebas E2E automatizadas</td></tr>
          <tr><td>Integración GitHub MCP</td><td>🔵 Beta</td><td>9 archivos — implementación más madura que Vercel, flujo básico probado</td></tr>
          <tr><td>Design systems</td><td>🔵 Beta</td><td>5 sistemas disponibles — integración con <code>product-designer</code> parcialmente documentada</td></tr>
          <tr><td>Tests de pipeline</td><td>🔵 Beta</td><td>18 tests de artefactos — no cubren flujos de usuario E2E ni llamadas reales a LLM</td></tr>
          <tr><td>Registro multi-LLM</td><td>🧪 Experimental</td><td>Registra provider en <code>consumo.jsonl</code> para auditoría. Routing real (cambiar modelo efectivo) pendiente de la API de Claude Code — previsto en v5.1.</td></tr>
        </tbody>
      </table>

      <div class="callout tip">
        <p><strong>Para producción:</strong> Usa las áreas marcadas ✅. Las áreas 🔵 son estables pero pueden cambiar su API. Las 🧪 son para exploración.</p>
      </div>
    `
  },
  en: {
    titulo: "Maturity Analysis",
    html: `
      <h1>Maturity Analysis</h1>
      <p class="lead">Real status of each FORGE area: what's production-ready, what's in beta, and what's experimental.</p>

      <table>
        <thead><tr><th>Area</th><th>Status</th><th>Justification</th></tr></thead>
        <tbody>
          <tr><td>SDD Pipeline (38 commands)</td><td>✅ Production</td><td>Complete implementation, tested handoffs, functional gates</td></tr>
          <tr><td>14 specialized agents</td><td>✅ Production</td><td>Stable frontmatter, operative memory, restrictions implemented</td></tr>
          <tr><td>Guardrails (pre-tool-guard)</td><td>✅ Production</td><td>Exhaustive detection patterns, configurable, tested</td></tr>
          <tr><td>Persistent memory (Markdown)</td><td>✅ Production</td><td>Auto-compression, inverted index, selective retrieval</td></tr>
          <tr><td>Observability (consumo.jsonl)</td><td>✅ Production</td><td>Auto-rotation, stable fields, complete telemetry</td></tr>
          <tr><td>CLI (forge init/doctor/ui)</td><td>✅ Production</td><td>Zero-deps, cross-platform, exhaustive diagnostics</td></tr>
          <tr><td>Persistent memory (SQLite)</td><td>🔵 Beta</td><td>Requires Node ≥22.5 — incompatible with most environments</td></tr>
          <tr><td>Dashboard UI</td><td>🔵 Beta</td><td>Functional but no auth or WebSockets (polling)</td></tr>
          <tr><td>Quick-start templates</td><td>🔵 Beta</td><td>3 templates available, flow verified</td></tr>
          <tr><td>Multi-LLM registry</td><td>🧪 Experimental</td><td>Observability only. Real routing in v5.1</td></tr>
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
      <p class="lead">Referencia técnica completa: capas del sistema, módulos, flujo de ejecución, extensibilidad y limitaciones reales. Basada en análisis estático del repositorio — sin contenido inventado.</p>

      <div class="callout tip">
        <p>Documentación técnica completa en <code>docs/forge-architecture.md</code> — incluye diagramas Mermaid, tabla de módulos con firma de funciones e interfaces TypeScript completas.</p>
      </div>

      <h2>Capas del sistema</h2>
      <pre><code class="text">╔══════════════════════════════════════════════════════════════════╗
║  CAPA 0 — USUARIO                                                ║
║  /forge "quiero una API de tareas con autenticación JWT"         ║
╚═══════════════════════════╤══════════════════════════════════════╝
                            │
╔═══════════════════════════▼══════════════════════════════════════╗
║  CAPA 1 — COMANDOS (39 system prompts .md)                       ║
║  forge.md → sdd.interpretar → sdd.especificar → sdd.planificar  ║
║           → sdd.implementar → sdd.verificar → sdd.desplegar     ║
║  Cada .md se carga como system prompt · handoff encadenado       ║
╚════════════╤═════════════════════════════════════════════════════╝
             │ invocación de agente por nombre
╔════════════▼═════════════════════════════════════════════════════╗
║  CAPA 2 — AGENTES (14 archivos .md)                              ║
║  Opus   → arquitecto · critico · seguridad · asesor-datos        ║
║           product-designer · revisor    [solo lectura]           ║
║  Sonnet → dev-backend · dev-frontend · tester · operaciones      ║
║           disenador-api · investigador · architecture-designer   ║
╚══════════╤══════════════════════════════════════════════════════╝
           │ cada tool call dispara hooks
     ┌─────▼──────────────┐       ┌───────────────────────────────┐
     │ PRE-TOOL-USE        │       │ POST-TOOL-USE (Write|Edit)    │
     │ pre-tool-guard.js   │       │ ① agent-memory.js             │
     │                     │       │   • SQLite si Node ≥22.5 ✅   │
     │ exit 2 → BLOQUEADO  │       │   • Markdown si Node <22.5   │
     │ exit 0 → continúa   │       │   · consumo.jsonl + ADRs     │
     └─────────────────────┘       │ ② post-write-conventions.js  │
                                   │ ③ ast-indexer.js (JS/TS)     │
                                   └────────────┬──────────────────┘
                                                │ escribe
╔═══════════════════════════════════════════════▼═════════════════╗
║  CAPA 4 — ESTADO  (.sdd/)                                        ║
║  estado.json   ir.json   sdd.config.yaml                         ║
║  especificaciones/  memoria/  arquitectura/  observabilidad/      ║
╚══════════════════════════════════════════════════════════════════╝</code></pre>

      <h2>Flujo de un tool call</h2>
      <pre><code class="text">Agente ejecuta Write .sdd/ir.json
│
├── Claude Code → PreToolUse → node pre-tool-guard.js
│   ├── exit 2: BLOQUEADO (rm -rf, push --force, DROP DB, etc.)
│   └── exit 0: PERMITIDO → archivo escrito
│
└── Claude Code → PostToolUse (solo Write|Edit)
    ├── node agent-memory.js
    │   ├── detecta agente (CLAUDE_AGENT_NAME env)
    │   ├── actualiza .sdd/memoria/agente-{nombre}.md
    │   ├── rota consumo.jsonl si > 10MB
    │   └── escribe entrada en consumo.jsonl
    ├── node post-write-conventions.js
    │   ├── valida contra constitución del proyecto
    │   └── exit 2 si violación bloqueante
    └── node ast-indexer.js
        ├── parsea archivo con acorn (solo JS/TS básico)
        └── actualiza .sdd/arquitectura/ast-index.jsonl</code></pre>

      <h2>Módulos principales</h2>
      <table>
        <thead><tr><th>Módulo</th><th>Ubicación</th><th>Responsabilidad</th><th>Estado</th></tr></thead>
        <tbody>
          <tr><td><code>cli/index.js</code></td><td>CLI</td><td>forge init, update, doctor, config, ui</td><td>Core</td></tr>
          <tr><td><code>pre-tool-guard.js</code></td><td>PreToolUse</td><td>Bloquea operaciones destructivas (9 categorías)</td><td>Core</td></tr>
          <tr><td><code>agent-memory.js</code></td><td>PostToolUse</td><td>Memoria persistente + ledger consumo.jsonl</td><td>Core</td></tr>
          <tr><td><code>post-write-conventions.js</code></td><td>PostToolUse</td><td>Valida convenciones del proyecto</td><td>Core</td></tr>
          <tr><td><code>ast-indexer.js</code></td><td>PostToolUse</td><td>Índice AST de archivos JS/TS modificados</td><td>Beta</td></tr>
          <tr><td><code>model-registry.js</code></td><td>Librería hook</td><td>Resolución de provider/modelo (observabilidad, no routing real)</td><td>Experimental</td></tr>
          <tr><td><code>core/project-memory.ts</code></td><td>Core TS</td><td>Lectura/escritura de estado.json con cache y migración</td><td>Beta</td></tr>
          <tr><td><code>ui/server.js</code></td><td>Dashboard</td><td>HTTP server loopback — 6 endpoints de solo lectura</td><td>Beta</td></tr>
        </tbody>
      </table>

      <h2>Patrones de diseño</h2>
      <table>
        <thead><tr><th>Patrón</th><th>Dónde</th><th>Propósito</th></tr></thead>
        <tbody>
          <tr><td>Pipeline con gates</td><td>39 comandos SDD</td><td>Aprobación humana entre fases críticas</td></tr>
          <tr><td>Observer (hooks)</td><td>PreToolUse / PostToolUse</td><td>Interceptar cada tool call sin modificar el agente</td></tr>
          <tr><td>Strategy</td><td>Backends de memoria</td><td>SQLite/Markdown intercambiables sin cambiar la lógica</td></tr>
          <tr><td>Registry</td><td><code>model-registry.js</code></td><td>Mapa de provider/tier por agente</td></tr>
          <tr><td>Chain of Responsibility</td><td><code>pre-tool-guard.js</code></td><td>Reglas de guardrail evaluadas en cascada</td></tr>
          <tr><td>Append-only log + rotación</td><td><code>consumo.jsonl</code></td><td>Trazabilidad bounded sin pérdida de historial reciente</td></tr>
        </tbody>
      </table>

      <h2>Limitaciones conocidas</h2>
      <table>
        <thead><tr><th>Limitación</th><th>Causa</th></tr></thead>
        <tbody>
          <tr><td>Sin routing real de modelos</td><td><code>model-registry.js</code> registra, no routea. El modelo efectivo está en el frontmatter .md del agente.</td></tr>
          <tr><td>AST indexer no soporta TS complejo</td><td>acorn no parsea TypeScript nativo. Regex de limpieza básica — fallos silenciosos en código TS avanzado.</td></tr>
          <tr><td>SQLite requiere Node ≥22.5</td><td>80% de entornos usa Node 18/20 → backend Markdown O(n) en consultas.</td></tr>
          <tr><td>Sin colaboración multi-usuario</td><td>estado.json sin locking — dos sesiones simultáneas producen condición de carrera.</td></tr>
          <tr><td>Despliegue requiere MCP externo</td><td>sdd.desplegar necesita MCP Vercel instalado. Sin él, genera instrucciones manuales.</td></tr>
        </tbody>
      </table>
    `
  },
  en: {
    titulo: "System Architecture",
    html: `
      <h1>System Architecture</h1>
      <p class="lead">Complete technical reference: system layers, modules, execution flow, extensibility and real limitations. Based on static analysis of the repository — no invented content.</p>

      <div class="callout tip">
        <p>Full technical documentation in <code>docs/forge-architecture.md</code> — includes Mermaid diagrams, module table with function signatures and complete TypeScript interfaces.</p>
      </div>

      <h2>System layers</h2>
      <pre><code class="text">╔══════════════════════════════════════════════════════════════════╗
║  LAYER 0 — USER                                                  ║
║  /forge "I want to build a task API with JWT auth"               ║
╚═══════════════════════════╤══════════════════════════════════════╝
                            │
╔═══════════════════════════▼══════════════════════════════════════╗
║  LAYER 1 — COMMANDS (39 .md system prompts)                      ║
║  forge.md  →  sdd.interpretar  →  sdd.especificar  →  ...       ║
║  Each .md loaded as system prompt • handoff chaining             ║
╚════════════╤═════════════════════════════════════════════════════╝
             │ agent invocation by name
╔════════════▼═════════════════════════════════════════════════════╗
║  LAYER 2 — AGENTS (14 .md files)                                 ║
║  Opus  → arquitecto · critico · seguridad · asesor-datos         ║
║         product-designer · revisor  [read-only tools]            ║
║  Sonnet → dev-backend · dev-frontend · tester · operaciones      ║
║           disenador-api · investigador · architecture-designer   ║
╚══════════╤══════════════════════════════════════════════════════╝
           │ every tool call triggers hooks
     ┌─────▼──────────────┐       ┌───────────────────────────────┐
     │ PRE-TOOL-USE       │       │ POST-TOOL-USE (Write|Edit)    │
     │ pre-tool-guard.js  │       │ ① agent-memory.js             │
     │                    │       │   • SQLite if Node ≥22.5      │
     │ exit 2 → BLOCK     │       │   • Markdown if Node <22.5    │
     │ exit 0 → allow     │       │   • consumo.jsonl + ADRs      │
     └──────────────────  ┘       │ ② post-write-conventions.js   │
                                  │ ③ ast-indexer.js (JS/TS)     │
                                  └────────────┬──────────────────┘
                                               │
╔══════════════════════════════════════════════▼══════════════════╗
║  LAYER 4 — STATE  (.sdd/)                                        ║
║  estado.json   ir.json   sdd.config.yaml                         ║
║  especificaciones/  memoria/  arquitectura/  observabilidad/      ║
╚══════════════════════════════════════════════════════════════════╝</code></pre>

      <h2>Key modules</h2>
      <table>
        <thead><tr><th>Module</th><th>Location</th><th>Responsibility</th><th>Status</th></tr></thead>
        <tbody>
          <tr><td><code>cli/index.js</code></td><td>CLI</td><td>forge init, update, doctor, config, ui</td><td>Core</td></tr>
          <tr><td><code>pre-tool-guard.js</code></td><td>PreToolUse</td><td>Blocks destructive operations (9 categories)</td><td>Core</td></tr>
          <tr><td><code>agent-memory.js</code></td><td>PostToolUse</td><td>Persistent memory + consumo.jsonl ledger</td><td>Core</td></tr>
          <tr><td><code>model-registry.js</code></td><td>Hook library</td><td>Provider/model resolution (observability, not real routing)</td><td>Experimental</td></tr>
          <tr><td><code>core/project-memory.ts</code></td><td>Core TS</td><td>Read/write estado.json with cache and migration</td><td>Beta</td></tr>
          <tr><td><code>ui/server.js</code></td><td>Dashboard</td><td>Loopback HTTP server — 6 read-only endpoints</td><td>Beta</td></tr>
        </tbody>
      </table>

      <h2>Known limitations</h2>
      <table>
        <thead><tr><th>Limitation</th><th>Cause</th></tr></thead>
        <tbody>
          <tr><td>No real model routing</td><td><code>model-registry.js</code> records, does not route. Effective model is set in agent .md frontmatter.</td></tr>
          <tr><td>AST indexer lacks TS support</td><td>acorn does not parse TypeScript natively. Silent failures on advanced TS code.</td></tr>
          <tr><td>SQLite requires Node ≥22.5</td><td>80% of environments use Node 18/20 → Markdown backend with O(n) queries.</td></tr>
          <tr><td>No multi-user collaboration</td><td>estado.json has no locking — two concurrent sessions cause a race condition.</td></tr>
          <tr><td>Deployment requires external MCP</td><td>sdd.desplegar needs Vercel MCP installed. Without it, generates manual instructions.</td></tr>
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

      <h2>Hub de comandos — <code>commands/forge.md</code></h2>
      <p>Punto de entrada único para el usuario. Recibe lenguaje natural y enruta al comando SDD correcto.</p>
      <table>
        <thead><tr><th>El usuario dice</th><th>Comando interno</th></tr></thead>
        <tbody>
          <tr><td>"quiero construir X"</td><td><code>sdd.interpretar [idea]</code></td></tr>
          <tr><td>"continúa", "sigue"</td><td><code>sdd.implementar continuar</code></td></tr>
          <tr><td>"¿cómo voy?", "qué falta"</td><td><code>sdd.estado</code></td></tr>
          <tr><td>"despliega", "publícalo"</td><td><code>sdd.desplegar</code></td></tr>
          <tr><td>"explícame", "¿qué sigue?"</td><td>skill <code>explicame</code></td></tr>
          <tr><td>"comparte el progreso"</td><td>skill <code>share-progress</code></td></tr>
          <tr><td>"despliega en vercel"</td><td>skill <code>deploy-vercel</code></td></tr>
        </tbody>
      </table>

      <h2>Hook de guardrails — <code>pre-tool-guard.js</code></h2>
      <p>Intercepta cada tool call antes de ejecutarse.</p>
      <ul>
        <li><strong>Bloqueos duros (exit 2):</strong> <code>rm -rf /</code>, <code>git push --force</code>, <code>DROP DATABASE</code>, <code>chmod 777</code>, secrets hardcodeados</li>
        <li><strong>Advertencias:</strong> <code>git push</code>, <code>npm publish</code>, <code>terraform apply</code></li>
        <li><strong>Restricciones por agente:</strong> 6 agentes de análisis son estrictamente read-only</li>
      </ul>

      <h2>Hook de memoria — <code>agent-memory.js</code></h2>
      <p>Persiste el contexto de cada agente entre sesiones y mantiene el ledger de observabilidad.</p>

      <h3>Selección automática de backend</h3>
      <p>A partir de v5.0.0, el backend se auto-selecciona según la versión de Node.js. No se requiere configuración:</p>
      <table>
        <thead><tr><th>Node.js</th><th>Backend activo</th><th>Consulta</th><th>Storage</th></tr></thead>
        <tbody>
          <tr><td>≥ 22.5</td><td>SQLite nativo (<code>node:sqlite</code>)</td><td>O(log n)</td><td><code>.sdd/memoria/memoria.db</code></td></tr>
          <tr><td>&lt; 22.5</td><td>Markdown (append-only)</td><td>O(n)</td><td><code>.sdd/memoria/agente-{nombre}.md</code></td></tr>
        </tbody>
      </table>
      <p>Para forzar un backend específico, edita <code>.sdd/sdd.config.yaml</code>:</p>
      <pre><code class="text">memoria:
  backend: "sqlite"     # fuerza SQLite (requiere Node ≥22.5)
  # backend: "markdown" # fuerza Markdown en cualquier Node</code></pre>

      <h3>Esquema de entrada (PostToolUse)</h3>
      <pre><code class="json">// stdin que recibe el hook desde Claude Code
{
  "tool_name": "Write",
  "tool_input": { "file_path": "src/api.js", "content": "..." },
  "tool_response": "File written successfully"
}</code></pre>

      <h3>Archivos escritos por el hook</h3>
      <pre><code class="text">.sdd/memoria/agente-arquitecto.md     ← backend Markdown
.sdd/memoria/memoria.db               ← backend SQLite
.sdd/memoria/indice.jsonl             ← índice invertido (siempre activo)
.sdd/observabilidad/consumo.jsonl     ← ledger de telemetría
.sdd/arquitectura/ADRs.jsonl          ← solo si detecta // ADR: {...}</code></pre>

      <h3>Patrón ADR inline</h3>
      <p>Los agentes pueden registrar decisiones arquitectónicas directamente en el código:</p>
      <pre><code class="js">// ADR: {"decision":"usar JWT stateless","context":"Sin BD de sesiones","status":"accepted"}</code></pre>
      <p>El hook lo detecta y lo escribe en <code>.sdd/arquitectura/ADRs.jsonl</code> automáticamente.</p>

      <h3>Rotación de consumo.jsonl</h3>
      <p>Cuando el ledger supera el umbral (default: 10 MB), el hook lo rota automáticamente:</p>
      <pre><code class="text">consumo.jsonl        → archivo activo
consumo.jsonl.1      → backup más reciente
consumo.jsonl.2      → anterior
consumo.jsonl.3      → más antiguo (máximo 3 backups)</code></pre>

      <h2>CLI — <code>cli/index.js</code></h2>
      <p>Instalador y punto de entrada de terminal. Zero-deps.</p>
      <pre><code class="bash">forge init                    # Instala FORGE
forge init --template api-rest # Con template
forge init --guided            # Wizard interactivo
forge update                   # Actualiza núcleo
forge doctor                   # Diagnóstico completo
forge ui [--port N]            # Dashboard
forge config show | get | set  # Configuración</code></pre>

      <h2>Dashboard UI — <code>ui/server.js</code></h2>
      <p>Servidor HTTP nativo Node.js, solo loopback (127.0.0.1:3001), cierre automático a 30 minutos.</p>
      <table>
        <thead><tr><th>Endpoint</th><th>Fuente</th><th>Descripción</th></tr></thead>
        <tbody>
          <tr><td><code>GET /estado</code></td><td><code>estado.json</code></td><td>Pipeline step actual</td></tr>
          <tr><td><code>GET /tareas</code></td><td><code>estado-tareas.json</code></td><td>Lista de tareas con estados</td></tr>
          <tr><td><code>GET /verificar</code></td><td><code>verificacion.json</code></td><td>Resultado de la última verificación</td></tr>
          <tr><td><code>GET /consumo</code></td><td><code>consumo.jsonl</code></td><td>Telemetría raw (últimas 50 líneas)</td></tr>
          <tr><td><code>GET /actividad</code></td><td><code>consumo.jsonl</code></td><td>Feed legible: hora, agente, tool, bytes</td></tr>
        </tbody>
      </table>
    `
  },
  en: {
    titulo: "System Components",
    html: `
      <h1>System Components</h1>
      <p class="lead">Detailed description of each module: purpose, inputs, outputs, and dependencies.</p>

      <h2>Command hub — <code>commands/forge.md</code></h2>
      <p>Single entry point for the user. Receives natural language and routes to the correct SDD command.</p>

      <h2>Guardrails hook — <code>pre-tool-guard.js</code></h2>
      <p>Intercepts every tool call before execution.</p>
      <ul>
        <li><strong>Hard blocks (exit 2):</strong> <code>rm -rf /</code>, <code>git push --force</code>, <code>DROP DATABASE</code>, hardcoded secrets</li>
        <li><strong>Warnings:</strong> <code>git push</code>, <code>npm publish</code>, <code>terraform apply</code></li>
        <li><strong>Agent restrictions:</strong> 6 analysis agents are strictly read-only</li>
      </ul>

      <h2>CLI — <code>cli/index.js</code></h2>
      <p>Installer and terminal entry point. Zero-deps.</p>
      <pre><code class="bash">forge init                    # Install FORGE
forge init --template api-rest # With template
forge doctor                   # Full diagnostic
forge ui [--port N]            # Dashboard</code></pre>
    `
  }
},

"contratos": {
  seccion: "technical",
  es: {
    titulo: "Contratos de Artefactos",
    html: `
      <h1>Contratos de Artefactos</h1>
      <p class="lead">Esquemas JSON exactos que cada fase del pipeline produce y consume. Son los contratos estables entre componentes.</p>

      <h2><code>ir.json</code> — Intermediate Representation</h2>
      <pre><code class="json">{
  "id": "string",
  "created_at": "ISO 8601",
  "confidence": 0.85,
  "product": {
    "name": "string",
    "type": "api | saas | web | cli | mobile | other",
    "value_proposition": "string",
    "target_users": "string"
  },
  "features": {
    "core": ["string"],
    "nice_to_have": ["string"]
  },
  "requires_clarification": false,
  "estimated_complexity": "baja | media | alta"
}</code></pre>
      <p><strong>Regla:</strong> <code>confidence ≥ 0.7</code> para continuar. Si es menor, FORGE pide aclaración antes de avanzar.</p>

      <h2><code>estado.json</code> — Estado del pipeline</h2>
      <pre><code class="json">{
  "schemaVersion": "1.0",
  "pipeline_step": "idea | ir | design | spec | plan | tasks | code | done",
  "spec_activa": "string | null",
  "plan_activo": "object | null",
  "ir_generado": true,
  "ultima_actualizacion": "ISO 8601"
}</code></pre>

      <h2><code>consumo.jsonl</code> — Líneas de telemetría</h2>
      <pre><code class="json">{ "ts": "ISO 8601", "agente": "arquitecto", "tool": "Write",
  "archivo": "src/api.js", "bytes": 1024,
  "provider": "anthropic", "effort_level": "high" }</code></pre>

      <h2><code>verificacion.json</code> — Resultado de verificación</h2>
      <pre><code class="json">{
  "timestamp": "ISO 8601",
  "passed": true,
  "criterios": [
    { "id": "CA-001-01", "descripcion": "...", "passed": true }
  ],
  "fallidos": []
}</code></pre>

      <h2>Contrato de hooks (Claude Code)</h2>
      <pre><code class="json">// PreToolUse — entrada
{ "tool_name": "Bash", "tool_input": { "command": "..." } }

// PostToolUse — entrada
{ "tool_name": "Write",
  "tool_input": { "file_path": "...", "content": "..." },
  "tool_response": "File written successfully" }

// Exit codes
// 0 → permitido / procesado
// 2 → bloqueado (solo PreToolUse)</code></pre>
    `
  },
  en: {
    titulo: "Artifact Contracts",
    html: `
      <h1>Artifact Contracts</h1>
      <p class="lead">Exact JSON schemas that each pipeline phase produces and consumes.</p>

      <h2><code>ir.json</code> — Intermediate Representation</h2>
      <pre><code class="json">{
  "id": "string",
  "created_at": "ISO 8601",
  "confidence": 0.85,
  "product": { "name": "string", "type": "api | saas | web | cli | mobile | other" },
  "features": { "core": ["string"] },
  "requires_clarification": false,
  "estimated_complexity": "low | medium | high"
}</code></pre>

      <h2><code>estado.json</code> — Pipeline state</h2>
      <pre><code class="json">{
  "schemaVersion": "1.0",
  "pipeline_step": "idea | ir | design | spec | plan | tasks | code | done",
  "ir_generado": true,
  "ultima_actualizacion": "ISO 8601"
}</code></pre>
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
        <p><strong>Requisitos previos:</strong> Node.js ≥18, Claude Code instalado y autenticado (<code>claude --version</code>), cuenta Anthropic con créditos.</p>
      </div>

      <h2>Instalación básica</h2>
      <pre><code class="bash"># En el directorio de tu proyecto
npx forge init

# Verificar instalación
npx forge doctor</code></pre>

      <h2>Con template (recomendado para empezar rápido)</h2>
      <pre><code class="bash"># API REST con autenticación JWT
npx forge init --template api-rest

# CLI con subcomandos y output coloreado
npx forge init --template cli-tool

# SaaS MVP con auth y dashboard
npx forge init --template saas-mvp</code></pre>

      <h2>Con wizard interactivo</h2>
      <pre><code class="bash">npx forge init --guided
# 3 preguntas: perfil, modelo, modo de sesión</code></pre>

      <h2>Primer uso</h2>
      <p>Después de <code>forge init</code>, abre Claude Code en el directorio y escribe:</p>
      <pre><code class="text">/forge "describe tu idea aquí"</code></pre>

      <h3>Ejemplos concretos</h3>
      <pre><code class="text">/forge "una API para que mi equipo registre sus horas de trabajo"
/forge "una CLI que convierta archivos CSV a JSON con validación de esquema"
/forge "un dashboard web donde mis clientes vean el estado de sus pedidos"</code></pre>

      <h2>Qué instala <code>forge init</code></h2>
      <pre><code class="text">.claude/
  ├── commands/     (38 archivos .md)
  ├── agents/       (14 archivos .md)
  ├── skills/       (26 directorios)
  └── claude-hooks/ (7 archivos .js)

.sdd/
  ├── estado.json
  ├── sdd.config.yaml
  ├── memoria/
  ├── especificaciones/
  ├── arquitectura/
  └── observabilidad/

CLAUDE.md         ← sección ## FORGE añadida/actualizada</code></pre>
    `
  },
  en: {
    titulo: "Installation and First Use",
    html: `
      <h1>Installation and First Use</h1>

      <div class="callout tip">
        <p><strong>Prerequisites:</strong> Node.js ≥18, Claude Code installed and authenticated, Anthropic account with credits.</p>
      </div>

      <h2>Basic installation</h2>
      <pre><code class="bash">npx forge init
npx forge doctor</code></pre>

      <h2>With template (recommended)</h2>
      <pre><code class="bash">npx forge init --template api-rest
npx forge init --template cli-tool
npx forge init --template saas-mvp</code></pre>

      <h2>First use</h2>
      <p>After <code>forge init</code>, open Claude Code in the directory and type:</p>
      <pre><code class="text">/forge "describe your idea here"</code></pre>
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
          <tr><td><code>memoria.umbral_bytes</code></td><td>number</td><td><code>50000</code></td><td>Tamaño máximo antes de auto-compresión</td></tr>
          <tr><td><code>memoria.backend</code></td><td>enum</td><td><code>"markdown"</code></td><td><code>sqlite</code> | <code>markdown</code></td></tr>
          <tr><td><code>observabilidad.consumo_max_mb</code></td><td>number</td><td><code>10</code></td><td>Tamaño máximo de consumo.jsonl</td></tr>
          <tr><td><code>calidad.cobertura_tests_minima</code></td><td>number</td><td><code>80</code></td><td>% mínimo de cobertura</td></tr>
          <tr><td><code>calidad.longitud_funcion_maxima</code></td><td>number</td><td><code>50</code></td><td>Líneas máximas por función</td></tr>
          <tr><td><code>comportamiento.requerir_aprobacion_plan</code></td><td>boolean</td><td><code>true</code></td><td>Gate de aprobación del plan</td></tr>
          <tr><td><code>protecciones.no_tocar_archivos</code></td><td>string[]</td><td><code>[".env*", "*.key"]</code></td><td>Archivos que FORGE nunca modifica</td></tr>
          <tr><td><code>compresion.modo_salida_usuario</code></td><td>enum</td><td><code>"lite"</code></td><td>Verbosidad para el usuario</td></tr>
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

      <h2>Presets de configuración</h2>
      <table>
        <thead><tr><th>Preset</th><th>Uso</th><th>Características</th></tr></thead>
        <tbody>
          <tr><td><code>lean</code></td><td>Proyectos personales</td><td>Haiku para tareas simples, Sonnet para dev</td></tr>
          <tr><td><code>startup</code></td><td>MVP ágil</td><td>Sonnet como default, Opus solo para arquitectura</td></tr>
          <tr><td><code>enterprise</code></td><td>Proyectos corporativos</td><td>Opus extensivo, todos los guardrails, ADR obligatorio</td></tr>
        </tbody>
      </table>
      <pre><code class="bash">forge init --preset startup</code></pre>

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

      <h2>Variables de entorno</h2>
      <table>
        <thead><tr><th>Variable</th><th>Propósito</th><th>Requerida</th></tr></thead>
        <tbody>
          <tr><td><code>OPENAI_API_KEY</code></td><td>Habilita registro de OpenAI en consumo.jsonl</td><td>No</td></tr>
          <tr><td><code>GOOGLE_API_KEY</code></td><td>Habilita registro de Google en consumo.jsonl</td><td>No</td></tr>
          <tr><td><code>FORGE_UI_PORT</code></td><td>Puerto del dashboard (default: 3001)</td><td>No</td></tr>
        </tbody>
      </table>
    `
  },
  en: {
    titulo: "Configuration",
    html: `
      <h1>Configuration</h1>
      <p class="lead">All FORGE configuration options, their defaults and recommendations.</p>

      <h2>Session modes</h2>
      <table>
        <thead><tr><th>Mode</th><th>Active agents</th><th>Recommended for</th></tr></thead>
        <tbody>
          <tr><td><code>normal</code></td><td>All (14 agents)</td><td>Full pipeline with critic, security and ADRs</td></tr>
          <tr><td><code>rapido</code></td><td>Without <code>critico</code></td><td>Saves ~30% tokens on small projects</td></tr>
          <tr><td><code>prototipo</code></td><td>Developers + tester only</td><td>Fast iteration, no reviewers</td></tr>
        </tbody>
      </table>

      <h2>Configuration presets</h2>
      <pre><code class="bash">forge init --preset startup    # Recommended for MVPs
forge init --preset lean       # Personal projects
forge init --preset enterprise # Corporate</code></pre>
    `
  }
},

"flujos-operativos": {
  seccion: "operate",
  es: {
    titulo: "Flujos Operativos",
    html: `
      <h1>Flujos Operativos</h1>
      <p class="lead">Cómo funciona FORGE en la práctica: flujo de instalación, pipeline principal, y recuperación de errores.</p>

      <h2>Flujo del pipeline principal</h2>
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
│   ├── arquitecto + product-designer generan spec
│   └── [GATE] ¿Apruebas la spec? → Sí / Cambia esto
│
├── sdd.planificar
│   ├── arquitecto diseña plan técnico
│   ├── critico revisa riesgos
│   ├── Genera ADRs en .sdd/arquitectura/ADRs.jsonl
│   └── [GATE] ¿Apruebas el plan? → Sí
│
├── sdd.tareas
│   └── Desglosa plan en 5–20 tareas atómicas
│
├── sdd.implementar
│   ├── desarrollador-backend: código de servidor
│   ├── tester: tests TDD en paralelo
│   └── seguridad: auditoría de cambios sensibles
│
├── sdd.verificar
│   ├── Ejecuta criterios de aceptación
│   ├── Genera .sdd/verificacion.json
│   └── [GATE] ✅ Todos pasan / ❌ Itera
│
└── sdd.desplegar
    └── operaciones: configura CI/CD y despliega</code></pre>

      <h2>Gates de aprobación</h2>
      <p>Cada gate es una conversación, no un comando técnico. En modo guiado el usuario responde:</p>
      <ul>
        <li><strong>"sí"</strong> → FORGE continúa a la siguiente fase</li>
        <li><strong>"cambia esto"</strong> → FORGE revisa y vuelve a presentar</li>
        <li><strong>"no me convence X"</strong> → FORGE aplica la retroalimentación</li>
      </ul>

      <h2>Recuperación de errores</h2>
      <table>
        <thead><tr><th>Error</th><th>Acción de FORGE</th></tr></thead>
        <tbody>
          <tr><td>Estado corrupto (<code>estado.json</code>)</td><td><code>forge doctor</code> detecta el problema; <code>ProjectMemory.migrate()</code> intenta reparar</td></tr>
          <tr><td>Hook bloqueó una acción (exit 2)</td><td><code>pre-tool-guard</code> escribe la razón a stderr; el usuario puede aprobar manualmente si es legítimo</td></tr>
          <tr><td><code>consumo.jsonl</code> supera 10MB</td><td><code>rotarJSONL()</code> mueve automáticamente a <code>.1</code>, <code>.2</code>, <code>.3</code></td></tr>
          <tr><td>Error en un agente individual</td><td>Se registra en <code>consumo.jsonl</code> y el pipeline continúa salvo que bloquee el artefacto requerido</td></tr>
        </tbody>
      </table>

      <h2>Comandos de diagnóstico</h2>
      <pre><code class="bash">forge doctor         # Diagnóstico completo
forge ui             # Dashboard en localhost:3001
/sdd.estado          # Estado actual del pipeline (dentro de Claude Code)
/sdd.snapshot        # Guarda snapshot antes de pausar</code></pre>
    `
  },
  en: {
    titulo: "Operational Flows",
    html: `
      <h1>Operational Flows</h1>
      <p class="lead">How FORGE works in practice: pipeline flow, approval gates, and error recovery.</p>

      <h2>Main pipeline flow</h2>
      <pre><code class="text">User: /forge "I want an API for task management"
│
├── /forge hub detects: "create new"
├── sdd.interpretar → ir.json → [GATE: approve?]
├── sdd.especificar → spec.md → [GATE: approve?]
├── sdd.planificar  → plan + ADRs → [GATE: approve?]
├── sdd.implementar → code + TDD tests
├── sdd.verificar   → verificacion.json → [GATE: all pass?]
└── sdd.desplegar   → production</code></pre>

      <h2>Error recovery</h2>
      <table>
        <thead><tr><th>Error</th><th>FORGE action</th></tr></thead>
        <tbody>
          <tr><td>Corrupt state</td><td><code>forge doctor</code> detects; <code>ProjectMemory.migrate()</code> attempts repair</td></tr>
          <tr><td>Hook blocked action (exit 2)</td><td>Reason written to stderr; user can manually approve if legitimate</td></tr>
          <tr><td><code>consumo.jsonl</code> over 10MB</td><td><code>rotarJSONL()</code> auto-rotates to <code>.1</code>, <code>.2</code>, <code>.3</code></td></tr>
        </tbody>
      </table>
    `
  }
},

"api-comandos": {
  seccion: "operate",
  es: {
    titulo: "Referencia de Comandos",
    html: `
      <h1>Referencia de Comandos</h1>
      <p class="lead">Todos los slash commands disponibles en Claude Code y comandos del CLI.</p>

      <h2>Slash commands principales</h2>
      <table>
        <thead><tr><th>Comando</th><th>Descripción</th><th>Modo</th></tr></thead>
        <tbody>
          <tr><td><code>/forge "idea"</code></td><td>Inicia o continúa el pipeline</td><td>Guiado + Experto</td></tr>
          <tr><td><code>/forge.explicame</code></td><td>Explica el estado en lenguaje humano</td><td>Guiado</td></tr>
          <tr><td><code>/forge.desplegar vercel</code></td><td>Despliega en Vercel via MCP</td><td>Ambos</td></tr>
          <tr><td><code>/forge.compartir</code></td><td>Genera resumen Markdown del progreso</td><td>Ambos</td></tr>
          <tr><td><code>/sdd.interpretar [texto]</code></td><td>Interpreta una idea directamente</td><td>Experto</td></tr>
          <tr><td><code>/sdd.especificar</code></td><td>Genera spec desde IR activo</td><td>Experto</td></tr>
          <tr><td><code>/sdd.planificar</code></td><td>Genera plan desde spec activa</td><td>Experto</td></tr>
          <tr><td><code>/sdd.implementar</code></td><td>Inicia implementación</td><td>Experto</td></tr>
          <tr><td><code>/sdd.verificar</code></td><td>Verifica criterios de aceptación</td><td>Experto</td></tr>
          <tr><td><code>/sdd.desplegar</code></td><td>Despliega el proyecto</td><td>Experto</td></tr>
          <tr><td><code>/sdd.estado</code></td><td>Estado actual del pipeline</td><td>Ambos</td></tr>
          <tr><td><code>/sdd.ayuda</code></td><td>Ayuda contextual</td><td>Ambos</td></tr>
          <tr><td><code>/sdd.optimizar</code></td><td>Comprime tokens y optimiza contexto</td><td>Ambos</td></tr>
          <tr><td><code>/sdd.snapshot</code></td><td>Guarda snapshot del estado</td><td>Ambos</td></tr>
        </tbody>
      </table>

      <h2>CLI de terminal</h2>
      <pre><code class="bash">forge init                    # Instala FORGE en el proyecto
forge init --global           # Instala para todos los proyectos
forge init --template &lt;name&gt;  # api-rest | cli-tool | saas-mvp
forge init --guided           # Wizard interactivo
forge init --preset &lt;name&gt;    # lean | startup | enterprise
forge init --ui               # Incluye dashboard
forge update                  # Actualiza núcleo sin tocar .sdd/
forge doctor                  # Diagnóstico completo
forge ui [--port N]           # Abre dashboard en navegador
forge config show             # Muestra sdd.config.yaml
forge config get &lt;key&gt;        # Lee valor específico
forge config set &lt;key&gt; &lt;val&gt;  # Modifica valor
forge config validate         # Valida estructura del config
forge --version               # Versión instalada</code></pre>
    `
  },
  en: {
    titulo: "Command Reference",
    html: `
      <h1>Command Reference</h1>
      <p class="lead">All slash commands available in Claude Code and CLI commands.</p>

      <h2>Main slash commands</h2>
      <table>
        <thead><tr><th>Command</th><th>Description</th><th>Mode</th></tr></thead>
        <tbody>
          <tr><td><code>/forge "idea"</code></td><td>Start or continue the pipeline</td><td>Both</td></tr>
          <tr><td><code>/forge.explicame</code></td><td>Explains current state in human language</td><td>Guided</td></tr>
          <tr><td><code>/forge.desplegar vercel</code></td><td>Deploy to Vercel via MCP</td><td>Both</td></tr>
          <tr><td><code>/sdd.estado</code></td><td>Current pipeline status</td><td>Both</td></tr>
          <tr><td><code>/sdd.snapshot</code></td><td>Save state snapshot</td><td>Both</td></tr>
        </tbody>
      </table>

      <h2>Terminal CLI</h2>
      <pre><code class="bash">forge init                    # Install FORGE
forge init --template api-rest # With template
forge doctor                   # Full diagnostic
forge ui [--port N]            # Open dashboard</code></pre>
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
      <p class="lead">FORGE está diseñado para ser extensible: puedes añadir agentes, skills, comandos e integraciones de MCP sin tocar el núcleo.</p>

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
2. [Pasos de trabajo]</code></pre>

      <p>Luego registrar en <code>.claude-plugin/plugin.json</code> bajo <code>"agents"</code> y verificar con <code>npm test</code>.</p>

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

      <p>Registrar en <code>.claude-plugin/plugin.json</code> bajo <code>"skills"</code>. Si tiene alias, añadir a <code>commands/forge.md</code>.</p>

      <h2>Añadir un nuevo comando SDD</h2>
      <pre><code class="markdown">---
description: "Descripción del comando"
allowed-tools: [Read, Write, Bash]
handoffs:
  - etiqueta: "Siguiente"
    comando: "sdd.siguiente"
    prompt: "Continúa con..."
---

# /sdd.nombre

## VERIFICACIONES PRE-EJECUCIÓN
\`\`\`bash
[ -f ".sdd/estado.json" ] || { echo "FORGE no inicializado"; exit 1; }
\`\`\`

## INSTRUCCIONES
[Qué debe hacer el agente]</code></pre>

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

      <h2>Hooks de usuario por proyecto</h2>
      <p>Añade tus propias validaciones en <code>.sdd/hooks/</code>:</p>
      <pre><code class="bash">#!/bin/bash
# .sdd/hooks/antes_especificar.sh
# Se ejecuta antes de sdd.especificar
[ -f "package.json" ] || { echo "ERROR: necesitas package.json"; exit 1; }</code></pre>

      <div class="callout tip">
        <p><strong>Regla de oro:</strong> Nunca añadas dependencias npm al runtime (<code>cli/</code>, <code>claude-hooks/</code>). FORGE es zero-deps por diseño.</p>
      </div>
    `
  },
  en: {
    titulo: "How to Extend FORGE",
    html: `
      <h1>How to Extend FORGE</h1>
      <p class="lead">FORGE is designed to be extensible: you can add agents, skills, commands, and MCP integrations without touching the core.</p>

      <h2>Add a new agent</h2>
      <pre><code class="markdown">---
name: my-agent
description: "One-line description of the role"
model: claude-sonnet-4-6
tools: ["Read", "Glob", "Grep"]
---</code></pre>
      <p>Register in <code>.claude-plugin/plugin.json</code> under <code>"agents"</code> and verify with <code>npm test</code>.</p>

      <h2>Add a new skill</h2>
      <pre><code class="markdown">---
id: my-skill
nombre: My Skill
descripcion: "What it does in one line"
aliases: ["/forge.my-skill"]
version: 1.0.0
---</code></pre>
      <p>Register in <code>.claude-plugin/plugin.json</code> under <code>"skills"</code>.</p>

      <div class="callout tip">
        <p><strong>Golden rule:</strong> Never add npm dependencies to the runtime. FORGE is zero-deps by design.</p>
      </div>
    `
  }
},

"integraciones": {
  seccion: "extend",
  es: {
    titulo: "Integraciones MCP",
    html: `
      <h1>Integraciones MCP</h1>
      <p class="lead">MCPs externos que FORGE puede usar para extender sus capacidades.</p>

      <table>
        <thead><tr><th>MCP</th><th>Skill asociada</th><th>Capacidad</th><th>Estado</th></tr></thead>
        <tbody>
          <tr><td><strong>Vercel</strong></td><td><code>deploy-vercel</code></td><td>Deploy automático desde el pipeline</td><td>🔵 Beta</td></tr>
          <tr><td><strong>GitHub</strong></td><td><code>github-connect</code></td><td>Repos, PRs, workflows</td><td>🔵 Beta</td></tr>
          <tr><td><strong>Figma</strong></td><td>(referenciado en docs)</td><td>Importar especificaciones de diseño</td><td>🧪 Experimental</td></tr>
          <tr><td><strong>Playwright</strong></td><td>(en .mcp.json)</td><td>Browser testing en E2E</td><td>🔵 Beta</td></tr>
          <tr><td><strong>Slack</strong></td><td>Roadmap</td><td>Notificaciones de pipeline</td><td>🗺️ Roadmap</td></tr>
          <tr><td><strong>Linear</strong></td><td>Roadmap</td><td>Sync de tareas con tickets</td><td>🗺️ Roadmap</td></tr>
        </tbody>
      </table>

      <h2>Cómo activar Vercel</h2>
      <ol>
        <li>Instala el MCP de Vercel en Claude Code</li>
        <li>Autentica con tu cuenta de Vercel</li>
        <li>Durante el pipeline, en cualquier punto escribe: <code>/forge.desplegar vercel</code></li>
        <li>El skill <code>deploy-vercel</code> verifica que <code>pipeline_step="verificado"</code> y ejecuta el deploy</li>
      </ol>

      <h2>Cómo activar GitHub</h2>
      <ol>
        <li>Instala el MCP de GitHub en Claude Code</li>
        <li>Autentica con tu GitHub PAT</li>
        <li>La skill <code>github-connect</code> queda disponible automáticamente</li>
      </ol>

      <h2>Verificar MCPs detectados</h2>
      <pre><code class="bash">forge doctor
# Muestra:
#   Vercel MCP: ✅ detectado
#   GitHub MCP: ✅ detectado
#   Figma MCP:  ⚠️  no instalado (opcional)</code></pre>
    `
  },
  en: {
    titulo: "MCP Integrations",
    html: `
      <h1>MCP Integrations</h1>
      <p class="lead">External MCPs that FORGE can use to extend its capabilities.</p>

      <table>
        <thead><tr><th>MCP</th><th>Associated skill</th><th>Capability</th><th>Status</th></tr></thead>
        <tbody>
          <tr><td><strong>Vercel</strong></td><td><code>deploy-vercel</code></td><td>Auto-deploy from pipeline</td><td>🔵 Beta</td></tr>
          <tr><td><strong>GitHub</strong></td><td><code>github-connect</code></td><td>Repos, PRs, workflows</td><td>🔵 Beta</td></tr>
          <tr><td><strong>Figma</strong></td><td>(referenced in docs)</td><td>Import design specifications</td><td>🧪 Experimental</td></tr>
          <tr><td><strong>Playwright</strong></td><td>(in .mcp.json)</td><td>E2E browser testing</td><td>🔵 Beta</td></tr>
        </tbody>
      </table>

      <h2>Verify detected MCPs</h2>
      <pre><code class="bash">forge doctor
# Shows:
#   Vercel MCP: ✅ detected
#   GitHub MCP: ✅ detected
#   Figma MCP:  ⚠️  not installed (optional)</code></pre>
    `
  }
},

"recomendaciones": {
  seccion: "extend",
  es: {
    titulo: "Recomendaciones",
    html: `
      <h1>Recomendaciones</h1>
      <p class="lead">Qué cambios haría mayor impacto en FORGE, ordenados por prioridad.</p>

      <h2>Alta prioridad</h2>

      <div class="callout warning">
        <p><strong>Tests E2E del pipeline</strong></p>
        <p>Los 900+ tests actuales cubren infraestructura pero no el flujo de usuario. Una regresión en <code>sdd.interpretar</code> que cambia el formato de <code>ir.json</code> puede pasar desapercibida.</p>
        <p><strong>Acción:</strong> Crear <code>tests/e2e/pipeline-flow.test.js</code> que simule un ciclo completo idea → ir → spec → estado usando fixtures, sin llamar al LLM.</p>
      </div>

      <div class="callout warning">
        <p><strong>Routing real de modelo LLM</strong></p>
        <p>La feature más diferenciadora actualmente no funciona como se documenta. <code>model-registry.js</code> registra, no routea.</p>
        <p><strong>Acción:</strong> Monitorear la API de Claude Code. Cuando exponga el mecanismo de override, <code>model-registry.js</code> ya tiene la lógica lista — solo falta el punto de inyección.</p>
      </div>

      <h2>Media prioridad</h2>

      <div class="callout tip">
        <p><strong>Indexación de TypeScript y JSX</strong></p>
        <p><code>acorn</code> no parsea TypeScript ni JSX. En proyectos TS, el índice AST queda vacío.</p>
        <p><strong>Acción:</strong> Añadir <code>@babel/parser</code> o <code>@typescript-eslint/typescript-estree</code> como parsers alternativos según extensión.</p>
      </div>

      <div class="callout tip">
        <p><strong>Backend SQLite para Node.js estándar</strong></p>
        <p>Node ≥22.5 es el 15–20% de los entornos. Mientras SQLite lo requiera, el 80% usa Markdown con O(n).</p>
        <p><strong>Acción:</strong> Evaluar <code>better-sqlite3</code> con soporte hasta Node 18.</p>
      </div>

      <h2>Baja prioridad</h2>
      <ul>
        <li><strong>WebSockets en dashboard</strong> — Evaluar Server-Sent Events (SSE) como alternativa zero-dep intermedia al polling</li>
        <li><strong>Marketplace de templates</strong> — El formato ya es estable; crear repositorio de templates de la comunidad</li>
        <li><strong>Documentación bilingüe de comandos SDD</strong> — Los 38 comandos están en español; añadir soporte EN para la comunidad internacional</li>
      </ul>

      <h2>Para contribuir</h2>
      <p>Lee <a href="#extensibilidad">Cómo Extender FORGE</a> y el archivo <a href="https://github.com/forge-sdd/FORGE/blob/main/CONTRIBUIR.md"><code>docs/CONTRIBUIR.md</code></a> en el repositorio.</p>

      <pre><code class="bash">git checkout -b feature/mi-contribucion
npm test           # Todos en verde antes de PR
npm run typecheck  # Type-check sin errores</code></pre>
    `
  },
  en: {
    titulo: "Recommendations",
    html: `
      <h1>Recommendations</h1>
      <p class="lead">What changes would have the greatest impact on FORGE, ordered by priority.</p>

      <h2>High priority</h2>
      <div class="callout warning">
        <p><strong>Pipeline E2E tests</strong></p>
        <p>900+ existing tests cover infrastructure but not user flow. Create <code>tests/e2e/pipeline-flow.test.js</code> to simulate a complete cycle without calling the LLM.</p>
      </div>

      <div class="callout warning">
        <p><strong>Real LLM model routing</strong></p>
        <p>The most differentiating feature currently doesn't work as documented. <code>model-registry.js</code> records, not routes. Monitor Claude Code API for the override mechanism.</p>
      </div>

      <h2>Medium priority</h2>
      <ul>
        <li><strong>TypeScript/JSX AST indexing</strong> — Add <code>@babel/parser</code> as alternative parser</li>
        <li><strong>SQLite for standard Node.js</strong> — Evaluate <code>better-sqlite3</code> with Node 18 support</li>
      </ul>

      <h2>Contribute</h2>
      <pre><code class="bash">git checkout -b feature/my-contribution
npm test
npm run typecheck</code></pre>
    `
  }
}

}; // fin PAGES
