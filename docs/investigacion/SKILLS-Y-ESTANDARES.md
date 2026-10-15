# Skills, agentes y comandos: estándares y auditoría del catálogo Fragua

Fecha: 2026-10-14. Fuentes primarias consultadas hoy (WebFetch). Lo no confirmado se marca «no verificado».

## 1. Reglas verificables de calidad

| # | Regla | Aplica a | Fuente |
|---|---|---|---|
| R1 | `name` obligatorio, 1-64 caracteres, solo `a-z0-9-`, sin guion inicial/final ni `--`, igual al nombre de carpeta | Skill (spec abierta) | https://agentskills.io/specification (2026-10-14) |
| R2 | `description` obligatoria, 1-1024 caracteres, dice qué hace y cuándo usarla, con palabras clave | Skill (spec) | idem |
| R3 | Opcionales de la spec: `license`, `compatibility` (≤500), `metadata` (mapa string-string), `allowed-tools` (separado por espacios, experimental) | Skill | idem |
| R4 | SKILL.md < 500 líneas y < 5000 tokens; material extra en `references/`, `scripts/`, `assets/`, un nivel de profundidad, indicando cuándo cargar cada archivo | Skill | idem + https://agentskills.io/skill-creation/best-practices |
| R5 | Metadatos (~100 tokens) se cargan siempre; el cuerpo solo al activar: la descripción es el único disparador | Skill | spec, «Progressive disclosure» |
| R6 | En Claude Code `name` por defecto es el directorio; `description` es «recomendada»; `description`+`when_to_use` se truncan a 1.536 caracteres: lo clave primero | Skill CC | https://code.claude.com/docs/en/skills |
| R7 | Claude Code ignora en silencio claves desconocidas: validar nombres exactos (`allowed-tools`, `disable-model-invocation`, `user-invocable`, `context`, `model`, `effort`, `paths`) | Skill/comando | idem |
| R8 | `allowed-tools` en Claude Code acepta cadena separada por espacios o comas, o lista YAML; solo preaprueba, no restringe | Skill/comando | idem |
| R9 | Comandos y skills están fusionados: `.claude/commands/x.md` equivale a `skills/x/SKILL.md`; mismo frontmatter salvo `name` y `paths`; ante choque de nombre gana la skill; skills recomendadas para trabajo nuevo | Comando | idem |
| R10 | Subagente: obligatorios `name` (≤256, sin `:`) y `description` (cuándo delegar); opcionales `tools`, `disallowedTools`, `model`, `permissionMode`, `maxTurns`, `skills`, `mcpServers`, `hooks`, `memory`, `effort`, `isolation`, `color`... | Agente | https://code.claude.com/docs/en/sub-agents |
| R11 | `model`: alias `sonnet/opus/haiku/fable`, ID completo o `inherit`; `tools` acepta cadena con comas o lista YAML | Agente | idem |
| R12 | Descripción de agente: cuándo delegar, «use proactively» si debe ser automático, breve; instrucciones largas al cuerpo | Agente | idem |
| R13 | Contenido: solo lo que el agente no sabe; un valor por defecto en vez de menús; procedimientos, no respuestas; sección «Gotchas»; plantillas de salida; bucles de validación; unidades cohesivas | Skill | best-practices (URL arriba) |
| R14 | Evaluar: ejecutar casos reales, leer trazas, iterar; validar con `skills-ref validate` | Skill | spec + best-practices |
| R15 | AGENTS.md: Markdown libre, sin campos obligatorios, manda el archivo más cercano, el prompt del usuario anula; lo gobierna la Agentic AI Foundation (Linux Foundation) | Contexto de proyecto | https://agents.md |

Nota: la spec abierta y Claude Code divergen en `allowed-tools` (espacios vs espacios o comas). Para portabilidad, usar espacios.

## 2. Auditoría de Fragua (`node scripts/inventario-agentes.mjs --json`)

Totales: 14 agentes, 31 skills, 39 comandos.

| Regla | Hallazgo | Elementos |
|---|---|---|
| R1/R6 `name` ausente | 22 de 31 skills sin `name` (válido en Claude Code por defecto al directorio; incumple la spec abierta) | cache-audit, compresion-tokens, constitucion-constraint, critica-diseno, deploy-vercel, descubrir-idea, deteccion-stack, effort-router, elegir-direccion, enrutador-agentes, explicame, gestion-estado, indexador, interpretar-idea, mejorar-prompt, observabilidad-consumo, resource-selector, share-progress, token-budget, validacion-spec, verificador-implementacion, wireframe-mvp |
| R2 `description` vacía | 3 skills: no pueden activarse por descripción | deploy-vercel, explicame, share-progress |
| R2 descripción muy corta (<80 car.; probable falta del «cuándo usar», texto no leído) | 4 skills | mutation-detector (65), adr-indexer (67), memory-compactor (69), mejorar-prompt (73) |
| R11 `model` en tres formas | alias (`haiku`, `sonnet`, `opus`) en 10 skills; ID completo `claude-haiku-4-5` en 4 (adr-indexer, indexar-proyecto, memory-compactor, mutation-detector); 17 sin modelo. Las tres son válidas, pero el ID fijo envejece | skills |
| R4 > 500 líneas | Ninguna skill (máx. vercel-deploy 352, github-connect 337). Sí 4 comandos: sdd.implementar 679, sdd.planificar 548, sdd.compliance 518, sdd.constitucion 508 | comandos |
| R8 `allowed-tools` con comas | 39 comandos (válido en Claude Code; no portable a la spec abierta) | todos |
| R9 formato heredado | 39 comandos en `commands/`, sin recursos de apoyo | todos |
| R10 agentes | 14/14 con nombre, descripción, modelo y herramientas: cumplen | -- |
| R12 | Ninguna descripción de agente usa «use proactively» (verificado por el campo `descripcion` del script en los 14 listados); varias dependen de un comando concreto (`/sdd.planificar`) | arquitecto, investigador, desarrollador-backend, disenador-api |
| Modelo en prosa | «Modelo opus recomendado» dentro de la descripción en lugar de solo en `model` | revisor, critico, asesor-datos |
| R4/R13 recursos | 29 de 31 skills sin `references/` ni `scripts/`; solo github-connect (9) y vercel-deploy (12) los tienen | 29 skills |
| R13 solapamientos (contenido no leído: no verificado) | deploy-vercel vs vercel-deploy; indexador vs indexar-proyecto; token-budget vs compresion-tokens vs observabilidad-consumo | -- |
| Agentes largos | tester 282, product-designer 270, desarrollador-backend 244 líneas (ninguno >500) | -- |

No medido por el script: uso de `maxTurns`, `memory`, `isolation` en agentes (no verificado).

## 3. Catálogos comunitarios y lo que Fragua no tiene

| Fuente | Tamaño | Roles/skills relevantes | Hueco en Fragua |
|---|---|---|---|
| anthropics/skills (https://github.com/anthropics/skills) | docx, pdf, pptx, xlsx, web-app testing, MCP builder; `template/` y `spec/` | convención SKILL.md con name+description; Apache 2.0 salvo los 4 de documentos | plantilla propia de skill |
| wshobson/agents (https://github.com/wshobson/agents) | 40,8k estrellas; 202 agentes, 184 skills, 105 comandos, 94 plugins | `plugin-eval` (chequeos estáticos de skills sin modelo, `make validate STRICT=1`), security-scanning, developer-essentials | validador estático del catálogo |
| VoltAgent/awesome-claude-code-subagents (https://github.com/VoltAgent/awesome-claude-code-subagents) | 25,7k estrellas; 161+ agentes | code-reviewer, architect-reviewer, surgeon-reviewer (veredicto ship/no-ship con severidad), debugger, error-detective, performance-engineer, security-auditor, penetration-tester, test-automator, qa-expert, accessibility-tester, chaos-engineer, compliance-auditor, gdpr-ccpa-compliance | debugger, rendimiento, accesibilidad, cumplimiento |

Candidatos de verificación, gobierno y calidad que Fragua no tiene:

| Candidato | Finalidad | Fuente |
|---|---|---|
| debugger / error-detective | causa raíz de fallos | VoltAgent |
| performance-engineer | calidad no funcional | VoltAgent |
| accessibility-tester | verificación de UI | VoltAgent |
| compliance-auditor (+ privacidad) | gobierno; hoy solo existe el comando sdd.compliance | VoltAgent |
| veredicto ship/no-ship por severidad | cierre de verificación | VoltAgent (surgeon-reviewer) |
| validador estático de skills | calidad del propio catálogo | wshobson plugin-eval; skills-ref (agentskills.io) |
| evaluación de descripciones con casos de activación | activación fiable | https://agentskills.io/skill-creation/optimizing-descriptions (no leída: no verificado) |

Advertencia de la fuente: VoltAgent no audita la seguridad de sus agentes; revisar antes de importar.

## 4. Recomendaciones ordenadas

| Prioridad | Cambio | Regla |
|---|---|---|
| 1 | Rellenar `description` en deploy-vercel, explicame, share-progress (o eliminarlas si duplican) | R2 |
| 2 | Añadir `name` (= carpeta) a las 22 skills sin él | R1 |
| 3 | Reescribir las 4 descripciones cortas con «qué hace + cuándo usarla», lo clave primero | R2, R6 |
| 4 | Fusionar duplicados (vercel-deploy/deploy-vercel, indexador/indexar-proyecto) tras leerlos | R13 |
| 5 | Unificar `model`: alias o `inherit`; quitar IDs fijos y la prosa «modelo recomendado» | R11 |
| 6 | `allowed-tools` con espacios o lista YAML en los 39 comandos | R3, R8 |
| 7 | Partir los 4 comandos >500 líneas, enviando detalle a `references/` | R4 |
| 8 | Migrar comandos a `skills/<nombre>/SKILL.md` gradualmente; `disable-model-invocation: true` en los de efecto lateral | R9 |
| 9 | Añadir al script de inventario un validador R1-R4 y R10 que falle en CI | R14 |
| 10 | Incorporar debugger, rendimiento, accesibilidad, cumplimiento; veredicto con severidad en revisor | sección 3 |
| 11 | «Use proactively» y `maxTurns` en revisor/seguridad/tester si se quiere delegación automática | R10, R12 |
