---
id: 2026-11-27-aprobacion-verificable-en-todos-los-caminos
titulo: "Aprobación verificable en todos los caminos: la verificación firmada de la spec en todo llamador de la máquina de estados y en la evidencia"
tamano: mediano  # micro | pequeño | mediano | grande
estado: aprobada  # por delegación del dueño el 2026-11-28 (bloque MVP, respuesta «Aprobar bloque MVP por delegación»); pendiente de ratificación
creada: 2026-11-27
actualizada: 2026-11-27
autor: humano  # humano | importado
constitucion_version: 1.1.0
etiquetas: [nucleo, aprobacion, seguridad, maquina-de-estados, evidencia, plan-modos-fase-2c]
---

# Especificación: Aprobación verificable en todos los caminos

> **Estado: borrador, sin aprobar.** Punto 2c del «Plan consolidado de modos y componentes de Forja» (2026-11-27, §3.4, §5 fase 2c, §6, §8.1 y §8.2). La aprobación es del dueño del proyecto; ningún agente la marca. Orden de trabajo: spec aprobada → pruebas (una en rojo antes del arreglo) → código. Complementa, sin sustituir, la spec `2026-11-06-aprobaciones-con-identidad`.

## 1. Contexto y Motivación

El Principio II de la constitución dice que la aprobación es humana. Para que lo sea de verdad, pasar de la especificación a la planificación no puede depender de un booleano que cualquiera con acceso al archivo `.sdd/estado.json` puede escribir (hallazgo C-03 de `docs/informes/REVERIFICACION-SEGURIDAD.md`). Una parte ya está cerrada: la transición `spec → plan` de la máquina de estados exige además el registro firmado. Pero la verificación se aplica solo a un llamador, y otros caminos llegan a etapas posteriores o dan por buena la aprobación sin comprobarla.

**Comportamiento actual, verificado en el código:**

*Lo que ya funciona (no hay que rehacerlo):*
- `core/state-machine.js:62-68`: la guarda de `spec → plan` sigue comprobando solo el booleano (`:65`, `if (!e.spec_aprobado)`). Pero `advance` añade, sin `force`, la verificación firmada y es obligatoria: sin `opciones.verificarSpec` la transición falla cerrada (`:148-154`, mensaje «spec → plan exige comprobar el registro firmado…»).
- `cli/runner.js:235` aporta `verificarSpec` con `idm.verificarAprobacionDeSpec(cwd, estado)` en `forge step`; `:244` llama a `fsm.advance`. `--force` exige motivo de 10 caracteres o más y firma un evento (`core/state-machine.js:160-169`, `cli/runner.js:236-242`).
- `core/aprobaciones-identidad.js:261-273` (`verificarAprobacionDeSpec`) comprueba el registro firmado con el hash vigente de la spec. Los registros de `forge aprobar` exigen terminal y código de un solo uso (`:293-296`, `aprobarConIdentidad`).
- La documentación `REVERIFICACION-SEGURIDAD.md` (C-03: «`core/state-machine.js:65` exige solo `e.spec_aprobado === true`») describe un estado anterior a este cambio en ese punto.

*Lo que sigue abierto (el fallo existe hoy en estos caminos):*
1. **Otros llamadores del mismo núcleo.** Los únicos llamadores de `advance` son `cli/runner.js:244` y `core/engine-cli.js:199` (`tasks → code`, sin guarda de spec). No hay ninguno en `core/mcp/` ni `core/api/` (búsqueda de `advance`, `pipeline_step` y `spec_aprobado` sin resultados en esos directorios). Pero nada impide que un llamador futuro cumpla la guarda; el contrato solo se sostiene por convención y por la regla de fallar cerrado dentro de `advance`.
2. **Escritura directa.** `ProjectMemory.update()` y `setPipelineStep()` no comprueban aprobaciones (`core/project-memory.js:187-202`; admitido en `docs/api-reference.md:102`). `forceStep` salta todo (`core/state-machine.js:180-184`; usado en `cli/runner.js:307` para `reset`).
3. **El anfitrión escribe el estado sin pasar por el motor.** `commands/sdd.planificar.md:35`, `:414` y `:486` leen y añaden a `.sdd/estado.json` con comandos de shell. Es el camino de los comandos `/sdd.*` en los agentes anfitriones.
4. **El guardián no protege `.sdd/estado.json`.** `esRutaCriticaDelGuardian` solo cubre `.sdd/execution-level.json` y `.sdd/aprobaciones.jsonl` (`core/evidencia/guardian-reglas.js:153-173`, línea 170). Un agente puede editar el booleano y `pipeline_step`. [NV] el estado actual del guardián en cada anfitrión (en Gemini, Codex y Windsurf falla abierto, plan §3.9).
5. **El ciclo no verifica la aprobación al ejecutarse.** `prepararCiclo` solo comprueba que la etapa sea `code` o que se pueda avanzar de `tasks` (`core/engine-cli.js:163-166`, con `--force`). Con `pipeline_step: "code"` escrito a mano, `fragua run` no mira el registro firmado.
6. **La evidencia copia el booleano.** `core/evidencia/cadena.js:102` registra `aprobada` desde `estado.spec_aprobado`; su propio comentario dice «no prueba que sea el aprobado. El aprobador no existe: se declara» (`:84`) y el informe de `verificar` declara `aprobador: null` y «el proyecto no registra quién aprueba la spec» (`:486`, `:502`).
7. **La clave HMAC la lee el mismo usuario del sistema.** `core/aprobaciones-identidad.js:19-29` lo reconoce: un proceso con los permisos de la persona puede leer la clave (`core/estado-usuario.js:161-186`, archivo `clave` de 32 bytes con modo 0600) y fabricar registros, o abrir un seudoterminal y teclear el código. El plan lo registra como «firma local, no verificable por terceros» (§3.8, `docs/limitations.md`, fila «`fragua aprobar` comparte usuario del sistema», que ya existe).

## 2. Objetivo

Que ninguna etapa posterior a la especificación se alcance, ni ninguna evidencia afirme una aprobación, sin que se haya comprobado el registro firmado y vigente de la spec; y que la documentación diga sin adornos hasta dónde llega esa garantía mientras la clave sea local.

## 3. Usuarios y Actores

| Actor | Rol | Necesidad principal |
|---|---|---|
| Dueño del proyecto | Aprueba la spec con `forge aprobar` | Que su aprobación sea la única vía para avanzar |
| Agente (anfitrión o motor) | Ejecuta las fases | No poder avanzar ni declararse aprobado por su cuenta |
| Quien lee la evidencia | Revisor, cliente | Saber si la aprobación consta de forma verificable y cuán fuerte es |
| Mantenedor | Añade llamadores o herramientas | Que la verificación no dependa de recordar llamarla |

## 4. Historias de Usuario

### HU-001: Un solo punto que decide, sin rutas laterales
**Como** mantenedor
**Quiero** que toda transición que exige la spec aprobada use la misma verificación firmada
**Para** que añadir un llamador no abra una vía sin comprobar

**Criterios de aceptación:**
- [ ] **CA-001-01**: Una prueba recorre todos los llamadores de `advance` del repositorio (`cli/runner.js`, `core/engine-cli.js` y los que aparezcan en `core/mcp/` y `core/api/`) y falla si alguno puede llevar de `spec` a `plan` sin `verificarSpec`. (P1)
- [ ] **CA-001-02**: Con `estado.json` editado a mano (`spec_aprobado: true`, sin registro en `aprobaciones.jsonl`), ningún llamador avanza de `spec` a `plan`: todos salen con código distinto de 0 y mensaje claro (caso existente de `forge step`, ampliado a los demás). (P1)
- [ ] **CA-001-03**: `setPipelineStep` y `forceStep` no pueden situar el pipeline en `plan` o posterior desde `spec` sin la verificación, o su uso queda limitado a `reset` hacia `idea` con una prueba que lo demuestra. (P1)

### HU-002: El ciclo verificado no arranca con una aprobación sin comprobar
**Como** persona que ejecuta `fragua run`
**Quiero** que el motor compruebe el registro firmado de la spec antes de gastar nada
**Para** que escribir `pipeline_step: "code"` a mano no salte la aprobación

**Criterios de aceptación:**
- [ ] **CA-002-01**: `fragua run` (modo `ciclo` y `clasico`) con `pipeline_step: "code"` escrito a mano y sin registro firmado vigente sale con código distinto de 0 antes de llamar a Docker o a un modelo. (P1)
- [ ] **CA-002-02**: `--force` conserva su efecto actual sobre la etapa, deja el evento firmado con motivo y no omite en silencio la comprobación de la spec: el informe dice «aprobación de spec no verificada, forzado». (P1)
- [ ] **CA-002-03**: Si el registro de aprobaciones no es íntegro o no se puede verificar (clave ausente, firma que no vale, spec cambiada tras aprobarse), el motor se detiene con el motivo de `verificarAprobacionDeSpec`. (P1)

### HU-003: La evidencia dice lo que se verificó
**Como** quien lee un informe de evidencia
**Quiero** que diga si la aprobación de la spec se comprobó contra el registro firmado y con qué garantía
**Para** no tomar un booleano por una aprobación

**Criterios de aceptación:**
- [ ] **CA-003-01**: El bloque de la spec en la evidencia distingue tres estados: `verificada` (registro firmado vigente con el hash actual), `declarada` (solo el booleano de `estado.json`) y `sin_dato`. El booleano solo ya no se presenta como `aprobada: true` sin más (`cadena.js:102`). (P1)
- [ ] **CA-003-02**: Una prueba falla si la evidencia marca `verificada` sin registro firmado vigente. (P1)
- [ ] **CA-003-03**: Cuando la verificación se hizo, la evidencia incluye quién aprobó (la identidad registrada en `aprobaciones.jsonl`) y la fecha, en vez de `aprobador: null` (`cadena.js:502`). (P2)
- [ ] **CA-003-04**: La evidencia imprime «firma local, no verificable por terceros» mientras la clave sea HMAC local. (P1)

### HU-004: Los comandos del anfitrión no saltan la puerta
**Como** persona que usa los comandos `/sdd.*` dentro de un agente
**Quiero** que escribir el estado desde el anfitrión no pueda conceder la aprobación
**Para** que el camino sin motor tenga la misma puerta que el del motor, o diga que no la tiene

**Criterios de aceptación:**
- [ ] **CA-004-01**: El guardián trata `.sdd/estado.json` de forma que un agente no pueda marcar `spec_aprobado` ni `pipeline_step` (por ejemplo, bloqueando la escritura directa y dejando solo la vía del motor), o la decisión de no hacerlo queda registrada con su motivo (es una pregunta abierta: ver §11). (P1)
- [ ] **CA-004-02**: Los comandos `/sdd.*` que escriben `.sdd/estado.json` (`commands/sdd.planificar.md:414` y `:486` al menos) no lo hacen para `spec_aprobado` ni para avanzar de `spec` a `plan`; usan `forge step`. (P2)
- [ ] **CA-004-03**: En el modo agente anfitrión, el informe no emite «aprobado» ni un nivel superior a G0 sin que `fragua verificar` lo confirme fuera del anfitrión (plan §3.9). (P2)

### HU-005: La documentación dice el límite de la clave
**Como** persona que decide cuánto fiarse de la aprobación
**Quiero** una sola frase honesta sobre quién puede fabricar un registro
**Para** no creer que hay separación criptográfica entre «la persona» y «el agente»

**Criterios de aceptación:**
- [ ] **CA-005-01**: `docs/GARANTIAS-Y-LIMITES.md` y `docs/limitations.md` declaran que la clave HMAC es un archivo legible por el mismo usuario del sistema operativo; que un agente con esos permisos podría fabricar registros o teclear el código desde un seudoterminal; y que el cierre real exige llavero del SO o firma asimétrica (decisión futura). `docs/limitations.md` ya tiene una fila sobre esto («no hay separación criptográfica total»); falta decir que la clave es legible, el seudoterminal y el cierre posible, y llevarlo a `GARANTIAS-Y-LIMITES.md` [NV: no se leyó ese archivo]. (P1)
- [ ] **CA-005-02**: Una prueba de consistencia falla si el texto del límite desaparece de esos documentos. (P2)

## 5. Escenarios de Uso

### Escenario 1: Caso feliz
**Dado** una spec aprobada con `forge aprobar spec` en una terminal
**Cuando** se ejecuta `forge step plan`
**Entonces** avanza; la evidencia posterior marca la aprobación como `verificada` con quién y cuándo.

### Escenario 2: Caso de error
**Dado** un `estado.json` con `spec_aprobado: true` y sin registro
**Cuando** se ejecuta `forge step plan`, `fragua run` o cualquier llamador de `advance`
**Entonces** ninguno avanza, todos explican «la spec no tiene una aprobación registrada y vigente» y cómo aprobarla.

### Escenario 3: Caso borde
**Dado** una spec aprobada que se modifica después
**Cuando** se intenta avanzar o ejecutar
**Entonces** el hash no coincide y hay que aprobarla de nuevo (comportamiento actual de `verificarAprobacionDeSpec`, que no cambia).

## 6. Requisitos Funcionales

- **RF-001**: El sistema DEBE comprobar el registro firmado y vigente de la spec en toda transición `spec → plan` y antes de ejecutar el ciclo.
- **RF-002**: El sistema DEBE distinguir en la evidencia entre aprobación `verificada`, `declarada` y `sin_dato`.
- **RF-003**: El sistema DEBE fallar cerrado si el registro no se puede verificar.
- **RF-004**: El sistema DEBE declarar el límite de la clave local en la documentación y en la evidencia.
- **RF-005**: El sistema NO DEBE aceptar el booleano de `estado.json` como única prueba de aprobación.
- **RF-006**: El sistema NO DEBE prometer protección frente a un proceso con el mismo usuario del sistema operativo que la persona.

## 7. Requisitos No Funcionales

| Categoría | Requisito | Métrica |
|---|---|---|
| Seguridad | Fallar cerrado si el registro es ilegible o inválido | Código de salida ≠ 0 en todos los llamadores |
| Honestidad (Principio XI) | La evidencia no afirma más de lo comprobado | Prueba que falla si `verificada` aparece sin registro |
| Compatibilidad | `forge step` y `forge aprobar` no cambian de uso | Pruebas existentes (`tests/state-machine-aprobacion.test.js`, `tests/aprobaciones-identidad.test.js`) siguen en verde |

## 8. Fuera de Alcance (Exclusiones Explícitas)

- ❌ Guardar la clave fuera del alcance del agente (llavero del SO o firma asimétrica SSH/GPG): decisión futura, fase 10 del plan, spec de equipos.
- ❌ Definir o prohibir la «aprobación por delegación» (spec `gobierno-delegacion`, decisión 2 del dueño).
- ❌ Verificación de aprobaciones por terceros (nivel G3).
- ❌ Detectar el truncado de las últimas líneas de `aprobaciones.jsonl` (límite ya declarado en `aprobaciones-identidad.js`).

## 9. Dependencias y Asunciones

### Dependencias
- `2026-11-06-aprobaciones-con-identidad` (borrador): provee `verificarAprobacionDeSpec`, el registro y `forge aprobar`.
- `2026-11-27-nivel-de-garantia-en-evidencia` (por redactar): el campo de nivel para CA-003-03 y CA-004-03.

### Asunciones
- El MCP y la API no avanzan la etapa hoy. [NV] se buscó por texto (`advance`, `pipeline_step`, `spec_aprobado`) en `core/mcp/` y `core/api/` y no hubo resultados; no se leyeron las herramientas una a una.
- [NECESITA_ACLARACION]: si el servidor MCP o la API deben poder avanzar la etapa en el futuro; si es así, la prueba de CA-001-01 los cubre desde ya.

## 10. Términos del Dominio

- **Registro firmado**: línea de `.sdd/aprobaciones.jsonl` con identidad, hash de la spec y firma con la clave local.
- **Aprobación verificada / declarada**: comprobada contra ese registro / solo afirmada por el booleano de `estado.json`.

## 11. Preguntas Abiertas

- [ ] [POR_DECIDIR]: ¿se protege `.sdd/estado.json` en el guardián (bloqueo de escritura directa)? Hoy los comandos `/sdd.*` lo escriben a mano, por lo que habría que migrarlos primero (CA-004-02). Riesgo: romper el flujo del anfitrión.
- [ ] [POR_DECIDIR]: ¿`fragua run` debe verificar la aprobación siempre o solo cuando no viene de `forge step`? Se propone siempre.
- [ ] [POR_DECIDIR]: el registro de aprobaciones puede ser ilegible por pérdida de la clave (`core/aprobaciones-identidad.js:175`); ¿cómo se recupera sin permitir un salto?

## 12. Criterios de Éxito Medibles

- 100 % de los llamadores de `advance` y de las rutas que ponen `pipeline_step` en `plan` o posterior pasan por la verificación firmada (prueba por inspección + prueba de comportamiento).
- 0 evidencias que marquen una aprobación como `verificada` sin registro vigente.

## 13. Referencias

- `reports/Plan consolidado de modos y componentes Forja.md` (§3.4, §3.8, §3.9, §5 fase 2c, §8.1).
- `core/state-machine.js`, `cli/runner.js`, `core/aprobaciones-identidad.js`, `core/estado-usuario.js`, `core/project-memory.js`, `core/engine-cli.js`, `core/evidencia/cadena.js`, `core/evidencia/guardian-reglas.js`, `commands/sdd.planificar.md`.
- `docs/informes/REVERIFICACION-SEGURIDAD.md` (C-01, C-03, C-05), `docs/api-reference.md:102`.
- Constitución, Principios II, VI y XI. Spec `2026-11-06-aprobaciones-con-identidad`.

## 14. Historial de Aclaraciones

| # | Categoría | Pregunta | Decisión | Fecha |
|---|-----------|----------|----------|-------|
| – | – | Sin aclaraciones todavía | – | – |
