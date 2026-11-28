---
spec_id: 2026-11-27-contrato-de-componente
fecha_verificacion: pendiente
veredicto: PENDIENTE  # spec en borrador; sin implementación ni verificación
---

# Verificación: 2026-11-27-contrato-de-componente

## Veredicto: **PENDIENTE**

La spec está en borrador y no está aprobada. No hay código ni pruebas. La tabla fija cómo se verificará cada criterio; la rellena un verificador independiente, no quien implemente.

| CA | Cómo se verifica (estado o código de salida) | Resultado |
|---|---|---|
| CA-001-01 | Manifiestos inválidos en fixtures → carga con código ≠ 0 y nombre del campo en stderr | — |
| CA-001-02 | `contrato` no soportado → código ≠ 0 | — |
| CA-001-03 | `amplia` con `puertas.claves` no vacío → rechazo | — |
| CA-001-04 | `si_falta` ≠ `not_evaluable` o `adr` vacío → rechazo | — |
| CA-001-05 | `modelo: true` sin tope → rechazo | — |
| CA-002-01 | Sin activación: igualdad profunda de cada lista con la del núcleo | — |
| CA-002-02 | Repo temporal hostil (manifiesto + `componentes:` + `modo:`) → listas iguales al núcleo | — |
| CA-002-03 | `FRAGUA_COMPONENTES=inexistente` → código ≠ 0 | — |
| CA-002-04 | Salida de `doctor` separa recomendado y activo | — |
| CA-003-01 | Mutar cada lista publicada lanza error | — |
| CA-003-02 | Operación de puerto sin auditoría → no carga | — |
| CA-003-03 | Escritura sin `OPERACIONES_APROBABLES` → rechazo | — |
| CA-003-04 | Declarar una operación genérica → `validarProveedor` la rechaza | — |
| CA-003-05 | Núcleo ⊆ lista publicada para toda combinación | — |
| CA-003-06 | Dos componentes con el mismo elemento → sin duplicados y orden fijo | — |
| CA-004-01 | `CLAVES_PUERTAS` igual con cualquier combinación | — |
| CA-005-01 | Caracterización en verde antes y después, sin diff en la prueba | — |
| CA-005-02 | Mismo recuento de `npm test` antes y después | — |
| CA-006-01 | Matriz casos × componentes: veredicto ≥ estrictez sin componentes | — |
| CA-006-02 | Componente «siempre pass» no cambia ningún `fail` | — |
| CA-006-03 | Componente que lanza → `not_evaluable` | — |
