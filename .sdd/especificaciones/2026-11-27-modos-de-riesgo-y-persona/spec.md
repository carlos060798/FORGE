---
id: 2026-11-27-modos-de-riesgo-y-persona
titulo: "Modos de riesgo y persona: dos ejes que solo suben las exigencias sobre un suelo fijo del núcleo"
tamano: grande  # micro | pequeño | mediano | grande
estado: borrador  # borrador | en_revision | aprobada | en_implementacion | completada
creada: 2026-11-27
actualizada: 2026-11-27
autor: humano  # humano | importado — redactada por Claude a petición del dueño; la aprobación es del dueño
constitucion_version: 1.1.0
etiquetas: [modos, riesgo, persona, puertas, suelo, fase-4]
---

# Especificación: Modos de riesgo y persona

> **Estado: borrador, sin aprobar.** Fase 4 del «Plan consolidado de modos y componentes de Forja» (`reports/Plan consolidado de modos y componentes Forja.md`, §3 y §5). Decisión de diseño asociada: `ADR-28-modos-de-dos-ejes-que-solo-suben` (propuesta). Ningún agente marca esta spec como aprobada: el dueño la aprueba con `fragua aprobar spec`.
>
> Marcas: **[V-código]** comprobado en el código de este worktree el 2026-11-27; **[NV]** no verificado (umbral sin datos, comportamiento en ejecución no observado o cita traída de las notas del consejo sin reabrir).

## 1. Contexto y Motivación

Hoy Fragua no tiene «modos» como tal: tiene tres presets (`presets/lean.yaml`, `startup.yaml`, `enterprise.yaml`) que escriben claves en la configuración, y la mayoría de esas claves **no tiene lector**: `comportamiento.requerir_aprobacion_plan`, `calidad.cobertura_tests_minima` (el propio `presets/lean.yaml:63` dice «declarativa: nada la aplica»), `agentes.*.activo`, `sesion.modo` (solo la lee y escribe `cli/comandos/config.js:42-215`, nada la aplica) [V-código]. Un usuario que elige `lean` o `enterprise` cree que cambia las puertas y no cambia nada que se ejecute [NV en ejecución; `docs/agents.md` l.87 según las notas].

Al mismo tiempo, la seguridad que sí existe ya sigue un patrón de «solo apretar»: las puertas del proyecto solo añaden exigencias (`core/puertas/config.js:14-19`, `:35-44`), el proyecto solo puede bajar el tope de gasto (`core/ciclo/config.js:439-445`) y solo subir precios (`:383-384`) [V-código]. Falta un concepto de modo que (a) diga en lenguaje llano qué protege Fragua según lo que está en juego, (b) se aplique por código y (c) **no pueda usarse para saltarse puertas** (riesgo «bajar de modo para ir más rápido», plan §8.1, gravedad alta).

## 2. Objetivo

Que el nivel de exigencia de un proyecto lo fije un **modo de riesgo** declarado en el proyecto y resuelto por el motor sobre un **suelo fijo del núcleo**; que la **persona** del usuario cambie solo la guía y los comandos visibles; y que ninguna combinación de modo, persona, configuración o disparador produzca exigencias por debajo del suelo.

## 3. Usuarios y Actores

| Actor | Rol | Necesidad principal |
|---|---|---|
| Freelance o dev individual (persona `individual` / Esencial) | Construye herramientas y MVPs para sí o para clientes | Saber qué puertas aplican sin leer YAML, y no pagar proceso de más |
| Fundador técnico con usuarios reales | Lanza un MVP | Que Fragua suba sola las exigencias cuando aparecen datos, pagos o login |
| No técnico acompañado (persona `guiado` / Guiado) | Usa Fragua con alguien al lado | Preguntas llanas; «No sé» nunca le baja la protección |
| Dev experto (persona `experto` / Completo) | Quiere todos los comandos | Ver todo sin que eso afloje ninguna puerta |
| Dueño del proyecto | Aprueba | Que bajar de modo exija su firma y quede visible |
| Repositorio ajeno (actor hostil) | Trae un `.sdd/sdd.config.yaml` | No debe poder bajar exigencias ni activar nada desde el repo |

## 4. Historias de Usuario

### HU-001: Dos ejes separados
**Como** usuario
**Quiero** que el riesgo del proyecto y mi perfil personal sean cosas distintas
**Para** que elegir «ver menos comandos» nunca signifique «menos protección»

**Criterios de aceptación:**
- [ ] **CA-001-01**: El modo de riesgo se lee solo de `modo.riesgo` en `.sdd/sdd.config.yaml`; la persona se lee solo del estado del usuario (fuera del repo). Un `modo.persona` o `persona:` en el archivo del proyecto es **error** con código propio, no se ignora. (P1)
- [ ] **CA-001-02**: Para cada persona (`guiado`, `individual`, `experto`, `equipo`) y un mismo proyecto, las exigencias efectivas resueltas son idénticas campo a campo (prueba parametrizada: diferencia vacía). (P1)
- [ ] **CA-001-03**: `modo.riesgo` admite solo la lista cerrada `prototipo | personal | mvp | producto | plataforma`; cualquier otro valor, o una clave desconocida bajo `modo:`, sale con código distinto de 0 y un mensaje que nombra la clave y los valores válidos. (P1)
- [ ] **CA-001-04**: Sin `modo:` en el proyecto, el modo efectivo es `personal` (el recorrido actual) y las exigencias efectivas son iguales a las de hoy (prueba de caracterización: mismas puertas, mismo `motor.mutacion`, mismo tope). (P1)

### HU-002: Un modo solo puede subir sobre el suelo
**Como** dueño
**Quiero** una propiedad comprobada por código: ningún modo baja exigencias por debajo del suelo del núcleo
**Para** que el modo no sea un atajo para saltarse puertas

**Criterios de aceptación:**
- [ ] **CA-002-01**: **Propiedad del suelo.** Para toda combinación generada de `modo.riesgo` × disparadores × valores del proyecto × persona × entorno del usuario, `ExigenciasEfectivas ≥ SUELO_NÚCLEO` campo a campo (orden definido por campo: booleano exigido ≥ no exigido; `exigir` ≥ `informar` ≥ `no`; umbral mayor ≥ menor; tope de gasto menor ≥ mayor). La prueba de propiedad falla (código ≠ 0) si encuentra un contraejemplo. (P1)
- [ ] **CA-002-02**: **Monotonía.** Si el modo A es mayor o igual que B en el orden `prototipo < personal < mvp < producto < plataforma`, las exigencias de A son ≥ las de B campo a campo, con los mismos valores del proyecto. (P1)
- [ ] **CA-002-03**: **El proyecto solo sube.** Para cada campo, el valor efectivo es `max(mínimo_del_modo, valor_del_proyecto)` en el orden del campo; un valor del proyecto por debajo del mínimo se ignora con un aviso que nombra la clave, y nunca reduce la exigencia (prueba por campo). (P1)
- [ ] **CA-002-04**: El suelo del núcleo (`SUELO_NÚCLEO`) y la tabla de mínimos por modo son constantes congeladas del paquete: ninguna clave del proyecto ni variable de entorno puede modificarlos (prueba: mutar la configuración o el entorno no cambia la tabla; intentar escribirla lanza). (P1)
- [ ] **CA-002-05**: El resolver es puro: con las mismas entradas devuelve el mismo resultado, sin leer disco, red ni reloj (prueba: dos llamadas idénticas, sin acceso a `fs` permitido). (P2)

### HU-003: Los once mínimos no negociables
**Como** cualquier usuario, también en `prototipo`
**Quiero** un suelo que ningún modo quita
**Para** que el boceto más rápido siga siendo reversible, sin secretos y con tope de gasto

**Criterios de aceptación:**
- [ ] **CA-003-01**: Para cada mínimo M1–M11 de §6.2 existe una prueba roja que demuestra que, si falta su condición, la ejecución se detiene con su código propio (código ≠ 0 y distinto del de fallo de pruebas). Matriz modo × mínimo: un test que falla y otro que pasa por celda. (P1)
- [ ] **CA-003-02**: `not_evaluable` en un mínimo duro nunca cuenta como aprobado: el veredicto global no es 0. (P1)
- [ ] **CA-003-03**: En `mvp` y superiores, `not_evaluable` en la puerta `seguridad` es fallo (código ≠ 0). (P1)
- [ ] **CA-003-04**: En `prototipo`, todo informe y la plantilla inicial llevan la etiqueta «PROTOTIPO — no usar con datos reales» (M11); su ausencia hace fallar la prueba de esquema. (P1)

### HU-004: Disparadores de riesgo que solo suben
**Como** fundador que añade pagos a su herramienta
**Quiero** que Fragua lo detecte y me pida subir de modo
**Para** no lanzar con usuarios reales protegido como un script personal

**Criterios de aceptación:**
- [ ] **CA-004-01**: `modo.datos` admite la lista cerrada `personales | pagos | auth | borrado | publico | mensajeria`; un valor fuera de lista es error. (P1)
- [ ] **CA-004-02**: Si hay un disparador (declarado, respuesta del selector o detector) de `personales`, `pagos`, `auth` o `publico` y `modo.riesgo` < `mvp`, el motor sale **con código propio** (distinto de 0/1/3/4 [NV: código a asignar]) antes de llamar a ningún modelo, y el mensaje dice qué disparador y qué hacer (declarar o subir). (P1)
- [ ] **CA-004-03**: Los disparadores nunca bajan nada: añadir o quitar un disparador detectado no reduce ningún campo de las exigencias efectivas (prueba de propiedad). (P1)
- [ ] **CA-004-04**: Los detectores son deterministas (sin modelo): con el mismo árbol de archivos dan el mismo resultado; un LLM no participa en decidir el riesgo (Principio VI). (P1)
- [ ] **CA-004-05**: Se publica la tasa de detección (aciertos y falsos negativos) sobre un corpus versionado en el repo; la prueba falla si el corpus o la tasa publicada faltan. (P2)
- [ ] **CA-004-06**: En el selector, «No sé» se trata como «Sí» (prueba: respuesta «No sé» a «¿guarda datos de personas?» ⇒ disparador `personales`). (P1)

### HU-005: Bajar de modo solo con firma
**Como** dueño
**Quiero** que bajar de modo requiera mi aprobación firmada en terminal
**Para** que ni un agente ni un repo ajeno lo hagan por mí

**Criterios de aceptación:**
- [ ] **CA-005-01**: Si `modo.riesgo` en el proyecto es menor que el último modo registrado y no existe una aprobación firmada de bajada (`fragua aprobar modo <nuevo> --motivo ...`) que coincida con ese cambio, el motor sale con código propio y no avanza. (P1)
- [ ] **CA-005-02**: `fragua aprobar modo` exige TTY y motivo; sin TTY sale con código ≠ 0 y no registra nada (mismo mecanismo que `fragua aprobar spec`, `core/aprobaciones-identidad.js`). (P1)
- [ ] **CA-005-03**: Ninguna aprobación permite bajar por debajo del mínimo que imponen los disparadores activos: el comando sale con código ≠ 0 y lo explica. (P1)
- [ ] **CA-005-04**: Toda evidencia e informe posterior a una bajada lista «modo rebajado: de X a Y, motivo, fecha» (prueba de esquema). (P1)
- [ ] **CA-005-05**: Subir de modo no requiere aprobación (código 0). (P1)

### HU-006: Graduación guiada
**Como** usuario que empezó con un boceto
**Quiero** saber qué me falta para el siguiente modo
**Para** graduar sin sorpresas

**Criterios de aceptación:**
- [ ] **CA-006-01**: `fragua doctor` (o el comando que se decida) lista, para el modo siguiente, las puertas pendientes con su estado (`existe` / `falta`), con salida 0 aunque falten (es informativo). (P2)
- [ ] **CA-006-02**: Pasar de `prototipo` a `personal` no promueve código del boceto sin pasar por el ciclo: el checklist «el boceto se queda» aparece y el estado no marca la spec como aprobada. (P2)
- [ ] **CA-006-03**: `producto` y `plataforma` se aceptan en el resolver, pero `init`, `doctor` y cada informe dicen «modo no soportado: puertas parciales» (prueba de texto en la evidencia). (P1)

### HU-007: Claves sin lector
**Como** usuario
**Quiero** que toda clave que me dejen en la configuración haga algo, o diga que no hace nada
**Para** no creer que estoy protegido cuando no lo estoy

**Criterios de aceptación:**
- [ ] **CA-007-01**: Toda clave escrita por una plantilla de modo (`presets/*.yaml` o su sucesor) tiene un lector en el código o lleva el comentario `# declarativa`; la prueba recorre las plantillas y falla si encuentra una clave sin ninguna de las dos cosas. (P1)
- [ ] **CA-007-02**: Las claves `sesion.modo`, `comportamiento.*`, `calidad.*`, `perfil` y `agentes.*.activo` quedan, cada una, cableadas a `core/modos/` o borradas de las plantillas (decisión por clave en §11). (P1)

### HU-008: Piso de nivel de modelo por rol
**Como** dueño de un MVP
**Quiero** que la degradación por gasto nunca baje al rol de pruebas por debajo de un nivel mínimo
**Para** que ahorrar no convierta las pruebas en decorado

**Criterios de aceptación:**
- [ ] **CA-008-01**: En `mvp` y superiores, si la degradación (`presupuesto.umbral_degradacion_usd`) llevaría el rol `qa` por debajo del piso del modo, el motor se detiene con código propio y pide decisión; no degrada en silencio. (P1)
- [ ] **CA-008-02**: `motor.nivel_maximo` (`core/ciclo/config.js:36`) por debajo del piso del modo para un rol obligado es error de configuración con código ≠ 0. (P1)

### HU-009: Elegir modo y persona en `init`
**Como** usuario nuevo
**Quiero** `init --modo <riesgo> --persona <x>` y un selector de seis preguntas
**Para** empezar con el modo correcto sin leer documentación

**Criterios de aceptación:**
- [ ] **CA-009-01**: `init --modo personal` escribe `modo.riesgo: personal` en `.sdd/sdd.config.yaml`; `--persona experto` escribe la persona en el estado del usuario, no en el repo. (P1)
- [ ] **CA-009-02**: `--preset lean|startup|enterprise` y `--perfil esencial|completo` siguen funcionando una versión MENOR como alias (`lean`→`personal`, `startup`→`mvp`, `enterprise`→`producto`; `esencial`→`individual`, `completo`→`experto`) con aviso de obsolescencia (Principio X). (P1)
- [ ] **CA-009-03**: `init --modo prototipo` falla con código ≠ 0 mientras los detectores de HU-004 no existan (oferta: «desde la fase 3/4»). (P1)
- [ ] **CA-009-04**: El selector responde el modo recomendado y el porqué en una frase; funciona en Windows leyendo la entrada estándar real (depende de la spec `asistente-guiado-multiplataforma`; hoy `cli/comandos/instalar.js:899` usa `/dev/stdin` [V-código por C2; fallo en ejecución NV]). (P2)

## 5. Escenarios de Uso

### Escenario 1: Caso feliz
**Dado** un proyecto con `modo.riesgo: personal` y sin disparadores
**Cuando** el usuario ejecuta `fragua run`
**Entonces** las puertas efectivas son las de hoy y la evidencia dice «modo: personal / Herramienta personal; persona: individual».

### Escenario 2: Disparador sin declarar
**Dado** `modo.riesgo: personal` y un `package.json` que añade `stripe`
**Cuando** el usuario ejecuta `fragua run`
**Entonces** el motor sale con el código de «riesgo no declarado» antes de llamar a un modelo y propone `modo.riesgo: mvp` con la lista «faltan X, Y, Z».

### Escenario 3: Repo hostil intenta bajar
**Dado** un repo clonado cuyo `sdd.config.yaml` pone `modo.riesgo: prototipo` y `motor.mutacion: no` tras haber estado en `mvp`
**Cuando** se ejecuta el ciclo
**Entonces** sale con el código de «bajada sin aprobar»; y aunque hubiera aprobación, `motor.mutacion` efectivo es `max(mínimo_del_modo, no)`.

### Escenario 4: Persona no afloja
**Dado** persona `guiado` con 9 comandos visibles y persona `experto` con 39
**Cuando** ambos resuelven el mismo proyecto
**Entonces** obtienen exactamente las mismas exigencias.

## 6. Requisitos Funcionales

### 6.1 Los dos ejes

**Eje A, riesgo** (proyecto, `modo.riesgo`, lista cerrada; fija puertas):

| Valor | es | en | Para qué | ISO/IEC 29110 | Oferta |
|---|---|---|---|---|---|
| `prototipo` | Boceto | Sketch | Probar una idea desechable, sin datos reales | – | **Sí**, cuando existan los detectores (HU-004) |
| `personal` | Herramienta personal | Personal tool | Lo usa una persona: scripts, utilidades, web propia | Entry | **Sí** (recorrido actual, por defecto) |
| `mvp` | MVP serio | Real MVP | Usuarios reales, primeros clientes, 1-3 personas | Basic | **Sí, parcial** hasta las puertas de seguridad (fase 6) |
| `producto` | Producto en marcha | Running product | Operación continua, datos personales o pagos | Intermediate (parcial) | No soportado aún |
| `plataforma` | Plataforma | Platform | Varios equipos o proyectos, terceros | Intermediate/Advanced | No soportado aún |

Fuera de alcance, y Forja lo dice: software crítico para la vida o la seguridad física, dispositivos médicos, finanzas reguladas, cumplimiento formal (SOC2, HIPAA, AI Act).

**Eje B, persona** (estado del usuario, fuera del repo; fija guía y comandos visibles, **nunca** baja puertas):

| Valor | es | en | Quién | Instalación | Estado |
|---|---|---|---|---|---|
| `guiado` | Guiado | Guided | No técnico acompañado, aprendiz | `esencial` + `/forge`, `explicame`, `descubrir-idea` | Experimental (acompañado) |
| `individual` | Esencial | Essentials | Freelance, dev individual, fundador técnico | `esencial` (6 comandos, `core/instalacion/perfiles.js:15-19` [V-código]) | Real |
| `experto` | Completo | Full | Dev experto | `completo` (todos, `perfiles.js:20`) | Real como instalación |
| `equipo` | Equipo | Team | 2-5 personas | `completo` + aprobadores y CI | No existe (spec `2026-11-10-equipos-y-ciclo-en-ci`, borrador) |

- **RF-001**: El sistema DEBE resolver las exigencias con la precedencia `SUELO_NÚCLEO` < `mínimos(modo.riesgo ∪ disparadores)` < `valores del proyecto (solo suben)`. El entorno del usuario solo sube topes o techos, como hoy (`core/ciclo/config.js:433-445`, `core/puertas/config.js:168-181` [V-código]).
- **RF-002**: La persona NO DEBE entrar en el cálculo de exigencias; solo en la lista de comandos, skills y agentes instalados (ampliación de `core/instalacion/perfiles.js`, que hoy solo filtra comandos, `perfiles.js:39-42` [V-código]).
- **RF-003**: Los lectores actuales (`leerConfigCiclo`, `core/ciclo/config.js:366`; `leerPuertas`, `core/puertas/config.js:199`) DEBEN recibir las exigencias efectivas y aplicar `max(suelo_modo, valor_proyecto)`.
- **RF-004**: La clasificación de tamaño hecha por el modelo (micro/pequeño...) NO DEBE decidir ninguna exigencia; si se conserva, es informativa.

### 6.2 Mínimos no negociables (todos los modos, también `prototipo`)

| # | Mínimo | Existe hoy | Hay que construir |
|---|---|---|---|
| M1 | Git desde el primer cambio y checkpoint antes de cada escritura del agente | `core/ciclo/checkpoint-archivos.js` | Exigirlo en todas las rutas, también en modo anfitrión |
| M2 | Nada destructivo sin reversibilidad (nada fuera de la raíz, sin `push --force`, sin `DROP` sin copia, sin producción) | `core/evidencia/guardian-reglas.js`, `core/ciclo/respaldo.js` | Cerrar C-07 y rodeos [NV estado actual] |
| M3 | Ningún secreto en el repo ni en la salida al modelo; escaneo antes del commit | Redacción parcial `core/ciclo/redactar.js` | Componente `seguridad`; sin binario = `not_evaluable` en rojo. Límite: base64, hex y secretos partidos no se detectan |
| M4 | El código generado no corre en el anfitrión sin decirlo | `core/sandbox/politica.js:167` [NV línea] | Quitar la caída a Node: `core/runners/index.js:31-32` (`default: return createNodeRunner(cwd)`) [V-código] |
| M5 | Veredicto por código de salida de pruebas reales, rojo antes que verde | `core/ciclo/nodos.js:448-533` [NV línea] | Detectar o marcar puertas triviales (`node -e "process.exit(0)"`) |
| M6 | Tope de gasto con parada dura en todo uso de modelo | `core/ciclo/presupuesto.js`; tope 2 USD `core/ciclo/config.js:20` | `SessionBudget` solo avisa (`core/session-budget.js:166`, «Esto es una alerta, no el tope») [V-código]; `--motor clasico` sin parada dura |
| M7 | Nivel de garantía en toda evidencia | `core/evidencia/cadena.js` (sin el campo, `:516-531` [V-código]) | Spec `2026-11-27-nivel-de-garantia-en-evidencia` |
| M8 | Aprobación humana registrada para lo que sale del equipo | `core/integraciones/aprobacion.js` [NV] | Aplicarla a `github-connect.sh` y a todo componente |
| M9 | Datos reales, credenciales, pagos o exposición pública ⇒ el modo sube | No existe | Disparadores en `core/modos/` (HU-004) |
| M10 | Dependencias nuevas registradas (lista y licencia) | Solo prompt (ADR) | Detector determinista de cambios en manifiestos |
| M11 | Etiqueta «PROTOTIPO — no usar con datos reales» en `prototipo` | No existe | Plantilla y campo en la evidencia |

- **RF-005**: `not_evaluable` en un mínimo duro NO DEBE contar como aprobado.

### 6.3 Puertas por modo

| Exigencia | prototipo | personal | mvp | producto* | plataforma* | Hoy |
|---|---|---|---|---|---|---|
| Spec aprobada antes de planificar | 1 frase + criterio de descarte | mini-spec, 3-5 criterios | spec + plan + tareas | + PRD, ADR | contratos versionados | **Sí**: guarda `core/state-machine.js:65` (booleano) + verificación firmada en `forge step` (`cli/runner.js:234-235`) [V-código] |
| Pruebas en rojo antes de implementar | ≥1 automatizada | sí | por criterio + integración en rutas críticas | pirámide | contratos y carga | **Sí** en el ciclo [NV línea] |
| Pruebas escritas por otro rol | si hay subagentes | sí | **obligatorio** | obligatorio | obligatorio | **Sí** en el ciclo (`core/ciclo/protocolo-archivos.js`) |
| Ejecución aislada sin red | sí (o directo = G1) | sí (o directo = G1) | **obligatorio** | sí | sí | **Sí** (sandbox) |
| Tope de gasto con parada dura | sí | sí | sí | sí | sí | **Parcial** (M6) |
| Mutación | `no` | `informar` | `exigir` (umbral [NV]) | `exigir` | `exigir` | **Sí**: `motor.mutacion`, `mutacion_minima` (`core/ciclo/config.js:43-44`, validación `:419-426`) [V-código] |
| `tipos` / `linter` | – | si el proyecto los declara | obligatoria si hay herramienta | obligatoria | obligatoria | **Parcial**: puertas en `core/puertas/config.js:35`; «obligatoria por modo» por construir |
| `seguridad` | secretos | secretos | secretos + SCA | + SAST | + SBOM | **Solo declarativa** (componente opcional) |
| `cobertura` | – | – | informar | umbral [NV] | umbral [NV] | **Parcial**: la clave existe; `calidad.cobertura_tests_minima` es declarativa (`presets/lean.yaml:63`) [V-código] |
| Trazabilidad criterio→prueba | – | informar | exigir | exigir | exigir | **Parcial**: `core/evidencia/criterios.js` |
| Revisión independiente | – | checklist | IA local, consultiva | humana obligatoria | humana + CODEOWNERS | **No existe** (componente) |
| Evidencia `--registrar` | – | opcional | sí | sí | sí | **Sí** (`core/evidencia/cadena.js:541`) |
| ADR para dependencias nuevas | – | sí | sí | sí | sí | **Solo prompt** → detector |
| Plan aprobado | – | – | sí | + analizar | + analizar | **Solo prompt** (`requerir_aprobacion_plan` sin lector, `presets/lean.yaml:58`) [V-código] |
| Piso de nivel de modelo por rol | – | – | `qa` ≥ `medio` [NV] | igual | igual | **No existe** (HU-008) |
| Checklist de RNF ISO/IEC 25010:2023 | – | 1 página aplica/no aplica | sí | medido | medido | **No existe** |
| Rollback, BD dev ≠ prod | – | copia de datos | rollback documentado, dev≠prod | runbook | DR | **No existe** |

\* No soportado aún: el resolver lo acepta; `init`/`doctor`/evidencia dicen «modo no soportado: puertas parciales».

- **RF-006**: Cada celda «sí/exigir/obligatorio» de una fila marcada «Sí» DEBE aplicarse por código en la fase 4; las celdas de filas «No existe» o «Solo prompt» DEBEN aparecer como `falta` en la graduación (HU-006) y en la evidencia, nunca como cumplidas.

### 6.4 Disparadores, graduación y bajada

- **RF-007**: Fuentes de disparador: (a) `modo.datos` declarado; (b) respuestas del selector («No sé» = Sí); (c) detectores deterministas: dependencias de pago o auth en manifiestos, variables `*_KEY`/`STRIPE`/`DATABASE_URL`, migraciones con `DROP`, archivos de despliegue. Mínimos: datos personales, pagos, auth o público ⇒ `mvp`; más de un contribuidor o API consumida por terceros ⇒ `producto` (no soportado: se dice).
- **RF-008**: Graduación: `prototipo → personal` con checklist «el boceto se queda» (reescribir con mini-spec y pruebas); `personal → mvp` propuesta por disparador o selector con la lista de puertas pendientes; `mvp → producto` requiere equipo y CI, hasta entonces «Forja no cubre aún este nivel».
- **RF-009**: Subir es libre. Bajar exige `fragua aprobar modo` en TTY con motivo, registrado en el mismo registro firmado que las aprobaciones de spec, visible en todo informe, y nunca por debajo del mínimo de los disparadores activos.
- **RF-010**: El sistema NO DEBE leer ninguna aprobación de bajada desde un archivo del repositorio; solo del registro del usuario.

### 6.5 Plantillas y claves

- **RF-011**: Los presets pasan a ser plantillas que escriben `modo.riesgo` (`lean`→`personal`, `startup`→`mvp`, `enterprise`→`producto`); `enterprise.yaml` deja de mencionar SOC2/HIPAA/GDPR.
- **RF-012**: Claves sin lector hoy [V-código salvo indicación]: `comportamiento.*` (`presets/lean.yaml:54-60`), `calidad.*` (`:62-67`), `agentes.*.activo` y `agentes.*.modelo` (`:18-52`; efecto en ejecución [NV]), `sesion.modo` (solo `cli/comandos/config.js`), `perfil` (ídem). Cada una se cablea a `core/modos/` o se borra (ver §11).

## 7. Requisitos No Funcionales

| Categoría | Requisito | Métrica |
|---|---|---|
| Seguridad | El archivo del proyecto nunca baja exigencias | Prueba de propiedad CA-002-01 sin contraejemplos en ≥1000 casos generados [NV: número] |
| Compatibilidad | Sin `modo:`, comportamiento idéntico al actual | Suite actual en verde sin cambios; caracterización CA-001-04 |
| Determinismo | Resolver puro | CA-002-05 |
| Calidad de pruebas | Mutación sobre `core/modos/` | `exigir`, umbral [NV] |
| Honestidad | Celdas no construidas visibles | 0 celdas «No existe» reportadas como cumplidas |

## 8. Fuera de Alcance (Exclusiones Explícitas)

- ❌ Soportar de verdad `producto` y `plataforma` (spec de equipos, fase 10).
- ❌ Construir los componentes `seguridad`, revisión IA o `guardian-git` (specs propias, fases 5-6).
- ❌ El nivel de garantía G0-G3 (spec hermana `2026-11-27-nivel-de-garantia-en-evidencia`).
- ❌ Fijar umbrales numéricos definitivos (mutación, cobertura, piso de modelo): se calibran tras los pilotos.
- ❌ Software crítico, regulado o de cumplimiento formal.

## 9. Dependencias y Asunciones

### Dependencias
- ADR-28 (propuesta) aceptado por el dueño.
- Fase 2 del plan: `runner-falla-cerrado` (M4), `tope-duro-comun` (M6), `aprobacion-verificable-en-todos-los-caminos`.
- `asistente-guiado-multiplataforma` para el selector (CA-009-04).
- Spec `2026-11-27-nivel-de-garantia-en-evidencia` para M7.

### Asunciones
- El registro de aprobaciones de `core/aprobaciones-identidad.js` puede registrar un tipo nuevo «modo» [NV].
- [NECESITA_ACLARACION]: códigos de salida concretos para «riesgo no declarado», «bajada sin aprobar» y «piso de modelo»; hoy se usan 0/1/3/4 en `fragua run` [NV la lista completa].

## 10. Términos del Dominio

- **Suelo del núcleo (`SUELO_NÚCLEO`)**: exigencias mínimas congeladas en el paquete; ningún modo ni archivo las baja.
- **Modo de riesgo**: nivel de lo que está en juego en el proyecto; fija puertas.
- **Persona**: perfil del usuario; fija guía y comandos visibles.
- **Disparador**: señal determinista de riesgo que solo sube el mínimo.
- **Exigencias efectivas**: resultado del resolver, que consumen los lectores.

## 11. Preguntas Abiertas

- [ ] [POR_DECIDIR]: ¿`personal` como modo por defecto sin `modo:`, o exigir declararlo en `init` y fallar si falta?
- [ ] [POR_DECIDIR]: Por clave sin lector, ¿cablear o borrar? Propuesta: borrar `comportamiento.deteccion_tamano_automatica`, `numeracion_especificaciones`, `calidad.permitir_*`, `longitud_*`; cablear `requerir_aprobacion_plan` como mínimo del modo (no como clave del proyecto); `sesion.modo` y `perfil` → reemplazados por la persona en el estado del usuario.
- [ ] [POR_DECIDIR]: Umbrales [NV]: `mutacion_minima` por modo (0,5/0,6/0,7 propuestos), cobertura en `producto`, piso `qa ≥ medio`.
- [ ] [NECESITA_ACLARACION]: ¿La bajada aprobada caduca (p. ej., en N días) o es permanente hasta la siguiente subida?
- [ ] [NECESITA_ACLARACION]: ¿Se ofrece `prototipo` en esta misma fase (decisión 9 del plan: «solo cuando existan los detectores») o se separa en una spec posterior?
- [ ] [POR_DECIDIR]: Nombre en inglés definitivo de la persona `individual` («Essentials») frente a su clave.

## 12. Criterios de Éxito Medibles

- 100 % de celdas de la matriz modo × mínimo con un test que falla y otro que pasa.
- 0 contraejemplos en la prueba de propiedad del suelo.
- 0 claves de plantilla sin lector ni `# declarativa`.
- Tasa de detección de disparadores publicada sobre el corpus (sin umbral de aprobación hasta los pilotos).

## 13. Referencias

- `reports/Plan consolidado de modos y componentes Forja.md` §3, §5 (fase 4), §6-8.
- `research_notes/Consejo plan consolidado Forja/` C1_arquitectura, C2_producto_personas, C3_riesgo_calidad, R1, R2, L2_motor_modos.
- `.sdd/arquitectura/ADR-28-modos-de-dos-ejes-que-solo-suben.md` (propuesta).
- ISO/IEC 29110 (perfiles Entry/Basic/Intermediate), ISO/IEC 25010:2023.

## 14. Historial de Aclaraciones

| # | Categoría | Pregunta | Decisión | Fecha |
|---|---|---|---|---|
