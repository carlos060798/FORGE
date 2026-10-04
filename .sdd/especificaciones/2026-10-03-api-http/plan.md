---
spec_id: 2026-10-03-api-http
estado: aprobado_por_delegacion
actualizado: 2026-10-03
---

# Plan: API HTTP local

Plan abreviado (spec mediana, un módulo). Las decisiones de fondo están en ADR-13.

## Módulos

| Archivo | Cambio |
|---|---|
| `core/api/servidor.js` | NUEVO. `crearServidorApi({cwd, token?, lanzar?})` → `{server, token, escuchar(puerto), ejecuciones, cerrar}`; `lanzarCli`; `validarTareas` |
| `cli/index.js` | Caso `api` (`--port`, `--cwd`; imprime una línea JSON con URL y secreto) |
| `tests/api-http.test.js` | NUEVO: 20 tests, uno de ellos con Docker real (`FORGE_TEST_DOCKER=1`) |

## Interfaz

| Método y ruta | Función |
|---|---|
| `GET /v1/estado` | Etapa, sesión, tareas con su situación, gasto, ejecución en curso |
| `POST /v1/ejecuciones` | Lanza `forge run --motor ciclo` con las tareas enviadas (202 + id) |
| `GET /v1/ejecuciones/:id` | Estado, código de salida y final de la salida redactada |
| `POST /v1/decisiones` | Lanza `forge resume --motor ciclo --decision ...` (202 + id) |

Errores: 401 secreto, 403 origen/host, 404, 405, 409 ejecución en curso, 413 cuerpo grande, 415 tipo, 400 validación.

## Constitution Check

Sin dependencias (IV), acceso cerrado y solo local, cuerpos acotados (64 KB), la API no puede saltarse el aislamiento porque delega en la CLI del ciclo.

## Verificación

`node --test tests/api-http.test.js` (y con `FORGE_TEST_DOCKER=1` el recorrido real), suite completa, `npx tsc` sin errores nuevos.
