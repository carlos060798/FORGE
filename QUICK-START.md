# Fragua (antes FORGE): inicio corto

> Tipo: Tutorial
> Última revisión: 2026-11-10 contra el commit 55a9dd9

Fragua es un marco de desarrollo por especificaciones. Su anfitrión nativo es Claude Code; otras herramientas de código reciben una versión adaptada, sin probar en real ([docs/ANFITRIONES.md](docs/ANFITRIONES.md), [docs/USO-EN-OTRAS-HERRAMIENTAS.md](docs/USO-EN-OTRAS-HERRAMIENTAS.md)). Tiene un ciclo que da una tarea por buena solo si sus pruebas pasan en un contenedor Docker sin red. Qué hace y qué no: [docs/introduction.md](docs/introduction.md). Versión 5.0.0-beta.1, sin publicar en npm.

## Requisitos

Node ≥ 20, una herramienta de código (Claude Code es el camino nativo; para otras, [docs/USO-EN-OTRAS-HERRAMIENTAS.md](docs/USO-EN-OTRAS-HERRAMIENTAS.md)), Git, Docker en marcha (para `/sdd.implementar` y `fragua run`) y `ANTHROPIC_API_KEY` en el entorno.

## Instalar (desde el repositorio)

```bash
git clone https://github.com/carlos060798/FORGE
cd FORGE
npm install
npm install -g .
fragua --version
cd /ruta/a/mi-proyecto
fragua init        # perfil esencial (6 comandos) y preset lean
fragua doctor      # diagnóstico; acaba con «Siguiente paso»
```

Las órdenes `fragua`, `forge` y `sdd-es` son equivalentes. Opciones de `init` (`--perfil completo`, `--preset`, `--template`, `--integracion`): [docs/getting-started.md](docs/getting-started.md).

## Primer uso

Sigue [docs/PRIMEROS-15-MINUTOS.md](docs/PRIMEROS-15-MINUTOS.md): `/sdd.especificar`, `fragua aprobar spec` (en una terminal real), `/sdd.planificar`, `/sdd.tareas`, `/sdd.implementar`, `/sdd.estado`.

## Órdenes de terminal usadas con más frecuencia

```bash
fragua status                   # etapa del pipeline
fragua aprobar spec             # aprobación humana de la spec
fragua run                      # ciclo verificado (necesita Docker; puede gastar dinero)
fragua resume                   # retomar o decidir una pausa
fragua verificar                # veredicto de pruebas sin modelo
fragua logs --last 20           # consumo de tokens
fragua ui                       # dashboard en localhost:3001
fragua decisions list           # registro de decisiones de arquitectura
```

Lista completa: `fragua help` y [docs/referencia-cli.md](docs/referencia-cli.md).

## Otro proveedor de modelo (opcional)

En `.sdd/sdd.config.yaml`:

```yaml
llm:
  provider: ollama   # anthropic | openai | ollama | stub
```

o la variable `FORGE_LLM_PROVIDER`. Solo Anthropic se ha probado con llamadas reales; OpenAI y Ollama, contra servidores falsos ([docs/PROBLEMAS-CONOCIDOS.md](docs/PROBLEMAS-CONOCIDOS.md)).

## Más

[Estado actual](docs/ESTADO-ACTUAL.md) · [Límites](docs/limitations.md) · [Solución de problemas](docs/TROUBLESHOOTING.md) · [Configuración](docs/configuration.md)
