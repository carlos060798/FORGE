# Política de seguridad

## Cómo reportar una vulnerabilidad

**No abras una incidencia pública** ni publiques el detalle en una PR, un foro o una red social.

Usa el aviso privado de seguridad de GitHub: en https://github.com/carlos060798/FORGE, pestaña «Security» → «Report a vulnerability». Es el único canal de seguridad verificado de este proyecto. Escribe en español o en inglés e incluye:

- La versión de Fragua (`fragua --version`), la de Node y el sistema operativo.
- Los pasos para reproducirlo, lo más pequeños posible.
- El impacto que crees que tiene y qué parte de la tabla de abajo se rompe.
- No incluyas secretos reales (claves, tokens) en el reporte.

> Decisión pendiente del dueño: no hay un correo de seguridad dedicado. Si se crea uno, se añade aquí. Mientras tanto, no se publica ninguno.

### Tiempos, sin promesas

El proyecto está en **pre-beta** y lo mantiene **una persona**. No hay plazo garantizado de respuesta, de corrección ni de publicación, y no hay acuerdo de nivel de servicio. Lo que se intenta: dar prioridad a los avisos de seguridad sobre el resto del trabajo y contestar en el propio aviso si se considera dentro del alcance y en qué estado queda. Si pasa un tiempo largo sin ninguna respuesta, puedes volver a escribir en el mismo aviso privado.

### Divulgación coordinada

- Mantén el reporte en privado hasta que haya una corrección publicada, o hasta que quien mantiene el proyecto y tú acordéis una fecha. No se fija un plazo automático porque no se puede cumplir con garantías; si prefieres uno (por ejemplo, 90 días), propónlo en el aviso y se discute.
- Cuando se corrija, la corrección se anota en [CHANGELOG.md](CHANGELOG.md) y en [docs/PROBLEMAS-CONOCIDOS.md](docs/PROBLEMAS-CONOCIDOS.md) si deja un límite. Se te atribuye la autoría del hallazgo si lo deseas; dilo en el aviso.
- Si un tercero afectado debe enterarse antes (por ejemplo, el proveedor de una dependencia), se coordina por el mismo aviso.
- No hay programa de recompensas.

## Alcance

**Dentro del alcance** (un fallo aquí es una vulnerabilidad):

- El guardián (`claude-hooks/pre-tool-guard.js`) y su registro propio, cuando un bypass permite algo que su documentación dice que bloquea. Incluye `fragua guardian evaluar` y la traducción de eventos de otras herramientas (`core/instalacion/hooks-anfitrion.js`): un evento que se evalúa como «permitir» siendo peligroso, o un caso de error que no falle cerrado, es una vulnerabilidad. Fuera de alcance: que Gemini CLI y Codex fallen abierto ante un error del hook, que es comportamiento de la herramienta y está declarado en `docs/ANFITRIONES.md`.
- El aislamiento del ciclo verificado (`core/sandbox/`): escape del contenedor, red, escalada de privilegios, escritura fuera de la carpeta permitida.
- Confinamiento de rutas: escrituras de una salida de modelo fuera del directorio del proyecto, o en `.git/`, `.sdd/` o `.env*`.
- Fuga de secretos hacia registros, estados guardados, copias de trabajo o destinos de red no autorizados (por ejemplo, que un repositorio ajeno reciba la clave del usuario).
- Un repositorio ajeno que pueda subir el tope de gasto, ampliar los recursos del contenedor o fabricar un estado o una aprobación aceptados.
- La cadena de evidencia y las aprobaciones firmadas, dentro de lo que dice «Qué es y qué no es una barrera».
- El servidor MCP y la API HTTP local (`fragua api`), en especial acceso desde fuera del equipo.
- Los scripts de instalación (`instalar.sh`, `instalar.ps1`) y el empaquetado: qué archivos viajan en el paquete de npm.

**Fuera del alcance** (se agradece como mejora, no como vulnerabilidad; se puede abrir como incidencia pública normal):

- Lo que el propio documento declara como límite conocido (ver abajo): por ejemplo, que el guardián no resuelva alias o `eval`, o que el agente comparta usuario del sistema operativo con la persona.
- Ataques que ya requieren control total del equipo del usuario o de su cuenta de sistema operativo.
- Vulnerabilidades de Claude Code, Docker, Node.js, npm o de un proveedor de modelos en sí mismos: repórtalas a sus responsables.
- Calidad o seguridad del código que un modelo genera para tu proyecto: lo revisa tu proceso, no es una vulnerabilidad de Fragua.
- Ataques que necesitan que el usuario desactive a propósito una protección (`FORGE_EDITAR_GUARDIAN=1`, permisos amplios).
- Denegación de servicio por consumir tu propia cuota de modelo.
- Ingeniería social o spam sobre mantenedores o contribuidores.
- Informes automáticos de un escáner sin un caso de explotación demostrable.

## Qué es y qué no es una barrera

| Capa | Qué hace | Qué NO garantiza |
|---|---|---|
| **Guardián** (`claude-hooks/pre-tool-guard.js`) | Red de seguridad: bloquea comandos destructivos, escrituras sobre secretos, configuración protegida y su propio registro; falla cerrado | **No es un límite**. Analiza texto; alias, funciones de shell, `eval` o scripts ejecutados después no se resuelven |
| **Permisos de Claude Code** (`permissions.deny`, ajustes gestionados) | Defensa principal sobre qué herramientas puede usar el agente | Depende de que el dueño los configure |
| **Sandbox Docker** del ciclo verificado | Ejecuta el código generado sin red, de solo lectura, sin capacidades, con límites | Se probó con Docker real en **Windows 11 con Docker Desktop** el 2026-11-10 (aislamiento: 11 de 11 pruebas de `tests/sandbox-real.test.js`, ver [docs/ESTADO-ACTUAL.md](docs/ESTADO-ACTUAL.md)). **No se ha validado en Linux ni en macOS**: los jobs `aislamiento` y `pruebas-docker` de la CI de GitHub existen, pero su último resultado conocido no era verde |
| **Cadena de evidencia y aprobaciones** | Detecta alteraciones de los registros firmados (HMAC) | La clave está en el estado de usuario, legible por el mismo usuario que ejecuta el agente: un agente comprometido con acceso al disco puede firmar. Ver «Límites conocidos» |

## Límites conocidos

- **Misma identidad de sistema operativo:** el agente y el humano comparten usuario. Sin llavero del sistema (DPAPI/Keychain) ni aprobación fuera de banda, la firma HMAC acredita integridad, no autoría humana. La aprobación humana exige terminal interactiva (`forge aprobar`).
- **`FORGE_EDITAR_GUARDIAN=1`** desactiva la protección del guardián sobre sus propios archivos; solo debe fijarla el dueño al lanzar Claude Code.
- **Identidad del agente:** viene de `CLAUDE_AGENT_NAME`; sin ella no actúan los guardias de agentes de solo lectura.
- **Inyección de prompt:** no se ha probado de extremo a extremo con un modelo real.
- **Aislamiento fuera de Windows:** sin validar con Docker real en Linux ni en macOS (ver tabla).

## Cadena de suministro

Comprobado el 2026-11-10:

- **Dependencias de ejecución:** `npm audit --omit=dev` el 2026-11-10 informó `found 0 vulnerabilities`. Es una foto de ese día contra la base de avisos de npm de ese momento: no se ejecuta en la CI y no garantiza nada hacia adelante. Vuelve a ejecutarlo antes de confiar en ella. Las dependencias de ejecución son `@anthropic-ai/sdk`, `@sqlite.org/sqlite-wasm` y `acorn`; añadir otra exige un ADR.
- **Dependabot** propone actualizaciones semanales de npm y de las acciones de GitHub (`.github/dependabot.yml`).
- **Acciones de GitHub:** las de `.github/workflows/*.yml` van fijadas por SHA de commit (con la etiqueta de versión como comentario), no por etiqueta móvil. `tests/endurecimiento-f3.test.js` falla si una acción queda fijada por etiqueta.
- **Imágenes del sandbox:** las bases van fijadas por digest (misma prueba).
- **Instalación en la CI:** `npm ci --ignore-scripts`.

Los hallazgos y su estado están en [docs/informes/SEGURIDAD-CIBER.md](docs/informes/SEGURIDAD-CIBER.md). Ese informe no viaja en el paquete de npm.

## Versiones soportadas

Solo la rama `main`. No hay versiones publicadas en npm todavía (la versión del árbol es `5.0.0-beta.1`, sin publicar). Cuando exista una beta publicada, solo se dará soporte de seguridad a la última versión publicada, y esta tabla se actualizará. No se hacen correcciones retroactivas a versiones anteriores, ni a `forja-mvp` (nombre antiguo del paquete, 4.x).
