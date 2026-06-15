---
spec_id: [SPEC_ID]
plan_id: [SPEC_ID]-plan
estado: pendiente_aprobacion  # pendiente_aprobacion | aprobado | obsoleto
creado: [FECHA]
constitucion_version: [X.Y.Z]
agentes_participantes: []
---

# Plan Técnico: [TITULO_SPEC]

## 1. Resumen Ejecutivo

[3-5 frases. Qué se va a construir técnicamente, con qué tecnología, en qué archivos principales.]

## 2. Verificación de Constitución (Constitution Check)

| Principio | Cumple | Justificación |
|-----------|--------|--------------|
| Principio I | ✅/❌/⚠️ | [explicación] |
| Principio II | ✅ | [explicación] |

> Si hay ❌ o ⚠️: documentar en sección "Complejidad Justificada" o detener el plan.

## 3. Enfoque Técnico

[2-4 párrafos del enfoque elegido y por qué.]

## 4. Decisiones Técnicas

| # | Decisión | Opción elegida | Alternativas descartadas | Razón |
|---|----------|---------------|--------------------------|-------|
| 1 | [decisión] | [opción] | [otras] | [razón concreta] |

> Decisiones no triviales también se documentan como ADR en `.sdd/arquitectura/`.

## 5. Estructura de Carpetas Afectada

```
[Diagrama de árbol mostrando dónde van los archivos nuevos]
```

## 6. Archivos Afectados

| Acción | Ruta | Propósito | Agente responsable |
|--------|------|-----------|--------------------|
| CREAR | `ruta/archivo.ext` | [qué hace] | desarrollador-backend |
| MODIFICAR | `ruta/existente.ext` | [qué cambia] | desarrollador-backend |
| ELIMINAR | `ruta/obsoleto.ext` | [por qué] | — |

## 7. Modelo de Datos

### Entidades nuevas
```[lenguaje]
// Tipos / interfaces / schemas
```

### Cambios en entidades existentes
[Migraciones requeridas]

### Queries críticas
[SQL/NoSQL queries importantes con justificación de índices]

## 8. Contratos de API

### Endpoints / Operaciones nuevas
```yaml
# OpenAPI / GraphQL schema / proto / etc
```

### Cambios en endpoints existentes
[Breaking? Si sí, plan de migración]

### Eventos / Mensajes (si aplica)
[Topics, formatos, idempotencia]

## 9. Estrategia de Tests

### Tests unitarios
- Qué unidades se testean
- Mocks necesarios

### Tests de integración
- Qué integraciones se prueban

### Tests E2E (si aplica)
- Flujos críticos a cubrir

## 10. Dependencias Nuevas

| Paquete | Versión | Justificación | Alternativas |
|---------|---------|--------------|-------------|
| [paquete] | [versión] | [por qué] | [otras] |

## 11. Riesgos Técnicos

| # | Riesgo | Probabilidad | Impacto | Mitigación |
|---|--------|--------------|---------|-----------|
| 1 | [riesgo] | A/M/B | A/M/B | [acción] |

## 12. Plan de Implementación en Fases

### Fase A: Fundamentos
[Tipos, interfaces, schemas, migraciones]

### Fase B: Tests primero (si TDD)

### Fase C: Capa de datos

### Fase D: Lógica de negocio

### Fase E: Interfaz / API

### Fase F: UI (si aplica)

### Fase G: Integración

### Fase H: Verificación

## 13. Cambios Breaking

[Lista de cambios que rompen compatibilidad. Vacío si ninguno.]

## 14. Métricas y Observabilidad

[Qué loguear / métricas a exponer / alarmas]

## 15. Complejidad Justificada

[Solo si hay desviaciones de la constitución que se justifican.]

## 16. Estimación

- Complejidad global: [Baja / Media / Alta]
- Tareas estimadas: [N]

## 17. Aportes por Agente

### Arquitecto
[Decisiones de alto nivel]

### Diseñador de API
[Diseño de contratos]

### Asesor de datos
[Decisiones de BD]

### Crítico
[Riesgos identificados]

### Seguridad
[Consideraciones]
