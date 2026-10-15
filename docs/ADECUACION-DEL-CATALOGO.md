# Adecuación del catálogo de agentes, skills y comandos

> **Fecha:** 2026-10-14 · **Rama:** `feature/motor-agentico`
> Cruza el inventario (`docs/INVENTARIO-AGENTES-Y-SKILLS.md`) con tres investigaciones de la industria (`docs/investigacion/`): fábricas multiagente, skills y estándares, y estándares de ingeniería. Propone cambios **ordenados por riesgo**, con lo que hay que comprobar antes de cada uno.
> Las investigaciones leyeron una página por fuente; lo que cada informe marca como «no verificado» se mantiene así aquí. Nada de este plan está implementado.

## 1. Conclusión

1. **Fragua no tiene un problema de roles: tiene un problema de higiene del catálogo y de contención.** Los 14 agentes cubren casi todos los roles que usa la industria; lo que falla son cabeceras incompletas, solapamientos, permisos de más y controles que solo existen como texto del prompt.
2. **La corrección más rentable es mecánica:** completar `name` y `description` en 25 skills y poner una prueba que impida que vuelva a pasar.
3. **Fusionar y borrar es más caro de lo que parece:** el catálogo está referenciado desde el motor (`core/evaluator-optimizer.js`), los tres presets, el manifiesto y varios comandos. Cada fusión es una pequeña migración con prueba, no un borrado.
4. **No añadir agentes por añadir.** La evidencia consultada (Anthropic, Cognition) es que un sistema multiagente cuesta del orden de 15 veces los tokens de un chat y rinde peor en código con contexto compartido. Un rol nuevo solo entra si cierra un hueco medido.
5. **Lo que más separa a Fragua del resto sigue siendo lo que no es un agente:** el veredicto determinista, el aislamiento, el tope de gasto y la aprobación humana. El catálogo debe reforzarlo, no diluirlo.

## 2. Qué dice la industria, en lo que importa aquí

| Tema | Hallazgo (fuente en `docs/investigacion/`) | Efecto en Fragua |
|---|---|---|
| Coste de los multiagentes | Del orden de 15× tokens frente a un chat (Anthropic, sistema de investigación) | Más agentes por defecto no es mejor; medir antes de añadir |
| Paralelismo en código | Decisiones implícitas que chocan entre agentes (Cognition) | Backend y frontend siguen en secuencia; paralelizar solo lectura (investigación, revisión, seguridad) |
| Evaluador–optimizador | Exige criterios distintos y claros entre evaluadores | `revisor` y `crítico` necesitan fronteras explícitas |
| Controles | Los que valen son los deterministas (ganchos antes de usar una herramienta, listas cerradas de herramientas), no los del texto del prompt | Pasar la contención de «dice el prompt» a «lo impide el motor» |
| Skills | `name` y `description` obligatorios; la descripción decide cuándo se activa; cuerpos cortos y material en archivos aparte | 22 skills sin `name`, 3 sin `description`, 12 comandos de más de 250 líneas |
| Evidencia de verificación | NIST SP 800-218A (perfil de IA generativa) y SLSA piden trazabilidad y procedencia | La evidencia de `verificar` no incluye todavía hashes, imagen ni identidad de modelo (spec `puertas-de-calidad-y-evidencia`) |
| Gobierno | Un estándar de gobierno de agentes aún no ha cuajado; OWASP publicó el Top 10 de agentes en 2025-12 | Mantener la guía OWASP como referencia y no prometer conformidad con un estándar |

## 3. Decisiones sobre las recomendaciones de la investigación

| # | Recomendación investigada | Decisión | Motivo |
|---|---|---|---|
| 1 | Completar `name`/`description` en las skills | **Hacer ya** | Mecánico, sin riesgo, exigido por la especificación abierta |
| 2 | Validador del catálogo en la suite | **Hacer ya** | Es lo que evita que el problema vuelva |
| 3 | Ganchos `PreToolUse` en agentes con `Bash` y `Write` | **Hacer, con matiz** | Es un control determinista y vale, pero es una función de Claude Code: no cubre a otras herramientas. La garantía real sigue siendo el sandbox |
| 4 | Fijar `maxTurns` y la profundidad de subagentes | **Hacer, tras verificar** | El investigador no leyó la parte final de la documentación de subagentes; confirmar nombres y semántica antes de escribirlos |
| 5 | Quitar `Bash` a roles de solo lectura | **Decidir por agente** | `revisor` y `seguridad` pueden necesitarlo para ejecutar pruebas o análisis; `arquitecto` es el planificador del ciclo verificado. Ver §4 |
| 6 | Fusionar `arquitecto` y `architecture-designer` | **Delimitar, no fusionar** | `arquitecto` es parte del ciclo verificado; `architecture-designer` está en motor, presets y manifiesto. Se deja el límite por escrito en las dos descripciones |
| 7 | Delimitar `revisor` y `crítico` | **Hacer** | Barato; evita el doble coste |
| 8 | Consolidar las 4 skills de enrutado | **Aplazar** | Las usan `sdd.planificar`, `sdd.optimizar`, `sdd.implementar` y `sdd.crear-agente`; la propia investigación apunta a sustituirlas por reglas deterministas. Es una especificación, no un ajuste |
| 9 | Eliminar duplicados (`deploy-vercel`/`vercel-deploy`, `indexador`/`indexar-proyecto`) y `compresion-tokens` | **Hacer con migración** | Cada una está referenciada por un comando distinto; elegir una, redirigir y probar |
| 10 | Política de modelo (6 agentes en `opus`) | **Documentar y medir** | Sin medición no se cambia; hoy el nivel se acota con `motor.nivel_maximo` |
| 11 | Hueco de roles: depuración, rendimiento, accesibilidad, cumplimiento | **Skills, no agentes** | Cada una como skill de carga bajo demanda; solo `cumplimiento` y `seguridad` se acoplan a la evidencia |
| 12 | No añadir agente «manager» | **De acuerdo** | El orquestador es el motor determinista, no un agente |
| 13 | Evaluar con ~20 casos y un juez de rúbrica antes de añadir o quitar agentes | **Hacer** | Es la única forma honesta de decidir sobre el catálogo |

## 4. Mínimo privilegio por rol (propuesta, no aplicada)

> **Corrección tras comprobarlo en el código (2026-10-14).** La lista `tools:` de la cabecera de un agente se lee en `core/agent-registry.js:102` y **no se usa en ningún otro punto del motor**. En el ciclo verificado el modelo no recibe `Bash` ni `Write`: recibe texto y un protocolo de archivos (modo bloque) o las cinco herramientas propias de `core/ciclo/herramientas-coder.js` (modo turnos). Por tanto, quitar `Bash` de una cabecera **solo cambia el flujo interactivo de Claude Code**, que es quien lo impone; no cambia lo que el ciclo permite. Y el gancho de agentes de solo lectura de `claude-hooks/pre-tool-guard.js` se desactiva si el entorno no trae `CLAUDE_AGENT_NAME` (aviso en `pre-tool-guard.js:215`).
> La contención real del ciclo está en el protocolo de archivos y en el sandbox, no en las cabeceras. Convertir las cabeceras en una garantía del motor es el objeto de la especificación `2026-10-14-perfiles-de-agente`.

Regla: **cada agente declara las herramientas que necesita su rol y nada más**, y lo que se declara debe imponerlo el motor, no el prompt ni solo la herramienta anfitriona.

| Rol | Herramientas hoy | Propuesta | Condición para aplicarla |
|---|---|---|---|
| `critico`, `investigador`, `asesor-datos` | `Read, Grep, Glob, Bash` | Quitar `Bash` | Revisar que su texto no pida ejecutar nada |
| `revisor` | `Read, Grep, Glob, Bash` | Mantener `Bash` solo si ejecuta pruebas; si no, quitarlo | Leer su texto; decidir con una prueba |
| `seguridad` | `Read, Grep, Glob, Bash` | Mantener, con gancho que bloquee escritura y red | Depende de la spec `perfiles-de-agente` |
| `arquitecto` | `Read, Grep, Glob, Bash` | **Es el planificador del ciclo verificado**: cualquier cambio exige prueba del ciclo | Prueba de regresión del ciclo |
| `tester` | `Read, Write, Grep, Glob, Bash` | Mantener; es parte del ciclo; limitar `Write` a las rutas de pruebas | Spec `perfiles-de-agente` |
| `desarrollador-*`, `operaciones`, `disenador-api`, `documentador` | `Read, Write, Grep, Glob, Bash` | Añadir `Edit` y gancho de rutas | Spec `perfiles-de-agente` |

## 5. Plan por oleadas

| Oleada | Qué | Riesgo | Quién | Salida verificable |
|---|---|---|---|---|
| **C1. Higiene** | `name` en 22 skills; `description` en 3; descripciones cortas (4) ampliadas; modelo en alias o ausente (nunca identificador completo); `allowed-tools` explícito en las 17 que no lo tienen; prueba del catálogo | Bajo | Agente | `tests/catalogo.test.js` en verde; el inventario sin hallazgos H1, H2, H4, H5 |
| **C2. Fronteras** | `revisor`/`crítico` y `arquitecto`/`architecture-designer` con límites en la descripción; política de modelo documentada | Bajo | Agente | Descripciones sin solapamiento; prueba del catálogo comprueba que cada par se excluye |
| **C3. Duplicados** | Elegir `deploy-vercel` o `vercel-deploy`, `indexador` o `indexar-proyecto`; redirigir comandos y manifiesto; retirar `compresion-tokens` | Medio | Agente + revisión | Ningún comando referencia una skill inexistente (prueba) |
| **C4. Comandos largos** | Los 12 de más de 250 líneas: cuerpo corto y material a archivos de apoyo, empezando por `sdd.implementar` (679) | Medio | Agente | Mismo comportamiento; prueba de que cada referencia a un archivo de apoyo existe |
| **C5. Mínimo privilegio** | Aplicar §4: cabeceras mínimas para el flujo de Claude Code y, aparte, perfiles que imponga el motor (spec `perfiles-de-agente`) | **Alto** | Agente + revisión independiente | Pruebas de que un rol de solo lectura no puede escribir |
| **C6. Evaluación** | ~20 casos con rúbrica para decidir sobre roles y modelo | Medio | Agente + dueño | Informe con medición, no opinión |
| **C7. Skills nuevas** | Depuración, rendimiento, accesibilidad, cumplimiento | Medio | Agente | Cada una con casos de activación y evidencia |

### Política de modelo actual (documentada en C2, sin cambios)

Fuente: campo `model` de `agents/*.md`. Todos usan alias, nunca identificador completo. El nivel real se acota con `motor.nivel_maximo`; no se ha medido aún si algún `opus` podría ser `sonnet` (eso es C6).

| Agente | Modelo | Por qué (criterio declarado en su cabecera) |
|---|---|---|
| `arquitecto` | opus | Decisiones de alto nivel y contratos; un error aquí se propaga a todo el ciclo |
| `asesor-datos` | opus | Los errores de esquema son costosos de revertir |
| `critico` | opus | Encontrar puntos ciegos requiere abstracción |
| `revisor` | opus | La revisión profunda atrapa más bugs |
| `seguridad` | opus | Vulnerabilidades reales con impacto; el falso negativo es caro |
| `product-designer` | opus | Genera el diseño de producto completo del que depende lo demás |
| `architecture-designer` | sonnet | Recomendación de stack simple y acotada |
| `desarrollador-backend` | sonnet | Implementación siguiendo patrones existentes |
| `desarrollador-frontend` | sonnet | Implementación siguiendo patrones existentes |
| `disenador-api` | sonnet | Contratos acotados por la spec |
| `documentador` | sonnet | Documentación acotada; desactivado por defecto |
| `investigador` | sonnet | Recopilación de contexto, más amplitud que profundidad |
| `operaciones` | sonnet | Configuración de CI/CD acotada |
| `tester` | sonnet | Generación de pruebas con el framework detectado |

Resumen: 6 en `opus` (razonamiento y riesgo), 8 en `sonnet`, ninguno en `haiku`. `haiku` solo lo piden skills mecánicas (`cache-audit`, `effort-router`, `token-budget`, `observabilidad-consumo` y las cuatro de indexado/memoria).

C1 y C2 no tocan el motor ni los agentes que forman parte del ciclo verificado. C5 sí, y por eso va con revisión independiente.

## 6. Lo que NO se cambia

- Los tres agentes del ciclo verificado (`arquitecto`, `tester` y el implementador de cada tarea) no se tocan fuera de C5, y C5 va con prueba de regresión del ciclo.
- Los nombres de los comandos `sdd.*`: son interfaz pública (y hay 39 skills generadas con su nombre).
- Los 14 agentes no se reducen: no hay evidencia propia de que sobren; se delimitan.

## 7. Decisiones del dueño

| Decisión | Recomendación |
|---|---|
| ¿Quitar `Bash` a `critico`, `investigador` y `asesor-datos`? | Sí, tras comprobar su texto (C5) |
| ¿Qué skill de despliegue se conserva, `deploy-vercel` o `vercel-deploy`? | La que invoque más caminos; decidirlo con la prueba de referencias (C3) |
| ¿Se acepta que el catálogo tenga un validador que bloquee la suite? | Sí: es lo que evita la regresión |
| ¿Se añaden las skills de la oleada C7 antes o después de la beta? | Después: no son parte de la promesa central |
| ¿Se evalúa con un juez de rúbrica (gasto en modelos)? | Sí, con tope bajo, antes de tocar los roles del ciclo |

## 8. Fuentes

Documentos de esta carpeta, con las URL y fechas de consulta de cada uno:

- `docs/investigacion/FABRICAS-MULTIAGENTE.md`
- `docs/investigacion/SKILLS-Y-ESTANDARES.md`
- `docs/investigacion/ESTANDARES-DE-INGENIERIA.md`
- `docs/INVENTARIO-AGENTES-Y-SKILLS.md` (generado con `scripts/inventario-agentes.mjs`)

**No verificado en las investigaciones:** la lista de los 10 riesgos de OWASP Agentic, DORA 2025, ASVS, SAMM, ISO 25010 y 42001, OpenHands, los roles clásicos de BMAD y los nombres exactos de los ajustes de subagentes de Claude Code leídos por el investigador solo en parte.
