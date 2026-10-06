# ADR-10: `.sdd/` del propio repo versionada de forma selectiva

> Estado: aceptada  # propuesta | aceptada | obsoleta | reemplazada-por-ADR-XX
> Fecha: 2026-10-03 (aceptada el 2026-10-05, por delegación del dueño)
> Spec relacionada: 2026-10-03-ciclo-verificado
> Autor: Claude (pendiente de aceptación por el dueño)

## Contexto

FORGE no se especificaba a sí mismo: no existía `.sdd/` en el repo y `.gitignore` la ignoraba entera. Los comandos tienen `.sdd/` fijo en sus rutas. Además, el repo documenta cuatro convenciones distintas para los ADR: `YYYY-MM-DD-titulo.md` (`commands/sdd.planificar.md:354`), `ADR-[NN]` (plantilla), el ledger `ADRs.jsonl` (`commands/sdd.adr.md:103`) y un directorio `.sdd/adrs` (`claude-hooks/pre-tool-guard.js:138`).

## Decisión

- Los artefactos SDD de FORGE viven en `.sdd/` del propio repo.
- `.gitignore` pasa de `.sdd/` a `.sdd/*` con excepciones para `INDICE.md`, `estado.json`, `especificaciones/`, `arquitectura/`, `dominio/` y `memoria/constitucion.md`. Siguen ignorados `sdd.config.yaml` (puede contener claves), la memoria de agentes, los eventos, `motor/` y `ADRs.jsonl`.
- Los ADR se nombran `ADR-NN-slug.md` en `.sdd/arquitectura/`, con la fecha en la cabecera.
- Los ADR en `propuesta` no se escriben en `ADRs.jsonl`: su esquema no admite ese estado (`core/schemas/adr.schema.json`).

## Alternativas consideradas

- **A. Carpeta fuera de `.sdd/`** (por ejemplo `docs/sdd/`): rechazada porque los comandos no la encontrarían.
- **B. Nombre de ADR por fecha**: rechazada porque la plantilla exige un número para `reemplazada-por-ADR-XX` y el plan los cita por número.
- **C. Versionar `.sdd/` entera**: rechazada porque incluye estado local y posibles claves.
- **D. Versionado selectivo y `ADR-NN-slug.md`**: aceptada.

## Consecuencias

### Positivas
- El repo aplica su propia metodología (Principio I).
- Los ADR tienen identificador estable.

### Negativas
- `estado.json` versionado puede generar conflictos entre colaboradores.
- Queda una quinta convención hasta que S0 unifique la documentación de los comandos.

### Neutrales
- Sin verificar que ningún test asuma que `.sdd/` no existe en la raíz del repo.

## Cuándo revisitar

- En S0, al unificar la convención de ADR en comandos y hook.
- Si `estado.json` genera conflictos: dejar de versionarlo.

## Referencias

- `.gitignore`, `plantillas/decision-arquitectura.md:1-3`, `core/schemas/adr.schema.json`
