# Plan de implementación: `despliegue-con-aprobacion`

> Spec: `spec.md` · Estado: **borrador, sin aprobar** · Decisiones existentes: ADR-22 (anfitrión ejecuta, modelo sin herramientas de red; decisiones de seguridad en el entorno del usuario), ADR-15, ADR-19
>
> **Frente de más riesgo del plan maestro. No empieza antes de que estén terminadas y revisadas las especificaciones de defensa y de perfiles de agente (frente C) y de calidad (frente D).**

## 1. Suposiciones tomadas (corregibles)

| # | Pregunta de la spec | Suposición del plan | Qué cambia si se invierte |
|---|---|---|---|
| 1 | Formato de IaC | CloudFormation con conjuntos de cambios (a confirmar en S0.3) | Otro adaptador de plan; cambia el validador |
| 2 | Transporte | Firma propia con `node:crypto` y `fetch` (a confirmar en S0.4) | Invocar la CLI del proveedor: más superficie |
| 3 | Estimación | Tabla de precios propia versionada, con «sin estimar» | La API de precios: añade red y credenciales |
| 4 | Tipos de recurso | Lista pequeña sin bases de datos | Se amplía con otra spec |
| 5 | Destructivo | Vetado, sin operación de destrucción | Otra especificación |
| 6 | Pruebas reales | Una cuenta aislada con tope de 1 USD que aporta el dueño | Sin cuenta, solo adaptador falso y no se cierra |

## 2. Principios del diseño

- **El anfitrión ejecuta; el modelo propone.** El modelo escribe archivos y nada más.
- **Lo aprobado es lo que se aplica.** Se ejecuta el conjunto calculado, atado a la huella.
- **Falla cerrado.** Sin lista, sin tope, sin identidad verificada, sin estimación, sin interruptor: no se aplica.
- **El usuario concede, el proyecto aprieta.**
- **Reutilizar el patrón de integraciones;** extraer lo común antes de duplicar.
- **Primero sin nube:** todo el diseño se prueba contra un adaptador falso antes de la primera llamada real.

## 3. Módulos

| Módulo | Responsabilidad |
|---|---|
| `core/despliegue/puerto.js` (nuevo) | Contrato de cuatro operaciones y su validación (patrón de `core/integraciones/puerto.js`) |
| `core/despliegue/politica.js` (nuevo) | Listas (cuentas, regiones, tipos), vetos fijos, modo y topes: usuario ∩ proyecto |
| `core/despliegue/plantilla.js` (nuevo) | Lectura y validación de la plantilla (inline, sin URL, sin anidadas, sin vetados) |
| `core/despliegue/plan.js` (nuevo) | Forma `plan.v1`, vista previa, huella, deriva |
| `core/despliegue/coste.js` (nuevo) | Estimación, rango y «sin estimar» |
| `core/despliegue/cola.js` (nuevo) | Solicitudes firmadas, caducidad, uso único |
| `core/despliegue/gasto.js` (nuevo) | Acumulado mensual en el estado del usuario |
| `core/despliegue/proveedores/aws/` (nuevo) | Firma, planificar, aplicar, comprobar alcance |
| `core/despliegue/proveedores/falso/` (nuevo) | Adaptador sin red para pruebas |
| `core/compartido/estado-usuario.js` (extracción) | Lo común de `core/integraciones/estado-usuario.js`, `auditoria.js` y `aprobacion.js`, con sus pruebas existentes en verde |
| `cli/desplegar.js` (nuevo) | Comandos de la persona |
| `agents/operaciones.md` | Ajuste: propone IaC y plan; no aplica (tarea CA-001-04) |

## 4. Flujo

1. **Proponer.** `operaciones` escribe IaC en `infra/` (ruta del proyecto, bajo las reglas del ciclo; sin credenciales, sin red).
2. **Planificar** (`fragua desplegar planificar`): el anfitrión lee la plantilla, valida contra lista y vetos, comprueba cuenta y alcance con el rol de planificar, crea el conjunto de cambios, estima el coste y guarda una solicitud pendiente firmada. No se aplica nada.
3. **Vista** (`vista <id>`): se muestra plan, destructivos en rojo, coste con rango y «sin estimar», cuenta, región, rol, topes, huella y comando de aprobar.
4. **Aprobar** (`aprobar <id> --huella <h>`): comprueba interruptor, tope por aplicación y mensual, caducidad, uso único, deriva, huella y política; vuelve a verificar identidad y alcance.
5. **Aplicar:** ejecuta el conjunto calculado con el rol de aplicar; observa hasta estado terminal.
6. **Registrar:** evento de auditoría, acumulado de gasto, informe con recursos y etiquetas, salidas redactadas.

## 5. Datos

- `plan.v1`: `{formato, proveedor, cuenta, region, plantilla_sha256, parametros, cambios:[{accion, tipo, id, reemplazo, estado_con}], coste:{mensual_estimado, rango, sin_estimar:[...]}, creado, caduca}`.
- Solicitud: lo anterior + `huella`, `estado`, `hmac`.
- Estado del usuario: `<estado>/despliegue/<hash-proyecto>/` con modo 0700, igual que `estado-usuario.js:128`.
- Variables (nombres provisionales, a fijar con `renombrar-a-fragua`): `FRAGUA_DESPLIEGUE` (`normal|apagado`), `FRAGUA_DESPLIEGUE_CUENTAS`, `_REGIONES`, `_TIPOS`, `_TOPE_USD`, `_TOPE_MENSUAL_USD`, `_PERMITIR_DESTRUCTIVO` (por operación).

## 6. Fases

| Fase | Contenido | Sale con |
|---|---|---|
| **Puerta** | Condición de arranque de la spec §9 cumplida y confirmada por el dueño | Autorización escrita |
| S0 | Spikes S0.1 a S0.6 | `spikes/` y revisión del dueño |
| F0 | Extraer lo común de integraciones a un módulo compartido, sin cambio de comportamiento | Suite existente en verde |
| F1 | Puerto, política, plantilla, plan, huella, cola; adaptador falso | HU-001, HU-003, HU-005 con el falso |
| F2 | Coste y topes | HU-002 (coste), HU-007 |
| F3 | Vetos y destructivo | HU-005, HU-006 |
| F4 | Auditoría, interruptor, deriva, caducidad | HU-008 |
| F5 | **Revisión independiente 1** sobre todo lo anterior, sin nube real | Informe y correcciones |
| F6 | Adaptador de AWS: planificar y comprobar alcance con rol de solo lectura; sin aplicar | HU-004 (plan), HU-002 real |
| F7 | Aplicar en la cuenta de pruebas con un recurso mínimo | HU-009 |
| F8 | **Revisión independiente 2**, con el código real contra la cuenta de pruebas | Cierre |
| F9 | Documentación, `agents/operaciones.md`, `doctor` | Cierre |

Ningún fase de F6 en adelante empieza sin informe favorable de F5.

## 7. Pruebas

- **Todo contra el adaptador falso primero:** cada criterio con y sin cumplimiento.
- **Batería hostil de plantillas:** identidad, recursos personalizados, macros, URL, anidadas, tipos fuera de lista, nombres con caracteres engañosos, parámetros enormes, coste sin estimar.
- **Huella:** una prueba por cada campo cubierto.
- **Estado y firma:** cola alterada, clave ausente, acumulado corrupto, caducidad, repetición.
- **Interruptor y topes:** en cada operación, incluida la ya aprobada.
- **Rastreo de secretos:** credencial sintética por todos los caminos (eventos, salida, estado, errores).
- **Orden de comprobaciones:** ninguna llamada a la nube antes de superar validación local (prueba con adaptador que falla si se le llama).
- **Cuenta de pruebas real (F7), opcional y con bandera explícita,** nunca en la suite normal.

## 8. Riesgos del plan

| Riesgo | Señal | Respuesta |
|---|---|---|
| El plan del servidor no existe como se supone | S0.3 | Cambiar de formato o reducir a validación local; no seguir |
| La estimación es demasiado floja para un tope | S0.2 | Tope solo sobre recursos estimables; el resto, vetado |
| La política mínima no se puede acotar lo bastante | S0.1 | No implementar `aplicar`; quedarse en planificar |
| Firmar solicitudes a mano es frágil | S0.4 | Pruebas con vectores publicados por el proveedor; si no, CLI con entorno controlado |
| Extraer código común rompe integraciones | F0 | Suite completa y sin cambio de comportamiento antes de seguir |
| Aprobación mecánica | Revisión | Vista fija y corta; destructivo imposible por defecto; caducidad corta |
| Gasto real durante las pruebas | F7 | Cuenta aislada con presupuesto de 1 USD y alerta; recurso mínimo |
| El agente `operaciones` conserva `Bash` y evita el puerto | Revisión del frente C | Esta spec no arranca sin perfiles de agente |

## 9. Revisión

La más estricta del plan. **Dos revisiones independientes** con la guía OWASP de agentes, la primera sobre el diseño y el adaptador falso (F5) y la segunda sobre el adaptador real (F8). Puntos que se piden revisar expresamente: política mínima literal de los dos roles; lista de vetos y su completitud; orden de comprobaciones (ninguna llamada antes de validar); huella (que cubra todo lo que se ejecuta); deriva y uso único; manejo y redacción de credenciales; que ningún camino (MCP, API, agentes, skills) pueda aplicar; límites declarados de la estimación. Hasta que no estén sin hallazgos altos, no se usa con cuentas reales de terceros.
