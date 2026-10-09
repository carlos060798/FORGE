# AGENTS.md — {{NOMBRE}}

<!-- Generado por FORGE a partir de su plantilla mínima: el proyecto aún no tiene constitución.
     Cuando la tenga (/sdd.constitucion), vuelve a ejecutar `forge init`: dejará una propuesta
     con sus reglas en .sdd/AGENTS.propuesto.md, sin tocar este archivo. -->

Instrucciones para agentes de código que trabajan en este repositorio. Léelas antes de cambiar nada.

## Cómo ejecutar las pruebas

```
{{PRUEBAS}}
```

Ejecútalas antes de dar un cambio por terminado. Si fallan, el cambio no está terminado.

## Dónde está cada cosa

| Qué | Dónde |
|-----|-------|
| Reglas del proyecto (constitución) | `.sdd/memoria/constitucion.md` (aún por escribir) |
| Especificaciones: qué se pidió y por qué | `.sdd/especificaciones/<id>/spec.md` |
| Decisiones de arquitectura (ADR) | `.sdd/arquitectura/ADR-NN-*.md` |
| Índice de especificaciones | `.sdd/INDICE.md` |

## Cómo se cambia algo

1. **Todo cambio empieza por una especificación** en `.sdd/especificaciones/`. Si no existe una para lo que vas a hacer, escríbela antes de tocar el código: dice qué y por qué, sin nombrar herramientas.
2. La especificación y el plan los **aprueba una persona**. No marques una aprobación por tu cuenta.
3. Las pruebas se escriben antes que la implementación.
4. Una decisión técnica que no sea trivial se deja escrita como ADR en `.sdd/arquitectura/`.
5. No añadas dependencias sin dejar escrita la razón en un ADR.
6. No escribas secretos en el repositorio, ni en registros, ni en este archivo.
