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

## Revisión independiente (2026-10-05)

Un revisor ajeno intentó romper S3 y las últimas correcciones. Veredicto: **aprobada con observaciones**. No encontró fuga de rutas vetadas (21 rutas hostiles, junctions incluidas) ni inyección de comandos. Los fallos que reprodujo están corregidos con test en `tests/revision-s3.test.js`:

| Hallazgo | Corrección |
|---|---|
| M1 El candado perdía la exclusión mutua en Windows sin candado huérfano (una lectura con `ENOENT`/`EPERM` se tomaba por candado dañado y se retiraba el de otro) | Ausente o ilegible a ratos se espera y se reintenta; solo un JSON roto se trata como dañado. 12 procesos × 25 rondas sin solapes |
| M2 Falsos positivos en vetos por nombre (`secretary.js`, `credentials.service.ts`, `secrets.test.js`…) | `*secret*` y `*credentials*` solo con extensión de datos; `secrets.*` igual. Siguen vetados `credentials`, `secrets.json`, `key.json`, `*-key.json`… |
| M3 `unittest`, `go test (cached)`, rspec, jasmine, phpunit y maven daban «éxito sospechoso» | Reconocidos como evidencia de pruebas |
| M4 Ollama: seguía redirecciones (el contenido salía a otra dirección), el plazo no cubría el cuerpo, sin tope de respuesta, `OLLAMA_HOST` sin esquema fallaba, el aviso mostraba `usuario:clave` | `redirect: 'error'`, plazo sobre la petición entera, 512 KB y 8192 dimensiones como máximo, esquema por defecto, credenciales ocultas |
| B1 `tokenizar` cuadrático | Entrada acotada a 6000 caracteres |
| B2 Sin tope global de trozos | 20 000 trozos como máximo |
| B3 `buscar` leía archivos sin tope | `statSync` y descarte por encima de 200 KB |
| B4 Archivos repetidos (mayúsculas distintas, trozos solapados, `spec.md` falso) | Comparación canónica, trozos solapados descartados, el pseudo-fragmento `spec` no excluye nada |
| B5 `npx --no-install jest` lanzaba excepción; `..foo.js` rechazado por el respaldo; `restaurar()` se cortaba si faltaba una copia | Opciones de `npx` descartadas; comprobación exacta de `..`; `restaurar()` sigue y devuelve `fallidos` |

Documentación corregida: «git ignora `.sdd/indice/`» (FORGE no toca el `.gitignore` del proyecto), la lista en línea de `no_tocar_archivos` (sí se reconoce), la validación de `motor.recuperador` y las cifras de tests.

**Sin corregir, a sabiendas:**
- `process.exit` indentado, dentro de una función, con `process["exit"]` o `os.Exit(0)` de Go sigue sin detectarse; un `sys.exit(main())` de primer nivel en Python da un falso positivo (pide revisión, no rompe nada).
- Sin probar: Ollama real, symlinks de archivo (necesitan privilegios), Linux y macOS, y un posible bloqueo de la API si el hijo deja nietos con las tuberías abiertas (hipótesis del revisor).
- 64 conexiones ociosas bloquean a un cliente legítimo de la API hasta que vence `headersTimeout` (10 s): molestia local.
