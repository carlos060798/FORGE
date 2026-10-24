# Plan maestro — FORGE frente al mercado y todo el trabajo agrupado

> **Fecha:** 2026-10-13 · **Rama:** `feature/motor-agentico`
> Agrupa en un solo sitio la comparación con el mercado, la posición frente a Spec Kit y todo el trabajo pendiente, ordenado para poder ejecutarlo. Detalle en `PLAN-EJECUCION-FINAL.md` (cierre), `PLAN-ESCALADO.md` (etapas) y `PLAN-INCREMENTAL.md` (incrementos).
> Fuentes primarias consultadas el 2026-10-13 (sección 9). Se leyó una página por herramienta: «no aparece» significa que no está en esa página. Nada de lo planificado aquí está implementado.

## 1. En una página

- **Qué es FORGE hoy:** un marco de desarrollo guiado por especificaciones con un ciclo que verifica el código en un contenedor sin red, decide por código de salida, limita el gasto y espera la aprobación de una persona. Validado con un modelo de Anthropic, en Windows con Docker, en proyectos pequeños.
- **Dónde no debe competir:** en escribir especificaciones. Spec Kit (141 mil estrellas, 41 herramientas) y OpenSpec (72 mil) ya lo hacen y son agnósticos.
- **Dónde tiene sitio:** en lo que esas herramientas dejan al criterio del agente: **comprobar** que el código cumple, **contener** al agente y **acotar** el gasto. En las páginas leídas de Spec Kit, OpenSpec, BMAD y Kiro no aparece ejecución aislada obligatoria, defensa contra inyección ni tope de gasto.
- **Posición propuesta:** *la capa de verificación y gobierno para código escrito con IA: cualquier modelo, cualquier herramienta, calidad comprobada y coste acotado.* Se usa **junto a** Spec Kit, no en su lugar.
- **Lo que no se puede afirmar:** que sea «el primer marco agnóstico» (no lo sería) ni que garantice software correcto (ningún arnés lo hace).

## 2. Comparación con lo que hay

| Categoría | Ejemplos (dato de su página) | Qué resuelven | Qué dejan sin resolver | FORGE |
|---|---|---|---|---|
| **Especificaciones** | Spec Kit: 141 mil estrellas, 41 herramientas. OpenSpec: 72 mil, más de 30. BMAD: 54 mil. Kiro (AWS) | Qué construir y en qué orden; plantillas; agnósticos de herramienta | Quién ejecuta las pruebas y dónde; contención del agente; gasto | Tiene un flujo equivalente, con menos alcance y sin comunidad |
| **Agentes de código** | Goose: 55 mil estrellas, más de 15 proveedores, en la Linux Foundation. Aider. OpenHands. «Forge» de forgecode: 7,6 mil | Escribir y editar código con cualquier modelo | La verificación es opcional y suele correr en el equipo del usuario | No compite: se apoya en ellos |
| **Aislamiento para agentes** | container-use (Dagger): 4,1 mil estrellas, un contenedor y una rama por agente, vía MCP, experimental | Que varios agentes no se pisen | No da veredicto ni mide calidad | Ya aísla la ejecución de pruebas; no aísla al agente entero |
| **Puertas de verificación** | x-harness: comprueba una «tarjeta de finalización» del agente contra una política, sin modelos, versión candidata | Que el agente no declare «hecho» sin evidencia | Según su página, verifica la tarjeta, no ejecuta las pruebas en un contenedor | El terreno más cercano a FORGE; ver sección 4 |
| **Estándares** | AGENTS.md (Linux Foundation, más de 60 mil proyectos). Agent Skills (formato abierto, decenas de herramientas). MCP | Portabilidad entre herramientas | — | Ya genera `AGENTS.md` y tiene 31 skills; el instalador solo escribe en `.claude/` |

Un estudio de once arneses de código (arXiv 2609.00006, resumen) apunta en la misma dirección: 9 de 11 adoptan skills y 8 de 11 MCP, y el comportamiento pasa «de la prosa del prompt a la configuración». Ser agnóstico por esos estándares es seguir la corriente, no inventar una vía propia.

## 3. FORGE frente a Spec Kit

| Aspecto | Spec Kit | FORGE | Lectura |
|---|---|---|---|
| Especificar | Flujo completo, extensiones, presets, paquetes | Flujo equivalente en español | Gana Spec Kit |
| Herramientas soportadas | 41 más una genérica | Claude Code | Gana Spec Kit |
| Comunidad y mantenimiento | GitHub, 141 mil estrellas | Un dueño, sin publicar la 5.0 | Gana Spec Kit |
| Pruebas antes que código | Artículo III de su constitución: una regla que el agente debe seguir | El motor lo impone: otro rol las escribe y deben fallar antes | Gana FORGE |
| Dónde corren las pruebas | Su documento de método no lo dice | Contenedor sin red, obligatorio | Gana FORGE |
| Quién decide que está hecho | El agente («converged») y la revisión humana | El código de salida, y después una persona | Gana FORGE |
| Calidad de las pruebas | No aparece | Medición por mutación | Gana FORGE |
| Gasto | No aparece | Tope por sesión y libro de gasto | Gana FORGE |
| Contención del agente | No aparece | Rutas vetadas, herramientas contadas, sin red, sin credenciales | Gana FORGE |
| Reanudar tras un corte | No aparece | Puntos de guardado y diario de llamadas | Gana FORGE |

**Conclusión:** son complementarios. Spec Kit decide **qué** construir; FORGE comprueba **que se construyó** y **contiene a quien lo construye**. FORGE ya exporta e importa el formato de Spec Kit (`cli/export.js`, `cli/import.js`).

### Situaciones en las que alguien lo usaría

| Situación | Qué hace con FORGE | Qué necesita del plan |
|---|---|---|
| Equipo que ya usa Spec Kit con Copilot o Cursor | Tras implementar, `forge verificar`: pruebas aisladas, veredicto y mutación, sin gastar en modelos | Frente B (`verificar`, instalación agnóstica) |
| Desarrollador que no se fía del «casi correcto» | `forge run` sobre las tareas de su especificación: nada se da por bueno sin pasar las puertas | Ya existe; frente A para publicarlo |
| Quien abre repositorios de terceros con un agente | El agente no puede leer secretos, salir a la red ni publicar nada | Frente C |
| Equipo con presupuesto limitado | Tope de gasto, nivel de modelo más barato que resuelva, modelo local | Frente B (proveedores) |
| Integración continua | La misma puerta en local y en el servidor | Frentes B y D |
| Equipo que despliega en la nube | El agente propone la infraestructura; una persona aprueba el plan y el coste | Frente G |

## 4. Riesgos de la posición

| Riesgo | Por qué importa | Respuesta |
|---|---|---|
| Spec Kit añade verificación aislada como extensión | Tiene mecanismo de extensiones y mucha comunidad | Ofrecer FORGE **como** pieza que Spec Kit pueda usar (MCP, comando), no como rival |
| Ya hay puertas de verificación (x-harness y otras) | El hueco no está vacío | Diferenciarse en lo que ejecuta de verdad: pruebas en contenedor, mutación y gasto, no una declaración del agente |
| El nombre `forge` choca con forgecode, que usa el mismo comando | Confusión al instalar y al buscar | Decisión del dueño antes de publicar; `sdd-es` ya es alias |
| Evidencia escasa | Windows, un proveedor, proyectos pequeños | Frente A antes que cualquier anuncio |
| Un solo mantenedor | Los competidores tienen equipos | Alcance pequeño y bien probado; no abrir frentes sin usuarios |

## 5. Todo el trabajo, agrupado en frentes

| Frente | Objetivo | Especificaciones | Estado | Gasta | Revisión independiente |
|---|---|---|---|---|---|
| **A. Cierre y publicación** | Que lo que hay sea instalable y esté probado en Linux | Las 10 existentes | Código hecho; faltan CI, cuentas reales, factura, ratificación, beta | No | Hechas cinco pasadas |
| **B. Agnóstico** | Cualquier herramienta y cualquier modelo | `instalacion-agnostica`, `verificar-sin-modelo`, `proveedores-agnosticos` | Las tres en borrador, sin aprobar | Solo la validación real | `verificar` y `proveedores` |
| **C. Gobierno del agente** | Que un agente engañado no tenga con qué hacer daño | `defensa-inyeccion-y-fuga`, `perfiles-de-agente` | Por redactar | No | Sí, las dos |
| **D. Calidad** | Más puertas objetivas y evidencia citables | `puertas-de-calidad-y-evidencia`; corrección con «lo que no debe cambiar»; propiedades (experimento) | Por redactar | No | La primera |
| **E. Interoperar** | Que otras herramientas usen FORGE como pieza | `ciclo-por-mcp`, `contrato-publico`, puente con Spec Kit y OpenSpec | Por redactar | No | MCP |
| **F. Orquestación** | Tareas independientes a la vez, con el gasto acotado | `oleadas-en-paralelo` | Por redactar; espera a usuarios | No | Sí |
| **G. Despliegue** | Proponer infraestructura con aprobación; AWS primero | `despliegue-con-aprobacion` (puerto y adaptador de AWS) | Por redactar; el último por riesgo | Infraestructura real | Sí, la más estricta |
| **H. Adopción** | Que alguien pueda empezar en diez minutos | Guía corta, ejemplo de punta a punta, nombre, beta en tres fases | Parcial (`docs/FORGE-5.0-GUIA.md`, `docs/PUBLICO-OBJETIVO.md`) | No | No |

### Contenido de los frentes por redactar

**C. Gobierno del agente**
- Archivos del proyecto entregados al modelo como dato no confiable, con el delimitador que ya usan las integraciones (`core/integraciones/confianza.js`).
- Control de salida: lo que el agente escribe se revisa en busca de secretos y de destinos externos antes de aceptarlo.
- Batería permanente de textos y proyectos hostiles (`tests/fixtures/integraciones/hostiles.json`, `tests/proyecto-hostil.test.js`), ampliada.
- El repositorio no puede redirigir la clave del proveedor a otro servidor (hoy es un spike de `proveedores-agnosticos`; si se confirma, pasa a ser lo primero).
- Perfil por rol: herramientas permitidas, rutas legibles y escribibles, tope de contexto y de pasos. El proyecto puede apretar, nunca aflojar.
- Guía: OWASP Top 10 para aplicaciones con agentes 2026, como en las revisiones anteriores.

**D. Calidad**
- Puertas declarables por el proyecto (tipos, linter, seguridad, cobertura), ejecutadas en el contenedor y evaluadas por código de salida.
- Criterios de aceptación enlazados a pruebas: se ve qué requisito no tiene prueba.
- Informe de evidencia por tarea: qué se ejecutó, con qué imagen, qué salió y cuánto costó.

**G. Despliegue**
- El modelo propone infraestructura como código y un plan; nunca llama a la nube ni ve una credencial.
- Vista previa con lo que se crea, cambia o borra y el coste estimado; aprobación con huella; lo aprobado es lo que se aplica.
- Rol temporal y acotado que concede el usuario desde su entorno; listas cerradas de cuentas, regiones y servicios; lo destructivo, vetado por defecto.
- Tope de gasto de infraestructura, auditoría e interruptor. Parte del agente `operaciones` y de la skill de despliegue que ya existen.

## 6. La regla que ordena todo

| Capa | Quién la cambia | Contenido |
|---|---|---|
| **Garantías** | Nadie | Código generado solo en contenedor sin red; veredicto por código de salida; pruebas por otro rol; tope de gasto; aprobación humana; el modelo sin red y sin credenciales |
| **Política** | El usuario, en su entorno | Qué se puede escribir fuera, qué proveedores y destinos, cuánto gasto |
| **Personalización** | El proyecto | Flujo, agentes, plantillas, puertas adicionales y límites más estrictos |

El proyecto puede **pedir y apretar, nunca conceder ni aflojar**. Un frente que debilite una garantía no se fusiona.

## 7. Orden de trabajo

| Oleada | Contenido | Quién | Sale con |
|---|---|---|---|
| **0. Ahora** | Aprobar o corregir las tres especificaciones en borrador; abrir la solicitud de cambio. El nombre ya está decidido: Fragua | Dueño | Especificaciones aprobadas, integración continua corriendo |
| **1. Agnóstico sin gasto** | Spikes de las tres; `instalacion-agnostica`; `verificar-sin-modelo`; conformidad de proveedores y herramientas en OpenAI | Agentes | FORGE usable desde otra herramienta y con otro proveedor, contra servidores falsos |
| **2. Publicar la beta** | Integración continua en verde; guía corta y ejemplo; `5.0.0-beta.1` con la etiqueta `next`; beta cerrada de 5 a 10 personas | Dueño y agentes | Primeros usuarios reales |
| **3. Gobierno y calidad** | Redactar y aprobar `defensa-inyeccion-y-fuga`, `perfiles-de-agente` y `puertas-de-calidad-y-evidencia`; implementarlas con revisión independiente | Agentes; el dueño aprueba | La promesa de «contención y calidad» respaldada por pruebas |
| **4. Interoperar** | `ciclo-por-mcp`, `contrato-publico`, guía «FORGE junto a Spec Kit» | Agentes; el dueño aprueba | Otra herramienta delega la verificación en FORGE |
| **5. Según la beta** | Validación con un segundo proveedor real; oleadas en paralelo; más lenguajes | Dueño y agentes | Lo que pidan los usuarios |
| **6. Despliegue** | `despliegue-con-aprobacion` con AWS | Dueño y agentes | Solo con los frentes C y D terminados |

Las oleadas 1 y 3 no gastan en modelos. La 2 es la que convierte el proyecto en algo que existe para otros; sin ella, el resto es trabajo sin evidencia.

## 8. Arranque: qué se hace primero

El cambio de nombre toca los mismos archivos que las otras especificaciones (`cli/index.js`, lectura de variables, carpeta de estado). Para no rehacer trabajo, el orden de arranque es:

| Paso | Qué | Especificación | Tipo | Bloqueado por |
|---|---|---|---|---|
| 1 | Orden `fragua` junto a `forge` | `renombrar-a-fragua` F1 | Código | **Hecho** |
| 2 | Inventarios: variables, carpeta de estado, etiquetas, nombre del paquete | `renombrar-a-fragua` S0 | Lectura | — |
| 3 | Spikes de las tres especificaciones agnósticas | S0 de cada una | Lectura | Aprobación del dueño |
| 4 | Nombre en un solo sitio; ayuda y mensajes | `renombrar-a-fragua` F2 | Código, riesgo bajo | 2 |
| 5 | `instalacion-agnostica` F1 a F3 y `verificar-sin-modelo` F1 y F2, en ramas separadas | — | Código | 3, 4 |
| 6 | Variables con alias y conflicto como error; carpeta de estado; etiqueta | `renombrar-a-fragua` F3, F4 | Código, **seguridad** | 2; revisión independiente antes de fusionar |
| 7 | Conformidad de proveedores y herramientas en OpenAI | `proveedores-agnosticos` F1, F2 | Código | 3, 6 |
| 8 | Paquete y documentación con el nombre nuevo; guía corta | `renombrar-a-fragua` F5; frente H | Código y documentos | 4 |
| 9 | Integración continua en verde y beta con el nombre nuevo | Frente A | **Dueño** | 8 |

Los pasos 2 y 3 son de solo lectura y pueden ir en paralelo. Los pasos 5 a 7 van en ramas separadas, se integran uno a uno y con la suite completa entre medias.

## 9. Decisiones del dueño

| Decisión | Para cuándo | Recomendación |
|---|---|---|
| Aprobar las tres especificaciones en borrador | Oleada 0 | Aprobar con las respuestas recomendadas en cada una |
| Abrir la solicitud de cambio a `main` | Oleada 0 | Hacerlo ya: la integración continua en Linux nunca ha corrido |
| Nombre del comando (`forge` choca con forgecode) | **Decidido el 2026-10-13: Fragua** | Spec `2026-10-13-renombrar-a-fragua`; la orden `fragua` ya existe junto a `forge` |
| Publicar como `5.0.0-beta.1` con `next` | Oleada 2 | Sí; `latest` sigue en 4.2.0 |
| Posición: junto a Spec Kit, no contra él | Oleada 2 | Sí; es donde hay hueco |
| Rotar la clave de Anthropic usada en la validación | Ya | Pendiente desde la validación |
| Segundo proveedor y presupuesto para la validación real | Oleada 5 | El que ya tenga; tope de 1 USD |
| Despliegue en AWS | Oleada 6 | No empezarlo antes de terminar C y D |
| De herramienta local a servicio | Sin fecha | No ahora: toca los Principios III y IV |

## 10. Fuentes

Consultadas el 2026-10-13.

- Spec Kit: https://github.com/github/spec-kit · método: https://github.com/github/spec-kit/blob/main/spec-driven.md · integraciones: https://github.com/github/spec-kit/blob/main/docs/reference/integrations.md
- OpenSpec: https://github.com/Fission-AI/OpenSpec
- BMAD: https://github.com/bmad-code-org/BMAD-METHOD
- Kiro: https://kiro.dev/docs/specs/ · https://kiro.dev/docs/specs/correctness/
- Aider: https://aider.chat/docs/usage/lint-test.html
- Goose: https://github.com/block/goose
- OpenHands: https://docs.openhands.dev/
- container-use: https://github.com/dagger/container-use
- Forge (forgecode): https://github.com/antinomyhq/forge
- x-harness: https://pkg.go.dev/github.com/BrianNguyen29/x-harness
- Estudio de once arneses (resumen): https://arxiv.org/abs/2609.00006
- AGENTS.md: https://agents.md/ · Agent Skills: https://agentskills.io/
- OWASP Top 10 para aplicaciones con agentes 2026: https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/

No verificado: verzcar y otras puertas de verificación aparecieron solo en resultados de búsqueda; las cifras de estrellas son las que mostraba cada página ese día.
