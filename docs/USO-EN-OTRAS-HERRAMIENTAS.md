# Usar Fragua sin Claude Code

> Tipo: Guía · Para quien trabaja con Codex, Cursor, Copilot, Gemini CLI, Windsurf, opencode o Kiro · Qué recibe cada una, en detalle: [ANFITRIONES.md](ANFITRIONES.md) · Estado real del proyecto: [ESTADO-ACTUAL.md](ESTADO-ACTUAL.md).

## Lo primero: nada de esto está probado en real

Ninguna herramienta distinta de Claude Code ha sido probada con Fragua. Las carpetas de skills salen de la documentación oficial de cada herramienta, y las pruebas automáticas del proyecto comprueban que se escriben los archivos esperados. Nadie ha comprobado todavía que, por ejemplo, Cursor o Codex descubran la skill y la ejecuten bien. Si lo pruebas, tu resultado es útil: anota la versión de la herramienta y qué funcionó.

Lo que sí es independiente de la herramienta es el **motor**: `fragua run`, `fragua resume` y `fragua verificar` corren desde la terminal y no dependen de ningún anfitrión.

## 1. Qué necesitas

| Requisito | Para qué |
|---|---|
| Node ≥ 20 | La CLI `fragua` y el guardián |
| Docker abierto | El ciclo verificado ejecuta el código en un contenedor sin red |
| Una clave de modelo en el entorno (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY` o un Ollama local) | Solo para `fragua run`; nunca va en archivos del proyecto |
| Tu herramienta de código | Quien lee las skills y conduce el flujo |

La instalación del paquete es la de [PRIMEROS-15-MINUTOS.md](PRIMEROS-15-MINUTOS.md), pasos 0 y 1, sin Claude Code.

## 2. Instalar para tu herramienta

Dentro de tu proyecto:

```bash
fragua init --integracion <clave>
fragua doctor
```

| Herramienta | Clave | Carpeta donde quedan las skills |
|---|---|---|
| Codex CLI | `codex` | `.agents/skills` |
| Cursor | `cursor` | `.cursor/skills` |
| GitHub Copilot | `copilot` | `.github/skills` |
| Gemini CLI | `gemini` | `.gemini/skills` |
| Windsurf | `windsurf` | `.devin/skills` |
| opencode | `opencode` | `.opencode/skills` |
| Kiro | `kiro` | `.kiro/skills` |
| Varias a la vez que leen `.agents/skills` | `agents` | `.agents/skills` |
| Otra herramienta | `generica` | la que pases con `--carpeta-skills <ruta>` (dentro del proyecto o de tu carpeta personal) |

Notas:

- Sin `--perfil`, se instala el perfil **esencial** (seis comandos). `--perfil completo` instala los 39.
- `fragua update` recuerda la clave, el perfil y si instalaste con `--con-hooks`; `--sin-hooks` lo desactiva.
- Zed y Goose no tienen clave: su carpeta de skills no se pudo confirmar en la documentación oficial. Usa `generica`.
- `fragua init` no pisa un archivo ajeno que ya exista en la carpeta de destino: avisa y lo deja.

## 3. Qué recibes y qué no

**Recibes**

- Las 31 skills propias de Fragua, adaptadas a tu herramienta (sin referencias a Claude Code ni a sus nombres de herramientas).
- Los comandos del perfil como skills llamadas `sdd-*` (y `forge`), con las órdenes `/sdd.x` del texto reescritas a la forma de invocar de tu herramienta.
- **14 roles**, uno por agente, como skills `rol-arquitecto`, `rol-tester`, `rol-revisor`, `rol-seguridad`, etc.
- Una nota al inicio de cada skill con las equivalencias de lo que solo existe en Claude Code.
- `AGENTS.md` en la raíz, con las reglas del proyecto.

**No recibes**

- Los hooks de Claude Code, `settings.json` ni `CLAUDE.md`.
- Subagentes: los agentes de Claude Code no existen como tales en tu herramienta; ver el apartado 5.
- Memoria automática por agente: en Claude Code un hook la escribe; aquí hay que anotar las decisiones a mano en `.sdd/memoria/`.
- Guardián, salvo que lo pidas con `--con-hooks` (apartado 6).

## 4. Cómo se invoca el flujo

La forma de invocar una skill depende de tu herramienta. Empieza siempre por `forge` y sigue por el camino de cinco pasos del perfil esencial: `sdd-especificar`, `sdd-planificar`, `sdd-tareas`, `sdd-implementar`, `sdd-estado`.

| Herramienta | Cómo se invoca | Ejemplo de inicio |
|---|---|---|
| Codex CLI, carpeta común | `$<nombre>`; también `/skills`; implícita por descripción | `$forge` |
| Cursor | `/<nombre>` en el chat del agente; también automática | `/forge` |
| GitHub Copilot | `/<nombre>` en el chat; también automática por descripción | `/forge` |
| Gemini CLI | La herramienta `activate_skill` la activa por descripción; `/skills` las gestiona | pedir «usa la skill forge» |
| Windsurf | `@<nombre>` en Cascade; también automática | `@forge` |
| opencode | La herramienta `skill({name})`; `/<nombre>` solo con `opencode/slash` | `skill({ name: "forge" })` |
| Kiro | `/<nombre>`; también automática | `/forge` |
| Genérica | Según tu herramienta: la skill por nombre | pedir «usa la skill forge» |

Esta tabla repite lo que dice [herramientas-destino.js](../core/instalacion/herramientas-destino.js) con su fuente y fecha de consulta. Si tu herramienta cambia su forma de invocar, manda su documentación.

Dos reglas que valen en todas:

- **La spec la apruebas tú, en una terminal real.** Ningún agente la aprueba por ti: ejecuta `fragua aprobar spec` fuera del chat. Sin esa aprobación no se pasa al plan.
- **El código lo verifica el motor, no el chat.** Para que el código generado se dé por bueno, corre `fragua run` (o `fragua verificar`) en tu terminal con Docker abierto. Que la herramienta diga «listo» no es el veredicto.

### Ejemplo con Codex

```text
$forge
> una API para llevar el inventario de una tienda de barrio

$sdd-especificar "API de inventario con altas, bajas y consulta de stock"
  (revisa .sdd/especificaciones/<fecha-id>/spec.md)

# En una terminal aparte:
fragua aprobar spec

$sdd-planificar
  (revisa el plan; si no te gusta, dilo y se rehace)
```

### Ejemplo con Cursor

```text
/forge
> una API para llevar el inventario de una tienda de barrio

/sdd-especificar API de inventario con altas, bajas y consulta de stock
  (revisa .sdd/especificaciones/<fecha-id>/spec.md)

# En una terminal aparte:
fragua aprobar spec

/sdd-planificar
  (revisa el plan; si no te gusta, dilo y se rehace)
```

Cómo se pasa el texto después del nombre de la skill (en la misma línea o en el mensaje siguiente) depende de tu herramienta. Si no lo toma como argumento, pega la idea en el mensaje siguiente.

## 5. Trabajar sin subagentes

En Claude Code, un comando puede delegar en un agente aparte. En tu herramienta eso no existe tal cual. La nota al inicio de cada skill lo resuelve así:

- Donde el texto dice `Task("agente", …)` o «invoca al agente X», **carga la skill `rol-X` y haz ese trabajo en la misma conversación**, devolviendo solo el informe.
- Lo que el texto pida **en paralelo se hace en secuencia**.
- No hay aislamiento de contexto entre roles: todo cabe en la misma conversación. En trabajos largos, abre una conversación nueva por fase y deja que `.sdd/` lleve el estado.
- Los roles de solo lectura (`rol-arquitecto`, `rol-critico`, `rol-seguridad`, `rol-investigador`, `rol-revisor`, `rol-asesor-datos`, `rol-disenador-api`) no deberían escribir archivos. Sin guardián, nadie lo impide: tú lo vigilas.

## 6. El guardián con `--con-hooks`

El guardián de Fragua bloquea acciones peligrosas antes de que se ejecuten: borrados recursivos de la raíz, `git push --force`, `git reset --hard`, escribir o leer archivos de secretos (`.env`), y contenido con aspecto de clave. En Claude Code se activa solo. En otras herramientas es **opcional**:

```bash
fragua init --integracion cursor --con-hooks
```

Crea el archivo de hooks de tu herramienta. **Nunca pisa uno que ya exista**: en ese caso avisa y te da la orden que debes añadir tú, `fragua guardian evaluar --anfitrion <clave>`.

| Herramienta | Archivo | Si el hook falla |
|---|---|---|
| Cursor | `.cursor/hooks.json` | **Bloquea** (usa `failClosed`) |
| GitHub Copilot | `.github/hooks/fragua-guardian.json` | **Bloquea** ante un error del hook; ante un tiempo agotado deja pasar y avisa |
| Gemini CLI | `.gemini/settings.json` | **Deja pasar** la acción |
| Codex CLI | `.codex/hooks.json` | **Deja pasar** la acción |

Lo que significa en la práctica:

- En **Gemini y Codex**, si `fragua` no está instalado o el hook se rompe, la acción continúa sin aviso de bloqueo. Trátalo como una ayuda, no como una garantía.
- En Codex, los hooks del proyecto solo se cargan si la carpeta `.codex/` es de confianza, y hay que revisarlos y aprobarlos dentro de Codex.
- El hook llama a la orden `fragua`: debe estar instalada y en el `PATH`.
- El guardián solo conoce las herramientas cuyo evento sabe traducir. Una herramienta que no reconoce **pasa sin evaluar**.
- Los nombres de herramienta y de campos de Gemini y Copilot están **sin confirmar** en la documentación leída.
- Windsurf, opencode, Kiro, `agents` y `generica` no tienen adaptador de hook: `--con-hooks` avisa y no escribe nada.
- **Ningún hook está probado en una instalación real** de su herramienta.

El guardián es una red de seguridad, no un límite. La defensa que sí vale en cualquier herramienta es el aislamiento del ciclo verificado (`fragua run` y `fragua verificar`, en un contenedor sin red) y los permisos de tu propia herramienta. Detalle en [GARANTIAS-Y-LIMITES.md](GARANTIAS-Y-LIMITES.md) y en el contrato [contrato/evento-herramienta.md](contrato/evento-herramienta.md).

## 7. Si algo no funciona

| Síntoma | Qué mirar |
|---|---|
| Tu herramienta no encuentra la skill | `fragua doctor` informa de la integración y el perfil instalados. Comprueba que la carpeta de la tabla del apartado 2 existe y que reiniciaste la herramienta |
| La skill menciona una orden que no existe | Es texto original que la adaptación no cubre. Búscalo en la nota del inicio: allí están las equivalencias. Si no está, repórtalo |
| El hook no bloquea nada | Mira el apartado 6: puede que tu herramienta falle abierto, que `fragua` no esté en el `PATH` o que el proyecto no sea de confianza |
| Un archivo de la carpeta no se instaló | `fragua init` no pisa archivos ajenos; el aviso dice cuál. Muévelo y repite |

Para reportar un fallo en una herramienta concreta, usa la plantilla de [fallo.md](../.github/ISSUE_TEMPLATE/fallo.md) e indica la herramienta y su versión.

## En curso

Estos paquetes se están desarrollando mientras se escribe esta guía. No cuentes con ellos hasta que [ANFITRIONES.md](ANFITRIONES.md) los marque como hechos:

- Agentes en el formato nativo de cada herramienta (hoy solo hay roles `rol-*`).
- Memoria por agente mediante hooks fuera de Claude Code.
- Una herramienta MCP consultiva para el guardián.
- La prueba manual por herramienta, que hará el dueño del proyecto.
