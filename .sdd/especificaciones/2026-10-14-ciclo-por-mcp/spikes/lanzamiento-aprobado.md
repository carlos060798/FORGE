# Spike S0.4: cómo lanza el ciclo `fragua ciclo aprobar` sin pasar por el servidor MCP

> Lectura (2026-10-17): `cli/index.js:2147-2170`, `core/engine-cli.js`, `core/api/servidor.js:40-60`, `core/integraciones/aprobacion.js`, `core/estado-usuario.js`. Sin ejecución real del ciclo.

## Cómo se lanza un ciclo hoy

- `forge run` / `forge resume` → `engineMain()` en el mismo proceso, reescribiendo `process.argv` (`cli/index.js:2163-2169`). El proceso hijo de la API usa `spawn(process.execPath, [CLI, ...args, '--cwd', cwd], { env, stdio:[ignore,pipe,pipe] })` (`core/api/servidor.js:54`), con un entorno propio.
- `buildDeps` (`engine-cli.js:86-100`) crea `EventLog`, estado, registro de agentes; el tope sale de `leerConfigCiclo` (ver `tope-efectivo.md`).

## Patrón reutilizable: la cola firmada de integraciones

`core/integraciones/aprobacion.js` ya resuelve el mismo problema (acción con efectos en el exterior que una persona aprueba):
- Cola en el estado del USUARIO (`<estado>/pendientes/`), fuera del árbol, con HMAC-SHA256 y clave local (`core/estado-usuario.js:295-454`).
- Aprobar exige la **huella completa o ≥ 12 caracteres** de lo que la persona vio (`MIN_HUELLA`, `aprobacion.js:49,451`); el orden de comprobaciones lo documenta el encabezado (firma, coherencia, huella, texto limpio…, **sin red**).
- Un pendiente que esté en el árbol o con firma inválida se lista como «no autenticado» y no se aprueba (`:270`).
- Idempotente: si ya se publicó, devuelve el resultado guardado.
- Lo escribe el mismo proceso que la propone (el MCP) con la clave del usuario: el MCP tiene acceso a la clave (mismo usuario). Esto significa que **un cliente MCP comprometido puede crear pendientes firmados**; lo que no puede es aprobarlos si la aprobación exige la huella que una persona ve en su terminal. La barrera es la huella tecleada por el humano, no la firma (la firma solo evita pendientes ajenos/del repositorio).

## Diseño propuesto para `fragua ciclo aprobar`

1. `ciclo vista <id>`: imprime la tarea **exacta** (texto íntegro, no confiable, escapado), archivos permitidos, tope efectivo, la huella (`sha256` de la solicitud canónica incluyendo tope y proyecto) y el comando para aprobar.
2. `ciclo aprobar <id> --huella <hex>` en la terminal del usuario: comprueba firma, caducidad (CA-006-01), huella, que no se haya usado; recalcula el tope con `min()`; marca el pendiente `aprobado` **antes** de lanzar (un solo uso); lanza el ciclo con `spawn(process.execPath, [CLI, 'run', ...])` con **entorno explícito** (`FRAGUA_BUDGET_USD=<topeEfectivo>`, sin heredar `FRAGUA_MCP_*`), `cwd` fijado, y sin `stdin`. No pasa por el servidor MCP: el servidor MCP no tiene ninguna herramienta ni función que pueda llamar a `aprobar`.
3. La aprobación **no puede ser una herramienta** (CA-006-03): `tools/list` no la contiene, y la prueba debe recorrer `herramientas` y comprobar que ningún nombre ni ejecución llama a `aprobar`/`lanzar` (análisis estático del módulo `core/mcp/`, como el que hace `verificar.test.js` contra proveedores).
4. La tarea del ciclo lanzada es **dato no confiable**: va al agente como texto de tarea con el mismo tratamiento que una incidencia de integraciones (`core/integraciones/` marca los textos externos y los redacta); la huella cubre el texto, así que cambiarlo tras la vista invalida.

## Qué cambia en la spec o el plan

- F5.1/F5.4: **reutilizar** `estado-usuario.js` y la estructura de `aprobacion.js` en vez de una cola nueva; módulo `core/ciclo/solicitudes.js` que comparte primitivas (`canonico`, `firmar`, `firmaValida`, `crearArchivo`) y NO copia la lógica de huella: extraer `huellaDeContenido` (`aprobacion.js:120`) a un común.
- El lanzamiento es `spawn` del propio CLI con entorno controlado, no `engineMain()` en proceso (así el tope viaja por entorno y el proceso del MCP no comparte memoria con el ciclo).
- Documentar que el límite real es «el humano teclea la huella»; una huella copiada por el humano de la propia salida del cliente MCP (que el modelo puede haber manipulado) es el hueco. Mitigación: `ciclo vista` se ejecuta en la terminal, no se pega desde el cliente; avisar en la guía.

## Riesgos

- El MCP y la CLI comparten usuario del sistema: la separación es de proceso y de herramientas, no de privilegios.
- Caducidad y un solo uso necesitan estado en el lado del usuario (ya existe) y reloj local (manipulable por el usuario, no por el repositorio).
