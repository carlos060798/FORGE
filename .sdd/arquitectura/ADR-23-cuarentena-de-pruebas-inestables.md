# ADR-23: Cuarentena de pruebas inestables, con incidencia, fecha y caducidad

> Estado: propuesta (implementada por instrucción del plan MVP, 2026-11-09; pendiente de aceptación formal del dueño)  # propuesta | aceptada | obsoleta | reemplazada-por-ADR-XX
> Fecha: 2026-11-09
> Spec relacionada: 2026-11-09-ci-verde-y-cuarentena
> Autor: Claude (pendiente de aceptación por el dueño)
> No cambia ADR-17 (ciclo por defecto y Node 20) ni ADR-20 (medición por mutación).

## Contexto

La suite tiene más de 4000 pruebas y algunas fallan solo bajo carga o por la velocidad del disco (`docs/ESTADO-ACTUAL.md`: tiempo límite de `adfATexto`, «una cadena enorme», «5000 archivos pequeños», memoria SQLite); aisladas pasan. La CI de GitHub en `main` nunca ha estado verde. Hoy hay tres salidas, todas malas: subir el tiempo límite a ciegas (esconde la regresión real cuando llegue), borrar la prueba (se pierde la cobertura) o dejar la suite roja (nadie confía en ella y `prepublishOnly` bloquea publicar). La constitución exige que las decisiones del flujo se basen en códigos de resultado: una CI roja «por ruido» convierte ese código en algo que la gente aprende a ignorar.

El repositorio ya separa `rapido` y `lento` con `tests/lentos.txt` leído por `scripts/pruebas.mjs`, sin mover archivos (las specs citan las pruebas por su ruta).

## Decisión

Una prueba inestable se aparta en `tests/cuarentena.txt` con **tres condiciones obligatorias**: una incidencia abierta que la nombra, la fecha en que entró y un motivo. `npm test` la excluye; un job de CI no bloqueante (`cuarentena`) la sigue ejecutando para que el fallo se vea. La entrada **caduca a los 30 días**: la prueba del clasificador falla y obliga a renovarla a conciencia o a sacarla. Hay un tope de 5 entradas simultáneas. Sale de la cuarentena cuando pasa tres veces seguidas en ese job. Nada de esto reintenta pruebas ni sube tiempos límite.

## Alternativas consideradas

- **A. `node --test --test-skip-pattern`**: rechazada. Salta por nombre de prueba, no por archivo; no deja rastro de por qué ni de cuándo, y no obliga a revisarlo.
- **B. Borrar o comentar la prueba inestable**: rechazada. Pierde cobertura y nadie vuelve a mirarla.
- **C. Reintentar automáticamente las pruebas que fallan (2 o 3 intentos)**: rechazada. Convierte una prueba que falla el 30 % de las veces en «verde» y oculta carreras reales; además, va contra el principio de decidir por el código de resultado.
- **D. Subir los tiempos límite hasta que pasen**: rechazada como política. Un tiempo límite más alto deja de detectar la regresión de rendimiento que la prueba vigila. Se admite caso por caso con diagnóstico, nunca a ciegas.
- **E. Archivo de cuarentena con incidencia, fecha, caducidad y job no bloqueante (elegida)**: la prueba sigue corriendo y se ve, hay dueño (la incidencia), hay fecha de revisión forzada y la suite principal vuelve a ser una señal fiable.

## Consecuencias

### Positivas
- `npm test` vuelve a significar «todo lo que el proyecto afirma que funciona»; un rojo es una regresión, no ruido.
- Cada prueba apartada tiene incidencia, fecha y motivo: la deuda es visible y caduca.
- Las pruebas en cuarentena siguen corriendo en la CI; si una empieza a pasar, se ve en el job.

### Negativas
- Mientras una prueba está en cuarentena, la regresión que vigila puede entrar sin bloquear la fusión. Por eso el tope de 5 y la caducidad.
- `npm test` ya no es un glob que cualquiera lea en `package.json`: hay que mirar `scripts/pruebas.mjs`.

### Neutrales
- `tests/lentos.txt` no cambia; `rapido` + `lento` + `cuarentena` siguen sumando la suite entera.
- Las pruebas que se saltan por sí mismas (Docker real, enlaces en Windows) no son cuarentena: son `t.skip` con motivo y se cuentan como omitidas.

## Cuándo revisitar

Si la cuarentena se llena de forma recurrente (se toca el tope de 5 más de una vez por trimestre), el problema es de diseño de las pruebas con tiempo límite y hay que cambiarlas, no ampliar el tope. Si el job `cuarentena` lleva tres meses sin usarse, se puede quitar.

## Referencias

- `.sdd/especificaciones/2026-11-09-ci-verde-y-cuarentena/spec.md`
- `scripts/pruebas.mjs`, `tests/pruebas-clasificacion.test.js`, `tests/lentos.txt`
- `docs/ESTADO-ACTUAL.md` («Pasadas anteriores con fallos intermitentes»)
