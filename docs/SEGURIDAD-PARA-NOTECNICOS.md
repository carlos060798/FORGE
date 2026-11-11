# Qué protege Fragua y qué no (sin jerga)

> Tipo: Explicación
> Última revisión: 2026-11-10 contra el commit 55a9dd9

Este texto es para quien usa Fragua y no es especialista en seguridad. Dice qué impide el software, qué intenta impedir sin garantizarlo y qué no cubre. La versión técnica y las pruebas están en [GARANTIAS-Y-LIMITES.md](GARANTIAS-Y-LIMITES.md), [../SECURITY.md](../SECURITY.md) y [ESTADO-ACTUAL.md](ESTADO-ACTUAL.md). Si este texto y esas fuentes discrepan, mandan ellas.

La versión anterior de este archivo trataba de tokens de GitHub y Vercel de un producto anterior (SDD-ES). Se retiró entera: no describía el código actual.

## 1. El contenedor sin red (solo en el ciclo verificado)

Cuando ejecutas `fragua run` o `fragua verificar`, las pruebas del código generado corren dentro de un contenedor Docker. Los argumentos con los que se lanza están en `argvRun` (`core/sandbox/politica.js`), y una prueba los compara sin necesitar Docker. Entre ellos:

| Argumento | Efecto |
|---|---|
| `--network none` | El código no tiene red |
| `--ipc none` | Sin memoria compartida con tu equipo ni con otros contenedores |
| `--user 1000:1000`, `--cap-drop ALL`, `--security-opt no-new-privileges` | Sin ser administrador dentro del contenedor y sin capacidades añadidas |
| `--read-only` y `/tmp` en memoria con `noexec` | El sistema de archivos del contenedor no se puede escribir salvo `/tmp`, donde no se ejecutan programas |
| `--cpus`, `--memory`, `--memory-swap`, `--pids-limit`, `--ulimit` | Límites de CPU, memoria, procesos, archivos abiertos y tamaño de archivo |
| `--pull never` | El contenedor no descarga imágenes |
| `--mount type=bind` de una copia | Solo ve una copia de trabajo, no tu proyecto original |

Qué NO cubre:

- Solo se aplica a lo que Fragua ejecuta en el ciclo verificado. **No envuelve** las órdenes que un agente lanza dentro de Claude Code (`Bash`): eso lo vigila el guardián (sección 2), que no es un contenedor.
- Docker real solo se ha probado en Windows 11 con Docker Desktop (2026-11-10, `tests/sandbox-real.test.js`, 11 de 11). **En Linux y macOS no se ha medido.** Ver [ESTADO-ACTUAL.md](ESTADO-ACTUAL.md) y [../SECURITY.md](../SECURITY.md).
- Un contenedor sin red y de solo lectura reduce el daño posible; no demuestra que no haya forma de salir de él.
- El archivo del proyecto puede pedir otro mecanismo de aislamiento (`sandbox.runtime`); solo se acepta `runc`, el de Docker por defecto, o uno que tú autorices con `FORGE_RUNTIMES_PERMITIDOS` (`runtimePermitido` en `core/sandbox/politica.js`).

## 2. El guardián: una red de seguridad, no un límite

Cuando usas Claude Code, un programa (`claude-hooks/pre-tool-guard.js`, con las reglas en `core/evidencia/guardian-reglas.js`) revisa cada acción del agente antes de que se ejecute y puede bloquearla. Bloquea, entre otras cosas (lista completa en [hooks.md](hooks.md)):

- Comandos destructivos: borrados recursivos de la raíz, de tu carpeta personal o del directorio actual, `git push` forzado, `git reset --hard`, `chmod 777`.
- Escribir en archivos de secretos (`.env`, salvo `.env.example`) o en la clave de estado de usuario.
- Escribir en su propia configuración (sus archivos, el registro de hooks, `.git`) y en la configuración de calidad protegida (por ejemplo `tsconfig.json`).
- Todo `Bash` o `PowerShell` si el nivel de ejecución es `sandbox`.

Cómo leerlo:

- **Falla cerrado**: si no puede leer el evento o cargar sus módulos, bloquea (`fallarCerrado`). Sin Node 20 o superior, la versión `.sh` también bloquea.
- **Analiza texto.** El propio archivo dice que es «una RED DE SEGURIDAD, no un límite». Alias, funciones de shell, `eval` o un script que se ejecuta después y hace el daño no se resuelven.
- Las reglas por agente (agentes de solo lectura) dependen de la variable `CLAUDE_AGENT_NAME`. Si Claude Code no la entrega, el guardián lo avisa y esas reglas quedan desactivadas.
- `FORGE_EDITAR_GUARDIAN=1` apaga la protección de sus propios archivos. Solo debe fijarla una persona al lanzar Claude Code.
- Solo existe en Claude Code. Otras herramientas no reciben guardián ([RELACION-CON-CLAUDE-CODE.md](RELACION-CON-CLAUDE-CODE.md)).

La defensa principal, según [../SECURITY.md](../SECURITY.md), son los permisos de Claude Code (`permissions.deny`) que configuras tú, y el aislamiento de la sección 1.

## 3. Qué impide un repositorio ajeno

Un repositorio que clonas puede traer archivos pensados para engañar al software. La revisión de seguridad cerró, cada caso con una prueba que fallaba antes, lo que muestra la tabla «lo que ya no puede hacer un repositorio ajeno» de [ESTADO-ACTUAL.md](ESTADO-ACTUAL.md):

- Enviar la clave del modelo a otro servidor (`base_url` y `api_key` del archivo del proyecto se ignoran con aviso; `core/llm-providers/index.js`).
- Escribir en tu carpeta personal con el instalador.
- Subir el tope de gasto o bajar los precios para que el gasto no cuente.
- Pedir más recursos al contenedor.
- Presentar una tarea como verificada con un estado fabricado.
- Hacer que el modelo lea un archivo de fuera del proyecto con `../` o un enlace.
- Autorizar destinos de red con una dirección puesta en su propio código.
- Ampliar las herramientas o rutas de un agente desde su propio perfil.
- Cambiar la configuración de herramientas de calidad desde el implementador.

Lo que se garantiza es **contención**, no detección: aunque el modelo obedezca a un archivo hostil, el motor limita lo que puede leer, escribir y ejecutar. Que el modelo no se deje engañar es un extra no garantizado. Cada garantía enlaza su prueba en [GARANTIAS-Y-LIMITES.md](GARANTIAS-Y-LIMITES.md).

## 4. Dónde viven las claves

- La clave del modelo (por ejemplo `ANTHROPIC_API_KEY`) se toma de tu entorno. El archivo del proyecto no puede redirigirla (sección 3).
- La clave que firma las aprobaciones y la cadena de evidencia (HMAC) se genera la primera vez y se guarda **fuera del árbol del proyecto**, en el estado de usuario: `%LOCALAPPDATA%\fragua\integraciones\<hash>\clave` en Windows, `~/.fragua/integraciones/<hash>/clave` en el resto, o bajo `FORGE_HOME` si la defines (`core/estado-usuario.js`). El guardián trata esa ruta como secreto.
- En Windows el modo 0600 no se aplica; la protección es la que hereda `%LOCALAPPDATA%`.
- Si guardas el estado sellado en otro equipo o pierdes la clave, no se puede reanudar (así se evita que un repositorio fabrique ese estado).
- No verificado: que ninguna orden de Fragua escriba nunca una clave de modelo en disco. Esta revisión no lo ha comprobado módulo por módulo.

## 5. Qué NO protege

- **Mismo usuario del sistema.** Agente y persona comparten usuario. La clave de firma es un archivo que ese usuario puede leer, así que un agente comprometido con acceso al disco **podría firmar**. La firma acredita integridad, no que lo aprobó una persona. La aprobación exige terminal interactiva (`forge aprobar`), y eso no cambia lo anterior.
- **Secretos partidos o codificados.** Un secreto dividido en dos cadenas, escrito en base64 o hexadecimal, o con un formato que ninguna lista conoce, pasa el control de salida.
- **Inyección de prompt.** No está probada de extremo a extremo con un modelo real. Las defensas se comprueban con modelos simulados.
- **Docker fuera de Windows.** Sin medir (sección 1).
- **Un adversario deliberado** puede imitar la señal de aserción de la medición de mutación (documentado en [ESTADO-ACTUAL.md](ESTADO-ACTUAL.md)).
- **Calidad del código generado.** Que pase las pruebas no significa que sea seguro; eso lo revisa tu proceso.
- **Integraciones GitHub, GitLab y Jira**: probadas solo contra servidores falsos.
- **Ataques que ya controlan tu cuenta de sistema operativo.**

## 6. Qué hacer tú

1. Configura `permissions.deny` en Claude Code; es la defensa principal.
2. No pegues secretos en archivos del proyecto ni en conversaciones con el agente.
3. Revisa lo que un repositorio ajeno trae antes de ejecutar nada.
4. Antes de aprobar un cambio que el sistema pide revisar (destino de red nuevo, secreto rechazado), léelo.
5. Informe de vulnerabilidades: [../SECURITY.md](../SECURITY.md).
