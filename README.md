<div align="center">

# Fragua (antes FORGE)

**Desarrollo Guiado por Especificaciones (SDD) para Claude Code**

[![Versión](https://img.shields.io/badge/versión-5.0.0-blue)](CHANGELOG.md)
[![Licencia](https://img.shields.io/badge/licencia-MIT-green)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](package.json)

</div>

Fragua lleva una idea escrita en lenguaje natural hasta código probado, pasando por una especificación que **una persona aprueba** antes de que los agentes escriban nada. Orquesta 14 agentes, 39 comandos y 31 skills sobre Claude Code, y guarda todo el estado en `.sdd/` para retomar entre sesiones.

---

## Estado (léelo primero)

- **5.0.0 no está publicada en npm.** `forja-mvp` (nombre antiguo) sigue en 4.2.0 y el paquete nuevo es `fragua`. Hoy se instala clonando el repositorio.
- Cifras de pruebas, qué está probado y qué no, con fecha y commit: **[docs/ESTADO-ACTUAL.md](docs/ESTADO-ACTUAL.md)**. Una auditoría externa (2026-11) no pudo reproducir el «0 fallos» publicado: 2 pruebas fallaban en el árbol de trabajo. No des por verde la suite sin ejecutarla.
- Probado con modelo real: Anthropic, tareas pequeñas en JavaScript, Python y Go. **Sin probar:** Docker real en Linux/macOS, OpenAI/Ollama con modelo real, integraciones externas contra cuentas reales.

## Para quién sí y para quién no

- **Sí:** quien programa o supervisa código y quiere un proceso con especificación, pruebas y trazabilidad.
- **No (todavía):** quien espera «no-code». Necesitas Docker, una clave de API y leer los veredictos del ciclo.

## Requisitos

| Requisito | Por qué |
|---|---|
| Node ≥ 20 | Los hooks y la CLI. **Sin Node, el guardián bloquea toda acción** (falla cerrado), no hay modo de reserva en Bash. Ver [docs/runtime.md](docs/runtime.md) |
| Docker en marcha | `fragua run` ejecuta el código generado en un contenedor sin red. Sin Docker: `--motor clasico` (modo 4.x, sin aislamiento) |
| `ANTHROPIC_API_KEY` (u otra) en tu entorno | Las claves nunca se leen del archivo del proyecto |
| Proyecto en JS/TS, Python o Go | Lenguajes cubiertos por el ciclo verificado |

## Instalar y primera ejecución

```bash
git clone https://github.com/carlos060798/FORGE && cd FORGE && npm install
node cli/index.js doctor          # comprueba Node, hooks, proveedor LLM y SQLite
```

Después, dentro de Claude Code en tu proyecto: `/forge`. Recorrido completo: [docs/getting-started.md](docs/getting-started.md).

> Cuando se publique el paquete: `npm install -g fragua`. No uses `npx forge`: descargaría otro paquete llamado `forge`.

**Nombres:** el producto es *Fragua*; las órdenes `fragua`, `forge` y `sdd-es` son equivalentes; el estado vive en `.sdd/`. Variables `FRAGUA_*` (las `FORGE_*` antiguas se siguen leyendo). Detalle en [MIGRACION-5.0.md](docs/MIGRACION-5.0.md).

## Qué pasa cuando lo usas

```
idea → discovery → ir → design → spec → [aprobación humana] → plan → tasks → code → done
```

Cada etapa deja un artefacto en `.sdd/` y se puede reanudar (`/sdd.implementar continuar`).

**Aprobación humana.** No se puede pasar de `spec` a `plan` sin `fragua aprobar spec` (guard en [core/state-machine.js](core/state-machine.js)). Matiz honesto: el guard comprueba que alguien ejecutó la aprobación, **no** que la revisó; existe `step --force --motivo` para saltarlo y deja registro. Ver [GARANTIAS-Y-LIMITES.md](docs/GARANTIAS-Y-LIMITES.md).

**Ciclo verificado (por defecto en 5.0.0)** para tareas de código:

1. Un agente escribe pruebas que deben fallar antes de que exista el código.
2. Otro implementa y no puede tocar las pruebas.
3. Las pruebas corren en Docker sin red.
4. Decide el código de salida de las pruebas, no un modelo.
5. Tope de gasto por sesión (2 USD por defecto) y pausa para que decidas cuando no puede terminar solo.

Guía: [ciclo-verificado.md](docs/ciclo-verificado.md). Qué falla y cómo recuperarse: [QUE-PASA-SI-FALLA.md](docs/QUE-PASA-SI-FALLA.md).

## Qué incluye

| Pieza | Cantidad | Dónde |
|---|---|---|
| Agentes | 14 (el preset `lean` activa 6; el ciclo usa 3) | [docs/agents.md](docs/agents.md) |
| Comandos `/sdd.*` | 39 | [commands/](commands/) |
| Skills | 31 | [skills/](skills/), [docs/tools.md](docs/tools.md) |
| Hooks | 8 archivos `.js` (3 con `.sh` que delegan en Node) | [docs/runtime.md](docs/runtime.md) |
| Proveedores LLM | Anthropic, OpenAI y compatibles, Ollama, Stub (CI) | [docs/configuration.md](docs/configuration.md) |

**Opcional (apagado por defecto):** servidor MCP (`fragua mcp`), API HTTP local (`fragua api`), dashboard (`fragua ui`, `localhost:3001`) e **integraciones externas** con GitHub, GitLab y Jira Cloud (`fragua integraciones`, configuradas en `integraciones:` de `sdd.config.yaml`; probadas solo contra servidores simulados). Ver [integraciones-externas.md](docs/integraciones-externas.md).

Comandos de CLI habituales: `status`, `run`, `resume`, `aprobar`, `doctor`, `logs`, `ui`, `integraciones`. La CLI tiene más subcomandos de los listados aquí; usa `fragua help`.

## Garantías y límites en tres líneas

- Cada garantía publicada enlaza a una prueba automática: [GARANTIAS-Y-LIMITES.md](docs/GARANTIAS-Y-LIMITES.md).
- Límites conocidos y a quién afectan: [PROBLEMAS-CONOCIDOS.md](docs/PROBLEMAS-CONOCIDOS.md), [limitations.md](docs/limitations.md).
- Seguridad explicada sin jerga: [SEGURIDAD-PARA-NOTECNICOS.md](docs/SEGURIDAD-PARA-NOTECNICOS.md); política de reporte: [SECURITY.md](SECURITY.md).

## Documentación

| Quiero… | Lee |
|---|---|
| Empezar | [getting-started.md](docs/getting-started.md), [QUICK-START.md](QUICK-START.md) |
| Entender cómo funciona | [core-concepts.md](docs/core-concepts.md), [architecture.md](docs/architecture.md), [FORGE-5.0-GUIA.md](docs/FORGE-5.0-GUIA.md) |
| Configurar | [configuration.md](docs/configuration.md) |
| Migrar desde 4.2.0 | [MIGRACION-5.0.md](docs/MIGRACION-5.0.md) |
| Resolver un error | [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) |
| Extender (agentes, comandos, hooks) | [extending-forge.md](docs/extending-forge.md) |
| Integrar (MCP, API, plataformas) | [servidor-mcp.md](docs/servidor-mcp.md), [api-http.md](docs/api-http.md), [INTEGRACIONES.md](docs/INTEGRACIONES.md) |
| Ver el índice completo | [0-INDICE.md](docs/0-INDICE.md) |

## Contribuir y licencia

[CONTRIBUTING.md](CONTRIBUTING.md) · Bugs y propuestas de agentes por GitHub Issues · MIT, ver [LICENSE](LICENSE).
