---
id: 2026-11-27-tope-duro-comun
titulo: "Tope duro común: un libro de costos compartido con parada dura para SessionBudget, el motor clásico y los componentes futuros"
tamano: mediano  # micro | pequeño | mediano | grande
estado: aprobada  # por delegación del dueño el 2026-11-28 (bloque MVP, respuesta «Aprobar bloque MVP por delegación»); pendiente de ratificación
creada: 2026-11-27
actualizada: 2026-11-27
autor: humano  # humano | importado
constitucion_version: 1.1.0
etiquetas: [nucleo, presupuesto, gasto, principio-viii, plan-modos-fase-2b]
---

# Especificación: Tope duro común

> **Estado: borrador, sin aprobar.** Punto 2b del «Plan consolidado de modos y componentes de Forja» (2026-11-27, §3.3 M6, §4.1 principio 4, §5 fase 2 y §6). La aprobación es del dueño del proyecto; ningún agente la marca. Orden de trabajo: spec aprobada → pruebas (una en rojo antes del arreglo) → código.

## 1. Contexto y Motivación

El Principio VIII de la constitución exige que toda sesión que consuma un modelo tenga «un tope de gasto, un umbral de degradación […] y una parada dura al alcanzar el tope». Hoy solo el ciclo verificado la cumple. El acumulador de la sesión (`SessionBudget`) solo avisa, y el motor clásico (`--motor clasico`) gasta sin parada. Los componentes opcionales del plan (revisión con modelo, seguridad) heredarían el mismo hueco si cada uno trajera su propio contador.

**Comportamiento actual, verificado en el código (confirmado: el fallo existe hoy):**

- `core/session-budget.js:166`: el comentario del propio acumulador dice «Esto es una alerta, no el tope». Al superar el umbral solo emite el evento `budget:warning` (`:183-190`); no detiene nada.
- Nadie escucha `budget:warning`: la única aparición del nombre en `core/`, `cli/` y `claude-hooks/` es la emisión (`core/session-budget.js:185`). [NV] no se buscó en `tests/` ni en `skills/`.
- Quien alimenta al acumulador es el orquestador: `core/orchestrator.js:163` emite `agent:result`. El motor clásico no consulta ningún estado de presupuesto antes de llamar a un agente (`grep` de `puedeLlamar`: solo `core/ciclo/nodos.js:79` y `core/ciclo/turnos.js:215`).
- El acumulador es el único singleton `sessionBudget` (`core/session-budget.js:218-220`), en memoria: se pierde al reanudar. El del ciclo vive en el estado guardado (`core/ciclo/estado.js:123-130`, `presupuesto.{tope_usd, gastado_usd, estado, llamadas, tokens_in, tokens_out}`) y sobrevive a `resume`.
- El listener de `SessionBudget` valora siempre con la tabla de `'anthropic'` (`core/session-budget.js:171`, `:175`), sin mirar el proveedor del evento. El libro del ciclo sí usa el proveedor de cada llamada (`core/ciclo/presupuesto.js:50-65`, `costoDe`).
- El umbral por defecto del singleton sale de `leerVariableRestrictiva('BUDGET_USD', process.env, '0') ?? 1.0` (`core/session-budget.js:218-220`). [NV] qué devuelve esa función con el valor por defecto `'0'` (no se localizó su definición en `core/entorno.js` en esta revisión): si fuera 0, el aviso saltaría en todas las llamadas.
- `docs/limitations.md` ya lo declara: «Con `--motor clasico` […] las pruebas corren en tu equipo, sin aislamiento ni parada dura de gasto» (PROBLEMAS-CONOCIDOS A-5, G-7).
- Lo que el ciclo ya hace y debe reusarse, en `core/ciclo/presupuesto.js`: `estadoDe` (`:26-30`: `ok` / `degradado` / `agotado`), `puedeLlamar` (`:36-38`), `costoDe` (`:50-65`, falla cerrado con `ErrorConsumo` ante un consumo inválido), `registrar` (`:98-123`), `ampliar` (`:168-172`), `trasAbortada` (`:91-96`) y `avisoSinPrecio` (`:146-160`). El tope por defecto es 2,00 USD (`core/ciclo/config.js:20`); el proyecto solo puede bajarlo y el usuario lo fija con `FRAGUA_BUDGET_USD` (`core/ciclo/config.js:436-445`).
- Dependencia circular a vigilar: `core/ciclo/presupuesto.js:9` importa de `core/session-budget.js` (`esRecuentoValido`, `precioCompletoDe`, `tienePrecio`, `esSinCosto`). Extraer el libro implica decidir dónde viven esas funciones de precio.

## 2. Objetivo

Que exista un solo libro de costos, con parada dura al alcanzar el tope, que usen por igual el ciclo verificado, el motor clásico, `SessionBudget` y, más adelante, todo componente con modelo; de modo que ningún camino de uso de un modelo gaste por encima del tope sin que alguien lo decida.

## 3. Usuarios y Actores

| Actor | Rol | Necesidad principal |
|---|---|---|
| Persona que usa `--motor clasico` | Paga las llamadas | Que el gasto se detenga en el tope, igual que en el ciclo |
| Persona que reanuda una sesión | Reanuda con `resume` | Que lo gastado antes cuente después |
| Futuro componente con modelo (revisión IA) | Consume el libro | Un contador común, no uno propio |
| Dueño del proyecto | Fija el tope | Un solo tope, un solo sitio para fijarlo |

## 4. Historias de Usuario

### HU-001: El libro de costos es único y reutilizable
**Como** mantenedor
**Quiero** que el libro de costos del ciclo viva en un módulo común
**Para** que el ciclo, el motor clásico y los componentes usen exactamente la misma aritmética

**Criterios de aceptación:**
- [ ] **CA-001-01**: Existe un módulo común del libro (estado, costo por llamada, estado `ok|degradado|agotado`, `puedeLlamar`, ampliación) del que `core/ciclo/` y el motor clásico leen; no hay una segunda implementación de `costoDe`. (P1)
- [ ] **CA-001-02**: Una prueba de caracterización escrita antes de extraer demuestra que el ciclo da los mismos importes, estados y errores (`ErrorConsumo`) que hoy para un conjunto fijo de llamadas. (P1)
- [ ] **CA-001-03**: Un consumo inválido (NaN, negativo, decimal, ausente) falla cerrado con `ErrorConsumo` en cualquier consumidor del libro, salvo en un proveedor sin costo declarado (stub, Ollama local), como hoy. (P1)

### HU-002: El motor clásico se detiene en el tope
**Como** persona que usa `--motor clasico`
**Quiero** que no se inicie ninguna llamada a un modelo con el presupuesto agotado
**Para** no gastar sin límite mientras nadie mira

**Criterios de aceptación:**
- [ ] **CA-002-01**: Con el tope alcanzado, el orquestador clásico no inicia la siguiente llamada a un agente y termina la ejecución con un código de salida distinto de 0 (el valor lo decide el dueño: ver §11). (P1)
- [ ] **CA-002-02**: El tope del motor clásico sale de la misma fuente que el del ciclo: `FRAGUA_BUDGET_USD` del usuario, el valor del proyecto solo si es menor y 2,00 USD por defecto. Un archivo del proyecto no puede subirlo. (P1)
- [ ] **CA-002-03**: Con una respuesta ya pagada que no cuesta nada, el comportamiento actual del ciclo (`nodos.js:77-79`) se conserva; el clásico no tiene equivalente y no se le inventa. (P2)
- [ ] **CA-002-04**: La parada deja constancia en el registro de eventos y en la salida estándar, con el gasto, el tope y cómo ampliarlo. (P1)

### HU-003: `SessionBudget` deja de ser solo una alerta
**Como** persona que usa cualquier camino con modelo
**Quiero** que `SessionBudget` consulte el mismo libro y pueda detener
**Para** que «alerta» y «tope» no sean dos cosas distintas

**Criterios de aceptación:**
- [ ] **CA-003-01**: `SessionBudget` valora cada llamada con el proveedor y el modelo del evento, no siempre con la tabla de `'anthropic'` (`session-budget.js:171`, `:175`). (P1)
- [ ] **CA-003-02**: Al alcanzar el tope, `SessionBudget` impide la llamada siguiente (parada dura) y ya no se limita a emitir `budget:warning`. El aviso previo al tope se conserva. (P1)
- [ ] **CA-003-03**: Un `tokens_input` o `tokens_output` inválido en un evento no hace bajar ni corromper el acumulador (comportamiento actual de `recuento`, conservado), y no permite saltarse el tope. (P1)
- [ ] **CA-003-04**: Sin umbral configurado, el valor efectivo es el tope por defecto de 2,00 USD y no 0 ni «sin límite». (P1)

### HU-004: El gasto sobrevive a la reanudación en el clásico
**Como** persona que reanuda con `fragua resume`
**Quiero** que lo gastado antes cuente
**Para** que reanudar no reinicie el tope

**Criterios de aceptación:**
- [ ] **CA-004-01**: El gasto acumulado del clásico se guarda con el estado de la sesión y `resume` parte de él. (P1)
- [ ] **CA-004-02**: `resume --presupuesto-extra <USD>` amplía el tope del clásico con la misma función de ampliación que el ciclo. (P2)

### HU-005: Contrato para los componentes
**Como** autor de un componente opcional con modelo
**Quiero** obtener el libro común y que mi manifiesto no pueda declarar «sin tope»
**Para** cumplir `permisos.tope_usd_obligatorio` del contrato de componente

**Criterios de aceptación:**
- [ ] **CA-005-01**: La interfaz del libro común es utilizable por un consumidor que no es el ciclo ni el orquestador (prueba con un consumidor de juguete). (P2)
- [ ] **CA-005-02**: Un consumidor del libro sin tope definido falla cerrado en vez de gastar sin límite. (P1)

## 5. Escenarios de Uso

### Escenario 1: Caso feliz
**Dado** un tope de 2,00 USD y un gasto de 0,40
**Cuando** el motor clásico llama a un agente
**Entonces** la llamada se hace y se anota su costo en el libro común.

### Escenario 2: Caso de error
**Dado** un gasto de 2,00 USD con tope de 2,00
**Cuando** el orquestador clásico va a iniciar otra tarea
**Entonces** no llama al modelo, deja el evento de parada y sale con el código decidido.

### Escenario 3: Caso borde
**Dado** una sesión reanudada con 1,90 USD ya gastados
**Cuando** una llamada cuesta 0,30
**Entonces** el libro pasa a `agotado` y no se inicia ninguna más sin una ampliación explícita.

## 6. Requisitos Funcionales

- **RF-001**: El sistema DEBE tener un único libro de costos con parada dura, usado por el ciclo, el clásico y `SessionBudget`.
- **RF-002**: El sistema DEBE comprobar el libro antes de iniciar cada llamada a un modelo, no después.
- **RF-003**: El sistema DEBE valorar cada llamada por proveedor y modelo, con precio configurado primero y, si no hay precio, el más caro conocido (política vigente).
- **RF-004**: El sistema DEBE persistir el gasto con el estado de la sesión del clásico.
- **RF-005**: El sistema NO DEBE permitir que un archivo del proyecto suba el tope por encima del valor por defecto.
- **RF-006**: El sistema NO DEBE cambiar los importes, estados ni errores del ciclo verificado.

## 7. Requisitos No Funcionales

| Categoría | Requisito | Métrica |
|---|---|---|
| Seguridad | Falla cerrado ante consumo no informado | `ErrorConsumo` en todo consumidor |
| Compatibilidad | La interfaz pública del ciclo y el formato del estado no cambian sin versión MAYOR | Estado guardado con `schemaVersion` actual sigue siendo válido (`core/ciclo/estado.js:208-213`) |
| Pruebas | Obligatorias para presupuesto (`AGENTS.md`) | Cada CA con una prueba en rojo previa |

## 8. Fuera de Alcance (Exclusiones Explícitas)

- ❌ Calibrar umbrales de degradación o el valor por defecto del tope.
- ❌ Cambiar la tabla de precios (`core/precios.js`, ADR-19).
- ❌ Construir los componentes de revisión o seguridad.
- ❌ Medir el gasto real frente a la factura del proveedor (pilotos, fase 9 del plan).
- ❌ Llamadas hechas fuera del motor (por ejemplo, el modelo del propio agente anfitrión): Fragua no las ve.

## 9. Dependencias y Asunciones

### Dependencias
- Plan consolidado de modos, fase 2b. ADR-06 (libro del ciclo) y ADR-19 (precios).
- Spec `2026-11-27-stub-explicito`: define qué cuenta como costo cero (el stub).

### Asunciones
- El estado de la sesión del clásico puede guardar un campo de gasto sin romper `forge run` ni `forge resume` (no negociable de `AGENTS.md`). [NV] dónde se guarda hoy el estado del clásico: no se localizó un equivalente de `EstadoCiclo` para él.
- [NECESITA_ACLARACION]: si hay más consumidores de `agent:result` (por ejemplo `core/mcp/`) que deban alimentar el libro común. No se buscaron.

## 10. Términos del Dominio

- **Libro de costos**: registro del gasto de una sesión (`core/ciclo/presupuesto.js`).
- **Parada dura**: no iniciar la siguiente llamada al alcanzar el tope (Principio VIII).
- **Alerta**: aviso sin efecto sobre la ejecución.

## 11. Preguntas Abiertas

- [ ] [POR_DECIDIR]: código de salida de la parada del clásico (propuesta: reutilizar la semántica de «revisión humana pendiente», 3, como el ciclo con el motivo `presupuesto`, `core/engine-cli.js:238`).
- [ ] [POR_DECIDIR]: dónde viven las funciones de precio que hoy están en `session-budget.js` y que importa el libro (evitar el ciclo de importación).
- [ ] [POR_DECIDIR]: ¿`SessionBudget` se conserva como fachada del libro común o se retira? Se recomienda fachada, para no romper a quien lo importa (`tests/ciclo-presupuesto.test.js`).

## 12. Criterios de Éxito Medibles

- 0 caminos con modelo que puedan superar el tope sin una ampliación explícita (prueba por camino: ciclo, clásico, `SessionBudget`, consumidor de juguete).
- 1 sola implementación de `costoDe` en el repositorio.
- 100 % de los importes del ciclo idénticos antes y después de extraer (prueba de caracterización).

## 13. Referencias

- `reports/Plan consolidado de modos y componentes Forja.md` (§3.3 M6, §4.1 principio 4, §5 fase 2b).
- `core/session-budget.js`, `core/ciclo/presupuesto.js`, `core/ciclo/config.js`, `core/ciclo/estado.js`, `core/orchestrator.js`, `core/engine-cli.js`.
- Constitución, Principio VIII; ADR-06 y ADR-19.

## 14. Historial de Aclaraciones

| # | Categoría | Pregunta | Decisión | Fecha |
|---|-----------|----------|----------|-------|
| – | – | Sin aclaraciones todavía | – | – |
