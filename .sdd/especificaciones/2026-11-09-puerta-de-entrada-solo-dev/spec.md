---
id: 2026-11-09-puerta-de-entrada-solo-dev
titulo: "Puerta de entrada para el desarrollador individual: perfil esencial y preset lean por defecto, doctor con siguiente paso, catálogo sin duplicados"
tamano: pequeño  # micro | pequeño | mediano | grande
estado: borrador  # borrador | en_revision | aprobada | en_implementacion | completada
creada: 2026-11-09
actualizada: 2026-11-09
autor: humano  # humano | importado
constitucion_version: 1.1.0
etiquetas: [instalacion, experiencia, mvp, catalogo]
---

# Especificación: puerta de entrada para el desarrollador individual

> **Estado (2026-11-09): borrador.** Redactada por un agente dentro del plan «Marco Mínimo Viable para el desarrollador individual» (Fase 2), en la rama `fase-2-puerta-de-entrada`; **la aprueba el dueño** con `fragua aprobar spec`. No se fusiona en `main` hasta que la CI esté verde (Fase 1). El código va en el mismo cambio para que el dueño lo revise con la spec.

## 1. Contexto y Motivación

El primer usuario del MVP es una persona sola, en Windows, con Claude Code, Docker Desktop y una clave de Anthropic. Hoy `forge init` sin opciones instala 39 comandos y la configuración de ejemplo dice «preset lean por defecto» pero activa otro conjunto de agentes (arquitecto y revisor con opus, documentador con haiku), lo que contradice `README.md`, `docs/agents.md` y `docs/configuration.md`. `forge doctor` comprueba Node, clave y Docker pero no dice qué hacer después, y ante un Docker Desktop instalado pero cerrado da el mismo mensaje que si no estuviera instalado. El catálogo tiene duplicados que confunden (`deploy-vercel`/`vercel-deploy`, cuatro comandos de ahorro de contexto) y `__tests__/` contiene tres archivos que no prueban código del proyecto.

## 2. Objetivo

Que alguien con Windows 11, Node ≥ 20, Docker Desktop y Claude Code llegue de la instalación a una tarea verificada en contenedor con seis comandos y una página de documentación, sin leer el resto; y que lo que la documentación promete por defecto (perfil esencial, preset lean) sea lo que de verdad se instala.

## 3. Criterios de aceptación

### Defaults
- **CA-001-01** `forge init` sin `--perfil` instala el perfil `esencial` (6 comandos: `forge`, `sdd.especificar`, `sdd.planificar`, `sdd.tareas`, `sdd.implementar`, `sdd.estado`). `--perfil completo` instala los 39. `forge update` sobre una instalación anterior completa y sin sección `instalacion:` no borra nada.
- **CA-001-02** La configuración de ejemplo (`configuracion-ejemplo/sdd.config.yaml`) activa exactamente los agentes que `presets/lean.yaml` marca `activo: true`, con el mismo modelo (sonnet), y ningún otro.
- **CA-001-03** Las integraciones que no son Claude Code reciben las skills de los comandos del perfil efectivo: con el perfil por defecto, las 31 skills más 6 generadas.
- **CA-001-04** Al terminar `forge init`, el mensaje final nombra el perfil instalado, el camino de cinco comandos y `fragua doctor` como siguiente orden.

### `doctor`
- **CA-002-01** `forge doctor` termina con una sección «Siguiente paso» con el camino feliz: `/sdd.especificar` → `/sdd.planificar` → `/sdd.tareas` → `/sdd.implementar` → `/sdd.estado`, y qué hacer si Docker no está (`--motor clasico`, con aviso de que no hay aislamiento).
- **CA-002-02** El diagnóstico de Docker distingue «no instalado» (el ejecutable no existe) de «instalado pero no arrancado» (el ejecutable responde pero el demonio no), con una acción concreta en cada caso. En Windows, el segundo dice «abre Docker Desktop».

### Catálogo
- **CA-003-01** `skills/deploy-vercel/SKILL.md` es un alias explícito de `vercel-deploy` (remite, no duplica), con su cabecera válida; nada que lo cite se rompe.
- **CA-003-02** `commands/sdd.optimizar.md` y `commands/sdd.optimizar-memoria.md` son alias explícitos de `sdd.comprimir`, como ya lo es `compact.md`; `skills-generadas/` está regenerada y sin divergencias.
- **CA-003-03** `__tests__/` desaparece; `scripts/pruebas.mjs` y `package.json` dejan de nombrarla; la suite sigue siendo la misma menos esos tres archivos.

### Documentación
- **CA-004-01** Existe `docs/PRIMEROS-15-MINUTOS.md`: requisitos, instalación, `doctor`, los cinco comandos, qué hacer en cada pausa de aprobación y el coste orientativo con lean. `README.md`, `docs/0-INDICE.md` y `docs/getting-started.md` lo enlazan.
- **CA-004-02** `docs/PLAN-DE-CIERRE.md` y `docs/PLAN-FLUJO-AI-NATIVO.md` pasan a `docs/archivo/planes/`; nada fuera de `docs/archivo/` e `informes/` los enlaza como vigentes.

## 4. Fuera de alcance

- Fusionar `arquitecto` con `architecture-designer` (`tests/catalogo.test.js` exige referencia mutua y está en los tres presets): Fase 4.
- Borrar skills o comandos (bajaría las cifras 14/39/31): Fase 4. Aquí solo alias.
- Cambiar los agentes, el ciclo o las puertas.

## 5. Cambios de comportamiento visibles

Una instalación nueva sin opciones tiene 6 comandos en `.claude/commands/` en vez de 39, y un `sdd.config.yaml` con los seis agentes de lean en sonnet. Quien quiera todo: `forge init --perfil completo` o `forge config set instalacion.perfil completo && forge update`. `forge doctor` imprime el siguiente paso. Las instalaciones existentes no cambian.

## 6. Decisiones abiertas (del dueño)

1. Aprobar esta spec y el ADR-24.
2. Confirmar que `esencial` es el perfil por defecto (la cabecera de `core/instalacion/perfiles.js` lo reservaba a esta decisión).
