# FORGE 5.0: para qué sirve y qué trae

> Estado: 5.0.0 **no está publicada en npm**. Describe la rama `feature/motor-agentico`. **Para el estado al día (cifras, qué está en curso y qué falta) ver [ESTADO-ACTUAL.md](ESTADO-ACTUAL.md).** Cada dato sale de leer el código (`cli/index.js`, `cli/integraciones.js`, `core/ciclo/config.js`, `core/llm-providers/index.js`) o los documentos enlazados; no se ejecutó nada para escribir esta guía.

## Qué está verificado y qué no

| Tema | Estado |
|---|---|
| Ciclo verificado con Docker Desktop en Windows 11 | Verificado por el equipo (ver [PROBLEMAS-CONOCIDOS.md](PROBLEMAS-CONOCIDOS.md)) |
| Ciclo en Linux con Docker real | **No verificado**: el CI de Linux nunca corrió |
| Proveedor Anthropic | Probado con modelo real, en proyectos pequeños |
| Proveedores OpenAI y Ollama | **Sin prueba real** de extremo a extremo |
| Integraciones GitHub/GitLab/Jira | **Nunca probadas contra plataformas reales** |
| Publicación 5.0.0 en npm | **No existe** |
| Cifras de pruebas | Los documentos discrepan entre sí (ver sección 9) |

## 1. Qué es y para quién

FORGE es una herramienta de línea de comandos (`forge`, paquete `forja-mvp`) que organiza el desarrollo asistido por modelos de lenguaje alrededor de una especificación escrita y aprobada por una persona. Se usa dentro de Claude Code (comandos `/forge`, `/sdd.*`) y también desde la terminal con `forge run`.

Es para quien quiere que un modelo escriba código **y que algo distinto de otro modelo diga si funciona**: un contenedor que ejecuta las pruebas y devuelve un código de salida.

Qué NO es:

- No es una garantía de corrección: que las pruebas pasen demuestra solo lo que esas pruebas comprueban.
- No es un servicio en la nube ni un reemplazo de la revisión humana.
- No sirve (en modo ciclo) para Java, Rust, C#, etc.: solo JavaScript/TypeScript, Python y Go ([MIGRACION-5.0.md](MIGRACION-5.0.md), punto 2.2).
- No está pensado todavía para monorepos ni proyectos grandes (ver sección 9).

## 2. Qué pretende hacer

El ciclo verificado (detalle en [ciclo-verificado.md](ciclo-verificado.md)):

1. **Spec**: una especificación aprobada por una persona.
2. **Pruebas por otro rol**: un agente distinto del implementador escribe las pruebas.
3. **Código**: el implementador escribe el código hasta que las pruebas pasen.
4. **Ejecución aislada**: las pruebas corren en un contenedor Docker sin red.
5. **Veredicto determinista**: lo decide el código de salida de las pruebas, no un modelo. Con señales de «éxito sospechoso» (sin pruebas pasadas, menos pruebas de las escritas, `process.exit` al cargar) la tarea pide revisión aunque salga 0.
6. **Aprobación humana**: cuando el ciclo no basta, la tarea se pausa y una persona decide (`continuar`, `aceptar`, `abortar`).

Además: **tope de gasto** (2,00 USD por sesión por defecto, con cambio a un modelo más barato al llegar a 1,50), **reanudación** desde puntos de guardado y **auditoría** del consumo (`forge logs`).

## 3. Novedades 5.0 frente a 4.x

Fuentes: [CHANGELOG.md](../CHANGELOG.md) y [MIGRACION-5.0.md](MIGRACION-5.0.md). La migración completa, con cómo desactivar cada punto, está en este último.

| Área | 4.x | 5.0.0 |
|---|---|---|
| Motor de `forge run`/`resume` | Clásico: ejecuta pruebas en tu equipo | Ciclo verificado por defecto (`motor.modo: ciclo`); el clásico sigue con `--motor clasico` |
| Aislamiento | Ninguno | Docker sin red; sin Docker, salida 4 |
| Node | ≥18 | ≥20 |
| Dependencias | Dos | Tres (`@anthropic-ai/sdk` pasa a `dependencies`) |
| LangGraph.js | Opcional | Retirado; motor propio (ADR-18) |
| Códigos de salida | 0 y 1 | 0, 1, 3 (revisión), 4 (sin aislamiento) |
| Tope de gasto | No | `presupuesto.tope_usd`, degradación de modelo |
| Éxito sospechoso | No | Detección y pausa |
| Medición por mutación | No | `motor.mutacion: no\|informar\|exigir` (ADR-20) |
| Implementador por turnos | No | Opcional, `motor.implementador: turnos` (ADR-21) |
| Servidor MCP / API HTTP | No | `forge mcp`, `forge api` |
| Integraciones GitHub/GitLab/Jira | No | `forge integraciones`, apagadas por defecto |
| Memoria semántica | No | Opcional, `motor.recuperador: semantico` |
| Precios y modelos | Fijos | Configurables (`modelos:`, `precios:`, ADR-19) |

## 4. Instalación (honesta)

- **5.0.0 no está en npm.** En npm solo hay 4.0.0 y 4.2.0; `npm install -g forja-mvp` instalaría una versión anterior.
- Desde el paquete generado con `npm pack`:

```bash
npm install -g ./dist/forja-mvp-5.0.0.tgz
forge --version
```

- O clonando la rama `feature/motor-agentico` y ejecutando `npm install` y `npm install -g .`.
- Requisitos: **Node ≥20** y **Docker en marcha** (para el ciclo). Una clave de proveedor, por ejemplo `ANTHROPIC_API_KEY`, en el entorno; nunca la escribas en el repositorio.

## 5. Ejemplo mínimo punta a punta

```bash
forge doctor                  # Node, proveedor, clave. No comprueba que Docker corra: usa `docker info`
forge init                    # instala FORGE en el proyecto actual
```

Crea `tareas.json` (formato tomado de `scripts/pruebas-independientes.mjs`):

```json
[
  {
    "id": "T1",
    "agente": "desarrollador-backend",
    "prompt": "Crea src/texto.js que exporte capitalizar(frase). Pruebas con node:test en tests/texto.test.js."
  }
]
```

Una segunda tarea puede depender de la primera con `"dependencias": ["T1"]`. En JavaScript el proyecto necesita un `package.json`.

Ejecuta:

```bash
forge run --motor ciclo --tasks tareas.json --cwd .
```

Si una tarea queda esperando tu decisión, `forge resume` muestra el motivo sin gastar nada. Para decidir:

```bash
forge resume --decision continuar --iteraciones-extra 3
forge resume --decision aceptar
forge resume --decision abortar
```

También existen `--presupuesto-extra USD`.

Códigos de salida: **0** completado, **1** fallo, **3** revisión humana pendiente, **4** Docker no disponible.

Límite: `forge run` con el ciclo solo actúa en la etapa `code`; en otra pide `--force` ([MIGRACION-5.0.md](MIGRACION-5.0.md), 2.3).

## 6. Configuración mínima

Archivo `.sdd/sdd.config.yaml`. Cada clave con **exactamente dos espacios** de sangría (con otra, el lector falla o ignora la clave; ver [MIGRACION-5.0.md](MIGRACION-5.0.md)).

### `motor:`

| Clave | Defecto | Significado |
|---|---|---|
| `modo` | `ciclo` | `ciclo` o `clasico` |
| `grafo` | `auto` | `auto` o `propio` (`langgraph` se acepta con aviso) |
| `recuperador` | `archivos` | `archivos` o `semantico` |
| `embeddings` | `hash` | `hash` (local) u `ollama` |
| `embeddings_modelo` | `nomic-embed-text` | con `embeddings: ollama` |
| `nivel_maximo` | `opus` | `opus`, `sonnet`, `haiku` |
| `max_iteraciones` | 5 | ejecuciones de pruebas por tarea |
| `sin_progreso` | 3 | mismo fallo seguido antes de pedir revisión; 0 lo desactiva |
| `contexto_max_bytes` | 65536 | contexto para agentes |
| `implementador` | `bloque` | `bloque` o `turnos` |
| `turnos_max` | 30 | solo con `turnos` |
| `turnos_pruebas_max` | 5 | solo con `turnos` |
| `mutacion` | `informar` | `no`, `informar`, `exigir` |
| `mutacion_minima` | 0.6 | con `exigir` |
| `mutacion_max` | 10 | alteraciones por tarea |
| `mutacion_max_archivos` | 5 | archivos medidos por tarea |
| `mutacion_min_concluyentes` | 3 | con `exigir` |
| `mutacion_timeout_s` | 300 | tiempo de la medición |

### `sandbox:`

| Clave | Defecto |
|---|---|
| `cpus` | 1 |
| `memoria` | `512m` |
| `pids` | 256 |
| `timeout_s` | 120 |
| `salida_max_bytes` | 1048576 |
| `runtime` | vacío (el de Docker); otro valor distinto de `runc` exige `FORGE_RUNTIMES_PERMITIDOS` |

### `presupuesto:`

| Clave | Defecto |
|---|---|
| `tope_usd` | 2.0 (también `FORGE_BUDGET_USD`) |
| `umbral_degradacion_usd` | 1.5 |
| `degradar_a` | `escalon` (o `local`) |

### `llm:`

Fuente: `core/llm-providers/index.js` y los proveedores.

| Clave | Defecto / nota |
|---|---|
| `provider` | Variable `FORGE_LLM_PROVIDER` manda; si no, esta clave; si no, detección por entorno (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OLLAMA_BASE_URL`); por último `anthropic`. Valores: `anthropic`, `openai`, `ollama`, `stub` y alias |
| `model` | Nivel o identificador del modelo |
| `base_url` | Para `openai` (defecto `https://api.openai.com/v1`) y `ollama` (defecto `http://localhost:11434`) |
| `cache` | Caché de prompts de Anthropic; `false` la apaga |
| `timeout_s` | Segundos por intento, entre 1 y 3600; sin la clave se usan 120 s |

Además, `modelos:` (`opus`, `sonnet`, `haiku` con identificadores) y `precios:` (claves planas `<modelo>_entrada` y `<modelo>_salida`, USD por millón de tokens). `forge config show|get|set|validate` lee y valida el archivo.

## 7. Comandos del CLI

Tomados de `uso()` en `cli/index.js`. Todos también como `sdd-es`.

| Comando | Para qué |
|---|---|
| `forge init [--global] [--preset lean\|startup\|enterprise] [--ui] [--template api-rest\|cli-tool\|saas-mvp]` | Instala FORGE |
| `forge update [--global]` | Re-copia el núcleo sin tocar `.sdd/` |
| `forge doctor` | Diagnóstico de instalación y proveedores |
| `forge ui [--port N] [--no-open]` | Dashboard en el navegador |
| `forge config show\|get\|set\|validate` | Configuración |
| `forge logs [--last N]` | Consumo de tokens |
| `forge export` / `forge import` | Formatos portables (Spec Kit, OpenSpec) |
| `forge status`, `step`, `state`, `validate`, `reset --force` | Pipeline |
| `forge adr <raíz> "<glob>" [--update-ledger]` | Busca ADR en el código |
| `forge probar-modelo [--tope USD] [--conservar]` | Prueba mínima con un modelo real (gasta hasta el tope, 0,50 USD por defecto) |
| `forge api [--port N] [--cwd <ruta>]` | API HTTP local (127.0.0.1) con token ([api-http.md](api-http.md)) |
| `forge mcp [--cwd <ruta>]` | Servidor MCP por stdin/stdout ([servidor-mcp.md](servidor-mcp.md)) |
| `forge run [--tasks <json>] [--motor clasico\|ciclo] [--force]` | Ejecuta tareas |
| `forge resume [--decision continuar\|aceptar\|abortar] [--iteraciones-extra N] [--presupuesto-extra USD]` | Reanuda |
| `forge aprobar spec` | Aprueba la spec activa (existe en el código; no aparece en `uso()`) |
| `forge integraciones <sub>` | Ver sección 8 |
| `forge --version` | Versión |

El código también despacha `dispatch`, `adapters` y `decisions`; no están en `uso()` y esta guía no los describe.

### Instalar en otra herramienta: `--integracion`, `--perfil`, `--carpeta-skills`

`forge init` y `forge update` aceptan tres opciones (lista en `uso()`; tabla de herramientas y fuentes en `core/instalacion/herramientas-destino.js`):

| Opción | Qué hace |
|---|---|
| `--integracion <clave>` | Herramienta de destino: `claude` (por defecto), `generica`, `agents`, `copilot`, `cursor`, `gemini`, `windsurf`, `opencode`, `kiro`. Solo `claude` instala comandos, agentes y hooks nativos; las demás reciben skills en su carpeta |
| `--perfil <esencial\|completo>` | `esencial`: 6 comandos del camino principal; `completo` (por defecto): todos. Ver `core/instalacion/perfiles.js` |
| `--carpeta-skills <ruta>` | Solo con `--integracion generica`: carpeta de skills dentro del proyecto o de tu carpeta personal |

La elección se guarda en la sección `instalacion:` de `.sdd/sdd.config.yaml` y `forge doctor` la informa. Un repositorio no puede apuntar la escritura fuera del proyecto: una carpeta externa solo vale por `--carpeta-skills`. Límite: los perfiles no borran comandos ya instalados ([PROBLEMAS-CONOCIDOS.md](PROBLEMAS-CONOCIDOS.md)). Especificación: `.sdd/especificaciones/2026-10-13-instalacion-agnostica/`.

### Fragua frente a FORGE

- **Fragua** es el nombre del producto desde 2026-10-13; **FORGE** es el nombre anterior. El paquete de npm pasa a `fragua` (el paquete antiguo, `forja-mvp`, conserva las 4.x) y la orden principal es `fragua`.
- Siguen funcionando `forge` y `sdd-es` (con un aviso en terminal), las variables `FORGE_*` (junto a `FRAGUA_*`; dos valores distintos son un error y nunca amplían permisos) y los nombres de comandos `sdd.*`, carpetas y skills.
- Tabla completa de equivalencias en el [README](../README.md#forge--fragua-qué-cambia-y-qué-no).

## 8. Integraciones GitHub, GitLab y Jira

Detalle en [integraciones-externas.md](integraciones-externas.md).

- **Apagadas por defecto.** Sin la sección `integraciones:` no se abre ninguna conexión ni se lee ningún token.
- **Modos** por proveedor (`<proveedor>_modo`): `apagado`, `solo_lectura`, `comentar`, `proponer`.
- **El token no va en el archivo**: `<proveedor>_token_env` guarda solo el *nombre* de la variable de entorno (`FORGE_...`).
- **Escritura la concede el usuario**: `comentar` y `proponer` solo valen si defines `FORGE_INTEGRACIONES_ESCRITURA=<proveedor>` en tu entorno.
- **Aprobación con huella**: `publicar` deja la publicación pendiente; `vista <id>` muestra texto, destino y cuenta con una huella; `aprobar <id> --huella <hex>` publica solo lo que viste.
- **Kill-switch**: `FORGE_INTEGRACIONES=apagado` (o `forge integraciones apagar`) detiene todo, incluso lo ya aprobado.
- Subcomandos: `leer`, `publicar`, `pendientes`, `vista`, `aprobar`, `rechazar`, `estado`, `doctor [--red]`, `apagar`, `encender`. Salida: 0 bien, 1 rechazo o fallo, 2 uso incorrecto.
- **Nunca se han probado contra plataformas reales.**

## 9. Límites y estado

Lista completa en [PROBLEMAS-CONOCIDOS.md](PROBLEMAS-CONOCIDOS.md) y [limitations.md](limitations.md).

- Solo se probó en **Windows 11 con Docker Desktop**. El CI de Linux (`aislamiento`, `pruebas-docker`) **nunca corrió**.
- Probado en **proyectos pequeños**; sin evidencia en monorepos ni bases grandes.
- **OpenAI y Ollama** no tienen prueba real de extremo a extremo.
- Un **adversario deliberado** puede imitar la señal de aserción de las pruebas y esquivar la detección de éxito sospechoso.
- Con `motor.mutacion: exigir`, la tarea **se pausa si hay pocos mutantes concluyentes** (menos de `mutacion_min_concluyentes`), p. ej. en proyectos pequeños.
- La puntuación de mutación se midió en pocos proyectos.
- **Cifras de pruebas**: las de los documentos antiguos (998, 1405, 2055, 2214, 2468) están superadas. La cifra vigente, con su commit, está en [ESTADO-ACTUAL.md](ESTADO-ACTUAL.md).

Pendiente del dueño del proyecto:

- Poner en marcha y ver verde el CI en Linux.
- Pruebas con cuentas reales de GitHub, GitLab y Jira.
- Contrastar la **factura real del proveedor** con el **gasto calculado** por FORGE (las tarifas son una lista interna).
- Ratificar los ADR-19 a ADR-22.
- Publicar 5.0.0 en npm.
