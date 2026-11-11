# Soporte

Fragua (FORGE) es un proyecto de código abierto en **pre-beta**, mantenido por **una sola persona** en su tiempo disponible. Esto es lo que puedes esperar y dónde acudir.

## Honestidad sobre el soporte

- No hay acuerdo de nivel de servicio, ni plazos de respuesta, ni soporte garantizado.
- Las preguntas y los bugs se atienden cuando se puede. Un reporte claro y reproducible se atiende antes que uno vago.
- No hay chat, Discord, foro ni correo de soporte. El único canal es el repositorio: https://github.com/carlos060798/FORGE
- Antes de preguntar, la respuesta probablemente está en la documentación.

## Primero, mira esto

| Si tu duda es... | Mira |
|---|---|
| Cómo empezar | [docs/PRIMEROS-15-MINUTOS.md](docs/PRIMEROS-15-MINUTOS.md), [QUICK-START.md](QUICK-START.md) |
| Qué funciona hoy y qué no | [docs/ESTADO-ACTUAL.md](docs/ESTADO-ACTUAL.md), [docs/limitations.md](docs/limitations.md) |
| Un error conocido | [docs/PROBLEMAS-CONOCIDOS.md](docs/PROBLEMAS-CONOCIDOS.md), [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) |
| Qué pasa si el ciclo falla | [docs/QUE-PASA-SI-FALLA.md](docs/QUE-PASA-SI-FALLA.md) |
| Un término | [docs/GLOSARIO.md](docs/GLOSARIO.md) |
| Todo lo demás | [docs/0-INDICE.md](docs/0-INDICE.md) |

Ejecuta también `node cli/index.js doctor` (o `fragua doctor` si ya lo tienes instalado): comprueba Node, Docker, la clave y la instalación, y termina con el siguiente paso.

## Dónde preguntar

- **Una pregunta de uso o una duda:** abre una incidencia en https://github.com/carlos060798/FORGE/issues. Si la respuesta debería estar en los documentos y no está, dilo: el documento debe mejorar.
- **Un bug:** incidencia con la plantilla «Reporte de bug», o «Reporte de fallo» si es del ciclo verificado, el CLI, el servidor MCP o la API.
- **Una propuesta de mejora:** incidencia describiendo el problema que resuelve; si se acepta, se escribe como spec (ver [CONTRIBUTING.md](CONTRIBUTING.md)).
- **Quieres contribuir:** [CONTRIBUTING.md](CONTRIBUTING.md).

## Dónde NO preguntar

- **Seguridad: nunca en una incidencia pública.** Una vulnerabilidad se reporta por el aviso privado de GitHub (pestaña «Security» → «Report a vulnerability»), como explica [SECURITY.md](SECURITY.md).
- **Conducta:** una denuncia va por el canal privado descrito en [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), no en público.
- **Secretos:** no pegues claves, tokens ni contenido de `.env` en ninguna incidencia. Revisa los registros antes de adjuntarlos (`.sdd/events.jsonl` puede contener rutas y texto de tu proyecto).
- **Soporte de terceros:** los problemas propios de Claude Code, Docker, Node.js o de un proveedor de modelos van a sus responsables.

## Qué incluir en un reporte

1. Versión de Fragua: `node cli/index.js --version`.
2. Versión de Node (`node --version`) y sistema operativo (Windows, Linux o macOS, y versión).
3. Si usas el ciclo verificado: versión de Docker (`docker version`) y si Docker estaba en marcha.
4. El proveedor de modelos y el modelo, si importan.
5. El comando exacto o el flujo que falló.
6. Lo que esperabas y lo que pasó, con el mensaje de error completo.
7. La salida de `doctor`.
8. Los pasos mínimos para reproducirlo.
9. Lo que ya probaste (reinstalar, otra versión de Node).

Los reportes sin esta información suelen quedar a la espera de que la completes.

## Estado del proyecto que conviene recordar

Está sin publicar en npm; se instala desde el repositorio. La integración continua de GitHub no estaba verde en Linux en la última comprobación documentada. La validación con Docker real se hizo en Windows. Detalles en [docs/ESTADO-ACTUAL.md](docs/ESTADO-ACTUAL.md).
