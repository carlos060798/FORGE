# ADR-17: El ciclo verificado es el modo por defecto y Node ≥20 el mínimo (5.0.0)

> Estado: aceptada  # propuesta | aceptada | obsoleta | reemplazada-por-ADR-XX
> Fecha: 2026-10-09 (aceptada por delegación del dueño)
> Spec relacionada: 2026-10-03-ciclo-verificado
> Autor: Claude
> Reemplaza en parte: ADR-09 (activación opt-in) y la restricción de Node ≥18 de ADR-01

## Contexto

ADR-09 entregó el ciclo en 4.3.0 como opt-in y dejó la 5.0.0 para cuando fuera el modo por defecto y se retirara Node 18. El plan maestro (FASE 5) lo describe como tres pasos: 5.1 el ciclo por defecto, 5.2 retirar Node 18 y decidir si queda un solo motor de grafo, 5.3 declarar el SDK del proveedor en `dependencies`.

El dueño pidió completar la FASE 5 y probarla después. **Todavía no se ha probado el ciclo con un modelo de pago, ni el job de CI `aislamiento` (Linux con Docker real) se ha ejecutado.**

## Decisión

1. **5.1.** `motor.modo` vale `ciclo` por defecto, en el código (`core/ciclo/config.js`) y en la configuración de ejemplo. El modo clásico sigue disponible con `--motor clasico` o `motor.modo: clasico`; todos los mensajes de error del ciclo (sin Docker, etapa equivocada, lenguaje no cubierto) indican cómo usarlo. **Nunca hay una vuelta automática al modo clásico**: ejecutaría en el equipo código que escribió un modelo.
2. **5.2.** `engines.node` pasa a `>=20.0.0`; el CI prueba 20 y 22; `instalar.sh`, `instalar.ps1` y `forge doctor` comprueban la versión. **Se mantienen los dos motores de grafo** (el propio y LangGraph.js opcional): quitar uno es una decisión que necesita datos de un modelo real y no cambia nada hoy. Se revisará después de la primera prueba real.
3. **5.3.** `@anthropic-ai/sdk` pasa a `dependencies`. Antes, sin el SDK instalado, el proveedor devolvía en silencio un texto de relleno.
4. La versión pasa a **5.0.0**, con guía de migración en el CHANGELOG.

## Alternativas consideradas

- **A. Dejar el ciclo opt-in hasta probarlo con un modelo real**: es lo más prudente, pero el dueño pidió completar la fase. Se mitiga con una advertencia explícita en el CHANGELOG y la lista de publicación: **no publicar sin `forge probar-modelo` ni el job `aislamiento`**.
- **B. Volver al clásico si no hay Docker**: rechazada por el Principio de aislamiento (ver ADR-02).
- **C. Hacer LangGraph.js obligatorio o quitarlo**: rechazada por ahora (ver 2).

## Consecuencias

### Positivas
- El comportamiento seguro es el predeterminado: el código generado no se ejecuta en el equipo salvo que el usuario lo pida.
- Un solo valor mínimo de Node; el SDK de Anthropic se instala siempre.

### Negativas / Riesgos
- **Rompe compatibilidad:** quien no tenga Docker, use otro lenguaje o esté en una etapa distinta de `code` verá un error donde antes `forge run` funcionaba. Se documenta en la guía de migración.
- Node 18 deja de estar soportado.
- El valor por defecto cambia sin haber probado el ciclo con un modelo de pago. Es la mayor incertidumbre abierta.
- `@anthropic-ai/sdk` añade unos 18 MB a la instalación.

## Cumplimiento de la constitución

La constitución fija «Runtime: Node ≥18»: se enmienda a ≥20 (v1.1.0). Sin otras dependencias nuevas.
