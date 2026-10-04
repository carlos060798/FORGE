---
spec_id: 2026-10-03-ciclo-verificado
total_tareas: 38
estado: completada
generado: 2026-10-03
---

# Tareas: Ciclo Verificado

## Progreso

```
[████████████████████] 100% (38/38)
```

| Total | Pendientes | En progreso | Completadas | Bloqueadas |
|-------|------------|-------------|-------------|------------|
| 38    | 0         | 0           | 38           | 0          |

Omitidas: 0 ().

## Leyenda de estados
- ⬜ pendiente
- 🔧 en_progreso
- ✅ completada
- ❌ bloqueada
- ⏭️ omitida

> La Fase F (UI) no aplica: el panel ya lee `events.jsonl`.

---

## T001 — Spike: guardador e interrupción con LangGraph.js

**Fase:** A (Fundamentos)
**Agente:** arquitecto
**Modelo:** opus (según config)
**Archivos:** `.sdd/especificaciones/2026-10-03-ciclo-verificado/spikes/T001-langgraph.md` (CREAR)
**Depende de:** —
**Estado:** ✅ completada
**Tiempo estimado:** L

### Qué hacer
En un directorio temporal con Node ≥20, construir un grafo mínimo con un nodo que interrumpe, un guardador propio en archivos y reanudación con `Command({ resume })`. Anotar los métodos que exige el guardador, cómo serializa y si la interrupción se comporta como asume ADR-11.

### Contexto
- CA cubierto: ninguno de forma directa (tarea de soporte)
- Decisión técnica: #1 y #4 (ADR-01, ADR-04)

### Criterio de verificación
```bash
test -s .sdd/especificaciones/2026-10-03-ciclo-verificado/spikes/T001-langgraph.md
```

### Notas
Si el contrato resulta frágil, actualizar ADR-01 y ADR-04 antes de seguir: el motor propio pasa a principal.

---

## T002 — Spike: montajes y usuario en Docker Desktop para Windows

**Fase:** A (Fundamentos)
**Agente:** arquitecto
**Modelo:** opus (según config)
**Archivos:** `.sdd/especificaciones/2026-10-03-ciclo-verificado/spikes/T002-docker-windows.md` (CREAR)
**Depende de:** —
**Estado:** ✅ completada
**Tiempo estimado:** M

### Qué hacer
Lanzar un contenedor con la política de ADR-02 montando una carpeta temporal en Windows y en Linux. Comprobar escritura con `--user 1000:1000`, raíz de solo lectura, ausencia de red y tiempo de arranque. Si el montaje no es fiable, probar `docker create` + `docker cp` + `docker start -a`.

### Contexto
- CA cubierto: ninguno de forma directa (tarea de soporte)
- Decisión técnica: #2 (ADR-02)

### Criterio de verificación
```bash
test -s .sdd/especificaciones/2026-10-03-ciclo-verificado/spikes/T002-docker-windows.md
```

### Notas
Medir el tiempo de arranque: fija la métrica de rendimiento de la spec.

---

## T003 — Esquema y validación de EstadoCiclo

**Fase:** A (Fundamentos)
**Agente:** desarrollador-backend
**Modelo:** sonnet (según config)
**Archivos:** `core/ciclo/estado.js` (CREAR)
**Depende de:** —
**Estado:** ✅ completada
**Tiempo estimado:** M

### Qué hacer
Implementar `estadoInicial(tarea, opciones)`, `validarEstado(estado)` y los reductores (`ejecuciones` añade; el resto reemplaza) según la sección 7 del plan.

### Contexto
- CA cubierto: ninguno de forma directa (tarea de soporte)
- Decisión técnica: Modelo de datos (plan §7)

### Criterio de verificación
```bash
node --test tests/ciclo-fundamentos.test.js
```

### Notas
Tipos con JSDoc; sin dependencias.

---

## T004 — Secciones motor, sandbox y presupuesto en la configuración

**Fase:** A (Fundamentos)
**Agente:** desarrollador-backend
**Modelo:** sonnet (según config)
**Archivos:** `core/ciclo/config.js` (CREAR), `configuracion-ejemplo/sdd.config.yaml` (MODIFICAR)
**Depende de:** —
**Estado:** ✅ completada
**Tiempo estimado:** M

### Qué hacer
Leer `motor`, `sandbox` y `presupuesto` de `sdd.config.yaml` con valores por defecto. `motor.modo` vale `clasico` si no se indica.

### Contexto
- CA cubierto: CA-008-01
- Decisión técnica: #9 (ADR-09)

### Criterio de verificación
```bash
node --test tests/ciclo-fundamentos.test.js
```

### Notas
Reutilizar el lector de configuración de `core/llm-providers/index.js`.

---

## T005 — Tipos de evento del ciclo y estado "en revisión"

**Fase:** A (Fundamentos)
**Agente:** desarrollador-backend
**Modelo:** sonnet (según config)
**Archivos:** `core/event-log.js` (MODIFICAR)
**Depende de:** —
**Estado:** ✅ completada
**Tiempo estimado:** S

### Qué hacer
Añadir los seis tipos de evento de la sección 8 del plan y el caso `en_revision` en `replayTaskStates` cuando el último evento de una tarea es `task_paused`.

### Contexto
- CA cubierto: CA-008-03
- Decisión técnica: #11 (ADR-11)

### Criterio de verificación
```bash
node --test tests/ciclo-fundamentos.test.js
```

### Notas
No cambiar el comportamiento de los tipos existentes.

---

## T006 — Dependencias opcionales del motor de grafo

**Fase:** A (Fundamentos)
**Agente:** operaciones
**Modelo:** sonnet (según config)
**Archivos:** `package.json` (MODIFICAR)
**Depende de:** T001
**Estado:** ✅ completada
**Tiempo estimado:** S

### Qué hacer
Añadir a `optionalDependencies` las versiones que fije el spike T001. Comprobar que `npm install` en Node 18 termina sin error.

### Contexto
- CA cubierto: ninguno de forma directa (tarea de soporte)
- Decisión técnica: #1 (ADR-01)

### Criterio de verificación
```bash
node -e "const p=require('./package.json');process.exit(p.optionalDependencies?0:1)"
```

### Notas
Si T001 descarta LangGraph.js, esta tarea se omite.

---

## T007 — Flags booleanos en parseArgs

**Fase:** A (Fundamentos)
**Agente:** desarrollador-backend
**Modelo:** sonnet (según config)
**Archivos:** `core/engine-cli.js` (MODIFICAR)
**Depende de:** —
**Estado:** ✅ completada
**Tiempo estimado:** S

### Qué hacer
Hacer que `parseArgs` no desalinee los flags siguientes cuando uno no lleva valor: un flag seguido de otro flag vale `true`.

### Contexto
- CA cubierto: ninguno de forma directa (tarea de soporte)
- Decisión técnica: #9 (ADR-09)

### Criterio de verificación
```bash
node --test tests/ciclo-fundamentos.test.js
```

### Notas
Mantener compatibilidad con `--clave valor`.

---

## T008 — Tests del router

**Fase:** B (Tests primero)
**Agente:** tester
**Modelo:** sonnet (según config)
**Archivos:** `tests/ciclo-router.test.js` (CREAR)
**Depende de:** T003
**Estado:** ✅ completada
**Tiempo estimado:** M

### Qué hacer
Tabla de verdad completa de categoría × presupuesto × iteración: pase en la iteración 5, cero pruebas, pruebas alteradas, `infra_error` sin contar iteración, tiempo agotado.

### Contexto
- CA cubierto: CA-001-01, CA-001-03, CA-001-04, CA-001-05, CA-005-01, CA-005-05
- Decisión técnica: #5 (ADR-05)

### Criterio de verificación
```bash
node --test tests/ciclo-router.test.js
```

### Notas
Deben fallar hasta T018.

---

## T009 — Tests del presupuesto

**Fase:** B (Tests primero)
**Agente:** tester
**Modelo:** sonnet (según config)
**Archivos:** `tests/ciclo-presupuesto.test.js` (CREAR)
**Depende de:** T003
**Estado:** ✅ completada
**Tiempo estimado:** M

### Qué hacer
Transiciones `ok → degradado → agotado`, comprobación previa a la llamada, precios por proveedor, modelo desconocido y respuesta sin consumo.

### Contexto
- CA cubierto: CA-004-01, CA-004-02, CA-004-05
- Decisión técnica: #6 (ADR-06)

### Criterio de verificación
```bash
node --test tests/ciclo-presupuesto.test.js
```

### Notas
Deben fallar hasta T019.

---

## T010 — Tests del protocolo de archivos y del confinamiento

**Fase:** B (Tests primero)
**Agente:** tester
**Modelo:** sonnet (según config)
**Archivos:** `tests/ciclo-protocolo.test.js` (CREAR)
**Depende de:** T003
**Estado:** ✅ completada
**Tiempo estimado:** M

### Qué hacer
Traversal, rutas absolutas, prefijo engañoso, rutas vetadas, pruebas inmutables para el implementador y cambio de manifiesto de dependencias.

### Contexto
- CA cubierto: CA-002-02, CA-008-05
- Decisión técnica: #7 (ADR-07)

### Criterio de verificación
```bash
node --test tests/ciclo-protocolo.test.js
```

### Notas
Directorios temporales, sin simular el sistema de archivos.

---

## T011 — Tests del argv de la política de aislamiento

**Fase:** B (Tests primero)
**Agente:** tester
**Modelo:** sonnet (según config)
**Archivos:** `tests/sandbox-politica.test.js` (CREAR)
**Depende de:** —
**Estado:** ✅ completada
**Tiempo estimado:** S

### Qué hacer
Comprobar el argv exacto: red, usuario, capacidades, límites de CPU, memoria y procesos, solo lectura, etiquetas y nombre.

### Contexto
- CA cubierto: CA-003-01, CA-003-03, CA-003-05
- Decisión técnica: #2 (ADR-02)

### Criterio de verificación
```bash
node --test tests/sandbox-politica.test.js
```

### Notas
No requiere Docker.

---

## T012 — Tests de los puntos de guardado

**Fase:** B (Tests primero)
**Agente:** tester
**Modelo:** sonnet (según config)
**Archivos:** `tests/ciclo-datos.test.js` (CREAR)
**Depende de:** T003
**Estado:** ✅ completada
**Tiempo estimado:** M

### Qué hacer
Escritura atómica, lectura del último válido, archivo dañado y bloqueo ante dos reanudaciones simultáneas.

### Contexto
- CA cubierto: CA-006-02, CA-006-03
- Decisión técnica: #4 (ADR-04)

### Criterio de verificación
```bash
node --test tests/ciclo-datos.test.js
```

### Notas
Deben fallar hasta T014.

---

## T013 — Proveedor guionizado y tests de nodos

**Fase:** B (Tests primero)
**Agente:** tester
**Modelo:** sonnet (según config)
**Archivos:** `tests/ciclo-motor.test.js` (CREAR)
**Depende de:** T003
**Estado:** ✅ completada
**Tiempo estimado:** L

### Qué hacer
Crear un proveedor de test con respuestas y consumo programables y un ejecutor de Docker falso. Probar cada nodo: orden pruebas-antes-que-código y contrato de salida. El tope de contexto se prueba con el recuperador (T025).

### Contexto
- CA cubierto: CA-002-01
- Decisión técnica: #7 y #8 (ADR-07, ADR-08)

### Criterio de verificación
```bash
node --test tests/ciclo-motor.test.js
```

### Notas
El stub actual devuelve 0 tokens y no sirve para presupuesto.

---

## T014 — Puntos de guardado en archivos

**Fase:** C (Capa de datos)
**Agente:** desarrollador-backend
**Modelo:** sonnet (según config)
**Archivos:** `core/ciclo/checkpoint-archivos.js` (CREAR), `core/ciclo/candado.js` (CREAR), `core/ciclo/diario.js` (CREAR)
**Depende de:** T012, T001
**Estado:** ✅ completada
**Tiempo estimado:** L

### Qué hacer
Guardar tras cada nodo en `.sdd/motor/<runId>/checkpoints/` con archivo temporal y renombrado; leer el último válido; detectar archivos dañados; bloqueo por hilo.

### Contexto
- CA cubierto: CA-006-01, CA-006-02, CA-006-03
- Decisión técnica: #4 (ADR-04)

### Criterio de verificación
```bash
node --test tests/ciclo-datos.test.js
```

### Notas
Mismo patrón que `core/state-store.js:72-74`.

---

## T015 — Copia de trabajo sin secretos

**Fase:** C (Capa de datos)
**Agente:** desarrollador-backend
**Modelo:** sonnet (según config)
**Archivos:** `core/sandbox/staging.js` (CREAR), `tests/ciclo-datos.test.js` (CREAR)
**Depende de:** T002
**Estado:** ✅ completada
**Tiempo estimado:** M

### Qué hacer
Copiar el proyecto a `.sdd/motor/<runId>/staging/` excluyendo `.git`, `.sdd`, `.env*`, claves y `secrets/`. Eliminar la copia al terminar.

### Contexto
- CA cubierto: CA-003-02, CA-003-08
- Decisión técnica: #2 (ADR-02)

### Criterio de verificación
```bash
node --test tests/ciclo-datos.test.js
```

### Notas
Reutilizar la lista `protecciones.no_tocar_archivos`.

---

## T016 — Respaldo y restauración de archivos

**Fase:** C (Capa de datos)
**Agente:** desarrollador-backend
**Modelo:** sonnet (según config)
**Archivos:** `core/ciclo/respaldo.js` (CREAR), `tests/ciclo-datos.test.js` (CREAR)
**Depende de:** T003
**Estado:** ✅ completada
**Tiempo estimado:** M

### Qué hacer
Antes de la primera escritura de una tarea, respaldar los archivos que se van a tocar; `restaurar()` los devuelve a su estado previo y borra los creados.

### Contexto
- CA cubierto: CA-005-04
- Decisión técnica: #11 (ADR-11)

### Criterio de verificación
```bash
node --test tests/ciclo-datos.test.js
```

### Notas
—

---

## T017 — Tabla de precios por proveedor

**Fase:** C (Capa de datos)
**Agente:** desarrollador-backend
**Modelo:** sonnet (según config)
**Archivos:** `core/session-budget.js` (MODIFICAR)
**Depende de:** —
**Estado:** ✅ completada
**Tiempo estimado:** S

### Qué hacer
Exportar la tabla de precios indexada por proveedor y modelo, con proveedor local a 0 y precio conservador configurable para modelos desconocidos.

### Contexto
- CA cubierto: CA-004-04
- Decisión técnica: #6 (ADR-06)

### Criterio de verificación
```bash
node --test tests/ciclo-presupuesto.test.js
```

### Notas
El singleton `sessionBudget` conserva su interfaz.

---

## T018 — Router determinista

**Fase:** D (Lógica de negocio)
**Agente:** desarrollador-backend
**Modelo:** sonnet (según config)
**Archivos:** `core/ciclo/router.js` (CREAR)
**Depende de:** T008
**Estado:** ✅ completada
**Tiempo estimado:** M

### Qué hacer
Implementar `categoria`, `decidirRuta` y `guardiaPresupuesto` con el orden de ADR-05.

### Contexto
- CA cubierto: CA-001-01, CA-001-03, CA-001-04, CA-001-05, CA-005-01, CA-005-05
- Decisión técnica: #5 (ADR-05)

### Criterio de verificación
```bash
node --test tests/ciclo-router.test.js
```

### Notas
Funciones puras.

---

## T019 — Libro de costos

**Fase:** D (Lógica de negocio)
**Agente:** desarrollador-backend
**Modelo:** sonnet (según config)
**Archivos:** `core/ciclo/presupuesto.js` (CREAR), `core/ciclo/diario.js` (CREAR)
**Depende de:** T009, T017
**Estado:** ✅ completada
**Tiempo estimado:** M

### Qué hacer
Implementar el libro de costos puro y la degradación por alias. Los proveedores reales devuelven siempre el consumo; su ausencia es un error en modo ciclo.

### Contexto
- CA cubierto: CA-004-01, CA-004-02, CA-004-03, CA-004-05
- Decisión técnica: #6 (ADR-06)

### Criterio de verificación
```bash
node --test tests/ciclo-presupuesto.test.js
```

### Notas
No cambiar el modo clásico.

---

## T020 — Protocolo de archivos con escritura confinada

**Fase:** D (Lógica de negocio)
**Agente:** desarrollador-backend
**Modelo:** sonnet (según config)
**Archivos:** `core/ciclo/protocolo-archivos.js` (CREAR)
**Depende de:** T010
**Estado:** ✅ completada
**Tiempo estimado:** M

### Qué hacer
Extraer el bloque JSON de la salida, validar cada ruta y escribir. Rechazar rutas vetadas, pruebas tocadas por el implementador y cambios de manifiesto.

### Contexto
- CA cubierto: CA-002-02, CA-008-05
- Decisión técnica: #7 (ADR-07)

### Criterio de verificación
```bash
node --test tests/ciclo-protocolo.test.js
```

### Notas
Revisión de `seguridad`.

---

## T021 — Política de aislamiento y envoltorio de la CLI de Docker

**Fase:** D (Lógica de negocio)
**Agente:** desarrollador-backend
**Modelo:** sonnet (según config)
**Archivos:** `core/sandbox/politica.js` (CREAR), `core/sandbox/docker-cli.js` (CREAR), `tests/sandbox-politica.test.js` (CREAR)
**Depende de:** T011, T002
**Estado:** ✅ completada
**Tiempo estimado:** L

### Qué hacer
Generar el argv desde la política; lanzar con `spawn` y ejecutor inyectable; temporizador con `kill` y `rm -f`; tope de salida; barrido de huérfanos por etiqueta; detección de daemon caído.

### Contexto
- CA cubierto: CA-003-01, CA-003-03, CA-003-04, CA-003-05, CA-003-06, CA-003-07
- Decisión técnica: #2 (ADR-02)

### Criterio de verificación
```bash
node --test tests/sandbox-politica.test.js
```

### Notas
Revisión de `seguridad`. Sin shell.

---

## T022 — Imagen preparada por huella de manifiesto

**Fase:** D (Lógica de negocio)
**Agente:** desarrollador-backend
**Modelo:** sonnet (según config)
**Archivos:** `core/sandbox/preparar-imagen.js` (CREAR), `tests/sandbox-politica.test.js` (CREAR)
**Depende de:** T021
**Estado:** ✅ completada
**Tiempo estimado:** L

### Qué hacer
Calcular la huella de manifiesto y lockfile, construir `forge-sbx:<huella>` instalando solo desde manifiestos y reutilizarla si ya existe.

### Contexto
- CA cubierto: CA-003-09
- Decisión técnica: #3 (ADR-03)

### Criterio de verificación
```bash
node --test tests/sandbox-politica.test.js
```

### Notas
Revisión de `seguridad`. Primera entrega: JavaScript/TypeScript y Python.

---

## T023 — Runner aislado

**Fase:** D (Lógica de negocio)
**Agente:** desarrollador-backend
**Modelo:** sonnet (según config)
**Archivos:** `core/sandbox/sandbox-runner.js` (CREAR), `tests/sandbox-politica.test.js` (CREAR)
**Depende de:** T015, T021, T022
**Estado:** ✅ completada
**Tiempo estimado:** M

### Qué hacer
Implementar el contrato `Runner` sobre la copia de trabajo y el contenedor. Sin Docker, devolver `infra_error`; no existe camino al anfitrión.

### Contexto
- CA cubierto: CA-003-02, CA-003-04, CA-003-06, CA-003-07
- Decisión técnica: #2 (ADR-02)

### Criterio de verificación
```bash
node --test tests/sandbox-politica.test.js
```

### Notas
Revisión de `seguridad`.

---

## T024 — Los seis nodos y sus contratos de salida

**Fase:** D (Lógica de negocio)
**Agente:** desarrollador-backend
**Modelo:** sonnet (según config)
**Archivos:** `core/ciclo/nodos.js` (CREAR), `core/ciclo/contratos.js` (CREAR), `core/ciclo/redactar.js` (CREAR)
**Depende de:** T013, T018, T019, T020, T023, T016
**Estado:** ✅ completada
**Tiempo estimado:** L

### Qué hacer
Implementar `planner`, `retriever`, `qa`, `coder`, `sandbox` y `revision-humana`. `sandbox` verifica las huellas de las pruebas antes de ejecutar. La comprobación de "rojo inicial" se registra como aviso.

### Contexto
- CA cubierto: CA-001-02, CA-002-01, CA-002-03, CA-002-04, CA-005-02
- Decisión técnica: #7 y #11 (ADR-07, ADR-11)

### Criterio de verificación
```bash
node --test tests/ciclo-motor.test.js
```

### Notas
No editar `agents/*.md`: el contrato va por `extraContext`.

---

## T025 — Puerto Recuperador e implementación por archivos

**Fase:** D (Lógica de negocio)
**Agente:** desarrollador-backend
**Modelo:** sonnet (según config)
**Archivos:** `core/recuperacion/recuperador.js` (CREAR), `core/recuperacion/recuperador-archivos.js` (CREAR), `tests/ciclo-datos.test.js` (CREAR)
**Depende de:** T003
**Estado:** ✅ completada
**Tiempo estimado:** M

### Qué hacer
Definir el puerto y la fábrica; reunir los archivos de la tarea, los del plan y los extractos de spec y plan por criterio, con tope de bytes y marca de truncado.

### Contexto
- CA cubierto: CA-007-01, CA-007-02, CA-007-03
- Decisión técnica: #8 (ADR-08)

### Criterio de verificación
```bash
node --test tests/ciclo-datos.test.js
```

### Notas
—

---

## T026 — Grafo, motor propio y fachada

**Fase:** D (Lógica de negocio)
**Agente:** desarrollador-backend
**Modelo:** sonnet (según config)
**Archivos:** `core/ciclo/grafo.js` (CREAR), `core/ciclo/motores/propio.js` (CREAR), `core/ciclo/motores/index.js` (CREAR), `core/ciclo/index.js` (CREAR), `tests/ciclo-motor.test.js` (CREAR)
**Depende de:** T024, T025, T014
**Estado:** ✅ completada
**Tiempo estimado:** L

### Qué hacer
Declarar nodos y aristas sin framework; el motor propio ejecuta el grafo, guarda tras cada nodo, se detiene en revisión y reanuda con una decisión.

### Contexto
- CA cubierto: CA-001-02, CA-005-03, CA-006-01
- Decisión técnica: #1 (ADR-01)

### Criterio de verificación
```bash
node --test tests/ciclo-motor.test.js
```

### Notas
La suite de comportamiento debe poder correr contra cualquier motor.

---

## T027 — Motor con LangGraph.js

**Fase:** D (Lógica de negocio)
**Agente:** desarrollador-backend
**Modelo:** sonnet (según config)
**Archivos:** `core/ciclo/motores/langgraph.js` (CREAR)
**Depende de:** T026, T006
**Estado:** ✅ completada
**Tiempo estimado:** L

### Qué hacer
Ejecutar el mismo grafo con LangGraph.js cargado de forma perezosa. Si la carga falla o Node es <20, usar el motor propio y avisar.

### Contexto
- CA cubierto: CA-005-03, CA-006-01
- Decisión técnica: #1 (ADR-01)

### Criterio de verificación
```bash
node --test tests/ciclo-motor.test.js
```

### Notas
Se omite si T001 descarta LangGraph.js.

---

## T028 — Flags --motor y --decision

**Fase:** E (Interfaz / CLI)
**Agente:** desarrollador-backend
**Modelo:** sonnet (según config)
**Archivos:** `core/engine-cli.js` (MODIFICAR)
**Depende de:** T026, T007
**Estado:** ✅ completada
**Tiempo estimado:** M

### Qué hacer
Añadir `--motor`, `--force`, `--decision`, `--iteraciones-extra` y `--presupuesto-extra`. Con el ciclo activo, exigir la etapa `code`. Sin decisión y con revisión pendiente, mostrar el motivo y salir sin gastar.

### Contexto
- CA cubierto: CA-005-02, CA-005-03, CA-008-02
- Decisión técnica: #9 y #11 (ADR-09, ADR-11)

### Criterio de verificación
```bash
node --test tests/e2e/ciclo-flow.test.js
```

### Notas
—

---

## T029 — forge status ampliado

**Fase:** E (Interfaz / CLI)
**Agente:** desarrollador-backend
**Modelo:** sonnet (según config)
**Archivos:** `core/engine-cli.js` (MODIFICAR)
**Depende de:** T028
**Estado:** ✅ completada
**Tiempo estimado:** S

### Qué hacer
Mostrar iteración, gasto, estado del presupuesto y revisión pendiente leyendo el último punto de guardado.

### Contexto
- CA cubierto: CA-004-04
- Decisión técnica: #6 (ADR-06)

### Criterio de verificación
```bash
node --test tests/e2e/ciclo-flow.test.js
```

### Notas
—

---

## T030 — Ayuda del CLI

**Fase:** E (Interfaz / CLI)
**Agente:** desarrollador-backend
**Modelo:** sonnet (según config)
**Archivos:** `cli/index.js` (MODIFICAR)
**Depende de:** T028
**Estado:** ✅ completada
**Tiempo estimado:** S

### Qué hacer
Documentar los flags nuevos en la ayuda de `forge run` y `forge resume`.

### Contexto
- CA cubierto: ninguno de forma directa (tarea de soporte)
- Decisión técnica: #9 (ADR-09)

### Criterio de verificación
```bash
node cli/index.js --help | grep -q -- "--motor"
```

### Notas
—

---

## T031 — Códigos de salida

**Fase:** E (Interfaz / CLI)
**Agente:** desarrollador-backend
**Modelo:** sonnet (según config)
**Archivos:** `core/engine-cli.js` (MODIFICAR), `docs/runtime.md` (MODIFICAR)
**Depende de:** T028
**Estado:** ✅ completada
**Tiempo estimado:** S

### Qué hacer
Fijar y documentar: 0 completado, 1 fallo, 3 revisión pendiente, 4 aislamiento no disponible.

### Contexto
- CA cubierto: CA-003-07, CA-005-01
- Decisión técnica: #11 (ADR-11)

### Criterio de verificación
```bash
node --test tests/e2e/ciclo-flow.test.js
```

### Notas
—

---

## T032 — Delegación del orquestador al ciclo

**Fase:** G (Integración)
**Agente:** desarrollador-backend
**Modelo:** sonnet (según config)
**Archivos:** `core/orchestrator.js` (MODIFICAR)
**Depende de:** T026, T004, T005
**Estado:** ✅ completada
**Tiempo estimado:** M

### Qué hacer
En modo ciclo, las tareas de código pasan por `CicloVerificado.ejecutar` y se ejecutan en secuencia. En modo clásico, nada cambia.

### Contexto
- CA cubierto: CA-008-01, CA-008-02, CA-008-04
- Decisión técnica: Enfoque técnico (plan §3)

### Criterio de verificación
```bash
node --test tests/orchestrator-runner.test.js tests/e2e/ciclo-flow.test.js
```

### Notas
Conservar orden topológico, circuit breaker y eventos de tarea.

---

## T033 — Pruebas de extremo a extremo

**Fase:** G (Integración)
**Agente:** tester
**Modelo:** sonnet (según config)
**Archivos:** `tests/e2e/ciclo-flow.test.js` (CREAR)
**Depende de:** T032, T028
**Estado:** ✅ completada
**Tiempo estimado:** L

### Qué hacer
Escenarios 1 a 5 y 9 de la spec con proveedor guionizado y Docker falso, incluida la interrupción del proceso entre nodos.

### Contexto
- CA cubierto: CA-001-02, CA-005-04, CA-006-01, CA-008-03
- Decisión técnica: Estrategia de tests (plan §9)

### Criterio de verificación
```bash
node --test tests/e2e/ciclo-flow.test.js
```

### Notas
Patrón de `tests/cli-run.test.js`.

---

## T034 — Job de CI con Docker real

**Fase:** G (Integración)
**Agente:** operaciones
**Modelo:** sonnet (según config)
**Archivos:** `.github/workflows/ci.yml` (MODIFICAR), `tests/sandbox-real.test.js` (CREAR)
**Depende de:** T023
**Estado:** ✅ completada
**Tiempo estimado:** M

### Qué hacer
Suite de aislamiento con `FORGE_TEST_DOCKER=1` en `ubuntu-latest`: red bloqueada, solo lectura, usuario sin privilegios, límites y cero residuos.

### Contexto
- CA cubierto: CA-003-01, CA-003-02, CA-003-03, CA-003-04, CA-003-05, CA-003-06
- Decisión técnica: #2 (ADR-02)

### Criterio de verificación
```bash
FORGE_TEST_DOCKER=1 node --test tests/sandbox-real.test.js
```

### Notas
Se salta si Docker no está disponible.

---

## T035 — Matriz de Node con saltos condicionales

**Fase:** G (Integración)
**Agente:** operaciones
**Modelo:** sonnet (según config)
**Archivos:** `.github/workflows/ci.yml` (MODIFICAR)
**Depende de:** T027
**Estado:** ✅ completada
**Tiempo estimado:** S

### Qué hacer
Comprobar que Node 18 instala y pasa la suite con el motor propio, y que Node 20 y 22 prueban además el motor LangGraph.

### Contexto
- CA cubierto: CA-008-01
- Decisión técnica: #1 (ADR-01)

### Criterio de verificación
```bash
npm test
```

### Notas
—

---

## T036 — Verificación criterio por criterio

**Fase:** H (Verificación)
**Agente:** revisor
**Modelo:** opus (según config)
**Archivos:** `.sdd/especificaciones/2026-10-03-ciclo-verificado/verificacion.md` (CREAR)
**Depende de:** T033, T034, T035
**Estado:** ✅ completada
**Tiempo estimado:** M

### Qué hacer
Para cada uno de los 39 criterios, localizar el código y la prueba que lo cubren, sin fiarse de lo reportado por los implementadores.

### Contexto
- CA cubierto: ninguno de forma directa (tarea de soporte)
- Decisión técnica: Verificación

### Criterio de verificación
```bash
test -s .sdd/especificaciones/2026-10-03-ciclo-verificado/verificacion.md
```

### Notas
Equivale a `/sdd.verificar`.

---

## T037 — Documentación y changelog

**Fase:** H (Verificación)
**Agente:** documentador
**Modelo:** sonnet (según config)
**Archivos:** `docs/runtime.md` (MODIFICAR), `docs/limitations.md` (MODIFICAR), `docs/roadmap.md` (MODIFICAR), `CHANGELOG.md` (MODIFICAR)
**Depende de:** T036
**Estado:** ✅ completada
**Tiempo estimado:** M

### Qué hacer
Documentar el ciclo, sus requisitos (Docker, Node ≥20 para LangGraph), sus límites y los códigos de salida. Matizar la promesa de aislamiento: un contenedor reduce el riesgo, no lo elimina.

### Contexto
- CA cubierto: ninguno de forma directa (tarea de soporte)
- Decisión técnica: Principio XI

### Criterio de verificación
```bash
grep -q "motor ciclo" docs/ciclo-verificado.md
```

### Notas
—

---

## T038 — Revisión de seguridad final

**Fase:** H (Verificación)
**Agente:** seguridad
**Modelo:** opus (según config)
**Archivos:** `.sdd/especificaciones/2026-10-03-ciclo-verificado/revision-seguridad.md` (CREAR)
**Depende de:** T036
**Estado:** ✅ completada
**Tiempo estimado:** M

### Qué hacer
Revisar la fase de preparación con red, el confinamiento de escrituras, la exclusión de secretos y que no exista camino al anfitrión cuando Docker falla.

### Contexto
- CA cubierto: CA-003-08
- Decisión técnica: Riesgos R5, R9, R10

### Criterio de verificación
```bash
test -s .sdd/especificaciones/2026-10-03-ciclo-verificado/revision-seguridad.md
```

### Notas
—

---

## Matriz de Cobertura de CAs

| CA | Tareas que lo cubren |
|----|----------------------|
| CA-001-01 | T008, T018 |
| CA-001-02 | T024, T026, T033 |
| CA-001-03 | T008, T018 |
| CA-001-04 | T008, T018 |
| CA-001-05 | T008, T018 |
| CA-002-01 | T013, T024 |
| CA-002-02 | T010, T020 |
| CA-002-03 | T024 |
| CA-002-04 | T024 |
| CA-003-01 | T011, T021, T034 |
| CA-003-02 | T015, T023, T034 |
| CA-003-03 | T011, T021, T034 |
| CA-003-04 | T021, T023, T034 |
| CA-003-05 | T011, T021, T034 |
| CA-003-06 | T021, T023, T034 |
| CA-003-07 | T021, T023, T031 |
| CA-003-08 | T015, T038 |
| CA-003-09 | T022 |
| CA-004-01 | T009, T019 |
| CA-004-02 | T009, T019 |
| CA-004-03 | T019 |
| CA-004-04 | T017, T029 |
| CA-004-05 | T009, T019 |
| CA-005-01 | T008, T018, T031 |
| CA-005-02 | T024, T028 |
| CA-005-03 | T026, T027, T028 |
| CA-005-04 | T016, T033 |
| CA-005-05 | T008, T018 |
| CA-006-01 | T014, T026, T027, T033 |
| CA-006-02 | T012, T014 |
| CA-006-03 | T012, T014 |
| CA-007-01 | T025 |
| CA-007-02 | T025 |
| CA-007-03 | T025 |
| CA-008-01 | T004, T032, T035 |
| CA-008-02 | T028, T032 |
| CA-008-03 | T005, T033 |
| CA-008-04 | T032 |
| CA-008-05 | T010, T020 |

## Diagrama de Dependencias

```
T001 ──> T006
T003 ──> T008
T003 ──> T009
T003 ──> T010
T003 ──> T012
T003 ──> T013
T012, T001 ──> T014
T002 ──> T015
T003 ──> T016
T008 ──> T018
T009, T017 ──> T019
T010 ──> T020
T011, T002 ──> T021
T021 ──> T022
T015, T021, T022 ──> T023
T013, T018, T019, T020, T023, T016 ──> T024
T003 ──> T025
T024, T025, T014 ──> T026
T026, T006 ──> T027
T026, T007 ──> T028
T028 ──> T029
T028 ──> T030
T028 ──> T031
T026, T004, T005 ──> T032
T032, T028 ──> T033
T023 ──> T034
T027 ──> T035
T033, T034, T035 ──> T036
T036 ──> T037
T036 ──> T038
```

Sin dependencias (pueden empezar ya): T001, T002, T003, T004, T005, T007, T011, T017.

## Historial de Cambios

| Tarea | Anterior | Nuevo | Fecha | Notas |
|-------|----------|-------|-------|-------|
| T001 | pendiente | completada | 2026-10-03 | Spike concluyente: viable. Ajusta ADR-04 (el guardador hereda de MemorySaver) |
| T003 | pendiente | completada | 2026-10-03 | core/ciclo/estado.js |
| T004 | pendiente | completada | 2026-10-03 | core/ciclo/config.js y secciones en la configuración de ejemplo |
| T005 | pendiente | completada | 2026-10-03 | task_paused → en_revision en replayTaskStates |
| T007 | pendiente | completada | 2026-10-03 | parseArgs admite flags sin valor |
| T008 | pendiente | completada | 2026-10-03 | tests/ciclo-router.test.js, con la tabla de verdad completa |
| T009 | pendiente | completada | 2026-10-03 | tests/ciclo-presupuesto.test.js |
| T010 | pendiente | completada | 2026-10-03 | tests/ciclo-protocolo.test.js, incluido el escape por enlace simbólico |
| T017 | pendiente | completada | 2026-10-03 | precioDe y PRECIOS_POR_PROVEEDOR; los precios de OpenAI son de referencia |
| T018 | pendiente | completada | 2026-10-03 | core/ciclo/router.js |
| T019 | pendiente | completada | 2026-10-03 | core/ciclo/presupuesto.js y el libro de gasto de diario.js. No hizo falta tocar los proveedores: la falta de consumo se detecta al registrar |
| T020 | pendiente | completada | 2026-10-03 | core/ciclo/protocolo-archivos.js y core/glob.js. Pendiente la revisión de seguridad (T038) |
| T012 | pendiente | completada | 2026-10-03 | tests/ciclo-datos.test.js |
| T014 | pendiente | completada | 2026-10-03 | core/ciclo/checkpoint-archivos.js, candado.js y diario.js. Los dos motores comparten este formato; no hizo falta la subclase de MemorySaver: el motor LangGraph guarda con el mismo guardador |
| T015 | pendiente | completada | 2026-10-03 | core/sandbox/staging.js |
| T016 | pendiente | completada | 2026-10-03 | core/ciclo/respaldo.js |
| T025 | pendiente | completada | 2026-10-03 | core/recuperacion/ |
| T002 | pendiente | completada | 2026-10-03 | Spike concluyente: el montaje bind funciona en Docker Desktop para Windows; arranque de 2,9 s. Obliga a fijar --entrypoint |
| T011 | pendiente | completada | 2026-10-03 | tests/sandbox-politica.test.js |
| T021 | pendiente | completada | 2026-10-03 | core/sandbox/politica.js y docker-cli.js |
| T022 | pendiente | completada | 2026-10-03 | core/sandbox/preparar-imagen.js; probado con Docker real para Node. Python sin probar con Docker real |
| T023 | pendiente | completada | 2026-10-03 | core/sandbox/sandbox-runner.js |
| T034 | pendiente | completada | 2026-10-03 | tests/sandbox-real.test.js pasa en local con Docker real (Windows); job aislamiento añadido a ci.yml, sin ejecutar aún en Linux |
| T013 | pendiente | completada | 2026-10-03 | tests/ciclo-motor.test.js: proveedor guionizado y runner falso |
| T024 | pendiente | completada | 2026-10-03 | core/ciclo/nodos.js y contratos.js (un archivo, no una carpeta). Añade el motivo de revisión salida_invalida |
| T026 | pendiente | completada | 2026-10-03 | core/ciclo/grafo.js, motores/propio.js e index.js |
| T028 | pendiente | completada | 2026-10-03 | Flags --motor, --force, --decision y extras en core/engine-cli.js |
| T029 | pendiente | completada | 2026-10-03 | lineasEstadoCiclo en forge status (cli/runner.js y engine-cli) |
| T030 | pendiente | completada | 2026-10-03 | Ayuda de run y resume en cli/index.js |
| T031 | pendiente | completada | 2026-10-03 | Códigos 0, 1, 3 y 4; documentados en docs/ciclo-verificado.md |
| T032 | pendiente | completada | 2026-10-03 | core/orchestrator.js: _executeConCiclo, secuencial en modo ciclo, pausedTasks |
| T033 | pendiente | completada | 2026-10-03 | tests/e2e/ciclo-flow.test.js, incluido un recorrido real con Docker y proveedor stub |
| T037 | pendiente | completada | 2026-10-03 | docs/ciclo-verificado.md (nuevo) y notas en runtime, limitations, roadmap y CHANGELOG |
| T036 | pendiente | completada | 2026-10-03 | verificacion.md. La verificación independiente rechazó la primera versión (28 de 39 demostrados); hallazgos corregidos y criterios con test nuevo. Falta una nueva pasada independiente |
| T006 | pendiente | completada | 2026-10-03 | package.json: optionalDependencies @langchain/langgraph ~1.4.19. En Node 18, npm lo omite sin error |
| T027 | pendiente | completada | 2026-10-03 | core/ciclo/motores/langgraph.js e index.js (elección auto/langgraph/propio). tests/ciclo-motores.test.js: la suite del ciclo corre contra los dos motores y se reanuda entre ellos |
| T035 | pendiente | completada | 2026-10-03 | Comprobado en contenedores: suite completa en Node 18 y 20, y en Windows con Node 24. El job de CI queda por ejecutar |
| T038 | pendiente | completada | 2026-10-03 | revision-seguridad.md: revisión propia (insuficiente) y revisión independiente del agente seguridad, que la rechazó con 1 crítico, 3 altos y 6 medios; corregidos salvo dos riesgos residuales documentados. Falta una tercera pasada independiente |

