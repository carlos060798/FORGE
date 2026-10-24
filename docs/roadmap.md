# Hoja de ruta

Estado a 2026-10-24. Versión 5.0.0, sin publicar (la 4.3.0 nunca se publicó). Las cifras y los límites detallados están en [ESTADO-ACTUAL.md](ESTADO-ACTUAL.md); este documento solo dice qué falta y en qué orden.

---

## Hecho en 5.0.0 (en la rama `feature/motor-agentico`)

- **Ciclo verificado** por defecto: planificación, pruebas, implementación y mutación, dentro de un contenedor sin red. Ver [ciclo-verificado.md](ciclo-verificado.md).
- **`fragua verificar`**: veredicto aislado sobre un proyecto, con mutación, `--registrar` y `--comprobar-evidencia`.
- **Puertas de calidad** declaradas en `sdd.config.yaml`, aplicadas también dentro del ciclo.
- **Perfiles de agente por rol**: el proyecto solo puede apretar, nunca ampliar.
- **Estado del ciclo sellado** con una clave del usuario, fuera del proyecto.
- **Proveedores** Anthropic, OpenAI y Ollama, con niveles neutrales.
- **Instalación agnóstica** para 9 herramientas con carpeta confirmada.
- **Servidor MCP** con perfil `verificacion`, y API HTTP local.
- **Contrato público** versionado en `docs/contrato/`.
- **Cierre de hallazgos de seguridad** de la revisión independiente: un repositorio ajeno ya no puede subir el tope de gasto, ampliar los recursos del contenedor ni fabricar un estado aceptado. Lista completa en ESTADO-ACTUAL.md.

## Pendiente en el código

Trabajo ya empezado, en las especificaciones de `.sdd/especificaciones/`:

- **Perfiles de agente, tareas F6 y F7.**
- **Puertas de calidad, tareas F4 y F7**, y el evento `ciclo:llamada` con `modeloServido`.
- **Ciclo por MCP, tareas F4 y F5.**
- **Servidor MCP de edición**: decidir si pasa también por el perfil de agente.
- **Puertas ligadas a los `tsconfig` referenciados** (`extends`).

## Pendiente para publicar (responsabilidad de la persona)

No los puede hacer el código solo:

1. Abrir la PR a `main`, para que corra la integración continua en Linux (los jobs `aislamiento`, `pruebas-docker` y `tipos` nunca han corrido).
2. Rotar la clave de Anthropic que apareció en la conversación.
3. Medir contenedores reales con Docker en un equipo que lo tenga.
4. Aprobar formalmente las especificaciones.
5. Comprobar la marca y el dominio de «Fragua», y el nombre exacto del paquete.
6. Probar las integraciones con cuentas reales de GitHub, GitLab y Jira.
7. Decidir la publicación: `5.0.0-beta.1` con la etiqueta `next`.

Las condiciones de la beta están en [RELEASE-CHECKLIST.md](../RELEASE-CHECKLIST.md).

---

## Ideas sin fecha

Venían del roadmap anterior. No se han vuelto a verificar contra el código actual, así que son intenciones, no compromisos:

- **Routing por complejidad**: elegir el modelo por tarea y no fijo por agente.
- **Análisis incremental del AST**: reindexar solo los símbolos afectados por un cambio, en proyectos grandes.
- **Índice TF-IDF persistente** para las decisiones: hoy se recalcula al arrancar.
- **Marketplace de plantillas** de proyecto instalables.
- **Embeddings locales** (vía Ollama) para la memoria, en lugar de TF-IDF.
- **Modo headless completo** con repetición de sesiones, para CI.
- **Carga en caliente de plugins**, sin reiniciar Claude Code.
- **Coordinación entre repositorios** en un monorepo o en un proyecto distribuido.

---

## Lo que FORGE no hará

- **Un proveedor de Google/Gemini**: los cuatro existentes cubren los casos previstos.
- **Una interfaz de terminal propia**: Claude Code es la interfaz.
- **Un ORM o un cliente de base de datos propios**: FORGE genera código que usa las herramientas del proyecto.
- **WebSockets en el panel**: el flujo es unidireccional, y SSE basta.
