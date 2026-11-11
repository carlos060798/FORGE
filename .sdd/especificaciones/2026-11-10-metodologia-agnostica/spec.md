---
id: 2026-11-10-metodologia-agnostica
titulo: "Metodología agnóstica del anfitrión: comandos y agentes utilizables fuera de Claude Code"
tamano: grande  # micro | pequeño | mediano | grande
estado: en_implementacion  # borrador | en_revision | aprobada | en_implementacion | completada
creada: 2026-11-10
actualizada: 2026-11-11
autor: humano  # humano | importado
constitucion_version: 1.1.0
etiquetas: [agnostico, anfitrion, comandos, agentes, roles]
---

# Especificación: Metodología agnóstica del anfitrión

> **Estado: en implementación.** Redactada por instrucción del dueño (2026-11-10); **aprobada por delegación del dueño el 2026-11-11** («tú haz el 3»), pendiente de su ratificación. Corresponde a las fases F1 y F2 de `docs/PLAN-AGNOSTICO.md`; el guardián y la memoria fuera de los hooks (F3) merecen una especificación propia por tocar seguridad.

## 1. Contexto y Motivación

El motor de Fragua ya no depende de Claude Code, y `forge init --integracion` instala skills en la carpeta de nueve herramientas. Pero los 39 comandos, los 14 agentes y los hooks están escritos para Claude Code: quien usa otra herramienta recibía skills sin agentes y con textos que hablan de `/sdd.x`, `Task` y `TodoWrite`. La especificación `2026-10-13-instalacion-agnostica` dejó fuera de alcance los agentes.

## 2. Objetivo

Que quien instale Fragua en una herramienta que no es Claude Code reciba la metodología completa en una forma que esa herramienta pueda usar (comandos como skills con su sintaxis, agentes como roles), sin cambiar nada de lo que recibe Claude Code, y sabiendo con claridad qué no recibe.

## 3. Usuarios y Actores

| Actor | Rol | Necesidad principal |
|---|---|---|
| Usuario de otra herramienta | Usa Codex, Cursor, Copilot u otra | Poder seguir el flujo sin traducir a mano la sintaxis de Claude Code |
| Usuario de Claude Code | Instala como hoy | Que nada cambie |
| Mantenedor | Edita comandos y agentes | Una sola fuente, sin copias que diverjan |

## 4. Historias de Usuario

### HU-001: Comandos y skills con la sintaxis de mi herramienta (F1)
**Como** usuario de otra herramienta
**Quiero** que las órdenes de los comandos usen la forma de invocar de mi herramienta
**Para** poder ejecutarlas sin reescribirlas

**Criterios de aceptación:**
- [ ] **CA-001-01**: En las integraciones que no son `claude`, toda referencia a una orden `/sdd.x` en el cuerpo y en la `description` pasa a la forma de invocar de esa herramienta; las rutas (`.sdd/sdd.config.yaml`) no se tocan. (P1)
- [ ] **CA-001-02**: Estas skills no llevan `allowed-tools` en la cabecera ni la expresión «Claude Code» fuera de una nota inicial de equivalencias. (P1)
- [ ] **CA-001-03**: La nota inicial explica el equivalente de `Task`, `TodoWrite`, `/effort`, `$CLAUDE_PLUGIN_ROOT` y los hooks, e indica que lo paralelo pasa a secuencial. (P1)
- [ ] **CA-001-04**: Una prueba falla si una skill adaptada de cualquier integración no válida contra la especificación abierta o conserva sintaxis excluida. (P1)
- [ ] **CA-001-05**: Las fuentes de `commands/`, `agents/` y `skills/` y lo que recibe `claude` no cambian (la prueba de equivalencia de `init` sigue en verde). (P1)

### HU-002: Agentes como roles (F2)
**Como** usuario de otra herramienta
**Quiero** que cada agente exista como una skill que pueda cargar
**Para** que los comandos que delegan en un agente tengan a quién delegar

**Criterios de aceptación:**
- [ ] **CA-002-01**: Con una integración que no es `claude`, `init` instala una skill `rol-<agente>` por cada agente de `agents/`, válida contra la especificación abierta. (P1)
- [ ] **CA-002-02**: Cada rol lleva en `metadata` el nivel neutral (`alto`, `medio`, `economico`) y las herramientas del agente. (P1)
- [ ] **CA-002-03**: El cuerpo del rol no cita el hook de memoria de Claude Code; indica anotar las decisiones en `.sdd/memoria/`. (P2)
- [ ] **CA-002-04**: La escritura de roles usa escritura segura y no pisa un archivo ajeno distinto sin avisar. (P1)
- [ ] **CA-002-05**: El mensaje final de `init` dice cuántos roles se instalaron y qué no recibe la herramienta (hooks, guardián, memoria por hooks, `settings.json`). (P1)

### HU-003: Honestidad sobre lo que no se recibe
**Como** usuario de otra herramienta
**Quiero** saber qué protecciones no están activas
**Para** no confiar en un guardián que no existe

**Criterios de aceptación:**
- [ ] **CA-003-01**: `docs/ANFITRIONES.md` tiene una matriz herramienta × capacidad en la que ninguna herramienta figura como «probada» sin su registro de prueba manual. (P1)
- [ ] **CA-003-02**: README, estado actual y hoja de ruta describen la diferencia entre Claude Code y el resto en los mismos términos que la matriz. (P2)

## 5. Fuera de Alcance

- Guardián y memoria fuera de los hooks de Claude Code (F3): especificación propia.
- Agentes en el formato nativo de cada herramienta: depende de un spike con documentación oficial (S0.1 del plan); no se afirma ni se genera nada hasta entonces.
- Vocabulario neutral de modelos en `agents/` y `presets/`, y `doctor` por proveedor (F4).
- Prueba manual en cada herramienta (F5).
- Pasar la fuente de comandos y agentes a un formato neutral con tokens; esta especificación adapta al instalar, sin tocar las fuentes.

## 6. Dependencias y Asunciones

- `core/instalacion/` (tabla de integraciones, generador de skills, perfiles) y `cli/comandos/instalar.js`.
- Asunción: el formato `SKILL.md` sigue siendo estable y abierto.
- Asunción: sustituir las órdenes por expresión regular basta para los 39 comandos; la prueba CA-001-04 es la red.

## 7. Riesgos

| Riesgo | Mitigación |
|---|---|
| Sin subagentes, la delegación pierde el aislamiento de contexto | Se dice en la nota inicial, en el mensaje de `init` y en `docs/ANFITRIONES.md` |
| La sustitución textual rompe un ejemplo de código | La prueba de lint y la revisión de una instalación real por herramienta (F5) |
| Parecer protegido sin guardián | La matriz y el mensaje final lo dicen; no se usa la palabra «protegido» fuera de Claude Code |

## 8. Preguntas Abiertas

| # | Pregunta | Recomendación |
|---|---|---|
| 1 | ¿La fuente definitiva pasa a un formato neutral con tokens (F1 completa) o se mantiene la adaptación al instalar? | Mantener la adaptación hasta que F5 muestre qué falla en la práctica |
| 2 | ¿Qué herramientas se prueban primero a mano? | Codex y Cursor |

## 9. Criterios de Éxito Medibles

- Los 14 agentes y los 39 comandos se instalan válidos en las nueve integraciones (prueba automática).
- `init` sin opciones produce el mismo árbol que antes (prueba automática).
- Al menos dos herramientas con registro de prueba manual en `verificacion.md`.

## 10. Referencias

- `docs/PLAN-AGNOSTICO.md`, `docs/ANFITRIONES.md`.
- `.sdd/especificaciones/2026-10-13-instalacion-agnostica/` y su spike de carpetas de skills.
- 2026-11-11: aprobada por delegación del dueño (pendiente de ratificación).
