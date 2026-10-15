# Plan de implementación: perfiles de agente

> Spec: `spec.md` · Estado: **borrador, sin aprobar** · Decisiones existentes: ADR-21 (un solo lugar para las reglas), ADR-22 revisión 2 (lo que autoriza no vive en el árbol)

## 1. Suposiciones tomadas (corregibles)

| # | Pregunta de la spec | Suposición del plan | Qué cambia si se invierte |
|---|---|---|---|
| 1 | Dónde va el perfil | En la cabecera del agente si el lector lo admite (S0.2); si no, archivo hermano | Un lector distinto |
| 2 | Agente sin perfil | Perfil mínimo del rol | Una constante |
| 3 | `tools:` actual | Solicitud, intersectada | Migración explícita |
| 4 | Alcance de la primera entrega | Solo `arquitecto`, `tester` e implementador | El resto del catálogo en la segunda |
| 5 | Política del usuario | Archivo en el estado del usuario | Una lectura |

## 2. Principios del diseño

- **El motor impone:** el perfil se convierte en esquemas ofrecidos y en reglas de ruta, no en texto de prompt.
- **Un solo lugar por regla:** las rutas siguen decididas por `validarRuta` y `aplicarArchivos`; el perfil solo les pasa más restricciones.
- **Intersección, nunca unión.**
- **Sin cambio sin perfil:** el valor por defecto reproduce el ciclo de hoy, probado.
- **Falla cerrado.**

## 3. Módulos

| Módulo | Responsabilidad |
|---|---|
| `core/ciclo/perfiles.js` (nuevo) | Garantías fijas por rol del ciclo; `resolverPerfil(def, politica, config)`; función pura |
| `core/agent-registry.js` | Lee y valida el perfil de la definición (mismo estilo de error que la configuración) |
| `core/ciclo/politica-usuario.js` (nuevo) | Lee la política del estado del usuario fuera del árbol |
| `core/ciclo/herramientas-coder.js` | `crearHerramientasCoder` recibe el perfil; esquemas filtrados; mismo comportamiento por defecto |
| `core/ciclo/protocolo-archivos.js` | `aplicarArchivos` acepta rutas escribibles del perfil; motivo `fuera_de_perfil` |
| `core/ciclo/nodos.js`, `turnos.js` | Resuelven el perfil de cada rol y lo pasan; topes de contexto y de pasos |
| `core/ciclo/estado.js` | Guarda el perfil efectivo para reanudar y auditar |
| `cli/` (`doctor`, `agentes perfil`) | Muestran el efectivo y los intentos de ampliación |

## 4. Flujo

1. Cargar definición del agente (`agent-registry.js:90-110`) con su perfil y su solicitud `tools:`.
2. Leer política del usuario (fuera del árbol) y configuración del proyecto.
3. `resolverPerfil`: capa 1 (tabla del rol) ∩ capa 2 ∩ capa 3; registrar en el diario cada intento de ampliación.
4. Guardar el efectivo en el estado.
5. Nodo: ofrece al modelo solo los esquemas del perfil; las rutas pasan por `validarRuta`/`aplicarArchivos` con las restricciones; los topes son los efectivos.
6. Rechazos: motivo claro, diario, el ciclo continúa o pide revisión como hoy.

## 5. Datos

- Perfil efectivo: `{ rol, herramientas: string[], rutasLeer: string[], rutasEscribir: string[], contextoMaxBytes: number, pasosMax: number, origen: Record<campo, 'garantia'|'usuario'|'proyecto'> }`.
- Evento: `ciclo:perfil_resuelto` y `ciclo:perfil_ampliacion_ignorada { agente, campo }`.
- Garantías fijas por rol (punto de partida, a confirmar en S0.1): `arquitecto` sin herramientas; `tester` escribe solo rutas de prueba; implementador con las cinco herramientas y sin escritura en pruebas ni rutas protegidas.

## 6. Fases

| Fase | Contenido | Sale con |
|---|---|---|
| S0 | Spikes S0.1 a S0.4 | `spikes/` |
| F1 | **Prueba de regresión del ciclo verificado** sobre el código actual (verde) | CA-005-04 como referencia |
| F2 | Formato y lector del perfil; errores claros | HU-001 |
| F3 | `perfiles.js` con tres capas y propiedad | HU-003 |
| F4 | Aplicación en el implementador por turnos y en bloque | HU-004 |
| F5 | Aplicación a `arquitecto` y `tester` | HU-005 |
| F6 | Aviso en `doctor`, `agentes perfil`, documentación | HU-001 (CA-001-04) |
| F7 | Revisión independiente; después segunda entrega con el resto del catálogo | Cierre |

## 7. Pruebas

- **Regresión del ciclo verificado:** proveedor guionizado, Docker falso, ambos modos de implementador; compara archivos escritos, huellas, eventos de diario relevantes, veredicto y presupuesto contabilizado. Se escribe y pasa **antes** de tocar nada.
- **Propiedad:** generar capas al azar; el efectivo siempre es subconjunto de la capa 1 y nunca supera ningún tope.
- **Rol de solo lectura:** por bloque, por `editar` y por integración: ninguna escritura.
- **Herramienta no ofrecida pedida igual:** rechazada y anotada.
- **Repositorio hostil:** `agents/*.md` del proyecto con `Write` en un agente de lectura; archivo de política fabricado en el árbol ignorado.
- **Reanudación:** perfil original conservado; uno más estricto aplicado; uno más laxo, no.
- **Perfil mal formado:** detiene antes de la primera llamada.

## 8. Riesgos del plan

| Riesgo | Señal | Respuesta |
|---|---|---|
| Un perfil demasiado estricto rompe el ciclo | La regresión falla | La capa 1 se define desde S0.1, no desde las cabeceras |
| Las cabeceras actuales dan expectativas falsas | Documentación | Renombrar el concepto: «solicitud» |
| Dos mecanismos (ciclo y gancho) divergen | Spike S0.3 | Documentar; unificar en entrega aparte |
| `parseFrontmatter` no soporta estructura | S0.2 | Archivo hermano |
| Política del usuario fabricable desde el árbol | Revisión | Ubicación fuera del árbol, como ADR-22 revisión 2 |

## 9. Revisión

Toca los tres agentes del ciclo verificado: revisión independiente obligatoria y la prueba de regresión como condición de fusión (`docs/ADECUACION-DEL-CATALOGO.md` §6). Se usa la guía OWASP Agentic 2026 como referencia temática de mínimo privilegio; sin citar números de riesgo mientras la lista no se verifique.
