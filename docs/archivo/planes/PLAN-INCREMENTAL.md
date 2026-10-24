# Plan incremental — qué tomar de herramientas parecidas y por dónde empezar

> **Fecha:** 2026-10-13 · **Rama:** `feature/motor-agentico` · **Detalla a:** `PLAN-ESCALADO.md`
> Investigación en fuentes primarias (páginas oficiales y repositorios, consultadas el 2026-10-13) de las herramientas parecidas a FORGE, lo que conviene tomar de cada una, y un plan por incrementos pequeños para empezar a ejecutar.
> Nada de este plan está implementado. Las duraciones son estimaciones.

## 1. Conclusión

1. **El camino barato para ser agnóstico de herramienta ya está medio hecho.** FORGE tiene 31 skills en el formato abierto `SKILL.md`, que hoy admiten más de 40 herramientas, y ya genera `AGENTS.md`. Lo que lo ata a Claude Code es el instalador, que escribe siempre en `.claude/` (`cli/index.js:87`), y los 39 comandos en formato propio.
2. **Nadie de los revisados anuncia lo que FORGE ya tiene.** En las páginas consultadas de Spec Kit, OpenSpec, BMAD y Kiro no aparece ejecución aislada obligatoria ni tope de gasto. Es la diferencia a proteger y a ofrecer por separado.
3. **Lo que más conviene tomar** son tres ideas: instalación por clave de integración (Spec Kit), verificación con el comando de pruebas del usuario (Aider) y oleadas de tareas en paralelo (Kiro), que FORGE ya calcula y no usa en el ciclo.

**Límite de esta investigación:** se leyó una página por herramienta. «No aparece» significa que no está en esa página, no que la herramienta no lo tenga.

## 2. Qué hace cada una y qué tomar

| Herramienta | Qué es (fuente primaria) | Qué tomar | Qué ya tiene FORGE |
|---|---|---|---|
| **Spec Kit** (GitHub), 141 mil estrellas | Flujo `constitution → specify → plan → tasks → implement → converge`; 41 herramientas más una opción genérica; cada una con una clave de integración. Extensiones, presets y paquetes | Instalación con `--integration <clave>` y un `generic` para las no listadas; un andamio que crea la integración con su prueba; repetir «implementar y converger» hasta un veredicto | Constitución, flujo equivalente, presets, exportación a Spec Kit |
| **OpenSpec**, 72 mil estrellas | Una carpeta por cambio (`proposal.md`, `specs/`, `design.md`, `tasks.md`); requisitos como deltas («ADDED») con escenarios WHEN/THEN; al archivar, el cambio se funde en la especificación viva. Perfil por defecto de 4 comandos y perfil ampliado. Más de 30 herramientas | Perfil corto de comandos; deltas por cambio y archivado; que el instalador imprima la forma de invocar según la herramienta | Carpeta por especificación en `.sdd/especificaciones/`, exportación a OpenSpec |
| **BMAD**, 54 mil estrellas | Roles de producto, arquitectura, UX, desarrollo y pruebas; el proceso se ajusta al tamaño del cambio; módulo «Loop» que construye y verifica una épica sin supervisión. La versión 7 se instala como skills | Camino corto para cambios pequeños | 14 agentes por rol; el ciclo ya construye y verifica con tope de gasto |
| **Kiro** (AWS) | `requirements.md`, `design.md`, `tasks.md`; especificación de corrección de errores con «comportamiento que no cambia»; al ejecutar todo, agrupa tareas independientes en **oleadas** concurrentes. Pruebas basadas en propiedades derivadas de requisitos EARS, con reducción del contraejemplo | Oleadas en paralelo; propiedades derivadas de los criterios de aceptación; plantilla de corrección con «lo que no debe cambiar» | `_topologicalLevels` ya calcula las oleadas (`core/orchestrator.js:50`); la mutación mide la calidad de las pruebas por otra vía |
| **Aider** | `--test-cmd` con `--auto-test`: ejecuta el comando del usuario tras cada edición; salida distinta de cero es fallo y se intenta corregir | Verificar con **el comando de pruebas que ya tiene el proyecto**, sin exigir el flujo entero | El enrutador ya decide por código de salida, pero dentro de Docker |
| **OpenHands** | SDK, servidor de agentes con API REST y WebSocket, servidor de sandbox aparte y cliente web; gestión de presupuesto en la versión en la nube | Separar servidor de agentes y servidor de sandbox cuando llegue la etapa de servicio | API HTTP local y sandbox en el mismo proceso |
| **Tessl** | Se conecta a los agentes existentes por MCP; registro de skills con análisis de seguridad. Datos de reseñas de terceros, no de su web | Ofrecer las capacidades por MCP en vez de sustituir a la herramienta del usuario | Servidor MCP con tres herramientas |
| **Estándar AGENTS.md** | Formato abierto bajo la Linux Foundation; más de 60 mil proyectos; lo leen Codex, Cursor, Copilot, Gemini CLI, Aider, Zed y otros | Mantenerlo como la entrada común | `core/agents-md.js` ya lo genera |
| **Estándar Agent Skills** | Carpeta con `SKILL.md` (nombre y descripción como mínimo); carga progresiva; creado por Anthropic y abierto; lo admiten Claude Code, Codex, Cursor, Copilot, Gemini CLI, Kiro, OpenHands y decenas más | Publicar las capacidades de FORGE como skills, también los comandos | 31 skills con `SKILL.md` |

## 3. Lo que FORGE no debe copiar

| Tentación | Por qué no |
|---|---|
| Competir en número de herramientas soportadas | Spec Kit tiene 41; el formato de skills ya da ese alcance sin mantener un adaptador por herramienta |
| Añadir más comandos | OpenSpec funciona con 4 por defecto; FORGE tiene 39 y eso es una barrera de entrada |
| Bucles sin supervisión sin límites | Es justo donde el tope de gasto y la aprobación humana diferencian a FORGE |
| Servicio en la nube | Contradice el Principio III y no hay usuarios que lo pidan |

## 4. Riesgo de nombre

La lista de integraciones de Spec Kit incluye una herramienta llamada **«Forge»** con la clave `forge`. El README de FORGE ya avisa de que `npx forge` descarga otro paquete. El comando `forge` y el nombre del proyecto chocan con otros productos. **Es una decisión del dueño** antes de publicar: mantener `forge` como comando, o usar `sdd-es`, que ya existe como alias en `package.json`.

## 5. Incrementos

Cada incremento es pequeño, se puede fusionar solo y deja el proyecto funcionando. Los tres primeros no gastan en modelos.

| # | Incremento | Tomado de | Reutiliza | Criterio de hecho | Estimación |
|---|---|---|---|---|---|
| **I0** | Abrir la solicitud de cambio y dejar la integración continua en verde | — | — | Los tres jobs pasan en Linux | Dueño |
| **I1** | **Instalación por integración.** `forge init --integracion <clave>` con una tabla de destinos y una opción `generica` | Spec Kit | `copiarSeguro` y la copia de skills de `cli/index.js` | Las 31 skills se instalan en la carpeta correcta de al menos tres herramientas y en una carpeta genérica; el instalador imprime cómo invocarlas; sin la opción, todo sigue igual que hoy | 2–3 días |
| **I2** | **Comandos como skills y perfil corto.** Una sola fuente genera el comando de Claude Code y la skill; perfil por defecto de 5 comandos, perfil completo opcional | OpenSpec, BMAD | `commands/`, `skills/`, `presets/` | Los 39 comandos existen como skills generadas; una prueba falla si las dos formas divergen | 3–4 días |
| **I3** | **`forge verificar`.** Ejecuta el comando de pruebas del proyecto en el sandbox y devuelve veredicto, sin llamar a ningún modelo | Aider | Sandbox, enrutador, mutación | Funciona en un proyecto que nunca usó FORGE; salida 0, 1 o 4 como `forge run`; mide mutación si se pide | 3–5 días |
| **I4** | **Conformidad de proveedores y OpenAI con herramientas** (E1.1, E1.2) | — | `provider-interface.js`, `stub-provider.js` | Una suite común pasa con los cuatro proveedores; el implementador por turnos completa una tarea contra un servidor falso | 4–5 días |
| **I5** | **Gasto fuera de Anthropic y niveles neutrales** (E1.4, E1.5) | — | `core/precios.js`, `modelos:` | Coste cero solo si se declara; aviso de modelo sin precio; `alto`, `medio` y `economico` equivalen a los alias actuales | 2 días |
| **I6** | **Validación con un segundo proveedor real** (E1.6) | — | `scripts/pruebas-independientes.mjs` | Tres proyectos en éxito; evidencia registrada | Dueño: clave y presupuesto |
| **I7** | **El ciclo por MCP** (E2.2) y su revisión de seguridad | Tessl | `core/mcp/` | Un cliente MCP lanza, consulta y decide; pasa una revisión independiente | 5 días más revisión |
| **I8** | **Contrato público versionado** (E2.1) | — | `core/ciclo/estado.js`, `core/tareas.js` | Esquemas en `docs/contrato/` y una prueba que los compara con el código | 3 días |
| **I9** | **Plantilla de corrección con «lo que no debe cambiar»** | Kiro | `plantillas/` | La plantilla existe y el agente de pruebas genera pruebas de regresión a partir de ella | 2 días |
| **I10** | **Oleadas en paralelo en el ciclo** (E3) | Kiro | `core/orchestrator.js`, `core/sandbox/staging.js` | Ver `PLAN-ESCALADO.md` E3; requiere especificación, ADR y revisión | 3–5 semanas |
| **I11** | **Propiedades derivadas de los criterios de aceptación** (experimental) | Kiro | Agente de pruebas, mutación | Un experimento medido: ¿detectan más que las pruebas por ejemplos? | Por decidir |

### Orden y motivo

1. **I1, I2, I3** primero: hacen a FORGE usable desde otras herramientas y sin su flujo completo, no cuestan dinero y no tocan el ciclo validado.
2. **I4, I5** después: preparan el segundo proveedor sin gastar.
3. **I6, I7** necesitan al dueño: gasto real y una superficie de ataque nueva.
4. **I8, I9** en cualquier momento.
5. **I10, I11** solo con usuarios reales de la beta.

### Antes de programar I1

Hay que confirmar en la documentación de cada herramienta la carpeta exacta donde lee las skills. Esta investigación solo confirmó, por la página de Spec Kit, que Copilot usa `.github/skills/` y que Codex y Zed usan `.agents/skills`. Las demás rutas no están verificadas.

## 6. Especificaciones creadas

Los incrementos se llevan por el ciclo de especificaciones del proyecto. Las tres primeras están redactadas **en borrador**: ninguna se implementa hasta que el dueño la apruebe (Principio II).

| Especificación | Incrementos | Tamaño | Gasta en modelos | Necesita revisión independiente |
|---|---|---|---|---|
| `2026-10-13-instalacion-agnostica` | I1, I2 | mediano | No | No (escritura segura ya revisada; se reutiliza) |
| `2026-10-13-verificar-sin-modelo` | I3 | mediano | No | Sí: aislamiento y proyectos de terceros |
| `2026-10-13-proveedores-agnosticos` | I4, I5, I6 | mediano | Solo I6, con clave del dueño | Sí: gasto y credenciales |

Cada carpeta tiene `spec.md` (historias y criterios de aceptación), `plan.md` (módulos, fases, riesgos) y `tareas.md` (spikes primero, prueba antes que código).

### Orden de ejecución propuesto

| Paso | Qué | Quién | Depende de |
|---|---|---|---|
| 1 | Aprobar o corregir las tres especificaciones y responder sus preguntas abiertas | Dueño | — |
| 2 | Abrir la solicitud de cambio de `feature/motor-agentico` y dejar la integración continua en verde | Dueño | — |
| 3 | Spikes S0 de las tres especificaciones, en paralelo: son solo lectura | Agentes | 1 |
| 4 | `instalacion-agnostica` F1 a F3 y `verificar-sin-modelo` F1 y F2, en ramas separadas | Agentes | 3 |
| 5 | `proveedores-agnosticos` F1 y F2 | Agentes | 3 |
| 6 | Resto de fases, revisiones independientes y verificación | Agentes | 4, 5 |
| 7 | Validación con un segundo proveedor real | Dueño y agentes | 5 |

Las tres especificaciones tocan archivos distintos salvo `cli/index.js`: se trabajan en ramas separadas y se integran una a una, con la suite completa entre medias.

### Especificaciones previstas, sin redactar

| Especificación | Incrementos | Por qué espera |
|---|---|---|
| El ciclo por MCP | I7 | Abre una superficie de ataque nueva; conviene tener antes `forge verificar` |
| Contrato público versionado | I8 | Mejor cuando `verificar` fije la primera forma de resultado |
| Corrección con «lo que no debe cambiar» | I9 | Pequeña; cuando haya hueco |
| Oleadas en paralelo en el ciclo | I10 | Toca garantías revisadas; con usuarios de la beta |
| Propiedades desde criterios de aceptación | I11 | Experimento |

## 7. Reglas de ejecución

Las mismas que en `PLAN-EJECUCION-FINAL.md`: un incremento por rama; se sube solo con la suite en 0 fallos y los tipos en 0; no se ejecuta la suite completa en paralelo; lo que toca seguridad, gasto o aislamiento pasa por una revisión independiente; publicar y gastar son decisiones del dueño.

## 8. Fuentes

Consultadas el 2026-10-13.

- Spec Kit: https://github.com/github/spec-kit
- Spec Kit, integraciones: https://github.com/github/spec-kit/blob/main/docs/reference/integrations.md
- OpenSpec: https://github.com/Fission-AI/OpenSpec
- BMAD: https://github.com/bmad-code-org/BMAD-METHOD
- Kiro, specs: https://kiro.dev/docs/specs/
- Kiro, corrección: https://kiro.dev/docs/specs/correctness/
- Aider, lint y pruebas: https://aider.chat/docs/usage/lint-test.html
- OpenHands: https://docs.openhands.dev/
- AGENTS.md: https://agents.md/
- Agent Skills: https://agentskills.io/
- Tessl (reseñas de terceros): https://codemyspec.com/blog/tessl-review y https://rywalker.com/research/tessl
