# Tareas: Instalación agnóstica de herramienta

> Plan: `plan.md` · Cada tarea: test primero, después código. `[ ]` por hacer · `[x]` hecha.
> **Ninguna tarea empieza hasta que el dueño apruebe la spec.**

## S0 — Spikes

- [x] **S0.1** Carpeta de skills y forma de invocación de cada herramienta candidata, desde su documentación oficial, con URL y fecha. Salida: `spikes/carpetas-de-skills.md`, con «sin confirmar» donde no se pudo. Cubre CA-001-01 y CA-001-07.
- [x] **S0.2** Campos obligatorios y opcionales de la cabecera de `SKILL.md` según la especificación abierta. Salida: sección en el mismo informe. Cubre CA-003-01.

## F1 — Integración por clave

- [x] **F1.1** `core/instalacion/herramientas-destino.js`: tabla con `claude` y `generica`. Tests: clave desconocida rechazada con la lista; carpeta genérica fuera del proyecto y de la carpeta personal rechazada. Cubre CA-001-02, CA-001-03.
- [x] **F1.2** Prueba de equivalencia: foto del árbol de `forge init` y `forge update` sin opciones, antes del cambio. Cubre CA-002-01.
- [x] **F1.3** `copiarNucleo` recibe la integración; `--integracion` en `init`. Tests: equivalencia en verde; con `generica`, solo skills y `AGENTS.md`. Cubre CA-001-01, CA-002-03, CA-001-06.
- [x] **F1.4** Escritura segura en los destinos nuevos. Tests: unión hacia fuera, enlace duro, archivo ajeno existente. Cubre CA-001-04.
- [x] **F1.5** Guardar integración en la configuración y respetarla en `forge update`. Cubre CA-002-02.
- [x] **F1.6** Mensaje final con lo instalado, lo omitido y la forma de invocación. Cubre CA-001-05.

## F2 — Comandos como skills

- [x] **F2.1** `core/instalacion/skills-de-comandos.js`. Tests: los 39 comandos producen `SKILL.md` con nombre y descripción; cabecera propia de Claude Code convertida o avisada. Cubre CA-003-01, CA-003-03.
- [x] **F2.2** `scripts/generar-skills.mjs` y prueba de divergencia. Cubre CA-003-02.
- [x] **F2.3** Skills generadas en el paquete; prueba con `npm pack --dry-run`. Cubre CA-003-04.

## F3 — Perfiles

- [x] **F3.1** `core/instalacion/perfiles.js` con `esencial` y `completo`. Cubre CA-004-01.
- [x] **F3.2** `--perfil` en `init`, clave en `forge config`, aplicación en `update`. Tests: una instalación existente no cambia de perfil al actualizar. Cubre CA-004-02, CA-004-03, CA-004-04.

## F4 — Más herramientas

- [ ] **F4.1** Dos filas nuevas en la tabla, solo con carpeta confirmada en S0.1. Cubre CA-001-07.
- [ ] **F4.2** Prueba manual por herramienta, registrada en `verificacion.md`: instalar, invocar una skill y anotar el resultado.

## F5 — Cierre

- [x] **F5.1** `forge doctor` informa de integración y perfil. Cubre RF-06.
- [x] **F5.2** Documentación: `docs/FORGE-5.0-GUIA.md`, `docs/getting-started.md`, `README.md`, `CHANGELOG.md`.
- [ ] **F5.3** Suite completa en Windows y en el contenedor Linux; tipos en 0.
- [ ] **F5.4** `verificacion.md` con cada criterio y su prueba.

> **2026-10-14:** S0, F1, F2 y F3 implementadas. El módulo de la tabla se llama `core/instalacion/herramientas-destino.js` (antes `integraciones.js`, que chocaba con las integraciones externas). Pendientes: F4 (pruebas manuales por herramienta), F5. La fila `claude` cita docs.claude.com sin confirmar en los spikes.

> **2026-10-14 (F5.1 y F5.2):** `forge doctor` informa de integración y perfil (`tests/doctor-instalacion.test.js`). Documentado en `docs/FORGE-5.0-GUIA.md`, `docs/getting-started.md`, `README.md`, `CHANGELOG.md` y el límite de los perfiles en `docs/PROBLEMAS-CONOCIDOS.md`. La fila `claude` de la tabla queda CONFIRMADA el 2026-10-14 en https://code.claude.com/docs/en/skills (`.claude/skills/<nombre>/SKILL.md`, personal `~/.claude/skills/`) y https://code.claude.com/docs/en/sub-agents (`.claude/agents/`, `~/.claude/agents/`); `docs.claude.com` redirige (301) a `code.claude.com`. Quedan F5.3 (suite completa) y F5.4 (`verificacion.md`).
