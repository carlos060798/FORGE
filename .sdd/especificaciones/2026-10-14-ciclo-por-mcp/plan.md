# Plan de implementación: `ciclo-por-mcp`

> Spec: `spec.md` · Estado: **fase 1 en implementación (aprobada por delegación del dueño, 2026-10-17); fases 2 y 3 sin implementar** · Decisiones existentes: ADR-12 (MCP sin dependencias), ADR-15 (sin cliente MCP en los nodos), ADR-22 (decisiones de seguridad en el entorno del usuario)

## 1. Suposiciones tomadas (corregibles)

| # | Pregunta de la spec | Suposición del plan | Qué cambia si se invierte |
|---|---|---|---|
| 1 | Alcance de la implementación | Solo fase 1 (`verificar`); fases 2 y 3 quedan diseñadas | Más fases en esta entrega |
| 2 | Perfil | `--perfil verificacion` en `fragua mcp` | Un comando nuevo |
| 3 | Topes | 20/hora y 200/día, a confirmar con S0.3 | Constantes |
| 4 | `desde` en mutación | Fuera: el argumento es `mutacion_archivos` (decisión con evidencia de los spikes, ver spec §15) | Exigiría ejecutar git con texto del llamante |
| 5 | Transporte | Solo stdio | HTTP exigiría otra spec |

## 2. Principios del diseño

- **El llamante es hostil:** el esquema de cada herramienta se diseña como si lo rellenara un atacante.
- **Lista cerrada, no lista de bloqueo:** el perfil enumera lo que expone; lo demás no existe.
- **Quien concede es el usuario:** perfil, topes y tope de gasto vienen del entorno; el repositorio solo aprieta.
- **Componer, no copiar:** `verificar`, el candado, la cola firmada y la auditoría ya existen y están revisadas.
- **Aprobar no es una herramienta.**

## 3. Módulos

| Módulo | Responsabilidad |
|---|---|
| `core/mcp/perfiles.js` (nuevo) | Perfiles y sus listas cerradas; resuelve el perfil efectivo (usuario ∩ proyecto) |
| `core/mcp/herramientas-verificar.js` (nuevo) | Herramienta `verificar`: valida argumentos, llama a `core/verificar/index.js`, aplica topes y auditoría; cubre el `DockerCli` (sin `pull`/`build`, mata el contenedor al cortar) |
| `core/mcp/limites.js` (nuevo) | Contadores por hora y día en el estado del usuario; interruptor |
| `core/mcp/protocolo.js` | `validarArgumentos` valida arrays, booleanos y números (spike S0.1) |
| `core/mcp/servidor.js` | Acepta `perfil` y construye las herramientas según el perfil (cambio mínimo) |
| `core/mcp/herramientas-ciclo.js` (nuevo, fase 2-3) | `estado_ciclo` y `proponer_ciclo` |
| `core/ciclo/solicitudes.js` (nuevo, fase 3) | Cola de solicitudes firmada; reutiliza `estado-usuario.js` |
| `cli/ciclo.js` (nuevo, fase 3) | `pendientes`, `vista`, `aprobar --huella`, `rechazar` |

Se reutilizan sin cambios: `core/verificar/`, `core/ciclo/candado.js`, `core/ciclo/presupuesto.js`, `core/integraciones/estado-usuario.js` (`directorioDeEstado`, `claveLocal`, `firmar`), `core/integraciones/auditoria.js` (patrón del interruptor), `core/integraciones/confianza.js`.

## 4. Flujo

**`verificar` (fase 1)**
1. El cliente llama; el servidor comprueba interruptor y perfil.
2. Valida argumentos con el esquema (sin campos libres) y las rutas con `validarRuta`.
3. Reserva un cupo por hora y por día; si no hay, error.
4. Adquiere el candado; si está ocupado, error «ocupado».
5. Llama a `verificar({ cwd, mutacion })`; devuelve el objeto del resultado.
6. Escribe la auditoría.

**`proponer_ciclo` (fase 3)**
1. Comprueba que `FRAGUA_MCP_TOPE_USD` esté definido; si no, «apagado».
2. Valida la tarea con las reglas de `validarTareas` (`core/api/servidor.js:75`; mover a un módulo común en la implementación).
3. Crea una solicitud pendiente firmada con huella y caducidad.
4. Devuelve el id y la instrucción para la persona. **No ejecuta.**
5. La persona ejecuta `fragua ciclo vista <id>` y `fragua ciclo aprobar <id> --huella <h>`; la CLI lanza `fragua run --motor ciclo` con el tope efectivo.

## 5. Datos

- Resultado de `verificar`: el de `core/verificar/resultado.js` (`formato: 1`).
- Contadores: JSON en `<estado del usuario>/mcp/` con HMAC, igual que las integraciones.
- Solicitud: `{id, proyecto, tareas, tope_usd, nivel_maximo, motor, creada, caduca, estado, huella, hmac}`.

## 6. Fases

| Fase | Contenido | Sale con |
|---|---|---|
| S0 | Spikes S0.1 a S0.5 | `spikes/` |
| F1 | Perfil `verificacion` y herramienta `verificar` | HU-001, HU-002, HU-003 |
| F2 | Topes, interruptor, auditoría | HU-004 |
| F3 | Batería de textos hostiles contra un cliente de prueba; revisión independiente de F1 y F2 | Cierre de la fase 1 |
| F4 | `estado_ciclo` | HU-005 |
| F5 | Cola de solicitudes y comando `ciclo` | HU-006 |
| F6 | Revisión independiente de la fase 3 | Cierre |

F5 y F6 no empiezan hasta que existan y estén revisadas las especificaciones del frente C.

## 7. Pruebas

- Con el Docker falso de las pruebas del ciclo: los veredictos y códigos por MCP.
- Cliente MCP de prueba que intenta: herramienta fuera de lista, `comando`, `cwd`, rutas con `..`, ráfaga, esquema con campos extra.
- Prueba estática: el perfil no importa proveedores de modelos ni integraciones.
- `fetch` interceptado y entorno vigilado.
- Fase 3: solicitud sin huella, con huella ajena, caducada, repetida, con tope superior al del usuario; tarea con texto hostil; sin `FRAGUA_MCP_TOPE_USD`.
- Proceso hijo real hablando MCP por tubería, en Windows y Linux.

## 8. Riesgos del plan

| Riesgo | Señal | Respuesta |
|---|---|---|
| El protocolo no tiene noción de cancelación o de tiempo largo | S0.1 | Respuesta con límite de duración y error claro |
| El repositorio sube el tope por configuración | S0.2 | `min()` con el valor del usuario; prueba con repositorio hostil |
| Los contadores en el estado del usuario se corrompen | Prueba de concurrencia | Falla cerrado: sin contador válido, sin ejecución |
| Un cliente trata «ocupado» como fallo de pruebas | Pruebas con clientes reales | Veredicto explícito en el cuerpo, distinto de `fallan` |
| La aprobación de la fase 3 se hace por costumbre | Revisión | Vista obligatoria con texto, tope y modelo; tope bajo por defecto |

## 9. Revisión

Toca una superficie nueva alcanzable por texto no confiable y, en la fase 3, gasto: necesita revisión independiente con la guía OWASP de agentes antes de fusionar, **en dos pasos** (fase 1 y fase 3). Se pide revisar en especial: la lista cerrada del perfil, el `min()` del tope, que la aprobación no sea alcanzable por el protocolo, y la caducidad y el uso único de las solicitudes.
