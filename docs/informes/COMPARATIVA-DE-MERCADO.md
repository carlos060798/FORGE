# Comparativa de mercado: Fragua/FORGE frente a alternativas SDD

Fecha de la investigación: 2026-11-06. Método: lectura de README.md, AGENTS.md y docs/FORGE-5.0-GUIA.md (solo lectura) y consulta de las páginas oficiales indicadas. Cada celda sale de la fuente citada; lo que la página no decía se marca **[no verificado]**. Las cifras de estrellas cambian rápido.

## 1. Qué es FORGE/Fragua (según su propia documentación)
- SDD en español, paquete npm `fragua` (antes `forja-mvp`), plugin de Claude Code; 14 agentes, 39 comandos, pipeline de 9 etapas con guard de aprobación humana `spec -> plan` (`forge aprobar spec`).
- Ciclo verificado (5.0): un agente escribe pruebas que deben fallar, otro implementa sin tocar las pruebas, ejecución en Docker sin red, veredicto por código de salida (no por modelo), detección de "éxito sospechoso", tope de gasto (2 USD), pausa para decisión humana.
- Hooks (pre-tool guard JS y Bash), registros JSONL de solo adición (consumo, mutaciones, eventos, auditoría de herramientas), ADR con búsqueda TF-IDF, motor LLM agnóstico (Anthropic, OpenAI, Ollama, Stub), instalación para otras herramientas (`--integracion`: copilot, cursor, gemini, windsurf, opencode, kiro...).
- Madurez declarada por el propio proyecto: 5.0.0 NO publicada en npm; CI de Linux nunca ejecutado; sin Docker real en Linux/macOS; OpenAI/Ollama e integraciones GitHub/GitLab/Jira sin prueba real; suite con 1 fallo; solo proyectos pequeños; Windows 11 como único entorno validado. Esta franqueza es un activo, pero define su madurez: pre-beta.

## 2. Tabla comparativa

| Solución | Flujo spec-first | Verificación determinista | Gobernanza / aprobaciones | Agnosticismo de agente | Idioma | Instalación | Evidencia / auditoría | Madurez y comunidad | Fuente |
|---|---|---|---|---|---|---|---|---|---|
| **Fragua/FORGE** | Sí, 9 etapas, spec aprobada | Sí: pruebas en Docker, código de salida, éxito sospechoso, mutación opcional | Guard de aprobación no configurable, pausas, aprobación con huella en integraciones | Parcial: nativo en Claude Code; otras 8 herramientas reciben solo skills; LLM agnóstico | Español nativo | npm (5.0 no publicada); Node>=20 + Docker | JSONL de solo adición, `verificacion.md` por criterio, ADR | Pre-beta; comunidad no medida **[no verificado]** | README/AGENTS/GUIA locales |
| **GitHub Spec Kit** | Sí: constitution, specify, plan, tasks, implement, converge | Parcial: bucle implement/converge hasta "Converged"; bugs con veredicto verified/partial/failed. Ejecución aislada **[no verificado]** | Constitución del proyecto; aprobaciones **[no verificado]** | Alto: `specify init --integration <agente>`; lista no mostrada | Inglés en la página; plantillas **[no verificado]** | `uv tool install specify-cli` (Python 3.11+) | Artefactos en repo; auditoría formal **[no verificado]** | 148,1k estrellas, 13,3k forks, MIT | https://github.com/github/spec-kit |
| **OpenSpec** | Sí, por cambio: propose (proposal/specs/design/tasks), apply, archive; deltas | Perfil ampliado añade `/opsx:verify` (naturaleza **[no verificado]**) | Acuerdo humano-IA antes de codificar; guards técnicos **[no verificado]** | Alto: 30+ asistentes por slash commands | Inglés; otros **[no verificado]** | curl/PowerShell, npm (Node>=22.12) o brew | Carpeta por cambio + archivo; auditoría **[no verificado]** | 74,2k estrellas, 5,1k forks, MIT | https://github.com/Fission-AI/OpenSpec |
| **BMAD-METHOD** | Sí, ágil, de idea a software, escala según tamaño | No indicado **[no verificado]** | Multi-agente con roles (producto, arquitectura, UX, dev, testing); gobernanza formal **[no verificado]** | Claude Code y Codex; V7 (alpha) cualquier herramienta con skills | Sección de idiomas vacía **[no verificado]** | `npx bmad-method install` (v6.12); V7 alpha | **[no verificado]** | 55,1k estrellas, 6,1k forks, MIT; V7 alpha con cambios incompatibles | https://github.com/bmad-code-org/BMAD-METHOD |
| **Kiro (AWS)** | Sí: requirements.md, design.md, tasks.md; bugfix specs; Quick Spec sin aprobaciones; ejecución en "waves" | Pruebas basadas en propiedades ("Correctness") solo en IDE; resto **[no verificado]** | Puntos de aprobación por fase (salvo Quick Spec); hooks y steering existen pero la página no los describe | Bajo: IDE propio (también CLI y Web); modelos **[no verificado]** | **[no verificado]** | IDE/CLI/Web | **[no verificado]** | Comercial; fuente secundaria cita 50 créditos gratis y Pro 20 USD a Power 200 USD/mes | https://kiro.dev/docs/specs/ ; https://ssojet.com/blog/best-spec-driven-development-tools |
| **Tessl** | La página actual no menciona spec-driven; se presenta como registro de skills y plataforma | Evals: ejecuta el agente con y sin skill y mide impacto | RBAC, políticas de instalación/publicación, puntuación de seguridad Snyk, registro de auditoría | "Funciona con todos los agentes populares" (sin lista) | **[no verificado]** | Plataforma/CLI; precios **[no verificado]**; Tessl Agent en open beta | Registro de auditoría y observabilidad (según su página) | Fuentes discrepan sobre su foco (spec-as-source vs registro de skills) | https://docs.tessl.io |
| **Cline Memory Bank** | No es SDD: memoria de contexto (projectbrief, activeContext, progress...) | No | No | Según la doc, sirve con cualquier IA que lea documentos | **[no verificado]** | Copiar instrucciones a `.clinerules/` | Archivos Markdown editables | Método documentado, no función automática | https://docs.cline.bot/features/memory-bank |
| **Claude Code plugins/Skills/hooks** | Base, sin flujo SDD propio | Los hooks permiten comprobaciones que define el autor | Configuración gestionada por organización (allowlist de marketplaces, instalación forzada) | Específico de Claude Code (formato también en claude.ai/Cowork) | Neutral | `/plugin`, marketplaces | Medición de coste y evals de plugins | Plataforma oficial de Anthropic | https://code.claude.com/docs/en/plugins |
| **Cursor rules** | No (reglas de contexto) | **[no verificado]** | **[no verificado]** | Propio de Cursor | **[no verificado]** | **[no verificado]** | **[no verificado]** | La página redirigió; contenido no leído | https://cursor.com/docs |
| **Aider** | No (programación en pareja en terminal) | Corrige automáticamente errores de lint y tests | No | Muy alto en modelos (OpenAI, Anthropic, Gemini, Ollama, etc.) | **[no verificado]** | CLI | Integración con git; commits automáticos **[no verificado]** | **[no verificado]** | https://aider.chat/docs/ |
| Otros citados en comparativas (no investigados): Task Master AI, SpecStory, cc-sdd | - | - | - | - | - | - | - | **[no verificado]** | https://ssojet.com/blog/best-spec-driven-development-tools |

Limitaciones: WebFetch resume las páginas con un modelo pequeño; se leyeron páginas principales, no el código de cada proyecto. Que una página no mencione algo no prueba que la función no exista. Cursor, Aider y los detalles de gobernanza de Spec Kit/OpenSpec/BMAD quedaron sin profundizar.

## 3. Qué debería mejorar o copiar FORGE
1. **Publicar y simplificar la instalación.** OpenSpec ofrece curl/PowerShell/npm/brew; Spec Kit, una línea con `uv`. FORGE 5.0 no está en npm y exige Docker, lo que frena la adopción.
2. **Agnosticismo real de agente.** Spec Kit (`--integration`) y OpenSpec (30+ asistentes) cubren muchas herramientas con el flujo completo; FORGE da comandos/agentes/hooks nativos solo en Claude Code. Valorar exponer el ciclo verificado vía `forge mcp` como vía común.
3. **Cambios por delta con archivo** (OpenSpec: ADDED/MODIFIED/REMOVED y archive) para proyectos existentes; FORGE declara no estar listo para bases grandes.
4. **Bucle "converge" y extensiones** (Spec Kit: bug-fix, evaluación de ideas). FORGE ya tiene constitución en `.sdd/`.
5. **Specs de bugs y ejecución paralela por "waves"** según grafo de dependencias (Kiro).
6. **Gobernanza organizacional** (Tessl: RBAC, políticas; Claude Code: configuración gestionada). FORGE audita bien pero no tiene RBAC ni políticas de organización.
7. **Evals de impacto de skills/plugins** (Tessl, evals de plugins de Claude Code) para medir si cada comando aporta.
8. **Cerrar deudas propias:** CI en Linux, Docker real en Linux/macOS, pruebas con OpenAI/Ollama y con GitHub/GitLab/Jira reales. La credibilidad de la verificación determinista depende de ello.
9. **Ampliar lenguajes del ciclo** (hoy JS/TS, Python y Go).

## 4. Qué parece único en FORGE
En las fuentes consultadas **no encontré** estas combinaciones en otra herramienta, pero **no puedo confirmar que ninguna lo haga** (solo revisé páginas principales y resúmenes).

| Rasgo | Evidencia en FORGE | Frente al mercado |
|---|---|---|
| Veredicto por código de salida de pruebas en contenedor Docker sin red, con separación de roles (quien escribe pruebas no implementa ni las toca) | AGENTS.md; GUIA sección 2 | Spec Kit tiene bucle converge y Aider corrige tests, pero en lo leído no aparece aislamiento sin red ni separación de roles. No confirmado. |
| Detección de "éxito sospechoso" y medición por mutación opcional | GUIA secciones 2 y 3 | No encontré equivalente. No confirmado. |
| Tope de gasto por sesión con degradación automática de modelo | GUIA secciones 2 y 6 | No encontré equivalente (Kiro usa créditos como modelo de precio, no como control). No confirmado. |
| Aprobación con huella (vista previa y hash) y kill-switch en integraciones | GUIA sección 8 | No encontrado en otras; en FORGE nunca probado contra plataformas reales. |
| Principio "ningún documento afirma una capacidad que el código no tiene" y registros de solo adición | AGENTS.md | Cultura documental, no comparable con datos. |
| SDD con comandos y docs nativos en español | README | Las demás páginas consultadas están en inglés; su soporte multilingüe es **[no verificado]**. |

Importante: lo "único" aún no está probado en producción (ver sección 1). Una función que existe en el código pero no se ha ejecutado en Linux o con proveedores reales no es una ventaja demostrada.

## 5. Fuentes
- https://github.com/github/spec-kit
- https://github.com/Fission-AI/OpenSpec
- https://github.com/bmad-code-org/BMAD-METHOD
- https://kiro.dev/docs/specs/
- https://docs.tessl.io
- https://docs.cline.bot/features/memory-bank
- https://code.claude.com/docs/en/plugins
- https://aider.chat/docs/
- https://docs.cursor.com/context/rules (redirige a https://cursor.com/docs; contenido no leído)
- https://ssojet.com/blog/best-spec-driven-development-tools (terceros, fuente secundaria)
