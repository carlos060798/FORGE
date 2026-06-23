# 🔗 Matriz de Trazabilidad — FORGE v4.0.0

**Traza cada concepto clave de FORGE a través de toda su documentación, código fuente y ejemplos**

---

## Propósito

Esta matriz garantiza que:
- ✅ Cada concepto está documentado en al menos un lugar
- ✅ La documentación es completa y sin gaps
- ✅ No hay conceptos huérfanos (sin documentación)
- ✅ Todo concepto apunta a código verificable
- ✅ Ejemplos demuestran cada concepto

---

## Matriz por Concepto

### 1. SDD (Spec-Driven Development)

| Aspecto | Ubicación | Tipo | Estado |
|---------|-----------|------|--------|
| Definición | [core-concepts.md#desarrollo-guiado-por-especificaciones](core-concepts.md) | Definición formal | ✅ |
| Metodología | [introduction.md#cómo-se-relaciona-forge-con-sdd](introduction.md) | Explicación | ✅ |
| Ciclo | [core-concepts.md#desarrollo-guiado-por-especificaciones](core-concepts.md) | Diagrama | ✅ |
| Implementación en pipeline | [workflows.md](workflows.md) | Ejemplo | ✅ |
| Código fuente | `.sdd/` | Sistema | ✅ |
| Ejemplo completo | [EJEMPLO-API-REST.md](Ejemplo-API-REST.md) | Walkthrough | ✅ |

**Trazabilidad:** ✅ COMPLETA

---

### 2. IR (Interpreted Requirement)

| Aspecto | Ubicación | Tipo | Estado |
|---------|-----------|------|--------|
| Definición | [core-concepts.md#el-requisito-interpretado-ir](core-concepts.md) | Formal | ✅ |
| Estructura JSON | [core-concepts.md#estructura-del-ir](core-concepts.md) | Ejemplo | ✅ |
| Confidence score | [core-concepts.md#la-puntuación-de-confianza](core-concepts.md) | Explicación | ✅ |
| Generación | [workflows.md#etapa-2--interpretación](workflows.md) | Comando `/sdd.interpretar` | ✅ |
| Almacenamiento | `.sdd/ir.json` | Archivo | ✅ |
| Ejemplo | [EJEMPLO-API-REST.md](Ejemplo-API-REST.md) | Caso real | ✅ |

**Trazabilidad:** ✅ COMPLETA

---

### 3. Agente

| Aspecto | Ubicación | Tipo | Estado |
|---------|-----------|------|--------|
| Definición | [GLOSARIO.md#agente](GLOSARIO.md) | Canónica | ✅ |
| Conceptos | [core-concepts.md#memoria-de-agentes](core-concepts.md) | Explicación | ✅ |
| Tabla completa | [agents.md#tabla-de-referencia-rápida](agents.md) | Referencia | ✅ |
| Perfiles (14 agentes) | [agents.md#perfiles-de-agentes](agents.md) | Detallado | ✅ |
| Arquitectura | [architecture.md#l4--orquestación](architecture.md) | Diagrama | ✅ |
| Memoria | [MEMORIA-Y-OBSERVABILIDAD.md](MEMORIA-Y-OBSERVABILIDAD.md) | API | ✅ |
| Ejemplo | [EJEMPLO-API-REST.md](Ejemplo-API-REST.md) | Walkthrough | ✅ |
| Código | `.claude/agents/*.md` | Implementación | ✅ |

**Trazabilidad:** ✅ COMPLETA

---

### 4. Skill

| Aspecto | Ubicación | Tipo | Estado |
|---------|-----------|------|--------|
| Definición | [GLOSARIO.md#skill](GLOSARIO.md) | Canónica | ✅ |
| Concepto | [core-concepts.md](core-concepts.md) | Explicación | ✅ |
| Mapa de skills | [tools.md#mapa-de-skills-por-categoría](tools.md) | Categorizado | ✅ |
| Referencia completa | [tools.md#referencia-completa-de-skills](tools.md) | Detallado | ✅ |
| Crear personalizada | [extending-forge.md#crear-skills-personalizadas](extending-forge.md) | How-to | ✅ |
| Código | `.claude/skills/*/SKILL.md` | Implementación | ✅ |

**Trazabilidad:** ✅ COMPLETA

---

### 5. Comando

| Aspecto | Ubicación | Tipo | Estado |
|---------|-----------|------|--------|
| Definición | [GLOSARIO.md#comando](GLOSARIO.md) | Canónica | ✅ |
| Los 39 comandos | [Comandos-Referencia.md](Comandos-Referencia.md) | Lista | ✅ |
| 8 principales | [workflows.md](workflows.md) | Detallado | ✅ |
| Pipeline completo | [core-concepts.md#el-pipeline-de-etapas](core-concepts.md) | Descripción | ✅ |
| Crear personalizado | [extending-forge.md#crear-comandos-personalizados](extending-forge.md) | How-to | ✅ |
| Código | `.claude/commands/*.md` | Implementación | ✅ |

**Trazabilidad:** ✅ COMPLETA

---

### 6. Hook

| Aspecto | Ubicación | Tipo | Estado |
|---------|-----------|------|--------|
| Definición | [GLOSARIO.md#hook](GLOSARIO.md) | Canónica | ✅ |
| Los 3 hooks | [introduction.md#qué-instala-forge](introduction.md) | Listado | ✅ |
| pre-tool-guard | [runtime.md#pre-tool-guardjs](runtime.md) | Detallado | ✅ |
| agent-memory | [runtime.md#agent-memoryjs](runtime.md) | Detallado | ✅ |
| post-write-conventions | [runtime.md#post-write-conventionsjs](runtime.md) | Detallado | ✅ |
| Modelo de ejecución | [architecture.md#modelo-de-ejecución-de-hooks](architecture.md) | Diagrama | ✅ |
| Compatibilidad | [COMPATIBILIDAD.md](COMPATIBILIDAD.md) | Contrato | ✅ |
| Código | `.claude/hooks/*.js` | Implementación | ✅ |

**Trazabilidad:** ✅ COMPLETA

---

### 7. Pipeline

| Aspecto | Ubicación | Tipo | Estado |
|---------|-----------|------|--------|
| Definición | [GLOSARIO.md#pipeline](GLOSARIO.md) | Canónica | ✅ |
| Visión general | [introduction.md#cómo-funciona](introduction.md) | Explicación | ✅ |
| 8 etapas principales | [workflows.md#el-pipeline-completo](workflows.md) | Documentado | ✅ |
| 11 estados | [core-concepts.md#nivel-3-estado-11-totales](core-concepts.md) | Máquina de estados | ✅ |
| Máquina de estados | [architecture.md#máquina-de-estados-del-pipeline](architecture.md) | Diagrama | ✅ |
| Reanudabilidad | [core-concepts.md#el-pipeline-de-etapas](core-concepts.md) | Concepto | ✅ |
| Ejemplo | [EJEMPLO-API-REST.md](Ejemplo-API-REST.md) | Walkthrough | ✅ |

**Trazabilidad:** ✅ COMPLETA

---

### 8. Constitución

| Aspecto | Ubicación | Tipo | Estado |
|---------|-----------|------|--------|
| Definición | [GLOSARIO.md](GLOSARIO.md) | Canónica | ✅ |
| Qué contiene | [core-concepts.md#la-constitución-del-proyecto](core-concepts.md) | Definición | ✅ |
| Creación | [workflows.md](workflows.md) | Comando `/sdd.constitucion` | ✅ |
| Como restricción dura | [core-concepts.md#por-qué-es-una-restricción-dura](core-concepts.md) | Explicación | ✅ |
| Ejemplo | [core-concepts.md#ejemplo](core-concepts.md) | Markdown | ✅ |
| Almacenamiento | `.sdd/memoria/constitucion.md` | Archivo | ✅ |

**Trazabilidad:** ✅ COMPLETA

---

### 9. ADR (Architecture Decision Record)

| Aspecto | Ubicación | Tipo | Estado |
|---------|-----------|------|--------|
| Definición | [GLOSARIO.md#adr](GLOSARIO.md) | Canónica | ✅ |
| Propósito | [core-concepts.md#registros-de-decisiones-arquitectónicas-adr](core-concepts.md) | Explicación | ✅ |
| Generación | [workflow.md](workflows.md) | Implícito en `/sdd.planificar` | ✅ |
| Almacenamiento | `.sdd/arquitectura/` | Directorio | ✅ |
| Ejemplo | [core-concepts.md](core-concepts.md) | Referencia | ✅ |

**Trazabilidad:** ✅ COMPLETA

---

### 10. Memoria persistente

| Aspecto | Ubicación | Tipo | Estado |
|---------|-----------|------|--------|
| Concepto | [core-concepts.md#memoria-de-agentes](core-concepts.md) | Explicación | ✅ |
| Backend Markdown | [runtime.md](runtime.md) | Descripción | ✅ |
| Backend SQLite | [configuration.md#backend-de-memoria](configuration.md) | Configuración | ✅ |
| Estructura `.sdd/` | [architecture.md#estructura-del-directorio-sdd](architecture.md) | Diagrama | ✅ |
| API ProjectMemory | [api-reference.md](api-reference.md) | Referencia | ✅ |
| Ejemplos de código | [EJEMPLOS-MEMORIA-API.md](Ejemplos-Memoria-API.md) | JS/TS | ✅ |
| Optimización | [MEMORIA-Y-OBSERVABILIDAD.md](Memoria-Y-Observabilidad.md) | Técnicas | ✅ |

**Trazabilidad:** ✅ COMPLETA

---

### 11. Observabilidad

| Aspecto | Ubicación | Tipo | Estado |
|---------|-----------|------|--------|
| Dashboard | [README.md](../README.md) | Mención | ✅ |
| Arquitectura | [architecture.md#arquitectura-de-observabilidad](architecture.md) | Diagrama | ✅ |
| Consumo de tokens | [MEMORIA-Y-OBSERVABILIDAD.md](Memoria-Y-Observabilidad.md) | Detallado | ✅ |
| Skill observabilidad | [tools.md](tools.md) | Referencia | ✅ |

**Trazabilidad:** ✅ COMPLETA

---

### 12. Configuración

| Aspecto | Ubicación | Tipo | Estado |
|---------|-----------|------|--------|
| Referencia completa | [configuration.md](configuration.md) | Exhaustiva | ✅ |
| Ejemplo | [getting-started.md](getting-started.md) | Getting-started | ✅ |
| Backend Markdown vs SQLite | [configuration.md#backend-de-memoria](configuration.md) | Detallado | ✅ |
| Agentes configurables | [configuration.md](configuration.md) | Tabla | ✅ |
| Variables de entorno | [OPTIMIZACION-ENTORNO.md](Optimizacion-Entorno.md) | Guía | ✅ |
| Archivo físico | `.sdd/sdd.config.yaml` | Almacenamiento | ✅ |

**Trazabilidad:** ✅ COMPLETA

---

## Cobertura por tipo de concepto

### Conceptos fundamentales (100% cobertura)
- ✅ SDD
- ✅ IR
- ✅ Agente
- ✅ Comando
- ✅ Pipeline
- ✅ Skill
- ✅ Hook
- ✅ Constitución
- ✅ ADR

### Conceptos técnicos (100% cobertura)
- ✅ Memoria persistente
- ✅ Observabilidad
- ✅ Configuración
- ✅ Modelo de capas (L0-L5)
- ✅ Máquina de estados

### Conceptos sin cobertura
- ❌ (Ninguno identificado)

---

## Validación de trazabilidad

### Checklist de validación

Para cada concepto nuevo agregado a FORGE:

- [ ] ¿Se define en GLOSARIO.md?
- [ ] ¿Se explica en conceptos fundamentales?
- [ ] ¿Se documenta en arquitectura si es técnico?
- [ ] ¿Se referencia en workflows si está en pipeline?
- [ ] ¿Se incluye en un ejemplo (al menos EJEMPLO-API-REST.md)?
- [ ] ¿Existe código fuente verificable?
- [ ] ¿Se agrega a esta matriz?

**Si no cumple todos:** El concepto no está trazable. Completar antes de liberar.

---

## Gaps detectados (SEMANA 4-5)

### Conceptos documentados pero con gaps menores

| Concepto | Gap | Prioridad | Acción |
|----------|-----|----------|--------|
| Debugging | No hay DEBUG-GUIDE.md | Media | Crear en SEMANA 5-6 |
| Performance | No hay PERFORMANCE.md | Media | Crear en SEMANA 5-6 |
| Disaster recovery | No hay DISASTER-RECOVERY.md | Baja | Crear futuro |
| Monorepos | Mencionado en USE-CASES.md | Baja | Expandir ejemplo |

**Estado:** Cobertura completa de conceptos actuales, gaps para futuras extensiones.

---

## Cómo usar esta matriz

### Para verificar cobertura
1. Elige un concepto de la matriz
2. Verifica que tiene valores ✅ en todas las columnas
3. Si falta algo: reporta el gap

### Para asegurar trazabilidad en nuevos cambios
1. Cada concepto nuevo debe completar todas las filas
2. Usar el checklist arriba
3. Actualizar esta matriz

### Para auditar documentación
1. Leer esta matriz
2. Verificar cada link
3. Validar que la documentación es consistente

---

## Mantenimiento

**Última auditoría:** 2026-06-22  
**Estado:** ✅ Completo para FORGE v4.0.0  
**Próxima auditoría:** Después de cada release mayor

**Responsable:** Principal Documentation Architect

---

## Resumen final

| Métrica | Valor | Estado |
|---------|-------|--------|
| Conceptos principales | 12 | ✅ Trazables |
| Documentos de referencia | 30+ | ✅ Funcionales |
| Cobertura promedio | 100% | ✅ Completa |
| Gaps críticos | 0 | ✅ Ninguno |
| Gaps menores | 4 | 📋 Conocidos |

**Conclusión:** ✅ Trazabilidad completa para todos los conceptos clave de FORGE v4.0.0
