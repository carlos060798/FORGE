# ADR-22: Integraciones externas ejecutadas por el anfitrión, sin dar al modelo herramientas de red

> Estado: propuesta (en implementación por instrucción del dueño, 2026-10-11; pendiente de aceptación formal)  # propuesta | aceptada | obsoleta | reemplazada-por-ADR-XX
> Fecha: 2026-10-11
> Spec relacionada: 2026-10-11-integraciones-externas
> Autor: Claude (pendiente de aceptación por el dueño)
> Matiza: ADR-15 (sin cliente MCP en los nodos del ciclo). No cambia ADR-12, ADR-02 ni ADR-07.

## Contexto

El dueño quiere que FORGE se conecte con GitHub, GitLab y Jira, para que una tarea nazca de una incidencia o ticket y su resultado vuelva a la plataforma. Las tres ofrecen servidores MCP oficiales (consultados el 2026-10-11): GitHub remoto con token personal y conjuntos de herramientas seleccionables, GitLab en `/api/v4/mcp` solo con OAuth y con un administrador que debe habilitarlo, y Atlassian en `mcp.atlassian.com/v2/mcp` con OAuth 2.1 o token de API. Atlassian recomienda explícitamente mínimo privilegio y revisar los cambios de alto impacto.

El riesgo no es la conexión: es qué ocurre con el texto. Una incidencia la escribe cualquiera con acceso de escritura, y ese texto acabaría en un prompt de un agente que escribe código. Cualquier diseño que dé al modelo una herramienta de red o una credencial convierte una incidencia en un vector (ASI01, ASI02, ASI03 del Top 10 agéntico de OWASP 2026).

ADR-15 decidió que los nodos del ciclo no consumen herramientas por MCP: las herramientas del implementador por turnos son funciones en proceso, con las reglas de ruta de ADR-07. Esa frontera es la que hay que conservar.

## Decisión

1. **Las operaciones de plataforma las ejecuta FORGE, en el proceso del anfitrión, en puntos definidos del flujo** (traer un elemento antes de empezar; publicar después de terminar). Ningún agente las pide, ninguna herramienta las expone y ningún modelo recibe credenciales ni URL que pueda seguir.
2. **Un puerto con tres operaciones fijas por proveedor:** leer un elemento, comentar y proponer un cambio (rama nueva con prefijo fijo y solicitud en borrador). No hay una operación genérica «llamar a la API».
3. **Primera entrega con adaptadores REST estrechos**, uno por plataforma, sin dependencias nuevas (`fetch` de Node). Un cliente MCP queda como transporte alternativo posible del mismo puerto, de solo lectura, tras su propio spike.
4. **Mínimo privilegio y modo apagado por defecto.** Cada proveedor tiene un modo (`apagado`, `solo_lectura`, `comentar`, `proponer`); lista cerrada de destinos permitidos; tokens solo en variables de entorno.
5. **Escritura con aprobación humana registrada** por defecto, con vista previa exacta, idempotente, y nunca sobre ramas existentes ni protegidas, ni fusionando, ni cerrando, ni transicionando estados.
6. **El texto de la plataforma es dato no confiable** en todo punto de entrada: delimitado, acotado, redactado, sin autoridad sobre reglas, topes ni herramientas. La defensa es estructural y no depende de detectar la inyección.
7. **Sin cambios para quien no lo configure:** sin sección `integraciones:`, ninguna conexión, ninguna lectura de variables de tokens y ningún cambio de comportamiento.

## Alternativas consideradas

- **A. Cliente MCP completo con los servidores oficiales, expuesto a los agentes:** rechazada. Da a un modelo toda la superficie de herramientas de la plataforma (decenas de operaciones de escritura y administración), incluye los esquemas remotos como entrada (ASI04), exige flujos OAuth interactivos y revierte ADR-15 sin necesidad.
- **B. Cliente MCP usado solo por FORGE, no por los agentes:** aplazada, no rechazada. Evita exponer herramientas al modelo, pero obliga a escribir un cliente de transporte HTTP con negociación de versiones sin dependencias (Principio IV) para usar tres operaciones que una llamada REST resuelve. Se reconsidera para solo lectura si las plataformas retiran o cambian sus API REST.
- **C. Adaptadores REST estrechos ejecutados por FORGE:** aceptada como propuesta. Superficie mínima y auditable, determinista (Principio VI), sin dependencias; coste: tres adaptadores que mantener.
- **D. Delegar todo en el cliente de la persona (Claude Code con los servidores MCP de `.mcp.json`):** ya posible hoy y no cambia nada de FORGE. Útil, pero sin las garantías de esta decisión: ahí el modelo sí tiene las herramientas.

## Consecuencias

### Positivas
- Un modelo comprometido por una incidencia hostil no tiene ruta a la red ni a las credenciales.
- Los permisos efectivos son los del token: se pueden auditar en la plataforma, no solo en FORGE.
- La integración se puede apagar con una variable y no afecta a quien no la usa.

### Negativas
- Tres adaptadores a mantener, y cualquier cambio de API de una plataforma nos afecta directamente.
- Menos capacidades que un cliente MCP completo: no hay transiciones de Jira, ni revisión de solicitudes, ni búsqueda general.
- El flujo de aprobación por línea de comandos es más lento que uno automático.

### Neutrales
- El servidor MCP propio de FORGE (ADR-12) no cambia.
- Las bases de datos quedan para otra especificación.

## Riesgos que esta decisión no elimina

- **Un token con más alcance del documentado.** Se mitiga con `doctor`, pero FORGE no puede inspeccionar el alcance real en todas las plataformas.
- **Una aprobación humana mecánica.** ASI09: la vista previa ayuda, pero una persona puede aprobar sin leer.
- **Texto hostil en el resultado, no en la entrada.** Lo que el ciclo escribe en un comentario sale redactado, pero no es un filtro de contenido.
- **Contenido ya sensible en la incidencia.** Lo que contiene una incidencia viaja al proveedor de modelos; si el proyecto no debe enviar ese texto fuera, no debe activar la lectura.

## Cuándo revisitar

Si las plataformas dejan de ofrecer una API estable para estas tres operaciones, o si el cliente MCP de solo lectura resulta mejor que mantener tres adaptadores, o si la aprobación por línea de comandos se muestra inviable para los equipos.

## Referencias

- `.sdd/especificaciones/2026-10-11-integraciones-externas/spec.md`
- `.sdd/arquitectura/ADR-12-servidor-mcp-sin-dependencias.md`, `ADR-15-sin-cliente-mcp-en-los-nodos.md`
- OWASP GenAI Security Project, Top 10 para Aplicaciones Agénticas 2026


## Dónde viven las decisiones de seguridad

La revisión independiente 1 (R1) demostró que una configuración que vive en el repositorio, y que por tanto no es de confianza, no puede decidir sola qué variable de entorno se lee ni a qué servidor se envía. Regla: **ninguna elección de seguridad depende solo del archivo del proyecto.**

| Decisión | Dónde vive | Quién la controla |
|---|---|---|
| Qué variable contiene el token | `*_token_env`, solo `FORGE_` + mayúsculas/dígitos/«_», con lista de nombres reservados en el código | el proyecto, dentro de un espacio propio de FORGE |
| A qué host se envía | defecto en el código (`api.github.com`, `gitlab.com`); cualquier otro en `FORGE_INTEGRACIONES_HOSTS` | el USUARIO (su entorno), comparación exacta |
| Qué hosts se rechazan siempre | código (`hosts.js`): localhost, `*.internal`, `*.local`, IP, `metadata.*`, puerto ≠ 443 | nadie |
| Qué rutas no se proponen | código (`rutas.js`), lista común y no reducible | nadie |
| Modo, tope e interruptor | modo obligatorio por adaptador; auditoría obligatoria para escribir; `FORGE_INTEGRACIONES` solo `normal`/`apagado` (otro valor apaga) | el proyecto puede restringir, no ampliar |
| Escritura (`comentar`, `proponer`) | el modo del proyecto es solo una PETICIÓN: vale únicamente si `FORGE_INTEGRACIONES_ESCRITURA` nombra al proveedor (lista separada por comas, comparación exacta); si no, el efectivo es `solo_lectura` como máximo (revisión 2, H8) | el USUARIO (su entorno) |
| Destinos | los del proyecto, **intersecados** con `FORGE_INTEGRACIONES_DESTINOS` si el usuario la define (revisión 2, H8) | el proyecto puede restringir; el usuario decide el techo |
| Cola de aprobaciones, bloqueo por alcance, contadores | directorio de estado del USUARIO fuera del árbol (`~/.forge/integraciones/<hash>/`, en Windows `%LOCALAPPDATA%\forge\integraciones\<hash>\`, o `<FORGE_HOME>/integraciones/<hash>/`); pendientes con HMAC-SHA256 con una clave local aleatoria (revisión 2, H1, H3, H9) | nadie desde el repositorio |
| Qué se aprueba | `aprobar` exige `--huella` (completa o ≥ 12), que cubre `{proveedor, operacion, destino, referencia, contenido}`; muestra siempre el texto exacto, destino, cuenta y archivos con su huella (revisión 2, H1, H3) | la persona, con lo que VE |
| Servidor local de pruebas | símbolo `BASE_LOCAL` de `pruebas-internas.js`; no hay opción pública | solo las pruebas |

Consecuencia: `forge doctor` muestra `FORGE_INTEGRACIONES_HOSTS` y los nombres de variable que la configuración pide leer, para que el usuario vea a dónde irían sus credenciales.

## Revisión 2: un archivo del árbol no es de confianza (cola, alcance, sesión, modo y destinos)

La revisión independiente 2 (RECHAZADA, H1 a H12) encontró que la regla anterior se cumplía para el host y la variable, pero no para lo que AUTORIZA una escritura: la cola de pendientes, `alcance.json`, `sesion.json` y el modo y los destinos estaban en el árbol del proyecto (o en su `sdd.config.yaml`) y, por tanto, los controla un repositorio hostil que se clona. Un pendiente fabricado con su huella (un SHA-256 sin secreto) se publicaba con el token del usuario.

**Decisión.** Lo que autoriza una escritura debe venir de algo que el repositorio NO pueda fabricar:

1. **Estado del usuario fuera del árbol.** La cola de pendientes, el bloqueo por alcance y los contadores de operaciones (por sesión y por día) viven en `<FORGE_HOME>/integraciones/<hash>/` si `FORGE_HOME` está definida, en `%LOCALAPPDATA%\forge\integraciones\<hash>\` en Windows y en `~/.forge/integraciones/<hash>/` en el resto; `<hash>` es el SHA-256 de la ruta REAL del proyecto. El directorio se crea con modo 0700 y los archivos con 0600 donde el sistema los respeta (en Windows, la protección es la ACL heredada de `%LOCALAPPDATA%`).
2. **Cola autenticada.** Cada pendiente lleva un HMAC-SHA256, con una clave aleatoria de 32 bytes generada la primera vez y guardada en ese directorio (nunca en el árbol), sobre TODO el registro (`id`, `proveedor`, `operacion`, `destino`, `referencia`, `contenido` con la lista de archivos y su sha256, `estado`, `creado`, y lo que se añada después). Uno cuyo HMAC no valga se rechaza con un mensaje claro. La carpeta `.sdd/integraciones/` del proyecto conserva la ENTRADA (`entrada/`, `*.tareas.json`) y el interruptor por archivo (que solo puede apagar), y no autoriza nada. Un pendiente antiguo del árbol no se aprueba nunca: `pendientes` lo lista «no autenticado» y dice cómo recrearlo con `publicar`.
3. **Aprobar es ver y atar.** `aprobar <id>` imprime siempre el texto exacto, el destino, la cuenta (proveedor y modo) y los archivos con su huella, y exige `--huella <hash o prefijo de al menos 12>`; sin ella sale con 2 e imprime la vista y el comando completo. La huella cubre `{proveedor, operacion, destino, referencia, contenido}` y se comprueba la coherencia destino/referencia/operación/tipo.
4. **Mismas reglas al preparar y al aprobar.** Una sola función (`archivoPublicable`) decide si un archivo se publica (dependencias, configuración, CI, vetados, secretos por formato, rutas que el adaptador rechaza, y que su sha256 sea el de su contenido); el texto, la descripción y el título pasan siempre por `redactar` y `redactarFormatos`.
5. **El repositorio puede pedir, no conceder.** El modo de escritura del proyecto solo vale si el usuario lo habilita con `FORGE_INTEGRACIONES_ESCRITURA` (lista de proveedores, comparación exacta); sin ella el efectivo es `solo_lectura` como máximo y `forge doctor` lo dice. Si el usuario define `FORGE_INTEGRACIONES_DESTINOS`, todo destino fuera de esa lista se rechaza aunque el proyecto lo liste.
6. **Topes.** El tope por sesión sigue contando por sesión, pero como `sesion.json` lo puede fabricar el repositorio, se añade un tope diario (5 veces el de sesión, con techo de 200) que ningún identificador de sesión reinicia, en el estado del usuario.

**Riesgo residual (se documenta, no se oculta).**
- El estado del ciclo que `publicar` lee (`.sdd/motor/`) sigue estando en el árbol: un repositorio hostil puede fabricar un punto de guardado con su huella. Lo que lo contiene es que `publicar` solo prepara, `aprobar` obliga a ver el texto y los archivos con su huella, y el modo de escritura y los destinos los pone el usuario.
- Quien ya tiene acceso de escritura al directorio de estado del usuario (y por tanto a la clave) puede firmar lo que quiera: está fuera del modelo de amenaza (es el propio usuario o su cuenta).
- Una persona puede copiar y pegar la huella sin mirar. La aprobación obliga a que la vista se imprima y a que la huella la dé la persona; no puede obligar a leer.
