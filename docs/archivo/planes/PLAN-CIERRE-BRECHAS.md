# Plan maestro — Cierre de brechas del Motor Agéntico (continúa `PLAN-MOTOR-AGENTICO.md`)

> **Estado (actualizado 2026-10-11):** implementado en la rama `feature/motor-agentico`, sin publicar. Las cuatro fases están hechas y revisadas de forma independiente, con tres pasadas; **falta la integración continua en Linux, la comparación del gasto con lo facturado y tus decisiones** (ver «Estado de ejecución» y «Pendiente para las próximas sesiones»). Las cuatro especificaciones están en `en_implementacion` y los tres ADR en `aceptada`, **por delegación del dueño, pendientes de su ratificación**.
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

**Estado (2026-10-11):** las cinco se implementaron tomando la propuesta, por delegación del dueño el 2026-10-09, y siguen pendientes de su ratificación. La de versiones no se ha ejecutado: 5.0.0 no está publicada y falta decidir si se separa o sale como beta.

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

## Estado de ejecución (actualizado 2026-10-11)

Leyenda: ✅ hecho y comprobado · ⚠️ hecho con límites o sin comprobar del todo · ⏳ pendiente.

**Rama `feature/motor-agentico`, subida y sin publicar.** Pruebas unitarias: 2202 pasan, 0 fallan, 12 saltadas (2214). Comprobación de tipos: 0 errores. Ejecuciones con un modelo real: 24, de unos 2,4 USD calculados (sin comparar con lo facturado). Revisiones independientes: tres fases revisadas, una segunda pasada sobre las correcciones y una tercera sobre las de la segunda; la cuarta pasada no existe.

| Brecha | Estado | Qué quedó |
|---|---|---|
| **C1** modelo real | ✅ | 24 ejecuciones (JavaScript, Python, Go; código existente; corte y reanudación; pausa por presupuesto) y 14 hallazgos, ver `evidencia-2026-10-09.md` |
| **C2** CI | ⏳ | Rama subida; la matriz y el job `aislamiento` no han corrido. Desde el 2026-10-12 `ci.yml` añade `tipos` y `pruebas-docker` (todas las pruebas que mencionan `FORGE_TEST_DOCKER`), sin ejecutar |
| **C3** correcciones sin revisar | ⚠️ | Tres revisiones y dos pasadas hechas, con sus hallazgos altos corregidos. Lo corregido en la tercera pasada no tiene cuarta |
| **C4** modelos y precios | ✅ | ADR-19 implementada y contrastada con la tarifa publicada; falta compararla con lo facturado |
| **C5** rojo | ✅ | Obligatorio con reintento y exención; no se aplica si ya hay implementación |
| **C6** fortaleza de las pruebas | ⚠️ | Mutación propia, con salidas reales capturadas de node:test, pytest, unittest, jest, vitest y Go (58 capturas), limitada a las líneas que la tarea cambió y con el barrido de copias de procesos muertos. **Abierto: N-02**, funciones trampa que el código llama inflan la puntuación porque no se filtra por cobertura |
| **C7** herramientas | ✅ | Modo por turnos; probado con un modelo real en una tarea, tres veces |
| **C8** caché | ⚠️ | Medida en el modo por turnos (55 %). En modo de bloque casi no ahorra y con el nivel económico no se guarda nada (H14) |
| **C9** MCP | ⚠️ | Revisión `2026-07-28` confirmada e implementada; sin cliente oficial |
| **C10** `AGENTS.md` | ✅ | En la raíz y en `forge init` |
| **C11** runtime | ⚠️ | Solo `runc` probado; otro runtime exige `FORGE_RUNTIMES_PERMITIDOS` |
| **C12** lista de riesgos | ✅ | Tabla ASI01 a ASI10 en cada revisión (nombres tomados de un resumen de terceros) |
| **C13** llamada cancelada por tiempo | ⚠️ | Nueva. Se cobraba sin contabilizarse. Ahora se anota una estimación de la entrada; la salida no se puede estimar |
| **C14** robustez | ⚠️ | Nueva. Cortes reales del proceso, concurrencia, proyectos hostiles y pruebas frágiles estabilizadas, con pruebas automáticas. Sin ejecución larga ni segunda plataforma |

Documentos: `evidencia-2026-10-09.md` y `revision-independiente.md`, `-2` y `-3` en `.sdd/especificaciones/2026-10-09-validacion-modelo-real/`; `revision-independiente.md` y `verificacion.md` en la carpeta de cada una de las otras tres specs; `docs/PROBLEMAS-CONOCIDOS.md`, `docs/MIGRACION-5.0.md` y `docs/COBERTURA.md`.

> **El plan de trabajo por olas, con quién hace cada cosa, está en `PLAN-EJECUCION-FINAL.md`** (2026-10-12). Esta lista queda como inventario.

## Pendiente para las próximas sesiones

Marcas `[ ]` por hacer · `[x]` hecho. Cada línea dice quién puede hacerla.

**Verificación (puede hacerla un agente)**
- [ ] Resultado de la suite completa con `FORGE_TEST_DOCKER=1` sobre `27ea407`: estaba corriendo al cerrar. Si falla solo por carga de la máquina, repetir aislado.
- [ ] **N-02:** descartar de la muestra de mutación los archivos y líneas que ninguna prueba ejecuta (cobertura del ejecutor, solo si se ofrece sin dependencias), limitar los archivos por medición y documentar que `mutacion: exigir` no es una garantía frente a un implementador adversario.
- [ ] Cuarta revisión independiente de lo corregido en la tercera pasada: intención del diario (N-01), redacción solo por formato (N-03), escritura global de `init` y `update` (N-04, N-05, N-07, N-08), barrido por pid y la mutación con salidas reales.
- [ ] Medición por mutación con Docker real en Python y TypeScript: `tests/mutacion-docker-lenguajes.test.js` está escrito, sin resultado confirmado. Actualizar `verificacion.md` de pruebas confiables con las cifras.
- [ ] Refuerzo de pruebas con un modelo real: en las dos ejecuciones con `exigir`, las pruebas detectaron todo y no hubo refuerzo.
- [ ] Caché: una tarea de tres iteraciones en modo de bloque, con y sin caché, para el criterio de la spec de puesta al día (probablemente no se cumple).
- [ ] Permisos 0700 de las copias temporales y enlaces simbólicos de archivo en Linux.
- [x] Un job de integración continua para las demás pruebas con Docker, y otro de tipos. *(2026-10-12: jobs `pruebas-docker` y `tipos` en `ci.yml`; no pueden ejecutarse fuera de GitHub Actions y no han corrido.)*
- [ ] `forge doctor` debe comprobar Docker siempre, no solo con `sandbox.runtime`.
- [ ] La configuración ignora en silencio una clave mal sangrada: avisar.
- [x] Test de consistencia que compare las cifras escritas en prosa (agentes, comandos, skills) con el disco. *(2026-10-12: `tests/consistencia-cifras.test.js`; corrigió `docs-site/assets/data.js`, que decía 6 agentes de solo lectura y 8 que escriben.)*
- [x] Corregir las contradicciones entre documentos listadas en `docs/PROBLEMAS-CONOCIDOS.md`, sección 8 (índices con enlaces que no existen, nombres de paquete antiguos). *(2026-10-12, salvo la razón del Principio IV de la constitución, que dice «dos dependencias» y son tres: es decisión del dueño.)*

**Necesita algo tuyo**
- [ ] Abrir la solicitud de cambio `feature/motor-agentico` hacia `main` para que corra la integración continua.
- [ ] Comparar el gasto calculado con lo facturado (saldo de la consola del proveedor, antes y después).
- [ ] Ratificar las cuatro especificaciones y los ADR-19, ADR-20 y ADR-21, aprobados por delegación el 2026-10-09; y la decisión de crear `AGENTS.md` una sola vez.
- [ ] Ratificar la tensión con el Principio VII (refuerzo de pruebas posterior a la implementación).
- [ ] Decidir si `mutacion` pasa a `exigir` por defecto en la próxima versión MAYOR.
- [ ] Decidir cómo se publica: 5.0.0 entera, o separada (fases 6 y 9 en 5.0.0; 7 y 8 en 5.1.0), o `5.0.0-beta.1` con la etiqueta `beta` de npm. Cambiar la versión exige tocar dos pruebas que fijan `5.0.0`.
- [ ] Definir `GITHUB_PERSONAL_ACCESS_TOKEN` y reiniciar la sesión para conectar el servidor MCP de GitHub (ya está en `.mcp.json`, sin confirmar); indicar la instancia de GitLab si se quiere conectar.
- [ ] Rotar la clave de API usada en las ejecuciones reales.
- [ ] Revisar y decidir sobre `2026-10-11-integraciones-externas` y ADR-22: REST directo o cliente MCP, enmienda del Principio III, Jira Cloud con token de servicio u OAuth, y quién aprueba las publicaciones.
- [ ] Publicar (`npm publish`, etiqueta de git): solo con la integración continua en verde.

**Abierto, sin asignar**
- [~] H13: sigue sin saberse POR QUÉ algunas llamadas no responden en 120 s si el proveedor responde en un segundo (causa abierta). Mitigado: tiempo por intento con señal propia, un reintento tras tiempo agotado, cada intento cancelado se cobra como estimación y `llm.timeout_s` configurable.
- [ ] H10: con el nivel económico, el agente de pruebas a veces escribe valores esperados erróneos y el ciclo no puede distinguirlos de una implementación que falla.
- [x] Estimación del gasto (N-11): el texto no ASCII ya se cuenta por bytes UTF-8 (mitad de bytes). El ASCII se queda a 3 caracteres por token a propósito (por lo alto). La salida de una llamada cancelada sigue sin estimarse (se desconoce), solo la de una respuesta sin consumo válido.
- [x] Consumo inválido (N-06): se anota una estimación (`estimado`, `ciclo:consumo_estimado`); el tope muerde y los `continuar` no pagan sin fin.
- [~] H-10 (fase 8, pagar dos veces tras un corte con la petición en vuelo): inherente, no se evita; ahora la intención se anota antes de llamar y al reanudar se cuenta una estimación (`ciclo:llamada_huerfana`).
- [x] `initialize` con una versión desconocida responde con la más reciente soportada (N-10, spec 2025-11-25 lifecycle); `pytest `, `#egg=pytest` y `-r base.txt` se reconocen y la comprobación previa avisa de que la imagen no resuelve `-r` (N4). 2026-10-12.
- [x] Tres tiempos de espera seguidos con la misma huella cuentan para «sin progreso». 2026-10-12.
- [ ] El modo por turnos no usa el recuperador de contexto, solo el mapa de archivos.
- [x] Precios de OpenAI contrastados el 2026-10-12 (https://developers.openai.com/api/docs/pricing). [ ] Pendiente: el tramo caro de Claude Haiku 5.5 (más de 100 000 tokens de entrada) no se contempla.
- [ ] Proyectos grandes y una ejecución larga sin intervención: no se han probado.
- [ ] Que el ciclo use servidores MCP de GitHub o GitLab (cliente MCP): exige una especificación nueva y revisión de seguridad (ADR-12 y ADR-15 hoy lo excluyen).

**Cerrado en esta tanda**
- [x] 2026-10-12: sangría incorrecta de claves conocidas del config lanza error con línea; `forge doctor` comprueba Docker siempre; tope de 256 KiB en manifiestos y nombres no ASCII de dependencias; señal de cancelación pasada a las herramientas MCP (H-09, límite documentado en M-3).
- [x] Comprobación de tipos: de 36 errores a 0.
- [x] Tercera revisión independiente (N-01 a N-14): N-01, N-03, N-04, N-05, N-07, N-08, N-09, N-12, N-13 y N-14 corregidos; N-02 abierto arriba.
- [x] Cuarta revisión independiente, parte 1 (N4-03, N4-04, N4-05, N4-07, N4-08, N4-09): redacción por valor, cuerpo de clave privada oculto por tramo y en `buscar`, BOM conservado, temporales huérfanos barridos, `import`/`export`/`runner` por escritura segura con prueba estática, marcador `[REDACTADO` permitido si el archivo ya lo tiene. N4-03 queda mitigado, no cerrado (contraseñas cortas o de una clase); N4-01, N4-02, N4-06 y N4-10 en otra tarea.
- [x] `forge config set` y `forge aprobar` escriben por el módulo de escritura segura.
- [x] Mutación limitada a las líneas que la tarea cambió (H11).
- [x] Pruebas frágiles estabilizadas (`docker info`, rendimiento, doctor).

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

- **6.1** Confirmar los archivos pendientes de la rama y subirla. Ejecutar la matriz de CI (Node 20 y 22) y, por primera vez, el job `aislamiento`. ⚠️ **Parcial:** rama subida y confirmada. La matriz de CI y el job `aislamiento` **no han corrido**: hace falta abrir la solicitud de cambio.
- **6.2** Modelos y precios configurables (ADR-19): alias y precios en `sdd.config.yaml`, tabla incluida con fecha de revisión, y aviso cuando se cobra un modelo desconocido al precio más caro. ✅ **Hecho.** `core/precios.js` con tabla fechada contrastada con la tarifa publicada; `modelos:` y `precios:` en la configuración (ADR-19).
- **6.3** `forge probar-modelo` con un proveedor de pago: la tarea mínima en JavaScript y otra en Python. Guardar el informe en `verificacion.md`. ✅ **Hecho.** 21 ejecuciones reales (JavaScript, Python, Go; código existente; corte y reanudación; pausa por presupuesto). Ver `.sdd/especificaciones/2026-10-09-validacion-modelo-real/evidencia-2026-10-09.md`.
- **6.4** Medir en esas ejecuciones: salidas que no se pudieron interpretar, iteraciones hasta pasar, gasto real frente al calculado, revisiones pedidas y su motivo. ⚠️ **Parcial:** medido todo salvo el **gasto calculado frente al facturado** (necesita el saldo real del proveedor).
- **6.5** Cuarta revisión independiente (agentes `revisor` y `seguridad`) de las correcciones sin revisar, con la lista de riesgos de agentes como guion (cierra C12). ⚠️ **Parcial:** cuatro revisiones independientes y una segunda pasada hechas, con tabla de riesgos de agentes (ASI01 a ASI10). Las correcciones de la última tanda **no tienen tercera revisión**.
- **6.6** Decidir con los datos de 6.4 si S8 sube o baja de prioridad. ✅ **Hecho.** S8 subió de prioridad: el modo de bloque no puede cambiar una función en un archivo de 1812 líneas y el modo por turnos sí.

**Reuso:** `core/probar-modelo.js`, `RELEASE-CHECKLIST.md`, `precioDe` de `core/session-budget.js`.

**Verificación:** CI en verde con el job `aislamiento`; informe de `probar-modelo` con resultado `exito` en los dos lenguajes; diferencia entre gasto calculado y facturado menor del 5 %.

> **No lo puede hacer un agente:** 6.1 (subir la rama) y 6.3 (clave y gasto real) son tuyos.

---

## FASE 7 — Pruebas confiables (S7, hito 5.1.0)

**Objetivo:** que un pase demuestre algo. Spec `2026-10-09-pruebas-confiables`.

- **7.1** Tests primero: clasificación de «rojo», operadores de mutación, puntuación, ruta nueva del router. ✅ **Hecho.**
- **7.2** Rojo obligatorio: si las pruebas recién escritas pasan sin implementación, el agente de pruebas lo intenta una vez más; si vuelve a pasar, revisión humana con motivo `pruebas_no_fallan`. Una tarea puede declarar que parte de código ya existente y quedar exenta. ✅ **Hecho.** Con exención `parte_de_codigo_existente` y sin aplicar si ya hay implementación.
- **7.3** Mutación propia (ADR-20): tras un pase, se alteran los archivos que escribió el implementador (comparaciones, constantes, condiciones, valores de retorno) y se ejecutan las pruebas contra cada alteración en el entorno aislado, con un tope de alteraciones y de tiempo. ⚠️ **Hecho; medido con Docker real en Go y JavaScript, con salidas reales capturadas de pytest, unittest, jest y vitest** (58 capturas en `tests/fixtures/salidas-ejecutores/`) y limitado a las líneas que la tarea cambió. La medición completa con Docker en Python y TypeScript tiene su prueba escrita y sin resultado confirmado; sigue abierto N-02 (funciones trampa).
- **7.4** Tres modos, `motor.mutacion: no | informar | exigir`. Con `informar` (por defecto) la puntuación queda en el registro. Con `exigir`, bajo el umbral se pide una ronda de refuerzo al agente de pruebas y, si no basta, revisión humana con motivo `pruebas_debiles`. ✅ **Hecho.** Añadido `motor.mutacion_min_concluyentes` (3): `exigir` no pasa con una medición vacía.
- **7.5** Ampliar la lista de archivos que configuran al ejecutor de pruebas (`jest.setup.js`, `__mocks__/`, `vitest.workspace.ts`, `karma.conf.js`). ✅ **Hecho.**

**Reuso:** `core/ciclo/sospecha.js`, `core/ciclo/router.js`, `core/sandbox/sandbox-runner.js`, `huellasAlteradas`, `acorn` (ya es dependencia).

**Verificación:** una implementación vacía con pruebas triviales ya no termina en éxito; una alteración que las pruebas no detectan aparece en el registro con archivo y línea; la mutación nunca corre fuera del entorno aislado; con `mutacion: no` el ciclo se comporta como en 5.0.0.

> **Tensión con el Principio VII:** el refuerzo de pruebas ocurre después de la implementación. Lo sigue haciendo otro rol y el implementador sigue sin poder tocarlas, pero conviene que lo ratifiques (pregunta abierta de la spec).

---

## FASE 8 — Implementador con herramientas (S8, hito 5.2.0 opt-in)

**Objetivo:** que el implementador lea, busque, edite y ejecute por pasos. Spec `2026-10-09-implementador-con-herramientas`.

- **8.1** Dos spikes: llamada con herramientas en cada proveedor (cuáles la admiten y con qué forma), y reanudación a mitad de una conversación por turnos. ✅ **Hecho.** `.sdd/especificaciones/2026-10-09-implementador-con-herramientas/spikes/herramientas-por-proveedor.md`.
- **8.2** Tests primero: confinamiento de lectura y escritura por herramienta, tope de turnos, diario por turno, vuelta al modo de bloque. ✅ **Hecho.**
- **8.3** Ampliar el contrato de proveedor con una llamada por turnos. Los proveedores que no la admitan lo declaran y el ciclo usa el modo de bloque. ⚠️ **Hecho para Anthropic y el proveedor de pruebas.** OpenAI y Ollama declaran que no admiten herramientas y el ciclo usa el modo de bloque.
- **8.4** Cinco herramientas en proceso: leer archivo, listar, buscar texto, editar (reemplazo acotado o archivo nuevo) y ejecutar las pruebas. Comparten las reglas de ruta de ADR-07 y el entorno aislado con el servidor MCP. ✅ **Hecho.**
- **8.5** Nodo `coder` por turnos: cada turno cuenta para el presupuesto, se guarda en el diario y tiene un tope propio. La ejecución final de pruebas la sigue haciendo el nodo `sandbox`; lo que el implementador ejecute por su cuenta no decide el éxito. ✅ **Hecho.** Con caché de prompts: la misma tarea costó 0,09 USD frente a 0,21 sin ella.
- **8.6** `motor.implementador: bloque | turnos`, con `bloque` por defecto hasta 6.0.0. ✅ **Hecho.** `bloque` sigue por defecto.

**Reuso:** `core/mcp/herramientas.js`, `validarRuta`, `aplicarArchivos`, `Respaldo`, diario de respuestas, `core/ciclo/presupuesto.js`.

**Verificación:** una tarea que exige cambiar tres líneas de un archivo de 2000 se resuelve sin reescribirlo; una herramienta no lee ni escribe nada que el modo de bloque rechazaría; cortar el proceso entre turnos y reanudar no repite turnos pagados; con un proveedor sin herramientas el ciclo avisa y sigue en modo de bloque.

> **Riesgo propio:** el texto de un archivo leído puede contener instrucciones. Las reglas de ruta y el aislamiento siguen siendo la frontera, no el modelo.

---

## FASE 9 — Puesta al día (S9, hito 5.1.0)

**Objetivo:** cerrar las brechas pequeñas. Spec `2026-10-09-puesta-al-dia`. Sus cuatro partes son independientes entre sí.

- **9.1** Caché de prompts en los proveedores que la ofrecen, con los tokens de caché contados a su precio en el presupuesto. ⚠️ **Hecho; ahorro medido solo en el modo por turnos (55 %).** El criterio de la spec (30 % menos de entrada en tres iteraciones del modo de bloque) sigue sin medir.
- **9.2** Spike: leer la especificación oficial vigente de MCP. Si confirma una revisión nueva, negociarla sin dejar de aceptar las actuales. ⚠️ **Hecho:** la revisión vigente es `2026-07-28` (confirmada en la fuente oficial) y se negocia sin dejar de aceptar las anteriores. **Sin probar con el cliente oficial.**
- **9.3** `AGENTS.md` en la raíz del repo y en lo que instala `forge init`, generado a partir de la constitución. ✅ **Hecho.**
- **9.4** `sandbox.runtime` opcional: si se configura y no está instalado, el ciclo se niega a empezar y lo explica. ⚠️ **Hecho; probado solo con `runc` y con un nombre inexistente.** Un runtime distinto de `runc` exige `FORGE_RUNTIMES_PERMITIDOS`.

**Estado (2026-10-09):** implementadas las cuatro partes; detalle y límites en `.sdd/especificaciones/2026-10-09-puesta-al-dia/verificacion.md`. Sin medir: el ahorro real de la caché (hace falta un modelo de pago). Sin probar: la revisión nueva de MCP con el cliente oficial, y un mecanismo de aislamiento distinto del de por defecto.

**Reuso:** `core/llm-providers/`, `core/mcp/protocolo.js`, `core/sandbox/politica.js`, `cli/index.js` (`copiarNucleo`).

**Verificación:** con caché, la segunda iteración de una tarea gasta menos tokens de entrada facturados que la primera y el libro de gasto coincide; el cliente oficial de MCP se conecta en la revisión antigua y en la nueva; un runtime inexistente termina con el código de «aislamiento no disponible».

---

## FASE 10 — Integraciones con GitHub, GitLab y Jira (S10, propuesta, sin aprobar)

**Objetivo:** que una tarea nazca de una incidencia o ticket y su resultado vuelva como comentario o solicitud de cambio en borrador, sin dar al modelo ninguna herramienta de red ni credencial. Spec `2026-10-11-integraciones-externas` (borrador) y ADR-22 (propuesta).

- **10.0** Tres spikes antes de construir: permisos mínimos reales por proveedor con su documentación oficial; batería de al menos 30 textos hostiles; decisión REST directo frente a cliente MCP.
- **10.1** Puerto con tres operaciones fijas por proveedor (leer elemento, comentar, proponer cambio) y adaptadores REST sin dependencias nuevas.
- **10.2** Configuración `integraciones:` con modo por proveedor (`apagado` por defecto), lista cerrada de destinos y tokens solo en variables de entorno; comprobaciones en `forge doctor`.
- **10.3** Texto de la plataforma como dato no confiable: delimitado, acotado, redactado y sin autoridad sobre reglas, topes ni herramientas.
- **10.4** Publicación con vista previa y aprobación registrada, idempotente, solo ramas nuevas con prefijo fijo y solicitudes en borrador.
- **10.5** Auditoría, topes por sesión y apagado inmediato.
- **10.6** Revisión independiente (`revisor` y `seguridad`) con la lista de riesgos agénticos como guion, antes de publicar.

**Verificación:** con la sección ausente o apagada, 0 conexiones nuevas y suite sin cambios; la batería hostil no cambia ninguna decisión del ciclo; ningún token aparece en prompts, registros, estado ni errores.

> **No lo puede hacer un agente:** aprobar la spec y el ADR (Principio II), aportar cuentas de servicio y tokens de prueba en cada plataforma, y decidir REST frente a MCP.

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

1. S6: `forge probar-modelo` termina en `exito` con un proveedor de pago, en JavaScript y en Python. ✅ (JavaScript y Python, niveles por defecto).
2. S6: el job `aislamiento` pasa en Linux y no deja contenedores. ⏳ **Pendiente: nunca ha corrido.**
3. S7: una tarea con pruebas que no comprueban nada termina en revisión, no en éxito. ⚠️ Cubierto por pruebas automáticas; sin tarea real con un modelo.
4. S7: `forge status` muestra la puntuación de mutación de cada tarea terminada. ✅
5. S8: la misma tarea, en modo `turnos` y en modo `bloque`, termina en éxito; se comparan gasto e iteraciones. ⚠️ Una sola tarea: el modo de bloque no pudo y el de turnos sí; no es una comparación de gasto limpia.
6. S9: dos iteraciones seguidas muestran tokens leídos de caché en el libro de gasto. ✅ Visto en el libro de gasto con la API real.
7. Con `mutacion: no` e `implementador: bloque`, el comportamiento es el de 5.0.0. ✅ Cubierto por la suite.

---

## Qué te tocaba a ti (lista original; el estado actual está en «Pendiente para las próximas sesiones»)

1. Decidir si este plan se adopta, entero o por partes.
2. Subir la rama y aportar una clave de un proveedor de pago para S6.
3. Aprobar cada spec (`forge aprobar spec`) antes de planificarla. Están en `borrador`; `estado.json` no se tocó y la spec activa sigue siendo `2026-10-03-ciclo-verificado`.
4. Responder las preguntas abiertas de cada spec (sección 11).
5. Aceptar o rechazar ADR-19, ADR-20 y ADR-21.

Después, por cada spec aprobada: `/sdd.planificar`, `/sdd.tareas`, `/sdd.analizar`, `/sdd.implementar`, `/sdd.verificar`.
