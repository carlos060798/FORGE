# Reverificación de seguridad de FORGE/Fragua (C-01 a C-13)

> Fecha: 2026-11-07 · Auditor independiente, en modo escéptico · Alcance: **solo lectura**. El único archivo creado es este.
> Base: rama `main` (HEAD `8cc2e58`) **más los cambios sin commit del árbol de trabajo**, sobre todo en `.github/workflows/*`, `core/sandbox/preparar-imagen.js` y `cli/comandos/`.
> Método: se pasaron eventos JSON por stdin a `node claude-hooks/pre-tool-guard.js`, siempre desde carpetas temporales fuera del repositorio (scratchpad). Ningún comando de los eventos se ejecutó: el hook solo los recibe como texto. Además se hizo una lectura adversaria del código de aprobaciones, del sandbox y de CI. No se usó red.

## Resumen

- El guardián **bloquea todas las pruebas originales** del informe `SEGURIDAD-CIBER.md`: 25 de 26. La excepción es la escritura de `.sdd/estado.json`, que el propio informe pedía bloquear.
- Fallar cerrado es cierto **dentro del script**: un JSON roto, un evento vacío o con forma de array y un módulo ausente devuelven `exit 2`.
- **El hallazgo más grave ahora es lógico, no de sintaxis.** La puerta `spec → plan` (`core/state-machine.js:65`) solo comprueba el booleano `spec_aprobado` de `.sdd/estado.json`. El hook deja que el agente escriba ese archivo (`exit 0`) y el registro firmado `.sdd/aprobaciones.jsonl` no se consulta en ninguna puerta. En la práctica, `forge aprobar` con TTY y código de un solo uso no protege la aprobación de la spec.
- La tabla «Estado de la mitigación» **sobrestima** C-04, C-11 y la eficacia de C-03, y **subestima** C-08 y C-10: los digests y SHA ya están en el árbol de trabajo, aunque sin commit.
- **No se completó** la búsqueda sistemática de evasiones nuevas del analizador por argv (punto 2 del encargo). Ver la sección «Límites de esta reverificación».

**Nota de postura: 3 / 5** (antes era 2).

---

## 1. Prueba original contra el hook actual

Todas las pruebas se lanzaron desde una carpeta temporal con su propio cwd. El control benigno (`Bash ls`) devuelve `exit 0`.

| Hallazgo | Evento (del informe original) | Antes | Ahora |
|---|---|---|---|
| C-01 | `Write .claude/settings.json` | 0 | **2** |
| C-01 | `Write claude-hooks/pre-tool-guard.js` | 0 | **2** |
| C-01 | `MultiEdit .claude/settings.json` / `Write .claude/settings.local.json` | — | **2** / **2** |
| C-02 | `rm -r -f /`, `rm -fr /`, `rm --recursive --force ~` | 0 | **2** |
| C-02 | `rm -rf ./`, `rm -rf *`, `find . -delete` | 0 | **2** |
| C-02 | `Remove-Item -Force -Recurse C:\` (PowerShell) | 0 | **2** |
| C-02 | `git -c x=y push --force origin main`, `git push origin +main` | 0 | **2** |
| C-04 | `sed -i s/a/b/ .env`, `node -e "...writeFileSync('.env',...)"`, `echo {} > tsconfig.json` | 0 | **2** |
| C-04 | `Write TSCONF~1.JSO` (8.3), `NotebookEdit tsconfig.json`, `Read .env` | 0 | **2** |
| C-05 | `Write .sdd/execution-level.json` | 0 | **2** |
| C-05 | `Write .sdd/estado.json` | 0 | **0 (sigue permitido)** |
| C-05 | Con `{"nivel":"sandbox"}`: `Bash ls`, `PowerShell Get-Date`, `Write C:/Windows/x.txt` | 2 / 0 / 0 | **2 / 2 / 2** |
| C-06 | `CLAUDE_AGENT_NAME=revisor` + `Bash printf x > src/a.js` | 0 | **2** |
| C-07 | entrada `no-json`, cadena vacía, `[]` | 0 | **2** |
| C-07 | hook copiado sin `shared/` (módulo ausente) | 1 (no bloquea) | **2** |
| C-11 | `Write` con `sk-ant-api03-…` ficticio | 0 | **2** |
| C-03 | `Read` de `%LOCALAPPDATA%/fragua/integraciones/<h>/clave` | 0 | **2** |
| — | `FORGE_EDITAR_GUARDIAN=1 echo x > .claude/settings.json` (variable fijada en el propio comando) | — | **2** |

Pruebas adicionales que se hicieron para comprobar la tabla de mitigación, todas con valores ficticios:

| Prueba | Resultado | Implicación |
|---|---|---|
| `Grep` con `path: .env` | **0** | Lectura del contenido de `.env` sin pasar por `Read` (C-04) |
| `Glob .env*` | 0 | Solo da los nombres; impacto bajo |
| `Write` con `github_pat_` + 40 caracteres ficticios | **0** | El detector del hook no cubre `github_pat_` (C-11) |
| `Write` con `glpat-` + 24 caracteres ficticios | **0** | Ídem, `glpat-` (C-11) |
| `Bash echo github_pat_…` con `CLAUDE_AGENT_NAME=implementador` | 0, y el token queda **en claro** en `.sdd/observabilidad/agent-tool-audit.jsonl` | La redacción de la auditoría usa la lista corta del hook (C-09) |
| `node claude-hooks/pre-tool-guard.js` desde un cwd donde la ruta relativa no existe | **exit 1** | Error *no bloqueante* en el protocolo de hooks: falla abierto fuera del script (C-07) |

**Sobre `FORGE_EDITAR_GUARDIAN`.** El hook lee `process.env` de su propio proceso, que hereda de Claude Code. Un prefijo `VAR=1` dentro del texto del comando no llega al hook, y el analizador quita esa asignación y evalúa la redirección. Las vías persistentes que se revisaron (`.claude/settings*.json` con su clave `env`) están protegidas. Conclusión: el agente no puede fijarla en línea. Fijarla por otros medios dependería de saltarse primero C-01 o C-02.

---

## 2. Clasificación por hallazgo

| ID | Tabla previa | **Reverificación** | Evidencia / motivo |
|---|---|---|---|
| C-01 | Cerrado | **PARCIAL** | Write, Edit, MultiEdit y NotebookEdit sobre `.claude/settings*`, `.claude/hooks/**`, `claude-hooks/**`, `.git/**` y `execution-level.json` devuelven 2. Pero **`.sdd/estado.json` sigue escribible** (`exit 0`), aunque la corrección original lo incluía, y ese archivo decide la aprobación de la spec (ver C-03). La vía por shell hereda los límites de C-02. |
| C-02 | Cerrado (formas del informe) | **PARCIAL** | Las 11 formas originales están bloqueadas. La clase de ataque no está cerrada: `guardian-reglas.js` no expande variables, no resuelve alias ni funciones, no sigue `eval` y no inspecciona scripts ni rutas que se construyen en tiempo de ejecución. Los intérpretes solo se comprueban con rutas literales en el argumento. El propio código y la tabla lo admiten. Sigue siendo una lista de verbos prohibidos, no un límite. |
| C-03 | Mitigado, no cerrado | **ABIERTO** (spec) / PARCIAL (delegaciones) | `core/state-machine.js:65` exige solo `e.spec_aprobado === true`. `buscarAprobacion()` (`core/aprobaciones-identidad.js:236`) no se llama desde ningún sitio fuera de su módulo. Como el hook deja escribir `.sdd/estado.json`, el agente puede marcar la spec como aprobada sin TTY, sin código y sin entrada en `aprobaciones.jsonl`. Las delegaciones sí se verifican contra el registro (`cli/verificar.js:111`). La clave HMAC sigue siendo un archivo del mismo usuario. El hook bloquea su lectura por ruta literal, pero no impide que un proceso del usuario importe `core/estado-usuario.js` y firme; el propio módulo lo reconoce en sus líneas 19-29. |
| C-04 | Cerrado | **PARCIAL** | La escritura, el 8.3, NotebookEdit y `Read .env` están bloqueados. **`Grep` sobre `.env` está permitido** (`exit 0`): `pre-tool-guard.js:377` deja pasar cualquier herramienta que no sea de escritura, `Read`, `Bash` o `PowerShell`. |
| C-05 | Cerrado | **CERRADO** (formas del informe) | Con nivel `sandbox` se bloquean Bash, PowerShell y la escritura fuera del proyecto. El nivel se evalúa antes de cualquier salida y se usa `path.relative`. Queda un residuo: el nivel sigue viviendo en el árbol del proyecto, protegido solo por el hook. |
| C-06 | Cerrado en el hook | **PARCIAL** | Funciona **solo si** existe `CLAUDE_AGENT_NAME`. Sin la variable no hay guardia de solo lectura, y el aviso solo sale en las herramientas de escritura, no en Bash. No se verificó que Claude Code exponga esa variable. `agents/{arquitecto,critico,investigador,asesor-datos,seguridad,revisor}.md` siguen declarando `Bash`. `escribeAlgo()` es una lista de verbos prohibidos. Hay una incoherencia: `disenador-api` está en `READ_ONLY_AGENTS` pero declara `Write`. |
| C-07 | Cerrado | **PARCIAL** | Dentro del script es cierto: JSON roto, vacío, array y módulo ausente devuelven 2. **Fuera del script falla abierto:** `.claude/settings.json` registra `node claude-hooks/pre-tool-guard.js` con una ruta **relativa**. Si la ruta no resuelve (cwd distinto, archivo movido o borrado), Node sale con 1, que es un error no bloqueante, y la herramienta se ejecuta. Lo mismo pasa si `node` no está en el PATH (127). El `.sh` falla cerrado, pero no es lo que está registrado. |
| C-08 | Parcial (bases sin digest) | **PARCIAL** (mejor que la tabla) | En el árbol de trabajo (sin commit): bases `node:22-alpine@sha256:0e17…`, `python:3.12-slim@sha256:4840…` y `golang:1.23-alpine@sha256:3833…` (`preparar-imagen.js:24-27`); `pip --only-binary=:all:` (`:115`); `npm ci/install --ignore-scripts` (`:123-129`); `--ipc none`, `--network none`, `--cap-drop ALL`, `no-new-privileges`, `--read-only` y `--pull never` (`politica.js:146-160`). Pendiente: los digests no se pudieron cotejar sin red; `--require-hashes` solo actúa si el `requirements.txt` trae hashes; la construcción sigue teniendo red; no hay un perfil seccomp/AppArmor explícito. |
| C-09 | Parcial | **PARCIAL** | Comprobado: un `github_pat_…` ficticio queda en claro en `agent-tool-audit.jsonl`, porque `redactarSecretos()` del hook usa su lista corta y no `core/ciclo/redactar.js`. La deuda declarada del diario del ciclo no se volvió a comprobar. |
| C-10 | Parcial (acciones por etiqueta) | **PARCIAL** (mejor que la tabla) | En el árbol de trabajo (sin commit), todas las `uses:` están fijadas por SHA de 40 caracteres con un comentario de versión, se usa `npm ci --ignore-scripts` en todos los jobs y existe `.github/dependabot.yml`. `ci.yml` y `evals-modelo-real.yml` tienen `contents: read`, y `inputs.tope` va por `env`. Pendiente: `docs.yml:11-14` sigue con `pages: write` e `id-token: write` **a nivel de workflow**; no hay `npm audit signatures`; los SHA no se cotejaron con sus etiquetas (sin red). |
| C-11 | Cerrado | **PARCIAL** | El hook detecta `sk-ant-` pero **no** `github_pat_` ni `glpat-` (comprobado, `exit 0`), ni JWT ni webhooks de Slack. `core/ciclo/redactar.js:41-70` sí los tiene: sigue habiendo dos catálogos. |
| C-12 | Cerrado | **CERRADO** | `.claude-plugin/.claude/settings.json` ya no concede `WebSearch` ni `git commit`/`rm`/`add`; solo pruebas y `WebFetch(domain:arxiv.org)`. Quedan residuos: `.mcp.json` sigue con `npx -y @playwright/mcp@0.0.83`, y hay un MCP `github` HTTP nuevo que envía un PAT por cabecera (está bien que no lleve el token en claro, pero amplía la superficie). |
| C-13 | Cerrado | **CERRADO** | Se retiró `.sdd/adrs/`. `cargarPatronesDeArquitectura()` solo lee `.sdd/arquitectura/ADR-*.md` con `Estado: aceptada` y la sección explícita. El riesgo residual de DoS es leve: el agente puede escribir en `.sdd/arquitectura/`. |

No se observó **ninguna regresión** en las pruebas originales.

---

## 3. Correcciones propuestas para lo no cerrado

1. **C-03 / C-01: atar la puerta de spec al registro firmado.** En `core/state-machine.js` (`spec → plan`), sustituir `e.spec_aprobado` por `buscarAprobacion(cwd, { tipo: 'spec', id, sha256: hashDeArchivo(spec) }) !== null`, y tratar el booleano como caché, no como fuente de verdad. Añadir `.sdd/estado.json` y `.sdd/aprobaciones.jsonl` a `esRutaCriticaDelGuardian()`. Añadir una prueba con `estado.json` editado a mano con `spec_aprobado: true` y sin registro, que debe rechazarse. A medio plazo, el ADR del llavero del SO o la firma asimétrica.
2. **C-07: ruta absoluta del hook.** Registrar `node "$CLAUDE_PROJECT_DIR/claude-hooks/pre-tool-guard.js"` (y lo mismo en la plantilla instalada `.claude/hooks/…`), o registrar el `.sh`, que falla cerrado. Que `forge doctor` compruebe que la ruta registrada resuelve.
3. **C-04: cubrir `Grep`, y `Glob` como aviso.** Aplicar `esSecreto()` a `tool_input.path` y `tool_input.glob`/`pattern` de `Grep`, y por defecto a cualquier herramienta cuya entrada traiga una ruta (`path`, `file_path`, `notebook_path`). Mejor una lista de herramientas permitidas que la salida temprana actual de `pre-tool-guard.js:377`.
4. **C-11 / C-09: un solo catálogo de secretos.** Copiar `core/ciclo/redactar.js` a `claude-hooks/shared/`, como ya se hace con `guardian-reglas.js`, y usarlo tanto para detectar como para redactar la auditoría y la DLQ.
5. **C-06: no depender de una variable de entorno.** Quitar `Bash` de los `tools:` de los seis agentes de solo lectura (o sustituirlo por permisos `Bash(git diff *)`, `Bash(git log *)`, etc.). Corregir la incoherencia de `disenador-api`. Si falta `CLAUDE_AGENT_NAME`, avisar también en Bash y PowerShell.
6. **C-02: aceptar que es una red de seguridad.** Como defensa real, usar `permissions.deny` gestionado y ejecutar el agente en el sandbox. En el analizador, tratar como sospechoso, o pedir confirmación para, todo comando cuyo verbo u objetivos contengan expansiones (`$`, `%…%`), `eval`/`Invoke-Expression` o intérpretes con código inline. Hoy se dejan pasar si no aparece una ruta literal.
7. **C-08 / C-10: cerrar la deuda.** Hacer commit de los digests y SHA y cotejarlos con red. Mover los permisos de `docs.yml` al job `deploy`. Añadir `npm audit signatures`. Construir la imagen Python con `pip download` en un paso aparte o detrás de un proxy, y exigir hashes.
8. **Documentación.** Actualizar la tabla «Estado de la mitigación» de `SEGURIDAD-CIBER.md`: C-04 y C-11 a Parcial, C-03 a Abierto en la puerta de spec, y C-08 y C-10 con el estado real del árbol.

---

## 4. Límites de esta reverificación

- **El punto 2 del encargo (evasiones nuevas) no se ejecutó de forma sistemática.** Esta sesión se interrumpió y el alcance se recortó: solo se repitieron las pruebas ya publicadas en el informe original, más las comprobaciones de cobertura de herramientas, fallo cerrado, aprobaciones, sandbox y CI que figuran arriba. No se generó ni probó un catálogo de variantes nuevas: variables, alias, `eval`, here-docs, codificaciones, one-liners, `xargs`/`find -exec`, descriptores, mayúsculas, `..`, enlaces, ADS, alias de PowerShell o APIs .NET. La clasificación PARCIAL de C-02 se basa en la lectura del diseño de `guardian-reglas.js`, no en evasiones demostradas. Se recomienda convertir ese catálogo en una suite de regresión dentro de `tests/`, mantenida por el equipo.
- No se verificó que Claude Code exponga `CLAUDE_AGENT_NAME`, ni el comportamiento real cuando la sesión arranca en una subcarpeta.
- Sin red: los digests de las imágenes y los SHA de las acciones no se cotejaron.
- No se ejecutó Docker real.

## 5. Nota y prioridades

**Postura: 3 / 5** (antes era 2). La capa de hooks pasó de ser un filtro de regex que fallaba abierto a un analizador por argv que falla cerrado, protege su propio registro y supera todas las pruebas originales. El sandbox y la CI van bien encaminados, aunque esos cambios aún no tienen commit. No sube más porque la aprobación humana de la spec, que es el control de gobierno central del ciclo, sigue a una escritura de archivo de distancia, y porque varias filas «Cerrado» de la tabla no se sostienen.

Lo que sigue abierto, por prioridad:

1. **C-03 (ABIERTO):** la puerta `spec → plan` se fía de `spec_aprobado` en `.sdd/estado.json`, que el agente puede escribir. → Verificar contra `aprobaciones.jsonl` y proteger `estado.json` y `aprobaciones.jsonl`.
2. **C-07 (PARCIAL):** el hook se registra con una ruta relativa; si no resuelve, devuelve exit 1 y no bloquea. → `$CLAUDE_PROJECT_DIR` o el `.sh`.
3. **C-04 (PARCIAL):** `Grep` lee `.env`. → Cubrir toda herramienta con ruta.
4. **C-06 (PARCIAL):** los agentes de solo lectura dependen de una variable de entorno y conservan `Bash`.
5. **C-11 / C-09 (PARCIAL):** `github_pat_` y `glpat-` no se detectan y quedan en claro en la auditoría. → Un solo catálogo (`redactar.js`).
6. **C-02 (PARCIAL):** límite de diseño del análisis por argv. → `permissions.deny` gestionado, el sandbox y una suite de evasiones.
7. **C-01 (PARCIAL):** depende de 1 y 6.
8. **C-08 / C-10 (PARCIAL):** hacer commit y cotejar digests y SHA; permisos de `docs.yml` por job; `npm audit signatures`; red durante la construcción de Python.
