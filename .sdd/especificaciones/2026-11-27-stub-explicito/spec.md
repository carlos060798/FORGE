---
id: 2026-11-27-stub-explicito
titulo: "Stub explícito: sin clave de modelo es un error; el proveedor de pruebas solo con opción explícita y su evidencia es inconfundible"
tamano: mediano  # micro | pequeño | mediano | grande
estado: borrador  # borrador | en_revision | aprobada | en_implementacion | completada
creada: 2026-11-27
actualizada: 2026-11-27
autor: humano  # humano | importado
constitucion_version: 1.1.0
etiquetas: [nucleo, proveedores, stub, evidencia, falla-cerrado, plan-modos-fase-2e]
---

# Especificación: Stub explícito

> **Estado: borrador, sin aprobar.** Punto 2e del «Plan consolidado de modos y componentes de Forja» (2026-11-27, §3.8, §5 fase 2 y §6). La aprobación es del dueño del proyecto; ningún agente la marca. Orden de trabajo: spec aprobada → pruebas (una en rojo antes del arreglo) → código.

## 1. Contexto y Motivación

Si falta la clave del proveedor, el motor hoy avisa y sigue «en modo stub»: las respuestas son texto de relleno, el gasto es cero y la ejecución puede terminar con un veredicto que parece normal. Una persona que olvidó definir la clave obtiene un informe que no distingue sus pruebas reales de un recorrido sin modelo. Eso contradice «NO degradar en silencio» (`AGENTS.md`) y deja en la evidencia una afirmación que el código no sostiene (Principio XI). El stub es legítimo para las pruebas y la CI, pero debe elegirse, no caerse en él.

**Comportamiento actual, verificado en el código (confirmado: el fallo existe hoy):**

- `core/engine-cli.js:97-108` (`resolverClave`): sin `ANTHROPIC_API_KEY` (o la variable del proveedor elegido) devuelve un aviso «no está definida — el engine correrá en modo stub». `cmdRun` solo lo muestra con `warn` y continúa (`core/engine-cli.js:416-418`); `cmdResume` ni siquiera lo muestra (`:300` descarta `aviso`).
- `core/llm-providers/anthropic-provider.js:192-194`: en `complete`, sin SDK o sin clave devuelve `{ output: '[stub-anthropic] sin SDK o API key. Prompt: …' }` en vez de fallar. En cambio `conversar` sí lanza error (`:153`). Es decir, el mismo proveedor falla cerrado en una vía y cae a texto de relleno en la otra.
- `core/llm-providers/index.js:195-199`: sin ninguna señal de proveedor, el valor por defecto es `anthropic`; sin clave, entonces, se llega al camino de relleno anterior.
- El proveedor `stub` se elige por nombre (`core/llm-providers/index.js:285-287`, alias `test`) con `FRAGUA_LLM_PROVIDER`/`FORGE_LLM_PROVIDER` o `llm.provider` en `.sdd/sdd.config.yaml`. No existe ninguna opción de la línea de órdenes de `run` para elegirlo [NV: se buscó `--proveedor` en `cli/` y `core/`; solo aparece en `cli/integraciones.js`, que es otra cosa]. Las pruebas del repositorio lo eligen por entorno (`tests/api-http.test.js:353`, `:475`).
- `llm.provider` lo puede fijar el archivo del proyecto (`core/llm-providers/index.js:249-253`): un repositorio ajeno podría elegir `stub` sin que la persona lo pida. [NV] si hoy hay algún aviso en ese caso.
- El stub cuenta costo cero por declaración (`core/session-budget.js:29`, `:63-65`; `core/ciclo/presupuesto.js:51`, `:99`).
- La evidencia registra un campo `proveedor` por modelo usado (`core/evidencia/cadena.js:195`), pero lo aporta quien llama y no marca nada especial para `stub` ni para el texto de relleno; `verificar` no llama a ningún modelo (`cadena.js:485`). [NV] si el ciclo verificado pasa `modelos` con el proveedor real a la evidencia: no se leyó el cableado.

## 2. Objetivo

Que ejecutar con un modelo exija una clave válida (o un proveedor local declarado) y falle con error si no la hay; que el proveedor de pruebas solo se use cuando la persona lo pide de forma explícita; y que cualquier evidencia o informe producido con él lo diga de forma que no se pueda confundir con una ejecución real.

## 3. Usuarios y Actores

| Actor | Rol | Necesidad principal |
|---|---|---|
| Persona que olvidó la clave | Usuaria de `run`/`resume` | Un error claro, no un recorrido de relleno |
| Mantenedor y CI | Ejecutan pruebas sin modelo | Seguir usando el stub, pero eligiéndolo |
| Quien lee un informe o evidencia | Tercero o cliente | Saber si hubo modelo real |
| Quien clona un repositorio ajeno | Persona expuesta | Que el repositorio no pueda poner el stub por ella |

## 4. Historias de Usuario

### HU-001: Sin clave es un error
**Como** persona que ejecuta `fragua run` o `resume`
**Quiero** que se detenga si no hay clave para el proveedor elegido
**Para** no obtener un veredicto sin modelo creyendo que lo hubo

**Criterios de aceptación:**
- [ ] **CA-001-01**: `run` y `resume`, con el proveedor `anthropic` (explícito o por defecto), `OpenAI` o `gemini` sin su clave en el entorno, terminan con código de salida distinto de 0 y mensaje en español e inglés, antes de llamar a ningún modelo, de preparar Docker y de cambiar el estado del proyecto. (P1)
- [ ] **CA-001-02**: `AnthropicProvider.complete` sin clave ni SDK lanza error en vez de devolver `[stub-anthropic] …` (`anthropic-provider.js:192-194`). (P1)
- [ ] **CA-001-03**: Con un proveedor local sin clave (Ollama) el comportamiento no cambia. (P1)
- [ ] **CA-001-04**: El código de salida del error de clave es distinto de 0, 1, 3 y 4 (valor a decidir: ver §11) y la decisión se toma por la clase del error, no por su texto. (P1)

### HU-002: El stub solo con opción explícita
**Como** mantenedor o persona que prueba sin modelo
**Quiero** pedir el proveedor de pruebas de forma expresa
**Para** que nunca se llegue a él por omisión

**Criterios de aceptación:**
- [ ] **CA-002-01**: Existe una opción explícita para usar el stub en `run` y `resume`; sin esa opción ni el nombre `stub` en el entorno del usuario, ninguna ejecución usa respuestas de relleno. (P1)
- [ ] **CA-002-02**: Las pruebas internas del repositorio siguen usando el stub (con `FRAGUA_LLM_PROVIDER=stub`) sin cambiar de comportamiento. (P1)
- [ ] **CA-002-03**: Un `llm.provider: stub` que venga solo del archivo del proyecto no activa el stub sin la opción o la variable del usuario; el motor se detiene y dice por qué. (P1)
- [ ] **CA-002-04**: Cada ejecución con stub imprime al inicio un banner visible («SIN MODELO REAL / NO REAL MODEL») y lo repite al terminar. (P1)

### HU-003: La evidencia hecha con stub es inconfundible
**Como** persona que lee un informe de evidencia
**Quiero** que diga sin ambigüedad que no hubo modelo real
**Para** no tomarlo por un recorrido verificado

**Criterios de aceptación:**
- [ ] **CA-003-01**: Toda evidencia o informe producido con el stub lleva un campo propio y obligatorio (por ejemplo `sin_modelo_real: true`) y el nombre del proveedor `stub`, y la salida legible lo muestra en la primera línea. (P1)
- [ ] **CA-003-02**: Una prueba falla si se construye una evidencia con proveedor `stub` sin ese campo. (P1)
- [ ] **CA-003-03**: La evidencia con stub no puede registrar un nivel de garantía superior al más bajo del esquema de niveles (cuando exista la spec `nivel-de-garantia-en-evidencia`); hasta entonces, se declara «no apta como evidencia» en el informe. (P2)
- [ ] **CA-003-04**: El texto de relleno (`[stub] …`, `[stub-anthropic] …`) nunca llega a un artefacto del proyecto como si fuera contenido generado sin el banner. [NV] si hoy llega: no se trazó dónde se escribe la salida del agente. (P2)

## 5. Escenarios de Uso

### Escenario 1: Caso feliz
**Dado** `ANTHROPIC_API_KEY` definida
**Cuando** se ejecuta `fragua run`
**Entonces** se comporta como hoy.

### Escenario 2: Caso de error
**Dado** ninguna clave y ninguna opción de stub
**Cuando** se ejecuta `fragua run`
**Entonces** sale con el código propio y el mensaje «falta la clave de …», sin tocar Docker ni el estado.

### Escenario 3: Caso borde
**Dado** un repositorio clonado cuyo `.sdd/sdd.config.yaml` dice `llm.provider: stub`
**Cuando** la persona ejecuta `fragua run` sin pedir el stub
**Entonces** el motor se detiene explicando que el proyecto pide el proveedor de pruebas y cómo aceptarlo de forma expresa.

## 6. Requisitos Funcionales

- **RF-001**: El sistema DEBE comprobar la clave del proveedor elegido antes de cualquier efecto, en `run` y en `resume`.
- **RF-002**: El sistema DEBE tratar «sin clave» como error en todas las vías de un proveedor (`complete` y `conversar`).
- **RF-003**: El sistema DEBE aceptar el stub solo por una opción explícita del usuario (entorno o línea de órdenes).
- **RF-004**: El sistema DEBE marcar de forma obligatoria y visible toda salida y evidencia hecha con stub.
- **RF-005**: El sistema NO DEBE permitir que el archivo del proyecto active el stub por sí solo.
- **RF-006**: El sistema NO DEBE hacer pagar ni ocultar nada distinto: el costo del stub sigue siendo cero.

## 7. Requisitos No Funcionales

| Categoría | Requisito | Métrica |
|---|---|---|
| Seguridad | Falla cerrado ante clave ausente | Código de salida ≠ 0 antes de efectos |
| Honestidad (Principio XI) | Ninguna evidencia de stub puede pasar por real | Prueba que falla sin el campo |
| Compatibilidad | Las pruebas del repo no necesitan clave | Suite en verde con `FRAGUA_LLM_PROVIDER=stub` |

## 8. Fuera de Alcance (Exclusiones Explícitas)

- ❌ Rotar o gestionar claves (decisión 1 del plan, del dueño).
- ❌ Usar el modelo del agente anfitrión como proveedor sin clave aparte (marcado [NV] en el plan, §3.9).
- ❌ El esquema completo de niveles de garantía G0 a G3 (spec `nivel-de-garantia-en-evidencia`).
- ❌ Cambiar los guiones del stub (`FORGE_STUB_GUION`).

## 9. Dependencias y Asunciones

### Dependencias
- Plan consolidado de modos, fase 2e. `2026-11-12-proveedor-no-fijado` (comportamiento ante nombre desconocido, ya implementado como borrador).
- `nivel-de-garantia-en-evidencia` para CA-003-03 (parcial hasta que exista).

### Asunciones
- `run` y `resume` comparten `resolverClave` (`core/engine-cli.js:300`, `:416`); `status`, `doctor` y `verificar` no llaman a un modelo y no se ven afectados.
- [NECESITA_ACLARACION]: qué otras entradas llaman al modelo (MCP, API HTTP: `core/mcp/`, `core/api*`) y si comparten `resolverClave`. No se leyeron.

## 10. Términos del Dominio

- **Stub**: proveedor de pruebas con respuestas deterministas y costo cero (`core/llm-providers/stub-provider.js`).
- **Relleno**: texto `[stub-anthropic] …` que hoy devuelve `AnthropicProvider.complete` sin clave.

## 11. Preguntas Abiertas

- [ ] [POR_DECIDIR]: forma de la opción explícita (propuesta del plan: `--proveedor stub`; hoy solo existe el entorno) y si el entorno del usuario basta.
- [ ] [POR_DECIDIR]: código de salida del error de clave (propuesta: uno propio, como en `runner-falla-cerrado`; hoy 0, 1, 3 y 4).
- [ ] [POR_DECIDIR]: nombre del campo de la evidencia y texto del banner.
- [ ] [POR_DECIDIR]: comportamiento de `llm.provider: stub` en un archivo de proyecto (propuesta: rechazar, ver CA-002-03).

## 12. Criterios de Éxito Medibles

- 0 caminos de `run`/`resume` que lleguen a respuestas de relleno sin una elección explícita del stub (prueba por proveedor: anthropic, openai, gemini).
- 100 % de las evidencias con proveedor `stub` llevan el campo de marca (prueba de propiedad).

## 13. Referencias

- `reports/Plan consolidado de modos y componentes Forja.md` (§3.8, §5 fase 2e, §8.2).
- `core/engine-cli.js`, `core/llm-providers/index.js`, `core/llm-providers/anthropic-provider.js`, `core/llm-providers/stub-provider.js`, `core/evidencia/cadena.js`, `core/session-budget.js`.
- `AGENTS.md` («NO degradar en silencio»), Principio XI.

## 14. Historial de Aclaraciones

| # | Categoría | Pregunta | Decisión | Fecha |
|---|-----------|----------|----------|-------|
| – | – | Sin aclaraciones todavía | – | – |
