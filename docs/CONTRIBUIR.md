# Guía de contribución a FORGE

¡Gracias por contribuir! Este documento explica cómo añadir nuevos componentes al sistema.

## Tipos de contribución

- **Nuevo agente** — Añade un especialista al equipo de 14
- **Nuevo skill** — Añade una capacidad especial invocable
- **Nuevo comando SDD** — Extiende el pipeline con una nueva fase
- **Bug fix** — Corrige un problema existente
- **Tests** — Mejora la cobertura del sistema

## Cómo añadir un nuevo agente

### Estructura

```
agents/
└ <nombre>.md
```

### Formato del archivo

```markdown
---
name: nombre-del-agente
description: "Descripción de una línea del rol del agente"
model: claude-sonnet-4-6
---

# <Nombre del Agente>

## Rol

[Descripción detallada de su responsabilidad en el pipeline]

## Cuándo se activa

[En qué fase del pipeline actúa y qué activa su invocación]

## Qué produce

[Artefactos que genera: archivos, cambios en estado.json, etc.]

## Instrucciones

[Instrucciones específicas para el agente sobre cómo ejecutar su trabajo]
```

### Reglas

- El `name` debe ser único en `agents/`
- `model` debe ser uno de: `claude-opus-4-8`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`
- Reserva Opus para agentes de alta criticidad (arquitecto, crítico, seguridad)
- El agente debe integrarse con el estado en `.sdd/estado.json`

### Tests requeridos

Añadir en `tests/agents.test.js` (o crear si no existe):
- Test de existencia del archivo
- Test de frontmatter válido (name, description, model)
- Test de secciones requeridas en el cuerpo

**Criterio de verificación ejecutable:**
```bash
npm test
# Debe pasar incluyendo el nuevo test de agente.
# El test de consistency.test.js verificará automáticamente que el agente
# está registrado en plugin.json y tiene el formato correcto.
```

---

## Cómo añadir un nuevo skill

### Estructura

```
skills/
└ <nombre>/
   └ SKILL.md
```

### Formato del archivo

```markdown
---
id: nombre-del-skill
nombre: Nombre Legible
descripcion: Descripción de una línea para el índice de skills
aliases: ["/comando.skill", "/comando alias"]
version: 1.0.0
---

# Skill: <Nombre>

## Propósito

[Qué problema resuelve]

## Cuándo usar este skill

[Condiciones de activación]

## Instrucciones para el agente

[Pasos concretos que debe seguir el agente al activar el skill]
```

### Registro del alias

Si el skill tiene un alias como `/forge.nombre`, añadirlo a la tabla de routing en `commands/forge.md`:

```markdown
| "trigger phrase" | skill `nombre` |
```

### Tests requeridos

- Verificar existencia de `SKILL.md`
- Verificar frontmatter válido (id, nombre, descripcion)
- Verificar que el alias está registrado en `commands/forge.md`

**Criterio de verificación ejecutable:**
```bash
npm test
# consistency.test.js verificará que el nuevo skill aparece en plugin.json
# y que su SKILL.md existe. Si falta alguno de los dos, el test falla con
# un mensaje que indica exactamente qué archivo o entrada está ausente.
```

---

## Cómo añadir un nuevo comando SDD

### Estructura

```
commands/
└ sdd.<nombre>.md
```

### Formato del archivo

```markdown
---
description: Descripción del comando (aparece en /help)
allowed-tools: Read, Write, Bash
---

# /sdd.<nombre>

[Instrucciones completas para ejecutar el comando]
```

### Integración con el estado

El comando DEBE actualizar `estado.json` cuando cambia la fase del pipeline:

```bash
# Actualizar pipeline_step
jq '.pipeline_step = "<nueva_fase>" | .ultima_actualizacion = "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"' \
  .sdd/estado.json > .sdd/estado.json.tmp && mv .sdd/estado.json.tmp .sdd/estado.json
```

### Tests requeridos

En `tests/pipeline-behavior.test.js`:
- Test de que el artefacto producido tiene el formato correcto
- Test de que `estado.json` se actualiza con el `pipeline_step` correcto

**Criterio de verificación ejecutable:**
```bash
npm test
# Los tests de pipeline-behavior.test.js verificarán el contrato del artefacto.
# Si el nuevo comando produce un artefacto con un formato distinto al esperado,
# el test falla indicando qué campo falta o tiene tipo incorrecto.
```

---

## Proceso de contribución

### 1. Fork y rama

```bash
git checkout -b feature/mi-contribucion
```

### 2. Desarrollo

- Sigue el formato exacto descrito arriba para cada tipo
- Mantiene el principio zero-deps: no añadas dependencias npm en runtime

### 3. Tests

```bash
npm test
npm run typecheck
```

Todos los tests deben estar en verde antes de hacer PR.

### 4. Pull Request

- Título: `feat(agentes): añade agente <nombre>` o `fix(hooks): corrige <problema>`
- Descripción: qué añade/corrige y por qué
- Los tests deben pasar en CI

---

## Qué NO hacer

- ❌ Añadir dependencias npm al runtime (`cli/`, `claude-hooks/`, `core/` sin build step)
- ❌ Modificar los 38 comandos `sdd.*.md` sin tests que validen el cambio
- ❌ Hardcodear rutas absolutas (usar siempre `join(process.cwd(), "...")`)
- ❌ Registrar información sensible en `consumo.jsonl` (tokens, contraseñas, secrets)
- ❌ Crear archivos de más de 500 líneas sin una razón justificada
