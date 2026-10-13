# 📑 Índice General de FORGE v5.0.0

**Punto de entrada único a toda la documentación de FORGE**

Bienvenido a FORGE. Este índice te ayuda a encontrar exactamente lo que necesitas según tu rol y objetivo.

---

## 🚀 Inicio rápido por rol

Elige tu rol para obtener una ruta de lectura personalizada:

### 👤 Usuario nuevo (quiero probar FORGE)

**Objetivo:** Instalar FORGE e implementar mi primer proyecto  
**Tiempo:** 1-2 horas  
**Ruta de lectura:**

1. [Introducción](introduction.md) — Qué es FORGE y por qué existe (5 min)
2. [Inicio rápido](getting-started.md) — Instalación paso-a-paso (10 min)
3. [Ejemplo: API REST](EJEMPLO-API-REST.md) — Walkthrough completo (30-45 min)
4. [Glosario](GLOSARIO.md) — Referencia rápida de términos (consúltalo cuando sea necesario)

**Próximo paso:** Ejecuta `/sdd.descubrir "tu idea"` en Claude Code

---

### 🏗️ Arquitecto (quiero diseñar el sistema)

**Objetivo:** Entender la arquitectura y tomar decisiones técnicas informadas  
**Tiempo:** 2-4 horas  
**Ruta de lectura:**

1. [Introducción](introduction.md) — Contexto general (5 min)
2. [Conceptos fundamentales](core-concepts.md) — SDD, IR, Constitución, Pipeline (20 min)
3. [Arquitectura](architecture.md) — 6 capas, diagramas, flujos (30 min)
4. [Agentes](agents.md) — Los 14 agentes y sus roles (15 min)
5. [Ejemplo: API REST](EJEMPLO-API-REST.md) — Ver arquitectura en acción (30 min)
6. [Extender FORGE](extending-forge.md) — Customizaciones (15 min)

**Consulta también:**
- [Glosario](GLOSARIO.md) — Definiciones precisas
- [ADRs en .sdd/arquitectura/](architecture.md) — Decisiones registradas

**Próximo paso:** Lee los requisitos de tu proyecto, luego llama al arquitecto en FORGE

---

### 💻 Developer (quiero implementar)

**Objetivo:** Escribir código que pase verificación  
**Tiempo:** 1-2 horas  
**Ruta de lectura:**

1. [Inicio rápido](getting-started.md) — Instalación (10 min)
2. [Flujos de trabajo](workflows.md) — 8 comandos del pipeline (20 min)
3. [Ejemplo: API REST](EJEMPLO-API-REST.md) — Implementación real (30 min)
4. [Configuración](configuration.md) — Stack, convenciones, calidad (15 min)
5. [Agentes: desarrollador](agents.md#desarrollador-backend) — Tu rol (5 min)

**Consulta cuando lo necesites:**
- [Troubleshooting](TROUBLESHOOTING.md) — Errores comunes
- [Glosario](GLOSARIO.md) — Términos técnicos

**Próximo paso:** Espera a que FORGE genere tareas, luego implementa

---

### 🚀 DevOps (quiero desplegar)

**Objetivo:** Configurar CI/CD y desplegar a producción  
**Tiempo:** 1-2 horas  
**Ruta de lectura:**

1. [Configuración](configuration.md) — Variables y backends (15 min)
2. [Compatibilidad](COMPATIBILIDAD.md) — Versiones soportadas (5 min)
3. [Optimización del entorno](OPTIMIZACION-ENTORNO.md) — Env vars recomendadas (10 min)
4. [Integraciones](INTEGRACIONES.md) — Vercel, GitHub, Figma status (15 min)
5. [Workflows: Despliegue](workflows.md#etapa-10--despliegue) — Comando `/sdd.desplegar` (10 min)

**Consulta también:**
- [Observabilidad y memoria](MEMORIA-Y-OBSERVABILIDAD.md) — Monitoring
- [Troubleshooting](TROUBLESHOOTING.md) — Qué hacer si falla

**Próximo paso:** Configura FORGE para tu infraestructura

---

### 🛠️ Contributor (quiero desarrollar FORGE)

**Objetivo:** Entender cómo funciona FORGE internamente y contribuir  
**Tiempo:** 3-5 horas  
**Ruta de lectura:**

1. [Introducción](introduction.md) — Qué es FORGE (5 min)
2. [Conceptos fundamentales](core-concepts.md) — SDD + IR + Estado (20 min)
3. [Arquitectura](architecture.md) — 6 capas + componentes (30 min)
4. [Runtime](runtime.md) — Hooks + Memory + Model registry (20 min)
5. [Extender FORGE](extending-forge.md) — Crear agentes, comandos, skills (30 min)

**Después, elige tu área:**
- **Agentes:** Lee [agents.md](agents.md), luego crea uno con `/sdd.crear-agente`
- **Comandos:** Copia estructura de [commands/*.md](../commands/), registra en plugin.json
- **Skills:** Copia estructura de [skills/*/SKILL.md](../skills/), ¡inventa la tuya!

**Próximo paso:** [CONTRIBUTING.md](../CONTRIBUTING.md) — Cómo enviar PRs

---

## 📚 Mapa temático completo

### Nivel 1: Índices y Glosarios
- 📍 [0-INDICE.md](0-INDICE.md) — Este archivo (punto de entrada)
- 📖 [GLOSARIO.md](GLOSARIO.md) — 12+ términos canónicos

### Nivel 2: Introducciones (QUÉ es FORGE)
- 🎯 [introduction.md](introduction.md) — Qué es FORGE y por qué existe
- 🤔 [core-concepts.md](core-concepts.md) — SDD, IR, Constitución, Pipeline, Memoria, Hooks, ADRs

### Nivel 3: Arquitectura (CÓMO funciona)
- 🏗️ [architecture.md](architecture.md) — 6 capas, diagramas, flujos end-to-end
- ⚙️ [runtime.md](runtime.md) — Hooks, Memory, Model registry, observabilidad
- 🔌 [Extensiones internas](architecture.md) — APIs internas, ProjectMemory

### Nivel 4: Referencia (REFERENCIA exhaustiva)
- 📋 [workflows.md](workflows.md) — 8 etapas del pipeline documentadas
- 👥 [agents.md](agents.md) — 14 agentes: roles, herramientas, etapas
- 🛠️ [tools.md](tools.md) — 31 skills: categorización, referencias
- 📖 [commands/](../commands/) — 39 comandos, uno por archivo `.md`
- ⚙️ [configuration.md](configuration.md) — `sdd.config.yaml` completo
- 🔗 [api-reference.md](api-reference.md) — APIs públicas

### Nivel 5: Guías Especializadas (CÓMO hacer cosas)
- 🚀 [getting-started.md](getting-started.md) — Instalación y primeros pasos
- 🔁 [ciclo-verificado.md](ciclo-verificado.md) — El ciclo verificado: configuración, aislamiento, presupuesto, pausas
- ⚠️ [PROBLEMAS-CONOCIDOS.md](PROBLEMAS-CONOCIDOS.md) — Límites conocidos, con cómo evitarlos y dónde está la evidencia
- 🔀 [MIGRACION-5.0.md](MIGRACION-5.0.md) — Qué cambia al actualizar desde 4.2.0
- 📏 [COBERTURA.md](COBERTURA.md) — Cobertura de pruebas por archivo
- 📝 [EJEMPLO-API-REST.md](EJEMPLO-API-REST.md) — Walkthrough completo
- 🐛 [Troubleshooting.md](TROUBLESHOOTING.md) — Errores por fase
- 🆘 [QUE-PASA-SI-FALLA.md](QUE-PASA-SI-FALLA.md) — Recuperación
- 🔐 [SEGURIDAD-PARA-NOTECNICOS.md](SEGURIDAD-PARA-NOTECNICOS.md) — Security sin jerga
- ⚙️ [OPTIMIZACION-ENTORNO.md](OPTIMIZACION-ENTORNO.md) — Tuning
- 🧠 [MEMORIA-Y-OBSERVABILIDAD.md](MEMORIA-Y-OBSERVABILIDAD.md) — API memoria, SQLite
- 📊 [EJEMPLOS-MEMORIA-API.md](EJEMPLOS-MEMORIA-API.md) — Código JS/TS
- 🔗 [INTEGRACIONES.md](INTEGRACIONES.md) — MCP: Vercel, GitHub, Figma
- 🔌 [integraciones-externas.md](integraciones-externas.md) — GitHub, GitLab y Jira: leer incidencias y publicar resultados con aprobación (en construcción)
- [PRUEBAS-INDEPENDIENTES.md](PRUEBAS-INDEPENDIENTES.md): cómo comprobar FORGE instalado como paquete sobre proyectos independientes.
- ✅ [COMPATIBILIDAD.md](COMPATIBILIDAD.md) — Contrato de hooks
- 📦 [VERIFICACION-SQLITE-AUTODETECT.md](VERIFICACION-SQLITE-AUTODETECT.md) — Auto-detectión

### Nivel 6: Casos de Uso (soluciones end-to-end)
- 📚 [FABRICA.md](FABRICA.md) — Narrativas para no-técnicos
- 📊 [ANALISIS-COMPARATIVO-FRAMEWORKS.md](ANALISIS-COMPARATIVO-FRAMEWORKS.md) — FORGE vs CrewAI vs LangGraph

### Nivel 7: Contribuir y Mantener (para developers de FORGE)
- 🤝 [../CONTRIBUTING.md](../CONTRIBUTING.md) — Cómo contribuir
- 🏗️ [extending-forge.md](extending-forge.md) — Crear agentes, comandos, skills
- 🧪 [COBERTURA.md](COBERTURA.md) — Cobertura de pruebas por archivo
- 📢 [RELEASE-CHECKLIST.md](../RELEASE-CHECKLIST.md) — Lista de release y criterios de beta
- 🔖 [VERSIONING.md](../VERSIONING.md) — Versionado

### Nivel 8: Especiales (investigaciones + futuro)
- 🗜️ [COMPRESION.md](COMPRESION.md) — Técnica caveman-lite
- 🗺️ [MAPAS.md](MAPAS.md) — Estrategia de mapas estáticos
- 📊 [INFORME-MEMORIA-OSS.md](INFORME-MEMORIA-OSS.md) — Investigación OSS
- 📋 [ESTANDAR-EJEMPLOS-CODIGO.md](ESTANDAR-EJEMPLOS-CODIGO.md) — Formato único ejemplos

---

## 🎯 Búsqueda por tema

¿Buscas información sobre un tema específico? Usa esta tabla:

| Tema | Documento | Ubicación |
|------|-----------|-----------|
| **SDD (Spec-Driven Development)** | core-concepts.md | Nivel 2 |
| **IR (Interpreted Requirement)** | core-concepts.md | Nivel 2 |
| **Pipeline completo** | workflows.md | Nivel 4 |
| **Agentes disponibles** | agents.md | Nivel 4 |
| **Skills disponibles** | tools.md | Nivel 4 |
| **Configuración** | configuration.md | Nivel 4 |
| **Seguridad** | SEGURIDAD-PARA-NOTECNICOS.md | Nivel 5 |
| **Memoria persistente** | MEMORIA-Y-OBSERVABILIDAD.md | Nivel 5 |
| **Despliegue** | workflows.md#etapa-10 | Nivel 4 |
| **Troubleshooting** | Troubleshooting.md | Nivel 5 |
| **Ejemplos de código** | EJEMPLOS-MEMORIA-API.md | Nivel 5 |
| **Integraciones (MCP)** | INTEGRACIONES.md | Nivel 5 |
| **Crear agente personalizado** | extending-forge.md | Nivel 7 |
| **Crear skill personalizada** | extending-forge.md | Nivel 7 |
| **Comparativa de frameworks** | ANALISIS-COMPARATIVO-FRAMEWORKS.md | Nivel 6 |

---

## ❓ No encuentras lo que buscas?

### Busca en el Glosario
[GLOSARIO.md](GLOSARIO.md) tiene definiciones de 12+ términos clave. Si un término te parece ambiguo, búscalo allí.

### Consulta Troubleshooting
[Troubleshooting.md](TROUBLESHOOTING.md) tiene soluciones por fase del pipeline.

### Lee el Ejemplo completo
[EJEMPLO-API-REST.md](EJEMPLO-API-REST.md) es un walkthrough paso-a-paso que toca casi todo.

### Revisa Architecture
[architecture.md](architecture.md) tiene diagramas detallados de cómo funciona FORGE por dentro.

---

## 📖 Convenciones de esta documentación

- 🔗 **Links internos:** Siempre apuntan a documentos en esta carpeta o repo
- 📁 **Rutas de archivo:** Relativas a `FORGE/`
- 💻 **Ejemplos de código:** Verificados contra APIs documentadas
- 📊 **Diagramas:** Mermaid v10.6+ (100% válidos)
- 🏷️ **Etiquetas:** Cada sección tiene [GLOSARIO.md](GLOSARIO.md) referencias para términos clave

---

## 🔄 Actualización de documentación

Esta documentación se mantiene con cada versión de FORGE.

**Última actualización:** 2026-10-12  
**Versión:** 5.0.0 (sin publicar)  
**Estado:** los enlaces de este índice los comprueba `tests/consistencia-cifras.test.js`

[Ver CHANGELOG.md](../CHANGELOG.md) para historial de cambios.

---

## 💡 Recomendaciones finales

1. **Primeira visita:** Sigue la ruta para tu rol arriba
2. **Referencia rápida:** Guarda el [GLOSARIO.md](GLOSARIO.md) para buscar términos
3. **Profundidad:** El nivel 4 (Referencia) es exhaustivo; el nivel 2-3 es introductorio
4. **Ejemplos:** [EJEMPLO-API-REST.md](EJEMPLO-API-REST.md) y [EJEMPLOS-MEMORIA-API.md](EJEMPLOS-MEMORIA-API.md) son tutoriales paso-a-paso

---

**Índice preparado por:** Principal Documentation Architect  
**Fecha:** 2026-06-22  
**Versión:** 1.0  
**Estado:** ✅ Listo como punto de entrada principal
