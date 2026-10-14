# S0.2 Nombres «forge» usados COMO DATO

Alcance: producción (core/, cli/, claude-hooks/, ui/, scripts/, .github/, manifiestos). Sin textos de ayuda ni comentarios. Excluidos `node_modules`, `.claude/worktrees` y `tests/` (varias pruebas fijan estos valores).

## 1. Datos persistentes del usuario

| Dato | Dónde | Qué se rompe si cambia | ¿Persistente? |
|---|---|---|---|
| Carpeta de estado Windows `%LOCALAPPDATA%\forge\integraciones\<hash32>` | core/integraciones/estado-usuario.js:52 | Se pierden la `clave` HMAC, las aprobaciones pendientes firmadas y los contadores | SÍ: clave, `pendientes/*.json`, `<id>.lock` (aprobacion.js:485) |
| Carpeta de estado Unix `~/.forge/integraciones/<hash>` | estado-usuario.js:54 | Igual | SÍ |
| `FORGE_HOME` + `/integraciones` | estado-usuario.js:46-47 | Igual (la variable es F3; la subcarpeta `integraciones` es el dato) | SÍ |
| Clave HMAC `clave` y firma `createHmac(...).update(canonico(valor))` | estado-usuario.js:113-143 | La firma no contiene la cadena «forge»: sigue válida si se conserva la clave | SÍ |
| Hash del proyecto (sha256 de la ruta real) | estado-usuario.js:63-66 | No depende del nombre | - |
| `forge.config.json` del proyecto | claude-hooks/shared/config.js:43; configuracion-ejemplo/forge.config.json | Los hooks caen a los valores por defecto sin error (`write_safety`, `verify_local_imports`) | SÍ (proyectos de usuarios) |
| `.forge-ui/` en el proyecto | cli/index.js:745,1280,1576 | `forge ui` y `doctor` no encuentran el panel instalado | SÍ |
| `forge-version:` y `## FORGE` en CLAUDE.md | cli/index.js:442,454,1199 | `init`/`doctor` no reconocen su bloque: duplican la sección o marcan «desactualizado» | SÍ (CLAUDE.md del usuario) |
| `<!-- Generado por FORGE` en AGENTS.md | core/agents-md.js:17 | No se reconoce un AGENTS.md propio | SÍ |
| `forge_version` en exportaciones | cli/export.js:206 | Importar exportaciones antiguas | SÍ |
| `.sdd/` (estado, motor, apagado) | todo | No lleva «forge»: no cambia | SÍ |

## 2. Contenedores, imágenes y procesos

| Dato | Dónde | Qué se rompe | ¿Persistente? |
|---|---|---|---|
| Etiqueta `forge.sandbox=1` | core/sandbox/politica.js:7 (uso :133); docker-cli.js:9,225-226 (`barrerHuerfanos`) | Contenedores creados por la versión vieja dejan de barrerse: siguen vivos | Contenedores en el equipo |
| Etiqueta `forge.sandbox=1` en CI | .github/workflows/ci.yml:86,124 | La comprobación «no quedan contenedores» pasaría siempre en verde | No |
| Etiqueta de proyecto `forge.proyecto=<id>` | politica.js:15; sandbox-runner.js:230 | El barrido por proyecto no encuentra los viejos (la spec no la menciona) | Contenedores |
| Etiqueta de imagen `forge.sandbox.imagen=1` | docker-cli.js:198 | Limpieza de imágenes | Imágenes locales |
| Nombre `forge-sbx-<runId>-<n>` | politica.js:83 | Solo informativo | Efímero |
| Imagen `forge-sbx:<lenguaje>-<huella>` | preparar-imagen.js:162 | Reconstruir todas las imágenes (caché fría) | Imágenes locales |
| `Symbol.for('forge.integraciones.base-local-de-pruebas')` | pruebas-internas.js:13 | Un cambio silencioso desactiva el modo de pruebas | No |
| User-Agent `forge-integraciones/1` | http.js:34 | Sin impacto funcional | No |
| `forge-go` ($0 de `sh -c`) | sandbox-runner.js:32 | Nada | No |

## 3. Ramas y marcadores publicados

| Dato | Dónde | Qué se rompe | ¿Persistente? |
|---|---|---|---|
| Prefijo de rama `forge/` | integraciones/publicacion.js:33; github.js:37,466; gitlab.js:33,454; aprobacion.js:182 (`startsWith(PREFIJO_RAMA)`) | Pendientes ya firmados con `forge/…` fallan la validación al publicar; ramas publicadas dejan de reconocerse | SÍ: ramas en GitHub/GitLab y pendientes |
| Marcador `<!-- forge:ID -->` | github.js:203,415,490; gitlab.js:356,373,459 | La idempotencia busca el marcador: con otro nombre se republican comentarios duplicados; no se pueden migrar los ya publicados | SÍ (servicios externos) |
| Commit `forge:<marcador>` | github.js:524 | Reconocimiento de commits propios | SÍ |
| Jira `FORGE-ID: <id>` | jira.js:397,418,427 | Igual: idempotencia por línea | SÍ (Jira) |
| Derivación `forge-derivado:<marcador>` | integraciones/marcador.js:19 | Cambia los sufijos `.r<hash>`; un reintento no encuentra su comentario | SÍ |
| Textos «Propuesta generada por FORGE.», aviso fijo | gitlab.js:513; confianza.js:286 | Cosmético (pruebas lo fijan) | No |

## 4. Paquete, manifiestos y comandos

| Dato | Dónde | Qué se rompe | ¿Persistente? |
|---|---|---|---|
| Paquete `forja-mvp` | package.json:2; cli/runner.js:47; docs-site/assets/data.js:58,78,111,887,966; tests/consistencia-cifras.test.js:385-389; tests/empaquetado.test.js:86 | Quien tiene `npm i -g forja-mvp` no recibe la 5.0 sin migrar; hay que deprecar con enlace. `.claude/settings.json:23-24` usa `forge-sdd`, nombre distinto: incoherente | Instalaciones |
| bin `forge`, `fragua`, `sdd-es` | package.json:8 | Hecho en F1 | - |
| Plugin `name: forge`, marketplace `forge-marketplace` | .claude-plugin/plugin.json:3; marketplace.json:2,13 | Cambia el espacio de nombres de comandos; las instalaciones existentes pierden la habilitación | SÍ (plugins instalados) |
| Comandos `/forge`, `/forge.explicame`, `/forge.desplegar`, `/forge.diseño` | cli/index.js:406-1788 y archivos de comandos | El nombre de archivo es el comando del usuario | SÍ (`.claude/commands` ya copiadas) |
| Clave MCP `"forge"` | cli/index.js:1773 | Solo ejemplo; el cliente del usuario ya la tiene | Configs de clientes |
| URL `carlos060798/FORGE` | plugin.json:6-12; marketplace.json:5,21; package.json:69-72 | GitHub redirige, el marketplace instalado apunta a la URL | Instalaciones |

## 5. Archivos temporales y de bloqueo

| Nombre | Dónde | Qué se rompe | ¿Persistente? |
|---|---|---|---|
| `<archivo>.forge-tmp-<pid>-<hex8>` y `/^.+\.forge-tmp-\d+-[0-9a-f]{8}$/` | core/escritura-segura.js:192,238; core/ciclo/protocolo-archivos.js:252 | El barrido no reconoce temporales de la versión anterior: basura en proyectos | Restos en proyectos |
| `forge-mutacion-XXXXXX`, `/^forge-mutacion-[A-Za-z0-9]{6}$/`, marca `.forge-mutacion` | core/ciclo/mutacion.js:815,856,1428; core/ciclo/restos.js:23-24 | Dos sitios deben coincidir. El barrido BORRA carpetas por patrón: un patrón laxo borraría carpetas ajenas | Restos en `os.tmpdir()` |
| `forge-probar-modelo-`, `forge-independientes-` | core/probar-modelo.js:43; scripts/pruebas-independientes.mjs:95 | Solo carpeta temporal | No |
| `.tmp`, `en-curso.lock`, `proyecto.lock`, `<id>.lock` | checkpoint.js:49,77; checkpoint-archivos.js:72,118; diario.js:191; respaldo.js:53; engine-cli.js:170; estado-usuario.js:126 | Sin «forge»: no cambian | - |

## 6. Regex que contienen «forge»

| Regex | Dónde | Efecto |
|---|---|---|
| `/<!--\s*forge:/i` | github.js:415; gitlab.js:373,459 | Barrera anti-inyección: debe vetar el nombre viejo y el nuevo |
| `/^\s*FORGE-ID\s*:/im` | jira.js:397 | Igual |
| `/^FORGE_[A-Z0-9_]{1,58}$/` | core/integraciones/config.js:153 | Lista blanca de variables leíbles como token (seguridad; ver variables.md R5) |
| `/^.+\.forge-tmp-\d+-[0-9a-f]{8}$/` | escritura-segura.js:192 | Barrido de temporales |
| `/^forge-mutacion-[A-Za-z0-9]{6}$/` | mutacion.js:856; restos.js:23 | Barrido con borrado |
| filtro Docker `label=forge.sandbox=1` | docker-cli.js:226; ci.yml:86,124 | Barrido de contenedores |

## 7. Riesgos para F3 y F4

| # | Riesgo | Fase |
|---|---|---|
| R1 | La carpeta de estado guarda la clave HMAC. «Nueva si existe, si no la antigua» deja a una versión vieja usando la antigua mientras la nueva usa otra: aprobaciones en dos sitios. Definir cuál manda y que `doctor` avise. | F4 |
| R2 | `rutaDeEstado` rechaza raíces dentro del proyecto (estado-usuario.js:73-77): ambas raíces (nueva y antigua) deben pasar por la misma comprobación. | F4 |
| R3 | Sin migración: una clave antigua sin uso no debe leerse para firmar ni verificar con el nombre nuevo (mezcla de claves). | F4 |
| R4 | `barrerHuerfanos(etiqueta)` toma un solo valor (docker-cli.js:225): llamarlo dos veces o aceptar lista. También `forge.proyecto=` y `forge.sandbox.imagen`. CI mira una sola etiqueta. | F4 |
| R5 | Los barridos por regex borran archivos: ampliar con patrón explícito de dos nombres y prueba de «no borra carpetas ajenas». | F4 |
| R6 | Marcadores publicados y `forge/`: no cambiar emisor ni regex; si se añade un marcador nuevo, las barreras anti-inyección deben vetar los dos. | F4 |
| R7 | `forge.config.json` controla guardrails de seguridad y vive en proyectos de usuarios: sin tratamiento previsto en la spec. | F4 |
| R8 | `NOMBRE_VARIABLE` y la lista reservada. | F3 |

## 8. Qué cambiaría en el plan

1. F4.3: ampliar a `forge.proyecto=`, `forge.sandbox.imagen=` y al filtro de CI (ci.yml:86,124); barrer con las dos etiquetas.
2. Nueva tarea: decidir que los temporales (`.forge-tmp-`, `forge-mutacion-`) NO cambian (son internos; sin ganancia de seguridad) y fijarlo con prueba; si cambian, barrer ambos patrones.
3. F4.4: añadir `FORGE-ID:` (Jira), `forge:` en commits y `forge-derivado:` a la prueba de inmutables.
4. Spec: decidir qué pasa con `forge.config.json`, `.forge-ui`, `forge-version:` en CLAUDE.md, `<!-- Generado por FORGE` y el plugin `forge`: están fuera del plan y rompen a usuarios existentes si cambian. Recomendación: leer ambos nombres de `forge.config.json`, el resto sin cambio.
5. F5.1: añadir cli/runner.js:47 y `.claude/settings.json:23-24` (`forge-sdd`).
6. Regla general: cambian solo la carpeta de estado y las etiquetas de contenedor; lo publicado en servicios externos se declara inmutable.
