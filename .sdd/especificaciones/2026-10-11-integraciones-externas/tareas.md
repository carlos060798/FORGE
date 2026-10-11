# Tareas: Integraciones con GitHub, GitLab y Jira

> Plan: `plan.md` · Cada tarea: test primero, después código. `[ ]` por hacer · `[x]` hecha.

## S0 — Spikes (antes de escribir adaptadores)

- [x] **S0.1** Permisos mínimos por proveedor, desde la documentación oficial vigente: GitHub (permisos de grano fino de un token: leer incidencias, comentar, crear rama, abrir solicitud en borrador), GitLab (ámbitos de un token de proyecto y rol mínimo), Jira Cloud (permisos de un usuario de servicio y esquema de autenticación con token de API). Rutas REST exactas de las tres operaciones. Salida: `spikes/permisos-minimos.md` con URL de cada dato y «sin confirmar» donde no se pudo.
- [x] **S0.2** Cómo comprobar el alcance de un token sin escribir, por proveedor, o que no se puede. Salida: sección en el mismo informe.
- [x] **S0.3** Batería de al menos 30 textos hostiles como datos de prueba (`tests/fixtures/integraciones/hostiles.json`): órdenes directas, falsas cabeceras del sistema, enlaces e imágenes, bloques de código con órdenes, caracteres invisibles y de control, volumen extremo, marcadores propios de FORGE (`[REDACTADO]`, `## Contexto`), formatos de secretos, y texto en varios alfabetos.
- [x] **S0.4** Contratos de respuesta (forma de la incidencia, del comentario creado, de la rama y de la solicitud) de las tres plataformas, para los servidores falsos.

## F1 — Núcleo

- [x] **F1.1** `puerto.js`: tipos y contrato. Test: un proveedor falso cumple el contrato; uno incompleto se rechaza.
- [x] **F1.2** `config.js`: leer y validar `integraciones_*` (claves planas). Tests: sección ausente → todo apagado y cero lecturas de entorno; modo desconocido; destino con comodín rechazado; valor que parece un token literal rechazado; host con esquema distinto de HTTPS rechazado.
- [x] **F1.3** `confianza.js`: texto de plataforma → dato. Tests con la batería S0.3: delimitado, acotado, sin caracteres de control ni invisibles, redactado, sin los marcadores propios, y sin forma de cerrar el delimitador desde dentro.
- [x] **F1.4** `http.js`: cliente mínimo. Tests contra servidor local: HTTPS obligatorio (salvo `127.0.0.1` en pruebas con interruptor interno), host fuera de la lista, redirección a otro host, respuesta enorme, tiempo agotado, reintento acotado con espera, límite de ritmo.
- [x] **F1.5** `auditoria.js`: eventos sin contenido, topes por sesión y proveedor, interruptor `FORGE_INTEGRACIONES=apagado`. Test: ninguna operación tras apagar, ni aprobadas.
- [x] **F1.6** Carga perezosa. Test: importar `cli/index.js` y ejecutar `forge run` no importa ningún módulo de `core/integraciones/`.
- [x] **F1.7** Prueba de aislamiento HU-005: `fetch` interceptado y suite del ciclo en verde con la integración ausente y apagada.

> F1 hecha (2026-10-11). Matices, con detalle en `verificacion.md`: F1.3 se probó con una batería mínima propia de 16 casos (la de S0.3 se suma sola cuando exista `tests/fixtures/integraciones/hostiles.json`); F1.4 no tiene limitador de ritmo propio, solo el reintento con `Retry-After`; F1.6 se verifica con una prueba estática y con un gancho de resolución de módulos en procesos hijos; F1.7 corre 5 archivos del ciclo, no toda la suite.

## F2 — Adaptadores

- [ ] **F2.1** GitHub: `leerElemento`, `comentar`, `proponerCambio`, `comprobarAlcance`, con servidor falso. Rama con prefijo `forge/`; solicitud en borrador; nunca una rama existente.
- [ ] **F2.2** GitLab (host configurable): igual.
- [x] **F2.3** Jira Cloud: lectura de ticket y comentario. `proponerCambio` no existe en Jira: la operación se rechaza con un mensaje claro y el modo `proponer` en Jira se trata como `comentar`.
- [x] **F2.3a** Jira: conversor mínimo ADF→texto y texto→ADF, sin dependencias. Tests: documento con nodos desconocidos, anidamiento profundo, enlaces y menciones, texto hostil dentro del documento, y tamaño extremo.
- [x] **F2.3b** Jira: solo token sin ámbitos contra `<sitio>.atlassian.net`; con ámbitos, `doctor` avisa del límite. *(El adaptador devuelve `no_soportado` y no intenta nada; el aviso de `doctor` es F4.2.)*
- [ ] **F2.5** GitLab: filtrar notas de sistema (`system: true`); solicitud con prefijo `Draft:`; ámbitos comprobables con token personal.
- [ ] **F2.6** Idempotencia local: marcador oculto y búsqueda previa, en los tres.
- [ ] **F2.4** Prueba de contrato común: las tres respuestas normalizadas al mismo tipo de elemento, sin campos de más.

> Jira hecho (2026-10-11): F2.3, F2.3a y F2.3b. Quedan abiertas **F2.6** (idempotencia: solo está la de Jira, con marcador `FORGE-ID:` en la línea final; faltan GitHub y GitLab) y **F2.4** (la prueba común entre las tres: Jira ya devuelve el tipo `ElementoDeTrabajo` con exactamente sus 8 campos).

## F3 — Publicación

- [ ] **F3.1** `aprobacion.js`: cola de pendientes, huella del contenido, estados.
- [ ] **F3.2** `publicar`: arma la publicación desde el estado del ciclo (huellas, resultado, evidencia), nunca desde archivos releídos; excluye los archivos de dependencias y configuración pausados.
- [ ] **F3.3** `aprobar`: comprueba modo, destino, tope, huella sin cambios y que no esté ya publicada; idempotente.
- [ ] **F3.4** Fallo de la plataforma: la publicación queda pendiente y reintentable; ninguna tarea se pierde (CA-005-04).

## F4 — CLI y diagnóstico

- [ ] **F4.1** `cli/integraciones.js` con `leer`, `publicar`, `aprobar`, `estado`, `apagar`.
- [ ] **F4.2** `doctor`: variable definida, host permitido y HTTPS; alcance solo donde se puede (GitLab con token personal) y «no comprobable» en GitHub y Jira con el alcance declarado a la vista; escritura bloqueada si el alcance excede; sin imprimir tokens.
- [ ] **F4.3** `forge status` muestra pendientes y operaciones por proveedor.

## F5 — Seguridad y cierre

- [ ] **F5.1** Prueba de no filtración con token centinela en todo el recorrido (CA-004-05).
- [ ] **F5.2** Prueba de que ningún camino lleva del modelo a una operación de red (RF-001, RF-002): ningún agente, herramienta, contrato ni prompt referencia el módulo.
- [ ] **F5.3** Batería hostil de extremo a extremo con el ciclo guionizado: el resultado del ciclo con texto hostil es el mismo que con texto limpio (CA-001-04).
- [ ] **F5.4** Revisión independiente (`revisor` y `seguridad`) con la lista de riesgos agénticos como guion; corregir hallazgos altos.
- [ ] **F5.5** `verificacion.md` honesto: cada criterio con su test y su estado.
- [ ] **F5.6** Documentación: `docs/integraciones.md`, `docs/ciclo-verificado.md` (enlace), `CHANGELOG.md`, `configuracion-ejemplo/sdd.config.yaml`.

## F6 — Opcional, solo con decisión del dueño

- [ ] **F6.1** Transporte MCP de solo lectura detrás del mismo puerto, con lista de herramientas permitidas una a una.
