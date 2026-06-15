---
id: [ID]
titulo: "[TITULO_HUMANO]"
tamano: pequeño  # micro | pequeño | mediano | grande
estado: borrador  # borrador | en_revision | aprobada | en_implementacion | completada
creada: [FECHA]
actualizada: [FECHA]
autor: humano  # humano | importado
constitucion_version: [X.Y.Z]
etiquetas: []
---

# Especificación: [TITULO]

## 1. Contexto y Motivación

[2-4 frases. POR QUÉ se necesita esto. Qué problema resuelve. Motivación de negocio o usuario, NO técnica.]

## 2. Objetivo

[QUÉ debe lograr cuando esté terminado. 1-3 frases declarativas. Sin detalles de implementación.]

## 3. Usuarios y Actores

| Actor | Rol | Necesidad principal |
|-------|-----|---------------------|
| [Actor 1] | [rol] | [qué quiere lograr] |

## 4. Historias de Usuario

### HU-001: [Título corto]
**Como** [tipo de usuario]
**Quiero** [acción/capacidad]
**Para** [beneficio/valor]

**Criterios de aceptación:**
- [ ] **CA-001-01**: [criterio testeable] (P1)
- [ ] **CA-001-02**: [criterio testeable] (P1)
- [ ] **CA-001-03**: [criterio testeable] (P2)

## 5. Escenarios de Uso

### Escenario 1: Caso feliz
**Dado** [estado inicial]
**Cuando** [acción del actor]
**Entonces** [resultado esperado]

### Escenario 2: Caso de error
**Dado** [precondición]
**Cuando** [acción incorrecta]
**Entonces** [manejo de error esperado]

### Escenario 3: Caso borde
**Dado** [precondición borde]
**Cuando** [acción]
**Entonces** [comportamiento esperado]

## 6. Requisitos Funcionales

- **RF-001**: El sistema DEBE [acción específica]
- **RF-002**: El sistema DEBE [acción específica]
- **RF-003**: El sistema NO DEBE [acción prohibida]

## 7. Requisitos No Funcionales

| Categoría | Requisito | Métrica |
|-----------|-----------|---------|
| Rendimiento | [requisito] | [métrica] |
| Seguridad | [requisito] | [criterio] |
| Disponibilidad | [requisito] | [SLO] |
| Accesibilidad | [requisito] | [estándar] |

## 8. Fuera de Alcance (Exclusiones Explícitas)

- ❌ [Cosa que NO se hará]
- ❌ [Cosa que NO se hará]

## 9. Dependencias y Asunciones

### Dependencias
- [Otra spec, feature, servicio externo]

### Asunciones
- [Lo que se asume]
- [NECESITA_ACLARACION]: [si hay algo asumido sin certeza]

## 10. Términos del Dominio

- **[Término]**: [definición]

## 11. Preguntas Abiertas

- [ ] [NECESITA_ACLARACION]: [pregunta crítica]
- [ ] [POR_DECIDIR]: [decisión pospuesta]

## 12. Criterios de Éxito Medibles

- [Métrica 1 con número]
- [Métrica 2 con número]

## 13. Referencias

- [Issue, mockup, doc relacionado]

## 14. Historial de Aclaraciones

| # | Categoría | Pregunta | Decisión | Fecha |
|---|-----------|----------|----------|-------|
