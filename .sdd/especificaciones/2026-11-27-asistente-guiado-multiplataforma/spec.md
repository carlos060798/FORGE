---
id: 2026-11-27-asistente-guiado-multiplataforma
titulo: "Asistente guiado multiplataforma: lectura interactiva de respuestas y selector de modo de seis preguntas en código"
tamano: mediano  # micro | pequeño | mediano | grande
estado: borrador  # borrador | en_revision | aprobada | en_implementacion | completada
creada: 2026-11-27
actualizada: 2026-11-27
autor: humano  # humano | importado
constitucion_version: 1.1.0
etiquetas: [init, guiado, windows, selector, modos, fase-2, fase-4]
---

# Especificación: Asistente guiado multiplataforma

> **Estado: borrador, sin aprobar.** Ítem (j) de la fase 2 y «Selector de 6 preguntas en código» de la fase 4 del `Plan consolidado de modos y componentes Forja` (§3.6, §5). La aprobación es del dueño del proyecto; ningún agente la marca.

## 1. Contexto y Motivación

`fragua init --guided` es la puerta de entrada de la persona no técnica, y hoy no se puede dar por funcional fuera de Linux y macOS:

- Lee la respuesta con `readFileSync("/dev/stdin")` (`cli/comandos/instalar.js:898-899`). En Windows ese archivo no existe; la lectura lanza una excepción que se traga en silencio (`:901-904`, «usa default silenciosamente») y **todas las preguntas se contestan con la opción 1 sin que la persona lo sepa**. [El comportamiento en una consola real de Windows es NV: el plan lo cita como «V-código por C2» y lo no verificado es la ejecución.]
- Aun en Linux, `readFileSync("/dev/stdin")` lee hasta el final de la entrada, no una línea, y recorta a dos caracteres (`.slice(0, 2)`, `:899`), por lo que una segunda pregunta no recibe su propia respuesta.
- La degradación a la opción por defecto es silenciosa, y `AGENTS.md` prohíbe degradar en silencio.
- El asistente actual pregunta perfil, balance calidad/costo y «modo de sesión» (`:915-941`); no pregunta nada que determine el riesgo del proyecto. El plan (§3.6) pide un selector de seis preguntas en lenguaje llano, **en código del CLI con prueba**, porque si queda en un `.md` el modelo puede saltárselo (C2 §1.5).

Ya hay en el repositorio una lectura de línea con `readline` que funciona en cualquier plataforma: `leerLineaDeTerminal` en `core/aprobaciones-identidad.js:102`, usada por `fragua aprobar` (`cli/comandos/aprobar.js:27`).

## 2. Objetivo

Que `init --guided` lea las respuestas de la persona en cualquier sistema operativo, nunca conteste por ella sin decirlo, y termine recomendando un modo de riesgo con una frase de motivo, calculado por código determinista a partir de seis preguntas en lenguaje llano, en el que «No sé» sobre datos personales cuenta como «Sí».

## 3. Usuarios y Actores

| Actor | Rol | Necesidad principal |
|---|---|---|
| Persona no técnica en Windows, macOS o Linux | Ejecuta `init --guided` | Responder preguntas y que se respete lo que contestó |
| Persona que no sabe si guardará datos de otros | Responde «No sé» | Que no se le baje la protección por no saber |
| Dueño del proyecto | Decide el modo | Una recomendación explicada, que él confirma |
| Mantenedor | Mantiene la CLI | Un selector con pruebas, sin modelo |

## 4. Historias de Usuario

### HU-001: Las respuestas se leen en cualquier plataforma
**Como** persona que usa Windows
**Quiero** que `init --guided` espere y lea cada respuesta que escribo
**Para** que la configuración sea la que elegí y no la de por defecto

**Criterios de aceptación:**
- [ ] **CA-001-01**: El asistente lee **una línea por pregunta** con un lector de líneas interactivo de la plataforma, sin abrir rutas del sistema como `/dev/stdin`; una prueba comprueba que el código del asistente no contiene `/dev/stdin`. (P1)
- [ ] **CA-001-02**: Con una entrada de varias líneas («2», «3», «1»), cada pregunta recibe su propia línea: la configuración resultante refleja las tres respuestas. (P1)
- [ ] **CA-001-03**: Una respuesta vacía acepta la opción por defecto que la pregunta muestra; una respuesta fuera de rango se vuelve a preguntar hasta 3 veces y, agotadas, termina con código distinto de 0 sin escribir configuración. (P1)
- [ ] **CA-001-04**: Si la entrada se cierra antes de contestar todas las preguntas (fin de entrada, sin terminal), el asistente termina con código distinto de 0 y un mensaje claro, y **no** completa las respuestas restantes con valores por defecto. (P1)
- [ ] **CA-001-05**: `init` sin `--guided` no cambia: no lee la entrada y su resultado es idéntico al de hoy (prueba de caracterización). (P1)
- [ ] **CA-001-06**: La prueba corre en el sistema de integración continua de Windows y de Linux con la entrada simulada por una tubería, no por un doble del lector. (P1)

### HU-002: El asistente no responde por mí en silencio
**Como** persona que ejecuta el asistente sin terminal (CI, tubería vacía)
**Quiero** que se me diga que no hay entrada
**Para** no instalar una configuración que nadie eligió

**Criterios de aceptación:**
- [ ] **CA-002-01**: Sin terminal y sin entrada, `init --guided` sale con un código distinto de 0 e indica cómo ejecutar el modo no interactivo (`init` con opciones explícitas). (P1)
- [ ] **CA-002-02**: El mensaje no contiene el texto «silenciosamente» y no aparece ningún aviso de «configuración personalizada aplicada» cuando no se aplicó ninguna. (P2)

### HU-003: Selector de modo de seis preguntas
**Como** persona no técnica
**Quiero** contestar seis preguntas sencillas y que me digan qué nivel de exigencia le corresponde a mi proyecto
**Para** no tener que saber qué es un «modo»

**Criterios de aceptación:**
- [ ] **CA-003-01**: El selector hace estas seis preguntas, en este orden y con estas opciones, en lenguaje llano y sin jerga: (1) ¿quién lo va a usar? (solo yo / gente que conozco / clientes o público); (2) ¿guardará datos de personas (nombres, correos, teléfonos, documentos, salud)? (sí / no / no sé); (3) ¿cobra dinero o mueve pagos? (sí / no); (4) ¿hay inicio de sesión o cuentas de usuario? (sí / no / no sé); (5) ¿puede borrar o cambiar datos que importan (inventario, contabilidad, registros de otros)? (sí / no); (6) ¿cuánto vale esto en días de tu esfuerzo? (una tarde / una semana / un mes o más). (P1)
- [ ] **CA-003-02**: Una séptima pregunta opcional, «¿programas?» (sí, a diario / un poco / no), fija la persona y **no** influye en el modo recomendado: para cualquier respuesta a la séptima, el modo es el mismo (prueba por parametrización). (P1)
- [ ] **CA-003-03**: Con «solo yo» y «no» en las preguntas 2 a 5, el modo recomendado es `personal`, sea cual sea la respuesta a la 6. (P1)
- [ ] **CA-003-04**: Con «gente que conozco» o «clientes o público» en la pregunta 1, el modo recomendado es `mvp` o superior, sea cual sea el resto. (P1)
- [ ] **CA-003-05**: Un «sí» en las preguntas 2, 3, 4 o 5 hace que el modo recomendado sea `mvp` o superior. (P1)
- [ ] **CA-003-06**: **«No sé» cuenta como «sí».** «No sé» en la pregunta 2 produce el mismo modo y el mismo disparador `personales` que «sí»; lo mismo en la pregunta 4 con `auth`. Una prueba compara la salida completa de ambas respuestas y exige igualdad. (P1)
- [ ] **CA-003-07**: El selector nunca recomienda un modo menor que el que implican los disparadores (propiedad: para todas las combinaciones de respuestas, el modo no es menor que `mvp` si alguna respuesta de las preguntas 2 a 5 es «sí» o «no sé», o la 1 no es «solo yo»). (P1)
- [ ] **CA-003-08**: El selector no recomienda `prototipo` mientras no existan los detectores deterministas (fase 3 del plan, §3.1) y no recomienda `producto` ni `plataforma` (no soportados aún, §3.1); si las respuestas apuntaran a ellos, dice que ese nivel está fuera de lo que Fragua cubre y qué hacer fuera de Fragua. (P1)
- [ ] **CA-003-09**: La respuesta del selector incluye el modo recomendado y el porqué **en una frase** que nombra los disparadores que lo causaron (por ejemplo, «guardas datos de otras personas»). Misma entrada, misma frase (determinista). (P1)
- [ ] **CA-003-10**: El cálculo no llama a ningún modelo ni a la red: una prueba lo ejecuta con la red y las claves ausentes y con `FRAGUA_LLM_PROVIDER` inexistente. (P1)

### HU-004: La persona confirma; el selector no decide solo
**Como** dueño del proyecto
**Quiero** poder aceptar o cambiar la recomendación
**Para** que el modo lo fije una persona, siempre en la dirección segura

**Criterios de aceptación:**
- [ ] **CA-004-01**: Tras la recomendación, el asistente pide confirmación; aceptar escribe el modo, rechazar permite elegir otro **igual o mayor**. Elegir uno menor que el recomendado exige el procedimiento de bajada de modo con aprobación humana registrada de la especificación `modos-de-riesgo-y-persona` y, mientras no exista, el asistente no lo permite. (P1)
- [ ] **CA-004-02**: Las respuestas y el modo elegido quedan registrados en el estado del proyecto (para que `doctor` y la evidencia puedan decir «modo y por qué»), sin datos personales: solo las respuestas de opción cerrada. (P2)
- [ ] **CA-004-03**: Mientras no exista la clave `modo.riesgo` (especificación `modos-de-riesgo-y-persona`), el asistente muestra la recomendación y **no escribe una clave sin lector** en `sdd.config.yaml`; lo dice. (P1)

### HU-005: El resto del asistente sigue funcionando
**Como** persona que ya usaba `--guided`
**Quiero** que el perfil, el balance calidad/costo y el modo de sesión sigan ofreciéndose
**Para** no perder lo que ya tenía

**Criterios de aceptación:**
- [ ] **CA-005-01**: Las tres preguntas actuales (perfil, balance, modo de sesión) conservan sus opciones y su efecto sobre `sdd.config.yaml` (`instalar.js:413-470`); una prueba de caracterización con el nuevo lector da el mismo archivo que hoy para las mismas elecciones. (P1)
- [ ] **CA-005-02**: El orden queda definido: primero el selector de modo, después las tres preguntas actuales, y un resumen final de lo elegido. (P2)

## 5. Escenarios de Uso

### Escenario 1: Caso feliz
**Dado** una persona en Windows que ejecuta `fragua init --guided`
**Cuando** contesta «solo yo», «no», «no», «no», «no», «una tarde»
**Entonces** el asistente recomienda `personal` con una frase de motivo, la persona confirma y continúa con las demás preguntas.

### Escenario 2: Caso de error
**Dado** una ejecución dentro de un script sin entrada
**Cuando** corre `init --guided`
**Entonces** sale con un código distinto de 0, dice que no hay entrada y sugiere el modo no interactivo; no se escribe ninguna configuración.

### Escenario 3: Caso borde
**Dado** una persona que contesta «no sé» a si guardará datos de otros
**Cuando** termina el selector
**Entonces** la recomendación es `mvp` con el motivo «puede que guardes datos de otras personas», idéntica a haber contestado «sí».

## 6. Requisitos Funcionales

- **RF-001**: El asistente DEBE leer cada respuesta como una línea con un lector interactivo que funcione en Windows, macOS y Linux.
- **RF-002**: El asistente NO DEBE contestar por la persona ni rellenar con valores por defecto las respuestas que faltan por falta de entrada.
- **RF-003**: El selector DEBE ser código determinista de la CLI, con pruebas, y NO DEBE depender de un modelo ni de un archivo `.md`.
- **RF-004**: El selector DEBE tratar «no sé» como «sí» en las preguntas que lo ofrecen.
- **RF-005**: La recomendación DEBE incluir el motivo en una frase y los disparadores que la causaron.
- **RF-006**: El selector solo DEBE recomendar subidas respecto del mínimo que implican las respuestas, nunca bajadas.
- **RF-007**: `init` sin `--guided` NO DEBE cambiar.
- **RF-008**: El asistente DEBE conservar sus preguntas actuales (perfil, balance, modo de sesión).

## 7. Requisitos No Funcionales

| Categoría | Requisito | Métrica |
|---|---|---|
| Portabilidad | Mismo comportamiento en Windows, macOS y Linux | Prueba en ambos sistemas de la CI |
| Accesibilidad | Lenguaje llano, una pregunta a la vez, valor por defecto visible | Revisión de texto: sin las palabras «gate», «ciclo», «ADR», «sandbox» en las preguntas |
| Fiabilidad | Sin respuestas inventadas | 0 casos de valor por defecto aplicado sin entrada |
| Determinismo | Misma entrada, misma salida | Prueba de repetición con 100 combinaciones |

## 8. Fuera de Alcance (Exclusiones Explícitas)

- ❌ Detectores heurísticos de dependencias, variables y migraciones (fase 4 del plan; especificación `modos-de-riesgo-y-persona`).
- ❌ Definir la tabla de modos y la clave `modo.riesgo` (la define `modos-de-riesgo-y-persona`).
- ❌ Traducción al inglés de las preguntas (bilingüe es/en queda para después de la enmienda del Principio XII).
- ❌ Un asistente gráfico o web.
- ❌ Una persona `guiado` como producto propio (el plan pide un piloto de al menos 5 personas no técnicas antes).

## 9. Dependencias y Asunciones

### Dependencias
- `core/aprobaciones-identidad.js:102` (`leerLineaDeTerminal`) como lector reutilizable; hoy rechaza si la entrada se cierra sin respuesta, lo que coincide con CA-001-04. [NV]: su opción `terminal: true` puede comportarse distinto con una tubería; la prueba CA-001-06 lo comprueba.
- Especificación `modos-de-riesgo-y-persona` (tabla de modos, `modo.riesgo`, bajada firmada). Su CA-009-04 depende de esta.
- `cmdInit` es síncrono (`instalar.js:674`) y `wizardGuiado` también (`:889`); la llamada está en `cli/index.js:137`. Leer con un lector de línea es asíncrono, así que `cmdInit` y su llamador pasan a esperar. Es un cambio interno que no altera la interfaz pública.

### Asunciones
- [NECESITA_ACLARACION]: la fuente exacta de la pregunta 6 (apetito) y su peso. El plan (§3.6, C2 §1.4) la nombra, pero en el mapeo solo sirve para distinguir `prototipo` de `personal`, y `prototipo` aún no se ofrece. Esta especificación la hace y la guarda, pero no cambia el modo recomendado.
- Orden y opciones de las seis preguntas tomados de C2 §1.4 y del plan §3.6; la redacción final es del dueño.

## 10. Términos del Dominio

- **Selector**: las seis preguntas y la regla que las convierte en un modo recomendado.
- **Disparador**: respuesta o dato que obliga a un mínimo de modo (datos personales, pagos, autenticación, borrado, exposición pública).
- **«No sé» = «sí»**: ante la duda, se asume el caso que exige más protección.

## 11. Preguntas Abiertas

- [ ] [POR_DECIDIR]: ¿qué hace el asistente cuando la persona elige un modo menor que el recomendado? Recomendado (CA-004-01): impedirlo hasta que exista la bajada firmada.
- [ ] [POR_DECIDIR]: ¿dónde se guardan las respuestas del selector? Recomendado: en el estado del proyecto de `.sdd/`, sin datos personales.
- [ ] [NECESITA_ACLARACION]: la pregunta 5 («borrar o cambiar datos que importan») ¿es un disparador de `mvp` por sí sola? El plan lista `borrado` como disparador declarable (§3.5) pero la regla «datos, pagos, auth o exposición ⇒ mvp» (§3.5) no lo nombra. Esta especificación lo trata como disparador (CA-003-05); el dueño debe confirmarlo.
- [ ] [NECESITA_ACLARACION]: si hay terminal pero la persona pulsa solo Enter en las seis preguntas, ¿cuál es el valor por defecto de cada una? Esta especificación propone el más seguro de cada pregunta («no sé» donde existe).

## 12. Criterios de Éxito Medibles

- 100 % de las combinaciones de respuestas con modo no menor que el mínimo de sus disparadores (propiedad probada sobre las 3 × 3 × 2 × 3 × 2 × 3 = 324 combinaciones de las preguntas 1 a 6).
- 0 apariciones de `/dev/stdin` en `cli/`.
- `init --guided` verde en Windows y Linux en la CI.
- La persona no técnica de la fase de pilotos completa el selector sin ayuda en menos de 3 minutos [NV: se medirá en la fase 9].

## 13. Referencias

- `cli/comandos/instalar.js:413,457-470,674,699,885-948`, `cli/index.js:114,137`.
- `core/aprobaciones-identidad.js:102`, `cli/comandos/aprobar.js:26-27`.
- `reports/Plan consolidado de modos y componentes Forja.md` §3.5, §3.6, §5.
- `research_notes/Consejo plan consolidado Forja/C2_producto_personas.md` §1.4 y §1.5; `C1_arquitectura.md` §4 (D7).
- Especificación `2026-11-27-modos-de-riesgo-y-persona` (CA-004-06 y CA-009-04).

## 14. Historial de Aclaraciones

| # | Categoría | Pregunta | Decisión | Fecha |
|---|-----------|----------|----------|-------|
| 1 | Reglas | ¿«No sé» sobre datos personales? | Cuenta como «sí» (indicación del encargo y plan §3.5) | 2026-11-27 |
