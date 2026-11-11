# Primeros 15 minutos con Fragua

> Para una persona sola, en Windows 11 (también vale en Linux o macOS), con Claude Code (con otra herramienta de código, ver [USO-EN-OTRAS-HERRAMIENTAS.md](USO-EN-OTRAS-HERRAMIENTAS.md); sin probar en real). Una página; el resto de la documentación es opcional hasta que la necesites. Estado real del proyecto: [ESTADO-ACTUAL.md](ESTADO-ACTUAL.md).

## 0. Qué necesitas (2 minutos)

| Requisito | Cómo comprobarlo | Si falta |
|---|---|---|
| Node ≥ 20 | `node --version` | https://nodejs.org (LTS) |
| Docker Desktop **abierto** (dice «Engine running») | `docker version` | https://www.docker.com/products/docker-desktop/ . Sin Docker, el ciclo no ejecuta nada: ver el paso 5 |
| Clave de Anthropic en el entorno | `echo $env:ANTHROPIC_API_KEY` (PowerShell) | Ponla con un tope de gasto en la consola de Anthropic. Nunca va en archivos del proyecto |
| Claude Code | `claude --version` | https://claude.com/claude-code |
| Un proyecto en JavaScript/TypeScript, Python o Go | `package.json`, `pyproject.toml` o `go.mod` | Son los lenguajes que el ciclo verificado sabe probar |

## 1. Instalar (3 minutos)

Hasta que `fragua` esté en npm, se instala desde el repositorio:

```bash
git clone https://github.com/carlos060798/FORGE && cd FORGE && npm install && npm install -g .
cd <tu-proyecto>
fragua init
```

`fragua init` sin opciones instala el **perfil esencial**: seis comandos en el menú `/` de Claude Code y una configuración con los seis agentes del preset *lean* (todos en sonnet, el modelo barato). Para todos los comandos: `fragua init --perfil completo`. Para otro preset: `--preset startup` o `--preset enterprise`.

## 2. Comprobar el entorno (1 minuto)

```bash
fragua doctor
```

Lee la salida de arriba abajo. Lo que importa: Node, la clave, Docker y la sección final «Siguiente paso». Si Docker está instalado pero cerrado, el diagnóstico te lo dice y te pide abrir Docker Desktop.

## 3. El camino de cinco comandos (8 minutos la primera vez)

Abre Claude Code dentro del proyecto (en otra herramienta, la invocación cambia: [USO-EN-OTRAS-HERRAMIENTAS.md](USO-EN-OTRAS-HERRAMIENTAS.md)) y escribe, en este orden:

| Paso | Comando | Qué pasa | Qué haces tú |
|---|---|---|---|
| 1 | `/sdd.especificar "una idea en una frase"` | Escribe una especificación en `.sdd/especificaciones/<fecha-id>/spec.md`: qué y por qué, sin tecnología | **La lees y la apruebas** desde una terminal real: `fragua aprobar spec`. Te pide teclear un código que ves en pantalla. Sin esto no se puede planificar |
| 2 | `/sdd.planificar` | Plan técnico a partir de la spec aprobada | Lo revisas. Si no te gusta, lo dices y se rehace |
| 3 | `/sdd.tareas` | Lista de tareas pequeñas, cada una con sus criterios | Nada, salvo quitar lo que no quieras |
| 4 | `/sdd.implementar` | **Ciclo verificado:** un agente escribe pruebas que fallan, otro escribe el código sin poder tocar las pruebas, y todo corre en un contenedor Docker sin red. Decide el código de salida de las pruebas, no el modelo | Esperas. El ciclo se **pausa** y te pregunta cuando no puede seguir solo: dependencia nueva, cambio de configuración, demasiadas iteraciones, tope de gasto |
| 5 | `/sdd.estado` | Dónde va el proyecto, qué tarea está en revisión y por qué | Decides: `fragua resume` para continuar o corregir a mano |

Para retomar en otra sesión: `/sdd.implementar continuar`. Para ver el estado desde la terminal: `fragua status`.

## 4. Las pausas: qué significan

| El ciclo dice | Significa | Qué hacer |
|---|---|---|
| «requiere revisión humana: dependencia» | El modelo quiso añadir un paquete. No se aplica solo | Añádelo tú si lo quieres y `fragua resume` |
| «requiere revisión humana: configuración protegida» | Quiso tocar `tsconfig`, `biome`, CI o similares | Igual: lo cambias tú o no |
| «sin progreso» o «iteraciones agotadas» | Las pruebas siguen en rojo tras varios intentos | Mira la salida en `.sdd/motor/`; a veces la spec era ambigua: corrígela y vuelve |
| «tope de gasto alcanzado» | Se gastó el límite de la sesión (2 USD por defecto) | Sube `presupuesto.tope_usd` en `.sdd/sdd.config.yaml` si quieres, y `fragua resume` |
| «código 4: sin aislamiento» | Docker no responde | Abre Docker Desktop. O, sin aislamiento y con aviso: `fragua run --motor clasico` |

## 5. Coste orientativo

Con el preset lean (sonnet) una tarea pequeña suele costar céntimos y rara vez pasa de unas decenas de céntimos; el tope por sesión es de 2 USD y el ciclo se para solo al llegar. El gasto exacto queda en `.sdd/motor/<sesión>/gasto.jsonl`. **Advertencia honesta:** la cifra calculada no se ha contrastado con una factura real todavía ([ESTADO-ACTUAL.md](ESTADO-ACTUAL.md)).

## 6. Qué viene después, cuando lo necesites

- Todos los comandos: `fragua init --perfil completo` y `/forge ayuda`.
- Qué garantiza el ciclo y qué no: [GARANTIAS-Y-LIMITES.md](GARANTIAS-Y-LIMITES.md).
- Si algo falla: [QUE-PASA-SI-FALLA.md](QUE-PASA-SI-FALLA.md) y [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
- Configuración completa: [configuration.md](configuration.md).

> **Tiempo medido:** pendiente. El dueño mide este recorrido en una carpeta limpia de Windows y anota aquí el tiempo de reloj (tarea T10 de la spec `2026-11-09-puerta-de-entrada-solo-dev`).
