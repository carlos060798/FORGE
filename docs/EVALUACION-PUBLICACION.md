# Evaluación de publicación de FORGE 5.0.0

> Fecha: 2026-10-13 · Rama `feature/motor-agentico` · Evaluador independiente, solo lectura (sin suite, sin commit).
> Fuentes leídas: `PLAN-CIERRE-BRECHAS.md`, `PLAN-EJECUCION-FINAL.md` (§2, §4, §6), `.sdd/INDICE.md`, `docs/PROBLEMAS-CONOCIDOS.md`, `docs/MIGRACION-5.0.md`, `CHANGELOG.md`, las `revision-independiente*.md` y `evidencia-2026-10-09.md`. No re-ejecuté pruebas: las cifras son las que declaran esos documentos.

## Veredicto

**No publicar 5.0.0 entera hoy. Publicar `5.0.0-beta.1` con etiqueta `next` (nunca `latest`)** cuando se cierren los bloqueantes de la sección 6. El motor central (ciclo verificado) está bien demostrado en Windows con un modelo real; lo que no está demostrado es lo demás: Linux, macOS, CI, integraciones reales, gasto frente a factura y documentación coherente.

## 1. Cuánto cubre el plan

Criterio: las 36 tareas de `PLAN-EJECUCION-FINAL.md` §2, con el estado del registro §6. «Hecho» = implementada por el agente y pasada revisión/pruebas locales (Windows). «Validado fuera» = comprobado en plataforma, cuenta o factura real distinta del equipo de desarrollo.

| Bloque | Tareas | Hecho | Hecho, sin validar fuera | Pendiente del dueño | Sin hacer / sin confirmar |
|---|---|---|---|---|---|
| 1 Integraciones | 9 | 1.1 a 1.6 (6) | todas (servidores falsos) | 1.7, 1.8 | 1.9 (cliente MCP) |
| 2 Mutación | 3 | 2.1 (N-02 cerrado, con límite del adversario) | — | 2.3 (crédito) | 2.2 (Docker real Py/TS: P-5 «sin comprobar») |
| 3 Gasto | 6 | 3.1 (mitigado; causa de H13 abierta), 3.2 a 3.5 | 3.5 sí contrastado con la fuente | 3.6 | — |
| 4 Config/protocolo | 6 | 4.1 a 4.5 | 4.3 sin cliente oficial (M-2) | — | 4.6 |
| 5 Revisión | 3 | 5.1, 5.2 | — | — | 5.3 (§6 la lista como pendiente y a la vez «tras la quinta revisión»: ambiguo) |
| 6 CI/doc/publicar | 9 | 6.1 (escrito, nunca corrió), 6.2, 6.3 (parcial) | — | 6.4, 6.6, 6.7, 6.8, 6.9 | 6.5 (depende de 6.4) |
| **Total** | **36** | **22 (61 %)** | | **8 (22 %)** | **6 (17 %)** |

Notas: el pendiente del dueño cuenta 1.7, 1.8, 3.6, 6.4, 6.6, 6.7, 6.8, 6.9; sin hacer o sin confirmar: 1.9, 2.2, 2.3, 4.6, 5.3, 6.5.

**% global:** 61 % implementado por el agente. Si solo cuenta lo que tiene ejecución real fuera de dobles, el «publicable con evidencia» baja a ~40 % (aprox. 14 de 36: 2.1, 3.2 a 3.5, 4.1, 4.2, 4.4, 4.5, 5.1, 5.2, 6.2, 6.3 parcial). Las integraciones (1.x), la CI (6.1) y MCP oficial (4.3) no cuentan como validadas.

### Criterio de terminado (§4), uno a uno

Los 8 checkboxes del archivo están todos sin marcar (`PLAN-EJECUCION-FINAL.md` §4). Mi lectura:

| # | Criterio | Estado honesto |
|---|---|---|
| 1 | CI Linux con jobs de tipos y Docker pasa | **No.** Nunca corrió; la rama no tiene PR abierta (PLAN C2; PROBLEMAS PL-4). |
| 2 | Suite 0 fallos en tres pasadas con Docker | **No.** §6: 3025 pruebas, 3016 pasan; luego 2989 con 3 fallos por suspensión del equipo, aisladas pasan. No hay tres pasadas verdes seguidas documentadas (PL-3). |
| 3 | Revisiones sin altos abiertos | **Parcial.** Revisiones 2, 3, 4 e integraciones-3 terminan APROBADA_CON_OBSERVACIONES; la primera de validación y las integraciones 1 y 2 fueron RECHAZADAS y corregidas (R1 a R15, H1 a H12). La revisión integraciones-3 deja N3-09 como «alta» en su propio texto; no confirmé que se corrigiera. |
| 4 | N-02 cerrado y mutación medida con Docker en lo que se promete | **Parcial.** N-02 cerrado; Python/TS con Docker real «sin comprobar» (P-5). |
| 5 | Gasto dentro del 5 % de lo facturado | **No.** Nunca comparado (G-1); la evidencia mezcla dos listas de precios (G-2). |
| 6 | Prueba real mínima por plataforma o documentado «sin probar» | **Parcial.** I-1 lo documenta como sin probar; cumple la alternativa, pero I-2 está desfasado. |
| 7 | Documentación coincide con el código | **Parcial.** Existe `tests/consistencia-cifras.test.js`, pero `docs/PROBLEMAS-CONOCIDOS.md` (cabecera: commit `82815b4`) dice en I-2 que publicación y CLI «no existen», y el plan y `cli/index.js:1333` muestran que sí. |
| 8 | Dueño ratificó especificaciones y decidió publicación | **No.** `.sdd/INDICE.md`: 10 de 10 «en_implementacion», 0 completadas. |

## 2. Qué hace FORGE hoy y con qué evidencia

**Verificado con ejecución real (Anthropic, Windows 11, Docker 29.7, Node 24):**
- 24 ejecuciones del ciclo con modelo real hasta 2026-10-10 (`evidencia-2026-10-09.md`), unos 2,4 USD calculados: JavaScript (suma, Carrito, calc), Python (`a_romano`), Go (ejecuciones 10 y 11), código existente, corte y reanudación, pausa por presupuesto.
- Resultados mezclados: varias «revisión por iteraciones/presupuesto» antes de corregir H1 a H8; luego éxitos (ej. 8: 27/27 pruebas en 3 iteraciones; Go: económico falló, medio pasó).
- Modo por turnos: una tarea, tres veces (T-2), en un archivo de 1812 líneas donde el modo bloque no pudo; caché medida una vez (55 %).
- Paquete instalado fuera del repo: 3 de 3 éxitos con modelo real, 0,13 USD (`PLAN-EJECUCION-FINAL.md` §6; `docs/PRUEBAS-INDEPENDIENTES.md`).

**Solo con dobles, servidores falsos o sin ejecutar:**
- GitHub, GitLab, Jira: servidores HTTP falsos con ejemplos de contrato, no capturas; pruebas reales escritas y no ejecutadas (I-1).
- Cliente MCP oficial con `2026-07-28`: solo un cliente escrito por el mismo autor (M-1, M-2).
- OpenAI y Ollama: sin prueba automática de la llamada (G-3); no admiten herramientas.
- Linux, macOS, Docker en Linux, runtime distinto de `runc`, `mutacion: exigir` con modelo real (P-8), mutación Docker en Python/TS (P-5).

## 3. Límites actuales, por impacto en un usuario real

| # | Límite | Dónde |
|---|---|---|
| 1 | `forge run` exige Docker (código 4 sin él); el modo clásico no aísla nada | MIGRACION 1.2; A-5 |
| 2 | Solo probado en Windows 11; Linux, macOS y Node 20/22 sin evidencia | PL-1 |
| 3 | Solo JS/TS, Python y Go; otro lenguaje no arranca en ciclo | MIGRACION 2.2; C-13 |
| 4 | Python exige `requirements.txt` con pytest; solo `pyproject.toml` se rechaza | MIGRACION 4.1, 4.2 |
| 5 | Gasto calculado nunca contrastado con factura; tope superable en una llamada; modo clásico sin tope duro | G-1, G-6, G-7 |
| 6 | Llamadas que no responden a 120 s sin causa conocida (H13); una cancelada se cobra | G-9; PLAN «Abierto» |
| 7 | «Pruebas pasan» no demuestra corrección: por defecto `mutacion: informar`, pruebas triviales dan éxito | P-1, P-2, C-2 |
| 8 | Con nivel económico el agente de pruebas escribe esperados erróneos y el ciclo no lo distingue | C-1 |
| 9 | Modo por turnos solo Anthropic y con evidencia mínima | T-1, T-2 |
| 10 | `npx forge` descarga otro paquete; hay que usar `forja-mvp` | PL-5 |
| 11 | Integraciones sin cuenta real; alcance del token no verificable en GitHub/Jira; host validado por nombre, no por IP | I-1, I-3, I-4 |
| 12 | Proyectos grandes y ejecuciones largas no probados | PLAN «Abierto» |
| 13 | Constitución dice «dos dependencias» y son tres | PROBLEMAS §8 |

## 4. Cuán funcional es, por escenario

| Escenario | Veredicto |
|---|---|
| JS nuevo, tarea pequeña | **Funciona**, con evidencia real repetida (éxito en 1 a 3 iteraciones). |
| Código existente | **Con reservas**: pocas tareas; en archivos grandes solo el modo turnos (una tarea). Exige declarar `parte_de_codigo_existente` por el rojo obligatorio. |
| Python | **Funciona si** `requirements.txt` declara pytest; si no, se pausa. Mutación sin Docker real medida. |
| Go | **Funciona** en 2 ejecuciones (una falló en nivel económico); sin cgo, 128 MB de `/tmp`. |
| Dos tareas encadenadas | Cubierto por las pruebas independientes; las tareas de código van de una en una (MIGRACION 2.7, que su propio autor no revalidó). |
| Sin Docker | **No funciona** en ciclo; solo modo clásico, sin garantías. |
| Linux / macOS | **Sin comprobar** (suite solo en Alpine dentro de Docker con 4.3.0). |
| Integraciones | **Experimental, apagadas por defecto**, sin cuenta real. No contar con ellas. |

## 5. Qué pasaría si se publica hoy 5.0.0

Estado de npm: `forja-mvp` `latest` = 4.2.0 (consultado el 2026-10-10, MIGRACION cabecera); 4.3.0 nunca se publicó. `dist/forja-mvp-5.0.0.tgz` existe y se instaló en carpeta limpia.

**Riesgos para usuarios:** quien actualice de 4.2.0 recibe de golpe 4.3.0 + 5.0.0, con el ciclo por defecto exigiendo Docker y tope de 2 USD; scripts que solo distinguen 0/1 reciben 3/4; fallos de Linux/macOS aún sin diagnosticar; gasto sin contrastar; documentación contradictoria; confusión `npx forge` frente a `forja-mvp`; claves en el entorno (la usada en pruebas aún sin rotar, 6.8); integraciones sin probar contra plataformas reales.
**Riesgos para el proyecto:** el primer CI Linux correría con el paquete ya público; el número 5.0.0 quedaría quemado; reputación del nombre.

**Reversibilidad:** `npm unpublish` solo en las primeras 72 h y con condiciones, y el número no se reutiliza; quien instaló ya tiene el código. `npm deprecate` y mover `dist-tag latest` son posibles pero no retiran el contenido. El tag git sí se borra. Es irreversible en lo esencial.

| Opción | A favor | En contra |
|---|---|---|
| A. 5.0.0 entera (`latest`) | Cierra la rama | Todos los riesgos caen sobre usuarios de 4.2.0; sin CI Linux; irreversible |
| B. `5.0.0-beta.1` con `--tag next` | `latest` sigue en 4.2.0; solo voluntarios; feedback de Linux/macOS; el número estable queda libre | Hay que cambiar la versión (dos pruebas fijan `5.0.0`); más comunicación |
| C. Dividir (6+9 en 5.0.0; 7+8 en 5.1.0) | Menos superficie inicial | Código ya entrelazado y revisado como bloque; el 5.0.0 resultante sigue sin CI Linux; no reduce el riesgo dominante (plataforma) |

**Recomendación: B.** El riesgo dominante no es el tamaño sino la falta de evidencia fuera de Windows. La beta con `next` lo trata directamente y mantiene `latest` intacto. Dividir (C) no mitiga eso; publicar entera (A) es apostar a que el primer CI Linux pase.

## 6. Condiciones ordenadas hasta «publicable» (beta)

| # | Condición | Responsable | Esfuerzo |
|---|---|---|---|
| 1 | Abrir PR a `main`; CI en verde en Linux (`test`, `tipos`, `pruebas-docker`, `aislamiento`); corregir lo que falle | D abre; A corrige | 0,5 a 2 días |
| 2 | Tres pasadas seguidas de la suite con Docker, 0 fallos, equipo sin carga | A | 0,5 día |
| 3 | Poner al día PROBLEMAS-CONOCIDOS (I-2, cabecera), MIGRACION, CHANGELOG, `docs/integraciones-externas.md`; test de consistencia en verde | A | 0,5 día |
| 4 | Confirmar que la quinta pasada (5.3) no deja altos abiertos (incluida N3-09 de integraciones-3) | A | 0,5 día |
| 5 | Rotar la clave de API usada en pruebas (6.8) | D | 10 min |
| 6 | Ratificar specs, ADR-19 a 22 y Principio VII; decidir la opción B (6.6, 6.7) | D | 0,5 día |
| 7 | Fijar versión `5.0.0-beta.1` y ajustar las dos pruebas que fijan `5.0.0` | A | 1 h |
| 8 | `npm publish --tag next` y tag git, solo con 1 a 4 en verde (6.9) | D | 30 min |

Para promover a `latest` 5.0.0: comparar gasto con factura (3.6, D, 1 h), medición Docker Py/TS (2.2, A, 0,5 día), cuentas reales mínimas por plataforma o mantenerlas «sin probar» (1.7, D+A, 1 a 2 días), y al menos un usuario externo en Linux o macOS.
