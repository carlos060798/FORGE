---
id: 2026-11-27-informe-de-entrega
titulo: "Informe de entrega bilingüe (es/en) para el cliente de un freelance, generado desde la cadena de evidencia"
tamano: mediano  # micro | pequeño | mediano | grande
estado: borrador  # borrador | en_revision | aprobada | en_implementacion | completada
creada: 2026-11-27
actualizada: 2026-11-27
autor: humano  # redactada por Claude por encargo del dueño; pendiente de aprobación
constitucion_version: 1.1.0
etiquetas: [informe, entrega, evidencia, bilingue, freelance, garantia, fase-6]
---

# Especificación: Informe de entrega

> **Estado: borrador, sin aprobar.** Fase 6 del `Plan consolidado de modos y componentes Forja` (§5 fase 6: «Informe de entrega para el cliente es/en desde la evidencia», prioridad 5 de C2; §6 spec `informe-de-entrega`). La aprobación es del dueño. Convenciones: **[V-código]** comprobado en este repositorio; **[V-plan]** del plan o las notas; **[NV]** sin verificar.

## 1. Contexto y Motivación

Un freelance que entrega software a un cliente suele tener que demostrar qué hizo, qué se probó y qué no. Forja ya guarda, por cada verificación registrada, un informe encadenado por hash y, si hay clave local, firmado, con spec, commit, pruebas, imagen, modelos, puertas, omisiones y la cadena al informe anterior (`core/evidencia/cadena.js:7`, `:478-520`) [V-código]. Pero ese archivo es técnico y está pensado para una máquina: un cliente no lo lee, y nadie le explica con qué fuerza se puede creer cada afirmación.

El riesgo contrario es el que el plan marca como «falsa garantía» (riesgo «Muy alta» en §8.1): un informe bonito que parezca decir «verificado y seguro» cuando la firma es local, la spec la aprobó el propio freelance o parte de las puertas no se evaluó. El informe de entrega debe ser **tan claro como honesto**: explica lo que hay y, con el mismo peso, lo que no se puede afirmar.

## 2. Objetivo

Que, con un solo mandato, el freelance obtenga un documento para su cliente en español y en inglés, derivado únicamente de la cadena de evidencia verificada del proyecto, que diga qué se pidió, qué se probó, con qué resultado, con qué nivel de garantía y con qué limitaciones, sin afirmar nada que la cadena no respalde.

## 3. Usuarios y Actores

| Actor | Rol | Necesidad principal |
|---|---|---|
| Freelance o agencia pequeña | Genera y entrega el informe | Un documento presentable que demuestre el trabajo sin exagerarlo |
| Cliente del freelance | Lee el informe; puede no ser técnico | Entender qué recibió, qué se comprobó y qué riesgo queda, en su idioma |
| Dueño del proyecto | Aprueba la spec y es responsable del contenido | Que el informe no afirme más de lo que Forja puede probar |
| Tercero que audita (futuro) | Verifica la evidencia | Poder comprobar el informe contra la cadena (hoy solo posible en la máquina que firmó) |

## 4. Historias de Usuario

### HU-001: Generar el informe desde la cadena
**Como** freelance
**Quiero** generar el informe de entrega de un proyecto
**Para** adjuntarlo a la entrega

**Criterios de aceptación:**
- [ ] **CA-001-01**: La orden produce el informe a partir de los informes de `.sdd/verificaciones/` y de nada más: ningún dato se pide a un modelo ni se toma de texto libre del repositorio. Sin llamada a modelo, sin red. (P1)
- [ ] **CA-001-02**: Antes de generar, comprueba la cadena (`comprobarEvidencia`, `core/evidencia/cadena.js:420`) [V-código]. Con la cadena rota (nivel `rota`) no genera el informe: sale con un código de salida distinto de 0 y dice qué informe y qué campo no cuadran. (P1)
- [ ] **CA-001-03**: Con la cadena vacía (nivel `vacia`) o sin ninguna verificación registrada, no genera un informe vacío: sale con código distinto de 0 y explica cómo registrar una verificación. (P1)
- [ ] **CA-001-04**: El informe indica a qué informe de la cadena corresponde (su `sha256`) y la posición de la cadena, de modo que cualquiera con la cadena pueda comprobar que el documento no se refiere a otro. (P1)
- [ ] **CA-001-05**: El informe se guarda en una ruta del proyecto bajo `.sdd/`, nunca fuera del árbol, y no sobrescribe un informe anterior sin avisar. (P1)
- [ ] **CA-001-06**: Generarlo no altera la cadena ni el estado de ningún ciclo (solo lectura de la evidencia; la comprobación no escribe, como dice `cadena.js` en la descripción de `recorrer`) [V-código]. (P1)

### HU-002: Contenido: qué se pidió, qué se probó y con qué resultado
**Como** cliente
**Quiero** ver qué se pidió, qué se comprobó y qué salió
**Para** decidir si acepto la entrega

**Criterios de aceptación:**
- [ ] **CA-002-01**: El informe incluye: identificador y huella de la especificación entregada, si el proyecto declara que fue aprobada y **quién la aprobó o que el proyecto no lo registra** (hoy la evidencia deja `aprobador: null`, `cadena.js:486,502`) [V-código], el commit, la fecha, la versión de Forja y las puertas con su resultado (`pasa`, `falla`, `no_evaluable`). (P1)
- [ ] **CA-002-02**: Cada afirmación del informe se toma de un campo de la evidencia y el informe lo cita (informe de la cadena y campo). Una afirmación sin campo no existe en el informe. (P1)
- [ ] **CA-002-03**: Las puertas no ejecutadas, `no_evaluable` o con herramienta ausente se muestran **con el mismo peso** que las que pasan, en una sección propia «Lo que no se comprobó». (P1)
- [ ] **CA-002-04**: El informe lista el proveedor y modelo usados (de `modelos`) y la frase «el gasto calculado por Forja nunca se comparó con una factura» mientras siga vigente esa limitación en `docs/limitations.md` [V-código]. Si la evidencia no trae modelos, dice «sin modelo». (P1)
- [ ] **CA-002-05**: El informe no incluye código fuente, secretos, rutas absolutas del equipo del freelance, nombres de usuario del sistema ni texto de plataformas; todo campo de texto sale con el mismo saneado que la evidencia (`texto()` de `cadena.js:62`) y pasa por redacción de secretos. (P1)
- [ ] **CA-002-06**: Si el proyecto declara qué cosas son «mínimos» de entrega o hay un resumen de lo construido en la spec, el informe puede citar el título de la spec, pero no parafrasea con un modelo ni inventa un resumen. (P2)

### HU-003: Nivel de garantía honesto
**Como** dueño del proyecto
**Quiero** que el informe diga con qué fuerza se puede creer
**Para** que el cliente no entienda más de lo que hay

**Criterios de aceptación:**
- [ ] **CA-003-01**: El informe muestra un **nivel de garantía** (G0 a G3 del plan §3.8) calculado por reglas deterministas sobre la evidencia, y la tabla que explica qué significa ese nivel y los otros. (P1)
- [ ] **CA-003-02**: El nivel no puede ser más alto que lo que la evidencia respalda: sin aislamiento comprobado en el contenedor, no hay G2; con clave HMAC local, no hay G3; con herramientas `no_evaluable`, no sube de G1. Una prueba por regla. (P1)
- [ ] **CA-003-03**: Mientras la firma sea HMAC con clave local, el informe dice con esas palabras «firma local, no verificable por terceros» (`docs/limitations.md`; plan §3.8) [V-código]. Sin clave: «encadenada, no firmada» (nivel `encadenada_sin_firma`, `cadena.js:290,408-410`) [V-código]. (P1)
- [ ] **CA-003-04**: El informe lista los **bypasses** usados en la evidencia (`--force`, proveedor de pruebas, `clasico`, modo rebajado) [V-plan: §3.8]. Si la evidencia no permite saber si se usó alguno, el informe dice «no se puede saber» y no «ninguno». (P1)
- [ ] **CA-003-05**: Si el nivel de garantía aún no está registrado en la evidencia (spec `nivel-de-garantia-en-evidencia` sin implementar; hoy no existe ningún campo así en `core/`) [V-código: sin coincidencias de `nivel_garantia` ni `G0` en `core/**/*.js`], el informe lo deriva con las reglas conservadoras de CA-003-02 y lo marca «derivado, no registrado». (P1)
- [ ] **CA-003-06**: El informe nunca usa palabras de garantía no respaldadas («certificado», «garantizado», «seguro», «libre de errores», «aprobado por Forja»). Una prueba de texto sobre las dos lenguas lo comprueba con una lista cerrada de términos prohibidos. (P1)
- [ ] **CA-003-07**: Si una revisión con IA figura en la evidencia, el informe la presenta como **consultiva** (G0) y con su medida de recall o «recall no medido», nunca como aprobación de código. (P2)

### HU-004: Bilingüe es/en
**Como** freelance con un cliente de habla inglesa (o española)
**Quiero** el informe en los dos idiomas
**Para** entregar el mismo documento a quien no lee el otro

**Criterios de aceptación:**
- [ ] **CA-004-01**: La orden genera los dos idiomas en una sola ejecución, con la misma estructura y los mismos datos; elegir uno solo es una opción. (P1)
- [ ] **CA-004-02**: **Paridad**: una prueba compara, entre las dos versiones, cada cifra, fecha, hash, nombre de puerta y estado; cualquier diferencia hace fallar. Solo difiere el texto de las etiquetas y las explicaciones. (P1)
- [ ] **CA-004-03**: Las explicaciones de cada nivel de garantía y de cada estado de puerta existen en las dos lenguas y no tienen término sin traducir salvo nombres propios; una prueba detecta una clave de texto presente en una lengua y ausente en la otra. (P1)
- [ ] **CA-004-04**: Un campo cuyo contenido es texto del proyecto (el título de la spec) se muestra tal cual en ambas versiones, sin traducirlo ni resumirlo con un modelo, y se marca «texto original». (P1)
- [ ] **CA-004-05**: La versión en español es la fuente de verdad del contenido; la inglesa se revisa por una persona antes de la primera versión publicada [NV: quién la revisa]. (P2)
- [ ] **CA-004-06**: Esta spec depende de la enmienda del Principio XII (español primero → bilingüe es/en en los documentos de entrada), que decide el dueño; hasta entonces, el informe en inglés es un **entregable al cliente** y no un documento de gobierno del proyecto. (P1)

### HU-005: Legible para un cliente no técnico
**Como** cliente sin formación técnica
**Quiero** entender el informe sin jerga
**Para** no depender de que el freelance me lo explique

**Criterios de aceptación:**
- [ ] **CA-005-01**: El informe abre con un resumen de menos de una página que dice, en lenguaje llano: qué se entregó, qué se comprobó, qué no, y el nivel de garantía con una frase. (P1)
- [ ] **CA-005-02**: Todo término técnico que aparezca (por ejemplo «mutación», «cadena de evidencia», «HMAC») está definido en un glosario corto del propio informe. (P2)
- [ ] **CA-005-03**: El informe se puede leer sin herramientas especiales: formato de texto estructurado portable. Si se ofrece otro formato (por ejemplo para imprimir) se decide en §11. (P2)
- [ ] **CA-005-04**: El orden de las secciones es fijo y el resultado de las puertas se muestra con texto y no solo con color (accesibilidad). (P2)

### HU-006: Sin efecto si no se pide
**Como** usuario que no entrega a un cliente
**Quiero** que nada cambie
**Para** no pagar la complejidad

**Criterios de aceptación:**
- [ ] **CA-006-01**: Sin ejecutar la orden, no se genera ningún archivo ni se importa ningún módulo del informe (carga perezosa). (P1)
- [ ] **CA-006-02**: El informe no añade dependencias. (P1)
- [ ] **CA-006-03**: Generar el informe no cambia el veredicto de ninguna puerta ni la evidencia registrada (prueba de invariancia). (P1)

## 5. Escenarios de Uso

### Escenario 1: Caso feliz
**Dado** un proyecto con tres verificaciones registradas, la cadena firmada con la clave local y todas las puertas evaluadas
**Cuando** el freelance genera el informe
**Entonces** obtiene dos documentos (es y en) con las mismas cifras, nivel de garantía **G2** como máximo, la frase «firma local, no verificable por terceros» y la lista de lo que no se comprobó (si alguna puerta no se evaluó).

### Escenario 2: Cadena rota
**Dado** un informe de evidencia retocado a mano
**Cuando** se pide el informe de entrega
**Entonces** no se genera nada, el código de salida no es 0 y el mensaje señala el informe y el campo.

### Escenario 3: Todo con el proveedor de pruebas
**Dado** una cadena creada con el proveedor de pruebas
**Cuando** se genera el informe
**Entonces** dice que la verificación usó el proveedor de pruebas y el nivel no supera G1; el informe no se presenta como entrega verificada con modelo real.

### Escenario 4: Sin aprobador registrado
**Dado** una evidencia con `aprobador: null`
**Cuando** se genera el informe
**Entonces** dice «el proyecto no registra quién aprobó la especificación», no un nombre inventado.

### Escenario 5: Herramienta ausente
**Dado** una puerta de seguridad `no_evaluable` por falta de binario
**Cuando** se genera el informe
**Entonces** aparece en «Lo que no se comprobó» con su motivo, y el nivel queda limitado.

## 6. Requisitos Funcionales

- **RF-001**: El sistema DEBE generar el informe solo a partir de la evidencia comprobada.
- **RF-002**: El sistema DEBE negarse a generarlo con la cadena rota o vacía.
- **RF-003**: El sistema DEBE calcular el nivel de garantía con reglas deterministas y mostrar las limitaciones con el mismo peso que los resultados.
- **RF-004**: El sistema DEBE generar es y en con paridad de datos.
- **RF-005**: El sistema NO DEBE llamar a un modelo ni a la red.
- **RF-006**: El sistema NO DEBE afirmar garantía, certificación ni seguridad que la evidencia no respalde.
- **RF-007**: El sistema NO DEBE incluir código, secretos ni rutas absolutas.
- **RF-008**: El sistema NO DEBE modificar la cadena ni el estado del proyecto.

## 7. Requisitos No Funcionales

| Categoría | Requisito | Métrica |
|---|---|---|
| Honestidad | Cada afirmación cita su campo de evidencia | CA-002-02 |
| Reproducibilidad | Misma cadena, mismo informe (byte a byte, salvo la fecha de generación, que se marca aparte) | Prueba que genera dos veces y compara |
| Seguridad | Sin secretos ni rutas absolutas | CA-002-05 |
| Accesibilidad | Estado con texto, no solo color | CA-005-04 |
| Internacionalización | Paridad es/en | CA-004-02, CA-004-03 |
| Rendimiento | Sin llamada externa; tiempo acotado por el tamaño de la cadena | [NV] medir con una cadena grande |

## 8. Fuera de Alcance (Exclusiones Explícitas)

- ❌ Firma asimétrica (SSH/GPG) o verificación por terceros: es G3, spec de equipos (cola del plan, fase 10).
- ❌ Resumen o traducción del contenido con un modelo.
- ❌ Una factura, un cálculo de horas o un informe de gasto como documento contable.
- ❌ Asesoramiento legal o cláusulas de garantía comercial: el informe describe evidencia técnica, no contratos.
- ❌ Más de dos idiomas en esta versión.
- ❌ Enviar el informe al cliente (correo, plataforma). Solo se genera.
- ❌ Informes para equipos, panel o histórico entre proyectos.

## 9. Dependencias y Asunciones

### Dependencias
- Cadena de evidencia existente (`core/evidencia/cadena.js`, spec `2026-10-14-puertas-de-calidad-y-evidencia`) [V-código].
- Spec `nivel-de-garantia-en-evidencia` (campo G0 a G3 obligatorio) [V-plan]; mientras no exista, se aplica CA-003-05.
- Spec `2026-11-27-contrato-de-componente`: el informe es un componente opcional activado por el usuario [V-plan].
- Enmienda del Principio XII (bilingüe es/en) [V-plan §6, decisión del dueño].
- Para la sección de revisión con IA: spec `2026-11-27-componente-revision-ia`.

### Asunciones
- La evidencia declara lo que el proyecto o el cliente afirman (spec aprobada, modelo); la cadena prueba que no se retocó después, no que fuera cierto (`cadena.js:27-28`) [V-código]. El informe lo dice.
- [NECESITA_ACLARACION]: qué campos de la evidencia permiten saber si hubo aislamiento en contenedor y si se usó el proveedor de pruebas o un bypass; hoy la evidencia guarda `imagen`, `modelos` y `omitidos` pero no un campo explícito de «bypass usado» [V-código: `cadena.js:7,498-505`; la lista exacta de campos se confirmará al implementar].

## 10. Términos del Dominio

- **Cadena de evidencia**: informes de verificación encadenados por hash, con firma si hay clave.
- **Nivel de garantía (G0 a G3)**: cuánto se puede confiar en lo que afirma el informe (plan §3.8).
- **No evaluable**: una puerta que no se pudo ejecutar; no es un aprobado ni un fallo.
- **Bypass**: una opción que salta una salvaguarda (`--force`, proveedor de pruebas, modo clásico).
- **Cliente**: quien recibe la entrega; no tiene por qué ser técnico.

## 11. Preguntas Abiertas

- [ ] [POR_DECIDIR]: nombre de la orden (el plan no lo fija) y dónde se guarda el informe.
- [ ] [POR_DECIDIR]: formato de salida (texto estructurado portable es el mínimo; un formato para imprimir queda a decidir y no puede añadir dependencias sin ADR).
- [ ] [POR_DECIDIR]: si el informe se cuenta en la superficie «de entrada» a la que se aplica la enmienda del Principio XII.
- [ ] [NECESITA_ACLARACION]: qué información de coste se muestra al cliente (el gasto de modelos puede ser confidencial del freelance); recomendación del borrador: omitirlo por defecto y mostrarlo solo con una opción explícita.
- [ ] [NECESITA_ACLARACION]: cómo se identifica al freelance y al cliente en la cabecera (el proyecto no registra identidades hoy; no se inventan).
- [ ] [NV]: quién revisa la versión en inglés.

## 12. Criterios de Éxito Medibles

- 100 % de las afirmaciones del informe con su campo de evidencia citado (prueba automática sobre una cadena de ejemplo).
- 0 diferencias de datos entre las versiones es y en (prueba de paridad).
- 0 términos prohibidos de garantía en ambos idiomas.
- Una persona no técnica, en una prueba con ≥ 3 lectores, puede decir qué se comprobó y qué no sin ayuda [NV: no se ha hecho; se registra el resultado aunque sea malo].

## 13. Referencias

- `reports/Plan consolidado de modos y componentes Forja.md` §3.8, §5 (fase 6), §6, §8.1.
- `core/evidencia/cadena.js:7,27-28,62,290,408-410,420,478-520`; `docs/limitations.md` (filas de firma local y gasto).
- `.sdd/especificaciones/2026-10-14-puertas-de-calidad-y-evidencia/`, `2026-11-06-aprobaciones-con-identidad/`.
- `.sdd/memoria/constitucion.md`, Principios XI y XII.

## 14. Historial de Aclaraciones

| # | Categoría | Pregunta | Decisión | Fecha |
|---|-----------|----------|----------|-------|
| – | – | Sin aclaraciones: borrador inicial | – | 2026-11-27 |
