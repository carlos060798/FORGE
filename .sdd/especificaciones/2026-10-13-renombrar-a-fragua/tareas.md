# Tareas: Renombrar el proyecto a Fragua

> Plan: `plan.md` · Cada tarea: test primero, después código. `[ ]` por hacer · `[x]` hecha.

## F1 — La orden nueva

- [x] **F1.1** `fragua` en `bin` de `package.json`, apuntando al mismo programa que `forge`. Prueba en `tests/integration.test.js`. Cubre CA-001-01, CA-001-02.
- [x] **F1.2** Línea en la ayuda que anuncia el nombre nuevo.

> F1 hecha (2026-10-13). `forge` y `sdd-es` no cambian. Pruebas de manifiesto, empaquetado y consistencia: 70 de 70.

## S0 — Inventarios (solo lectura)

- [x] **S0.1** Todas las lecturas de variables `FORGE_*`, con archivo y línea, clasificadas en política, configuración y pruebas. Salida: `spikes/variables.md`.
- [x] **S0.2** Todos los sitios donde la carpeta de estado, la etiqueta de contenedor y el nombre del paquete se usan como dato. Salida: `spikes/nombres-como-dato.md`.
- [ ] **S0.3** Comprobación del nombre en npm el día de publicar.

## F2 — Nombre en un solo sitio

- [x] **F2.1** `core/nombres.js` con las formas nueva y antigua.
- [x] **F2.2** Ayuda y mensajes con la orden con la que se invocó el programa; ejemplos con `fragua`. Cubre CA-001-03.
- [x] **F2.3** Aviso al usar `forge`: una línea, nunca con `--json` ni en salida no interactiva. Cubre CA-001-04.

## F3 — Variables de entorno (seguridad)

- [x] **F3.1** `core/entorno.js`: `leerVariable`. Tests: solo antigua, solo nueva, iguales, distintas (error que nombra las dos). Cubre CA-003-01, CA-003-02.
- [x] **F3.2** Sustituir todas las lecturas del inventario S0.1. Prueba estática: no queda ninguna lectura directa fuera de `core/entorno.js`.
- [ ] **F3.3** Una prueba por variable de política: ninguna combinación de los dos nombres amplía permisos. Cubre CA-003-03.
- [x] **F3.4** Prefijos admitidos en `*_token_env`. Cubre CA-003-04.
- [ ] **F3.5** Proyecto hostil: el repositorio no puede fijar ninguna de las dos formas. Cubre CA-003-05.

## F4 — Estado del usuario y contenedores (seguridad)

- [x] **F4.1** Carpeta de estado con la regla nueva/antigua, sin migración. Tests de las cuatro combinaciones. Cubre CA-004-01 a CA-004-04.
- [x] **F4.2** `doctor` avisa de estado antiguo sin usar. Cubre CA-004-03.
- [x] **F4.3** Etiqueta nueva de contenedor y barrido de las dos. Cubre CA-005-01.
- [x] **F4.4** Prueba de que el prefijo de rama y los marcadores de lo publicado no cambian. Cubre CA-005-02.

## F5 — Paquete y documentación

- [x] **F5.1** Nombre del paquete; pruebas que lo fijan; `scripts/pruebas-independientes.mjs`. Cubre CA-002-01, CA-002-03.
- [x] **F5.2** README, guía, primeros pasos y `QUICK-START.md` con Fragua y una sección de equivalencia. Cubre CA-006-01.
- [x] **F5.3** Nota del cambio en `.sdd/INDICE.md` y `docs/0-INDICE.md`; los documentos históricos no se tocan. Cubre CA-006-02.
- [ ] **F5.4** Texto del producto en comandos y skills, sin cambiar sus nombres. Cubre CA-006-03.
- [ ] **F5.5** Empaquetar e instalar en carpeta limpia con el nombre nuevo; `fragua doctor` arranca.

## F6 — Dueño

- [ ] **F6.1** Decidir el nombre exacto del paquete y comprobar marca y dominio.
- [ ] **F6.2** Publicar la beta con el nombre nuevo y avisar en `forja-mvp`. Cubre CA-002-02.
- [ ] **F6.3** Renombrar el repositorio de GitHub y actualizar los enlaces. Cubre CA-006-04.

## F7 — Cierre

- [ ] **F7.1** Revisión independiente de F3 y F4; hallazgos altos corregidos.
- [ ] **F7.2** Suite completa en Windows y en el contenedor Linux; tipos en 0.
- [ ] **F7.3** `verificacion.md` con cada criterio y su prueba.

> **2026-10-14:** S0, F2 y F3 implementadas en la rama de integración (`core/nombres.js`, `core/entorno.js`, `claude-hooks/shared/entorno.js`, `tests/entorno-fragua.test.js`). Pendientes: F3.3 y F3.5 (una prueba por variable de política y proyecto hostil, a verificar en la revisión independiente), F4, F5, F6 y F7. El inventario encontró 23 lecturas de 17 variables (la spec decía 28).
> **2026-10-14 (F4 y F5):** F4.1 a F4.4 y F5.1 a F5.3 hechas; `fragua` libre en npm (404). Pendiente F5.4 y F5.5.
