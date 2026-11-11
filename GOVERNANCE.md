# Gobernanza

Este documento describe cómo se toman decisiones en Fragua (FORGE) tal como funciona hoy, sin añadir estructuras que no existen.

## Modelo actual: mantenedor único

- El proyecto tiene **un mantenedor**, **carlos060798** (propietario del repositorio https://github.com/carlos060798/FORGE, titular de la [licencia MIT](LICENSE)). En estos documentos se le llama «el dueño».
- No hay comité, junta, votaciones, fundación ni empresa detrás. No hay acuerdos de nivel de servicio ni plazos garantizados.
- Las decisiones finales son del dueño. Las contribuciones externas son bienvenidas y se aceptan cuando cumplen el proceso de abajo.

## Cómo se decide: spec y ADR

Las decisiones no se toman de palabra: quedan escritas en el repositorio (reglas completas en [AGENTS.md](AGENTS.md), sección «Cómo se cambia algo», y en [.sdd/memoria/constitucion.md](.sdd/memoria/constitucion.md), que manda si hay diferencias).

| Tipo de decisión | Dónde queda |
|---|---|
| Qué se construye y por qué | Una especificación en `.sdd/especificaciones/<id>/spec.md` ([plantilla](plantillas/especificacion.md)), listada en [.sdd/INDICE.md](.sdd/INDICE.md) |
| Una decisión técnica no trivial | Un ADR en `.sdd/arquitectura/ADR-NN-*.md` ([plantilla](plantillas/decision-arquitectura.md)). Una dependencia nueva siempre lo exige |
| Las reglas no negociables del proyecto | La constitución, `.sdd/memoria/constitucion.md` |
| Qué cambió y cuándo | [CHANGELOG.md](CHANGELOG.md) y [VERSIONING.md](VERSIONING.md) |
| Cuándo se publica una versión | Decisión del dueño, con las condiciones de [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md) |

Estados de una especificación: `borrador`, `en_revision`, `aprobada`, `en_implementacion`, `completada`.

## Cómo se aprueba

- **La aprobación de una spec y de su plan es del dueño.** Ningún agente, comando ni contribuidor la marca por su cuenta. Hoy se registra con `fragua aprobar` en una terminal interactiva, firmado con la clave local del dueño.
- Un ADR nace como `propuesta` y pasa a `aceptada` cuando el dueño lo decide.
- Una PR se revisa con [REVIEW.md](REVIEW.md) (corrección, seguridad, cumplimiento de la spec). La fusión a `main` es del dueño.
- Algunos cambios exigen versión MAYOR (romper `forge run` o `forge resume`, la interfaz pública, o subir el mínimo de Node). Está en AGENTS.md.
- La honestidad es una regla de revisión: ningún documento puede afirmar una capacidad que el código no tiene.

## Cómo proponer un cambio

1. **Idea o duda:** abre una incidencia (ver [SUPPORT.md](SUPPORT.md)) y describe el problema, no solo la solución.
2. **Si se acepta el rumbo:** escribe la spec (y un ADR si hace falta) y ábrela como PR o enlázala en la incidencia. El dueño la aprueba o pide cambios.
3. **Implementación:** pruebas primero, luego código, como explica [CONTRIBUTING.md](CONTRIBUTING.md).
4. **Revisión y fusión** con la CI correspondiente en verde.

Si el dueño rechaza una propuesta, lo dirá en la incidencia o PR con el motivo; puedes insistir con evidencia nueva. Eres libre de bifurcar el proyecto bajo la licencia MIT.

## Conflictos y conducta

Se aplica el [código de conducta](CODE_OF_CONDUCT.md). Los desacuerdos técnicos se resuelven con evidencia (pruebas, mediciones, enlaces al código) y, si no hay acuerdo, decide el dueño.

## Cómo se llegaría a más mantenedores

No hay un proceso formal porque hoy no existe más de un mantenedor; esto es una intención, no una promesa. El camino natural sería:

1. Contribuciones sostenidas y de calidad en el tiempo (specs, pruebas y revisiones que siguen este proceso).
2. Una invitación del dueño, por escrito en una incidencia o PR, tras conocer a la persona por su trabajo en el repositorio.
3. Acceso con los permisos mínimos necesarios, ampliables con el tiempo. Se actualizarían [.github/CODEOWNERS](.github/CODEOWNERS) y este documento.

Mientras sea único, una limitación conocida: las revisiones no tienen un segundo par de ojos humano, y las aprobaciones registradas con la clave local no identifican a más de una persona (la spec `2026-11-10-equipos-y-ciclo-en-ci` trata ese problema y está en borrador).

## Decisiones pendientes del dueño

Estas decisiones no están tomadas; este documento no las inventa:

- Si se designa un segundo mantenedor o un contacto de respaldo, y con qué criterio.
- Un correo dedicado para seguridad y/o conducta (hoy solo existe el aviso privado de GitHub).
- A quién se denuncia una conducta del propio mantenedor mientras sea único.
- Un plazo o política de respuesta a PRs e incidencias, si el dueño quiere comprometerse a alguno.
- El plan de continuidad si el mantenedor deja de estar disponible (por ejemplo, transferir el repositorio).
- La fecha de publicación de la beta en npm (ver [docs/roadmap.md](docs/roadmap.md)).
- Qué autor aparece en `.claude-plugin/plugin.json` (hoy figura otra persona distinta del titular de la licencia y del repositorio).
