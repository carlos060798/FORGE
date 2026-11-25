---
id: 2026-11-12-proveedor-no-fijado
titulo: "Proveedor no fijado: ningún módulo del motor ni de la CLI decide con el nombre de un modelo concreto"
tamano: pequeño  # micro | pequeño | mediano | grande
estado: borrador  # borrador | en_revision | aprobada | en_implementacion | completada
creada: 2026-11-24  # el identificador conserva 2026-11-12, la fecha prevista en el plan; se redactó el 2026-11-24
actualizada: 2026-11-24
autor: humano  # humano | importado
constitucion_version: 1.1.0
etiquetas: [agnostico, proveedor, modelos, niveles, paso-3]
---

# Especificación: Proveedor no fijado

> **Estado: borrador, sin aprobar.** Paso 3 del plan de cierre de la auditoría del 2026-11-11 (`docs/informes/EVALUACION-AGNOSTICISMO.md`, hallazgo H4). La aprobación es del dueño del proyecto.

## 1. Contexto y Motivación

La constitución prohíbe fijar un proveedor de modelos en cualquier módulo (`AGENTS.md`, «NO fijar un proveedor de modelos en ningún módulo»). La auditoría encontró restos de identificadores concretos de un proveedor fuera de los lugares donde corresponden (los proveedores y la tabla de precios):

- el acumulador de gasto de la sesión valora un modelo que no conoce con el precio de un modelo concreto;
- el diagnóstico (`doctor`) valida el modelo configurado contra una lista cerrada de identificadores de un solo proveedor, de modo que un modelo válido de otro proveedor sale como «desconocido»;
- el asistente guiado de `init` ofrece solo tres modelos de un proveedor y, además, su elección no llega a escribirse: sustituye valores que la configuración de ejemplo no tiene.

Una revisión previa (paquete P del 2026-11-11) ya resolvió la clave y el modelo de respaldo en `run` y `resume`; esta especificación cierra lo que quedó y fija la regla con una prueba que la vigila.

## 2. Objetivo

Que quien use otro proveedor, o uno local, no encuentre nombres de modelos ajenos en lo que decide el motor o la CLI, y que una prueba impida que vuelvan a aparecer.

## 3. Usuarios y Actores

| Actor | Rol | Necesidad principal |
|---|---|---|
| Usuario de Anthropic | Usa Fragua como hoy | Que nada cambie: mismo proveedor por defecto, mismos precios |
| Usuario de otro proveedor o de uno local | Elige su proveedor | Que sus modelos se valoren y validen sin avisos falsos |
| Mantenedor | Añade modelos o proveedores | Que la regla se vigile sola |

## 4. Historias de Usuario

### HU-001: El gasto no depende de un modelo concreto
**Como** usuario
**Quiero** que un modelo que la tabla de precios no conoce se cuente de forma conservadora
**Para** que el aviso de gasto nunca marque menos de lo real

**Criterios de aceptación:**
- [ ] **CA-001-01**: El acumulador de la sesión no contiene el identificador de un modelo como literal; el valor de último recurso sale de la tabla de precios. (P1)
- [ ] **CA-001-02**: Un modelo desconocido se valora al precio más caro conocido, igual que el resto del motor para los modelos sin precio. (P1)
- [ ] **CA-001-03**: Un modelo conocido de cualquier proveedor se valora con su propia tabla, como hoy. (P1)

### HU-002: `doctor` valida con los niveles neutrales
**Como** usuario de cualquier proveedor
**Quiero** que `doctor` acepte los niveles `alto`, `medio` y `economico`, sus alias heredados y los modelos de la tabla de precios
**Para** no recibir un aviso por un modelo válido

**Criterios de aceptación:**
- [ ] **CA-002-01**: Un nivel neutral, un alias heredado o un identificador presente en alguna tabla de precios no genera aviso. (P1)
- [ ] **CA-002-02**: Un valor que no es ninguno de los anteriores sigue generando el aviso y cuenta como problema. (P1)
- [ ] **CA-002-03**: `doctor` no contiene una lista propia de identificadores de modelo. (P1)
- [x] **CA-002-04**: `doctor` valida cada línea `modelo:` del `sdd.config.yaml` con esa misma regla, solo en la clave exacta `modelo:` (`embeddings_modelo:`, `modelos:` y los comentarios no cuentan), admite comillas y comentarios al final y lista todos los inválidos. La configuración de ejemplo que instala `init` no produce ningún aviso. (P1) — Añadido el 2026-11-24 (informe de agnosticismo, MEDIO-3): `doctor` conservaba una segunda comprobación contra `opus|sonnet|haiku` que marcaba `nomic-embed-text`, los niveles neutrales y los modelos de OpenAI. Pruebas en `tests/doctor-agnostico.test.js`.
- [x] **CA-002-05**: El proveedor que `doctor` muestra y para el que comprueba la clave sale de la misma detección que usa el motor (el fijado y, si no, la clave de Anthropic, la de OpenAI o `OLLAMA_BASE_URL`); sin ninguna señal, Anthropic como siempre. (P1) — Añadido el 2026-11-24; pruebas en `tests/doctor-agnostico.test.js` (con Ollama en un puerto local cerrado, sin red).

### HU-003: El asistente guiado no ofrece un solo proveedor
**Como** usuario del asistente de `init --guided`
**Quiero** elegir el balance calidad/costo en niveles neutrales
**Para** que se aplique a mi proveedor, sea cual sea

**Criterios de aceptación:**
- [ ] **CA-003-01**: El asistente ofrece los niveles `alto`, `medio` y `economico`; ninguno es el nombre de un modelo. (P1)
- [ ] **CA-003-02**: La elección se escribe en `sdd.config.yaml` limitando el nivel de cada agente al elegido (`alto` no cambia nada; `medio` y `economico` bajan los que estén por encima), conservando el juego de nombres que ya usa el archivo. (P1)
- [ ] **CA-003-03**: Sin `--guided`, `init` produce exactamente lo mismo que antes. (P1)

### HU-004: Una prueba vigila la regla
**Como** mantenedor
**Quiero** que falle una prueba si un módulo fija un identificador de modelo de Claude
**Para** no volver a introducirlo sin notarlo

**Criterios de aceptación:**
- [ ] **CA-004-01**: Se escanean `core/` y `cli/`; quedan fuera `core/llm-providers/` (cada proveedor conoce los suyos) y `core/precios.js` (la tabla de precios). (P1)
- [ ] **CA-004-02**: Cualquier otra excepción figura en una lista blanca con su justificación; la prueba falla si una entrada de la lista ya no se necesita. (P1)
- [ ] **CA-004-03**: Sin proveedor configurado el proveedor por defecto sigue siendo Anthropic. (P1)
- [x] **CA-004-04**: Un nombre de proveedor que no se reconoce (un error tipográfico, o uno sin soporte como Gemini) no cae en Anthropic: `crearProvider` lanza un `ErrorProveedorDesconocido` (con `code: 'proveedor_desconocido'` y el nombre recibido) cuyo mensaje lista los válidos y dice cómo corregirlo, venga el nombre de `llm.provider`, de `FRAGUA_LLM_PROVIDER` o de quien llama. Los nombres válidos, sus alias y una URL de Ollama siguen funcionando. (P1) — Añadido el 2026-11-24 (informe de agnosticismo, MEDIO-4): antes avisaba por consola «Usando anthropic» y seguía, y Anthropic recibía el código y los prompts de quien había elegido otro proveedor (constitución: «NO degradar en silencio»). **Cambia el comportamiento.** Pruebas en `tests/proveedor-desconocido.test.js`.
- [x] **CA-004-05**: `fragua run` y `fragua resume` se detienen antes de nada, con salida 1 y ese mensaje, sin volcado de pila y antes del aviso de Docker; la decisión se toma por la clase del error, no por su texto. `fragua doctor` muestra el mismo error. Con el proveedor de pruebas, `run` no cambia. (P1) — Sin esto, en el ciclo verificado el error saldría del interior de `prepararCiclo` como una traza. Pruebas en `tests/proveedor-desconocido.test.js` («por la CLI»). **No se probó con Docker real** (esta máquina no lo tiene): la comprobación va antes de Docker.

## 5. Fuera de Alcance (Exclusiones Explícitas)

- `claude-hooks/`: son la integración con Claude Code y hablan de sus modelos a propósito; `model-registry.js` solo etiqueta el consumo.
- Los identificadores de la cabecera `model:` de los agentes (`opus`, `sonnet`, `haiku`): el motor ya los trata como alias exactos de los niveles neutrales (`core/llm-providers/niveles.js`) y Claude Code los necesita.
- Cambiar precios, añadir proveedores o modelos.

## 6. Dependencias y Asunciones

- `core/llm-providers/niveles.js` (niveles y límite de nivel) y `core/precios.js` (tablas y precio más caro).
- Asunción: sin proveedor configurado, Anthropic sigue siendo el valor por defecto (comportamiento histórico, sin cambio).

## 7. Riesgos

| Riesgo | Mitigación |
|---|---|
| Valorar un modelo desconocido al precio más caro adelanta el aviso de gasto | Es solo una alerta, no el tope; es la política ya vigente para modelos sin precio |
| El asistente empieza a aplicar una elección que antes no se aplicaba | Es el comportamiento prometido por su texto; solo ocurre con `--guided`; se anuncia en el CHANGELOG |
| La lista blanca crece sin control | La prueba falla si una entrada sobra y cada entrada exige justificación |

## 8. Preguntas Abiertas

| # | Pregunta | Recomendación |
|---|---|---|
| 1 | ¿El valor de último recurso del acumulador debe ser el precio más caro conocido o el de un nivel medio? | El más caro: coincide con el resto del motor y nunca marca menos de lo real |

## 9. Criterios de Éxito Medibles

- Cero identificadores de modelo de Claude como literal en `core/` y `cli/` fuera de las dos excepciones (prueba automática).
- `doctor` no avisa de un modelo válido de otro proveedor (prueba automática).

## 10. Referencias

- `docs/informes/EVALUACION-AGNOSTICISMO.md` (H4), `AGENTS.md` (restricciones), ADR-19 (modelos y precios configurables).
