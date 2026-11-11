---
name: deploy-vercel
description: Alias de vercel-deploy. Úsala igual que esa skill cuando el usuario pida /forge.deploy o desplegar en Vercel; el procedimiento completo vive en skills/vercel-deploy/SKILL.md.
allowed-tools: Read, Bash
metadata:
  forge-id: "deploy-vercel"
  forge-nombre: "Deploy a Vercel (alias)"
  forge-descripcion: "Alias de la skill vercel-deploy. Despliega en Vercel con pre-checks, build, health checks y rollback. Requiere el MCP de Vercel autenticado."
  forge-aliases: "[\"/forge.deploy\", \"/sdd.desplegar vercel\"]"
  forge-version: "1.1.0"
  forge-requisitos: "mcp: vercel; descripcion: MCP de Vercel instalado y autenticado en tu herramienta"
---

# deploy-vercel — alias de `vercel-deploy`

Esta skill **no tiene procedimiento propio**: es un alias que se conserva porque la citan `plugin.json`, `/forge`, `agent-manifest.yaml` y `resource-selector` (spec `2026-11-09-puerta-de-entrada-solo-dev`, CA-003-01).

Lee y sigue `skills/vercel-deploy/SKILL.md`:

```bash
cat .claude/skills/vercel-deploy/SKILL.md 2>/dev/null || cat skills/vercel-deploy/SKILL.md
```

Antes de desplegar se mantiene la regla de siempre: el pipeline debe estar en `done` y el ciclo verificado en verde (`fragua status`). Si no, no se despliega.
