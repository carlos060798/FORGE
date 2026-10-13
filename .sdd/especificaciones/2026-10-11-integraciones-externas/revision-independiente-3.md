# Revisión independiente 3 — cola autenticada y mutación por aserción (PARCIAL, en curso)

- **Base:** rama `feature/motor-agentico`, commit `e2c9fa0`.
- **Estado de este archivo:** parcial; se completa más abajo.

## Hallazgos previos de la revisión 2 (A), re-ejecutados

| id | ¿sigue? | cómo lo comprobé |
|---|---|---|
| H1 | NO | pendiente fabricado en `.sdd/integraciones/pendientes/` con huella calculada: `pendiente_no_autenticado`, 0 peticiones. En el estado del usuario con HMAC de otra clave: ídem. |
| H2 | NO | pendientes sellados con clave válida (simula un fallo interno) con `package.json`, `.npmrc`, `.env`, `Makefile`, `.vscode/tasks.json`, `scripts/postinstall.sh`, `.GitHub/workflows/x.yml`, sha256 falso: todos `archivo_no_publicable`, 0 POST. |
| H3 | NO | JSON editado a mano (destino/referencia/operacion) con huella y hmac viejos: `pendiente_no_autenticado`. |
| H8 | NO | repo con `github_modo: proponer` sin `FORGE_INTEGRACIONES_ESCRITURA`: `publicar` falla, modo efectivo `solo_lectura`; con `FORGE_INTEGRACIONES_DESTINOS=org/solo`, destino rechazado. |
| H9 | NO | `alcance.json` del árbol ignorado; el del usuario vaciado (`{}`) o sin firma bloquea (fallo cerrado). |

(Resto del informe en preparación.)
