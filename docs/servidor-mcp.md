# Servidor MCP de FORGE

> Disponible desde la versión en desarrollo posterior a 4.2.0.
> Especificación: `.sdd/especificaciones/2026-10-03-herramientas-mcp/`. Decisión: `.sdd/arquitectura/ADR-12`.

`forge mcp` arranca un servidor del protocolo [MCP](https://modelcontextprotocol.io) con tres herramientas. Sirve para que **otro agente** (Claude Code u otro cliente MCP) use el aislamiento y las reglas de escritura del [ciclo verificado](ciclo-verificado.md): ejecutar las pruebas del proyecto en un contenedor sin red, y leer y escribir archivos sin salirse del proyecto.

No lo usa el propio ciclo, que sigue llamando a las mismas funciones directamente.

## Cómo configurarlo

En el cliente, como servidor por entrada y salida estándar. Por ejemplo, en el `.mcp.json` del proyecto:

```json
{
  "mcpServers": {
    "forge": { "command": "npx", "args": ["forge", "mcp"] }
  }
}
```

O con la ruta de una instalación concreta, sobre otro proyecto:

```json
{
  "mcpServers": {
    "forge": { "command": "node", "args": ["C:/ruta/a/FORGE/cli/index.js", "mcp", "--cwd", "C:/ruta/al/proyecto"] }
  }
}
```

Con Claude Code: `claude mcp add forge -- npx forge mcp`.

No se añade al `.mcp.json` del propio plugin: lo activa quien lo quiera.

## Las herramientas

| Herramienta | Qué hace |
|---|---|
| `ejecutar_pruebas` | Ejecuta las pruebas del proyecto en el entorno aislado y devuelve si pasan, fallan, agotan el tiempo o si falló el entorno, el código de salida y el final de la salida (sin secretos). **Sin argumentos**: no acepta comandos, ejecuta el que FORGE detecta en el proyecto |
| `leer_archivo` | Lee un archivo del proyecto (hasta 256 KB; avisa si recorta). Puede leer manifiestos y configuración, que no puede escribir |
| `escribir_archivo` | Escribe un archivo (hasta 1 MB), con un respaldo del contenido anterior. Argumento `rol`: `implementacion` (por defecto, no escribe pruebas) o `pruebas` (solo escribe pruebas) |

Los errores (ruta rechazada, entorno no disponible) se devuelven como resultado de la herramienta marcado como error, con la razón, para que el agente pueda corregirlo o decírselo al usuario.

## Qué rechaza

Las mismas reglas que el ciclo, con una sola implementación (`core/ciclo/protocolo-archivos.js`): rutas fuera del proyecto, absolutas o no portables; `.git` (también anidado), `.sdd`, `.claude`, `node_modules`, secretos y credenciales; enlaces simbólicos. Los cambios en dependencias y en configuración que otras herramientas ejecutan solas (`package.json`, `.github/`, `.husky/`, `conftest.py`, `*.config.js`…) **no se aplican**: el error dice que requieren revisión humana. Detalle en [ciclo-verificado.md](ciclo-verificado.md#qué-puede-escribir-un-agente).

## Requisitos y comportamiento

- `leer_archivo` y `escribir_archivo` no necesitan nada más.
- `ejecutar_pruebas` necesita **Docker**. Se comprueba al primer uso, no al arrancar. Sin Docker devuelve un error y no ejecuta nada en tu equipo.
- Solo una ejecución a la vez por proyecto, compartida con el ciclo verificado: si hay un `forge run --motor ciclo` en marcha, o dos llamadas simultáneas, la segunda recibe un error de «proyecto ocupado».
- Proyectos en JavaScript/TypeScript o Python (los mismos que el ciclo).
- Por la salida estándar solo salen mensajes del protocolo; los avisos van a la salida de errores.
- Revisiones del protocolo:
  - **con saludo** (el cliente abre con `initialize`): 2024-11-05, 2025-03-26, 2025-06-18 y 2025-11-25;
  - **sin estado** (no hay saludo: cada petición trae su versión en `_meta`): 2026-07-28, la vigente.

  El servidor atiende las dos a la vez y elige petición a petición. A un cliente que pida sin saludo una revisión que no admite le responde el error `-32022` con las que sí. Qué cambia en cada revisión y de qué página oficial sale: `.sdd/especificaciones/2026-10-09-puesta-al-dia/spikes/mcp-revision-vigente.md`.
- Si `sandbox.runtime` está configurado, `ejecutar_pruebas` usa ese mecanismo de aislamiento; si Docker no lo tiene, devuelve un error y no ejecuta nada. Un mecanismo distinto de `runc` además tiene que estar en `FORGE_RUNTIMES_PERMITIDOS` (variable de entorno del proceso `forge mcp`): el archivo del proyecto puede ser ajeno y no basta para elegirlo.
- **Con saludo y versión desconocida o ausente**, `initialize` responde `2025-06-18`, como antes de esta fase (no la más reciente). Una versión que sí se admite se devuelve tal cual.
- **Peticiones sin `_meta` de versión y sin saludo**: `tools/list` y `tools/call` se atienden como siempre, con la forma de las revisiones con saludo y sin `resultType` (es lo que hacía el servidor antes y lo que esperan los clientes que nunca saludan). `server/discover` y `subscriptions/listen`, que solo existen en la revisión sin estado, responden `-32602` si falta `_meta`.
- **Suscripciones** (`subscriptions/listen`): como mucho 64 abiertas a la vez por conexión y sin ids repetidos; en otro caso `-32602`. Cancelar una libera su sitio.

## Límites conocidos

- **Sin autenticación ni transporte de red**: el servidor lo lanza tu cliente como proceso hijo y confía en él. No lo expongas por otro canal.
- **Un agente con estas herramientas puede escribir código dañino en `src/`.** Se ejecuta solo dentro del contenedor, pero queda en tu proyecto. Revisa el diff antes de hacer commit. Una configuración ejecutable que no esté en las listas de rutas se escribiría.
- **Los respaldos se guardan, pero no hay herramienta para restaurarlos**: están en `.sdd/motor/mcp-<n>/respaldo/mcp/archivos/`.
- **Cancelar una petición no detiene la herramienta**: sin estado, la respuesta de una petición cancelada ya no se envía, pero `ejecutar_pruebas` o `escribir_archivo` terminan y sus efectos se aplican (la especificación pide dejar de trabajar, «SHOULD»). Abierto (revisión H-09).
- **`supported` de `-32022` lista solo `2026-07-28`**; el ejemplo oficial lista también otras. No se pudo contrastar con el esquema (revisión H-12).
- **No hay mensajes agrupados** (retirados en la versión 2025-06-18 del protocolo); solo herramientas: ni recursos, ni prompts, ni muestreo.
- **El resultado de las pruebas se decide por el código de salida**, con los mismos límites que el ciclo: un `process.exit(0)` en el código falsea un éxito.
- **La revisión 2026-07-28 no se ha probado con el cliente oficial**, solo con un cliente mínimo escrito a partir de la especificación (`tests/mcp-sin-estado.test.js`). De esa revisión se implementa lo que necesita un servidor de herramientas: `server/discover`, `tools/list`, `tools/call`, la cancelación y una suscripción que no notifica nada (la lista de herramientas no cambia).
- Las revisiones con saludo: probado con el cliente oficial del SDK de MCP y con Docker real en Windows. **No probado con Claude Code ni con otros clientes**, ni en Linux con Docker.
