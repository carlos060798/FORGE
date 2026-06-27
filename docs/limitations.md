# Limitaciones

Este documento describe las limitaciones conocidas de FORGE: restricciones inherentes al diseño, compromisos deliberados, áreas incompletas y casos donde FORGE no es la herramienta adecuada.

---

## Limitaciones de diseño (por decisión)

### FORGE no es independiente de Claude Code

FORGE requiere Claude Code para funcionar. No existe un modo de ejecución autónomo, un servidor independiente ni una API HTTP propia. Todo corre dentro de las sesiones de Claude Code.

**Por qué:** Esta decisión mantiene FORGE extremadamente ligero (dos dependencias npm) y elimina la fricción de instalación. La contrapartida es que FORGE no puede ejecutarse en pipelines de CI sin Claude Code.

---

### Los agentes son prompts, no procesos

Los 14 agentes de FORGE son archivos Markdown con instrucciones de rol. No son procesos separados, no tienen estado de ejecución propio y no pueden comunicarse entre sí directamente — solo a través de artefactos en `.sdd/`.

**Consecuencia práctica:** No existe una garantía de que el agente siga sus instrucciones al 100% en todos los casos. Un agente puede desviarse del rol si el contexto de la conversación lo lleva en otra dirección. Los hooks de governance (`pre-tool-guard`, `post-write-conventions`) mitigan esto para operaciones de escritura, pero no para el razonamiento del agente.

---

### Sin ejecución paralela real dentro de una sesión

La herramienta `Task` de Claude Code permite despachar subagentes, pero dentro de una sesión de Claude Code la ejecución es fundamentalmente secuencial en el nivel de la sesión principal. El Programmatic Tool Calling (PTC) paraleliza al nivel de subagentes, pero el agente principal espera a que todos completen.

**Consecuencia práctica:** En proyectos muy grandes con muchas tareas independientes, el tiempo total de implementación puede ser largo aunque las tareas sean paralelizables en teoría.

---

### El modo multi-proveedor no ha sido validado exhaustivamente

FORGE soporta OpenAI y Ollama como proveedores alternativos a Anthropic. Sin embargo, los tests de integración están escritos contra Anthropic (y el proveedor `stub` para CI). El comportamiento con GPT-4o u Ollama como proveedores de agentes de implementación puede variar respecto al comportamiento documentado.

**Proveedores soportados:** anthropic, openai, ollama, stub. Google/Gemini no está soportado.

**Recomendación:** Usar OpenAI/Ollama solo para agentes de nivel de implementación (`desarrollador-backend`, `desarrollador-frontend`, `tester`). Los agentes estratégicos usan Anthropic de forma fija.

---

## Limitaciones técnicas conocidas

### La migración automática de Markdown a SQLite no está implementada

Si cambias `memoria.backend` de `markdown` a `sqlite` en un proyecto existente, el historial de memoria en archivos `.md` no se migra al backend SQLite. El sistema empieza con una memoria vacía.

**Solución actual:** Si necesitas preservar el historial, no cambies el backend a mitad del proyecto. Cambia el backend solo en proyectos nuevos.

---

### Algunos tests avanzados están desactivados (.skip)

En v4.2.0, los 998 tests activos pasan todos (0 fallos). Sin embargo, hay tests desactivados con `.skip` que cubren funcionalidades aún en desarrollo:
- `tests/agent-enforcement.test.js.skip` — enforcement de permisos por agente
- `tests/ast-compressor.test.js.skip` — compresión AST avanzada
- `tests/delta-encoding.test.js.skip` — delta encoding para memoria
- `tests/episodic-memory.test.js.skip` — memoria episódica avanzada
- `tests/hybrid-indexer.test.js.skip` — indexación híbrida

**Impacto:** Las funcionalidades cubiertas por estos tests (.skip) no están garantizadas. Las funcionalidades principales están todas cubiertas por los 998 tests activos.

---

### `mcp-figma/` está incompleto

El directorio `mcp-figma/` existe y tiene un `README.md` y `package.json`, pero el código fuente del servidor MCP de Figma está en estado esquelético.

**Impacto:** La integración con Figma descrita en `sdd.config.yaml → figma` no funciona sin este MCP completamente implementado.

**Alternativa actual:** La skill `elegir-direccion` y los design systems en `design-systems/` funcionan de forma independiente y no requieren Figma.

---

### Los presets no son activables como comando

Los archivos en `presets/` (`lean.yaml`, `startup.yaml`, `enterprise.yaml`) son plantillas que se aplican durante `forge init --preset`. No existe un comando `/sdd.preset cargar startup` para cambiar el preset de un proyecto existente.

**Alternativa actual:** Copiar manualmente las claves del preset que quieres aplicar en tu `sdd.config.yaml`, o usar `/sdd.configurar set` para cada valor.

---

### `cache-audit` no está conectado al pipeline automáticamente

La skill `cache-audit` analiza oportunidades de `cache_control` en los archivos de memoria de agentes, pero no se invoca automáticamente en ningún punto del pipeline. Requiere invocación manual.

---

### El modo `prototipo` no es respetado completamente por todos los comandos

Aunque `sesion.modo: prototipo` está declarado en `sdd.config.yaml` y los comandos principales (`sdd.planificar`, `sdd.especificar`) lo respetan, algunos comandos de mantenimiento no comprueban el modo de sesión y pueden ejecutar pasos que se supone deben omitirse.

---

### `orquestacion-ptc` requiere activación explícita

La skill de paralelización con PTC no está activa por defecto en todos los contextos donde podría beneficiar. Requiere que el comando la invoque explícitamente o que el usuario tenga el flag correspondiente.

---

## Limitaciones de escala

### Proyectos muy grandes pueden degradar el rendimiento de la memoria

Con proyectos de más de ~500 archivos y sesiones largas, los archivos de memoria de agentes pueden crecer considerablemente incluso con compactación. El índice invertido (`indice.jsonl`) puede volverse lento para consultas complejas.

**Solución:** Activar el backend SQLite (`memoria.backend: sqlite`) con Node ≥ 22.5 para proyectos grandes.

---

### El dashboard UI no escala para consumo.jsonl muy grandes

El endpoint `/consumo` devuelve las últimas 50 líneas de `consumo.jsonl`. En proyectos con cientos de sesiones, el archivo puede ser grande, pero el dashboard siempre mostrará solo las 50 más recientes.

**Impacto:** No hay impacto funcional — el archivo completo está disponible en disco para análisis externo.

---

## Casos donde FORGE no es adecuado

### Proyectos sin Claude Code

Si tu equipo no usa Claude Code como herramienta principal, FORGE no encaja. FORGE no tiene CLI propia para ejecutar el pipeline, servidor propio para recibir webhooks, ni SDK para integrar en otra herramienta de IA.

---

### Automatización de CI/CD sin intervención humana

FORGE está diseñado para trabajo colaborativo humano-IA, no para pipelines completamente automatizados. Los puntos de aprobación (`requerir_aprobacion_plan: true`) son deliberados. Si necesitas una pipeline de CI que genere código completamente automático, FORGE no es la herramienta correcta.

---

### Tareas de mantenimiento puntual

Para una tarea puntual de 5 minutos ("arregla este bug", "renombra esta función"), el overhead de FORGE (discovery → IR → spec → plan) es desproporcionado. Usa Claude Code directamente para tareas menores.

FORGE es más valioso cuanto más compleja y duradera es la tarea: features nuevas, refactorizaciones grandes, nuevos módulos.

---

### Proyectos en producción sin especificación existente

Si tienes un proyecto en producción bien establecido pero sin spec formal, el proceso de retroespecificación (escribir la spec a partir del código existente) puede ser más trabajo del que aporta. FORGE es más efectivo cuando la spec se crea junto con el producto.

---

## Deuda técnica visible

Las siguientes áreas del código tienen TODOs o están marcadas como incompletas:

| Área | Estado | Impacto |
|------|--------|---------|
| `mcp-figma/src/` | Esquelético | Integración Figma no funcional |
| `tests/agent-enforcement.test.js.skip` | Desactivado | Enforcement de permisos por agente |
| `tests/ast-compressor.test.js.skip` | Desactivado | Compresión AST avanzada |
| `tests/delta-encoding.test.js.skip` | Desactivado | Delta encoding para memoria |
| `tests/episodic-memory.test.js.skip` | Desactivado | Memoria episódica avanzada |
| `tests/hybrid-indexer.test.js.skip` | Desactivado | Indexación híbrida |
| Migración Markdown→SQLite | No implementada | Cambio de backend pierde historial |
| `mcp-figma/src/` | Esquelético | Integración Figma no funcional |

---

## Convivencia con otras herramientas

### Con GitHub Copilot / Cursor

FORGE no interfiere con otras herramientas de IA en el editor. Los hooks de Claude Code solo se activan dentro de sesiones de Claude Code.

### Con ESLint / Prettier

`post-write-conventions.js` detecta convenciones de código del proyecto. Si tienes ESLint/Prettier configurados, FORGE los detectará y los respetará. No los ejecuta automáticamente — solo valida que el código generado siga las mismas reglas.

### Con Git hooks

Los hooks de Claude Code y los hooks de Git (pre-commit, etc.) son independientes. FORGE no interfiere con tus Git hooks existentes.
