# Spike S0.2: resolución de `tope_usd` y cómo aplicar `min()` sin que el repositorio lo suba

> Lectura de `core/ciclo/config.js`, `ciclo/index.js`, `ciclo/diario.js`; un experimento con `leerConfigCiclo` sobre un YAML hostil (2026-10-17).

## Cómo se resuelve hoy

1. Valor por defecto 2,0 USD (`TOPE_POR_DEFECTO_USD`, `config.js:19`; `POR_DEFECTO.presupuesto.tope_usd`, `:59`).
2. El proyecto puede declarar `presupuesto.tope_usd` en `.sdd/sdd.config.yaml`; si es **mayor** que 2,0 se ignora con aviso y vuelve a 2,0 (`:380-392`, función `avisarTopeIgnorado`, `:22-27`). Experimento: `tope_usd: 50` + `umbral_degradacion_usd: 40` → `{ tope_usd: 2, umbral_degradacion_usd: 2 }`. El proyecto solo puede **bajarlo**.
3. El usuario puede **subirlo** (o fijarlo) con `FRAGUA_BUDGET_USD` / `FORGE_BUDGET_USD` (`:380-385`, `leerVariable('BUDGET_USD')`); un valor no numérico o negativo se ignora en silencio.
4. Después, el tope **ampliado por una persona** vive en el libro de la sesión: `libro.tope()` (`core/ciclo/diario.js:196-206`), valor firmado con HMAC con la clave local del usuario (`:208-214`); un `tope.json` sin firma válida o sin estado de usuario se ignora (`tope() → null`). Se usa así: tope inicial `libro.tope() ?? config.presupuesto.tope_usd` (`ciclo/index.js:501`); al reanudar `Math.max(estado.presupuesto.tope_usd, libro.tope() ?? 0)` (`:513`); y `forge status` (`:167`).
5. `--presupuesto-extra N` en `resume --decision` suma sin techo (`presupuesto.js:168-172`; ver `presupuesto-extra-api.md`).

## Consecuencia para el `min()`

Aplicar el mínimo **solo en `leerConfigCiclo` no basta**: el punto 4 permite que `libro.tope()` (de una sesión previa donde una persona amplió) o `Math.max(..., libro.tope())` (`:513`) devuelvan algo mayor que la configuración. El cap del MCP debe aplicarse **donde se compone el tope efectivo**, en un único sitio:

```
topeEfectivo = min( topeCalculadoActual, FRAGUA_MCP_TOPE_USD )   // y umbral_degradacion ≤ topeEfectivo
```

Sitios: `ciclo/index.js:501` y `:513` (y el `punto.estado` restaurado de checkpoint, `:495`: un checkpoint con tope alto, ya firmado o no, también debe recortarse), más `forge status`. Mejor: una función `topeEfectivo(estado, libro, techo)` en `presupuesto.js` usada por los tres.

## De dónde sale el techo (decisión)

- `FRAGUA_MCP_TOPE_USD` (variable del entorno del USUARIO), leída con `leerVariable('MCP_TOPE_USD')` (que ya soporta el prefijo `FORGE_`, y conflicto entre ambos: `ErrorVariableEnConflicto`, `core/entorno.js`). **Sin la variable, la fase 3 queda apagada** (CA-006-04; fase 1 no gasta, no la necesita).
- Validar: número finito > 0 y con un máximo duro razonable (p. ej. ≤ 50) para que un error de tecleo (`FRAGUA_MCP_TOPE_USD=1000`) no sea un cheque en blanco. Valor inválido ⇒ apagado (coherente con el patrón `leerVariableRestrictiva` del interruptor de integraciones, `core/entorno.js`/`sandbox/politica.js:285-301`).
- El repositorio no la controla: `.sdd/sdd.config.yaml` nunca la lee. Si se quiere permitir que el proyecto la **baje**, `min()` ya lo cubre (proyecto ≤ 2 y ≤ techo).
- El proceso del ciclo lanzado tras la aprobación hereda un entorno controlado: el que lanza (terminal del usuario) pone `FRAGUA_BUDGET_USD = topeEfectivo` y el `min()` en `presupuesto.js` actúa de segunda defensa.

## Qué cambia en la spec o el plan

- Plan F5.2: el `min()` va en `presupuesto.js` (función pura, probada con: proyecto alto, entorno alto, libro alto, checkpoint alto, `--presupuesto-extra`), no en `config.js`.
- Añadir a la spec que `--presupuesto-extra` sobre una sesión originada en MCP **también** respeta el techo (o queda como decisión humana explícita: documentarlo).
- `FRAGUA_BUDGET_USD` y `FRAGUA_MCP_TOPE_USD` son dos variables distintas con roles distintos; evitar que el MCP use la primera.

## Riesgos

- Gasto ya hecho no se recorta: si la sesión ya gastó 3 USD y el techo es 1, `estadoDe` da `agotado` (`presupuesto.js:27`); correcto y deseable (falla cerrado).
- `tope_usd` aplica por **sesión** (libro); varias solicitudes aprobadas son varias sesiones o no: decisión de F5 (contador diario además, como `topeDiarioDe` de integraciones).
