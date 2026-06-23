# 📑 Índice General de FORGE v4.0.0

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
3. [Ejemplo: API REST](Ejemplo-API-REST.md) — Walkthrough completo (30-45 min)
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
5. [Ejemplo: API REST](Ejemplo-API-REST.md) — Ver arquitectura en acción (30 min)
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
3. [Ejemplo: API REST](Ejemplo-API-REST.md) — Implementación real (30 min)
4. [Configuración](configuration.md) — Stack, convenciones, calidad (15 min)
5. [Agentes: desarrollador](agents.md#desarrollador-backend) — Tu rol (5 min)

**Consulta cuando lo necesites:**
- [Troubleshooting](Troubleshooting.md) — Errores comunes
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
- [Troubleshooting](Troubleshooting.md) — Qué hacer si falla

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
- **Comandos:** Copia estructura de [commands/*.md](../FORGE/commands/), registra en plugin.json
- **Skills:** Copia estructura de [skills/*/SKILL.md](../FORGE/skills/), ¡inventa la tuya!

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
- 🛠️ [tools.md](tools.md) — 30 skills: categorización, referencias
- 📖 [Comandos-Referencia.md](Comandos-Referencia.md) — 39 comandos listados
- ⚙️ [configuration.md](configuration.md) — `sdd.config.yaml` completo
- 🔗 [api-reference.md](api-reference.md) — APIs públicas

### Nivel 5: Guías Especializadas (CÓMO hacer cosas)
- 🚀 [getting-started.md](getting-started.md) — Instalación y primeros pasos
- 📝 [EJEMPLO-API-REST.md](Ejemplo-API-REST.md) — Walkthrough completo
- 🐛 [Troubleshooting.md](Troubleshooting.md) — Errores por fase
- 🆘 [QUE-PASA-SI-FALLA.md](Que-Pasa-Si-Falla.md) — Recuperación
- 🔐 [SEGURIDAD-PARA-NOTECNICOS.md](Seguridad-Para-Notecnicos.md) — Security sin jerga
- ⚙️ [OPTIMIZACION-ENTORNO.md](Optimizacion-Entorno.md) — Tuning
- 🧠 [MEMORIA-Y-OBSERVABILIDAD.md](Memoria-Y-Observabilidad.md) — API memoria, SQLite
- 📊 [EJEMPLOS-MEMORIA-API.md](Ejemplos-Memoria-API.md) — Código JS/TS
- 🔗 [INTEGRACIONES.md](Integraciones.md) — MCP: Vercel, GitHub, Figma
- ✅ [COMPATIBILIDAD.md](Compatibilidad.md) — Contrato de hooks
- 📦 [VERIFICACION-SQLITE-AUTODETECT.md](Verificacion-SQLite-Autodetect.md) — Auto-detectión

### Nivel 6: Casos de Uso (soluciones end-to-end)
- 💡 [Casos-de-Uso.md](Casos-De-Uso.md) — Monorepos, microservicios, data pipelines
- 📚 [FABRICA.md](Fabrica.md) — Narrativas para no-técnicos
- 📊 [ANALISIS-COMPARATIVO-FRAMEWORKS.md](Analisis-Comparativo-Frameworks.md) — FORGE vs CrewAI vs LangGraph

### Nivel 7: Contribuir y Mantener (para developers de FORGE)
- 🤝 [../CONTRIBUTING.md](../CONTRIBUTING.md) — Cómo contribuir
- 🏗️ [extending-forge.md](extending-forge.md) — Crear agentes, comandos, skills
- 🧪 [TESTING-FORGE.md](Testing-FORGE.md) — Test framework
- 📢 [RELEASE-PROCESS.md](Release-Process.md) — Versioning, changelog, deploy

### Nivel 8: Especiales (investigaciones + futuro)
- 🗜️ [COMPRESION.md](Compresion.md) — Técnica caveman-lite
- 🗺️ [MAPAS.md](Mapas.md) — Estrategia de mapas estáticos
- 📊 [INFORME-MEMORIA-OSS.md](Informe-Memoria-OSS.md) — Investigación OSS
- 📋 [ESTANDAR-EJEMPLOS-CODIGO.md](Estandar-Ejemplos-Codigo.md) — Formato único ejemplos
- 🎨 [AUDITORIA-DIAGRAMAS-MERMAID.md](Auditoria-Diagramas-Mermaid.md) — Validación de diagramas

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
[Troubleshooting.md](Troubleshooting.md) tiene soluciones por fase del pipeline.

### Lee el Ejemplo completo
[EJEMPLO-API-REST.md](Ejemplo-API-REST.md) es un walkthrough paso-a-paso que toca casi todo.

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

**Última actualización:** 2026-06-22  
**Versión:** 4.0.0  
**Estado:** ✅ Completo y verificado

[Ver CHANGELOG.md](../CHANGELOG.md) para historial de cambios.

---

## 💡 Recomendaciones finales

1. **Primeira visita:** Sigue la ruta para tu rol arriba
2. **Referencia rápida:** Guarda el [GLOSARIO.md](GLOSARIO.md) para buscar términos
3. **Profundidad:** El nivel 4 (Referencia) es exhaustivo; el nivel 2-3 es introductorio
4. **Ejemplos:** [EJEMPLO-API-REST.md](Ejemplo-API-REST.md) y [EJEMPLOS-MEMORIA-API.md](Ejemplos-Memoria-API.md) son tutoriales paso-a-paso

---

**Índice preparado por:** Principal Documentation Architect  
**Fecha:** 2026-06-22  
**Versión:** 1.0  
**Estado:** ✅ Listo como punto de entrada principal
