# Crítica hostil de FORGE / Fragua 5.0.0

> Fecha: 2026-11-06. Revisión de solo lectura. Cada hallazgo lleva una etiqueta: **[D]** demostrado con archivo:línea o comando; **[O]** opinión del crítico.
> Lo que no se hizo: no se ejecutó la suite completa (la propia documentación dice que tarda 1277 s), no se usó Docker y no se llamó a ningún modelo.

## 1. Lo que se promete frente a lo que se puede comprobar

| Afirmación | Dónde | Realidad | Tipo |
|---|---|---|---|
| "De una idea en lenguaje natural a producción" | README.md:9 | ESTADO-ACTUAL.md:51-54: no hay ningún contenedor real medido en el equipo de desarrollo, la CI en Linux "nunca ha corrido" y las funciones nuevas no se han probado con un modelo real. Nada respalda la palabra "producción". | D |
| "Convierte ideas en productos implementados, probados y desplegados" | README.md:20 | No hay evidencia de un solo despliegue de extremo a extremo hecho por un usuario. | D (falta de evidencia) |
| "Sin escribir código", palabras clave `no-code`, `citizen-developer` | package.json:4, :70 | Para el ciclo verificado hace falta Docker, una clave de API, Node >= 20 y leer veredictos de mutación. Una persona no técnica no puede auditar lo que se le entrega. | O, con base en D |
| Los guards "garantizan que una persona revisó y aprobó la especificación" | README.md:143 | `.sdd/especificaciones/2026-10-03-api-http/plan.md:3` dice `estado: aprobado_por_delegacion`. En `spec.md:172` el dueño pidió "seguir sin preguntar". En `ciclo-verificado/analisis.md:30` las seis preguntas abiertas se resolvieron "con el valor recomendado, sin respuesta individual". El propio proyecto se salta su garantía central. | D |
| Las cifras "14 agentes, 39 comandos, 31 skills" | README.md:20, package.json:4 | Son ciertas como conteo de archivos (14 en `agents/`, 39 en `commands/`, 31 en `skills/`). Pero ESTADO-ACTUAL.md:16-18 reconoce que se miden contando archivos. Es una métrica de volumen, no de valor. Además el preset por defecto solo activa 6 agentes (README.md:173). | D (cifra) / O (inflada) |
| 3909 pruebas | ESTADO-ACTUAL.md:13 | Hay honestidad: la suite no está verde (1 fallo y 31 saltadas). Las 31 saltadas son justo las de Docker real, es decir, la parte que respalda la tesis "verificado en contenedor sin red" (`tests/api-http.test.js:345`, `:469`, `tests/ciclo-mutacion.test.js:1210`). | D |

## 2. Pruebas que prueban menos de lo que parece

- **[D] Lo esencial se salta.** Toda la verificación con contenedores reales está tras `FORGE_TEST_DOCKER=1`, y ESTADO-ACTUAL.md:51 admite que no hay Docker en la máquina del autor. Los tiempos y el comportamiento en contenedor salen de un "Docker falso".
- **[D] Hay muchos saltos condicionales silenciosos.** Las pruebas de enlaces simbólicos, que son defensas de seguridad, se saltan si el sistema no deja crear enlaces: `ciclo-tercera-pasada.test.js:83,92,409,420`, `ciclo-hallazgos.test.js:100,110,117`, `ciclo-protocolo.test.js:104,291`, `ciclo-datos.test.js:322`. En Windows sin modo desarrollador, esas defensas pasan en verde sin haberse comprobado. `ciclo-mutacion.test.js:1308` se salta si "no se pudo preparar el escenario".
- **[D] Las integraciones usan dobles.** Según ESTADO-ACTUAL.md:56-57, GitHub, GitLab y Jira solo se probaron contra servidores falsos, y las puertas de calidad con "Docker falso y un modelo guionizado" (:35).
- **[D] Hay pruebas inestables.** Fallaron pruebas intermitentes en `f195354` y `03d4baa` (ESTADO-ACTUAL.md:23). Una suite que depende de la velocidad del disco no sirve como señal de CI.
- **[O, indicio D] Muchas pruebas son estructurales.** Hay 243 usos de `existsSync(` en `tests/*.js` frente a unas 2749 llamadas `test(`/`it(`. Parte de la suite comprueba que un archivo existe, no que algo funciona. No se auditó una por una: es un indicio, no una prueba.
- **[D] El autor reconoce que la medición de mutación se puede engañar** (ESTADO-ACTUAL.md:59). Es justo la métrica que debería separar las pruebas buenas de las vacías.

## 3. Complejidad y sobreingeniería

- **[D]** `cli/index.js` tiene 2243 líneas, unas 50 funciones de nivel superior y 32 ramas `case "`. Es un monolito de despacho con mucho acoplamiento.
- **[D]** `core/` tiene unas 23 600 líneas de JS para una herramienta 5.0.0 sin publicar (ESTADO-ACTUAL.md:1, CHANGELOG.md:8 "Sin publicar" y CHANGELOG.md:187 "4.3.0 — No publicada").
- **[D]** Hay 46 documentos `.md` en `docs/`. Algunos son enormes: PROBLEMAS-CONOCIDOS.md (70 KB), ciclo-verificado.md (57 KB), GARANTIAS-Y-LIMITES.md (36 KB). El CHANGELOG ocupa 55 KB.
- **[D] Hay duplicados:** `agents.md` e `INVENTARIO-AGENTES-Y-SKILLS.md`; `INTEGRACIONES.md` e `integraciones-externas.md`; `FORGE-5.0-GUIA.md` y `FORGE-DOCUMENTACION.html`; `docs/` y `docs-site/`. Hay tres binarios para el mismo archivo (`fragua`, `forge`, `sdd-es`, en package.json:6-9), `skills/` y `skills-generadas/`, y `tests/` y `__tests__/`.
- **[O]** Un marco SDD con sello criptográfico del estado, cadena de evidencia firmada, servidor MCP, API HTTP, panel, memoria SQLite-wasm, indexador AST y tres proveedores de modelo resuelve problemas que nadie le ha planteado todavía, porque no hay usuarios.

## 4. Madurez y riesgo de abandono

- **[D]** El paquete no está publicado, así que el número de usuarios externos es 0 (CHANGELOG.md:8). Las versiones 4.3.0 y 5.0.0 nunca salieron.
- **[Corregido]** El agente creyó que la copia no era un repositorio git porque el entorno decía `Is a git repository: false`. Es un error: `forge/FORGE` sí tiene `.git` y la historia citada (`be747d6`, `1d728f5`) se puede auditar con `git log`.
- **[D]** ESTADO-ACTUAL.md:5-6 está fechado el 2026-10-24 y desde entonces hay cambios en `core/` y `tests/` (6/11). La "fuente de verdad" ya está desfasada.
- **[O]** Hay un solo mantenedor (`carlos060798`, package.json), las decisiones se aprueban "por delegación" y el dueño hace a la vez de autor y revisor. El factor bus es 1.

## 5. Por qué alguien elegiría Spec Kit u OpenSpec

- **[O]** Ambos son agnósticos de la herramienta y ligeros (plantillas más unos pocos comandos), tienen comunidad, issues públicos y versiones publicadas. Fragua exige aprender 39 comandos, 14 agentes y su propio vocabulario en español.
- **[O]** El idioma es una ventaja de nicho y a la vez un límite: cierra la puerta a los colaboradores que no hablan español.
- **[O]** El diferencial real de Fragua (veredicto por código de salida en un contenedor sin red, más mutación) es valioso, pero justo esa parte es la menos probada en condiciones reales (§2).

## 6. Mérito que hay que reconocer (para no inventar)

- ESTADO-ACTUAL.md y el README admiten abiertamente que la suite no está verde y enumeran sus límites. Esa franqueza es poco habitual y le resta fuerza a varias críticas.
- La tabla de defensas frente a un repositorio ajeno (ESTADO-ACTUAL.md:40-50) dice estar cubierta por pruebas que fallaban antes del arreglo. No se verificó una por una.

## 7. Las 10 críticas más duras que resisten la verificación

| # | Crítica | Evidencia | Qué haría falta para refutarla |
|---|---|---|---|
| 1 | El README promete "producción" y "desplegados" sin un solo despliegue documentado | README.md:9, :20; ESTADO-ACTUAL.md:51-54 | Un caso de extremo a extremo reproducible: idea, despliegue y registro |
| 2 | La garantía "una persona revisó la spec" la incumple el propio proyecto | README.md:143 frente a `api-http/plan.md:3`, `spec.md:172` | Aprobaciones nominativas, sin la opción "por delegación", y que el guard la rechace |
| 3 | La tesis central (contenedor sin red) no se ha ejecutado de verdad en la máquina de desarrollo | ESTADO-ACTUAL.md:51; 31 pruebas saltadas | Ejecución con `FORGE_TEST_DOCKER=1` en CI pública, con registros |
| 4 | La CI en Linux nunca ha corrido | ESTADO-ACTUAL.md:52 | Un enlace a ejecuciones verdes de GitHub Actions |
| 5 | La suite no está verde y es inestable según la carga y el disco | ESTADO-ACTUAL.md:13, :21-23 | Tres pasadas verdes seguidas en hardware limpio |
| 6 | Las defensas de enlaces simbólicos se saltan en silencio donde no se pueden crear enlaces | `ciclo-tercera-pasada.test.js:83` y otros 8 | Que los saltos fallen en CI o que se informen como "no verificado" |
| 7 | Ninguna función nueva se ha probado con un modelo real | ESTADO-ACTUAL.md:53 | Una batería de evaluación con un modelo real, con coste y resultados publicados |
| 8 | Un monolito CLI de 2243 líneas y unas 23 600 líneas de core para 0 usuarios | `cli/index.js`; recuento de `core/` | Dividirlo en módulos por comando y justificar cada subsistema con un caso de uso real |
| 9 | Documentación inflada y duplicada (46 md, varios pares redundantes) que ya se desfasa | `docs/`; fecha de ESTADO-ACTUAL frente a los cambios del 6/11 | Consolidar en una sola fuente y generar las cifras automáticamente |
| 10 | Factor bus 1 y 0 versiones publicadas desde 4.2.0 | package.json; CHANGELOG.md:8, :187 | Publicar en npm, sumar usuarios externos y un segundo mantenedor con permisos de revisión |
