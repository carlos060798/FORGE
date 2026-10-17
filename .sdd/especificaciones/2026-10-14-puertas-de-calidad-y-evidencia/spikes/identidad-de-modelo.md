# Spike S0.4: identidad de modelo y rol por llamada

> Solo lectura (2026-10-17).

## Qué hay

- Cada respuesta del proveedor llega al ciclo con `modelo` y `proveedor`: `core/ciclo/index.js:149` (`modelo: r.modelo, proveedor: r.provider`). Viene de `LlmAgentAdapter` (`core/agent-registry.js:262,277,300`: `modelo: modelId`).
- `modelId` es el identificador **pedido**: `resolveModelId(alias)` (`anthropic-provider.js:183`, vía `modeloDeNivel`, que respeta `modelos:` del proyecto), NO el que el servidor devuelve. `anthropic-provider.js:210-216` descarta `res.model` y solo copia usos de tokens. Es decir: el informe puede decir «se pidió X», nunca «respondió X». Un proveedor compatible (OpenAI-compatible con `base_url`) puede servir otro modelo con el mismo nombre; sin confirmar para `openai-provider.js` y `ollama-provider.js` (no se leyeron enteros).
- El rol (`coder`, `qa`) existe en la petición (`nodos.js:366,482`: `rol: 'qa'`, `rol: 'coder'`; `agente:` `tester`, `arquitecto`, `estado.tarea.agente`) pero el estado del ciclo no lo guarda por llamada.
- Dónde queda hoy el modelo: el libro de gasto anota `taskId, usd, tokens` sin modelo (`index.js:316-326`); `diario.anotarIntencion` guarda `proveedor, modelo, tokensEntrada` por intención (`index.js:401`), en `.sdd/motor/` y solo hasta que se cierra; los eventos `ciclo:consumo_estimado`, `ciclo:llamada_abortada`, `ciclo:llamada_huerfana` llevan `modelo`/`proveedor` pero solo cuando la llamada fue estimada o abortada (`index.js:338,365,391`). `EstadoCiclo` no tiene campo de modelo (`estado.js:61-82`). La degradación de modelo la decide el gasto (`presupuesto.js` `modeloEfectivo`), de modo que **el modelo de una tarea puede cambiar entre llamadas**.

## Qué falta

1. Registrar por llamada exitosa `{ rol, agente, proveedor, modeloPedido, degradado }` en un sitio durable. Candidato mínimo: un evento `ciclo:llamada` por respuesta ok en `_anotarRespuesta` (`index.js:319`), con esos campos más tokens ya conocidos; o un array `llamadas` acotado en el estado.
2. Opcional y mejor: que el proveedor devuelva el modelo informado por el servidor (`res.model` en Anthropic) como `modeloServido`, y el informe distinga «pedido» y «servido» (`null` si el proveedor no lo da).
3. Qué es «el modelo de código» de una tarea: puede haber varios (por degradación, reintentos). El informe debe llevar una **lista de pares distintos**, no un único valor, p. ej. `roles: { codigo: [{agente, proveedor, modelo, llamadas}], pruebas: [...] }`.

## Qué cambia en la spec o el plan

- Plan §5: `roles{codigo,pruebas}{agente,modelo}` pasa a listas de `{agente, proveedor, modelo, modeloServido|null, llamadas}`; `null` con motivo si no hubo llamadas (verificación sin modelo: `forge verificar` no tiene ninguna, el campo es `[]` con motivo «sin modelo», correcto y verificable por la prueba estática de `verificar.test.js`).
- Nueva tarea en F5: evento `ciclo:llamada` (tipo nuevo en `EventType`, ver spike de eventos) o campo en estado; con prueba de que no incluye texto de prompt ni respuesta.
- Aviso en la guía: la identidad es la **pedida**, declarada por el cliente de la API; no prueba qué modelo ejecutó.

## Riesgos

- Estimar «quién escribió el código» desde el rol es una convención del ciclo, no un hecho criptográfico.
- Si se guarda el modelo servido, un proveedor hostil con `base_url` permitido puede mentir; igual que hoy con los tokens.
