---
id: 2026-11-27-implementar-por-motor
titulo: "Implementar por el motor: sdd.implementar invoca fragua run y decide por sus códigos de salida; y cada orden citada existe"
tamano: mediano  # micro | pequeño | mediano | grande
estado: aprobada  # por delegación del dueño el 2026-11-28 (bloque MVP, respuesta «Aprobar bloque MVP por delegación»); pendiente de ratificación
creada: 2026-11-27
actualizada: 2026-11-27
autor: humano  # humano | importado
constitucion_version: 1.1.0
etiquetas: [sdd-implementar, motor, codigos-de-salida, honestidad-documental, fase-2]
---

# Especificación: Implementar por el motor

> **Estado: borrador, sin aprobar.** Ítems (g) y (h) de la fase 2 del `Plan consolidado de modos y componentes Forja` (§5) y «ruptura principal» de su §3.9. La aprobación es del dueño del proyecto; ningún agente la marca.

## 1. Contexto y Motivación

El comando `/sdd.implementar` es el camino por defecto del perfil esencial. Hoy implementa **por prompt**: un modelo orquesta agentes que escriben código, sin aislamiento, sin mutación y sin veredicto por código de salida. `commands/sdd.implementar.md` no contiene ninguna mención a `fragua run`, `forge run` ni al motor (búsqueda en el archivo, 2026-11-27). El motor sí existe y decide por códigos: `core/engine-cli.js:42` define `SALIDA = { OK: 0, FALLO: 1, REVISION: 3, SIN_AISLAMIENTO: 4 }`, y la ayuda de la CLI los documenta (`cli/index.js:96-98`). El resultado: las garantías del ciclo verificado se pierden justo con el comando que más gente usará, y la persona cree que tiene un código «verificado» que solo pasó por el juicio de un modelo (Principios V y VI de la constitución).

Un problema emparentado: varios documentos citan órdenes y archivos que no existen, lo que contradice el Principio XI (honestidad documental):

- `/forge why`, `/forge explica`, `/forge deploy`, `/forge share` y `/forge progress` aparecen en `commands/forge.md:98-119` y en los metadatos de las skills `explicame` y `share-progress`. En el `switch` de `cli/index.js` (`:136-284`) no hay ningún caso con esos nombres. Las skills a las que apuntan sí existen (`skills/explicame`, `skills/share-progress`, `skills/deploy-vercel`, `skills/vercel-deploy`), así que son alias de skill escritos con forma de orden de terminal, no órdenes de la CLI.
- `commands/sdd.exportar.md:54` y `:148` (y su copia generada `skills-generadas/sdd-exportar/SKILL.md:57,151`) incluyen en el paquete `sdd-lite/core/ir.types.ts`. No existe ni `sdd-lite/` ni ese `.ts`; el archivo real es `core/ir.types.js` (JSDoc).

## 2. Objetivo

Que `/sdd.implementar` ejecute las tareas con el motor y decida su siguiente paso solo por el código de salida y el estado que este deja, y que toda orden o ruta que un comando o skill cite exista o se haya quitado del texto.

## 3. Usuarios y Actores

| Actor | Rol | Necesidad principal |
|---|---|---|
| Persona con el perfil esencial | Pide `/sdd.implementar` | Que «implementado» signifique que pasó pruebas reales en aislamiento, o que se le diga con claridad que no |
| Dueño del proyecto | Decide qué se aprueba | Que lo que el comando afirma lo respalde el motor |
| Mantenedor | Mantiene los comandos | Que ningún texto cite una orden inexistente sin que una prueba falle |

## 4. Historias de Usuario

### HU-001: El comando implementa con el motor
**Como** persona que pide `/sdd.implementar`
**Quiero** que las tareas se ejecuten con `fragua run`
**Para** que cada tarea se corrija hasta que sus pruebas pasen, en aislamiento y con tope de gasto

**Criterios de aceptación:**
- [ ] **CA-001-01**: El texto de `commands/sdd.implementar.md` contiene la invocación de `fragua run` y, para continuar lo interrumpido, de `fragua resume`; una prueba lo comprueba. (P1)
- [ ] **CA-001-02**: Sin pasar `--motor`, el comando usa el ciclo verificado (por defecto desde 5.0.0, `core/engine-cli.js:150`); el motor clásico solo se usa si la persona lo pide de forma expresa en esa ejecución. (P1)
- [ ] **CA-001-03**: Si se usa el motor clásico, la salida del comando y la evidencia llevan la marca de nivel de garantía G1 (sin aislamiento) y el aviso «las pruebas se ejecutan en tu equipo». Hoy el propio motor imprime ese aviso (`core/engine-cli.js:158`); el comando no debe ocultarlo. (P1)
- [ ] **CA-001-04**: El comando no implementa por prompt como camino alternativo: si el motor no puede ejecutarse (código 4 o configuración inválida) no cae a escribir código con un agente fuera del motor. (P1)

### HU-002: La decisión es por código de salida
**Como** mantenedor
**Quiero** que el comando ramifique solo por el código con que termina `fragua run`/`resume`
**Para** cumplir «las decisiones que dirigen el flujo se basan en códigos de resultado y en el estado, nunca en buscar texto»

**Criterios de aceptación:**
- [ ] **CA-002-01**: Código 0: el comando pasa al paso siguiente de la metodología (verificar contra la spec) y no afirma nada más que «el motor terminó las tareas». (P1)
- [ ] **CA-002-02**: Código 1: el comando informa las tareas fallidas leyendo el estado que deja el motor, no su texto de pantalla, se detiene y ofrece `fragua resume`; no declara completada ninguna tarea. (P1)
- [ ] **CA-002-03**: Código 3: el comando muestra las tareas que esperan decisión de la persona y se detiene; la decisión (`--decision continuar|aceptar|abortar`) la toma la persona, nunca el modelo. (P1)
- [ ] **CA-002-04**: Código 4: el comando dice que no hay aislamiento disponible, cómo resolverlo y, como única alternativa, la orden expresa del motor clásico con su aviso; no lo elige por la persona. (P1)
- [ ] **CA-002-05**: Cualquier otro código, o la imposibilidad de leer el código, se trata como fallo (1) y no como éxito. (P1)
- [ ] **CA-002-06**: Una prueba recorre los cuatro códigos con un doble del motor que sale con cada uno y comprueba la rama que toma el comando (o el script que lo implementa), sin modelo ni red. (P1)
- [ ] **CA-002-07**: La tabla de códigos del comando es la misma que `SALIDA` en `core/engine-cli.js:42`: una prueba compara ambas y falla si divergen. (P1)

### HU-003: Las tareas y el estado llegan al motor
**Como** persona con tareas ya generadas por `/sdd.tareas`
**Quiero** que el motor lea esas tareas sin que yo las reescriba
**Para** no perder lo ya aprobado

**Criterios de aceptación:**
- [ ] **CA-003-01**: Con una spec activa y su `tareas.md`, `fragua run` sin `--tasks` las carga (`core/engine-cli.js:432-434`, `cargarTareas`) y el comando no necesita otro formato. [NV]: no se ha comprobado que el `tareas.md` que genera `/sdd.tareas` sea el formato que `cargarTareas` espera; la prueba de este criterio lo comprueba con un `tareas.md` generado por la plantilla. (P1)
- [ ] **CA-003-02**: Las modalidades del comando que hoy son texto del modelo (`T003`, `continuar`, `fase A`, `rapido`, `prototipo`) o se mapean a una opción del motor o se retiran del texto; ninguna modalidad omite en silencio las pruebas. En concreto, `prototipo` («Solo implementa, sin validar») no puede producir una salida que parezca verificada. (P1)
- [ ] **CA-003-03**: Los pasos del comando que hoy usan `.estado-tareas.json` y la «aprobación» por conversación (`sí` / `editar` / `cancelar`) no sustituyen a la aprobación humana registrada de la spec: el comando no marca ninguna aprobación. (P1)

### HU-004: Cada orden citada existe
**Como** persona que lee un comando o una skill
**Quiero** que toda orden `fragua <x>` o `forge <x>` citada se pueda ejecutar
**Para** no copiar una orden que da «comando desconocido»

**Criterios de aceptación:**
- [ ] **CA-004-01**: Una prueba extrae de `commands/`, `skills/` y `agents/` toda orden con forma `fragua <palabra>` o `forge <palabra>` escrita como orden de terminal (bloques de código y texto en línea con comillas inversas) y comprueba que `<palabra>` es un caso del `switch` de `cli/index.js`. Falla si no. (P1)
- [ ] **CA-004-02**: Las formas `/forge why`, `/forge explica`, `/forge deploy`, `/forge share` y `/forge progress` se resuelven por una de estas dos vías, la que decida el dueño (ver §11): (a) se quitan del texto de `commands/forge.md` y de los metadatos `forge-aliases` de las skills, o (b) se mantienen solo como alias de skill, escritos como tales («pide a tu asistente…»), y una prueba comprueba que cada alias apunta a una skill existente. (P1)
- [ ] **CA-004-03**: Ninguna de esas cinco formas aparece como orden de terminal (`forge why` sin barra) en la documentación de uso. (P1)
- [ ] **CA-004-04**: Ningún comando ni skill cita `core/ir.types.ts` ni `sdd-lite/…`; las rutas citadas en `commands/sdd.exportar.md` existen en el repositorio o en lo que `instalar` copia. Una prueba comprueba la existencia de cada ruta citada entre comillas inversas con la forma de una ruta a un archivo del paquete. (P2)
- [ ] **CA-004-05**: La copia generada (`skills-generadas/`) se regenera con `scripts/generar-skills.mjs` desde el texto corregido, y una prueba (la de consistencia que ya existe, `tests/consistencia-cifras.test.js`, u otra) comprueba que no está desfasada. [NV]: no se ha leído si `generar-skills.mjs` cubre `sdd-exportar`. (P2)

## 5. Escenarios de Uso

### Escenario 1: Caso feliz
**Dado** un proyecto con spec y tareas aprobadas, Docker en marcha y una clave del proveedor
**Cuando** la persona ejecuta `/sdd.implementar`
**Entonces** el comando invoca `fragua run`, el motor sale con 0 y el comando indica que las tareas terminaron según el motor y propone `/sdd.verificar`.

### Escenario 2: Caso de error
**Dado** el mismo proyecto sin Docker
**Cuando** la persona ejecuta `/sdd.implementar`
**Entonces** el motor sale con 4; el comando explica que el ciclo verificado necesita aislamiento, no escribe código por otro camino y muestra, aparte, la orden expresa del motor clásico con su advertencia.

### Escenario 3: Caso borde
**Dado** una tarea que el motor deja esperando una decisión
**Cuando** el motor sale con 3
**Entonces** el comando lista la tarea y su motivo, se detiene y espera que la persona elija `continuar`, `aceptar` o `abortar`; no elige por ella.

## 6. Requisitos Funcionales

- **RF-001**: `/sdd.implementar` DEBE ejecutar las tareas con `fragua run` (y retomarlas con `fragua resume`).
- **RF-002**: El comando DEBE decidir su flujo solo por el código de salida del motor (0, 1, 3, 4) y por el estado que este escribe.
- **RF-003**: El comando NO DEBE implementar por prompt cuando el motor no se puede ejecutar, ni degradar en silencio a otro camino.
- **RF-004**: El camino sin aislamiento DEBE existir solo si la persona lo pide de forma expresa, con la marca de nivel de garantía G1.
- **RF-005**: Toda orden de terminal citada en `commands/`, `skills/` y `agents/` DEBE existir en la CLI, y una prueba DEBE vigilarlo.
- **RF-006**: Toda ruta de archivo del paquete citada en un comando DEBE existir.
- **RF-007**: El comando NO DEBE marcar aprobaciones ni afirmar «verificado» por su cuenta.

## 7. Requisitos No Funcionales

| Categoría | Requisito | Métrica |
|---|---|---|
| Seguridad | El código generado no corre en el anfitrión sin decirlo | 0 ejecuciones sin aislamiento sin opción expresa |
| Compatibilidad | No se rompen `run` ni `resume` ni sus códigos | Suite existente de `engine-cli` en verde sin cambios |
| Coste | Tope de gasto vigente | El comando no desactiva el tope de la sesión |

## 8. Fuera de Alcance (Exclusiones Explícitas)

- ❌ Cambiar los códigos de salida del motor o añadir uno nuevo (se necesitarían versión MAYOR y un ADR; ver ADR-30 del plan).
- ❌ Implementar `why`, `explica`, `deploy`, `share` o `progress` como órdenes de la CLI, salvo que el dueño lo decida (§11).
- ❌ Que el motor sea el proveedor con el modelo del anfitrión sin clave aparte: [NV] según el plan (§3.9).
- ❌ Aprobar la spec o el plan por el usuario (Principio II).
- ❌ Reescribir los demás comandos que implementan por prompt (`sdd.construir`, etc.).

## 9. Dependencias y Asunciones

### Dependencias
- `core/engine-cli.js` (`SALIDA`, `cmdRun`, `cmdResume`), `cli/index.js:268-275` (despacho de `run`/`resume`), `core/tareas.js` (`cargarTareas`).
- Especificación `2026-11-27-runner-falla-cerrado` del plan (el motor clásico no debe caer a Node para otros lenguajes); esta especificación no depende de ella, pero la honestidad de CA-001-03 sí.
- Nivel de garantía en la evidencia (`nivel-de-garantia-en-evidencia` del plan).

### Asunciones
- Un comando de Markdown puede ejecutar la CLI y leer su código de salida en las herramientas anfitrionas que lo soporten. [NV]: no se ha comprobado en cada anfitrión; en los que no puedan, el comando dice que no puede y no finge.
- La clave del proveedor es aparte de la suscripción del anfitrión (`README.md:75-77`, según el plan).

## 10. Términos del Dominio

- **Ciclo verificado**: modo del motor que corrige cada tarea hasta que sus pruebas pasan, en contenedor sin red.
- **Motor clásico**: modo sin aislamiento, en el equipo; solo por opción expresa.
- **Alias de skill**: palabra que una herramienta anfitriona asocia con una skill (no es una orden de terminal).

## 11. Preguntas Abiertas

- [ ] [POR_DECIDIR]: cinco formas citadas sin orden de CLI: ¿(a) quitarlas del texto o (b) conservarlas como alias de skill? Recomendado: (b) para `why/explica`, `deploy` y `share/progress` porque las skills existen y funcionan por prompt; en ambos casos, sin forma de orden de terminal. Implementarlas como órdenes de la CLI exige que `explica` use un modelo y rompe el reparto actual (CLI determinista).
- [ ] [POR_DECIDIR]: `sdd-lite/` en `sdd.exportar`: ¿se corrige la ruta a `core/ir.types.js` o se quita la entrada? Hay que leer qué hace la instalación del paquete exportado antes de decidir. [NV]
- [ ] [NECESITA_ACLARACION]: ¿qué hace el modo `prototipo` de `sdd.implementar` cuando exista el modo de riesgo `prototipo` (spec `modos-de-riesgo-y-persona`)? Aquí solo se exige que no parezca verificado.

## 12. Criterios de Éxito Medibles

- 4 de 4 códigos del motor con rama probada.
- 0 órdenes citadas inexistentes (prueba verde sobre `commands/`, `skills/`, `agents/`).
- 0 menciones de `core/ir.types.ts` en el repositorio.

## 13. Referencias

- `commands/sdd.implementar.md` (sin mención al motor; PASO 2 con las modalidades `rapido` y `prototipo`).
- `core/engine-cli.js:42,58,150,158,184,358,401,408,474,484,549` y `cli/index.js:96-98,136-284`.
- `commands/forge.md:98-119`, `skills/explicame/SKILL.md:9,23-24,110`, `skills/share-progress/SKILL.md:9,21`, `commands/sdd.exportar.md:54,148`.
- `reports/Plan consolidado de modos y componentes Forja.md` §3.9 y §5 (fase 2, ítems g y h).

## 14. Historial de Aclaraciones

| # | Categoría | Pregunta | Decisión | Fecha |
|---|-----------|----------|----------|-------|
| 1 | Alcance | ¿Implementar o quitar las formas citadas? | Pendiente (ver §11) | 2026-11-27 |
