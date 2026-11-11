# Tareas: Metodología agnóstica del anfitrión

> Plan: `plan.md` · Cada tarea: prueba primero, después código. `[ ]` por hacer · `[x]` hecha. Lo marcado `[x]` cita su evidencia; lo que otros agentes tienen en curso queda `[ ]` hasta que haya evidencia.

## F0 — Spikes

- [x] **S0.1 a S0.3** Agentes nativos, hooks y argumentos por herramienta, desde documentación oficial. Evidencia: `spikes/agentes-hooks-argumentos.md` (2026-11-10). Windsurf y partes de opencode y Kiro: «sin confirmar».

## F1 — Comandos y skills con la sintaxis de la herramienta (HU-001)

- [x] **F1.1** `core/instalacion/adaptar-anfitrion.js`: `adaptarCuerpo`, `adaptarSkill`, prefijo por integración. Prueba: `tests/instalacion-anfitrion.test.js` (`adaptarCuerpo`, `adaptarSkill`). Cubre CA-001-01 a CA-001-03.
- [x] **F1.2** Lint por integración: toda skill adaptada válida y sin sintaxis excluida. Prueba: `tests/instalacion-anfitrion.test.js`, un test por cada clave distinta de `claude`. Cubre CA-001-04.
- [x] **F1.3** `copiarSkillsDeIntegracion` aplica la adaptación a skills propias y generadas. Prueba: «init --integracion cursor instala 14 roles y los comandos con la sintaxis de Cursor». Cubre CA-001-01.
- [x] **F1.4** Lo que recibe `claude` no cambia. Prueba: `tests/instalacion-equivalencia.test.js`. Cubre CA-001-05.

## F2 — Agentes como roles (HU-002)

- [x] **F2.1** `agenteARol` y su instalación como `rol-<agente>`. Prueba: «cada agente da una skill rol-* válida con nivel y herramientas». Cubre CA-002-01 a CA-002-03.
- [x] **F2.2** Escritura segura de roles: un archivo ajeno distinto no se pisa. Código en `copiarSkillsDeIntegracion`; la prueba de archivo ajeno existente es de las skills (`tests/instalacion-integraciones.test.js`), **no hay prueba específica de roles**. Cubre CA-002-04 a medias.
- [x] **F2.3** Mensaje final con roles instalados y lo no recibido. Prueba: la instalación real comprueba «14 roles»; el texto de lo no recibido no tiene aserción propia. Cubre CA-002-05 a medias.

## F3 — Guardián y memoria fuera de Claude Code (fuera de las HU; spec propia pendiente)

- [x] **F3.1** `fragua guardian evaluar` y `fragua memoria registrar`, identidad `FRAGUA_AGENTE`. Prueba: `tests/guardian-cli.test.js`.
- [x] **F3.2** `--anfitrion` y plantillas de hook para Cursor, Copilot, Gemini y Codex; `forge init --con-hooks`. Prueba: `tests/hooks-anfitrion.test.js`. Sin probar en una instalación real.
- [ ] **F3.3** Adaptador de memoria por herramienta. **En curso (otro agente), sin evidencia todavía.**
- [ ] **F3.4** Agentes en formato nativo de cada herramienta. **En curso (otro agente), sin evidencia todavía.**
- [ ] **F3.5** Herramienta MCP consultiva `guardian_evaluar`. **En curso (otro agente), sin evidencia todavía.**

## F4 — Vocabulario, diagnóstico y metadatos

- [x] **F4.1** `doctor` por proveedor, metadatos neutrales, cabeceras de skills en `metadata`. Sin ítem propio en esta spec; ver `docs/PLAN-AGNOSTICO.md` sección 8.
- [x] **F4.2** `model:` de agentes y presets: no se cambia, decisión registrada en `docs/PLAN-AGNOSTICO.md`.

## F5 — Prueba manual (la hace el dueño)

- [ ] **F5.1** Instalar en Codex y registrar el resultado en `verificacion.md`.
- [ ] **F5.2** Instalar en Cursor y registrar el resultado en `verificacion.md`.
- [ ] **F5.3** Resto de herramientas de la tabla.

## F6 — Documentación (HU-003)

- [x] **F6.1** `docs/ANFITRIONES.md` con la matriz; README, `ESTADO-ACTUAL.md`, hoja de ruta y `CHANGELOG.md` al día. Cubre CA-003-01 y CA-003-02 (son documentos; ninguna prueba los comprueba).
- [ ] **F6.2** Cierre: `verificacion.md` actualizado tras F3.3 a F3.5 y F5.
