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
- Versiones del protocolo: 2024-11-05, 2025-03-26 y 2025-06-18.

## Límites conocidos

- **Sin autenticación ni transporte de red**: el servidor lo lanza tu cliente como proceso hijo y confía en él. No lo expongas por otro canal.
- **Un agente con estas herramientas puede escribir código dañino en `src/`.** Se ejecuta solo dentro del contenedor, pero queda en tu proyecto. Revisa el diff antes de hacer commit. Una configuración ejecutable que no esté en las listas de rutas se escribiría.
- **Los respaldos se guardan, pero no hay herramienta para restaurarlos**: están en `.sdd/motor/mcp-<n>/respaldo/mcp/archivos/`.
- **No hay mensajes agrupados** (retirados en la versión 2025-06-18 del protocolo); solo herramientas: ni recursos, ni prompts, ni muestreo.
- **El resultado de las pruebas se decide por el código de salida**, con los mismos límites que el ciclo: un `process.exit(0)` en el código falsea un éxito.
- Probado con el cliente oficial del SDK de MCP y con Docker real en Windows. **No probado con Claude Code ni con otros clientes**, ni en Linux con Docker.
