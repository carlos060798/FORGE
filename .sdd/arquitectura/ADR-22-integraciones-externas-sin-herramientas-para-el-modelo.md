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
| Servidor local de pruebas | símbolo `BASE_LOCAL` de `pruebas-internas.js`; no hay opción pública | solo las pruebas |

Consecuencia: `forge doctor` muestra `FORGE_INTEGRACIONES_HOSTS` y los nombres de variable que la configuración pide leer, para que el usuario vea a dónde irían sus credenciales.