# Estado actual de Fragua (5.0.0, sin publicar)

> **Fecha:** 2026-10-23 · **Rama:** `feature/motor-agentico` · **Último commit con suite completa:** `b4f234d`
> Este documento es el estado de referencia. Las guías (`FORGE-5.0-GUIA.md`, `README.md`) enlazan aquí en vez de repetir cifras. Si una cifra de otro documento no coincide con esta página, manda esta.

## Qué es, en una frase

Fragua es un marco de desarrollo guiado por especificaciones con un **ciclo verificado**: el código que escribe un modelo solo se da por bueno si pasa las pruebas en un contenedor sin red y lo confirma una persona. El veredicto lo decide el código de salida de las pruebas, no el modelo. Sigue llamándose `forge` en su comando antiguo; el nombre nuevo es `fragua`.

## Cifras (último commit verificado)

| Medida | Valor | Cómo se midió |
|---|---|---|
| Pruebas | 3782 en total: 3750 pasan, 31 saltadas, 1 fallo | `npm test` completo en `b4f234d` |
| El fallo | Una batería hostil de 52 entradas, que solo falla bajo la carga de la suite completa | Pasa aislada (19 de 19); no es un fallo del código |
| Tipos | 0 errores | `npm run typecheck` |
| Agentes | 14 (en `agents/`) | Inventario, `scripts/inventario-agentes.mjs` |
| Skills | 31 | Inventario |
| Comandos | 39, con una skill generada cada uno | Inventario |
| Especificaciones | 20 en `.sdd/especificaciones/` (10 de antes, 10 de hoy) | Conteo de carpetas |

Las pruebas saltadas son las que exigen Docker real (`FORGE_TEST_DOCKER=1`) y no se ejecutan en este equipo.

## Lo que funciona y está probado

Probado con pruebas automáticas, y en parte con modelo real en la validación anterior:

- **Ciclo verificado** de planificación, pruebas, implementación y mutación, con aislamiento de Docker (probado de forma real solo en Windows 11 con Docker Desktop).
- **`fragua verificar`**: veredicto aislado sobre un proyecto sin llamar a ningún modelo. Incluye mutación, `--desde` con git neutralizado, `--registrar` con cadena de evidencia firmada y `--comprobar-evidencia`.
- **Puertas declarables** (`sdd.config.yaml`, sección `puertas:`): tipos, linter, seguridad y cobertura, con un comando por clave fija. Dentro de `fragua verificar` y, desde esta semana, también en el ciclo: si una puerta falla, la tarea no se da por buena.
- **Estado del ciclo sellado**: los puntos de guardado y la sesión llevan un sello con una clave del usuario, fuera del proyecto. Un repositorio no puede fabricar un estado que el ciclo acepte.
- **Proveedores**: Anthropic, OpenAI y Ollama con herramientas (conformidad común), niveles neutrales `alto`, `medio` y `economico`.
- **Instalación agnóstica**: `forge init --integracion <clave>` para 9 herramientas con carpeta confirmada en su documentación oficial.
- **Servidor MCP con perfil `verificacion`**: expone solo `verificar`, sin gasto, con límites del entorno del usuario.
- **Contrato público**: esquemas versionados en `docs/contrato/` y una prueba que falla si el código se aparta de ellos.

## Seguridad: lo que ya no puede hacer un repositorio ajeno

La mayor parte de la revisión de hoy consistió en un patrón: **un archivo del proyecto, que puede venir de un repositorio ajeno, decidía algo que protege al usuario**. Todo lo siguiente está cerrado con prueba que fallaba antes:

| Lo que el repositorio ya no puede |
|---|
| Enviar la clave del modelo a otro servidor (`base_url`, `api_key`) |
| Escribir en tu carpeta personal con el instalador |
| Subir el tope de gasto, ni con un `tope.json` o un `sesion.json` fabricados |
| Bajar los precios para que el gasto no cuente |
| Pedir más recursos del contenedor (CPU, memoria, tiempo) |
| Presentar una tarea como verificada con un estado fabricado (sello) |
| Llevar al modelo un archivo ajeno con una ruta `../` o un enlace |
| Autorizar destinos de red con un URL plantado en el propio código |
| Forzar la bifurcación de la cadena de evidencia con dos registros a la vez |

## Límites conocidos (sin cerrar)

- **Ningún contenedor real está medido en este equipo.** No hay Docker aquí. Las cifras de tiempo, consumo y comportamiento en contenedor son de pruebas con un Docker falso.
- **La integración continua en Linux nunca ha corrido.** Está escrita (`tipos`, `pruebas-docker`, `aislamiento`) pero no se ha ejecutado. Requiere abrir la PR a `main`.
- **El modelo real no se ha usado con las funciones nuevas de hoy.** El delimitador de datos ajenos y las puertas en el ciclo no se han probado con un modelo de verdad.
- **Gasto calculado frente a factura:** no comparado. Las tarifas son una lista interna.
- **Integraciones GitHub, GitLab y Jira:** probadas solo contra servidores falsos.
- **Estado del ciclo sellado:** un estado guardado en otro equipo, o tras perder la clave, no se puede reanudar. Es el precio de que el repositorio no pueda fabricarlo.
- **Un adversario deliberado** puede imitar la señal de aserción de la medición de mutación. Está documentado en `GARANTIAS-Y-LIMITES.md`.
- **Secretos partidos, en base64 o en hexadecimal** no los detecta el control de salida. Documentado como límite.
- **Trabajo de perfiles de agente a medias:** la primera entrega está integrada; partes de las tareas F2 a F5 se están completando (ver abajo).

## En curso al redactar este documento

Se actualiza cuando terminen; si lees esto y no hay una fecha posterior, no están integrados:

- Perfiles de agente, tareas F2 a F5: validación del perfil del proyecto, política fuera del árbol, filtrado de herramientas por perfil y regresión de los tres roles.
- Puertas, tareas F3, F6.6, F6.7 y F1.5: pruebas del nodo y del grafo, motivo `puerta` en el estado, lista de archivos protegidos (`tsconfig`, `biome`, etc.) cableada al protocolo de escritura, y candado de lectura de la cabeza de evidencia.

## Lo que solo puede hacer la persona responsable

1. **Abrir la PR a `main`** para que corra la integración continua en Linux: https://github.com/carlos060798/FORGE/compare/main...feature/motor-agentico
2. **Rotar la clave de Anthropic** que apareció en la conversación, y poner una nueva en el entorno con un tope.
3. **Tener Docker en el equipo** para medir contenedores reales (`fragua verificar`, mutación, puertas).
4. **Aprobar formalmente las especificaciones.** Hasta ahora se ha avanzado por delegación, anotado en cada carpeta.
5. **Comprobar marca registrada y dominio de «Fragua»**, y decidir el nombre exacto del paquete.
6. **Cuentas reales** de GitHub, GitLab y Jira para probar las integraciones.
7. **Decidir la publicación**: `5.0.0-beta.1` con la etiqueta `next`, y cuándo.

## Documentos relacionados

- [FORGE-5.0-GUIA.md](FORGE-5.0-GUIA.md): cómo usarlo, configuración y comandos.
- [GARANTIAS-Y-LIMITES.md](GARANTIAS-Y-LIMITES.md): qué garantiza cada parte y con qué prueba.
- [PROBLEMAS-CONOCIDOS.md](PROBLEMAS-CONOCIDOS.md): incidencias abiertas y cerradas, con su evidencia.
- [INVENTARIO-AGENTES-Y-SKILLS.md](INVENTARIO-AGENTES-Y-SKILLS.md): agentes, skills y comandos, generado por script.
- [ADECUACION-DEL-CATALOGO.md](ADECUACION-DEL-CATALOGO.md): plan para el catálogo de agentes y skills.
