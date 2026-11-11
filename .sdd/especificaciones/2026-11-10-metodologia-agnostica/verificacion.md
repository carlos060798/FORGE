# Verificación: metodologia-agnostica

> **Fecha:** 2026-11-11 · Escrita a mano leyendo `spec.md`, `core/instalacion/adaptar-anfitrion.js`, `cli/comandos/instalar.js` y los archivos de `tests/` citados. **No se ejecutó la suite al escribirla**; la última pasada completa que consta en la sesión (4245 pruebas, 0 fallos, 31 saltadas) es anterior a algunos cambios en curso de otros agentes. Sin revisión independiente.

## Criterio → pruebas

| Criterio | Prueba | Estado |
|---|---|---|
| CA-001-01 órdenes `/sdd.x` en cuerpo y `description` | `tests/instalacion-anfitrion.test.js`: «cambia /sdd.x por la invocación de la herramienta y respeta rutas y archivos»; el lint de cada integración («${clave}: todos los comandos y skills propias salen válidos y sin sintaxis ajena») busca órdenes con punto que queden | **Con prueba.** El lint solo mira órdenes con punto (`sdd.x`); `/forge` y `/compact` quedan fuera de la comprobación |
| CA-001-02 sin `allowed-tools` ni «Claude Code» fuera de la nota | «quita allowed-tools, antepone la nota y conserva el resto de la cabecera»; lint por integración | **Con prueba.** El lint comprueba `allowed-tools` solo en la cabecera, porque la plantilla de `sdd.crear-agente` lo nombra a propósito en el cuerpo |
| CA-001-03 la nota explica `Task`, `TodoWrite`, `/effort`, `$CLAUDE_PLUGIN_ROOT`, hooks y lo paralelo | La nota se genera en `notaDeAnfitrion`; la prueba de `adaptarSkill` comprueba que se antepone | **A medias.** Ninguna prueba comprueba el contenido de cada equivalencia |
| CA-001-04 prueba que falla ante skill inválida o sintaxis excluida | Un test por cada clave distinta de `claude`, con `validarSkill` | **Con prueba** |
| CA-001-05 fuentes y salida de `claude` sin cambios | `tests/instalacion-equivalencia.test.js` («init + update ... producen el árbol de la foto») | **Con prueba** |
| CA-002-01 un `rol-<agente>` por agente, válido | «cada agente da una skill rol-* válida con nivel y herramientas» (14 agentes); «init --integracion cursor instala 14 roles ...» | **Con prueba** |
| CA-002-02 `metadata` con nivel y herramientas | mismo test: comprueba `forge-nivel`; las herramientas se generan pero la aserción no las verifica | **A medias** |
| CA-002-03 sin cita al hook de memoria | mismo test: ningún rol contiene `agent-memory.js` ni «Claude Code»; ««Claude Code» pasa a un nombre neutral y la frase del hook de memoria se sustituye» | **Con prueba.** No comprueba que el texto de reemplazo diga `.sdd/memoria/` en los roles |
| CA-002-04 escritura segura de roles | Código en `copiarSkillsDeIntegracion` (no pisa si existe y difiere). Las pruebas de archivo ajeno, unión y enlace duro son de las skills (`tests/instalacion-integraciones.test.js`, F1.4) | **Sin prueba específica de roles** |
| CA-002-05 mensaje final con roles y lo no recibido | La instalación real comprueba `14 roles` en la salida | **A medias.** El texto de hooks/guardián/memoria no tiene aserción |
| CA-003-01 matriz sin herramienta «probada» sin registro | `docs/ANFITRIONES.md` | **Solo documento; sin prueba.** Ninguna herramienta figura como probada |
| CA-003-02 README, estado y hoja de ruta coherentes con la matriz | `README.md`, `docs/ESTADO-ACTUAL.md`, `docs/roadmap.md` | **Solo documento; sin prueba** |

## Qué quedó a medias o sin hacer

- **Prueba manual por herramienta (F5):** no hecha; la hace el dueño. Los criterios de éxito «al menos dos herramientas con registro de prueba manual» y «los 14 agentes y los 39 comandos válidos en las nueve integraciones» no se cumplen del todo: el lint cubre las integraciones automáticamente, pero no hay registro manual alguno. La tabla ya tiene diez claves con `codex`.
- **Agentes en formato nativo, memoria por herramienta y herramienta MCP consultiva:** los hacen otros agentes ahora mismo. **En curso, sin evidencia todavía.**
- **Nada se ejecuta en una herramienta real:** las pruebas instalan en carpetas temporales y comprueban archivos y texto, no que la herramienta cargue la skill.

## Límites de este documento

- Se leyó el código y las pruebas, no se corrieron.
- Los nombres de test son los de los archivos al 2026-11-11; otros agentes editan `tests/` en paralelo.
