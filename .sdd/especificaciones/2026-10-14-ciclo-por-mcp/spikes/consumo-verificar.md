# Spike S0.3: consumo de una verificación (tiempo, memoria, disco)

> **No medido: sin confirmar.** El equipo de la investigación no tiene daemon de Docker (`docker version` falla al conectar con `dockerDesktopLinuxEngine`), y la tarea prohíbe ejecutar la suite. Lo que sigue son los **límites ya impuestos por el código** y el método para medir; las cifras reales hay que tomarlas con Docker.

## Límites que ya acotan una verificación (por código)

| Recurso | Límite actual | Dónde |
|---|---|---|
| CPU del contenedor | 1 CPU | `LIMITES_POR_DEFECTO` `politica.js:260` (y `sandbox.cpus` del proyecto, SIN techo: ver abajo) |
| Memoria | 512 MiB (`--memory` = `--memory-swap`) + `/tmp` 64 MiB tmpfs que cuenta dentro | `politica.js:260,360-361,383-385` |
| Procesos | 256 | `politica.js:260,385` |
| Tiempo por ejecución | 120 s | `config.js` `sandbox.timeout_s`; `sandbox-runner.js:199` |
| Salida capturada | 1 MiB | `sandbox.salida_max_bytes`; `docker-cli.js:50` (`maxBytes`) |
| Tamaño de archivo escrito | 100 MiB (`fsize`) | `politica.js:388-389` |
| Salida en el resultado | 8 KiB | `resultado.js:20` |
| Disco de la copia de trabajo | **ninguno** (el único límite es el tiempo) | `docs/ciclo-verificado.md` §aislamiento |
| Mutación | `mutacion_timeout_s` 300, `mutacion_max_archivos` 5, `mutacion_max` 10 | `config.js` `motor` |

- Memoria/disco del anfitrión: la copia (`staging`) del proyecto se crea en la carpeta temporal (`verificar/index.js:142-144`) y se borra al final (`:236-243`); su tamaño es el del proyecto sin lo vetado (`staging.js:23`). Una imagen de dependencias nueva puede pesar cientos de MiB (`npm ci`, `preparar-imagen.js:119-120`).
- **Hallazgo de seguridad conectado**: `sandbox.cpus/memoria/pids/timeout_s/salida_max_bytes` los fija el proyecto y no tienen techo (experimento, ver `puertas-de-calidad…/spikes/varias-ejecuciones.md`: 64 CPU, 64g, timeout 99999 se aceptan). Para la fase 1 por MCP, el que llama no controla el repositorio pero el repositorio sí controla el coste local: **el servidor MCP debe aplicar techos propios** (p. ej. tiempo ≤ 300 s, memoria ≤ 1g) por encima de lo que lea de la configuración.

## Qué fijar y cómo medirlo

1. Topes del servidor MCP (a validar con medición): tiempo máximo por llamada = `min(sandbox.timeout_s, 300)` + preparación de imagen; tamaño de respuesta ≤ 16 KiB; una llamada a la vez; N por hora y por día (contadores firmados en el estado del usuario, patrón `core/integraciones/auditoria.js`, `topeDiarioDe`).
2. Medición (cuando haya Docker): ejecutar `forge verificar --json` 10 veces en 3 proyectos (Node pequeño, Node con dependencias, Python) y registrar `duracionMs` (ya viene en el resultado, `resultado.js:64`), `docker stats --no-stream` del contenedor (memoria pico), `du` de la carpeta `forge-verificar-<hash>` en el temporal antes del borrado, y tiempo de la primera ejecución (construcción de imagen) frente a las siguientes.
3. La primera llamada por MCP en un equipo nuevo puede tardar minutos (descarga de imagen base con red: `descargarBase: true`, `crear-sandbox.js:227`; esa red es del **anfitrión**, no del contenedor). Hay que decidir si la fase 1 por MCP la permite: es una salida a internet disparada por un agente. Recomendación: en el perfil MCP, `descargarBase: false` y mensaje «prepara la imagen con `fragua doctor`/`fragua verificar` primero» (falla cerrado, sin red por orden de un agente).

## Qué cambia en la spec o el plan

- Plan F2.3: los topes de salida y duración tienen valores de partida (arriba) y una tarea de medición S0.3 pendiente de Docker.
- Plan F1.4/F1.3: añadir «sin imagen preparada: error de herramienta, no se descarga ni se construye» o decidir expresamente lo contrario.
- Techos de `sandbox.*` aplicados por el servidor.

## Riesgos

- Sin cuota de disco: un test que llene `/work` agota el disco del anfitrión hasta el timeout (documentado en `ciclo-verificado.md`).
- Cifras de consumo desconocidas: no fijar topes numéricos finales en la spec hasta medir.
