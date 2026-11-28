# Verificación: Componente de revisión con IA

> Spec: `spec.md` · Estado: **borrador. No hay plan, tareas, pruebas ni código.** Este documento no afirma nada como hecho: solo fija contra qué se verificará y qué existe hoy. Se actualizará criterio a criterio al implementar (Principio XI).

## 1. Lo que existe hoy y se reutiliza (comprobado leyendo el código el 2026-11-27, sin ejecutar nada)

| Pieza | Dónde | Sirve para |
|---|---|---|
| Niveles neutrales y resolución de modelo | `core/llm-providers/niveles.js:12,27,52,78` | CA-002-02 |
| Error de proveedor desconocido | `core/llm-providers/index.js:221` | CA-002-04 |
| Libro de costos del ciclo (parada con `agotado`, `ErrorConsumo`) | `core/ciclo/presupuesto.js:14,26,36,50` | CA-003-02, CA-003-04 (base; hay que extraerlo a un módulo común) |
| `SessionBudget`: solo avisa, no detiene | `core/session-budget.js:166,183-190` | Motivo de CA-003-05 |
| Texto de terceros como dato | `core/integraciones/confianza.js:250`, `core/ciclo/dato-no-confiable.js` | CA-005-01 |
| Redacción de secretos | `core/ciclo/redactar.js` (importada en `confianza.js`) | CA-005-05 |

No existe `core/revision/`, ni `fragua revisar`, ni corpus de evaluación [V-código: no hay ningún archivo con ese nombre en `core/` ni en `cli/` en este worktree; no se ejecutó una búsqueda exhaustiva de sinónimos, [NV]].

## 2. Criterios de aceptación

Leyenda: **Pendiente** = sin prueba ni código. **Depende** = no se puede cumplir hasta que exista la spec o el ADR citado.

| CA | Estado | Cómo se verificará (propuesta) | Depende de |
|---|---|---|---|
| CA-001-01 | Pendiente | Prueba de CLI con repositorio temporal y `stub` explícito: código 0 e informe bajo `.sdd/` | – |
| CA-001-02 | Pendiente | Interceptor de red que falla si se usa | – |
| CA-001-03 | Pendiente | Diff vacío: código propio, 0 llamadas | códigos de salida (§11) |
| CA-001-04 | Pendiente | Diff sobre el tope: informe «cobertura parcial» | – |
| CA-001-05 | Pendiente | Entrada de plataforma simulada (borrador, bifurcación) | revision-publicada |
| CA-002-01 | Pendiente | Prueba existente de literales de modelo, ampliada | proveedor-no-fijado |
| CA-002-02 | Pendiente | Nivel inválido: código 1, 0 llamadas | – |
| CA-002-03 | Depende | Sin clave: código 1; con `--proveedor stub`: evidencia marcada | stub-explicito |
| CA-002-04 | Pendiente | Nombre de proveedor mal escrito | – |
| CA-002-05 | Pendiente | `doctor` con nivel bajo el piso | umbral [NV] |
| CA-003-01 a CA-003-04 | Pendiente | Proveedor guionizado con consumo conocido: tope 0, tope a mitad, modelo sin precio, consumo inválido | tope-duro-comun |
| CA-003-05 | Depende | Prueba que falla si el componente usa `SessionBudget` como único freno | tope-duro-comun |
| CA-003-06, CA-003-07 | Pendiente | Proveedor local sin coste; texto de limitación en el informe | – |
| CA-004-01 a CA-004-06 | Pendiente | Respuestas guionizadas válidas e inválidas; hallazgo fuera del diff; duplicados; orden estable en 2 ejecuciones; tope de mostrados | ADR-31, severidad [POR_DECIDIR] |
| CA-004-07 | Pendiente | Exportación y comparación de recuento con el informe | ADR-31 |
| CA-005-01 a CA-005-05 | Pendiente | Corpus hostil × (diff, título, comentario) con respuestas guionizadas; interceptor que detecta cualquier herramienta entregada al modelo; archivo de reglas modificado por el propio diff | – |
| CA-006-01 | Pendiente | Misma revisión con 0 y con 10 hallazgos críticos: mismo código de salida | – |
| CA-006-02 | Pendiente | Prueba de invariancia del veredicto con y sin componente | contrato-de-componente |
| CA-006-03, CA-006-04 | Pendiente | Prueba de texto del informe: sin palabras de aprobación; campos G0 y proveedor presentes | nivel-de-garantia-en-evidencia |
| CA-006-05 | Pendiente | Modo con «revisión humana»: el informe de IA no la satisface | modos-de-riesgo-y-persona |
| CA-007-01 a CA-007-03 | Pendiente | Cálculo de precisión y recall sobre un corpus mínimo con respuestas guionizadas y variación entre repeticiones | corpus por construir |
| CA-007-04 | Pendiente | Evaluación determinista con `stub` en la suite normal | – |
| CA-007-05 | Pendiente | Ejecución manual con modelo real y tope; **no hay evidencia hoy** | clave del dueño, corpus |
| CA-007-06 a CA-007-08 | Pendiente | Informe con y sin medida publicada; corpus bajo el mínimo | – |
| CA-008-01 a CA-008-04 | Pendiente | Repositorio hostil que declara el componente; carga perezosa; `package.json` sin cambios; motor externo con salida simulada | contrato-de-componente, ADR-31 |

## 3. Qué NO se ha hecho

- Nada del contenido de la spec. No se escribió código ni pruebas.
- No se midió ninguna precisión ni recall. Las cifras del §5 de la spec son ejemplos.
- No se comprobó cómo se comporta ningún proveedor real como revisor.

## 4. Riesgos que esta verificación no cubrirá aunque todo pase

- Un recall alto en un corpus propio pequeño no garantiza recall en código real. Por eso el informe publica el número de casos.
- Un revisor puede estar bien medido y aun así ser ignorado o aceptado sin leer (ASI09 del ADR-22): la spec no lo puede impedir.
