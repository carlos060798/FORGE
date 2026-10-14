# S0.1 Inventario de lecturas de variables `FORGE_*`

Alcance: código de producción (claude-hooks/, cli/, core/, ui/, scripts/; `utils/` no contiene lecturas). Excluidos `node_modules`, `.claude/worktrees` (copias) y `tests/` (288 líneas con `FORGE_`; solo las inyectan o fijan). Búsqueda textual más lectura de los puntos comunes; `env[nombre]` dinámico va aparte.

## 1. Lecturas por variable

| Variable | Lecturas (archivo:línea) | n | Clase | ¿Directa de `process.env`? | ¿Podría venir de un archivo del proyecto? |
|---|---|---|---|---|---|
| FORGE_BUDGET_USD | core/session-budget.js:171; core/ciclo/config.js:316-317 | 3 | POLÍTICA (gasto) | Sí | Sí: el proyecto fija tope en su config; el entorno pisa (config.js:316) |
| FORGE_BUDGET_WARN_USD | claude-hooks/context-manager.js:34 | 1 | POLÍTICA (gasto) | Sí | No |
| FORGE_BUDGET_BLOCK_USD | claude-hooks/context-manager.js:36 | 1 | POLÍTICA (gasto) | Sí | No |
| FORGE_NIVEL_MAXIMO | core/ciclo/config.js:281 | 1 | POLÍTICA (nivel) | Sí | Sí (`motor.nivel_maximo`) |
| FORGE_IMPLEMENTADOR | core/ciclo/config.js:291 | 1 | POLÍTICA (qué runtime/modelo escribe) | Sí | Sí (`motor.implementador`) |
| FORGE_MOTOR_GRAFO | core/ciclo/config.js:277 | 1 | CONFIGURACIÓN | Sí | Sí (`motor.grafo`) |
| FORGE_LLM_PROVIDER | core/llm-providers/index.js:95,117; cli/index.js:848; core/probar-modelo.js:35 | 4 | POLÍTICA (destino: adónde van código y clave) | Sí (3) + por `env` (1) | Sí (`llm.provider`); el entorno gana (index.js:95) |
| FORGE_STUB_GUION | core/llm-providers/stub-provider.js:65,66 | 2 | PRUEBA (lee y parsea un archivo cualquiera) | Sí | No |
| FORGE_API_TOKEN | cli/index.js:1897; core/api/servidor.js:52 (la quita del entorno de hijos) | 2 | POLÍTICA (autenticación) | Sí | No |
| FORGE_UI_PORT | ui/server.js:316 | 1 | CONFIGURACIÓN | Sí | No |
| FORGE_TOOL_MAX_BYTES | claude-hooks/context-manager.js:38 | 1 | CONFIGURACIÓN | Sí | No |
| FORGE_LEDGER_MAX_BYTES | claude-hooks/context-manager.js:40 | 1 | CONFIGURACIÓN | Sí | No |
| FORGE_INTEGRACIONES | core/integraciones/auditoria.js:81 | 1 | POLÍTICA (interruptor; valor desconocido = apagado) | No (`env`) | No (existe además el archivo `.sdd/integraciones/apagado`) |
| FORGE_INTEGRACIONES_ESCRITURA | core/integraciones/config.js:410 | 1 | POLÍTICA (escritura) | No (`env`) | NO debe (config.js:408-419) |
| FORGE_INTEGRACIONES_DESTINOS | core/integraciones/config.js:411 | 1 | POLÍTICA (destinos) | No (`env`) | NO debe |
| FORGE_INTEGRACIONES_HOSTS | core/integraciones/hosts.js:76 | 1 | POLÍTICA (hosts que reciben credenciales) | No (`env`) | NO debe |
| FORGE_RUNTIMES_PERMITIDOS | core/sandbox/politica.js:59 | 1 | POLÍTICA (runtimes) | No (`env`) | NO debe |
| FORGE_DOCKER_TIMEOUT_S | core/sandbox/docker-cli.js:85 | 1 | CONFIGURACIÓN | No (`env`) | No |
| FORGE_HOME | core/integraciones/estado-usuario.js:46 | 1 | POLÍTICA (estado del usuario) | No (`env`) | NO debe (estado-usuario.js:73-77 rechaza rutas dentro del proyecto) |
| `FORGE_*` de nombre libre (token, usuario) | core/integraciones/config.js:471 `env[nombre]`; envoltorios :481, :490 | 1 dinámica | POLÍTICA (credenciales) | No (`env`) | El NOMBRE sí viene del proyecto (`*_token_env`); filtrado por `NOMBRE_VARIABLE` (config.js:153) y `PREFIJOS_RESERVADOS` (:163) |
| FORGE_TIER | solo texto de ayuda (context-manager.js:186) | 0 | n/a: no se lee (el consejo es falso) | - | - |
| FORGE_VERSION, FORGE_TEST_INTEGRACIONES | solo lista reservada (config.js:160) y comentario (gitlab.js:11) | 0 | n/a / PRUEBA | - | - |

Total: 23 lecturas en 17 variables con lectura real, más 1 dinámica. Solo informativas (se muestran, no se leen para decidir): doctor.js:79-82, cli/integraciones.js:155,447. Escrituras al entorno de hijos: probar-modelo.js:51, scripts/pruebas-independientes.mjs:133-139. `FORGE_VERSION` de cli/export.js:21 e import.js:21 y `FORGE_CONFIG*` de claude-hooks son constantes JS, no entorno.

## 2. Estilos de lectura

| Estilo | Sitios |
|---|---|
| `process.env.X` / `process.env['X']` directo, sin punto común (13) | session-budget.js:171; ciclo/config.js:277,281,291,316,317; llm-providers/index.js:95,117; stub-provider.js:65,66; cli/index.js:848,1897; ui/server.js:316; context-manager.js:34,36,38,40 |
| Parámetro `env = process.env` (punto semicomún) | politica.js:57-59; docker-cli.js:84-85; estado-usuario.js:45-46; hosts.js:75-76; config.js:367,408-411,456,471; auditoria.js:80-81; probar-modelo.js:33-35 |
| Destructuring | core/api/servidor.js:52 |
| Dinámica `env[nombre]` | core/integraciones/config.js:471 |
| Herencia a procesos hijos | probar-modelo.js:33,51; servidor.js:52; scripts/pruebas-independientes.mjs:133-139 |

Hoy no hay un punto común: hay tres estilos.

## 3. Podrían venir de un archivo del proyecto

BUDGET_USD, NIVEL_MAXIMO, IMPLEMENTADOR, MOTOR_GRAFO, LLM_PROVIDER (core/ciclo/config.js:277-317; llm-providers/index.js:95-117). El proyecto no puede fijar las de integraciones, runtimes ni FORGE_HOME.

## 4. Riesgos para F3 y F4

| # | Riesgo | Fase |
|---|---|---|
| R1 | `FORGE_INTEGRACIONES` falla cerrado. Con dos nombres, «uno normal y otro apagado» o «uno ilegible» debe dar APAGADO; el error de conflicto debe apagar, no solo avisar. | F3 |
| R2 | ESCRITURA, DESTINOS, HOSTS y RUNTIMES_PERMITIDOS son listas que amplían permisos. Si un nombre trae `github` y el otro nada, unir sería ampliar: debe ser error y quedar en lo más restrictivo. | F3 |
| R3 | 13 lecturas directas no reciben `env`: `leerVariable` obliga a cambiar firmas o a leer `process.env` dentro; las pruebas mutan `process.env`. | F3 |
| R4 | BUDGET_USD y NIVEL_MAXIMO: el entorno sustituye al archivo en cualquier dirección; con los dos nombres distintos, error que nombre ambos. | F3 |
| R5 | `NOMBRE_VARIABLE` y `PREFIJOS_RESERVADOS` (config.js:153-175) deben admitir y reservar ambos prefijos; si no, un proyecto pediría leer `FRAGUA_API_TOKEN` como «token de GitHub». Duplicar también la lista reservada (config.js:156-160). | F3 |
| R6 | servidor.js:52 solo quita `FORGE_API_TOKEN`; hay que quitar las dos formas o el hijo hereda la nueva. Igual probar-modelo.js:33. | F3 |
| R7 | `FORGE_STUB_GUION` lee un archivo arbitrario: no ampliar a un nombre nuevo sin necesidad (no duplicarla). | F3 |
| R8 | `FORGE_HOME` fija dónde está la clave HMAC: con dos nombres distintos, elegir uno oculta aprobaciones. Error, no preferencia. | F4 |

## 5. Qué cambiaría en el plan

1. F3.2: la prueba estática debe cubrir `process.env.X`, `process.env['X']`, `env.X`, `env[VARIABLE_*]`, destructuring y `env[nombre]` dinámico; hoy hay tres estilos.
2. F3.1: tabla previa de variables con tipo (interruptor, lista que amplía, escalar, ruta). Regla común «iguales o error»; ante error, las de política caen a lo más restrictivo.
3. F3.3 debe nombrar las 8 de política de integraciones/runtimes/estado más BUDGET, NIVEL, IMPLEMENTADOR y LLM_PROVIDER (esta última decide adónde va la clave).
4. F3.4: ampliar a `NOMBRE_VARIABLE`, `PREFIJOS_RESERVADOS`, lista reservada y servidor.js:52.
5. Decidir si FORGE_TIER (que no se lee) se corrige en el texto en vez de renombrarse; FORGE_STUB_GUION no se duplica; los scripts exportan los dos nombres a los hijos durante una versión.
6. La spec dice 28 variables; solo 17 se leen de verdad. Corregir la cifra en la spec.
