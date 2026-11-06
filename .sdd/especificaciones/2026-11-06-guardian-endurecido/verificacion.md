# Verificación: guardian-endurecido

> **Fecha:** 2026-11-06 · Autoevaluación escrita a mano tras ejecutar las pruebas puntuales y `npm run typecheck`. Sin revisión independiente todavía.

| Criterio | Estado | Dónde |
|---|---|---|
| CA-001-01 a CA-001-04 | Con prueba | `tests/guardian-reglas.test.js` |
| CA-002-01 | Con prueba (JSON ilegible, vacío, no objeto, módulo roto) | `tests/pre-tool-guard.test.js`, `tests/guardian-endurecido.test.js`; el `.sh` sin Node: **sin prueba automática** |
| CA-002-02 | Con prueba (ruta relativa, absoluta, con `..`; variable del dueño) | `tests/guardian-endurecido.test.js`, `tests/evals/casos-guardian.json` |
| CA-002-03 | Con prueba | `tests/guardian-endurecido.test.js` |
| CA-002-04 | Con prueba | `tests/guardian-endurecido.test.js` |
| CA-002-05 | Con prueba (la redacción de la auditoría solo se ejerce si el comando se permite) | `tests/guardian-endurecido.test.js` |
| CA-003-01 | Con prueba: `init` en un proyecto temporal y el hook instalado bloquea | `tests/hook-instalado.test.js` |

Prueba de los hallazgos del informe: los eventos de `docs/informes/SEGURIDAD-CIBER.md` (C-01, C-02, C-04, C-05, C-06, C-07) están como casos en `tests/evals/casos-guardian.json` y todos bloquean.

## Límites

- Es una **lista de comprobaciones sobre texto**, no un intérprete de shell: alias, funciones, `eval`, here-docs, variables (`$X`) y archivos de script ejecutados después no se resuelven. Por eso no es un límite de seguridad.
- La identidad del agente viene de `CLAUDE_AGENT_NAME`; si falta, los guardias de solo lectura no actúan (el hook lo avisa).
- No probado con Claude Code real en un proyecto de terceros.
- El guardián se protege a sí mismo con su propia lista de rutas: si el dueño lanza Claude Code con `FORGE_EDITAR_GUARDIAN=1`, esa protección queda desactivada para esa sesión.
- La clave HMAC (C-03) sigue al alcance del mismo usuario: el hook solo bloquea leerla desde la shell o `Read`.
