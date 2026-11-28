---
id: 2026-11-27-gobierno-delegacion
titulo: "Gobierno: la «aprobación por delegación» se define con límites y ratificación en plazo, o se prohíbe"
tamano: pequeño  # micro | pequeño | mediano | grande
estado: borrador  # borrador | en_revision | aprobada | en_implementacion | completada
creada: 2026-11-27
actualizada: 2026-11-27
autor: humano  # humano | importado
constitucion_version: 1.1.0
etiquetas: [gobierno, aprobacion, delegacion, principio-ii, fase-0]
---

# Especificación: Gobierno de la «aprobación por delegación»

> **Estado: borrador, sin aprobar.** Fase 0 del plan consolidado de modos y componentes (`reports/Plan consolidado de modos y componentes Forja.md`, §5 y §7, decisión 2). La aprobación es del dueño del proyecto; ningún agente la marca. Esta especificación **ofrece dos opciones y recomienda una**: el dueño elige.

## 1. Contexto y Motivación

El Principio II de la constitución dice que la especificación y el plan los aprueba el dueño y que ningún agente ni comando marca una aprobación por su cuenta (`.sdd/memoria/constitucion.md`, Principio II). En la práctica, buena parte del proyecto avanzó con una figura que la constitución no define: la «aprobación por delegación». Comprobado en el árbol el 2026-11-27:

- La constitución, `AGENTS.md` y `GOVERNANCE.md` no contienen la palabra «delegación» (búsqueda sobre esos tres archivos, sin resultados).
- `.sdd/INDICE.md` y `docs/ESTADO-ACTUAL.md:104` la usan («Hasta ahora se ha avanzado por delegación, anotado en cada carpeta»). Cinco archivos de `.sdd/` llevan `estado: aprobado_por_delegacion` en su cabecera (p. ej. `.sdd/especificaciones/2026-10-03-api-http/plan.md:3`); otras especificaciones figuran en el INDICE como «aprobada por delegación» sin que su `spec.md` lo recoja (caso `2026-10-09-validacion-modelo-real`, cuya cabecera dice `estado: borrador`).
- El código ya trata una parte: un archivo con `estado: aprobado_por_delegacion` solo vale si hay un registro firmado de tipo `delegacion` con el hash vigente del archivo (`core/aprobaciones-identidad.js:301-338`, `comprobarDelegaciones`), y `fragua verificar` lo consulta (`cli/verificar.js:111-112`). El registro lo hace la persona con `fragua aprobar delegacion <carpeta>/<archivo>.md`, que exige un terminal real (`cli/comandos/aprobar.js`, comentario de cabecera y rama `delegacion`).
- No hay definición de quién puede delegar, en quién, para qué clase de cambio, ni **plazo** para ratificar. Por eso el mismo verbo «aprobada» significa dos cosas distintas (delegada y ratificada) en el INDICE y en las especificaciones.

El plan consolidado la llama «la grieta por la que entra todo lo demás»: sin límites, la delegación vacía el Principio II.

## 2. Objetivo

Que exista una sola regla escrita, comprobable por el motor, sobre la aprobación por delegación: o bien una definición con alcance, registro y plazo de ratificación, o bien su prohibición. Y que ningún documento use «aprobada» para algo que el dueño no ha ratificado.

## 3. Usuarios y Actores

| Actor | Rol | Necesidad principal |
|---|---|---|
| Dueño del proyecto | Aprueba y ratifica | Saber qué se hizo en su nombre, hasta cuándo, y poder revertirlo |
| Agente de código | Propone y redacta | Saber con precisión qué puede dar por aprobado y qué no |
| Mantenedor / auditor | Revisa la trazabilidad | Distinguir lo ratificado de lo delegado sin leer cada carpeta |
| Contribuidor externo | Lee el gobierno | Una regla única y pública |

## 4. Opciones para el dueño

### Opción A (recomendada): definirla con límites y ratificación obligatoria en plazo

**Por qué se recomienda:** el proyecto ya funciona así y lo ha dejado registrado en cinco archivos y en el INDICE; prohibirla de golpe obliga a ratificar o revertir de inmediato todo lo avanzado por delegación, con una sola persona como cuello de botella. La definición con plazo conserva la velocidad y cierra la grieta: si el dueño no ratifica a tiempo, el sistema se detiene en lugar de seguir.

Elementos que la definición DEBE fijar (los valores marcados `[POR_DECIDIR]` son del dueño):

- **Quién delega:** solo el dueño, por escrito, desde su terminal. Un agente no se delega a sí mismo ni delega a otro agente.
- **A quién:** a un rol de agente nombrado en el propio registro.
- **Qué se puede delegar:** especificaciones y planes de tamaño `micro` y `pequeño` que no cambien una garantía, una restricción de la constitución, una dependencia, la interfaz pública ni la seguridad. [POR_DECIDIR: ¿también `mediano`?]
- **Qué nunca se delega:** enmiendas de la constitución; decisiones de dependencias nuevas (ADR); cambios de garantía de aislamiento o del guardián; publicación de versiones; titular, nombre y licencia; bajar un modo de riesgo.
- **Cómo se registra:** archivo con la marca de delegación en su cabecera **y** registro firmado de tipo `delegacion` con el hash vigente del archivo y, además, quién delegó, a quién, alcance, fecha y fecha límite de ratificación. Si el archivo cambia, el registro deja de valer (ya ocurre hoy, `core/aprobaciones-identidad.js:334`).
- **Plazo de ratificación:** [POR_DECIDIR] valor propuesto: 14 días naturales desde la fecha del registro.
- **Qué pasa al vencer:** el artefacto deja de contar como aprobado. El motor lo informa, impide el avance posterior (planificar, implementar o publicar a partir de él) y exige elegir: ratificar con la aprobación firmada normal del Principio II, o revertir.
- **Vocabulario:** «delegada» (provisional, con plazo) y «ratificada» (aprobada por el dueño). La palabra «aprobada» sola significa «ratificada».

### Opción B: prohibirla

La constitución y `GOVERNANCE.md` dicen que no existe aprobación por delegación; el estado `aprobado_por_delegacion` deja de ser válido; el motor lo rechaza. Todo lo hoy delegado se ratifica o se revierte antes de seguir. Es la lectura más estricta del Principio II y la más simple de explicar, pero bloquea el avance hasta que el dueño revise todo el inventario.

## 5. Historias de Usuario

### HU-001: Una sola regla escrita
**Como** dueño
**Quiero** que la regla de delegación (o su prohibición) esté en un solo lugar
**Para** que ningún documento la reinterprete

**Criterios de aceptación:**
- [ ] **CA-001-01**: La regla elegida figura en la constitución, o en un documento de gobierno que la constitución cita; `AGENTS.md`, `GOVERNANCE.md`, `.sdd/INDICE.md` y `docs/ESTADO-ACTUAL.md` la remiten y ninguno la redefine. (P1)
- [ ] **CA-001-02**: La regla distingue «delegada» de «ratificada»; ningún documento de gobierno usa «aprobada» para una delegación sin ratificar. (P1)
- [ ] **CA-001-03**: La elección del dueño (A o B) consta en el historial de aclaraciones de esta especificación con su fecha. (P1)

### HU-002: Registro verificable de cada delegación (solo Opción A)
**Como** auditor
**Quiero** que cada delegación deje un registro comprobable
**Para** saber quién delegó, en qué, y hasta cuándo

**Criterios de aceptación:**
- [ ] **CA-002-01**: Un artefacto marcado como delegado sin registro firmado vigente hace que `fragua verificar` falle y diga qué falta. (P1)
- [ ] **CA-002-02**: El registro incluye quién delegó, a quién, alcance, fecha y fecha límite de ratificación. (P1)
- [ ] **CA-002-03**: Un agente no puede crear el registro: exige una persona en un terminal real, como hoy. (P1)
- [ ] **CA-002-04**: Un artefacto que cae en la lista «nunca se delega» no se puede registrar como delegado. (P1)

### HU-003: Ratificación en plazo (solo Opción A)
**Como** dueño
**Quiero** ver qué delegaciones vencen y ratificarlas o revertirlas
**Para** que lo hecho en mi nombre no quede sin revisar

**Criterios de aceptación:**
- [ ] **CA-003-01**: El estado del proyecto lista las delegaciones abiertas con su fecha límite. (P1)
- [ ] **CA-003-02**: Vencido el plazo sin ratificar, el motor deja de tratar el artefacto como aprobado y bloquea el avance que dependa de él, con un mensaje que nombra las dos salidas. (P1)
- [ ] **CA-003-03**: Ratificar usa la aprobación firmada del Principio II y deja un registro distinto del de delegación. (P1)
- [ ] **CA-003-04**: Una delegación vencida no se puede renovar en silencio: renovar exige una nueva delegación registrada por la persona. (P2)

### HU-004: Prohibición (solo Opción B)
**Como** dueño
**Quiero** que el motor rechace cualquier delegación
**Para** que el Principio II se cumpla a la letra

**Criterios de aceptación:**
- [ ] **CA-004-01**: Un archivo con la marca de delegación en su cabecera hace que `fragua verificar` falle con un mensaje que explica la prohibición. (P1)
- [ ] **CA-004-02**: La constitución y `GOVERNANCE.md` dicen que no existe la aprobación por delegación. (P1)
- [ ] **CA-004-03**: El comando que registra una delegación desaparece o responde con la prohibición; no registra nada. (P1)

### HU-005: Inventario inicial
**Como** dueño
**Quiero** que cada artefacto hoy delegado quede clasificado
**Para** que ninguno siga en un limbo

**Criterios de aceptación:**
- [ ] **CA-005-01**: Cada artefacto hoy marcado como delegado (cinco archivos con la marca en su cabecera y las especificaciones que el INDICE llama «aprobada por delegación») figura en una tabla con uno de estos estados: ratificado, revertido o delegado con plazo (Opción A) / ratificado o revertido (Opción B). Ninguno queda sin clasificar. (P1)
- [ ] **CA-005-02**: El INDICE y la cabecera de cada especificación coinciden en su estado; el caso `2026-10-09-validacion-modelo-real` (INDICE `en_implementacion`, cabecera `borrador`) queda resuelto. (P1)

## 6. Escenarios de Uso

### Escenario 1: Caso feliz (Opción A)
**Dado** una especificación pequeña que no toca garantías, y una delegación registrada por el dueño con plazo de 14 días
**Cuando** el dueño la ratifica el día 9
**Entonces** el registro de ratificación sustituye a la delegación y el INDICE la muestra como «ratificada».

### Escenario 2: Caso de error
**Dado** un agente que escribe `estado: aprobado_por_delegacion` en una cabecera sin registro
**Cuando** se ejecuta `fragua verificar`
**Entonces** falla y dice que la persona debe registrar la delegación en su terminal.

### Escenario 3: Caso borde
**Dado** una delegación vencida hace tres días y un plan que depende de ella
**Cuando** alguien intenta pasar a implementar
**Entonces** el motor se detiene y ofrece ratificar o revertir; no avanza ni degrada en silencio.

## 7. Requisitos Funcionales

- **RF-001**: El sistema DEBE tener una sola definición de la aprobación por delegación (o de su prohibición) y todos los documentos DEBEN remitirla.
- **RF-002**: El sistema DEBE distinguir «delegada» de «ratificada» en el INDICE, en las cabeceras y en la salida del motor.
- **RF-003** (Opción A): El sistema DEBE exigir un registro firmado, con el hash vigente, para toda delegación, y una fecha límite de ratificación.
- **RF-004** (Opción A): El sistema DEBE dejar de contar como aprobada una delegación vencida y bloquear el avance que dependa de ella.
- **RF-005**: El sistema NO DEBE permitir que un agente o comando registre por su cuenta una aprobación, una delegación o una ratificación (Principio II).
- **RF-006** (Opción A): El sistema NO DEBE permitir delegar lo que figura en la lista «nunca se delega».

## 8. Requisitos No Funcionales

| Categoría | Requisito | Métrica |
|-----------|-----------|---------|
| Seguridad | El registro de delegación es íntegro y verificable; un cambio en el archivo lo invalida | Prueba automática con archivo modificado |
| Honestidad | Ningún documento llama «aprobada» a una delegación sin ratificar | Prueba de consistencia sobre INDICE y cabeceras |
| Límite declarado | La firma es local: con el mismo usuario del sistema no hay separación criptográfica total (`cli/comandos/aprobar.js`, comentario de cabecera). Se declara, no se oculta | Frase presente en `GOVERNANCE.md` |

## 9. Fuera de Alcance (Exclusiones Explícitas)

- ❌ Aprobar o ratificar ninguna especificación concreta: lo hace el dueño con su comando.
- ❌ Cambiar la firma, su algoritmo o dónde vive la clave (es de la especificación `2026-11-06-aprobaciones-con-identidad`).
- ❌ Varias personas aprobadoras o firma de equipo (especificación `2026-11-10-equipos-y-ciclo-en-ci`).
- ❌ Decidir las otras decisiones del dueño del plan consolidado.

## 10. Dependencias y Asunciones

### Dependencias
- Constitución (Principio II y proceso de enmiendas); `GOVERNANCE.md`; `.sdd/INDICE.md`.
- `2026-11-06-aprobaciones-con-identidad` (registro firmado); sigue en borrador y, según la propia spec, no se ha probado en un terminal real.

### Asunciones
- Hay un solo dueño hoy (`GOVERNANCE.md:7`).
- El plazo propuesto (14 días) es una cifra de partida, no medida.
- [NV] Que el motor hoy no bloquee nada por vencimiento: no existe ningún plazo en el código leído (`core/aprobaciones-identidad.js:301-338` solo comprueba registro y hash); no se buscó en el resto del motor.

## 11. Términos del Dominio

- **Delegación:** instrucción del dueño, registrada por él, para que un rol de agente dé por aprobado provisionalmente un artefacto acotado.
- **Ratificación:** aprobación firmada del dueño que convierte una delegación en una aprobación del Principio II.
- **Plazo de ratificación:** fecha tras la cual una delegación sin ratificar deja de valer.

## 12. Preguntas Abiertas

- [ ] [POR_DECIDIR]: ¿Opción A o B? Recomendación: A.
- [ ] [POR_DECIDIR]: plazo de ratificación (propuesta: 14 días naturales).
- [ ] [POR_DECIDIR]: ¿se pueden delegar especificaciones `mediano`? (propuesta: no).
- [ ] [POR_DECIDIR]: ¿la regla vive en la constitución (enmienda MENOR, con informe de sincronización) o en `GOVERNANCE.md`? Recomendación: constitución, para que la manden todos.

## 13. Criterios de Éxito Medibles

- 0 artefactos con la marca de delegación sin registro vigente.
- 0 artefactos con estado discordante entre INDICE y cabecera sobre la delegación.
- 100 % de las delegaciones abiertas con fecha límite visible (Opción A).

## 14. Referencias

- `reports/Plan consolidado de modos y componentes Forja.md` §5 (fase 0), §7 (decisión 2).
- `research_notes/Consejo plan consolidado Forja/L4_gobierno.md` §5 (inconsistencias de estado).
- `.sdd/memoria/constitucion.md` (Principio II); `core/aprobaciones-identidad.js:301-338`; `cli/verificar.js:111-112`; `cli/comandos/aprobar.js`; `docs/ESTADO-ACTUAL.md:104`.

## 15. Historial de Aclaraciones

| # | Categoría | Pregunta | Decisión | Fecha |
|---|-----------|----------|----------|-------|
| 1 | Gobierno | ¿Opción A o B? | pendiente del dueño | – |
