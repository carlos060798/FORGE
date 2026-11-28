---
spec_id: 2026-11-27-github-connect-seguro
fecha_verificacion: pendiente
veredicto: NO_VERIFICADA  # borrador: nada implementado ni probado
---

# Verificación: 2026-11-27-github-connect-seguro

## Veredicto: **NO_VERIFICADA**

La especificación está en borrador y no hay código ni pruebas. Esta tabla fija qué prueba debe existir para cada criterio; se rellena al terminar. Las pruebas usan dobles de `gh` y `git` en un directorio temporal, sin red ni cuenta real (`AGENTS.md`: el sistema de archivos no se simula y no se necesitan claves).

## Hechos del estado actual (código leído el 2026-11-27)

| Hecho | Evidencia |
|---|---|
| Visibilidad por defecto `public` | `skills/github-connect/github-connect.sh:21`; `SKILL.md:31,70` |
| Salida a `/tmp` | `github-connect.sh:195,198,288,294` |
| Decisión por texto | `github-connect.sh:290` |
| Errores tragados | `github-connect.sh:330-331` |
| `origin` ajeno borrado | `github-connect.sh:223-224` |
| `git add -A` | `github-connect.sh:251` |
| La cola no tiene operación de crear repositorio | `core/integraciones/aprobacion.js:44`, `puerto.js:18` |
| Pruebas existentes de `github-connect` | [NV] ninguna encontrada en `tests/` por nombre de archivo |

## Criterios de aceptación

| CA | Prueba prevista | Estado |
|---|---|---|
| CA-001-01 | doble de `gh`: sin visibilidad, argumentos con `--private` | pendiente |
| CA-001-02 | visibilidad inválida: salida 2, sin llamadas | pendiente |
| CA-001-03 | `public` sin línea en la vista previa: no publica | pendiente |
| CA-001-04 | prueba de consistencia entre documentos y script | pendiente |
| CA-002-01 | listado de la carpeta temporal antes y después | pendiente |
| CA-002-02 | búsqueda de `/tmp` y `tee` en la skill | pendiente |
| CA-002-03 | doble que emite un token de prueba | pendiente |
| CA-002-04 | búsqueda de `--show-token` y del valor del token | pendiente |
| CA-003-01 | doble de `git push` con salida 1 | pendiente |
| CA-003-02 | doble con el texto antiguo y otro código | pendiente |
| CA-003-03 | búsqueda de `|| true` y fallo del commit de configuración | pendiente |
| CA-003-04 | una prueba por código (0, 1, 2, 3, 4) | pendiente |
| CA-003-05 | `origin` ajeno: sale 1 y el remoto sigue igual | pendiente |
| CA-004-01 | sin aprobación: sale 3, doble sin llamadas de escritura | pendiente |
| CA-004-02 | vista previa con los seis campos | pendiente |
| CA-004-03 | huella errónea o corta: no publica | pendiente |
| CA-004-04 | cambio posterior: huella distinta, no publica | pendiente |
| CA-004-05 | `.env` y secreto sembrado excluidos y listados | pendiente |
| CA-004-06 | registro de auditoría con huella y sin token | pendiente |
| CA-005-01 | lectura del texto de la skill | pendiente |
| CA-005-02 | integración apagada: sale 4 | pendiente |

## Lo no hecho o no verificado

- Nada probado contra GitHub real (fase 7 del plan).
- Funcionamiento en Windows: [NV].
- Alineación de los códigos de salida con ADR-30: pendiente de que exista.
