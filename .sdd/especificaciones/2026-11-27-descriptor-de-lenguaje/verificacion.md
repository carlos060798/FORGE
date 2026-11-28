---
spec_id: 2026-11-27-descriptor-de-lenguaje
fecha_verificacion: pendiente
veredicto: NO_VERIFICADA  # borrador: nada implementado ni probado
---

# Verificación: 2026-11-27-descriptor-de-lenguaje

## Veredicto: **NO_VERIFICADA**

Borrador sin código ni pruebas. La tabla fija la prueba que debe existir por criterio. La secuencia obligatoria es: caracterización (HU-001) en verde, después migración, después gestores de Python.

## Hechos del estado actual (leídos el 2026-11-27)

| Hecho | Evidencia |
|---|---|
| El lenguaje sin soporte cae en Node | `core/runners/index.js:31` |
| La imagen y los manifiestos están en el código | `core/sandbox/preparar-imagen.js:24-40` |
| Los pasos de instalación están en el código | `core/sandbox/preparar-imagen.js:111-135` |
| Entorno por lenguaje en el código | `core/sandbox/sandbox-runner.js:17-23,64-72` |
| Extensiones y tratamiento de mutación en el código | `core/ciclo/mutacion.js:49-58` |
| Python solo desde `requirements.txt` | `core/sandbox/preparar-imagen.js:63-65` |
| El detector conoce `poetry.lock` y `Pipfile` pero la imagen no los usa | `core/stack-detector.js` (`install_cmd` de Python) |
| Rust con ejecutor y sin imagen | `core/runners/rust-runner.js`; `preparar-imagen.js:24-27` |
| Pruebas de lenguajes existentes | `tests/sandbox-lenguajes.test.js`, `tests/mutacion-docker-lenguajes.test.js`, `tests/orchestrator-runner.test.js` |
| Prueba de caracterización de la planificación | no existe [NV: no se buscó un nombre distinto] |
| `uv`, `poetry`, `pipenv` sin red en la imagen | [NV] |

## Criterios de aceptación

| CA | Prueba prevista | Estado |
|---|---|---|
| CA-001-01 a CA-001-03 | caracterización de planificación, sin Docker, tres lenguajes | pendiente |
| CA-002-01 | esquema con los campos mínimos | pendiente |
| CA-002-02 | descriptor inválido: clave extra, campo ausente, operador de shell | pendiente |
| CA-002-03 | imagen sin huella | pendiente |
| CA-002-04 | descriptor puesto en un proyecto: ignorado y avisado | pendiente |
| CA-002-05 | prueba de agnosticismo sobre los módulos | pendiente |
| CA-003-01 | caracterización tras migrar | pendiente |
| CA-003-02 | suite de sandbox y mutación sin cambios | pendiente |
| CA-003-03 | Java sin descriptor: error y código propio | pendiente |
| CA-004-01 a CA-004-04 | proyectos de ejemplo con cada archivo de bloqueo, con dos y con ninguno | pendiente |
| CA-004-05 | la instalación no está en el comando de pruebas | pendiente |
| CA-004-06 | bloqueo desfasado: falla | pendiente (requiere Docker) |
| CA-004-07 | depende de `modos-de-riesgo-y-persona` | pendiente |
| CA-004-08 | ejecución con Docker real | pendiente [NV] |
| CA-005-01 a CA-005-03 | caracterización de mutación y `not_evaluable` | pendiente |
| CA-006-01 | batería común sobre los tres descriptores | pendiente |
| CA-006-02 | lenguaje inventado en el directorio de pruebas | pendiente |
| CA-006-03 | lista de la documentación frente a los descriptores | pendiente |
| CA-006-04 | texto de `docs/limitations.md:14` | pendiente |
| CA-007-01 y CA-007-02 | Java sin descriptor | pendiente |

## Lo no hecho o no verificado

- Gestores de Python sin red en la imagen: [NV].
- Tiempo de carga de los descriptores: [NV].
- Ejecución real en Linux de los tres lenguajes con el descriptor: depende de la CI verde (fase 3 del plan).
