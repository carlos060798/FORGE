<!--
INFORME DE IMPACTO DE SINCRONIZACIÓN
====================================
Cambio de versión: [VERSION_ANTERIOR] → [VERSION_NUEVA]
Tipo de cambio: [MAYOR | MENOR | PARCHE]

Principios modificados:
  - [Lista de cambios]

Plantillas que requieren actualización:
  - plantillas/especificacion.md   [✅ alineada | ⚠ pendiente]
  - plantillas/plan.md              [✅ | ⚠]
  - plantillas/tareas.md            [✅ | ⚠]
  - commands/*.md                   [✅ | ⚠]

TODOs diferidos:
  - [Lista]
-->

# Constitución del Proyecto: [NOMBRE_PROYECTO]

> **Versión:** [X.Y.Z] | **Ratificada:** [FECHA_RATIFICACION] | **Última enmienda:** [FECHA_HOY]

## Propósito y Misión

[Descripción del propósito del proyecto en 2-3 frases. Qué problema resuelve y para quién.]

## Stack Técnico

| Aspecto | Valor |
|---------|-------|
| Lenguaje principal | [LENGUAJE] |
| Framework | [FRAMEWORK o "ninguno"] |
| Almacenamiento | [BASE_DATOS o "por definir"] |
| Tests | [FRAMEWORK_TESTS] |
| Build/Bundler | [HERRAMIENTA] |
| Despliegue | [DESTINO] |

> Cualquier cambio de stack requiere un ADR en `.sdd/arquitectura/`.

## Principios Fundamentales

### Principio I: [NOMBRE_PRINCIPIO_1]

[Descripción declarativa. Usa MUST/MUST NOT/SHOULD/MAY (DEBE/NO DEBE/DEBERÍA/PUEDE) explícitamente.]

**Razón:** [Por qué este principio existe]

### Principio II: [NOMBRE_PRINCIPIO_2]

[Descripción]

**Razón:** [Por qué]

### Principio III: [NOMBRE_PRINCIPIO_3]

[Descripción]

**Razón:** [Por qué]

## Estándares de Calidad

- **Tests:** cobertura mínima [X]%. Tests obligatorios para [áreas].
- **Linting:** [HERRAMIENTA] con configuración estricta. Sin warnings en CI.
- **Tipos:** [Estricto/Opcional]. [Detalles del type-checker].
- **Formato:** [HERRAMIENTA]. Aplicado automáticamente.
- **Revisión:** cada cambio pasa por el agente `revisor` antes de marcar tareas como completas.

## Restricciones Arquitectónicas

[Lista de cosas que NUNCA hay que hacer:]

- NO agregar dependencias nuevas sin ADR
- NO romper la API pública sin bump de versión MAYOR
- NO mezclar lógica de presentación con dominio
- [...]

## Convenciones

### Nomenclatura
- Archivos: [convención]
- Variables: [convención]
- Constantes: [convención]
- Tipos/Clases: [convención]

### Estructura
[Cómo se organizan los directorios y módulos]

## Proceso de Cambios (Flujo SDD-ES)

1. Todo cambio empieza con `/sdd.especificar`
2. La spec se clarifica con `/sdd.aclarar` si hay ambigüedad
3. El plan técnico se aprueba con `/sdd.planificar aprobar`
4. Las tareas se generan con `/sdd.tareas`
5. La consistencia se valida con `/sdd.analizar`
6. La implementación se ejecuta con `/sdd.implementar`
7. El cumplimiento se verifica con `/sdd.verificar`

## Gobernanza

- Esta constitución sigue versionado semántico (MAYOR.MENOR.PARCHE)
- Cualquier cambio se registra en el "Informe de Impacto de Sincronización" arriba
- Las enmiendas requieren actualizar las plantillas y comandos afectados
- Las decisiones técnicas no triviales se documentan como ADR en `.sdd/arquitectura/`
