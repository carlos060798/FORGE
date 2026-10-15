---
id: 2026-10-14-perfiles-de-agente
titulo: "Perfiles de agente: herramientas, rutas, contexto y pasos por rol, impuestos por el motor"
tamano: grande  # micro | pequeño | mediano | grande
estado: borrador  # borrador | en_revision | aprobada | en_implementacion | completada
creada: 2026-10-14
actualizada: 2026-10-14
autor: humano  # humano | importado
constitucion_version: 1.1.0
etiquetas: [seguridad, minimo-privilegio, agentes, frente-c, ciclo-verificado]
---

# Especificación: perfiles de agente

> **Estado: borrador.** Redactada por un agente por encargo del dueño (2026-10-14); **no está aprobada** y no se implementa hasta que el dueño la apruebe (Principio II). Corresponde al frente C de `PLAN-MAESTRO.md` y a la oleada C5 de `docs/ADECUACION-DEL-CATALOGO.md` §5. Toca los tres agentes del ciclo verificado: necesita revisión independiente y prueba de regresión.

## 1. Contexto y Motivación

La regla de `docs/ADECUACION-DEL-CATALOGO.md` §4 es: «cada agente declara las herramientas que necesita su rol y nada más; el motor las impone, no el prompt». Hoy no se cumple, por tres hechos comprobados en el código (2026-10-14):

1. **La cabecera `tools:` se lee y no se impone en el ciclo.** `AgentRegistry.load` guarda `tools` (`core/agent-registry.js:102`), pero ningún módulo de `core/ciclo/` ni de `cli/` lo consulta (búsqueda de `.tools` y `tools` en `core/ciclo/*.js` y `core/agent-registry.js`; el único `tools` restante es del cuerpo de petición de OpenAI, `core/llm-providers/openai-provider.js:184`). En el ciclo, lo que un rol puede hacer lo decide el nodo y el protocolo, no la cabecera.
2. **Hay dos mecanismos de permisos distintos.** En el modo plugin de Claude Code, `claude-hooks/pre-tool-guard.js:130-133` impone una lista de agentes de solo lectura (`arquitecto`, `asesor-datos`, `critico`, `seguridad`, `investigador`, `revisor`, `disenador-api`) **solo si** `CLAUDE_AGENT_NAME` está definida; sin ella, los guardias están desactivados (`:206-215`). En el ciclo propio, las restricciones están codificadas por rol en `aplicarArchivos` (`core/ciclo/protocolo-archivos.js:290,294`) y en las cinco herramientas (`core/ciclo/herramientas-coder.js:52-126`).
3. **Los topes por rol no existen.** Hay topes globales: `contexto_max_bytes` 65536 y `turnos_max` 30 (`core/ciclo/config.js:27,29`), `turnos_pruebas_max`, y `maxTokens: 8192` fijo (`core/agent-registry.js:233,306`).

Los tres agentes del ciclo verificado son: `arquitecto` (planificador, `core/ciclo/nodos.js:307`), `tester` (rol `qa`, `nodos.js:366`) y el implementador de cada tarea (`estado.tarea.agente`, `nodos.js:482`; en modo turnos, las cinco herramientas de `herramientas-coder.js`). Las cabeceras de `agents/arquitecto.md` y `agents/tester.md` declaran `Read, Grep, Glob, Bash` y `Read, Write, Grep, Glob, Bash`, que **no describen** lo que el ciclo les permite: es una declaración sin efecto.

## 2. Objetivo

Que cada rol tenga un **perfil** (herramientas, rutas legibles y escribibles, tope de contexto, tope de pasos) declarado en su definición, **resuelto y impuesto por el motor** como la intersección de tres capas (garantías fijas, política del usuario, personalización del proyecto), de modo que el proyecto pueda apretar y nunca aflojar, sin alterar el comportamiento del ciclo verificado.

## 3. Usuarios y Actores

| Actor | Rol | Necesidad principal |
|---|---|---|
| Desarrollador que abre un repositorio ajeno | Ejecuta el ciclo | Que un agente de solo lectura no pueda escribir, aunque el repositorio diga otra cosa |
| Autor de agentes (proyecto) | Personaliza | Poder reducir los permisos de un rol |
| Usuario en su entorno | Fija política | Un techo que ningún repositorio sube |
| Revisor | Audita | Ver el perfil efectivo de cada rol y por qué |

## 4. Historias de Usuario

### HU-001: Perfil declarado en la definición del agente
**Como** autor de un agente
**Quiero** declarar sus herramientas, rutas y topes en su definición
**Para** que el permiso viaje con el rol y se pueda revisar

**Criterios de aceptación:**
- [ ] **CA-001-01**: La definición (`agents/*.md`) admite un perfil con: herramientas permitidas, rutas legibles, rutas escribibles, tope de contexto y tope de pasos. Un agente sin perfil recibe el perfil **mínimo por rol** de las garantías fijas, no el máximo. (P1)
- [ ] **CA-001-02**: Una clave desconocida, un valor mal formado o una herramienta que no existe es un error que nombra el archivo y la clave (patrón de `forge config`: error con clave y línea); no se ignora en silencio. (P1)
- [ ] **CA-001-03**: La lista `tools:` actual se interpreta como **solicitud**, nunca como concesión: se intersecta con el techo del rol. (P1)
- [ ] **CA-001-04**: `forge agentes perfil <nombre>` muestra el perfil efectivo y de qué capa viene cada límite. (P2)

### HU-002: El motor impone el perfil, no el prompt
**Como** desarrollador
**Quiero** que un rol sin permiso de escritura no pueda escribir
**Para** no depender de que el modelo obedezca

**Criterios de aceptación:**
- [ ] **CA-002-01**: Una herramienta fuera del perfil no se ofrece al modelo (no está en el esquema) y, si el modelo la pide de todos modos, se rechaza con motivo y se anota en el diario. (P1)
- [ ] **CA-002-02**: Una ruta fuera de las legibles o escribibles del perfil se rechaza con las mismas funciones que hoy (`validarRuta`, `aplicarArchivos`), con un motivo nuevo `fuera_de_perfil`; no hay una segunda implementación de las reglas de ruta (ADR-21). (P1)
- [ ] **CA-002-03**: Los topes de contexto y de pasos del perfil son techos: el efectivo es el mínimo entre perfil, configuración global y política (`contexto_max_bytes`, `turnos_max`). (P1)
- [ ] **CA-002-04**: Falla cerrado: un perfil que no se puede resolver detiene el ciclo antes de llamar al modelo y no cae al máximo. (P1)
- [ ] **CA-002-05**: Una prueba prueba que un rol de solo lectura no puede escribir por ninguna vía (bloque, `editar`, integraciones). (P1)

### HU-003: El proyecto puede apretar, nunca aflojar
**Como** dueño del entorno
**Quiero** tres capas con un orden fijo
**Para** que un repositorio hostil no pueda ampliar lo que un agente hace

**Criterios de aceptación:**
- [ ] **CA-003-01**: Capa 1, **garantías fijas**, en código (no en un archivo editable): nadie las cambia (el modelo sin red ni credenciales, pruebas inmutables para el implementador, el rol `qa` solo escribe pruebas, veredicto por código de salida). (P1)
- [ ] **CA-003-02**: Capa 2, **política del usuario**, fuera del árbol (entorno y estado del usuario, como ADR-22 revisión 2): puede fijar un techo por rol más estricto que las garantías; **no** puede quitar una garantía fija. (P1)
- [ ] **CA-003-03**: Capa 3, **personalización del proyecto** (`agents/*.md` del proyecto, `sdd.config.yaml`): solo reduce. Cada campo del perfil efectivo es la intersección (herramientas, rutas) o el mínimo (topes) de las tres capas. (P1)
- [ ] **CA-003-04**: Un intento del proyecto de ampliar (más herramientas, más rutas, tope mayor) se ignora **y se avisa** en `forge doctor` y en el diario; no se aplica parcialmente. (P1)
- [ ] **CA-003-05**: Prueba de propiedad: para cualquier combinación de las tres capas, el perfil efectivo es subconjunto del de las garantías fijas. (P1)

### HU-004: Encaje con el implementador por turnos
**Como** mantenedor
**Quiero** que los perfiles gobiernen las cinco herramientas existentes
**Para** no crear una segunda forma de dar permisos

**Criterios de aceptación:**
- [ ] **CA-004-01**: `crearHerramientasCoder` (`herramientas-coder.js:208`) recibe el perfil resuelto y construye el conjunto de esquemas a partir de él; sin perfil explícito el resultado es idéntico al de hoy (cinco herramientas). (P1)
- [ ] **CA-004-02**: `maxPruebas` y `turnos_max` salen del perfil del implementador, acotados por la configuración. (P1)
- [ ] **CA-004-03**: El modo `bloque` aplica el mismo perfil de escritura mediante `aplicarArchivos`. (P1)
- [ ] **CA-004-04**: Un proveedor sin herramientas (`admiteHerramientas` falso) sigue degradando a `bloque` como hoy; el perfil no cambia esa decisión. (P1)

### HU-005: Los tres agentes del ciclo verificado, sin regresión
**Como** dueño
**Quiero** que `arquitecto`, `tester` y el implementador sigan produciendo el mismo resultado
**Para** no romper lo único que está verificado de punta a punta

**Criterios de aceptación:**
- [ ] **CA-005-01**: Perfil de `arquitecto` en el ciclo: sin herramientas de escritura, sin ejecución, solo el contexto que ya recibe; su salida es el plan. Equivale a lo que hace hoy (`nodos.js:307`). (P1)
- [ ] **CA-005-02**: Perfil de `tester`: escritura solo en rutas de prueba (`esRutaDePrueba`, `protocolo-archivos.js:133`), lectura del contexto actual; equivale al rol `qa` de hoy (`:290`). (P1)
- [ ] **CA-005-03**: Perfil del implementador: las cinco herramientas, escritura fuera de pruebas y de rutas protegidas, con los topes actuales. (P1)
- [ ] **CA-005-04**: **Prueba de regresión**: el ciclo verificado completo, con el proveedor de pruebas guionizado y con el Docker falso, produce los mismos archivos, huellas, eventos de diario relevantes y veredicto antes y después de la entrega, en ambos modos de implementador. Es la **primera tarea** (rojo/verde de referencia) y el criterio de fusión. (P1)
- [ ] **CA-005-05**: Cualquier diferencia de comportamiento en esos tres roles es un error de la entrega, no una consecuencia aceptable. (P1)

## 5. Escenarios de Uso

### Escenario 1: Repositorio que pide más
Un `agents/revisor.md` del proyecto declara `Write`. El perfil efectivo no la incluye; `forge doctor` lo señala.

### Escenario 2: Usuario que aprieta
Con la política del usuario, `desarrollador-backend` solo escribe bajo `src/`. El repositorio no puede cambiarlo.

### Escenario 3: Modelo que pide una herramienta que no tiene
El modelo del `arquitecto` pide `editar`. No estaba en el esquema; se rechaza, se anota y el ciclo continúa.

### Escenario 4: Ciclo verificado normal
Misma salida, mismas huellas, mismo veredicto que hoy.

### Escenario 5: Perfil mal formado
Un typo en la clave del perfil detiene el ciclo antes de gastar nada, con el archivo y la clave.

## 6. Requisitos Funcionales

| ID | Requisito | Prioridad |
|---|---|---|
| RF-01 | Formato del perfil en la definición del agente y su lector con validación estricta | P1 |
| RF-02 | Resolución de tres capas por intersección/mínimo en un solo módulo | P1 |
| RF-03 | El perfil resuelto gobierna esquemas de herramientas, rutas y topes en el ciclo | P1 |
| RF-04 | Garantías fijas en código, con una tabla por rol del ciclo | P1 |
| RF-05 | Política del usuario fuera del árbol | P1 |
| RF-06 | Aviso de intento de ampliación en `doctor` y diario | P1 |
| RF-07 | Prueba de regresión del ciclo verificado | P1 |
| RF-08 | Mostrar el perfil efectivo con su origen | P2 |

## 7. Requisitos No Funcionales

| ID | Requisito |
|---|---|
| RNF-01 | Sin dependencias nuevas (Principio IV) |
| RNF-02 | Resolución determinista y pura (Principio VI) |
| RNF-03 | Sin cambio de comportamiento sin perfil: el valor por defecto reproduce el ciclo actual |
| RNF-04 | El perfil entra en el estado del ciclo para auditoría y reanudación (Principio IX): al reanudar se usa el perfil con el que se empezó, salvo que el nuevo sea más estricto |
| RNF-05 | Windows y Linux |

## 8. Fuera de Alcance (Exclusiones Explícitas)

- Cambiar los prompts o el contenido de los agentes (`docs/ADECUACION-DEL-CATALOGO.md` C1-C4).
- Añadir o retirar agentes (ítem 12 y 13 de la adecuación).
- Perfil de las skills (`allowed-tools` de skills es otro mecanismo; oleada C1).
- Delimitar contenido hostil y control de salida: `2026-10-14-defensa-inyeccion-y-fuga`.
- Los ganchos de Claude Code (`claude-hooks/pre-tool-guard.js`): son el modo plugin; se coordinan en el spike S0.3 pero no se reescriben aquí.
- Perfiles dinámicos o aprendidos.

## 9. Dependencias y Asunciones

### Spikes obligatorios antes de construir
- **S0.1** Inventario de lo que cada uno de los tres roles del ciclo hace hoy realmente: qué lee, qué escribe, qué recibe, con archivo:línea (`nodos.js:307,366,482`, `turnos.js:161`). Salida: tabla que sirve de perfil de referencia.
- **S0.2** Qué soporta `parseFrontmatter` de `agent-registry.js`: valores anidados o solo listas simples (**sin confirmar**). Decide si el perfil va en la cabecera o en un archivo hermano por agente.
- **S0.3** Cómo se cargan los agentes del proyecto frente a los del plugin (`createAgentRegistry(forgeRoot)`, `agent-registry.js:329`; **sin confirmar** si un proyecto puede aportar sus propios `agents/*.md`) y cómo se relaciona con `READ_ONLY_AGENTS` del gancho.
- **S0.4** Cómo se reanuda un ciclo con un perfil distinto del original (estado y diario).

### Dependencias
- `core/agent-registry.js`, `core/ciclo/{nodos,turnos,herramientas-coder,protocolo-archivos,config}.js`, `claude-hooks/pre-tool-guard.js`, ADR-21, ADR-22 (revisión 2), `docs/ADECUACION-DEL-CATALOGO.md` §4 y §6.

### Asunciones
- (sin confirmar) Que ninguna cabecera `tools:` actual se usa con efecto en el ciclo; S0.1 lo confirma.
- Que el rol `qa` y el rol `coder` de `aplicarArchivos` se corresponden con los perfiles de `tester` y de implementador sin ambigüedad (se ve en el código: `:290,294`).

## 10. Capas de seguridad

| Capa | Quién la cambia | Contenido | Dónde vive |
|---|---|---|---|
| 1. Garantías fijas | Nadie | Techo por rol del ciclo; código generado solo en contenedor sin red; pruebas inmutables para el implementador; `qa` solo escribe pruebas; modelo sin red ni credenciales | Código (`core/ciclo/perfiles.js`, nuevo) |
| 2. Política del usuario | El usuario, en su entorno | Techos más estrictos por rol; destinos y rutas permitidas | Entorno y estado del usuario fuera del árbol |
| 3. Personalización | El proyecto | Reducir herramientas, rutas y topes | `agents/*.md` y `sdd.config.yaml` |

**Resolución:** `efectivo = capa1 ∩ capa2 ∩ capa3` en herramientas y rutas; `min(capa1, capa2, capa3)` en topes. Una capa ausente no restringe pero tampoco concede: el techo lo pone la 1.

| Riesgo | Control |
|---|---|
| El repositorio amplía permisos desde `agents/*.md` | Solo intersección; la ampliación se ignora y se avisa |
| `CLAUDE_AGENT_NAME` ausente desactiva los guardias del gancho | Fuera de esta spec; el ciclo propio no depende de ello; se documenta (sin cambio del gancho) |
| Un perfil mal formado cae al máximo | Falla cerrado (CA-002-04) |
| Reanudar con un perfil más laxo | Se conserva el original salvo que el nuevo sea más estricto (RNF-04) |
| Segunda implementación de reglas de ruta | CA-002-02: mismas funciones |

### Lo que NO se garantiza
- Que un rol con escritura permitida no escriba código dañino dentro de su perfil: el perfil limita **dónde** y **con qué**, no **qué**; eso lo cubre `2026-10-14-defensa-inyeccion-y-fuga` y las pruebas.
- Que la cabecera `tools:` describa lo que el modo plugin de Claude Code hace: ahí gobierna Claude Code, no el motor.

## 11. Términos del Dominio

- **Perfil:** conjunto de herramientas, rutas y topes de un rol.
- **Garantía fija:** límite en código que ninguna capa superior puede quitar.
- **Efectivo:** resultado de intersectar las tres capas.

## 12. Preguntas Abiertas

| # | Pregunta | Recomendación |
|---|---|---|
| 1 | ¿Perfil en la cabecera del agente o en archivo aparte? | En la cabecera si S0.2 muestra que el lector admite estructura; si no, un `perfil` hermano por agente. Lo importante: que viaje con el rol |
| 2 | ¿Qué hace un agente sin perfil? | Perfil mínimo del rol; nunca el máximo |
| 3 | ¿`tools:` actual: se reinterpreta o se migra? | Se reinterpreta como solicitud (CA-001-03) y se deja de usar la palabra «permiso» en su documentación |
| 4 | ¿Se incluye en la primera entrega el aviso en `doctor`? | Sí: sin aviso, una ampliación ignorada es silenciosa |
| 5 | ¿Cuántos agentes en la primera entrega? | Solo los tres del ciclo verificado con prueba de regresión; el resto del catálogo en una segunda entrega (C5 completo) |
| 6 | ¿La política del usuario es por entorno o archivo? | Archivo en el estado del usuario (como la cola de ADR-22), con variable para ubicarlo |
| 7 | ¿Se unifica el gancho `READ_ONLY_AGENTS` con los perfiles? | Después: leer la misma fuente, en una entrega aparte con su revisión |

## 13. Criterios de Éxito Medibles

- Prueba de regresión del ciclo verificado idéntica antes y después, en `bloque` y `turnos`.
- Propiedad: el efectivo siempre es subconjunto de las garantías fijas, en miles de combinaciones generadas.
- Un rol de solo lectura no puede escribir por ninguna vía (prueba).
- Cero ampliaciones aplicadas desde el proyecto.
- Revisión independiente sin hallazgos altos abiertos.

## 14. Referencias

- `PLAN-MAESTRO.md` (frente C, §6 regla de las tres capas).
- `docs/ADECUACION-DEL-CATALOGO.md` §4, §5 (C5) y §6.
- `docs/investigacion/FABRICAS-MULTIAGENTE.md`, `docs/investigacion/ESTANDARES-DE-INGENIERIA.md` (líneas 31 y 88: mínimo privilegio como tema de la guía OWASP Agentic; detalle no verificado).
- `.sdd/arquitectura/ADR-21`, `ADR-22` (revisión 2).
- `.sdd/memoria/constitucion.md` (Principios II, V, VI, IX).

## 15. Historial de Aclaraciones

- 2026-10-14: creada en borrador por un agente por encargo del dueño. Hechos del código comprobados el mismo día; los marcados «sin confirmar» no se verificaron.

## Qué necesita revisión independiente

1. La prueba de regresión del ciclo verificado: que de verdad compare lo que importa (archivos, huellas, veredicto, diario) y no solo «termina».
2. La resolución de capas: que ninguna combinación afloje una garantía (propiedad) y que la capa 2 no pueda ser fabricada por el repositorio.
3. La reanudación con un perfil distinto.
4. Que no quede una segunda implementación de reglas de ruta.
5. Que el aviso de ampliación ignorada no sea ocultable por el proyecto.
