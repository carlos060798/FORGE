# ADR-30: Contrato de resultados de los componentes

> Estado: propuesta  # propuesta | aceptada | obsoleta | reemplazada-por-ADR-XX
> Fecha: 2026-11-27
> Spec relacionada: 2026-11-27-contrato-de-componente, 2026-11-27-componente-guardian-git, 2026-11-27-componente-seguridad
> Autor: Claude (pendiente de aceptación por el dueño)
> Evidencia: informe «Skills agnósticas git y DevOps» (tabla de códigos y traducciones). Los códigos nativos de terceros vienen de su documentación citada en ese informe; no se han probado aquí.

## Contexto

Cada herramienta usa sus propios códigos: gitleaks devuelve 1 tanto por fugas como por error salvo `--exit-code`; OSV-Scanner devuelve 0, 1, 128 (sin paquetes) y ≥127/129-255 ante errores; Claude Code bloquea un hook con 2. Las puertas actuales clasifican en `pass`, `fail`, `timeout`, `no_ejecutable` (127), `infra_error` y `no_ejecutada` (`core/puertas/ejecutar.js:48-51`, `:120-135`) [V-código]. Sin un contrato común, «no se pudo mirar» se confunde con «limpio» o un error de argumentos con un bloqueo.

## Decisión

**Resultado:** todo chequeo de un componente emite JSON con `resultado: "pass" | "fail" | "not_evaluable"`, la cobertura (chequeos evaluados frente a declarados) y hallazgos redactados (nunca valores secretos).

**Códigos de salida comunes:**

| Código | Significado | Resultado |
|---|---|---|
| 0 | Cumple; operación completada | `pass` |
| 1 | Verificación fallida (hallazgos que bloquean) | `fail` |
| 2 | Argumentos inválidos | `fail` |
| 3 | Precondición no cumplida (árbol sucio, no es repo, rama incorrecta, conflicto) | `fail` |
| 4 | Operación destructiva rechazada | `fail` |
| 5 | Error de autenticación, remoto o plataforma | `not_evaluable` |
| 6 | No evaluable (falta herramienta, token o adaptador) | `not_evaluable` |
| 7 | No concluyente: requiere decisión humana | `not_evaluable` |
| 8 | Error interno de una herramienta externa | `not_evaluable` |

**Reglas:**
1. Orden de estrictez `pass` < `not_evaluable` < `fail`. Combinar resultados toma el más estricto. `not_evaluable` nunca es éxito: en la puerta se juzga como no-`pass` (coherente con `juzgarPuertas`), y el modo decide si además bloquea (en `producto` siempre).
2. Un código no listado, una señal o una excepción se tratan como 8 → `not_evaluable`.
3. **Traducción de terceros** (siempre explícita y probada por componente): OSV 0→0, 1→1, 128→6, resto ≥127→8; gitleaks con `--exit-code` dedicado: código de fuga→1, error→8; ausencia del binario (127 en puertas)→6. `git bisect run` conserva su 125 dentro de su propio script.
4. **Adaptadores de anfitrión**: el adaptador de hooks de Claude Code traduce 4→2; ningún otro código produce 2 en ese adaptador.
5. Relación con las categorías actuales: `no_ejecutable` se corresponde con 6; `infra_error` con 8. El mapeo se implementa sin cambiar el veredicto actual del núcleo [NV: confirmar con pruebas de caracterización].

## Alternativas consideradas

| Alternativa | Por qué no |
|---|---|
| Pasar los códigos nativos tal cual | Ambiguos (gitleaks 1) y distintos entre herramientas |
| Solo dos estados `pass/fail` | Oculta lo no evaluado; tienta a tratarlo como limpio o a castigarlo siempre |
| Reutilizar 2 para «bloqueado» en todos lados | Choca con «argumentos inválidos» |

## Consecuencias

### Positivas
- Decisión por código de salida en todos los anfitriones; `not_evaluable` visible como rasgo propio.

### Negativas
- Una tabla de traducción por herramienta que mantener y probar.

### Neutrales
- El núcleo conserva sus categorías internas; el contrato es la frontera hacia componentes y anfitriones.

## Cuándo revisitar

- Si una herramienta cambia sus códigos documentados.
- Si se necesita distinguir más estados (p. ej. «con advertencias»).

## Referencias

- Informe «Skills agnósticas git y DevOps», tabla de códigos 0-8 y traducciones.
- `core/puertas/ejecutar.js:48-51`, `:120-135`.
- ADR-29, ADR-32.
