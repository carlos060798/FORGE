---
id: 2026-11-27-honestidad-documental-2
titulo: "Honestidad documental 2: archivar la narrativa de «fábrica», cerrar las contradicciones y vigilar las órdenes citadas"
tamano: mediano  # micro | pequeño | mediano | grande
estado: aprobada  # por delegación del dueño el 2026-11-28 (bloque MVP, respuesta «Aprobar bloque MVP por delegación»); pendiente de ratificación
creada: 2026-11-27
actualizada: 2026-11-27
autor: humano  # humano | importado
constitucion_version: 1.1.0
etiquetas: [documentacion, honestidad, principio-xi, consistencia, fase-1]
---

# Especificación: Honestidad documental 2

> **Estado: borrador, sin aprobar.** Segunda pasada del Principio XI (la primera está en `docs/PROBLEMAS-CONOCIDOS.md` y en las pruebas de consistencia existentes). Origen: plan consolidado de modos y componentes (`reports/Plan consolidado de modos y componentes Forja.md`, §5 y §6, spec `honestidad-documental-2`; decisión 7 de §7) y las notas L3 (contradicciones C1-C15) y L4 (inconsistencias de gobierno) de `research_notes/Consejo plan consolidado Forja/`. La aprobación es del dueño. Esta especificación **dice qué debe quedar verdadero**; los textos nuevos los redacta quien implemente, y cada texto que afirme una capacidad la verifica contra el código antes de escribirse.

## 1. Contexto y Motivación

El Principio XI exige que ningún documento afirme una capacidad que el código no tiene y que lo no verificado se marque. Una lectura de la documentación (2026-11-27) encontró:

- Un documento, `docs/FABRICA.md`, que promete lo contrario de lo que dicen el resto: «sin escribir una sola línea de código» y publicación en internet (`docs/FABRICA.md:5`), «14 agentes en paralelo» (`:36`, `:86`), coste cero, «puedes confiar en el código» (`:161`, `:186`). Frente a eso, `README.md:37` dice «No (todavía): quien espera «no-code»», y `docs/limitations.md:19` dice que las tareas se ejecutan de una en una. Además cita resultados de usuarios («23 clientes», `:58`) sin evidencia en ningún otro documento. Su cabecera dice «Última revisión: sin registrar» (`docs/FABRICA.md:3`).
- Quince contradicciones entre documentos (C1-C15 de la nota L3) y doce grupos de inconsistencias de gobierno (L4 §5).
- Órdenes citadas en comandos y skills que no tienen prueba que las vigile. Hoy las pruebas de consistencia comprueban agentes, skills, plantillas, enlaces del índice y cifras (`tests/consistency.test.js`, `tests/consistencia-cifras.test.js`), pero no que una orden del terminal citada en un comando o skill exista.
- Una promesa de valor repetida con palabras distintas en cada documento y solo en español, cuando el plan consolidado propone entrada bilingüe (ADR-35, propuesto).

## 2. Objetivo

Que quien lea cualquier documento de entrada encuentre una sola promesa, igual en todos, que el código cumple; que ninguna contradicción conocida siga abierta; que la narrativa de «fábrica sin código» quede como visión archivada y no como descripción del producto; y que una prueba automática impida que un comando o skill cite una orden del terminal que no existe.

## 3. Usuarios y Actores

| Actor | Rol | Necesidad principal |
|---|---|---|
| Persona que evalúa el proyecto | Lee README, QUICK-START y documentos de estado | No ver dos productos distintos según el documento |
| Usuario que sigue un comando o skill | Teclea una orden citada | Que la orden exista |
| Mantenedor | Revisa y publica | Que una contradicción nueva rompa una prueba |
| Dueño | Decide el archivado y la promesa | Una decisión por punto, sin reescritura masiva |

## 4. Historias de Usuario

### HU-001: Archivar `docs/FABRICA.md`
**Como** persona que evalúa el proyecto
**Quiero** que la narrativa de «fábrica sin código» no se presente como el producto
**Para** no esperar lo que el producto no promete

**Criterios de aceptación:**
- [ ] **CA-001-01**: `docs/FABRICA.md` se traslada a `docs/archivo/` con una cabecera que dice que es una visión histórica, que no describe el producto actual y qué documento manda (`docs/ESTADO-ACTUAL.md`, según su propia regla de precedencia, `docs/ESTADO-ACTUAL.md:4`). El texto original no se reescribe. (P1)
- [ ] **CA-001-02**: Las referencias vivas al archivo se actualizan o se retiran: `commands/sdd.ayuda.md:241`, `skills-generadas/sdd-ayuda/SKILL.md:244` (generada desde el comando; se regenera, no se edita a mano, `CONTRIBUTING.md:132`) y `docs/0-INDICE.md:94`. (P1)
- [ ] **CA-001-03**: Ningún documento fuera de `docs/archivo/` enlaza a `docs/FABRICA.md` ni lo presenta como guía para no programadores; el índice sigue sin enlaces rotos. (P1)
- [ ] **CA-001-04**: El archivado no deja a `docs/FABRICA.md` como camino que alguien pueda seguir sin ver la cabecera de visión. (P2)

### HU-002: Cerrar las contradicciones C1-C15
**Como** persona que lee varios documentos
**Quiero** que dos documentos no se contradigan
**Para** poder fiarme de cualquiera

Cada fila indica qué debe quedar verdadero. «Manda» significa el documento que prevalece según la regla de precedencia declarada (`docs/ESTADO-ACTUAL.md:4`). Lo marcado [NV] no se ha verificado contra el código en esta redacción; antes de escribir la resolución se verifica.

| C | Contradicción (resumen) | Qué debe quedar verdadero |
|---|---|---|
| C1 | `FABRICA.md` frente a README, ESTADO-ACTUAL y PUBLICO-OBJETIVO | Resuelta por HU-001 (archivado) |
| C2 | `FABRICA.md` frente a «Qué NO prometer» (`docs/PUBLICO-OBJETIVO.md:64`) | Resuelta por HU-001; PUBLICO-OBJETIVO no cambia |
| C3 | Usuarios externos: «3/3 instalaciones externas» (`docs/PUBLICO-OBJETIVO.md:24`, `:61`) frente a «0» (nota L3, citando `docs/informes/CRITICA-HOSTIL.md` §4 y `CHANGELOG.md:8`) | Una sola cifra, con su fuente y su fecha, o la afirmación se retira. [NV: cuál es la cierta] |
| C4 | Etiqueta de publicación: `beta` (`README.md:26`, `docs/roadmap.md:53`) frente a `next` (`docs/PUBLICO-OBJETIVO.md:66`) | Una sola etiqueta en todos; `beta`, que es la que usan README, hoja de ruta y `RELEASE-CHECKLIST.md`. Decisión del dueño si prefiere otra |
| C5 | Gemini en roles nativos: «7 de 14» (`README.md:66`) frente a «14 de 14» (`docs/PLAN-AGNOSTICO.md:149`) | Una cifra, comprobada contra lo que instala `fragua init --integracion`. [NV: cuál es la cierta] |
| C6 | Herramientas con guardián por `--con-hooks`: seis en `README.md:67`, cuatro en `README.md:79` | El mismo conjunto en ambos sitios, comprobado contra lo que instala el código. [NV] |
| C7 | «Sin Node el guardián bloquea toda acción (falla cerrado)» (`README.md:75`) frente a la reverificación del 2026-11-07 (hueco parcial C-07 del guardián) | O el hueco está cerrado y la afirmación se sostiene con prueba, o el README declara el límite. [NV: estado posterior al 2026-11-07] |
| C8 | La transición `spec → plan` comprueba un registro firmado (`README.md:47`) frente a una puerta que solo miraba el booleano (`core/state-machine.js:65`) | El documento dice exactamente qué caminos verifican la firma. Hoy se verifica en `cli/runner.js:234-235`; que **todos** los caminos la apliquen es [NV] y hasta entonces se declara |
| C9 | ESTADO-ACTUAL lista a OpenAI y Ollama como «probados» con herramientas (`docs/ESTADO-ACTUAL.md:46`); README y limitaciones dicen que solo se probaron contra servidores falsos (`docs/limitations.md:21`) | Un único enunciado: probados con conformidad común contra servidores falsos; solo Anthropic con llamadas reales |
| C10 | «El veredicto no es la opinión de un modelo» frente a «que pasen las pruebas no prueba que el código sea correcto» (`docs/limitations.md:10`) | No es contradicción formal; la promesa única (HU-003) incluye la frase de alcance: el veredicto es sobre las pruebas, no sobre la corrección |
| C11 | Metadatos agnósticos: README ya dice «y otras herramientas» (`README.md:5`); `package.json:4` y `plugin.json:5` hablan de ciclo aislado sin esa precisión | Descripciones de `package.json`, `plugin.json` y `marketplace.json` alineadas con la promesa única |
| C12 | Docker real: «ninguno medido» (`docs/informes/CRITICA-HOSTIL.md`) frente a 597 pruebas con Docker real en Windows (`docs/ESTADO-ACTUAL.md:31`) | Superada. Los informes con fecha se identifican como históricos o llevan una nota de qué quedó superado |
| C13 | Nombre del producto: «Fragua (antes FORGE)», «SDD-ES», «FORGE 5.0», `forja-mvp` | Una sola regla de uso del nombre; decisión de nombre y marca del dueño (decisión 6 del plan). Hasta entonces, «Fragua (antes FORGE)» en los documentos de entrada |
| C14 | Público «no-code» (`README.md:37`) frente a la persona sin conocimientos técnicos de `FABRICA.md` | Resuelta por HU-001 |
| C15 | Cuándo y a quién se anuncia la beta: PUBLICO-OBJETIVO (publicar en la fase 2) frente a `PLAN-DOCUMENTACION-PUBLICA` (no anunciar antes de cerrar las fases 0, 1 y 2) y la hoja de ruta (pendiente de decisión) | Un solo plan de anuncio, decidido por el dueño |

**Criterios de aceptación:**
- [ ] **CA-002-01**: Cada fila C1-C15 queda en uno de estos estados, anotado en `verificacion.md`: resuelta (con el cambio), superada (con la fecha del hecho que la supera), o pendiente de una decisión del dueño (con cuál). Ninguna queda sin estado. (P1)
- [ ] **CA-002-02**: C3, C5, C6, C7 y C8 se resuelven solo después de comprobar el hecho en el código o en una ejecución; si no se puede comprobar, el documento lo dice como no verificado. (P1)
- [ ] **CA-002-03**: Tras los cambios, una búsqueda de la cifra o frase de cada fila en los documentos de entrada devuelve el mismo valor en todos. (P1)
- [ ] **CA-002-04**: Los informes con fecha que ya no describen el estado actual llevan una línea que remite a `docs/ESTADO-ACTUAL.md`; no se reescriben. (P2)

### HU-003: Una sola promesa, en español e inglés
**Como** persona que llega por primera vez
**Quiero** leer la misma frase de valor en todas partes
**Para** saber qué se promete y qué no

La promesa se redacta una vez, en español y en inglés, a partir de lo que ya dicen `README.md:16` y `docs/ESTADO-ACTUAL.md:8`, y se aprueba por el dueño. Propuesta de partida, **no aprobada**:

> **es:** Fragua lleva una idea hasta código probado: una persona aprueba la especificación, otro rol escribe las pruebas y el veredicto sobre el código lo da el código de salida de esas pruebas, ejecutadas en un contenedor sin red, no la opinión de un modelo. Que las pruebas pasen no prueba que el código sea correcto.
>
> **en:** Fragua takes an idea to tested code: a person approves the specification, a different role writes the tests, and the verdict on the code is the exit code of those tests run in a container with no network, not a model's opinion. Passing tests do not prove the code is correct.

**Criterios de aceptación:**
- [ ] **CA-003-01**: La promesa vive en un solo archivo fuente (ambas lenguas) y el README, el QUICK-START, `docs/PUBLICO-OBJETIVO.md`, `docs/ESTADO-ACTUAL.md` y las descripciones de `package.json` y del plugin la repiten sin variaciones o la enlazan. (P1)
- [ ] **CA-003-02**: La promesa no afirma nada que `docs/ESTADO-ACTUAL.md` declare parcial o pendiente (otras herramientas, otros sistemas operativos, integraciones, publicación en npm) sin su matiz. (P1)
- [ ] **CA-003-03**: Una prueba compara la promesa de cada documento citado con el archivo fuente y falla si difieren. (P1)
- [ ] **CA-003-04**: La parte en inglés solo se publica si el dueño aprueba la enmienda del Principio XII (ADR-35); si no, se mantiene la versión en español. (P1)

### HU-004: Cerrar las inconsistencias de gobierno
**Como** mantenedor
**Quiero** que los documentos de gobierno no se contradigan
**Para** que la trazabilidad sirva

Doce grupos, de L4 §5. Todos se verificaron contra el árbol el 2026-11-27 salvo lo marcado [NV].

| I | Inconsistencia | Qué debe quedar verdadero |
|---|---|---|
| I1 | `2026-10-09-validacion-modelo-real`: la cabecera dice `borrador` (`spec.md:5`) y el INDICE `en_implementacion`; «aprobada» se usa para delegada y ratificada | Estado coherente entre INDICE y cabecera. La regla de delegación es de `2026-11-27-gobierno-delegacion` |
| I2 | ADR-17 «reemplaza en parte» ADR-09 (`ADR-17:7`), pero ADR-09 sigue `aceptada` sin nota (`ADR-09:3`) | ADR-09 lleva la nota de reemplazo parcial, en el vocabulario permitido |
| I3 | ADR-09 y ADR-19 con estado `aceptada` y autor «pendiente de aceptación por el dueño» (`ADR-09:6`, `ADR-19:6`) | Estado y autor coherentes: se acepta de verdad o se corrige el estado. Decisión del dueño |
| I4 | ADR-22 a ADR-26 con estado de texto extenso entre paréntesis (línea 3 de cada uno), fuera del vocabulario `propuesta \| aceptada \| obsoleta \| reemplazada-por-ADR-XX` | El campo de estado contiene solo un valor del vocabulario; el matiz va en el cuerpo. (ADR-27 y los nuevos ADR-33 a ADR-35 deben seguir la misma regla) |
| I5 | Conteos desfasados: el informe de decisiones dice «15» borradores (`docs/informes/DECISIONES-PENDIENTES-2026-11.md:17`) y el INDICE tiene 16; `CONTRIBUTING.md:53` dice «hoy el último es el ADR-24» y existen del 25 al 27 | Los conteos salen de una prueba, o se eliminan del texto la cifra que envejece |
| I6 | Principio IV de la constitución: «dos dependencias»; `package.json` declara tres (`package.json:84-86`) y CONTRIBUTING, SECURITY y `docs/mapa-de-modulos.md:31` listan tres | Los documentos dicen el número real tras la decisión de ADR-33 (retirar `sqlite-wasm`, que lo deja en dos) |
| I7 | Versiones: `RELEASE-CHECKLIST.md:9` pide que coincidan «(5.0.0)» y el paquete es `5.0.0-beta.1` (`package.json:3`); `CHANGELOG.md:60` dice `[5.0.0-beta.1] — Sin publicar` | La lista de comprobación nombra la versión de cada paso (beta o estable) sin ambigüedad |
| I8 | Nombre: `.claude-plugin/plugin.json:3` dice `forge`; `package.json:2` dice `fragua`; la constitución dice `forja-mvp` en la tabla de stack | Un solo nombre de paquete en todos los documentos; el nombre del plugin, decisión del dueño |
| I9 | Constitución: cabecera 1.1.0 frente a informe de sincronización 1.0.0 | Una versión coherente; la ratificación y la enmienda son del dueño |
| I10 | Titular: `LICENSE:3` «Danilo Angarita»; `GOVERNANCE.md:7` carlos060798; `.claude-plugin/plugin.json:10` «Danilo Angarita»; `.github/CODEOWNERS:1` `@carlos060798` | Un titular en todos; decisión del dueño |
| I11 | Comando de aprobación: la constitución dice `/sdd.planificar aprobar` (proceso de cambios, paso 3) y `GOVERNANCE.md:27` dice `fragua aprobar` | Un solo comando citado, comprobado contra la CLI |
| I12 | Afirmaciones sobre capacidades: la constitución dice `npm test` «en verde en toda la matriz de CI» y `CONTRIBUTING.md:91` reconoce CI en rojo en Linux; la constitución dice que la cobertura «no se mide» y `package.json:19-20` define comandos de cobertura; `GOVERNANCE.md:27` presenta como hecho una firma que la spec `2026-11-06-aprobaciones-con-identidad` declara sin probar en un terminal real [NV: estado de esa spec leído de la nota L4, no releído aquí] | Cada frase se corrige para decir lo que hoy es cierto, o se marca como objetivo |

**Criterios de aceptación:**
- [ ] **CA-004-01**: Cada fila I1-I12 queda en estado resuelta, superada o pendiente de decisión del dueño, anotado en `verificacion.md`. (P1)
- [ ] **CA-004-02**: Los cambios sobre la constitución (I6, I8, I9, I11, I12) no se aplican sin la aprobación del dueño; esta especificación solo lista qué debe cambiar. (P1)
- [ ] **CA-004-03**: Una prueba comprueba que el campo de estado de cada ADR contiene un valor del vocabulario y nada más. (P1)
- [ ] **CA-004-04**: Una prueba comprueba que el estado del INDICE de cada especificación coincide con el de su cabecera. (P1)

### HU-005: Las órdenes citadas existen
**Como** usuario
**Quiero** que toda orden `fragua <x>` o `forge <x>` que un comando o skill me pida teclear exista
**Para** no encontrar «Comando desconocido»

**Criterios de aceptación:**
- [ ] **CA-005-01**: Una prueba de consistencia recorre `commands/` y `skills/`, extrae cada orden del terminal de la forma `fragua <palabra>` o `forge <palabra>`, y comprueba que `<palabra>` figura como caso del selector de órdenes de `cli/index.js` (`switch (comando)`, hoy `cli/index.js:135`, que termina en `default:` con «Comando desconocido», `cli/index.js:287-288`). (P1)
- [ ] **CA-005-02**: Las menciones con barra inicial (`/forge why`, `/forge share`, `/forge progress`, `/forge explica`, `/forge deploy`, `/sdd.…`) son alias de Claude Code y no órdenes del terminal; la prueba las excluye por su forma, y comprueba aparte que cada alias citado esté declarado en el skill o comando correspondiente. (P1)
- [ ] **CA-005-03**: Hoy las órdenes de terminal citadas son `status`, `logs`, `doctor`, `ui` y `adr` (`commands/sdd.ayuda.md:86-89`, `commands/sdd.adr.md:145`, `commands/sdd.optimizar.md:15`, `skills/adr-indexer/SKILL.md:168`, `skills/explicame/SKILL.md:105`), todas presentes en el selector; la prueba pasa sin cambios en esos archivos. (P1)
- [ ] **CA-005-04**: Si se añade en un comando o skill la orden `fragua inexistente`, la prueba falla y nombra el archivo, la línea y la orden. (P1)
- [ ] **CA-005-05**: La prueba no ignora una orden por estar dentro de un bloque de código; sí ignora palabras de prosa que siguen a «forge» sin ser una orden (p. ej. «`# /forge siempre arranca en modo guiado`», `commands/forge.md:20`), mediante una lista de excepciones con justificación en la que cada entrada que ya no se necesita hace fallar la prueba (mismo criterio que la lista blanca de la especificación `2026-11-12-proveedor-no-fijado`, CA-004-02). (P1)
- [ ] **CA-005-06**: La prueba no ejecuta ninguna orden ni llama a un modelo; solo lee archivos. (P1)

## 5. Escenarios de Uso

### Escenario 1: Caso feliz
**Dado** el árbol tras los cambios
**Cuando** se ejecuta la suite de pruebas
**Entonces** pasan la prueba de órdenes citadas, la de promesa única y la de estados, y `docs/0-INDICE.md` no tiene enlaces rotos.

### Escenario 2: Caso de error
**Dado** un skill nuevo que dice «ejecuta `forge verificar-todo`»
**Cuando** se ejecuta la suite
**Entonces** falla con el archivo, la línea y la orden inexistente.

### Escenario 3: Caso borde
**Dado** una cifra que cambia (p. ej. el número de ADR)
**Cuando** alguien la actualiza en un documento y no en otro
**Entonces** la prueba de cifras existente o la nueva lo detecta; no depende de que alguien lo recuerde.

## 6. Requisitos Funcionales

- **RF-001**: El sistema DEBE tener una sola promesa de valor, en una sola fuente, repetida o enlazada desde los documentos de entrada.
- **RF-002**: El sistema DEBE vigilar con una prueba que toda orden de terminal citada en `commands/` y `skills/` exista en la CLI.
- **RF-003**: El sistema DEBE dejar `docs/FABRICA.md` archivado con una cabecera que lo declare visión histórica.
- **RF-004**: El sistema NO DEBE afirmar en un documento de entrada una capacidad que `docs/ESTADO-ACTUAL.md` declare pendiente o parcial sin su matiz.
- **RF-005**: El sistema NO DEBE reescribir los informes con fecha ni los documentos archivados; los marca.

## 7. Requisitos No Funcionales

| Categoría | Requisito | Métrica |
|-----------|-----------|---------|
| Mantenibilidad | Las pruebas nuevas leen archivos y no necesitan Docker, red ni clave | 0 dependencias de entorno |
| Honestidad | Toda cifra o capacidad afirmada tiene una fuente o se marca [NV] | Revisión del verificador |
| Lenguaje | La parte en inglés de la promesa solo existe si se aprueba ADR-35 | CA-003-04 |

## 8. Fuera de Alcance (Exclusiones Explícitas)

- ❌ Traducir los documentos de entrada a inglés (plan consolidado §7, decisión 17: después de la fase 1; esta especificación solo fija la promesa).
- ❌ Decidir el nombre, la marca o el titular (decisiones 6 y 10 del dueño); solo exige que los documentos sean coherentes con lo que decida.
- ❌ Reescribir `docs/informes/` o `docs/archivo/`.
- ❌ Cambiar el código de la CLI; las pruebas lo leen.
- ❌ Aprobar ADR (22 a 27 y los nuevos) o ratificar la constitución.

## 9. Dependencias y Asunciones

### Dependencias
- `2026-11-27-gobierno-delegacion` (vocabulario «delegada» / «ratificada»).
- ADR-33 (número de dependencias) y ADR-35 (idioma), ambos propuestos.

### Asunciones
- `docs/ESTADO-ACTUAL.md` manda en caso de conflicto de cifras (`docs/ESTADO-ACTUAL.md:4`).
- Las citas con número de línea de las notas L3 y L4 se leyeron de esas notas y se comprobaron una por una el 2026-11-27 las que aparecen aquí con archivo y línea; lo demás es [NV].
- [NV] Que no existan más órdenes citadas en `docs/`, `README.md` o `QUICK-START.md`: el alcance de la prueba es solo `commands/` y `skills/`. Ampliarlo es una decisión posterior.

## 10. Términos del Dominio

- **Promesa única:** la frase de valor del producto, la misma en todos los documentos de entrada.
- **Orden citada:** texto de la forma `fragua <palabra>` o `forge <palabra>` que un comando o skill indica teclear en el terminal.
- **Alias de Claude Code:** orden con barra inicial dentro de Claude Code; no es una orden del terminal.

## 11. Preguntas Abiertas

- [ ] [POR_DECIDIR]: texto exacto de la promesa única (la de la sección HU-003 es una propuesta).
- [ ] [POR_DECIDIR]: etiqueta de publicación (C4), nombre y marca (C13), plan de anuncio (C15), titular (I10).
- [ ] [NECESITA_ACLARACION]: cifra real de instalaciones externas (C3).
- [ ] [POR_DECIDIR]: ¿se amplía la prueba de órdenes a `docs/`, `README.md` y `QUICK-START.md`?

## 12. Criterios de Éxito Medibles

- 15 de 15 contradicciones con estado anotado; 12 de 12 inconsistencias con estado anotado.
- 0 órdenes de terminal citadas en `commands/` y `skills/` que no existan en la CLI.
- 1 sola promesa, con 0 variaciones entre documentos de entrada.
- 0 referencias vivas a `docs/FABRICA.md` fuera de `docs/archivo/`.

## 13. Referencias

- `reports/Plan consolidado de modos y componentes Forja.md` §5, §6, §7 (decisiones 7 y 17).
- `research_notes/Consejo plan consolidado Forja/L3_vision_promesas.md` (C1-C15) y `L4_gobierno.md` §5.
- `docs/FABRICA.md`, `docs/ESTADO-ACTUAL.md`, `docs/PUBLICO-OBJETIVO.md`, `docs/limitations.md`, `README.md`.
- `tests/consistency.test.js`, `tests/consistencia-cifras.test.js` (pruebas de consistencia existentes); `cli/index.js:135-288`.
- ADR-33, ADR-34 y ADR-35 (propuestos, 2026-11-27); especificación `2026-11-27-gobierno-delegacion`.

## 14. Historial de Aclaraciones

| # | Categoría | Pregunta | Decisión | Fecha |
|---|-----------|----------|----------|-------|
| 1 | Alcance | ¿Archivar o reescribir `docs/FABRICA.md`? | Archivar con cabecera de visión (recomendación del plan, decisión 7); falta la decisión del dueño | – |
