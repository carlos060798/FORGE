# Hallazgo S0.5: `/v1/decisiones` con `presupuestoExtra`: ¿hay otro tope aguas abajo?

> Lectura (2026-10-17): `core/api/servidor.js:227-250`, `core/engine-cli.js:285-305`, `core/ciclo/nodos.js:555-590`, `core/ciclo/presupuesto.js:168-172`. Como hallazgo, no se corrige aquí.

## Cadena completa

1. API: `POST /v1/decisiones` acepta `decision`, `tarea`, `iteracionesExtra`, `presupuestoExtra`; valida que sean números finitos entre 0 y 1000 (`servidor.js:239-241`) y compone `['resume','--motor','ciclo','--decision',…,'--presupuesto-extra', N]` (`:243-247`), lanzado como proceso hijo del CLI.
2. `engine-cli.js:301` convierte a `Number(flags['presupuesto-extra']) || undefined` y lo pasa a la decisión.
3. `nodos.js:569`: `if (decision.presupuestoExtra) presupuesto = ampliar(presupuesto, decision.presupuestoExtra)`.
4. `ampliar` (`presupuesto.js:168-172`): `tope_usd + Math.max(0, extraUsd)`. **Sin techo**, sin comparar con `TOPE_POR_DEFECTO_USD` ni con ninguna variable del usuario. Después `index.js:543` guarda el nuevo tope en el libro, firmado con la clave local (`diario.js:208`), y vale para toda la sesión.

## Respuesta

**No hay otro tope aguas abajo.** Un solo `POST` con `presupuestoExtra: 1000` lleva el tope de la sesión a 1002 USD. Cada llamada puede repetirse (cada una hasta 1000), y no hay contador de ampliaciones ni límite acumulado. La barrera es solo el token de la API (`Authorization: Bearer`, `servidor.js:43,53`), que equivale a «quien tenga el token puede gastar sin límite».

(Para contrastar: el archivo del proyecto no puede subir el tope — `config.js:380-392` — y el firmado `libro.tope()` impide que un `tope.json` traído por el repositorio se acepte; pero esa defensa protege de un repositorio hostil, no de un cliente con token legítimo.)

## Relación con `ciclo-por-mcp`

- La fase 3 NO debe reutilizar `resume --presupuesto-extra`: cualquier ampliación en una sesión que viene de MCP tiene que respetar el techo `FRAGUA_MCP_TOPE_USD` (ver `tope-efectivo.md`). Mientras `ampliar` no tenga techo, es un camino que salta el `min()`.
- El servidor MCP no expone decisiones (`continuar|aceptar|abortar`) ni ampliaciones: correcto, no cambiar.

## Recomendación (fuera de esta spec)

- Abrir un hallazgo aparte: ponerle un techo configurable por el usuario a `presupuestoExtra` en la API (p. ej. `FRAGUA_API_EXTRA_MAX_USD`, por defecto el tope por defecto 2,0) y registrar un evento por cada ampliación. Mientras tanto, documentar que el token de la API equivale a gasto ilimitado.
- Severidad: media (requiere token de la API, local, aleatorio; pero el token se imprime en stdout al arrancar — `cli/index.js:2130`).

## Qué cambia en la spec o el plan

- Ninguna tarea de `ciclo-por-mcp` depende de arreglarlo, pero la spec debe declarar que el `min()` se aplica en el camino de `ampliar` para sesiones con origen MCP (F5.2).
