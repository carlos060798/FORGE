# Plan de implementación: Integraciones con GitHub, GitLab y Jira

> Spec: `spec.md` · Decisión técnica: ADR-22 · Estado: en implementación por instrucción del dueño (2026-10-11)

## 1. Suposiciones tomadas (corregibles)

La spec dejó cinco preguntas abiertas. Para poder avanzar sin esperar, el plan toma la recomendación de la spec en cada una. **Si el dueño decide otra cosa, se cambia aquí y en la spec antes de la fase que lo toque.**

| # | Pregunta de la spec | Suposición del plan | Qué cambia si se invierte |
|---|---|---|---|
| 1 | REST directo o cliente MCP | **REST directo** con `fetch` de Node, tres adaptadores estrechos | Un transporte MCP detrás del mismo puerto (fase 6, opcional) |
| 2 | ¿Enmendar el Principio III? | **No se enmienda ahora**: los módulos de integración son opcionales y el núcleo sigue funcionando sin red. Se anota la interpretación en el ADR | Una enmienda MENOR de la constitución, sin cambiar código |
| 3 | Jira: token o OAuth | **Token de API** de un usuario de servicio (correo + token, esquema básico sobre HTTPS) | Un flujo OAuth con navegador: otra spec |
| 4 | Dónde se aprueba | **Línea de comandos**: `forge integraciones aprobar <id>`; la solicitud en borrador es la revisión final en la plataforma | Aprobación en la plataforma: se omite el paso |
| 5 | `aprobacion: no_requerida` | **No existe en la primera entrega**: toda escritura exige aprobación | Una opción explícita solo para `comentar`, más una prueba |

## 2. Principios del diseño

- **Apagado por defecto y sin efecto sobre quien no lo usa** (HU-005): ningún módulo de integración se importa en el arranque de `forge run`, `forge resume`, el modo clásico, el servidor MCP ni la API. Se cargan de forma perezosa desde el comando `forge integraciones`.
- **El modelo no participa**: ninguna función de este módulo la llama un agente, y ningún agente recibe nada de aquí salvo, si se pide, el texto de la incidencia ya delimitado como dato.
- **Un puerto, tres operaciones**: leer, comentar, proponer. Nada genérico.
- **Estado de control, no texto**: qué se publica y dónde lo decide el estado del ciclo y la configuración (Principio VI).

## 3. Módulos

| Módulo | Responsabilidad |
|---|---|
| `core/integraciones/puerto.js` | Contrato `ProveedorDeTrabajo`: `leerElemento`, `comentar`, `proponerCambio`, `comprobarAlcance`; tipos del elemento |
| `core/integraciones/config.js` | Leer y validar `integraciones:`; modos; lista de destinos; nombres de variables de entorno; rechazo de tokens literales |
| `core/integraciones/confianza.js` | Convertir texto de la plataforma en dato: delimitar, acotar, redactar, neutralizar caracteres invisibles y URL; sin autoridad |
| `core/integraciones/http.js` | Cliente mínimo sobre `fetch`: solo HTTPS, host en la lista, sin redirecciones a otro host, tiempo máximo, tope de respuesta, reintento acotado, límite de ritmo |
| `core/integraciones/proveedores/github.js` | Adaptador de GitHub |
| `core/integraciones/proveedores/gitlab.js` | Adaptador de GitLab (gitlab.com y autoalojado) |
| `core/integraciones/proveedores/jira.js` | Adaptador de Jira Cloud |
| `core/integraciones/aprobacion.js` | Cola de pendientes en `.sdd/integraciones/pendientes/`, vista previa, aprobación, idempotencia por identificador |
| `core/integraciones/auditoria.js` | Eventos `integracion:*` sin contenido ni credenciales; topes por sesión y por proveedor; interruptor |
| `cli/integraciones.js` | Comandos `forge integraciones leer | publicar | aprobar | estado | apagar` |
| `core/integraciones/doctor.js` | Comprobaciones para `forge doctor` |

Todos los archivos escriben a través de `core/escritura-segura.js` y redactan con `core/ciclo/redactar.js`.

## 4. Flujo

```
forge integraciones leer github org/repo#123
  → config.js valida modo y destino (antes de cualquier red)
  → proveedor.leerElemento  (HTTPS, host permitido, tope de tamaño)
  → confianza.js: dato delimitado, redactado, acotado
  → escribe .sdd/integraciones/entrada/<id>.json y un archivo de tareas listo para `forge run --tasks`
  → muestra la descripción que el ciclo usaría (sin ejecutar nada)

forge run --motor ciclo --tasks .sdd/integraciones/entrada/<id>.tareas.json
  → el ciclo existente, sin cambios

forge integraciones publicar <id> --tipo comentario|propuesta
  → arma la publicación desde el ESTADO del ciclo (huellas, resultado, evidencia), la redacta y la acota
  → la deja en pendientes con vista previa; NO escribe en la plataforma

forge integraciones aprobar <id>
  → comprueba modo, destino, tope y que la vista previa no haya cambiado (huella)
  → proveedor.comentar / proponerCambio  (idempotente por identificador)
  → evento integracion:publicado
```

## 5. Datos

`.sdd/integraciones/entrada/<id>.json`: `{ proveedor, destino, referencia, titulo, cuerpo (ya como dato), etiquetas, traido, huella }`.
`.sdd/integraciones/pendientes/<id>.json`: `{ id, proveedor, operacion, destino, contenido, huellaContenido, estado: pendiente|aprobado|publicado|rechazado, creado, aprobadoPor? }`. El token nunca se guarda: solo el nombre de la variable.

## 6. Configuración

```yaml
integraciones:
  github:
    modo: solo_lectura          # apagado | solo_lectura | comentar | proponer
    token_env: FORGE_GITHUB_TOKEN
    destinos:
      - org/repo
  gitlab:
    modo: apagado
    host: gitlab.com
    token_env: FORGE_GITLAB_TOKEN
    destinos: []
  jira:
    modo: apagado
    sitio: ejemplo.atlassian.net
    usuario_env: FORGE_JIRA_USUARIO
    token_env: FORGE_JIRA_TOKEN
    destinos: []                 # claves de proyecto
  topes:
    operaciones_por_sesion: 20
```

El lector de configuración existente solo entiende un nivel de claves: la lista de destinos y el anidamiento exigen ampliarlo con prueba, o usar claves planas (`github_modo`, `github_destinos` separadas por comas). **Decisión del plan: claves planas**, para no tocar el lector mínimo y evitar el error de sangría que ya mordió (ver `docs/PROBLEMAS-CONOCIDOS.md`).

## 7. Fases

| Fase | Contenido | Depende de | Verificación |
|---|---|---|---|
| **S0** Spikes | ✅ Hechos el 2026-10-11: `spikes/permisos-minimos.md`, `spikes/contratos-respuesta.md` y 52 casos hostiles. Ver sección 10 | — | Informes en `spikes/` |
| **F1** Núcleo | Puerto, configuración, `confianza.js`, `http.js`, auditoría, apagado, carga perezosa | S0 (parcial) | HU-004, HU-005, HU-006 con tests |
| **F2** Adaptadores | GitHub, GitLab, Jira, con un servidor HTTP falso local para las pruebas | F1, S0 | HU-001 y contratos de cada uno |
| **F3** Publicación | Cola de pendientes, vista previa, aprobación, idempotencia, comentarios y propuestas | F2 | HU-002, HU-003 |
| **F4** CLI y `doctor` | `forge integraciones`, comprobaciones de alcance y configuración | F3 | CA-004-02 |
| **F5** Seguridad | Batería hostil contra el flujo completo, prueba de no filtración, revisión independiente | F4 | HU-001 CA-03/04, CA-004-05 |
| **F6** Opcional | Transporte MCP de solo lectura detrás del puerto | F5 y decisión del dueño | Spec aparte |

## 8. Pruebas

- **Sin red real en la suite**: servidor HTTP local falso por proveedor, con respuestas guionizadas, errores, redirecciones, respuestas enormes y textos hostiles.
- **Prueba de aislamiento (HU-005)**: con la configuración ausente o apagada, ni una conexión (se intercepta `fetch` y falla si se llama) y los módulos de integración no se importan al arrancar.
- **Prueba de no filtración (CA-004-05)**: un token centinela con formato reconocible; tras un recorrido completo, no aparece en prompts, `events.jsonl`, puntos de guardado, diario, pendientes ni mensajes de error.
- **Pruebas reales**: opt-in, con `FORGE_TEST_INTEGRACIONES=1` y cuentas de prueba del dueño; nunca en la suite normal.

## 9. Riesgos del plan

| Riesgo | Mitigación |
|---|---|
| Las rutas REST o los permisos mínimos no son los que se supone | S0 va primero y los adaptadores se escriben contra su resultado |
| Un cambio de API de una plataforma rompe un adaptador | Versión de API fijada, pruebas de contrato y adaptadores independientes |
| La aprobación se vuelve mecánica | Vista previa exacta, borrador en la plataforma como segunda barrera, y el límite se documenta |
| El texto hostil llega al registro | `confianza.js` es el único punto de entrada y tiene su batería |
| Se rompe el modo de quien no usa esto | Carga perezosa y la prueba de aislamiento corren en cada ejecución de la suite |

## 10. Consecuencias de los spikes (2026-10-11)

| Hallazgo | Cambio en el plan |
|---|---|
| El alcance del token no se puede consultar en GitHub ni Jira | `comprobarAlcance` devuelve `no_comprobable` en esos dos y `doctor` lo dice. Nuevo valor de configuración `<proveedor>_alcance` (texto libre que se muestra en `doctor` y `estado`). El control real es el **modo** y la **lista de destinos**, no la detección del alcance |
| GitLab: `draft` por API sin confirmar | El adaptador usa el prefijo `Draft:` en el título y la prueba contra una instancia real (opt-in) decide si también se envía `draft`. La solicitud nunca se crea sin ese marcador |
| GitLab.com Free no tiene tokens de proyecto | Se documenta: en Free se usa un token personal de un usuario de servicio con acceso solo a los proyectos permitidos; `doctor` comprueba sus ámbitos |
| Jira: ADF | Tarea nueva F2.3a: conversor ADF→texto y texto→ADF mínimo, propio, con batería hostil (un documento ADF es otro vector) |
| Jira con ámbitos cambia la base de la API y el `cloudId` está sin confirmar | La primera entrega solo admite **token sin ámbitos contra `<sitio>.atlassian.net`**. Las cuentas de servicio que exigen ámbitos quedan como límite documentado |
| Sin idempotencia en las APIs | `aprobacion.js` guarda el identificador devuelto y un marcador oculto en el texto; antes de publicar busca el marcador |
| GitHub puede devolver 404 por falta de permiso | CA-003-04 se comprueba **leyendo** primero (rama base, permisos del repositorio) y un 404 se trata como «sin permiso o no existe», sin distinguirlo |
| Jira no tiene equivalente a una solicitud de cambio | Ya contemplado: `proponer` se trata como `comentar` en Jira |
| Límites de ritmo documentados | `http.js` respeta `Retry-After` y los topes por sesión quedan muy por debajo de los límites secundarios de GitHub |

**Pendiente de confirmar con cuentas reales (opt-in):** `draft` en GitLab, borradores en repositorios privados de GitHub con plan gratuito, rol mínimo de GitLab para comentar y los ámbitos por endpoint.
