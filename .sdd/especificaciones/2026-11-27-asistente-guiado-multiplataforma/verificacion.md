---
spec_id: 2026-11-27-asistente-guiado-multiplataforma
fecha_verificacion: pendiente
veredicto: NO_VERIFICADA  # borrador: nada implementado ni probado
---

# Verificación: 2026-11-27-asistente-guiado-multiplataforma

## Veredicto: **NO_VERIFICADA**

Borrador sin código ni pruebas. La tabla fija la prueba que debe existir por criterio.

## Hechos del estado actual (leídos el 2026-11-27)

| Hecho | Evidencia |
|---|---|
| Lectura con `readFileSync("/dev/stdin")`, recortada a 2 caracteres | `cli/comandos/instalar.js:898-899` |
| Si falla la lectura, se usa el valor por defecto sin avisar | `cli/comandos/instalar.js:901-904` |
| El asistente tiene tres preguntas (el comentario dice cuatro) | `cli/comandos/instalar.js:885-941` |
| `cmdInit` y `wizardGuiado` son síncronos | `cli/comandos/instalar.js:674,699,889` |
| Existe un lector de línea portable | `core/aprobaciones-identidad.js:102`; uso en `cli/comandos/aprobar.js:27` |
| No existe selector de modo ni clave `modo.riesgo` en el código | búsqueda de `modo` en `cli/comandos/instalar.js` (solo `sesion.modo`, `:466`) |
| Comportamiento real en Windows | [NV] no ejecutado |

## Criterios de aceptación

| CA | Prueba prevista | Estado |
|---|---|---|
| CA-001-01 | búsqueda de `/dev/stdin` en el código del asistente | pendiente |
| CA-001-02 | tubería con tres líneas, tres respuestas reflejadas | pendiente |
| CA-001-03 | vacío, fuera de rango y agotar los intentos | pendiente |
| CA-001-04 | entrada cerrada a medias: código ≠ 0, sin valores por defecto | pendiente |
| CA-001-05 | caracterización de `init` sin `--guided` | pendiente |
| CA-001-06 | ejecución real en CI de Windows y Linux | pendiente |
| CA-002-01 | sin entrada: código ≠ 0 y mensaje | pendiente |
| CA-002-02 | ausencia de la palabra y del aviso engañoso | pendiente |
| CA-003-01 | texto y orden de las seis preguntas | pendiente |
| CA-003-02 | séptima pregunta no cambia el modo | pendiente |
| CA-003-03 a CA-003-05 | tabla de combinaciones esperadas | pendiente |
| CA-003-06 | «no sé» frente a «sí», salida completa igual | pendiente |
| CA-003-07 | propiedad sobre las 324 combinaciones | pendiente |
| CA-003-08 | nunca `prototipo` ni `producto` | pendiente |
| CA-003-09 | frase de motivo determinista | pendiente |
| CA-003-10 | sin red, sin claves, sin proveedor | pendiente |
| CA-004-01 | rechazo de un modo menor al recomendado | pendiente |
| CA-004-02 | registro sin datos personales | pendiente |
| CA-004-03 | no se escribe una clave sin lector | pendiente |
| CA-005-01 | caracterización del `sdd.config.yaml` resultante | pendiente |
| CA-005-02 | orden de preguntas | pendiente |

## Lo no hecho o no verificado

- Ejecución real en una consola de Windows: [NV].
- Comportamiento de `leerLineaDeTerminal` con una entrada por tubería (`terminal: true`): [NV].
- Tiempo de uso por personas no técnicas: se mide en la fase 9 del plan.
