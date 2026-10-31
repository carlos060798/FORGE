# REVIEW.md — criterios de revisión de un cambio

Para quien revise un cambio (una persona o un agente). La aprobación final es siempre de una persona.
Tres pasadas, en este orden. Omite comentarios de estilo menor: aquí no hay linter ni formateador y no se inventa uno.

## 1. Corrección

- ¿Hace lo que dice la especificación (`.sdd/especificaciones/<id>/spec.md`) y nada más?
- Casos límite: entradas vacías, hostiles o muy grandes; rutas con `\` y `/`; mayúsculas en Windows y macOS.
- Las decisiones del flujo (éxito, reintento, parada) se basan en códigos de resultado y en el estado, nunca en buscar texto en una salida.
- El estado se guarda de forma atómica y los eventos van a un registro de solo adición.
- Criterio de apoyo: `agents/revisor.md`.

## 2. Seguridad

Las restricciones de [AGENTS.md](AGENTS.md) (sección «Restricciones») no son negociables. Comprueba en especial:

- Nada generado por un modelo se ejecuta en el equipo anfitrión con el ciclo verificado activo.
- Ninguna dependencia nueva sin un ADR. No sube la versión mínima de Node.
- Ningún secreto en registros, estados guardados o copias de trabajo.
- Ninguna escritura desde una salida de modelo fuera del proyecto ni en `.git/`, `.sdd/` o `.env*`.
- Nada se degrada en silencio: si falta aislamiento o proveedor, se informa y se detiene.
- Ningún proveedor de modelos fijado en un módulo. Toda sesión con modelo tiene tope de gasto.
- Criterio de apoyo: `agents/seguridad.md`.

## 3. Cumplimiento de la especificación

- Cada criterio `CA-NNN-NN` de la spec tiene una prueba que lo cita: `npx fragua verificar --criterios` (el job `evidencia` de CI lo ejecuta y guarda el informe).
- Citar un identificador no demuestra que la prueba lo compruebe: lee la prueba. Una prueba nueva debe fallar sin el cambio.
- Las pruebas existentes no se han debilitado para que pasen, y la configuración de tipos, linter, seguridad y cobertura no se ha tocado (el guardián la protege).
- `verificacion.md` de la spec dice, criterio a criterio, qué tiene prueba, qué quedó a medias y qué no se hizo. Ningún documento afirma una capacidad que el código no tiene.
- Criterio de apoyo: `agents/critico.md`.
