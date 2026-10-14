# Plan de implementación: Proveedores agnósticos

> Spec: `spec.md` · Estado: **borrador, sin aprobar** · Decisiones existentes: ADR-19 (modelos y precios), ADR-21 (implementador por turnos). Los niveles neutrales necesitan una enmienda de ADR-19.

## 1. Suposiciones tomadas (corregibles)

| # | Pregunta de la spec | Suposición del plan | Qué cambia si se invierte |
|---|---|---|---|
| 1 | Nombres de nivel | `alto`, `medio`, `economico` | Una tabla de alias |
| 2 | `sin_precio` por defecto | `avisar` | Una constante |
| 3 | Validación real | Queda pendiente del dueño; el resto no depende de ella | Nada |
| 4 | Modelos por defecto de OpenAI | No se tocan hasta el spike S0.2 | La tabla de alias y la de precios |

## 2. Principios del diseño

- **La interfaz manda:** se implementa la forma neutra que ya existe; no se añade una por proveedor.
- **Anthropic es la referencia y no se toca:** sus pruebas actuales son la red de seguridad.
- **Conformidad antes que código:** la batería se escribe primero y falla con OpenAI y Ollama hasta que se implementen.
- **El gasto nunca baja solo:** coste cero únicamente por declaración explícita.

## 3. Módulos

| Módulo | Cambio |
|---|---|
| `tests/proveedores-conformidad.test.js` (nuevo) | Batería parametrizada |
| `tests/fixtures/proveedores/` (nuevo) | Servidores falsos de la API de chat de OpenAI y de Ollama; el de Anthropic usa el cliente inyectable que ya existe |
| `core/llm-providers/openai-provider.js` | `conversar`, traducción de bloques y de motivos de parada, `admiteHerramientas` condicionado |
| `core/llm-providers/ollama-provider.js` | `conversar` y detección de modelo sin herramientas |
| `core/llm-providers/niveles.js` (nuevo) | Niveles neutrales y alias; un solo sitio |
| `core/ciclo/config.js`, `core/agent-registry.js`, `core/ciclo/presupuesto.js` | Usar `niveles.js`; opción `presupuesto.sin_precio` |
| `core/precios.js` | Aviso de modelo sin precio; revisión de la tabla de OpenAI |
| `scripts/pruebas-independientes.mjs` | `--proveedor` |
| `cli/index.js` (`doctor`) | Mostrar a qué modelo resuelve cada nivel |

## 4. Traducción de la conversación

| Forma neutra | API de chat de OpenAI | Nota |
|---|---|---|
| `herramientas[{ nombre, descripcion, esquema }]` | Lista de funciones con nombre, descripción y parámetros | — |
| Bloque `uso_herramienta` | Llamada a función en el mensaje del asistente, con argumentos como texto JSON | Argumentos no válidos: error de herramienta, no excepción |
| Bloque `resultado_herramienta` | Mensaje de rol herramienta con el identificador de la llamada | Un mensaje por resultado |
| `stopReason` | Motivo de fin de la respuesta | Tabla fija; lo desconocido es `otro` |
| Bloque `opaco` | Se devuelve tal cual | Para lo que el proveedor exija conservar |

Los nombres exactos de los campos se fijan en el spike S0.1, desde la documentación oficial vigente; aquí no se escriben de memoria.

## 5. Fases

| Fase | Contenido | Sale con |
|---|---|---|
| S0 | Spikes: forma de las herramientas, tarifas, puntos donde se resuelven los niveles y de dónde sale `base_url` | `spikes/` |
| F1 | Batería de conformidad y servidores falsos; pasa con Anthropic y el proveedor de pruebas, falla donde debe con los otros | HU-001 |
| F2 | `conversar` en OpenAI; ciclo por turnos de punta a punta con servidor falso | HU-002 |
| F3 | `conversar` en Ollama | HU-003 |
| F4 | Gasto: coste cero explícito, aviso, `sin_precio`, tabla revisada | HU-004 |
| F5 | Niveles neutrales y enmienda de ADR-19 | HU-005 |
| F6 | `--proveedor` en el kit y, con el dueño, validación real | HU-006 |
| F7 | Documentación, revisión independiente del gasto y de las claves | Cierre |

## 6. Pruebas

- Batería de conformidad con los cuatro proveedores.
- Las pruebas actuales de Anthropic, del ciclo por turnos y del presupuesto, sin modificar.
- Equivalencia de niveles: mismos resultados con alias antiguos y nombres nuevos.
- Centinela de la clave en registros, errores y prompts.
- Windows y contenedor Linux.

## 7. Riesgos del plan

| Riesgo | Señal | Respuesta |
|---|---|---|
| La forma neutra no alcanza para otro proveedor | La batería no puede pasar sin cambiar la interfaz | Ampliar la interfaz aquí y actualizar ADR-21 |
| Los puntos «compatibles» difieren entre sí | Fallos solo con algunos | Se promete la API oficial; lo demás, «compatible sin garantía» |
| Cambiar niveles rompe la degradación por presupuesto | Falla la prueba de equivalencia | No se fusiona |
| `base_url` del proyecto filtra la clave | Spike S0.3 | Se corrige en esta spec con prioridad sobre el resto |

## 8. Revisión

Toca gasto y credenciales: revisión independiente antes de fusionar, como las anteriores.
