# Tareas: Proveedores agnósticos

> Plan: `plan.md` · Cada tarea: test primero, después código. `[ ]` por hacer · `[x]` hecha.
> **Ninguna tarea empieza hasta que el dueño apruebe la spec.**

## S0 — Spikes

- [ ] **S0.1** Forma de las herramientas en la API de chat de OpenAI y en la de Ollama, desde la documentación oficial vigente, con URL y fecha. Salida: `spikes/herramientas-por-proveedor.md`.
- [ ] **S0.2** Tarifa oficial vigente de OpenAI. Salida: sección en el mismo informe y propuesta de tabla.
- [ ] **S0.3** Puntos del código donde se resuelven los niveles y de dónde sale `base_url` (¿puede fijarlo el proyecto?). Salida: `spikes/niveles-y-destinos.md`. Si el proyecto puede dirigir la clave a otro servidor, se abre una tarea F0 con prioridad.

## F1 — Conformidad

- [ ] **F1.1** Servidores falsos de OpenAI y de Ollama en `tests/fixtures/proveedores/`.
- [ ] **F1.2** Batería de `complete`. Cubre CA-001-01, CA-001-02.
- [ ] **F1.3** Batería de `conversar`, que se salta en quien no declara herramientas y falla en quien las declara y no cumple. Cubre CA-001-03, CA-001-04.
- [ ] **F1.4** Documento «cómo añadir un proveedor». Cubre CA-001-05.

## F2 — OpenAI con herramientas

- [ ] **F2.1** Traducción de herramientas, bloques y motivos de parada. Cubre CA-002-01.
- [ ] **F2.2** `admiteHerramientas` condicionado. Cubre CA-002-02.
- [ ] **F2.3** Punto compatible sin herramientas: error claro y modo de bloque. Cubre CA-002-03.
- [ ] **F2.4** Argumentos no válidos devueltos como error de herramienta. Cubre CA-002-04.
- [ ] **F2.5** Ciclo por turnos de punta a punta con servidor falso. Cubre CA-002-05.
- [ ] **F2.6** Centinela de la clave. Cubre CA-002-06.

## F3 — Ollama con herramientas

- [ ] **F3.1** `conversar` en Ollama. Cubre CA-003-01.
- [ ] **F3.2** Detección y recuerdo de modelo sin herramientas. Cubre CA-003-02.

## F4 — Gasto

- [ ] **F4.1** Coste cero explícito en `precios:`; prueba de que nunca es implícito. Cubre CA-004-01.
- [ ] **F4.2** Aviso de modelo sin precio, una vez por sesión, con la clave que falta. Cubre CA-004-02.
- [ ] **F4.3** `presupuesto.sin_precio`. Cubre CA-004-03.
- [ ] **F4.4** Tabla de OpenAI revisada y fecha actualizada. Cubre CA-004-04.
- [ ] **F4.5** Tokens de caché de otros proveedores. Cubre CA-004-05.

## F5 — Niveles neutrales

- [ ] **F5.1** `core/llm-providers/niveles.js` y uso en todos los puntos de S0.3. Cubre CA-005-01, CA-005-02.
- [ ] **F5.2** Prueba de equivalencia de degradación y nivel máximo. Cubre CA-005-03.
- [ ] **F5.3** `forge doctor` muestra el modelo de cada nivel; documentación. Cubre CA-005-04.
- [ ] **F5.4** Enmienda de ADR-19.

## F6 — Validación real

- [ ] **F6.1** `--proveedor` en `scripts/pruebas-independientes.mjs`. Cubre CA-006-01.
- [ ] **F6.2** **(Dueño)** Tres proyectos con un segundo proveedor real, con tope; evidencia en la carpeta. Cubre CA-006-02.
- [ ] **F6.3** Documentación coherente con lo que se haya probado. Cubre CA-006-03.

## F7 — Cierre

- [ ] **F7.1** Documentación: guía, `configuration.md`, `CHANGELOG.md`.
- [ ] **F7.2** Suite completa en Windows y en el contenedor Linux; tipos en 0.
- [ ] **F7.3** Revisión independiente de gasto y credenciales; hallazgos altos corregidos.
- [ ] **F7.4** `verificacion.md` con cada criterio y su prueba.
