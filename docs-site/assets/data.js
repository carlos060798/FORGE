/* ============================================================
   Fragua Docs — datos v5.0.0-beta.1 (bilingüe ES/EN)
   Actualizado: 2026-11-10 — fase 0 del plan de documentación pública
   (docs/informes/PLAN-DOCUMENTACION-PUBLICA.md). Provisional: la
   fase 1 genera el sitio desde docs/ y elimina este archivo.
   ============================================================ */

const UI = {
  es: {
    brand_tag: "v5.0.0-beta.1",
    search_placeholder: "Buscar…",
    search_input_placeholder: "Buscar en la documentación…",
    search_navigate: "navegar",
    search_open: "abrir",
    search_close: "cerrar",
    footer_text: "Fragua (antes FORGE) v5.0.0-beta.1 · pre-beta · MIT License",
    search_no_results: "Sin resultados",
    groups: {
      overview: "◈ El framework",
      technical: "⬡ Arquitectura",
      operate: "▶ Operación",
      extend: "✦ Extensibilidad"
    }
  },
  en: {
    brand_tag: "v5.0.0-beta.1",
    search_placeholder: "Search…",
    search_input_placeholder: "Search the docs…",
    search_navigate: "navigate",
    search_open: "open",
    search_close: "close",
    footer_text: "Fragua (antes FORGE) v5.0.0-beta.1 · pre-beta · MIT License",
    search_no_results: "No results",
    groups: {
      overview: "◈ The framework",
      technical: "⬡ Architecture",
      operate: "▶ Operation",
      extend: "✦ Extensibility"
    }
  }
};

const GROUP_ORDER = ["overview", "technical", "operate", "extend"];

const PAGES = {
  "vision-general": {
    seccion: "overview",
    es: {
      titulo: "Visión General",
      html: `
      <h1>Visión General</h1>
      <p class="lead">Fragua (antes FORGE) es un framework de <strong>Desarrollo Guiado por Especificaciones (SDD)</strong> para Claude Code. Lleva una idea escrita en lenguaje natural hasta código probado, pasando por una especificación que <strong>una persona aprueba</strong> antes de que los agentes escriban nada.</p>

      <div class="callout warn">
        <p><strong>Pre-beta.</strong> La versión 5.0.0-beta.1 no está publicada en npm y la integración continua en Linux todavía no está en verde. El estado real, con cifras y fechas, está en <a href="https://github.com/carlos060798/FORGE/blob/main/docs/ESTADO-ACTUAL.md">ESTADO-ACTUAL.md</a>.</p>
      </div>

      <h2>Qué lo distingue</h2>
      <p>El veredicto sobre el código lo da el <strong>código de salida de las pruebas</strong>, ejecutadas en un contenedor Docker sin red, y no la opinión de un modelo. Un agente escribe pruebas que deben fallar, otro implementa sin poder tocarlas, y un tope de gasto detiene el ciclo. Ver <a href="#ciclo-verificado">Ciclo verificado</a>.</p>

      <h2>En números</h2>
      <table>
        <thead><tr><th>Pieza</th><th>Cantidad</th></tr></thead>
        <tbody>
          <tr><td>Agentes</td><td>14 agentes (el preset <code>lean</code> activa 6; el ciclo usa 3)</td></tr>
          <tr><td>Comandos</td><td>39 comandos <code>/sdd.*</code></td></tr>
          <tr><td>Skills</td><td>31 skills</td></tr>
          <tr><td>Dependencias de npm</td><td>3 (<code>@anthropic-ai/sdk</code>, <code>@sqlite.org/sqlite-wasm</code> y <code>acorn</code>)</td></tr>
          <tr><td>Lenguajes con ciclo verificado</td><td>JavaScript y TypeScript, Python, Go</td></tr>
        </tbody>
      </table>

      <h2>Para quién sí y para quién no</h2>
      <ul>
        <li><strong>Sí:</strong> quien programa o supervisa código y quiere un proceso con especificación, pruebas y trazabilidad.</li>
        <li><strong>No, todavía:</strong> quien espera «no-code». Necesitas Docker, una clave de API y leer los veredictos del ciclo.</li>
      </ul>

      <h2>Cómo se usa</h2>
      <p>Los comandos y los agentes son nativos de Claude Code. Otras herramientas (Cursor, Copilot, Gemini CLI y similares) reciben solo las skills. La CLI <code>fragua</code> (equivalente a <code>forge</code>) instala, diagnostica y verifica. Ver <a href="#instalacion">Instalación</a>.</p>

      <div class="callout tip">
        <p><strong>Siguiente paso:</strong> <a href="#instalacion">Instalación y primer uso</a>, o la guía de una página <a href="https://github.com/carlos060798/FORGE/blob/main/docs/PRIMEROS-15-MINUTOS.md">Primeros 15 minutos</a>.</p>
      </div>
    `
    },
    en: {
      titulo: "Overview",
      html: `
      <h1>Overview</h1>
      <p class="lead">Fragua (formerly FORGE) is a <strong>Spec-Driven Development (SDD)</strong> framework for Claude Code. It takes an idea written in natural language to tested code, through a specification that <strong>a person approves</strong> before any agent writes code.</p>

      <div class="callout warn">
        <p><strong>Pre-beta.</strong> Version 5.0.0-beta.1 is not published on npm and continuous integration on Linux is not green yet. The real status, with figures and dates, is in <a href="https://github.com/carlos060798/FORGE/blob/main/docs/ESTADO-ACTUAL.md">ESTADO-ACTUAL.md</a> (Spanish).</p>
      </div>

      <h2>What sets it apart</h2>
      <p>The verdict on the code is the <strong>exit code of the tests</strong>, run in a Docker container with no network, not a model's opinion. One agent writes tests that must fail, another implements without being able to touch them, and a spending cap stops the cycle. See <a href="#ciclo-verificado">Verified cycle</a>.</p>

      <h2>In numbers</h2>
      <table>
        <thead><tr><th>Piece</th><th>Count</th></tr></thead>
        <tbody>
          <tr><td>Agents</td><td>14 agents (the <code>lean</code> preset activates 6; the cycle uses 3)</td></tr>
          <tr><td>Commands</td><td>39 <code>/sdd.*</code> commands</td></tr>
          <tr><td>Skills</td><td>31 skills</td></tr>
          <tr><td>npm dependencies</td><td>3 (<code>@anthropic-ai/sdk</code>, <code>@sqlite.org/sqlite-wasm</code> and <code>acorn</code>)</td></tr>
          <tr><td>Languages with the verified cycle</td><td>JavaScript and TypeScript, Python, Go</td></tr>
        </tbody>
      </table>

      <h2>Who it is for</h2>
      <ul>
        <li><strong>Yes:</strong> people who write or supervise code and want a process with specification, tests and traceability.</li>
        <li><strong>Not yet:</strong> anyone expecting «no-code». You need Docker, an API key and to read the cycle's verdicts.</li>
      </ul>

      <h2>How it is used</h2>
      <p>Commands and agents are native to Claude Code. Other tools (Cursor, Copilot, Gemini CLI and similar) receive only the skills. The <code>fragua</code> CLI (equivalent to <code>forge</code>) installs, diagnoses and verifies. See <a href="#instalacion">Installation</a>.</p>

      <div class="callout tip">
        <p><strong>Next:</strong> <a href="#instalacion">Installation and first use</a>, or the one-page guide <a href="https://github.com/carlos060798/FORGE/blob/main/docs/PRIMEROS-15-MINUTOS.md">First 15 minutes</a> (Spanish).</p>
      </div>
    `
    }
  },
  "ciclo-verificado": {
    seccion: "overview",
    es: {
      titulo: "Ciclo verificado",
      html: `
      <h1>Ciclo verificado</h1>
      <p class="lead">Es el modo por defecto de la 5.0 para tareas de código. Una tarea solo se da por buena si sus pruebas pasan en un contenedor sin red, y lo decide el código de salida, no un modelo.</p>

      <h2>Los cinco pasos</h2>
      <ol>
        <li>Un agente escribe pruebas que <strong>deben fallar</strong> antes de que exista el código. Si no fallan, se pide revisión.</li>
        <li>Otro agente implementa y <strong>no puede tocar las pruebas</strong>.</li>
        <li>Las pruebas corren en <strong>Docker, sin red</strong>, con raíz de solo lectura y límites de tiempo y memoria.</li>
        <li><strong>Decide el código de salida</strong> de las pruebas. Además se mide cuánto detectan las pruebas alterando el código (mutación) y se desconfía de un «pasa» sospechoso.</li>
        <li><strong>Tope de gasto</strong> por sesión (2 USD por defecto) y pausa para que decida una persona cuando el ciclo no puede terminar solo.</li>
      </ol>

      <h2>Cuándo se pausa y te pregunta</h2>
      <table>
        <thead><tr><th>Motivo</th><th>Qué significa</th></tr></thead>
        <tbody>
          <tr><td>Dependencia o configuración</td><td>El modelo quiso añadir un paquete o tocar una configuración protegida. No se aplica solo.</td></tr>
          <tr><td>Sin progreso o iteraciones agotadas</td><td>Las pruebas siguen fallando igual tras varios intentos.</td></tr>
          <tr><td>Tope de gasto</td><td>Se alcanzó el límite de la sesión.</td></tr>
          <tr><td>Entorno</td><td>Docker no responde o falló el contenedor.</td></tr>
          <tr><td>Pruebas débiles</td><td>Las pruebas pasan pero detectan poco del código.</td></tr>
        </tbody>
      </table>

      <h2>Qué garantiza y qué no</h2>
      <ul>
        <li>El modelo no puede leer rutas vetadas ni escribir fuera del proyecto, ni ejecutar un comando propio: <code>ejecutar_pruebas</code> no admite parámetros.</li>
        <li>El código generado solo corre en un contenedor sin red.</li>
        <li><strong>No garantiza</strong> que las pruebas sean buenas: la medición por mutación lo mide, pero un adversario deliberado podría engañarla. Cada garantía enlaza a su prueba en <a href="https://github.com/carlos060798/FORGE/blob/main/docs/GARANTIAS-Y-LIMITES.md">GARANTIAS-Y-LIMITES.md</a>.</li>
        <li>Con el mismo usuario del sistema, un agente comprometido podría falsificar un registro firmado. Es un límite declarado, no oculto.</li>
      </ul>

      <div class="callout warn">
        <p><strong>Estado.</strong> El aislamiento con Docker real está probado en Windows (Docker Desktop). En Linux y macOS no se ha probado y la integración continua de Linux no está en verde. Sin Docker puedes usar <code>--motor clasico</code>, que ejecuta <strong>sin aislamiento</strong> y lo avisa.</p>
      </div>

      <p>Más: <a href="https://github.com/carlos060798/FORGE/blob/main/docs/ciclo-verificado.md">ciclo-verificado.md</a> y <a href="https://github.com/carlos060798/FORGE/blob/main/docs/QUE-PASA-SI-FALLA.md">qué hacer si falla</a>.</p>
    `
    },
    en: {
      titulo: "Verified cycle",
      html: `
      <h1>Verified cycle</h1>
      <p class="lead">It is the default mode in 5.0 for code tasks. A task is only accepted if its tests pass in a container with no network, and the exit code decides, not a model.</p>

      <h2>The five steps</h2>
      <ol>
        <li>One agent writes tests that <strong>must fail</strong> before the code exists. If they do not fail, a review is requested.</li>
        <li>Another agent implements and <strong>cannot touch the tests</strong>.</li>
        <li>The tests run in <strong>Docker, with no network</strong>, read-only root and time and memory limits.</li>
        <li>The tests' <strong>exit code decides</strong>. The tests are also measured by altering the code (mutation), and a suspicious «pass» is distrusted.</li>
        <li>A <strong>spending cap</strong> per session (2 USD by default), and a pause for a person to decide when the cycle cannot finish alone.</li>
      </ol>

      <h2>When it pauses and asks you</h2>
      <table>
        <thead><tr><th>Reason</th><th>Meaning</th></tr></thead>
        <tbody>
          <tr><td>Dependency or configuration</td><td>The model wanted to add a package or touch a protected configuration. It is not applied on its own.</td></tr>
          <tr><td>No progress or iterations exhausted</td><td>The tests keep failing the same way after several attempts.</td></tr>
          <tr><td>Spending cap</td><td>The session limit was reached.</td></tr>
          <tr><td>Environment</td><td>Docker does not respond or the container failed.</td></tr>
          <tr><td>Weak tests</td><td>The tests pass but detect little of the code.</td></tr>
        </tbody>
      </table>

      <h2>What it guarantees and what it does not</h2>
      <ul>
        <li>The model cannot read forbidden paths, write outside the project or run its own command: <code>ejecutar_pruebas</code> takes no parameters.</li>
        <li>Generated code only runs in a container with no network.</li>
        <li>It does <strong>not</strong> guarantee the tests are good: mutation measures that, but a deliberate adversary could fool it. Each guarantee links to its test in <a href="https://github.com/carlos060798/FORGE/blob/main/docs/GARANTIAS-Y-LIMITES.md">GARANTIAS-Y-LIMITES.md</a> (Spanish).</li>
        <li>With the same operating-system user, a compromised agent could forge a signed record. It is a declared limit, not a hidden one.</li>
      </ul>

      <div class="callout warn">
        <p><strong>Status.</strong> Isolation with real Docker is tested on Windows (Docker Desktop). It is not tested on Linux or macOS, and the Linux continuous integration is not green. Without Docker you can use <code>--motor clasico</code>, which runs <strong>without isolation</strong> and says so.</p>
      </div>

      <p>More: <a href="https://github.com/carlos060798/FORGE/blob/main/docs/ciclo-verificado.md">ciclo-verificado.md</a> and <a href="https://github.com/carlos060798/FORGE/blob/main/docs/QUE-PASA-SI-FALLA.md">what to do if it fails</a> (Spanish).</p>
    `
    }
  },
  capacidades: {
    seccion: "overview",
    es: {
      titulo: "Capacidades",
      html: `
      <h1>Capacidades</h1>
      <div class="callout warn">
        <p><strong>Página pendiente de actualizar.</strong> Se escribió antes del ciclo verificado y puede describir comportamiento anterior. La versión al día está en <a href="https://github.com/carlos060798/FORGE/blob/main/README.md">README (Spanish)</a>.</p>
      </div>

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
        <li><strong>Memoria persistente por agente</strong> — SQLite (Node ≥22.5) o Markdown (Node ≥20), auto-seleccionado</li>
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
      <div class="callout warn">
        <p><strong>Page pending an update.</strong> It was written before the verified cycle and may describe earlier behaviour. The up-to-date version is in <a href="https://github.com/carlos060798/FORGE/blob/main/README.md">README (Spanish)</a> (Spanish).</p>
      </div>

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
      <p>7 agents are strictly read-only (enforced at hook level — not configurable). 7 agents can write files.</p>

      <h2>Key capabilities</h2>
      <ul>
        <li><strong>Real-time guardrails</strong> — <code>pre-tool-guard.js</code> blocks destructive commands, detects secrets and ADR violations</li>
        <li><strong>Agent enforcement</strong> — 7 read-only agents blocked at hook level from Write/Edit</li>
        <li><strong>Persistent agent memory</strong> — SQLite (Node ≥22.5) or Markdown (Node ≥20), auto-selected</li>
        <li><strong>Decision store SQLite</strong> — ADRs with TF-IDF semantic search, versioning and consolidation</li>
        <li><strong>Host adapters</strong> — Claude Code + Spec Kit portable (consumable by Cursor, Copilot, Gemini)</li>
        <li><strong>Portable artifacts</strong> — <code>forge export --format=speckit|openspec</code> works without FORGE installed</li>
        <li><strong>Complete observability</strong> — <code>consumo.jsonl</code> + <code>budget-state.json</code></li>
      </ul>
    `
    }
  },
  limitaciones: {
    seccion: "overview",
    es: {
      titulo: "Limitaciones",
      html: `
      <h1>Limitaciones</h1>
      <p class="lead">Lo que está probado, lo que no, y los límites que conviene conocer antes de usarlo. La fuente al día es <a href="https://github.com/carlos060798/FORGE/blob/main/docs/ESTADO-ACTUAL.md">ESTADO-ACTUAL.md</a>.</p>

      <div class="callout warn">
        <p><strong>Lee esto primero.</strong> Fragua está en pre-beta, lo mantiene una persona y varias partes no se han probado fuera de Windows.</p>
      </div>

      <h2>Sin probar</h2>
      <table>
        <thead><tr><th>Qué</th><th>Estado</th></tr></thead>
        <tbody>
          <tr><td>Aislamiento con Docker real en Linux y macOS</td><td>Probado solo en Windows (Docker Desktop). La integración continua de Linux no está en verde.</td></tr>
          <tr><td>OpenAI y Ollama con modelo real</td><td>Probados con dobles de prueba; sin ejecución real.</td></tr>
          <tr><td>Integraciones con GitHub, GitLab y Jira</td><td>Probadas solo contra servidores simulados.</td></tr>
          <tr><td>Gasto calculado frente a una factura</td><td>No comparado todavía.</td></tr>
          <tr><td>Modelo real con tareas grandes</td><td>Probado con Anthropic en tareas pequeñas de JavaScript, Python y Go.</td></tr>
        </tbody>
      </table>

      <h2>Límites de diseño</h2>
      <table>
        <thead><tr><th>Límite</th><th>Detalle</th></tr></thead>
        <tbody>
          <tr><td>La aprobación no prueba revisión</td><td><code>fragua aprobar spec</code> prueba que alguien ejecutó la aprobación en una terminal real, no que la leyó. Con el mismo usuario del sistema, un agente comprometido podría falsificar el registro firmado.</td></tr>
          <tr><td>El guardián es una red de seguridad</td><td>Analiza texto: alias, funciones de shell o scripts ejecutados después no se resuelven. No es un límite. La defensa principal son los permisos de Claude Code.</td></tr>
          <tr><td>Sin colaboración multiusuario</td><td>El estado vive en <code>.sdd/</code> y no hay bloqueo entre personas. Está en el plan, no implementado.</td></tr>
          <tr><td>Cobertura de lenguajes</td><td>El ciclo verificado cubre JavaScript y TypeScript, Python y Go.</td></tr>
          <tr><td>Sin Docker</td><td><code>--motor clasico</code> ejecuta el código generado en tu equipo, sin aislamiento, y lo avisa.</td></tr>
          <tr><td>Mantenimiento</td><td>Una persona, sin plazos de respuesta garantizados.</td></tr>
        </tbody>
      </table>

      <h2>Requisitos duros</h2>
      <ul>
        <li>Node.js ≥ 20. Sin Node, el guardián bloquea toda acción (falla cerrado).</li>
        <li>Docker en marcha para el ciclo verificado.</li>
        <li>Una clave de API en tu entorno y un tope de gasto en el proveedor.</li>
      </ul>

      <p>Detalle completo: <a href="https://github.com/carlos060798/FORGE/blob/main/docs/PROBLEMAS-CONOCIDOS.md">PROBLEMAS-CONOCIDOS.md</a> y <a href="https://github.com/carlos060798/FORGE/blob/main/docs/limitations.md">limitations.md</a>.</p>
    `
    },
    en: {
      titulo: "Limitations",
      html: `
      <h1>Limitations</h1>
      <p class="lead">What is tested, what is not, and the limits worth knowing before you use it. The up-to-date source is <a href="https://github.com/carlos060798/FORGE/blob/main/docs/ESTADO-ACTUAL.md">ESTADO-ACTUAL.md</a> (Spanish).</p>

      <div class="callout warn">
        <p><strong>Read this first.</strong> Fragua is pre-beta, maintained by one person, and several parts have not been tested outside Windows.</p>
      </div>

      <h2>Not tested</h2>
      <table>
        <thead><tr><th>What</th><th>Status</th></tr></thead>
        <tbody>
          <tr><td>Isolation with real Docker on Linux and macOS</td><td>Tested on Windows only (Docker Desktop). Linux continuous integration is not green.</td></tr>
          <tr><td>OpenAI and Ollama with a real model</td><td>Tested with test doubles; no real run.</td></tr>
          <tr><td>GitHub, GitLab and Jira integrations</td><td>Tested only against simulated servers.</td></tr>
          <tr><td>Computed spending against an invoice</td><td>Not compared yet.</td></tr>
          <tr><td>Real model on large tasks</td><td>Tested with Anthropic on small JavaScript, Python and Go tasks.</td></tr>
        </tbody>
      </table>

      <h2>Design limits</h2>
      <table>
        <thead><tr><th>Limit</th><th>Detail</th></tr></thead>
        <tbody>
          <tr><td>Approval does not prove review</td><td><code>fragua aprobar spec</code> proves someone ran the approval in a real terminal, not that they read it. With the same operating-system user, a compromised agent could forge the signed record.</td></tr>
          <tr><td>The guard is a safety net</td><td>It analyses text: aliases, shell functions or scripts run later are not resolved. It is not a boundary. The main defence is Claude Code's permissions.</td></tr>
          <tr><td>No multi-user collaboration</td><td>State lives in <code>.sdd/</code> and there is no locking between people. It is planned, not implemented.</td></tr>
          <tr><td>Language coverage</td><td>The verified cycle covers JavaScript and TypeScript, Python and Go.</td></tr>
          <tr><td>Without Docker</td><td><code>--motor clasico</code> runs generated code on your machine, without isolation, and says so.</td></tr>
          <tr><td>Maintenance</td><td>One person, with no guaranteed response times.</td></tr>
        </tbody>
      </table>

      <h2>Hard requirements</h2>
      <ul>
        <li>Node.js ≥ 20. Without Node, the guard blocks every action (fails closed).</li>
        <li>Docker running for the verified cycle.</li>
        <li>An API key in your environment and a spending cap at the provider.</li>
      </ul>

      <p>Full detail: <a href="https://github.com/carlos060798/FORGE/blob/main/docs/PROBLEMAS-CONOCIDOS.md">PROBLEMAS-CONOCIDOS.md</a> and <a href="https://github.com/carlos060798/FORGE/blob/main/docs/limitations.md">limitations.md</a> (Spanish).</p>
    `
    }
  },
  madurez: {
    seccion: "overview",
    es: {
      titulo: "Análisis de Madurez",
      html: `
      <h1>Análisis de Madurez</h1>
      <p class="lead">Estado real de cada área de Fragua 5.0.0-beta.1, a 2026-11-10. Qué está respaldado por pruebas automáticas, qué se probó con Docker o un modelo real y qué no. Cifras y commits en <a href="https://github.com/carlos060798/FORGE/blob/main/docs/ESTADO-ACTUAL.md">ESTADO-ACTUAL.md</a>.</p>

      <div class="callout warn">
        <p>Una suite verde no es lo mismo que una prueba en producción: <strong>no hay usuarios externos medidos todavía</strong> y el paquete no está publicado.</p>
      </div>

      <table>
        <thead><tr><th>Área</th><th>Respaldo</th><th>Qué falta</th></tr></thead>
        <tbody>
          <tr><td>Ciclo verificado (pruebas, implementación, mutación)</td><td>Pruebas automáticas; Docker real en Windows; modelo real en tareas pequeñas</td><td>Linux y macOS; tareas grandes; otros proveedores</td></tr>
          <tr><td>Aislamiento del código generado</td><td>11 pruebas con Docker real en Windows: sin red, sin privilegios, raíz de solo lectura, tiempo y memoria acotados</td><td>Repetirlo en Linux</td></tr>
          <tr><td>Aprobación humana con registro firmado</td><td>Pruebas automáticas</td><td>Una terminal real en cada plataforma; separación del usuario del sistema</td></tr>
          <tr><td>Guardián de hooks</td><td>Pruebas y batería de evasiones</td><td>Es una red de seguridad, no un límite</td></tr>
          <tr><td>Cadena de evidencia y puertas de calidad</td><td>Pruebas automáticas; Docker falso para las puertas</td><td>Puertas con Docker real y modelo real</td></tr>
          <tr><td>Servidor MCP (perfil de verificación)</td><td>Pruebas automáticas</td><td>Un cliente real de otra herramienta</td></tr>
          <tr><td>API HTTP local y panel</td><td>Pruebas automáticas; desactivados por defecto</td><td>Uso externo</td></tr>
          <tr><td>Proveedores OpenAI y Ollama</td><td>Conformidad con dobles de prueba</td><td>Una ejecución con modelo real</td></tr>
          <tr><td>Integraciones GitHub, GitLab y Jira</td><td>Servidores simulados</td><td>Cuentas reales</td></tr>
          <tr><td>Instalación en otras herramientas</td><td>Pruebas automáticas; solo skills</td><td>Comandos, agentes y hooks son de Claude Code</td></tr>
          <tr><td>Distribución</td><td>Paquete preparado y revisado</td><td>No publicado; integración continua de Linux sin verde</td></tr>
        </tbody>
      </table>
    `
    },
    en: {
      titulo: "Maturity Analysis",
      html: `
      <h1>Maturity Analysis</h1>
      <p class="lead">Real status of each area of Fragua 5.0.0-beta.1, as of 2026-11-10. What is backed by automated tests, what was tried with real Docker or a real model, and what was not. Figures and commits in <a href="https://github.com/carlos060798/FORGE/blob/main/docs/ESTADO-ACTUAL.md">ESTADO-ACTUAL.md</a> (Spanish).</p>

      <div class="callout warn">
        <p>A green suite is not the same as proof in production: <strong>no external users have been measured yet</strong> and the package is not published.</p>
      </div>

      <table>
        <thead><tr><th>Area</th><th>Backing</th><th>What is missing</th></tr></thead>
        <tbody>
          <tr><td>Verified cycle (tests, implementation, mutation)</td><td>Automated tests; real Docker on Windows; real model on small tasks</td><td>Linux and macOS; large tasks; other providers</td></tr>
          <tr><td>Isolation of generated code</td><td>11 tests with real Docker on Windows: no network, no privileges, read-only root, bounded time and memory</td><td>Repeat on Linux</td></tr>
          <tr><td>Human approval with signed record</td><td>Automated tests</td><td>A real terminal on each platform; separation from the system user</td></tr>
          <tr><td>Hook guard</td><td>Tests and an evasion battery</td><td>It is a safety net, not a boundary</td></tr>
          <tr><td>Evidence chain and quality gates</td><td>Automated tests; fake Docker for gates</td><td>Gates with real Docker and a real model</td></tr>
          <tr><td>MCP server (verification profile)</td><td>Automated tests</td><td>A real client from another tool</td></tr>
          <tr><td>Local HTTP API and dashboard</td><td>Automated tests; off by default</td><td>External use</td></tr>
          <tr><td>OpenAI and Ollama providers</td><td>Conformance with test doubles</td><td>A run with a real model</td></tr>
          <tr><td>GitHub, GitLab and Jira integrations</td><td>Simulated servers</td><td>Real accounts</td></tr>
          <tr><td>Installation in other tools</td><td>Automated tests; skills only</td><td>Commands, agents and hooks belong to Claude Code</td></tr>
          <tr><td>Distribution</td><td>Package prepared and reviewed</td><td>Not published; Linux continuous integration not green</td></tr>
        </tbody>
      </table>
    `
    }
  },
  arquitectura: {
    seccion: "technical",
    es: {
      titulo: "Arquitectura del Sistema",
      html: `
      <h1>Arquitectura del Sistema</h1>
      <div class="callout warn">
        <p><strong>Página pendiente de actualizar.</strong> Se escribió antes del ciclo verificado y puede describir comportamiento anterior. La versión al día está en <a href="https://github.com/carlos060798/FORGE/blob/main/docs/architecture.md">architecture.md</a>.</p>
      </div>

      <p class="lead">Referencia técnica de la arquitectura de 3 capas de FORGE v5.0.0-beta.1. Basada en análisis estático del repositorio.</p>

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
      <div class="callout warn">
        <p><strong>Page pending an update.</strong> It was written before the verified cycle and may describe earlier behaviour. The up-to-date version is in <a href="https://github.com/carlos060798/FORGE/blob/main/docs/architecture.md">architecture.md</a> (Spanish).</p>
      </div>

      <p class="lead">Technical reference for FORGE v5.0.0-beta.1's 3-layer architecture.</p>

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
  componentes: {
    seccion: "technical",
    es: {
      titulo: "Componentes del Sistema",
      html: `
      <h1>Componentes del Sistema</h1>
      <div class="callout warn">
        <p><strong>Página pendiente de actualizar.</strong> Se escribió antes del ciclo verificado y puede describir comportamiento anterior. La versión al día está en <a href="https://github.com/carlos060798/FORGE/blob/main/docs/mapa-de-modulos.md">mapa-de-modulos.md</a>.</p>
      </div>

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
      <div class="callout warn">
        <p><strong>Page pending an update.</strong> It was written before the verified cycle and may describe earlier behaviour. The up-to-date version is in <a href="https://github.com/carlos060798/FORGE/blob/main/docs/mapa-de-modulos.md">mapa-de-modulos.md</a> (Spanish).</p>
      </div>

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
  contratos: {
    seccion: "technical",
    es: {
      titulo: "Contratos de Artefactos",
      html: `
      <h1>Contratos de Artefactos</h1>
      <div class="callout warn">
        <p><strong>Página pendiente de actualizar.</strong> Se escribió antes del ciclo verificado y puede describir comportamiento anterior. La versión al día está en <a href="https://github.com/carlos060798/FORGE/tree/main/docs/contrato/">docs/contrato/</a>.</p>
      </div>

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
      <div class="callout warn">
        <p><strong>Page pending an update.</strong> It was written before the verified cycle and may describe earlier behaviour. The up-to-date version is in <a href="https://github.com/carlos060798/FORGE/tree/main/docs/contrato/">docs/contrato/</a> (Spanish).</p>
      </div>

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
  instalacion: {
    seccion: "operate",
    es: {
      titulo: "Instalación y Primer Uso",
      html: `
      <h1>Instalación y Primer Uso</h1>

      <div class="callout warn">
        <p><strong>El paquete aún no está publicado en npm.</strong> Hoy se instala desde el repositorio. Cuando se publique será <code>npm install -g fragua</code> con la etiqueta <code>beta</code>.</p>
      </div>

      <h2>Requisitos</h2>
      <table>
        <thead><tr><th>Requisito</th><th>Por qué</th></tr></thead>
        <tbody>
          <tr><td>Node.js ≥ 20</td><td>La CLI y los hooks. Sin Node, el guardián bloquea toda acción.</td></tr>
          <tr><td>Docker en marcha</td><td>El ciclo verificado ejecuta el código generado en un contenedor sin red.</td></tr>
          <tr><td><code>ANTHROPIC_API_KEY</code> en tu entorno</td><td>Las claves nunca se leen del archivo del proyecto.</td></tr>
          <tr><td>Claude Code</td><td>Los comandos y agentes son nativos de Claude Code.</td></tr>
        </tbody>
      </table>

      <h2>Instalar</h2>
      <pre><code class="bash">git clone https://github.com/carlos060798/FORGE
cd FORGE
npm install
npm install -g .
cd &lt;tu-proyecto&gt;
fragua init       # perfil esencial y preset lean por defecto
fragua doctor     # comprueba Node, Docker, clave, hooks y proveedor</code></pre>

      <p><code>fragua init</code> sin opciones instala el perfil <strong>esencial</strong> (seis comandos en el menú <code>/</code>) y el preset <strong>lean</strong> (seis agentes, todos en sonnet). Para todos los comandos: <code>--perfil completo</code>. Otros presets: <code>--preset startup</code> o <code>--preset enterprise</code>. Las órdenes <code>fragua</code>, <code>forge</code> y <code>sdd-es</code> son equivalentes.</p>

      <h2>Primera tarea</h2>
      <p>Dentro de Claude Code, en tu proyecto, en este orden:</p>
      <pre><code class="text">/sdd.especificar "una idea en una frase"   →  fragua aprobar spec   (en una terminal)
/sdd.planificar
/sdd.tareas
/sdd.implementar                            →  ciclo verificado en un contenedor
/sdd.estado</code></pre>
      <p><code>fragua aprobar spec</code> exige una terminal real y teclear un código: sin esa aprobación no se puede pasar de la especificación al plan.</p>

      <h2>Plantillas de proyecto</h2>
      <pre><code class="bash">fragua init --template api-rest    # API REST
fragua init --template cli-tool    # CLI con subcomandos
fragua init --template saas-mvp    # SaaS mínimo</code></pre>

      <div class="callout tip">
        <p>Guía de una página con qué hacer en cada pausa: <a href="https://github.com/carlos060798/FORGE/blob/main/docs/PRIMEROS-15-MINUTOS.md">Primeros 15 minutos</a>. Todos los subcomandos: <a href="https://github.com/carlos060798/FORGE/blob/main/docs/referencia-cli.md">referencia de la CLI</a>.</p>
      </div>
    `
    },
    en: {
      titulo: "Installation and First Use",
      html: `
      <h1>Installation and First Use</h1>

      <div class="callout warn">
        <p><strong>The package is not published on npm yet.</strong> Today it is installed from the repository. Once published it will be <code>npm install -g fragua</code> with the <code>beta</code> tag.</p>
      </div>

      <h2>Requirements</h2>
      <table>
        <thead><tr><th>Requirement</th><th>Why</th></tr></thead>
        <tbody>
          <tr><td>Node.js ≥ 20</td><td>The CLI and hooks. Without Node, the guard blocks every action.</td></tr>
          <tr><td>Docker running</td><td>The verified cycle runs generated code in a container with no network.</td></tr>
          <tr><td><code>ANTHROPIC_API_KEY</code> in your environment</td><td>Keys are never read from the project file.</td></tr>
          <tr><td>Claude Code</td><td>Commands and agents are native to Claude Code.</td></tr>
        </tbody>
      </table>

      <h2>Install</h2>
      <pre><code class="bash">git clone https://github.com/carlos060798/FORGE
cd FORGE
npm install
npm install -g .
cd &lt;your-project&gt;
fragua init       # essential profile and lean preset by default
fragua doctor     # checks Node, Docker, key, hooks and provider</code></pre>

      <p><code>fragua init</code> with no options installs the <strong>essential</strong> profile (six commands in the <code>/</code> menu) and the <strong>lean</strong> preset (six agents, all on sonnet). For every command: <code>--perfil completo</code>. Other presets: <code>--preset startup</code> or <code>--preset enterprise</code>. The <code>fragua</code>, <code>forge</code> and <code>sdd-es</code> commands are equivalent.</p>

      <h2>First task</h2>
      <p>Inside Claude Code, in your project, in this order:</p>
      <pre><code class="text">/sdd.especificar "an idea in one sentence"   →  fragua aprobar spec   (in a terminal)
/sdd.planificar
/sdd.tareas
/sdd.implementar                              →  verified cycle in a container
/sdd.estado</code></pre>
      <p><code>fragua aprobar spec</code> needs a real terminal and typing a code: without that approval you cannot move from specification to plan.</p>

      <h2>Project templates</h2>
      <pre><code class="bash">fragua init --template api-rest    # REST API
fragua init --template cli-tool    # CLI with subcommands
fragua init --template saas-mvp    # minimal SaaS</code></pre>

      <div class="callout tip">
        <p>One-page guide with what to do at each pause: <a href="https://github.com/carlos060798/FORGE/blob/main/docs/PRIMEROS-15-MINUTOS.md">First 15 minutes</a> (Spanish). All subcommands: <a href="https://github.com/carlos060798/FORGE/blob/main/docs/referencia-cli.md">CLI reference</a> (Spanish).</p>
      </div>
    `
    }
  },
  configuracion: {
    seccion: "operate",
    es: {
      titulo: "Configuración",
      html: `
      <h1>Configuración</h1>
      <div class="callout warn">
        <p><strong>Página pendiente de actualizar.</strong> Se escribió antes del ciclo verificado y puede describir comportamiento anterior. La versión al día está en <a href="https://github.com/carlos060798/FORGE/blob/main/docs/configuration.md">configuration.md</a>.</p>
      </div>

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
      <div class="callout warn">
        <p><strong>Page pending an update.</strong> It was written before the verified cycle and may describe earlier behaviour. The up-to-date version is in <a href="https://github.com/carlos060798/FORGE/blob/main/docs/configuration.md">configuration.md</a> (Spanish).</p>
      </div>

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
      <div class="callout warn">
        <p><strong>Página pendiente de actualizar.</strong> Se escribió antes del ciclo verificado y puede describir comportamiento anterior. La versión al día está en <a href="https://github.com/carlos060798/FORGE/blob/main/docs/getting-started.md">getting-started.md</a>.</p>
      </div>

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
      <div class="callout warn">
        <p><strong>Page pending an update.</strong> It was written before the verified cycle and may describe earlier behaviour. The up-to-date version is in <a href="https://github.com/carlos060798/FORGE/blob/main/docs/getting-started.md">getting-started.md</a> (Spanish).</p>
      </div>

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
      <div class="callout warn">
        <p><strong>Página pendiente de actualizar.</strong> Se escribió antes del ciclo verificado y puede describir comportamiento anterior. La versión al día está en <a href="https://github.com/carlos060798/FORGE/blob/main/docs/workflows.md">workflows.md</a>.</p>
      </div>

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
      <div class="callout warn">
        <p><strong>Page pending an update.</strong> It was written before the verified cycle and may describe earlier behaviour. The up-to-date version is in <a href="https://github.com/carlos060798/FORGE/blob/main/docs/workflows.md">workflows.md</a> (Spanish).</p>
      </div>

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
  ejemplos: {
    seccion: "operate",
    es: {
      titulo: "Ejemplos de Uso",
      html: `
      <h1>Ejemplos de Uso</h1>
      <div class="callout warn">
        <p><strong>Página pendiente de actualizar.</strong> Se escribió antes del ciclo verificado y puede describir comportamiento anterior. La versión al día está en <a href="https://github.com/carlos060798/FORGE/blob/main/docs/EJEMPLO-API-REST.md">EJEMPLO-API-REST.md</a>.</p>
      </div>

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
forge dispatch   --agente=investigador   --tarea="Analiza el proyecto existente y extrae el contexto técnico"   --adapter=speckit

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
      <div class="callout warn">
        <p><strong>Page pending an update.</strong> It was written before the verified cycle and may describe earlier behaviour. The up-to-date version is in <a href="https://github.com/carlos060798/FORGE/blob/main/docs/EJEMPLO-API-REST.md">EJEMPLO-API-REST.md</a> (Spanish).</p>
      </div>

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
      <div class="callout warn">
        <p><strong>Página pendiente de actualizar.</strong> Se escribió antes del ciclo verificado y puede describir comportamiento anterior. La versión al día está en <a href="https://github.com/carlos060798/FORGE/blob/main/docs/referencia-cli.md">referencia-cli.md</a>.</p>
      </div>

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
      <div class="callout warn">
        <p><strong>Page pending an update.</strong> It was written before the verified cycle and may describe earlier behaviour. The up-to-date version is in <a href="https://github.com/carlos060798/FORGE/blob/main/docs/referencia-cli.md">referencia-cli.md</a> (Spanish).</p>
      </div>

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
  extensibilidad: {
    seccion: "extend",
    es: {
      titulo: "Cómo Extender FORGE",
      html: `
      <h1>Cómo Extender FORGE</h1>
      <div class="callout warn">
        <p><strong>Página pendiente de actualizar.</strong> Se escribió antes del ciclo verificado y puede describir comportamiento anterior. La versión al día está en <a href="https://github.com/carlos060798/FORGE/blob/main/docs/extending-forge.md">extending-forge.md</a>.</p>
      </div>

      <p class="lead">FORGE está diseñado para ser extensible: puedes añadir agentes, skills, comandos, adaptadores de host e integraciones MCP sin tocar el núcleo.</p>

      <div class="callout tip">
        <p><strong>Regla de oro:</strong> Nunca añadas dependencias npm al runtime (<code>cli/</code>, <code>claude-hooks/</code>, <code>core/</code>). FORGE tiene tres dependencias (<code>@anthropic-ai/sdk</code>, <code>acorn</code> y <code>@sqlite.org/sqlite-wasm</code>) y cualquier otra exige un ADR.</p>
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
      <div class="callout warn">
        <p><strong>Page pending an update.</strong> It was written before the verified cycle and may describe earlier behaviour. The up-to-date version is in <a href="https://github.com/carlos060798/FORGE/blob/main/docs/extending-forge.md">extending-forge.md</a> (Spanish).</p>
      </div>

      <p class="lead">You can add agents, skills, commands, host adapters and MCP integrations without touching the core.</p>

      <div class="callout tip">
        <p><strong>Golden rule:</strong> Never add npm dependencies to the runtime. FORGE has three dependencies (<code>@anthropic-ai/sdk</code>, <code>acorn</code> and <code>@sqlite.org/sqlite-wasm</code>); any other one requires an ADR.</p>
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
  integraciones: {
    seccion: "extend",
    es: {
      titulo: "Integraciones MCP",
      html: `
      <h1>Integraciones MCP</h1>
      <div class="callout warn">
        <p><strong>Página pendiente de actualizar.</strong> Se escribió antes del ciclo verificado y puede describir comportamiento anterior. La versión al día está en <a href="https://github.com/carlos060798/FORGE/blob/main/docs/INTEGRACIONES.md">INTEGRACIONES.md</a>.</p>
      </div>

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
      <div class="callout warn">
        <p><strong>Page pending an update.</strong> It was written before the verified cycle and may describe earlier behaviour. The up-to-date version is in <a href="https://github.com/carlos060798/FORGE/blob/main/docs/INTEGRACIONES.md">INTEGRACIONES.md</a> (Spanish).</p>
      </div>

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
  recomendaciones: {
    seccion: "extend",
    es: {
      titulo: "Recomendaciones",
      html: `
      <h1>Recomendaciones</h1>
      <div class="callout warn">
        <p><strong>Página pendiente de actualizar.</strong> Se escribió antes del ciclo verificado y puede describir comportamiento anterior. La versión al día está en <a href="https://github.com/carlos060798/FORGE/blob/main/docs/0-INDICE.md">0-INDICE.md</a>.</p>
      </div>

      <p class="lead">Qué cambios tendrían mayor impacto en FORGE v5.0.0-beta.1, ordenados por prioridad.</p>

      <h2>Completado en v5.0.0-beta.1</h2>
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
npm test           # 0 fallos antes de PR</code></pre>
    `
    },
    en: {
      titulo: "Recommendations",
      html: `
      <h1>Recommendations</h1>
      <div class="callout warn">
        <p><strong>Page pending an update.</strong> It was written before the verified cycle and may describe earlier behaviour. The up-to-date version is in <a href="https://github.com/carlos060798/FORGE/blob/main/docs/0-INDICE.md">0-INDICE.md</a> (Spanish).</p>
      </div>

      <p class="lead">What changes would have the greatest impact on FORGE v5.0.0-beta.1, ordered by priority.</p>

      <h2>Completed in v5.0.0-beta.1</h2>
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
};
