# Optimización del Entorno Claude Code

> Referencia de variables de entorno, límites reales y configuración óptima para proyectos FORGE. Datos verificados contra la documentación oficial de Anthropic (code.claude.com).

---

## Variables de entorno recomendadas

### `DISABLE_AUTOUPDATER=1`

Evita que Claude Code se actualice automáticamente durante una sesión de trabajo. Las actualizaciones automáticas pueden reiniciar el proceso y desactivar hooks temporalmente.

```bash
# En .env o en el perfil de shell
export DISABLE_AUTOUPDATER=1
```

**Cuándo usar:** proyectos con hooks críticos de seguridad o en entornos CI/CD donde la versión debe ser fija.

---

### `CLAUDE_CODE_DISABLE_1M_CONTEXT=1`

Fuerza la ventana de contexto estándar (200K tokens) en lugar de la extendida (1M tokens). La ventana de 1M es más cara y en proyectos medianos no aporta ventaja — el costo extra solo se justifica cuando el contexto supera ~150K tokens.

```bash
export CLAUDE_CODE_DISABLE_1M_CONTEXT=1
```

**Cuándo usar:** proyectos con presupuesto ajustado o cuando el costo por sesión es una prioridad.

---

### `MAX_THINKING_TOKENS`

Controla el presupuesto de razonamiento extendido (extended thinking) para modelos que lo soportan (Opus 4.8, Sonnet 4.6, Fable 5). Reducir este valor disminuye la latencia y el costo en tareas que no necesitan razonamiento profundo.

```bash
export MAX_THINKING_TOKENS=5000   # Reducido — tareas simples
export MAX_THINKING_TOKENS=20000  # Default aproximado
export MAX_THINKING_TOKENS=0      # Deshabilita (no disponible en Fable 5)
```

**Nota:** Fable 5 no permite deshabilitar el thinking completamente.

---

## Límites reales de instrucciones (oficiales, Claude Code)

Estos límites son **duros** — el contenido que los supera se trunca **silenciosamente sin aviso**.

| Archivo | Límite | Consecuencia si se excede |
|---|---|---|
| CLAUDE.md (por archivo) | **4,000 chars** | El contenido extra se silencia sin aviso |
| CLAUDE.md (total multi-archivo) | **12,000 chars** | El contenido extra se silencia |
| MEMORY.md (auto-memory) | **200 líneas ó 25KB** | Truncación al inicio de sesión |
| Skill post-/compact | **5,000 tokens por skill** | El skill más antiguo se elimina |
| Skills total post-/compact | **25,000 tokens** | Skills más antiguos se eliminan |

### Cómo evitar truncación silenciosa

**Para CLAUDE.md:** mantén el archivo bajo 3,500 chars. Usa `node cli/index.js doctor` para auditar el tamaño.

**Para MEMORY.md:** usa el patrón de índice de punteros — MEMORY.md como tabla de contenidos (máx. 150 líneas), con archivos temáticos separados para el contenido detallado:

```markdown
# Memory Index

- Decisiones de autenticación → auth-decisions.md
- Convenciones de API REST → api-conventions.md
- Schema de base de datos → database-schema.md
- Bugs conocidos y workarounds → known-issues.md
```

Los archivos temáticos (`auth-decisions.md`, etc.) no tienen límite de tamaño y se cargan bajo demanda cuando Claude los necesita. Solo MEMORY.md se carga automáticamente al inicio de sesión.

FORGE v2.8 alerta en stderr cuando MEMORY.md supera 150 líneas.

---

## Hooks oficiales de Claude Code

Los siguientes hooks están documentados oficialmente (38 eventos totales). Los más relevantes para FORGE:

| Hook | Cuándo se dispara |
|---|---|
| `PreToolUse` | Antes de ejecutar cualquier herramienta |
| `PostToolUse` | Después de ejecutar cualquier herramienta |
| `SessionStart` | Al iniciar una sesión |
| `SessionEnd` | Al terminar una sesión (sí existe — es oficial) |
| `PreCompact` | Antes de la compactación de contexto |
| `PostCompact` | Después de la compactación |
| `UserPromptSubmit` | Al enviar un prompt del usuario |
| `Stop` | Cuando el modelo para de generar |

> **Corrección:** documentación anterior de FORGE indicaba que `SessionEnd` no existía. **Sí existe** y está documentado en code.claude.com/docs/en/hooks.

---

## Qué sobrevive a `/compact`

La compactación reduce el historial a un resumen. Lo que se **re-inyecta automáticamente**:

- ✅ CLAUDE.md del proyecto (desde disco)
- ✅ Auto-memory (MEMORY.md)
- ✅ Instrucciones de sistema
- ✅ Skills invocados en la sesión (cap: 5,000 tokens/skill, 25,000 total)

Lo que se **pierde**:

- ❌ Skill listing (la lista de skills disponibles — única excepción)
- ❌ Path-scoped rules (se recargan cuando se lee un archivo en ese directorio)
- ❌ CLAUDE.md anidados en subdirectorios (ídem)

---

## Configuración `.claudeignore`

FORGE incluye una plantilla en `configuracion-ejemplo/.claudeignore`. Añadir este archivo al proyecto reduce el overhead de contexto en un 85% (archivos irrelevantes que Claude no carga).

Patrones más importantes:

```gitignore
node_modules/
dist/
build/
.next/
coverage/
*.lock
*.log
```

---

## Diagnóstico con FORGE doctor

```bash
node cli/index.js doctor
```

Verifica:
- Node >= 18
- Claude CLI en PATH
- Integridad del plugin
- Tamaño de CLAUDE.md (alerta si > 3,500 chars)
- Presencia y claves obligatorias de sdd.config.yaml

---

*Fuentes: documentación oficial code.claude.com, investigación FORGE v2.8 — ver [INFORME-MEMORIA-OSS.md](INFORME-MEMORIA-OSS.md)*
