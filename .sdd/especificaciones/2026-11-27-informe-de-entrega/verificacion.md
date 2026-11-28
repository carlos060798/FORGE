# Verificación: Informe de entrega

> Spec: `spec.md` · Estado: **borrador. No hay plan, tareas, pruebas ni código.** Este documento solo dice contra qué se verificará y qué existe hoy.

## 1. Lo que existe hoy (leído el 2026-11-27, sin ejecutar nada)

| Pieza | Dónde | Relación |
|---|---|---|
| Informe de evidencia con spec, commit, pruebas, imagen, modelos, puertas, omitidos, `firmado`, `anterior`, `sha256`, `firma` | `core/evidencia/cadena.js:7,478-520` | Fuente única de datos |
| Comprobación de cadena con niveles `firmada`, `encadenada_sin_firma`, `firmas_no_verificables`, `rota`, `vacia`; solo lectura | `cadena.js:290,408-420` | CA-001-02, CA-001-03, CA-003-03 |
| `aprobador: null` y la omisión «el proyecto no registra quién aprueba la spec» | `cadena.js:486,502` | CA-002-01, escenario 4 |
| Resumen de puertas con `categoria` y `codigoSalida` | `cadena.js:455-468` | CA-002-01, CA-002-03 |
| Aviso de límites de la firma (HMAC simétrico, clave legible por el mismo usuario) | `cadena.js:16-31` | CA-003-03 |
| Campo de nivel de garantía G0 a G3 | **no existe** (sin coincidencias de `nivel_garantia` ni `G0` en `core/**/*.js`) | CA-003-05 |
| Campo de «bypass usado» | **no existe como tal** [NV: se confirma al implementar] | CA-003-04 |
| Informe para cliente, es o en | **no existe** | – |

## 2. Criterios de aceptación

| CA | Estado | Cómo se verificará (propuesta) |
|---|---|---|
| CA-001-01 a CA-001-06 | Pendiente | Proyecto temporal con cadena de ejemplo; interceptor de red y de modelo que falla si se usa; cadena retocada; cadena vacía; ruta de salida confinada; cadena idéntica antes y después |
| CA-002-01 a CA-002-06 | Pendiente | Cadena de ejemplo con y sin aprobador, con puertas `no_ejecutada`; comprobación de que cada afirmación cita campo; secreto y ruta absoluta centinelas ausentes en la salida |
| CA-003-01 a CA-003-07 | Pendiente (CA-003-05 depende de `nivel-de-garantia-en-evidencia`) | Una prueba por regla de limitación; cadenas con y sin clave; lista cerrada de términos prohibidos en es y en |
| CA-004-01 a CA-004-06 | Pendiente (CA-004-06 depende de la enmienda del Principio XII) | Paridad de datos; claves de texto presentes en las dos lenguas; revisión humana del inglés [NV] |
| CA-005-01 a CA-005-04 | Pendiente | Revisión de estructura; prueba con lectores no técnicos [NV, no hecha] |
| CA-006-01 a CA-006-03 | Pendiente | Prueba de carga perezosa, de `package.json` sin cambios y de invariancia |

## 3. Qué NO se ha hecho

- Ni código ni pruebas ni una muestra del informe.
- No se decidió el formato ni el nombre de la orden.
- No se probó con ninguna persona no técnica ni con un cliente real.
- Las reglas de nivel de garantía (qué evidencia permite G1 o G2) están enunciadas en la spec de forma conservadora, pero **no se comprobó** que la evidencia actual traiga los campos para aplicarlas todas (ver §9 de la spec).

## 4. Límites que el informe heredará aunque todo pase

- La firma es simétrica y local: no sirve a un tercero (G3 es futuro).
- El informe no prueba que lo declarado (spec aprobada, modelo) fuera cierto; prueba que no se retocó después.
- El gasto nunca se comparó con una factura.
