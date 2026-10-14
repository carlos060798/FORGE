# Tareas: Instalación agnóstica de herramienta

> Plan: `plan.md` · Cada tarea: test primero, después código. `[ ]` por hacer · `[x]` hecha.
> **Ninguna tarea empieza hasta que el dueño apruebe la spec.**

## S0 — Spikes

- [ ] **S0.1** Carpeta de skills y forma de invocación de cada herramienta candidata, desde su documentación oficial, con URL y fecha. Salida: `spikes/carpetas-de-skills.md`, con «sin confirmar» donde no se pudo. Cubre CA-001-01 y CA-001-07.
- [ ] **S0.2** Campos obligatorios y opcionales de la cabecera de `SKILL.md` según la especificación abierta. Salida: sección en el mismo informe. Cubre CA-003-01.

## F1 — Integración por clave

- [ ] **F1.1** `core/instalacion/herramientas-destino.js`: tabla con `claude` y `generica`. Tests: clave desconocida rechazada con la lista; carpeta genérica fuera del proyecto y de la carpeta personal rechazada. Cubre CA-001-02, CA-001-03.
- [ ] **F1.2** Prueba de equivalencia: foto del árbol de `forge init` y `forge update` sin opciones, antes del cambio. Cubre CA-002-01.
- [ ] **F1.3** `copiarNucleo` recibe la integración; `--integracion` en `init`. Tests: equivalencia en verde; con `generica`, solo skills y `AGENTS.md`. Cubre CA-001-01, CA-002-03, CA-001-06.
- [ ] **F1.4** Escritura segura en los destinos nuevos. Tests: unión hacia fuera, enlace duro, archivo ajeno existente. Cubre CA-001-04.
- [ ] **F1.5** Guardar integración en la configuración y respetarla en `forge update`. Cubre CA-002-02.
- [ ] **F1.6** Mensaje final con lo instalado, lo omitido y la forma de invocación. Cubre CA-001-05.

## F2 — Comandos como skills

- [ ] **F2.1** `core/instalacion/skills-de-comandos.js`. Tests: los 39 comandos producen `SKILL.md` con nombre y descripción; cabecera propia de Claude Code convertida o avisada. Cubre CA-003-01, CA-003-03.
- [ ] **F2.2** `scripts/generar-skills.mjs` y prueba de divergencia. Cubre CA-003-02.
- [ ] **F2.3** Skills generadas en el paquete; prueba con `npm pack --dry-run`. Cubre CA-003-04.

## F3 — Perfiles

- [ ] **F3.1** `core/instalacion/perfiles.js` con `esencial` y `completo`. Cubre CA-004-01.
- [ ] **F3.2** `--perfil` en `init`, clave en `forge config`, aplicación en `update`. Tests: una instalación existente no cambia de perfil al actualizar. Cubre CA-004-02, CA-004-03, CA-004-04.

## F4 — Más herramientas

- [ ] **F4.1** Dos filas nuevas en la tabla, solo con carpeta confirmada en S0.1. Cubre CA-001-07.
- [ ] **F4.2** Prueba manual por herramienta, registrada en `verificacion.md`: instalar, invocar una skill y anotar el resultado.

## F5 — Cierre

- [ ] **F5.1** `forge doctor` informa de integración y perfil. Cubre RF-06.
- [ ] **F5.2** Documentación: `docs/FORGE-5.0-GUIA.md`, `docs/getting-started.md`, `README.md`, `CHANGELOG.md`.
- [ ] **F5.3** Suite completa en Windows y en el contenedor Linux; tipos en 0.
- [ ] **F5.4** `verificacion.md` con cada criterio y su prueba.
