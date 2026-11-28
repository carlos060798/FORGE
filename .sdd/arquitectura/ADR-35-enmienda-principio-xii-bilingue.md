# ADR-35: Enmienda del Principio XII: de «español primero» a bilingüe es/en en los documentos de entrada

> Estado: propuesta  # propuesta | aceptada | obsoleta | reemplazada-por-ADR-XX
> Fecha: 2026-11-27
> Spec relacionada: 2026-11-27-honestidad-documental-2 (HU-003, promesa única en dos lenguas); plan consolidado de modos y componentes, §6 («Enmienda constitucional XII») y §7 (decisión 17)
> Autor: Claude (pendiente de aceptación por el dueño)
> Evidencia: lectura del repositorio el 2026-11-27. No se tradujo nada. Esta enmienda NO se aplica a la constitución hasta que la apruebe el dueño (Principio II y «Gobernanza» de la constitución).

## Contexto

El Principio XII dice: «Los artefactos, los mensajes al usuario y los nombres del dominio DEBEN estar en español», con la razón «es la identidad del producto y la lengua de sus usuarios» (`.sdd/memoria/constitucion.md`, Principio XII). `AGENTS.md` lo repite en «Convenciones».

El plan consolidado propone que Fragua se pueda evaluar y probar fuera del ámbito hispanohablante, empezando por la entrada: quien llega al repositorio lee el README, el contribuir, la política de seguridad y el inicio rápido antes de decidir nada. Lo que ya existe en inglés o en dos lenguas:

- `SECURITY.md:7` acepta avisos «en español o en inglés».
- El sitio de documentación ya lleva textos en las dos lenguas (`docs-site/assets/data.js:68` y `:107`, `:1833` y `:1944`, pares es/en).
- La metodología (comandos, agentes, skills, plantillas), los ADR, las especificaciones y los mensajes de la CLI están en español.

Hay un límite que importa: el Principio XI (honestidad documental) obliga a que dos versiones de un documento digan lo mismo. Mantener dos lenguas duplica el riesgo de contradicción si no se vigila, y el proyecto tiene un solo mantenedor (`GOVERNANCE.md:7`).

## Decisión

Enmendar el Principio XII de modo que **los documentos de entrada y los mensajes de pausa y selector de la CLI sean bilingües es/en**, y que todo lo demás siga en español.

Texto propuesto del Principio XII (reemplaza al actual):

> ### Principio XII: Español primero, entrada bilingüe
>
> Los artefactos, los mensajes al usuario y los nombres del dominio DEBEN estar en español. Los **documentos de entrada** (README, CONTRIBUTING, SECURITY, el inicio rápido y los mensajes de la CLI que piden una decisión a la persona: pausas, selectores y avisos de aprobación) DEBEN publicarse también en inglés, con el mismo contenido. La versión en español es la fuente; en caso de diferencia, manda el español y la diferencia es un defecto. Las especificaciones, los ADR, la constitución, los informes, los comandos, los agentes, las skills, las plantillas y los identificadores del dominio permanecen solo en español.
>
> **Razón:** es la identidad del producto y la lengua de sus usuarios, y la puerta de entrada no debe cerrarse a quien evalúa o contribuye en inglés.

Alcance preciso:

- **Bilingüe (es/en):** `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `QUICK-START.md`, la promesa única de la spec `2026-11-27-honestidad-documental-2`, y los mensajes de pausa y de selector que la CLI muestra al pedir una decisión (aprobación, elección de modo, parada por gasto o por pruebas inestables).
- **Solo en español:** especificaciones, ADR, constitución, informes, `docs/` técnicos, comandos, agentes, skills, plantillas, nombres del dominio, registros y errores de diagnóstico internos.
- **Nombres de órdenes y claves de configuración:** no se traducen (`fragua aprobar`, `sdd.config.yaml`).

Reglas de mantenimiento (a concretar en la especificación que implemente la enmienda):

1. Un archivo fuente por lengua; la versión en inglés no se edita sin cambiar la española en el mismo cambio.
2. Una prueba automática comprueba lo que se pueda decidir sin traducir: que cada documento bilingüe tenga ambas versiones, que las cifras y las órdenes citadas coincidan entre lenguas y que cada mensaje de la CLI en el alcance tenga las dos lenguas.
3. La lengua de los mensajes de la CLI se elige por configuración o por variable de entorno, con el español por omisión; no se detecta la del sistema sin que la persona lo pida [POR_DECIDIR].
4. Se traduce después de la fase 1 del plan consolidado, empezando por tres documentos y los mensajes (decisión 17 del plan).

## Alternativas consideradas

- **A. Mantener «español primero» sin cambios**: rechazada como destino. Cierra la entrada a quien evalúa en inglés y obliga a que lo traduzca cada lector.
- **B. Todo bilingüe, incluidos ADR y especificaciones**: rechazada. Duplica el mantenimiento de documentos que solo lee el equipo; con un mantenedor, se desincronizarían (riesgo para el Principio XI).
- **C. Pasar la entrada a inglés primero**: rechazada. Cambia la identidad que declara la constitución y la lengua de los usuarios actuales.
- **D. Bilingüe solo en la entrada y los mensajes de decisión, con el español como fuente (elegida)**: aceptada porque abre la puerta sin duplicar lo que no se lee desde fuera, y porque la regla «manda el español» da un criterio para resolver diferencias.
- **E. Delegar la traducción a un servicio externo en cada release**: rechazada. Añadiría una dependencia de red y un paso no determinista a la publicación (Principios III y VI).

## Consecuencias

### Positivas
- La entrada del proyecto es legible para quien no lee español, sin renunciar al español como lengua de trabajo.
- La promesa única puede publicarse en dos lenguas con una sola fuente.

### Negativas
- Más superficie que mantener: cada cambio en un documento de entrada es doble.
- Riesgo de divergencia entre lenguas, mitigado con pruebas, pero no eliminado: una prueba no entiende el sentido.
- Los mensajes de la CLI en el alcance necesitan un mecanismo de selección de lengua que hoy no existe [NV: no se revisó cómo se emiten los mensajes de la CLI].

### Neutrales
- Es una enmienda MENOR de la constitución (amplía un principio sin romper la interfaz pública). Obliga a actualizar el informe de sincronización, `AGENTS.md` y las plantillas que repitan el principio (`.sdd/memoria/constitucion.md`, «Gobernanza»).
- La constitución está pendiente de ratificación en una sola versión (1.1.0 frente a 1.0.0, plan consolidado §7 decisión 3): la enmienda se aplica sobre la versión que el dueño ratifique.
- No cambia el idioma de los identificadores ni de los archivos del dominio.

## Cuándo revisitar

- Si tras la traducción las dos lenguas divergen más de una vez en un trimestre [valor propuesto, sin medir].
- Si aparecen contribuidores que trabajen solo en inglés y pidan ampliar el alcance a las especificaciones.
- Si el mantenimiento de dos lenguas supera la capacidad del mantenedor: se recorta a README y SECURITY.

## Referencias

- `.sdd/memoria/constitucion.md` (Principio XII, Principio XI, «Gobernanza»); `AGENTS.md` (Convenciones).
- `SECURITY.md:7`; `docs-site/assets/data.js:68`, `:107`, `:1833`, `:1944`; `GOVERNANCE.md:7`.
- Especificación `2026-11-27-honestidad-documental-2` (HU-003, CA-003-04).
- `reports/Plan consolidado de modos y componentes Forja.md` §6 y §7 (decisión 17).
