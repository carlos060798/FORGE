# Glosario de Fragua

> Tipo: Referencia
> Última revisión: 2026-11-10 contra el commit 55a9dd9

Definiciones de los términos que usa la documentación, comprobadas contra el código. Cuando una definición remite a un documento, ese documento manda en los detalles. Estado del proyecto y cifras: [ESTADO-ACTUAL.md](ESTADO-ACTUAL.md).

---

## Parte 1. Estructura del producto

### Anfitrión

La **herramienta de código** en la que se usa Fragua (Claude Code, Codex, Cursor, Copilot, Gemini CLI…). Claude Code es el nativo: recibe comandos, subagentes y hooks. En las demás, Fragua instala solo skills (las propias y las generadas de los comandos) y `AGENTS.md`; no instala comandos, agentes ni hooks. Ver [RELACION-CON-CLAUDE-CODE.md](RELACION-CON-CLAUDE-CODE.md).

### Integración

La clave de `forge init --integracion <clave>` que fija el anfitrión de destino y, con él, la carpeta de skills y la forma de invocarlas. Se define en `core/instalacion/herramientas-destino.js`. Sin la opción, la integración es `claude`.

### Agente

Un **agente** es un rol especializado que ejecuta un modelo de lenguaje. Es un archivo `.md` en `agents/` (instalado en `.claude/agents/`) con nombre, instrucciones de sistema, modelo (`opus`, `sonnet` o `haiku`) y lista de herramientas.

FORGE tiene **14 agentes totales**, agrupados por función (modelo de la cabecera: 6 con `opus`, 8 con `sonnet`):
- 4 estratégicos (opus): arquitecto, critico, revisor, seguridad
- 2 de diseño (opus): product-designer, asesor-datos
- 4 de implementación (sonnet): desarrollador-backend, desarrollador-frontend, tester, operaciones
- 4 de soporte (sonnet): disenador-api, architecture-designer, investigador, documentador

Seis tienen solo lectura de archivos (`Read`, `Grep`, `Glob`) y `Bash`, sin `Write`. El ciclo verificado reutiliza tres: `arquitecto` (planifica), `tester` (pruebas) y el agente que declare cada tarea (implementa). Ver [agents.md](agents.md) y [INVENTARIO-AGENTES-Y-SKILLS.md](INVENTARIO-AGENTES-Y-SKILLS.md).

### Rol

Tiene dos usos; la documentación indica cuál:

1. **Función genérica** de un agente («el rol del arquitecto»). Se prefiere decir «agente».
2. **Rol del nodo del ciclo** (`planner`, `qa`, `coder`): a cada rol se le asigna un perfil de capacidades en `core/ciclo/perfiles.js`; el perfil es del rol, no del agente que lo ejerza.

### Modelo

Un modelo de lenguaje concreto de un proveedor. Un agente es un rol; el modelo es el LLM que lo ejecuta. El motor soporta varios proveedores (Anthropic, OpenAI y Ollama en `core/llm-providers/`); ver [configuration.md](configuration.md).

### Comando

Una **etapa del pipeline invocable por el usuario**: archivo `.md` en `commands/` (instalado en `.claude/commands/`), que se invoca como `/sdd.nombre [argumentos]`. Hay **39 comandos**. En anfitriones que no son Claude Code se instalan como skills `sdd-*`.

Los 8 comandos principales que avanzan el pipeline linealmente:
1. `/sdd.descubrir`
2. `/sdd.interpretar`
3. `/sdd.diseñar`
4. `/sdd.especificar`
5. `/sdd.planificar`
6. `/sdd.tareas`
7. `/sdd.implementar`
8. `/sdd.desplegar`

Ver [workflows.md](workflows.md).

### Skill

Una **skill** es un archivo `SKILL.md` en `skills/<nombre>/` (instalado en `.claude/skills/` o en la carpeta del anfitrión) con instrucciones que el modelo sigue. No es código que Fragua ejecute. Los comandos, los agentes o el propio modelo (por la descripción de la cabecera) la invocan. Hay **31 skills**. Ver [tools.md](tools.md).

### Hook

Un script de `claude-hooks/` que **Claude Code** (no el modelo) ejecuta en un evento. Los que registra el plugin: `pre-tool-guard.js` (`PreToolUse`; exit 2 bloquea la acción), `agent-memory.js` y `post-write-conventions.js` (`PostToolUse`, sobre `Write|Edit`), y `context-manager.js` (`PostToolUse`); `ast-indexer.js` solo está en el `settings.json` de este repositorio. En `PostToolUse` el archivo ya está escrito: el exit 2 devuelve un mensaje al agente, no revierte. Los hooks de Claude Code no existen en otros anfitriones: con `--con-hooks`, `fragua guardian evaluar --anfitrion <x>` los sustituye de forma opcional y sin probar en real (ver [ANFITRIONES.md](ANFITRIONES.md)). El motor (`forge run`, `resume`, `verificar`) no depende de ellos. Tabla completa en [hooks.md](hooks.md).

### Perfil de instalación

Qué comandos recibe una instalación: `esencial` (6: `forge`, `sdd.especificar`, `sdd.planificar`, `sdd.tareas`, `sdd.implementar`, `sdd.estado`) o `completo` (todos). Se elige con `--perfil`. En el código de este árbol el valor por defecto es `esencial` (ADR-24); [ESTADO-ACTUAL.md](ESTADO-ACTUAL.md) sitúa ese cambio en la rama `fase-2-puerta-de-entrada`, sin fusionar hasta que la CI esté verde. `update` no borra comandos ya instalados. Ver `core/instalacion/perfiles.js`. No confundir con el **perfil de interacción** (`guiado` o `experto`) ni con el **perfil de capacidades** de un rol del ciclo.

### Preset

Un archivo de `presets/` (`lean`, `startup`, `enterprise`) que `forge init --preset <nombre>` aplica a `.sdd/sdd.config.yaml`: valores de configuración para un tipo de proyecto. Conserva los bloques propios del proyecto. Un nombre desconocido avisa y no aplica nada. Ver [referencia-cli.md](referencia-cli.md) y [configuration.md](configuration.md).

---

## Parte 2. Metodología y pipeline

### SDD (Spec-Driven Development)

La metodología: no se escribe código sin una especificación escrita y aprobada por una persona. Ciclo: entender, especificar, planificar, implementar, verificar. Una especificación contiene criterios de aceptación, escenarios, restricciones y qué significa «hecho». Ver [core-concepts.md](core-concepts.md).

### Pipeline

La secuencia de etapas de la idea al despliegue: 8 comandos principales en orden, uno condicional (`/sdd.aclarar`) y comandos auxiliares. Produce artefactos en `.sdd/` que persisten entre sesiones. Ver [workflows.md](workflows.md).

### Etapa

Según el contexto, tres niveles:

1. **Etapa conceptual** (5): especificación, diseño, implementación, verificación, despliegue.
2. **Etapa ejecutable** (8): los comandos principales de arriba. «Etapa» sin calificar se refiere a este nivel.
3. **Estado** (9): los valores de `estado.json → pipeline_step`, definidos en `core/state-machine.js` y en `docs/contrato/estado-pipeline.schema.json`:

```
idea → discovery → ir → design → spec → plan → tasks → code → done
```

Ver [core-concepts.md](core-concepts.md#etapas-comandos-y-estados).

### Constitución

El documento de principios del proyecto, en `.sdd/memoria/constitucion.md` (lo crea `/sdd.constitucion`): stack, principios, restricciones de seguridad, convenciones. Lo hace cumplir de forma automática solo el hook `post-write-conventions.js`, que extrae un límite de longitud de función, una cobertura mínima y patrones prohibidos; el resto depende de que el modelo la lea (skill `constitucion-constraint`). Ver [core-concepts.md](core-concepts.md).

### IR (Interpreted Requirement)

La primera transformación estructurada de la idea: `.sdd/ir.json`, producido por `/sdd.interpretar`. Incluye requisitos, restricciones, ambigüedades y una `confidence` de 0 a 1 que es orientativa: no es una guarda del motor.

### ADR (Architecture Decision Record)

Registro de una decisión de arquitectura: contexto, opciones, decisión, consecuencias. Los del proyecto van en `.sdd/arquitectura/`; el hook `agent-memory.js` también indexa en `ADRs.jsonl` los comentarios `# ADR: {...}` del código.

---

## Parte 3. Ciclo verificado y garantías de 5.0

### Ciclo verificado

El motor de `forge run` (`core/ciclo/`): un planificador divide la tarea, un agente de pruebas escribe las pruebas, el implementador escribe el código, las pruebas se ejecutan en un contenedor sin red, se miden con mutación y una persona aprueba. **El veredicto lo decide el código de salida de las pruebas, no el modelo.** Ver [ciclo-verificado.md](ciclo-verificado.md) y [GARANTIAS-Y-LIMITES.md](GARANTIAS-Y-LIMITES.md).

### Aislamiento

El código del proyecto y las pruebas se ejecutan en un contenedor Docker sin red, sin privilegios, sin capacidades añadidas y con límites de recursos (`core/sandbox/politica.js`). El ciclo usa Docker para ejecutar las pruebas; el comportamiento con Docker real en Windows se midió una vez (ver ESTADO-ACTUAL.md). Los contenedores llevan la etiqueta `fragua.sandbox=1` para barrer huérfanos.

### Mutación

La **medición de pruebas por mutación propia** (ADR-20, `core/ciclo/mutacion.js`): tras un pase, se introducen cambios pequeños y deliberados en una copia del código del implementador y se ejecutan las pruebas contra cada uno; unas pruebas que solo ejecutan el código pasan igualmente y se detectan así. No llama a ningún modelo. No confundir con el **registro de mutaciones** del hook `agent-memory.js` (`.sdd/observabilidad/mutaciones.jsonl`: qué agente modificó qué archivo), que lee la skill `mutation-detector`.

### Puerta de calidad

Una comprobación adicional que el proyecto declara en la sección `puertas:` de `.sdd/sdd.config.yaml` (tipos, linter, seguridad, cobertura). Corre en el mismo contenedor sin red que las pruebas y decide solo por el código de salida de su comando; lo que no pasa (incluidos tiempo agotado y herramienta ausente) no es éxito. Ver [puertas-de-calidad.md](puertas-de-calidad.md). No confundir con `core/quality-gate.js`, el gate más simple del modo clásico.

### Cadena de evidencia

Cada informe que guarda `forge verificar --registrar` en `.sdd/verificaciones/<id>.json` lleva un bloque `evidencia` que lo enlaza con el anterior y, si hay clave local, lo firma, de modo que alterar, borrar o reordenar informes se detecta. Ver [cadena-de-evidencia.md](cadena-de-evidencia.md).

### Aprobación con identidad

Una aprobación humana exige un terminal interactivo y un código de un solo uso que la persona teclea; queda en `.sdd/aprobaciones.jsonl` (solo adición) con quién (correo o nombre de git, o usuario del sistema), cuándo, qué y el SHA-256 del artefacto aprobado, y cada línea lleva un HMAC encadenado con el de la anterior (`core/aprobaciones-identidad.js`). La identidad es la que declara el equipo local, no una autenticación fuerte.

### Punto de guardado

El estado del ciclo tras cada paso: un JSON por transición en `.sdd/motor/<sesión>/checkpoints/`, escrito con archivo temporal y renombrado, con su huella y su sello (`core/ciclo/checkpoint-archivos.js`). `forge resume` continúa desde el último válido; uno dañado se descarta y se usa el anterior. No confundir con `core/checkpoint.js`, que solo guarda la última tarea completada en `.estado-tareas.json`.

### Sello

Un HMAC-SHA256 del estado del ciclo con una clave del **usuario**, fuera del proyecto (`core/ciclo/sello.js`). Sin sello válido, el estado se ignora y la tarea empieza de cero. Evita que un repositorio ajeno traiga un punto de guardado fabricado. Límite: un estado sellado en otro equipo, o tras perder la clave, no se puede reanudar.

### Dato no confiable

Todo texto que sale del árbol del proyecto y llega al modelo (archivos, nombres, salida de pruebas) lo controla quien lo escribió. Se entrega entre marcadores, con un identificador derivado del hash del contenido, como dato sin autoridad (`core/ciclo/dato-no-confiable.js`). Es una medida complementaria: la garantía de seguridad es la contención (rutas, herramientas, aislamiento), no que el modelo obedezca los marcadores.

### Cuarentena de pruebas

Mecanismo para apartar una prueba inestable (ADR-23): se registra en `tests/cuarentena.txt` con incidencia, fecha y motivo; `npm test` la excluye y un job de CI no bloqueante la sigue ejecutando; caduca a los 30 días y hay un tope de 5. Estado actual: ver [ESTADO-ACTUAL.md](ESTADO-ACTUAL.md).

### Modo de bloque y modo por turnos

Las dos formas de trabajar del implementador (`motor.implementador`).

- **Modo de bloque** (por defecto): una respuesta con todos los archivos completos.
- **Modo por turnos** (opcional, ADR-21): varias respuestas con acciones entre medias.
- **Turno**: una respuesta del modelo dentro de un intento, que pide acciones o declara que terminó.
- **Acción**: una de cinco operaciones: `leer_archivo`, `listar`, `buscar`, `editar`, `ejecutar_pruebas`.
- **Iteración**: una ejecución final de pruebas del ciclo. Es lo único que decide el éxito, en los dos modos.

Ver [ciclo-verificado.md](ciclo-verificado.md).
