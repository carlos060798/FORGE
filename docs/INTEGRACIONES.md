# Integraciones de FORGE con MCPs y servicios externos

FORGE es extensible via **Model Context Protocol (MCP)**. Cada integración añade capacidades que FORGE puede invocar desde skills o comandos.

## Estado de integraciones

| Integración | Estado | Skill asociada |
|---|---|---|
| Vercel | ✅ Disponible | `skills/deploy-vercel/` |
| GitHub | ✅ Disponible | `skills/github/` |
| Figma | ✅ Disponible | `skills/figma-handoff/` |
| Compartir progreso | ✅ Disponible | `skills/share-progress/` |
| Slack | 🗺️ Roadmap | — |
| Linear | 🗺️ Roadmap | — |
| Stripe | 🗺️ Roadmap | — |

---

## Vercel

### Requisito

MCP de Vercel instalado en Claude Code. Verifica con `forge doctor`.

### Cómo activar

1. En Claude Code, ve a Configuración → MCPs
2. Añade el MCP de Vercel: `@vercel/mcp-server`
3. Autentica con tu cuenta de Vercel cuando se te pida

### Uso desde FORGE

```
/forge.deploy        → despliega el proyecto actual en Vercel
/sdd.desplegar vercel → alias técnico del mismo flujo
```

FORGE detecta automáticamente si el MCP está disponible via `forge doctor`. Si no está, sugiere instalarlo.

### Qué hace

- Lee `.sdd/ir.json` para obtener el nombre y tipo del proyecto
- Crea `vercel.json` si no existe, adaptado al tipo (api, saas, cli)
- Despliega usando la herramienta `deploy_to_vercel` del MCP
- Registra la URL de despliegue en `.sdd/estado.json → deploy_url`

### Referencia de skill

Ver `skills/deploy-vercel/SKILL.md` para el flujo completo y manejo de errores.

---

## GitHub

### Requisito

MCP de GitHub instalado en Claude Code.

### Uso desde FORGE

```
/sdd.github.pr       → crea un PR con el código generado
/sdd.github.issue    → crea un issue desde un criterio de aceptación fallido
```

### Qué hace

- Lee el plan de tareas para generar la descripción del PR
- Asocia tareas completadas con commits via convención de mensajes
- Si una verificación falla, puede crear un issue automáticamente

---

## Figma

### Requisito

MCP de Figma instalado en Claude Code + URL de un archivo Figma compartido.

### Uso desde FORGE

```
/forge.diseño <url-figma>   → importa especificaciones de diseño desde Figma
/sdd.diseño figma            → alias técnico
```

### Qué hace

- Lee el archivo Figma via MCP para extraer:
  - Paleta de colores → genera variables CSS
  - Tipografía → genera configuración de fuentes
  - Componentes → genera bocetos de componentes React/HTML
  - Spacing → genera tokens de diseño
- Añade la información de diseño al contexto del agente `disenador-visual`

---

## Cómo conectar un nuevo MCP

### Paso 1 — Crear el skill

```
skills/<nombre>/
└ SKILL.md
```

El skill describe:
- Qué MCP requiere y cómo verificar que está instalado
- Cuándo se activa (condiciones de pipeline_step o comando del usuario)
- El flujo paso a paso usando las herramientas del MCP
- Cómo integra el resultado con `.sdd/estado.json`

### Paso 2 — Registrar el alias en forge.md

Añadir a la tabla de routing en `commands/forge.md`:

```markdown
| "despliega en <servicio>" | skill `<nombre>` |
```

### Paso 3 — Actualizar forge doctor

Añadir la detección del MCP en `cli/index.js` → función `cmdDoctor()`:

```javascript
// Detectar MCP de ejemplo
const tieneMiMcp = detectarMcp("mi-mcp-nombre");
console.log(`  Mi Servicio MCP: ${tieneMiMcp ? "✅ disponible" : "⚠️  no instalado (opcional)"}`);
```

### Paso 4 — Tests

En `tests/integration.test.js`:
```javascript
test("skill de <nombre> existe y tiene frontmatter válido", () => {
  const skillPath = join(PLUGIN_DIR, "skills", "<nombre>", "SKILL.md");
  assert.ok(existsSync(skillPath));
});
```

---

## Principios para integraciones

1. **Siempre opcional** — FORGE funciona sin ningún MCP. Las integraciones añaden capacidades, no las quitan.
2. **Graceful degradation** — Si el MCP no está, FORGE da instrucciones manuales equivalentes.
3. **Sin credenciales en disco** — Los MCPs gestionan la autenticación. FORGE nunca almacena tokens.
4. **Estado en `.sdd/`** — El resultado de cada integración (URL, PR#, etc.) se registra en `estado.json`.
