# Ejemplos de uso

> Tipo: Guía
> Última revisión: 2026-11-10 contra el commit 55a9dd9

Cada ejemplo indica qué se ejecuta y qué produce. Los comandos de la CLI están descritos en [referencia-cli.md](referencia-cli.md); los comandos `/sdd.*` son instrucciones para Claude Code (archivos de `commands/`), no órdenes de shell. Estado del proyecto (pre-beta, sin publicar): [ESTADO-ACTUAL.md](ESTADO-ACTUAL.md).

**Ningún ejemplo de esta página se ejecutó en esta revisión.** Se comprobó que los comandos y subcomandos existen y que los mensajes citados están en el código. Las salidas que dependen de un modelo (preguntas, specs, planes) varían entre ejecuciones y aquí no se reproducen.

Para un recorrido largo con salidas de ejemplo de cada agente, ver [EJEMPLO-API-REST.md](EJEMPLO-API-REST.md).

---

## 1. Instalar y comprobar el entorno

Qué ejecuta: instalación en el proyecto actual y diagnóstico.

```bash
npx fragua init --preset lean
npx fragua doctor
```

- `init` copia el núcleo, comandos, agentes y hooks al proyecto y crea `.sdd/` (ver [referencia-cli.md](referencia-cli.md#init)). `--guided` ejecuta además un asistente interactivo que pregunta cuestiones de configuración (`wizardGuiado` en `cli/comandos/instalar.js`); `--ui` instala también el dashboard.
- `doctor` comprueba Node (>= 20), Docker, hooks, configuración y la clave del proveedor. Si Docker falla, indica si no está instalado, no está arrancado o falta permiso (`core/sandbox/diagnostico.js`).

Resultado esperado: un informe de líneas informativas y avisos. `doctor` sale con 0 aunque detecte problemas. No ejecutado en esta revisión.

## 2. Idea a código verificado con un comando

Qué ejecuta: el comando `/forge` en el chat de Claude Code (`commands/forge.md`), que recibe la idea en lenguaje natural y conduce el flujo (descubrimiento, spec, plan, tareas). No es un comando de shell.

```
/forge una API REST para gestionar tareas de equipos, con autenticación
```

La spec generada queda en `.sdd/especificaciones/`. **Para pasar de spec a plan hace falta una aprobación humana** que no puede dar el modelo: en una terminal real, `npx fragua aprobar spec` muestra lo que se aprueba y pide teclear un código de un solo uso (`cli/comandos/aprobar.js`, `core/aprobaciones-identidad.js`). Queda registrada en `.sdd/aprobaciones.jsonl` con el hash del archivo; si la spec cambia después, hay que aprobarla de nuevo.

Límite: la calidad de la spec y del plan depende del modelo. No ejecutado en esta revisión.

## 3. Ejecutar las tareas con el ciclo verificado

Qué ejecuta: el motor `ciclo`, por defecto desde 5.0.0 (referencia: [`run`](referencia-cli.md#run)).

```bash
npx fragua run --tasks tareas.json
```

Cada tarea de código se corrige hasta que sus pruebas pasan, en un contenedor Docker sin red. Salidas posibles:

| Código | Qué ha pasado |
|---|---|
| 0 | completado |
| 1 | fallo |
| 3 | una tarea espera tu decisión |
| 4 | Docker no disponible |

Puede gastar dinero: el tope por sesión es `presupuesto.tope_usd` (2,00 USD por defecto). Si el ciclo se pausa, no gasta nada hasta que decidas:

```bash
npx fragua resume --decision continuar --presupuesto-extra 1
```

`--decision` admite `continuar`, `aceptar` (dar la tarea por buena) y `abortar` (restaurar los archivos). Causas de pausa y qué hacer: [TROUBLESHOOTING.md](TROUBLESHOOTING.md#el-ciclo-se-pausa-código-de-salida-3). No ejecutado en esta revisión (requiere Docker y modelo; ver [ESTADO-ACTUAL.md](ESTADO-ACTUAL.md) sobre qué se ha probado con Docker real).

## 4. Cambiar de modo para prototipar

Qué ejecuta (en el chat de Claude Code):

```
/sdd.modo prototipo
/sdd.modo normal
```

`/sdd.modo` lee y escribe `sesion.modo` en `.sdd/sdd.config.yaml`. Según `commands/sdd.modo.md`: `normal` es el flujo completo, `rapido` omite el crítico y `prototipo` omite crítico, seguridad y ADR. Sin argumento muestra el modo actual. Alternativa desde la CLI: `npx fragua config set sesion.modo rapido`. No ejecutado en esta revisión.

## 5. Consultar el estado y reanudar

```
/sdd.estado
```

Muestra la fase, la spec activa y el progreso (`commands/sdd.estado.md`). Desde la CLI, sin modelo:

```bash
npx fragua status     # paso del pipeline y transiciones disponibles
npx fragua resume     # si hay tareas esperando decisión, las lista sin gastar
```

El formato exacto de la salida de `/sdd.estado` lo decide el modelo; no se reproduce aquí. No ejecutado en esta revisión.

## 6. Auditar consistencia antes de implementar

```
/sdd.checklist
/sdd.analizar
```

`/sdd.checklist` aplica una lista de calidad a la spec activa; `/sdd.analizar` verifica la consistencia entre constitución, spec, plan y tareas y detecta huecos o contradicciones (descripciones en `commands/`). El informe lo redacta el modelo. No ejecutado en esta revisión.

## 7. Proyecto existente

```bash
npx fragua init
```
```
/sdd.mapear
/sdd.constitucion
/sdd.especificar la siguiente funcionalidad
```

`/sdd.mapear` indexa estructura, símbolos y dependencias en `.sdd/mapa/`. Límite documentado: el mapa que reciben los agentes es parcial (C-9 en [PROBLEMAS-CONOCIDOS.md](PROBLEMAS-CONOCIDOS.md)). No ejecutado en esta revisión.

## 8. Historial de memoria de un agente

Los agentes dejan memoria en `.sdd/memoria/agente-<nombre>.md` cuando el hook usa el formato markdown (`claude-hooks/agent-memory.js`; con Node >= 22.5 puede usar SQLite en su lugar):

```bash
cat .sdd/memoria/agente-asesor-datos.md
```

El contenido depende de lo que haya hecho el agente. No ejecutado en esta revisión.

## 9. Exportar a otro formato

```bash
npx fragua export --format=speckit --out=export
```

Escribe `spec.md`, `plan.md`, `tasks.md`, `README.md` y, si hay ADR, `decisions.md` (ver [`export`](referencia-cli.md#export)). No ejecutado en esta revisión.

---

## Qué se quitó respecto a la versión de junio

- Salidas inventadas (`ir.json` con `confidence: 0.89`, «11/11 criterios», «43 tests», cobertura 84 %, tiempos de «3 minutos»): dependen del modelo y no las produce el código de forma fija.
- `npx forge-sdd ...` (el paquete se llama `fragua`, sin publicar) y el panel de `forge ui` en `localhost:3001` (puerto no verificado).
- `/sdd.configurar set calidad.cobertura_tests_minima`: esa clave no está comprobada en la configuración.
- Un agente `accessibility-tester` con edición manual de `sdd.config.yaml`: el flujo de `/sdd.crear-agente` existe (`commands/sdd.crear-agente.md`) pero la sección `agentes:` del ejemplo no está verificada.
