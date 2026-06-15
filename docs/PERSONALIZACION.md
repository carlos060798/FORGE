# Guía Exhaustiva de Personalización

SDD-ES está diseñado para ser **completamente personalizable**. Cada archivo es Markdown plano que puedes editar.

## Niveles de personalización

### Nivel 1: Configuración (`.sdd/sdd.config.yaml`)

Cambios sin tocar lógica del plugin.

- Activar/desactivar agentes
- Cambiar modelos por agente
- Cambiar rutas de archivos
- Ajustar umbrales de calidad
- Modificar comportamientos (numeración de specs, ruta rápida, etc.)
- Definir protecciones (archivos no tocar, comandos prohibidos)

### Nivel 2: Plantillas (`plantillas/*.md`)

Cambios en el formato de los artefactos generados.

- Modificar secciones de la spec
- Cambiar el formato del plan
- Personalizar el ADR
- Añadir/quitar secciones del snapshot

Las plantillas se leen al generar cada artefacto. Cambia un campo aquí y todos los artefactos futuros lo respetarán.

### Nivel 3: Comandos (`commands/sdd.*.md`)

Cambios en el comportamiento del flujo.

- Modificar el orden de pasos en un comando
- Cambiar las preguntas que se hacen
- Ajustar criterios de detección automática
- Personalizar mensajes y outputs

### Nivel 4: Agentes (`agents/*.md`)

Cambios en la personalidad y reglas de los expertos.

- Añadir restricciones específicas del proyecto
- Cambiar el formato de salida
- Definir conocimiento de dominio
- Ajustar criterios de aceptación de su trabajo

### Nivel 5: Hooks (`.sdd/hooks/*.sh`)

Integración con tus sistemas externos.

- Git/GitLab/GitHub workflows
- Notificaciones (Slack, Teams, Discord)
- Triggers de CI/CD
- Linters/formatters automáticos
- Backups
- Sync con sistemas de tickets (Jira, Linear, etc.)

## Casos de personalización comunes

### Caso 1: Agregar una sección obligatoria a las specs

Edita `plantillas/especificacion.md` y añade tu sección. Luego edita `commands/sdd.especificar.md` para mencionarla en el PASO 4.

Opcional: edita `commands/sdd.checklist.md` para añadir un check sobre esa sección.

### Caso 2: Cambiar el formato de los ADRs

Edita `plantillas/decision-arquitectura.md`.

### Caso 3: Integrar con tu workflow de Git (sin que SDD lo haga directamente)

Crea `.sdd/hooks/despues_especificar.sh`:
```bash
#!/bin/bash
# Crear branch automáticamente al crear una spec
SPEC_ID="$1"
git checkout -b "spec/${SPEC_ID}"
echo "✅ Branch creada: spec/${SPEC_ID}"
```

Y `.sdd/hooks/despues_implementar.sh`:
```bash
#!/bin/bash
# Hacer commit y abrir PR
SPEC_ID=$(grep -o '"especificacion_activa": "[^"]*"' .sdd/estado.json | cut -d'"' -f4)
git add -A
git commit -m "feat(${SPEC_ID}): implementación completada"
gh pr create --title "${SPEC_ID}" --body "$(cat .sdd/especificaciones/${SPEC_ID}/spec.md | head -20)"
```

### Caso 4: Notificar al equipo cuando se aprueba un plan

Crea `.sdd/hooks/despues_planificar.sh`:
```bash
#!/bin/bash
SPEC_ID=$(grep -o '"especificacion_activa": "[^"]*"' .sdd/estado.json | cut -d'"' -f4)
TITULO=$(grep "^titulo:" ".sdd/especificaciones/${SPEC_ID}/spec.md" | cut -d'"' -f2)

curl -X POST https://hooks.slack.com/services/XXX/YYY/ZZZ \
  -H 'Content-type: application/json' \
  --data "{\"text\":\"📋 Plan aprobado: ${TITULO}\"}"
```

### Caso 5: Añadir un agente nuevo (ej: "mobile-developer")

1. Crea `agents/desarrollador-mobile.md` con el frontmatter y el rol
2. Añádelo a `.claude-plugin/plugin.json` en `agents:`
3. Añade entrada en `.sdd/sdd.config.yaml`:
   ```yaml
   agentes:
     desarrollador-mobile:
       activo: true
       modelo: sonnet
       descripcion: "Desarrollo de apps móviles."
   ```
4. Edita `skills/enrutador-agentes.md` para incluir reglas de cuándo invocarlo
5. (Opcional) Edita `commands/sdd.tareas.md` para asignarle tareas específicas

### Caso 6: Soportar otro idioma además de español

Aunque SDD-ES está en español, puedes:
- Duplicar los archivos `commands/sdd.*.md` con sufijo `.en.md` y traducirlos
- Mantener variables como `.sdd/idioma` y leer condicionalmente
- Más simple: forkea el repo y traduce todo

### Caso 7: Bloquear ciertos archivos

En `.sdd/sdd.config.yaml`:
```yaml
protecciones:
  no_tocar_archivos:
    - ".env*"
    - "src/legacy/**"           ← añade tus rutas
    - "vendor/**"
    - "secrets/**"
```

### Caso 8: Numeración secuencial en lugar de fecha

En `.sdd/sdd.config.yaml`:
```yaml
comportamiento:
  numeracion_especificaciones: "secuencial"  # 001-, 002-, ...
  # o "ambos": 2026-06-08-001-feature-x
```

## Filosofía de personalización

- **Empieza simple**: usa los defaults, personaliza solo cuando los necesites
- **Documenta tus cambios**: si cambias una plantilla, deja un comentario explicando por qué
- **No olvides el equipo**: si trabajas en equipo, commitea las personalizaciones
- **Versiona la constitución**: cuando cambias principios, sube versión MAYOR/MENOR/PARCHE
