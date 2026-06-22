<div align="center">

# FORGE

**Desarrollo Guiado por Especificaciones para Claude Code**

*De una idea en lenguaje natural a producción — un comando a la vez.*

[![Versión](https://img.shields.io/badge/versión-4.0.0-blue)](CHANGELOG.md)
[![Licencia](https://img.shields.io/badge/licencia-MIT-green)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](package.json)
[![Tests](https://img.shields.io/badge/tests-848%20pasando-brightgreen)](tests/)

</div>

---

FORGE es un **framework de Desarrollo Guiado por Especificaciones (SDD)** que corre dentro de [Claude Code](https://claude.ai/code). Convierte una idea en lenguaje natural en un producto implementado, probado y desplegado, orquestando un equipo de 14 agentes especializados a través de un pipeline estructurado de 38 comandos.

```
Tú: "Necesito una API REST con autenticación JWT y PostgreSQL"

FORGE:
  ✦ Descubre requisitos     → ir.json
  ✦ Diseña el producto      → product-design.json
  ✦ Genera la especificación → spec.md (con criterios de aceptación)
  ✦ Planifica               → plan.md + tareas.md
  ✦ Ejecuta con agentes     → backend, tester, revisor, seguridad
  ✦ Verifica contra la spec → verificacion.json
  ✦ Despliega               → health check pasado ✓
```

---

## ¿Por qué FORGE?

| Sin FORGE | Con FORGE |
|---|---|
| Cada sesión de Claude empieza en blanco | Estado persistente entre sesiones vía `.sdd/` |
| Sin memoria de decisiones anteriores | Memoria de agentes + ADRs registran cada decisión |
| Coordinación manual de tareas | 14 agentes orquestados automáticamente |
| Sin límites sobre qué toca Claude | Restricciones constitucionales + guardia pre-tool |
| Cada prompt puede reescribir todo | Ejecución con checkpoints, reanudable en cualquier punto |
| Sin visibilidad de lo que ocurrió | Dashboard de observabilidad en `localhost:3001` |

---

## Inicio rápido

```bash
# Instalar en tu proyecto
npx forge-sdd init

# Comenzar desde una idea en lenguaje natural
/forge

# O saltar directamente al pipeline
/sdd.descubrir construir un SaaS multi-tenant con Stripe
```

→ Ver la [Guía de inicio](docs/getting-started.md) para un recorrido completo.

---

## Cómo funciona

FORGE implementa un **pipeline de 10 etapas** que mapea directamente el proceso de un equipo profesional de software:

```
idea → descubrimiento → IR → diseño → spec → plan → tareas → código → verificación → despliegue
```

Cada etapa produce un **artefacto duradero** almacenado en el directorio `.sdd/` del proyecto. Las etapas son reanudables: si una sesión termina a mitad de la implementación, `/sdd.implementar continuar` retoma exactamente donde se quedó.

→ Ver [Arquitectura](docs/architecture.md) para el diagrama completo del sistema.

---

## Instalación

### Requisitos

- Node.js ≥ 18.0.0
- [Claude Code](https://claude.ai/code) (CLI o aplicación de escritorio)

### Instalación en proyecto

```bash
npx forge-sdd init
```

Copia comandos, agentes, skills y hooks en el directorio `.claude/` del proyecto y crea un `sdd.config.yaml` con valores predeterminados.

### Instalación global

```bash
npx forge-sdd init --global
```

Disponibiliza FORGE en todos los proyectos de la máquina.

### Configuración guiada (recomendada para nuevos usuarios)

```bash
npx forge-sdd init --guided
```

Asistente interactivo: pregunta sobre tu perfil, stack, destino de despliegue y nivel de modelo preferido, luego genera un `sdd.config.yaml` preconfigurado.

### Presets

```bash
npx forge-sdd init --preset lean        # mínimo, bajo costo
npx forge-sdd init --preset startup     # equilibrado, estándar
npx forge-sdd init --preset enterprise  # máximas verificaciones de calidad
```

---

## El pipeline de un vistazo

| Etapa | Comando | Salida |
|-------|---------|--------|
| Descubrimiento | `/sdd.descubrir` | Captura estructurada de intención |
| Interpretación | `/sdd.interpretar` | `ir.json` — IR con puntuación de confianza |
| Diseño | `/sdd.diseñar` | `product-design.json` — pantallas, stack |
| Especificación | `/sdd.especificar` | `spec.md` — criterios de aceptación |
| Aclaración | `/sdd.aclarar` | Ambigüedades resueltas |
| Planificación | `/sdd.planificar` | `plan.md` — plan técnico |
| Desglose de tareas | `/sdd.tareas` | `tareas.md` — tareas atómicas con agentes |
| Implementación | `/sdd.implementar` | Código, tests, commits |
| Verificación | `/sdd.verificar` | `verificacion.json` — pasa/falla |
| Despliegue | `/sdd.desplegar` | Endpoint activo + health check |

→ Ver [Flujos de trabajo](docs/workflows.md) para documentación detallada de cada etapa.

---

## Agentes

FORGE despacha trabajo a 14 agentes especializados. Cada agente tiene un rol fijo, un modelo configurado y acceso solo a las herramientas que necesita.

| Nivel | Agentes | Modelo predeterminado |
|-------|---------|----------------------|
| Estratégico | `arquitecto`, `critico`, `revisor`, `seguridad` | Claude Opus |
| Diseño | `product-designer`, `asesor-datos` | Claude Opus |
| Implementación | `desarrollador-backend`, `desarrollador-frontend`, `tester`, `operaciones` | Claude Sonnet |
| Soporte | `disenador-api`, `architecture-designer`, `investigador`, `documentador` | Claude Sonnet |

→ Ver [Agentes](docs/agents.md) para perfiles completos.

---

## Configuración

Todo el comportamiento de FORGE se controla desde `.sdd/sdd.config.yaml`:

```yaml
perfil: guiado          # guiado | experto

agentes:
  arquitecto:
    activo: true
    modelo: opus

calidad:
  cobertura_tests_minima: 80
  longitud_funcion_maxima: 40

memoria:
  backend: markdown     # markdown | sqlite (requiere Node ≥22.5)
  umbral_bytes: 50000
```

→ Ver [Configuración](docs/configuration.md) para todas las opciones.

---

## Observabilidad

```bash
forge ui            # abre el dashboard en localhost:3001
forge ui --port 4000
```

El dashboard muestra el estado en vivo del pipeline, agentes activos, progreso de tareas y línea de tiempo de actividad, todo desde `.sdd/` sin ningún servicio externo.

---

## Extender FORGE

FORGE está diseñado para extenderse sin modificar su núcleo:

- **Agentes personalizados** — `/sdd.crear-agente` genera un nuevo agente en `agents/`
- **Comandos personalizados** — añade archivos `.md` a `commands/` y regístralos en `plugin.json`
- **Skills personalizadas** — añade un `SKILL.md` a `skills/tu-skill/`
- **Hooks propios** — añade `antes_*.sh` / `despues_*.sh` a `.sdd/hooks/`

→ Ver [Extender FORGE](docs/extending-forge.md).

---

## Documentación

### Documentación principal

| Documento | Descripción |
|-----------|-------------|
| [Introducción](docs/introduction.md) | Qué es FORGE y por qué existe |
| [Inicio rápido](docs/getting-started.md) | Primera ejecución, recorrido guiado |
| [Arquitectura](docs/architecture.md) | Diseño del sistema, capas, diagramas |
| [Conceptos fundamentales](docs/core-concepts.md) | SDD, IR, pipeline, estado, memoria |
| [Runtime](docs/runtime.md) | Hooks, guardias, memoria, registro de modelos |
| [Agentes](docs/agents.md) | Los 14 agentes, roles, modelos, herramientas |
| [Herramientas](docs/tools.md) | Biblioteca de skills — las 29 skills |
| [Flujos de trabajo](docs/workflows.md) | Etapas del pipeline, flags, ejemplos |
| [Configuración](docs/configuration.md) | Referencia de sdd.config.yaml |
| [Extender FORGE](docs/extending-forge.md) | Agentes, comandos y hooks personalizados |
| [Referencia de API](docs/api-reference.md) | CLI, ProjectMemory, tipos IR |
| [Limitaciones](docs/limitations.md) | Restricciones conocidas y compromisos de diseño |
| [Ejemplos](docs/examples.md) | Recorridos completos de extremo a extremo |
| [Hoja de ruta](docs/roadmap.md) | Lo que viene a continuación |

### Guías especializadas

| Documento | Descripción |
|-----------|-------------|
| [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Errores por fase con solución paso a paso |
| [EJEMPLO-API-REST.md](docs/EJEMPLO-API-REST.md) | Walkthrough detallado API REST + JWT + PostgreSQL |
| [MEMORIA-Y-OBSERVABILIDAD.md](docs/MEMORIA-Y-OBSERVABILIDAD.md) | API de memoria persistente, SQLite, compresión |
| [EJEMPLOS-MEMORIA-API.md](docs/EJEMPLOS-MEMORIA-API.md) | Código JS/TS para interactuar con la API de memoria |
| [QUICK-REFERENCE-API-MEMORIA.md](docs/QUICK-REFERENCE-API-MEMORIA.md) | Referencia rápida de consultas de memoria |
| [RELACION-CON-CLAUDE-CODE.md](docs/RELACION-CON-CLAUDE-CODE.md) | Mapping explícito FORGE ↔ primitivas nativas de Claude Code |
| [COMPATIBILIDAD.md](docs/COMPATIBILIDAD.md) | Contrato de hooks — versiones verificadas |
| [VERIFICACION-SQLITE-AUTODETECT.md](docs/VERIFICACION-SQLITE-AUTODETECT.md) | Auto-detección SQLite con Node ≥22.5 |
| [MAPAS.md](docs/MAPAS.md) | Estrategia de mapas estáticos — ahorro 50-65k tokens/sesión |
| [COMPRESION.md](docs/COMPRESION.md) | Técnica caveman-lite de compresión de tokens |
| [OPTIMIZACION-ENTORNO.md](docs/OPTIMIZACION-ENTORNO.md) | Variables de entorno recomendadas |
| [INTEGRACIONES.md](docs/INTEGRACIONES.md) | Estado de MCPs: Vercel, GitHub, Figma |
| [SEGURIDAD-PARA-NOTECNICOS.md](docs/SEGURIDAD-PARA-NOTECNICOS.md) | Seguridad explicada sin jerga técnica |
| [QUE-PASA-SI-FALLA.md](docs/QUE-PASA-SI-FALLA.md) | Recuperación cuando algo sale mal |
| [ANALISIS-COMPARATIVO-FRAMEWORKS.md](docs/ANALISIS-COMPARATIVO-FRAMEWORKS.md) | FORGE vs CrewAI vs LangGraph — comparativa 10 dimensiones |
| [FABRICA.md](docs/FABRICA.md) | Casos de uso reales — narrativa para no-técnicos |
| [INFORME-MEMORIA-OSS.md](docs/INFORME-MEMORIA-OSS.md) | Investigación: técnicas de memoria en 4 repos OSS |

---

## Contribuir

Ver [CONTRIBUTING.md](CONTRIBUTING.md). Reportes de bugs y propuestas de agentes bienvenidos vía GitHub Issues.

---

## Licencia

MIT — ver [LICENSE](LICENSE).
