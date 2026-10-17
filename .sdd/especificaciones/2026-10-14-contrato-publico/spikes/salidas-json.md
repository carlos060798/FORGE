# Spike S0.5: salidas `--json` de `run` y `status`

> Lectura y `grep` (2026-10-17).

## Hallazgo principal: no existen

- La única orden con `--json` es `forge verificar` (`cli/verificar.js:14,44,91`: `salida(o.json ? JSON.stringify(r) : textoDelResultado(r))`). Un `grep` de `--json` / `flags.json` en `cli/` y `core/` solo da `verificar` y la lista `debeAvisarOrdenAntigua` de `core/nombres.js:29` (que solo evita el aviso de nombre antiguo).
- `forge status` (`cli/runner.js:116-165`) y `forge run` (`core/engine-cli.js`) imprimen texto con colores; no tienen salida estructurada. `lineasEstadoCiclo` (`core/ciclo/index.js:~140-165`) devuelve líneas de texto.
- Lo más parecido a una salida de máquina de `run` son los códigos de salida `SALIDA = { OK:0, FALLO:1, REVISION:3, SIN_AISLAMIENTO:4 }` (`core/engine-cli.js:41`), y la API HTTP (`core/api/servidor.js`), que sí tiene respuestas JSON (`/v1/...`) sin esquema.

## Forma real de `verificar --json`

Una línea JSON con las 15 claves de `crearResultado` (ver `artefactos-reales.md`). `--json` imprime `JSON.stringify(r)`, sin pretty ni envoltorio; `codigoSalida` coincide con el código de proceso.

## Qué cambia en la spec o el plan

- **No entran** `run --json` ni `status --json` en la versión 1 del contrato: no se puede «congelar» una salida que no existe. Entran: `verificar --json`, el estado del ciclo (`.sdd/motor/...`) y los eventos, y la API HTTP **sólo si se decide** (sin confirmar: no se inventarió el servidor; sería otra spec).
- Si se quiere `status --json`, es una función nueva con su propia spec; deja un hueco documentado en `CONTRATO-PUBLICO.md`: «salidas de texto no son contrato».
- Documentar en el contrato el mapa **código de salida ↔ veredicto** de `verificar` (0/1/4) y los de `run` (0/1/3/4), porque es lo único estable que hoy usan los scripts de `run`.
- Tareas S0.5 → F2.3 solo prueba `verificar --json` (ya es el plan).
