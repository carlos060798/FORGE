---
spec_id: 2026-11-27-implementar-por-motor
fecha_verificacion: pendiente
veredicto: NO_VERIFICADA  # borrador: nada implementado ni probado
---

# Verificación: 2026-11-27-implementar-por-motor

## Veredicto: **NO_VERIFICADA**

Borrador sin código ni pruebas. La tabla fija la prueba que debe existir por criterio.

## Hechos del estado actual (leídos el 2026-11-27)

| Hecho | Evidencia |
|---|---|
| `sdd.implementar.md` no menciona `fragua run`, `forge run` ni `engine` | búsqueda en `commands/sdd.implementar.md` sin resultados |
| Códigos del motor 0/1/3/4 | `core/engine-cli.js:42` |
| Salida 4 sin aislamiento | `core/engine-cli.js:184` |
| Salida 3 con revisión pendiente | `core/engine-cli.js:358,401,474` |
| Salida 1 por fallo (y por `err()`, y por orden desconocida) | `core/engine-cli.js:58,408,484,549` |
| Ayuda con los cuatro códigos | `cli/index.js:96-98` |
| Sin casos `why/explica/deploy/share/progress` en la CLI | `cli/index.js:136-284` |
| Alias de skill con esas formas | `commands/forge.md:98-119`; skills `explicame`, `share-progress` |
| `ir.types.ts` citado y `ir.types.js` real | `commands/sdd.exportar.md:54,148`; `core/ir.types.js` |
| Prueba de órdenes citadas | no existe (`tests/consistencia-cifras.test.js` es de cifras) |

## Criterios de aceptación

| CA | Prueba prevista | Estado |
|---|---|---|
| CA-001-01 | el texto del comando contiene `fragua run` y `fragua resume` | pendiente |
| CA-001-02 | sin `--motor`, la invocación no pide el clásico | pendiente |
| CA-001-03 | con el clásico, marca G1 y aviso presentes | pendiente |
| CA-001-04 | con salida 4, ninguna rama escribe código | pendiente |
| CA-002-01 a CA-002-05 | doble del motor con cada código y con uno inesperado | pendiente |
| CA-002-06 | prueba de los cuatro códigos | pendiente |
| CA-002-07 | comparación de la tabla del comando con `SALIDA` | pendiente |
| CA-003-01 | `tareas.md` de la plantilla leído por `cargarTareas` | pendiente |
| CA-003-02 | revisión de las modalidades del comando | pendiente |
| CA-003-03 | el comando no escribe aprobaciones | pendiente |
| CA-004-01 | prueba de órdenes citadas frente al `switch` | pendiente |
| CA-004-02 | según la decisión del dueño | pendiente |
| CA-004-03 | búsqueda de las formas sin barra | pendiente |
| CA-004-04 | existencia de rutas citadas | pendiente |
| CA-004-05 | regeneración de `skills-generadas/` sin diferencias | pendiente |

## Lo no hecho o no verificado

- Que el formato de `tareas.md` coincida con `cargarTareas`: [NV].
- Que cada herramienta anfitriona devuelva el código de salida de un comando al modelo: [NV].
- Que `scripts/generar-skills.mjs` cubra `sdd-exportar`: [NV].
