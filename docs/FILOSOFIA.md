# Filosofía de SDD-ES

## ¿Qué es SDD?

**Spec-Driven Development** (Desarrollo Guiado por Especificaciones) es una metodología donde:

1. **La especificación es la fuente de verdad**, no el código.
2. El código es un **artefacto derivado** de la spec, no al revés.
3. Cada cambio empieza definiendo *qué* y *por qué* antes de *cómo*.

## ¿Por qué SDD funciona con IA?

Los modelos de IA son muy creativos — demasiado para nuestro gusto cuando programan. SDD canaliza esa creatividad imponiendo restricciones estructuradas:

- La spec define el espacio de soluciones aceptables
- La constitución limita las decisiones técnicas
- Las tareas atómicas reducen la deriva en cada paso
- Los criterios de verificación atrapan errores antes de que se acumulen

**Resultado**: implementación predecible, auditable, sin "magia" en el medio.

## Inspiración

SDD-ES integra ideas de:

- **[github/spec-kit](https://github.com/github/spec-kit)**: constitution, sync impact reports, hooks de extensión, versionado semántico, checklist como tests de los requisitos.
- **[LiorCohen/sdd](https://github.com/LiorCohen/sdd)**: agentes especializados por rol con modelo asignado, comandos en lenguaje natural, estructura específica con INDEX/SNAPSHOT/glossary, verificación cruzada.
- **OpenSpec**, **SpecWeave**, **disciplined-agentic-engineering**: schemas custom, BDD, mecanismos de auditoría.

## Diferencias de SDD-ES

1. **100% español**: comandos, plantillas, agentes, documentación
2. **Agnóstico al stack**: TypeScript, Python, Rust, Go, Java, C#, Ruby, PHP, etc.
3. **Sin acoplamiento a Git/GitHub/GitLab**: tú integras tu VCS desde hooks personalizados
4. **Configurable**: cualquier agente se activa/desactiva, cualquier modelo se reasigna
5. **Recomendaciones de modelos**: cada agente trae una recomendación justificada
6. **Personalización exhaustiva**: todo es Markdown plano editable

## Cuándo usar SDD-ES

✅ **Usar cuando:**
- Tienes una idea de feature pero no sabes cómo descomponerla
- El proyecto requiere trazabilidad de decisiones
- Trabajas en equipo y necesitas alineación
- Quieres que la IA implemente con rigor (no improvisando)
- El cambio toca múltiples archivos o capas

❌ **No usar (overhead innecesario):**
- Arreglar un typo
- Cambiar un literal de string
- Ajustes de CSS visual sin lógica

> Para esos casos hay flujo "micro" — la IA detecta automáticamente que es trivial y simplifica el proceso.

## Los 5 principios de SDD-ES

1. **Spec antes que código** — siempre
2. **Constitución es ley** — el plan no puede contradecirla sin justificación documentada
3. **Cada decisión es trazable** — del CA a la línea de código que lo implementa
4. **Agentes especializados** — un experto por dominio supera a un generalista
5. **Verificación independiente** — la IA que verifica no es la misma que implementa
