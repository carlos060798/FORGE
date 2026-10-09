# Plan maestro — Cierre de brechas del Motor Agéntico (continúa `PLAN-MOTOR-AGENTICO.md`)

> **Estado:** propuesta. Nada de este plan está implementado ni aprobado. Las cuatro especificaciones están en `borrador` y los tres ADR en `propuesta`.
> **Fecha:** 2026-10-09
> **Visión:** que el ciclo verificado esté **demostrado con un modelo real**, que un «las pruebas pasan» **signifique algo**, y que el implementador trabaje **leyendo y editando por pasos** en lugar de adivinar y reescribir archivos enteros. Como mejora incremental (Principio X), sin dependencias nuevas (Principio IV).
> **Continúa a:** `PLAN-MOTOR-AGENTICO.md` (FASES 0 a 5, implementadas y sin publicar). La numeración sigue: FASES 6 a 9, specs S6 a S9.
> **Origen:** análisis del 2026-10-09 del repositorio frente a prácticas actuales de agentes de código. Las fuentes externas son en su mayoría secundarias: lo que dependa de ellas se confirma con un spike antes de construir (Principio XI).

---

## Decisiones propuestas

| Decisión | Propuesta | Implicación |
|---|---|---|
| **Orden** | **Validar antes de construir** | Nada de S7 a S9 se da por necesario hasta ver cómo se comporta un modelo real (S6). El resultado puede cambiar prioridades. |
| **Modelos y precios** | **Configurables, con tabla incluida y fecha** (ADR-19) | El tope de gasto deja de depender de una tabla escrita a mano y sin fecha. |
| **Calidad de las pruebas** | **Rojo obligatorio y mutación propia** (ADR-20) | Unas pruebas que pasan sin implementación dejan de ser un aviso. La fortaleza de las pruebas se mide con reglas, sin modelo. |
| **Implementador** | **Por turnos con herramientas, opt-in** (ADR-21) | El contrato de archivos completos (ADR-07) queda como modo de respaldo. ADR-15 no cambia: las herramientas se llaman en proceso, sin cliente MCP. |
| **Versiones** | 5.0.0 se publica tras S6; S7 y S9 en 5.1.0; S8 opt-in en 5.2.0 y por defecto en 6.0.0 | Mismo patrón que ADR-09: primero opt-in, por defecto en la MAYOR siguiente. |

Las cinco son tuyas. Ninguna está tomada.

---

## Contexto — las brechas

Lo que ya está bien y no se toca: router determinista (ADR-05), motor propio (ADR-18), índice propio (ADR-14), puntos de guardado en archivos (ADR-04), revisión humana por CLI (ADR-11), skills en formato `SKILL.md`.

| # | Brecha | Evidencia |
|---|---|---|
| **C1** | El ciclo nunca se ejecutó con un modelo real. No se sabe con qué frecuencia un modelo devuelve el formato esperado. | `docs/ciclo-verificado.md:162`; `RELEASE-CHECKLIST.md` |
| **C2** | El job `aislamiento` de CI nunca corrió; la rama no está subida y tiene cambios sin confirmar. | `.github/workflows/ci.yml`; `git status` |
| **C3** | Las correcciones posteriores a la tercera verificación no tienen revisión independiente; 8 de 39 criterios siguen parciales. | `.sdd/especificaciones/2026-10-03-ciclo-verificado/verificacion.md` |
| **C4** | Alias de modelo y precios fijos en el código, de generaciones anteriores y sin fecha. El tope de gasto se calcula con ellos. | `core/llm-providers/anthropic-provider.js:18-22`; `core/session-budget.js:7-33` |
| **C5** | Si las pruebas recién escritas pasan sin implementación, solo queda un aviso (CA-002-04 es P3). | `core/ciclo/nodos.js` (nodo `qa`); spec del ciclo, sección 11 |
| **C6** | El ciclo no mide la fortaleza de las pruebas: unas pruebas triviales que imprimen un resumen pasan. | `docs/ciclo-verificado.md:163`; `core/ciclo/sospecha.js` |
| **C7** | Los agentes no tienen herramientas: reciben todo en un mensaje y devuelven archivos enteros en JSON. El implementador no puede leer lo que no se le mostró ni editar una parte de un archivo grande. | `core/ciclo/contratos.js:9-19`; `core/llm-providers/provider-interface.js` |
| **C8** | No se usa caché de prompts, aunque cada iteración reenvía el mismo prompt de sistema y el mismo contrato. | Ninguna aparición de `cache_control` en `core/` |
| **C9** | El servidor MCP negocia hasta la revisión `2025-06-18`. Fuentes secundarias describen una revisión `2026-07-28` con cambios incompatibles. **Sin confirmar en la especificación oficial.** | `core/mcp/protocolo.js:13` |
| **C10** | El repo no tiene `AGENTS.md`, el archivo de instrucciones que leen varios agentes de código. | Raíz del repo |
| **C11** | El aislamiento usa siempre el runtime de contenedores por defecto. No se puede elegir uno más estricto aunque esté instalado. | `core/sandbox/politica.js` (sin opción de runtime) |
| **C12** | La revisión de seguridad no sigue una lista externa de riesgos de agentes. | `.sdd/especificaciones/2026-10-03-ciclo-verificado/revision-seguridad.md` |

**Corrección al análisis previo:** `skills/mutation-detector` no hace pruebas de mutación. Registra qué archivos cambian los agentes. No hay nada en el repo que mida la fortaleza de las pruebas; S7 lo construye desde cero.

**Resultado buscado:** una 5.0.0 publicable con evidencia real, y después un ciclo cuyo éxito es más difícil de falsear y más barato de alcanzar.

---

## Arquitectura objetivo

```
planner ─▶ retriever ─▶ qa ──▶ [rojo?] ──▶ coder ─▶ sandbox ─▶ router
                         ▲        │ no        ▲                   │
                         │        ▼           └──── fail ─────────┤
                         │   revision_humana                      ├─ pass ─▶ [mutación] ─▶ fin
                         │   (pruebas_no_fallan)                  │              │
                         └──────── sobrevivientes (una ronda) ◀───┼──────────────┘
                                                                  └─ tope / gasto / infra ─▶ revision_humana

coder (S8, opt-in):  turno ─▶ herramienta ─▶ turno ─▶ … ─▶ «terminé»
                     leer · listar · buscar · editar · ejecutar pruebas
                     mismas reglas de ruta que ADR-07, mismo entorno aislado, diario por turno
```

**Principio rector:** lo nuevo entra como pasos y modos opcionales del grafo actual. El router sigue decidiendo por código de salida y estado de control (Principio VI).

---

## FASE 6 — Validación con un modelo real (S6, hito 5.0.0 publicable)

**Objetivo:** convertir «implementado» en «demostrado», y dejar el gasto bien calculado. Spec `2026-10-09-validacion-modelo-real`.

- **6.1** Confirmar los archivos pendientes de la rama y subirla. Ejecutar la matriz de CI (Node 20 y 22) y, por primera vez, el job `aislamiento`.
- **6.2** Modelos y precios configurables (ADR-19): alias y precios en `sdd.config.yaml`, tabla incluida con fecha de revisión, y aviso cuando se cobra un modelo desconocido al precio más caro.
- **6.3** `forge probar-modelo` con un proveedor de pago: la tarea mínima en JavaScript y otra en Python. Guardar el informe en `verificacion.md`.
- **6.4** Medir en esas ejecuciones: salidas que no se pudieron interpretar, iteraciones hasta pasar, gasto real frente al calculado, revisiones pedidas y su motivo.
- **6.5** Cuarta revisión independiente (agentes `revisor` y `seguridad`) de las correcciones sin revisar, con la lista de riesgos de agentes como guion (cierra C12).
- **6.6** Decidir con los datos de 6.4 si S8 sube o baja de prioridad.

**Reuso:** `core/probar-modelo.js`, `RELEASE-CHECKLIST.md`, `precioDe` de `core/session-budget.js`.

**Verificación:** CI en verde con el job `aislamiento`; informe de `probar-modelo` con resultado `exito` en los dos lenguajes; diferencia entre gasto calculado y facturado menor del 5 %.

> **No lo puede hacer un agente:** 6.1 (subir la rama) y 6.3 (clave y gasto real) son tuyos.

---

## FASE 7 — Pruebas confiables (S7, hito 5.1.0)

**Objetivo:** que un pase demuestre algo. Spec `2026-10-09-pruebas-confiables`.

- **7.1** Tests primero: clasificación de «rojo», operadores de mutación, puntuación, ruta nueva del router.
- **7.2** Rojo obligatorio: si las pruebas recién escritas pasan sin implementación, el agente de pruebas lo intenta una vez más; si vuelve a pasar, revisión humana con motivo `pruebas_no_fallan`. Una tarea puede declarar que parte de código ya existente y quedar exenta.
- **7.3** Mutación propia (ADR-20): tras un pase, se alteran los archivos que escribió el implementador (comparaciones, constantes, condiciones, valores de retorno) y se ejecutan las pruebas contra cada alteración en el entorno aislado, con un tope de alteraciones y de tiempo.
- **7.4** Tres modos, `motor.mutacion: no | informar | exigir`. Con `informar` (por defecto) la puntuación queda en el registro. Con `exigir`, bajo el umbral se pide una ronda de refuerzo al agente de pruebas y, si no basta, revisión humana con motivo `pruebas_debiles`.
- **7.5** Ampliar la lista de archivos que configuran al ejecutor de pruebas (`jest.setup.js`, `__mocks__/`, `vitest.workspace.ts`, `karma.conf.js`).

**Reuso:** `core/ciclo/sospecha.js`, `core/ciclo/router.js`, `core/sandbox/sandbox-runner.js`, `huellasAlteradas`, `acorn` (ya es dependencia).

**Verificación:** una implementación vacía con pruebas triviales ya no termina en éxito; una alteración que las pruebas no detectan aparece en el registro con archivo y línea; la mutación nunca corre fuera del entorno aislado; con `mutacion: no` el ciclo se comporta como en 5.0.0.

> **Tensión con el Principio VII:** el refuerzo de pruebas ocurre después de la implementación. Lo sigue haciendo otro rol y el implementador sigue sin poder tocarlas, pero conviene que lo ratifiques (pregunta abierta de la spec).

---

## FASE 8 — Implementador con herramientas (S8, hito 5.2.0 opt-in)

**Objetivo:** que el implementador lea, busque, edite y ejecute por pasos. Spec `2026-10-09-implementador-con-herramientas`.

- **8.1** Dos spikes: llamada con herramientas en cada proveedor (cuáles la admiten y con qué forma), y reanudación a mitad de una conversación por turnos.
- **8.2** Tests primero: confinamiento de lectura y escritura por herramienta, tope de turnos, diario por turno, vuelta al modo de bloque.
- **8.3** Ampliar el contrato de proveedor con una llamada por turnos. Los proveedores que no la admitan lo declaran y el ciclo usa el modo de bloque.
- **8.4** Cinco herramientas en proceso: leer archivo, listar, buscar texto, editar (reemplazo acotado o archivo nuevo) y ejecutar las pruebas. Comparten las reglas de ruta de ADR-07 y el entorno aislado con el servidor MCP.
- **8.5** Nodo `coder` por turnos: cada turno cuenta para el presupuesto, se guarda en el diario y tiene un tope propio. La ejecución final de pruebas la sigue haciendo el nodo `sandbox`; lo que el implementador ejecute por su cuenta no decide el éxito.
- **8.6** `motor.implementador: bloque | turnos`, con `bloque` por defecto hasta 6.0.0.

**Reuso:** `core/mcp/herramientas.js`, `validarRuta`, `aplicarArchivos`, `Respaldo`, diario de respuestas, `core/ciclo/presupuesto.js`.

**Verificación:** una tarea que exige cambiar tres líneas de un archivo de 2000 se resuelve sin reescribirlo; una herramienta no lee ni escribe nada que el modo de bloque rechazaría; cortar el proceso entre turnos y reanudar no repite turnos pagados; con un proveedor sin herramientas el ciclo avisa y sigue en modo de bloque.

> **Riesgo propio:** el texto de un archivo leído puede contener instrucciones. Las reglas de ruta y el aislamiento siguen siendo la frontera, no el modelo.

---

## FASE 9 — Puesta al día (S9, hito 5.1.0)

**Objetivo:** cerrar las brechas pequeñas. Spec `2026-10-09-puesta-al-dia`. Sus cuatro partes son independientes entre sí.

- **9.1** Caché de prompts en los proveedores que la ofrecen, con los tokens de caché contados a su precio en el presupuesto.
- **9.2** Spike: leer la especificación oficial vigente de MCP. Si confirma una revisión nueva, negociarla sin dejar de aceptar las actuales.
- **9.3** `AGENTS.md` en la raíz del repo y en lo que instala `forge init`, generado a partir de la constitución.
- **9.4** `sandbox.runtime` opcional: si se configura y no está instalado, el ciclo se niega a empezar y lo explica.

**Reuso:** `core/llm-providers/`, `core/mcp/protocolo.js`, `core/sandbox/politica.js`, `cli/index.js` (`copiarNucleo`).

**Verificación:** con caché, la segunda iteración de una tarea gasta menos tokens de entrada facturados que la primera y el libro de gasto coincide; el cliente oficial de MCP se conecta en la revisión antigua y en la nueva; un runtime inexistente termina con el código de «aislamiento no disponible».

---

## Orden y dependencias

```
FASE 6 (S6 Validación) ──┬──▶ FASE 7 (S7 Pruebas confiables) ──▶ FASE 8 (S8 Herramientas)
                         └──▶ FASE 9 (S9 Puesta al día) ─────────────┘ (9.1 antes de 8.5)
```

S7 va antes que S8: dar más libertad al implementador sin endurecer antes las pruebas agranda el hueco de C6. La caché (9.1) va antes del nodo por turnos (8.5), que multiplica las llamadas.

---

## Qué no se hace

- Volver a LangGraph.js (ADR-18) o añadir LanceDB (ADR-14).
- Más agentes, más comandos o más lenguajes en el ciclo.
- Adoptar una biblioteca de telemetría: las convenciones para IA generativa siguen sin versión estable. Se revisa cuando la tengan.
- Aislamiento con máquinas virtuales ligeras: 9.4 deja la puerta abierta sin construirlo.
- Dar herramientas al planificador o al agente de pruebas: S8 cubre solo al implementador.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| El modelo real falla el formato a menudo | Es justo lo que mide 6.4; si ocurre, S8 sube de prioridad |
| Los alias actuales apuntan a modelos que el proveedor ya no sirve | 6.2 va antes que 6.3 |
| La mutación multiplica el tiempo por tarea | Tope de alteraciones y de tiempo; modo `informar` por defecto; solo archivos de la tarea |
| Alteraciones equivalentes dan falsos «sobrevivientes» | La puntuación informa; solo `exigir` bloquea, y lleva a una persona, no a un fallo |
| Rojo obligatorio bloquea tareas de refactor legítimas | Exención declarada en la tarea |
| El modo por turnos gasta más que el de bloque | Tope de turnos, caché (9.1) y comparación de gasto en la verificación de S8 |
| Un proveedor local sin herramientas | Vuelta declarada al modo de bloque, con aviso |
| La revisión nueva de MCP no es como la describen las fuentes | 9.2 empieza por un spike sobre la especificación oficial |

---

## Verificación global (end-to-end)

1. S6: `forge probar-modelo` termina en `exito` con un proveedor de pago, en JavaScript y en Python.
2. S6: el job `aislamiento` pasa en Linux y no deja contenedores.
3. S7: una tarea con pruebas que no comprueban nada termina en revisión, no en éxito.
4. S7: `forge status` muestra la puntuación de mutación de cada tarea terminada.
5. S8: la misma tarea, en modo `turnos` y en modo `bloque`, termina en éxito; se comparan gasto e iteraciones.
6. S9: dos iteraciones seguidas muestran tokens leídos de caché en el libro de gasto.
7. Con `mutacion: no` e `implementador: bloque`, el comportamiento es el de 5.0.0.

---

## Qué te toca a ti

1. Decidir si este plan se adopta, entero o por partes.
2. Subir la rama y aportar una clave de un proveedor de pago para S6.
3. Aprobar cada spec (`forge aprobar spec`) antes de planificarla. Están en `borrador`; `estado.json` no se tocó y la spec activa sigue siendo `2026-10-03-ciclo-verificado`.
4. Responder las preguntas abiertas de cada spec (sección 11).
5. Aceptar o rechazar ADR-19, ADR-20 y ADR-21.

Después, por cada spec aprobada: `/sdd.planificar`, `/sdd.tareas`, `/sdd.analizar`, `/sdd.implementar`, `/sdd.verificar`.
