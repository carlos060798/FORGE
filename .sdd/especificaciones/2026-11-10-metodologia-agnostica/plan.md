# Plan de implementación: Metodología agnóstica del anfitrión

> Spec: `spec.md` · Estado: **en implementación** (aprobada por delegación del dueño el 2026-11-11, pendiente de ratificación) · Plan general: `docs/PLAN-AGNOSTICO.md` (secciones 3 y 8). Sin ADR nuevo: la decisión de adaptar al instalar, sin tocar las fuentes, está en la pregunta abierta 1 de la spec.

## 1. Decisión de diseño

Las fuentes de `commands/`, `agents/` y `skills/` no cambian. La adaptación a otra herramienta se hace **al instalar**, con funciones puras, para que lo que recibe Claude Code quede igual (prueba de equivalencia de `init`). La alternativa del plan general (fuente neutral con tokens `{{cmd:...}}`) queda diferida hasta que la prueba manual (F5) muestre qué falla en la práctica.

## 2. Módulos

| Módulo | Responsabilidad | Estado |
|---|---|---|
| `core/instalacion/adaptar-anfitrion.js` | `adaptarCuerpo`, `adaptarSkill`, `agenteARol`, `notaDeAnfitrion`, prefijo de invocación por integración | Hecho |
| `cli/comandos/instalar.js` | Aplica la adaptación a skills propias y generadas; instala los roles `rol-*`; mensaje final con lo no instalado | Hecho |
| `core/instalacion/hooks-anfitrion.js` | `traducirEvento` y plantillas de hook de Cursor, Copilot, Gemini y Codex | Hecho (F3, fuera de las HU de esta spec) |
| `cli/comandos/guardian.js` | `fragua guardian evaluar [--anfitrion]`, `fragua memoria registrar` | Hecho (F3) |
| Adaptador de memoria por herramienta | Registrar memoria de agentes fuera de Claude Code | En curso, otro agente; sin evidencia todavía |
| Agentes en formato nativo de cada herramienta | Salida nativa además del rol `rol-*` | En curso, otro agente; sin evidencia todavía |
| Herramienta MCP consultiva `guardian_evaluar` | Vía para herramientas sin hooks | En curso, otro agente; sin evidencia todavía (choca con el perfil `verificacion`, que expone solo `verificar`) |

## 3. Fases (de `docs/PLAN-AGNOSTICO.md`)

| Fase | Contenido | Estado |
|---|---|---|
| F0 | Spikes de agentes, hooks y argumentos | Hecha: `spikes/agentes-hooks-argumentos.md` (resúmenes de WebFetch, no copia literal) |
| F1 | Comandos y skills con la sintaxis de la herramienta | Hecha en su versión práctica (adaptar al instalar) |
| F2 | Agentes como roles `rol-*`, mensaje final, `doctor` | Hecha |
| F3 | Guardián y memoria fuera de los hooks de Claude Code | Parcial: guardián hecho; memoria, agentes nativos y MCP en curso |
| F4 | `doctor` por proveedor, metadatos, cabeceras de skills | Hecha; el `model:` de agentes y presets no se cambia (alias equivalentes en `core/llm-providers/niveles.js`) |
| F5 | Prueba manual por herramienta | **La hace el dueño**; pendiente |
| F6 | Documentación (`docs/ANFITRIONES.md`, README, estado, hoja de ruta, changelog) | Hecha |

## 4. Orden

1. Pruebas de adaptación y de roles (`tests/instalacion-anfitrion.test.js`) antes del instalador.
2. Instalador y mensaje final.
3. Guardián por CLI y adaptadores de hook, con pruebas propias.
4. Documentación al día en cada paso.
5. F5 a mano, en Codex y Cursor primero (pregunta abierta 2 de la spec).

## 5. Riesgos abiertos

- La sustitución por expresión regular puede romper un ejemplo de código: la red es la prueba de lint de `tests/instalacion-anfitrion.test.js` y la prueba manual.
- Los hooks de Gemini y Codex fallan abiertos y los nombres de herramienta de Gemini y Copilot están sin confirmar: ver `docs/ANFITRIONES.md`.
