---
id: 2026-10-14-despliegue-con-aprobacion
titulo: "Despliegue con aprobación: puerto de despliegue con un adaptador de AWS; el modelo propone, una persona aprueba la huella, el anfitrión aplica con un rol temporal y acotado"
tamano: grande  # micro | pequeño | mediano | grande
estado: borrador  # borrador | en_revision | aprobada | en_implementacion | completada
creada: 2026-10-14
actualizada: 2026-10-14
autor: humano  # humano | importado
constitucion_version: 1.1.0
etiquetas: [despliegue, aws, infraestructura, aprobacion, gasto, seguridad, alto-riesgo]
---

# Especificación: `despliegue-con-aprobacion`

> **Estado: borrador.** Redactada por un agente por encargo del dueño (2026-10-14); **no está aprobada** y no se implementa hasta que el dueño la apruebe (Principio II). Es el frente G de `PLAN-MAESTRO.md` (§5): **el de más riesgo y el último** (§7, oleada 6).
>
> **Aviso de riesgo.** Esta especificación es la única del plan que, una vez implementada, puede **gastar dinero real y destruir recursos reales** sin que haya un modelo de lenguaje equivocado de por medio: basta un error de código o una aprobación mecánica. Por eso hay spikes obligatorios, revisión independiente la más estricta y una condición de arranque explícita (§9).

## 1. Contexto y Motivación

El agente `operaciones` ya configura IaC y despliegues, pero con las herramientas del propio agente: tiene `Bash` y `Write` (`agents/operaciones.md:6`) y su proceso termina en «usa el comando de la plataforma detectada (`vercel --prod`, `flyctl deploy`, `railway up`…)» con confirmación verbal del usuario (`agents/operaciones.md:90-97`). La skill `deploy-vercel` exige que el **agente** tenga el MCP de Vercel instalado y autenticado y lo use directamente (`skills/deploy-vercel/SKILL.md:7-9`, `:52-54`). Es el modelo que ADR-22 rechaza para las integraciones: un modelo con herramientas de red y credenciales convierte cualquier texto no confiable en un vector.

El plan maestro fija la respuesta (§5, frente G): *el modelo propone infraestructura como código y un plan; nunca llama a la nube ni ve una credencial*; vista previa de lo que se crea, cambia o borra con coste estimado; aprobación con huella; rol temporal y acotado que concede el usuario; listas cerradas; lo destructivo, vetado; tope de gasto de infraestructura; auditoría e interruptor. Es la misma arquitectura que `core/integraciones/` aplicada a una operación mucho más peligrosa.

Qué se reutiliza de las integraciones (no se reescribe): decisión de que el anfitrión ejecuta y el modelo no (ADR-22, decisión 1); puerto con operaciones fijas y sin «llamar a la API» (`core/integraciones/puerto.js:12-18`); cola de pendientes firmada con HMAC y clave local fuera del árbol (`core/integraciones/aprobacion.js:76`, `core/integraciones/estado-usuario.js:128-179`); huella que cubre todo lo que se ejecuta y `aprobar` que la exige (`aprobacion.js:129`, `:451-538`); modo y destinos que el usuario concede por entorno y el proyecto solo puede apretar (`aprobacion.js:550-553`; ADR-22, revisión 2); auditoría, tope diario e interruptor (`core/integraciones/auditoria.js:34`, `:81-101`); redacción y delimitación (`confianza.js`).

## 2. Objetivo

Que Fragua pueda **aplicar** en una cuenta de AWS de la persona la infraestructura que un agente propuso, de modo que:

1. el agente solo escriba archivos de IaC en el proyecto y nunca toque la nube ni una credencial;
2. el anfitrión calcule un plan y una vista previa **deterministas** (qué se crea, cambia y borra, y cuánto cuesta aproximadamente);
3. lo que se aplica sea **exactamente** lo que la persona vio (huella);
4. se aplique con un rol temporal y de alcance mínimo que la persona concede desde su entorno;
5. cualquier cosa destructiva, fuera de lista o por encima del tope, **no se aplique**.

## 3. Usuarios y Actores

| Actor | Rol | Necesidad principal |
|---|---|---|
| Equipo que despliega en la nube | Quiere que un agente proponga infraestructura | Que el agente no pueda gastar ni destruir por sí mismo |
| Agente `operaciones` | Escribe IaC y un plan en texto | No tiene red, credenciales ni orden de aplicar |
| Texto no confiable | Incidencia, README, plantilla de terceros | Es el adversario: intenta crear recursos caros, abrir red, escalar privilegios |
| Persona que aprueba | Ve la vista previa y da la huella | Ver lo real, no un resumen del modelo |
| Revisor independiente | Audita antes de cualquier aplicación real | Una superficie pequeña y cerrada |

## 4. Historias de Usuario

### HU-001: Puerto de despliegue sin acceso del modelo
**Como** responsable de seguridad
**Quiero** un puerto con operaciones fijas y sin «llamar a la API»
**Para** que ninguna capa superior pueda hacer una llamada arbitraria a la nube

**Criterios de aceptación:**
- [ ] **CA-001-01**: El puerto tiene operaciones fijas: `planificar`, `vistaPrevia`, `aplicar`, `comprobarAlcance`. No existe una operación genérica; un adaptador que la ofrezca se rechaza (patrón de `puerto.js:90`). (P1)
- [ ] **CA-001-02**: Ningún agente, herramienta MCP ni nodo del ciclo recibe el puerto, URLs de la nube ni credenciales (ADR-22, decisión 1; ADR-15). Una prueba estática lo vigila. (P1)
- [ ] **CA-001-03**: El adaptador de AWS vive en `core/despliegue/proveedores/aws/` y no importa ninguna dependencia nueva (Principio IV). (P1)
- [ ] **CA-001-04**: El agente `operaciones` y la skill `deploy-vercel` no se usan para esta vía; sus instrucciones de «publicar con el comando de la plataforma» se sustituyen o se marcan como no aplicables a los destinos del puerto (el cambio de `agents/operaciones.md` es una tarea de esta spec, no de la de perfiles). (P2)

### HU-002: Plan determinista y vista previa
**Como** persona que aprueba
**Quiero** ver exactamente qué se crea, cambia y borra y cuánto cuesta
**Para** decidir con lo real y no con lo que el modelo cuente

**Criterios de aceptación:**
- [ ] **CA-002-01**: El plan lo calcula el anfitrión desde los archivos de IaC del proyecto, con un rol de **solo lectura/plan**; el texto del modelo no entra en el plan ni en la vista previa (patrón de `vistaPrevia`, `aprobacion.js:322`). (P1)
- [ ] **CA-002-02**: La vista previa lista por recurso: acción (crear, modificar, **reemplazar**, **borrar**), tipo, identificador, región y cuenta; marca en rojo reemplazos y borrados. (P1)
- [ ] **CA-002-03**: La vista previa incluye un **coste mensual estimado** con su rango y con la lista de recursos cuyo coste **no se pudo estimar** («sin estimar»); un recurso sin estimar cuenta como incumplimiento del tope, no como cero. (P1)
- [ ] **CA-002-04**: El mismo contenido y la misma configuración producen la misma huella (determinismo, Principio VI). (P1)
- [ ] **CA-002-05**: El plan declara su formato y versión; un plan de otro formato o caducado se rechaza. (P1)

### HU-003: Aprobación con huella
**Como** persona que aprueba
**Quiero** aprobar atando una huella
**Para** que lo que se aplique sea lo que vi

**Criterios de aceptación:**
- [ ] **CA-003-01**: `fragua desplegar aprobar <id> --huella <h>` exige la huella completa o un prefijo ≥ 12 (`MIN_HUELLA`, `aprobacion.js:49`); sin ella, sale con 2 imprimiendo la vista. (P1)
- [ ] **CA-003-02**: La huella cubre `{proveedor, cuenta, región, plantilla (contenido), parámetros, plan, coste estimado, tope, rol}`; un cambio en cualquiera invalida la aprobación. (P1)
- [ ] **CA-003-03**: La cola vive en el estado del usuario fuera del árbol, con HMAC y clave local (`estado-usuario.js:128`, `:142`); una solicitud del árbol no se aprueba nunca. (P1)
- [ ] **CA-003-04**: Una aprobación caduca (por defecto 30 minutos) y es de un solo uso. Si el estado real de la cuenta cambió desde el plan (deriva), se rechaza y hay que planificar de nuevo. (P1)
- [ ] **CA-003-05**: Aplicar no es una herramienta ni del MCP ni de ningún agente; solo la CLI de la persona (coherencia con `2026-10-14-ciclo-por-mcp`, §8). (P1)

### HU-004: Rol temporal y acotado
**Como** usuario
**Quiero** conceder un rol temporal desde mi entorno
**Para** que Fragua no tenga credenciales permanentes ni amplias

**Criterios de aceptación:**
- [ ] **CA-004-01**: Las credenciales que Fragua usa son **temporales**, obtenidas por el usuario (p. ej. asumiendo un rol con duración corta y política de sesión) y entregadas por su entorno; Fragua no guarda ni escribe credenciales en disco ni en el árbol, y no las pasa a ningún proceso del modelo ni al contenedor de pruebas. (P1)
- [ ] **CA-004-02**: Hay **dos roles distintos**: el de planificar (lectura y creación de conjuntos de cambios sin ejecutarlos) y el de aplicar; el de aplicar se concede solo para esta operación. (P1)
- [ ] **CA-004-03**: `comprobarAlcance` verifica, antes de aplicar, la identidad (cuenta, ARN), que el rol tenga límite de permisos (permissions boundary) y que no tenga permisos de administración de identidad; si no puede verificarlo, **no aplica** y lo dice. (P1)
- [ ] **CA-004-04**: El nombre de la variable de credenciales sigue la regla de ADR-22 («Dónde viven»): espacio propio, con lista de nombres reservados; el repositorio no elige qué variable se lee ni a qué punto de acceso se envía. (P1)
- [ ] **CA-004-05**: `fragua doctor` muestra qué cuenta, regiones y servicios están concedidos y a qué punto de acceso irían las credenciales. (P2)

### HU-005: Listas cerradas
**Como** usuario
**Quiero** listas cerradas de cuentas, regiones y servicios
**Para** que un plan fuera de ellas no se aplique nunca

**Criterios de aceptación:**
- [ ] **CA-005-01**: Cuentas, regiones y tipos de recurso permitidos vienen del **entorno del usuario**; el repositorio puede reducirlas, nunca ampliarlas (ADR-22, revisión 2, H8). (P1)
- [ ] **CA-005-02**: Sin lista definida, no hay despliegue: el valor por defecto es «ninguno», no «todos». (P1)
- [ ] **CA-005-03**: La lista de **tipos de recurso** es una lista de permitidos (allowlist) inicial y pequeña; todo lo que no esté, se rechaza al planificar, aunque el rol lo pudiera crear. (P1)
- [ ] **CA-005-04**: Se vetan siempre, sin configuración del proyecto: recursos de identidad (usuarios, roles, políticas, claves de acceso), recursos personalizados con código (Lambda como recurso personalizado), macros y transformaciones, y plantillas anidadas que se descargan por URL. (P1)
- [ ] **CA-005-05**: La plantilla se recibe como contenido inline; no se admite una URL de plantilla ni un archivo fuera del proyecto. (P1)

### HU-006: Lo destructivo, vetado
**Como** usuario
**Quiero** que borrar y reemplazar estén vetados por defecto
**Para** que un plan nunca destruya datos sin una decisión aparte

**Criterios de aceptación:**
- [ ] **CA-006-01**: Un plan con borrados o reemplazos **no se aplica** por defecto, aunque tenga huella aprobada. (P1)
- [ ] **CA-006-02**: Permitirlo exige una variable del usuario **por operación** (no una lista permanente) y una segunda aprobación con huella que muestre solo lo destructivo y lo que se pierde. (P1)
- [ ] **CA-006-03**: Los recursos con estado (bases de datos, almacenes de objetos, volúmenes, colas con mensajes) nunca se borran ni se reemplazan por esta vía en la primera versión; no hay variable que lo permita. (P1)
- [ ] **CA-006-04**: No hay operación «destruir pila» ni «destruir todo» en el puerto. (P1)

### HU-007: Tope de gasto de infraestructura
**Como** usuario
**Quiero** un tope de gasto de infraestructura que pare lo que lo supere
**Para** que un plan con una instancia enorme no se aplique

**Criterios de aceptación:**
- [ ] **CA-007-01**: Tope por **aplicación** (coste mensual estimado del plan) y tope **mensual acumulado** de lo aplicado por Fragua en esa cuenta, ambos fijados por el usuario en su entorno; el proyecto solo puede bajarlos. (P1)
- [ ] **CA-007-02**: Sin tope definido no se aplica. (P1)
- [ ] **CA-007-03**: El acumulado vive en el estado del usuario con firma; si no es legible o válido, falla cerrado. (P1)
- [ ] **CA-007-04**: Se declara el límite conocido: es un tope sobre una **estimación**, no sobre la factura real; no sustituye a las alertas de presupuesto de la propia cuenta, que el usuario debe configurar. (P1)
- [ ] **CA-007-05**: Recursos de coste no acotado por el plan (por uso: transferencia, peticiones, funciones sin tope de concurrencia) se tratan como «sin estimar» y no pasan salvo que la plantilla fije su límite. (P2)

### HU-008: Auditoría e interruptor
**Como** responsable
**Quiero** un registro completo y un interruptor
**Para** reconstruir lo ocurrido y poder pararlo todo

**Criterios de aceptación:**
- [ ] **CA-008-01**: Cada operación (planificar, aprobar, aplicar, rechazar, fallo) deja un evento con cuenta, región, huella, coste estimado, resultado y duración, sin credenciales ni contenido sensible (patrón de `OPERACIONES_AUDITADAS`, `auditoria.js:37`). (P1)
- [ ] **CA-008-02**: Interruptor `FRAGUA_DESPLIEGUE=apagado` (o archivo de apagado) se comprueba en **cada** operación, también en las ya aprobadas; un valor no reconocido apaga (`auditoria.js:81-101`). (P1)
- [ ] **CA-008-03**: Un tope diario de operaciones que ningún identificador de sesión reinicia (patrón `topeDiarioDe`, `auditoria.js:34`). (P1)
- [ ] **CA-008-04**: Cada recurso creado lleva etiquetas de propiedad (`gestionado-por: fragua`, huella, fecha) para localizarlo y limpiarlo; la creación sin etiquetas se rechaza. (P2)

### HU-009: Aplicar y comprobar
**Como** persona que aprueba
**Quiero** que tras aplicar se compruebe el resultado
**Para** no dar por buena una infraestructura a medias

**Criterios de aceptación:**
- [ ] **CA-009-01**: Aplicar ejecuta **el conjunto de cambios calculado**, identificado y atado a la huella, y no recalcula uno nuevo. (P1)
- [ ] **CA-009-02**: Se observa hasta un estado terminal con tiempo máximo; un estado no terminal o un fallo se informa como fallo, no como éxito. (P1)
- [ ] **CA-009-03**: Ante fallo de creación, el comportamiento es el **del proveedor** (deshacer lo creado en esa operación) y Fragua no ejecuta recuperaciones por su cuenta; informa del estado real. (P2)
- [ ] **CA-009-04**: El resultado (salidas de la pila) se redacta antes de mostrarse o guardarse. (P1)

## 5. Escenarios de Uso

### Escenario 1: Caso feliz
`operaciones` escribe `infra/` con un bucket y una distribución. `fragua desplegar planificar` produce la vista: 2 recursos nuevos, coste estimado bajo, nada destructivo. La persona aprueba con la huella. Se aplica con el rol temporal y se comprueba.

### Escenario 2: Plantilla hostil
Una incidencia hace que el agente incluya un rol de administración y un recurso personalizado con código. Al planificar, ambos están en la lista de vetados: el plan se rechaza sin llegar a la nube.

### Escenario 3: Coste por encima del tope
Una instancia grande con base de datos supera el tope por aplicación: la vista lo marca y `aprobar` no aplica.

### Escenario 4: Plan destructivo
El plan reemplaza una base de datos. Vetado por defecto; sin variable del usuario, no hay nada que aprobar.

### Escenario 5: Aprobación vieja
Pasa una hora y la cuenta cambió. La aprobación caducó o el plan derivó: se rechaza y se vuelve a planificar.

### Escenario 6: Interruptor
Con `FRAGUA_DESPLIEGUE=apagado`, una aprobación ya firmada no se aplica.

## 6. Requisitos Funcionales

| ID | Requisito | Prioridad |
|---|---|---|
| RF-01 | Puerto `core/despliegue/puerto.js` con cuatro operaciones fijas | P1 |
| RF-02 | Adaptador de AWS en `core/despliegue/proveedores/aws/` (forma del plan según spike S0.3) | P1 |
| RF-03 | Comandos `fragua desplegar planificar|vista|aprobar|rechazar|estado|apagar|encender` | P1 |
| RF-04 | Validador de plantilla con lista de permitidos y vetos fijos | P1 |
| RF-05 | Estimador de coste con «sin estimar» explícito (spike S0.2) | P1 |
| RF-06 | Cola firmada, caducidad, uso único, comprobación de deriva | P1 |
| RF-07 | Topes de gasto por aplicación y mensual acumulado | P1 |
| RF-08 | Auditoría e interruptor | P1 |
| RF-09 | Adaptador falso local (sin red) para toda la batería de pruebas | P1 |
| RF-10 | `fragua doctor` muestra cuenta, regiones, servicios, rol, topes y a dónde irían las credenciales | P2 |

## 7. Requisitos No Funcionales

| ID | Requisito |
|---|---|
| RNF-01 | Sin dependencias nuevas (Principio IV); la decisión de cómo firmar y llamar se toma en el spike S0.4 |
| RNF-02 | El modelo no ve credenciales ni salidas con secretos (Principio V, ADR-22) |
| RNF-03 | Decisiones de control deterministas: lista, tope y veto por código, nunca por el modelo (Principio VI) |
| RNF-04 | Gasto acotado, medible y atribuible (Principio VIII) |
| RNF-05 | Reanudable y auditable (Principio IX) |
| RNF-06 | Falla cerrado: lo que no se puede verificar, no se aplica |
| RNF-07 | Windows y Linux |

## 8. Fuera de Alcance (Exclusiones Explícitas)

- Destruir infraestructura (HU-006); la primera versión no tiene operación de destrucción.
- Otras nubes (Azure, GCP) y plataformas (Vercel, Fly, Railway): llegan como adaptadores del mismo puerto en otra especificación, solo si este esquema resiste la revisión.
- Crear cuentas, roles o políticas de identidad: lo hace el usuario con su propio proceso.
- Gestión de secretos de la aplicación desplegada.
- Aplicar desde un servidor MCP o desde una API: solo CLI de una persona.
- Despliegue continuo o sin persona.
- Reparar o reconciliar infraestructura existente no creada por Fragua.
- Tablero de costes real o integración con la facturación.
- Estado remoto compartido de herramientas de IaC con dependencias de proveedores descargados.

## 9. Dependencias y Asunciones

### Condición de arranque (no negociable)
**No se empieza a implementar hasta que estén terminadas y revisadas** (revisión independiente con hallazgos altos corregidos) las especificaciones:
- `defensa-inyeccion-y-fuga` y `perfiles-de-agente` (frente C), hoy **por redactar** (no existen en `.sdd/especificaciones/` a 2026-10-14; `PLAN-MAESTRO.md` §5).
- `puertas-de-calidad-y-evidencia` (frente D), por redactar (`PLAN-MAESTRO.md` §9: «No empezarlo antes de terminar C y D»).

Motivo: el agente `operaciones` tiene `Bash` y `Write` (`agents/operaciones.md:6`); sin perfiles de agente por rol, ninguna defensa de esta spec impide que otro camino toque la nube. Y sin defensa de inyección, el plan que se muestra puede ir precedido de texto que lo disfrace.

### Spikes obligatorios (antes de escribir código)
- **S0.1 Permisos mínimos.** Derivar, con la documentación del proveedor y sin tocar una cuenta, la política mínima de dos roles (planificar y aplicar) para la lista de recursos inicial; la política de sesión que acota aún más; el límite de permisos; y qué acciones permiten escalar privilegios y deben quedar fuera. Salida: `spikes/permisos-minimos.md`, con la política literal y la lista de acciones excluidas.
- **S0.2 Estimación de coste.** Evaluar cómo estimar sin dependencias: tabla de precios propia versionada (como `core/precios.js`, ADR-19) frente a consultar la API de precios del proveedor; cobertura por tipo de recurso; margen de error; qué se marca «sin estimar». Salida: `spikes/estimacion-coste.md`, con una tabla de recursos permitidos × método × fiabilidad.
- **S0.3 Forma del plan.** Qué formato de IaC admite la primera versión y qué «plan» concreto se muestra y se ejecuta. Hipótesis a comprobar (**sin confirmar**): el conjunto de cambios de CloudFormation es calculado por el servidor, lista añadir/modificar/borrar con reemplazo y se ejecuta por identificador, lo que encaja con «lo aprobado es lo que se aplica»; Terraform exige binario y proveedores descargados (superficie y dependencias mayores). Salida: `spikes/forma-del-plan.md` con la decisión y el formato `plan.v1`.
- **S0.4 Cómo se firman y envían las llamadas.** Implementar la firma de solicitudes con `node:crypto` y `fetch` (Principio IV) frente a invocar la CLI del proveedor desde el anfitrión (superficie: configuración local, perfiles, versiones, ejecución de código). Salida: `spikes/transporte-aws.md`.
- **S0.5 Deriva y atomicidad.** Qué pasa entre planificar y aplicar si la cuenta cambia; si el conjunto de cambios queda inválido; cuánto dura. Salida: `spikes/deriva.md`.
- **S0.6 Entorno de pruebas real.** Diseñar una cuenta de pruebas aislada con presupuesto de 1 USD y alertas, y el criterio de qué se prueba allí y qué solo con el adaptador falso. Salida: `spikes/cuenta-de-pruebas.md`. **Requiere una decisión y una cuenta del dueño.**

### Dependencias
- `core/integraciones/{puerto,aprobacion,estado-usuario,auditoria,confianza,hosts}.js` (patrones y, donde proceda, módulos compartidos).
- `core/ciclo/redactar.js`, `core/ciclo/candado.js`, `core/escritura-segura.js`.
- `core/precios.js` y ADR-19 como modelo de la tabla de precios.

### Asunciones
- El usuario tiene una cuenta con un mecanismo de roles temporales y sabe usarlo; Fragua no los crea.
- La estimación de coste es **aproximada**; el producto lo dice en cada vista previa.
- Que el proveedor ofrezca un plan calculado en el servidor (S0.3) está **sin confirmar**.

## 10. Capas de seguridad

| Riesgo | Control |
|---|---|
| El modelo llama a la nube o ve credenciales | El puerto lo ejecuta el anfitrión; el modelo solo escribe archivos; credenciales solo en el entorno del usuario y en el proceso del anfitrión (ADR-22) |
| Texto no confiable cambia el plan (incidencia, README, plantilla de terceros) | El plan lo calcula el código desde la plantilla; la vista previa no incluye texto del modelo; defensa del frente C |
| Escalada de privilegios desde la plantilla (crear un rol de administración) | Recursos de identidad vetados por código; límite de permisos en el rol; `comprobarAlcance` |
| Código arbitrario en la nube (recursos personalizados, macros, transformaciones) | Vetados siempre; lista de tipos permitidos |
| Plantilla externa por URL o plantilla anidada | Solo contenido inline del proyecto |
| Coste desbocado | Tope por aplicación y mensual; «sin estimar» cuenta como incumplimiento; sin tope no se aplica |
| Destrucción de datos | Borrado y reemplazo vetados; recursos con estado inalterables en la primera versión; sin operación de destrucción |
| Aprobación mecánica (ASI09) | Vista obligatoria con rojo en lo destructivo y el coste; huella; caducidad; uso único. Riesgo residual declarado |
| Aprobación vieja o plan que derivó | Caducidad y comprobación de deriva; se aplica el conjunto calculado, no uno nuevo |
| El repositorio concede cuentas, regiones o topes | Solo el entorno del usuario concede; el repositorio aprieta (ADR-22, revisión 2) |
| Credenciales en logs, salidas o eventos | Redacción de formatos de credenciales de AWS; salidas de la pila redactadas; nunca en disco |
| Aplicar sin interruptor | Se comprueba en cada operación, también en aprobadas |
| Cuenta equivocada | Cuenta en la huella y comprobada por identidad real antes de aplicar |
| Recursos huérfanos y gasto residual | Etiquetas obligatorias; informe de lo creado; el usuario es quien limpia (no hay destrucción en la primera versión) |
| Compromiso de la clave local o del estado del usuario | Fuera del modelo de amenaza (igual que ADR-22); se documenta |

## 11. Términos del Dominio

- **Puerto de despliegue:** contrato de operaciones fijas que el anfitrión usa para planificar y aplicar.
- **Plan / conjunto de cambios:** lista calculada por el proveedor de lo que se crearía, modificaría o borraría.
- **Vista previa:** presentación determinista del plan, coste incluido.
- **Huella:** SHA-256 de lo aprobado.
- **Rol temporal acotado:** credenciales de corta duración con política de sesión y límite de permisos.
- **Deriva:** diferencia entre el estado de la cuenta al planificar y al aplicar.
- **Destructivo:** borrado o reemplazo.

## 12. Preguntas Abiertas

| # | Pregunta | Recomendación |
|---|---|---|
| 1 | ¿CloudFormation, Terraform/OpenTofu o CDK en la primera versión? | CloudFormation con conjuntos de cambios, **si S0.3 lo confirma**: plan del servidor, ejecución por identificador, sin binarios ni estado propio |
| 2 | ¿Firma propia de las llamadas o CLI del proveedor? | Firma propia con `node:crypto` si S0.4 sale bien; la CLI amplía la superficie (configuración local, perfiles) |
| 3 | ¿Estimación con tabla propia o con la API de precios? | Tabla propia versionada y «sin estimar» explícito; la API de precios añade red y credenciales |
| 4 | ¿Lista inicial de tipos de recurso? | Muy pequeña: almacenamiento estático, distribución, red básica, función sin recurso personalizado. Sin bases de datos |
| 5 | ¿Se permiten recursos con estado alguna vez? | No en la primera versión; otra especificación con su revisión |
| 6 | ¿Un rol o dos? | Dos (planificar y aplicar) |
| 7 | ¿Tope por defecto? | No hay: sin tope definido, no se aplica |
| 8 | ¿Quién crea la cuenta de pruebas y el presupuesto? | El dueño; sin ella no hay prueba real |
| 9 | ¿Cuándo empezar? | Con C y D terminadas y revisadas, como fija el plan maestro; no antes |
| 10 | ¿Se reutiliza código de `core/integraciones/` o se copia el patrón? | Extraer lo común (estado del usuario, firma, auditoría) a un módulo compartido en una tarea previa, con sus pruebas, antes de duplicar nada |

## 13. Criterios de Éxito Medibles

- Una batería de plantillas hostiles (identidad, recursos personalizados, URL, anidadas, tipos fuera de lista, coste sobre el tope, destructivas) se rechaza **antes** de contactar con la nube, con el adaptador falso y con la cuenta de pruebas.
- La huella cambia ante el cambio de cualquier campo cubierto (prueba por campo).
- Con el interruptor apagado, ninguna operación llega al adaptador.
- Ningún secreto en logs, eventos, salidas ni en el estado (prueba de rastreo con credencial sintética).
- En la cuenta de pruebas, un despliegue mínimo aplica, se comprueba y su coste real no supera el tope fijado.
- Revisión independiente sin hallazgos altos abiertos.

## 14. Referencias

- `PLAN-MAESTRO.md` (§3, §5 frente G, §6, §7 oleada 6, §9).
- `.sdd/arquitectura/ADR-22-integraciones-externas-sin-herramientas-para-el-modelo.md` (decisiones y revisión 2), `ADR-15`, `ADR-19`.
- `.sdd/especificaciones/2026-10-11-integraciones-externas/`, `2026-10-14-ciclo-por-mcp/`.
- `agents/operaciones.md`, `skills/deploy-vercel/SKILL.md`.
- OWASP GenAI, Top 10 para aplicaciones agénticas 2026 (ASI01 a ASI05, ASI09).
- Documentación del proveedor sobre roles temporales, políticas de sesión, límites de permisos y conjuntos de cambios: **por consultar y citar en los spikes** (no verificada al redactar).

## 15. Historial de Aclaraciones

- 2026-10-14: creada en borrador. Sin aclaraciones del dueño todavía.
