/* ============================================================
   FORGE Docs — datos (data-driven, bilingüe ES/EN)
   PAGES: cada página con audiencia, sección y contenido es/en.
   El orden de las claves define el orden en el sidebar.
   ============================================================ */

/* Traducciones de la interfaz (chrome) */
const UI = {
  es: {
    brand_tag: "Documentación",
    search_placeholder: "Buscar…",
    search_input_placeholder: "Buscar en la documentación…",
    search_navigate: "navegar",
    search_open: "abrir",
    search_close: "cerrar",
    footer_text: "FORGE · Spec-Driven Development en español para Claude Code · MIT",
    search_no_results: "Sin resultados",
    groups: {
      nodev: "🟢 Para construir",
      dev: "🔵 Para entender el motor",
      prompts: "🟣 Ingeniería de prompts",
      ref: "📖 Referencia"
    }
  },
  en: {
    brand_tag: "Documentation",
    search_placeholder: "Search…",
    search_input_placeholder: "Search the docs…",
    search_navigate: "navigate",
    search_open: "open",
    search_close: "close",
    footer_text: "FORGE · Spec-Driven Development for Claude Code · MIT",
    search_no_results: "No results",
    groups: {
      nodev: "🟢 To build",
      dev: "🔵 To understand the engine",
      prompts: "🟣 Prompt engineering",
      ref: "📖 Reference"
    }
  }
};

/* Orden de grupos en el sidebar */
const GROUP_ORDER = ["nodev", "dev", "prompts", "ref"];

/* Páginas. seccion = clave de grupo. */
const PAGES = {
"que-es-forge": {
    seccion: "nodev",
    es: {
      titulo: "¿Qué es FORGE? Misión, necesidad y objetivo",
      html: `
        <h1>¿Qué es FORGE? — El por qué detrás de la herramienta</h1>
        <p class="lead">FORGE no es solo software. Es una respuesta a una pregunta que hace años nos obsesiona: ¿Cómo hacemos que crear software sea accesible para TODOS, no solo para programadores?</p>

        <h2>La necesidad: El problema que FORGE resuelve</h2>

        <h3>Hoy, crear software es un privilegio</h3>
        <p>Si tienes una idea brillante pero no sabes programar, tienes 3 opciones:</p>
        <ul>
          <li><strong>Contratar programador</strong> — Costo: $$$$ (miles/mes) · Tiempo: semanas · Dependencia: total</li>
          <li><strong>Usar no-code (Bubble, Webflow)</strong> — Costo: $$ (por mes) · Tiempo: días · Limitado por la plataforma</li>
          <li><strong>Aprender a programar</strong> — Costo: $ (gratis) · Tiempo: meses/años · Demasiado lento</li>
        </ul>
        <p><strong>El problema:</strong> Cada opción tiene un costo prohibitivo. El talento no-técnico queda atrapado.</p>

        <h2>La misión de FORGE</h2>

        <p>FORGE existe para una sola cosa: <strong>hacer que cualquiera pueda crear software sin necesidad de programar, de forma segura, entendible y sin dependencias.</strong></p>

        <h3>Tres principios fundamentales</h3>
        <ul>
          <li><strong>Accesible sin programación:</strong> Si puedes describir lo que quieres en palabras, FORGE lo construye</li>
          <li><strong>Transparente en cada decisión:</strong> Cada línea de código tiene un "por qué" que entiendes</li>
          <li><strong>Dueño de tu código:</strong> Tu software está en GitHub, bajo TU control, no atrapado en una plataforma</li>
        </ul>

        <h2>¿Por qué "FORGE"?</h2>

        <p>Forge significa fragua — donde se forjan herramientas de metal. Aquí:</p>
        <ul>
          <li>Traes tu materia prima: una idea</li>
          <li>Los especialistas (14 agentes) trabajan en paralelo</li>
          <li>Se verifica la calidad (auditoría automática)</li>
          <li>Sale producto listo para usar (código en vivo)</li>
        </ul>

        <h2>El objetivo: ¿Hacia dónde vamos?</h2>

        <p><strong>En 2 años:</strong> 1000 proyectos reales creados por no-programadores (herramientas, productos, negocios).</p>
        <p><strong>En 5 años:</strong> Crear software sea tan fácil como crear un documento de Google.</p>

        <h2>⚠️ Un marco experimental en construcción</h2>

        <p>FORGE v2.6.0 funciona, pero es experimental. El roadmap es público:</p>
        <ul>
          <li>✅ Crear sitios web y apps</li>
          <li>✅ Auditoría automática de seguridad</li>
          <li>✅ Despliegue automático</li>
          <li>✅ Memoria entre sesiones</li>
          <li>🔄 Generador visual de UIs (en desarrollo)</li>
          <li>🔄 Integración con Figma (en desarrollo)</li>
          <li>⏳ Marketplace de templates (v2.7.0)</li>
          <li>⏳ Apps móviles iOS/Android (v3.0)</li>
        </ul>

        <p>Somos transparentes. Si quieres contribuir con ideas, bienvenido.</p>

        <h2>¿Por qué en español?</h2>

        <p>FORGE nace en Latinoamérica, para Latinoamérica. El talento existe en abundancia, pero barreras de acceso (idioma, educación, costo) mantienen a miles fuera del software. Empezamos en español para cambiar eso.</p>

        <div class="callout tip">
          <p><strong>Próximo paso:</strong> Lee "Cómo funciona FORGE paso a paso" o abre Claude Code y escribe: <code>/sdd.constitucion</code></p>
        </div>
      `
    },
    en: {
      titulo: "What is FORGE? Mission and goal",
      html: `
        <h1>What is FORGE?</h1>
        <p class="lead">FORGE is an answer to a question obsessing us for years: How do we make building software accessible to EVERYONE, not just programmers?</p>

        <h2>The mission</h2>

        <p>Make it possible for anyone to create software without programming, safely, transparently, and without eternal lock-in.</p>

        <h3>Three guiding principles</h3>
        <ul>
          <li><strong>Accessible without coding:</strong> Describe it in words, FORGE builds it</li>
          <li><strong>Transparent decisions:</strong> Every line of code has a "why" you understand</li>
          <li><strong>You own your code:</strong> On GitHub, under YOUR control, never locked in</li>
        </ul>

        <h2>The goal</h2>

        <p><strong>Year 2:</strong> 1000 real projects built by non-programmers.</p>
        <p><strong>Year 5:</strong> Creating software as easy as creating a Google Doc.</p>

        <h2>⚠️ Experimental framework under construction</h2>

        <p>FORGE v2.6.0 works. Public roadmap:</p>
        <ul>
          <li>✅ Build websites and apps</li>
          <li>✅ Automatic security audit</li>
          <li>✅ Auto-deploy</li>
          <li>🔄 Visual UI generator (in progress)</li>
          <li>⏳ Mobile apps (v3.0)</li>
        </ul>

        <p>Transparent and open to contributions.</p>

        <div class="callout tip">
          <p><strong>Next:</strong> Read "How FORGE Works Step by Step" or type: <code>/sdd.constitucion</code></p>
        </div>
      `
    }
  },

"bienvenida": {
    seccion: "nodev",
    es: {
      titulo: "Bienvenida a FORGE",
      html: `
        <h1>FORGE: de la idea al producto, sin escribir código</h1>
        <p class="lead">
          FORGE es un sistema que convierte lo que describes en palabras normales
          en software real, funcionando en internet. Tú hablas, FORGE construye.
        </p>

        <div class="callout">
          <div class="callout-title">¿Qué hace FORGE exactamente?</div>
          <p>
            Describes lo que quieres — una app, una herramienta, un sitio — como si
            se lo explicaras a un amigo. FORGE entiende tu idea, la convierte en un
            plan detallado que tú revisas, luego la construye, la prueba
            y la publica en internet. Todo sin que escribas una sola línea de código.
          </p>
        </div>

        <h2>La historia de Martina</h2>
        <p>
          Martina es diseñadora gráfica. Un martes por la mañana pensó: "Necesito
          una herramienta que haga mis presupuestos automáticamente". No sabe programar.
          Abrió Claude Code, escribió su idea en español, y a las 15:45 de ese mismo día
          su herramienta estaba publicada en internet. Tiempo total desde la idea: menos
          de dos horas, casi todo esperando a que FORGE trabajara.
        </p>
        <p>
          En la primera semana, 23 clientes usaron la herramienta. Martina no escribió
          ni una línea de código.
        </p>

        <h2>¿En qué se diferencia de otras herramientas?</h2>
        <table>
          <thead>
            <tr>
              <th>Herramienta</th>
              <th>¿Puedes ver las decisiones?</th>
              <th>¿Audita automáticamente?</th>
              <th>¿Para no-técnicos?</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Bolt / v0</td>
              <td>No — caja negra</td>
              <td>No</td>
              <td>Parcialmente</td>
            </tr>
            <tr>
              <td>ChatGPT</td>
              <td>Da código, tú lo revisas</td>
              <td>No</td>
              <td>Muy limitado</td>
            </tr>
            <tr>
              <td><strong>FORGE</strong></td>
              <td><strong>Sí — plan en lenguaje claro</strong></td>
              <td><strong>Sí — antes de publicar</strong></td>
              <td><strong>Sí — modo guiado</strong></td>
            </tr>
          </tbody>
        </table>

        <h2>¿Necesito saber programar?</h2>
        <p>
          No. Absolutamente no. Si puedes describir lo que quieres en palabras
          normales, FORGE hace el resto. No necesitas saber qué es una "variable",
          una "API" o una "base de datos".
        </p>

        <div class="callout tip">
          <div class="callout-title">Empieza ahora mismo</div>
          <p>Abre Claude Code, escribe:</p>
          <pre><code class="lang-text">/sdd quiero una app para [tu idea]</code></pre>
          <p>
            FORGE te guía desde ahí. No necesitas configurar nada primero.
          </p>
        </div>

        <h2>¿Qué pasa exactamente después de que escribo mi idea?</h2>
        <ol>
          <li>FORGE entiende tu idea y te hace las preguntas necesarias (pocas, claras).</li>
          <li>Te muestra un plan en lenguaje normal. Tú lo revisas y apruebas.</li>
          <li>14 agentes especializados construyen tu producto en paralelo (tú esperas).</li>
          <li>Todo se audita automáticamente antes de publicar.</li>
          <li>Tu producto queda disponible en internet con una URL real.</li>
        </ol>
        <p>Tiempo típico: entre 10 y 30 minutos dependiendo de la complejidad de la idea.</p>
      `
    },
    en: {
      titulo: "Welcome to FORGE",
      html: `
        <h1>FORGE: from idea to product, no coding required</h1>
        <p class="lead">
          FORGE is a system that turns what you describe in plain words into real,
          working software on the internet. You talk, FORGE builds.
        </p>

        <div class="callout">
          <div class="callout-title">What does FORGE actually do?</div>
          <p>
            You describe what you want — an app, a tool, a website — the way you would
            explain it to a friend. FORGE understands your idea, turns it into a clear
            plan that you review, then builds it, tests it, and publishes it online.
            All without you writing a single line of code.
          </p>
        </div>

        <h2>Martina's story</h2>
        <p>
          Martina is a graphic designer. One Tuesday morning she thought: "I need a
          tool that generates my client quotes automatically." She doesn't know how to
          code. She opened Claude Code, described her idea in plain language, and by
          3:45 PM that same day her tool was live on the internet. Total time from idea
          to launch: less than two hours, most of it waiting for FORGE to do its work.
        </p>
        <p>
          In the first week, 23 clients used the tool. Martina wrote zero lines of code.
        </p>

        <h2>How is FORGE different from other tools?</h2>
        <table>
          <thead>
            <tr>
              <th>Tool</th>
              <th>Can you see the decisions?</th>
              <th>Auto-audits before publish?</th>
              <th>For non-coders?</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Bolt / v0</td>
              <td>No — black box</td>
              <td>No</td>
              <td>Partially</td>
            </tr>
            <tr>
              <td>ChatGPT</td>
              <td>Gives code, you review it</td>
              <td>No</td>
              <td>Very limited</td>
            </tr>
            <tr>
              <td><strong>FORGE</strong></td>
              <td><strong>Yes — plan in plain language</strong></td>
              <td><strong>Yes — before publishing</strong></td>
              <td><strong>Yes — guided mode</strong></td>
            </tr>
          </tbody>
        </table>

        <h2>Do I need to know how to code?</h2>
        <p>
          No. Absolutely not. If you can describe what you want in normal words,
          FORGE does the rest. You don't need to know what a "variable," an "API,"
          or a "database" is.
        </p>

        <div class="callout tip">
          <div class="callout-title">Start right now</div>
          <p>Open Claude Code and type:</p>
          <pre><code class="lang-text">/sdd I want an app for [your idea]</code></pre>
          <p>FORGE guides you from there. No setup needed first.</p>
        </div>

        <h2>What happens after I type my idea?</h2>
        <ol>
          <li>FORGE understands your idea and asks only the questions it needs (few, clear).</li>
          <li>It shows you a plan in plain language. You review and approve it.</li>
          <li>14 specialized agents build your product in parallel (you just wait).</li>
          <li>Everything is automatically audited before publishing.</li>
          <li>Your product goes live on the internet with a real URL.</li>
        </ol>
        <p>Typical time: 10 to 30 minutes depending on the complexity of your idea.</p>
      `
    }
  },

  "primeros-pasos": {
    seccion: "nodev",
    es: {
      titulo: "Primeros pasos",
      html: `
        <h1>Primeros pasos con FORGE</h1>
        <p class="lead">
          Desde cero hasta tu primera idea en marcha. Todo lo que necesitas hacer
          son dos cosas: instalar FORGE y escribir lo que quieres construir.
        </p>

        <h2>Antes de empezar: lo que necesitas</h2>
        <ul>
          <li><strong>Claude Code</strong> instalado en tu computadora</li>
          <li><strong>Node.js versión 18 o superior</strong> (un programa gratuito)</li>
          <li>Una carpeta para tu proyecto (puede ser nueva y vacía)</li>
        </ul>

        <div class="callout tip">
          <div class="callout-title">¿No tienes Node.js?</div>
          <p>
            Descárgalo gratis en <strong>nodejs.org</strong>. Elige la versión marcada
            como "LTS" (es la más estable). La instalación es como cualquier programa:
            siguiente, siguiente, instalar.
          </p>
        </div>

        <h2>Paso 1: Instalar FORGE</h2>
        <p>Abre la terminal (en Windows: PowerShell; en Mac: Terminal) dentro de tu carpeta de proyecto y escribe:</p>

        <pre><code class="lang-bash">npx sdd-es init</code></pre>

        <p>
          Eso es todo. FORGE se instala y queda listo para usarse con Claude Code.
          No necesitas hacer nada más.
        </p>

        <div class="callout">
          <div class="callout-title">¿Usas Windows?</div>
          <p>También puedes ejecutar el instalador incluido:</p>
          <pre><code class="lang-bash">.\instalar.ps1</code></pre>
        </div>

        <h2>Paso 2: Abrir Claude Code en tu proyecto</h2>
        <p>
          Abre Claude Code apuntando a la carpeta donde instalaste FORGE.
          Desde ese momento, FORGE está activo y listo.
        </p>

        <h2>Paso 3: Escribe tu primera idea</h2>
        <p>
          En Claude Code, escribe <code>/sdd</code> seguido de tu idea en lenguaje natural.
          Por ejemplo:
        </p>

        <pre><code class="lang-text">/sdd quiero una app para gestionar mis tareas del día</code></pre>

        <p>O simplemente:</p>

        <pre><code class="lang-text">/sdd</code></pre>

        <p>
          Si escribes solo <code>/sdd</code>, FORGE te pregunta qué quieres construir
          y te guía paso a paso. No tienes que saber cómo empezar; FORGE lo sabe por ti.
        </p>

        <h2>¿Qué pasa después?</h2>
        <p>FORGE entra en <strong>modo guiado</strong> y te lleva por cuatro pasos simples:</p>

        <ol>
          <li>
            <strong>Entender tu idea</strong> — te hace solo las preguntas necesarias
            para aclarar qué quieres exactamente.
          </li>
          <li>
            <strong>Hacer el plan</strong> — decide cómo construirlo y te lo explica
            en lenguaje claro. Tú lo revisas y dices "sí" o pides cambios.
          </li>
          <li>
            <strong>Construirlo</strong> — escribe el código, lo prueba y lo verifica.
            Tú esperas (entre 10 y 30 minutos).
          </li>
          <li>
            <strong>Publicarlo</strong> — lo sube a internet y te da la dirección (URL)
            para compartir con quien quieras.
          </li>
        </ol>

        <div class="callout tip">
          <div class="callout-title">Si algo no funciona</div>
          <p>Escribe:</p>
          <pre><code class="lang-text">/sdd ayuda</code></pre>
          <p>FORGE te explicará qué está pasando y qué hacer.</p>
        </div>

        <h2>¿Y si no tengo una idea clara todavía?</h2>
        <p>
          También puedes escribir algo vago, como "quiero algo para organizar mis
          recetas de cocina" o "necesito una herramienta para mis clientes". FORGE
          te hace preguntas para ayudarte a aclarar la idea antes de construir nada.
        </p>
      `
    },
    en: {
      titulo: "First steps",
      html: `
        <h1>First steps with FORGE</h1>
        <p class="lead">
          From scratch to your first idea up and running. All you need to do is
          two things: install FORGE and write what you want to build.
        </p>

        <h2>Before you start: what you need</h2>
        <ul>
          <li><strong>Claude Code</strong> installed on your computer</li>
          <li><strong>Node.js version 18 or higher</strong> (a free program)</li>
          <li>A folder for your project (can be brand new and empty)</li>
        </ul>

        <div class="callout tip">
          <div class="callout-title">Don't have Node.js?</div>
          <p>
            Download it for free at <strong>nodejs.org</strong>. Choose the version
            labeled "LTS" (most stable). Installation works like any other program:
            next, next, install.
          </p>
        </div>

        <h2>Step 1: Install FORGE</h2>
        <p>Open a terminal (on Windows: PowerShell; on Mac: Terminal) inside your project folder and type:</p>

        <pre><code class="lang-bash">npx sdd-es init</code></pre>

        <p>
          That's it. FORGE installs itself and is ready to use with Claude Code.
          You don't need to do anything else.
        </p>

        <div class="callout">
          <div class="callout-title">Using Windows?</div>
          <p>You can also run the bundled installer:</p>
          <pre><code class="lang-bash">.\instalar.ps1</code></pre>
        </div>

        <h2>Step 2: Open Claude Code in your project</h2>
        <p>
          Open Claude Code pointing to the folder where you installed FORGE.
          From that point on, FORGE is active and ready.
        </p>

        <h2>Step 3: Type your first idea</h2>
        <p>
          In Claude Code, type <code>/sdd</code> followed by your idea in plain language.
          For example:
        </p>

        <pre><code class="lang-text">/sdd I want an app to manage my daily tasks</code></pre>

        <p>Or simply:</p>

        <pre><code class="lang-text">/sdd</code></pre>

        <p>
          If you just type <code>/sdd</code>, FORGE asks what you want to build
          and guides you step by step. You don't need to know how to start; FORGE does.
        </p>

        <h2>What happens next?</h2>
        <p>FORGE enters <strong>guided mode</strong> and walks you through four simple steps:</p>

        <ol>
          <li>
            <strong>Understanding your idea</strong> — it asks only the questions
            needed to clarify exactly what you want.
          </li>
          <li>
            <strong>Making the plan</strong> — it decides how to build it and explains
            it in plain language. You review it and say "yes" or request changes.
          </li>
          <li>
            <strong>Building it</strong> — writes the code, tests it, and verifies it.
            You wait (10 to 30 minutes).
          </li>
          <li>
            <strong>Publishing it</strong> — uploads it to the internet and gives you
            a URL to share with anyone you like.
          </li>
        </ol>

        <div class="callout tip">
          <div class="callout-title">If something doesn't work</div>
          <p>Type:</p>
          <pre><code class="lang-text">/sdd help</code></pre>
          <p>FORGE will explain what's happening and what to do.</p>
        </div>

        <h2>What if I don't have a clear idea yet?</h2>
        <p>
          You can also type something vague, like "I want something to organize
          my cooking recipes" or "I need a tool for my clients." FORGE asks questions
          to help you clarify the idea before building anything.
        </p>
      `
    }
  },

  "primer-proyecto": {
    seccion: "nodev",
    es: {
      titulo: "Tu primer proyecto",
      html: `
        <h1>Tutorial: una app de lista de tareas, de la idea a internet</h1>
        <p class="lead">
          Sigamos juntos un proyecto real desde cero. Vamos a construir una app
          sencilla para gestionar tareas — el tipo de herramienta que cualquier
          persona necesita alguna vez. Verás exactamente qué pasa en cada paso.
        </p>

        <div class="callout tip">
          <div class="callout-title">Requisito previo</div>
          <p>
            Asegúrate de haber completado los <strong>Primeros pasos</strong>:
            Node.js instalado, FORGE inicializado con <code>npx sdd-es init</code>,
            y Claude Code abierto en tu proyecto.
          </p>
        </div>

        <h2>Paso 1: Describe tu idea</h2>
        <p>En Claude Code, escribe:</p>

        <pre><code class="lang-text">/sdd quiero una app para anotar mis tareas del día, marcarlas como hechas y organizarlas por prioridad</code></pre>

        <p>
          FORGE responde con algo así: <em>"Entendido, quieres una lista de tareas.
          Primero voy a entender bien los detalles, luego lo construyo y lo pruebo.
          ¿Arrancamos?"</em>
        </p>
        <p>Responde <strong>sí</strong>.</p>

        <h2>Paso 2: FORGE te hace preguntas</h2>
        <p>
          FORGE te preguntará cosas simples para entender mejor lo que necesitas.
          Por ejemplo:
        </p>
        <ul>
          <li>"¿Las tareas son solo para ti o también para otras personas?"</li>
          <li>"¿Quieres que las tareas se guarden entre sesiones?"</li>
          <li>"¿Necesitas que funcione en el teléfono?"</li>
        </ul>
        <p>
          Responde en tus propias palabras. No hay respuestas correctas o incorrectas.
          FORGE toma cada respuesta y ajusta el plan.
        </p>

        <h2>Paso 3: Revisa el plan</h2>
        <p>
          FORGE te muestra un plan explicado en lenguaje claro. Algo parecido a:
        </p>

        <div class="callout">
          <div class="callout-title">Plan de tu app de tareas</div>
          <ul>
            <li>Una página web donde puedes escribir tareas nuevas</li>
            <li>Botón para marcar cada tarea como completada</li>
            <li>Tres niveles de prioridad: alta, media, baja</li>
            <li>Las tareas se guardan aunque cierres la página</li>
            <li>Funciona en celular, tablet y computadora</li>
          </ul>
        </div>

        <p>
          Si el plan te parece bien, di <strong>"apruebo"</strong> o simplemente <strong>"sí"</strong>.
          Si quieres cambiar algo — por ejemplo, añadir fechas límite — díselo ahora
          en palabras normales. FORGE actualiza el plan al instante.
        </p>

        <h2>Paso 4: FORGE construye (tú esperas)</h2>
        <p>
          Una vez aprobado el plan, FORGE pone a trabajar a sus agentes especializados.
          Tú no tienes que hacer nada. El proceso tarda entre 5 y 15 minutos.
        </p>
        <p>
          Verás mensajes de progreso como: <em>"Construyendo la pantalla principal..."</em>,
          <em>"Preparando el guardado de datos..."</em>, <em>"Verificando que todo funcione..."</em>
        </p>

        <div class="callout warn">
          <div class="callout-title">No cierres Claude Code mientras construye</div>
          <p>
            Deja que FORGE termine. Si lo interrumpes, puedes retomar escribiendo
            <code>/sdd</code> y FORGE recordará dónde estaba.
          </p>
        </div>

        <h2>Paso 5: Verificación automática</h2>
        <p>
          Antes de publicar, FORGE comprueba automáticamente que todo funcione:
          que la app se vea bien en pantallas pequeñas, que las tareas se guarden
          correctamente, que no haya errores de seguridad.
        </p>
        <p>Recibirás un reporte simple. Si todo está bien, verás algo como:</p>

        <pre><code class="lang-text">✅ Código correcto
✅ Funciona en móvil y escritorio
✅ Datos se guardan correctamente
✅ Sin problemas de seguridad
Listo para publicar.</code></pre>

        <h2>Paso 6: Publicar en internet</h2>
        <p>
          FORGE te preguntará si quieres publicar. Di <strong>sí</strong>.
          Unos minutos después, recibirás una URL real — algo como
          <code>mi-app-tareas.vercel.app</code> — que puedes compartir con cualquier persona.
        </p>

        <div class="callout tip">
          <div class="callout-title">¡Listo! Tu app está en internet</div>
          <p>
            Puedes abrirla desde el teléfono, compartirla con amigos o usarla tú solo.
            Todo el código está guardado en GitHub, así que nada se pierde.
          </p>
        </div>

        <h2>¿Y si quiero cambiar algo después?</h2>
        <p>
          Fácil. Vuelve a Claude Code y describe el cambio en palabras normales:
          "quiero cambiar el color de los botones" o "agrega una papelera para
          recuperar tareas borradas". FORGE actualiza la app y la vuelve a publicar.
        </p>
      `
    },
    en: {
      titulo: "Your first project",
      html: `
        <h1>Tutorial: a to-do app, from idea to the internet</h1>
        <p class="lead">
          Let's walk through a real project together from scratch. We're going to build
          a simple app to manage tasks — the kind of tool anyone needs at some point.
          You'll see exactly what happens at every step.
        </p>

        <div class="callout tip">
          <div class="callout-title">Prerequisite</div>
          <p>
            Make sure you've completed <strong>First Steps</strong>: Node.js installed,
            FORGE initialized with <code>npx sdd-es init</code>, and Claude Code
            open in your project.
          </p>
        </div>

        <h2>Step 1: Describe your idea</h2>
        <p>In Claude Code, type:</p>

        <pre><code class="lang-text">/sdd I want an app to write down my daily tasks, mark them as done, and organize them by priority</code></pre>

        <p>
          FORGE responds with something like: <em>"Got it, you want a task list.
          First I'll make sure I understand the details, then I'll build and test it.
          Shall we start?"</em>
        </p>
        <p>Reply <strong>yes</strong>.</p>

        <h2>Step 2: FORGE asks you questions</h2>
        <p>
          FORGE will ask simple questions to better understand what you need.
          For example:
        </p>
        <ul>
          <li>"Are these tasks just for you or for other people too?"</li>
          <li>"Do you want tasks saved between sessions?"</li>
          <li>"Do you need it to work on a phone?"</li>
        </ul>
        <p>
          Answer in your own words. There are no right or wrong answers.
          FORGE takes each answer and adjusts the plan.
        </p>

        <h2>Step 3: Review the plan</h2>
        <p>
          FORGE shows you a plan explained in plain language. Something like:
        </p>

        <div class="callout">
          <div class="callout-title">Plan for your task app</div>
          <ul>
            <li>A web page where you can write new tasks</li>
            <li>A button to mark each task as complete</li>
            <li>Three priority levels: high, medium, low</li>
            <li>Tasks are saved even if you close the page</li>
            <li>Works on phone, tablet, and computer</li>
          </ul>
        </div>

        <p>
          If the plan looks good, say <strong>"approve"</strong> or just <strong>"yes"</strong>.
          If you want to change something — for example, add due dates — say so now
          in plain words. FORGE updates the plan instantly.
        </p>

        <h2>Step 4: FORGE builds it (you wait)</h2>
        <p>
          Once the plan is approved, FORGE puts its specialized agents to work.
          You don't have to do anything. The process takes 5 to 15 minutes.
        </p>
        <p>
          You'll see progress messages like: <em>"Building the main screen..."</em>,
          <em>"Setting up data storage..."</em>, <em>"Verifying everything works..."</em>
        </p>

        <div class="callout warn">
          <div class="callout-title">Don't close Claude Code while it's building</div>
          <p>
            Let FORGE finish. If you interrupt it, you can resume by typing
            <code>/sdd</code> and FORGE will remember where it left off.
          </p>
        </div>

        <h2>Step 5: Automatic verification</h2>
        <p>
          Before publishing, FORGE automatically checks that everything works:
          the app looks good on small screens, tasks save correctly, no security issues.
        </p>
        <p>You'll receive a simple report. If everything is fine, you'll see something like:</p>

        <pre><code class="lang-text">✅ Code correct
✅ Works on mobile and desktop
✅ Data saves correctly
✅ No security issues
Ready to publish.</code></pre>

        <h2>Step 6: Publish to the internet</h2>
        <p>
          FORGE will ask if you want to publish. Say <strong>yes</strong>.
          A few minutes later you'll receive a real URL — something like
          <code>my-task-app.vercel.app</code> — that you can share with anyone.
        </p>

        <div class="callout tip">
          <div class="callout-title">Done! Your app is on the internet</div>
          <p>
            You can open it from your phone, share it with friends, or use it yourself.
            All the code is saved in GitHub, so nothing is lost.
          </p>
        </div>

        <h2>What if I want to change something later?</h2>
        <p>
          Easy. Go back to Claude Code and describe the change in plain words:
          "change the button color" or "add a trash bin to recover deleted tasks."
          FORGE updates the app and republishes it.
        </p>
      `
    }
  },

  "que-hace-forge": {
    seccion: "nodev",
    es: {
      titulo: "¿Qué hace FORGE?",
      html: `
        <h1>El pipeline de FORGE: tu fábrica de software</h1>
        <p class="lead">
          FORGE no es una varita mágica que adivina lo que quieres. Es una fábrica
          organizada con pasos claros. Cada paso tiene un propósito, y tú ves lo que
          ocurre en cada uno.
        </p>

        <div class="callout">
          <div class="callout-title">La metáfora de la fábrica</div>
          <p>
            Imagina una fábrica de muebles. Tú traes el plano (tu idea), el equipo
            de diseño lo convierte en instrucciones precisas, los carpinteros construyen
            cada pieza, control de calidad lo revisa todo, y al final te lo entregan
            en casa. FORGE funciona igual, pero para software.
          </p>
        </div>

        <h2>Las 6 fases del pipeline</h2>

        <h3>1. Descubrir — <span class="pill pill-nodev">Entender tu idea</span></h3>
        <p>
          FORGE te hace preguntas simples para entender qué quieres construir.
          No tecnicismos, no jerga. Solo: ¿para qué sirve? ¿quién lo usará?
          ¿qué es lo más importante? Esta fase termina cuando FORGE tiene una
          imagen clara de tu idea.
        </p>

        <h3>2. Especificar — <span class="pill pill-nodev">El contrato</span></h3>
        <p>
          Con la idea clara, FORGE escribe una especificación: un documento que
          describe exactamente qué hará tu producto. Tú lo revisas. Si algo no
          refleja lo que querías, lo cambias antes de que empiece la construcción.
          Es como revisar los planos antes de que empiecen a construir.
        </p>

        <h3>3. Planificar — <span class="pill pill-nodev">La estrategia</span></h3>
        <p>
          FORGE decide cómo construirlo: qué piezas necesita, cómo se comunicarán
          entre ellas, en qué orden se construyen. Tú ves el plan en lenguaje claro
          y lo apruebas. Si quieres añadir algo o cambiar una decisión, es el momento.
        </p>

        <h3>4. Implementar — <span class="pill pill-nodev">La construcción</span></h3>
        <p>
          14 agentes especializados trabajan en paralelo para construir tu producto.
          Uno diseña la base de datos, otro construye lo que ves en pantalla, otro
          implementa la lógica, otro integra los pagos si los hay. Tú esperas.
          Normalmente entre 5 y 20 minutos.
        </p>

        <div class="callout">
          <div class="callout-title">Los 14 agentes</div>
          <ul>
            <li>Arquitectura — cómo se comunican todas las partes</li>
            <li>Base de datos — dónde se guardan tus datos</li>
            <li>Pantalla — lo que ves y tocas</li>
            <li>Lógica — los cálculos y reglas de negocio</li>
            <li>Seguridad — que nadie pueda ver lo que no debe</li>
            <li>Integraciones — pagos, email, análisis</li>
            <li>Tests — pruebas automáticas de cada función</li>
            <li>Rendimiento — que cargue rápido</li>
            <li>Documentación — instrucciones claras</li>
            <li>Despliegue — preparar para publicar</li>
            <li>Servidores — configurar la infraestructura</li>
            <li>Auditoría — revisar cada decisión</li>
          </ul>
        </div>

        <h3>5. Verificar — <span class="pill pill-nodev">Control de calidad</span></h3>
        <p>
          Antes de publicar, FORGE audita automáticamente todo. ¿Funciona en móvil?
          ¿Los datos se guardan bien? ¿Hay algún agujero de seguridad? ¿Carga rápido?
          Si algo falla, FORGE lo arregla y vuelve a verificar. Solo te llega lo
          que ya pasó todos los controles.
        </p>

        <h3>6. Desplegar — <span class="pill pill-nodev">En internet</span></h3>
        <p>
          FORGE publica tu producto en internet con una URL real, certificado de
          seguridad (el candado verde del navegador) y un servidor que puede
          manejar miles de visitas. Tu código queda guardado en GitHub con
          historial completo de todos los cambios.
        </p>

        <h2>¿Tienes que hacer algo en cada paso?</h2>
        <table>
          <thead>
            <tr>
              <th>Fase</th>
              <th>Tú haces</th>
              <th>FORGE hace</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Descubrir</td>
              <td>Respondes preguntas simples</td>
              <td>Entiende y estructura tu idea</td>
            </tr>
            <tr>
              <td>Especificar</td>
              <td>Revisas y apruebas</td>
              <td>Escribe el documento de lo que hará el producto</td>
            </tr>
            <tr>
              <td>Planificar</td>
              <td>Revisas y apruebas</td>
              <td>Decide cómo construirlo</td>
            </tr>
            <tr>
              <td>Implementar</td>
              <td>Esperas</td>
              <td>14 agentes construyen en paralelo</td>
            </tr>
            <tr>
              <td>Verificar</td>
              <td>Ves el reporte</td>
              <td>Audita y arregla automáticamente</td>
            </tr>
            <tr>
              <td>Desplegar</td>
              <td>Confirmas con "sí"</td>
              <td>Publica en internet</td>
            </tr>
          </tbody>
        </table>

        <div class="callout tip">
          <div class="callout-title">Tu participación total: unos 15 minutos</div>
          <p>
            El tiempo de espera donde FORGE trabaja puede ser 5-20 minutos más.
            Pero tu esfuerzo activo — responder preguntas, revisar planes, confirmar —
            rara vez supera los 15 minutos en total.
          </p>
        </div>
      `
    },
    en: {
      titulo: "What does FORGE do?",
      html: `
        <h1>The FORGE pipeline: your software factory</h1>
        <p class="lead">
          FORGE isn't a magic wand that guesses what you want. It's an organized
          factory with clear steps. Each step has a purpose, and you can see
          what happens at every one.
        </p>

        <div class="callout">
          <div class="callout-title">The factory metaphor</div>
          <p>
            Imagine a furniture factory. You bring the sketch (your idea), the design
            team turns it into precise instructions, the carpenters build each piece,
            quality control checks everything, and then it's delivered to your door.
            FORGE works the same way, but for software.
          </p>
        </div>

        <h2>The 6 pipeline phases</h2>

        <h3>1. Discover — <span class="pill pill-nodev">Understanding your idea</span></h3>
        <p>
          FORGE asks you simple questions to understand what you want to build.
          No jargon, no technical terms. Just: what is it for? who will use it?
          what matters most? This phase ends when FORGE has a clear picture of your idea.
        </p>

        <h3>2. Specify — <span class="pill pill-nodev">The contract</span></h3>
        <p>
          With a clear idea, FORGE writes a specification: a document describing
          exactly what your product will do. You review it. If something doesn't
          match what you wanted, you change it before construction begins.
          Like reviewing blueprints before the builders arrive.
        </p>

        <h3>3. Plan — <span class="pill pill-nodev">The strategy</span></h3>
        <p>
          FORGE decides how to build it: what pieces are needed, how they'll
          communicate, in what order they'll be built. You see the plan in plain
          language and approve it. If you want to add or change something, now's the time.
        </p>

        <h3>4. Implement — <span class="pill pill-nodev">Construction</span></h3>
        <p>
          14 specialized agents work in parallel to build your product.
          One designs the database, one builds what you see on screen, one
          implements the logic, one integrates payments if needed. You wait.
          Usually 5 to 20 minutes.
        </p>

        <div class="callout">
          <div class="callout-title">The 14 agents</div>
          <ul>
            <li>Architecture — how all parts communicate</li>
            <li>Database — where your data is stored</li>
            <li>Screen — what you see and touch</li>
            <li>Logic — the calculations and business rules</li>
            <li>Security — keeping private data private</li>
            <li>Integrations — payments, email, analytics</li>
            <li>Tests — automatic checks for every feature</li>
            <li>Performance — making it load fast</li>
            <li>Documentation — clear instructions</li>
            <li>Deployment — preparing to publish</li>
            <li>Servers — setting up infrastructure</li>
            <li>Audit — reviewing every decision</li>
            <li>Product design — wireframes and UX</li>
            <li>System architecture — technical blueprint</li>
          </ul>
        </div>

        <h3>5. Verify — <span class="pill pill-nodev">Quality control</span></h3>
        <p>
          Before publishing, FORGE automatically audits everything. Does it work
          on mobile? Does data save correctly? Are there any security gaps? Does it
          load fast? If something fails, FORGE fixes it and verifies again. Only
          what passed every check reaches you.
        </p>

        <h3>6. Deploy — <span class="pill pill-nodev">On the internet</span></h3>
        <p>
          FORGE publishes your product online with a real URL, a security certificate
          (the green padlock in your browser), and a server that can handle thousands
          of visits. Your code is saved in GitHub with a complete history of every change.
        </p>

        <h2>Do you have to do anything at each step?</h2>
        <table>
          <thead>
            <tr>
              <th>Phase</th>
              <th>You do</th>
              <th>FORGE does</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Discover</td>
              <td>Answer simple questions</td>
              <td>Understands and structures your idea</td>
            </tr>
            <tr>
              <td>Specify</td>
              <td>Review and approve</td>
              <td>Writes what the product will do</td>
            </tr>
            <tr>
              <td>Plan</td>
              <td>Review and approve</td>
              <td>Decides how to build it</td>
            </tr>
            <tr>
              <td>Implement</td>
              <td>Wait</td>
              <td>14 agents build in parallel</td>
            </tr>
            <tr>
              <td>Verify</td>
              <td>Read the report</td>
              <td>Audits and fixes automatically</td>
            </tr>
            <tr>
              <td>Deploy</td>
              <td>Confirm with "yes"</td>
              <td>Publishes to the internet</td>
            </tr>
          </tbody>
        </table>

        <div class="callout tip">
          <div class="callout-title">Your total involvement: about 15 minutes</div>
          <p>
            The waiting time while FORGE works can be 5–20 minutes more.
            But your active effort — answering questions, reviewing plans, confirming —
            rarely exceeds 15 minutes in total.
          </p>
        </div>
      `
    }
  },

  "como-funciona": {
    seccion: "nodev",
    es: {
      titulo: "Cómo funciona FORGE paso a paso",
      html: `
        <h1>Cómo funciona FORGE — Paso a paso sin jerga técnica</h1>
        <p class="lead">FORGE es una fábrica de software. Tú describes qué quieres, y la fábrica lo construye, lo verifica y lo publica. Sin necesidad de programar. Aquí está exactamente cómo.</p>

        <h2>Los 5 pasos (de principio a fin)</h2>

        <h3>Paso 1 — Tú describes tu idea (en lenguaje normal)</h3>
        <p>No necesitas dibujos, especificaciones técnicas ni palabras raras como "API" o "base de datos". Solo describes qué quieres:</p>
        <blockquote>
          <p>"Necesito un formulario que haga 3 preguntas sobre el proyecto, calcule automáticamente el presupuesto, y guarde los datos para que yo después pueda verlos en una lista. Quiero que se vea profesional."</p>
        </blockquote>
        <p><strong>Tiempo de tu trabajo:</strong> 5 minutos escribiendo</p>

        <h3>Paso 2 — FORGE entiende y crea un plan</h3>
        <p>FORGE lee tu descripción y crea un plan detallado, pero en lenguaje que TÚ entiendes:</p>
        <div class="callout">
          <div class="callout-title">Ejemplo de plan generado</div>
          <pre><code>📋 PLAN DE CONSTRUCCIÓN

Página web con:
- Un formulario de 3 preguntas
- Cálculo de presupuesto (regla: X + Y × Z)
- Tabla para ver todos los presupuestos guardados
- Funciona en celular, tablet y computadora
- Colores profesionales

Base de datos:
- Guardará: pregunta 1, pregunta 2, pregunta 3, presupuesto, fecha

Seguridad:
- Solo tú puedes ver los presupuestos
- Los datos están encriptados</code></pre>
        </div>
        <p><strong>¿Te gusta el plan?</strong> Si quieres cambiar algo, lo cambias ahora (antes de construir). Si quieres agregar algo, lo agregas. Esto es como cambiar el plano de una casa ANTES de que empiecen a construir.</p>
        <p><strong>Tiempo de tu trabajo:</strong> 2-3 minutos revisando y aprobando el plan</p>

        <h3>Paso 3 — 14 agentes especializados construyen en paralelo</h3>
        <p>Una vez aprobado el plan, FORGE activa 14 especialistas que trabajan AL MISMO TIEMPO:</p>
        <table>
          <tr><th>Especialista</th><th>Qué hace</th></tr>
          <tr><td><strong>Arquitecto</strong></td><td>Diseña cómo se comunicarán todas las partes</td></tr>
          <tr><td><strong>Diseñador de base de datos</strong></td><td>Crea dónde se guardarán los datos</td></tr>
          <tr><td><strong>Diseñador de pantalla</strong></td><td>Construye lo que ves (botones, colores, formularios)</td></tr>
          <tr><td><strong>Lógica de negocio</strong></td><td>Implementa los cálculos (presupuesto, etc.)</td></tr>
          <tr><td><strong>Seguridad</strong></td><td>Se asegura de que nadie vea datos que no debe</td></tr>
          <tr><td><strong>Tester</strong></td><td>Escribe pruebas automáticas para cada función</td></tr>
          <tr><td><strong>Documentación</strong></td><td>Escribe instrucciones claras</td></tr>
          <tr><td><strong>DevOps</strong></td><td>Configura los servidores</td></tr>
          <tr><td colspan="2">... y 6 especialistas más trabajando en paralelo</td></tr>
        </table>
        <p><strong>Mientras todo esto ocurre:</strong> Tú esperas. No necesitas hacer nada. Toman 5-15 minutos dependiendo de qué tan complicado sea.</p>
        <p><strong>Tiempo de tu trabajo:</strong> 0 minutos (FORGE trabaja automáticamente)</p>

        <h3>Paso 4 — Verificación automática antes de publicar</h3>
        <p>Antes de publicar en internet, FORGE revisa TODO automáticamente:</p>
        <ul>
          <li><strong>Seguridad:</strong> ¿Hay vulnerabilidades? ¿Están protegidos los datos personales?</li>
          <li><strong>Funcionalidad:</strong> ¿El formulario funciona? ¿Los cálculos son correctos? ¿Se guardan los datos?</li>
          <li><strong>Compatibilidad:</strong> ¿Funciona en celular, tablet, computadora? ¿En Chrome, Safari, Firefox?</li>
          <li><strong>Velocidad:</strong> ¿Carga en menos de 3 segundos? ¿Puede manejar 1000 usuarios a la vez?</li>
        </ul>
        <p>Si algo no está bien, FORGE lo arregla automáticamente y vuelve a revisar. Si encuentra un problema que no puede arreglar solo, te lo reporta en lenguaje claro (no jerga técnica).</p>
        <p><strong>Tiempo de tu trabajo:</strong> 0-2 minutos (solo si hay algo que aprueba)</p>

        <h3>Paso 5 — Tu sitio está en internet</h3>
        <p>Una vez verificado, FORGE publica tu sitio automáticamente:</p>
        <ul>
          <li>✅ URL profesional (puedes usar tu dominio o uno que FORGE crea)</li>
          <li>✅ Certificado de seguridad (la lucecita verde en el navegador)</li>
          <li>✅ En un servidor rápido que maneja miles de visitantes</li>
          <li>✅ Con backups automáticos (si algo falla, se recupera solo)</li>
        </ul>
        <p>Tú compartes el link. Tus usuarios usan la herramienta. Eso es todo.</p>
        <p><strong>Tiempo de tu trabajo:</strong> 1 minuto compartiendo el link</p>

        <h2>Entonces... ¿cuánto tiempo toma de principio a fin?</h2>
        <table>
          <tr><th>Fase</th><th>Tiempo total</th><th>Tu esfuerzo</th></tr>
          <tr><td>Describir idea</td><td>5 min</td><td>✅ Tú escribes</td></tr>
          <tr><td>Revisar plan</td><td>3 min</td><td>✅ Tú apruebas</td></tr>
          <tr><td>FORGE construye</td><td>5-15 min</td><td>❌ FORGE trabaja</td></tr>
          <tr><td>Verificación</td><td>1-3 min</td><td>❌ FORGE revisa</td></tr>
          <tr><td>Publicación</td><td>1 min</td><td>❌ FORGE publica</td></tr>
          <tr><td colspan="2"><strong>TOTAL: 15-27 minutos</strong></td><td><strong>~10 min tuyo</strong></td></tr>
        </table>

        <h2>¿Qué necesito para empezar?</h2>
        <ul>
          <li>✅ Claude Code instalado (gratis)</li>
          <li>✅ Una idea (en tu cabeza o escriba)</li>
          <li>✅ Nada más</li>
        </ul>

        <h2>¿No sé programar. ¿Es problema?</h2>
        <p><strong>No es problema en absoluto.</strong> FORGE está diseñado exactamente para personas que no saben programar. No necesitas:</p>
        <ul>
          <li>❌ Saber qué es una "variable" o una "función"</li>
          <li>❌ Entender "HTML" o "CSS"</li>
          <li>❌ Conocer bases de datos</li>
          <li>❌ Tener experiencia técnica</li>
        </ul>
        <p>Solo necesitas saber describir lo que quieres en palabras normales.</p>

        <h2>¿Y si me arrepiento después de publicar?</h2>
        <p><strong>Sin problema.</strong> Puedes:</p>
        <ul>
          <li>Cambiar el color de un botón (5 minutos, publicado en 3 minutos)</li>
          <li>Agregar una pregunta nueva al formulario (10 minutos, publicado en 5)</li>
          <li>Volver a cómo estaba hace 2 horas (1 minuto)</li>
          <li>Cambiar completamente de idea (reinicia el proceso, 15 minutos)</li>
        </ul>
        <p>Todo está guardado en GitHub. Nada se pierde. Nada es permanente.</p>

        <h2>Ejemplo real: Presupuestador de diseño gráfico</h2>
        <blockquote>
          <p>Martina es diseñadora. Sus clientes siempre le preguntaban por presupuestos y ella escribía el mismo email 20 veces al día. Con FORGE:</p>
          <p><strong>14:00</strong> — Escribe: "Necesito un formulario que pregunta sobre el tipo de trabajo (logo, identidad, sitio web), urgencia, cantidad de revisiones, y calcula automáticamente el presupuesto"</p>
          <p><strong>14:15</strong> — FORGE crea un plan, Martina lo aprueba (pequeño cambio: quiero que pregunte también el presupuesto del cliente)</p>
          <p><strong>14:45</strong> — 14 agentes terminan. FORGE verifica todo.</p>
          <p><strong>15:00</strong> — En vivo. Martina comparte el link.</p>
          <p><strong>Semana 1:</strong> 25 clientes usan la herramienta, Martina ahorró 50 horas de email.</p>
        </blockquote>

        <h2>¿Cuál es el "truco"?</h2>
        <p>No hay truco. FORGE simplemente:</p>
        <ol>
          <li>Te pide que seas específico (en el plan)</li>
          <li>Delega el trabajo a especialistas (14 agentes)</li>
          <li>Verifica el resultado automáticamente</li>
          <li>Publica cuando está listo</li>
        </ol>
        <p>Es como una agencia de desarrollo, pero automática. Sin reuniones, sin "oye, eso va a tomar 2 semanas", sin sorpresas. Solo ideas → código en vivo.</p>

        <div class="callout tip">
          <div class="callout-title">Próximo paso</div>
          <p>Abre Claude Code y escribe: <code>/sdd.constitucion</code></p>
          <p>FORGE te hará 5 preguntas sobre tu proyecto. Luego de eso, estarás listo para crear tu primer proyecto.</p>
        </div>
      `
    },
    en: {
      titulo: "How FORGE works — step by step",
      html: `
        <h1>How FORGE Works — Step by Step (No Jargon)</h1>
        <p class="lead">FORGE is a software factory. You describe what you want, and the factory builds it, verifies it, and publishes it. No programming needed. Here's exactly how.</p>

        <h2>The 5 Steps (start to finish)</h2>

        <h3>Step 1 — You describe your idea (in normal language)</h3>
        <p>No diagrams, technical specs, or weird words like "API" or "database". Just describe what you want:</p>
        <blockquote>
          <p>"I need a form that asks 3 questions about the project, automatically calculates a quote, and saves the data so I can view it later in a list. I want it to look professional."</p>
        </blockquote>
        <p><strong>Your effort:</strong> 5 minutes typing</p>

        <h3>Step 2 — FORGE understands and creates a plan</h3>
        <p>FORGE reads your description and creates a detailed plan, but in language YOU understand:</p>
        <div class="callout">
          <p><strong>Example plan:</strong> Web page with a 3-question form, auto-calculated quote, table to view all saved quotes, works on mobile/tablet/desktop, professional colors. Database stores answers + quote + date. Only you see the quotes. Data encrypted.</p>
        </div>
        <p><strong>Like it?</strong> If you want changes, make them now (before building). If you want to add something, add it. Like changing a house blueprint BEFORE construction starts.</p>
        <p><strong>Your effort:</strong> 2-3 minutes reviewing and approving</p>

        <h3>Step 3 — 14 specialist agents build in parallel</h3>
        <p>Once approved, FORGE activates 14 specialists working AT THE SAME TIME:</p>
        <ul>
          <li><strong>Architect</strong> — designs how all parts communicate</li>
          <li><strong>Database designer</strong> — creates where data is stored</li>
          <li><strong>Screen designer</strong> — builds what you see (buttons, colors, forms)</li>
          <li><strong>Business logic</strong> — implements calculations</li>
          <li><strong>Security</strong> — ensures no unauthorized data access</li>
          <li><strong>Tester</strong> — writes automated tests for everything</li>
          <li><strong>Documentation</strong> — writes clear instructions</li>
          <li><strong>DevOps</strong> — configures servers</li>
          <li>... and 6 more specialists working in parallel</li>
        </ul>
        <p><strong>While this happens:</strong> You wait. Takes 5-15 minutes depending on complexity.</p>
        <p><strong>Your effort:</strong> 0 minutes (FORGE works automatically)</p>

        <h3>Step 4 — Automatic verification before publishing</h3>
        <p>Before going live, FORGE checks EVERYTHING automatically:</p>
        <ul>
          <li><strong>Security:</strong> Vulnerabilities? Personal data protected?</li>
          <li><strong>Works:</strong> Forms functional? Calculations correct? Data saved?</li>
          <li><strong>Compatible:</strong> Mobile, tablet, desktop? Chrome, Safari, Firefox?</li>
          <li><strong>Fast:</strong> Loads under 3 seconds? Handles 1000 users?</li>
        </ul>
        <p><strong>Your effort:</strong> 0-2 minutes (approval only if needed)</p>

        <h3>Step 5 — Your site is live on the internet</h3>
        <p>Once verified, FORGE publishes automatically:</p>
        <ul>
          <li>✅ Professional URL (your domain or one FORGE creates)</li>
          <li>✅ Security certificate (the green lock in browser)</li>
          <li>✅ Fast server handling thousands of visitors</li>
          <li>✅ Automatic backups (recovers if something fails)</li>
        </ul>
        <p>You share the link. Users use the tool. Done.</p>
        <p><strong>Your effort:</strong> 1 minute sharing the link</p>

        <h2>Total time from start to live?</h2>
        <table>
          <tr><th>Phase</th><th>Total time</th><th>Your effort</th></tr>
          <tr><td>Describe idea</td><td>5 min</td><td>✅ You write</td></tr>
          <tr><td>Review plan</td><td>3 min</td><td>✅ You approve</td></tr>
          <tr><td>FORGE builds</td><td>5-15 min</td><td>❌ FORGE works</td></tr>
          <tr><td>Verification</td><td>1-3 min</td><td>❌ FORGE checks</td></tr>
          <tr><td>Publishing</td><td>1 min</td><td>❌ FORGE publishes</td></tr>
          <tr><td colspan="2"><strong>TOTAL: 15-27 minutes</strong></td><td><strong>~10 min yours</strong></td></tr>
        </table>

        <h2>What do I need to start?</h2>
        <ul>
          <li>✅ Claude Code installed (free)</li>
          <li>✅ An idea</li>
          <li>✅ That's it</li>
        </ul>

        <h2>I don't know how to code. Is that a problem?</h2>
        <p><strong>Not at all.</strong> FORGE is built for people who don't code. You don't need to know:</p>
        <ul>
          <li>❌ Variables or functions</li>
          <li>❌ HTML or CSS</li>
          <li>❌ Databases</li>
          <li>❌ Any technical experience</li>
        </ul>
        <p>Just describe what you want in normal words.</p>

        <h2>What if I change my mind after publishing?</h2>
        <p><strong>No problem.</strong> You can:</p>
        <ul>
          <li>Change a button color (5 min, live in 3)</li>
          <li>Add a question (10 min, live in 5)</li>
          <li>Revert to 2 hours ago (1 minute)</li>
          <li>Completely change direction (15 min restart)</li>
        </ul>
        <p>Everything is in GitHub. Nothing is lost. Nothing is permanent.</p>

        <div class="callout tip">
          <div class="callout-title">Next step</div>
          <p>Open Claude Code and type: <code>/sdd.constitucion</code></p>
          <p>FORGE will ask 5 questions about your project. After that, you're ready to build.</p>
        </div>
      `
    }
  },

  "cuando-falla": {
    seccion: "nodev",
    es: {
      titulo: "Cuando algo falla",
      html: `
        <h1>Cuando algo sale mal</h1>
        <p class="lead">
          Cosas inesperadas pasan. Pero con FORGE, nada es permanente y nada se pierde.
          Esta página te explica qué hacer en las situaciones más comunes.
        </p>

        <div class="callout">
          <div class="callout-title">Lo más importante antes de cualquier otra cosa</div>
          <ul>
            <li>Tu código está siempre guardado en GitHub (historial completo).</li>
            <li>Puedes volver a una versión anterior en cualquier momento.</li>
            <li>No hay error que no se pueda resolver. Solo describir el problema.</li>
          </ul>
        </div>

        <h2>Situación 1: "La publicación falló — mi app no está en internet"</h2>
        <p>
          Puede pasar por razones técnicas menores: un archivo que no se generó,
          una configuración que falta. Lo importante es que tu código está intacto.
        </p>
        <p><strong>Qué hacer:</strong></p>
        <ol>
          <li>Di a FORGE: <em>"El deploy falló, ¿puedes intentarlo de nuevo?"</em></li>
          <li>FORGE reintenta automáticamente.</li>
          <li>Si el error persiste, FORGE te explica qué salió mal en lenguaje claro y cómo arreglarlo.</li>
        </ol>
        <p>
          Si no quieres lidiar con eso ahora, di: <em>"Déjalo para después."</em>
          FORGE guarda el estado. Puedes retomarlo mañana y nada se habrá perdido.
        </p>

        <h2>Situación 2: "Cambié de idea a mitad del proceso"</h2>
        <p>Normal. Las ideas evolucionan. FORGE está diseñado para esto.</p>
        <p><strong>Qué hacer:</strong></p>
        <ol>
          <li>Escribe <code>/sdd</code> y describe el cambio: <em>"Quiero agregar reservas con calendario"</em>.</li>
          <li>FORGE detecta que ya hay un proyecto y te pregunta si quieres actualizar el plan.</li>
          <li>La versión anterior sigue guardada. Si cambias de idea de vuelta, puedes recuperarla.</li>
        </ol>

        <h2>Situación 3: "Un usuario me dijo que algo no funciona"</h2>
        <p><strong>Qué hacer:</strong></p>
        <ol>
          <li>Describe el problema a FORGE: <em>"Mi cliente dice que el formulario no calcula el precio"</em>.</li>
          <li>FORGE reproduce el problema, identifica la causa y te dice qué encontró.</li>
          <li>Di cómo debería funcionar: <em>"El precio para logo básico debería ser 300"</em>.</li>
          <li>FORGE arregla, prueba y vuelve a publicar.</li>
        </ol>

        <div class="callout tip">
          <div class="callout-title">A veces es solo el caché del navegador</div>
          <p>
            Si un usuario ve algo raro, pídele que presione <strong>Ctrl + F5</strong>
            (Windows) o <strong>Cmd + Shift + R</strong> (Mac). Eso borra la copia
            antigua del sitio de su navegador y carga la versión actualizada.
          </p>
        </div>

        <h2>Situación 4: "Quiero volver a como estaba antes"</h2>
        <p>
          Di a FORGE: <em>"Vuelve a como estaba hace dos horas"</em> o
          <em>"La versión anterior estaba mejor."</em>
        </p>
        <p>
          FORGE va a GitHub, encuentra esa versión y la vuelve a publicar.
          Tu sitio queda igual que antes. Sin pérdida de datos.
        </p>

        <h2>Situación 5: "Algo raro pasa y no sé qué es"</h2>
        <p>
          Di a FORGE: <em>"Algo no está funcionando bien."</em>
          FORGE ejecuta un diagnóstico completo:
        </p>
        <pre><code class="lang-text">Revisando código...      ✅ Correcto
Revisando base de datos... ❌ No conecta
Causa probable: el archivo de base de datos se eliminó.
Solución: voy a restaurar desde GitHub...</code></pre>
        <p>
          FORGE te dice qué encontró en lenguaje claro y, si puede arreglarlo
          solo, lo hace. Si necesita tu confirmación, te lo pide.
        </p>

        <h2>Resumen: no hay error sin solución</h2>
        <table>
          <thead>
            <tr>
              <th>Problema</th>
              <th>¿Se pierde algo?</th>
              <th>Tiempo para resolver</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Publicación falló</td>
              <td>No</td>
              <td>2 minutos (reintento)</td>
            </tr>
            <tr>
              <td>Cambié de idea</td>
              <td>No (versión anterior guardada)</td>
              <td>10 minutos (ajustar plan)</td>
            </tr>
            <tr>
              <td>Bug reportado por usuario</td>
              <td>No</td>
              <td>5 minutos (fix + republicación)</td>
            </tr>
            <tr>
              <td>Quiero la versión anterior</td>
              <td>No</td>
              <td>2 minutos (rollback)</td>
            </tr>
            <tr>
              <td>Algo raro sin identificar</td>
              <td>No</td>
              <td>5-10 minutos (diagnóstico)</td>
            </tr>
          </tbody>
        </table>

        <div class="callout tip">
          <div class="callout-title">El mantra de FORGE</div>
          <p>
            Tu código está seguro. Cualquier cambio es reversible. No hay decisión
            que no puedas deshacer.
          </p>
        </div>
      `
    },
    en: {
      titulo: "When something fails",
      html: `
        <h1>When something goes wrong</h1>
        <p class="lead">
          Unexpected things happen. But with FORGE, nothing is permanent and nothing
          is lost. This page explains what to do in the most common situations.
        </p>

        <div class="callout">
          <div class="callout-title">The most important thing, before anything else</div>
          <ul>
            <li>Your code is always saved in GitHub (complete history).</li>
            <li>You can go back to any previous version at any time.</li>
            <li>There's no error that can't be resolved. Just describe the problem.</li>
          </ul>
        </div>

        <h2>Situation 1: "Publishing failed — my app isn't on the internet"</h2>
        <p>
          This can happen for minor technical reasons: a file that didn't generate,
          a missing configuration. What matters is that your code is intact.
        </p>
        <p><strong>What to do:</strong></p>
        <ol>
          <li>Tell FORGE: <em>"The deploy failed, can you try again?"</em></li>
          <li>FORGE retries automatically.</li>
          <li>If the error persists, FORGE explains what went wrong in plain language and how to fix it.</li>
        </ol>
        <p>
          If you don't want to deal with it now, say: <em>"Leave it for later."</em>
          FORGE saves the state. You can pick it up tomorrow and nothing will be lost.
        </p>

        <h2>Situation 2: "I changed my mind mid-process"</h2>
        <p>Totally normal. Ideas evolve. FORGE is designed for this.</p>
        <p><strong>What to do:</strong></p>
        <ol>
          <li>Type <code>/sdd</code> and describe the change: <em>"I want to add calendar bookings."</em></li>
          <li>FORGE detects an existing project and asks if you want to update the plan.</li>
          <li>The previous version stays saved. If you change your mind back, you can recover it.</li>
        </ol>

        <h2>Situation 3: "A user told me something isn't working"</h2>
        <p><strong>What to do:</strong></p>
        <ol>
          <li>Describe the problem to FORGE: <em>"My client says the form doesn't calculate the price."</em></li>
          <li>FORGE reproduces the problem, identifies the cause, and tells you what it found.</li>
          <li>Say how it should work: <em>"The price for a basic logo should be 300."</em></li>
          <li>FORGE fixes, tests, and republishes.</li>
        </ol>

        <div class="callout tip">
          <div class="callout-title">Sometimes it's just the browser cache</div>
          <p>
            If a user sees something odd, ask them to press <strong>Ctrl + F5</strong>
            (Windows) or <strong>Cmd + Shift + R</strong> (Mac). That clears the old
            copy from their browser and loads the updated version.
          </p>
        </div>

        <h2>Situation 4: "I want to go back to how it was before"</h2>
        <p>
          Tell FORGE: <em>"Go back to how it was two hours ago"</em> or
          <em>"The previous version was better."</em>
        </p>
        <p>
          FORGE goes to GitHub, finds that version, and republishes it.
          Your site looks exactly like it did before. No data loss.
        </p>

        <h2>Situation 5: "Something weird is happening and I don't know what"</h2>
        <p>
          Tell FORGE: <em>"Something isn't working right."</em>
          FORGE runs a full diagnosis:
        </p>
        <pre><code class="lang-text">Checking code...       ✅ OK
Checking database...   ❌ Not connecting
Likely cause: database file was accidentally deleted.
Fix: restoring from GitHub...</code></pre>
        <p>
          FORGE tells you what it found in plain language, and if it can fix it
          on its own, it does. If it needs your confirmation, it asks.
        </p>

        <h2>Summary: every error has a solution</h2>
        <table>
          <thead>
            <tr>
              <th>Problem</th>
              <th>Is anything lost?</th>
              <th>Time to resolve</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Deploy failed</td>
              <td>No</td>
              <td>2 minutes (retry)</td>
            </tr>
            <tr>
              <td>Changed my mind</td>
              <td>No (previous version saved)</td>
              <td>10 minutes (adjust plan)</td>
            </tr>
            <tr>
              <td>Bug reported by user</td>
              <td>No</td>
              <td>5 minutes (fix + republish)</td>
            </tr>
            <tr>
              <td>Want the previous version</td>
              <td>No</td>
              <td>2 minutes (rollback)</td>
            </tr>
            <tr>
              <td>Something weird, unclear</td>
              <td>No</td>
              <td>5–10 minutes (diagnosis)</td>
            </tr>
          </tbody>
        </table>

        <div class="callout tip">
          <div class="callout-title">FORGE's mantra</div>
          <p>
            Your code is safe. Every change is reversible. There's no decision
            you can't undo.
          </p>
        </div>
      `
    }
  },

  "seguridad": {
    seccion: "nodev",
    es: {
      titulo: "Seguridad y tokens",
      html: `
        <h1>Seguridad sin miedo</h1>
        <p class="lead">
          FORGE necesita conectarse a GitHub y Vercel para guardar tu código y
          publicarlo en internet. Para eso usa algo llamado "token". Esta página
          te explica qué es, por qué es seguro y qué hacer si algo sale mal.
        </p>

        <h2>¿Qué es un token?</h2>
        <p>
          Un token es como una <strong>llave específica para una puerta específica</strong>.
          Es diferente a tu contraseña normal. Con tu contraseña de GitHub entras
          a todo tu perfil. Un token solo puede hacer lo que tú le permites — y nada más.
        </p>

        <div class="callout">
          <div class="callout-title">Contraseña vs. token</div>
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Contraseña normal</th>
                <th>Token de FORGE</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>¿Qué puede hacer?</td>
                <td>Todo en tu cuenta</td>
                <td>Solo crear y guardar código</td>
              </tr>
              <tr>
                <td>¿Puede ver tu email?</td>
                <td>Sí</td>
                <td>No</td>
              </tr>
              <tr>
                <td>¿Puede cambiar tu contraseña?</td>
                <td>Sí</td>
                <td>No</td>
              </tr>
              <tr>
                <td>¿Puede expirar?</td>
                <td>Solo si tú la cambias</td>
                <td>Sí — ponle 90 días</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>¿Por qué FORGE necesita tokens?</h2>
        <p>FORGE necesita dos tokens:</p>
        <ul>
          <li>
            <strong>Token de GitHub</strong> — para guardar tu código automáticamente
            sin que tengas que usar comandos complicados.
          </li>
          <li>
            <strong>Token de Vercel</strong> — para publicar tu app en internet
            sin que tengas que hacer nada técnico.
          </li>
        </ul>
        <p>Sin estos tokens, tendrías que hacer esos pasos tú mismo, manualmente.</p>

        <h2>Cómo FORGE protege tus tokens</h2>

        <div class="callout tip">
          <div class="callout-title">FORGE cuida tus tokens así</div>
          <ul>
            <li>Los usa solo en memoria mientras los necesita.</li>
            <li>Nunca los escribe en archivos que se puedan ver.</li>
            <li>Nunca los sube a GitHub.</li>
            <li>Una vez que termina el proceso, el token desaparece de la memoria.</li>
          </ul>
        </div>

        <h2>Cómo crear un token de GitHub (paso a paso)</h2>
        <ol>
          <li>Ve a <strong>github.com/settings/tokens</strong></li>
          <li>Haz clic en "Generate new token" → "Fine-grained tokens"</li>
          <li>
            Permisos que necesitas marcar:
            <ul>
              <li>Repository: Lectura y escritura (para crear y guardar código)</li>
              <li>Todo lo demás: ningún permiso</li>
            </ul>
          </li>
          <li>Expiración: <strong>90 días</strong> (no elijas "sin expiración")</li>
          <li>Genera el token y cópialo</li>
          <li>Pégalo en FORGE cuando lo pida</li>
        </ol>

        <div class="callout warn">
          <div class="callout-title">No guardes el token en ningún archivo ni lo envíes por mensajes</div>
          <p>
            Pégalo directamente en FORGE cuando lo pida. Una vez hecho eso,
            ya no necesitas guardarlo en ningún lado.
          </p>
        </div>

        <h2>Cómo crear un token de Vercel</h2>
        <ol>
          <li>Ve a <strong>vercel.com/account/tokens</strong></li>
          <li>Haz clic en "Create Token"</li>
          <li>Ponle un nombre como "FORGE - mi proyecto"</li>
          <li>Expiración: <strong>90 días</strong></li>
          <li>Copia y pega en FORGE cuando lo pida</li>
        </ol>

        <h2>¿Qué pasa si compartí el token por error?</h2>
        <p>
          No entres en pánico. Solo revócalo de inmediato — esto inutiliza el
          token aunque alguien lo tenga — y genera uno nuevo.
        </p>
        <p><strong>Para revocar un token de GitHub:</strong></p>
        <ol>
          <li>Ve a github.com/settings/tokens</li>
          <li>Encuentra el token y haz clic en "Delete"</li>
          <li>Genera uno nuevo</li>
        </ol>
        <p><strong>Para revocar un token de Vercel:</strong></p>
        <ol>
          <li>Ve a vercel.com/account/tokens</li>
          <li>Haz clic en "Delete" junto al token</li>
          <li>Genera uno nuevo</li>
        </ol>

        <div class="callout danger">
          <div class="callout-title">Si crees que tu token fue robado</div>
          <p>
            Revócalo inmediatamente en los pasos de arriba. Luego revisa tu cuenta
            de GitHub o Vercel para asegurarte de que no hay actividad extraña.
            Si ves algo raro, cambia también tu contraseña y activa la
            verificación en dos pasos.
          </p>
        </div>

        <h2>Lista de verificación antes de usar FORGE</h2>
        <ul>
          <li>Generé un token nuevo (no uno viejo o reutilizado)</li>
          <li>El token tiene expiración de 90 días</li>
          <li>El token tiene solo los permisos que necesita (no "todos los permisos")</li>
          <li>Voy a pegar el token directamente en FORGE, sin guardarlo en otro lado</li>
          <li>No voy a enviarlo por WhatsApp, Slack ni email</li>
        </ul>

        <div class="callout tip">
          <div class="callout-title">¿Tienes dudas sobre seguridad?</div>
          <p>
            Mejor pregunta antes de actuar. Escribe en Claude Code:
            <em>"Tengo una duda de seguridad sobre los tokens"</em> y FORGE te guía.
          </p>
        </div>
      `
    },
    en: {
      titulo: "Security and tokens",
      html: `
        <h1>Security without fear</h1>
        <p class="lead">
          FORGE needs to connect to GitHub and Vercel to save your code and publish
          it on the internet. For that it uses something called a "token." This page
          explains what that is, why it's safe, and what to do if something goes wrong.
        </p>

        <h2>What is a token?</h2>
        <p>
          A token is like a <strong>specific key for a specific door</strong>.
          It's different from your regular password. Your GitHub password unlocks
          everything in your account. A token can only do what you allow it to — nothing more.
        </p>

        <div class="callout">
          <div class="callout-title">Password vs. token</div>
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Regular password</th>
                <th>FORGE token</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>What can it do?</td>
                <td>Everything in your account</td>
                <td>Only create and save code</td>
              </tr>
              <tr>
                <td>Can it see your email?</td>
                <td>Yes</td>
                <td>No</td>
              </tr>
              <tr>
                <td>Can it change your password?</td>
                <td>Yes</td>
                <td>No</td>
              </tr>
              <tr>
                <td>Can it expire?</td>
                <td>Only if you change it</td>
                <td>Yes — set it to 90 days</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>Why does FORGE need tokens?</h2>
        <p>FORGE needs two tokens:</p>
        <ul>
          <li>
            <strong>GitHub token</strong> — to save your code automatically
            without you needing complex commands.
          </li>
          <li>
            <strong>Vercel token</strong> — to publish your app on the internet
            without you having to do anything technical.
          </li>
        </ul>
        <p>Without these tokens, you'd have to do those steps yourself, manually.</p>

        <h2>How FORGE protects your tokens</h2>

        <div class="callout tip">
          <div class="callout-title">FORGE handles your tokens like this</div>
          <ul>
            <li>Uses them only in memory while needed.</li>
            <li>Never writes them to any visible file.</li>
            <li>Never uploads them to GitHub.</li>
            <li>Once the process is done, the token disappears from memory.</li>
          </ul>
        </div>

        <h2>How to create a GitHub token (step by step)</h2>
        <ol>
          <li>Go to <strong>github.com/settings/tokens</strong></li>
          <li>Click "Generate new token" → "Fine-grained tokens"</li>
          <li>
            Permissions to check:
            <ul>
              <li>Repository: Read and write (to create and save code)</li>
              <li>Everything else: no permission</li>
            </ul>
          </li>
          <li>Expiration: <strong>90 days</strong> (do not choose "no expiration")</li>
          <li>Generate the token and copy it</li>
          <li>Paste it into FORGE when asked</li>
        </ol>

        <div class="callout warn">
          <div class="callout-title">Do not save the token in any file or send it in messages</div>
          <p>
            Paste it directly into FORGE when prompted. Once you've done that,
            you don't need to save it anywhere.
          </p>
        </div>

        <h2>How to create a Vercel token</h2>
        <ol>
          <li>Go to <strong>vercel.com/account/tokens</strong></li>
          <li>Click "Create Token"</li>
          <li>Give it a name like "FORGE - my project"</li>
          <li>Expiration: <strong>90 days</strong></li>
          <li>Copy and paste into FORGE when asked</li>
        </ol>

        <h2>What if I accidentally shared the token?</h2>
        <p>
          Don't panic. Just revoke it immediately — this makes the token useless
          even if someone has it — and generate a new one.
        </p>
        <p><strong>To revoke a GitHub token:</strong></p>
        <ol>
          <li>Go to github.com/settings/tokens</li>
          <li>Find the token and click "Delete"</li>
          <li>Generate a new one</li>
        </ol>
        <p><strong>To revoke a Vercel token:</strong></p>
        <ol>
          <li>Go to vercel.com/account/tokens</li>
          <li>Click "Delete" next to the token</li>
          <li>Generate a new one</li>
        </ol>

        <div class="callout danger">
          <div class="callout-title">If you think your token was stolen</div>
          <p>
            Revoke it immediately using the steps above. Then check your GitHub or
            Vercel account for any unusual activity. If you see something strange,
            also change your password and enable two-factor authentication.
          </p>
        </div>

        <h2>Checklist before using FORGE</h2>
        <ul>
          <li>I generated a new token (not an old or reused one)</li>
          <li>The token has a 90-day expiration</li>
          <li>The token has only the permissions it needs (not "all permissions")</li>
          <li>I will paste the token directly into FORGE, not save it elsewhere</li>
          <li>I will not send it via WhatsApp, Slack, or email</li>
        </ul>

        <div class="callout tip">
          <div class="callout-title">Have a security question?</div>
          <p>
            Better to ask before acting. Type in Claude Code:
            <em>"I have a security question about tokens"</em> and FORGE will guide you.
          </p>
        </div>
      `
    }
  },
"cuando-falla": {
    seccion: "nodev",
    es: {
      titulo: "¿Qué pasa si falla?",
      html: `
        <h1>¿Qué Pasa Si Algo Sale Mal? — Guía de Recuperación</h1>
        <p class="lead">Tu código está siempre seguro. Cada cambio se registra. Puedes volver a una versión anterior en cualquier momento sin perder nada.</p>

        <div class="callout tip">
          <div class="callout-title">Premisa: Tu código está siempre seguro</div>
          <ul>
            <li>✅ Está guardado en GitHub (historial completo)</li>
            <li>✅ Cada cambio se registra (quién, qué, cuándo)</li>
            <li>✅ Puedes volver a una versión anterior en cualquier momento</li>
          </ul>
        </div>

        <h2>Escenario 1: El deploy falló — ¿mi app desapareció?</h2>
        <p><strong>No.</strong> Tu código está en GitHub. El servidor (Vercel) rechazó publicarlo porque:</p>
        <ul>
          <li>Falta una variable de entorno</li>
          <li>Un archivo obligatorio no se generó</li>
          <li>El código tiene un error que no detectamos en pruebas</li>
        </ul>
        <p><strong>Opciones:</strong> Reintentar (2 min) · Arreglar el código · Esperar para después. En todos los casos, tu código en GitHub está intacto.</p>

        <h2>Escenario 2: Cambié de idea a mitad del proceso</h2>
        <p>Sin problema. Ejecuta <code>/sdd.constitucion</code> de nuevo para actualizar los principios del proyecto. Tu especificación, plan y código anteriores quedan en GitHub — en ramas separadas. Si cambias de idea de vuelta, los recuperas.</p>

        <h2>Escenario 3: Publiqué pero quiero cambiar algo</h2>
        <p><strong>Opción A (rápida):</strong> "Cambio el color del botón" → 3 minutos y listo.</p>
        <p><strong>Opción B (importante):</strong> "Agrego una nueva pregunta" → Actualiza spec, genera plan, construye (igual que la primera vez, pero más rápido).</p>
        <p><strong>Opción C (arrepentimiento):</strong> "Vuelve a cómo estaba hace 2 horas" → Claude encuentra ese commit en GitHub y publica esa versión.</p>

        <h2>Escenario 4: Mi cliente dice que no funciona algo</h2>
        <p><strong>Paso 1:</strong> Claude prueba el sitio en vivo e intenta reproducir el problema contigo.</p>
        <p><strong>Paso 2:</strong> Identifica la causa: ¿fórmula incorrecta? ¿Dato no guardado? ¿Caché viejo del navegador?</p>
        <p><strong>Paso 3:</strong> Arregla, prueba y publica. Tu cliente ve el fix inmediatamente.</p>

        <h2>Escenario 5: ¿Qué pasa si GitHub desaparece?</h2>
        <p>La probabilidad es 0.001% (Microsoft lo posee). Pero si te preocupa: tu código también está en Vercel (servidor en vivo), puedes hacer backup a tu computadora, y puedes mover a GitLab/Gitea en 5 minutos.</p>

        <h2>Escenario 6: ¿Qué pasa si Vercel cobra?</h2>
        <p>Vercel es gratis hasta 100GB de ancho de banda. Si algo cambia, te avisan con 30 días de anticipación. Tu sitio NO desaparece. Puedes mover a Netlify/Railway en 30 minutos. Tu código en GitHub no se pierde.</p>

        <h2>Escenario 7: Necesito cumplir GDPR / HIPAA / Compliance</h2>
        <p>Ejecuta <code>/sdd.compliance</code>. FORGE identifica qué falta, genera un plan (política de privacidad, descarga de datos, encriptación, etc.) y te pide aprobación antes de implementar.</p>

        <h2>Escenario 8: ¿Alguien hackea mi sitio?</h2>
        <p>FORGE lo previene:</p>
        <ul>
          <li>✅ El agente de seguridad revisó el código automáticamente</li>
          <li>✅ Se prueban ataques comunes (XSS, SQL injection)</li>
          <li>✅ Secretos no están en el código</li>
          <li>✅ Si algo pasara: GitHub registra todo, vuelves atrás en segundos</li>
        </ul>

        <h2>Escenario 9: Pasó algo raro — no sé qué está mal</h2>
        <p>Ejecuta <code>/sdd.doctor</code>. Este comando verifica:</p>
        <ul>
          <li>Código sintaxis correcta</li>
          <li>Todos los archivos presentes</li>
          <li>Base de datos conectada</li>
          <li>Servidor respondiendo</li>
          <li>Tests pasando</li>
          <li>Sin secretos expuestos</li>
        </ul>
        <p>Te muestra diagnóstico, causa probable y solución.</p>

        <h2>Mantra: Tu código está seguro, cualquier cambio es reversible</h2>
        <table>
          <tr><th>Problema</th><th>Tiempo</th><th>¿Se puede arreglar?</th></tr>
          <tr><td>Deploy falló</td><td>2 min</td><td>✅ Sí</td></tr>
          <tr><td>Cliente reporta bug</td><td>5 min</td><td>✅ Sí</td></tr>
          <tr><td>Cambié de idea</td><td>10 min</td><td>✅ Sí</td></tr>
          <tr><td>Vercel cobra</td><td>30 min mover</td><td>✅ Sí</td></tr>
          <tr><td>GitHub desaparece</td><td>1 hora</td><td>✅ Sí (backup local)</td></tr>
          <tr><td>Compliance nueva</td><td>20 min</td><td>✅ Sí (auditar)</td></tr>
        </table>

        <div class="callout">
          <p><strong>Última línea:</strong> Tu proyecto tiene especificación clara, plan técnico, cambios documentados, tests automáticos y auditoría de seguridad. Si algo está mal, Claude tiene TODA la información para arreglarlo, sin necesidad de programar.</p>
        </div>
      `
    },
    en: {
      titulo: "What if something fails?",
      html: `
        <h1>What If Something Goes Wrong? — Recovery Guide</h1>
        <p class="lead">Your code is always safe. Every change is recorded. You can revert to a previous version at any time without losing anything.</p>

        <div class="callout tip">
          <div class="callout-title">Principle: Your code is always safe</div>
          <ul>
            <li>✅ Saved in GitHub (complete history)</li>
            <li>✅ Every change is recorded (who, what, when)</li>
            <li>✅ Revert to any previous version anytime</li>
          </ul>
        </div>

        <h2>Scenario 1: Deployment failed — did my app disappear?</h2>
        <p><strong>No.</strong> Your code is in GitHub. The server (Vercel) rejected publishing because:</p>
        <ul>
          <li>Missing environment variable</li>
          <li>Required file didn't generate</li>
          <li>Code has an error we didn't catch in tests</li>
        </ul>
        <p><strong>Options:</strong> Retry (2 min) · Fix the code · Try later. Your GitHub code is intact in all cases.</p>

        <h2>Scenario 2: I changed my mind halfway through</h2>
        <p>No problem. Run <code>/sdd.constitucion</code> again to update project principles. Your previous spec, plan, and code stay in GitHub — on separate branches. Change your mind again? Recover them.</p>

        <h2>Scenario 3: I published but want to change something</h2>
        <p><strong>Option A (quick):</strong> "Change the button color" → 3 minutes done.</p>
        <p><strong>Option B (important):</strong> "Add a new question" → Update spec, generate plan, build (same as first time, but faster).</p>
        <p><strong>Option C (regret):</strong> "Revert to 2 hours ago" → Claude finds that commit and publishes it.</p>

        <h2>Scenario 4: My client says something doesn't work</h2>
        <p><strong>Step 1:</strong> Claude tests the live site and reproduces the issue with you.</p>
        <p><strong>Step 2:</strong> Identifies cause: wrong formula? Data not saved? Old browser cache?</p>
        <p><strong>Step 3:</strong> Fixes, tests, publishes. Client sees fix immediately.</p>

        <h2>Scenario 5: What if GitHub disappears?</h2>
        <p>Probability: 0.001% (Microsoft owns it). But if you worry: your code also lives on Vercel (live server), you can backup to your computer, and move to GitLab/Gitea in 5 minutes.</p>

        <h2>Scenario 6: What if Vercel charges me?</h2>
        <p>Vercel is free until 100GB bandwidth. If it changes, they warn you 30 days ahead. Your site doesn't disappear. Move to Netlify/Railway in 30 minutes. Your GitHub code stays safe.</p>

        <h2>Scenario 7: I need GDPR / HIPAA compliance</h2>
        <p>Run <code>/sdd.compliance</code>. FORGE identifies what's missing, generates a plan (privacy policy, data download, encryption, etc.) and asks approval before implementing.</p>

        <h2>Scenario 8: Someone hacks my site?</h2>
        <p>FORGE prevents it:</p>
        <ul>
          <li>✅ Security agent reviewed code automatically</li>
          <li>✅ Common attacks tested (XSS, SQL injection)</li>
          <li>✅ Secrets not in code</li>
          <li>✅ If it happens: GitHub logs everything, revert in seconds</li>
        </ul>

        <h2>Scenario 9: Something weird happened — I don't know what's wrong</h2>
        <p>Run <code>/sdd.doctor</code>. This command checks:</p>
        <ul>
          <li>Code syntax correct</li>
          <li>All files present</li>
          <li>Database connected</li>
          <li>Server responding</li>
          <li>Tests passing</li>
          <li>No secrets exposed</li>
        </ul>
        <p>Shows diagnosis, probable cause, and solution.</p>

        <h2>Mantra: Your code is safe, every change is reversible</h2>
        <table>
          <tr><th>Problem</th><th>Time</th><th>Fixable?</th></tr>
          <tr><td>Deploy failed</td><td>2 min</td><td>✅ Yes</td></tr>
          <tr><td>Client bug report</td><td>5 min</td><td>✅ Yes</td></tr>
          <tr><td>Changed my mind</td><td>10 min</td><td>✅ Yes</td></tr>
          <tr><td>Vercel charges</td><td>30 min move</td><td>✅ Yes</td></tr>
          <tr><td>GitHub disappears</td><td>1 hour</td><td>✅ Yes (local backup)</td></tr>
          <tr><td>New compliance</td><td>20 min</td><td>✅ Yes (audit)</td></tr>
        </table>

        <div class="callout">
          <p><strong>Last line:</strong> Your project has clear spec, technical plan, documented changes, automatic tests, and security audit. If something's wrong, Claude has ALL the info to fix it, no programming needed.</p>
        </div>
      `
    }
  },
"arquitectura": {
    seccion: "dev",
    es: {
      titulo: "Arquitectura del sistema",
      html: `
<p class="lead">FORGE es una capa de opinión sobre las primitivas nativas de Claude Code. No modifica el binario ni el comportamiento base: organiza comandos, subagentes, skills y hooks en un flujo de ingeniería estructurado.</p>

<h2>Diagrama del sistema</h2>
<pre><code class="lang-text">
┌─────────────────────────────────────────────────────────────────┐
│                        USUARIO / EQUIPO                         │
│          /sdd.especificar  /sdd.planificar  /sdd.implementar    │
└───────────────────────────┬─────────────────────────────────────┘
                            │  slash commands
┌───────────────────────────▼─────────────────────────────────────┐
│                        FORGE / SDD-ES                           │
│                                                                 │
│  commands/          skills/              agents/                │
│  sdd.*.md  ──────►  enrutador-agentes ──► arquitecto           │
│                     constitucion        ► asesor-datos          │
│                     effort-router       ► desarrollador-backend │
│                     memory-compactor    ► desarrollador-frontend│
│                     cache-audit         ► tester                │
│                     token-budget        ► revisor               │
│                     compresion-tokens   ► critico               │
│                     orquestacion-ptc    ► seguridad             │
│                                         ► disenador-api         │
│                                         ► operaciones           │
│                                         ► documentador          │
│                                         ► investigador          │
│                                         ► product-designer      │
│                                         ► architecture-designer │
│                                                                 │
│  claude-hooks/                                                  │
│  pre-tool-guard.js  (PreToolUse)  — bloqueo y advertencias     │
│  agent-memory.js    (PostToolUse) — memoria + ledger            │
└───────────────────────────┬─────────────────────────────────────┘
                            │  primitivas oficiales
┌───────────────────────────▼─────────────────────────────────────┐
│                      CLAUDE CODE (CLI)                          │
│   Slash commands · Subagents · Skills · Hooks · Settings        │
└─────────────────────────────────────────────────────────────────┘
</code></pre>

<h2>Capas del sistema</h2>
<table>
  <thead>
    <tr><th>Capa</th><th>Artefactos</th><th>Responsabilidad</th></tr>
  </thead>
  <tbody>
    <tr><td>Comandos</td><td><code>commands/sdd.*.md</code></td><td>Punto de entrada del usuario. Cada comando orquesta una fase del pipeline.</td></tr>
    <tr><td>Skills</td><td><code>skills/*.md</code></td><td>Fragmentos de instrucción reutilizables. Los comandos y agentes los invocan cuando los necesitan.</td></tr>
    <tr><td>Agentes</td><td><code>agents/*.md</code></td><td>Subagentes especializados por dominio, cada uno con su modelo recomendado y herramientas acotadas.</td></tr>
    <tr><td>Hooks</td><td><code>claude-hooks/*.js</code></td><td>Código Node.js que se ejecuta en los puntos de ciclo de vida de Claude Code (<code>PreToolUse</code>, <code>PostToolUse</code>).</td></tr>
    <tr><td>Estado</td><td><code>.sdd/</code></td><td>Artefactos en disco: specs, planes, memoria por agente, ledger de consumo. Persiste entre sesiones.</td></tr>
    <tr><td>Configuración</td><td><code>.sdd/sdd.config.yaml</code></td><td>Activa/desactiva agentes, asigna modelos, define protecciones y comportamientos.</td></tr>
  </tbody>
</table>

<h2>Estructura de directorios</h2>
<pre><code class="lang-text">
FORGE/
├── commands/           # /sdd.especificar, /sdd.planificar, ...
├── agents/             # arquitecto.md, tester.md, revisor.md, ...
├── skills/             # enrutador-agentes, effort-router, ...
├── plantillas/         # especificacion.md, plan.md, adr.md, ...
├── claude-hooks/
│   ├── pre-tool-guard.js   # PreToolUse — seguridad
│   └── agent-memory.js     # PostToolUse — memoria y ledger
├── presets/            # lean.yaml, startup.yaml, enterprise.yaml
└── docs/               # documentación del sistema
</code></pre>

<div class="callout tip">Toda la lógica de FORGE es Markdown plano y JavaScript estándar — sin dependencias propias de framework. Si Claude Code actualiza sus primitivas, FORGE se beneficia automáticamente.</div>
`
    },
    en: {
      titulo: "System architecture",
      html: `
<p class="lead">FORGE is an opinionated layer on top of Claude Code's native primitives. It does not modify the binary or base behavior: it organizes commands, subagents, skills and hooks into a structured engineering workflow.</p>

<h2>System diagram</h2>
<pre><code class="lang-text">
┌─────────────────────────────────────────────────────────────────┐
│                        USER / TEAM                              │
│          /sdd.especificar  /sdd.planificar  /sdd.implementar    │
└───────────────────────────┬─────────────────────────────────────┘
                            │  slash commands
┌───────────────────────────▼─────────────────────────────────────┐
│                        FORGE / SDD-ES                           │
│                                                                 │
│  commands/          skills/              agents/                │
│  sdd.*.md  ──────►  enrutador-agentes ──► arquitecto           │
│                     constitucion        ► asesor-datos          │
│                     effort-router       ► desarrollador-backend │
│                     memory-compactor    ► desarrollador-frontend│
│                     cache-audit         ► tester                │
│                     token-budget        ► revisor               │
│                     compresion-tokens   ► critico               │
│                     orquestacion-ptc    ► seguridad             │
│                                         ► disenador-api         │
│                                         ► operaciones           │
│                                         ► documentador          │
│                                         ► investigador          │
│                                         ► product-designer      │
│                                         ► architecture-designer │
│                                                                 │
│  claude-hooks/                                                  │
│  pre-tool-guard.js  (PreToolUse)  — blocking and warnings      │
│  agent-memory.js    (PostToolUse) — memory + consumption ledger │
└───────────────────────────┬─────────────────────────────────────┘
                            │  official primitives
┌───────────────────────────▼─────────────────────────────────────┐
│                      CLAUDE CODE (CLI)                          │
│   Slash commands · Subagents · Skills · Hooks · Settings        │
└─────────────────────────────────────────────────────────────────┘
</code></pre>

<h2>System layers</h2>
<table>
  <thead>
    <tr><th>Layer</th><th>Artifacts</th><th>Responsibility</th></tr>
  </thead>
  <tbody>
    <tr><td>Commands</td><td><code>commands/sdd.*.md</code></td><td>User entry point. Each command orchestrates one pipeline phase.</td></tr>
    <tr><td>Skills</td><td><code>skills/*.md</code></td><td>Reusable instruction fragments. Commands and agents invoke them as needed.</td></tr>
    <tr><td>Agents</td><td><code>agents/*.md</code></td><td>Domain-specialized subagents, each with a recommended model and scoped tools.</td></tr>
    <tr><td>Hooks</td><td><code>claude-hooks/*.js</code></td><td>Node.js code that runs at Claude Code lifecycle points (<code>PreToolUse</code>, <code>PostToolUse</code>).</td></tr>
    <tr><td>State</td><td><code>.sdd/</code></td><td>Disk artifacts: specs, plans, per-agent memory, consumption ledger. Persists across sessions.</td></tr>
    <tr><td>Configuration</td><td><code>.sdd/sdd.config.yaml</code></td><td>Enable/disable agents, assign models, define protections and behaviors.</td></tr>
  </tbody>
</table>

<div class="callout tip">All FORGE logic is plain Markdown and standard JavaScript — no proprietary framework dependencies. When Claude Code updates its primitives, FORGE benefits automatically.</div>
`
    }
  },

  "adr": {
    seccion: "dev",
    es: {
      titulo: "Decisiones de arquitectura (ADR)",
      html: `
        <h1>Decisiones de Arquitectura — Registro Decisiones Arquitectónicas</h1>
        <p class="lead">Un ADR (Architecture Decision Record) es un registro de cada decisión técnica importante: por qué se tomó, qué alternativas se consideraron y cuál es su estado actual (aceptada, rechazada, obsoleta, etc.).</p>

        <h2>¿Por qué registrar decisiones?</h2>
        <ul>
          <li><strong>Memoria del proyecto:</strong> Cuando alguien nuevo se une o tú vuelves meses después, sabes por qué cada cosa se hizo así</li>
          <li><strong>Contexto:</strong> No solo queda "usamos PostgreSQL", sino "usamos PostgreSQL porque necesitábamos ACID y escalabilidad horizontal"</li>
          <li><strong>Riesgo mitigado:</strong> Si alguien propone cambiar la base de datos, ves las alternativas que YA fueron consideradas</li>
          <li><strong>Auditoría:</strong> Para compliance (legal, seguridad), queda constancia de quién decidió qué y por qué</li>
        </ul>

        <h2>Estructura de un ADR</h2>
        <pre><code>ID: 1
Decisión: Usar PostgreSQL para datos transaccionales
Contexto: Necesitamos ACID, integridad referencial y escalabilidad vertical
Alternativas consideradas: MySQL (menos features), MongoDB (sin transacciones), DynamoDB (sin queries complejas)
Status: aceptada
Fecha: 2026-06-14
Afecta: Módulo de pagos, auth, órdenes</code></pre>

        <h2>Estados de un ADR</h2>
        <table>
          <tr><th>Estado</th><th>Significa</th></tr>
          <tr><td><strong>aceptada</strong></td><td>Decisión vigente, en uso ahora</td></tr>
          <tr><td><strong>rechazada</strong></td><td>Se consideró pero NO se eligió</td></tr>
          <tr><td><strong>obsoleta</strong></td><td>Fue aceptada, pero ya no se usa</td></tr>
          <tr><td><strong>superseded</strong></td><td>Fue aceptada, pero otra ADR la reemplazó</td></tr>
        </table>

        <h2>Comandos para gestionar ADRs</h2>
        <p><strong>/sdd.adr list</strong> — Lista todas las decisiones</p>
        <pre><code>ID | Decisión              | Contexto       | Status
───┼──────────────────────┼────────────────┼─────────
1  | Use PostgreSQL       | ACID needed    | aceptada
2  | Cache con Redis      | Performance    | aceptada
3  | JWT para auth        | Stateless API  | aceptada</code></pre>

        <p><strong>/sdd.adr new</strong> — Captura una nueva decisión</p>
        <pre><code>Claude: ¿Cuál es la decisión?
Tú: Use DynamoDB para analytics

Claude: ¿Por qué? (contexto)
Tú: Scale infinita, baja latencia

Claude: ¿Qué alternativas consideraste?
Tú: PostgreSQL partitioning, BigQuery

Claude: ¿Status?
Tú: aceptada

✅ ADR guardado en .sdd/arquitectura/ADRs.jsonl</code></pre>

        <p><strong>/sdd.adr search "patrón"</strong> — Busca por palabra clave</p>
        <pre><code>/sdd.adr search "database"

ID | Decisión              | Contexto
───┼───────────────────────┼──────────────
1  | Use PostgreSQL        | ACID needed
2  | Use Redis cache       | Performance</code></pre>

        <h2>Cuándo crear un ADR</h2>
        <ul>
          <li>✅ Eligiste una base de datos o servidor de caché</li>
          <li>✅ Decidiste un patrón de autenticación o autorización</li>
          <li>✅ Elegiste una arquitectura (monolítica, microservicios, serveless)</li>
          <li>✅ Consideraste alternativas y descartaste algunas</li>
          <li>✅ La decisión afecta múltiples módulos o es difícil de cambiar</li>
        </ul>

        <h2>Cuándo NO crear un ADR</h2>
        <ul>
          <li>❌ "Usé localStorage en lugar de cookies" (decisión reversible, baja importancia)</li>
          <li>❌ "Elegí el nombre de la variable" (nivel de implementación, no arquitectura)</li>
          <li>❌ Decisiones que solo afectan a un archivo o función pequeña</li>
        </ul>

        <h2>Ejemplo completo de un ADR</h2>
        <pre><code><strong>ID: 7 — Use JWT tokens, no sessions en servidor</strong>

Contexto:
- API sin estado (stateless) → escalable horizontalmente
- Clientes móviles + web necesitan autenticación
- Queremos reducir carga en base de datos de sesiones

Alternativas:
1. Sessions en servidor (base de datos) — requiere sincronización entre servidores
2. Sessions en Redis — más rápido, pero costo extra
3. JWT tokens — sin estado, sin dependencias extra, verificable

Decisión:
Elegimos JWT porque:
✅ No requiere sincronización entre servidores
✅ Sin dependencias extra
✅ Token verificable sin consultar BD
✅ Mobile-friendly (sin cookies)

Tradeoffs:
- No podemos "revocar" un token antes de su expiración
- Token más pesado que un session ID

Mitigación:
- Expiración corta (15 min) + refresh token
- Refresh token corto (7 días) y rotado

Status: aceptada
Afecta: Módulo de auth, API, mobile app
Registrada por: arquitecto
Fecha: 2026-06-01</code></pre>

        <div class="callout tip">
          <p><strong>Consejo:</strong> Registra ADRs mientras construyes, no después. Es más fácil documentar la decisión cuando acabas de tomarla. Y ayuda a tu futuro yo (o al siguiente developer) a entender el "por qué".</p>
        </div>
      `
    },
    en: {
      titulo: "Architecture Decisions (ADR)",
      html: `
        <h1>Architecture Decisions — Architecture Decision Records</h1>
        <p class="lead">An ADR (Architecture Decision Record) is a log of each important technical decision: why it was made, what alternatives were considered, and its current status (accepted, rejected, obsolete, superseded).</p>

        <h2>Why record decisions?</h2>
        <ul>
          <li><strong>Project memory:</strong> When someone new joins or you return months later, you know why each thing is done this way</li>
          <li><strong>Context:</strong> Not just "we use PostgreSQL", but "we use PostgreSQL because we needed ACID and horizontal scalability"</li>
          <li><strong>Risk mitigated:</strong> If someone proposes changing the database, you see alternatives that were ALREADY considered</li>
          <li><strong>Audit trail:</strong> For compliance (legal, security), it's on record who decided what and why</li>
        </ul>

        <h2>ADR structure</h2>
        <pre><code>ID: 1
Decision: Use PostgreSQL for transactional data
Context: Need ACID, referential integrity, vertical scalability
Alternatives: MySQL (fewer features), MongoDB (no transactions), DynamoDB (no complex queries)
Status: accepted
Date: 2026-06-14
Affects: Payments, auth, orders</code></pre>

        <h2>ADR statuses</h2>
        <table>
          <tr><th>Status</th><th>Means</th></tr>
          <tr><td><strong>accepted</strong></td><td>Decision is current, in use now</td></tr>
          <tr><td><strong>rejected</strong></td><td>Considered but NOT chosen</td></tr>
          <tr><td><strong>obsolete</strong></td><td>Was accepted, no longer used</td></tr>
          <tr><td><strong>superseded</strong></td><td>Was accepted, replaced by another ADR</td></tr>
        </table>

        <h2>Commands to manage ADRs</h2>
        <p><strong>/sdd.adr list</strong> — List all decisions</p>
        <p><strong>/sdd.adr new</strong> — Capture a new decision interactively</p>
        <p><strong>/sdd.adr search "pattern"</strong> — Search by keyword</p>

        <h2>When to create an ADR</h2>
        <ul>
          <li>✅ You chose a database or cache server</li>
          <li>✅ You decided on an auth pattern (JWT, OAuth, sessions)</li>
          <li>✅ You chose an architecture (monolith, microservices, serverless)</li>
          <li>✅ You considered alternatives and ruled some out</li>
          <li>✅ Decision affects multiple modules or is hard to change</li>
        </ul>

        <h2>When NOT to create an ADR</h2>
        <ul>
          <li>❌ "Used localStorage instead of cookies" (reversible, low impact)</li>
          <li>❌ "Chose variable name" (implementation level, not architecture)</li>
          <li>❌ Decisions affecting only one small file or function</li>
        </ul>

        <div class="callout tip">
          <p><strong>Tip:</strong> Record ADRs while building, not after. It's easier to document the decision right after making it. And it helps your future self (or the next developer) understand the "why".</p>
        </div>
      `
    }
  },

  "flujo-sdd": {
    seccion: "dev",
    es: {
      titulo: "El flujo SDD",
      html: `
<p class="lead">FORGE implementa un sprint estructurado de siete fases: <strong>Pensar → Planear → Construir → Revisar → Probar → Publicar → Reflexionar</strong>. Cada flecha entre fases tiene un control explícito: no se avanza sin artefacto verificado.</p>

<h2>Pipeline completo</h2>
<pre><code class="lang-text">
Pensar → Planear → Construir → Revisar → Probar → Publicar → Reflexionar
  │                                                                 │
  └─────────────────── /sdd.especificar [siguiente] ◄──────────────┘
</code></pre>

<h2>Mapa de fases y comandos</h2>
<table>
  <thead>
    <tr><th>Fase</th><th>Qué ocurre</th><th>Comandos SDD-ES</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>Pensar</strong></td><td>Encuadrar el problema, extraer contexto de una idea vaga</td><td><code>/sdd.constitucion</code>, <code>/sdd.descubrir</code></td></tr>
    <tr><td><strong>Planear</strong></td><td>Capturar requisitos, diseñar, auditar el plan</td><td><code>/sdd.especificar</code>, <code>/sdd.aclarar</code>, <code>/sdd.planificar</code>, <code>/sdd.analizar</code></td></tr>
    <tr><td><strong>Construir</strong></td><td>Implementar con agentes especializados</td><td><code>/sdd.implementar</code></td></tr>
    <tr><td><strong>Revisar</strong></td><td>Revisión independiente de calidad y cumplimiento</td><td><code>/sdd.verificar</code> (+ agente <code>revisor</code>)</td></tr>
    <tr><td><strong>Probar</strong></td><td>QA en navegador real, no solo unitarios</td><td><code>/sdd.qa</code></td></tr>
    <tr><td><strong>Publicar</strong></td><td>Despliegue verificado + monitoreo</td><td><code>/sdd.desplegar</code>, <code>/sdd.canary</code></td></tr>
    <tr><td><strong>Reflexionar</strong></td><td>Capturar aprendizajes, actualizar el estado del producto</td><td><code>/sdd.retro</code>, <code>/sdd.snapshot</code></td></tr>
  </tbody>
</table>

<h2>Flujos según el tamaño del cambio</h2>

<h3>Micro (≤3 archivos, &lt;10 líneas)</h3>
<pre><code class="lang-bash">
/sdd.especificar [descripción]
# → Detecta micro → genera spec+plan+tareas automáticamente → implementa
</code></pre>

<h3>Pequeño (1 feature simple)</h3>
<pre><code class="lang-bash">
/sdd.especificar [descripción]
/sdd.planificar
/sdd.planificar aprobar
/sdd.tareas
/sdd.implementar
</code></pre>

<h3>Mediano (múltiples componentes)</h3>
<pre><code class="lang-bash">
/sdd.especificar [descripción]
/sdd.aclarar
/sdd.planificar
/sdd.planificar aprobar
/sdd.tareas
/sdd.implementar
/sdd.verificar
</code></pre>

<h3>Grande (sistema nuevo, calidad máxima)</h3>
<pre><code class="lang-bash">
/sdd.constitucion          # actualizar si hay nuevos principios
/sdd.especificar [descripción]
/sdd.aclarar
/sdd.checklist
/sdd.planificar
/sdd.planificar aprobar
/sdd.tareas
/sdd.analizar              # clave para cambios grandes
/sdd.implementar
/sdd.verificar
/sdd.snapshot
</code></pre>

<h2>Reanudación entre sesiones</h2>
<p>Claude Code no mantiene contexto entre conversaciones. FORGE persiste el estado en <code>.sdd/estado.json</code>:</p>
<pre><code class="lang-bash">
/sdd.estado                     # muestra dashboard de la sesión
/sdd.implementar continuar      # retoma desde la última tarea
</code></pre>

<div class="callout tip">La diferencia con "pídele a la IA que lo haga" es que <strong>cada flecha tiene un control</strong>: no se construye sin spec, no se publica sin tests verdes y QA, no se cierra sin verificación independiente. Esa es la garantía de estándar de ingeniería alto.</div>
`
    },
    en: {
      titulo: "The SDD flow",
      html: `
<p class="lead">FORGE implements a structured seven-phase sprint: <strong>Think → Plan → Build → Review → Test → Publish → Reflect</strong>. Each phase transition has an explicit gate: no progress without a verified artifact.</p>

<h2>Full pipeline</h2>
<pre><code class="lang-text">
Think → Plan → Build → Review → Test → Publish → Reflect
  │                                                    │
  └──────────── /sdd.especificar [next feature] ◄──────┘
</code></pre>

<h2>Phase and command map</h2>
<table>
  <thead>
    <tr><th>Phase</th><th>What happens</th><th>SDD-ES commands</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>Think</strong></td><td>Frame the problem, extract context from a vague idea</td><td><code>/sdd.constitucion</code>, <code>/sdd.descubrir</code></td></tr>
    <tr><td><strong>Plan</strong></td><td>Capture requirements, design, audit the plan</td><td><code>/sdd.especificar</code>, <code>/sdd.aclarar</code>, <code>/sdd.planificar</code>, <code>/sdd.analizar</code></td></tr>
    <tr><td><strong>Build</strong></td><td>Implement with specialized agents</td><td><code>/sdd.implementar</code></td></tr>
    <tr><td><strong>Review</strong></td><td>Independent quality and compliance review</td><td><code>/sdd.verificar</code> (+ <code>revisor</code> agent)</td></tr>
    <tr><td><strong>Test</strong></td><td>QA in a real browser, not just unit tests</td><td><code>/sdd.qa</code></td></tr>
    <tr><td><strong>Publish</strong></td><td>Verified deployment + monitoring</td><td><code>/sdd.desplegar</code>, <code>/sdd.canary</code></td></tr>
    <tr><td><strong>Reflect</strong></td><td>Capture learnings, update product state</td><td><code>/sdd.retro</code>, <code>/sdd.snapshot</code></td></tr>
  </tbody>
</table>

<h2>Flows by change size</h2>

<h3>Micro (≤3 files, &lt;10 lines)</h3>
<pre><code class="lang-bash">
/sdd.especificar [description]
# → Detects micro → auto-generates spec+plan+tasks → implements
</code></pre>

<h3>Small (1 simple feature)</h3>
<pre><code class="lang-bash">
/sdd.especificar [description]
/sdd.planificar
/sdd.planificar aprobar
/sdd.tareas
/sdd.implementar
</code></pre>

<h3>Large (new system, maximum quality)</h3>
<pre><code class="lang-bash">
/sdd.constitucion
/sdd.especificar [description]
/sdd.aclarar
/sdd.checklist
/sdd.planificar
/sdd.planificar aprobar
/sdd.tareas
/sdd.analizar
/sdd.implementar
/sdd.verificar
/sdd.snapshot
</code></pre>

<h2>Resuming across sessions</h2>
<p>Claude Code does not retain context between conversations. FORGE persists state in <code>.sdd/estado.json</code>:</p>
<pre><code class="lang-bash">
/sdd.estado                     # shows session dashboard
/sdd.implementar continuar      # resumes from the last task
</code></pre>

<div class="callout tip">The difference from "just ask the AI to do it" is that <strong>every arrow has a gate</strong>: no building without a spec, no publishing without green tests and QA, no closing without independent verification. That is the high engineering standard guarantee.</div>
`
    }
  },

  "principios": {
    seccion: "dev",
    es: {
      titulo: "Los 5 principios SDD",
      html: `
<p class="lead">Spec-Driven Development (Desarrollo Guiado por Especificaciones) es la metodología que sustenta FORGE. Cinco principios constituyen su fundamento — la <em>constitución</em> del proyecto, que ningún plan puede contradecir sin justificación documentada.</p>

<h2>¿Qué es SDD?</h2>
<p>En SDD la <strong>especificación es la fuente de verdad</strong>, no el código. El código es un artefacto derivado de la spec, no al revés. Cada cambio empieza definiendo <em>qué</em> y <em>por qué</em> antes de <em>cómo</em>.</p>

<div class="callout">Los modelos de IA son muy creativos — demasiado cuando programan sin restricciones. SDD canaliza esa creatividad imponiendo un espacio de soluciones aceptable: la spec define los límites, la constitución limita las decisiones técnicas, las tareas atómicas reducen la deriva, y los criterios de verificación atrapan errores antes de que se acumulen. <strong>Resultado: implementación predecible, auditable, sin "magia" en el medio.</strong></div>

<h2>Los 5 principios</h2>

<h3>1. Spec antes que código — siempre</h3>
<p>Ninguna línea de código se escribe sin una especificación que la justifique. La spec define el <em>qué</em> y el <em>por qué</em>; el código es la consecuencia. Esto elimina la implementación por intuición y hace cada decisión rastreable.</p>

<h3>2. Constitución es ley</h3>
<p>La constitución del proyecto (<code>/sdd.constitucion</code>) contiene los principios técnicos y de negocio que no se pueden violar. El plan no puede contradecirla sin justificación documentada. Esto preserva coherencia arquitectónica a lo largo del tiempo, incluso con múltiples agentes y sesiones.</p>

<h3>3. Cada decisión es trazable</h3>
<p>Del criterio de aceptación de la spec a la línea de código que lo implementa, hay una cadena de evidencia continua. Los ADRs (Architectural Decision Records) y el snapshot del producto registran por qué se tomó cada decisión, no solo qué se decidió.</p>

<h3>4. Agentes especializados</h3>
<p>Un experto por dominio supera a un generalista. FORGE usa 14 agentes con roles acotados: el <code>arquitecto</code> decide la estructura, el <code>asesor-datos</code> diseña el esquema, el <code>desarrollador-backend</code> implementa servicios, el <code>revisor</code> cruza el código contra la spec. Ninguno sale de su dominio.</p>

<h3>5. Verificación independiente</h3>
<p>La IA que verifica no es la misma que implementó. El agente <code>revisor</code> (modelo Opus) recibe el código y la spec sin el contexto de la sesión de implementación — esto elimina el sesgo de confirmación y detecta errores que el implementador naturalmente omite.</p>

<h2>Cuándo usar SDD-ES</h2>
<table>
  <thead>
    <tr><th>Contexto</th><th>¿Usar SDD?</th></tr>
  </thead>
  <tbody>
    <tr><td>Feature nueva que toca múltiples archivos o capas</td><td><span class="pill pill-dev">Sí</span></td></tr>
    <tr><td>El cambio requiere trazabilidad de decisiones</td><td><span class="pill pill-dev">Sí</span></td></tr>
    <tr><td>Trabajo en equipo y necesitas alineación</td><td><span class="pill pill-dev">Sí</span></td></tr>
    <tr><td>Idea vaga que necesita descomposición</td><td><span class="pill pill-dev">Sí</span></td></tr>
    <tr><td>Arreglar un typo o cambiar un literal de string</td><td>No (flujo micro)</td></tr>
    <tr><td>Ajuste de CSS visual sin lógica</td><td>No (flujo micro)</td></tr>
  </tbody>
</table>

<div class="callout tip">Para cambios triviales existe el flujo "micro": <code>/sdd.especificar</code> detecta automáticamente que el cambio es pequeño y comprime el proceso — spec, plan y tareas se generan en un solo paso.</div>
`
    },
    en: {
      titulo: "The 5 SDD principles",
      html: `
<p class="lead">Spec-Driven Development is the methodology underpinning FORGE. Five principles form its foundation — the project <em>constitution</em>, which no plan can contradict without documented justification.</p>

<h2>What is SDD?</h2>
<p>In SDD the <strong>specification is the source of truth</strong>, not the code. Code is a derived artifact of the spec, not the other way around. Every change starts by defining <em>what</em> and <em>why</em> before <em>how</em>.</p>

<div class="callout">AI models are highly creative — too creative when coding without constraints. SDD channels that creativity by imposing a bounded solution space: the spec defines the limits, the constitution constrains technical decisions, atomic tasks reduce drift, and verification criteria catch errors before they accumulate. <strong>Result: predictable, auditable implementation with no "magic" in between.</strong></div>

<h2>The 5 principles</h2>

<h3>1. Spec before code — always</h3>
<p>No line of code is written without a specification that justifies it. The spec defines the <em>what</em> and <em>why</em>; the code is the consequence. This eliminates intuition-driven implementation and makes every decision traceable.</p>

<h3>2. Constitution is law</h3>
<p>The project constitution (<code>/sdd.constitucion</code>) contains the technical and business principles that cannot be violated. No plan can contradict it without documented justification. This preserves architectural coherence over time, even across multiple agents and sessions.</p>

<h3>3. Every decision is traceable</h3>
<p>From the acceptance criterion in the spec to the line of code that implements it, there is a continuous chain of evidence. ADRs (Architectural Decision Records) and the product snapshot record <em>why</em> each decision was made, not just what was decided.</p>

<h3>4. Specialized agents</h3>
<p>One expert per domain outperforms a generalist. FORGE uses 14 agents with bounded roles: the <code>arquitecto</code> decides structure, the <code>asesor-datos</code> designs the schema, the <code>desarrollador-backend</code> implements services, the <code>revisor</code> cross-checks code against the spec. None steps outside their domain.</p>

<h3>5. Independent verification</h3>
<p>The AI that verifies is not the one that implemented. The <code>revisor</code> agent (Opus model) receives the code and the spec without the implementation session context — this eliminates confirmation bias and catches errors the implementer naturally overlooks.</p>

<h2>When to use SDD-ES</h2>
<table>
  <thead>
    <tr><th>Context</th><th>Use SDD?</th></tr>
  </thead>
  <tbody>
    <tr><td>New feature touching multiple files or layers</td><td><span class="pill pill-dev">Yes</span></td></tr>
    <tr><td>Change requires decision traceability</td><td><span class="pill pill-dev">Yes</span></td></tr>
    <tr><td>Team work requiring alignment</td><td><span class="pill pill-dev">Yes</span></td></tr>
    <tr><td>Vague idea needing decomposition</td><td><span class="pill pill-dev">Yes</span></td></tr>
    <tr><td>Fixing a typo or changing a string literal</td><td>No (micro flow)</td></tr>
    <tr><td>Visual CSS tweak with no logic</td><td>No (micro flow)</td></tr>
  </tbody>
</table>
`
    }
  },

  "agentes": {
    seccion: "dev",
    es: {
      titulo: "Los 14 agentes especializados",
      html: `
<p class="lead">FORGE orquesta 14 agentes con roles acotados. El usuario nunca los invoca directamente: el skill <code>enrutador-agentes</code> decide qué agente ejecuta cada tarea según el tipo de trabajo y la fase del pipeline.</p>

<h2>Tabla maestra</h2>
<table>
  <thead>
    <tr><th>Agente</th><th>Modelo rec.</th><th>Cuándo se activa</th><th>Para qué</th></tr>
  </thead>
  <tbody>
    <tr><td><code>arquitecto</code></td><td>Opus</td><td><code>/sdd.planificar</code>, fase A</td><td>Decisiones técnicas de alto nivel</td></tr>
    <tr><td><code>disenador-api</code></td><td>Sonnet</td><td><code>/sdd.planificar</code> (si hay contratos)</td><td>OpenAPI, GraphQL, gRPC, eventos</td></tr>
    <tr><td><code>asesor-datos</code></td><td>Opus</td><td><code>/sdd.planificar</code> (si toca BD)</td><td>Schemas, queries, índices, migraciones</td></tr>
    <tr><td><code>desarrollador-backend</code></td><td>Sonnet</td><td><code>/sdd.implementar</code> (servidor)</td><td>Servicios, controllers, lógica de negocio</td></tr>
    <tr><td><code>desarrollador-frontend</code></td><td>Sonnet</td><td><code>/sdd.implementar</code> (UI)</td><td>Componentes, vistas, estado cliente</td></tr>
    <tr><td><code>operaciones</code></td><td>Sonnet</td><td><code>/sdd.implementar</code> (infra)</td><td>CI/CD, Docker, IaC, despliegue</td></tr>
    <tr><td><code>tester</code></td><td>Sonnet</td><td><code>/sdd.implementar</code> (tests)</td><td>Unitarios, integración, E2E</td></tr>
    <tr><td><code>revisor</code></td><td>Opus</td><td>Al final de <code>/sdd.implementar</code></td><td>Revisión cruzada de calidad vs. spec</td></tr>
    <tr><td><code>critico</code></td><td>Opus</td><td><code>/sdd.planificar</code>, <code>/sdd.analizar</code></td><td>Riesgos y puntos ciegos del plan</td></tr>
    <tr><td><code>seguridad</code></td><td>Opus</td><td>Cambios sensibles (automático)</td><td>Auditoría de vulnerabilidades</td></tr>
    <tr><td><code>documentador</code></td><td>Sonnet</td><td>Bajo demanda (desactivado por defecto)</td><td>Docs útiles, no obvias</td></tr>
    <tr><td><code>investigador</code></td><td>Sonnet</td><td>Bajo demanda</td><td>Investigación técnica, benchmarks</td></tr>
    <tr><td><code>product-designer</code></td><td>Opus</td><td><code>/sdd.disenar</code> (fase de producto)</td><td>Pantallas P0/P1/P2, user flow, MVP scope</td></tr>
    <tr><td><code>architecture-designer</code></td><td>Sonnet</td><td><code>/sdd.disenar</code> (fase de stack)</td><td>Stack más simple viable, decisión técnica</td></tr>
  </tbody>
</table>

<h2>Cómo se invocan los agentes</h2>
<p>Los agentes operan en tres momentos del pipeline:</p>
<ul>
  <li><strong>Durante <code>/sdd.planificar</code></strong>: el orquestador llama a <code>arquitecto</code>, <code>disenador-api</code>, <code>asesor-datos</code> y <code>critico</code> (más <code>seguridad</code> si el cambio es sensible). Cada uno aporta su sección al plan.</li>
  <li><strong>Durante <code>/sdd.implementar</code></strong>: por cada tarea, <code>enrutador-agentes</code> decide qué agente la ejecuta según el tipo (backend, frontend, infra, tests).</li>
  <li><strong>Al final de <code>/sdd.implementar</code></strong>: <code>revisor</code> cruza el código contra la spec; <code>tester</code> ejecuta la suite; <code>seguridad</code> audita si tocó algo sensible.</li>
</ul>

<h2>Configuraciones por tipo de proyecto</h2>

<h3>API REST sin frontend</h3>
<pre><code class="lang-json">
{
  "disenador-api": "activo",
  "desarrollador-backend": "activo",
  "desarrollador-frontend": "desactivado",
  "asesor-datos": "activo",
  "operaciones": "activo"
}
</code></pre>

<h3>MVP / Side project</h3>
<pre><code class="lang-json">
{
  "critico": "desactivado",
  "seguridad": "desactivado",
  "documentador": "desactivado",
  "modelos": "todos sonnet o haiku"
}
</code></pre>

<h3>Producto enterprise</h3>
<pre><code class="lang-json">
{
  "todos": "activos",
  "modelos_opus": ["arquitecto", "asesor-datos", "revisor", "critico", "seguridad"]
}
</code></pre>

<h2>Personalizar un agente</h2>
<p>Los agentes son archivos Markdown plano. Edita <code>.claude/agents/[nombre].md</code> para cambiar la personalidad, añadir restricciones del proyecto, cambiar el formato de salida o agregar conocimiento de dominio específico.</p>
<div class="callout tip">Los cambios al frontmatter <code>model:</code> se sobreescriben con la config en <code>.sdd/sdd.config.yaml</code>. Usa siempre la config centralizada para gestionar modelos.</div>
`
    },
    en: {
      titulo: "The 14 specialized agents",
      html: `
<p class="lead">FORGE orchestrates 14 agents with bounded roles. The user never invokes them directly: the <code>enrutador-agentes</code> skill decides which agent executes each task based on work type and pipeline phase.</p>

<h2>Master table</h2>
<table>
  <thead>
    <tr><th>Agent</th><th>Rec. model</th><th>When activated</th><th>Purpose</th></tr>
  </thead>
  <tbody>
    <tr><td><code>arquitecto</code></td><td>Opus</td><td><code>/sdd.planificar</code>, phase A</td><td>High-level technical decisions</td></tr>
    <tr><td><code>disenador-api</code></td><td>Sonnet</td><td><code>/sdd.planificar</code> (if contracts involved)</td><td>OpenAPI, GraphQL, gRPC, events</td></tr>
    <tr><td><code>asesor-datos</code></td><td>Opus</td><td><code>/sdd.planificar</code> (if DB touched)</td><td>Schemas, queries, indexes, migrations</td></tr>
    <tr><td><code>desarrollador-backend</code></td><td>Sonnet</td><td><code>/sdd.implementar</code> (server)</td><td>Services, controllers, business logic</td></tr>
    <tr><td><code>desarrollador-frontend</code></td><td>Sonnet</td><td><code>/sdd.implementar</code> (UI)</td><td>Components, views, client state</td></tr>
    <tr><td><code>operaciones</code></td><td>Sonnet</td><td><code>/sdd.implementar</code> (infra)</td><td>CI/CD, Docker, IaC, deployment</td></tr>
    <tr><td><code>tester</code></td><td>Sonnet</td><td><code>/sdd.implementar</code> (tests)</td><td>Unit, integration, E2E</td></tr>
    <tr><td><code>revisor</code></td><td>Opus</td><td>End of <code>/sdd.implementar</code></td><td>Cross-review: code vs. spec</td></tr>
    <tr><td><code>critico</code></td><td>Opus</td><td><code>/sdd.planificar</code>, <code>/sdd.analizar</code></td><td>Plan risks and blind spots</td></tr>
    <tr><td><code>seguridad</code></td><td>Opus</td><td>Sensitive changes (automatic)</td><td>Vulnerability audit</td></tr>
    <tr><td><code>documentador</code></td><td>Sonnet</td><td>On demand (disabled by default)</td><td>Non-obvious useful docs</td></tr>
    <tr><td><code>investigador</code></td><td>Sonnet</td><td>On demand</td><td>Technical research, benchmarks</td></tr>
    <tr><td><code>product-designer</code></td><td>Opus</td><td><code>/sdd.disenar</code> (product phase)</td><td>P0/P1/P2 screens, user flow, MVP scope</td></tr>
    <tr><td><code>architecture-designer</code></td><td>Sonnet</td><td><code>/sdd.disenar</code> (stack phase)</td><td>Simplest viable stack, technical decision</td></tr>
  </tbody>
</table>

<h2>How agents are invoked</h2>
<ul>
  <li><strong>During <code>/sdd.planificar</code></strong>: the orchestrator calls <code>arquitecto</code>, <code>disenador-api</code>, <code>asesor-datos</code> and <code>critico</code> (plus <code>seguridad</code> if sensitive). Each contributes its section to the plan.</li>
  <li><strong>During <code>/sdd.implementar</code></strong>: per task, <code>enrutador-agentes</code> selects the appropriate agent by task type.</li>
  <li><strong>End of <code>/sdd.implementar</code></strong>: <code>revisor</code> cross-checks code vs. spec; <code>tester</code> runs the suite; <code>seguridad</code> audits if anything sensitive was touched.</li>
</ul>

<div class="callout tip">Agents are plain Markdown files. Edit <code>.claude/agents/[name].md</code> to change personality, add project constraints, change output format, or add domain knowledge. Manage model assignments centrally via <code>.sdd/sdd.config.yaml</code>.</div>
`
    }
  },

  "skills-hooks": {
    seccion: "dev",
    es: {
      titulo: "Skills y hooks",
      html: `
<p class="lead">Skills y hooks son las dos extensiones de bajo nivel de FORGE. Las skills son fragmentos de instrucción reutilizables que los comandos y agentes incluyen. Los hooks son código Node.js que se ejecuta en los puntos de ciclo de vida de Claude Code.</p>

<h2>Skills de FORGE</h2>
<p>Una skill es un archivo <code>.md</code> en <code>skills/</code> que puede ser invocado por cualquier comando o agente. No es código — es instrucción estructurada que el modelo lee como parte de su contexto.</p>

<h3>Skills incluidas</h3>
<table>
  <thead>
    <tr><th>Skill</th><th>Qué hace</th><th>Cuándo se usa</th></tr>
  </thead>
  <tbody>
    <tr><td><code>enrutador-agentes</code></td><td>Decide qué agente ejecuta cada tarea</td><td><code>/sdd.implementar</code></td></tr>
    <tr><td><code>constitucion-constraint</code></td><td>Inyecta los principios de la constitución</td><td>Inicio de cada comando de planificación</td></tr>
    <tr><td><code>effort-router</code></td><td>Recomienda Haiku/Sonnet/Opus por fase</td><td><code>/sdd.optimizar</code>, inicio de fase</td></tr>
    <tr><td><code>memory-compactor</code></td><td>Deduplica y comprime <code>.sdd/memoria/</code></td><td>Cuando memoria supera 50 KB</td></tr>
    <tr><td><code>cache-audit</code></td><td>Detecta invalidadores silenciosos de caché</td><td>Antes de fases costosas</td></tr>
    <tr><td><code>token-budget</code></td><td>Proyecta costo de fases restantes</td><td><code>/sdd.optimizar presupuesto</code></td></tr>
    <tr><td><code>compresion-tokens</code></td><td>Diccionario caveman — 80+ pares de reemplazos</td><td>Reutilizado por <code>memory-compactor</code></td></tr>
    <tr><td><code>orquestacion-ptc</code></td><td>Criterios para paralelizar agentes</td><td>Reutilizado por <code>token-budget</code></td></tr>
    <tr><td><code>observabilidad-consumo</code></td><td>Reporte del ledger JSONL</td><td><code>/sdd.estado consumo</code></td></tr>
  </tbody>
</table>

<h3>Añadir una skill nueva</h3>
<ol>
  <li>Crea <code>skills/mi-skill/mi-skill.md</code> con el rol y las instrucciones.</li>
  <li>Invócala desde un comando con <code>@mi-skill</code> o referénciala en el frontmatter del agente.</li>
</ol>

<h2>Hooks de FORGE</h2>
<p>Los hooks son código Node.js registrado en <code>.claude/settings.json</code> bajo la clave <code>hooks</code>. Claude Code los ejecuta en puntos de ciclo de vida específicos.</p>

<h3>pre-tool-guard.js — PreToolUse</h3>
<p>Bloquea operaciones destructivas antes de que Claude Code las ejecute. Opera sobre herramientas <code>Bash</code> y <code>PowerShell</code>.</p>
<ul>
  <li><strong>Bloqueo duro</strong> (exit 2): <code>rm -rf /</code>, <code>git push --force</code>, <code>git reset --hard</code>, <code>DROP DATABASE</code>, escritura de secrets literales, rutas de sistema.</li>
  <li><strong>Advertencia</strong> (exit 0 + stderr): <code>git push</code>, <code>git merge</code>, <code>DROP TABLE</code>, <code>terraform apply</code>, <code>kubectl delete</code>.</li>
  <li><strong>Permisos por agente</strong>: agentes de análisis (<code>arquitecto</code>, <code>revisor</code>, <code>critico</code>, <code>seguridad</code>) son read-only — no pueden usar <code>Write</code> ni <code>Edit</code>.</li>
  <li><strong>Auditoría</strong>: cada intento de tool por agente se registra en <code>.sdd/observabilidad/agent-tool-audit.jsonl</code>.</li>
</ul>
<pre><code class="lang-text">
Protocolo de hooks de Claude Code:
  stdin  → evento JSON con tool_name y tool_input
  exit 0 → permitir
  exit 2 → bloquear (Claude Code muestra stderr al usuario)
</code></pre>

<h3>agent-memory.js — PostToolUse</h3>
<p>Se ejecuta tras cada <code>Write</code>, <code>Edit</code> o <code>MultiEdit</code>. Hace dos cosas:</p>
<ol>
  <li>Si el agente activo tiene memoria persistente, añade una entrada a <code>.sdd/memoria/agente-{nombre}.md</code>.</li>
  <li>Escribe una línea JSONL en <code>.sdd/observabilidad/consumo.jsonl</code> con timestamp, agente, herramienta, archivo y bytes.</li>
</ol>
<p>Si la memoria de un agente supera 50 KB, emite alerta por stderr:</p>
<pre><code class="lang-text">
[agent-memory] Memoria de arquitecto supera 52KB — considera ejecutar /sdd.optimizar memoria
</code></pre>

<h3>Registrar los hooks</h3>
<pre><code class="lang-json">
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash|PowerShell",
        "hooks": [{ "type": "command", "command": "node claude-hooks/pre-tool-guard.js" }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [{ "type": "command", "command": "node claude-hooks/agent-memory.js" }]
      }
    ]
  }
}
</code></pre>

<div class="callout warn">Los hooks no reciben respuesta del usuario. <code>pre-tool-guard.js</code> solo puede bloquear (exit 2) o advertir (stderr + exit 0). Para interacción, el flujo normal de permisos de Claude Code es el mecanismo correcto.</div>
`
    },
    en: {
      titulo: "Skills and hooks",
      html: `
<p class="lead">Skills and hooks are FORGE's two low-level extension points. Skills are reusable instruction fragments that commands and agents include. Hooks are Node.js code that runs at Claude Code lifecycle points.</p>

<h2>FORGE skills</h2>
<p>A skill is a <code>.md</code> file in <code>skills/</code> that any command or agent can invoke. It is not code — it is structured instruction that the model reads as part of its context.</p>

<h3>Included skills</h3>
<table>
  <thead>
    <tr><th>Skill</th><th>What it does</th><th>When used</th></tr>
  </thead>
  <tbody>
    <tr><td><code>enrutador-agentes</code></td><td>Decides which agent executes each task</td><td><code>/sdd.implementar</code></td></tr>
    <tr><td><code>constitucion-constraint</code></td><td>Injects constitution principles</td><td>Start of each planning command</td></tr>
    <tr><td><code>effort-router</code></td><td>Recommends Haiku/Sonnet/Opus per phase</td><td><code>/sdd.optimizar</code>, phase start</td></tr>
    <tr><td><code>memory-compactor</code></td><td>Deduplicates and compresses <code>.sdd/memoria/</code></td><td>When memory exceeds 50 KB</td></tr>
    <tr><td><code>cache-audit</code></td><td>Detects silent cache invalidators</td><td>Before costly phases</td></tr>
    <tr><td><code>token-budget</code></td><td>Projects cost of remaining phases</td><td><code>/sdd.optimizar presupuesto</code></td></tr>
    <tr><td><code>compresion-tokens</code></td><td>Caveman dictionary — 80+ replacement pairs</td><td>Reused by <code>memory-compactor</code></td></tr>
    <tr><td><code>orquestacion-ptc</code></td><td>Criteria for parallelizing agents</td><td>Reused by <code>token-budget</code></td></tr>
    <tr><td><code>observabilidad-consumo</code></td><td>JSONL ledger report</td><td><code>/sdd.estado consumo</code></td></tr>
  </tbody>
</table>

<h2>FORGE hooks</h2>

<h3>pre-tool-guard.js — PreToolUse</h3>
<p>Blocks destructive operations before Claude Code executes them. Operates on <code>Bash</code> and <code>PowerShell</code> tools.</p>
<ul>
  <li><strong>Hard block</strong> (exit 2): <code>rm -rf /</code>, <code>git push --force</code>, <code>git reset --hard</code>, <code>DROP DATABASE</code>, hardcoded secrets, system paths.</li>
  <li><strong>Warning</strong> (exit 0 + stderr): <code>git push</code>, <code>git merge</code>, <code>DROP TABLE</code>, <code>terraform apply</code>, <code>kubectl delete</code>.</li>
  <li><strong>Per-agent permissions</strong>: analysis agents (<code>arquitecto</code>, <code>revisor</code>, <code>critico</code>, <code>seguridad</code>) are read-only — cannot use <code>Write</code> or <code>Edit</code>.</li>
</ul>

<h3>agent-memory.js — PostToolUse</h3>
<p>Runs after every <code>Write</code>, <code>Edit</code>, or <code>MultiEdit</code>. It does two things:</p>
<ol>
  <li>If the active agent has persistent memory, appends an entry to <code>.sdd/memoria/agente-{name}.md</code>.</li>
  <li>Writes a JSONL line to <code>.sdd/observabilidad/consumo.jsonl</code> with timestamp, agent, tool, file, and bytes.</li>
</ol>

<h3>Registering the hooks</h3>
<pre><code class="lang-json">
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash|PowerShell",
        "hooks": [{ "type": "command", "command": "node claude-hooks/pre-tool-guard.js" }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [{ "type": "command", "command": "node claude-hooks/agent-memory.js" }]
      }
    ]
  }
}
</code></pre>

<div class="callout warn">Hooks cannot interact with the user. <code>pre-tool-guard.js</code> can only block (exit 2) or warn (stderr + exit 0). For user interaction, Claude Code's normal permission flow is the right mechanism.</div>
`
    }
  },

  "memoria-contexto": {
    seccion: "dev",
    es: {
      titulo: "Memoria y contexto",
      html: `
<p class="lead">Claude Code no mantiene contexto entre conversaciones. FORGE resuelve este problema con tres mecanismos: memoria por agente en disco, un ledger de consumo en tiempo real, y un conjunto de skills de optimización de tokens.</p>

<h2>1. Memoria por agente</h2>
<p>Cada agente activo tiene un archivo de memoria persistente en <code>.sdd/memoria/agente-{nombre}.md</code>. Este archivo crece automáticamente durante la sesión: el hook <code>agent-memory.js</code> añade una entrada tras cada escritura de archivo.</p>

<p>Agentes con memoria persistente: <code>arquitecto</code>, <code>asesor-datos</code>, <code>disenador-api</code>, <code>critico</code>, <code>desarrollador-backend</code>, <code>desarrollador-frontend</code>, <code>tester</code>, <code>documentador</code>, <code>operaciones</code>.</p>

<h3>Formato de una entrada de memoria</h3>
<pre><code class="lang-text">
## 2026-06-13 — .sdd/especificaciones/2026-06-13-auth/spec.md
&gt; # Especificación: Autenticación con magic link — Decisión: usar Resend para emails
</code></pre>

<h3>Cuándo comprimir la memoria</h3>
<p>Cuando la memoria supera 80 entradas o 50 KB, empieza a consumir ventana de contexto sin aportar valor. El hook emite una alerta:</p>
<pre><code class="lang-text">
[agent-memory] Memoria de arquitecto supera 52KB — considera ejecutar /sdd.optimizar memoria
</code></pre>
<p>Para comprimir:</p>
<pre><code class="lang-bash">
/sdd.optimizar memoria
</code></pre>
<p>El skill <code>memory-compactor</code> deduplica entradas del mismo archivo (conserva solo la más reciente) y aplica compresión caveman. Siempre guarda un backup <code>.original</code>.</p>

<h2>2. Ledger de consumo</h2>
<p><code>.sdd/observabilidad/consumo.jsonl</code> es un archivo de líneas JSON (una por evento) que registra cada escritura en tiempo real.</p>

<h3>Campos del ledger</h3>
<table>
  <thead>
    <tr><th>Campo</th><th>Descripción</th></tr>
  </thead>
  <tbody>
    <tr><td><code>ts</code></td><td>Timestamp ISO 8601</td></tr>
    <tr><td><code>agente</code></td><td>Nombre del agente o <code>"main"</code> si es la sesión principal</td></tr>
    <tr><td><code>tool</code></td><td>Herramienta usada: <code>Write</code>, <code>Edit</code>, <code>MultiEdit</code></td></tr>
    <tr><td><code>archivo</code></td><td>Ruta del archivo modificado</td></tr>
    <tr><td><code>bytes</code></td><td>Tamaño en bytes del contenido escrito</td></tr>
  </tbody>
</table>
<div class="callout warn">Los bytes miden el contenido escrito, no el consumo real de tokens del modelo. Claude Code no expone el conteo de tokens a los hooks. Para costos exactos, usa el dashboard de Anthropic Console.</div>

<p>Para ver el reporte del ledger:</p>
<pre><code class="lang-bash">
/sdd.estado consumo
</code></pre>

<h2>3. Optimización de tokens</h2>
<p>El comando <code>/sdd.optimizar</code> ejecuta el ciclo completo de seis pasos: consumo → routing → compresión de memoria → auditoría de caché → presupuesto → reporte con acciones ordenadas por impacto.</p>

<h3>Subcomandos disponibles</h3>
<table>
  <thead>
    <tr><th>Subcomando</th><th>Qué hace</th></tr>
  </thead>
  <tbody>
    <tr><td><code>/sdd.optimizar</code></td><td>Ciclo completo (6 pasos)</td></tr>
    <tr><td><code>/sdd.optimizar tokens</code></td><td>Solo effort-router + cache-audit</td></tr>
    <tr><td><code>/sdd.optimizar memoria</code></td><td>Solo memory-compactor</td></tr>
    <tr><td><code>/sdd.optimizar presupuesto</code></td><td>Solo token-budget</td></tr>
  </tbody>
</table>

<h3>Effort routing — mayor impacto</h3>
<p>La skill <code>effort-router</code> recomienda el modelo correcto por fase:</p>
<table>
  <thead>
    <tr><th>Grupo</th><th>Fases</th><th>Ahorro vs. Opus en todo</th></tr>
  </thead>
  <tbody>
    <tr><td>A — Opus siempre</td><td>especificación, planificación, análisis</td><td>0 %</td></tr>
    <tr><td>B — Sonnet suficiente</td><td>implementación (backend/frontend), verificación, QA</td><td>~40 %</td></tr>
    <tr><td>C — Haiku suficiente</td><td>tests, docs, deploy, retro</td><td>~80 %</td></tr>
  </tbody>
</table>

<h3>Auditoría de caché</h3>
<p>La skill <code>cache-audit</code> detecta los tres patrones que invalidan el prompt caching silenciosamente:</p>
<table>
  <thead>
    <tr><th>Invalidador</th><th>Severidad</th><th>Fix</th></tr>
  </thead>
  <tbody>
    <tr><td>Timestamps dinámicos en el system prompt</td><td>Alta</td><td>Mover al final del prompt, en bloque separado</td></tr>
    <tr><td>UUIDs / IDs de sesión embebidos</td><td>Alta</td><td>Pasar como argumento, no como parte del system prompt</td></tr>
    <tr><td>Contenido JSONL embebido en el prompt</td><td>Media</td><td>Leer con tool <code>Read</code> cuando se necesite</td></tr>
  </tbody>
</table>
`
    },
    en: {
      titulo: "Memory and context",
      html: `
<p class="lead">Claude Code does not retain context between conversations. FORGE solves this with three mechanisms: per-agent persistent memory on disk, a real-time consumption ledger, and a set of token optimization skills.</p>

<h2>1. Per-agent memory</h2>
<p>Each active agent has a persistent memory file at <code>.sdd/memoria/agente-{name}.md</code>. This file grows automatically during the session: the <code>agent-memory.js</code> hook appends an entry after each file write.</p>

<h3>Memory entry format</h3>
<pre><code class="lang-text">
## 2026-06-13 — .sdd/especificaciones/2026-06-13-auth/spec.md
&gt; # Specification: Auth with magic link — Decision: use Resend for emails
</code></pre>

<h3>When to compress memory</h3>
<p>When memory exceeds 80 entries or 50 KB, it starts consuming context window without adding value. Run:</p>
<pre><code class="lang-bash">
/sdd.optimizar memoria
</code></pre>
<p>The <code>memory-compactor</code> skill deduplicates entries for the same file (keeps only the most recent) and applies caveman compression. Always saves a <code>.original</code> backup.</p>

<h2>2. Consumption ledger</h2>
<p><code>.sdd/observabilidad/consumo.jsonl</code> is a JSON-lines file (one event per line) that records every file write in real time.</p>

<div class="callout warn">Bytes measure the written content size, not the actual model token consumption. Claude Code does not expose token counts to hooks. For exact costs, use the Anthropic Console dashboard.</div>

<pre><code class="lang-bash">
/sdd.estado consumo    # shows per-agent table, fan-out alerts, peak activity
</code></pre>

<h2>3. Token optimization</h2>
<p><code>/sdd.optimizar</code> runs a six-step cycle: consumption → routing → memory compression → cache audit → budget → report with actions ordered by impact.</p>

<h3>Effort routing — highest impact</h3>
<table>
  <thead>
    <tr><th>Group</th><th>Phases</th><th>Saving vs. all-Opus</th></tr>
  </thead>
  <tbody>
    <tr><td>A — Always Opus</td><td>specification, planning, analysis</td><td>0 %</td></tr>
    <tr><td>B — Sonnet sufficient</td><td>implementation (backend/frontend), verification, QA</td><td>~40 %</td></tr>
    <tr><td>C — Haiku sufficient</td><td>tests, docs, deploy, retro</td><td>~80 %</td></tr>
  </tbody>
</table>

<h3>Cache audit</h3>
<p>The <code>cache-audit</code> skill detects three patterns that silently invalidate prompt caching:</p>
<table>
  <thead>
    <tr><th>Invalidator</th><th>Severity</th><th>Fix</th></tr>
  </thead>
  <tbody>
    <tr><td>Dynamic timestamps in the system prompt</td><td>High</td><td>Move to end of prompt in a separate block</td></tr>
    <tr><td>Session UUIDs embedded in the prompt</td><td>High</td><td>Pass as argument, not part of system prompt</td></tr>
    <tr><td>JSONL content embedded in the prompt</td><td>Medium</td><td>Read with <code>Read</code> tool when needed</td></tr>
  </tbody>
</table>

<div class="callout tip">Prompt caching reduces input token cost by up to 90% for stable blocks. A single invalidator in the system prompt cancels the entire benefit.</div>
`
    }
  },

  "relacion-claude-code": {
    seccion: "dev",
    es: {
      titulo: "FORGE como capa sobre Claude Code",
      html: `
<p class="lead">FORGE no es un reemplazo de Claude Code. Es una <strong>capa de opinión en español</strong> que organiza y conecta las primitivas nativas de Claude Code en un flujo de trabajo estructurado de extremo a extremo.</p>

<div class="callout">Toda la funcionalidad de FORGE descansa sobre primitivas que Claude Code ya provee. FORGE no modifica el binario ni el comportamiento base. Si Claude Code actualiza Skills, Subagents o Hooks, FORGE se beneficia automáticamente.</div>

<h2>Tabla de correspondencias</h2>
<table>
  <thead>
    <tr><th>Pieza de FORGE</th><th>Primitiva oficial de Claude Code</th><th>Notas</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><code>commands/*.md</code> (ej. <code>/sdd.especificar</code>)</td>
      <td><strong>Slash commands</strong> (<code>.claude/commands/*.md</code>)</td>
      <td>FORGE instala sus comandos en <code>.claude/commands/</code>. El mecanismo de invocación es idéntico al de cualquier slash command de Claude Code.</td>
    </tr>
    <tr>
      <td><code>agents/*.md</code> (ej. <code>arquitecto</code>, <code>tester</code>)</td>
      <td><strong>Subagents</strong> (<code>model: …</code>, <code>tools: […]</code>)</td>
      <td>Cada archivo <code>agents/X.md</code> es un subagente que Claude Code puede instanciar con su propio contexto, modelo y herramientas.</td>
    </tr>
    <tr>
      <td><code>skills/*.md</code> (ej. <code>modo-guiado</code>, <code>constitucion-constraint</code>)</td>
      <td><strong>Skills</strong> (<code>.claude/skills/*.md</code>)</td>
      <td>Las skills de FORGE son skills de Claude Code: fragmentos de instrucción reutilizables que los agentes y comandos incluyen cuando los necesitan.</td>
    </tr>
    <tr>
      <td><code>claude-hooks/</code></td>
      <td><strong>Hooks</strong> (<code>.claude/settings.json → hooks</code>)</td>
      <td>Los hooks de FORGE se registran en <code>settings.json</code> y se ejecutan en los puntos de ciclo de vida que Claude Code expone (<code>PreToolUse</code>, <code>PostToolUse</code>, <code>Stop</code>).</td>
    </tr>
    <tr>
      <td>Presets (<code>presets/lean.yaml</code>, etc.)</td>
      <td>Configuración de usuario / proyecto</td>
      <td>Archivos YAML que <code>/sdd.configurar</code> copia a <code>.sdd/sdd.config.yaml</code>. No son una primitiva de Claude Code; son configuración propia de FORGE.</td>
    </tr>
    <tr>
      <td><code>plantillas/*.md</code></td>
      <td>Sin equivalente directo</td>
      <td>Plantillas Markdown que los comandos llenan al generar artefactos (specs, planes, ADRs). Claude Code no tiene un sistema de plantillas nativo.</td>
    </tr>
    <tr>
      <td><code>.sdd/estado.json</code></td>
      <td>Sin equivalente directo</td>
      <td>Estado persistente del proyecto (spec activa, fase, ID de sesión). Claude Code no tiene estado global nativo; FORGE lo gestiona en disco.</td>
    </tr>
    <tr>
      <td>Modo guiado (<code>perfil: guiado</code>)</td>
      <td>Sin equivalente directo</td>
      <td>Comportamiento de conducción paso a paso implementado dentro del slash command <code>/sdd</code>, no una primitiva de Claude Code.</td>
    </tr>
  </tbody>
</table>

<h2>Lo que FORGE añade sobre Claude Code</h2>
<ol>
  <li><strong>Flujo ordenado</strong>: encadena los slash commands en fases (especificar → planificar → implementar → verificar → desplegar) con transiciones explícitas y artefactos verificados.</li>
  <li><strong>Lenguaje español</strong>: todos los artefactos, comandos y mensajes están en español.</li>
  <li><strong>Memoria entre sesiones</strong>: <code>estado.json</code> y los artefactos en <code>.sdd/</code> persisten el contexto del proyecto entre conversaciones.</li>
  <li><strong>Presets de calidad</strong>: configuraciones probadas (lean / startup / enterprise) que ajustan qué agentes están activos y con qué modelo.</li>
  <li><strong>Modo guiado</strong>: conduce a usuarios no técnicos sin exponer la nomenclatura de comandos.</li>
</ol>

<h2>Lo que FORGE NO hace</h2>
<ul>
  <li>No modifica el binario de Claude Code ni su comportamiento base.</li>
  <li>No reemplaza las primitivas: si Claude Code actualiza Skills, Subagents o Hooks, FORGE se beneficia automáticamente.</li>
  <li>No requiere acceso a la API de Anthropic directamente — todo pasa por Claude Code como intermediario.</li>
</ul>

<div class="callout tip">Si ya conoces Claude Code, piensa en FORGE como un conjunto de slash commands, subagentes y hooks que traen una metodología de ingeniería opinionada — sin ningún binario adicional que instalar.</div>
`
    },
    en: {
      titulo: "FORGE as a layer over Claude Code",
      html: `
<p class="lead">FORGE is not a replacement for Claude Code. It is an <strong>opinionated layer in Spanish</strong> that organizes and connects Claude Code's native primitives into a structured end-to-end workflow.</p>

<div class="callout">All FORGE functionality rests on primitives that Claude Code already provides. FORGE does not modify the binary or base behavior. When Claude Code updates Skills, Subagents, or Hooks, FORGE benefits automatically.</div>

<h2>Correspondence table</h2>
<table>
  <thead>
    <tr><th>FORGE piece</th><th>Official Claude Code primitive</th><th>Notes</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><code>commands/*.md</code> (e.g. <code>/sdd.especificar</code>)</td>
      <td><strong>Slash commands</strong> (<code>.claude/commands/*.md</code>)</td>
      <td>FORGE installs its commands in <code>.claude/commands/</code>. The invocation mechanism is identical to any Claude Code slash command.</td>
    </tr>
    <tr>
      <td><code>agents/*.md</code> (e.g. <code>arquitecto</code>, <code>tester</code>)</td>
      <td><strong>Subagents</strong> (<code>model: …</code>, <code>tools: […]</code>)</td>
      <td>Each <code>agents/X.md</code> file is a subagent that Claude Code can instantiate with its own context, model, and tools.</td>
    </tr>
    <tr>
      <td><code>skills/*.md</code></td>
      <td><strong>Skills</strong> (<code>.claude/skills/*.md</code>)</td>
      <td>FORGE skills are Claude Code skills: reusable instruction fragments that agents and commands include when needed.</td>
    </tr>
    <tr>
      <td><code>claude-hooks/</code></td>
      <td><strong>Hooks</strong> (<code>.claude/settings.json → hooks</code>)</td>
      <td>FORGE hooks are registered in <code>settings.json</code> and run at Claude Code's lifecycle points (<code>PreToolUse</code>, <code>PostToolUse</code>, <code>Stop</code>).</td>
    </tr>
    <tr>
      <td>Presets (<code>presets/lean.yaml</code>, etc.)</td>
      <td>User / project configuration</td>
      <td>YAML files that <code>/sdd.configurar</code> copies to <code>.sdd/sdd.config.yaml</code>. Not a Claude Code primitive — FORGE's own configuration layer.</td>
    </tr>
    <tr>
      <td><code>plantillas/*.md</code></td>
      <td>No direct equivalent</td>
      <td>Markdown templates that commands fill when generating artifacts (specs, plans, ADRs). Claude Code has no native template system.</td>
    </tr>
    <tr>
      <td><code>.sdd/estado.json</code></td>
      <td>No direct equivalent</td>
      <td>Persistent project state (active spec, phase, session ID). Claude Code has no native global state; FORGE manages it on disk.</td>
    </tr>
    <tr>
      <td>Guided mode (<code>perfil: guiado</code>)</td>
      <td>No direct equivalent</td>
      <td>Step-by-step guidance behavior implemented inside the <code>/sdd</code> slash command, not a Claude Code primitive.</td>
    </tr>
  </tbody>
</table>

<h2>What FORGE does NOT do</h2>
<ul>
  <li>Does not modify the Claude Code binary or base behavior.</li>
  <li>Does not replace primitives: if Claude Code updates Skills, Subagents, or Hooks, FORGE benefits automatically.</li>
  <li>Does not require direct access to the Anthropic API — everything goes through Claude Code as the intermediary.</li>
</ul>

<div class="callout tip">If you already know Claude Code, think of FORGE as a set of slash commands, subagents, and hooks that bring an opinionated engineering methodology — with no additional binary to install.</div>
`
    }
  },

  "personalizacion": {
    seccion: "dev",
    es: {
      titulo: "Personalización",
      html: `
<p class="lead">FORGE está diseñado para ser completamente personalizable. Cada artefacto es Markdown plano o YAML editable — sin configuración binaria ni compilación. Cinco niveles de personalización, del más simple al más profundo.</p>

<h2>Los 5 niveles</h2>

<h3>Nivel 1: Configuración (<code>.sdd/sdd.config.yaml</code>)</h3>
<p>Cambios sin tocar lógica del plugin. Es el punto de entrada recomendado para la mayoría de los ajustes:</p>
<ul>
  <li>Activar / desactivar agentes</li>
  <li>Cambiar modelos por agente</li>
  <li>Cambiar rutas de archivos</li>
  <li>Ajustar umbrales de calidad</li>
  <li>Definir protecciones (archivos que no tocar, comandos prohibidos)</li>
  <li>Cambiar numeración de specs (fecha, secuencial o ambos)</li>
</ul>
<pre><code class="lang-json">
{
  "agentes": {
    "arquitecto": { "modelo": "opus" },
    "tester": { "modelo": "haiku", "activo": true },
    "documentador": { "activo": false }
  },
  "protecciones": {
    "no_tocar_archivos": [".env*", "src/legacy/**", "vendor/**"]
  },
  "comportamiento": {
    "numeracion_especificaciones": "secuencial"
  }
}
</code></pre>

<h3>Nivel 2: Plantillas (<code>plantillas/*.md</code>)</h3>
<p>Cambios en el formato de los artefactos generados. Las plantillas se leen al generar cada artefacto: editar una sección aquí afecta todos los artefactos futuros.</p>
<ul>
  <li>Modificar secciones de la spec</li>
  <li>Cambiar el formato del plan</li>
  <li>Personalizar el ADR</li>
  <li>Añadir o quitar secciones del snapshot</li>
</ul>

<h3>Nivel 3: Comandos (<code>commands/sdd.*.md</code>)</h3>
<p>Cambios en el comportamiento del flujo:</p>
<ul>
  <li>Modificar el orden de pasos en un comando</li>
  <li>Cambiar las preguntas que se hacen</li>
  <li>Ajustar criterios de detección automática (micro vs. grande)</li>
  <li>Personalizar mensajes y outputs</li>
</ul>

<h3>Nivel 4: Agentes (<code>agents/*.md</code>)</h3>
<p>Cambios en la personalidad y reglas de los expertos:</p>
<ul>
  <li>Añadir restricciones específicas del proyecto</li>
  <li>Cambiar el formato de salida de un agente</li>
  <li>Definir conocimiento de dominio</li>
  <li>Ajustar criterios de aceptación</li>
</ul>

<h3>Nivel 5: Hooks (<code>.sdd/hooks/*.sh</code>)</h3>
<p>Integración con sistemas externos. Los hooks se ejecutan en los eventos del ciclo de vida de SDD:</p>
<ul>
  <li>Git / GitLab / GitHub workflows</li>
  <li>Notificaciones (Slack, Teams, Discord)</li>
  <li>Triggers de CI/CD</li>
  <li>Linters y formatters automáticos</li>
  <li>Sync con sistemas de tickets (Jira, Linear)</li>
</ul>

<h2>Casos de uso comunes</h2>

<h3>Integración con Git</h3>
<pre><code class="lang-bash">
# .sdd/hooks/despues_especificar.sh
#!/bin/bash
SPEC_ID="$1"
git checkout -b "spec/\${SPEC_ID}"
echo "Branch creada: spec/\${SPEC_ID}"
</code></pre>

<h3>Notificación a Slack al aprobar un plan</h3>
<pre><code class="lang-bash">
# .sdd/hooks/despues_planificar.sh
#!/bin/bash
SPEC_ID=$(grep -o '"especificacion_activa": "[^"]*"' .sdd/estado.json | cut -d'"' -f4)
curl -X POST https://hooks.slack.com/services/XXX/YYY/ZZZ \
  -H 'Content-type: application/json' \
  --data "{\"text\":\"Plan aprobado: \${SPEC_ID}\"}"
</code></pre>

<h3>Añadir un agente nuevo</h3>
<ol>
  <li>Crea <code>agents/desarrollador-mobile.md</code> con frontmatter y rol.</li>
  <li>Añade entrada en <code>.sdd/sdd.config.yaml</code> bajo <code>agentes:</code>.</li>
  <li>Edita <code>skills/enrutador-agentes.md</code> para incluir cuándo invocarlo.</li>
  <li>(Opcional) Edita <code>commands/sdd.tareas.md</code> para asignarle tareas.</li>
</ol>

<h3>Bloquear archivos críticos</h3>
<pre><code class="lang-json">
{
  "protecciones": {
    "no_tocar_archivos": [".env*", "src/legacy/**", "secrets/**"]
  }
}
</code></pre>

<h2>Filosofía de personalización</h2>
<ul>
  <li><strong>Empieza simple</strong>: usa los defaults, personaliza solo cuando los necesites.</li>
  <li><strong>Documenta tus cambios</strong>: si cambias una plantilla, deja un comentario explicando por qué.</li>
  <li><strong>Commitea las personalizaciones</strong>: si trabajas en equipo, incluye los archivos modificados en el repositorio.</li>
  <li><strong>Versiona la constitución</strong>: cuando cambias principios, actualiza la versión MAYOR/MENOR/PARCHE.</li>
</ul>

<div class="callout tip">El nivel 1 (configuración YAML) resuelve el 80 % de los casos. Solo sube de nivel cuando la configuración no alcanza.</div>
`
    },
    en: {
      titulo: "Customization",
      html: `
<p class="lead">FORGE is designed to be fully customizable. Every artifact is plain Markdown or editable YAML — no binary configuration, no compilation. Five customization levels, from simplest to deepest.</p>

<h2>The 5 levels</h2>

<h3>Level 1: Configuration (<code>.sdd/sdd.config.yaml</code>)</h3>
<p>Changes without touching plugin logic. The recommended entry point for most adjustments:</p>
<ul>
  <li>Enable / disable agents</li>
  <li>Change models per agent</li>
  <li>Change file paths</li>
  <li>Adjust quality thresholds</li>
  <li>Define protections (files not to touch, forbidden commands)</li>
  <li>Change spec numbering (date, sequential, or both)</li>
</ul>

<h3>Level 2: Templates (<code>plantillas/*.md</code>)</h3>
<p>Changes to the format of generated artifacts. Templates are read when each artifact is generated: editing a section here affects all future artifacts.</p>

<h3>Level 3: Commands (<code>commands/sdd.*.md</code>)</h3>
<p>Changes to flow behavior: step order, questions asked, auto-detection criteria, messages and outputs.</p>

<h3>Level 4: Agents (<code>agents/*.md</code>)</h3>
<p>Changes to expert personality and rules: project-specific constraints, output format, domain knowledge, acceptance criteria.</p>

<h3>Level 5: Hooks (<code>.sdd/hooks/*.sh</code>)</h3>
<p>Integration with external systems: Git workflows, Slack/Teams notifications, CI/CD triggers, linters, ticket system sync (Jira, Linear).</p>

<h2>Common use cases</h2>

<h3>Add a new agent</h3>
<ol>
  <li>Create <code>agents/mobile-developer.md</code> with frontmatter and role.</li>
  <li>Add an entry in <code>.sdd/sdd.config.yaml</code> under <code>agentes:</code>.</li>
  <li>Edit <code>skills/enrutador-agentes.md</code> to include when to invoke it.</li>
  <li>(Optional) Edit <code>commands/sdd.tareas.md</code> to assign it specific tasks.</li>
</ol>

<h3>Block critical files</h3>
<pre><code class="lang-json">
{
  "protecciones": {
    "no_tocar_archivos": [".env*", "src/legacy/**", "secrets/**"]
  }
}
</code></pre>

<h2>Customization philosophy</h2>
<ul>
  <li><strong>Start simple</strong>: use the defaults, customize only when needed.</li>
  <li><strong>Document your changes</strong>: if you change a template, leave a comment explaining why.</li>
  <li><strong>Commit customizations</strong>: if working in a team, include modified files in the repository.</li>
  <li><strong>Version the constitution</strong>: when changing principles, update the MAJOR/MINOR/PATCH version.</li>
</ul>

<div class="callout tip">Level 1 (YAML configuration) solves 80% of cases. Only move to deeper levels when configuration is not enough.</div>
`
    }
  },
"prompts": {
    seccion: "prompts",
    es: {
      titulo: "Ingeniería de prompts con Claude",
      html: `
        <h1>Ingeniería de prompts con Claude</h1>
        <p class="lead">Un buen prompt hace dos cosas: da <strong>contexto específico</strong> y deja una <strong>forma de verificar</strong> el resultado. Todo lo demás se deriva de ahí. FORGE aplica estos principios en cada comando y agente.</p>

        <div class="callout">
          <div class="callout-title">El recurso que importa: la ventana de contexto</div>
          <p>El rendimiento de Claude se degrada a medida que el contexto se llena. Casi todas las buenas prácticas existen para gestionar ese recurso: dar lo justo, verificar pronto, y limpiar entre tareas.</p>
        </div>

        <h2>1. Contexto específico, no vago</h2>
        <p>El error más común es pedir poco. Claude no adivina lo que está en tu cabeza: nombra archivos, describe el síntoma con su ubicación, apunta a patrones existentes en el código.</p>
        <div class="compare">
          <div class="compare-col bad">
            <div class="compare-label">✗ Vago</div>
            <pre><code class="lang-text">arregla el login</code></pre>
            <p>Claude tiene que adivinar qué archivo, qué bug y cómo comprobar que quedó bien.</p>
          </div>
          <div class="compare-col good">
            <div class="compare-label">✓ Específico</div>
            <pre><code class="lang-text">el login en auth.js falla cuando
el email lleva mayúsculas. Debería
normalizar a minúsculas antes de
comparar. Añade un test que cubra
"User@Mail.com".</code></pre>
            <p>Archivo, causa, comportamiento esperado y verificación. Claude puede ejecutar.</p>
          </div>
        </div>
        <p>En FORGE esto está institucionalizado: <code>/sdd.especificar</code> obliga a escribir criterios de aceptación en formato <strong>Dado / Cuando / Entonces</strong> antes de tocar una línea de código. La especificidad no es opcional, es el primer paso.</p>

        <h2>2. Da una forma de verificar el trabajo</h2>
        <p>Claude debe mostrar <strong>evidencia</strong>, no afirmar éxito. La diferencia entre "ya quedó" y "los 12 tests pasan, aquí está la salida" es la diferencia entre confiar y comprobar.</p>
        <ul>
          <li>Provee checks ejecutables: tests, build, linter, capturas comparativas.</li>
          <li>Para que sea infalible, usa un <strong>hook</strong> que corra el check siempre (determinista), no una sugerencia que Claude pueda saltarse.</li>
        </ul>
        <p>FORGE materializa esto con su gate de calidad: una tarea no se marca como terminada hasta que los tests corren, el linter pasa y el criterio de aceptación se cumple. Y el hook <code>pre-tool-guard.js</code> bloquea operaciones peligrosas sin pedir opinión.</p>

        <h2>3. Explora, planea, luego implementa</h2>
        <p>Separar la investigación de la ejecución produce mejores resultados que pedir todo de golpe. El flujo recomendado:</p>
        <pre><code class="lang-text">Explorar  →  Planear  →  Implementar  →  Confirmar</code></pre>
        <p>Esto es exactamente el pipeline de FORGE: <code>/sdd.descubrir</code> explora, <code>/sdd.planificar</code> diseña, <code>/sdd.implementar</code> ejecuta. El plan se aprueba antes de escribir código. En Claude Code directamente, el <strong>plan mode</strong> (Shift+Tab) cumple el mismo rol.</p>

        <h2>4. Referencia con precisión</h2>
        <p>Usa <code>@archivo</code> para traer contenido al contexto, pega imágenes directamente, y envía datos por tubería con <code>cat archivo | claude</code>. Cuanto más preciso el ancla, menos adivina Claude.</p>
        <div class="callout tip">
          <div class="callout-title">Patrón FORGE</div>
          <p>El <code>CLAUDE.md</code> de FORGE usa <code>@.sdd/estado.json</code> para que Claude cargue el estado del proyecto al iniciar cada sesión, sin que tengas que recordarlo.</p>
        </div>

        <h2>5. CLAUDE.md: corto y potente</h2>
        <p>El archivo <code>CLAUDE.md</code> guía el comportamiento de Claude en tu proyecto. La regla de oro: <strong>incluye solo lo que Claude no puede inferir del código</strong>. Si es muy largo, Claude ignora las reglas críticas.</p>
        <div class="compare">
          <div class="compare-col bad">
            <div class="compare-label">✗ Sobrecargado</div>
            <pre><code class="lang-text">500 líneas explicando cada
carpeta, cada convención obvia,
historia del proyecto, tutoriales…</code></pre>
          </div>
          <div class="compare-col good">
            <div class="compare-label">✓ Esencial</div>
            <pre><code class="lang-text">Reglas no obvias.
Convención de commits.
Comandos de test/build.
Imports @ para lo extenso.</code></pre>
          </div>
        </div>

        <h2>6. Gestiona la sesión activamente</h2>
        <p>El contexto es finito. Trátalo como tal:</p>
        <table>
          <tr><th>Situación</th><th>Acción</th></tr>
          <tr><td>Cambias a una tarea no relacionada</td><td><code>/clear</code> para empezar limpio</td></tr>
          <tr><td>El contexto se llena pero la tarea sigue</td><td><code>/compact</code> con instrucciones de foco</td></tr>
          <tr><td>Investigación pesada (leer muchos archivos)</td><td>Subagentes: corren en contexto aparte y reportan un resumen</td></tr>
          <tr><td>Te equivocaste de rumbo</td><td><code>Esc Esc</code> o <code>/rewind</code> para volver a un checkpoint</td></tr>
        </table>
        <p>FORGE automatiza parte de esto: comprime la memoria de agentes cuando supera un umbral, y dispara compresión cada cierto número de tareas en sesiones largas. La gestión de contexto deja de depender de tu memoria.</p>

        <h2>7. Subagentes para mantener el contexto limpio</h2>
        <p>Delegar investigación a subagentes ("usa subagentes para investigar X") mantiene el contexto principal despejado: cada uno trabaja en su propia ventana y devuelve solo lo relevante. FORGE lleva esto al extremo con 14 agentes especializados, cada uno con su rol y su modelo asignado según la dificultad de la tarea.</p>

        <div class="callout tip">
          <div class="callout-title">Resumen accionable</div>
          <p>Sé específico · exige evidencia · explora antes de codear · referencia con <code>@</code> · mantén el <code>CLAUDE.md</code> corto · limpia el contexto entre tareas · delega la investigación. FORGE convierte cada uno de estos principios en un comportamiento automático.</p>
        </div>
      `
    },
    en: {
      titulo: "Prompt engineering with Claude",
      html: `
        <h1>Prompt engineering with Claude</h1>
        <p class="lead">A good prompt does two things: it gives <strong>specific context</strong> and leaves a <strong>way to verify</strong> the result. Everything else follows from that. FORGE applies these principles in every command and agent.</p>

        <div class="callout">
          <div class="callout-title">The resource that matters: the context window</div>
          <p>Claude's performance degrades as the context fills up. Almost every best practice exists to manage that resource: give just enough, verify early, and clear between tasks.</p>
        </div>

        <h2>1. Specific context, not vague</h2>
        <p>The most common mistake is asking for too little. Claude can't read your mind: name files, describe the symptom with its location, point to existing patterns in the code.</p>
        <div class="compare">
          <div class="compare-col bad">
            <div class="compare-label">✗ Vague</div>
            <pre><code class="lang-text">fix the login</code></pre>
            <p>Claude has to guess which file, which bug, and how to confirm it's fixed.</p>
          </div>
          <div class="compare-col good">
            <div class="compare-label">✓ Specific</div>
            <pre><code class="lang-text">the login in auth.js fails when
the email has uppercase. It should
normalize to lowercase before
comparing. Add a test covering
"User@Mail.com".</code></pre>
            <p>File, cause, expected behavior and verification. Claude can execute.</p>
          </div>
        </div>
        <p>FORGE institutionalizes this: <code>/sdd.especificar</code> forces you to write acceptance criteria in <strong>Given / When / Then</strong> format before touching a line of code. Specificity isn't optional, it's step one.</p>

        <h2>2. Give a way to verify the work</h2>
        <p>Claude should show <strong>evidence</strong>, not claim success. The difference between "it's done" and "all 12 tests pass, here's the output" is the difference between trusting and checking.</p>
        <ul>
          <li>Provide executable checks: tests, build, linter, comparative screenshots.</li>
          <li>To make it foolproof, use a <strong>hook</strong> that always runs the check (deterministic), not a suggestion Claude can skip.</li>
        </ul>
        <p>FORGE makes this real with its quality gate: a task isn't marked done until tests run, the linter passes and the acceptance criterion is met. And the <code>pre-tool-guard.js</code> hook blocks dangerous operations without asking.</p>

        <h2>3. Explore, plan, then implement</h2>
        <p>Separating research from execution yields better results than asking for everything at once. The recommended flow:</p>
        <pre><code class="lang-text">Explore  →  Plan  →  Implement  →  Confirm</code></pre>
        <p>This is exactly FORGE's pipeline: <code>/sdd.descubrir</code> explores, <code>/sdd.planificar</code> designs, <code>/sdd.implementar</code> executes. The plan is approved before any code is written. In Claude Code directly, <strong>plan mode</strong> (Shift+Tab) plays the same role.</p>

        <h2>4. Reference precisely</h2>
        <p>Use <code>@file</code> to pull content into context, paste images directly, and pipe data with <code>cat file | claude</code>. The more precise the anchor, the less Claude guesses.</p>
        <div class="callout tip">
          <div class="callout-title">FORGE pattern</div>
          <p>FORGE's <code>CLAUDE.md</code> uses <code>@.sdd/estado.json</code> so Claude loads the project state at the start of each session, without you having to remember it.</p>
        </div>

        <h2>5. CLAUDE.md: short and powerful</h2>
        <p>The <code>CLAUDE.md</code> file guides Claude's behavior in your project. The golden rule: <strong>include only what Claude can't infer from the code</strong>. If it's too long, Claude ignores the critical rules.</p>
        <div class="compare">
          <div class="compare-col bad">
            <div class="compare-label">✗ Overloaded</div>
            <pre><code class="lang-text">500 lines explaining every
folder, every obvious convention,
project history, tutorials…</code></pre>
          </div>
          <div class="compare-col good">
            <div class="compare-label">✓ Essential</div>
            <pre><code class="lang-text">Non-obvious rules.
Commit convention.
Test/build commands.
@ imports for long content.</code></pre>
          </div>
        </div>

        <h2>6. Manage the session actively</h2>
        <p>Context is finite. Treat it that way:</p>
        <table>
          <tr><th>Situation</th><th>Action</th></tr>
          <tr><td>Switching to an unrelated task</td><td><code>/clear</code> to start fresh</td></tr>
          <tr><td>Context fills but the task continues</td><td><code>/compact</code> with focus instructions</td></tr>
          <tr><td>Heavy research (reading many files)</td><td>Subagents: run in separate context and report a summary</td></tr>
          <tr><td>You went the wrong way</td><td><code>Esc Esc</code> or <code>/rewind</code> to return to a checkpoint</td></tr>
        </table>
        <p>FORGE automates part of this: it compresses agent memory when it exceeds a threshold, and triggers compression every few tasks in long sessions. Context management stops depending on your memory.</p>

        <h2>7. Subagents to keep context clean</h2>
        <p>Delegating research to subagents ("use subagents to investigate X") keeps the main context clear: each works in its own window and returns only what's relevant. FORGE takes this to the extreme with 14 specialized agents, each with its role and model assigned according to task difficulty.</p>

        <div class="callout tip">
          <div class="callout-title">Actionable summary</div>
          <p>Be specific · demand evidence · explore before coding · reference with <code>@</code> · keep <code>CLAUDE.md</code> short · clear context between tasks · delegate research. FORGE turns each of these principles into automatic behavior.</p>
        </div>
      `
    }
  },
"prompts-profesionales": {
    seccion: "prompts",
    es: {
      titulo: "Patrones de prompts profesionales",
      html: `
        <h1>Patrones de prompts profesionales</h1>
        <p class="lead">Claude Code es un agente que toma decisiones: qué archivos leer, qué enfoque seguir, qué herramientas usar. La calidad de esas decisiones depende directamente de la calidad de tus instrucciones.</p>

        <div class="callout">
          <div class="callout-title">La estructura detrás de cada patrón</div>
          <p>Todo prompt profesional se compone de hasta cinco piezas: <strong>Contexto</strong> (qué necesita saber Claude), <strong>Tarea</strong> (qué tiene que hacer exactamente), <strong>Restricciones</strong> (qué no debe hacer), <strong>Formato</strong> (cómo quieres el resultado) y <strong>Verificación</strong> (cómo confirmar que está bien). No todos los prompts necesitan las cinco — pero cuando el resultado no es el esperado, casi siempre falta una.</p>
        </div>

        <h2>Vago vs. Profesional — 3 ejemplos reales</h2>

        <h3>Par 1 — Manejo de errores</h3>
        <div class="compare">
          <div class="compare-col bad">
            <div class="compare-label">✗ Vago</div>
            <pre><code class="lang-text">Añade manejo de errores al servidor</code></pre>
            <p>Claude puede añadir un try-catch genérico, un middleware complejo, tocar archivos que no debería. El resultado es impredecible.</p>
          </div>
          <div class="compare-col good">
            <div class="compare-label">✓ Profesional</div>
            <pre><code class="lang-text">Contexto: Snap es un servidor Express + TypeScript.
Solo tiene un endpoint GET /health.

Tarea: Añade dos middlewares al final de la cadena:
- Handler para rutas no encontradas → 404 JSON
- Handler global de errores → 500 sin exponer detalles

Restricciones:
- No modifiques el endpoint /health
- No instales dependencias nuevas
- En desarrollo: el error handler puede incluir el
  mensaje; en producción no

Verificación: Tests que comprueben 404 en ruta
inexistente y que el servidor no cae ante errores.</code></pre>
          </div>
        </div>

        <h3>Par 2 — Configuración del proyecto</h3>
        <div class="compare">
          <div class="compare-col bad">
            <div class="compare-label">✗ Vago</div>
            <pre><code class="lang-text">Haz un módulo de configuración</code></pre>
            <p>Claude puede crear desde un objeto simple hasta un sistema con dotenv, Zod y validación compleja. El estudiante no controla qué obtiene.</p>
          </div>
          <div class="compare-col good">
            <div class="compare-label">✓ Profesional</div>
            <pre><code class="lang-text">Contexto: Snap es un servidor Express + TypeScript.
Los valores están hardcodeados en el código.

Tarea: Crea src/config.ts con:
- Puerto del servidor (default 3000)
- Entorno (development/production, default development)
- Nombre de la BD SQLite (default "snap.db")

Restricciones:
- No instales dotenv; usa process.env directamente
- Exporta un objeto tipado, no variables sueltas
- Si falta una variable obligatoria en producción,
  lanza error al arrancar (no en mitad de una petición)

Verificación: Test que compruebe defaults sin env vars
y error si falta variable obligatoria en producción.</code></pre>
          </div>
        </div>

        <h3>Par 3 — Logging de peticiones</h3>
        <div class="compare">
          <div class="compare-col bad">
            <div class="compare-label">✗ Vago</div>
            <pre><code class="lang-text">Añade logs al servidor</code></pre>
            <p>Claude puede instalar Winston, Pino, Morgan, crear rotación de logs, niveles de severidad... todo a su criterio.</p>
          </div>
          <div class="compare-col good">
            <div class="compare-label">✓ Profesional</div>
            <pre><code class="lang-text">Contexto: Snap es un servidor Express + TypeScript
en fase inicial. Sin logging de peticiones todavía.

Tarea: Añade un middleware que registre cada petición:
método, ruta, código de respuesta y tiempo en ms.
Formato: GET /health → 200 (12ms)

Restricciones:
- Usa console.log, no instales librerías de logging
- El middleware va al principio de la cadena
- No loguees el body (puede tener passwords)

Verificación: Arranca el servidor, haz curl a /health,
confirma que el log aparece con el formato esperado.</code></pre>
          </div>
        </div>

        <h2>Los 7 patrones</h2>
        <p>Cada tipo de tarea tiene un patrón específico. Usa <code>/mejorar-prompt</code> para que FORGE identifique cuál aplica y construya la versión profesional automáticamente.</p>

        <h3>1. Implementar una feature</h3>
        <pre><code class="lang-text">Contexto: [proyecto, stack, qué existe ya]

Tarea: Implementa [feature] con estos requisitos:
- [requisito concreto 1]
- [requisito concreto 2]

Restricciones:
- [qué no cambiar]
- [dependencias que no instalar]

Verificación: [tests a crear y ejecutar]</code></pre>
        <div class="callout tip">El contexto evita que Claude invente una estructura propia. Las restricciones protegen lo que ya funciona. La verificación cierra el ciclo.</div>

        <h3>2. Depurar un problema</h3>
        <pre><code class="lang-text">Contexto: [qué estaba haciendo cuando ocurrió]

Tarea: Tengo este error:
[pegar error completo con stack trace]
Archivo: [archivo y línea si lo sabes]

Formato: Antes de corregir nada:
1. Identifica la causa raíz, no el síntoma
2. Explica por qué ocurre
3. Propón el fix y justifícalo
4. ¿Qué más podría verse afectado?

Verificación: Añade un test que reproduzca el bug
antes del fix y que pase después.</code></pre>
        <div class="callout tip">El escenario reproducible vale más que cualquier descripción. "Antes de corregir" obliga a Claude a pensar antes de actuar.</div>

        <h3>3. Refactorizar</h3>
        <pre><code class="lang-text">Contexto: [qué módulo y por qué refactorizarlo]

Tarea: Refactoriza [archivo] para [objetivo concreto].

Restricciones:
- La API pública NO debe cambiar
- Los tests existentes deben pasar sin modificarlos
- Sigue el patrón [patrón del proyecto]

Formato: Antes de tocar código:
1. Muéstrame qué cambiarías y por qué
2. Lista los archivos afectados
3. Identifica riesgos

Verificación: Ejecuta todos los tests sin cambiarlos.
Si alguno falla, el refactoring rompió algo.</code></pre>
        <div class="callout tip">"Los tests existentes pasan sin cambiarlos" es la red de seguridad más potente. Convierte un cambio destructivo en algo verificable.</div>

        <h3>4. Explorar un proyecto</h3>
        <pre><code class="lang-text">Tarea: Analiza [proyecto/módulo] y responde:
- [pregunta sobre estructura]
- [pregunta sobre patrones]
- [pregunta sobre dependencias]

Formato: [resumen breve por pregunta + diagrama ASCII]

Restricciones: No modifiques nada. Solo lectura.</code></pre>
        <div class="callout tip">Cuando Claude explora antes de implementar, ancla sus decisiones en la realidad del código en lugar de suposiciones genéricas.</div>

        <h3>5. Escribir tests</h3>
        <pre><code class="lang-text">Contexto: [módulo/servicio y qué hace]

Tarea: Genera tests para [archivo].
Para cada función pública:
- Happy path (caso normal)
- Edge case [ejemplos relevantes]
- Error [ejemplos relevantes]

Restricciones: [framework de testing del proyecto]

Verificación: Ejecuta los tests. Muéstrame la
cobertura del archivo.</code></pre>
        <div class="callout tip">Especificar las tres categorías con ejemplos concretos produce tests que realmente encuentran bugs. Sin eso, Claude genera tests que verifican lo obvio.</div>

        <h3>6. Documentar</h3>
        <pre><code class="lang-text">Contexto: [quién va a leer esta doc y para qué]

Tarea: Genera documentación para [archivo/API]:
- [qué secciones necesitas]
- [nivel de detalle]

Formato: [Markdown, JSDoc, README, etc.]

Verificación: Compara el resultado con las rutas
del código. Si falta un endpoint, añádelo.</code></pre>
        <div class="callout tip">Definir quién va a leer la doc cambia radicalmente el resultado. "Para onboarding" produce algo distinto a "para el equipo de QA".</div>

        <h3>7. Pedir justificación</h3>
        <pre><code class="lang-text">Sobre [la implementación que acabas de hacer]:
1. ¿Qué alternativas consideraste y por qué
   elegiste esta?
2. ¿Qué trade-offs tiene tu decisión?
3. ¿Qué podría fallar con este enfoque?
4. ¿Qué harías diferente con más tiempo o
   a mayor escala?</code></pre>
        <div class="callout tip">Claude no explica sus decisiones a menos que se lo pidas. Este patrón convierte a Claude en revisor de su propio código.</div>

        <h2>Combinando patrones: la cadena</h2>
        <p>Los patrones no se usan aislados. Una tarea compleja es una secuencia donde cada prompt usa un patrón distinto:</p>
        <pre><code class="lang-text">Explorar    → "Analiza cómo funciona el módulo X"
Implementar → "Siguiendo ese patrón, añade Y"
Tests       → "Genera tests para lo que acabas de implementar"
Justificar  → "¿Qué alternativas consideraste?"
Documentar  → "Actualiza la documentación con los cambios"</code></pre>
        <p>La regla es que cada prompt de la cadena produce algo verificable antes de lanzar el siguiente. Si no puedes comprobar el resultado, el paso es demasiado grande o le falta el componente de verificación.</p>

        <div class="callout tip">
          <div class="callout-title">Usa /mejorar-prompt en FORGE</div>
          <p>La skill <code>/mejorar-prompt</code> automatiza este proceso: detecta el patrón de los 7 que aplica, construye la versión profesional con los 5 componentes, y advierte si el prompt sale del alcance de la spec activa.</p>
        </div>
      `
    },
    en: {
      titulo: "Professional prompt patterns",
      html: `
        <h1>Professional prompt patterns</h1>
        <p class="lead">Claude Code is an agent that makes decisions: which files to read, which approach to follow, which tools to use. The quality of those decisions depends directly on the quality of your instructions.</p>

        <div class="callout">
          <div class="callout-title">The structure behind each pattern</div>
          <p>Every professional prompt has up to five pieces: <strong>Context</strong> (what Claude needs to know), <strong>Task</strong> (exactly what to do), <strong>Constraints</strong> (what not to do), <strong>Format</strong> (how you want the result) and <strong>Verification</strong> (how to confirm it worked). Not every prompt needs all five — but when the result is off, almost always one is missing.</p>
        </div>

        <h2>Vague vs. Professional — 3 real examples</h2>

        <h3>Pair 1 — Error handling</h3>
        <div class="compare">
          <div class="compare-col bad">
            <div class="compare-label">✗ Vague</div>
            <pre><code class="lang-text">Add error handling to the server</code></pre>
            <p>Claude might add a generic try-catch, a complex middleware, or touch files it shouldn't. The result is unpredictable.</p>
          </div>
          <div class="compare-col good">
            <div class="compare-label">✓ Professional</div>
            <pre><code class="lang-text">Context: Snap is an Express + TypeScript server.
It only has one GET /health endpoint.

Task: Add two middlewares at the end of the chain:
- Handler for not-found routes → 404 JSON
- Global error handler → 500 without exposing details

Constraints:
- Don't modify the /health endpoint
- Don't install new dependencies
- In development: error handler may include the error
  message; in production it must not

Verification: Tests that check 404 on unknown routes
and that the server doesn't crash on unexpected errors.</code></pre>
          </div>
        </div>

        <h3>Pair 2 — Project configuration</h3>
        <div class="compare">
          <div class="compare-col bad">
            <div class="compare-label">✗ Vague</div>
            <pre><code class="lang-text">Make a config module</code></pre>
            <p>Claude could create anything from a simple object to a full system with dotenv, Zod and schema validation. You don't control what you get.</p>
          </div>
          <div class="compare-col good">
            <div class="compare-label">✓ Professional</div>
            <pre><code class="lang-text">Context: Snap is an Express + TypeScript server.
Values are currently hardcoded in the code.

Task: Create src/config.ts with:
- Server port (default 3000)
- Environment (development/production, default development)
- SQLite database name (default "snap.db")

Constraints:
- Don't install dotenv; use process.env directly
- Export a typed object, not loose variables
- If a required variable is missing in production,
  throw an error at startup (not mid-request)

Verification: Test that checks defaults without env vars
and throws if a required variable is missing in production.</code></pre>
          </div>
        </div>

        <h3>Pair 3 — Request logging</h3>
        <div class="compare">
          <div class="compare-col bad">
            <div class="compare-label">✗ Vague</div>
            <pre><code class="lang-text">Add logs to the server</code></pre>
            <p>Claude could install Winston, Pino, Morgan, create log rotation, severity levels... all at its discretion.</p>
          </div>
          <div class="compare-col good">
            <div class="compare-label">✓ Professional</div>
            <pre><code class="lang-text">Context: Snap is an Express + TypeScript server
in early stage. No request logging yet.

Task: Add a middleware that logs each HTTP request:
method, route, response code and time in ms.
Format: GET /health → 200 (12ms)

Constraints:
- Use console.log, don't install logging libraries
- Middleware goes at the beginning of the chain
- Don't log the request body (may contain passwords)

Verification: Start the server, curl /health, confirm
the log appears in the terminal with the expected format.</code></pre>
          </div>
        </div>

        <h2>The 7 patterns</h2>
        <p>Each type of task has a specific pattern. Use <code>/mejorar-prompt</code> to have FORGE identify which one applies and build the professional version automatically.</p>

        <h3>1. Implement a feature</h3>
        <pre><code class="lang-text">Context: [project, stack, what already exists]

Task: Implement [feature] with these requirements:
- [concrete requirement 1]
- [concrete requirement 2]

Constraints:
- [what not to change]
- [dependencies not to install]

Verification: [tests to create and run]</code></pre>

        <h3>2. Debug a problem</h3>
        <pre><code class="lang-text">Context: [what you were doing when it happened]

Task: I have this error:
[paste full error with stack trace]
File: [file and line if you know it]

Format: Before fixing anything:
1. Identify the root cause, not the symptom
2. Explain why it happens
3. Propose the fix and justify it
4. What else could be affected?

Verification: Add a test that reproduces the bug
before the fix and passes after.</code></pre>

        <h3>3. Refactor</h3>
        <pre><code class="lang-text">Context: [which module and why refactor it]

Task: Refactor [file] to [concrete goal].

Constraints:
- The public API must NOT change
- Existing tests must pass without modifying them
- Follow the [project pattern]

Format: Before touching code, show me:
1. What you'd change and why
2. List of affected files
3. Risks

Verification: Run all tests without changing them.</code></pre>

        <h3>4. Explore a project</h3>
        <pre><code class="lang-text">Task: Analyze [project/module] and answer:
- [question about structure]
- [question about patterns]

Format: [brief summary per question + ASCII diagram]

Constraints: Don't modify anything. Read-only.</code></pre>

        <h3>5. Write tests</h3>
        <pre><code class="lang-text">Context: [module/service and what it does]

Task: Generate tests for [file].
For each public function:
- Happy path
- Edge case [relevant examples]
- Error [relevant examples]

Constraints: [project testing framework]

Verification: Run the tests. Show me coverage.</code></pre>

        <h3>6. Document</h3>
        <pre><code class="lang-text">Context: [who will read this and why]

Task: Generate documentation for [file/API]:
- [needed sections]

Format: [Markdown, JSDoc, README, etc.]

Verification: Compare against the actual routes in
code. If an endpoint is missing, add it.</code></pre>

        <h3>7. Ask for justification</h3>
        <pre><code class="lang-text">About [the implementation you just did]:
1. What alternatives did you consider and why
   did you choose this one?
2. What trade-offs does your decision have?
3. What could fail with this approach?
4. What would you do differently with more time
   or at larger scale?</code></pre>

        <h2>Combining patterns: the chain</h2>
        <p>Patterns are not used in isolation. A complex task is a sequence where each prompt uses a different pattern:</p>
        <pre><code class="lang-text">Explore     → "Analyze how module X works"
Implement   → "Following that pattern, add Y"
Tests       → "Generate tests for what you just implemented"
Justify     → "What alternatives did you consider?"
Document    → "Update the documentation with the changes"</code></pre>
        <p>The rule is that each prompt in the chain produces something verifiable before launching the next. If you can't check the result, the step is too big or missing the verification component.</p>

        <div class="callout tip">
          <div class="callout-title">Use /mejorar-prompt in FORGE</div>
          <p>The <code>/mejorar-prompt</code> skill automates this process: it detects which of the 7 patterns applies, builds the professional version with all 5 components, and warns if the prompt falls outside the active spec's scope.</p>
        </div>
      `
    }
  },
"comandos": {
    seccion: "ref",
    es: {
      titulo: "Todos los comandos",
      html: `
        <h1>Todos los comandos</h1>
        <p class="lead">FORGE expone 35 comandos <code>/sdd.*</code>. El hub <code>/sdd</code> entiende lenguaje natural y te enruta al correcto; rara vez necesitas memorizarlos.</p>

        <h2>Inicialización</h2>
        <div class="table-wrap"><table>
          <tr><th>Comando</th><th>Qué hace</th></tr>
          <tr><td><code>/sdd</code></td><td>Hub central — entiende lenguaje natural</td></tr>
          <tr><td><code>/sdd.descubrir</code></td><td>Extrae contexto de una idea vaga</td></tr>
          <tr><td><code>/sdd.constitucion</code></td><td>Establece los principios del proyecto</td></tr>
          <tr><td><code>/sdd.configurar</code></td><td>Ajusta agentes y modelos</td></tr>
          <tr><td><code>/sdd.ayuda</code></td><td>Guía completa</td></tr>
        </table></div>

        <h2>Especificación</h2>
        <div class="table-wrap"><table>
          <tr><th>Comando</th><th>Qué hace</th></tr>
          <tr><td><code>/sdd.especificar</code></td><td>Captura requisitos en formato SDD</td></tr>
          <tr><td><code>/sdd.importar</code></td><td>Importa una spec externa (URL, archivo)</td></tr>
          <tr><td><code>/sdd.aclarar</code></td><td>Resuelve ambigüedades pendientes</td></tr>
          <tr><td><code>/sdd.checklist</code></td><td>Valida la calidad formal de la spec</td></tr>
        </table></div>

        <h2>Planificación e implementación</h2>
        <div class="table-wrap"><table>
          <tr><th>Comando</th><th>Qué hace</th></tr>
          <tr><td><code>/sdd.planificar</code></td><td>Genera el plan técnico</td></tr>
          <tr><td><code>/sdd.tareas</code></td><td>Desglosa en tareas atómicas</td></tr>
          <tr><td><code>/sdd.analizar</code></td><td>Auditoría de consistencia</td></tr>
          <tr><td><code>/sdd.implementar</code></td><td>Ejecuta las tareas</td></tr>
          <tr><td><code>/sdd.qa</code></td><td>QA en navegador real</td></tr>
          <tr><td><code>/sdd.verificar</code></td><td>Verificación final contra la spec</td></tr>
        </table></div>

        <h2>Despliegue y producto</h2>
        <div class="table-wrap"><table>
          <tr><th>Comando</th><th>Qué hace</th></tr>
          <tr><td><code>/sdd.desplegar</code></td><td>Publica con verificación y health check</td></tr>
          <tr><td><code>/sdd.canary</code></td><td>Vigila el servicio recién desplegado</td></tr>
          <tr><td><code>/sdd.retro</code></td><td>Retrospectiva del ciclo</td></tr>
          <tr><td><code>/sdd.snapshot</code></td><td>Actualiza el estado del producto</td></tr>
          <tr><td><code>/sdd.glosario</code></td><td>Gestiona términos del dominio</td></tr>
          <tr><td><code>/sdd.estado</code></td><td>Dashboard de progreso</td></tr>
          <tr><td><code>/sdd.release</code></td><td>Versión semántica + CHANGELOG</td></tr>
        </table></div>

        <h2>Fábrica (idea → producto)</h2>
        <div class="table-wrap"><table>
          <tr><th>Comando</th><th>Qué hace</th></tr>
          <tr><td><code>/sdd.interpretar</code></td><td>Interpreta la idea y genera el IR</td></tr>
          <tr><td><code>/sdd.diseñar</code></td><td>Elige dirección visual y diseño de producto</td></tr>
          <tr><td><code>/sdd.construir</code></td><td>Pipeline completo automático</td></tr>
          <tr><td><code>/sdd.exportar</code></td><td>Empaqueta el proyecto como bundle</td></tr>
          <tr><td><code>/sdd.crear-app</code></td><td>Genera una app web o CLI</td></tr>
          <tr><td><code>/sdd.crear-mcp</code></td><td>Genera un servidor MCP empaquetado</td></tr>
        </table></div>

        <h2>Calidad y utilidades</h2>
        <div class="table-wrap"><table>
          <tr><th>Comando</th><th>Qué hace</th></tr>
          <tr><td><code>/sdd.compliance</code></td><td>Reporte de cumplimiento (GDPR, SOC2, etc.)</td></tr>
          <tr><td><code>/sdd.adr</code></td><td>Registra una decisión de arquitectura</td></tr>
          <tr><td><code>/sdd.defect-report</code></td><td>Reporte de defectos y tasa de bugs</td></tr>
          <tr><td><code>/sdd.mapear</code></td><td>Indexa estructura, símbolos y dependencias</td></tr>
          <tr><td><code>/sdd.comprimir</code></td><td>Comprime memoria para ahorrar contexto</td></tr>
          <tr><td><code>/sdd.optimizar</code></td><td>Optimiza artefactos para reducir contexto</td></tr>
          <tr><td><code>/sdd.optimizar-memoria</code></td><td>Compacta la memoria del agente activo</td></tr>
        </table></div>
      `
    },
    en: {
      titulo: "All commands",
      html: `
        <h1>All commands</h1>
        <p class="lead">FORGE exposes 35 <code>/sdd.*</code> commands. The <code>/sdd</code> hub understands natural language and routes you to the right one; you rarely need to memorize them.</p>

        <h2>Initialization</h2>
        <div class="table-wrap"><table>
          <tr><th>Command</th><th>What it does</th></tr>
          <tr><td><code>/sdd</code></td><td>Central hub — understands natural language</td></tr>
          <tr><td><code>/sdd.descubrir</code></td><td>Extracts context from a vague idea</td></tr>
          <tr><td><code>/sdd.constitucion</code></td><td>Sets the project principles</td></tr>
          <tr><td><code>/sdd.configurar</code></td><td>Adjusts agents and models</td></tr>
          <tr><td><code>/sdd.ayuda</code></td><td>Full guide</td></tr>
        </table></div>

        <h2>Specification</h2>
        <div class="table-wrap"><table>
          <tr><th>Command</th><th>What it does</th></tr>
          <tr><td><code>/sdd.especificar</code></td><td>Captures requirements in SDD format</td></tr>
          <tr><td><code>/sdd.importar</code></td><td>Imports an external spec (URL, file)</td></tr>
          <tr><td><code>/sdd.aclarar</code></td><td>Resolves pending ambiguities</td></tr>
          <tr><td><code>/sdd.checklist</code></td><td>Validates the formal quality of the spec</td></tr>
        </table></div>

        <h2>Planning and implementation</h2>
        <div class="table-wrap"><table>
          <tr><th>Command</th><th>What it does</th></tr>
          <tr><td><code>/sdd.planificar</code></td><td>Generates the technical plan</td></tr>
          <tr><td><code>/sdd.tareas</code></td><td>Breaks down into atomic tasks</td></tr>
          <tr><td><code>/sdd.analizar</code></td><td>Consistency audit</td></tr>
          <tr><td><code>/sdd.implementar</code></td><td>Executes the tasks</td></tr>
          <tr><td><code>/sdd.qa</code></td><td>QA in a real browser</td></tr>
          <tr><td><code>/sdd.verificar</code></td><td>Final verification against the spec</td></tr>
        </table></div>

        <h2>Deployment and product</h2>
        <div class="table-wrap"><table>
          <tr><th>Command</th><th>What it does</th></tr>
          <tr><td><code>/sdd.desplegar</code></td><td>Ships with verification and health check</td></tr>
          <tr><td><code>/sdd.canary</code></td><td>Watches the freshly deployed service</td></tr>
          <tr><td><code>/sdd.retro</code></td><td>Cycle retrospective</td></tr>
          <tr><td><code>/sdd.snapshot</code></td><td>Updates the product state</td></tr>
          <tr><td><code>/sdd.glosario</code></td><td>Manages domain terms</td></tr>
          <tr><td><code>/sdd.estado</code></td><td>Progress dashboard</td></tr>
          <tr><td><code>/sdd.release</code></td><td>Semantic version + CHANGELOG</td></tr>
        </table></div>

        <h2>Factory (idea → product)</h2>
        <div class="table-wrap"><table>
          <tr><th>Command</th><th>What it does</th></tr>
          <tr><td><code>/sdd.interpretar</code></td><td>Interprets the idea and generates the IR</td></tr>
          <tr><td><code>/sdd.diseñar</code></td><td>Picks visual direction and product design</td></tr>
          <tr><td><code>/sdd.construir</code></td><td>Full automatic pipeline</td></tr>
          <tr><td><code>/sdd.exportar</code></td><td>Packages the project as a bundle</td></tr>
          <tr><td><code>/sdd.crear-app</code></td><td>Generates a web or CLI app</td></tr>
          <tr><td><code>/sdd.crear-mcp</code></td><td>Generates a packaged MCP server</td></tr>
        </table></div>

        <h2>Quality and utilities</h2>
        <div class="table-wrap"><table>
          <tr><th>Command</th><th>What it does</th></tr>
          <tr><td><code>/sdd.compliance</code></td><td>Compliance report (GDPR, SOC2, etc.)</td></tr>
          <tr><td><code>/sdd.adr</code></td><td>Records an architecture decision</td></tr>
          <tr><td><code>/sdd.defect-report</code></td><td>Defect report and bug rate</td></tr>
          <tr><td><code>/sdd.mapear</code></td><td>Indexes structure, symbols and dependencies</td></tr>
          <tr><td><code>/sdd.comprimir</code></td><td>Compresses memory to save context</td></tr>
          <tr><td><code>/sdd.optimizar</code></td><td>Optimizes artifacts to reduce context</td></tr>
          <tr><td><code>/sdd.optimizar-memoria</code></td><td>Compacts the active agent's memory</td></tr>
        </table></div>
      `
    }
  },

  "glosario": {
    seccion: "ref",
    es: {
      titulo: "Glosario",
      html: `
        <h1>Glosario</h1>
        <p class="lead">Términos de FORGE y de Claude Code que aparecen en esta documentación.</p>
        <div class="table-wrap"><table>
          <tr><th>Término</th><th>Definición</th></tr>
          <tr><td><strong>SDD</strong></td><td>Spec-Driven Development: escribir la especificación antes que el código. La spec es la fuente de verdad.</td></tr>
          <tr><td><strong>Agente</strong></td><td>Un subagente de Claude Code con un rol especializado (arquitecto, tester, seguridad…). FORGE tiene 14.</td></tr>
          <tr><td><strong>Skill</strong></td><td>Una capacidad reutilizable que un agente invoca (compresión, indexado, presupuesto de tokens…).</td></tr>
          <tr><td><strong>Hook</strong></td><td>Un script que Claude Code ejecuta automáticamente antes (PreToolUse) o después (PostToolUse) de una operación.</td></tr>
          <tr><td><strong>IR</strong></td><td>Interpreted Requirement: la idea del usuario interpretada y estructurada antes de diseñar.</td></tr>
          <tr><td><strong>Pipeline</strong></td><td>La secuencia de fases: descubrir → especificar → planificar → implementar → verificar → desplegar.</td></tr>
          <tr><td><strong>Criterio de aceptación</strong></td><td>Condición verificable en formato Dado / Cuando / Entonces que define cuándo una tarea está completa.</td></tr>
          <tr><td><strong>Modo guiado</strong></td><td>El modo sin jerga de FORGE para personas no técnicas. Activo por defecto.</td></tr>
          <tr><td><strong>Ledger</strong></td><td>Registro JSONL de cada escritura de archivo, para observabilidad sin coste de tokens.</td></tr>
          <tr><td><strong>Ventana de contexto</strong></td><td>El espacio de memoria de trabajo de Claude en una sesión. Recurso finito que hay que gestionar.</td></tr>
          <tr><td><strong>MCP</strong></td><td>Model Context Protocol: forma estándar de conectar Claude con herramientas externas (Figma, Playwright…).</td></tr>
          <tr><td><strong><code>.sdd/</code></strong></td><td>La carpeta donde FORGE guarda el estado del proyecto: specs, planes, memoria, mapas.</td></tr>
        </table></div>
      `
    },
    en: {
      titulo: "Glossary",
      html: `
        <h1>Glossary</h1>
        <p class="lead">FORGE and Claude Code terms that appear in this documentation.</p>
        <div class="table-wrap"><table>
          <tr><th>Term</th><th>Definition</th></tr>
          <tr><td><strong>SDD</strong></td><td>Spec-Driven Development: writing the specification before the code. The spec is the source of truth.</td></tr>
          <tr><td><strong>Agent</strong></td><td>A Claude Code subagent with a specialized role (architect, tester, security…). FORGE has 14.</td></tr>
          <tr><td><strong>Skill</strong></td><td>A reusable capability an agent invokes (compression, indexing, token budget…).</td></tr>
          <tr><td><strong>Hook</strong></td><td>A script Claude Code runs automatically before (PreToolUse) or after (PostToolUse) an operation.</td></tr>
          <tr><td><strong>IR</strong></td><td>Interpreted Requirement: the user's idea interpreted and structured before designing.</td></tr>
          <tr><td><strong>Pipeline</strong></td><td>The sequence of phases: discover → specify → plan → implement → verify → deploy.</td></tr>
          <tr><td><strong>Acceptance criterion</strong></td><td>A verifiable condition in Given / When / Then format that defines when a task is complete.</td></tr>
          <tr><td><strong>Guided mode</strong></td><td>FORGE's jargon-free mode for non-technical people. On by default.</td></tr>
          <tr><td><strong>Ledger</strong></td><td>JSONL record of every file write, for observability without token cost.</td></tr>
          <tr><td><strong>Context window</strong></td><td>Claude's working memory in a session. A finite resource that must be managed.</td></tr>
          <tr><td><strong>MCP</strong></td><td>Model Context Protocol: a standard way to connect Claude with external tools (Figma, Playwright…).</td></tr>
          <tr><td><strong><code>.sdd/</code></strong></td><td>The folder where FORGE stores project state: specs, plans, memory, maps.</td></tr>
        </table></div>
      `
    }
  }
};
