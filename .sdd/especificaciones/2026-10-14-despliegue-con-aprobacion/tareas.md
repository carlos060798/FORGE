# Tareas: `despliegue-con-aprobacion`

> Plan: `plan.md` · Cada tarea: test primero, después código. `[ ]` por hacer · `[x]` hecha.
> **Ninguna tarea empieza hasta que el dueño apruebe la spec Y se cumpla la condición de arranque:** terminadas y revisadas las especificaciones `defensa-inyeccion-y-fuga`, `perfiles-de-agente` y `puertas-de-calidad-y-evidencia`.
> Frente de máximo riesgo: ninguna llamada a una cuenta real antes de F6, y F6 exige informe favorable de F5.

## Puerta

- [ ] **P0** Confirmar por escrito del dueño que C y D están terminadas y revisadas, y aprobar la spec. Sin esto, nada de lo que sigue.

## S0 — Spikes (todos obligatorios, de solo lectura y documentación)

- [ ] **S0.1** Permisos mínimos: política literal de los roles de planificar y aplicar, política de sesión, límite de permisos y lista de acciones de escalada excluidas. Salida: `spikes/permisos-minimos.md`.
- [ ] **S0.2** Estimación de coste: tabla propia frente a API de precios; cobertura, margen de error, qué es «sin estimar». Salida: `spikes/estimacion-coste.md`.
- [ ] **S0.3** Forma del plan: formato de IaC y conjunto de cambios; formato `plan.v1`. Salida: `spikes/forma-del-plan.md`.
- [ ] **S0.4** Transporte: firma propia con `node:crypto` frente a CLI del proveedor. Salida: `spikes/transporte-aws.md`.
- [ ] **S0.5** Deriva y atomicidad entre planificar y aplicar. Salida: `spikes/deriva.md`.
- [ ] **S0.6** Cuenta de pruebas con presupuesto de 1 USD: qué se prueba allí y qué no. Salida: `spikes/cuenta-de-pruebas.md`. Requiere al dueño.
- [ ] **S0.7** Inventario de lo común entre `core/integraciones/{estado-usuario,aprobacion,auditoria}.js` que se extrae en F0. Salida: `spikes/comun-con-integraciones.md`.

## F0 — Extraer lo común

- [ ] **F0.1** Mover lo reutilizable (estado del usuario, firma, cola, interruptor, contadores) a un módulo compartido sin cambiar comportamiento. Test: la suite de integraciones, sin tocarla, en verde.

## F1 — Puerto, política, cola (adaptador falso)

- [ ] **F1.1** `puerto.js`: cuatro operaciones; un adaptador con operación genérica se rechaza. Cubre CA-001-01.
- [ ] **F1.2** Prueba estática: ni agentes, ni MCP, ni nodos del ciclo importan el puerto ni el adaptador. Cubre CA-001-02, CA-003-05.
- [ ] **F1.3** `politica.js`: listas del usuario ∩ proyecto; vacío significa ninguno. Cubre CA-005-01, CA-005-02.
- [ ] **F1.4** `plantilla.js`: inline, sin URL, sin anidadas, tipos permitidos y vetos fijos. Tests con la batería hostil. Cubre CA-005-03 a CA-005-05.
- [ ] **F1.5** `plan.js`: `plan.v1`, vista previa determinista, huella con un test por campo. Cubre CA-002-01, CA-002-02, CA-002-04, CA-002-05, CA-003-02.
- [ ] **F1.6** `cola.js`: firma, caducidad, uso único, solicitud del árbol rechazada. Cubre CA-003-01, CA-003-03, CA-003-04.
- [ ] **F1.7** Adaptador falso con orden de llamadas verificable: ninguna llamada antes de validar. Cubre RF-09.

## F2 — Coste y topes

- [ ] **F2.1** `coste.js` según S0.2; «sin estimar» cuenta como incumplimiento. Cubre CA-002-03, CA-007-05.
- [ ] **F2.2** `gasto.js`: tope por aplicación y mensual; sin tope no se aplica; acumulado corrupto falla cerrado. Cubre CA-007-01 a CA-007-03.
- [ ] **F2.3** Aviso del límite (estimación, no factura) en cada vista. Cubre CA-007-04.

## F3 — Destructivo

- [ ] **F3.1** Borrado y reemplazo no se aplican aunque haya huella. Cubre CA-006-01.
- [ ] **F3.2** Variable por operación y segunda aprobación que muestra solo lo destructivo. Cubre CA-006-02.
- [ ] **F3.3** Recursos con estado inalterables; sin operación de destrucción. Cubre CA-006-03, CA-006-04.

## F4 — Auditoría, interruptor, deriva

- [ ] **F4.1** Eventos de cada operación, sin credenciales. Cubre CA-008-01.
- [ ] **F4.2** Interruptor en cada operación, también aprobadas; valor desconocido apaga. Cubre CA-008-02.
- [ ] **F4.3** Tope diario de operaciones. Cubre CA-008-03.
- [ ] **F4.4** Etiquetas obligatorias. Cubre CA-008-04.
- [ ] **F4.5** Deriva: se rechaza y obliga a planificar de nuevo. Cubre CA-003-04.
- [ ] **F4.6** Rastreo de credencial sintética por todos los caminos. Cubre CA-004-01.

## F5 — Revisión independiente 1 (sin nube)

- [ ] **F5.1** Suite completa y tipos en 0.
- [ ] **F5.2** Revisión con la guía OWASP de agentes sobre diseño, política, plantilla, huella y adaptador falso.
- [ ] **F5.3** Correcciones de todo hallazgo alto; informe archivado. **Puerta para F6.**

## F6 — Adaptador de AWS: solo planificar

- [ ] **F6.1** Firma/transporte según S0.4, con vectores de prueba publicados por el proveedor.
- [ ] **F6.2** `comprobarAlcance`: identidad, límite de permisos, sin administración de identidad. Cubre CA-004-03.
- [ ] **F6.3** Planificar con rol de solo lectura/plan en la cuenta de pruebas. Cubre HU-002 con datos reales.
- [ ] **F6.4** Credenciales solo del entorno del usuario; nombres reservados; `doctor` las muestra. Cubre CA-004-04, CA-004-05.

## F7 — Aplicar en la cuenta de pruebas

- [ ] **F7.1** Aplicar el conjunto calculado, no uno nuevo. Cubre CA-009-01.
- [ ] **F7.2** Observación hasta estado terminal con tiempo máximo; salidas redactadas. Cubre CA-009-02, CA-009-04.
- [ ] **F7.3** Comportamiento ante fallo: el del proveedor; informe del estado real. Cubre CA-009-03.
- [ ] **F7.4** Comprobar coste real frente al estimado en la cuenta de pruebas y documentar la diferencia.

## F8 — Revisión independiente 2 y cierre

- [ ] **F8.1** Revisión del adaptador real; hallazgos altos corregidos.
- [ ] **F8.2** `agents/operaciones.md`: propone IaC y plan, no aplica ni llama a plataformas. Cubre CA-001-04.
- [ ] **F8.3** Documentación, `CHANGELOG.md`, `doctor`.
- [ ] **F8.4** `verificacion.md` con cada criterio y su prueba.
