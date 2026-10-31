# Flujo nativo de IA en Fragua: qué se hizo y qué falta

Fuente de la idea: https://claude.com/es/resources/articles/the-ai-native-sdlc-playbook
Especificación: [`.sdd/especificaciones/2026-10-27-flujo-nativo-de-ia/`](../.sdd/especificaciones/2026-10-27-flujo-nativo-de-ia/spec.md) (criterios, tareas y verificación).

Se reutilizó lo que ya existía; casi todo el trabajo fue cablear y exponer piezas. Está escrito para cualquier agente de código: no depende de una herramienta concreta.

## Hecho (2026-10-27, autoevaluado)

| Fase | Qué | Reutiliza |
|---|---|---|
| 1 | `CLAUDE.md` raíz (`@AGENTS.md`), `.gitignore` de `.claude/worktrees/`, `settings.json` sin rutas ajenas | `AGENTS.md` |
| 2 | El guardián bloquea escribir o editar configuración de calidad protegida | `core/evidencia/protegidos.js` |
| 3 | `REVIEW.md` (3 pasadas) y job de CI `evidencia` | `forge verificar --criterios` y `--comprobar-evidencia` |
| 4 | Tabla de 34 casos del guardián dentro de `npm test`; workflow manual con modelo real | `claude-hooks/pre-tool-guard.js`, `forge probar-modelo` |
| 5 | `forge mantenimiento`: señales del registro de eventos a borradores de idea | `core/event-log.js`, `core/escritura-segura.js`, `core/agents-md.js` |
| 6 | Indicadores en `forge status`: primer intento, reintentos, tiempo medio | `CicloVerificado.resumen()`, `.sdd/events.jsonl` |

## Falta

1. Revisión independiente (nadie ha revisado este cambio salvo quien lo escribió).
2. Probar el hook instalado en un proyecto real con Claude Code. Ya hay una prueba con `init` en un directorio temporal (`tests/hook-instalado.test.js`).
3. Ejecutar el job `evidencia` y el workflow `evals-modelo-real.yml` en GitHub Actions.
4. Que algo invoque `forge mantenimiento` solo (hoy es manual). Los umbrales (3, 3, 2) son valores por defecto sin datos detrás.
5. Decisión pendiente: archivos de prueba. El guardián no los bloquea (el agente `tester` y este repo los editan); la defensa es `core/ciclo/pruebas-confiables.js`.
6. `.claude/worktrees/` sigue teniendo ~60 carpetas `agent-*`. No se borraron: revisar y podar a mano.

## Reglas para quien continúe

1. Lee `AGENTS.md` y `.sdd/memoria/constitucion.md`: mandan sobre este documento.
2. Cada cambio empieza por una especificación aprobada por el dueño.
3. Pruebas antes que código; `npm test` y `npm run typecheck` al terminar, mostrando el resultado.
4. Sin dependencias nuevas sin ADR. No debilites pruebas para que pasen.
5. Cada incidente en el que la barrera falló se convierte en un caso nuevo de `tests/evals/casos-guardian.json`.
