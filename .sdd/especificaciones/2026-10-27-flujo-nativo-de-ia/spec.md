---
id: 2026-10-27-flujo-nativo-de-ia
titulo: "Flujo nativo de IA: barreras en el guardián, revisión en capas, evals, mantenimiento por señal e indicadores"
tamano: mediano  # micro | pequeño | mediano | grande
estado: en_implementacion  # borrador | en_revision | aprobada | en_implementacion | completada
creada: 2026-10-27
actualizada: 2026-10-27
autor: humano  # humano | importado
constitucion_version: 1.1.0
etiquetas: [flujo, guardian, ci, evals, mantenimiento, metricas]
---

# Especificación: flujo nativo de IA

> **Estado (2026-10-27): en implementación por instrucción del dueño** («ejecuta el plan»). Autoevaluada, sin revisión independiente. Las specs se redactaron después del código; no es el orden que pide `AGENTS.md`.

## 1. Contexto y Motivación

Fragua ya cubre casi todo el ciclo del artículo «SDLC nativo de IA» (https://claude.com/es/resources/articles/the-ai-native-sdlc-playbook). Esta spec reúne lo que faltaba, reutilizando lo existente: el guardián no protegía la configuración de calidad en las escrituras (`core/evidencia/protegidos.js` no estaba cableado), no había criterios de revisión escritos, ni un job de CI para `verificar --criterios` y `--comprobar-evidencia`, ni una tabla de evals de la barrera, ni un paso de mantenimiento que convirtiera señales en ideas, ni indicadores del flujo.

## 2. Objetivo

Que un agente no pueda aflojar las puertas de calidad editando su configuración, que la revisión tenga criterios explícitos y comprobaciones automáticas sin modelo, que la barrera tenga una tabla de casos que crece con los incidentes, que las señales objetivas del registro de eventos produzcan borradores de idea y que `forge status` muestre indicadores del flujo.

## 3. Criterios de aceptación

### Fase 1 — Higiene
- **CA-001-01** Existe `CLAUDE.md` en la raíz que importa `AGENTS.md`, sin duplicar sus reglas.
- **CA-001-02** `.claude/worktrees/` no se versiona y `.claude/settings.json` no lleva permisos con rutas ajenas al repo.

### Fase 2 — Guardián
- **CA-002-01** Una escritura o edición sobre configuración protegida (tipos, linter, seguridad, cobertura) se bloquea con código 2, también con ruta absoluta, con `\` y con mayúsculas.
- **CA-002-02** Una escritura sin ruta no se trata como protegida; los archivos de prueba no se bloquean.
- **CA-002-03** Al instalar los hooks en un proyecto, `.claude/hooks/shared/protegidos.js` es una copia autónoma de `core/evidencia/protegidos.js`.

### Fase 3 — Revisión
- **CA-003-01** `REVIEW.md` define tres pasadas (corrección, seguridad, cumplimiento de la spec).
- **CA-003-02** Un job de CI `evidencia` ejecuta `verificar --criterios --exigir-cobertura-de-criterios` y `verificar --comprobar-evidencia` sin Docker ni modelo y sube los informes.

### Fase 4 — Evals
- **CA-004-01** Una tabla de al menos 30 casos (`tests/evals/casos-guardian.json`) se ejecuta contra el guardián real dentro de `npm test`, con casos que deben bloquear y casos que deben permitir.
- **CA-004-02** La prueba con modelo real solo se lanza a mano, con tope de gasto, y sin clave avisa en lugar de fallar o saltarse en silencio.

### Fase 5 — Mantenimiento
- **CA-005-01** `detectarSenales` aplica umbrales en código: fallos repetidos de una tarea desde su último éxito, racha de verificaciones fallidas y regresiones; no depende del orden de entrada y descarta eventos corruptos.
- **CA-005-02** El borrador trata el detalle como dato (bloque de código en una línea) y declara que no está aprobado.
- **CA-005-03** `escribirBorradores` no pisa un borrador existente. Nada de esto despliega, corrige ni aprueba.
- **CA-005-04** `forge status` avisa de cuántas señales hay y cómo dejar el borrador, solo en lectura; sin señales o con un registro ilegible, calla.

### Fase 6 — Indicadores
- **CA-006-01** Éxito al primer intento = tareas con resultado `exito` e iteración ≤ 1, sobre las terminadas; sin terminadas, la tasa es `null`.
- **CA-006-02** Tiempo medio por tarea desde `task_started` hasta `task_completed`; sin tareas medidas, «sin medir».
- **CA-006-03** `forge status` muestra los indicadores bajo el ciclo verificado.

## 4. Fuera de alcance

Cambiar el comportamiento del ciclo, bloquear archivos de prueba en el guardián (el agente `tester` y este repo los editan; la defensa es `core/ciclo/pruebas-confiables.js`), tocar `core/quality-gate.js`, borrar worktrees, y fijar un proveedor de modelos.
