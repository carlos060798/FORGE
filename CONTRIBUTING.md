# Contribuir a SDD-ES / FORGE

Gracias por tu interés en mejorar FORGE. Esta guía explica cómo añadir un agente, un comando, reportar un bug o proponer una mejora.

---

## Requisitos previos

- Node.js >= 18
- Claude Code CLI instalado (`npm install -g @anthropic-ai/claude-code`)
- Fork del repositorio en GitHub

```bash
git clone https://github.com/carlos060798/FORGE.git
cd FORGE
npm install
npm test   # debe pasar todos los tests
```

---

## Cómo añadir un agente

1. Crea `agents/{nombre}.md` siguiendo la plantilla en `plantillas/agente.md`.
2. Añade `"{nombre}"` al array `agents` en `.claude-plugin/plugin.json`.
3. Si el agente necesita memoria, añade su nombre al array `AGENTES_CON_MEMORIA` en `claude-hooks/agent-memory.js`.
4. Si es de solo lectura (no modifica archivos), añádelo a `READ_ONLY_AGENTS` en `claude-hooks/pre-tool-guard.js`.
5. Añade al menos 2 tests en `tests/agent-memory.test.js` verificando su comportamiento.
6. Documenta el agente en `docs/agentes/README.md`.

**Criterios de aceptación para un agente:**
- Tiene un rol claro, no solapado con agentes existentes.
- Los prompts del sistema tienen máx. 2,000 tokens.
- Pasa `npm test` sin nuevos fallos.

---

## Cómo añadir un comando

1. Crea `commands/sdd.{nombre}.md` con frontmatter válido:

```markdown
---
description: Una línea concisa describiendo qué hace el comando.
allowed-tools: Read, Write, Edit, Bash  # solo los que necesita
---
```

2. Añade `"sdd.{nombre}"` al array `commands` en `.claude-plugin/plugin.json`.
3. Referencia el comando en `commands/sdd.ayuda.md` bajo la sección apropiada.
4. Añade un caso de enrutamiento en `commands/sdd.md` (tabla de intenciones → comandos).
5. Los tests de consistencia en `tests/` verificarán automáticamente que el comando está registrado.

**Criterios de aceptación para un comando:**
- El frontmatter `description` tiene < 120 caracteres.
- El comando tiene handoffs definidos cuando aplique.
- Está documentado en `sdd.ayuda.md`.

---

## Cómo reportar un bug

Usa la plantilla de issue en GitHub: [Bug Report](.github/ISSUE_TEMPLATE/bug_report.md)

Incluye siempre:
- Versión de FORGE (`node cli/index.js --version`)
- Versión de Node.js y OS
- El comando o flujo que falló
- El output de `node cli/index.js doctor`

---

## Cómo proponer un agente nuevo

Usa la plantilla: [Propuesta de Agente](.github/ISSUE_TEMPLATE/agent_proposal.md)

---

## Proceso de revisión

1. Abre un PR contra `main`.
2. Asegúrate de que `npm test` pasa (CI automático).
3. Un maintainer revisará en 48-72h.
4. Los PRs que añaden agentes/comandos deben incluir tests.

---

## Estilo de código

- ESM puro (`import`/`export`), sin CommonJS.
- Node >= 18, sin dependencias externas en hooks (solo `node:fs`, `node:path`, `node:os`, `node:child_process`).
- Las dependencias npm permitidas actualmente: `acorn` (AST), `js-yaml` (config).
- Tests con `node:test` nativo, sin Jest ni Mocha.
- Sin comentarios que expliquen QUÉ hace el código — solo los WHY no obvios.

---

## Licencia

Al contribuir aceptas que tu código se distribuirá bajo la [licencia MIT](LICENSE).
