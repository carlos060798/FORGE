# Checklist de Calidad: 2026-10-03-ciclo-verificado

> Fecha: 2026-10-03 | Veredicto: NECESITA_REVISION (primera pasada)
>
> **Actualización 2026-10-03:** el hallazgo crítico B1 quedó resuelto: las seis preguntas se cerraron con el valor recomendado bajo la aprobación automática del dueño (spec §14, filas 5 a 12). Los cinco ítems parciales siguen abiertos y no bloquean. Conviene volver a pasar `/sdd.checklist`.

## Puntuación
- Total: 37 ítems | Pasados: 31 | Fallidos: 1 | Parciales: 5
- Cobertura: 84 %

## A. Calidad de Contenido
- [✅] A1: Sin detalles de implementación — las secciones 1 a 12 no nombran lenguajes, bibliotecas ni herramientas.
- [✅] A2: Foco en valor para usuario — cada historia parte de una necesidad del dueño o del operador.
- [⚠️] A3: Legible por no-técnico — HU-001 a HU-005 lo son; HU-006 y HU-007 usan "punto de guardado", "huella" y "contexto", definidos en la sección 10.
- [✅] A4: Secciones obligatorias completadas — las 14.
- [✅] A5: Frontmatter bien formado — los 9 campos.

## B. Completitud de Requisitos
- [❌] B1: Sin [NECESITA_ACLARACION] críticos — hay 6 abiertos; 3 cambian el diseño (ámbito del presupuesto, dónde se escribe el código, lenguajes cubiertos).
- [✅] B2: Requisitos testeables — los 16 RF se expresan como comportamiento observable.
- [⚠️] B3: Sin ambigüedad — "un modelo más barato" (CA-004-01) queda indefinido hasta resolver la pregunta 2.
- [✅] B4: Dado/Cuando/Entonces formal — los 9 escenarios.
- [✅] B5: Escenarios completos — feliz, error, borde, dependencias, datos extremos, concurrencia, reanudación.
- [✅] B6: Fuera de alcance definido — 10 exclusiones.
- [✅] B7: Dependencias identificadas — S0, sistema de aislamiento, proveedor.
- [✅] B8: Asunciones explícitas — 4, dos de ellas marcadas.

## C. Calidad de CAs
- [✅] C1: IDs únicos — 39 criterios, sin repetidos.
- [⚠️] C2: Atómicos — CA-005-02 agrupa tres decisiones (continuar, aceptar, abortar).
- [✅] C3: Observables externamente
- [✅] C4: Prioridad asignada — 31 P1, 7 P2, 1 P3.
- [✅] C5: Convertible a test

## D. Cobertura de Escenarios
- [✅] D1: Caso feliz — escenario 1.
- [✅] D2: Caso de error — escenario 2.
- [✅] D3: Caso borde — escenarios 3 y 4.
- [✅] D4: Concurrencia (si aplica) — escenario 8.
- [✅] D5: Datos extremos — escenario 7.
- [✅] D6: Fallos de dependencias — escenarios 5 y 6.

## E. Cumplimiento de Constitución
- [✅] E1: Restricciones respetadas
- [⚠️] E2: Estándares de calidad — la constitución tiene diferidos el linter, el formateador y la cobertura, y está sin ratificar.
- [✅] E3: Sin conflictos con principios — la spec desarrolla los principios V a IX.
- [✅] E4: Versión registrada — `constitucion_version: 1.0.0`.

## F. Dominio
- [✅] F1: Términos nuevos listados — 12, en la sección 10 y en el glosario.
- [✅] F2: Consistencia con glosario
- [✅] F3: Sin sinónimos confusos — el glosario fija "entorno aislado" frente a "sandbox" como nivel del interruptor de circuito.

## G. Trazabilidad
- [✅] G1: CAs vinculados a historias — por el identificador `CA-{HU}-{NN}`.
- [✅] G2: RFs vinculados a objetivo
- [✅] G3: Enlaces a recursos externos — sección 13.

## H. Métricas
- [✅] H1: Criterios medibles — sección 12, con número.
- [⚠️] H2: Alcanzables — el límite de 5 s para el aislamiento no tiene línea base medida.
- [✅] H3: Verificables post-lanzamiento

## Hallazgos críticos

1. **B1 — preguntas abiertas que cambian el diseño.** Antes de aprobar la spec hay que responder:
   - ¿El tope de gasto es por sesión o por tarea?
   - ¿El código se escribe en el proyecto real con respaldo, o en una copia que se aplica al pasar?
   - ¿Qué lenguajes cubre la primera entrega?

   Las otras tres (destino de la degradación, versión del entorno de ejecución, tiempo añadido por el aislamiento) no bloquean la aprobación, pero sí la del plan.

## Recomendaciones

1. Responder las 6 preguntas con `/sdd.aclarar`; las respuestas van a la sección 14 de la spec.
2. Dividir CA-005-02 en tres criterios, uno por decisión.
3. Medir el tiempo de arranque del entorno aislado en el spike T002 y fijar con ese dato la métrica de rendimiento.
4. Ratificar la constitución y decidir linter, formateador y cobertura.
5. Volver a pasar `/sdd.checklist` tras las aclaraciones. Este checklist se rellenó a mano con la plantilla; el comando añade los ítems B9 y B10, que aquí no se evaluaron.
6. Aprobar con `forge aprobar spec` solo cuando el veredicto sea APROBADA.

## Veredicto

**NECESITA_REVISION.** La spec es completa y testeable, pero un ítem crítico (B1) falla por decisiones que solo el dueño puede tomar.
