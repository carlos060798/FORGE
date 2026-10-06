# ADR-16: La guarda de escritura lee los ADR de `.sdd/arquitectura` solo en su sección «Patrones prohibidos»

> Estado: aceptada  # propuesta | aceptada | obsoleta | reemplazada-por-ADR-XX
> Fecha: 2026-10-05 (aceptada por delegación del dueño)
> Spec relacionada: 2026-10-03-saneamiento (CA-004-01)
> Autor: Claude

## Contexto

La guarda de escritura (`claude-hooks/pre-tool-guard.js`) bloquea contenido que contenga un término prohibido por un ADR, pero lo busca en `.sdd/adrs/`, una carpeta que ningún comando crea. Los ADR reales viven en `.sdd/arquitectura/` (ADR-10), así que la guarda no protegía nada. Apuntarla allí tal cual no servía: extrae los términos con una heurística sobre texto libre («evitar X», «NO usar X»), y los ADR citan esas expresiones al describir alternativas rechazadas, de modo que bloquearía escrituras legítimas.

## Decisión

La guarda lee además `.sdd/arquitectura/ADR-NN-*.md`, con tres reglas:

1. **Solo ADR con `Estado: aceptada`.** Propuestos, obsoletos y reemplazados no bloquean.
2. **Solo los términos de la sección `## Patrones prohibidos`**: una lista con un término entre comillas invertidas por línea. La sección termina en el siguiente encabezado `##`. Nada se deduce del texto libre.
3. **Los archivos bajo `.sdd/` quedan exentos del patrón nuevo**, para que un ADR pueda nombrar lo que prohíbe.

El comportamiento sobre `.sdd/adrs/` no cambia.

## Alternativas consideradas

- **A. Apuntar la heurística actual a `.sdd/arquitectura`**: rechazada, bloquea escrituras legítimas (es lo que dejó el criterio por decidir).
- **B. Dejar la guarda como estaba y quitar el criterio**: rechazada, deja una protección que parece activa y no hace nada.
- **C. Sección explícita y solo ADR aceptados**: aceptada. Es predecible y el autor decide qué se prohíbe.

## Consecuencias

### Positivas
- Un ADR aceptado puede hacer cumplir una prohibición concreta sin falsos positivos por texto libre.

### Negativas / Riesgos
- La coincidencia es por subcadena, sin distinguir mayúsculas: un término corto o común bloquearía de más. Se ignoran los de 3 caracteres o menos y los de 50 o más.
- Solo mira el contenido propuesto, no el que ya existe en el archivo.
- Nadie ha escrito aún secciones `Patrones prohibidos` en los ADR del repo: la guarda queda lista, sin reglas activas.

## Cumplimiento de la constitución

Sin dependencias nuevas. Cubierto por `tests/guarda-adr-arquitectura.test.js`.
