---
id: 2026-11-27-nivel-de-garantia-en-evidencia
titulo: "Nivel de garantía en la evidencia: todo informe dice si su veredicto es consultivo, local, aislado o verificable por terceros"
tamano: mediano  # micro | pequeño | mediano | grande
estado: aprobada  # por delegación del dueño el 2026-11-28 (bloque MVP, respuesta «Aprobar bloque MVP por delegación»); pendiente de ratificación
creada: 2026-11-27
actualizada: 2026-11-27
autor: humano  # humano | importado — redactada por Claude a petición del dueño; la aprobación es del dueño
constitucion_version: 1.1.0
etiquetas: [evidencia, garantia, honestidad, anfitrion, stub, fase-4]
---

# Especificación: Nivel de garantía en la evidencia

> **Estado: borrador, sin aprobar.** Mínimo M7 de la spec `2026-11-27-modos-de-riesgo-y-persona` y §3.8-3.9 del plan consolidado. La aprueba el dueño con `fragua aprobar spec`.
>
> Marcas: **[V-código]** comprobado en este worktree el 2026-11-27; **[NV]** no verificado.

## 1. Contexto y Motivación

Fragua se usa de dos formas con garantías muy distintas: el **modo motor** (`fragua run`, `resume`, `verificar`), donde el veredicto lo da el código por código de salida dentro de un contenedor sin red, y el **modo anfitrión** (skills y comandos dentro de Claude Code, Cursor, Codex...), donde las fases las ejecuta el agente del anfitrión y las puertas son texto. Hoy la evidencia no distingue una de otra: el bloque `evidencia` de `core/evidencia/cadena.js` lleva `version, fragua, spec, commit, pruebas, imagen, modelos, aprobador, omitidos, firmado, anterior, sha256, firma` (`cadena.js:7-8`, construido en `:494-509`) y ningún campo de nivel de garantía [V-código]. Además, una ejecución sin clave cae en `stub` con solo un aviso (`core/engine-cli.js:97-106`, «el engine correrá en modo stub») [V-código], y si su evidencia se distingue de una real es [NV]. La firma es HMAC local que solo verifica la misma máquina (`cadena.js:21-22`) [V-código].

El riesgo «falsa garantía en modo anfitrión» es el de mayor gravedad del plan (§8.1). Un cliente o el propio usuario lee «aprobado» y cree que hubo pruebas aisladas cuando hubo un prompt.

## 2. Objetivo

Que **todo** informe y toda evidencia lleven un nivel de garantía obligatorio G0-G3 calculado por el código (no declarado por el modelo), con los metadatos de honestidad que lo justifican; que el modo anfitrión quede en G0 y nunca diga «aprobado»; y que una ejecución `stub` sea inconfundible.

## 3. Usuarios y Actores

| Actor | Rol | Necesidad principal |
|---|---|---|
| Usuario de Fragua | Lee su informe | Saber cuánto vale el veredicto |
| Cliente del freelance | Recibe un informe de entrega | No confundir un prompt con una verificación |
| Agente del anfitrión | Ejecuta fases por prompt | No poder emitir un nivel mayor que G0 |
| Verificador independiente | Audita | Ver bypasses y `not_evaluable` sin buscar |

## 4. Historias de Usuario

### HU-001: Nivel obligatorio en el esquema
**Como** lector de un informe
**Quiero** ver siempre G0, G1, G2 o G3
**Para** saber qué garantiza ese veredicto

**Criterios de aceptación:**
- [ ] **CA-001-01**: El bloque `evidencia` tiene el campo obligatorio `garantia` con valor en la lista cerrada `G0 | G1 | G2 | G3`; un informe sin el campo o con otro valor no pasa la comprobación de la cadena (`comprobarEvidencia`, `cadena.js:420`) y el comando sale con código ≠ 0. (P1)
- [ ] **CA-001-02**: El campo entra en el `sha256` y en la firma: alterarlo después rompe la cadena (prueba de alteración, como las existentes). (P1)
- [ ] **CA-001-03**: Los informes de la versión de evidencia actual (`VERSION_EVIDENCIA = 1`, `cadena.js:49`) siguen siendo legibles y se muestran como «garantía: no registrada (informe anterior)», nunca como G1 o superior. (P1)
- [ ] **CA-001-04**: El nivel lo calcula el código a partir de hechos de la ejecución (motor usado, imagen de aislamiento, rojo→verde comprobado, tope duro activo, `not_evaluable`, firma); ningún valor pasado por el agente, el proyecto o una opción puede subirlo (prueba: pedir G2 sin contenedor ⇒ G1 o G0). (P1)

### HU-002: Reglas de cada nivel
**Como** mantenedor
**Quiero** reglas cerradas para asignar el nivel
**Para** que el mismo hecho dé siempre el mismo nivel

**Criterios de aceptación:**
- [ ] **CA-002-01**: **G0 consultivo** si las fases las ejecutó el agente anfitrión o las puertas fueron prompt, o si no hubo ejecución de pruebas por el motor. (P1)
- [ ] **CA-002-02**: **G1 local** si el motor ejecutó pruebas reales sin aislamiento verificado (`--motor clasico`, modo directo) **o** con alguna herramienta `not_evaluable`. (P1)
- [ ] **CA-002-03**: **G2 aislado** solo si se cumplen a la vez: ciclo en contenedor sin red, rojo→verde comprobado, tope de gasto duro activo y ninguna puerta obligatoria `not_evaluable`. Falta una ⇒ G1 o G0. (P1)
- [ ] **CA-002-04**: **G3 verificable por terceros** exige G2 + firma asimétrica (SSH/GPG) + CI reproducible. Mientras no exista (spec de equipos), el código nunca emite G3 (prueba: ninguna ruta produce `G3`). (P1)
- [ ] **CA-002-05**: El nivel es el mínimo de las condiciones: nunca se redondea hacia arriba (prueba de tabla con todas las combinaciones). (P1)

### HU-003: El modo anfitrión no dice «aprobado»
**Como** cliente que recibe un informe hecho dentro de un editor
**Quiero** que no ponga «aprobado» si nadie ejecutó las pruebas aisladas
**Para** no confiar de más

**Criterios de aceptación:**
- [ ] **CA-003-01**: Un informe G0 no contiene el veredicto `aprobado`/`approved` ni equivalentes; su veredicto es «consultivo: sin verificar» / «advisory: not verified». Prueba de texto sobre las plantillas y la salida, es y en. (P1)
- [ ] **CA-003-02**: Las skills y comandos que corren en el anfitrión indican «G0 — ejecuta `fragua verificar` para G2» al final de su informe (prueba: recorrido de `commands/` y `skills/` que emiten informe [NV: lista exacta]). (P1)
- [ ] **CA-003-03**: Tras `fragua verificar` con éxito en contenedor, el nuevo informe es G2 y referencia al G0 anterior por `anterior` (prueba e2e con imagen; en CI sin Docker la prueba es `not_evaluable`, nunca verde). (P2)

### HU-004: Stub inconfundible
**Como** usuario sin clave de API
**Quiero** que un informe hecho con el proveedor `stub` no pueda pasar por real
**Para** no entregar una demo como trabajo verificado

**Criterios de aceptación:**
- [ ] **CA-004-01**: Toda evidencia de una ejecución con proveedor `stub` lleva `proveedor: stub` y la marca «STUB — sin modelo real» en el informe legible, y su nivel es como máximo G0 aunque el contenedor y las pruebas sean reales [POR_DECIDIR: G0 o G1]. (P1)
- [ ] **CA-004-02**: Un informe stub no puede aparecer en el informe de entrega para el cliente sin la marca (prueba de plantilla). (P1)
- [ ] **CA-004-03**: Que el stub se active solo con `--proveedor stub` explícito es de la spec `stub-explicito`; esta spec solo exige la marca. (P2)

### HU-005: Metadatos de honestidad
**Como** verificador
**Quiero** ver en cada informe todo lo que rebaja su valor
**Para** auditar sin reconstruir la ejecución

**Criterios de aceptación:**
- [ ] **CA-005-01**: Cada informe incluye: modo de riesgo y persona, herramienta anfitriona (o `motor`), proveedor y modelo(s), lista de `not_evaluable`, y bypasses usados (`--force`, `stub`, `clasico`, modo rebajado). Un campo desconocido se registra en `omitidos` con su motivo, como hoy (`cadena.js:481-486`) [V-código]; nunca se omite en silencio. (P1)
- [ ] **CA-005-02**: Mientras la firma sea HMAC local, el informe legible dice «firma local, no verificable por terceros» / «local signature, not third-party verifiable». (P1)
- [ ] **CA-005-03**: Si se usó un bypass, el nivel baja según HU-002 y el bypass aparece listado (prueba por bypass). (P1)

## 5. Escenarios de Uso

### Escenario 1: Caso feliz
**Dado** un proyecto `personal` con Docker
**Cuando** el usuario ejecuta `fragua verificar --registrar`
**Entonces** el informe dice «G2 aislado», firma local no verificable por terceros, sin bypasses.

### Escenario 2: Anfitrión
**Dado** el usuario implementa con `/sdd.implementar` dentro del editor
**Cuando** termina
**Entonces** el informe dice «G0 consultivo: sin verificar» y propone `fragua verificar`.

### Escenario 3: Herramienta ausente
**Dado** puerta `seguridad` declarada y sin binario
**Cuando** se verifica en contenedor
**Entonces** el nivel es G1 y `seguridad` aparece en `not_evaluable`; en `mvp` además el veredicto es fallo (spec de modos, CA-003-03).

## 6. Requisitos Funcionales

- **RF-001**: El sistema DEBE añadir `garantia` y los metadatos de HU-005 al bloque `evidencia` y subir `VERSION_EVIDENCIA`.
- **RF-002**: El sistema DEBE calcular el nivel en el núcleo, a partir de hechos registrados por el motor, con la regla del mínimo.
- **RF-003**: El sistema NO DEBE aceptar un nivel declarado por el agente, el proyecto ni una opción de línea de órdenes.
- **RF-004**: El sistema NO DEBE emitir G3 hasta que exista firma asimétrica y CI reproducible.
- **RF-005**: El sistema NO DEBE escribir «aprobado» en un informe G0.

## 7. Requisitos No Funcionales

| Categoría | Requisito | Métrica |
|---|---|---|
| Integridad | Nivel cubierto por hash y firma | Prueba de alteración |
| Compatibilidad | Informes v1 legibles | Suite de cadena actual en verde |
| Honestidad | Bilingüe es/en en textos del nivel | Prueba de texto en ambos idiomas |

## 8. Fuera de Alcance (Exclusiones Explícitas)

- ❌ Firma asimétrica SSH/GPG y CI reproducible (G3; spec de equipos).
- ❌ Activar el stub solo con opción explícita (spec `stub-explicito`).
- ❌ Hacer que `sdd.implementar` invoque el motor (spec `implementar-por-motor`).
- ❌ Informe de entrega al cliente (spec `informe-de-entrega`; solo se exige que lleve el nivel).

## 9. Dependencias y Asunciones

### Dependencias
- Spec `2026-11-27-modos-de-riesgo-y-persona` (modo y persona en el informe).
- ADR-28 (propuesta).

### Asunciones
- El motor ya sabe, al registrar, si hubo contenedor (campo `imagen`, `cadena.js:501`) y el resultado de las puertas (`resumenDePuertas`, `:455`) [V-código]. Que sepa si el rojo→verde se comprobó en esa misma ejecución es [NV].
- [NECESITA_ACLARACION]: cómo sabe el código que un informe viene del anfitrión si no lo produce el motor: propuesta, todo informe no producido por el motor es G0 por construcción.

## 10. Términos del Dominio

- **Nivel de garantía**: G0 consultivo, G1 local, G2 aislado, G3 verificable por terceros.
- **Bypass**: opción oficial que rebaja la garantía (`--force`, `stub`, `clasico`, modo rebajado).
- **Modo anfitrión / modo motor**: quién ejecuta las fases y da el veredicto.

## 11. Preguntas Abiertas

- [ ] [POR_DECIDIR]: Stub con contenedor y pruebas reales: ¿G0 o G1? Propuesta: G0 (no hubo implementación por un modelo real).
- [ ] [POR_DECIDIR]: ¿El nivel se muestra también en `fragua status`?
- [ ] [NECESITA_ACLARACION]: Nombres en inglés definitivos: «advisory / local / isolated / third-party verifiable».

## 12. Criterios de Éxito Medibles

- 100 % de los informes nuevos con `garantia` (prueba de esquema).
- 0 rutas que emitan G3.
- 0 informes G0 con «aprobado».

## 13. Referencias

- Plan consolidado §3.8, §3.9, §8.1; C3_riesgo_calidad §2.2.4.
- `core/evidencia/cadena.js`; `docs/limitations.md:26` [NV línea].

## 14. Historial de Aclaraciones

| # | Categoría | Pregunta | Decisión | Fecha |
|---|---|---|---|---|
