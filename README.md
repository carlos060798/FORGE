<div align="center">

# Fragua (antes FORGE)

**Desarrollo Guiado por Especificaciones (SDD) para Claude Code y otras herramientas de código, con un ciclo de verificación aislado**

[![CI](https://github.com/carlos060798/FORGE/actions/workflows/ci.yml/badge.svg)](https://github.com/carlos060798/FORGE/actions/workflows/ci.yml)
[![Versión](https://img.shields.io/badge/versión-5.0.0--beta.1-blue)](CHANGELOG.md)
[![Licencia](https://img.shields.io/badge/licencia-MIT-green)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](package.json)

</div>

Fragua lleva una idea escrita en lenguaje natural hasta código probado, pasando por una especificación que **una persona aprueba** antes de que los agentes escriban nada. Orquesta 14 agentes, 39 comandos y 31 skills. Su anfitrión nativo es Claude Code; en otras herramientas recibe skills, comandos adaptados como skills y los agentes como roles (sin guardián por hooks; ver [docs/ANFITRIONES.md](docs/ANFITRIONES.md)). Guarda todo el estado en `.sdd/` para retomar entre sesiones.

Lo que lo distingue es una decisión de diseño: **el veredicto sobre el código lo da el código de salida de las pruebas, ejecutadas en un contenedor sin red, y no la opinión de un modelo.**

---

## Estado (léelo primero)

Fragua está en **pre-beta**. La fuente de referencia, con cifras, fechas y commits, es **[docs/ESTADO-ACTUAL.md](docs/ESTADO-ACTUAL.md)**; esta tabla es un resumen.

| Qué | Estado |
|---|---|
| Paquete en npm | **No publicado.** `5.0.0-beta.1` se instalará con la etiqueta `beta`. Hoy se instala clonando el repositorio |
| Suite de pruebas en Windows | Reproducida: tres pasadas seguidas con 0 fallos |
| Integración continua en Linux | **Sin verde todavía.** El estado actual lo muestra la insignia de arriba |
| Aislamiento con Docker real | Probado en **Windows** (Docker Desktop). **Sin probar** en Linux ni macOS |
| Modelo real | Probado con Anthropic, tareas pequeñas en JavaScript, Python y Go. **Sin probar** con OpenAI ni Ollama |
| Integraciones GitHub, GitLab y Jira | Probadas solo contra servidores simulados |
| Mantenimiento | Una persona. Sin plazos garantizados ([GOVERNANCE.md](GOVERNANCE.md), [SUPPORT.md](SUPPORT.md)) |

## Para quién sí y para quién no

- **Sí:** quien programa o supervisa código y quiere un proceso con especificación, pruebas y trazabilidad.
- **No (todavía):** quien espera «no-code». Necesitas Docker, una clave de API y leer los veredictos del ciclo.

## Cómo funciona

```
idea → discovery → ir → design → spec → [aprobación humana] → plan → tasks → code → done
```

Cada etapa deja un artefacto en `.sdd/` y se puede reanudar (`/sdd.implementar continuar`).

**Aprobación humana.** No se puede pasar de `spec` a `plan` sin `fragua aprobar spec`, que exige una terminal real y teclear un código; la transición comprueba además un registro firmado con el hash vigente de la spec. Matiz honesto: eso prueba que alguien ejecutó la aprobación, **no** que la revisó, y un agente con el mismo usuario del sistema podría falsificarla. Existe `step --force --motivo` para saltarla y deja un evento firmado. Ver [GARANTIAS-Y-LIMITES.md](docs/GARANTIAS-Y-LIMITES.md).

**Ciclo verificado (por defecto en 5.0.0)** para tareas de código:

1. Un agente escribe pruebas que deben fallar antes de que exista el código.
2. Otro implementa y no puede tocar las pruebas.
3. Las pruebas corren en Docker sin red.
4. Decide el código de salida de las pruebas, no un modelo.
5. Tope de gasto por sesión (2 USD por defecto) y pausa para que decidas cuando no puede terminar solo.

Guía: [ciclo-verificado.md](docs/ciclo-verificado.md). Qué falla y cómo recuperarse: [QUE-PASA-SI-FALLA.md](docs/QUE-PASA-SI-FALLA.md).

## Requisitos

| Requisito | Por qué |
|---|---|
| Node ≥ 20 | Los hooks y la CLI. **Sin Node, el guardián bloquea toda acción** (falla cerrado), no hay modo de reserva en Bash. Ver [docs/runtime.md](docs/runtime.md) |
| Docker en marcha | `fragua run` ejecuta el código generado en un contenedor sin red. Sin Docker: `--motor clasico` (modo 4.x, sin aislamiento) |
| `ANTHROPIC_API_KEY` (u otra) en tu entorno | Las claves nunca se leen del archivo del proyecto |
| Proyecto en JS/TS, Python o Go | Lenguajes cubiertos por el ciclo verificado |
| Una herramienta de código | Claude Code recibe comandos, subagentes y hooks (guardián y memoria). Las demás (`--integracion <clave>`) reciben skills, comandos adaptados como skills y 14 roles `rol-*`, sin guardián ni memoria por hooks. Ninguna está probada todavía: [docs/ANFITRIONES.md](docs/ANFITRIONES.md) |

## Instalación

Hasta que el paquete se publique:

```bash
git clone https://github.com/carlos060798/FORGE && cd FORGE
npm install && npm install -g .
cd <tu-proyecto>
fragua init          # perfil esencial y preset lean por defecto
fragua doctor        # comprueba Node, Docker, clave, hooks y proveedor
```

Cuando se publique: `npm install -g fragua`. No uses `npx forge`: descargaría otro paquete llamado `forge`.

`fragua init` sin opciones instala el perfil **esencial** (solo el camino principal en el menú `/`) y el preset **lean** (los seis agentes esenciales, en sonnet). Todo lo demás es opcional: `--perfil completo`, `--preset startup|enterprise`.

**Nombres:** el producto es *Fragua*; las órdenes `fragua`, `forge` y `sdd-es` son equivalentes; el estado vive en `.sdd/`. Variables `FRAGUA_*` (las `FORGE_*` antiguas se siguen leyendo). Detalle en [MIGRACION-5.0.md](docs/MIGRACION-5.0.md).

## Primera tarea

Dentro de Claude Code, en tu proyecto, en este orden:

```
/sdd.especificar "una idea en una frase"   →  fragua aprobar spec  (en una terminal)
/sdd.planificar
/sdd.tareas
/sdd.implementar                            →  ciclo verificado en un contenedor
/sdd.estado
```

Guía de una página, con qué hacer en cada pausa: **[docs/PRIMEROS-15-MINUTOS.md](docs/PRIMEROS-15-MINUTOS.md)**.

## Qué incluye

| Pieza | Cantidad | Dónde |
|---|---|---|
| Agentes | 14 (el preset `lean` activa 6; el ciclo usa 3) | [docs/agents.md](docs/agents.md) |
| Comandos `/sdd.*` | 39 | [commands/](commands/) |
| Skills | 31 | [skills/](skills/), [docs/tools.md](docs/tools.md) |
| Hooks | 8 archivos `.js` (3 con `.sh` que delegan en Node) | [docs/runtime.md](docs/runtime.md) |
| Proveedores LLM | Anthropic, OpenAI y compatibles, Ollama, Stub (CI) | [docs/configuration.md](docs/configuration.md) |

**Opcional (apagado por defecto):** servidor MCP (`fragua mcp`), API HTTP local (`fragua api`), dashboard (`fragua ui`, `localhost:3001`) e **integraciones externas** con GitHub, GitLab y Jira Cloud (`fragua integraciones`). Ver [integraciones-externas.md](docs/integraciones-externas.md). Todos los subcomandos: [referencia-cli.md](docs/referencia-cli.md).

## Documentación

Organizada por lo que necesitas hacer. Índice completo: [docs/0-INDICE.md](docs/0-INDICE.md).

| Necesito… | Tipo | Lee |
|---|---|---|
| Empezar | Tutorial | [PRIMEROS-15-MINUTOS.md](docs/PRIMEROS-15-MINUTOS.md), [getting-started.md](docs/getting-started.md), [EJEMPLO-API-REST.md](docs/EJEMPLO-API-REST.md) |
| Resolver una tarea concreta | Guía | [configuration.md](docs/configuration.md), [extending-forge.md](docs/extending-forge.md), [guia-anadir-proveedor.md](docs/guia-anadir-proveedor.md), [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md), [MIGRACION-5.0.md](docs/MIGRACION-5.0.md) |
| Consultar un dato exacto | Referencia | [referencia-cli.md](docs/referencia-cli.md), [api-reference.md](docs/api-reference.md), [api-http.md](docs/api-http.md), [servidor-mcp.md](docs/servidor-mcp.md), [GLOSARIO.md](docs/GLOSARIO.md) |
| Entender por qué es así | Explicación | [core-concepts.md](docs/core-concepts.md), [architecture.md](docs/architecture.md), [mapa-de-modulos.md](docs/mapa-de-modulos.md), [ciclo-verificado.md](docs/ciclo-verificado.md), decisiones en [.sdd/arquitectura/](.sdd/arquitectura/) |

## Garantías y límites

- Cada garantía publicada enlaza a una prueba automática: [GARANTIAS-Y-LIMITES.md](docs/GARANTIAS-Y-LIMITES.md).
- Límites conocidos y a quién afectan: [PROBLEMAS-CONOCIDOS.md](docs/PROBLEMAS-CONOCIDOS.md), [limitations.md](docs/limitations.md).
- Seguridad explicada sin jerga: [SEGURIDAD-PARA-NOTECNICOS.md](docs/SEGURIDAD-PARA-NOTECNICOS.md). Para reportar una vulnerabilidad: [SECURITY.md](SECURITY.md).

## Comunidad

| | |
|---|---|
| Contribuir | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Código de conducta | [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) |
| Dónde pedir ayuda | [SUPPORT.md](SUPPORT.md) |
| Cómo se decide | [GOVERNANCE.md](GOVERNANCE.md) |
| Hacia dónde va | [docs/roadmap.md](docs/roadmap.md) |
| Versionado y cambios | [VERSIONING.md](VERSIONING.md), [CHANGELOG.md](CHANGELOG.md) |

## Licencia

MIT. Ver [LICENSE](LICENSE).
