# ADR-09: Activación opt-in en 4.3.0, por defecto en 5.0.0

> Estado: aceptada  # propuesta | aceptada | obsoleta | reemplazada-por-ADR-XX
> Fecha: 2026-10-03 (aceptada el 2026-10-05, por delegación del dueño)
> Spec relacionada: 2026-10-03-ciclo-verificado
> Autor: Claude (pendiente de aceptación por el dueño)

## Contexto

Los documentos de partida llaman "FORGE v2" a este trabajo, pero el paquete está en 4.2.0 y `docs/roadmap.md:50` ya usa "v2" para otra cosa (un driver headless). El ciclo cambia cómo se ejecutan las tareas de código y exige Docker.

## Decisión

- El programa se llama **"FORGE Motor Agéntico"**; la primera spec, **"Ciclo Verificado"**. Se deja de usar "v2".
- El ciclo se entrega en **4.3.0** como opt-in: `motor.modo: clasico | ciclo` en la configuración, o `--motor ciclo`. El valor por defecto es `clasico`.
- Con el ciclo activo, `forge run` exige que la etapa sea `code`, salvo `--force true`, y las tareas de código se ejecutan en secuencia.
- **5.0.0** queda para cuando el ciclo sea el modo por defecto y se retire Node 18.

## Alternativas consideradas

- **A. Activado por defecto desde ya**: rechazada porque rompe a quien no tiene Docker (Principio X).
- **B. Rama o paquete separado**: rechazada porque duplica mantenimiento y contradice "mejora incremental".
- **C. Opt-in con versión MENOR**: aceptada.

## Consecuencias

### Positivas
- Nadie se ve afectado sin pedirlo (CA-008-01).
- La numeración deja de chocar con la del paquete.

### Negativas
- Dos caminos de ejecución que probar hasta 5.0.0.

### Neutrales
- Los flags del CLI son clave-valor porque `parseArgs` consume por pares (`core/engine-cli.js:49-58`).

## Cuándo revisitar

- Cuando S1 a S4 estén estables: activar por defecto (S5).

## Referencias

- `package.json:3`, `VERSIONING.md`, `docs/roadmap.md:50`
- `core/engine-cli.js:49-58,166-218`, `core/orchestrator.js:82`
