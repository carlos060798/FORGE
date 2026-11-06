# Política de seguridad

## Cómo reportar una vulnerabilidad

No abras una incidencia pública. Escribe al responsable del repositorio (https://github.com/carlos060798/FORGE) por un aviso privado de seguridad de GitHub («Security» → «Report a vulnerability»). Incluye la versión, los pasos para reproducirlo y el impacto. Responde en español o inglés.

Este proyecto está en **pre-beta** y lo mantiene una persona: no hay plazo garantizado de respuesta, pero los avisos de seguridad tienen prioridad sobre el resto.

## Qué es y qué no es una barrera

| Capa | Qué hace | Qué NO garantiza |
|---|---|---|
| **Guardián** (`claude-hooks/pre-tool-guard.js`) | Red de seguridad: bloquea comandos destructivos, escrituras sobre secretos, configuración protegida y su propio registro; falla cerrado | **No es un límite**. Analiza texto; alias, funciones de shell, `eval` o scripts ejecutados después no se resuelven |
| **Permisos de Claude Code** (`permissions.deny`, ajustes gestionados) | Defensa principal sobre qué herramientas puede usar el agente | Depende de que el dueño los configure |
| **Sandbox Docker** del ciclo verificado | Ejecuta el código generado sin red, de solo lectura, sin capacidades, con límites | No se ha validado con Docker real en Linux ni macOS (solo Windows) |
| **Cadena de evidencia y aprobaciones** | Detecta alteraciones de los registros firmados (HMAC) | La clave está en el estado de usuario, legible por el mismo usuario que ejecuta el agente: un agente comprometido con acceso al disco puede firmar. Ver «Límites conocidos» |

## Límites conocidos

- **Misma identidad de sistema operativo:** el agente y el humano comparten usuario. Sin llavero del sistema (DPAPI/Keychain) ni aprobación fuera de banda, la firma HMAC acredita integridad, no autoría humana. La aprobación humana exige terminal interactiva (`forge aprobar`).
- **`FORGE_EDITAR_GUARDIAN=1`** desactiva la protección del guardián sobre sus propios archivos; solo debe fijarla el dueño al lanzar Claude Code.
- **Identidad del agente:** viene de `CLAUDE_AGENT_NAME`; sin ella no actúan los guardias de agentes de solo lectura.
- **Inyección de prompt:** no se ha probado de extremo a extremo con un modelo real.
- **Cadena de suministro:** `npm audit` de dependencias transitivas no se ha ejecutado en CI; las acciones de GitHub se fijan por etiqueta, no por SHA.

Los hallazgos y su estado están en [docs/informes/SEGURIDAD-CIBER.md](docs/informes/SEGURIDAD-CIBER.md).

## Versiones soportadas

Solo la rama `main`. No hay versiones publicadas en npm todavía.
