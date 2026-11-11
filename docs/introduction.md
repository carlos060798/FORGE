# Introducción

> Tipo: Explicación
> Última revisión: 2026-11-10 contra el commit 55a9dd9

Términos poco claros (SDD, agente, comando, skill, hook, pipeline): [Glosario](GLOSARIO.md). Estado real y cifras de pruebas: [ESTADO-ACTUAL.md](ESTADO-ACTUAL.md). Versión 5.0.0-beta.1, sin publicar en npm.

## Qué es

Fragua (antes FORGE; el comando `fragua` equivale a `forge`) es un conjunto de archivos y una línea de comandos para trabajar con Claude Code por especificaciones. El flujo es: describir una idea, escribir una especificación, aprobarla tú, planificar, dividir en tareas e implementar. Cada paso deja un archivo en `.sdd/` del proyecto.

Instala en tu proyecto 39 comandos `/sdd.*`, 14 agentes y 31 skills, que son archivos Markdown, y hooks en Node. Los hooks bloquean ciertas escrituras y registran cambios. No es un servicio: no hay servidor de Fragua. Lo que sale de tu equipo son las llamadas al proveedor del modelo.

La parte de código propia es el **ciclo verificado** (`core/ciclo/`): un agente escribe pruebas, otro escribe el código sin poder tocarlas, y las pruebas corren en un contenedor Docker sin red. La tarea se da por buena según el código de salida de las pruebas, no según lo que diga el modelo. Instalación por defecto: perfil `esencial` (seis comandos) y preset `lean` (6 agentes activos).

## Qué puede hacer

| Capacidad | Respaldo | Estado de la prueba |
|---|---|---|
| Ciclo verificado: pruebas rojas, implementación, pase por código de salida, en Docker sin red | `core/ciclo/`, `tests/sandbox-real.test.js` (11 de 11), `tests/corte-real.test.js` | Docker real probado solo en Windows 11 con Docker Desktop (2026-11-10). Sin probar en Linux ni macOS. Modelo real: 24 ejecuciones pequeñas con Anthropic (2026-10) |
| Veredicto de pruebas sin modelo: `fragua verificar` (con mutación y cadena de evidencia) | `core/verificar/`, `tests/verificar-mutacion.test.js` | Pruebas automáticas; Docker real en Windows |
| Aprobación humana de la spec desde un terminal real, con código de un solo uso | `cli/comandos/aprobar.js`, `tests/aprobaciones-identidad.test.js`, `tests/state-machine-aprobacion.test.js` | Pruebas automáticas. Con el mismo usuario del sistema no hay separación criptográfica |
| Contención ante archivos hostiles del proyecto (rutas vetadas, secretos, dependencias, red) | [GARANTIAS-Y-LIMITES.md](GARANTIAS-Y-LIMITES.md) (G1 a G55), `tests/proyecto-hostil.test.js` | Modelo guionizado que obedece al ataque; sin revisión independiente ni modelo real |
| Puertas de calidad (tipos, lint) tras las pruebas | `core/puertas/`, `tests/puertas-ciclo-completo.test.js` | Docker falso y modelo guionizado; no con modelo real |
| Reanudar tras una interrupción, con estado sellado | `tests/estado-sellado.test.js`, `fragua resume` | Pruebas automáticas. Un estado de otro equipo no se reanuda |
| Tope de gasto por sesión (2 USD por defecto) | `core/ciclo/presupuesto.js`, `core/session-budget.js` | El gasto calculado nunca se comparó con una factura |
| Proveedores Anthropic, OpenAI y Ollama | `core/llm-providers/` | Solo Anthropic con llamadas reales; OpenAI y Ollama contra servidores falsos |
| Servidor MCP (perfil `verificacion`) y API HTTP local con token | `core/mcp/`, `tests/mcp-dato-no-confiable.test.js`, `tests/api-http.test.js` | Pruebas automáticas; sin cliente MCP real documentado aquí |
| Instalar las skills en otras 8 herramientas (`--integracion`) | `core/instalacion/`, `tests/instalacion-integraciones.test.js` | **Sin probar en ninguna herramienta real**; sin guardián por hooks fuera de Claude Code |
| Dashboard local en `127.0.0.1:3001` | `ui/server.js` | Solo lectura (`GET`); se cierra a los 30 min sin uso |

## Qué no puede hacer / límites

| Límite | Evidencia | Qué hacer |
|---|---|---|
| Pasar las pruebas no demuestra que el código sea correcto | [PROBLEMAS-CONOCIDOS.md](PROBLEMAS-CONOCIDOS.md) C-2, P-1 | Revisa el diff y ejecuta las pruebas tú antes de hacer commit |
| El ciclo exige Docker en marcha; sin él sale con código 4 | `docs/referencia-cli.md` (`run`), `fragua doctor` | Abre Docker Desktop o usa `--motor clasico` (sin aislamiento, en tu equipo) |
| Solo JavaScript/TypeScript, Python y Go; en Python, dependencias solo desde `requirements.txt` | [MIGRACION-5.0.md](MIGRACION-5.0.md) 2.2 y 4.2 | Otros lenguajes: solo el modo clásico |
| Sin probar en Linux ni macOS; la CI de GitHub sigue en rojo en el último run comprobado (2026-11-09) | [ESTADO-ACTUAL.md](ESTADO-ACTUAL.md) | No lo uses como garantía en esas plataformas |
| Los agentes son prompts; pueden desviarse de su rol | [limitations.md](limitations.md), hooks solo mitigan escrituras | Aprueba la spec y revisa los cambios |
| El flujo interactivo completo corre dentro de Claude Code | [limitations.md](limitations.md) | Sin Claude Code solo quedan `run`, `verificar`, `mcp` y `api` |
| La 5.0.0 no está publicada en npm | `docs/ESTADO-ACTUAL.md` | Instala desde el repositorio ([getting-started.md](getting-started.md)) |
| No es una herramienta para tareas de cinco minutos: el recorrido spec, plan y tareas tiene coste en tiempo y modelo | [PRIMEROS-15-MINUTOS.md](PRIMEROS-15-MINUTOS.md) | Para cambios menores, usa Claude Code directamente |

Lista completa y verificada: [limitations.md](limitations.md). Cómo empezar: [PRIMEROS-15-MINUTOS.md](PRIMEROS-15-MINUTOS.md) o [getting-started.md](getting-started.md).
