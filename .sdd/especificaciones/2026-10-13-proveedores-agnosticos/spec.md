---
id: 2026-10-13-proveedores-agnosticos
titulo: "Proveedores agnósticos: conformidad común, herramientas en OpenAI y Ollama, y niveles neutrales"
tamano: mediano  # micro | pequeño | mediano | grande
estado: borrador  # borrador | en_revision | aprobada | en_implementacion | completada
creada: 2026-10-13
actualizada: 2026-10-13
autor: humano  # humano | importado
constitucion_version: 1.1.0
etiquetas: [proveedores, agnostico, openai, ollama, gasto]
---

# Especificación: Proveedores agnósticos

> **Estado: borrador.** Redactada por un agente por encargo del dueño (2026-10-13); **no está aprobada** y no se implementa hasta que el dueño la apruebe (Principio II). Corresponde a los incrementos I4, I5 e I6 de `PLAN-INCREMENTAL.md`.

## 1. Contexto y Motivación

El Principio III pide «sin proveedor fijo». El código lo permite a medias:

- `core/llm-providers/provider-interface.js` define una conversación neutra (`mensajes`, `herramientas`, `Bloque`, `stopReason`), pero **solo Anthropic implementa `conversar`**. OpenAI y Ollama declaran `admiteHerramientas: false` (`openai-provider.js:38`, `ollama-provider.js:35`), así que con ellos el implementador por turnos (ADR-21) no funciona y el ciclo cae al modo de bloque.
- `core/precios.js` trae precios de Anthropic y de dos modelos de OpenAI (`gpt-4o`, `gpt-4o-mini`, revisados el 2026-10-12). A un modelo sin precio se le aplica **el más caro conocido** (`precioMasCaro`): es prudente, pero con un modelo local de Ollama, que no cuesta, el tope de gasto se alcanzaría sin haber gastado nada.
- Los niveles se llaman `opus`, `sonnet` y `haiku` también para otros proveedores, y OpenAI los resuelve a modelos fijados en el código.
- Cada proveedor tiene sus propias pruebas; no hay una batería común que diga «este proveedor cumple».
- **Ningún proveedor distinto de Anthropic se ha probado con un modelo real** (`docs/EVALUACION-PUBLICACION.md`).

## 2. Objetivo

Que cualquier proveedor que pase una batería común de conformidad pueda ejecutar el ciclo completo, incluido el implementador por turnos, con el gasto bien calculado y con nombres de nivel que no pertenezcan a un proveedor, **sin cambiar el comportamiento de quien usa Anthropic**.

## 3. Usuarios y Actores

| Actor | Rol | Necesidad principal |
|---|---|---|
| Usuario de Anthropic | Usa FORGE como hoy | Que nada cambie |
| Usuario de otro proveedor | Tiene clave de OpenAI o un punto compatible | El ciclo completo, con herramientas |
| Usuario de modelo local | Usa Ollama | Que el tope de gasto no lo frene por un coste que no existe |
| Mantenedor | Añade un proveedor | Una batería que le diga si cumple |

## 4. Historias de Usuario

### HU-001: Batería común de conformidad
**Como** mantenedor
**Quiero** una sola batería que todo proveedor deba pasar
**Para** saber si un proveedor sirve para el ciclo

**Criterios de aceptación:**
- [ ] **CA-001-01**: Existe una batería parametrizada por proveedor que se ejecuta contra servidores falsos locales, sin red ni claves. La pasan Anthropic, OpenAI, Ollama y el proveedor de pruebas. (P1)
- [ ] **CA-001-02**: Cubre `complete`: texto, recuento de tokens, error del servidor, tiempo agotado, cancelación con `signal` y respuesta vacía. (P1)
- [ ] **CA-001-03**: Cubre `conversar`, para quien lo declare: una herramienta, varias en un mismo turno, argumentos mal formados, resultado con error, corte por longitud, rechazo, y bloques que hay que devolver tal cual. (P1)
- [ ] **CA-001-04**: Un proveedor que declara `admiteHerramientas` y no pasa la parte de `conversar` hace fallar la batería. (P1)
- [ ] **CA-001-05**: La batería está documentada como requisito para añadir un proveedor. (P2)

### HU-002: Herramientas en OpenAI y compatibles
**Como** usuario de otro proveedor
**Quiero** el implementador por turnos con mi proveedor
**Para** no quedar en el modo de bloque

**Criterios de aceptación:**
- [ ] **CA-002-01**: `OpenAIProvider.conversar` traduce la conversación neutra a la API de chat con herramientas y de vuelta, sin dependencias nuevas. (P1)
- [ ] **CA-002-02**: `admiteHerramientas` es verdadero solo si hay con qué llamar (clave o cliente inyectado), como en Anthropic. (P1)
- [ ] **CA-002-03**: Un punto compatible que no admite herramientas produce un error claro; el ciclo avisa y usa el modo de bloque, como hoy. (P1)
- [ ] **CA-002-04**: Argumentos de herramienta que no son JSON válido no rompen el ciclo: se devuelven al modelo como error de la herramienta. (P1)
- [ ] **CA-002-05**: El implementador por turnos completa una tarea de punta a punta contra un servidor falso de la API de chat. (P1)
- [ ] **CA-002-06**: La clave nunca aparece en registros, errores ni prompts; una prueba lo comprueba con un centinela. (P1)

### HU-003: Herramientas en Ollama
**Como** usuario de modelo local
**Quiero** herramientas cuando mi modelo las admite
**Para** usar el implementador por turnos sin coste

**Criterios de aceptación:**
- [ ] **CA-003-01**: `OllamaProvider.conversar` usa las herramientas de la API de chat de Ollama cuando el modelo las admite. (P2)
- [ ] **CA-003-02**: Si el modelo no las admite, el proveedor lo detecta con el primer error, lo recuerda durante la sesión y el ciclo usa el modo de bloque con un aviso. (P1)

### HU-004: Gasto bien calculado fuera de Anthropic
**Como** usuario de otro proveedor o de modelo local
**Quiero** que el gasto refleje lo que pago
**Para** que el tope funcione

**Criterios de aceptación:**
- [ ] **CA-004-01**: Un proveedor local puede declararse sin coste de forma explícita (`precios:` a cero para ese modelo); nunca de forma implícita por el nombre del proveedor. (P1)
- [ ] **CA-004-02**: Un modelo sin precio sigue contándose al precio más caro conocido, y el ciclo lo avisa una vez por sesión diciendo qué clave de `precios:` falta. (P1)
- [ ] **CA-004-03**: Una opción `presupuesto.sin_precio: avisar | rechazar` permite que el ciclo no arranque con un modelo sin precio. El valor por defecto no cambia el comportamiento actual. (P2)
- [ ] **CA-004-04**: La tabla de OpenAI se revisa contra la tarifa oficial y se actualiza la fecha de revisión; se añade solo lo confirmado. (P2)
- [ ] **CA-004-05**: Los tokens de caché que informe otro proveedor se cuentan con su precio si existe; si no, al precio de entrada, nunca por debajo. (P2)

### HU-005: Niveles con nombre neutral
**Como** usuario de otro proveedor
**Quiero** niveles que no lleven el nombre de un modelo ajeno
**Para** entender la configuración

**Criterios de aceptación:**
- [ ] **CA-005-01**: Los niveles `alto`, `medio` y `economico` se aceptan en `modelos:`, `motor.nivel_maximo`, `FORGE_NIVEL_MAXIMO` y en la cabecera de los agentes. (P1)
- [ ] **CA-005-02**: `opus`, `sonnet` y `haiku` siguen valiendo como alias de los anteriores, sin aviso de obsolescencia en esta entrega. (P1)
- [ ] **CA-005-03**: Las reglas de degradación por presupuesto y de nivel máximo funcionan igual con los dos juegos de nombres; una prueba compara los resultados. (P1)
- [ ] **CA-005-04**: Los modelos por defecto de OpenAI y Ollama dejan de estar solo en el código: se documentan y `forge doctor` muestra a qué modelo resuelve cada nivel. (P2)

### HU-006: Validación con un modelo real
**Como** dueño
**Quiero** evidencia de que un segundo proveedor resuelve tareas
**Para** poder decir que FORGE no depende de uno

**Criterios de aceptación:**
- [ ] **CA-006-01**: `scripts/pruebas-independientes.mjs` acepta `--proveedor` y registra proveedor y modelo en el informe. (P1)
- [ ] **CA-006-02**: Tres proyectos del kit terminan en éxito con un segundo proveedor real, con tope de gasto, y la evidencia queda en la carpeta de la spec. **Requiere clave y presupuesto del dueño.** (P1)
- [ ] **CA-006-03**: Si no se hace, la documentación sigue diciendo «sin probar con modelo real» para ese proveedor. (P1)

## 5. Escenarios de Uso

### Escenario 1: OpenAI con implementador por turnos
`llm.provider: openai` y `motor.implementador: turnos`: el ciclo lee, busca, edita y ejecuta pruebas con herramientas y termina en éxito.

### Escenario 2: Punto compatible sin herramientas
El servidor rechaza el campo de herramientas: aviso y modo de bloque; la tarea continúa.

### Escenario 3: Modelo local
Ollama con `precios:` a cero para su modelo: el libro de gasto registra las llamadas con coste cero y el tope no interviene.

### Escenario 4: Modelo sin precio
Un modelo nuevo de OpenAI sin entrada en la tabla: aviso con la clave que falta y gasto contado al precio más caro.

## 6. Requisitos Funcionales

| ID | Requisito | Prioridad |
|---|---|---|
| RF-01 | Batería de conformidad parametrizada y servidores falsos por proveedor | P1 |
| RF-02 | `conversar` en OpenAI | P1 |
| RF-03 | `conversar` en Ollama con detección de modelo sin herramientas | P2 |
| RF-04 | Coste cero explícito, aviso de modelo sin precio y opción `sin_precio` | P1 |
| RF-05 | Niveles neutrales con alias | P1 |
| RF-06 | `--proveedor` en el kit de pruebas independientes | P1 |

## 7. Requisitos No Funcionales

| ID | Requisito |
|---|---|
| RNF-01 | Sin dependencias nuevas: `fetch` de Node (Principio IV) |
| RNF-02 | El comportamiento con Anthropic no cambia: sus pruebas actuales pasan sin modificarse |
| RNF-03 | El gasto nunca se calcula por debajo del real (Principio VIII) |
| RNF-04 | Claves solo por entorno o configuración local; nunca en registros |
| RNF-05 | Tiempo máximo y cancelación en todas las llamadas, como hoy |

## 8. Fuera de Alcance (Exclusiones Explícitas)

- Proveedores nuevos (Gemini, Mistral, Bedrock): se añaden después, pasando la batería.
- Caché de prompts fuera de Anthropic.
- Enrutamiento automático entre proveedores según coste o éxito: es de la etapa de orquestador.
- La API de respuestas de OpenAI: solo la de chat, que es la que comparten los puntos compatibles.
- Retirar los alias `opus`, `sonnet` y `haiku`.

## 9. Dependencias y Asunciones

### Spikes obligatorios antes de construir
- **S0.1** Forma exacta de las herramientas en la API de chat de OpenAI y en la de Ollama, desde su documentación oficial vigente, con URL y fecha: petición, respuesta, llamadas en paralelo, motivos de parada y errores.
- **S0.2** Tarifa oficial vigente de OpenAI para los modelos de la tabla y los que se quieran añadir.
- **S0.3** Leer en el código dónde se resuelven los niveles (`core/ciclo/config.js`, `core/agent-registry.js`, proveedores, presupuesto) para listar todos los puntos que tocan los nombres.

### Dependencias
- `core/llm-providers/`, `core/precios.js`, `core/ciclo/config.js`, `core/ciclo/presupuesto.js`, `core/ciclo/turnos.js`, `core/agent-registry.js`, `scripts/pruebas-independientes.mjs`.

### Asunciones
- La forma neutra de la conversación basta para OpenAI y Ollama; si falta algo, se amplía la interfaz en esta spec y se actualiza ADR-21.

## 10. Capas de seguridad

| Riesgo | Control |
|---|---|
| Un `base_url` del proyecto envía la clave a un servidor ajeno | El proyecto es no confiable: revisar en S0.3 de dónde sale `base_url` hoy y exigir que un destino distinto del oficial lo confirme el entorno del usuario, como en integraciones |
| Argumentos de herramienta manipulados por el modelo | Mismas validaciones de `herramientas-coder.js`; el proveedor no ejecuta nada |
| Coste infravalorado | Nunca por debajo del precio conocido más alto salvo declaración explícita |
| Fuga de la clave en errores del servidor | Redacción y prueba con centinela |

## 11. Términos del Dominio

- **Conformidad:** que un proveedor pase la batería común.
- **Nivel:** `alto`, `medio`, `economico`; categoría de modelo independiente del proveedor.

## 12. Preguntas Abiertas

| # | Pregunta | Recomendación |
|---|---|---|
| 1 | Nombres de los niveles neutrales | `alto`, `medio`, `economico` (Principio XII) |
| 2 | ¿`presupuesto.sin_precio` pasa a `rechazar` por defecto en una versión futura? | Decidirlo con datos de la beta |
| 3 | Segundo proveedor para la validación real y presupuesto | El que el dueño ya tenga; tope de 1 USD |
| 4 | ¿Se actualizan los modelos por defecto de OpenAI, hoy `gpt-4o`? | Sí, tras el spike de tarifas, con precios confirmados |

## 13. Criterios de Éxito Medibles

- Cuatro proveedores pasan la batería común.
- El implementador por turnos termina una tarea con OpenAI contra servidor falso.
- Las pruebas actuales de Anthropic pasan sin tocarse.
- Con clave del dueño: tres proyectos en éxito con un segundo proveedor.

## 14. Referencias

- `PLAN-INCREMENTAL.md` (I4, I5, I6), `PLAN-ESCALADO.md` (E1), ADR-19, ADR-21.

## 15. Historial de Aclaraciones

- 2026-10-13: creada en borrador. Se corrige una afirmación previa de los planes: sí hay precios de OpenAI en la tabla, y un modelo sin precio se cuenta al más caro conocido.
