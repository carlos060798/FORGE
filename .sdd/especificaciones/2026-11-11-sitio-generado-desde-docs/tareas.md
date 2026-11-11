# Tareas: sitio generado desde `docs/`

> `[x]` hecha · `[ ]` por hacer. Estado de la spec: borrador. **Nada se implementa hasta que el dueño apruebe la spec y el ADR-25.**

- [x] **T0** Prueba de viabilidad fuera del repositorio: `docs/informes/SPIKE-SITIO-STARLIGHT.md` (50 documentos, 52 páginas, 0 enlaces rotos de 395 con conversor, `npm audit` en cero con Mermaid 12.3.0).
- [ ] **T1** El dueño aprueba la spec y el ADR-25 y responde las cuatro decisiones de la sección 6.
- [ ] **T2** Pruebas primero: conversor (enlaces entre documentos, hacia GitHub, anclas, nombres con puntos), y comprobación del sitio construido (enlaces internos, versión, términos). Cubre CA-002-01 a CA-003-03.
- [ ] **T3** Conversor y directorio del sitio con su `package.json` y versiones exactas. Cubre CA-001-01, CA-001-02, CA-004-01.
- [ ] **T4** `docs.yml`: construir, comprobar y publicar; disparar por cambios en `docs/`. Cubre CA-005-01.
- [ ] **T5** Eliminar `docs-site/assets/data.js` y adaptar `tests/sitio-docs.test.js` a la nueva fuente.
- [ ] **T6** Medir lo que el spike no midió: aspecto en un navegador, accesibilidad, despliegue real con la ruta base.
