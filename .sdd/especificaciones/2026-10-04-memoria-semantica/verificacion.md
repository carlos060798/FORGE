---
spec_id: 2026-10-04-memoria-semantica
fecha_verificacion: 2026-10-04
veredicto: AUTOEVALUADA  # sin verificación ni revisión de seguridad independientes
---

# Verificación: 2026-10-04-memoria-semantica

## Veredicto: **AUTOEVALUADA**

La hizo quien implementó. En este proyecto las autoevaluaciones anteriores se rechazaron o se rebajaron al verificarlas de forma independiente: **esto no es una aprobación**. Falta una verificación independiente y, sobre todo, una revisión de seguridad (un índice que lee archivos del repositorio y los devuelve a un modelo).

## Criterios de aceptación

| CA | Test | Estado |
|---|---|---|
| CA-001-01 | `recuperacion-semantica` («entrega primero los archivos de la tarea…») y el ciclo con `semantico` (`ciclo-hallazgos`, S3) | ✅ |
| CA-001-02 | `recuperacion-semantica` («nunca supera el tope de bytes»: 8 topes, de 0 a 20 000) | ✅ |
| CA-001-03 | `recuperacion-semantica` («lista solo texto del proyecto…», «no devuelve lo vetado»). El salto de enlaces solo se ejercita si el sistema permite crear junctions (en Windows sí) | ⚠️ no se probó con enlaces simbólicos de archivo (EPERM sin privilegios) |
| CA-001-04 | «si el embedder falla…» y el ciclo con `ollama` apuntando a un puerto sin servicio | ✅ |
| CA-001-05 | Los tests del ciclo existentes (recuperador `archivos` por defecto) | ✅ |
| CA-002-01 | «actualizar es incremental…» (0 reindexados sin cambios, 1 tras modificar, borrado sale) | ✅ |
| CA-002-02 | «un índice de otro embedder o dañado se reconstruye» | ✅ (probado el dañado; el de otro embedder se separa por nombre de archivo y por el campo `embedder`, sin test propio) |
| CA-003-01 | `embeddings` (hash determinista y normalizado; Ollama con un servidor simulado: URL, cuerpo, errores) | ⚠️ **Ollama real no probado** |
| CA-003-02 | `configuración` (`motor.embeddings` desconocido) y `crearEmbedder` | ✅ |

Total: 7 ✅, 2 ⚠️, 0 ❌.

## Pruebas

- `tests/recuperacion-semantica.test.js`: 18 tests; 2 más en `tests/ciclo-hallazgos.test.js` (el ciclo completo con `semantico`).
- Sin dependencias nuevas.

## Lo que NO demuestra

- **Calidad semántica.** El embedder `hash` es léxico: los tests prueban que encuentra archivos que comparten palabras con la tarea, no que entienda significado. No hay ninguna medida de si el contexto añadido mejora el código que escribe un modelo real.
- **Ollama real**: nunca se ha llamado a un servidor de verdad ni a un modelo de embeddings descargado.
- **Escala**: no se ha medido con repositorios grandes; la búsqueda recorre todos los vectores.
- **Seguridad**: sin revisión independiente. Al escribir esta verificación encontré yo mismo que un índice manipulado dentro del repositorio (`.sdd/indice/*.json`) podía apuntar a rutas vetadas o fuera del proyecto; está corregido (se valida al cargar y cada ruta pasa por `validarRuta` antes de leerla) con test, pero lo encontré yo y lo corregí yo: conviene que alguien ajeno lo intente romper.
- No sustituye a `utils/hybrid-indexer.js`.
