# Verificación: guardian-fuera-de-claude-code

> **Fecha:** 2026-11-11 · Escrita leyendo `spec.md`, `core/instalacion/hooks-anfitrion.js`, `cli/comandos/guardian.js`, `cli/comandos/doctor.js` y las pruebas citadas. Pruebas de los archivos citados ejecutadas el 2026-11-11 en el worktree `feature/cierre-auditoria` (69 pruebas, 0 fallos en `hooks-anfitrion`, `doctor-instalacion`, `guardian-cli`, `mcp-guardian`, `instalacion-con-hooks`). La spec sigue **sin aprobar por el dueño**.

## Criterio → pruebas

| Criterio | Prueba | Estado |
|---|---|---|
| CA-001-01 códigos 0/2 y fallo cerrado | `tests/guardian-cli.test.js`; `tests/hooks-anfitrion.test.js` («un evento que no es JSON y un anfitrión desconocido fallan cerrado») | **Con prueba** |
| CA-001-02 reglas únicas | `cli/comandos/guardian.js` ejecuta `claude-hooks/pre-tool-guard.js`; no hay segunda copia | **Por diseño; sin prueba que lo impida** |
| CA-001-03 JSON inválido → 2 | `tests/guardian-cli.test.js` | **Con prueba** |
| CA-001-04 `FRAGUA_AGENTE` | `tests/guardian-cli.test.js` (identidad) | **Con prueba** (ver el archivo) |
| CA-002-01 contrato versionado y prueba | `docs/contrato/evento-herramienta.md` existe; **no hay prueba que valide la salida del traductor contra un esquema** | **A medias** |
| CA-002-02 `apply_patch` por archivo | «Codex: apply_patch da un evento de escritura por archivo del parche» | **Con prueba** |
| CA-002-03 anfitrión desconocido → 2 | `tests/guardian-cli.test.js`, `tests/hooks-anfitrion.test.js` | **Con prueba** |
| CA-002-04 capturas reales | — | **No hecho** (F5, lo hace una persona) |
| CA-002-05 herramienta no reconocida se clasifica por su entrada | «herramienta no traducida: se clasifica por su entrada…» (5 pruebas, incluida la CLI con los eventos de la auditoría) | **Con prueba** |
| CA-003-01 `--con-hooks` no pisa | `tests/instalacion-con-hooks.test.js` | **Con prueba** |
| CA-003-02 modo de fallo declarado en plantilla, `init`, `doctor`, GARANTIAS y SECURITY | Plantillas: «Cursor falla cerrado; Gemini y Codex declaran que fallan abierto». `init` lo imprime. `doctor`, GARANTIAS y SECURITY: **sin matriz** | **Parcial** |
| CA-003-03 «consultivo» donde falla abierto | Solo documento | **Sin prueba** |
| CA-003-04 sin `--con-hooks` nada | «sin la opción no se escribe ningún hook» | **Con prueba** |
| CA-003-05 `doctor` avisa si `fragua` no está en el PATH | `tests/doctor-instalacion.test.js` (3 pruebas: sin PATH, con PATH, sin hooks) | **Con prueba** |
| CA-004-01 memoria por hook | `tests/hooks-anfitrion.test.js` («memoria: eventos posteriores…») | **Con prueba** (la spec aún lo marca «no implementado»: desfasada) |

## Qué quedó a medias o sin hacer

- CA-002-04 y los criterios de éxito «al menos una herramienta con captura real»: nada probado en una herramienta real.
- CA-002-01: falta la prueba de esquema sobre la salida del traductor.
- CA-003-02: falta la matriz impuesto/consultivo en `docs/GARANTIAS-Y-LIMITES.md` y `SECURITY.md`.
- La clasificación por entrada (CA-002-05) depende de las claves `command`/`cmd`/`script`/`commandLine` y de las de ruta: una herramienta que use otras pasa sin evaluar.

## Límites de este documento

- Suite completa no ejecutada al escribirlo; solo los archivos citados.
- Otro proceso edita el árbol principal; este documento describe el worktree `feature/cierre-auditoria`.
