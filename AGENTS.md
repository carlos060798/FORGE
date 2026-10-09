# AGENTS.md — FORGE

Instrucciones para agentes de código que trabajan en este repositorio. Léelas antes de cambiar nada.

## Qué es este proyecto

FORGE convierte una idea en software especificado, construido y verificado, siguiendo una metodología de desarrollo guiado por especificaciones en español.
Es un paquete de npm (`forja-mvp`) y un plugin de Claude Code: un motor en JavaScript (módulos ESM, Node ≥20, sin paso de compilación) más comandos, agentes y plantillas en Markdown.

## Cómo ejecutar las pruebas

```
npm test
```

- Usa el ejecutor nativo de Node (`node:test`). No hay que compilar nada antes.
- Las pruebas que necesitan Docker se saltan solas. Para ejecutarlas, con Docker en marcha: `FORGE_TEST_DOCKER=1 npm test` (o un archivo concreto: `FORGE_TEST_DOCKER=1 node --test tests/sandbox-real.test.js`).
- Un archivo suelto: `node --test tests/<módulo>.test.js`.
- Tipos (opcional): `npm run typecheck`, que comprueba `core/**/*.js` sobre JSDoc.
- Las pruebas no llaman a modelos de pago: usan el proveedor de pruebas (`FORGE_LLM_PROVIDER=stub`) y dobles de prueba. No añadas una prueba que necesite una clave.
- No se simula el sistema de archivos: las pruebas usan directorios temporales.

## Estructura de carpetas

| Carpeta | Qué contiene |
|---------|--------------|
| `core/` | Motor ejecutable, sin dependencia del anfitrión. `core/ciclo/` (ciclo verificado), `core/sandbox/` (aislamiento con Docker), `core/mcp/` (servidor de herramientas), `core/llm-providers/` (proveedores de modelos) |
| `cli/` | Punto de entrada de terminal (`forge`) |
| `claude-hooks/` | Integración con Claude Code |
| `commands/`, `agents/`, `skills/`, `plantillas/` | La metodología, en Markdown |
| `tests/` | Un archivo `<módulo>.test.js` por módulo de `core/` |
| `docs/` | Documentación de uso |
| `.sdd/` | Artefactos del propio repositorio: constitución, especificaciones y decisiones |

## Restricciones (no negociables)

Resumen de [`.sdd/memoria/constitucion.md`](.sdd/memoria/constitucion.md), que es la fuente y manda si hay diferencias.

- NO ejecutar código generado por un modelo en el equipo anfitrión cuando el ciclo verificado esté activo: va en un entorno aislado, sin red y con límites.
- NO agregar dependencias nuevas sin un ADR. Las pesadas o con requisitos de runtime mayores son opcionales y se cargan de forma perezosa.
- NO subir la versión mínima del runtime (Node ≥20) sin versión MAYOR.
- NO escribir secretos en registros, estados guardados ni copias de trabajo.
- NO escribir, desde una salida de modelo, fuera del directorio del proyecto ni en `.git/`, `.sdd/` o `.env*`.
- NO degradar en silencio: si el aislamiento o el proveedor no están disponibles, se informa y se detiene.
- NO romper `forge run` ni `forge resume`, ni la interfaz pública (comandos, formato de `.sdd/`), sin versión MAYOR.
- NO fijar un proveedor de modelos en ningún módulo: es configurable, incluido uno local.
- Las decisiones que dirigen el flujo (éxito, reintento, parada) se basan en códigos de resultado y en el estado, nunca en buscar texto en una salida ni en el juicio de un modelo.
- Toda sesión que consuma un modelo tiene un tope de gasto.
- Ningún documento afirma una capacidad que el código no tiene. Lo no verificado se marca como tal.

## Convenciones

- **Idioma:** español en artefactos, mensajes al usuario, comentarios y nombres del dominio.
- **Archivos:** `kebab-case.js`. **Variables:** `camelCase`. **Constantes:** `MAYUSCULAS_CON_GUION_BAJO`. **Clases y tipos:** `PascalCase`.
- **ADR:** `ADR-NN-slug.md`, con la fecha en la cabecera.
- **Pruebas:** antes que el código. Son obligatorias para enrutado, presupuesto, política de aislamiento y confinamiento de rutas.
- **Tipos:** JSDoc, opcional. No hay linter ni formateador configurados: no inventes uno sin un ADR.
- El estado se guarda de forma atómica después de cada paso y los eventos van a un registro de solo adición.

## Dónde está cada cosa

| Qué | Dónde |
|-----|-------|
| Reglas del proyecto (constitución) | [`.sdd/memoria/constitucion.md`](.sdd/memoria/constitucion.md) |
| Especificaciones: qué se pidió y por qué | `.sdd/especificaciones/<id>/spec.md`, con su `verificacion.md` |
| Índice de especificaciones | [`.sdd/INDICE.md`](.sdd/INDICE.md) |
| Decisiones de arquitectura (ADR) | `.sdd/arquitectura/ADR-NN-*.md` |
| Glosario del dominio | `.sdd/dominio/glosario.md` |
| Historial de cambios | `CHANGELOG.md` |

## Cómo se cambia algo

1. **Todo cambio empieza por una especificación** en `.sdd/especificaciones/`. Dice qué y por qué; no nombra lenguajes, bibliotecas ni herramientas.
2. La especificación y el plan los **aprueba el dueño del proyecto**. Ningún agente ni comando marca una aprobación por su cuenta.
3. Las pruebas se escriben antes que la implementación.
4. Una decisión técnica que no sea trivial se documenta como ADR.
5. Al terminar, `verificacion.md` de la especificación dice, criterio a criterio, qué tiene prueba, qué quedó a medias y qué no se hizo.
