# ADR-26: Fuera de Claude Code, el guardián clasifica por su entrada la herramienta que no reconoce

> Estado: propuesta (pendiente de aceptación formal del dueño)  # propuesta | aceptada | obsoleta | reemplazada-por-ADR-XX
> Fecha: 2026-11-11
> Spec relacionada: 2026-11-11-guardian-fuera-de-claude-code (CA-002-05)
> Autor: Claude (pendiente de aceptación por el dueño)
> Evidencia: auditoría interna del 2026-11-11 (tabla de eventos en `docs/informes/EVALUACION-AGNOSTICISMO.md`, §4) y `tests/hooks-anfitrion.test.js`

## Contexto

`fragua guardian evaluar --anfitrion <x>` traduce el evento de cada herramienta de código a los nombres del contrato (`Bash`, `Write`, `Read`…) con una tabla por anfitrión (`NOMBRES` en `core/instalacion/hooks-anfitrion.js`). Esa tabla sale de la documentación de cada herramienta, que en Codex, Gemini y Copilot **no confirma los nombres**. Hasta hoy, un nombre que no estaba en la tabla pasaba tal cual, y el guardián de Claude Code no tiene reglas para `shell` ni `write_file`: la auditoría comprobó que en Codex `shell rm -rf /` y `write_file .env` salían con 0 (permitir). Lo mismo valía para cualquier herramienta nueva que una versión posterior añadiera.

## Decisión

Una herramienta cuyo nombre no está en la tabla **se clasifica por lo que trae su entrada**, ya normalizada:

- una orden (`command`, `cmd`, `script`, `commandLine`) → se evalúa como `Bash`;
- una ruta y un contenido → `Write`;
- solo una ruta → `Read`;
- ni orden ni ruta → pasa tal cual (no hay regla que aplicar).

La tabla de nombres confirmados sigue mandando cuando existe; la clasificación solo entra para lo que no está en ella.

## Alternativas consideradas

- **A. Dejar pasar lo desconocido (lo de antes)**: rechazada. Convierte cada nombre sin confirmar en un hueco, y lo documentado como «hueco conocido» era en la práctica la mayor parte de Codex.
- **B. Bloquear todo nombre desconocido (fallo cerrado estricto)**: rechazada. En Cursor (`failClosed`) y opencode bloquearía búsquedas, web y herramientas MCP, es decir, casi todo; la herramienta quedaría inservible y el usuario desactivaría el hook, que es peor que A.
- **C. Clasificar por la entrada (elegida)**: aplica las reglas reales a lo que puede hacer daño (órdenes y archivos) y deja pasar lo que no toca nada. Su límite es que depende de las claves de entrada: si una herramienta nombra la orden o la ruta de otra forma, la acción pasa. Ese límite se documenta y se cubre con la prueba manual por herramienta (F5).

## Consecuencias

### Positivas

- Los dos casos de la auditoría se bloquean; una herramienta nueva con `command` o `path` queda cubierta sin tocar la tabla.
- Sin cambio para los nombres confirmados ni para Claude Code (que no pasa por el traductor).

### Negativas

- Cambio de comportamiento: una acción que antes pasaba puede bloquearse si su orden o ruta cae en una regla. Se anota en el CHANGELOG.
- Falsos positivos posibles si una herramienta inocua trae una clave `command` (por ejemplo, un MCP que ejecute algo): se bloqueará solo si la orden coincide con una regla del guardián, que es lo deseado.
- La cobertura sigue siendo por heurística hasta que haya capturas reales (CA-002-04).
