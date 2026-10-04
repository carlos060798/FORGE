---
id: 2026-10-03-ciclo-verificado
titulo: "Ciclo Verificado"
tamano: grande  # micro | pequeño | mediano | grande
estado: en_implementacion  # borrador | en_revision | aprobada | en_implementacion | completada
creada: 2026-10-03
actualizada: 2026-10-03
autor: humano  # humano | importado
constitucion_version: 1.0.0
etiquetas: [motor, aislamiento, presupuesto, reanudacion]
---

# Especificación: Ciclo Verificado

## 1. Contexto y Motivación

Hoy, cuando FORGE construye una tarea sin supervisión, la ejecuta una sola vez: si las pruebas fallan, la tarea queda marcada como fallida y alguien tiene que intervenir. Además, el código que produce el modelo se ejecuta directamente en el equipo del usuario, sin separación alguna. Quien deja FORGE trabajando solo no tiene garantía de que el resultado funcione, de que su equipo esté protegido ni de cuánto va a gastar. Esta especificación cubre esas tres garantías.

## 2. Objetivo

Cuando FORGE construya una tarea de forma autónoma, DEBE corregir su propio trabajo hasta que las pruebas pasen, ejecutando todo el código generado en un entorno aislado, sin superar un tope de gasto ni un número máximo de intentos, y pidiendo la decisión de una persona cuando no pueda terminar solo. El trabajo interrumpido DEBE poder reanudarse sin repetir lo ya hecho.

## 3. Usuarios y Actores

| Actor | Rol | Necesidad principal |
|-------|-----|---------------------|
| Dueño del proyecto | Aprueba la especificación y decide en las revisiones | Saber que el resultado pasa las pruebas, cuánto costó y que su equipo no corrió riesgo |
| Operador | Lanza y reanuda la construcción desde la terminal | Lanzar, consultar el avance y retomar tras un corte sin perder trabajo |
| Agente planificador | Descompone la tarea en pasos | Recibir la tarea y devolver un plan acotado |
| Agente de pruebas | Escribe las pruebas antes del código | Que sus pruebas no puedan ser alteradas por quien implementa |
| Agente implementador | Escribe y corrige el código | Recibir el resultado de la última ejecución para corregir |
| Entorno aislado | Sistema que ejecuta el código generado | Ejecutar sin afectar al equipo anfitrión |

## 4. Historias de Usuario

### HU-001: Corrección automática hasta pasar las pruebas
**Como** dueño del proyecto
**Quiero** que el sistema corrija su propio código cuando las pruebas fallen
**Para** recibir tareas terminadas sin tener que intervenir en cada fallo

**Criterios de aceptación:**
- [ ] **CA-001-01**: Si la ejecución de las pruebas termina con éxito, la tarea se marca como completada y no se realizan más iteraciones. (P1)
- [ ] **CA-001-02**: Si la ejecución falla y quedan iteraciones y presupuesto, el implementador recibe el resultado de esa ejecución y produce una nueva versión. (P1)
- [ ] **CA-001-03**: Un éxito en la última iteración permitida se trata como éxito, no como revisión. (P1)
- [ ] **CA-001-04**: La decisión entre éxito, reintento y parada depende solo del código de resultado de la ejecución y del estado de control, nunca del texto de la salida. (P1)
- [ ] **CA-001-05**: Una ejecución en la que no hay ninguna prueba presente no cuenta como éxito. (P1)

### HU-002: Pruebas escritas antes y por otro rol
**Como** dueño del proyecto
**Quiero** que las pruebas las escriba un rol distinto del que implementa, y antes
**Para** que el código no se valide contra pruebas hechas a su medida

**Criterios de aceptación:**
- [ ] **CA-002-01**: Las pruebas de una tarea existen antes de que se produzca la primera versión de la implementación. (P1)
- [ ] **CA-002-02**: Un intento del implementador de modificar o borrar una prueba se rechaza y queda registrado. (P1)
- [ ] **CA-002-03**: Si las pruebas cambiaron respecto a la huella tomada al escribirlas, la ejecución no se realiza. (P1)
- [ ] **CA-002-04**: Las pruebas recién escritas fallan cuando todavía no hay implementación. (P3)

### HU-003: Ejecución aislada
**Como** dueño del proyecto
**Quiero** que el código generado se ejecute separado de mi equipo
**Para** que un error o un código dañino no afecte a mis archivos, mis credenciales ni mi red

**Criterios de aceptación:**
- [ ] **CA-003-01**: El código en ejecución no puede abrir conexiones de red. (P1)
- [ ] **CA-003-02**: El código en ejecución no puede escribir fuera de su área de trabajo ni alterar el proyecto real. (P1)
- [ ] **CA-003-03**: El código en ejecución corre sin privilegios de administrador. (P1)
- [ ] **CA-003-04**: Al superar el tiempo máximo, la ejecución se detiene y se clasifica como tiempo agotado. (P1)
- [ ] **CA-003-05**: Al superar el límite de memoria o de número de procesos, la ejecución se detiene sin afectar al equipo anfitrión. (P1)
- [ ] **CA-003-06**: Tras cada ejecución no queda ningún entorno residual. (P1)
- [ ] **CA-003-07**: Si el aislamiento no está disponible, se informa al operador y no se ejecuta nada en el equipo anfitrión. (P1)
- [ ] **CA-003-08**: Los secretos del proyecto no entran en el área de trabajo aislada. (P1)
- [ ] **CA-003-09**: Las dependencias declaradas por el proyecto están disponibles durante la ejecución, pese a no haber red. (P2)

### HU-004: Gasto acotado
**Como** dueño del proyecto
**Quiero** fijar cuánto puede gastar una sesión
**Para** que un ciclo que no converge no consuma dinero sin límite

**Criterios de aceptación:**
- [ ] **CA-004-01**: Al alcanzar el umbral de degradación, las llamadas siguientes usan un modelo más barato y el cambio queda registrado. (P1)
- [ ] **CA-004-02**: Alcanzado el tope de gasto, no se inicia ninguna llamada más y la tarea pasa a revisión humana. (P1)
- [ ] **CA-004-03**: El gasto acumulado se conserva tras reanudar una sesión. (P1)
- [ ] **CA-004-04**: El gasto acumulado se puede consultar en cualquier momento. (P2)
- [ ] **CA-004-05**: Una respuesta de un proveedor real que no informa de su consumo se trata como error, no como gasto cero. (P1)

### HU-005: Tope de iteraciones y revisión humana
**Como** dueño del proyecto
**Quiero** que el sistema se detenga y me pregunte cuando no consiga terminar
**Para** decidir yo si vale la pena seguir

**Criterios de aceptación:**
- [ ] **CA-005-01**: Tras 5 ejecuciones fallidas, el sistema se pausa y pide revisión indicando el motivo. (P1)
- [ ] **CA-005-02**: En la revisión, la persona puede continuar con una ampliación de iteraciones o de presupuesto, aceptar el resultado tal como está, o abortar. (P1)
- [ ] **CA-005-03**: Mientras no haya una decisión explícita, no se consume presupuesto. (P1)
- [ ] **CA-005-04**: Abortar restaura los archivos del proyecto al estado previo a la tarea. (P2)
- [ ] **CA-005-05**: Un fallo del entorno aislado no consume iteraciones y lleva a revisión con ese motivo. (P1)

### HU-006: Reanudación
**Como** operador
**Quiero** retomar una sesión interrumpida
**Para** no pagar dos veces por el mismo trabajo

**Criterios de aceptación:**
- [ ] **CA-006-01**: Tras una interrupción, reanudar continúa desde el último paso completado sin repetir las llamadas a modelos ya realizadas. (P1)
- [ ] **CA-006-02**: Un punto de guardado dañado se detecta y se informa, sin perder el anterior válido. (P1)
- [ ] **CA-006-03**: Dos reanudaciones simultáneas de la misma tarea no producen estados divergentes. (P2)

### HU-007: Contexto acotado y extensible
**Como** dueño del proyecto
**Quiero** que los agentes reciban solo el contexto relevante de la tarea
**Para** no pagar por enviar el proyecto entero en cada llamada

**Criterios de aceptación:**
- [ ] **CA-007-01**: El contexto entregado a un agente nunca supera el tamaño máximo configurado, e indica si se truncó. (P1)
- [ ] **CA-007-02**: La fuente de contexto se puede sustituir por otra sin modificar el resto del ciclo. (P2)
- [ ] **CA-007-03**: El ciclo funciona sin ningún índice preparado de antemano. (P1)

### HU-008: Operación y compatibilidad
**Como** operador
**Quiero** activar el ciclo cuando lo necesite, sin que cambie lo que ya uso
**Para** adoptarlo de forma gradual

**Criterios de aceptación:**
- [ ] **CA-008-01**: Con el ciclo sin activar, el modo clásico se comporta exactamente como antes. (P1)
- [ ] **CA-008-02**: El ciclo solo se ejecuta cuando el proyecto está en la etapa de construcción. (P1)
- [ ] **CA-008-03**: Cada paso del ciclo queda en el registro de eventos y es visible en el panel. (P2)
- [ ] **CA-008-04**: Dos tareas de construcción no se ejecutan a la vez sobre la misma área de trabajo. (P2)
- [ ] **CA-008-05**: Un cambio de dependencias propuesto por el implementador no se aplica sin revisión humana. (P1)

## 5. Escenarios de Uso

### Escenario 1: Caso feliz
**Dado** un proyecto en etapa de construcción, con una tarea pendiente y presupuesto disponible
**Cuando** el operador lanza la construcción con el ciclo activado
**Y** la primera ejecución de las pruebas falla y la segunda pasa
**Entonces** la tarea queda completada tras 2 iteraciones
**Y** el registro muestra el plan, las pruebas, las dos versiones, las dos ejecuciones y el gasto

### Escenario 2: Caso de error
**Dado** una tarea cuyas pruebas no consigue pasar el implementador
**Cuando** se acumulan 5 ejecuciones fallidas
**Entonces** el sistema se pausa, indica "tope de iteraciones" como motivo y no gasta más
**Y** cuando la persona elige abortar, los archivos del proyecto vuelven al estado previo a la tarea

### Escenario 3: Caso borde — éxito en la última iteración
**Dado** una tarea con 4 ejecuciones fallidas
**Cuando** la quinta ejecución pasa las pruebas
**Entonces** la tarea queda completada, sin pasar por revisión humana

### Escenario 4: Caso borde — tope de gasto a mitad de corrección
**Dado** una sesión cuyo gasto alcanza el tope justo después de una ejecución fallida
**Cuando** el sistema decide el siguiente paso
**Entonces** no inicia ninguna llamada más y pide revisión con motivo "presupuesto"
**Y** si la persona amplía el presupuesto, el ciclo continúa desde ese punto

### Escenario 5: Fallo de dependencia — aislamiento no disponible
**Dado** un equipo donde el entorno aislado no puede arrancar
**Cuando** el operador lanza la construcción con el ciclo activado
**Entonces** el sistema informa del problema y termina con un código de error propio
**Y** ningún código generado se ejecuta en el equipo anfitrión

### Escenario 6: Fallo de dependencia — proveedor de modelos caído
**Dado** un ciclo en curso
**Cuando** el proveedor de modelos deja de responder
**Entonces** la llamada se reintenta según la política existente y, si sigue fallando, la tarea pasa a revisión
**Y** la llamada fallida no se contabiliza como iteración

### Escenario 7: Datos extremos
**Dado** unas pruebas que producen una salida de gran tamaño
**Cuando** termina la ejecución
**Entonces** la salida se recorta a un tamaño máximo, el implementador recibe solo la parte final
**Y** la decisión del ciclo no cambia por el recorte

### Escenario 8: Concurrencia
**Dado** una tarea pausada en revisión
**Cuando** dos operadores intentan reanudarla a la vez
**Entonces** solo una reanudación procede y la otra recibe un aviso de que la tarea ya está en curso

### Escenario 9: Interrupción y reanudación
**Dado** un ciclo que ya escribió las pruebas y una versión de la implementación
**Cuando** el proceso se corta antes de ejecutar las pruebas y el operador reanuda
**Entonces** el ciclo continúa en la ejecución de las pruebas
**Y** no se repite ninguna llamada a modelos ya realizada

## 6. Requisitos Funcionales

- **RF-001**: El sistema DEBE ejecutar, para cada tarea de construcción, la secuencia: planificar, reunir contexto, escribir pruebas, implementar, ejecutar pruebas, decidir.
- **RF-002**: El sistema DEBE evaluar el éxito antes que los topes de iteraciones y de gasto.
- **RF-003**: El sistema DEBE decidir el siguiente paso a partir del código de resultado de la ejecución y del estado de control.
- **RF-004**: El sistema NO DEBE considerar exitosa una ejecución sin pruebas presentes o con pruebas alteradas.
- **RF-005**: El sistema DEBE producir las pruebas con un rol distinto del implementador y antes de la primera implementación.
- **RF-006**: El sistema NO DEBE permitir que el implementador modifique o borre las pruebas.
- **RF-007**: El sistema NO DEBE ejecutar código generado fuera del entorno aislado.
- **RF-008**: El sistema DEBE ejecutar el código generado sin red, sin privilegios de administrador y con límites de tiempo, memoria y número de procesos.
- **RF-009**: El sistema DEBE eliminar todo entorno aislado al terminar cada ejecución, y los residuales al iniciar o reanudar una sesión.
- **RF-010**: El sistema NO DEBE copiar secretos del proyecto al área de trabajo aislada, ni escribirlos en registros o puntos de guardado.
- **RF-011**: El sistema DEBE llevar el gasto acumulado por sesión, degradar el modelo al alcanzar el umbral y no iniciar llamadas al alcanzar el tope.
- **RF-012**: El sistema DEBE pausar el ciclo y pedir revisión humana por cinco motivos: tope de iteraciones, tope de gasto, fallo del entorno aislado o del proveedor de modelos, cambio de dependencias y salida de un agente que no se puede interpretar.
- **RF-013**: El sistema DEBE ofrecer en la revisión las decisiones continuar, aceptar y abortar, y NO DEBE gastar presupuesto sin una decisión explícita.
- **RF-014**: El sistema DEBE guardar el estado del ciclo después de cada paso y reanudar desde el último paso completado.
- **RF-015**: El sistema DEBE limitar el tamaño del contexto entregado a los agentes y permitir sustituir la fuente de contexto.
- **RF-016**: El sistema DEBE mantener el modo clásico sin cambios cuando el ciclo no esté activado, y registrar cada paso del ciclo en el registro de eventos.

## 7. Requisitos No Funcionales

| Categoría | Requisito | Métrica |
|-----------|-----------|---------|
| Seguridad | El código generado no alcanza la red ni escribe fuera de su área | 0 conexiones y 0 escrituras externas en la suite de aislamiento |
| Seguridad | Sin secretos en área aislada, registros ni puntos de guardado | 0 coincidencias de los patrones de secretos en esos tres lugares |
| Costo | Exceso sobre el tope de gasto | No mayor que el costo máximo de una sola llamada |
| Rendimiento | Tiempo añadido por el aislamiento en cada ejecución, con el entorno ya preparado | ≤ 5 s (provisional; se fija con la medición de T002) |
| Disponibilidad | Reanudación tras un corte en cualquier paso | 100 % de los pasos de la suite de reanudación, sin llamadas repetidas |
| Limpieza | Entornos residuales tras 100 ejecuciones consecutivas | 0 |
| Compatibilidad | Suite de pruebas existente con el ciclo sin activar | Sin regresiones |
| Observabilidad | Pasos del ciclo presentes en el registro de eventos | 100 % |
| Accesibilidad | Mensajes de revisión comprensibles por una persona no técnica | En español, sin jerga, con el motivo y las opciones disponibles |

## 8. Fuera de Alcance (Exclusiones Explícitas)

- ❌ Exponer o consumir herramientas mediante un protocolo estándar de herramientas (especificación posterior S2)
- ❌ Memoria semántica o búsqueda por similitud sobre el proyecto (especificación posterior S3)
- ❌ Lanzar tareas, consultar estado o decidir revisiones por red (especificación posterior S4)
- ❌ Un revisor basado en modelo que decida si el resultado es correcto
- ❌ Ejecutar varios ciclos en paralelo sobre un mismo proyecto
- ❌ Formas de aislamiento distintas de la elegida en el plan
- ❌ Aprobar o instalar dependencias nuevas de forma automática
- ❌ Cambios en los comandos, agentes o plantillas de la metodología
- ❌ Una interfaz gráfica para la revisión humana
- ❌ Corregir los defectos previos del motor que impiden usar el ciclo con tareas generadas por la metodología (especificación previa S0)

## 9. Dependencias y Asunciones

### Dependencias
- Especificación S0 "Saneamiento" (por escribir): el motor y los comandos de la metodología usan hoy nombres y rutas distintos para el estado y las tareas. Sin S0, el ciclo no puede ejecutar tareas generadas por la metodología.
- Un sistema de aislamiento instalado en el equipo del operador.
- Un proveedor de modelos configurado que informe del consumo de cada llamada.

### Asunciones
- Las tareas de construcción declaran los archivos que tocan y los criterios de aceptación que cubren.
- El proyecto tiene un comando de pruebas detectable.
- El presupuesto es por sesión completa, no por tarea (aclaración 5).
- La primera entrega cubre proyectos en dos lenguajes (aclaración 7).

## 10. Términos del Dominio

- **Ciclo verificado**: secuencia automática que se repite hasta que las pruebas pasan o se alcanza un tope.
- **Iteración**: una ejecución de las pruebas contra una versión de la implementación.
- **Entorno aislado**: espacio de ejecución separado del equipo anfitrión, sin red, sin privilegios y con límites.
- **Equipo anfitrión**: el ordenador del usuario donde se ejecuta FORGE.
- **Área de trabajo aislada**: copia desechable del proyecto, sin secretos, sobre la que opera el entorno aislado.
- **Huella**: resumen del contenido de un archivo que permite detectar si cambió.
- **Sesión**: una ejecución de construcción y todas sus reanudaciones.
- **Tope de gasto**: importe máximo de una sesión.
- **Umbral de degradación**: importe a partir del cual se usa un modelo más barato.
- **Revisión humana**: pausa en la que una persona decide continuar, aceptar o abortar.
- **Punto de guardado**: estado del ciclo escrito tras cada paso.
- **Modo clásico**: el comportamiento actual, sin corrección automática.

Definiciones completas en `.sdd/dominio/glosario.md`.

## 11. Preguntas Abiertas

Todas resueltas el 2026-10-03 con el valor recomendado, bajo la aprobación automática que dio el dueño. Ver la sección 14, filas 5 a 12. Cualquiera se puede cambiar con `/sdd.aclarar`.

- [x] Ámbito del tope de gasto → por sesión.
- [x] Destino de la degradación → un modelo más barato del mismo proveedor; configurable a uno local.
- [x] Lenguajes de la primera entrega → dos (ver aclaración 7).
- [x] Dónde se escribe el código → en el proyecto real, con respaldo.
- [x] Versión del entorno de ejecución → se acepta para el ciclo; el modo clásico sigue en la mínima.
- [x] Tiempo añadido por el aislamiento → 5 s provisional.
- [x] Verificación de que las pruebas fallan antes de implementar → sí, como aviso que no bloquea.
- [x] Justificación al aceptar → no se exige en esta entrega.

## 12. Criterios de Éxito Medibles

- 0 ejecuciones de código generado en el equipo anfitrión con el ciclo activado.
- 100 % de las tareas terminadas por el ciclo tienen sus pruebas pasando, o una decisión humana registrada.
- Ninguna sesión supera su tope de gasto en más del costo de una llamada.
- 0 entornos residuales tras 100 ejecuciones consecutivas.
- 0 llamadas a modelos repetidas al reanudar, en la suite de reanudación.
- 0 regresiones en la suite existente con el ciclo sin activar.
- Los 39 criterios de aceptación tienen al menos una prueba automática.

## 13. Referencias

- `PLAN-MOTOR-AGENTICO.md` (plan maestro y roadmap S0-S5)
- `.sdd/memoria/constitucion.md` (principios V a IX)
- Documentos de partida, reemplazados: `../doc/plan_de_ejecuci_n_forge_v2.md`, `../doc/estructura_de_implementaci_n_para_el_agente_cursor_claude.md`, `../doc/documento_de_soporte_t_cnico_y_comercial.md`
- Comportamiento actual: `core/orchestrator.js:100-174`, `core/runners/runner.js:31-51`, `core/session-budget.js`, `core/execution-context.js:30-36`

## 14. Historial de Aclaraciones

| # | Categoría | Pregunta | Decisión | Fecha |
|---|-----------|----------|----------|-------|
| 1 | Alcance | ¿Qué es "FORGE v2" respecto al repositorio actual? | Una mejora incremental del marco de trabajo, no una reescritura | 2026-10-03 |
| 2 | Alcance | ¿Qué flujo es el canónico entre los dos de los documentos de partida? | Fusión: planificar, reunir contexto, escribir pruebas, implementar, ejecutar, con decisión determinista | 2026-10-03 |
| 3 | Alcance | ¿Qué entra en la primera entrega? | Núcleo primero; herramientas, memoria semántica y acceso por red en especificaciones posteriores | 2026-10-03 |
| 4 | Restricciones | ¿Se mantiene el entorno de ejecución actual del producto? | Sí; se usan equivalentes en el mismo entorno en lugar de cambiar de lenguaje | 2026-10-03 |
| 5 | Costo | ¿El tope de gasto es por sesión o por tarea? | Por sesión. *Valor por defecto, bajo aprobación automática del dueño* | 2026-10-03 |
| 6 | Costo | ¿A dónde lleva la degradación? | A un modelo más barato del mismo proveedor; configurable a uno local. *Por defecto* | 2026-10-03 |
| 7 | Alcance | ¿Qué lenguajes cubre la primera entrega? | JavaScript/TypeScript y Python. *Por defecto* | 2026-10-03 |
| 8 | Comportamiento | ¿Dónde se escribe el código generado? | En el proyecto real, con respaldo previo y restauración al abortar. *Por defecto* | 2026-10-03 |
| 9 | Restricciones | ¿Puede el ciclo exigir una versión superior del entorno de ejecución? | Sí, solo para el motor opcional; hay un motor de reserva para la versión mínima. *Por defecto* | 2026-10-03 |
| 10 | Rendimiento | ¿Tiempo máximo que puede añadir el aislamiento? | 5 s provisional, a fijar con la medición de T002. *Por defecto* | 2026-10-03 |
| 11 | Calidad | ¿Se verifica que las pruebas fallen antes de implementar? | Sí, como aviso que no bloquea (CA-002-04 sigue en P3). *Por defecto* | 2026-10-03 |
| 12 | Proceso | ¿Aceptar en una revisión exige justificación escrita? | No en esta entrega; la decisión queda registrada. *Por defecto* | 2026-10-03 |
| 13 | Proceso | ¿Quién aprueba la spec y el plan? | El dueño dio aprobación automática para continuar. Se registran como aprobados por delegación | 2026-10-03 |
| 14 | Comportamiento | ¿Qué pasa si un agente devuelve una salida que no se puede interpretar? | Un reintento; si vuelve a fallar, revisión humana con un quinto motivo, sin gastar iteraciones. *Caso no previsto, descubierto al implementar* | 2026-10-03 |
| 15 | Comportamiento | Si el presupuesto se agota justo después de implementar, ¿se ejecutan las pruebas? | Sí: ejecutar no cuesta dinero, y si pasan, el trabajo ya pagado termina en éxito. *Cambia el orden de ADR-05* | 2026-10-03 |
| 16 | Comportamiento | ¿Un fallo del proveedor de modelos cuenta como iteración? | No. Lleva a revisión con el motivo de fallo del entorno | 2026-10-03 |
| 17 | Seguridad | ¿Puede el implementador escribir configuración que alguna herramienta ejecuta sola (hooks, CI, editor, ejecutor de pruebas)? | No: se trata como una dependencia, con revisión humana. *Descubierto por la revisión de seguridad independiente* | 2026-10-03 |
| 18 | Operación | ¿Cuántos ciclos a la vez por proyecto? | Uno. Un segundo se rechaza. *Descubierto por la verificación independiente: el barrido de contenedores mataba los de otra sesión* | 2026-10-03 |
| 19 | Comportamiento | ¿Se puede relanzar en modo clásico una tarea empezada con el ciclo? | No sin `--force`: ejecutaría en el anfitrión código que escribió un modelo | 2026-10-03 |
| 20 | Presupuesto | ¿La ampliación del tope vale para la tarea o para la sesión? | Para la sesión | 2026-10-03 |
