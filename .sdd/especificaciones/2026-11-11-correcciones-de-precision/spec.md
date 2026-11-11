---
id: 2026-11-11-correcciones-de-precision
titulo: "Correcciones de precisión halladas al documentar: la versión que estampa export y el tipo del estado"
tamano: micro  # micro | pequeño | mediano | grande
estado: borrador  # borrador | en_revision | aprobada | en_implementacion | completada
creada: 2026-11-11
actualizada: 2026-11-11
autor: humano  # humano | importado
constitucion_version: 1.1.0
etiquetas: [documentacion, precision, mvp]
---

# Especificación: correcciones de precisión

> **Estado (2026-11-11): borrador.** Salió de la auditoría de documentación (`docs/informes/PLAN-DOCUMENTACION-PUBLICA.md`, sección 9). La aprueba el dueño. Es un cambio sin efecto sobre el ciclo verificado ni sobre ninguna interfaz documentada como pública, salvo el valor del campo `forge_version` de lo que se exporta.

## 1. Contexto y Motivación

Al documentar la CLI y las interfaces aparecieron dos afirmaciones del código que no se corresponden con la realidad:

- `fragua export` estampa «FORGE v4.0.0» en cada artefacto exportado (`cli/export.js`) y escribe `forge_version: "4.0.0"` en `openspec.json`, aunque el paquete es 5.0.0-beta.1. Nadie lee ese campo: solo se escribe. `cli/import.js` declara la misma constante y no la usa.
- El tipo `ForgeEstado` (`core/project-memory.js`) no declara `spec_aprobado` ni otros campos que el archivo real tiene según el esquema público `estado-pipeline`.

## 2. Objetivo

Que lo que `export` declara sea la versión real del paquete, y que el tipo del estado declare todo lo que el esquema público declara.

## 3. Criterios de aceptación

- **CA-001-01** `fragua export --format=openspec` escribe `forge_version` igual a la versión de `package.json`.
- **CA-001-02** `fragua export --format=speckit` estampa «FORGE v<versión de package.json>» y nunca «v4.0.0».
- **CA-001-03** `cli/import.js` no declara una constante de versión que no use.
- **CA-002-01** Toda propiedad de `docs/contrato/estado-pipeline.schema.json` aparece en el tipo `ForgeEstado`, y `npm run typecheck` sigue sin errores.

## 4. Fuera de alcance

- Aplicar `calidad.cobertura_tests_minima`, hacer que los hooks de `.sdd/hooks/` cancelen, o cambiar el código de salida de `fragua doctor`: son cambios de comportamiento que necesitan su propia especificación y decisión.
- Unificar la forma de las líneas de `consumo.jsonl` entre los dos hooks que la escriben.

## 5. Cambios de comportamiento visibles

El campo `forge_version` de `openspec.json` y la línea «Generado por FORGE v…» de los Markdown exportados pasan de `4.0.0` a la versión del paquete.
