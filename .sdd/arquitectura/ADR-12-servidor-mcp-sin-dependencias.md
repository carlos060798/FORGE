# ADR-12: Servidor MCP propio, sin dependencias, por entrada y salida estándar

> Estado: propuesta  # propuesta | aceptada | obsoleta | reemplazada-por-ADR-XX
> Fecha: 2026-10-03
> Spec relacionada: 2026-10-03-herramientas-mcp
> Autor: Claude (pendiente de aceptación por el dueño)

## Contexto

El plan maestro prevé exponer el aislamiento y la escritura confinada como servidor MCP (FASE 2). El SDK oficial (`@modelcontextprotocol/sdk@1.32.0`) declara 17 dependencias directas, entre ellas `express`, `hono`, `jose`, `cors` y `express-rate-limit`, pensadas para el transporte HTTP. Un servidor por entrada y salida estándar no las necesita. El Principio IV exige un ADR por cada dependencia y que las pesadas sean opcionales.

## Decisión

Se implementa el servidor en `core/mcp/` sin dependencias: JSON-RPC 2.0 con mensajes delimitados por salto de línea sobre stdin y stdout, con `initialize`, `notifications/initialized`, `ping`, `tools/list` y `tools/call`, que es lo que necesita un servidor de herramientas. Acepta las versiones del protocolo 2024-11-05, 2025-03-26 y 2025-06-18. Solo los mensajes del protocolo van a stdout; los avisos, a stderr.

Se verifica contra el cliente oficial del SDK instalado en un directorio temporal, fuera del repositorio (`tests/mcp-interop.test.js`, que se salta si el SDK no está disponible).

Las tres herramientas reutilizan el código del ciclo: `validarRuta` y `aplicarArchivos` de `protocolo-archivos.js`, `SandboxRunner`, `Respaldo` y el candado de proyecto. No hay una segunda implementación de las reglas de rutas.

## Alternativas consideradas

- **A. SDK oficial como dependencia**: rechazada por el peso (17 dependencias directas) para un transporte que no usa HTTP.
- **B. SDK oficial como dependencia opcional**: rechazada porque el servidor no arrancaría sin ella; el valor está en que `forge mcp` funcione siempre.
- **C. Protocolo propio mínimo, verificado contra el SDK**: aceptada.

## Consecuencias

### Positivas
- Cero dependencias nuevas y un único punto de reglas de rutas.
- El protocolo se puede probar entero sin procesos externos (flujos en memoria).

### Negativas
- Hay que seguir la evolución del protocolo a mano. Solo se cubren las capacidades de herramientas.
- Sin batching (retirado en la versión 2025-06-18): una petición agrupada recibe un error.

### Neutrales
- Si más adelante hace falta HTTP, un transporte nuevo puede reutilizar `ServidorMcp`: toma entrada y salida como flujos.

## Cuándo revisitar

- Si el protocolo añade capacidades obligatorias para servidores de herramientas.
- Si se necesita el transporte HTTP: valorar entonces el SDK.

## Referencias

- Protocolo MCP: https://modelcontextprotocol.io
- `core/ciclo/protocolo-archivos.js`, `core/sandbox/*`, `core/ciclo/candado.js`
