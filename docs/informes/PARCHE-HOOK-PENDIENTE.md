# Parche pendiente del guardián (lo aplica el dueño)

El guardián se protege a sí mismo: un agente no puede editar `claude-hooks/`, y por eso estas correcciones, que salen de [REVERIFICACION-SEGURIDAD.md](REVERIFICACION-SEGURIDAD.md), no se aplicaron. Para aplicarlas, lanza Claude Code con `FORGE_EDITAR_GUARDIAN=1` en el entorno (o edita los archivos a mano) y luego `npm test`.

## 1. `Grep` y `Glob` sobre `.env` (C-04)

En `claude-hooks/pre-tool-guard.js`, junto al bloque de `Read`/`NotebookRead`, amplía la condición a `Grep` y `Glob`:

```js
if (toolName === "Read" || toolName === "NotebookRead" || toolName === "Grep" || toolName === "Glob") {
  const objetivos = [toolInput?.file_path, toolInput?.path, toolInput?.notebook_path, toolInput?.glob, toolInput?.pattern]
    .filter((x) => typeof x === "string" && x !== "");
  const secreto = objetivos.find((o) => esSecreto(o) || esSecreto(relativoAlProyecto(o)));
  if (secreto) {
    bloquear(`FORGE detuvo esta acción: "${secreto}" contiene secretos y un agente no lo lee. Usa ".env.example".`,
      { tool: toolName, input: { path: secreto } });
  }
  process.exit(0);
}
```

Añade casos a `tests/evals/casos-guardian.json` (`Grep` con `path: ".env"`, `Glob` con `pattern: "**/.env*"`) y comprueba que `Grep` con `.env.example` sigue permitido.

## 2. Más formatos de claves (C-11, C-09)

En `SECRET_PATTERNS` del hook añade:

```js
/github_pat_[A-Za-z0-9_]{22,}/,     // GitHub fine-grained PAT
/glpat-[A-Za-z0-9_-]{20,}/,          // GitLab PAT
```

El mismo patrón ya está en `core/ciclo/redactar.js` (aplicado), de modo que la auditoría `agent-tool-audit.jsonl` deja de guardarlas en claro cuando el hook use `redactarSecretos` sobre ese patrón.

## 3. Agentes de solo lectura (C-06)

`disenador-api` figura en `READ_ONLY_AGENTS` pero `agents/disenador-api.md` declara `Write`. Decide una de las dos: quitarlo del conjunto del hook, o quitar `Write` de sus herramientas.

## 4. Ruta del hook en `.claude/settings.json` (C-07)

Si la ruta relativa `node claude-hooks/pre-tool-guard.js` no resuelve (Claude Code lanzado desde otra carpeta), Node termina con código 1, que Claude Code trata como error **no bloqueante**: la herramienta se ejecuta. Usa una ruta anclada:

```json
"command": "node \"$CLAUDE_PROJECT_DIR/claude-hooks/pre-tool-guard.js\""
```

Es un límite del protocolo de hooks, no del script: documentado en `SECURITY.md`.
