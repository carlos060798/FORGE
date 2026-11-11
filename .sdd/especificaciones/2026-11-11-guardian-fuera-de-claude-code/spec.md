---
id: 2026-11-11-guardian-fuera-de-claude-code
titulo: "Guardián y memoria fuera de Claude Code: orden `fragua guardian`, traducción del evento por anfitrión y plantillas de hook"
tamano: mediano  # micro | pequeño | mediano | grande
estado: borrador  # borrador | en_revision | aprobada | en_implementacion | completada
creada: 2026-11-11
actualizada: 2026-11-11
autor: humano  # humano | importado
constitucion_version: 1.1.0
etiquetas: [agnostico, anfitrion, guardian, hooks, seguridad, fase-3]
---

# Especificación: Guardián y memoria fuera de Claude Code

> **Estado: borrador, sin aprobar.** El código correspondiente (F3 de `docs/PLAN-AGNOSTICO.md`) se implementó por instrucción del dueño antes de que existiera esta especificación; la spec `2026-11-10-metodologia-agnostica` (§5) exigía una propia por tocar seguridad. Esta la redacta un agente a posteriori para dejar el alcance, los criterios y los límites por escrito. **El dueño decide si la aprueba, la recorta o la rechaza**; hasta entonces el guardián fuera de Claude Code se documenta como «consultivo, sin probar en una herramienta real».

## 1. Contexto y Motivación

El guardián de Fragua (`claude-hooks/pre-tool-guard.js`) solo corría como hook `PreToolUse` de Claude Code. En Cursor, Copilot, Gemini CLI y Codex el usuario recibía la metodología (spec `2026-11-10-metodologia-agnostica`) sin ninguna barrera: un comando o un rol podían escribir en `.git/`, `.env*` o fuera del proyecto sin que nada lo frenara. Cada herramienta tiene su propio formato de evento de hook y su propia política ante un error del hook (algunas fallan cerrado, otras abierto).

## 2. Objetivo

Que las mismas reglas del guardián (`core/evidencia/guardian-reglas.js`, fuente única) se puedan evaluar desde cualquier herramienta mediante una orden de la CLI, con el evento traducido al contrato común de Fragua, y que la instalación pueda registrar esa orden como hook en las herramientas que lo permiten, **diciendo con claridad en cuáles la protección es consultiva porque la herramienta falla abierto**.

## 3. Usuarios y Actores

| Actor | Rol | Necesidad principal |
|---|---|---|
| Usuario de otra herramienta | Usa Cursor, Copilot, Gemini CLI o Codex | Que las reglas del guardián se apliquen o, si no pueden, saberlo |
| Usuario de Claude Code | Instala como hoy | Que nada cambie |
| Mantenedor | Mantiene las reglas | Una sola fuente de reglas y un solo contrato de evento |

## 4. Historias de Usuario

### HU-001: Evaluar el guardián desde la CLI
**Como** herramienta de código
**Quiero** pasarle a Fragua el evento de una herramienta a punto de ejecutarse
**Para** recibir un veredicto permitir/bloquear por código de salida

**Criterios de aceptación:**
- [ ] **CA-001-01**: `fragua guardian evaluar` lee un evento JSON por la entrada estándar y termina con 0 (permitir) o 2 (bloquear); cualquier otro fallo del propio guardián termina con 2 (falla cerrado). (P1)
- [ ] **CA-001-02**: Las reglas evaluadas son exactamente las de `core/evidencia/guardian-reglas.js`; no existe una segunda copia. (P1)
- [ ] **CA-001-03**: Un evento JSON inválido o vacío termina con 2, con y sin `--anfitrion`. (P1) — **Hoy incumplido**: sin `--anfitrion` devuelve 1 (`cli/comandos/guardian.js`), que la mayoría de herramientas interpreta como «dejar pasar».
- [ ] **CA-001-04**: La identidad del agente llega por `FRAGUA_AGENTE` (o `FORGE_AGENTE`) y se traslada al guardián con el mismo significado que `CLAUDE_AGENT_NAME`. (P2)

### HU-002: Traducir el evento de cada anfitrión
**Como** usuario de Cursor, Copilot, Gemini CLI o Codex
**Quiero** que `--anfitrion <clave>` traduzca el evento nativo al contrato de Fragua
**Para** no escribir yo el adaptador

**Criterios de aceptación:**
- [ ] **CA-002-01**: Existe un contrato de evento versionado en `docs/contrato/evento-herramienta.md` y una prueba que falla si el traductor produce algo fuera de él. (P1)
- [ ] **CA-002-02**: Un `apply_patch` de Codex que toca N archivos produce N evaluaciones de escritura, y basta una bloqueada para bloquear. (P1)
- [ ] **CA-002-03**: Un anfitrión desconocido en `--anfitrion` termina con 2, no pasa sin reglas. (P1) — **Hoy incumplido**: `core/instalacion/hooks-anfitrion.js` deja pasar un anfitrión no reconocido.
- [ ] **CA-002-04**: Los traductores se prueban con al menos una captura real del evento de cada herramienta (no solo eventos sintéticos sacados de la documentación), con versión y fecha de la herramienta. (P1) — **Pendiente** (F5).

### HU-003: Registrar el hook al instalar, con honestidad sobre el modo de fallo
**Como** usuario de otra herramienta
**Quiero** que `fragua init --integracion <x> --con-hooks` registre el guardián
**Para** no configurarlo a mano

**Criterios de aceptación:**
- [ ] **CA-003-01**: `--con-hooks` escribe la plantilla de hook de la herramienta y nunca pisa un archivo de hooks existente sin avisar. (P1)
- [ ] **CA-003-02**: Cada plantilla declara si la herramienta falla cerrado o abierto ante un error o un tiempo agotado del hook; `init` y `doctor` lo dicen al usuario y `docs/ANFITRIONES.md`, `docs/GARANTIAS-Y-LIMITES.md` y `SECURITY.md` lo recogen en la misma matriz. (P1) — **Parcial**: las plantillas lo declaran; `doctor`, GARANTIAS y SECURITY no lo dicen.
- [ ] **CA-003-03**: En una herramienta que falla abierto, ningún documento usa la palabra «protegido»; se usa «consultivo». (P1)
- [ ] **CA-003-04**: Sin `--con-hooks`, `init` no toca ningún archivo de hooks (comportamiento de hoy). (P1)

### HU-004: Memoria por hook fuera de Claude Code
**Como** usuario de otra herramienta
**Quiero** que la memoria de agentes se registre tras cada herramienta
**Para** que los roles no pierdan contexto entre sesiones

**Criterios de aceptación:**
- [ ] **CA-004-01**: `fragua memoria registrar` acepta `--anfitrion` y las plantillas registran un hook posterior a la herramienta donde la herramienta lo soporte. (P2) — **No implementado**: hoy solo existe como orden manual sin traducción.

## 5. Fuera de Alcance

- Guardián como herramienta MCP (`guardian_evaluar`): se menciona en el contrato pero no se implementa aquí; requiere su propia decisión porque el MCP de Fragua hoy expone solo `verificar` en el perfil seguro.
- Kiro, opencode y Windsurf: sin adaptador hasta tener documentación oficial de su formato de hook.
- Validación de convenciones (`post-write-conventions`), `context-manager` y `settings.json` fuera de Claude Code.

## 6. Dependencias y Asunciones

- `core/evidencia/guardian-reglas.js`, `claude-hooks/pre-tool-guard.js`, `claude-hooks/agent-memory.js`, `core/instalacion/hooks-anfitrion.js`, `cli/comandos/guardian.js`.
- Asunción: `fragua` está en el `PATH` cuando la herramienta ejecuta el hook; hoy solo se garantiza con `npm install -g .`.
- Asunción no verificada: que Cursor respete la clave `failClosed` y bloquee con código 2 sale de un spike leído por web, no de una prueba real.

## 7. Riesgos

| Riesgo | Mitigación |
|---|---|
| El usuario cree estar protegido en Gemini o Codex, que fallan abierto | CA-003-02 y CA-003-03; `doctor` avisa |
| El formato de evento de una herramienta cambia y el traductor deja pasar todo | CA-002-03 (falla cerrado) y CA-002-04 (capturas reales con versión) |
| El hook tarda y la herramienta lo descarta por tiempo | Medir el tiempo de `guardian evaluar` en frío; documentar el límite de cada herramienta |
| Dos códigos de salida distintos para el mismo caso (1 y 2) | CA-001-03 |

## 8. Preguntas Abiertas

| # | Pregunta | Recomendación |
|---|---|---|
| 1 | ¿Se acepta ofrecer el guardián en herramientas que fallan abierto, aunque sea consultivo? | Sí, con la palabra «consultivo» en todo documento y en `doctor` |
| 2 | ¿Primera herramienta a probar en real? | Codex (formato documentado, `apply_patch` es el caso más distinto) |

## 9. Criterios de Éxito Medibles

- Todos los CA P1 con prueba automática, salvo CA-002-04 que exige registro manual con versión y fecha.
- Al menos una herramienta con captura real en `verificacion.md`.
- `npm test` en verde con las pruebas nuevas; `init` sin `--con-hooks` produce el mismo árbol que antes.

## 10. Referencias

- `docs/PLAN-AGNOSTICO.md` (F3), `docs/ANFITRIONES.md`, `docs/contrato/evento-herramienta.md`.
- `.sdd/especificaciones/2026-11-10-metodologia-agnostica/` (§5: F3 merece spec propia) y su spike `spikes/agentes-hooks-argumentos.md`.
- `.sdd/especificaciones/2026-11-06-guardian-endurecido/` (falla cerrado, análisis por argv).
