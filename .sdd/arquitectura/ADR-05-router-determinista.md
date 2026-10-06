# ADR-05: Router determinista, éxito antes que topes

> Estado: aceptada  # propuesta | aceptada | obsoleta | reemplazada-por-ADR-XX
> Fecha: 2026-10-03 (aceptada el 2026-10-05, por delegación del dueño)
> Spec relacionada: 2026-10-03-ciclo-verificado
> Autor: Claude (pendiente de aceptación por el dueño)

## Contexto

Los documentos de partida proponen dos formas de decidir el éxito: un nodo revisor con modelo que emite "PASS", y `"PASS" in test_results` sobre la salida cruda. La segunda da positivo con cualquier salida que contenga "PASSED" aunque otras pruebas fallen, y además evalúa el tope de iteraciones antes que el éxito, de modo que un pase en la quinta iteración acaba en revisión.

## Decisión

Cada ejecución se clasifica en una categoría a partir del código de salida y de banderas del runtime, nunca del texto:

```
infra_error  si exitCode ∈ {125, 126, 127}, el daemon no responde o falta la imagen
timeout      si timedOut
pass         si exitCode === 0 && !timedOut && hay pruebas && sus huellas están intactas
fail         en otro caso (incluye oomKilled)
```

Después del sandbox, `decidirRuta` aplica este orden:

1. `infra_error` → revisión humana (motivo `infraestructura`; no cuenta como iteración)
2. `pass` → éxito
3. presupuesto `agotado` → revisión humana (motivo `presupuesto`)
4. `iteracion >= maxIteraciones` → revisión humana (motivo `iteraciones`)
5. en otro caso → `coder`

Después de `planner` y `qa`, `guardiaPresupuesto` envía a revisión si el estado es `agotado`.

**Ajuste al implementar (2026-10-03).** Tras `coder` no hay guardia: siempre se ejecutan las pruebas. Ejecutar no cuesta dinero, y si pasan, el trabajo ya pagado termina en éxito aunque el presupuesto se haya agotado. Además, un contenedor matado por tiempo no deja código de salida: se clasifica como `timeout`, no como `infra_error` (lo destapó la suite con Docker real).

## Alternativas consideradas

- **A. Buscar una cadena en la salida**: rechazada por falsos positivos (Principio VI).
- **B. Nodo revisor con modelo**: rechazada porque la decisión no es reproducible y cuesta dinero en cada iteración.
- **C. Topes antes que éxito**: rechazada porque descarta un éxito legítimo en la última iteración (CA-001-03).
- **D. Categoría por código de salida, éxito primero**: aceptada.

## Consecuencias

### Positivas
- El router es una función pura con tabla de verdad completa y comprobable.
- No hay falso pase por cero pruebas ni por pruebas alteradas (CA-001-05, CA-002-03).

### Negativas
- Depende de que el ejecutor de pruebas del proyecto devuelva un código distinto de cero al fallar.
- No detecta pruebas triviales que pasan siempre; eso queda para CA-002-04 y la revisión.

### Neutrales
- El texto de la salida sigue llegando al implementador para corregir, pero no interviene en la decisión.

## Cuándo revisitar

- Si aparecen ejecutores de pruebas que devuelven 0 con fallos.
- Si se añade una spec que incorpore un revisor de calidad como paso posterior, no como router.

## Referencias

- `../doc/estructura_de_implementaci_n_para_el_agente_cursor_claude.md` §3 (líneas 46-51)
- `../doc/03_system_prompts.md` §3
