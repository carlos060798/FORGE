# 📑 Índice General de FORGE (Fragua) 5.0.0

**Punto de entrada único a la documentación.** Versión sin publicar: el estado al día, con cifras y pendientes, está en [ESTADO-ACTUAL.md](ESTADO-ACTUAL.md).

Si buscas algo que no está aquí, mira primero en [archivo/](archivo/): contiene planes, informes y análisis que ya no describen el proyecto.

---

## 🚀 Inicio rápido por rol

### 👤 Usuario nuevo (quiero probar FORGE)

1. [Introducción](introduction.md): qué es y por qué existe (5 min)
2. [Inicio rápido](getting-started.md): instalación paso a paso (10 min)
3. [Ejemplo: API REST](EJEMPLO-API-REST.md): recorrido completo (30-45 min)
4. [Glosario](GLOSARIO.md): términos (consúltalo cuando haga falta)

**Próximo paso:** ejecuta `/sdd.descubrir "tu idea"` en Claude Code.

### 🏗️ Arquitecto (quiero diseñar el sistema)

1. [Introducción](introduction.md): contexto general
2. [Conceptos fundamentales](core-concepts.md): SDD, IR, constitución, pipeline
3. [Arquitectura](architecture.md): capas, diagramas, flujos
4. [Agentes](agents.md): los 14 agentes y sus roles
5. [Extender FORGE](extending-forge.md): personalizaciones

**Consulta también:** [Glosario](GLOSARIO.md) y [GARANTIAS-Y-LIMITES.md](GARANTIAS-Y-LIMITES.md), que dice qué garantiza cada parte y con qué prueba.

### 💻 Developer (quiero implementar)

1. [Inicio rápido](getting-started.md): instalación
2. [Flujos de trabajo](workflows.md): los comandos del pipeline
3. [Ciclo verificado](ciclo-verificado.md): cómo se da por buena una tarea
4. [Configuración](configuration.md): `sdd.config.yaml`
5. [Agentes](agents.md#desarrollador-backend): tu rol

**Consulta cuando lo necesites:** [Troubleshooting](TROUBLESHOOTING.md), [Glosario](GLOSARIO.md).

### 🚀 DevOps (quiero desplegar)

1. [Configuración](configuration.md): variables y backends
2. [Compatibilidad](COMPATIBILIDAD.md): versiones soportadas
3. [Integraciones](INTEGRACIONES.md) y [integraciones externas](integraciones-externas.md)
4. [Servidor MCP](servidor-mcp.md) y [API HTTP](api-http.md)

**Consulta también:** [Problemas conocidos](PROBLEMAS-CONOCIDOS.md) y [Qué pasa si falla](QUE-PASA-SI-FALLA.md).

### 🛠️ Contributor (quiero desarrollar FORGE)

1. [Introducción](introduction.md)
2. [Arquitectura](architecture.md) y [Runtime](runtime.md)
3. [Extender FORGE](extending-forge.md): agentes, comandos, skills
4. [Cobertura de pruebas](COBERTURA.md)

**Después:** [CONTRIBUTING.md](../CONTRIBUTING.md) para enviar cambios, [RELEASE-CHECKLIST.md](../RELEASE-CHECKLIST.md) para las condiciones de la beta y [VERSIONING.md](../VERSIONING.md) para el versionado.

---

## 📚 Mapa temático

### Introducción y conceptos
- 📍 [0-INDICE.md](0-INDICE.md): este archivo
- 🎯 [introduction.md](introduction.md): qué es FORGE y por qué existe
- 🤔 [core-concepts.md](core-concepts.md): SDD, IR, constitución, pipeline, memoria, hooks, ADRs
- 📖 [GLOSARIO.md](GLOSARIO.md): términos canónicos
- 🔗 [RELACION-CON-CLAUDE-CODE.md](RELACION-CON-CLAUDE-CODE.md): qué primitivas de Claude Code usa FORGE

### Estado, límites y garantías
- ✅ [ESTADO-ACTUAL.md](ESTADO-ACTUAL.md): cifras, qué está probado, límites y pendientes. **Fuente de referencia.**
- 🛡️ [GARANTIAS-Y-LIMITES.md](GARANTIAS-Y-LIMITES.md): qué garantiza cada parte, con su prueba
- ⚠️ [PROBLEMAS-CONOCIDOS.md](PROBLEMAS-CONOCIDOS.md): incidencias abiertas y cerradas, con su evidencia
- 🔀 [MIGRACION-5.0.md](MIGRACION-5.0.md): qué cambia al actualizar desde 4.2.0
- 📏 [COBERTURA.md](COBERTURA.md): cobertura de pruebas por archivo
- 🧪 [PRUEBAS-INDEPENDIENTES.md](PRUEBAS-INDEPENDIENTES.md): cómo comprobar FORGE instalado como paquete sobre proyectos independientes

### Arquitectura y referencia
- 🏗️ [architecture.md](architecture.md): capas, diagramas, flujos de extremo a extremo
- ⚙️ [runtime.md](runtime.md): hooks, memoria, registro de modelos
- 📋 [workflows.md](workflows.md): etapas del pipeline y flags
- 👥 [agents.md](agents.md): los 14 agentes, roles y herramientas
- 🛠️ [tools.md](tools.md): las 31 skills, por categoría
- 📂 [INVENTARIO-AGENTES-Y-SKILLS.md](INVENTARIO-AGENTES-Y-SKILLS.md): inventario generado por script
- ⚙️ [configuration.md](configuration.md): `sdd.config.yaml` completo
- 🔗 [api-reference.md](api-reference.md): APIs públicas
- ✅ [COMPATIBILIDAD.md](COMPATIBILIDAD.md): contrato de hooks

### Ciclo verificado y seguridad
- 🔁 [ciclo-verificado.md](ciclo-verificado.md): configuración, aislamiento, presupuesto, pausas
- 🧩 [puertas-de-calidad.md](puertas-de-calidad.md): puertas declarables en `sdd.config.yaml`
- 🔗 [cadena-de-evidencia.md](cadena-de-evidencia.md): registro firmado de verificaciones
- 🔐 [SEGURIDAD-PARA-NOTECNICOS.md](SEGURIDAD-PARA-NOTECNICOS.md): seguridad sin jerga
- 🆘 [QUE-PASA-SI-FALLA.md](QUE-PASA-SI-FALLA.md): recuperación

### Integraciones y servidores
- 🔌 [servidor-mcp.md](servidor-mcp.md): servidor MCP
- 🧾 [mcp-verificar.md](mcp-verificar.md): perfil `verificacion` del servidor MCP
- 🌐 [api-http.md](api-http.md): API HTTP local
- 🔗 [INTEGRACIONES.md](INTEGRACIONES.md): MCPs de Vercel, GitHub y Figma
- 🎫 [integraciones-externas.md](integraciones-externas.md): GitHub, GitLab y Jira, apagadas por defecto
- 🧠 [memoria-semantica.md](memoria-semantica.md): índice de memoria por agente
- 🧭 [guia-anadir-proveedor.md](guia-anadir-proveedor.md): cómo añadir un proveedor de modelos

### Guías y ejemplos
- 🚀 [getting-started.md](getting-started.md): instalación y primeros pasos
- 🧰 [FORGE-5.0-GUIA.md](FORGE-5.0-GUIA.md): para qué sirve la 5.0 y qué trae
- 📝 [EJEMPLO-API-REST.md](EJEMPLO-API-REST.md): recorrido completo
- 📚 [examples.md](examples.md): ejemplos de extremo a extremo
- 🐛 [TROUBLESHOOTING.md](TROUBLESHOOTING.md): errores por fase
- 🧱 [extending-forge.md](extending-forge.md): crear agentes, comandos y skills

### Mercado y público
- 🗺️ [MERCADO-CLASIFICACION.md](MERCADO-CLASIFICACION.md): en qué categoría se sitúa FORGE
- 👥 [PUBLICO-OBJETIVO.md](PUBLICO-OBJETIVO.md): a quién va dirigido y con qué pruebas
- 🧩 [ADECUACION-DEL-CATALOGO.md](ADECUACION-DEL-CATALOGO.md): plan para el catálogo de agentes y skills
- 📚 [FABRICA.md](FABRICA.md): narrativa para no técnicos (pendiente de revisar sus nombres antiguos)

### Contribuir y publicar
- 🤝 [../CONTRIBUTING.md](../CONTRIBUTING.md): cómo contribuir
- 📢 [../RELEASE-CHECKLIST.md](../RELEASE-CHECKLIST.md): condiciones de la beta y registro de pasadas
- 🔖 [../VERSIONING.md](../VERSIONING.md): versionado
- 📜 [../CHANGELOG.md](../CHANGELOG.md): historial de cambios

### Archivo
- 🗄️ [archivo/](archivo/): planes, informes y análisis superados, con el motivo de cada uno. Se conservan como historia.

---

## 🎯 Búsqueda por tema

| Tema | Documento |
|------|-----------|
| SDD (Spec-Driven Development) | [core-concepts.md](core-concepts.md) |
| Pipeline completo | [workflows.md](workflows.md) |
| Agentes disponibles | [agents.md](agents.md) |
| Skills disponibles | [tools.md](tools.md) |
| Configuración | [configuration.md](configuration.md) |
| Seguridad | [SEGURIDAD-PARA-NOTECNICOS.md](SEGURIDAD-PARA-NOTECNICOS.md), [GARANTIAS-Y-LIMITES.md](GARANTIAS-Y-LIMITES.md) |
| Qué está probado y qué no | [ESTADO-ACTUAL.md](ESTADO-ACTUAL.md) |
| Despliegue | [workflows.md](workflows.md) |
| Troubleshooting | [TROUBLESHOOTING.md](TROUBLESHOOTING.md) |
| Integraciones | [INTEGRACIONES.md](INTEGRACIONES.md), [integraciones-externas.md](integraciones-externas.md) |
| Crear agente o skill | [extending-forge.md](extending-forge.md) |

---

## 📖 Convenciones

- **Enlaces internos:** apuntan a documentos de esta carpeta o del repositorio. `tests/consistencia-cifras.test.js` comprueba que existan.
- **Rutas de archivo:** relativas a `FORGE/`.
- **Cifras:** las de agentes, skills y comandos se cuentan contra el disco en cada prueba. Las de pruebas y tipos están en [ESTADO-ACTUAL.md](ESTADO-ACTUAL.md).

---

## 🔄 Actualización

**Última actualización:** 2026-10-24 · **Versión:** 5.0.0 (sin publicar) · **Historial:** [../CHANGELOG.md](../CHANGELOG.md)

> FORGE pasa a llamarse **Fragua** (paquete `fragua`). Los documentos conservan el nombre con el que se escribieron; la equivalencia está en el README.
