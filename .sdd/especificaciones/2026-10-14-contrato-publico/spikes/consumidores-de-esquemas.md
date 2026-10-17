# Spike S0.4: consumidores de `core/schemas` y qué rompería endurecer `validateArtefacto`

> Lectura y `grep` (2026-10-17).

## Consumidores

- Código: solo `cli/export.js:18,241` y `cli/import.js:18,203,274`, y **solo con `'ir'`**. En `export.js:241-245` un esquema inválido es un `console.warn` (no corta). Ver `import.js:203` y `:274` (no se leyeron las ramas de error; sin confirmar si bloquean la importación).
- Pruebas: ninguna referencia a `validateArtefacto`, `loadSchema` ni `core/schemas` en `tests/` (grep). No hay red de seguridad: endurecer no rompe ninguna prueba, y tampoco habría quien avise si se rompe algo.
- `estado` y `adr` están definidos pero **nadie los valida**.
- `validateArtefacto` hoy (`core/schemas/index.js:41-76`): solo `required`, `schemaVersion` (const) y `enum` de primer nivel; ignora `type` y todo lo anidado.

## Hallazgo: el esquema `estado` no describe el archivo real

- `core/schemas/estado.schema.json` exige `schemaVersion` (`required`). El `.sdd/estado.json` real de este repositorio **no tiene `schemaVersion`** (grep: sin coincidencias) y trae claves que el esquema no conoce (`version_plugin`, `inicializado`, `perfil`, `historial`, `plan_aprobado`, `tareas_generadas`…). Si se valida con el validador completo, el propio estado del proyecto falla. Es el ejemplo exacto de «esquema que no se corresponde con lo real» (CA-002-04 / CA-004-02).
- También: el esquema `estado` llama «estado» al pipeline (`.sdd/estado.json`), mientras que el contrato nuevo habla de `estado-ciclo`; los nombres chocan. Renombrar en el contrato (`estado-pipeline` / `estado-ciclo`) sin tocar el `$id` publicado (`https://forge-sdd.dev/schemas/estado/1.0`).

## Qué rompería endurecer

- `ir`: cualquier IR guardado que hoy pase por `export`/`import` solo con `required` pasaría a fallar por tipo/`minimum`/`maxItems`. Sería un aviso en `export` y quizá un rechazo en `import`. Mitigación: validador nuevo **solo en modo advertencia** en `export/import` durante una versión menor, con el aviso «este artefacto no cumple el esquema v1», y rechazo duro en una mayor.
- `estado`/`adr`: nada (no se usan). Endurecer es gratis, pero hay que corregir antes el esquema `estado` (opcional `schemaVersion` o migración).
- Mantener `validateArtefacto` con su firma y devolver `{valid, errors}`; dentro, delegar en el nuevo `validar` (compatibilidad de API).

## Qué cambia en la spec o el plan

- Plan: la tarea de endurecimiento incluye (a) regenerar/ajustar `estado.schema.json` para que acepte el `estado.json` real, (b) modo advertencia por defecto en `export`/`import`, (c) una prueba que valide **el `.sdd/estado.json` de ejemplo del repositorio** (fixture) contra el esquema.
- Añadir al contrato la regla «un esquema publicado se prueba contra un artefacto real» (CA-002-04).
- Pregunta abierta resuelta: sí se puede endurecer sin romper pruebas; lo que hay que cuidar son los IR guardados de usuarios.
