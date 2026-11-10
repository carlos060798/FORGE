# Estado actual de Fragua (5.0.0, sin publicar)

> **Fecha:** 2026-11-06 · **Rama:** `main` · **Última suite completa:** árbol de trabajo previo al commit `17cbbc4` (4131 de 4162 pasan, 0 fallos, 31 saltadas)
> Este documento es el estado de referencia. Las guías (`FORGE-5.0-GUIA.md`, `README.md`) enlazan aquí en vez de repetir cifras. Si una cifra de otro documento no coincide con esta página, manda esta.

## Qué es, en una frase

Fragua es un marco de desarrollo guiado por especificaciones con un **ciclo verificado**: el código que escribe un modelo solo se da por bueno si pasa las pruebas en un contenedor sin red y lo confirma una persona. El veredicto lo decide el código de salida de las pruebas, no el modelo. Sigue llamándose `forge` en su comando antiguo; el nombre nuevo es `fragua`.

## Cifras (última suite completa)

| Medida | Valor | Cómo se midió |
|---|---|---|
| Pruebas | 4162 en total: 4131 pasan, 0 fallan, 31 saltadas | `npm test` el 2026-11-06 sobre el árbol previo a `17cbbc4`, Windows 11, Node 24, un solo `npm test` en marcha; 385 s |
| Tipos | 0 errores | `npm run typecheck` el 2026-11-06, mismo árbol |
| Agentes | 14 (en `agents/`) | Conteo de archivos |
| Skills | 31 (en `skills/`) | Conteo de carpetas |
| Comandos | 39, con una skill generada cada uno | Inventario, `scripts/inventario-agentes.mjs` |
| Especificaciones | 24 en `.sdd/especificaciones/` (9 en borrador, 15 en implementación; ninguna completada) | `.sdd/INDICE.md`, recalculado el 2026-11-06 |

Las pruebas saltadas son las que exigen Docker real (`FORGE_TEST_DOCKER=1`) y no se ejecutan en este equipo.

**La última pasada completa salió verde, pero no es estable en todas las máquinas.** Antes (`be747d6`) falló «5000 archivos pequeños» por lentitud del disco y, en otras pasadas, pruebas de tiempo límite bajo carga; aisladas, pasan. `tests/verificar-mutacion.test.js` tarda unos 42 s aislado y 74 s dentro de la suite; su tope por invocación ahora es de 600 s y está en `npm run test:lento`. La causa del agotamiento de tiempo que se vio antes no se confirmó. Las 31 saltadas son las de Docker real. **No hay una pasada verde en Linux ni en macOS**: el CI de GitHub corre desde el 2026-11-05 y su resultado no consta aquí.

**Pasadas anteriores con fallos intermitentes.** En `f195354` fallaron tres pruebas con la carga de la suite entera (memoria SQLite, batería hostil de 52 entradas y un límite de tiempo de `adfATexto`); aisladas pasan. En `03d4baa`, con otra suite corriendo en la misma máquina, fallaron pruebas de tiempo límite (`comoDato`, «una cadena enorme», «5000 archivos»). Todas las de tiempo límite pasan aisladas.

**CI de GitHub, comprobado el 2026-11-09 (API pública, sin acceso a los logs):** el último run de `main` (commit `8cc2e58`, 2026-11-06) está **en rojo**: `Tipos (Node 22)` y `Criterios y evidencia` pasan; `Tests (Node 22)`, `Aislamiento con Docker real` y `Pruebas con Docker real` fallan; `Tests (Node 20)` se cancela. **La CI nunca ha estado verde en Linux.** Leer los logs exige autenticación (`gh auth login`): es la tarea T8 de la spec `2026-11-09-ci-verde-y-cuarentena`.

**Cuarentena (2026-11-09, ADR-23):** una prueba inestable se aparta en `tests/cuarentena.txt` con incidencia, fecha y motivo; `npm test` la excluye y el job `cuarentena` (no bloqueante) la sigue ejecutando; caduca a los 30 días y hay un tope de 5. Hoy no hay ninguna. La CI tiene además el job `test-windows` (suite completa en `windows-latest`, Node 22, sin Docker real); las llamadas a `t.skip` por no poder crear enlaces (unas 35 en el código) solo se saltan cuando el sistema no deja crear el enlace; en este Windows, el 2026-11-10, fueron 6 de las 31 omitidas, todas por no poder crear enlaces simbólicos de archivo (las demás: Docker real, proveedores sin herramientas, cuenta de pruebas real, SDK opcional, permisos POSIX). La rama `pruebas-enlaces-windows` las marca «NO VERIFICADO» en vez de dejarlas pasar en silencio.

**Docker real en Windows, 2026-11-10 (Docker Desktop 29.7.2, Node 24, este árbol):** por primera vez se ejecutaron sobre esta versión las pruebas que piden `FORGE_TEST_DOCKER=1`, con el mismo mando que el job `pruebas-docker` (17 archivos, uno cada vez): **597 pruebas, 594 pasan, 0 fallan tras una corrección, 3 saltadas**, 46 minutos, sin contenedores residuales. `tests/sandbox-real.test.js` (aislamiento: sin red, sin privilegios, raíz de solo lectura, tiempo y memoria acotados): 11 de 11. La única causa de fallo fue de las pruebas, no del producto: el helper `contenedores` de `tests/fixtures/ciclo-guionizado.mjs` filtraba por las etiquetas antiguas `forge.*` y no veía los contenedores `fragua.*`, así que las tres pruebas de corte de proceso (`tests/corte-real.test.js`) nunca encontraban el contenedor vivo. Corregido; con Docker real quedan 25 de 25. **Sigue sin medirse en Linux.**

**Pendiente:** leer los logs del run rojo, clasificar cada fallo (carga, rutas/enlaces, Docker, otro) y corregir lo que sea código; lo inestable, a cuarentena con incidencia. Hipótesis tras la pasada con Docker real: el fallo de `Pruebas con Docker real` en la CI puede ser este mismo helper (fallaría igual en Linux); el de `Aislamiento con Docker real` no se explica con esto y hay que leer el log.

**Rama `fase-2-puerta-de-entrada` (2026-11-09, sin fusionar hasta que la CI esté verde):** perfil de instalación `esencial` por defecto y configuración de ejemplo igual al preset lean (ADR-24); `forge doctor` distingue Docker no instalado de no arrancado y termina con «Siguiente paso»; `deploy-vercel`, `sdd.optimizar` y `sdd.optimizar-memoria` son alias explícitos; `__tests__/` eliminada (no probaba código del proyecto); `docs/PRIMEROS-15-MINUTOS.md` nueva; planes antiguos en `docs/archivo/planes/`. Spec `2026-11-09-puerta-de-entrada-solo-dev`.

## Lo que funciona y está probado

Probado con pruebas automáticas, y en parte con modelo real en la validación anterior:

- **Ciclo verificado** de planificación, pruebas, implementación y mutación, con aislamiento de Docker (probado de forma real solo en Windows 11 con Docker Desktop).
- **Puertas de calidad en el ciclo**: tras las pruebas, cada puerta declarada en `sdd.config.yaml` se ejecuta; si una no pasa, la tarea vuelve al implementador con la salida. Solo una herramienta ausente (código 127) pide revisión humana. Probado con Docker falso y un modelo guionizado, no con un modelo real.
- **`fragua verificar`**: veredicto aislado sobre un proyecto sin llamar a ningún modelo. Incluye mutación, `--desde` con git neutralizado, `--registrar` con cadena de evidencia firmada y `--comprobar-evidencia`.
- **Perfiles de agente por rol** (planificador, QA, implementador): el proyecto solo puede apretar; lo que intente ampliar se ignora y se anota. Pruebas por capas, con mutaciones que las pruebas detectan. Faltan las tareas F6 y F7 de su especificación.
- **Estado del ciclo sellado**: los puntos de guardado y la sesión llevan un sello con una clave del usuario, fuera del proyecto. Un repositorio no puede fabricar un estado que el ciclo acepte.
- **Proveedores**: Anthropic, OpenAI y Ollama con herramientas (conformidad común), niveles neutrales `alto`, `medio` y `economico`.
- **Instalación agnóstica**: `forge init --integracion <clave>` para 9 herramientas con carpeta confirmada en su documentación oficial.
- **Servidor MCP con perfil `verificacion`**: expone solo `verificar`, sin gasto, con límites del entorno del usuario.
- **Contrato público**: esquemas versionados en `docs/contrato/` y una prueba que falla si el código se aparta de ellos.

## Seguridad: lo que ya no puede hacer un repositorio ajeno

La mayor parte de la revisión consistió en un patrón: **un archivo del proyecto, que puede venir de un repositorio ajeno, decidía algo que protege al usuario**. Todo lo siguiente está cerrado con prueba que fallaba antes:

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
| Ampliar sus herramientas, rutas o topes desde su propio perfil de agente |
| Escribir la configuración de las herramientas de calidad (`tsconfig`, `biome`, etc.) desde el implementador |

## Límites conocidos (sin cerrar)

- **Ningún contenedor real está medido en este equipo.** No hay Docker aquí. Las cifras de tiempo, consumo y comportamiento en contenedor son de pruebas con un Docker falso.
- **La integración continua en Linux nunca ha corrido.** Está escrita (`tipos`, `pruebas-docker`, `aislamiento`) pero no se ha ejecutado. Requiere abrir la PR a `main`.
- **El modelo real no se ha usado con las funciones nuevas.** El delimitador de datos ajenos, las puertas en el ciclo y los perfiles de agente no se han probado con un modelo de verdad.
- **Gasto calculado frente a factura:** no comparado. Las tarifas son una lista interna.
- **Integraciones GitHub, GitLab y Jira:** probadas solo contra servidores falsos.
- **Estado del ciclo sellado:** un estado guardado en otro equipo, o tras perder la clave, no se puede reanudar. Es el precio de que el repositorio no pueda fabricarlo.
- **Un adversario deliberado** puede imitar la señal de aserción de la medición de mutación. Está documentado en `GARANTIAS-Y-LIMITES.md`.
- **Secretos partidos, en base64 o en hexadecimal** no los detecta el control de salida. Documentado como límite.
- **Servidor MCP de edición** (`editar` en `core/mcp/herramientas.js`): escribe con las reglas de coder y qa, sin pasar por el perfil de agente. Está fuera del ciclo; pendiente de decidir si entra en esta entrega.
- **Política del usuario para los perfiles de agente**: hoy solo viene de variables de entorno, no de un archivo de estado. Decisión pendiente.
- **Pruebas intermitentes bajo carga**: ver «Pasadas intermitentes» arriba.

## En curso al redactar este documento

Se actualiza cuando terminen; si lees esto y no hay una fecha posterior, no están integrados:

- Perfiles de agente, tareas F6 y F7 (`.sdd/especificaciones/2026-10-14-perfiles-de-agente/`).
- Puertas, tareas F4 y F7 (criterios de aceptación y cierre), y F6.7 en lo que queda: `ciclo:llamada` con `modeloServido` (un evento nuevo con contrato) y `DockerCli.identidadImagen`.
- Ciclo por MCP, tareas F4 y F5.
- Ligar las puertas a los `tsconfig` referenciados (`extends`) y la verificación con Docker real (F8.2): documentados como límites, sin implementar.

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
- [archivo/](archivo/): planes, informes y análisis superados. Se conservan como historia, no como guía.
