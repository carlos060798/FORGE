---
spec_id: 2026-10-03-api-http
fecha_verificacion: 2026-10-03
veredicto: AUTOEVALUADA  # con una revisión de seguridad independiente (observaciones corregidas); sin verificación de criterios independiente
---

# Verificación: 2026-10-03-api-http

## Veredicto: **AUTOEVALUADA**

La hizo quien implementó la API. **Revisión de seguridad independiente hecha** (cuarta pasada del proyecto, ver `revision-seguridad.md` del ciclo): OBSERVACIONES, sin ejecución en el anfitrión ni fuga del secreto; reprodujo la inyección de flags con `tarea:"--force"` (H2), ids `.`/`..` y archivos temporales sin borrar (H10), y conexiones lentas sin límite (H7, abierto). H2 y H10 están corregidos con tests; la corrección no está revisada de forma independiente. En este proyecto la primera autoevaluación del ciclo verificado fue rechazada por la verificación independiente y la tercera dejó observaciones que ya se habían dado por cerradas, así que **esto no es una aprobación**. Falta una verificación de criterios por el agente `revisor`, y que alguien ajeno revise las correcciones de esta ronda.

## Criterios de aceptación

| CA | Test (`tests/api-http.test.js`) | Estado |
|---|---|---|
| CA-001-01 | sin secreto o con otro, 401 en cualquier ruta y método; no se acepta en la URL | ✅ |
| CA-001-02 | cualquier cabecera `Origin` se rechaza aunque lleve el secreto | ✅ |
| CA-001-03 | un `Host` ajeno se rechaza | ✅ (probado con un nombre; no se probó una IP distinta ni mayúsculas) |
| CA-001-04 | sin cabeceras CORS; `OPTIONS` no se atiende | ✅ |
| CA-001-05 | `server.listen` en `127.0.0.1`; arranque real por la CLI | ⚠️ solo se comprueba la dirección en el código y que responde en 127.0.0.1; no se intentó conectar desde otra interfaz |
| CA-002-01 | `POST /v1/ejecuciones` responde 202 con identificador (lanzador simulado) y recorrido real con Docker | ✅ |
| CA-002-02 | un campo `motor`/`modo` se rechaza; los argumentos son siempre `--motor ciclo` | ✅ |
| CA-002-03 | segunda ejecución → 409; al terminar se puede lanzar otra; la salida se consulta | ✅ |
| CA-002-04 | tareas inválidas no lanzan nada; las válidas van por archivo | ✅ |
| CA-003-01 | `POST /v1/decisiones` lanza `resume` con la decisión y extras; recorrido real: abortar por HTTP | ✅ |
| CA-003-02 | decisiones inválidas se rechazan sin lanzar | ✅ |
| CA-003-03 | cuerpo de 70 KB, no JSON, tipo equivocado, no objeto | ✅ |
| CA-003-04 | métodos y rutas inexistentes | ✅ |
| CA-004-01 | etapa, sesión, tareas con situación y gasto | ✅ |

Total: 13 ✅, 1 ⚠️, 0 ❌.

## Pruebas

- `tests/api-http.test.js`: 20 tests, uno de ellos (recorrido real) con `FORGE_TEST_DOCKER=1`: lanza el ciclo por HTTP con un proveedor de pruebas, ve que la tarea se pausa pidiendo decisión (`salida_invalida`, código 3), la aborta por HTTP y comprueba que queda abortada.
- Suite completa en Windows con Docker, tras las correcciones de la tercera pasada: 1381 tests, 1378 pasan, 0 fallan, 3 saltados. `npx tsc`: 32 errores, los 32 previos; ninguno en `core/api/`.
- Sin dependencias nuevas.

## Lo que NO demuestra

- **Ninguna revisión independiente**, ni de seguridad. Puntos que merecen mirada ajena: el manejo de `Host` (una petición HTTP/1.0 sin `Host`, o varias cabeceras `Host`), la lectura del cuerpo con `Content-Length` falso o troceado, el efecto de peticiones lentas, y si un `id` de ejecución con caracteres raros llega a algún sitio.
- **El secreto circula por la salida estándar del arranque**: cualquier cosa que capture esa salida lo ve.
- **Cualquier proceso de tu usuario con el secreto puede lanzar tareas.** Es la confianza asumida (ADR-13).
- **Sin límite de intentos fallidos**: un proceso local podría probar secretos; con 256 bits aleatorios no es práctico.
- Nunca probado con un modelo real, ni en Linux, ni con clientes externos a Node.
- La API hereda los límites del ciclo (en particular que un `process.exit(0)` del código generado falsea un éxito).
