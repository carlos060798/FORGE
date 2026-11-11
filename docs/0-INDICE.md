# Índice de la documentación de Fragua (antes FORGE) 5.0.0-beta.1

**Punto de entrada único.** Versión sin publicar: el estado al día, con cifras, qué está probado y qué no, está en [ESTADO-ACTUAL.md](ESTADO-ACTUAL.md).

La documentación sigue el marco [Diátaxis](https://diataxis.fr/): cada documento es de **un** tipo, y lo dice en su cabecera.

| Tipo | Para qué sirve | Cuándo ir ahí |
|---|---|---|
| **Tutorial** | Aprender haciendo, de la mano | «Nunca lo he usado» |
| **Guía** | Resolver una tarea concreta | «Quiero hacer X» |
| **Referencia** | Datos exactos, sin explicar | «¿Cuál era la opción / clave / código?» |
| **Explicación** | Entender el porqué | «¿Por qué funciona así?» |

Si buscas algo que no está aquí, mira en [archivo/](archivo/): planes, informes y análisis superados, conservados como historia.

---

## Tutoriales: empezar

1. [PRIMEROS-15-MINUTOS.md](PRIMEROS-15-MINUTOS.md): una página, de la instalación a la primera tarea verificada.
2. [getting-started.md](getting-started.md): lo mismo con más detalle, incluido el perfil completo.
3. [EJEMPLO-API-REST.md](EJEMPLO-API-REST.md): recorrido completo de una API (30 a 45 minutos).
4. [examples.md](examples.md): ejemplos de extremo a extremo.

## Guías: resolver una tarea

| Quiero… | Lee |
|---|---|
| Configurar el proyecto (`sdd.config.yaml`) | [configuration.md](configuration.md) |
| Elegir perfil de instalación o preset | [configuration.md](configuration.md), [MIGRACION-5.0.md](MIGRACION-5.0.md) |
| Instalar en otra herramienta (Cursor, Copilot, Gemini…) | [FORGE-5.0-GUIA.md](FORGE-5.0-GUIA.md) |
| Añadir un agente, comando o skill | [extending-forge.md](extending-forge.md) |
| Añadir un proveedor de modelos | [guia-anadir-proveedor.md](guia-anadir-proveedor.md) |
| Declarar puertas de calidad | [puertas-de-calidad.md](puertas-de-calidad.md) |
| Conectar GitHub, GitLab o Jira | [integraciones-externas.md](integraciones-externas.md), [INTEGRACIONES.md](INTEGRACIONES.md) |
| Usar Fragua desde otro agente por MCP | [servidor-mcp.md](servidor-mcp.md), [mcp-verificar.md](mcp-verificar.md) |
| Migrar desde 4.2.0 | [MIGRACION-5.0.md](MIGRACION-5.0.md) |
| Recuperarme de un fallo | [QUE-PASA-SI-FALLA.md](QUE-PASA-SI-FALLA.md), [TROUBLESHOOTING.md](TROUBLESHOOTING.md) |
| Comprobar Fragua sobre proyectos independientes | [PRUEBAS-INDEPENDIENTES.md](PRUEBAS-INDEPENDIENTES.md) |
| Contar un uso real | [uso-real/PLANTILLA.md](uso-real/PLANTILLA.md) |
| Contribuir al proyecto | [../CONTRIBUTING.md](../CONTRIBUTING.md) |

## Referencia: datos exactos

- [referencia-cli.md](referencia-cli.md): todos los subcomandos, opciones, códigos de salida y variables de entorno.
- [configuration.md](configuration.md): todas las claves de `sdd.config.yaml`.
- [agents.md](agents.md): los 14 agentes, roles y herramientas.
- [tools.md](tools.md): las 31 skills, por categoría. [INVENTARIO-AGENTES-Y-SKILLS.md](INVENTARIO-AGENTES-Y-SKILLS.md): inventario generado por script.
- [workflows.md](workflows.md): etapas del pipeline y sus flags.
- [api-reference.md](api-reference.md): las APIs públicas del paquete.
- [api-http.md](api-http.md) y [servidor-mcp.md](servidor-mcp.md): la API HTTP local y el servidor MCP.
- [hooks.md](hooks.md): los 8 hooks, qué se registra, requisito de Node. [COMPATIBILIDAD.md](COMPATIBILIDAD.md): contrato de hooks.
- [contrato/](contrato/): esquemas versionados de los formatos públicos.
- [GLOSARIO.md](GLOSARIO.md): términos canónicos.
- [../CHANGELOG.md](../CHANGELOG.md) y [../VERSIONING.md](../VERSIONING.md): cambios y política de versiones.

## Explicación: entender el porqué

- [introduction.md](introduction.md): qué es y por qué existe.
- [core-concepts.md](core-concepts.md): SDD, IR, constitución, pipeline, memoria, hooks, ADR.
- [architecture.md](architecture.md): capas, diagramas, flujos de extremo a extremo.
- [mapa-de-modulos.md](mapa-de-modulos.md): qué hace cada directorio y cada módulo clave, y dónde se extiende.
- [runtime.md](runtime.md): hooks, memoria y registro de modelos en ejecución.
- [ciclo-verificado.md](ciclo-verificado.md): aislamiento, presupuesto, pausas y por qué decide el código de salida.
- [cadena-de-evidencia.md](cadena-de-evidencia.md): registro firmado de verificaciones.
- [memoria-semantica.md](memoria-semantica.md): índice de memoria por agente.
- [ANFITRIONES.md](ANFITRIONES.md): qué recibe Claude Code y qué recibe cada otra herramienta de código.
- [RELACION-CON-CLAUDE-CODE.md](RELACION-CON-CLAUDE-CODE.md): puntero a ANFITRIONES.md.
- Decisiones de arquitectura: [../.sdd/arquitectura/](../.sdd/arquitectura/) (un ADR por decisión). Especificaciones: [../.sdd/INDICE.md](../.sdd/INDICE.md).

## Estado, garantías y límites

- ✅ [ESTADO-ACTUAL.md](ESTADO-ACTUAL.md): cifras, qué está probado, límites y pendientes. **Fuente de referencia.**
- 🛡️ [GARANTIAS-Y-LIMITES.md](GARANTIAS-Y-LIMITES.md): qué garantiza cada parte y con qué prueba.
- ⚠️ [PROBLEMAS-CONOCIDOS.md](PROBLEMAS-CONOCIDOS.md) y [limitations.md](limitations.md): incidencias y límites.
- 🔐 [SEGURIDAD-PARA-NOTECNICOS.md](SEGURIDAD-PARA-NOTECNICOS.md) y [../SECURITY.md](../SECURITY.md): seguridad sin jerga y cómo reportar.
- 📏 [COBERTURA.md](COBERTURA.md): cobertura de pruebas por archivo.
- 🗺️ [roadmap.md](roadmap.md): hacia dónde va.
- [USO-EN-OTRAS-HERRAMIENTAS.md](USO-EN-OTRAS-HERRAMIENTAS.md): cómo instalar y usar Fragua desde Codex, Cursor, Copilot, Gemini y otras, con lo que recibe y lo que no.
- [PLAN-AGNOSTICO.md](PLAN-AGNOSTICO.md): diagnóstico de qué sigue amarrado a Claude Code (comandos, agentes, hooks) y plan por fases para que otras herramientas reciban lo mismo. Plan sin aprobar; F1 a F3 implementadas, F5 (prueba manual por herramienta) pendiente.

## Comunidad y gobierno

[../CONTRIBUTING.md](../CONTRIBUTING.md) · [../CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md) · [../SUPPORT.md](../SUPPORT.md) · [../GOVERNANCE.md](../GOVERNANCE.md) · [../RELEASE-CHECKLIST.md](../RELEASE-CHECKLIST.md)

## Contexto de mercado

- [MERCADO-CLASIFICACION.md](MERCADO-CLASIFICACION.md): en qué categoría se sitúa.
- [PUBLICO-OBJETIVO.md](PUBLICO-OBJETIVO.md): a quién va dirigido y con qué pruebas.
- [ADECUACION-DEL-CATALOGO.md](ADECUACION-DEL-CATALOGO.md): plan para el catálogo de agentes y skills.
- [FABRICA.md](FABRICA.md): narrativa para no técnicos (pendiente de revisar sus nombres antiguos).

---

## Convenciones

- **Enlaces internos:** apuntan a documentos de esta carpeta o del repositorio. `tests/consistencia-cifras.test.js` comprueba que existan.
- **Rutas de archivo:** relativas a la raíz del repositorio.
- **Cifras:** las de agentes, skills y comandos se cuentan contra el disco en cada prueba. Las de pruebas y tipos están en [ESTADO-ACTUAL.md](ESTADO-ACTUAL.md).
- **Cabecera de cada documento técnico:** tipo (Diátaxis) y fecha de la última revisión contra un commit.

---

**Última actualización:** 2026-11-10 · **Versión:** 5.0.0-beta.1 (sin publicar) · **Historial:** [../CHANGELOG.md](../CHANGELOG.md)

> FORGE pasa a llamarse **Fragua** (paquete `fragua`). Los documentos conservan el nombre con el que se escribieron; la equivalencia está en el README.
