# ADR-37: Enmienda del ADR-22: operaciones de lectura de cambios y publicación de una revisión bajo aprobación

> Estado: propuesta (pendiente de aceptación formal del dueño; **no puede aceptarse antes que el ADR-22**)  # propuesta | aceptada | obsoleta | reemplazada-por-ADR-XX
> Fecha: 2026-11-27
> Spec relacionada: 2026-11-27-revision-publicada
> Autor: Claude (pendiente de aceptación por el dueño)
> Enmienda: ADR-22 (integraciones externas ejecutadas por el anfitrión, sin herramientas de red para el modelo). Relacionada con ADR-31 (puerto de revisión propio).
> Evidencia: lectura de `core/integraciones/puerto.js`, `aprobacion.js`, `auditoria.js` y los adaptadores de GitHub y GitLab el 2026-11-27, y del plan consolidado §4.2, §4.3. Nada se implementó ni se probó contra una plataforma. **[NV]** marca lo no verificado.

## Orden de aceptación (condición previa)

El ADR-22 figura hoy como **«propuesta (en implementación por instrucción del dueño, 2026-10-11; pendiente de aceptación formal)»** (`ADR-22-…md:3`) [V-código], y el plan dice que **«el dueño acepta primero el ADR-22 y después se enmienda»; no se construye encima de un ADR sin aceptar** (§4.3) [V-plan]. Por tanto:

1. El dueño decide el ADR-22 (aceptar, rechazar o modificar).
2. Solo si lo acepta, se evalúa este ADR-37. Si el ADR-22 se rechaza o cambia en lo que aquí se enmienda, este ADR se reescribe o queda obsoleto.
3. Hasta entonces la spec `revision-publicada` está bloqueada y no se escribe código de estas operaciones.

## Contexto

El ADR-22 fija un puerto de integraciones con operaciones cerradas por proveedor: leer un elemento, comentar y proponer un cambio, más la comprobación de alcance (`puerto.js:4,18`), y prohíbe cualquier operación genérica (`puerto.js:24-26,105-111`) [V-código]. La decisión 2 dice «tres operaciones fijas por proveedor»; la decisión 5 limita la escritura a lo que no toque ramas existentes, no fusione, no cierre y no transicione estados; la 6 trata el texto de plataforma como dato; la 4 y la tabla «Dónde viven las decisiones de seguridad» dejan en manos del usuario lo que autoriza una escritura [V-código: ADR-22].

Para la revisión de solicitudes de cambio hace falta algo que ese puerto no tiene: leer el **diff** y los metadatos de un cambio, leer el **estado de su CI** y **publicar una revisión** con comentarios en línea. Hoy `leerElemento` solo devuelve título, cuerpo, etiquetas y comentarios y marca `tipo: solicitud_de_cambio` (`github.js:355-408`; `gitlab.js:323-364`; `puerto.js:46`) [V-código]. Añadirlo es **una enmienda**, porque cambia el número y la naturaleza de las operaciones que el ADR-22 declara cerradas (`C1_arquitectura.md` §2.3) [V-plan].

Hay además cuatro hechos del código que condicionan el diseño:

- `validarProveedor` exige que **todo** proveedor tenga todas las operaciones de `OPERACIONES` (`puerto.js:100-102`) [V-código]. Jira no tiene solicitudes de cambio: añadir las operaciones nuevas a esa lista dejaría a Jira inválido.
- Existen **dos listas homónimas** `OPERACIONES`: la del puerto (`puerto.js:18`) y la de aprobación (`aprobacion.js:44`, solo `comentar` y `proponer_cambio`). El plan propone renombrar la segunda a `OPERACIONES_APROBABLES` (§4.2) [V-código y V-plan].
- Las operaciones auditables son otro conjunto cerrado (`auditoria.js:37`) y una operación fuera de él lanza un error [V-código: `auditoria.js:236-237`].
- Las referencias válidas son una expresión regular por adaptador (`github.js:57`, `gitlab.js:52`) y un mapa en `publicacion.js:44-48`; la de GitLab es `grupo/proyecto#N` y hoy designa incidencias [V-código].

## Decisión

1. **Se añaden tres operaciones para proveedores de código** (GitHub y GitLab en la primera entrega), en un **contrato de revisión** separado del contrato base:
   - `leerCambio(referencia)`: **lectura.** Devuelve metadatos del cambio, referencias de base y cabeza, indicador de borrador y de bifurcación, y el diff normalizado de ADR-31, con el texto de plataforma entregado como dato.
   - `leerEstadoCI(referencia)`: **lectura.** Devuelve un estado normalizado y cerrado y la lista de comprobaciones con nombre y estado. No lee registros. No hay estado «aprobado» posible si la plataforma no informa.
   - `publicarRevision(referencia, revision, opciones)`: **escritura bajo aprobación.** Publica un resumen y comentarios en línea, idempotente por marcador, solo como **comentarios**.
2. **Lo que `publicarRevision` NO puede hacer** (se prueba): aprobar, pedir cambios, fusionar, cerrar, borrar, editar código o ramas, crear comprobaciones de estado ni transicionar nada. Mantiene la decisión 5 del ADR-22. Un comentario que la plataforma no pueda anclar a una línea se degrada a nota general; en GitLab se usan los tres SHA completos de `diff_refs` y, si faltan o la plataforma rechaza la posición, se degrada [V-plan: `R3` §3.1; comportamiento real [NV]].
3. **`publicarRevision` pasa siempre por la cola autenticada**: crea un pendiente (HMAC con clave local, estado del usuario fuera del árbol), con huella sobre `{proveedor, operacion, destino, referencia, contenido}` donde el contenido incluye la **cabeza revisada**; `aprobar` exige `--huella` y muestra el texto exacto, el destino, la cuenta y cada comentario con archivo y línea. Si la cabeza cambió, no se publica. Nada se publica sin huella aprobada por la persona (`aprobacion.js:290,451-460,533-538`) [V-código].
4. **Las lecturas no escriben.** `leerCambio` y `leerEstadoCI` no crean pendientes ni disparan publicación; crear un pendiente es una acción explícita de la persona.
5. **Contrato aparte, no una ampliación de `OPERACIONES`.** Se añade una lista cerrada propia `OPERACIONES_DE_REVISION` y un validador `validarProveedorDeRevision` que exige esas tres y rechaza las genéricas con el mismo criterio que `validarProveedor` (`puerto.js:24-26`). Un proveedor es de revisión si lo declara; Jira no lo es y **no deja de ser válido**. Pedir una operación de revisión a un proveedor que no la tiene falla con un error propio y sin petición. [Variante rechazada en las alternativas: ampliar `OPERACIONES`.]
6. **Auditoría obligatoria:** se añaden `leer_cambio`, `leer_estado_ci` y `publicar_revision` a las operaciones auditadas (`auditoria.js:37`). Una operación sin auditoría no se carga (plan §4.2). Todas cuentan contra los topes por sesión y por día (`auditoria.js:34`).
7. **La aprobación reconoce la operación nueva:** `OPERACIONES` de `aprobacion.js:44` pasa a llamarse `OPERACIONES_APROBABLES` y suma `publicar_revision`. Sin cambio de comportamiento para `comentar` y `proponer_cambio` (se prueba con la suite actual en verde antes y después).
8. **Modo y habilitación.** `publicarRevision` se rechaza con modo inferior a `comentar` (`puerto.js:15`) [V-código] y, como toda escritura, solo vale si el **usuario** la habilita con `FORGE_INTEGRACIONES_ESCRITURA` para ese proveedor y el destino está en su techo `FORGE_INTEGRACIONES_DESTINOS` (ADR-22, «Revisión 2», puntos 5 y 6). [POR_DECIDIR: reutilizar `comentar` (propuesta de este ADR) o crear un modo propio.] `leerCambio` y `leerEstadoCI` exigen `solo_lectura`.
9. **Todo lo demás del ADR-22 se mantiene tal cual:** operaciones ejecutadas por Forja en el proceso del anfitrión, el modelo no recibe herramientas ni credenciales ni URL; sin dependencias nuevas (`fetch` de Node); mínimo privilegio y apagado por defecto; texto de la plataforma como dato; host y token en el control del usuario; sin cambios para quien no configure `integraciones:`.
10. **Las referencias de cambio** se definen por adaptador (propiedad del adaptador, plan §4.2). Para GitHub se reutiliza `org/repo#N` (`github.js:57`); para GitLab el formato de una solicitud de fusión es [POR_DECIDIR] (`#N` o `!N`).

## Alternativas consideradas

- **A. No enmendar: que el modelo use los servidores MCP oficiales de las plataformas desde el cliente del usuario** (alternativa D del ADR-22): ya es posible hoy, pero ahí el modelo sí tiene las herramientas de red y de escritura. Rechazada para el componente de Forja: pierde la cola, la huella y la auditoría.
- **B. Añadir las tres operaciones a `OPERACIONES` del puerto base:** rechazada. Obliga a todo proveedor (Jira incluido) a implementarlas (`puerto.js:100-102`) o a lanzar un error en cada una, y mezcla en un solo contrato proveedores con y sin solicitudes de cambio. [Es la opción más simple si el dueño prefiere un solo contrato; Jira lanzaría `no_soportado` como ya lo hace en `proponerCambio`, `puerto.js:81`.]
- **C. Una sola operación genérica «revisar» con modo lectura/escritura:** rechazada. Es el tipo de operación abierta que el ADR-22 prohíbe y que `validarProveedor` rechaza por nombre.
- **D. Publicar la revisión como comprobación de estado o con el veredicto de la plataforma (aprobar, pedir cambios):** rechazada. Convertiría un consejo en un bloqueo o una aprobación; el plan pide «nunca un bloque verde/rojo que en la práctica decide» (§4.3) y el servicio de revisión de referencia tampoco aprueba ni bloquea por sí solo (`R3` §1.1) [V-plan].
- **E. Contrato de revisión aparte con tres operaciones fijas, lectura sin escritura, publicación solo por la cola y solo como comentario (elegida como propuesta):** conserva todas las garantías del ADR-22, no rompe a Jira y se puede probar sin plataforma.

## Consecuencias

### Positivas
- La revisión publicada se apoya en lo ya probado del ADR-22: cola, huella, auditoría, topes, host y token controlados por el usuario.
- Jira y el comportamiento actual no cambian.
- Las operaciones nuevas son pocas, fijas y auditables; ninguna genérica.
- La degradación a nota general evita perder la revisión cuando la plataforma no admite el anclaje.

### Negativas
- Dos adaptadores más grandes que mantener (diff, CI, revisión), con riesgo de cambios de API de la plataforma; cada adaptador sube de cuatro operaciones a siete.
- Un segundo contrato (`OPERACIONES_DE_REVISION`) añade una concepto más al puerto.
- Leer un diff envía a la plataforma una petición más y trae contenido grande: topes de tamaño y de páginas por definir [NV].
- El flujo con aprobación por línea de comandos sigue siendo más lento que uno automático (consecuencia ya aceptada en el ADR-22).

### Neutrales
- El puerto de revisión de ADR-31 no cambia: las integraciones solo aportan `leerCambio` y `publicarRevision`.
- No se tocan ADR-12, ADR-15, ADR-02 ni ADR-07.

## Riesgos que esta decisión no elimina

- **Texto hostil en el diff, el título o los nombres de las comprobaciones.** Se contiene con texto como dato y sin herramientas; no se detecta.
- **Un token con más alcance del necesario.** `comprobarAlcance` no puede verificarlo en GitHub (`puerto.js:67`) [V-código]; el permiso mínimo que cubre leer diff, leer CI y publicar una revisión es [NV] y hay que leerlo de la documentación de cada plataforma.
- **Aprobación mecánica.** La vista previa obliga a imprimir el contenido y a copiar la huella, no a leer.
- **Anclaje incorrecto.** Un comentario publicado en una línea equivocada tras un cambio de cabeza se evita atando la huella a la cabeza revisada; si la plataforma ancla mal sin error, no se detecta [NV].
- **Contenido sensible en el diff** viaja al proveedor de modelos: quien no deba enviar ese código fuera no debe activar la lectura (mismo riesgo residual que el ADR-22).

## Cuándo revisitar

- Si el dueño rechaza o cambia el ADR-22 (esta enmienda se reescribe o queda obsoleta).
- Si las plataformas retiran o cambian la API REST de diff, estado de CI o revisiones.
- Si resulta mejor un contrato único (alternativa B) porque Jira u otro proveedor adquiere solicitudes de cambio.
- Si la aprobación por línea de comandos resulta inviable para publicar muchos comentarios.
- Si se decide admitir otras plataformas (Bitbucket, Azure DevOps, Forgejo, Gitea), cuyos endpoints están sin verificar (`R3`) [V-plan].

## Referencias

- `.sdd/arquitectura/ADR-22-integraciones-externas-sin-herramientas-para-el-modelo.md` (en particular las decisiones 2 y 5 y las revisiones 1 y 2).
- `.sdd/arquitectura/ADR-31-puerto-de-revision-propio.md`.
- `.sdd/especificaciones/2026-11-27-revision-publicada/spec.md`, `2026-10-11-integraciones-externas/spec.md`.
- `core/integraciones/puerto.js:4,15,18,24-26,46,67,79-81,100-111`; `aprobacion.js:44,49,290,451-460,533-538`; `auditoria.js:34,37,236-237`; `proveedores/github.js:57,355-408`; `proveedores/gitlab.js:52,323-364`; `publicacion.js:44-48`.
- `reports/Plan consolidado de modos y componentes Forja.md` §4.2, §4.3, §5 (fase 7), §6.
- `research_notes/Consejo plan consolidado Forja/R3_devops_revision_pr.md` §1.1, §3.1; `C1_arquitectura.md` §2.3.
