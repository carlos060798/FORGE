---
id: 2026-10-14-puertas-de-calidad-y-evidencia
titulo: "Puertas de calidad declarables, criterios de aceptación enlazados a pruebas e informe de evidencia por tarea a prueba de alteraciones"
tamano: grande  # micro | pequeño | mediano | grande
estado: en_implementacion  # borrador | en_revision | aprobada | en_implementacion | completada
creada: 2026-10-14
actualizada: 2026-10-14
autor: humano  # humano | importado
constitucion_version: 1.1.0
etiquetas: [calidad, evidencia, puertas, trazabilidad, sandbox, determinista]
---

# Especificación: puertas de calidad y evidencia

> **Estado (2026-10-17): aprobada por delegación del dueño ("avanzar"): fase A (evidencia encadenada, CA-004-xx y CA-005-xx en lo que cubre `plan.md`, sección 16) y fase B1 (puertas declarables dentro de `fragua verificar`: HU-001 y HU-002 en `verificar`, `plan.md` sección 17). La integración en el ciclo, los criterios enlazados y `no_cambiar` siguen en borrador.**
>
> **Estado original: borrador.** Redactada por un agente por encargo del dueño (2026-10-14); **no está aprobada** y no se implementa hasta que el dueño la apruebe (Principio II). Corresponde al frente D de `PLAN-MAESTRO.md` (sección 5). Cada afirmación sobre el código cita `archivo:línea` leído el 2026-10-14; lo que no se pudo confirmar está marcado «sin confirmar».

## 1. Contexto y Motivación

Hoy el veredicto de una tarea es el código de salida de **un solo comando de pruebas** en el contenedor (`core/ciclo/router.js:19-29`, `core/sandbox/sandbox-runner.js:143`). No hay otras puertas objetivas: tipos, linter, seguridad y cobertura no se evalúan en el contenedor.

- Existe un `QualityGate` con pruebas, linter y criterio de aceptación (`core/quality-gate.js:21-58`), pero pertenece al modo clásico: ejecuta con `core/runners/runner.js` **en el equipo del usuario**, no en el contenedor, y el criterio (`criterioCmd`) corre con `run(criterioCmd, cwd, 60_000)` en el anfitrión (`core/quality-gate.js:45-49`). No sirve de base para una garantía de aislamiento.
- Los criterios de aceptación llegan a la tarea como una lista de identificadores (`cas`, `cubre_cas`; `core/ciclo/estado.js:67,101`, `core/tareas.js:63`), pero **nada comprueba que cada identificador tenga una prueba**: el enlace requisito→prueba no existe.
- La evidencia que hoy queda por verificación es parcial. El resultado de `forge verificar` lleva `formato`, veredicto, comando, lenguaje, imagen (nombre), duración, cortes, salida acotada, avisos y mutación (`core/verificar/resultado.js:54-77`), y con `--registrar` se guarda en `.sdd/verificaciones/<id>.json` (`core/verificar/registro.js:21-55`). La investigación de estándares (`docs/investigacion/ESTANDARES-DE-INGENIERIA.md`, secciones 2 y 3) lista lo que **falta**: hash de la spec aprobada, hash del commit o árbol y de las pruebas, digest de la imagen, identidad de modelo y rol de autor y de probador, coste y decisión humana en el mismo registro, y firma o cadena de hashes.
- El ciclo guarda las huellas de pruebas e implementación (`sha256` por archivo, `core/ciclo/estado.js:70-71`; `core/ciclo/protocolo-archivos.js:149`), pero el resultado del ciclo y el de `verificar` no las llevan.

El mercado no cubre esto en lo leído (`PLAN-MAESTRO.md:11`). La posición del plan es «calidad comprobada y coste acotado»: sin puertas más allá de las pruebas y sin evidencia citable, la promesa se queda en «las pruebas pasan».

## 2. Objetivo

Que un proyecto pueda **declarar puertas adicionales** (tipos, linter, seguridad, cobertura mínima) que se ejecutan en el mismo contenedor sin red y se evalúan por código de salida en el enrutador, sin poder quitar las garantías fijas; que cada criterio de aceptación **muestre qué prueba lo cubre** y cuáles quedan sin cubrir; y que cada tarea verificada deje un **informe de evidencia** con los campos que faltan, encadenado de forma que alterarlo no pase desapercibido.

## 3. Usuarios y Actores

| Actor | Rol | Necesidad principal |
|---|---|---|
| Dueño o líder técnico | Declara las puertas del proyecto | Exigir más que «pasan las pruebas» sin tocar el motor |
| Revisor / auditor | Lee la evidencia | Saber qué se verificó exactamente, con qué y por quién, y que no se ha retocado |
| Desarrollador | Recibe el veredicto | Un motivo claro de qué puerta falló |
| Otra herramienta | Consume el informe | Forma estable (ver `2026-10-14-contrato-publico`) |
| Agente (modelo) | Escribe código y pruebas | No puede relajar ni saltarse las puertas |

## 4. Historias de Usuario

### HU-001: Declarar puertas adicionales del proyecto
**Como** dueño del proyecto
**Quiero** declarar en `.sdd/sdd.config.yaml` un comando por puerta (tipos, linter, seguridad, cobertura)
**Para** que el ciclo y `verificar` las exijan además de las pruebas

**Criterios de aceptación:**
- [x] **CA-001-01** (B1; sin `cobertura_minima`: el umbral va en el comando, ver `plan.md` §17): Una sección `puertas:` admite las claves fijas `tipos`, `linter`, `seguridad`, `cobertura` (comando) y `cobertura_minima` (0 a 100). El lector actual solo entiende `clave: valor` con dos espacios de sangría (`core/ciclo/config.js:81-110`), así que la forma es plana por diseño. (P1)
- [x] **CA-001-02** (B1): Una clave desconocida en `puertas:` es un error con mensaje claro, no se ignora en silencio (misma regla que `core/ciclo/config.js:94-102`). (P1)
- [x] **CA-001-03** (B1): Un proyecto **solo puede añadir** puertas. No existe clave para desactivar, relajar ni sustituir el comando de pruebas, el contenedor sin red, el rojo obligatorio, la redacción ni el tope de gasto. Una prueba recorre todas las claves aceptadas y falla si alguna aflojaría una garantía fija. (P1)
- [x] **CA-001-04** (B1): Sin sección `puertas:` el comportamiento es idéntico al de hoy (veredicto por el comando de pruebas). (P1)
- [x] **CA-001-05** (B1): Cada comando se divide con `dividirComando` (`core/verificar/index.js:119`, `core/sandbox/sandbox-runner.js`): sin intérprete de órdenes, sin encadenados ni redirecciones. (P1)

### HU-002: Ejecutar las puertas en el contenedor y decidir por código de salida
**Como** revisor
**Quiero** que cada puerta corra aislada y decida solo el código de salida
**Para** que el veredicto no dependa de la opinión de un modelo (Principio VI)

**Criterios de aceptación:**
- [x] **CA-002-01** (B1, en `verificar`): Cada puerta se ejecuta con el mismo mecanismo y los mismos límites que las pruebas (`sandbox.*`, `core/ciclo/config.js:38-45`), sin red y sobre una copia. No existe ejecución de puertas en el anfitrión. (P1)
- [x] **CA-002-02** (B1; 127 se distingue antes de `clasificar`): El enrutador clasifica cada puerta con las reglas ya existentes: salida 0 es `pass`; 125, 126 y 127 e `infraError` son `infra_error`; tiempo agotado es `timeout`; el resto, `fail` (`core/ciclo/router.js:19-29`). La decisión nunca lee el texto de la salida. (P1)
- [x] **CA-002-03** (B1, en `verificar`): Una puerta que falla impide el éxito de la tarea aunque las pruebas pasen. Una puerta en `infra_error` o `timeout` nunca es éxito (falla cerrado), igual que el modo `exigir` de mutación (`core/ciclo/router.js:127-130`). (P1)
- [x] **CA-002-04** (B1): Una puerta cuyo comando no existe en la imagen (herramienta no instalada) termina con salida distinta de cero y se informa como «puerta no ejecutable», no como éxito. La imagen no instala herramientas por su cuenta (sin red). (P1)
- [x] **CA-002-05** (B1): El resultado indica **qué puerta** causó el veredicto: nombre, comando, código de salida, duración y salida acotada y redactada con `cola`/`redactar` (`core/verificar/resultado.js:61-71`). (P1)
- [ ] **CA-002-06** (B1: sustituido, el umbral va dentro del comando de `cobertura`; sin `cobertura_minima`): `cobertura_minima` se evalúa pasando el umbral a la propia herramienta (p. ej. su opción de «fallar bajo X %»), no leyendo un número de la salida. Si la herramienta del proyecto no admite umbral, la puerta de cobertura no está disponible y se dice así. (P1)
- [x] **CA-002-07** (B1): `forge verificar` ejecuta las puertas con las mismas reglas; con `--json` aparecen en el resultado. Códigos de salida del proceso sin cambios (0, 1, 4). (P1)

### HU-003: Ver qué criterio de aceptación no tiene prueba
**Como** líder técnico
**Quiero** una matriz criterio→pruebas por tarea y por spec
**Para** saber qué requisito no está cubierto

**Criterios de aceptación:**
- [ ] **CA-003-01**: Los identificadores `CA-xxx-yy` de `spec.md` se extraen con una expresión fija y se cruzan con los `cubre_cas` de las tareas (`core/tareas.js:63`). Un CA en la spec que ninguna tarea cubre se lista como «sin tarea». (P1)
- [ ] **CA-003-02**: Un CA cubierto por una tarea se considera con prueba solo si algún archivo de prueba de esa tarea (`estado.pruebas.archivos`, `core/ciclo/estado.js:70`) **contiene el identificador** en un comentario o nombre de prueba. El agente de pruebas recibe la instrucción de citarlo. (P1)
- [ ] **CA-003-03**: La matriz se produce **sin llamar a un modelo** y sin ejecutar nada: lectura de archivos y comparación de texto. (P1)
- [ ] **CA-003-04**: `forge status` o `forge verificar --criterios` muestra los CA sin prueba y devuelve el código 1 si se pide `--exigir-cobertura-de-criterios` (opción explícita, por defecto solo informa). (P2)
- [ ] **CA-003-05**: El informe declara el límite: que un archivo cite el identificador **no demuestra** que la prueba compruebe el criterio; solo que alguien la enlazó. La calidad de la prueba la mide la mutación. (P1)

### HU-004: Informe de evidencia por tarea
**Como** auditor
**Quiero** un informe por tarea con qué se verificó, con qué entradas y por quién
**Para** citarlo y reproducirlo

**Criterios de aceptación:**
- [ ] **CA-004-01**: El informe incluye, además de los campos actuales del resultado: id de tarea y de spec; hash `sha256` de `spec.md`; aprobador y fecha de aprobación **si constan** (sin confirmar dónde se guardan hoy, ver spike S0.3); hash del árbol o commit de entrada; hash de cada archivo de prueba y de implementación; rol y agente autor de código y de pruebas; modelo y versión de cada uno; digest de la imagen; red desactivada y límites; resultado de cada puerta; mutación; coste y tope vigente; decisión humana. (P1)
- [ ] **CA-004-02**: Un campo que no se pudo obtener se escribe como `null` con su motivo en `avisos`, nunca se inventa ni se omite en silencio. (P1)
- [ ] **CA-004-03**: Toda cadena que sale hacia el informe pasa por `redactar` antes de guardarse (`core/verificar/resultado.js:61-71`). (P1)
- [ ] **CA-004-04**: El informe lleva `formato` (versión) y su propio `sha256` sobre una serialización canónica (claves ordenadas, sin espacios). (P1)
- [ ] **CA-004-05**: El informe se guarda con `core/escritura-segura.js`, en exclusiva y sin sobrescribir (`core/verificar/registro.js:28`). (P1)
- [ ] **CA-004-06**: Nada del informe sale del equipo ni se envía a un proveedor de modelo. (P1)

### HU-005: Evidencia que no se puede alterar sin que se note
**Como** auditor
**Quiero** poder comprobar que un informe no se modificó ni se quitó de la serie
**Para** fiarme del historial

**Criterios de aceptación:**
- [ ] **CA-005-01**: Cada informe incluye `anterior`: el `sha256` del informe anterior del mismo proyecto (o `null` en el primero). Alterar o borrar un informe intermedio rompe la cadena. (P1)
- [ ] **CA-005-02**: Un comando de comprobación (`forge verificar --comprobar-evidencia` o equivalente) recorre la cadena sin llamar a un modelo ni a la red y devuelve el código 0 si es íntegra, 1 si está rota, indicando el primer eslabón roto. (P1)
- [ ] **CA-005-03**: Firma **opcional** con la API de firma de `node:crypto` (sin dependencias nuevas), con una clave que el usuario guarda **fuera del proyecto y fuera del alcance del agente**. Sin clave, el informe se marca `firma: null` y el comando de comprobación lo dice: «encadenado, no firmado». (P2)
- [ ] **CA-005-04**: La documentación declara el límite: quien pueda reescribir **toda** la carpeta y no haya anclado la cabeza de la cadena fuera de ella puede reconstruirla. Con firma y clave fuera de su alcance no puede. (P1)
- [ ] **CA-005-05**: Se ofrece imprimir y registrar «la cabeza» (último hash) para anclarla fuera (mensaje de commit, etiqueta de git, pegarla en la solicitud de cambio). El motor no hace ese anclaje solo. (P2)

### HU-006: Corrección con «lo que no debe cambiar» (regresión)
**Como** desarrollador
**Quiero** declarar en una tarea de corrección qué comportamiento no debe cambiar
**Para** que el arreglo no rompa lo que ya funcionaba

**Criterios de aceptación:**
- [ ] **CA-006-01**: Una tarea puede declarar `no_cambiar` con una lista de comandos o archivos de prueba existentes que deben pasar **antes y después** del cambio. Es un campo de tarea nuevo y opcional (como `parte_de_codigo_existente`, `core/ciclo/estado.js:103-104`). (P1)
- [ ] **CA-006-02**: Antes de implementar se ejecutan en el contenedor y deben pasar (línea base verde); si ya fallan, la tarea pide revisión humana en lugar de seguir. (P1)
- [ ] **CA-006-03**: Tras implementar se vuelven a ejecutar; si alguno falla, el veredicto es `falla` con el motivo «regresión» y la lista de lo roto. Decide el código de salida. (P1)
- [ ] **CA-006-04**: Los archivos declarados en `no_cambiar` entran en las huellas protegidas: el implementador no puede modificarlos (misma regla que las pruebas, `core/ciclo/protocolo-archivos.js:318-325`). (P1)
- [ ] **CA-006-05**: Una declaración vacía o con rutas inexistentes se rechaza con mensaje claro, no se acepta en silencio. (P2)

## 5. Escenarios de Uso

### Escenario 1: Caso feliz
Proyecto de Node con `puertas: tipos: npx tsc --noEmit` y `linter: npx eslint .`. La tarea pasa pruebas, tipos y linter en el contenedor; el informe lleva hashes, digest de imagen y `anterior`.

### Escenario 2: Las pruebas pasan, el linter falla
El veredicto es `falla` por la puerta `linter`; el implementador recibe el motivo (código y cola redactada). No es éxito.

### Escenario 3: Herramienta no instalada
`seguridad: npx audit-tool` y la imagen no la trae (no hay red). Puerta «no ejecutable»: no es éxito y el mensaje dice cómo declararla en las dependencias del proyecto.

### Escenario 4: Requisito sin prueba
La spec tiene 12 CA y la matriz muestra que `CA-004-03` no está citado por ninguna prueba. Se lista; con `--exigir-cobertura-de-criterios` el código es 1.

### Escenario 5: Informe retocado
Alguien edita un informe intermedio para cambiar `falla` por `pasa`. La comprobación indica el eslabón roto.

### Escenario 6: Corrección que rompe otra cosa
Una tarea de corrección declara `no_cambiar: tests/facturas.test.js`. El arreglo hace pasar la prueba nueva pero rompe `facturas`: veredicto `falla` por regresión.

## 6. Requisitos Funcionales

| ID | Requisito | Prioridad |
|---|---|---|
| RF-01 | Sección `puertas:` plana en `sdd.config.yaml`, con claves fijas y validación estricta | P1 |
| RF-02 | Ejecución de cada puerta con `SandboxRunner`, un comando por puerta, sin red | P1 |
| RF-03 | Clasificación por `clasificar` del enrutador; nuevo motivo `puerta` en revisión humana | P1 |
| RF-04 | Las puertas se exponen en `forge verificar` y en el ciclo con las mismas reglas | P1 |
| RF-05 | Matriz criterio→pruebas por lectura de archivos | P1 |
| RF-06 | Informe de evidencia por tarea con los campos de la sección 2 de la investigación | P1 |
| RF-07 | Cadena de hashes y comando de comprobación | P1 |
| RF-08 | Firma opcional con `node:crypto` | P2 |
| RF-09 | `no_cambiar` en la tarea (regresión) | P1 |
| RF-10 | Eventos nuevos en `.sdd/events.jsonl` (`ciclo:puerta`, `ciclo:evidencia`) | P1 |

## 7. Requisitos No Funcionales

| ID | Requisito |
|---|---|
| RNF-01 | Sin dependencias nuevas (Principio IV): hash y firma con `node:crypto` |
| RNF-02 | Mismo aislamiento que el ciclo, sin opción de degradarlo (Principio V) |
| RNF-03 | Veredicto solo por código de salida y reglas fijas (Principio VI) |
| RNF-04 | Las puertas no llaman a modelos: coste cero añadido (Principio VIII) |
| RNF-05 | Windows y Linux |
| RNF-06 | Las puertas añaden tiempo: respetan `sandbox.timeout_s` por puerta y se informa la duración de cada una |
| RNF-07 | La salida de cada puerta tiene el mismo tope que `SALIDA_MAX_BYTES` (`core/verificar/resultado.js:15`) |

## 8. Fuera de Alcance (Exclusiones Explícitas)

- Instalar linters, analizadores o herramientas de seguridad en la imagen: son dependencias del proyecto.
- Cobertura leída del texto de la salida.
- Que un modelo evalúe si el requisito «está bien cubierto»: solo existe el enlace declarado y la mutación.
- Infraestructura externa de firma o transparencia (servicios de sellado, registros públicos, Sigstore): extensión futura.
- Conformidad certificada con SLSA o SSDF: se cita como referencia, no se promete (`docs/ADECUACION-DEL-CATALOGO.md:25`).
- Puertas de propiedades (experimento del frente D): otra especificación.
- Métricas DORA y rol revisor de seguridad.

## 9. Dependencias y Asunciones

### Spikes obligatorios antes de construir
- **S0.1** Cómo ejecutar varios comandos con una sola preparación de imagen: `SandboxRunner` fija `testCmd` al construirse (`core/sandbox/sandbox-runner.js:131,193`); decidir entre un runner por puerta o un método `ejecutar(cwd, comando)`. Medir el coste de preparar la imagen una vez frente a N.
- **S0.2** Cómo obtener el digest de la imagen. Hoy solo se conoce la etiqueta (`core/sandbox/preparar-imagen.js:155,164,176`) y `existeImagen` consulta `image inspect --format {{.Id}}` (`core/sandbox/docker-cli.js:214-215`); confirmar qué devuelve `{{.Id}}` frente a `RepoDigests` en imágenes construidas en local (sin confirmar).
- **S0.3** Dónde constan el aprobador y la fecha de aprobación de una spec y si existe «hash de la spec aprobada» (`core/spec.js`, `.sdd/estado.json`; sin confirmar).
- **S0.4** De dónde sale la identidad de modelo y rol por llamada: el estado del ciclo solo guarda tokens y gasto (`core/ciclo/estado.js:28-36`); el diario no incluye el modelo (`core/ciclo/diario.js:22`); `gasto.jsonl` puede llevarlo (sin confirmar).
- **S0.5** Formato de línea de `events.jsonl` y qué admite el tipo `EventType` (`core/event-log.js:9`); añadir los tipos nuevos exige ampliarlo.
- **S0.6** Efecto del recorte de `#` en los valores del lector de configuración (`core/ciclo/config.js:106-107`) sobre comandos reales con comillas o almohadilla (sin confirmar).

### Dependencias
- `core/sandbox/`, `core/ciclo/{router,estado,config,protocolo-archivos,redactar,mutacion}.js`, `core/verificar/{index,resultado,registro}.js`, `core/tareas.js`, `core/escritura-segura.js`, `core/event-log.js`.
- `.sdd/especificaciones/2026-10-14-contrato-publico`: el informe nuevo extiende el `formato` del resultado; los dos se versionan juntos.

### Asunciones
- El proyecto declara las herramientas (tipos, linter) en sus propias dependencias y el contenedor las instala al preparar la imagen, como ya hace con las del proyecto (`core/sandbox/preparar-imagen.js:139-176`). Si no es así, la puerta no es ejecutable (CA-002-04).
- Una puerta se ejecuta sobre el estado del proyecto tras la implementación; no hay puertas previas a codificar.

## 10. Capas de seguridad

| Riesgo | Control |
|---|---|
| El proyecto es de un tercero y su comando de puerta es hostil | Mismo contenedor sin red, usuario sin privilegios y límites que las pruebas; copia del proyecto |
| El agente relaja una puerta editando la configuración | Las claves no permiten aflojar; el agente no escribe `.sdd/` (`docs/ciclo-verificado.md:210-225`; confirmar la ruta exacta en el spike S0.6) |
| Un comando de puerta como vía de inyección | Sin intérprete de órdenes; `dividirComando` |
| Salida de la puerta con secretos | Redacción antes de mostrar y guardar |
| Informe alterado para ocultar un fallo | Cadena de hashes, comprobación y firma opcional; límite declarado (CA-005-04) |
| Éxito sospechoso: puerta que «pasa» sin comprobar nada (p. ej. un comando que siempre sale con 0) | Revisión humana de las puertas al aprobar la spec; rechazar comandos triviales (lista por definir, sin confirmar) |
| Falsa sensación de calidad por un enlace criterio→prueba superficial | CA-003-05 y la mutación |
| Clave de firma robada por el agente | La clave vive fuera del proyecto y del contenedor; nunca en el entorno del agente |
| `no_cambiar` usado para ocultar regresiones (lista irrelevante) | CA-006-05 y revisión humana de la lista al aprobar la tarea |

## 11. Términos del Dominio

- **Puerta:** comprobación declarada que se ejecuta en el contenedor y decide por código de salida.
- **Puerta fija:** la que ningún proyecto puede quitar: pruebas en contenedor sin red, rojo obligatorio, redacción, tope de gasto, aprobación humana (`PLAN-MAESTRO.md:103`).
- **Evidencia:** informe por tarea con entradas, salida y resultado de cada puerta.
- **Cadena:** serie de informes enlazados por el hash del anterior.
- **Cabeza:** el hash del último informe; anclarla fuera es lo que protege contra una reescritura total.

## 12. Preguntas Abiertas

| # | Pregunta | Recomendación |
|---|---|---|
| 1 | ¿Un comando por puerta o varios? | Uno por clave; mantiene el lector plano |
| 2 | ¿Las puertas corren en cada iteración o solo tras el pase de pruebas? | Solo tras el pase de pruebas: ahorra tiempo y el veredicto final es el que cuenta |
| 3 | ¿Una puerta fallida consume iteraciones? | Sí, como un fallo de pruebas, con su salida al implementador |
| 4 | ¿Cobertura mínima por defecto? | No: opcional; sin valor no hay puerta |
| 5 | ¿Cadena global del proyecto o una por spec? | Por proyecto: más simple y detecta borrados |
| 6 | ¿La firma entra en la primera entrega? | No: cadena primero, firma (P2) tras el primer uso real |
| 7 | ¿Dónde vive la clave de firma? | Fuera del proyecto, en una ruta que declara el usuario en su entorno (política, no del proyecto) |
| 8 | ¿Enlace criterio→prueba por texto o por un archivo aparte? | Por texto en la prueba; un archivo aparte se desincroniza |
| 9 | ¿`no_cambiar` en la tarea o en la spec? | En la tarea, donde ya se declara `parte_de_codigo_existente` |
| 10 | ¿Qué hace el informe con tareas anteriores sin los campos nuevos? | Se leen sin migrar; los campos ausentes son `null` |

## 13. Criterios de Éxito Medibles

- Con una puerta fallida y pruebas en verde, el veredicto es `falla` y el código de salida 1 en todas las pruebas de aceptación, sin ninguna llamada a un modelo.
- Ninguna clave aceptada en `puertas:` consigue aflojar una garantía fija (prueba exhaustiva).
- Alterar un campo cualquiera de un informe intermedio hace fallar la comprobación en todos los casos de la batería.
- La matriz identifica los CA sin prueba en una spec de ejemplo con resultado conocido.
- El informe de una tarea del kit de pruebas independientes (`scripts/pruebas-independientes.mjs`) contiene todos los campos o su `null` motivado.

## 14. Referencias

- `PLAN-MAESTRO.md` (frente D, sección 5; regla de capas, sección 6).
- `docs/investigacion/ESTANDARES-DE-INGENIERIA.md` (secciones 2, 3 y 4), `docs/ADECUACION-DEL-CATALOGO.md` (fila de evidencia, sección 2).
- NIST SP 800-218A y SLSA v1.1 niveles de build (verificados en esa investigación): la procedencia firmada es L2; L3 exige secretos de firma inaccesibles a los pasos del usuario. El resto de estándares citados allí está «no verificado» y aquí no se afirma.
- `.sdd/especificaciones/2026-10-13-verificar-sin-modelo/` (formato y registro actuales), ADR-20 (mutación y rojo obligatorio).

## 15. Historial de Aclaraciones

- 2026-10-14: creada en borrador a partir de la investigación de estándares y del frente D del plan maestro.
- 2026-10-17 (B1): aprobada por delegación del dueño la fase de puertas en `verificar`. Mandan los informes de `spikes/`: un clon de `SandboxRunner` por puerta (solo cambia el comando), en serie y con tiempo total acotado; el proyecto solo añade exigencias y solo baja topes; 127 es «no ejecutable»; el lector de la sección es propio y estricto (clave desconocida, `#` pegado y comilla final); sin `--sin-puertas`; `cobertura_minima` sustituido por el umbral dentro del comando.
- 2026-10-17: aprobada por delegación del dueño solo en la fase A (evidencia encadenada). Los siete informes de `spikes/` mandan sobre este texto cuando difieren: `aprobador` es siempre `null`; la imagen se registra como `{ etiqueta, id, repoDigests }` (no `digest`); los modelos son una lista de pares pedidos; la firma deja de ser opcional cuando hay clave local; CA-005-04: el truncado de los últimos informes solo se detecta con la cabeza guardada del lado del usuario.
