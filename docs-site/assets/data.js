/* ============================================================
   FORGE Docs — datos v3.0.0 (bilingüe ES/EN)
   12 secciones de documentación oficial
   ============================================================ */

const UI = {
  es: {
    brand_tag: "v3.0.0",
    search_placeholder: "Buscar…",
    search_input_placeholder: "Buscar en la documentación…",
    search_navigate: "navegar",
    search_open: "abrir",
    search_close: "cerrar",
    footer_text: "FORGE v3.0.0 · Claude Code-native · MIT License",
    search_no_results: "Sin resultados",
    groups: {
      overview:  "◈ El framework",
      technical: "⬡ Arquitectura",
      operate:   "▶ Operación",
      extend:    "✦ Extensibilidad"
    }
  },
  en: {
    brand_tag: "v3.0.0",
    search_placeholder: "Search…",
    search_input_placeholder: "Search the docs…",
    search_navigate: "navigate",
    search_open: "open",
    search_close: "close",
    footer_text: "FORGE v3.0.0 · Claude Code-native · MIT License",
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
      <p>39 comandos que implementan el ciclo completo de desarrollo de software, desde la idea hasta el despliegue.</p>

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
        <li><strong>30 skills especializadas</strong> — <code>explicame</code>, <code>deploy-vercel</code>, <code>share-progress</code>, y más</li>
      </ul>
    `
  },
  en: {
    titulo: "Capabilities",
    html: `
      <h1>Capabilities</h1>
      <p class="lead">What FORGE can do today, at what maturity level, and which components are involved.</p>

      <h2>Complete SDD+TDD Pipeline</h2>
      <p>39 commands implementing the full software development cycle, from idea to deployment.</p>

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
          <tr><td>Pipeline SDD (39 comandos)</td><td>✅ Producción</td><td>Implementación completa, handoffs probados, gates funcionales</td></tr>
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
          <tr><td>SDD Pipeline (39 commands)</td><td>✅ Production</td><td>Complete implementation, tested handoffs, functional gates</td></tr>
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
      <p>A partir de v3.0.0, el backend se auto-selecciona según la versión de Node.js. No se requiere configuración:</p>
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
  ├── commands/     (39 archivos .md)
  ├── agents/       (14 archivos .md)
  ├── skills/       (30 directorios)
  └── claude-hooks/ (8 archivos .js)

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
        <li><strong>Documentación bilingüe de comandos SDD</strong> — Los 39 comandos están en español; añadir soporte EN para la comunidad internacional</li>
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
},


/* ────── AGENTES, COMANDOS, SKILLS, ARQUITECTURA, MEMORIA, TOKENS, CASOS, FAQ, TROUBLESHOOTING ── */

"agentes-arquitecto": {
  seccion: "technical",
  es: {
    titulo: "Agente Arquitecto",
    html: `
      <h1>Agente Arquitecto (Opus)</h1>
      <p class="lead">El agente principal de FORGE. Orquesta todo el flujo SDD, toma decisiones de arquitectura de alto nivel y garantiza coherencia de todo el sistema.</p>

      <h2>Perfil</h2>
      <table>
        <tr><td><strong>Modelo</strong></td><td>Claude Opus 4</td></tr>
        <tr><td><strong>Token budget</strong></td><td>200,000 tokens</td></tr>
        <tr><td><strong>Tiempo de respuesta</strong></td><td>~15-90s (estimación; depende del modelo y carga del servidor)</td></tr>
        <tr><td><strong>Restricciones</strong></td><td>Nunca toma decisiones de implementación. Siempre delega specs a especialistas.</td></tr>
        <tr><td><strong>Rol</strong></td><td>Orquestación, decisiones estratégicas, validación cross-fase</td></tr>
      </table>

      <h2>Responsabilidades</h2>
      <ul>
        <li>Interpretar requisitos en lenguaje natural</li>
        <li>Proponer arquitectura L0-L2</li>
        <li>Delegar a especialistas (Backend, Frontend, Data, DevOps)</li>
        <li>Validar completitud de especificaciones</li>
        <li>Resolver conflictos entre agentes</li>
        <li>Mantener decisiones en memoria de proyecto</li>
      </ul>

      <h2>Restricciones</h2>
      <pre><code>✓ Puede: diseñar arquitectura, proponer patrones, validar specs
✗ No puede: escribir código, ejecutar tests, deployar
✗ Nunca: ignorar restricciones de especialistas</code></pre>

      <h2>Casos de uso</h2>
      <ul>
        <li>MVP de plataforma SaaS: arquitectura poliglota (BE + FE + data)</li>
        <li>Refactoring de monolito: decisión de microservicios vs modular</li>
        <li>Integración de nuevas fuentes de datos: capa data + pipeline</li>
      </ul>

      <h2>Ejemplo</h2>
      <pre><code>Entrada: "Necesito una API REST que valide JWT, consulte PostgreSQL y devuelva JSON"
Salida:
  - Arquitectura L1: "API Express + middleware JWT + Prisma ORM"
  - Delega Backend: implementación de rutas
  - Delega Testing: test de middleware
  - Delega DevOps: setup PostgreSQL + secrets

Decisiones registradas en memoria/ bajo "jwt-postgres-api"</code></pre>
    `
  },
  en: {
    titulo: "Architect Agent",
    html: `
      <h1>Architect Agent (Opus)</h1>
      <p class="lead">The main FORGE agent. Orchestrates the entire SDD flow, makes high-level architectural decisions and ensures system coherence.</p>

      <h2>Profile</h2>
      <table>
        <tr><td><strong>Model</strong></td><td>Claude Opus 4</td></tr>
        <tr><td><strong>Token budget</strong></td><td>200,000 tokens</td></tr>
        <tr><td><strong>Response time</strong></td><td>~15-90s (estimate; depends on model and server load)</td></tr>
        <tr><td><strong>Constraints</strong></td><td>Never makes implementation decisions. Always delegates specs to specialists.</td></tr>
        <tr><td><strong>Role</strong></td><td>Orchestration, strategic decisions, cross-phase validation</td></tr>
      </table>

      <h2>Responsibilities</h2>
      <ul>
        <li>Interpret requirements in natural language</li>
        <li>Propose L0-L2 architecture</li>
        <li>Delegate to specialists (Backend, Frontend, Data, DevOps)</li>
        <li>Validate specification completeness</li>
        <li>Resolve conflicts between agents</li>
        <li>Keep decisions in project memory</li>
      </ul>

      <h2>Constraints</h2>
      <pre><code>✓ Can: design architecture, propose patterns, validate specs
✗ Cannot: write code, run tests, deploy
✗ Never: ignore specialist constraints</code></pre>

      <h2>Use cases</h2>
      <ul>
        <li>SaaS platform MVP: polyglot architecture (BE + FE + data)</li>
        <li>Monolith refactoring: microservices vs modular decision</li>
        <li>New data source integration: data layer + pipeline</li>
      </ul>

      <h2>Example</h2>
      <pre><code>Input: "I need a REST API that validates JWT, queries PostgreSQL and returns JSON"
Output:
  - L1 architecture: "Express API + JWT middleware + Prisma ORM"
  - Delegates Backend: route implementation
  - Delegates Testing: middleware tests
  - Delegates DevOps: PostgreSQL setup + secrets

Decisions stored in memory/ under "jwt-postgres-api"</code></pre>
    `
  }
},

"agentes-critico": {
  seccion: "technical",
  es: {
    titulo: "Agente Crítico",
    html: `
      <h1>Agente Crítico (Opus)</h1>
      <p class="lead">Adversario del sistema. Busca activamente problemas: lógica faltante, edge cases no considerados, riesgos de seguridad, performance degradada.</p>

      <h2>Perfil</h2>
      <table>
        <tr><td><strong>Modelo</strong></td><td>Claude Opus 4</td></tr>
        <tr><td><strong>Token budget</strong></td><td>80,000 tokens</td></tr>
        <tr><td><strong>Tiempo de respuesta</strong></td><td>~10-45s (estimación; Opus, varía con longitud del contexto)</td></tr>
        <tr><td><strong>Restricciones</strong></td><td>Solo crítica, nunca propone soluciones. Documenta hallazgos en <code>critica.md</code></td></tr>
        <tr><td><strong>Rol</strong></td><td>Análisis adversario, QA mental, validación de robustez</td></tr>
      </table>

      <h2>Responsabilidades</h2>
      <ul>
        <li>Revisar cada especificación generada</li>
        <li>Identificar edge cases (null, vacío, timeout, overload)</li>
        <li>Detectar violaciones de patrones (DRY, SOLID, SRP)</li>
        <li>Señalar riesgos de seguridad (injection, CORS, auth bypass)</li>
        <li>Estimación realista de complejidad</li>
        <li>Validar exhaustividad de tests</li>
      </ul>

      <h2>Restricciones</h2>
      <pre><code>✓ Puede: criticar, plantear preguntas, sugerir áreas faltantes
✗ No puede: proponer implementación, escribir código, resolver
✗ Nunca: quedarse callado sobre un problema potencial</code></pre>

      <h2>Casos de uso</h2>
      <ul>
        <li>Validación pre-código: detectar flaws antes de Backend</li>
        <li>Security review: análisis de tokens, permisos, datos sensibles</li>
        <li>Performance audit: identificar operaciones O(n²), queries no optimizadas</li>
      </ul>

      <h2>Ejemplo</h2>
      <pre><code>Entrada: Spec de endpoint GET /users/:id
Crítica: "¿Qué pasa si id no existe? ¿Y si el usuario no tiene permiso?
         ¿Qué datos sensibles se exponen? ¿Cache? ¿Rate limit?
         El spec asume todos los IDs son válidos UUID pero no valida."
Salida: critica.md con 8 puntos sin resolver</code></pre>
    `
  },
  en: {
    titulo: "Critical Agent",
    html: `
      <h1>Critical Agent (Opus)</h1>
      <p class="lead">System adversary. Actively searches for problems: missing logic, unhandled edge cases, security risks, performance degradation.</p>

      <h2>Profile</h2>
      <table>
        <tr><td><strong>Model</strong></td><td>Claude Opus 4</td></tr>
        <tr><td><strong>Token budget</strong></td><td>80,000 tokens</td></tr>
        <tr><td><strong>Response time</strong></td><td>~10-45s (estimate; Opus, varies with context length)</td></tr>
        <tr><td><strong>Constraints</strong></td><td>Critique only, never proposes solutions. Documents findings in <code>critica.md</code></td></tr>
        <tr><td><strong>Role</strong></td><td>Adversarial analysis, mental QA, robustness validation</td></tr>
      </table>

      <h2>Responsibilities</h2>
      <ul>
        <li>Review each generated specification</li>
        <li>Identify edge cases (null, empty, timeout, overload)</li>
        <li>Detect pattern violations (DRY, SOLID, SRP)</li>
        <li>Flag security risks (injection, CORS, auth bypass)</li>
        <li>Realistic complexity estimation</li>
        <li>Validate test exhaustiveness</li>
      </ul>

      <h2>Constraints</h2>
      <pre><code>✓ Can: criticize, ask questions, suggest missing areas
✗ Cannot: propose implementation, write code, resolve
✗ Never: stay silent about a potential problem</code></pre>

      <h2>Use cases</h2>
      <ul>
        <li>Pre-code validation: detect flaws before Backend</li>
        <li>Security review: token, permission, sensitive data analysis</li>
        <li>Performance audit: identify O(n²) operations, unoptimized queries</li>
      </ul>

      <h2>Example</h2>
      <pre><code>Input: GET /users/:id endpoint spec
Critique: "What if id doesn't exist? What if user lacks permission?
          What sensitive data is exposed? Caching? Rate limiting?
          Spec assumes all IDs are valid UUIDs but doesn't validate."
Output: critica.md with 8 unresolved points</code></pre>
    `
  }
},

"agentes-revisor": {
  seccion: "technical",
  es: {
    titulo: "Agente Revisor (Code Review)",
    html: `
      <h1>Agente Revisor (Opus)</h1>
      <p class="lead">Valida código contra especificación. Verifica que Backend, Frontend y Data cumplan letra del spec, patrones de proyecto y principios SOLID.</p>

      <h2>Perfil</h2>
      <table>
        <tr><td><strong>Modelo</strong></td><td>Claude Opus 4</td></tr>
        <tr><td><strong>Token budget</strong></td><td>100,000 tokens</td></tr>
        <tr><td><strong>Tiempo de respuesta</strong></td><td>~10-45s (estimación; Opus, varía con longitud del contexto)</td></tr>
        <tr><td><strong>Restricciones</strong></td><td>Solo revisa, no escribe. Devuelve diff sugerencias.</td></tr>
        <tr><td><strong>Rol</strong></td><td>Validación especificación↔código, mejoras de legibilidad, pattern compliance</td></tr>
      </table>

      <h2>Responsabilidades</h2>
      <ul>
        <li>Mapear código a requisitos del spec</li>
        <li>Verificar tipos (TypeScript compliance)</li>
        <li>Validar manejo de errores</li>
        <li>Sugerir refactors para legibilidad</li>
        <li>Detectar código muerto o redundante</li>
        <li>Verificar cobertura de tests</li>
      </ul>

      <h2>Restricciones</h2>
      <pre><code>✓ Puede: revisar, proponer mejoras, generar inline comments
✗ No puede: escribir código implementado, mergear ramas
✗ Nunca: silenciar fallos de contrato spec↔código</code></pre>

      <h2>Casos de uso</h2>
      <ul>
        <li>Post-implementación Backend: validar API contrato</li>
        <li>Post-implementación Frontend: cumplimiento de UX spec</li>
        <li>Refactoring: asegurar no-regresión vs spec original</li>
      </ul>

      <h2>Ejemplo</h2>
      <pre><code>Entrada: src/api/users.ts implementación
Revisión:
  ✓ GET /users/:id responde con schema spec
  ✗ Falta validación UUID en línea 45
  ⚠ Error 404 no sigue formato estándar del spec

Salida: users.ts.review.md con diffs sugeridos</code></pre>
    `
  },
  en: {
    titulo: "Reviewer Agent",
    html: `
      <h1>Reviewer Agent (Opus)</h1>
      <p class="lead">Validates code against specification. Verifies that Backend, Frontend and Data comply with spec letter, project patterns and SOLID principles.</p>

      <h2>Profile</h2>
      <table>
        <tr><td><strong>Model</strong></td><td>Claude Opus 4</td></tr>
        <tr><td><strong>Token budget</strong></td><td>100,000 tokens</td></tr>
        <tr><td><strong>Response time</strong></td><td>~10-45s (estimate; Opus, varies with context length)</td></tr>
        <tr><td><strong>Constraints</strong></td><td>Only reviews, doesn't write. Returns suggested diffs.</td></tr>
        <tr><td><strong>Role</strong></td><td>Specification↔code validation, readability improvements, pattern compliance</td></tr>
      </table>

      <h2>Responsibilities</h2>
      <ul>
        <li>Map code to spec requirements</li>
        <li>Verify types (TypeScript compliance)</li>
        <li>Validate error handling</li>
        <li>Suggest refactors for readability</li>
        <li>Detect dead or redundant code</li>
        <li>Verify test coverage</li>
      </ul>

      <h2>Constraints</h2>
      <pre><code>✓ Can: review, propose improvements, generate inline comments
✗ Cannot: write production code, merge branches
✗ Never: silence spec↔code contract violations</code></pre>

      <h2>Use cases</h2>
      <ul>
        <li>Post-implementation Backend: validate API contract</li>
        <li>Post-implementation Frontend: UX spec compliance</li>
        <li>Refactoring: ensure no-regression vs original spec</li>
      </ul>

      <h2>Example</h2>
      <pre><code>Input: src/api/users.ts implementation
Review:
  ✓ GET /users/:id responds with spec schema
  ✗ Missing UUID validation at line 45
  ⚠ 404 error doesn't follow spec standard format

Output: users.ts.review.md with suggested diffs</code></pre>
    `
  }
},

"agentes-seguridad": {
  seccion: "technical",
  es: {
    titulo: "Agente Seguridad",
    html: `
      <h1>Agente Seguridad (Opus)</h1>
      <p class="lead">Especialista en seguridad ofensiva. Propone ataques, valida defensas, audita permisos y criptografía. Genera security.md con vulnerabilidades potenciales.</p>

      <h2>Perfil</h2>
      <table>
        <tr><td><strong>Modelo</strong></td><td>Claude Opus 4</td></tr>
        <tr><td><strong>Token budget</strong></td><td>120,000 tokens</td></tr>
        <tr><td><strong>Tiempo de respuesta</strong></td><td>~15-90s (estimación; Opus, análisis exhaustivo)</td></tr>
        <tr><td><strong>Restricciones</strong></td><td>Solo análisis, nunca código. Responsable de OWASP top 10.</td></tr>
        <tr><td><strong>Rol</strong></td><td>Auditoría de seguridad, penetration testing mental, compliance check</td></tr>
      </table>

      <h2>Responsabilidades</h2>
      <ul>
        <li>Validar autenticación y autorización</li>
        <li>Detectar SQL injection, XSS, CSRF</li>
        <li>Auditar manejo de secretos y credentials</li>
        <li>Verificar CORS, CSP, rate limiting</li>
        <li>Validar criptografía (hashing, encryption)</li>
        <li>Generar reporte OWASP compliance</li>
      </ul>

      <h2>Restricciones</h2>
      <pre><code>✓ Puede: auditar, proponer mejoras, explorar ataques
✗ No puede: escribir código, ejecutar exploits reales
✗ Nunca: pasar vulnerabilidades sin documentar</code></pre>

      <h2>Casos de uso</h2>
      <ul>
        <li>Pre-producción: auditoría antes del launch</li>
        <li>Integración OAuth: validar flujos de auth delegada</li>
        <li>Manejo de PII: GDPR compliance check</li>
      </ul>

      <h2>Ejemplo</h2>
      <pre><code>Entrada: Spec de API con JWT + PostgreSQL
Análisis:
  ✓ JWT signed con RS256 ✓ DB queries con Prisma (safe)
  ✗ JWT claims no validan audience
  ✗ Refresh token sin rotación
  ✗ Logs de error pueden exposar stack traces

Salida: security.md "High: 2 findings, Medium: 3 findings"</code></pre>
    `
  },
  en: {
    titulo: "Security Agent",
    html: `
      <h1>Security Agent (Opus)</h1>
      <p class="lead">Offensive security specialist. Proposes attacks, validates defenses, audits permissions and cryptography. Generates security.md with potential vulnerabilities.</p>

      <h2>Profile</h2>
      <table>
        <tr><td><strong>Model</strong></td><td>Claude Opus 4</td></tr>
        <tr><td><strong>Token budget</strong></td><td>120,000 tokens</td></tr>
        <tr><td><strong>Response time</strong></td><td>~15-90s (estimate; Opus, thorough security analysis)</td></tr>
        <tr><td><strong>Constraints</strong></td><td>Analysis only, never code. Responsible for OWASP top 10.</td></tr>
        <tr><td><strong>Role</strong></td><td>Security audit, mental penetration testing, compliance check</td></tr>
      </table>

      <h2>Responsibilities</h2>
      <ul>
        <li>Validate authentication and authorization</li>
        <li>Detect SQL injection, XSS, CSRF</li>
        <li>Audit secrets and credentials handling</li>
        <li>Verify CORS, CSP, rate limiting</li>
        <li>Validate cryptography (hashing, encryption)</li>
        <li>Generate OWASP compliance report</li>
      </ul>

      <h2>Constraints</h2>
      <pre><code>✓ Can: audit, propose improvements, explore attacks
✗ Cannot: write code, run real exploits
✗ Never: pass vulnerabilities without documenting</code></pre>

      <h2>Use cases</h2>
      <ul>
        <li>Pre-production: audit before launch</li>
        <li>OAuth integration: validate delegated auth flows</li>
        <li>PII handling: GDPR compliance check</li>
      </ul>

      <h2>Example</h2>
      <pre><code>Input: API spec with JWT + PostgreSQL
Analysis:
  ✓ JWT signed with RS256 ✓ DB queries with Prisma (safe)
  ✗ JWT claims don't validate audience
  ✗ Refresh token without rotation
  ✗ Error logs may expose stack traces

Output: security.md "High: 2 findings, Medium: 3 findings"</code></pre>
    `
  }
},

"agentes-designer": {
  seccion: "technical",
  es: {
    titulo: "Agente Product Designer",
    html: `
      <h1>Agente Product Designer (Opus)</h1>
      <p class="lead">Diseña UX/UI desde requisitos. Crea wireframes, user flows, componentes, tokens de diseño y guía de interacción. Genera design.md y assets.</p>

      <h2>Perfil</h2>
      <table>
        <tr><td><strong>Modelo</strong></td><td>Claude Opus 4</td></tr>
        <tr><td><strong>Token budget</strong></td><td>90,000 tokens</td></tr>
        <tr><td><strong>Tiempo de respuesta</strong></td><td>~10-45s (estimación; Opus, varía con complejidad del wireframe)</td></tr>
        <tr><td><strong>Restricciones</strong></td><td>Especificación de diseño solo. No implementa React/Vue.</td></tr>
        <tr><td><strong>Rol</strong></td><td>UX/UI design, design systems, user research, interaction patterns</td></tr>
      </table>

      <h2>Responsabilidades</h2>
      <ul>
        <li>Crear user journeys y user stories</li>
        <li>Diseñar wireframes y mockups</li>
        <li>Definir design tokens (colors, typography, spacing)</li>
        <li>Especificar componentes y states</li>
        <li>Validar accessibility (WCAG 2.1 AA)</li>
        <li>Documentar interaction patterns</li>
      </ul>

      <h2>Restricciones</h2>
      <pre><code>✓ Puede: diseñar, especificar componentes, proponer interacciones
✗ No puede: escribir React, CSS, implementar
✗ Nunca: ignorar accesibilidad</code></pre>

      <h2>Casos de uso</h2>
      <ul>
        <li>SaaS dashboard: diseño de layout, data visualization</li>
        <li>Mobile app mockup: user flows para mobile-first</li>
        <li>Form design: validación UX, error states</li>
      </ul>

      <h2>Ejemplo</h2>
      <pre><code>Entrada: "Dashboard para monitoreo de APIs"
Salida:
  - User journey: admin login → dashboard → select API → view metrics
  - 5 wireframes (desktop + mobile responsive)
  - Design tokens: 12 colors, typography scale, spacing 8px grid
  - Component spec: Card, Chart, Table con estados idle/loading/error
  - design.md con todo documentado</code></pre>
    `
  },
  en: {
    titulo: "Product Designer Agent",
    html: `
      <h1>Product Designer Agent (Opus)</h1>
      <p class="lead">Designs UX/UI from requirements. Creates wireframes, user flows, components, design tokens and interaction guide. Generates design.md and assets.</p>

      <h2>Profile</h2>
      <table>
        <tr><td><strong>Model</strong></td><td>Claude Opus 4</td></tr>
        <tr><td><strong>Token budget</strong></td><td>90,000 tokens</td></tr>
        <tr><td><strong>Response time</strong></td><td>~10-45s (estimate; Opus, varies with wireframe complexity)</td></tr>
        <tr><td><strong>Constraints</strong></td><td>Design specification only. Doesn't implement React/Vue.</td></tr>
        <tr><td><strong>Role</strong></td><td>UX/UI design, design systems, user research, interaction patterns</td></tr>
      </table>

      <h2>Responsibilities</h2>
      <ul>
        <li>Create user journeys and user stories</li>
        <li>Design wireframes and mockups</li>
        <li>Define design tokens (colors, typography, spacing)</li>
        <li>Specify components and states</li>
        <li>Validate accessibility (WCAG 2.1 AA)</li>
        <li>Document interaction patterns</li>
      </ul>

      <h2>Constraints</h2>
      <pre><code>✓ Can: design, specify components, propose interactions
✗ Cannot: write React, CSS, implement
✗ Never: ignore accessibility</code></pre>

      <h2>Use cases</h2>
      <ul>
        <li>SaaS dashboard: layout design, data visualization</li>
        <li>Mobile app mockup: user flows for mobile-first</li>
        <li>Form design: validation UX, error states</li>
      </ul>

      <h2>Example</h2>
      <pre><code>Input: "Dashboard for API monitoring"
Output:
  - User journey: admin login → dashboard → select API → view metrics
  - 5 wireframes (desktop + mobile responsive)
  - Design tokens: 12 colors, typography scale, 8px grid spacing
  - Component spec: Card, Chart, Table with idle/loading/error states
  - design.md with everything documented</code></pre>
    `
  }
},

"agentes-backend": {
  seccion: "technical",
  es: {
    titulo: "Agente Especialista Backend",
    html: `
      <h1>Agente Especialista Backend (Opus)</h1>
      <p class="lead">Implementa API REST, endpoints, lógica de negocio, bases de datos y middleware. Escribe código TypeScript/Node.js siguiendo spec exactamente.</p>

      <h2>Perfil</h2>
      <table>
        <tr><td><strong>Modelo</strong></td><td>Claude Sonnet 4</td></tr>
        <tr><td><strong>Token budget</strong></td><td>150,000 tokens</td></tr>
        <tr><td><strong>Tiempo de respuesta</strong></td><td>~8-45s (estimación; Sonnet, varía con número de archivos)</td></tr>
        <tr><td><strong>Restricciones</strong></td><td>Solo TypeScript/Node.js. Delega testing a Testing agent.</td></tr>
        <tr><td><strong>Rol</strong></td><td>API implementation, database queries, middleware, error handling</td></tr>
      </table>

      <h2>Responsabilidades</h2>
      <ul>
        <li>Implementar endpoints (GET, POST, PUT, DELETE)</li>
        <li>Escribir queries de BD (Prisma, SQL)</li>
        <li>Implementar middleware (auth, validation, logging)</li>
        <li>Manejo de errores y excepciones</li>
        <li>Validación de input (Zod, joi, etc.)</li>
        <li>Documentar con JSDoc y TypeDoc</li>
      </ul>

      <h2>Restricciones</h2>
      <pre><code>✓ Puede: escribir Express, Fastify, Prisma, middleware
✗ No puede: escribir tests, deployar, crear UI
✗ Nunca: ignorar validaciones especificadas</code></pre>

      <h2>Casos de uso</h2>
      <ul>
        <li>API REST CRUD completa: usuarios, productos, pedidos</li>
        <li>Integración con servicios externos: Stripe, Sendgrid, Auth0</li>
        <li>Pipeline de datos: ingestion, transform, load a DW</li>
      </ul>

      <h2>Ejemplo</h2>
      <pre><code>Entrada: Spec "POST /users con validación email + hash password"
Implementación:
  - Ruta Express con validación Zod
  - Prisma create con hash bcrypt
  - Manejo error: email_unique duplicado → 409
  - JSDoc: @param, @returns, @throws
  - Archivos: src/api/users.ts + src/models/user.ts

Pruebas: delegadas a Testing agent</code></pre>
    `
  },
  en: {
    titulo: "Backend Specialist Agent",
    html: `
      <h1>Backend Specialist Agent (Opus)</h1>
      <p class="lead">Implements REST API, endpoints, business logic, databases and middleware. Writes TypeScript/Node.js code following spec exactly.</p>

      <h2>Profile</h2>
      <table>
        <tr><td><strong>Model</strong></td><td>Claude Sonnet 4</td></tr>
        <tr><td><strong>Token budget</strong></td><td>150,000 tokens</td></tr>
        <tr><td><strong>Response time</strong></td><td>~8-45s (estimate; Sonnet, varies with number of files)</td></tr>
        <tr><td><strong>Constraints</strong></td><td>TypeScript/Node.js only. Delegates testing to Testing agent.</td></tr>
        <tr><td><strong>Role</strong></td><td>API implementation, database queries, middleware, error handling</td></tr>
      </table>

      <h2>Responsibilities</h2>
      <ul>
        <li>Implement endpoints (GET, POST, PUT, DELETE)</li>
        <li>Write database queries (Prisma, SQL)</li>
        <li>Implement middleware (auth, validation, logging)</li>
        <li>Error handling and exceptions</li>
        <li>Input validation (Zod, joi, etc.)</li>
        <li>Document with JSDoc and TypeDoc</li>
      </ul>

      <h2>Constraints</h2>
      <pre><code>✓ Can: write Express, Fastify, Prisma, middleware
✗ Cannot: write tests, deploy, create UI
✗ Never: ignore specified validations</code></pre>

      <h2>Use cases</h2>
      <ul>
        <li>Complete REST API CRUD: users, products, orders</li>
        <li>External service integration: Stripe, Sendgrid, Auth0</li>
        <li>Data pipeline: ingestion, transform, load to DW</li>
      </ul>

      <h2>Example</h2>
      <pre><code>Input: Spec "POST /users with email validation + password hash"
Implementation:
  - Express route with Zod validation
  - Prisma create with bcrypt hash
  - Error handling: duplicate email_unique → 409
  - JSDoc: @param, @returns, @throws
  - Files: src/api/users.ts + src/models/user.ts

Tests: delegated to Testing agent</code></pre>
    `
  }
},

"agentes-frontend": {
  seccion: "technical",
  es: {
    titulo: "Agente Especialista Frontend",
    html: `
      <h1>Agente Especialista Frontend (Sonnet)</h1>
      <p class="lead">Implementa componentes React/Vue, páginas, integración con API, estado global (Redux, Zustand), estilos. Genera código component-driven.</p>

      <h2>Perfil</h2>
      <table>
        <tr><td><strong>Modelo</strong></td><td>Claude Sonnet 4</td></tr>
        <tr><td><strong>Token budget</strong></td><td>130,000 tokens</td></tr>
        <tr><td><strong>Tiempo de respuesta</strong></td><td>~8-45s (estimación; Sonnet, varía con complejidad del componente)</td></tr>
        <tr><td><strong>Restricciones</strong></td><td>React o Vue (nunca ambos en proyecto). Delega tests a Testing.</td></tr>
        <tr><td><strong>Rol</strong></td><td>Component implementation, state management, API integration, styling</td></tr>
      </table>

      <h2>Responsabilidades</h2>
      <ul>
        <li>Convertir diseño → componentes React/Vue</li>
        <li>Implementar páginas y layouts</li>
        <li>Integrar con API backend (fetch, axios, SWR)</li>
        <li>Gestionar estado local y global</li>
        <li>Aplicar estilos (Tailwind, CSS modules, styled-components)</li>
        <li>Optimizar performance (memoization, lazy loading)</li>
      </ul>

      <h2>Restricciones</h2>
      <pre><code>✓ Puede: escribir React TSX, hooks, estado, CSS
✗ No puede: escribir tests, backend, deployar
✗ Nunca: ignorar especificación de componentes</code></pre>

      <h2>Casos de uso</h2>
      <ul>
        <li>SaaS dashboard: tablas, gráficos, formularios complejos</li>
        <li>E-commerce: product catalog, cart, checkout flow</li>
        <li>Admin panel: CRUD forms con validación</li>
      </ul>

      <h2>Ejemplo</h2>
      <pre><code>Entrada: Spec "UserList componente con paginación + search"
Implementación:
  - Component UserList.tsx con hooks useState/useEffect
  - Fetch a GET /users con query params
  - Estado local: currentPage, search
  - Zustand store para selectedUser
  - Estilos Tailwind responsive
  - Archivo: src/components/UserList.tsx

Tests: delegados a Testing agent</code></pre>
    `
  },
  en: {
    titulo: "Frontend Specialist Agent",
    html: `
      <h1>Frontend Specialist Agent (Sonnet)</h1>
      <p class="lead">Implements React/Vue components, pages, API integration, global state (Redux, Zustand), styles. Generates component-driven code.</p>

      <h2>Profile</h2>
      <table>
        <tr><td><strong>Model</strong></td><td>Claude Sonnet 4</td></tr>
        <tr><td><strong>Token budget</strong></td><td>130,000 tokens</td></tr>
        <tr><td><strong>Response time</strong></td><td>~8-45s (estimate; Sonnet, varies with component complexity)</td></tr>
        <tr><td><strong>Constraints</strong></td><td>React or Vue (never both in one project). Delegates tests to Testing.</td></tr>
        <tr><td><strong>Role</strong></td><td>Component implementation, state management, API integration, styling</td></tr>
      </table>

      <h2>Responsibilities</h2>
      <ul>
        <li>Convert design → React/Vue components</li>
        <li>Implement pages and layouts</li>
        <li>Integrate with backend API (fetch, axios, SWR)</li>
        <li>Manage local and global state</li>
        <li>Apply styles (Tailwind, CSS modules, styled-components)</li>
        <li>Optimize performance (memoization, lazy loading)</li>
      </ul>

      <h2>Constraints</h2>
      <pre><code>✓ Can: write React TSX, hooks, state, CSS
✗ Cannot: write tests, backend, deploy
✗ Never: ignore component specification</code></pre>

      <h2>Use cases</h2>
      <ul>
        <li>SaaS dashboard: tables, charts, complex forms</li>
        <li>E-commerce: product catalog, cart, checkout flow</li>
        <li>Admin panel: CRUD forms with validation</li>
      </ul>

      <h2>Example</h2>
      <pre><code>Input: Spec "UserList component with pagination + search"
Implementation:
  - Component UserList.tsx with useState/useEffect hooks
  - Fetch to GET /users with query params
  - Local state: currentPage, search
  - Zustand store for selectedUser
  - Responsive Tailwind styles
  - File: src/components/UserList.tsx

Tests: delegated to Testing agent</code></pre>
    `
  }
},

"agentes-testing": {
  seccion: "technical",
  es: {
    titulo: "Agente Testing",
    html: `
      <h1>Agente Testing (Sonnet)</h1>
      <p class="lead">Escribe tests unitarios, integración y e2e. Genera test suites que validen spec, cubre edge cases, calcula cobertura. Usa Jest, Vitest, Playwright.</p>

      <h2>Perfil</h2>
      <table>
        <tr><td><strong>Modelo</strong></td><td>Claude Sonnet 4</td></tr>
        <tr><td><strong>Token budget</strong></td><td>100,000 tokens</td></tr>
        <tr><td><strong>Tiempo de respuesta</strong></td><td>~8-40s (estimación; Sonnet, varía con cobertura requerida)</td></tr>
        <tr><td><strong>Restricciones</strong></td><td>Tests solo. Input: código Backend/Frontend implementado.</td></tr>
        <tr><td><strong>Rol</strong></td><td>Test writing, coverage validation, edge case discovery</td></tr>
      </table>

      <h2>Responsabilidades</h2>
      <ul>
        <li>Escribir unit tests (Jest, Vitest)</li>
        <li>Escribir tests de integración (API + DB)</li>
        <li>Escribir e2e tests (Playwright, Cypress)</li>
        <li>Calcular cobertura (línea, rama, función)</li>
        <li>Descubrir y validar edge cases</li>
        <li>Documentar test strategy</li>
      </ul>

      <h2>Restricciones</h2>
      <pre><code>✓ Puede: escribir tests, mocks, fixtures, calcular cobertura
✗ No puede: escribir código productivo, modificar spec
✗ Nunca: pasar tests sin validar spec compliance</code></pre>

      <h2>Casos de uso</h2>
      <ul>
        <li>Backend API: tests unitarios de controllers + integración DB</li>
        <li>Frontend: snapshot + interaction tests en componentes</li>
        <li>E2E: user workflows end-to-end (login → action → verify)</li>
      </ul>

      <h2>Ejemplo</h2>
      <pre><code>Entrada: Backend POST /users implementado (src/api/users.ts)
Test suite generado:
  - Unit: validación Zod, hash bcrypt, serialización
  - Integration: POST /users → DB insert → GET /users
  - Error: email duplicado, payload inválido, timeout
  - Cobertura: 92% líneas, 85% ramas
  - Archivo: src/api/users.test.ts

Comando: npm test -- users.test.ts</code></pre>
    `
  },
  en: {
    titulo: "Testing Agent",
    html: `
      <h1>Testing Agent (Sonnet)</h1>
      <p class="lead">Writes unit, integration and e2e tests. Generates test suites that validate spec, covers edge cases, calculates coverage. Uses Jest, Vitest, Playwright.</p>

      <h2>Profile</h2>
      <table>
        <tr><td><strong>Model</strong></td><td>Claude Sonnet 4</td></tr>
        <tr><td><strong>Token budget</strong></td><td>100,000 tokens</td></tr>
        <tr><td><strong>Response time</strong></td><td>~8-40s (estimate; Sonnet, varies with coverage required)</td></tr>
        <tr><td><strong>Constraints</strong></td><td>Tests only. Input: implemented Backend/Frontend code.</td></tr>
        <tr><td><strong>Role</strong></td><td>Test writing, coverage validation, edge case discovery</td></tr>
      </table>

      <h2>Responsibilities</h2>
      <ul>
        <li>Write unit tests (Jest, Vitest)</li>
        <li>Write integration tests (API + DB)</li>
        <li>Write e2e tests (Playwright, Cypress)</li>
        <li>Calculate coverage (line, branch, function)</li>
        <li>Discover and validate edge cases</li>
        <li>Document test strategy</li>
      </ul>

      <h2>Constraints</h2>
      <pre><code>✓ Can: write tests, mocks, fixtures, calculate coverage
✗ Cannot: write production code, modify spec
✗ Never: pass tests without validating spec compliance</code></pre>

      <h2>Use cases</h2>
      <ul>
        <li>Backend API: unit tests of controllers + DB integration</li>
        <li>Frontend: snapshot + interaction tests on components</li>
        <li>E2E: end-to-end user workflows (login → action → verify)</li>
      </ul>

      <h2>Example</h2>
      <pre><code>Input: Backend POST /users implemented (src/api/users.ts)
Generated test suite:
  - Unit: Zod validation, bcrypt hash, serialization
  - Integration: POST /users → DB insert → GET /users
  - Error: duplicate email, invalid payload, timeout
  - Coverage: 92% lines, 85% branches
  - File: src/api/users.test.ts

Command: npm test -- users.test.ts</code></pre>
    `
  }
},

"agentes-devops": {
  seccion: "technical",
  es: {
    titulo: "Agente DevOps",
    html: `
      <h1>Agente DevOps (Sonnet)</h1>
      <p class="lead">Configura infrastructure, CI/CD, deployment, Docker, variables de entorno, monitoreo. Genera Dockerfile, GitHub Actions, secrets management.</p>

      <h2>Perfil</h2>
      <table>
        <tr><td><strong>Modelo</strong></td><td>Claude Sonnet 4</td></tr>
        <tr><td><strong>Token budget</strong></td><td>100,000 tokens</td></tr>
        <tr><td><strong>Tiempo de respuesta</strong></td><td>~8-45s (estimación; Sonnet, varía con proveedor de deploy)</td></tr>
        <tr><td><strong>Restricciones</strong></td><td>No deploya directamente. Genera IaC que CI/CD ejecuta.</td></tr>
        <tr><td><strong>Rol</strong></td><td>IaC, CI/CD pipelines, containerization, secrets, monitoring</td></tr>
      </table>

      <h2>Responsabilidades</h2>
      <ul>
        <li>Crear Dockerfile con multi-stage builds</li>
        <li>Configurar GitHub Actions / GitLab CI</li>
        <li>Gestionar secretos (env vars, credentials)</li>
        <li>Definir health checks y monitoring</li>
        <li>Configurar auto-scaling y performance</li>
        <li>Documentar deployment checklist</li>
      </ul>

      <h2>Restricciones</h2>
      <pre><code>✓ Puede: escribir Docker, YAML, secretos management
✗ No puede: ejecutar deploy manual, acceder a producción
✗ Nunca: commitear secrets a repo</code></pre>

      <h2>Casos de uso</h2>
      <ul>
        <li>MVP SaaS: deploy a Vercel/Railway (serverless)</li>
        <li>API crítica: deploy a AWS ECS / GCP Cloud Run (managed)</li>
        <li>Monorepo: CI matrix para múltiples servicios</li>
      </ul>

      <h2>Ejemplo</h2>
      <pre><code>Entrada: Backend Node.js + PostgreSQL + Redis
Outputs:
  - Dockerfile: multi-stage (build, runtime)
  - .github/workflows/deploy.yml: lint → test → build → push ECR → deploy ECS
  - docker-compose.yml: local development (API + DB + Redis)
  - .env.example: plantilla de variables
  - deployment.md: checklist pre-producción

Archivos: Dockerfile, docker-compose.yml, .github/workflows/</code></pre>
    `
  },
  en: {
    titulo: "DevOps Agent",
    html: `
      <h1>DevOps Agent (Sonnet)</h1>
      <p class="lead">Configures infrastructure, CI/CD, deployment, Docker, environment variables, monitoring. Generates Dockerfile, GitHub Actions, secrets management.</p>

      <h2>Profile</h2>
      <table>
        <tr><td><strong>Model</strong></td><td>Claude Sonnet 4</td></tr>
        <tr><td><strong>Token budget</strong></td><td>100,000 tokens</td></tr>
        <tr><td><strong>Response time</strong></td><td>~8-45s (estimate; Sonnet, varies with deploy provider)</td></tr>
        <tr><td><strong>Constraints</strong></td><td>Doesn't deploy directly. Generates IaC that CI/CD executes.</td></tr>
        <tr><td><strong>Role</strong></td><td>IaC, CI/CD pipelines, containerization, secrets, monitoring</td></tr>
      </table>

      <h2>Responsibilities</h2>
      <ul>
        <li>Create Dockerfile with multi-stage builds</li>
        <li>Configure GitHub Actions / GitLab CI</li>
        <li>Manage secrets (env vars, credentials)</li>
        <li>Define health checks and monitoring</li>
        <li>Configure auto-scaling and performance</li>
        <li>Document deployment checklist</li>
      </ul>

      <h2>Constraints</h2>
      <pre><code>✓ Can: write Docker, YAML, secrets management
✗ Cannot: execute manual deploy, access production
✗ Never: commit secrets to repo</code></pre>

      <h2>Use cases</h2>
      <ul>
        <li>MVP SaaS: deploy to Vercel/Railway (serverless)</li>
        <li>Critical API: deploy to AWS ECS / GCP Cloud Run (managed)</li>
        <li>Monorepo: CI matrix for multiple services</li>
      </ul>

      <h2>Example</h2>
      <pre><code>Input: Node.js Backend + PostgreSQL + Redis
Outputs:
  - Dockerfile: multi-stage (build, runtime)
  - .github/workflows/deploy.yml: lint → test → build → push ECR → deploy ECS
  - docker-compose.yml: local development (API + DB + Redis)
  - .env.example: environment variables template
  - deployment.md: pre-production checklist

Files: Dockerfile, docker-compose.yml, .github/workflows/</code></pre>
    `
  }
},

"agentes-data": {
  seccion: "technical",
  es: {
    titulo: "Agente Data Specialist",
    html: `
      <h1>Agente Data Specialist (Opus)</h1>
      <p class="lead">Diseña esquemas BD, pipelines ETL, queries optimizadas, índices, migrations. Genera SQL, Prisma schemas, documentación de data model.</p>

      <h2>Perfil</h2>
      <table>
        <tr><td><strong>Modelo</strong></td><td>Claude Opus 4</td></tr>
        <tr><td><strong>Token budget</strong></td><td>120,000 tokens</td></tr>
        <tr><td><strong>Tiempo de respuesta</strong></td><td>~10-45s (estimación; Opus, varía con complejidad del modelo)</td></tr>
        <tr><td><strong>Restricciones</strong></td><td>Especificación + queries. No ejecuta DDL en producción.</td></tr>
        <tr><td><strong>Rol</strong></td><td>Database design, query optimization, migrations, data modeling</td></tr>
      </table>

      <h2>Responsabilidades</h2>
      <ul>
        <li>Diseñar ER diagram (relaciones, constraints)</li>
        <li>Crear Prisma schema o SQL DDL</li>
        <li>Generar migrations versionadas</li>
        <li>Optimizar queries (índices, EXPLAIN ANALYZE)</li>
        <li>Diseñar ETL pipelines (ingestion, validation, load)</li>
        <li>Documentar data dictionary</li>
      </ul>

      <h2>Restricciones</h2>
      <pre><code>✓ Puede: diseñar schemas, queries, migraciones, índices
✗ No puede: ejecutar DDL directo en BD, modificar datos
✗ Nunca: ignorar constraints de integridad</code></pre>

      <h2>Casos de uso</h2>
      <ul>
        <li>SaaS multitenancy: schema de tenants + sharding strategy</li>
        <li>Analytics: fact/dimension tables, slowly changing dimensions</li>
        <li>Audit trail: immutable log con partition strategy</li>
      </ul>

      <h2>Ejemplo</h2>
      <pre><code>Entrada: "Usuarios, Productos, Pedidos con historial"
Outputs:
  - ER diagram: users (PK: id, FK: tenant_id) → orders → order_items ← products
  - Prisma schema: models User, Order, OrderItem con relaciones
  - Migrations: 001_init.sql, 002_add_audit_fields.sql
  - Indexes: order(user_id, created_at), order_items(order_id)
  - data-model.md: documentación completa

Archivos: schema.prisma, migrations/, data-model.md</code></pre>
    `
  },
  en: {
    titulo: "Data Specialist Agent",
    html: `
      <h1>Data Specialist Agent (Opus)</h1>
      <p class="lead">Designs database schemas, ETL pipelines, optimized queries, indexes, migrations. Generates SQL, Prisma schemas, data model documentation.</p>

      <h2>Profile</h2>
      <table>
        <tr><td><strong>Model</strong></td><td>Claude Opus 4</td></tr>
        <tr><td><strong>Token budget</strong></td><td>120,000 tokens</td></tr>
        <tr><td><strong>Response time</strong></td><td>~10-45s (estimate; Opus, varies with model complexity)</td></tr>
        <tr><td><strong>Constraints</strong></td><td>Specification + queries. Doesn't execute DDL in production.</td></tr>
        <tr><td><strong>Role</strong></td><td>Database design, query optimization, migrations, data modeling</td></tr>
      </table>

      <h2>Responsibilities</h2>
      <ul>
        <li>Design ER diagram (relationships, constraints)</li>
        <li>Create Prisma schema or SQL DDL</li>
        <li>Generate versioned migrations</li>
        <li>Optimize queries (indexes, EXPLAIN ANALYZE)</li>
        <li>Design ETL pipelines (ingestion, validation, load)</li>
        <li>Document data dictionary</li>
      </ul>

      <h2>Constraints</h2>
      <pre><code>✓ Can: design schemas, queries, migrations, indexes
✗ Cannot: execute direct DDL on database, modify data
✗ Never: ignore integrity constraints</code></pre>

      <h2>Use cases</h2>
      <ul>
        <li>SaaS multitenancy: tenant schema + sharding strategy</li>
        <li>Analytics: fact/dimension tables, slowly changing dimensions</li>
        <li>Audit trail: immutable log with partition strategy</li>
      </ul>

      <h2>Example</h2>
      <pre><code>Input: "Users, Products, Orders with history"
Outputs:
  - ER diagram: users (PK: id, FK: tenant_id) → orders → order_items ← products
  - Prisma schema: models User, Order, OrderItem with relationships
  - Migrations: 001_init.sql, 002_add_audit_fields.sql
  - Indexes: order(user_id, created_at), order_items(order_id)
  - data-model.md: complete documentation

Files: schema.prisma, migrations/, data-model.md</code></pre>
    `
  }
},

"agentes-asesor": {
  seccion: "technical",
  es: {
    titulo: "Agente Asesor (Haiku)",
    html: `
      <h1>Agente Asesor (Haiku)</h1>
      <p class="lead">Agente ligero. Responde preguntas, clarifica requisitos, sugiere mejoras. Rápido y económico para consultas de clarificación.</p>

      <h2>Perfil</h2>
      <table>
        <tr><td><strong>Modelo</strong></td><td>Claude Haiku 4</td></tr>
        <tr><td><strong>Token budget</strong></td><td>50,000 tokens</td></tr>
        <tr><td><strong>Tiempo de respuesta</strong></td><td>~2-12s (estimación; Haiku, modelo más rápido)</td></tr>
        <tr><td><strong>Restricciones</strong></td><td>Solo Q&A y sugerencias. Delega decisiones a Arquitecto.</td></tr>
        <tr><td><strong>Rol</strong></td><td>Requirements clarification, quick suggestions, QA mental</td></tr>
      </table>

      <h2>Responsabilidades</h2>
      <ul>
        <li>Clarificar requisitos ambiguos</li>
        <li>Responder preguntas rápidamente</li>
        <li>Sugerir mejoras menores</li>
        <li>Validar convenciones del proyecto</li>
        <li>Proponer nombres (variables, funciones)</li>
        <li>Resolver conflictos de convención</li>
      </ul>

      <h2>Restricciones</h2>
      <pre><code>✓ Puede: responder, clarificar, sugerir
✗ No puede: tomar decisiones de arquitectura, implementar
✗ Nunca: asumir, siempre pide confirmación</code></pre>

      <h2>Casos de uso</h2>
      <ul>
        <li>¿Debo usar MongoDB o PostgreSQL? → Clarificar requisitos, sugiere alternativa</li>
        <li>¿Nombre para esta función? → Sugiere nombres idiomáticos</li>
        <li>¿Este error es critical? → Valida severity</li>
      </ul>

      <h2>Ejemplo</h2>
      <pre><code>Pregunta: "¿Cómo valido emails?"
Respuesta: "Depende. ¿Necesitas verificar que exista (confirmación) o solo formato?
           Formato: validador regex o librería (email-validator)
           Existencia: enviar confirmation link (async)
           ¿Cuál es tu caso?"

Decisión final → delegada a Arquitecto o especialista</code></pre>
    `
  },
  en: {
    titulo: "Advisor Agent",
    html: `
      <h1>Advisor Agent (Haiku)</h1>
      <p class="lead">Lightweight agent. Answers questions, clarifies requirements, suggests improvements. Fast and economical for clarification queries.</p>

      <h2>Profile</h2>
      <table>
        <tr><td><strong>Model</strong></td><td>Claude Haiku 4</td></tr>
        <tr><td><strong>Token budget</strong></td><td>50,000 tokens</td></tr>
        <tr><td><strong>Response time</strong></td><td>~2-12s (estimate; Haiku, fastest model)</td></tr>
        <tr><td><strong>Constraints</strong></td><td>Q&A and suggestions only. Delegates decisions to Architect.</td></tr>
        <tr><td><strong>Role</strong></td><td>Requirements clarification, quick suggestions, mental QA</td></tr>
      </table>

      <h2>Responsibilities</h2>
      <ul>
        <li>Clarify ambiguous requirements</li>
        <li>Answer questions quickly</li>
        <li>Suggest minor improvements</li>
        <li>Validate project conventions</li>
        <li>Propose names (variables, functions)</li>
        <li>Resolve convention conflicts</li>
      </ul>

      <h2>Constraints</h2>
      <pre><code>✓ Can: answer, clarify, suggest
✗ Cannot: make architectural decisions, implement
✗ Never: assume, always ask for confirmation</code></pre>

      <h2>Use cases</h2>
      <ul>
        <li>Should I use MongoDB or PostgreSQL? → Clarify requirements, suggest alternative</li>
        <li>What name for this function? → Suggest idiomatic names</li>
        <li>Is this error critical? → Validate severity</li>
      </ul>

      <h2>Example</h2>
      <pre><code>Question: "How do I validate emails?"
Response: "Depends. Do you need to verify existence (confirmation) or just format?
          Format: regex validator or library (email-validator)
          Existence: send confirmation link (async)
          Which is your case?"

Final decision → delegated to Architect or specialist</code></pre>
    `
  }
},

"agentes-interpretador": {
  seccion: "technical",
  es: {
    titulo: "Agente Interpretador",
    html: `
      <h1>Agente Interpretador (Sonnet)</h1>
      <p class="lead">Convierte requisitos en lenguaje natural a especificación técnica estructurada. Genera SPEC.md listo para que Arquitecto y especialistas lo implementen.</p>

      <h2>Perfil</h2>
      <table>
        <tr><td><strong>Modelo</strong></td><td>Claude Sonnet 4</td></tr>
        <tr><td><strong>Token budget</strong></td><td>110,000 tokens</td></tr>
        <tr><td><strong>Tiempo de respuesta</strong></td><td>~8-40s (estimación; Sonnet, varía con longitud de la descripción)</td></tr>
        <tr><td><strong>Restricciones</strong></td><td>Solo especificación. Input: requisitos en lenguaje natural.</td></tr>
        <tr><td><strong>Rol</strong></td><td>Requirement analysis, specification writing, traceability</td></tr>
      </table>

      <h2>Responsabilidades</h2>
      <ul>
        <li>Analizar requisitos no estructurados</li>
        <li>Generar SPEC.md formal (user stories, acceptance criteria)</li>
        <li>Identificar ambigüedades y pedir clarificación</li>
        <li>Mapear requisitos a módulos/componentes</li>
        <li>Definir interfaces y contratos</li>
        <li>Crear test cases desde spec</li>
      </ul>

      <h2>Restricciones</h2>
      <pre><code>✓ Puede: escribir specs, crear user stories, validar requirements
✗ No puede: implementar, tomar decisiones de arquitectura
✗ Nunca: pasar spec incompleta o ambigua</code></pre>

      <h2>Casos de uso</h2>
      <ul>
        <li>Conversación → Spec: usuario describe idea, genera SPEC.md</li>
        <li>Validación cruzada: spec vs crítica vs diseño</li>
        <li>Traceability: requisito → test → implementación</li>
      </ul>

      <h2>Ejemplo</h2>
      <pre><code>Entrada: "API que cobre a clientes por usar la app"
Spec generado:
  Requisito 1: POST /invoices con cliente + items
    - Acceptance: calcula total, aplica impuestos, crea en BD
    - Tests: invoice creado, total correcto, email enviado

  Requisito 2: GET /invoices/:id retorna invoice con estado
    - Acceptance: solo el cliente propietario puede ver
    - Tests: autenticación, permisos

  Requisito 3: PUT /invoices/:id/pay con payment method
    - Acceptance: procesa pago, actualiza estado, webhook

  Archivo: SPEC.md con 15+ user stories</code></pre>
    `
  },
  en: {
    titulo: "Interpreter Agent",
    html: `
      <h1>Interpreter Agent (Sonnet)</h1>
      <p class="lead">Converts natural language requirements to structured technical specification. Generates SPEC.md ready for Architect and specialists to implement.</p>

      <h2>Profile</h2>
      <table>
        <tr><td><strong>Model</strong></td><td>Claude Sonnet 4</td></tr>
        <tr><td><strong>Token budget</strong></td><td>110,000 tokens</td></tr>
        <tr><td><strong>Response time</strong></td><td>~8-40s (estimate; Sonnet, varies with description length)</td></tr>
        <tr><td><strong>Constraints</strong></td><td>Specification only. Input: natural language requirements.</td></tr>
        <tr><td><strong>Role</strong></td><td>Requirement analysis, specification writing, traceability</td></tr>
      </table>

      <h2>Responsibilities</h2>
      <ul>
        <li>Analyze unstructured requirements</li>
        <li>Generate formal SPEC.md (user stories, acceptance criteria)</li>
        <li>Identify ambiguities and request clarification</li>
        <li>Map requirements to modules/components</li>
        <li>Define interfaces and contracts</li>
        <li>Create test cases from spec</li>
      </ul>

      <h2>Constraints</h2>
      <pre><code>✓ Can: write specs, create user stories, validate requirements
✗ Cannot: implement, make architectural decisions
✗ Never: pass incomplete or ambiguous spec</code></pre>

      <h2>Use cases</h2>
      <ul>
        <li>Conversation → Spec: user describes idea, generates SPEC.md</li>
        <li>Cross-validation: spec vs critique vs design</li>
        <li>Traceability: requirement → test → implementation</li>
      </ul>

      <h2>Example</h2>
      <pre><code>Input: "API that charges customers for using the app"
Generated spec:
  Requirement 1: POST /invoices with customer + items
    - Acceptance: calculates total, applies taxes, creates in DB
    - Tests: invoice created, total correct, email sent

  Requirement 2: GET /invoices/:id returns invoice with status
    - Acceptance: only owner customer can see
    - Tests: authentication, permissions

  Requirement 3: PUT /invoices/:id/pay with payment method
    - Acceptance: processes payment, updates status, webhook

  File: SPEC.md with 15+ user stories</code></pre>
    `
  }
},

"agentes-descubridor": {
  seccion: "technical",
  es: {
    titulo: "Agente Descubridor",
    html: `
      <h1>Agente Descubridor (Sonnet)</h1>
      <p class="lead">Agente de descubrimiento. Analiza codebases existentes, identifica patrones, deuda técnica, oportunidades de refactoring. Genera audit.md detallado.</p>

      <h2>Perfil</h2>
      <table>
        <tr><td><strong>Modelo</strong></td><td>Claude Sonnet 4</td></tr>
        <tr><td><strong>Token budget</strong></td><td>180,000 tokens</td></tr>
        <tr><td><strong>Tiempo de respuesta</strong></td><td>~8-45s (estimación; Sonnet, varía con tamaño del codebase)</td></tr>
        <tr><td><strong>Restricciones</strong></td><td>Solo análisis e inspección. Genera reportes, nunca modifica.</td></tr>
        <tr><td><strong>Rol</strong></td><td>Codebase analysis, pattern discovery, technical debt assessment</td></tr>
      </table>

      <h2>Responsabilidades</h2>
      <ul>
        <li>Mapear arquitectura actual (módulos, dependencias)</li>
        <li>Identificar patrones y anti-patrones</li>
        <li>Detectar deuda técnica (coupling, duplicación)</li>
        <li>Proponer refactoring opportunities</li>
        <li>Calcular métricas (complejidad, cobertura, cyclomatic)</li>
        <li>Generar audit report estructurado</li>
      </ul>

      <h2>Restricciones</h2>
      <pre><code>✓ Puede: analizar, mapear, detectar, reportar
✗ No puede: modificar código, ejecutar
✗ Nunca: ocultar deuda técnica</code></pre>

      <h2>Casos de uso</h2>
      <ul>
        <li>Onboarding: nuevo developer aprende codebase via audit.md</li>
        <li>Refactoring: descubrir oportunidades pre-intervención</li>
        <li>Evaluación: calcular tech debt, esfuerzo de migración</li>
      </ul>

      <h2>Ejemplo</h2>
      <pre><code>Entrada: Codebase monolito Django 50k LoC
Audit generado:
  Arquitectura: 1 app.py monolítico, 12 models, 45 views
  Patrones: MVC inconsistente, tests en 20% código
  Deuda técnica:
    - Models sin docstring (67%)
    - Queries N+1 (8 encontradas)
    - Código duplicado: 12% (refactor: extract services)
  Métricas:
    - Cyclomatic complexity: 8.2 (objetivo: <5)
    - Test coverage: 42% (objetivo: >80%)

  Recomendaciones:
    1. Extraer lógica de negocio a services layer
    2. Implementar tests para modelos críticos
    3. Migrar a async/await donde sea I/O

  Archivo: audit.md + metrics.json</code></pre>
    `
  },
  en: {
    titulo: "Discovery Agent",
    html: `
      <h1>Discovery Agent (Opus)</h1>
      <p class="lead">Discovery agent. Analyzes existing codebases, identifies patterns, technical debt, refactoring opportunities. Generates detailed audit.md.</p>

      <h2>Profile</h2>
      <table>
        <tr><td><strong>Model</strong></td><td>Claude Sonnet 4</td></tr>
        <tr><td><strong>Token budget</strong></td><td>180,000 tokens</td></tr>
        <tr><td><strong>Response time</strong></td><td>~8-45s (estimate; Sonnet, varies with codebase size)</td></tr>
        <tr><td><strong>Constraints</strong></td><td>Analysis and inspection only. Generates reports, never modifies.</td></tr>
        <tr><td><strong>Role</strong></td><td>Codebase analysis, pattern discovery, technical debt assessment</td></tr>
      </table>

      <h2>Responsibilities</h2>
      <ul>
        <li>Map current architecture (modules, dependencies)</li>
        <li>Identify patterns and anti-patterns</li>
        <li>Detect technical debt (coupling, duplication)</li>
        <li>Propose refactoring opportunities</li>
        <li>Calculate metrics (complexity, coverage, cyclomatic)</li>
        <li>Generate structured audit report</li>
      </ul>

      <h2>Constraints</h2>
      <pre><code>✓ Can: analyze, map, detect, report
✗ Cannot: modify code, execute
✗ Never: hide technical debt</code></pre>

      <h2>Use cases</h2>
      <ul>
        <li>Onboarding: new developer learns codebase via audit.md</li>
        <li>Refactoring: discover opportunities pre-intervention</li>
        <li>Evaluation: calculate tech debt, migration effort</li>
      </ul>

      <h2>Example</h2>
      <pre><code>Input: 50k LoC monolithic Django codebase
Generated audit:
  Architecture: 1 app.py monolith, 12 models, 45 views
  Patterns: inconsistent MVC, tests in 20% of code
  Technical debt:
    - Models without docstring (67%)
    - N+1 queries (8 found)
    - Code duplication: 12% (refactor: extract services)
  Metrics:
    - Cyclomatic complexity: 8.2 (target: <5)
    - Test coverage: 42% (target: >80%)

  Recommendations:
    1. Extract business logic to services layer
    2. Implement tests for critical models
    3. Migrate to async/await where I/O

  Files: audit.md + metrics.json</code></pre>
    `
  }
},

"agentes-documentador": {
  seccion: "technical",
  es: {
    titulo: "Agente Documentador",
    html: `
      <h1>Agente Documentador (Sonnet)</h1>
      <p class="lead">Escribe documentación API, README, guías de desarrollo, diagramas. Genera archivos .md con ejemplos de código, tablas, flows.</p>

      <h2>Perfil</h2>
      <table>
        <tr><td><strong>Modelo</strong></td><td>Claude Sonnet 4</td></tr>
        <tr><td><strong>Token budget</strong></td><td>95,000 tokens</td></tr>
        <tr><td><strong>Tiempo de respuesta</strong></td><td>~5-30s (estimación; Sonnet, varía con extensión del documento)</td></tr>
        <tr><td><strong>Restricciones</strong></td><td>Documentación solo. Input: código/spec implementados.</td></tr>
        <tr><td><strong>Rol</strong></td><td>Technical writing, API docs, user guides, diagram generation</td></tr>
      </table>

      <h2>Responsabilidades</h2>
      <ul>
        <li>Generar README.md con quickstart</li>
        <li>Documentar API endpoints (OpenAPI / swagger)</li>
        <li>Escribir guías de instalación y deployment</li>
        <li>Crear diagramas ASCII/Mermaid</li>
        <li>Escribir ejemplos de código (curl, SDK)</li>
        <li>Documentar troubleshooting y FAQ</li>
      </ul>

      <h2>Restricciones</h2>
      <pre><code>✓ Puede: escribir docs, crear ejemplos, generar diagramas
✗ No puede: modificar código, ejecutar, deployar
✗ Nunca: documentar código que no existe</code></pre>

      <h2>Casos de uso</h2>
      <ul>
        <li>Post-implementación: docs para usuarios/developers</li>
        <li>API pública: OpenAPI spec + SDK examples</li>
        <li>Onboarding: setup guide + architecture diagram</li>
      </ul>

      <h2>Ejemplo</h2>
      <pre><code>Entrada: Backend REST API implementado
Documentación generada:
  - README.md: descripción, quickstart, features
  - API.md: endpoints GET/POST/PUT/DELETE con ejemplos curl
  - SETUP.md: instalación local, env vars, DB migrations
  - ARCHITECTURE.md: diagrama ASCII del flow
  - EXAMPLES.md: casos de uso con código JavaScript/Python
  - TROUBLESHOOTING.md: errores comunes y soluciones

  Archivos: README.md, docs/API.md, docs/ARCHITECTURE.md, etc.</code></pre>
    `
  },
  en: {
    titulo: "Documentation Agent",
    html: `
      <h1>Documentation Agent (Sonnet)</h1>
      <p class="lead">Writes API documentation, README, development guides, diagrams. Generates .md files with code examples, tables, flows.</p>

      <h2>Profile</h2>
      <table>
        <tr><td><strong>Model</strong></td><td>Claude Sonnet 4</td></tr>
        <tr><td><strong>Token budget</strong></td><td>95,000 tokens</td></tr>
        <tr><td><strong>Response time</strong></td><td>~5-30s (estimate; Sonnet, varies with document length)</td></tr>
        <tr><td><strong>Constraints</strong></td><td>Documentation only. Input: implemented code/spec.</td></tr>
        <tr><td><strong>Role</strong></td><td>Technical writing, API docs, user guides, diagram generation</td></tr>
      </table>

      <h2>Responsibilities</h2>
      <ul>
        <li>Generate README.md with quickstart</li>
        <li>Document API endpoints (OpenAPI / swagger)</li>
        <li>Write installation and deployment guides</li>
        <li>Create ASCII/Mermaid diagrams</li>
        <li>Write code examples (curl, SDK)</li>
        <li>Document troubleshooting and FAQ</li>
      </ul>

      <h2>Constraints</h2>
      <pre><code>✓ Can: write docs, create examples, generate diagrams
✗ Cannot: modify code, execute, deploy
✗ Never: document non-existent code</code></pre>

      <h2>Use cases</h2>
      <ul>
        <li>Post-implementation: docs for users/developers</li>
        <li>Public API: OpenAPI spec + SDK examples</li>
        <li>Onboarding: setup guide + architecture diagram</li>
      </ul>

      <h2>Example</h2>
      <pre><code>Input: Implemented REST API backend
Generated documentation:
  - README.md: description, quickstart, features
  - API.md: GET/POST/PUT/DELETE endpoints with curl examples
  - SETUP.md: local installation, env vars, DB migrations
  - ARCHITECTURE.md: ASCII diagram of flow
  - EXAMPLES.md: use cases with JavaScript/Python code
  - TROUBLESHOOTING.md: common errors and solutions

  Files: README.md, docs/API.md, docs/ARCHITECTURE.md, etc.</code></pre>
    `
  }
},

/* ── COMANDOS ──────────────────────────────────────────── */

"comandos-pipeline": {
  seccion: "operate",
  es: {
    titulo: "Pipeline — 39 Comandos",
    html: `
      <h1>Pipeline SDD — 39 Comandos</h1>
      <p class="lead">FORGE implementa el ciclo completo de desarrollo mediante 39 comandos en 8 etapas. Cada etapa produce artefactos duraderos en <code>.sdd/</code>.</p>

      <h2>Flujo del pipeline</h2>
      <pre><code>💡 Idea
   ↓
/sdd.descubrir    → preguntas de clarificación
/sdd.interpretar  → .sdd/ir.json
/sdd.diseñar      → .sdd/product-design.json + wireframe
/sdd.especificar  → .sdd/especificaciones/.../spec.md
/sdd.planificar   → .sdd/planes/.../plan.md
/sdd.tareas       → .sdd/tareas.json
/sdd.implementar  → código en src/
/sdd.verificar    → tests + cobertura
/sdd.desplegar    → 🚀 producción</code></pre>

      <h2>Etapa 1 — Descubrimiento e Interpretación</h2>
      <table>
        <thead><tr><th>Comando</th><th>Agente</th><th>Salida</th><th>Tiempo</th></tr></thead>
        <tbody>
          <tr><td><code>/sdd.descubrir</code></td><td>investigador</td><td>Respuestas estructuradas</td><td>2-5 min</td></tr>
          <tr><td><code>/sdd.interpretar [texto]</code></td><td>investigador</td><td><code>.sdd/ir.json</code></td><td>30-60s</td></tr>
          <tr><td><code>/sdd.aclarar</code></td><td>investigador</td><td><code>ir.json</code> actualizado</td><td>1-3 min</td></tr>
        </tbody>
      </table>

      <h2>Etapa 2 — Diseño</h2>
      <table>
        <thead><tr><th>Comando</th><th>Agentes</th><th>Salida</th><th>Tiempo</th></tr></thead>
        <tbody>
          <tr><td><code>/sdd.diseñar</code></td><td>product-designer + architecture-designer</td><td><code>product-design.json</code> + wireframe HTML</td><td>1-3 min</td></tr>
        </tbody>
      </table>

      <h2>Etapa 3 — Especificación</h2>
      <table>
        <thead><tr><th>Comando</th><th>Agentes</th><th>Salida</th><th>Tiempo</th></tr></thead>
        <tbody>
          <tr><td><code>/sdd.especificar [texto]</code></td><td>arquitecto + crítico + revisor</td><td><code>spec.md</code> con criterios de aceptación</td><td>3-8 min</td></tr>
          <tr><td><code>/sdd.revisar</code></td><td>crítico</td><td>Critique doc</td><td>1-2 min</td></tr>
        </tbody>
      </table>

      <h2>Etapa 4 — Planificación</h2>
      <table>
        <thead><tr><th>Comando</th><th>Agente</th><th>Salida</th><th>Tiempo</th></tr></thead>
        <tbody>
          <tr><td><code>/sdd.planificar</code></td><td>arquitecto</td><td><code>plan.md</code></td><td>2-5 min</td></tr>
          <tr><td><code>/sdd.tareas</code></td><td>arquitecto</td><td><code>tareas.json</code></td><td>1-2 min</td></tr>
        </tbody>
      </table>

      <h2>Etapa 5 — Implementación</h2>
      <table>
        <thead><tr><th>Comando</th><th>Agente</th><th>Salida</th><th>Tiempo</th></tr></thead>
        <tbody>
          <tr><td><code>/sdd.implementar</code></td><td>backend + frontend + data</td><td>Código completo en <code>src/</code></td><td>10-30 min</td></tr>
          <tr><td><code>/sdd.implementar backend</code></td><td>desarrollador-backend</td><td>API + middleware + modelos</td><td>5-15 min</td></tr>
          <tr><td><code>/sdd.implementar frontend</code></td><td>desarrollador-frontend</td><td>Componentes + páginas</td><td>5-15 min</td></tr>
          <tr><td><code>/sdd.implementar data</code></td><td>asesor-datos</td><td>Schema Prisma + migrations</td><td>2-5 min</td></tr>
        </tbody>
      </table>

      <h2>Etapa 6 — Verificación</h2>
      <table>
        <thead><tr><th>Comando</th><th>Agentes</th><th>Salida</th><th>Tiempo</th></tr></thead>
        <tbody>
          <tr><td><code>/sdd.verificar</code></td><td>tester + revisor</td><td>Tests + reporte cobertura</td><td>5-15 min</td></tr>
          <tr><td><code>/sdd.verificar seguridad</code></td><td>seguridad</td><td><code>security.md</code></td><td>3-8 min</td></tr>
        </tbody>
      </table>

      <h2>Etapa 7 — Despliegue</h2>
      <table>
        <thead><tr><th>Comando</th><th>Agente</th><th>Salida</th><th>Tiempo</th></tr></thead>
        <tbody>
          <tr><td><code>/sdd.desplegar</code></td><td>operaciones</td><td>Deploy a plataforma configurada</td><td>2-10 min</td></tr>
          <tr><td><code>/sdd.desplegar vercel</code></td><td>operaciones</td><td>URL de producción en Vercel</td><td>2-5 min</td></tr>
        </tbody>
      </table>

      <h2>Comandos de soporte (12 adicionales)</h2>
      <table>
        <thead><tr><th>Comando</th><th>Propósito</th></tr></thead>
        <tbody>
          <tr><td><code>/sdd.estado</code></td><td>Estado actual del pipeline</td></tr>
          <tr><td><code>/sdd.estado consumo</code></td><td>Consumo de tokens por agente</td></tr>
          <tr><td><code>/sdd.optimizar</code></td><td>Comprimir memoria y reducir tokens</td></tr>
          <tr><td><code>/sdd.optimizar memoria</code></td><td>Comprimir archivos de agentes</td></tr>
          <tr><td><code>/sdd.optimizar full</code></td><td>Compresión máxima antes de sesión larga</td></tr>
          <tr><td><code>/sdd.constitucion</code></td><td>Crear/editar principios del proyecto</td></tr>
          <tr><td><code>/sdd.contexto</code></td><td>Cargar contexto de sesión anterior</td></tr>
          <tr><td><code>/sdd.analizar</code></td><td>Analizar codebase existente</td></tr>
          <tr><td><code>/sdd.debug</code></td><td>Diagnóstico de agentes y hooks</td></tr>
          <tr><td><code>/sdd.github</code></td><td>Conectar repositorio GitHub</td></tr>
          <tr><td><code>/sdd.docs</code></td><td>Generar documentación del proyecto</td></tr>
          <tr><td><code>/sdd.configurar perfil</code></td><td>Cambiar entre perfil guiado/experto</td></tr>
        </tbody>
      </table>

      <h2>Reanudabilidad</h2>
      <p>Cada etapa escribe su checkpoint. Si la sesión se interrumpe:</p>
      <pre><code>/sdd.estado        # ver en qué etapa quedó
/sdd.implementar   # retomar — FORGE detecta qué ya existe y continúa</code></pre>
    `
  },
  en: {
    titulo: "Pipeline — 39 Commands",
    html: `
      <h1>SDD Pipeline — 39 Commands</h1>
      <p class="lead">FORGE implements the complete development cycle through 39 commands in 8 stages. Each stage produces durable artifacts in <code>.sdd/</code>.</p>
      <h2>Pipeline flow</h2>
      <pre><code>💡 Idea → /sdd.descubrir → /sdd.interpretar → /sdd.diseñar
→ /sdd.especificar → /sdd.planificar → /sdd.implementar
→ /sdd.verificar → /sdd.desplegar → 🚀 production</code></pre>
      <h2>Resumability</h2>
      <pre><code>/sdd.estado        # see current stage
/sdd.implementar   # resume — FORGE detects what exists and continues</code></pre>
    `
  }
},

/* ── SKILLS ────────────────────────────────────────────── */

"skills-catalogo": {
  seccion: "operate",
  es: {
    titulo: "Skills — 30 Capacidades",
    html: `
      <h1>Skills — 30 Capacidades Reutilizables</h1>
      <p class="lead">30 capacidades encapsuladas que los comandos invocan internamente. Una skill puede ser usada por múltiples comandos.</p>

      <h2>Diferencia: Comando vs Skill</h2>
      <table>
        <thead><tr><th>Aspecto</th><th>Comando</th><th>Skill</th></tr></thead>
        <tbody>
          <tr><td>Quién lo invoca</td><td>El usuario directamente</td><td>Los comandos internamente</td></tr>
          <tr><td>Propósito</td><td>Etapa completa del pipeline</td><td>Tarea específica reutilizable</td></tr>
          <tr><td>Ejemplo</td><td><code>/sdd.implementar</code></td><td><code>validacion-spec</code></td></tr>
        </tbody>
      </table>

      <h2>Pipeline y Orquestación (5 skills)</h2>
      <table>
        <thead><tr><th>Skill</th><th>Propósito</th><th>Usada por</th></tr></thead>
        <tbody>
          <tr><td><code>enrutador-agentes</code></td><td>Decide qué agente ejecuta según complejidad</td><td>/sdd.planificar, /sdd.implementar</td></tr>
          <tr><td><code>gestion-estado</code></td><td>Lee y actualiza pipeline_state.json</td><td>Todos los comandos</td></tr>
          <tr><td><code>orquestacion-ptc</code></td><td>Plan-then-code antes de implementar</td><td>/sdd.implementar</td></tr>
          <tr><td><code>effort-router</code></td><td>Clasifica complejidad y elige modelo óptimo</td><td>/sdd.interpretar, /sdd.especificar</td></tr>
          <tr><td><code>token-budget</code></td><td>Asigna presupuesto de tokens por agente</td><td>/sdd.implementar, /sdd.verificar</td></tr>
        </tbody>
      </table>

      <h2>Descubrimiento e Interpretación (4 skills)</h2>
      <table>
        <thead><tr><th>Skill</th><th>Propósito</th></tr></thead>
        <tbody>
          <tr><td><code>descubrir-idea</code></td><td>Hace 5 preguntas clave para clarificar idea inicial</td></tr>
          <tr><td><code>interpretar-idea</code></td><td>Convierte descripción libre en IR con confidence score</td></tr>
          <tr><td><code>deteccion-stack</code></td><td>Detecta tecnologías del proyecto (package.json, configs)</td></tr>
          <tr><td><code>mejorar-prompt</code></td><td>Reformula requisito ambiguo en descripción precisa</td></tr>
        </tbody>
      </table>

      <h2>Diseño (3 skills)</h2>
      <table>
        <thead><tr><th>Skill</th><th>Propósito</th></tr></thead>
        <tbody>
          <tr><td><code>elegir-direccion</code></td><td>Presenta 3-5 opciones visuales al usuario</td></tr>
          <tr><td><code>wireframe-mvp</code></td><td>Genera wireframe HTML de la pantalla P0</td></tr>
          <tr><td><code>critica-diseno</code></td><td>Evalúa diseño contra usabilidad y accesibilidad</td></tr>
        </tbody>
      </table>

      <h2>Calidad y Validación (4 skills)</h2>
      <table>
        <thead><tr><th>Skill</th><th>Propósito</th></tr></thead>
        <tbody>
          <tr><td><code>validacion-spec</code></td><td>Verifica campos requeridos y criterios de aceptación</td></tr>
          <tr><td><code>constitucion-constraint</code></td><td>Valida que spec/código no violan la constitución</td></tr>
          <tr><td><code>verificador-implementacion</code></td><td>Compara código vs spec para detectar divergencias</td></tr>
          <tr><td><code>mutation-detector</code></td><td>Detecta archivos modificados sin pasar por spec</td></tr>
        </tbody>
      </table>

      <h2>Memoria e Indexación (5 skills)</h2>
      <table>
        <thead><tr><th>Skill</th><th>Propósito</th></tr></thead>
        <tbody>
          <tr><td><code>memory-compactor</code></td><td>Comprime y deduplica archivos de memoria de agentes</td></tr>
          <tr><td><code>adr-indexer</code></td><td>Indexa Architecture Decision Records</td></tr>
          <tr><td><code>indexador</code></td><td>Crea índice de funciones y módulos del proyecto</td></tr>
          <tr><td><code>indexar-proyecto</code></td><td>Escanea src/ y genera mapa de dependencias</td></tr>
          <tr><td><code>cache-audit</code></td><td>Verifica coherencia del caché vs código actual</td></tr>
        </tbody>
      </table>

      <h2>Observabilidad (3 skills)</h2>
      <table>
        <thead><tr><th>Skill</th><th>Propósito</th></tr></thead>
        <tbody>
          <tr><td><code>observabilidad-consumo</code></td><td>Analiza consumo.jsonl y genera reporte por agente</td></tr>
          <tr><td><code>share-progress</code></td><td>Genera resumen compartible del pipeline actual</td></tr>
          <tr><td><code>explicame</code></td><td>Explica en lenguaje llano qué hizo FORGE en la sesión</td></tr>
        </tbody>
      </table>

      <h2>Compresión (2 skills)</h2>
      <table>
        <thead><tr><th>Skill</th><th>Niveles</th></tr></thead>
        <tbody>
          <tr><td><code>compresion-tokens</code></td><td>Lite (15-20%), Estándar (30-40%), Full/Caveman (60-70%)</td></tr>
          <tr><td><code>modo-guiado</code></td><td>Activa/desactiva lenguaje simplificado para no-técnicos</td></tr>
        </tbody>
      </table>

      <h2>Despliegue e Integración (3 skills)</h2>
      <table>
        <thead><tr><th>Skill</th><th>Propósito</th></tr></thead>
        <tbody>
          <tr><td><code>deploy-vercel</code></td><td>Configura y ejecuta despliegue a Vercel</td></tr>
          <tr><td><code>vercel-deploy</code></td><td>Wrapper de CLI de Vercel con manejo de errores</td></tr>
          <tr><td><code>github-connect</code></td><td>Conecta proyecto con repositorio GitHub</td></tr>
        </tbody>
      </table>

      <h2>Crear una skill personalizada</h2>
      <pre><code>mkdir skills/mi-skill

cat > skills/mi-skill/SKILL.md &lt;&lt; 'EOF'
---
name: mi-skill
description: Qué hace esta skill
---
[instrucciones para Claude]
EOF</code></pre>
    `
  },
  en: {
    titulo: "Skills — 30 Capabilities",
    html: `
      <h1>Skills — 30 Reusable Capabilities</h1>
      <p class="lead">30 encapsulated capabilities invoked internally by commands across 7 categories: Pipeline (5), Discovery (4), Design (3), Quality (4), Memory (5), Observability (3), Compression (2), Deploy (3).</p>
      <h2>Create a custom skill</h2>
      <pre><code>mkdir skills/my-skill
# Add SKILL.md with instructions for Claude</code></pre>
    `
  }
},

/* ── ARQUITECTURA ──────────────────────────────────────── */

"arquitectura-capas": {
  seccion: "technical",
  es: {
    titulo: "Arquitectura — Capas L0-L5",
    html: `
      <h1>Arquitectura de FORGE — Capas L0 a L5</h1>
      <p class="lead">FORGE opera en 6 capas de abstracción, desde el modelo de lenguaje (L0) hasta la interfaz del usuario (L5). Cada capa tiene responsabilidades bien definidas y no puede violar las restricciones de la capa superior.</p>

      <h2>Vista de capas</h2>
      <pre><code>L5 ┌──────────────────────────────────────────┐
   │  Usuario / Claude Code CLI / IDE        │
L4 ├──────────────────────────────────────────┤
   │  Comandos SDD (39)  /sdd.interpretar…   │
L3 ├──────────────────────────────────────────┤
   │  Agentes especializados (14)             │
   │  arquitecto · crítico · backend …       │
L2 ├──────────────────────────────────────────┤
   │  Skills reutilizables (30)              │
   │  validacion-spec · memory-compactor…    │
L1 ├──────────────────────────────────────────┤
   │  Hooks de runtime (3)                   │
   │  pre-tool-guard · agent-memory …        │
L0 ├──────────────────────────────────────────┤
   │  Modelo de lenguaje (Opus/Sonnet/Haiku) │
   └──────────────────────────────────────────┘</code></pre>

      <h2>L0 — Modelo de lenguaje</h2>
      <p>Los modelos de Anthropic ejecutan el razonamiento. FORGE asigna modelo por agente:</p>
      <table>
        <thead><tr><th>Modelo</th><th>Velocidad</th><th>Costo rel.</th><th>Agentes asignados</th></tr></thead>
        <tbody>
          <tr><td>Claude Opus</td><td>60-150s</td><td>Alto</td><td>arquitecto, seguridad, backend, data, devops, descubridor</td></tr>
          <tr><td>Claude Sonnet</td><td>20-60s</td><td>Medio</td><td>crítico, revisor, designer, frontend, testing, interpretador, documentador</td></tr>
          <tr><td>Claude Haiku</td><td>5-15s</td><td>Bajo</td><td>asesor (consultas rápidas)</td></tr>
        </tbody>
      </table>
      <p><strong>Routing dinámico:</strong> si <code>estimated_complexity: "media"</code> en el IR, el enrutador usa Sonnet en lugar de Opus — ahorro ~40%.</p>

      <h2>L1 — Hooks de runtime (3)</h2>
      <table>
        <thead><tr><th>Hook</th><th>Trigger</th><th>Propósito</th></tr></thead>
        <tbody>
          <tr>
            <td><code>pre-tool-guard.js</code></td>
            <td>PreToolUse (toda herramienta)</td>
            <td>Bloquea herramientas prohibidas por rol. El backend no puede usar deploy tools.</td>
          </tr>
          <tr>
            <td><code>agent-memory.js</code></td>
            <td>PostToolUse (Write, Edit)</td>
            <td>Registra cada escritura en memoria del agente + ledger consumo.jsonl</td>
          </tr>
          <tr>
            <td><code>post-write-conventions.js</code></td>
            <td>PostToolUse (Write)</td>
            <td>Aplica convenciones del proyecto (nombres de archivos, formato de imports)</td>
          </tr>
        </tbody>
      </table>

      <h2>L2 — Skills (30)</h2>
      <p>Capacidades reutilizables en <code>skills/{nombre}/SKILL.md</code>. Los agentes las invocan describiendo qué quieren hacer y FORGE selecciona la skill adecuada.</p>

      <h2>L3 — Agentes (14)</h2>
      <p>Definidos en <code>agents/{nombre}.md</code> con frontmatter de restricciones:</p>
      <pre><code>---
name: desarrollador-backend
model: claude-opus-4-8
tools: [Read, Write, Edit, Glob, Grep, Bash]
disallowed_tools: [WebFetch, WebSearch]
description: "Especialista Backend. Solo TypeScript/Node.js."
---
[prompt de especialidad]</code></pre>

      <h2>L4 — Comandos SDD (39)</h2>
      <p>Definidos en <code>commands/sdd.*.md</code>. Cada comando especifica: agentes que invoca, skills que usa, artefactos que produce, y cómo actualiza el estado del pipeline.</p>

      <h2>Flujo de datos entre capas</h2>
      <pre><code>Usuario → /sdd.implementar backend        (L4 comando)
  ↓
enrutador-agentes                          (L2 skill)
  ↓ elige desarrollador-backend
desarrollador-backend activado             (L3 agente)
  ↓
pre-tool-guard verifica permiso de Write  (L1 hook)
  ↓
Escribe src/api/users.ts                  (L0 Claude)
  ↓
agent-memory registra la escritura        (L1 hook PostToolUse)
  ↓
gestion-estado: pipeline_step→"implemented" (L2 skill)</code></pre>

      <h2>Máquina de estados (11 estados)</h2>
      <table>
        <thead><tr><th>Estado</th><th>Significado</th><th>Comando que lo activa</th></tr></thead>
        <tbody>
          <tr><td><code>idle</code></td><td>Sin pipeline activo</td><td>—</td></tr>
          <tr><td><code>discovery</code></td><td>Descubrimiento en curso</td><td>/sdd.descubrir</td></tr>
          <tr><td><code>interpreted</code></td><td>IR generado</td><td>/sdd.interpretar</td></tr>
          <tr><td><code>designed</code></td><td>Diseño completado</td><td>/sdd.diseñar</td></tr>
          <tr><td><code>specified</code></td><td>Spec generada</td><td>/sdd.especificar</td></tr>
          <tr><td><code>planned</code></td><td>Plan generado</td><td>/sdd.planificar</td></tr>
          <tr><td><code>tasked</code></td><td>Tareas distribuidas</td><td>/sdd.tareas</td></tr>
          <tr><td><code>implementing</code></td><td>Implementación en curso</td><td>/sdd.implementar</td></tr>
          <tr><td><code>implemented</code></td><td>Código completo</td><td>/sdd.implementar (fin)</td></tr>
          <tr><td><code>verified</code></td><td>Tests pasando</td><td>/sdd.verificar</td></tr>
          <tr><td><code>deployed</code></td><td>En producción</td><td>/sdd.desplegar</td></tr>
        </tbody>
      </table>
    `
  },
  en: {
    titulo: "Architecture — Layers L0-L5",
    html: `
      <h1>FORGE Architecture — Layers L0 to L5</h1>
      <p class="lead">FORGE operates in 6 abstraction layers from the language model (L0) to the user interface (L5). Each layer has well-defined responsibilities.</p>
      <pre><code>L5: User / Claude Code CLI
L4: SDD Commands (39)
L3: Specialized Agents (14)
L2: Reusable Skills (30)
L1: Runtime Hooks (3)
L0: Language Model (Opus/Sonnet/Haiku)</code></pre>
      <h2>11 pipeline states</h2>
      <p>idle → discovery → interpreted → designed → specified → planned → tasked → implementing → implemented → verified → deployed</p>
    `
  }
},

/* ── MEMORIA ──────────────────────────────────────────── */

"memoria-persistente": {
  seccion: "technical",
  es: {
    titulo: "Memoria Persistente",
    html: `
      <h1>Memoria Persistente</h1>
      <p class="lead">Claude Code no mantiene contexto entre sesiones. FORGE resuelve esto: cada agente guarda sus decisiones en <code>.sdd/memoria/</code> y las recupera automáticamente en la siguiente sesión.</p>

      <h2>Cómo funciona</h2>
      <pre><code>Sesión 1:
  Arquitecto decide: JWT con RS256 por multi-tenancy
  → agent-memory.js escribe en .sdd/memoria/agente-arquitecto.md:
    "## 2026-06-15 — auth/spec.md
     > Decisión: RS256, no HS256 (razón: multi-tenant)"

Sesión 2 (días después):
  Arquitecto inicia nueva sesión
  → Lee .sdd/memoria/agente-arquitecto.md
  → Recuerda: RS256, multi-tenant, sin secrets compartidos
  → El usuario no necesita repetir nada</code></pre>

      <h2>Estructura .sdd/memoria/</h2>
      <pre><code>.sdd/memoria/
├── agente-arquitecto.md       (decisiones del arquitecto)
├── agente-critico.md          (hallazgos del crítico)
├── agente-backend.md          (implementaciones backend)
├── agente-frontend.md         (componentes frontend)
├── agente-testing.md          (estrategia de tests)
├── agente-devops.md           (configuración infra)
├── agente-data.md             (esquemas y queries)
├── constitucion.md            (principios del proyecto — restricción dura)
└── memory.db                  (SQLite — solo Node ≥22.5)</code></pre>

      <h2>Markdown vs SQLite</h2>
      <table>
        <thead><tr><th>Aspecto</th><th>Markdown</th><th>SQLite</th></tr></thead>
        <tbody>
          <tr><td>Disponibilidad</td><td>Node ≥16 (todos)</td><td>Node ≥22.5 únicamente</td></tr>
          <tr><td>Velocidad búsqueda</td><td>Lineal</td><td>O(log n) con índices</td></tr>
          <tr><td>Edición manual</td><td>Fácil (texto plano)</td><td>Requiere cliente SQLite</td></tr>
          <tr><td>Compresión automática</td><td>Manual o con /sdd.optimizar</td><td>Automática siempre</td></tr>
          <tr><td>Tamaño típico</td><td>~2-5MB por proyecto</td><td>~500KB por proyecto</td></tr>
          <tr><td>Activación</td><td>Default</td><td>Auto-detectado en Node ≥22.5</td></tr>
        </tbody>
      </table>

      <h2>Verificar backend activo</h2>
      <pre><code>/sdd.estado
# Backend memoria: SQLite (Node 22.8.0)
# Tamaño total: 487KB | Agentes con memoria: 7/14</code></pre>

      <h2>Comprimir memoria</h2>
      <p>Al superar 80 entradas o 50KB el hook emite alerta y recomienda comprimir:</p>
      <pre><code>/sdd.optimizar memoria
# → Reducido de 52KB a 18KB (65% ahorro)</code></pre>

      <h2>Constitución del proyecto</h2>
      <p>El archivo <code>.sdd/memoria/constitucion.md</code> es una <strong>restricción dura</strong>: ningún agente puede violar sus principios.</p>
      <pre><code>/sdd.constitucion    # crear o editar

# Ejemplo:
## Principios técnicos
- Sin ORMs: solo driver nativo PostgreSQL
- TypeScript strict mode, sin any
- Tests obligatorios para toda función no trivial</code></pre>
    `
  },
  en: {
    titulo: "Persistent Memory",
    html: `
      <h1>Persistent Memory</h1>
      <p class="lead">FORGE solves Claude Code's lack of cross-session memory. Each agent saves decisions in <code>.sdd/memoria/</code> and retrieves them automatically next session.</p>
      <h2>Markdown vs SQLite</h2>
      <table>
        <thead><tr><th>Aspect</th><th>Markdown</th><th>SQLite</th></tr></thead>
        <tbody>
          <tr><td>Availability</td><td>Node ≥16 (all)</td><td>Node ≥22.5 only</td></tr>
          <tr><td>Auto-compression</td><td>Manual</td><td>Always automatic</td></tr>
          <tr><td>Size</td><td>~2-5MB</td><td>~500KB</td></tr>
        </tbody>
      </table>
    `
  }
},

/* ── TOKENS ───────────────────────────────────────────── */

"tokens-optimizacion": {
  seccion: "technical",
  es: {
    titulo: "Optimización de Tokens",
    html: `
      <h1>Optimización de Tokens</h1>
      <p class="lead">FORGE reduce el consumo de tokens entre 40% y 70% mediante 5 técnicas automáticas.</p>

      <h2>1. Routing dinámico por complejidad</h2>
      <table>
        <thead><tr><th>Complejidad (IR)</th><th>Modelo elegido</th><th>Ahorro vs Opus</th></tr></thead>
        <tbody>
          <tr><td>Alta</td><td>Opus</td><td>— (referencia)</td></tr>
          <tr><td>Media</td><td>Sonnet</td><td>~40%</td></tr>
          <tr><td>Baja</td><td>Haiku</td><td>~85%</td></tr>
        </tbody>
      </table>

      <h2>2. Memoria comprimida entre sesiones</h2>
      <table>
        <thead><tr><th>Escenario (5 sesiones)</th><th>Tokens</th></tr></thead>
        <tbody>
          <tr><td>Sin FORGE (repite contexto)</td><td>~50,000</td></tr>
          <tr><td>Con memoria sin comprimir</td><td>~20,000</td></tr>
          <tr><td>Con memoria comprimida</td><td>~8,000 (84% ahorro)</td></tr>
        </tbody>
      </table>

      <h2>3. Token budget por agente</h2>
      <pre><code># Budgets por defecto (sdd.config.yaml):
arquitecto:   200,000 tokens
backend:      150,000 tokens
frontend:     130,000 tokens
testing:      100,000 tokens
asesor:        50,000 tokens</code></pre>

      <h2>4. Compresión de artefactos (3 niveles)</h2>
      <table>
        <thead><tr><th>Nivel</th><th>Técnica</th><th>Ahorro</th></tr></thead>
        <tbody>
          <tr><td>Lite</td><td>Elimina ejemplos redundantes</td><td>15-20%</td></tr>
          <tr><td>Estándar</td><td>Lite + colapsa secciones similares</td><td>30-40%</td></tr>
          <tr><td>Full (Caveman)</td><td>Solo hechos clave, sin elaboración</td><td>60-70%</td></tr>
        </tbody>
      </table>
      <pre><code>/sdd.optimizar           # nivel Estándar (recomendado)
/sdd.optimizar full      # antes de sesiones largas</code></pre>

      <h2>5. Carga selectiva de contexto</h2>
      <p>Cada comando carga solo los artefactos necesarios para su etapa:</p>
      <pre><code>/sdd.implementar backend carga:
  ✓ spec.md, constitucion.md, agente-arquitecto.md
  ✗ NO carga: wireframes, planes de otras fases, diseño

Ahorro: ~30% de tokens de contexto por sesión</code></pre>

      <h2>Observabilidad del consumo</h2>
      <pre><code>/sdd.estado consumo

# ┌──────────────────┬────────────┬───────────────┐
# │ Agente           │ Escrituras │ Bytes totales │
# ├──────────────────┼────────────┼───────────────┤
# │ arquitecto       │     12     │    45,821     │
# │ desarrollador-b… │     28     │   127,440     │
# │ tester           │      9     │    34,200     │
# └──────────────────┴────────────┴───────────────┘
# ⚠ Fan-out detectado: arquitecto invocado 12 veces
#   → Considera comprimir memoria de arquitecto</code></pre>

      <h2>Checklist de optimización</h2>
      <pre><code>[ ] Ejecutar /sdd.optimizar memoria cada 10 sesiones
[ ] Verificar routing activo con /sdd.estado
[ ] Usar /sdd.implementar backend (no genérico)
[ ] Comprimir artefactos antes de sesiones complejas
[ ] Usar asesor (Haiku) para consultas, no arquitecto (Opus)

Ahorro potencial: 50-70%</code></pre>
    `
  },
  en: {
    titulo: "Token Optimization",
    html: `
      <h1>Token Optimization</h1>
      <p class="lead">FORGE reduces token consumption 40-70% through 5 automatic techniques: dynamic routing, compressed memory, per-agent budgets, artifact compression, and selective context loading.</p>
      <h2>Quick savings reference</h2>
      <table>
        <thead><tr><th>Technique</th><th>Typical savings</th></tr></thead>
        <tbody>
          <tr><td>Sonnet routing (medium complexity)</td><td>~40% vs Opus</td></tr>
          <tr><td>Compressed memory (5 sessions)</td><td>~84% vs no FORGE</td></tr>
          <tr><td>Standard compression</td><td>30-40% per artifact</td></tr>
          <tr><td>Selective context loading</td><td>~30% per session</td></tr>
        </tbody>
      </table>
    `
  }
},

/* ── CASO DE USO ──────────────────────────────────────── */

"caso-api-rest": {
  seccion: "operate",
  es: {
    titulo: "Caso: API REST con JWT",
    html: `
      <h1>Caso de uso: API REST con autenticación JWT</h1>
      <p class="lead">Flujo completo de FORGE para construir una API REST con Node.js, PostgreSQL y JWT. De idea a producción en ~90 minutos.</p>

      <h2>Contexto del proyecto</h2>
      <table>
        <tr><td><strong>Idea</strong></td><td>API REST para agenda de contactos con cuentas de usuario</td></tr>
        <tr><td><strong>Stack</strong></td><td>Node.js + TypeScript, PostgreSQL nativo, JWT RS256</td></tr>
        <tr><td><strong>Perfil</strong></td><td>experto</td></tr>
        <tr><td><strong>Tiempo estimado</strong></td><td>~90 minutos</td></tr>
      </table>

      <h2>Paso 1 — Inicializar</h2>
      <pre><code>npx sdd-es init
/sdd.constitucion</code></pre>
      <p>Constitución resultante:</p>
      <pre><code># .sdd/memoria/constitucion.md
- Sin ORMs: driver nativo pg
- TypeScript strict mode, sin any
- Errores como valores: Result type
- Tests obligatorios</code></pre>

      <h2>Paso 2 — Interpretar la idea</h2>
      <pre><code>/sdd.interpretar "API REST agenda de contactos con JWT"</code></pre>
      <p>Produce <code>.sdd/ir.json</code>:</p>
      <pre><code class="lang-json">{
  "product": { "name": "Agenda Contactos", "estimated_complexity": "media" },
  "features": { "core": ["registro", "login JWT", "CRUD contactos", "búsqueda", "paginación cursor"] },
  "constraints": { "tech": "TypeScript, PostgreSQL, sin ORM", "auth": "JWT" },
  "routing": "sonnet"
}</code></pre>
      <p>Complejidad media → Sonnet activo (ahorro ~40%)</p>

      <h2>Paso 3 — Especificar</h2>
      <pre><code>/sdd.especificar</code></pre>
      <p>Spec con criterios de aceptación por endpoint:</p>
      <pre><code>## POST /auth/register
Dado email + password válidos
→ Usuario creado con bcrypt, JWT devuelto (exp 7d), status 201

## GET /contacts?cursor=&lt;id&gt;&limit=20
Dado JWT válido
→ Solo contactos del usuario, paginación cursor (no offset)</code></pre>

      <h2>Paso 4 — Implementar</h2>
      <pre><code>/sdd.planificar
/sdd.implementar data      # Schema PostgreSQL + migrations
/sdd.implementar backend   # API REST completa</code></pre>

      <p>Data genera migrations:</p>
      <pre><code class="lang-sql">CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL
);
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, email TEXT, phone TEXT
);
CREATE INDEX idx_contacts_user_name ON contacts(user_id, name);</code></pre>

      <p>Backend genera:</p>
      <pre><code>src/
├── api/auth.ts       (register, login, refresh)
├── api/contacts.ts   (CRUD + search + cursor pagination)
├── middleware/auth.ts (JWT verification)
└── db/pool.ts        (pg Pool)</code></pre>

      <h2>Paso 5 — Verificar y desplegar</h2>
      <pre><code>/sdd.verificar           # 42 tests, 92% cobertura
/sdd.verificar seguridad # 0 findings críticos
/sdd.desplegar vercel    # URL de producción</code></pre>

      <h2>Resultado</h2>
      <table>
        <tr><td><strong>Tiempo</strong></td><td>~87 minutos</td></tr>
        <tr><td><strong>Archivos</strong></td><td>18 archivos (código + tests + docs + infra)</td></tr>
        <tr><td><strong>Tests</strong></td><td>42 tests, 92% cobertura</td></tr>
        <tr><td><strong>Seguridad</strong></td><td>0 hallazgos críticos</td></tr>
        <tr><td><strong>Tokens</strong></td><td>~85,000 (Sonnet routing)</td></tr>
        <tr><td><strong>Sin FORGE</strong></td><td>~4-6 horas, sin tests sistemáticos</td></tr>
      </table>
    `
  },
  en: {
    titulo: "Case: REST API with JWT",
    html: `
      <h1>Use case: REST API with JWT authentication</h1>
      <p class="lead">Complete FORGE workflow from idea to production in ~90 minutes. Node.js + TypeScript, PostgreSQL, JWT RS256.</p>
      <h2>Commands</h2>
      <pre><code>npx sdd-es init
/sdd.constitucion
/sdd.interpretar "REST API for contacts with JWT"
/sdd.especificar
/sdd.planificar
/sdd.implementar data
/sdd.implementar backend
/sdd.verificar
/sdd.desplegar vercel</code></pre>
      <h2>Result</h2>
      <p>18 files, 42 tests, 92% coverage, 0 critical security findings, ~87 minutes total.</p>
    `
  }
},

/* ── CONFIGURACIÓN ────────────────────────────────────── */

"configuracion-detallada": {
  seccion: "operate",
  es: {
    titulo: "Configuración — sdd.config.yaml",
    html: `
      <h1>Configuración — sdd.config.yaml</h1>
      <p class="lead">FORGE se configura mediante <code>.sdd/sdd.config.yaml</code>. Controla perfil, modelos, rutas, calidad, memoria y compresión.</p>

      <h2>Archivo completo con todos los valores</h2>
      <pre><code class="lang-yaml"># .sdd/sdd.config.yaml

idioma: "español"        # español | english
perfil: "guiado"         # guiado | experto

agentes:
  arquitecto:            { modelo: "claude-opus-4-8" }
  critico:               { modelo: "claude-opus-4-8" }
  revisor:               { modelo: "claude-opus-4-8" }
  seguridad:             { modelo: "claude-opus-4-8" }
  product-designer:      { modelo: "claude-opus-4-8" }
  disenador-api:         { modelo: "claude-sonnet-4-6" }
  desarrollador-backend: { modelo: "claude-sonnet-4-6" }
  desarrollador-frontend:{ modelo: "claude-sonnet-4-6" }
  tester:                { modelo: "claude-sonnet-4-6" }
  operaciones:           { modelo: "claude-sonnet-4-6" }
  asesor-datos:          { modelo: "claude-opus-4-8" }
  asesor:                { modelo: "claude-haiku-4-5-20251001" }
  investigador:          { modelo: "claude-sonnet-4-6" }
  documentador:          { modelo: "claude-sonnet-4-6" }

rutas:
  ir:               ".sdd/ir.json"
  especificaciones: ".sdd/especificaciones"
  planes:           ".sdd/planes"
  memoria:          ".sdd/memoria"
  observabilidad:   ".sdd/observabilidad"

comportamiento:
  mostrar_razonamiento: false
  pausa_entre_etapas: true
  max_reintentos: 3

calidad:
  cobertura_minima: 80
  confidence_minimo: 0.7
  max_complejidad_ciclomatica: 10

protecciones:
  archivos_protegidos:
    - ".sdd/memoria/constitucion.md"
    - ".claude/settings.json"

memoria:
  backend: "auto"             # auto | markdown | sqlite
  comprimir_al_superar_kb: 50
  backup_antes_comprimir: true

compresion:
  nivel_default: "estandar"   # lite | estandar | full
  auto_comprimir: false</code></pre>

      <h2>Perfiles predefinidos</h2>
      <table>
        <thead><tr><th>Perfil</th><th>Interrupciones</th><th>Modelos</th><th>Ideal para</th></tr></thead>
        <tbody>
          <tr><td><strong>guiado</strong></td><td>Altas (aprueba cada etapa)</td><td>Sonnet mayoría, Opus arquitectura</td><td>Primeros proyectos, no-técnicos</td></tr>
          <tr><td><strong>experto</strong></td><td>Bajas (flujo continuo)</td><td>Routing dinámico</td><td>Developers experimentados</td></tr>
        </tbody>
      </table>
      <pre><code>/sdd.configurar perfil experto</code></pre>

      <h2>Modelos disponibles</h2>
      <table>
        <thead><tr><th>Model ID</th><th>Mejor para</th><th>Costo relativo</th></tr></thead>
        <tbody>
          <tr><td>claude-opus-4-8</td><td>Arquitectura, seguridad, decisiones críticas</td><td>Alto</td></tr>
          <tr><td>claude-sonnet-4-6</td><td>Implementación, tests, documentación</td><td>Medio</td></tr>
          <tr><td>claude-haiku-4-5-20251001</td><td>Consultas rápidas, clarificaciones</td><td>Bajo</td></tr>
        </tbody>
      </table>

      <h2>Variables de entorno</h2>
      <table>
        <thead><tr><th>Variable</th><th>Propósito</th><th>Requerida</th></tr></thead>
        <tbody>
          <tr><td><code>ANTHROPIC_API_KEY</code></td><td>API key de Anthropic (vía Claude Code)</td><td>Sí</td></tr>
          <tr><td><code>FIGMA_TOKEN</code></td><td>Token de Figma</td><td>Solo si figma habilitado</td></tr>
          <tr><td><code>SDD_PROFILE</code></td><td>Override de perfil</td><td>No</td></tr>
          <tr><td><code>SDD_LANG</code></td><td>Override de idioma</td><td>No</td></tr>
        </tbody>
      </table>
    `
  },
  en: {
    titulo: "Configuration — sdd.config.yaml",
    html: `
      <h1>Configuration — sdd.config.yaml</h1>
      <p class="lead">FORGE is configured through <code>.sdd/sdd.config.yaml</code>.</p>
      <h2>Key options</h2>
      <table>
        <thead><tr><th>Option</th><th>Values</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td>perfil</td><td>guiado | experto</td><td>guiado</td></tr>
          <tr><td>memoria.backend</td><td>auto | markdown | sqlite</td><td>auto</td></tr>
          <tr><td>calidad.cobertura_minima</td><td>0-100</td><td>80</td></tr>
          <tr><td>compresion.nivel_default</td><td>lite | estandar | full</td><td>estandar</td></tr>
        </tbody>
      </table>
    `
  }
},

/* ── FAQ ──────────────────────────────────────────────── */

"faq": {
  seccion: "operate",
  es: {
    titulo: "Preguntas frecuentes",
    html: `
      <h1>Preguntas Frecuentes</h1>

      <h2>¿Cuándo usar FORGE vs Claude Code solo?</h2>
      <p><strong>Usa FORGE si:</strong> proyecto &gt;500 líneas, múltiples sesiones, necesitas tests/docs/deploy coordinados, auditabilidad.</p>
      <p><strong>Claude Code solo:</strong> scripts &lt;100 líneas de una sola sesión sin auditabilidad.</p>

      <h2>¿Por qué 14 agentes si solo hay un modelo?</h2>
      <p>Los agentes son <strong>roles con restricciones distintas</strong>, no modelos distintos. El mismo Sonnet actúa como Crítico (busca problemas, nunca propone) o como Backend (escribe código, nunca deploya). Las restricciones por rol mejoran la calidad ~40%.</p>

      <h2>¿Cómo comprimo el contexto automáticamente?</h2>
      <pre><code>/sdd.optimizar           # nivel estándar
/sdd.optimizar memoria   # solo archivos de agentes
/sdd.optimizar full      # máxima compresión</code></pre>

      <h2>¿Puedo usar Sonnet en lugar de Opus para el arquitecto?</h2>
      <pre><code class="lang-yaml">agentes:
  arquitecto: { modelo: "claude-sonnet-4-6" }</code></pre>
      <p>Tradeoff: ~30% menos calidad en decisiones arquitectónicas, ~40% menos costo.</p>

      <h2>¿Qué pasa si me quedo sin tokens?</h2>
      <pre><code>⚠ Token budget de desarrollador-backend agotado
  Estado guardado en .sdd/pipeline_state.json
  → /sdd.optimizar para liberar tokens y continuar
  → O iniciar nueva sesión: el estado se recupera automáticamente</code></pre>

      <h2>¿Funciona con Python, Go o Rust?</h2>
      <p>Parcialmente. El pipeline SDD es universal. Los agentes Backend/Frontend/Testing tienen prompts optimizados para TypeScript/Node.js. Para otros lenguajes puedes usar hasta <code>/sdd.especificar</code> e implementar manualmente, o personalizar los prompts de los agentes.</p>

      <h2>¿Cómo debuggeo si un agente no hace lo esperado?</h2>
      <pre><code>/sdd.debug
/sdd.debug arquitecto    # diagnóstico de agente específico
cat .sdd/memoria/agente-arquitecto.md  # qué "recuerda"
cat .sdd/observabilidad/consumo.jsonl  # actividad registrada</code></pre>

      <h2>¿FORGE funciona offline?</h2>
      <p>No. Requiere conexión a servidores Anthropic. Los artefactos <code>.sdd/</code> se guardan localmente, pero la ejecución de agentes requiere conectividad.</p>

      <h2>¿Cuánto espacio usa .sdd/?</h2>
      <p>Entre 5MB y 30MB por proyecto activo típico. Limpia sesiones antiguas:</p>
      <pre><code>ls -lh .sdd/memoria/
rm .sdd/memoria/agente-*.md.original   # backups de compresión</code></pre>

      <h2>¿Qué versión de Node.js necesito?</h2>
      <ul>
        <li>Node ≥16: FORGE completo con backend Markdown</li>
        <li>Node ≥22.5: SQLite automático (más rápido, menos espacio)</li>
      </ul>

      <h2>¿Por qué el IR tiene confidence &lt;0.7?</h2>
      <p>La descripción fue ambigua. FORGE sugiere <code>/sdd.aclarar</code>. Puedes ignorarlo con <code>/sdd.diseñar forzar</code> (puede producir spec con gaps).</p>

      <h2>¿Los hooks ralentizan a Claude Code?</h2>
      <p>Minimamente. pre-tool-guard: ~5ms, agent-memory: ~15ms. Impacto &lt;1%.</p>

      <h2>¿Puedo contribuir con agentes o skills?</h2>
      <p>Sí. Lee la sección <a href="#extensibilidad">Extensibilidad</a>. Contribuciones vía PR son bienvenidas.</p>
    `
  },
  en: {
    titulo: "Frequently Asked Questions",
    html: `
      <h1>Frequently Asked Questions</h1>

      <h2>When to use FORGE vs Claude Code alone?</h2>
      <p>Use FORGE for: &gt;500 lines, multiple sessions, coordinated tests/docs/deploy. Claude Code alone for: single-session scripts &lt;100 lines.</p>

      <h2>Why 14 agents if there's only one model?</h2>
      <p>Agents are roles with different constraints. The same Sonnet acts as Critic (finds problems only) or Backend (writes code only). Role constraints improve quality ~40%.</p>

      <h2>Does FORGE work offline?</h2>
      <p>No. Requires Anthropic server connection. Artifacts are stored locally.</p>

      <h2>What Node.js version do I need?</h2>
      <ul>
        <li>Node ≥16: Full FORGE with Markdown backend</li>
        <li>Node ≥22.5: Automatic SQLite (faster, smaller)</li>
      </ul>
    `
  }
},

/* ── TROUBLESHOOTING ──────────────────────────────────── */

"troubleshooting": {
  seccion: "operate",
  es: {
    titulo: "Resolución de problemas",
    html: `
      <h1>Resolución de Problemas</h1>
      <p class="lead">Errores reales con causa y solución. Ordenados por frecuencia.</p>

      <h2>Instalación</h2>

      <h3>Cannot find module 'sdd-es'</h3>
      <pre><code>npx sdd-es init        # sin instalación global
npm install -g sdd-es  # o global</code></pre>

      <h3>init no copia archivos</h3>
      <pre><code>ls -la .sdd/ .claude/
rm -rf .sdd/
npx sdd-es init</code></pre>

      <h3>Hooks no se activan</h3>
      <pre><code>cat .claude/settings.json | grep -A5 "hooks"
ls -la claude-hooks/pre-tool-guard.js

# Linux/macOS: dar permisos
chmod +x claude-hooks/pre-tool-guard.js
chmod +x claude-hooks/agent-memory.js</code></pre>

      <h2>/sdd.interpretar</h2>

      <h3>IR validation failed: missing product.name</h3>
      <pre><code># Antes (vaga):
/sdd.interpretar "algo para gestionar cosas"

# Después (concreta):
/sdd.interpretar "app web para gestionar inventario de tienda pequeña"</code></pre>

      <h3>Features incorrectas en ir.json</h3>
      <pre><code>cat .sdd/ir.json         # ver IR actual
# Editar features.core manualmente
# O re-ejecutar con más detalle</code></pre>

      <h2>/sdd.implementar</h2>

      <h3>Backend genera código incorrecto</h3>
      <pre><code>cat .sdd/memoria/constitucion.md    # verificar que existe
cat .sdd/especificaciones/*/spec.md # verificar spec
/sdd.revisar                        # crítico valida código vs spec</code></pre>

      <h3>Token budget agotado</h3>
      <pre><code>/sdd.optimizar    # comprimir y liberar

# O aumentar en config:
# agentes:
#   desarrollador-backend: { token_budget: 200000 }</code></pre>

      <h2>/sdd.verificar</h2>

      <h3>Tests fallan por BD</h3>
      <pre><code>docker-compose up -d postgres
npm test</code></pre>

      <h3>Cobertura inferior al 80%</h3>
      <pre><code>/sdd.verificar --forzar    # ver reporte sin bloquear
# O ajustar mínimo en config:
# calidad:
#   cobertura_minima: 70</code></pre>

      <h2>Memoria y estado</h2>

      <h3>Memoria de agente creció demasiado</h3>
      <pre><code>ls -lh .sdd/memoria/
/sdd.optimizar memoria</code></pre>

      <h3>Pipeline en estado incorrecto</h3>
      <pre><code>cat .sdd/pipeline_state.json
# Editar pipeline_step manualmente si es necesario</code></pre>

      <h2>Diagnóstico general</h2>
      <pre><code>/sdd.debug
/sdd.estado
npx sdd-es doctor</code></pre>
    `
  },
  en: {
    titulo: "Troubleshooting",
    html: `
      <h1>Troubleshooting</h1>
      <p class="lead">Real FORGE errors with cause and solution.</p>

      <h2>Installation</h2>
      <pre><code>npx sdd-es init        # always works without global install
chmod +x claude-hooks/*.js  # fix hook permissions on Linux/macOS</code></pre>

      <h2>Pipeline issues</h2>
      <pre><code>/sdd.debug             # general diagnosis
/sdd.estado            # pipeline state + memory backend
npx sdd-es doctor      # installation check</code></pre>

      <h2>Token budget exhausted</h2>
      <pre><code>/sdd.optimizar         # compress and resume</code></pre>
    `
  }
}

}; // fin PAGES
