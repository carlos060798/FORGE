# Cómo añadir un proveedor de modelos

Un proveedor está listo para FORGE cuando pasa la batería común de conformidad
(`tests/proveedores-conformidad.test.js`). La batería corre contra servidores falsos locales: sin red ni claves.

## 1. Implementar el contrato

`core/llm-providers/provider-interface.js` define la forma neutra:

- `nombre`, `resolveModelId(alias)` y `complete({ model, systemPrompt, userPrompt, maxTokens, signal })`
  → `{ output, inputTokens, outputTokens }`. Un proveedor con caché de prompts añade
  `cacheCreationTokens` y `cacheReadTokens`, **fuera** de `inputTokens`. Si el proveedor incluye la caché
  dentro de su recuento de entrada (como OpenAI), sepárala: el gasto no puede contarse dos veces ni por debajo.
- Opcional, para el implementador por turnos: `admiteHerramientas` (verdadero solo si hay con qué llamar:
  clave o cliente inyectado) y `conversar({ model, systemPrompt, mensajes, herramientas, maxTokens, signal })`
  → `{ contenido, stopReason, inputTokens, outputTokens }`, con `stopReason` en
  `herramientas | fin | max_tokens | rechazo | otro` (tabla fija, lo desconocido es `otro`).
- Reglas de `conversar`: argumentos de herramienta ilegibles **no** lanzan excepción (se devuelven para que el
  ejecutor los rechace y el modelo reciba un error); un bloque propio del proveedor que deba volver tal cual
  sale como `opaco`; el resultado con error llega al modelo marcado como error.
- La clave solo va en la cabecera de autenticación; redáctala en cualquier error que se lance. `redirect: 'error'`
  en cada `fetch`. La dirección del servidor la sanea `core/llm-providers/index.js` (el proyecto no es confiable).

## 2. Pasar la batería

1. Si el proveedor habla HTTP, añade su formato a `tests/fixtures/proveedores/servidor-falso.js`
   (los escenarios son neutros: texto, usos de herramienta, parada, error HTTP, «colgar»).
2. Añade un adaptador a `ADAPTADORES` en `tests/proveedores-conformidad.test.js`: cómo montar el proveedor
   contra el servidor falso y cómo leer los resultados de herramienta que recibió.
3. Declara sus capacidades (`declara`, `argumentosComoTexto`, `opaco`, ...). Quien declara `admiteHerramientas`
   y no pasa la parte de `conversar` hace fallar la batería: no se salta en silencio.
4. Lo que solo importa a este proveedor (caché, errores propios, el ciclo de punta a punta) va en su propio
   archivo de pruebas; ejemplo: `tests/openai-conversar.test.js`.

## 3. Gasto

Los precios viven en `core/precios.js` (solo lo contrastado con la tarifa oficial, con fecha). Un modelo sin
precio se cuenta al más caro conocido y el ciclo avisa una vez por sesión de qué clave de `precios:` falta.
Para un modelo sin coste real, declara cero de forma explícita en `precios:` de `.sdd/sdd.config.yaml`
(`<modelo>_entrada: 0` y `<modelo>_salida: 0`).

## 4. Validación real

Pasar la batería no prueba el proveedor con un modelo real. Hasta que se ejecute el kit de pruebas
independientes con él, la documentación debe seguir diciendo «sin probar con modelo real».
