---
spec_id: 2026-10-03-herramientas-mcp
fecha_verificacion: 2026-10-03
veredicto: APROBADA_CON_OBSERVACIONES  # autoevaluación de quien implementó; sin verificación independiente todavía
---

# Verificación: 2026-10-03-herramientas-mcp

## Revisión de seguridad independiente (cuarta pasada del proyecto)

Un agente independiente probó 94 mensajes JSON-RPC hostiles (lotes, ids no válidos, `params` no objeto, métodos `__proto__`, línea gigante, CRLF, JSON roto) y las rutas de `leer_archivo`/`escribir_archivo` (traversal, ADS, nombres de dispositivo, `GIT~1`, junctions, NUL, roles): todo correcto. Observaciones: el MCP almacena en memoria una línea de 11 MB antes de descartarla, `validarArgumentos` acepta un argumento llamado `constructor` (sin efecto), y el veto por nombres es una lista negra. No pudo probar `ejecutar_pruebas` con el contenedor real. Esto sigue sin ser una verificación de criterios de aceptación independiente.

## Veredicto: **APROBADA_CON_OBSERVACIONES** — autoevaluación, sin verificación independiente

> La spec anterior (ciclo verificado) pasó por una verificación independiente que **rechazó** su primera autoevaluación. Esta también la hizo quien implementó: **no es una verificación independiente** y hay que tratarla con la misma cautela. Conviene pasar `/sdd.verificar` con el agente `revisor` y una revisión del agente `seguridad`.

21 criterios ✅, 1 ⚠️ y 0 ❌ de 22.

## Cumplimiento de Criterios de Aceptación

| CA | Descripción | Archivo(s) | Test(s) | Estado |
|----|-------------|------------|---------|--------|
| CA-001-01 | La herramienta devuelve el resultado de las pruebas (pasan, fallan, tiempo agotado o fallo del entorno), el código de salida y el final de la salida, sin secretos. | core/mcp/herramientas.js (ejecutar_pruebas) | mcp-herramientas.test.js, mcp-e2e.test.js | ✅: Con respuestas guionizadas y, con Docker, contra el entorno aislado real |
| CA-001-02 | Si el entorno aislado no está disponible, la herramienta lo dice con un error y no ejecuta nada en el equipo anfitrión. | core/mcp/herramientas.js (ejecutar_pruebas) | mcp-herramientas.test.js, mcp-e2e.test.js | ✅: Sin Docker en el PATH: error y la prueba que escribiría una marca en el anfitrión no se ejecuta |
| CA-001-03 | Dos ejecuciones simultáneas, o una durante un ciclo verificado en marcha, no se pisan: la segunda recibe un error que indica que el proyecto está ocupado. | core/mcp/herramientas.js (ejecutar_pruebas) | mcp-herramientas.test.js | ✅ |
| CA-001-04 | La herramienta no acepta un comando a medida: ejecuta únicamente el comando de pruebas que FORGE detecta en el proyecto. | core/mcp/herramientas.js (ejecutar_pruebas) | mcp-herramientas.test.js | ✅ |
| CA-002-01 | La herramienta devuelve el contenido de un archivo del proyecto. | core/mcp/herramientas.js (leer_archivo) | mcp-herramientas.test.js | ✅ |
| CA-002-02 | Rechaza, con una razón comprensible, las rutas que salen del proyecto, las vetadas (repositorio, estado de FORGE, secretos) y las que llegan a ellas por un enlace. | core/mcp/herramientas.js (leer_archivo) | mcp-herramientas.test.js | ✅ |
| CA-002-03 | Un archivo mayor que el tope se devuelve recortado, e indica que lo está. | core/mcp/herramientas.js (leer_archivo) | mcp-herramientas.test.js | ✅ |
| CA-002-04 | Se pueden leer los manifiestos de dependencias y la configuración, que no se pueden escribir sin revisión. | core/mcp/herramientas.js (leer_archivo) | mcp-herramientas.test.js | ✅ |
| CA-003-01 | La herramienta escribe un archivo permitido y devuelve su huella. | core/mcp/herramientas.js (escribir_archivo) | mcp-herramientas.test.js | ✅ |
| CA-003-02 | Rechaza las mismas rutas que el ciclo: fuera del proyecto, vetadas, no portables y enlaces. | core/mcp/herramientas.js (escribir_archivo) | mcp-herramientas.test.js | ✅ |
| CA-003-03 | No aplica cambios en dependencias ni en configuración que alguna herramienta ejecuta sola, e indica que requieren revisión humana. | core/mcp/herramientas.js (escribir_archivo) | mcp-herramientas.test.js | ✅ |
| CA-003-04 | Con el rol de implementación no escribe archivos de prueba; con el rol de pruebas escribe solo archivos de prueba. | core/mcp/herramientas.js (escribir_archivo) | mcp-herramientas.test.js | ✅ |
| CA-003-05 | Antes de la primera escritura de cada archivo guarda un respaldo de su contenido previo. | core/mcp/herramientas.js (escribir_archivo) | mcp-herramientas.test.js | ✅ |
| CA-003-06 | Rechaza contenidos mayores que el tope. | core/mcp/herramientas.js (escribir_archivo) | mcp-herramientas.test.js | ✅ |
| CA-004-01 | Un cliente que sigue el protocolo puede inicializar la conexión, listar las herramientas y llamarlas. | core/mcp/protocolo.js | mcp-protocolo.test.js | ✅ |
| CA-004-02 | El servidor acepta las versiones del protocolo 2024-11-05, 2025-03-26 y 2025-06-18, y responde con la que el cliente pide si la soporta. | core/mcp/protocolo.js | mcp-protocolo.test.js | ✅ |
| CA-004-03 | Las peticiones mal formadas, los métodos desconocidos y las herramientas inexistentes reciben los errores estándar del protocolo; el servidor no se cae. | core/mcp/protocolo.js | mcp-protocolo.test.js | ✅ |
| CA-004-04 | Los errores de una herramienta (ruta rechazada, entorno no disponible) se devuelven como resultado de la herramienta marcado como error, para que el agente pueda corregirlos. | core/mcp/protocolo.js | mcp-protocolo.test.js | ✅ |
| CA-004-05 | El servidor solo escribe mensajes del protocolo en su salida; sus avisos van por la salida de errores. | core/mcp/protocolo.js | mcp-protocolo.test.js, mcp-e2e.test.js | ✅ |
| CA-004-06 | Funciona con el cliente oficial del protocolo. | core/mcp/protocolo.js | mcp-e2e.test.js | ✅: Con el cliente oficial del SDK (se salta si FORGE_MCP_SDK no apunta a él) |
| CA-005-01 | `forge mcp` arranca el servidor sobre el proyecto actual, o sobre el indicado con `--cwd`. | core/mcp/servidor.js, cli/index.js, docs/servidor-mcp.md | mcp-e2e.test.js | ✅ |
| CA-005-02 | La documentación incluye la configuración que hay que añadir al cliente. | core/mcp/servidor.js, cli/index.js, docs/servidor-mcp.md | docs/servidor-mcp.md (documentación, sin test) | ⚠️: Documentado en docs/servidor-mcp.md; no hay test |

## Suite

- Windows 11, Node 24, con Docker y cliente oficial del SDK (suite completa del repo): 1339 de 1342 pasan, 0 fallos, 3 saltados

## Comprobado con el cliente oficial

Una conexión real con `@modelcontextprotocol/sdk@1.32.0` (instalado fuera del repositorio): inicializa, lista las tres herramientas, lee, escribe, rechaza una ruta vetada y un cambio de dependencias con un resultado marcado como error, devuelve el error de protocolo -32602 para una herramienta inexistente, y `ejecutar_pruebas` corre en Docker real: el agente corrigió `a - b` por `a + b` y las pruebas pasaron en unos 8 s.

## Lo que esta verificación NO demuestra

- **Claude Code y otros clientes.** Solo se probó con el cliente del SDK oficial.
- **Linux con Docker.** Solo Windows con Docker Desktop.
- **Que las reglas de rutas sean completas.** Son las del ciclo, con sus mismos límites (ver `revision-seguridad.md` de la spec anterior): una configuración ejecutable que no esté en las listas se escribiría, y el contenido de un archivo permitido no se inspecciona.
- **Revisión de seguridad independiente** del servidor: no se ha hecho.
- **Concurrencia entre procesos reales** del servidor y de un ciclo: probado con un candado de un proceso vivo, no con dos servidores y un ciclo a la vez.

## Observaciones

1. No hay herramienta para restaurar los respaldos.
2. El servidor no tiene autenticación: confía en el proceso que lo lanza.
3. El resultado de las pruebas se decide por el código de salida (límite heredado: `process.exit(0)`).
4. El nombre del respaldo usa `Date.now()`: dos servidores arrancados en el mismo milisegundo compartirían carpeta.
