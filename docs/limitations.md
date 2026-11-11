# Limitaciones

> Tipo: Referencia
> Última revisión: 2026-11-10 contra el commit 55a9dd9

Tabla única de límites comprobados contra el código el 2026-11-10. Los límites del ciclo, las pruebas, el gasto y el aislamiento, con su detalle, están en [PROBLEMAS-CONOCIDOS.md](PROBLEMAS-CONOCIDOS.md); lo que se garantiza y con qué prueba, en [GARANTIAS-Y-LIMITES.md](GARANTIAS-Y-LIMITES.md); el estado general, en [ESTADO-ACTUAL.md](ESTADO-ACTUAL.md).

| Límite | Evidencia | Qué hacer |
|---|---|---|
| Que las pruebas pasen no prueba que el código sea correcto; un pase se puede falsear parcialmente | PROBLEMAS-CONOCIDOS C-2, P-1 | Revisa el diff y ejecuta las pruebas tú |
| El ciclo verificado exige Docker; sin él `fragua run` sale con código 4 | `docs/referencia-cli.md` (`run`) | Abre Docker Desktop. `--motor clasico` ejecuta en tu equipo sin aislamiento; `motor.modo: clasico` en la configuración no basta, hay que pedirlo en la orden (`core/engine-cli.js`) |
| Aislamiento probado con Docker real solo en Windows 11 (Docker Desktop); no en Linux ni macOS | ESTADO-ACTUAL («Docker real en Windows»), PROBLEMAS-CONOCIDOS A-1, PL-1 | No lo des por garantizado fuera de Windows |
| La CI de GitHub no ha estado verde en Linux (último run comprobado el 2026-11-09, en rojo) | ESTADO-ACTUAL («CI de GitHub») | Ver el estado actual antes de fiarte de Linux |
| Solo JavaScript/TypeScript, Python y Go en el ciclo; Python lee dependencias solo de `requirements.txt` | `core/sandbox/preparar-imagen.js`, MIGRACION-5.0 2.2 y 4.2 | Otros lenguajes: modo clásico |
| La instalación de dependencias en la imagen del contenedor usa red | PROBLEMAS-CONOCIDOS A-4 | Ten presente que la preparación de la imagen no es «sin red» |
| Los agentes son archivos Markdown, no procesos; no se comunican salvo por artefactos en `.sdd/` | `agents/*.md` | Aprueba la spec; los hooks solo frenan escrituras (`claude-hooks/pre-tool-guard.js`), no el razonamiento |
| Las tareas de código del ciclo se ejecutan de una en una, y una tarea en revisión detiene la ejecución | MIGRACION-5.0 2.7 (tomado del CHANGELOG, no vuelto a comprobar) | No contar con paralelismo |
| El flujo interactivo completo (`/sdd.*`) es nativo de Claude Code. En otras herramientas se instala como skills adaptadas (sin probar en real; ver la sección «Fuera de Claude Code»). `run`, `resume`, `verificar`, `api` y `mcp` no dependen de la herramienta, pero necesitan un proveedor de modelo y, el ciclo, Docker | `docs/referencia-cli.md`, [ANFITRIONES.md](ANFITRIONES.md) | Fuera de Claude Code, usa esas órdenes o las skills adaptadas |
| Solo Anthropic se ha probado con llamadas reales; OpenAI y Ollama, contra servidores falsos; Gemini no está soportado | PROBLEMAS-CONOCIDOS G-3, ESTADO-ACTUAL («Proveedores») | Usa Anthropic para algo que importe |
| El gasto calculado nunca se comparó con una factura | PROBLEMAS-CONOCIDOS G-1 | Mira la consola del proveedor y fija un tope allí |
| Instalar en otras herramientas (`--integracion`) no se ha probado en ninguna real y el guardián por hooks solo se instala con `--con-hooks` (Cursor, Copilot, Gemini, Codex), sin probar y consultivo donde la herramienta falla abierto | ESTADO-ACTUAL («Instalación agnóstica»), [RELACION-CON-CLAUDE-CODE.md](RELACION-CON-CLAUDE-CODE.md) | Verifica a mano en tu herramienta |
| Integraciones con GitHub, GitLab y Jira: probadas solo contra servidores falsos; todo lo que escribe queda pendiente de tu aprobación | ESTADO-ACTUAL («Límites conocidos»), [INTEGRACIONES.md](INTEGRACIONES.md) | No las uses en producción sin probarlas |
| Un estado del ciclo guardado en otro equipo, o tras perder la clave de sellado, no se puede reanudar | ESTADO-ACTUAL («Límites conocidos») | Empieza la tarea de nuevo en ese equipo |
| `fragua aprobar` comparte usuario del sistema con el ciclo: no hay separación criptográfica total | `docs/referencia-cli.md` (`aprobar`), `core/aprobaciones-identidad.js` | Ejecútalo tú, en una terminal real |
| Secretos partidos, en base64 o en hexadecimal no los detecta el control de salida | ESTADO-ACTUAL («Límites conocidos»), GARANTIAS-Y-LIMITES | No confíes el secreto al modelo |
| Con `--motor clasico` (o en el modo clásico) las pruebas corren en tu equipo, sin aislamiento ni parada dura de gasto | PROBLEMAS-CONOCIDOS A-5, G-7 | Úsalo solo con código que ya confíes |
| Migración de la memoria de agentes de Markdown a SQLite: no se ha encontrado un comando que la haga (solo `fragua decisions migrate`, que importa `ADRs.jsonl`) | `cli/decisions.js`. No verificado para la memoria de agentes | No cambies `memoria.backend` a mitad de un proyecto |
| `mcp-figma/` tiene código (8 herramientas, 780 líneas en `mcp-figma/src/`) pero ningún archivo de `tests/` lo cubre y no se ha ejecutado contra Figma real | `mcp-figma/README.md`; `ls tests` sin ruta a Figma | Trátalo como no probado |
| El dashboard (`fragua ui`) muestra solo las últimas 50 entradas de `consumo.jsonl` y `events.jsonl`, solo atiende `GET` y se cierra a los 30 minutos sin uso | `ui/server.js` (`readLastJsonlLines`, `IDLE_TIMEOUT_MS`) | El archivo completo está en `.sdd/observabilidad/` |
| La suite de pruebas deja 31 omitidas en Windows (Docker real, enlaces simbólicos de archivo, proveedores sin herramientas, cuenta real, SDK opcional, permisos POSIX) y es inestable bajo carga en algunas máquinas | ESTADO-ACTUAL («Cifras», «La última pasada»), [COBERTURA.md](COBERTURA.md) | Corre las de Docker con `FORGE_TEST_DOCKER=1` |
| Para una tarea puntual de minutos, el recorrido spec, plan y tareas cuesta más que el cambio | [PRIMEROS-15-MINUTOS.md](PRIMEROS-15-MINUTOS.md) | Usa tu herramienta de código directamente |

## Fuera de Claude Code: problemática vigente (2026-11-11)

Qué recibe cada herramienta: [ANFITRIONES.md](ANFITRIONES.md). Cómo se usa: [USO-EN-OTRAS-HERRAMIENTAS.md](USO-EN-OTRAS-HERRAMIENTAS.md).

| Límite | Evidencia | Qué hacer |
|---|---|---|
| **Ninguna herramienta distinta de Claude Code está probada en una instalación real**: skills, roles, agentes nativos y hooks tienen pruebas automáticas con eventos y archivos construidos, no capturas de la herramienta | `tests/instalacion-anfitrion.test.js`, `tests/hooks-anfitrion.test.js`, `tests/agentes-nativos.test.js` | Prueba tú en tu herramienta y anota el resultado en `.sdd/especificaciones/2026-11-10-metodologia-agnostica/verificacion.md` |
| Los esquemas de hooks y de agentes de otras herramientas se leyeron de resúmenes de la documentación oficial (WebFetch), no de copias literales | spikes en `.sdd/especificaciones/2026-11-10-metodologia-agnostica/spikes/` | Contrasta el archivo generado con la documentación vigente de tu herramienta |
| Los hooks de Gemini CLI, Codex y Windsurf **fallan abiertos**: si el hook se rompe o falta `fragua`, la acción continúa. Cursor (`failClosed`) y Copilot (ante error) fallan cerrados; el plugin de opencode, también | `core/instalacion/hooks-anfitrion.js` (notas de cada plantilla) | No lo trates como barrera; el aislamiento del ciclo verificado sí aplica en cualquier herramienta |
| Cobertura parcial: el guardián de Windsurf solo evalúa comandos de terminal y el de opencode solo la lectura de archivos; el resto de herramientas pasa sin evaluar | `core/instalacion/hooks-anfitrion.js` | Revisa los cambios de esas herramientas a mano |
| **Kiro no tiene guardián**: su documentación no da los nombres de herramienta ni las claves de entrada | `SIN_ADAPTADOR_POR_AHORA` en `core/instalacion/hooks-anfitrion.js` | Sin guardián en Kiro |
| Los agentes de solo lectura conservan `Bash` en los formatos nativos: fuera de Claude Code, nada les impide escribir por la terminal si la herramienta no tiene hook | `core/instalacion/agentes-nativos.js` | Revisa lo que ejecutan |
| opencode, Kiro, Zed y Goose no tienen memoria de agentes por hooks; Zed, Goose, Windsurf y la carpeta común no reciben agentes nativos (solo roles) | [ANFITRIONES.md](ANFITRIONES.md) | Usa los roles `rol-*` |
| Sin subagentes, un rol se ejecuta en la misma conversación: pierde el contexto aislado y lo paralelo pasa a secuencial | `core/instalacion/adaptar-anfitrion.js` (nota de anfitrión) | Es el comportamiento esperado de la adaptación |
| Los hooks necesitan Node ≥ 20 y la orden `fragua` en el PATH; sin ella, Cursor y Copilot bloquean y Gemini, Codex y Windsurf dejan pasar | [runtime.md](runtime.md), [referencia-cli.md](referencia-cli.md) | Instala `fragua` globalmente antes de usar `--con-hooks` |
| `--con-hooks` nunca pisa un archivo de hooks existente: si ya tienes uno, hay que añadir la orden a mano | `tests/instalacion-con-hooks.test.js` | Sigue el aviso que imprime la instalación |

## Quitado de la versión anterior de este documento

Estas afirmaciones se comprobaron y ya no son ciertas, o no se pudieron sostener:

- «Los presets no son activables como comando»: `/sdd.configurar preset:lean|startup|enterprise` existe (`commands/sdd.configurar.md`).
- «FORGE no tiene CLI propia»: existe (`cli/index.js`, con subcomandos como `run`, `verificar`, `api`, `mcp`).
- «Hay archivos `.skip` en `tests/`»: ya no.
- «`cache-audit`, `orquestacion-ptc` y el modo `prototipo` no están conectados / no se respetan»: no se encontró evidencia; `commands/sdd.implementar.md` usa `orquestacion-ptc` y `sdd.especificar`/`sdd.implementar` leen el modo prototipo. Sin verificar el resto de comandos.
- «Los proyectos de más de 500 archivos degradan la memoria»: sin medición en el repositorio.
