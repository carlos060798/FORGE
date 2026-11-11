# Inicio rápido

> Tipo: Tutorial
> Última revisión: 2026-11-10 contra el commit 55a9dd9

Esta guía instala Fragua y explica qué hacen `fragua init` y `fragua doctor`. El recorrido de cinco comandos con sus pausas está en [PRIMEROS-15-MINUTOS.md](PRIMEROS-15-MINUTOS.md) y no se repite aquí. Referencia de cada opción: [referencia-cli.md](referencia-cli.md).

## Requisitos

| Requisito | Para qué | Comprobación |
|---|---|---|
| Node.js ≥ 20 | Todo (`engines` de `package.json`) | `node --version` |
| Claude Code | Los comandos `/sdd.*` | `claude --version` |
| Docker en marcha | El ciclo verificado (`fragua run`, `/sdd.implementar`); sin él sale con código 4 | `docker version` |
| `ANTHROPIC_API_KEY` en el entorno | Llamadas al modelo del ciclo | `fragua doctor` |
| Proyecto en JavaScript/TypeScript, Python o Go | Lenguajes que el ciclo sabe probar | [MIGRACION-5.0.md](MIGRACION-5.0.md) 2.2 |

Con Node ≥ 22.5 se usa `node:sqlite` para el almacén de decisiones; con menos, `doctor` lo avisa y se usa Markdown (`cli/comandos/doctor.js`).

## 1. Instalar

La 5.0.0-beta.1 no está publicada en npm. Hasta que lo esté, se instala desde el repositorio:

```bash
git clone https://github.com/carlos060798/FORGE
cd FORGE
npm install
npm install -g .
fragua --version   # 5.0.0-beta.1
```

`fragua`, `forge` y `sdd-es` son el mismo ejecutable (`bin` de `package.json`). Sin instalar globalmente: `node /ruta/a/FORGE/cli/index.js <orden>`.

## 2. Instalar en tu proyecto

```bash
cd /ruta/a/mi-proyecto
fragua init
```

Sin opciones, `fragua init` instala el perfil **esencial** (seis comandos en el menú `/`: `forge`, `sdd.especificar`, `sdd.planificar`, `sdd.tareas`, `sdd.implementar`, `sdd.estado`) y una configuración igual al preset **lean** (6 agentes activos). Fuente: `core/instalacion/perfiles.js`, ADR-24; ver [configuration.md](configuration.md#perfil-de-instalación-y-preset-lean-por-defecto).

| Opción | Efecto |
|---|---|
| `--perfil completo` | Instala los 39 comandos |
| `--preset startup` o `--preset enterprise` | Otro preset en vez de lean |
| `--template api-rest\|cli-tool\|saas-mvp` | Parte de una plantilla de IR, spec y configuración |
| `--integracion <clave>` | Instala las skills para otra herramienta (cursor, copilot, gemini…). Sin probar en ninguna herramienta real: [RELACION-CON-CLAUDE-CODE.md](RELACION-CON-CLAUDE-CODE.md) |
| `--global` | Instala en `~/.claude` |
| `--ui` | Copia el dashboard a `.forge-ui/` |

`fragua update` vuelve a copiar el núcleo sin tocar `.sdd/` ni tus ajustes.

## 3. Comprobar el entorno

```bash
fragua doctor
```

Revisa Node, la instalación del proyecto, `sdd.config.yaml`, los hooks, la clave, Docker (distingue «no instalado» de «no arrancado») y, si hay clave, hace una llamada mínima al modelo. Termina con una sección «Siguiente paso». Informa de problemas en pantalla pero **sale con código 0** aunque los haya (`docs/referencia-cli.md`, `doctor`): léelo, no lo uses como puerta en un script.

## 4. Primer uso

Abre Claude Code en el proyecto y sigue [PRIMEROS-15-MINUTOS.md](PRIMEROS-15-MINUTOS.md). La aprobación de la spec es obligatoria y se hace en una terminal real:

```bash
fragua aprobar spec
```

Te pide teclear un código que ves en pantalla. Sin ella no se puede planificar.

## 5. Ver el estado y retomar

```bash
fragua status          # etapa del pipeline y transiciones
fragua logs --last 20  # consumo de tokens
fragua ui              # dashboard en http://localhost:3001 (solo lectura)
fragua resume          # retoma lo interrumpido o lo que espera tu decisión
```

Dentro de Claude Code: `/sdd.estado` e `/sdd.implementar continuar`.

## Configuración

Fichero `.sdd/sdd.config.yaml`. Se consulta y cambia con `fragua config show|get|set|validate`. Las secciones que lee el ciclo (`motor`, `sandbox`, `presupuesto`…) exigen exactamente dos espacios de sangría. Referencia completa: [configuration.md](configuration.md).

## Siguiente

- [Qué es y sus límites](introduction.md)
- [Solución de problemas](TROUBLESHOOTING.md)
- [Conceptos](core-concepts.md) · [Agentes](agents.md)
