# FORGE / SDD-ES — Relación con las primitivas oficiales de Claude Code

FORGE no es un reemplazo de Claude Code. Es una **capa de opinión en español** que organiza y conecta las primitivas nativas de Claude Code en un flujo de trabajo estructurado (idea → deploy).

Toda la funcionalidad de FORGE descansa sobre primitivas que Claude Code ya provee.

---

## Tabla de correspondencias

| Pieza de FORGE | Primitiva oficial de Claude Code | Notas |
|----------------|----------------------------------|-------|
| `commands/*.md` (ej. `/sdd.especificar`) | **Slash commands** (`.claude/commands/*.md`) | FORGE instala sus comandos en `.claude/commands/`. El mecanismo de invocación es idéntico al de cualquier slash command de Claude Code. |
| `agents/*.md` (ej. `arquitecto`, `tester`) | **Subagents** (`model: …`, `tools: […]`) | Cada archivo `agents/X.md` es un subagente que Claude Code puede instanciar con su propio contexto, modelo y herramientas. |
| `skills/*.md` (ej. `modo-guiado`, `constitucion-constraint`) | **Skills** (`.claude/skills/*.md`) | Las skills de FORGE son skills de Claude Code: fragmentos de instrucción reutilizables que los agentes y comandos incluyen cuando los necesitan. |
| `claude-hooks/` | **Hooks** (`.claude/settings.json → hooks`) | Los hooks de FORGE se registran en `settings.json` y se ejecutan en los puntos de ciclo de vida que Claude Code expone (`PreToolUse`, `PostToolUse`, `Stop`, etc.). |
| Presets (`presets/lean.yaml`, etc.) | Configuración de usuario / proyecto | Los presets son archivos YAML que `/sdd.configurar` copia a `.sdd/sdd.config.yaml`. No son una primitiva de Claude Code; son configuración propia de FORGE. |
| `plantillas/*.md` | Sin equivalente directo | Plantillas Markdown que los comandos llenan al generar artefactos (specs, planes, ADRs). Claude Code no tiene un sistema de plantillas nativo. |
| `.sdd/estado.json` | Sin equivalente directo | Estado persistente del proyecto (spec activa, fase, ID de sesión). Claude Code no tiene estado global nativo; FORGE lo gestiona en disco. |
| Modo guiado (`perfil: guiado`) | Sin equivalente directo | Comportamiento de conducción paso a paso implementado dentro del slash command `/sdd`, no una primitiva de Claude Code. |

---

## Lo que FORGE añade sobre Claude Code

1. **Flujo ordenado**: encadena los slash commands en fases (descubrir → especificar → planificar → implementar → verificar → desplegar) con transiciones explícitas.
2. **Lenguaje español**: todos los artefactos, comandos y mensajes están en español.
3. **Memoria entre sesiones**: `estado.json` y los artefactos en `.sdd/` persisten el contexto del proyecto entre conversaciones.
4. **Presets de calidad**: configuraciones probadas (lean / startup / enterprise) que ajustan qué agentes están activos y con qué modelo.
5. **Modo guiado**: conduce a usuarios no-técnicos sin exponer la nomenclatura de comandos.

---

## Lo que FORGE NO hace

- No modifica el binario de Claude Code ni su comportamiento base.
- No reemplaza las primitivas: si Claude Code actualiza Skills, Subagents o Hooks, FORGE se beneficia automáticamente.
- No requiere acceso a la API de Anthropic directamente — todo pasa por Claude Code como intermediario.
