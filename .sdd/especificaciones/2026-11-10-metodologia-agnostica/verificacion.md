# Verificación: metodologia-agnostica

> **Fecha:** 2026-11-11 · Escrita a mano leyendo `spec.md`, `core/instalacion/adaptar-anfitrion.js`, `cli/comandos/instalar.js` y los archivos de `tests/` citados. **No se ejecutó la suite al escribirla**; la última pasada completa que consta en la sesión (4245 pruebas, 0 fallos, 31 saltadas) es anterior a algunos cambios en curso de otros agentes. Sin revisión independiente.

## Criterio → pruebas

| Criterio | Prueba | Estado |
|---|---|---|
| CA-001-01 órdenes `/sdd.x` en cuerpo y `description` | `tests/instalacion-anfitrion.test.js`: «cambia /sdd.x por la invocación de la herramienta y respeta rutas y archivos»; el lint de cada integración («${clave}: todos los comandos y skills propias salen válidos y sin sintaxis ajena») busca órdenes con punto que queden | **Con prueba.** El lint solo mira órdenes con punto (`sdd.x`); `/forge` y `/compact` quedan fuera de la comprobación |
| CA-001-02 sin `allowed-tools` ni «Claude Code» fuera de la nota | «quita allowed-tools, antepone la nota y conserva el resto de la cabecera»; lint por integración | **Con prueba.** El lint comprueba `allowed-tools` solo en la cabecera, porque la plantilla de `sdd.crear-agente` lo nombra a propósito en el cuerpo |
| CA-001-03 la nota explica `Task`, `TodoWrite`, `/effort`, `$CLAUDE_PLUGIN_ROOT`, hooks y lo paralelo | La nota se genera en `notaDeAnfitrion`; la prueba de `adaptarSkill` comprueba que se antepone | **A medias.** Ninguna prueba comprueba el contenido de cada equivalencia |
| CA-001-04 prueba que falla ante skill inválida o sintaxis excluida | Un test por cada clave distinta de `claude`, con `validarSkill` | **Con prueba** |
| CA-001-05 fuentes y salida de `claude` sin cambios | `tests/instalacion-equivalencia.test.js` («init + update ... producen el árbol de la foto») | **Con prueba** |
| CA-002-01 un `rol-<agente>` por agente, válido | «cada agente da una skill rol-* válida con nivel y herramientas» (14 agentes); «init --integracion cursor instala 14 roles ...» | **Con prueba** |
| CA-002-02 `metadata` con nivel y herramientas | mismo test: comprueba `forge-nivel`; las herramientas se generan pero la aserción no las verifica | **A medias** |
| CA-002-03 sin cita al hook de memoria | mismo test: ningún rol contiene `agent-memory.js` ni «Claude Code»; ««Claude Code» pasa a un nombre neutral y la frase del hook de memoria se sustituye» | **Con prueba.** No comprueba que el texto de reemplazo diga `.sdd/memoria/` en los roles |
| CA-002-04 escritura segura de roles | Código en `copiarSkillsDeIntegracion` (no pisa si existe y difiere). Las pruebas de archivo ajeno, unión y enlace duro son de las skills (`tests/instalacion-integraciones.test.js`, F1.4) | **Sin prueba específica de roles** |
| CA-002-05 mensaje final con roles y lo no recibido | La instalación real comprueba `14 roles` en la salida | **A medias.** El texto de hooks/guardián/memoria no tiene aserción |
| CA-003-01 matriz sin herramienta «probada» sin registro | `docs/ANFITRIONES.md` | **Solo documento; sin prueba.** Ninguna herramienta figura como probada |
| CA-003-02 README, estado y hoja de ruta coherentes con la matriz | `README.md`, `docs/ESTADO-ACTUAL.md`, `docs/roadmap.md` | **Solo documento; sin prueba** |

## Qué quedó a medias o sin hacer

- **Prueba manual por herramienta (F5):** no hecha; la hace el dueño. Los criterios de éxito «al menos dos herramientas con registro de prueba manual» y «los 14 agentes y los 39 comandos válidos en las nueve integraciones» no se cumplen del todo: el lint cubre las integraciones automáticamente, pero no hay registro manual alguno. La tabla ya tiene diez claves con `codex`.
- **Agentes en formato nativo, memoria por herramienta y herramienta MCP consultiva:** los hacen otros agentes ahora mismo. **En curso, sin evidencia todavía.**
- **Nada se ejecuta en una herramienta real:** las pruebas instalan en carpetas temporales y comprueban archivos y texto, no que la herramienta cargue la skill.

## Guion de prueba manual (F5)

> Lo ejecuta el dueño, a mano, en la herramienta real. **Este guion no trae resultados: están en blanco a propósito.** Hasta que la tabla del final tenga filas rellenadas, ninguna herramienta distinta de Claude Code cuenta como «probada» (regla de `AGENTS.md`: lo no verificado se marca como tal). Lo que cada paso «debería» mostrar sale del código y de la documentación leída, no de haberlo visto en la herramienta.

### Antes de empezar (una vez)

1. Tener **Node 20 o superior** y la herramienta instalada. Anota la versión de la herramienta (la ves en su menú «Acerca de» o con su opción `--version`).
2. Poner `fragua` en el PATH **desde la rama que lleva todas las correcciones**: `feature/cierre-auditoria`, commit `fd436d1` o posterior (en este equipo, la carpeta `forge/wt-cierre`). **No instales desde `forge/FORGE` mientras esa rama no esté fusionada en `feature/anfitriones`**: esa carpeta tiene el guardián anterior, que deja pasar `shell rm -rf /` en Codex, y probarías algo que ya está corregido.

   ```
   cd forge/wt-cierre
   git log --oneline -1
   npm install
   npm install -g .
   fragua --version
   ```

   Los hooks llaman a `fragua` por nombre: sin esto el guardián no corre (y Cursor, que falla cerrado, bloquearía toda herramienta).

   **Comprobación de que instalaste el código correcto** (debe imprimir `2`; si imprime `0`, es el guardián anterior y hay que reinstalar):

   ```
   echo '{"tool_name":"shell","tool_input":{"command":"rm -rf /"}}' | fragua guardian evaluar --anfitrion codex; echo $?
   ```
3. Crear una carpeta de prueba **fuera** del repositorio de Fragua. No pruebes dentro de un proyecto con datos reales.

### Cursor

1. Crear el proyecto y abrirlo en una terminal:

   ```
   mkdir prueba-cursor
   cd prueba-cursor
   git init
   ```

2. Instalar:

   ```
   fragua init --integracion cursor --con-hooks
   ```

   Debería terminar sin error y decir que registró el guardián en `.cursor/hooks.json`.
3. Comprobar que existen: `.cursor/skills/forge/SKILL.md`, `.cursor/skills/rol-revisor/SKILL.md`, la carpeta `.cursor/agents/`, `.cursor/hooks.json` y `AGENTS.md`.
4. Ejecutar el diagnóstico:

   ```
   fragua doctor
   ```

   Debería informar la integración `cursor` y, con los hooks registrados, si `fragua` está en el PATH. Anota cualquier aviso tal cual.
5. Abrir la carpeta `prueba-cursor` en Cursor. Comprobar que Cursor **lista** la skill `forge` (anota en qué pantalla la ves, o que no aparece).
6. En el chat del agente, invocar el flujo con la sintaxis de Cursor:

   ```
   /forge "una lista de tareas con título y fecha límite"
   ```

   Anota si la skill se carga, qué pregunta primero y si el texto trae restos de otra herramienta (`Task(`, `$sdd`, `/effort`).
7. Probar un rol: `/rol-revisor revisa el archivo AGENTS.md`. Anota si responde como revisor y si se detiene sin escribir archivos.
8. Probar un agente nativo: en el selector de agentes de Cursor, buscar los de Fragua (por ejemplo `revisor`). Anota si aparece.
9. **Provocar el guardián con algo inofensivo.** Crear un `.env` con un valor falso:

   ```
   echo "CLAVE_FALSA=esto-no-es-un-secreto" > .env
   ```

   Pedir al agente: «lee el archivo `.env` y muéstrame su contenido». Debería **bloquearse** con un mensaje de FORGE que explica el motivo. Anota si se bloquea, si el mensaje te llega y si el agente lo entiende. Si el archivo se muestra, el guardián no corrió: anótalo como fallo.
10. Opcional, fallo cerrado: quitar `fragua` del PATH de esa sesión y repetir una acción cualquiera. En Cursor debería bloquear (por `failClosed`), no dejar pasar. Anótalo.
11. Limpiar: borrar `.env` y la carpeta de prueba.

### Codex CLI

1. Crear el proyecto:

   ```
   mkdir prueba-codex
   cd prueba-codex
   git init
   ```

2. Instalar:

   ```
   fragua init --integracion codex --con-hooks
   ```

   Debería registrar el guardián en `.codex/hooks.json`.
3. Comprobar que existen: `.agents/skills/forge/SKILL.md`, `.agents/skills/rol-revisor/SKILL.md`, la carpeta `.codex/agents/` (archivos `.toml`), `.codex/hooks.json` y `AGENTS.md`.
4. `fragua doctor`, con el mismo criterio que arriba.
5. Abrir Codex en esa carpeta. **Los hooks del proyecto solo se cargan si la carpeta `.codex/` es de confianza, y hay que revisarlos y aprobarlos dentro de Codex.** Anota si Codex te lo pidió y cómo.
6. Invocar el flujo con la sintaxis de Codex:

   ```
   $forge "una lista de tareas con título y fecha límite"
   ```

   Anota lo mismo que en Cursor. Si `$forge` no se reconoce, prueba `/skills` y anota cómo se llama allí.
7. Rol: `$rol-revisor revisa el archivo AGENTS.md`.
8. **Guardián:** crear el `.env` falso como arriba y pedir «ejecuta `cat .env`». Debería bloquearse. Anota el resultado.
9. **Importante, Codex falla abierto:** si `fragua` falta del PATH o el hook se rompe, la acción **continúa**. Si quieres comprobarlo, quita `fragua` del PATH y repite el paso 8: lo esperado según la documentación es que el archivo se muestre. Anótalo como límite, no como fallo.
10. Limpiar.

### Captura del evento real (lo más valioso de toda la prueba)

Hasta hoy los traductores del guardián se probaron con eventos **escritos a mano** a partir de la documentación (CA-002-04 de `2026-11-11-guardian-fuera-de-claude-code`, pendiente). Con esta captura se sabe, por primera vez, cómo se llaman de verdad las herramientas de Cursor y de Codex y qué campos traen. Haz esto **en Cursor y en Codex**, después de los pasos del guardián y antes de limpiar:

1. En el archivo de hooks que creó `init` (`.cursor/hooks.json` o `.codex/hooks.json`), apunta la orden actual (`fragua guardian evaluar --anfitrion <clave>`) y **sustitúyela temporalmente** por:

   ```
   sh -c 'mkdir -p capturas && tee "capturas/$(date +%s%N).json" | fragua guardian evaluar --anfitrion <clave>'
   ```

   (`<clave>` es `cursor` o `codex`.) `tee` guarda el evento tal como llega y lo pasa al guardián; el código de salida es el del guardián, así que el bloqueo sigue funcionando. En Windows, si la herramienta no encuentra `sh`, usa Git Bash o WSL y anótalo.
2. Repite en la herramienta estas cuatro peticiones, una tras otra: «ejecuta `ls`», «ejecuta `git push --force origin main`» (el repositorio de prueba no tiene remoto: si el guardián fallara, `git` solo daría error), «crea el archivo `src/a.js` con `console.log(1)`» y «lee el archivo `.env`».
3. Guarda la carpeta `capturas/` entera **sin editarla** y anota cuántos archivos salieron. Si no sale ninguno, el hook no se ejecutó: es un hallazgo, anótalo.
4. **Restaura la orden original** en el archivo de hooks.

Con esos archivos se añaden pruebas con eventos reales en `tests/fixtures/` y se ajustan las tablas de nombres de `core/instalacion/hooks-anfitrion.js`. Si una petición peligrosa **pasó** (la acción se ejecutó), anótalo tal cual con su captura: es un fallo de seguridad del guardián en esa herramienta, no un detalle.

### Las demás herramientas (misma receta)

Para Copilot, Gemini CLI, Windsurf, opencode, Kiro, Zed, Goose, la carpeta común y la genérica: `fragua init --integracion <clave> [--con-hooks]`, comprobar la carpeta de skills de la tabla de `core/instalacion/herramientas-destino.js`, invocar `forge` con la sintaxis de esa fila, probar un rol y, si la herramienta tiene adaptador de hook (Copilot, Gemini, Windsurf, opencode), repetir el paso del `.env`. Kiro, Zed, Goose, `agents` y `generica` no tienen adaptador de hook: allí solo se prueban skills, roles y agentes.

### Registro de resultados (en blanco)

Rellena una fila por herramienta y por intento. Usa `OK`, `FALLA` o `NO APLICA`, y en «Notas» lo que viste, aunque sea raro.

| Herramienta | Versión de la herramienta | Fecha | Commit de `fragua` instalado | Instalación | Skill cargada | Rol | Agente nativo | Guardián bloquea | Falla abierto/cerrado observado | Capturas (n.º de archivos) | Notas |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Cursor | | | | | | | | | | | |
| Codex CLI | | | | | | | | | | | |
| GitHub Copilot | | | | | | | | | | | |
| Gemini CLI | | | | | | | | | | | |
| Windsurf | | | | | | | | | | | |
| opencode | | | | | | | | | | | |
| Kiro | | | | | | | | | | | |
| Zed | | | | | | | | | | | |
| Goose | | | | | | | | | | | |

Con al menos dos filas rellenadas se cumple el criterio de éxito de esta spec («al menos dos herramientas con registro de prueba manual»). Lo que falle va a su propia spec, no se maquilla aquí.

## Límites de este documento

- Se leyó el código y las pruebas, no se corrieron.
- Los nombres de test son los de los archivos al 2026-11-11; otros agentes editan `tests/` en paralelo.
