---
id: 2026-11-27-descriptor-de-lenguaje
titulo: "Descriptor de lenguaje: cada lenguaje se declara como datos y el motor deja de tener lenguajes escritos en su código"
tamano: grande  # micro | pequeño | mediano | grande
estado: borrador  # borrador | en_revision | aprobada | en_implementacion | completada
creada: 2026-11-27
actualizada: 2026-11-27
autor: humano  # humano | importado
constitucion_version: 1.1.0
etiquetas: [lenguajes, agnostico, sandbox, mutacion, python, fase-8]
---

# Especificación: Descriptor de lenguaje

> **Estado: borrador, sin aprobar.** Fase 8 del `Plan consolidado de modos y componentes Forja` (§5, §6, «descriptor-de-lenguaje») y §3 de `C1_arquitectura.md`. La decisión de diseño está en `ADR-36-descriptor-de-lenguaje`, propuesta y sin aceptar. La aprobación es del dueño del proyecto; ningún agente la marca.

## 1. Contexto y Motivación

Fragua dice ser agnóstica de lenguaje, pero lo que sabe de cada lenguaje está repartido y escrito dentro del código, en al menos cinco sitios:

- la detección del stack, con una rama `if` por lenguaje (`core/stack-detector.js`, `detectStack`);
- la elección del ejecutor de pruebas, un `switch` por lenguaje (`core/runners/index.js:20-31`);
- la imagen del contenedor, sus manifiestos y la lista de «soportados» (`core/sandbox/preparar-imagen.js:24-40`), y los pasos de instalación de cada lenguaje (`:111-135`, función `dockerfile`);
- las variables de entorno del contenedor, con las de Go aparte (`core/sandbox/sandbox-runner.js:17-23,64-72`) y un envoltorio específico de Go (`:34-36`);
- la mutación: qué extensiones pertenecen a qué lenguaje (`core/ciclo/mutacion.js:49-58`, `lenguajeDe`) y qué se hace con cada uno (JavaScript con análisis sintáctico; TypeScript que el analizador no entiende, Python y Go con patrones de texto, según la cabecera de `mutacion.js:1-14`).

Consecuencias comprobadas en el código:

- Un lenguaje sin soporte cae en el ejecutor de Node (`core/runners/index.js:31`, `default: return createNodeRunner(cwd)`): un proyecto Java en modo clásico ejecutaría `npm test`. La parada honesta de ese `default` es la especificación `runner-falla-cerrado`; esta especificación asume que ya existe.
- El detector reconoce más lenguajes de los que el motor sabe ejecutar: `java`, `csharp`, `ruby`, `php` y `dart` están en el tipo `Lenguaje` (`stack-detector.js:10`) y Rust tiene ejecutor (`core/runners/rust-runner.js`) pero ninguna imagen (`IMAGENES_BASE` solo trae JavaScript, TypeScript, Python y Go, `preparar-imagen.js:24-27`).
- Python solo se instala desde `requirements.txt`: con un `pyproject.toml` sin él, el ciclo se niega (`preparar-imagen.js:63-65`), aunque el detector sabe que hay `poetry.lock` o `Pipfile` (`stack-detector.js`, `install_cmd`). Quien usa `uv`, `poetry` o `pipenv` no puede usar el ciclo.
- Añadir un lenguaje exige tocar cinco archivos y no hay una lista de comprobaciones que diga cuándo está «hecho».

El plan aplica a los lenguajes el mismo criterio que ya aplica a los proveedores de modelos: sin batería de conformidad no entra.

## 2. Objetivo

Que lo que Fragua sabe de un lenguaje (cómo se detecta, en qué imagen corre, cómo se instalan sus dependencias, con qué orden se prueban, qué entorno necesita y si se puede medir por mutación) sea un **dato declarado una sola vez**, de modo que añadir un lenguaje sea escribir un descriptor y pasar su batería de conformidad, y que JavaScript/TypeScript, Python y Go se comporten exactamente igual que hoy después de migrarlos.

## 3. Usuarios y Actores

| Actor | Rol | Necesidad principal |
|---|---|---|
| Persona con un proyecto Python con `uv`, `poetry` o `pipenv` | Usuario del ciclo | Usar el ciclo sin convertir sus dependencias a otro formato |
| Consultora con proyectos Java o Kotlin | Usuario futuro | Saber con claridad si su lenguaje entra y cuándo |
| Mantenedor | Añade un lenguaje | Un descriptor y una batería, no cinco archivos |
| Dueño del proyecto | Decide qué se promete | Que la lista de lenguajes soportados sea la que el código demuestra |

## 4. Historias de Usuario

### HU-001: Pruebas de caracterización antes de migrar
**Como** mantenedor
**Quiero** fijar con pruebas lo que hoy hace el motor con JavaScript/TypeScript, Python y Go
**Para** migrar a descriptores sin cambiar el comportamiento

**Criterios de aceptación:**
- [ ] **CA-001-01**: Antes de tocar el código existe, para cada uno de los tres lenguajes, una prueba que fija: el stack detectado (lenguaje, comando de pruebas, comando de instalación) sobre proyectos de ejemplo; la imagen base elegida; el texto exacto del archivo de construcción de la imagen; las variables de entorno del contenedor; el comando de pruebas ya dividido en argumentos; y el lenguaje que la mutación asigna a cada extensión. (P1)
- [ ] **CA-001-02**: Esas pruebas pasan en verde **antes** de la migración y siguen en verde, sin modificar sus valores esperados, **después**. Un cambio de valor esperado en la migración es un fallo de la migración. (P1)
- [ ] **CA-001-03**: Las pruebas de caracterización no necesitan Docker ni red (prueban las funciones de planificación, no la ejecución). La ejecución real sigue cubierta por las pruebas de Docker existentes (`FORGE_TEST_DOCKER=1`). (P1)

### HU-002: Un descriptor por lenguaje, como datos
**Como** mantenedor
**Quiero** que cada lenguaje sea un archivo de datos validado, que el motor lee
**Para** no escribir un lenguaje nuevo dentro del código

**Criterios de aceptación:**
- [ ] **CA-002-01**: Cada descriptor declara, como mínimo: identificador; señales de detección; imagen de ejecución con identificador inmutable (huella de contenido); manifiestos de dependencias; paso de instalación de dependencias (por gestor, si hay más de uno); comando de pruebas; entorno del contenedor; qué códigos de salida de las pruebas significan «pasan», «fallan» y «no hay pruebas»; y soporte de mutación. (P1)
- [ ] **CA-002-02**: Un descriptor se valida contra un esquema cerrado: una clave desconocida, un campo obligatorio ausente o un comando con operadores de shell es un error que impide cargarlo, con código de salida distinto de 0 y el nombre del descriptor en el mensaje. (P1)
- [ ] **CA-002-03**: Una imagen sin huella de contenido (solo una etiqueta móvil) es un error de validación. (P1)
- [ ] **CA-002-04**: Los descriptores solo se leen del paquete instalado. Un descriptor, o un campo de descriptor, que venga del proyecto (por ejemplo en `.sdd/` o en el repositorio) se ignora y se avisa; un repositorio hostil no puede declarar un lenguaje ni cambiar una imagen. (P1)
- [ ] **CA-002-05**: Los módulos de detección, imagen, ejecución y mutación no contienen el nombre de ningún lenguaje como literal de decisión (una prueba de agnosticismo, del tipo de las que ya vigilan los proveedores, lo comprueba sobre esos módulos). (P1)

### HU-003: JavaScript/TypeScript, Python y Go migrados sin cambios
**Como** usuario actual de cualquiera de los tres
**Quiero** que nada cambie
**Para** no recibir sorpresas

**Criterios de aceptación:**
- [ ] **CA-003-01**: Con los tres descriptores cargados, las pruebas de caracterización de HU-001 pasan sin cambios. (P1)
- [ ] **CA-003-02**: La suite existente de sandbox y mutación (`tests/sandbox-lenguajes.test.js`, `tests/mutacion-docker-lenguajes.test.js` y las demás del ciclo) pasa sin cambios en sus valores esperados. (P1)
- [ ] **CA-003-03**: Un proyecto de cualquier otro lenguaje con descriptor ausente termina con el error de «lenguaje no soportado» y su código propio (de `runner-falla-cerrado`), sin ejecutar nada. (P1)

### HU-004: Python con el gestor que el proyecto ya usa
**Como** persona con un proyecto Python que usa `uv`, `poetry` o `pipenv`
**Quiero** que el ciclo detecte mi gestor y use mi archivo de bloqueo
**Para** no tener que mantener un `requirements.txt` aparte

**Criterios de aceptación:**
- [ ] **CA-004-01**: El gestor se decide por el archivo de bloqueo presente (`uv.lock`, `poetry.lock`, `Pipfile.lock`), nunca por la presencia de un ejecutable ni por una suposición. (P1)
- [ ] **CA-004-02**: Con `requirements.txt` y sin ningún archivo de bloqueo de los anteriores, el comportamiento es el de hoy, bit a bit (caracterización de HU-001). (P1)
- [ ] **CA-004-03**: Con más de un archivo de bloqueo (por ejemplo `uv.lock` y `poetry.lock`), el motor se detiene con un error de configuración que lista los archivos encontrados; no elige uno. (P1)
- [ ] **CA-004-04**: Un proyecto que declara dependencias (en `pyproject.toml` o `Pipfile`) y no tiene ni `requirements.txt` ni archivo de bloqueo se detiene con un mensaje que indica qué añadir, como hoy (`preparar-imagen.js:63-65`), ampliado a los tres gestores. (P1)
- [ ] **CA-004-05**: La instalación de dependencias ocurre solo en la fase de preparación de la imagen, la única con red (ADR-03); las pruebas se ejecutan sin red, como hoy. Una prueba comprueba que el comando de instalación del gestor no forma parte del comando de pruebas. (P1)
- [ ] **CA-004-06**: La instalación respeta el archivo de bloqueo tal cual (sin actualizarlo ni resolver versiones nuevas); si el archivo no coincide con el manifiesto, la preparación falla con código distinto de 0. (P1)
- [ ] **CA-004-07**: En un modo de riesgo `mvp` o superior (especificación `modos-de-riesgo-y-persona`), la ausencia de archivo de bloqueo es un fallo y no un aviso. [Depende de esa especificación; hasta que exista, un aviso.] (P2)
- [ ] **CA-004-08**: **[NV, a verificar con Docker real]** Los gestores, una vez instalados en la imagen, ejecutan las pruebas sin red. Mientras no se haya comprobado, `uv`, `poetry` y `pipenv` se marcan «no probado» en la documentación. (P1)

### HU-005: La mutación es honesta por lenguaje
**Como** persona que exige medir la calidad de las pruebas
**Quiero** que el descriptor diga si el lenguaje se puede medir por mutación
**Para** no recibir un «aprobado» de una medida que no existe

**Criterios de aceptación:**
- [ ] **CA-005-01**: El descriptor declara el soporte de mutación con valores cerrados: análisis sintáctico, patrones de texto o ninguno. Los de JavaScript/TypeScript, Python y Go reproducen lo que hoy hace `core/ciclo/mutacion.js` (caracterización). (P1)
- [ ] **CA-005-02**: Cuando el modo exige mutación y el lenguaje declara «ninguno», el resultado de esa puerta es `not_evaluable` (contrato de resultados, ADR-30), con su mensaje, y **nunca cuenta como aprobado**; en `mvp` o superior bloquea. (P1)
- [ ] **CA-005-03**: Las herramientas externas de mutación quedan fuera del núcleo: no se añade ninguna dependencia. (P1)

### HU-006: Añadir un lenguaje es un descriptor y una batería
**Como** mantenedor
**Quiero** una batería de conformidad que cualquier descriptor deba pasar
**Para** que «Java soportado» signifique algo demostrable

**Criterios de aceptación:**
- [ ] **CA-006-01**: Existe una batería común que, dado un descriptor, comprueba: validación del esquema; detección sobre un proyecto de ejemplo; que el plan de la imagen usa solo lo declarado; que el comando de pruebas se divide sin operadores de shell; que los códigos de salida declarados se interpretan como pasa/falla/sin pruebas; y que, sin Docker, el desenlace es el de «sin aislamiento» (código 4) y no una ejecución en el equipo. (P1)
- [ ] **CA-006-02**: Un descriptor de prueba para un lenguaje inventado, escrito en el directorio de pruebas y no en el código, pasa la batería y produce un plan de imagen y de pruebas **sin modificar ningún módulo del motor**. (P1)
- [ ] **CA-006-03**: Un lenguaje solo figura como «soportado» en el README y en `docs/limitations.md` si tiene descriptor, batería en verde y, para el ciclo completo, una ejecución real registrada en Linux. Una prueba compara la lista de la documentación con la de los descriptores. (P1)
- [ ] **CA-006-04**: El texto «modo clásico para otros lenguajes» de `docs/limitations.md:14` no puede decir que se ejecutan otros lenguajes si no hay descriptor. (P2)

### HU-007: Java después, con las mismas reglas
**Como** consultora con proyectos Java o Kotlin
**Quiero** saber que mi lenguaje llegará por el mismo camino
**Para** planificar

**Criterios de aceptación:**
- [ ] **CA-007-01**: Esta especificación **no** entrega el descriptor de Java ni de Kotlin. Entrega el camino: HU-006 demuestra que se puede añadir sin tocar el motor. (P1)
- [ ] **CA-007-02**: Hasta que exista el descriptor de Java, un proyecto Java termina con el error de lenguaje no soportado (CA-003-03) y la documentación lo dice. (P1)

## 5. Escenarios de Uso

### Escenario 1: Caso feliz
**Dado** un proyecto Python con `uv.lock` y pruebas
**Cuando** se ejecuta el ciclo verificado
**Entonces** el motor detecta el gestor por el archivo de bloqueo, instala las dependencias en la fase con red, ejecuta las pruebas sin red y el resultado es idéntico en forma al de cualquier otro lenguaje.

### Escenario 2: Caso de error
**Dado** un proyecto Python con `uv.lock` y `poetry.lock`
**Cuando** se ejecuta el ciclo
**Entonces** el motor se detiene con un error de configuración que lista ambos archivos y no instala nada.

### Escenario 3: Caso borde
**Dado** un proyecto Java sin descriptor y el modo clásico pedido
**Cuando** se ejecuta `fragua run --motor clasico`
**Entonces** el motor sale con el error de «lenguaje no soportado» y su código, sin ejecutar `npm test` ni ninguna otra orden.

## 6. Requisitos Funcionales

- **RF-001**: El motor DEBE obtener de un descriptor todo lo específico de un lenguaje: detección, imagen, instalación, comando de pruebas, entorno, códigos de salida y soporte de mutación.
- **RF-002**: Los descriptores DEBEN validarse contra un esquema cerrado y NO DEBEN provenir del proyecto analizado.
- **RF-003**: JavaScript/TypeScript, Python y Go DEBEN comportarse exactamente igual tras la migración (caracterización primero).
- **RF-004**: Para Python, el gestor DEBE decidirse por el archivo de bloqueo y la instalación DEBE ocurrir solo en la fase con red.
- **RF-005**: Un lenguaje sin descriptor DEBE ser un error con código propio; el motor NO DEBE ejecutar el de otro lenguaje.
- **RF-006**: Una mutación imposible DEBE reportarse como `not_evaluable`, nunca como aprobada.
- **RF-007**: Añadir un lenguaje DEBE exigir solo un descriptor y pasar la batería de conformidad.
- **RF-008**: El sistema NO DEBE añadir dependencias nuevas (Principio IV) ni ejecutar código generado en el anfitrión (Principio V).

## 7. Requisitos No Funcionales

| Categoría | Requisito | Métrica |
|---|---|---|
| Compatibilidad | Sin cambios para JS/TS, Python con `requirements.txt` y Go | 0 valores esperados cambiados en la suite existente |
| Seguridad | Imágenes inmutables; instalación solo con red controlada; descriptor solo del paquete | 0 imágenes sin huella; 0 descriptores del proyecto aceptados |
| Mantenibilidad | Un lenguaje nuevo toca un archivo de datos y su batería | 0 módulos del motor modificados en la prueba CA-006-02 |
| Rendimiento | Cargar y validar los descriptores no ralentiza `run` | < 50 ms para los tres [NV: sin medir] |

## 8. Fuera de Alcance (Exclusiones Explícitas)

- ❌ El descriptor de Java, Kotlin, Rust, C#, Ruby, PHP o Dart (Java va después, según el plan; el resto no tiene fecha).
- ❌ Herramientas externas de mutación (mutmut, PIT y semejantes): serían un componente opcional con su propio ADR.
- ❌ Entornos con varios lenguajes en un mismo proyecto.
- ❌ Descriptores definidos por el usuario o por el proyecto (se evalúa más adelante; hoy es un vector de ataque).
- ❌ Cambiar los códigos de salida del motor o la política de aislamiento (`--network none`, solo lectura).
- ❌ La parada honesta del lenguaje no soportado: es `runner-falla-cerrado`.

## 9. Dependencias y Asunciones

### Dependencias
- `2026-11-27-runner-falla-cerrado`: el error de lenguaje sin soporte con código propio.
- ADR-02 (aislamiento con contenedores), ADR-03 (dependencias sin red) y ADR-20 (mutación propia): este trabajo no los cambia.
- ADR-30 (contrato de resultados): el valor `not_evaluable`.
- ADR-36 (descriptor de lenguaje), propuesta: el formato y el lugar de los descriptores.
- CI en verde en Linux (el plan, §5, fase 3) antes de dar un lenguaje por soportado.

### Asunciones
- La imagen de cada lenguaje se sigue fijando por huella de contenido; actualizarla es una decisión revisada, no automática.
- [NECESITA_ACLARACION]: la lista exacta de lo que `stack-detector.js` hoy decide por lenguaje y que debe pasar al descriptor (marcos, base de datos, comandos de lint y de build). Esta especificación solo exige lo que el ciclo usa (detección, imagen, instalación, pruebas, entorno, mutación); lo demás puede permanecer en el detector hasta una segunda fase.
- [NV]: que `uv`, `poetry` y `pipenv` instalen en una imagen sin red una vez construida, y que sus ejecutables funcionen con la raíz de solo lectura.

## 10. Términos del Dominio

- **Descriptor de lenguaje**: archivo de datos que declara todo lo que el motor necesita saber de un lenguaje.
- **Batería de conformidad**: conjunto común de pruebas que un descriptor debe pasar para contar como soportado.
- **Archivo de bloqueo**: archivo que fija las versiones exactas de las dependencias de un proyecto.
- **Prueba de caracterización**: prueba que fija el comportamiento actual, correcto o no, antes de cambiar el código.

## 11. Preguntas Abiertas

- [ ] [POR_DECIDIR]: el formato del descriptor (JSON como propone `C1_arquitectura.md` §3.2, u otro) y su ubicación: se decide en ADR-36.
- [ ] [POR_DECIDIR]: ¿se exige archivo de bloqueo en `mvp` o superior para todos los lenguajes, o solo para Python? El plan lo exige para Python (`C1_arquitectura.md` §3.3). JavaScript ya prefiere `npm ci` cuando hay `package-lock.json` (`preparar-imagen.js:127-131`).
- [ ] [NECESITA_ACLARACION]: el análisis sintáctico de JavaScript usa una biblioteca que ya forma parte del paquete (`mutacion.js`, ADR-20). ¿Se considera parte del núcleo para los descriptores, o se declara «texto» para todos y se pierde precisión? Se decide en ADR-36.
- [ ] [NECESITA_ACLARACION]: el límite de tiempo y de recursos de cada lenguaje (hoy comunes): ¿van en el descriptor? Recomendado: no en la primera entrega.

## 12. Criterios de Éxito Medibles

- Los tres lenguajes migrados con 0 valores esperados cambiados en la suite.
- 1 lenguaje de prueba añadido con 0 módulos del motor modificados.
- 3 gestores de Python detectados por archivo de bloqueo, con 1 de 3 probado con Docker real como mínimo para poder declararlo soportado (el resto, «no probado»).
- 0 literales de lenguaje en las decisiones de los módulos de detección, imagen, ejecución y mutación.

## 13. Referencias

- `core/stack-detector.js:10,36-145`, `core/runners/index.js:20-31`, `core/sandbox/preparar-imagen.js:24-40,56-72,111-135`, `core/sandbox/sandbox-runner.js:17-36,64-72,193`, `core/ciclo/mutacion.js:1-14,49-58`.
- `research_notes/Consejo plan consolidado Forja/C1_arquitectura.md` §3 (agnosticismo de lenguaje).
- `reports/Plan consolidado de modos y componentes Forja.md` §5 (fase 8), §6.
- `.sdd/arquitectura/ADR-02`, `ADR-03`, `ADR-20`, `ADR-30` y `ADR-36-descriptor-de-lenguaje.md`.
- Especificaciones `2026-11-27-runner-falla-cerrado` y `2026-11-27-modos-de-riesgo-y-persona`.

## 14. Historial de Aclaraciones

| # | Categoría | Pregunta | Decisión | Fecha |
|---|-----------|----------|----------|-------|
| 1 | Alcance | ¿Java en esta entrega? | No: va después de tener JS/TS, Python y Go verdes en Linux (plan, fase 8) | 2026-11-27 |
