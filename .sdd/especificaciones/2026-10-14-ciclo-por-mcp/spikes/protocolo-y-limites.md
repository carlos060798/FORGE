# Spike S0.1: `core/mcp/` entero: qué expone, identidad del cliente, tamaños, cancelación, llamadas largas

> Lectura completa de `core/mcp/protocolo.js` (363 líneas), `herramientas.js` (188), `servidor.js` (94) y de `cli/index.js:2147-2153` (2026-10-17). Sin cliente MCP real ni Docker: lo de ejecución va «sin confirmar».

## Qué expone hoy

- Servidor `forge mcp [--cwd]` por stdin/stdout, JSON-RPC un mensaje por línea (`protocolo.js:1-24`). Habla las dos épocas del protocolo: con `initialize` (`VERSIONES` 2025-11-25 … 2024-11-05) y sin estado 2026-07-28 (`protocolo.js:30-47,259-320`). Sin red, sin puertos (usa `process.stdin/stdout`, `servidor.js:84-93`).
- Tres herramientas fijas (`herramientas.js:67,111,152`): `ejecutar_pruebas` (sin argumentos), `leer_archivo` (`ruta`), `escribir_archivo` (`ruta`, `contenido`, `rol`). **Todas se registran siempre**: no hay perfiles ni lista configurable (`servidor.js:81`, `crearHerramientas({cwd, crearRunner})`). `tools/list` devuelve todas.
- `escribir_archivo` ya escribe en el proyecto (con las reglas de `aplicarArchivos`); es la superficie que el perfil «solo verificar» debe retirar.
- Existe ya `ejecutar_pruebas` ≈ `verificar` sin veredicto de «cero pruebas» ni mutación ni registro. No usa `core/verificar/index.js`: construye su propio runner (`servidor.js:34-72`) y NO usa `comprobarEntorno` ni `carpetaDeVerificacion`. Dos rutas de ejecución distintas para casi lo mismo: la herramienta `verificar` debe **sustituir** a `ejecutar_pruebas` en el perfil mínimo (o hacer que esta delegue), no añadirse a ella.

## Autenticación e identidad del cliente

- **No hay autenticación ni identidad**: el transporte es stdio; el «cliente» es el proceso que lanzó `forge mcp` (el padre) y la confianza es la del usuario que lo configuró en su `.mcp.json`. No se lee `clientInfo` en `initialize` (`protocolo.js:~245-256`: solo `protocolVersion`) ni `META.CLIENTE` en las peticiones sin estado (`protocolo.js:49-55` lo define y no se usa).
- Consecuencia: el servidor no puede distinguir «el usuario» de «un agente hostil que llama por el mismo canal»; todo lo que ofrece el servidor lo puede invocar un texto hostil que convenza al modelo cliente. El límite de seguridad es **qué herramientas existen**, no quién llama. Los topes deben ir en el servidor y en el entorno del usuario (no en argumentos de la llamada).
- El nombre anunciado es `forge` (`servidor.js:81`); tras el renombrado a Fragua, queda por decidir si cambia (afecta a configuraciones de usuarios).

## Tamaños, cancelación, llamadas largas

- Entrada: línea > 10 MiB se descarta con error (`MAX_LINEA`, `protocolo.js:62,138-150`).
- **Salida de herramienta sin tope en el protocolo**: `_llamar` devuelve lo que la herramienta devuelva (`protocolo.js:~325-340`). Los topes los pone cada herramienta: `ejecutar_pruebas` corta a 8 KiB con `cola` (`herramientas.js:~97`), `leer_archivo` a 256 KiB. La herramienta `verificar` debe fijar el suyo (8 KiB ya lo hace `resultado.js:20` `SALIDA_MAX_BYTES`) y añadir un tope del JSON total.
- Validación de argumentos (`validarArgumentos`, `protocolo.js:81-95`): comprueba `required`, rechaza campos desconocidos, y solo `string`/`enum`/`maxLength`. **No valida arrays, números ni booleanos**: `archivos: [..]` de `verificar` no tendría tipo comprobado. Hay que extenderla o sustituirla por el validador del contrato (ver spike de JSON Schema de `contrato-publico`).
- Cancelación: `notifications/cancelled` aborta una `AbortSignal` (`protocolo.js:~235-240`) solo en la época sin estado; la señal llega a `ejecutar(args, senal)`. `ejecutar_pruebas` **la ignora** (`async ejecutar()` sin parámetros, `herramientas.js:73`): una cancelación no detiene el contenedor; solo se termina por `timeout_s`. Para `verificar`: pasar la señal hasta el runner (matar contenedor por nombre, `DockerCli.run` ya sabe `kill`/`rm`, `docker-cli.js:172-176`) o aceptar que se agota por tiempo (sin confirmar el efecto en la verificación en curso).
- Llamadas largas: no hay progreso ni tiempo máximo propio del servidor; con mutación una llamada puede durar `mutacion_timeout_s` (300 por defecto, `config.js` `motor`) más las pruebas. Sin confirmar cómo reaccionan los clientes (muchos cortan a 60 s). Recomendación: fase 1 sin mutación por MCP (o con tope bajo y `archivos` obligatorios) y tiempo máximo del servidor (p. ej. 300 s) ≤ lo que el cliente tolere.
- Simultaneidad: `ejecutar_pruebas` toma `adquirir(.sdd/motor/proyecto.lock)` y responde «ocupado» (`herramientas.js:75-82`); `verificar` toma otro candado, `verificar.lock` en el temporal (`verificar/index.js:162`). Los dos candados son distintos: `verificar` por MCP y un ciclo en marcha no se excluyen entre sí. Usar el mismo candado de proyecto o ambos.

## Qué cambia en la spec o el plan

- Plan: el perfil no es «activar/desactivar una de tres» sino **construir la lista de herramientas por perfil** en `crearHerramientas`/`servidor.js`. Perfil por defecto debería ser el mínimo (`verificar`), hoy lo es «todas». Cambio de comportamiento que requiere decisión del dueño (rompe configuraciones que usan `escribir_archivo`): proponer que el perfil por defecto siga siendo el actual durante una versión y que `--perfil verificar` sea el nuevo.
- `verificar` reutiliza `core/verificar/index.js` (candado y carpeta propios) y retira el segundo runner.
- Extender `validarArgumentos` antes de F1.2 (campos de tipo array).
- Pasar `senal` al runner (decisión: sí/no) y documentar el límite si no.

## Riesgos

- Sin identidad de cliente, «tope por usuario» = «tope por proceso/proyecto/día»; no por cliente.
- El texto de `description` de cada herramienta lo lee el modelo cliente: es superficie de inyección inversa; mantenerlo estático y sin datos del proyecto.
