---
spec_id: 2026-11-27-modos-de-riesgo-y-persona
fecha_verificacion: pendiente
veredicto: PENDIENTE  # la spec está en borrador y no tiene código; esto es el plan de verificación, no un resultado
---

# Verificación: 2026-11-27-modos-de-riesgo-y-persona

## Veredicto: **PENDIENTE** (spec en borrador, sin aprobar y sin implementación)

Este documento fija **cómo** se verificará cada criterio cuando exista el código, para que la verificación no la escriba quien implementa. Ningún criterio está demostrado. La verificación final la hace un rol independiente (agente `revisor`, `commands/sdd.verificar.md`) y se registra con `fragua verificar --registrar`.

Reglas de la verificación:
- Un criterio solo se marca ✅ con una prueba que **antes** falló (rojo) y luego pasa, y se cita el archivo de prueba.
- La decisión es por código de salida o por el estado resultante, nunca por texto de un modelo.
- `not_evaluable` nunca es ✅.

## Plan por criterio

| Criterio | Prioridad | Cómo se demuestra | Prueba prevista | Estado |
|---|---|---|---|---|
| CA-001-01 | P1 | `modo.persona` en el YAML del proyecto ⇒ código ≠ 0 con la clave nombrada | `tests/modos-ejes.test.js` | ⏳ |
| CA-001-02 | P1 | Parametrizada sobre las 4 personas: `diff(resolver(p1), resolver(p2))` vacío | `tests/modos-ejes.test.js` | ⏳ |
| CA-001-03 | P1 | Valor fuera de lista y clave desconocida bajo `modo:` ⇒ código ≠ 0 | `tests/modos-lector.test.js` | ⏳ |
| CA-001-04 | P1 | Caracterización: sin `modo:`, salida de `leerConfigCiclo`/`leerPuertas` idéntica a la de antes del cambio (instantánea tomada **antes** de tocar el código) | `tests/modos-caracterizacion.test.js` | ⏳ |
| CA-002-01 | P1 | **Propiedad del suelo**: generador de combinaciones modo × disparadores × proyecto × persona × entorno; comparación campo a campo con `SUELO_NÚCLEO`; contraejemplo ⇒ código ≠ 0 | `tests/modos-propiedad-suelo.test.js` | ⏳ |
| CA-002-02 | P1 | Monotonía entre pares de modos ordenados | `tests/modos-propiedad-suelo.test.js` | ⏳ |
| CA-002-03 | P1 | Por cada campo: valor del proyecto bajo el mínimo ⇒ efectivo = mínimo + aviso | `tests/modos-resolver.test.js` | ⏳ |
| CA-002-04 | P1 | Tabla congelada: escribirla lanza; mutar entorno/config no la cambia | `tests/modos-resolver.test.js` | ⏳ |
| CA-002-05 | P2 | Resolver sin `fs`/red/reloj (módulo sin importaciones de E/S; dos llamadas iguales) | `tests/modos-resolver.test.js` | ⏳ |
| CA-003-01 | P1 | Matriz modo × M1–M11: una prueba roja y una verde por celda | `tests/modos-minimos.test.js` | ⏳ |
| CA-003-02 | P1 | `not_evaluable` en mínimo duro ⇒ veredicto ≠ 0 | `tests/modos-minimos.test.js` | ⏳ |
| CA-003-03 | P1 | `mvp` + `seguridad` `not_evaluable` ⇒ código ≠ 0 | `tests/modos-minimos.test.js` | ⏳ |
| CA-003-04 | P1 | Esquema de evidencia en `prototipo` exige la etiqueta M11 | `tests/modos-minimos.test.js` | ⏳ |
| CA-004-01 | P1 | Valor de `modo.datos` fuera de lista ⇒ error | `tests/modos-disparadores.test.js` | ⏳ |
| CA-004-02 | P1 | `personal` + `stripe` en `package.json` ⇒ código propio, y el proveedor falso registra 0 llamadas | `tests/modos-disparadores.test.js` | ⏳ |
| CA-004-03 | P1 | Propiedad: añadir/quitar disparador no baja ningún campo | `tests/modos-propiedad-suelo.test.js` | ⏳ |
| CA-004-04 | P1 | Mismo árbol ⇒ mismo resultado; el detector no importa ningún proveedor de modelos | `tests/modos-disparadores.test.js` | ⏳ |
| CA-004-05 | P2 | Corpus versionado y tasa publicada presentes | `tests/modos-corpus.test.js` | ⏳ |
| CA-004-06 | P1 | «No sé» ⇒ disparador activo | `tests/modos-selector.test.js` | ⏳ |
| CA-005-01 | P1 | Bajada en el YAML sin aprobación firmada ⇒ código propio, estado sin avanzar | `tests/modos-bajada.test.js` | ⏳ |
| CA-005-02 | P1 | `fragua aprobar modo` sin TTY o sin motivo ⇒ código ≠ 0 y registro sin cambios | `tests/modos-bajada.test.js` (TTY real: [NV], como `aprobar spec`) | ⏳ |
| CA-005-03 | P1 | Aprobación por debajo del mínimo de disparadores ⇒ código ≠ 0 | `tests/modos-bajada.test.js` | ⏳ |
| CA-005-04 | P1 | Informe tras bajada contiene «modo rebajado» con origen, destino, motivo y fecha | `tests/modos-bajada.test.js` | ⏳ |
| CA-005-05 | P1 | Subida sin aprobación ⇒ código 0 | `tests/modos-bajada.test.js` | ⏳ |
| CA-006-01 | P2 | Salida de graduación lista `existe`/`falta` con código 0 | `tests/modos-graduacion.test.js` | ⏳ |
| CA-006-02 | P2 | `prototipo → personal` no deja `spec_aprobado` en `true` | `tests/modos-graduacion.test.js` | ⏳ |
| CA-006-03 | P1 | `producto`/`plataforma` ⇒ texto «modo no soportado: puertas parciales» en `init`, `doctor` y evidencia | `tests/modos-graduacion.test.js` | ⏳ |
| CA-007-01 | P1 | Recorrido de plantillas: toda clave con lector o `# declarativa` | `tests/plantillas-claves-con-lector.test.js` | ⏳ |
| CA-007-02 | P1 | Las 5 familias de claves ausentes de las plantillas o leídas por `core/modos/` | `tests/plantillas-claves-con-lector.test.js` | ⏳ |
| CA-008-01 | P1 | Degradación simulada bajo el piso de `qa` en `mvp` ⇒ parada con código propio | `tests/modos-piso-modelo.test.js` | ⏳ |
| CA-008-02 | P1 | `nivel_maximo` bajo el piso ⇒ error de configuración | `tests/modos-piso-modelo.test.js` | ⏳ |
| CA-009-01 | P1 | `init --modo`/`--persona` escriben en el sitio correcto (repo frente a estado del usuario) | `tests/init-modo-persona.test.js` | ⏳ |
| CA-009-02 | P1 | Alias `--preset`/`--perfil` con aviso | `tests/init-modo-persona.test.js` | ⏳ |
| CA-009-03 | P1 | `--modo prototipo` sin detectores ⇒ código ≠ 0 | `tests/init-modo-persona.test.js` | ⏳ |
| CA-009-04 | P2 | Selector con entrada estándar real en Windows | Ejecución manual registrada en Windows [NV hasta hacerse] | ⏳ |

## Evidencia de salida de la fase 4 (plan §5)

- Matriz modo × mínimo con un test por celda (uno que falla y otro que pasa).
- Mutación sobre `core/modos/` (umbral [NV]).
- Tasa de detección de disparadores publicada sobre el corpus.
- `npm test`, `npm run typecheck` y `node scripts/emular-instalacion.mjs` en verde en Windows y Linux.

## Lo no verificado al redactar

- Líneas citadas desde las notas sin reabrir: `core/sandbox/politica.js:167`, `core/ciclo/nodos.js:448-533`, `core/integraciones/aprobacion.js`.
- Que los presets y `agentes:` no tengan ningún efecto en ejecución (solo comprobado que no hay lector para `comportamiento.*`, `calidad.*` y `sesion.modo` en `core/`).
- Que el registro de aprobaciones admita un tipo «modo» sin cambiar su formato.
