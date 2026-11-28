---
id: 2026-11-27-guardian-cierre-c07
titulo: "Guardián: cerrar el fallo abierto por ruta de hook no resuelta (C-07) y los rodeos conocidos"
tamano: mediano  # micro | pequeño | mediano | grande
estado: borrador  # borrador | en_revision | aprobada | en_implementacion | completada
creada: 2026-11-27
actualizada: 2026-11-27
autor: humano  # humano | importado
constitucion_version: 1.1.0
etiquetas: [seguridad, guardian, hooks, c-07, plan-modos-fase-2d]
---

# Especificación: Guardián, cierre de C-07

> **Estado: borrador, sin aprobar.** Punto 2d del «Plan consolidado de modos y componentes de Forja» (2026-11-27, §3.3 M2, §5 fase 2 y §6). La aprobación es del dueño del proyecto; ningún agente la marca. Orden de trabajo: spec aprobada → pruebas (una en rojo antes del arreglo) → código. Continúa la spec `2026-11-06-guardian-endurecido` (borrador, ya implementada en parte): no la reabre.

## 1. Contexto y Motivación

El guardián (`claude-hooks/pre-tool-guard.js`) es una «red de seguridad, no un límite» (spec `2026-11-06-guardian-endurecido`, §2). Aun así, no debe fallar abierto: si no puede ejecutarse, la acción debe bloquearse. La auditoría de seguridad (hallazgo C-07, `docs/informes/SEGURIDAD-CIBER.md:128`) encontró que el hook fallaba abierto; la reverificación posterior lo dejó **PARCIAL**.

**Estado actual de C-07 (¿sigue abierto? Sí, en la parte «fuera del script»):**

- *Dentro del script, cerrado.* JSON ilegible, entrada vacía, evento que no es objeto y módulo compartido ausente devuelven exit 2 (`claude-hooks/pre-tool-guard.js:28`, `:71`, `:210-222`; spec `guardian-endurecido` CA-002-01; `docs/informes/REVERIFICACION-SEGURIDAD.md:38-39`). El envoltorio `claude-hooks/pre-tool-guard.sh` también bloquea sin Node o sin el `.js` (`:49-51`).
- *Fuera del script, abierto.* `docs/informes/REVERIFICACION-SEGURIDAD.md:69` lo clasifica «PARCIAL»: `.claude/settings.json` registra `node claude-hooks/pre-tool-guard.js` con **ruta relativa**; si no resuelve (cwd distinto, archivo movido o borrado), Node sale con 1, que el protocolo de hooks trata como error **no bloqueante**, y la herramienta se ejecuta. Lo mismo si `node` no está en el `PATH` (127). La corrección propuesta (`REVERIFICACION-SEGURIDAD.md:84`, `PARCHE-HOOK-PENDIENTE.md:39-48`) es una ruta anclada con `$CLAUDE_PROJECT_DIR`, o registrar el `.sh`, más una comprobación de `doctor`. El propio `PARCHE-HOOK-PENDIENTE.md` está marcado como pendiente (el hook y `.claude/settings*` están protegidos para el agente).
- *Verificado hoy en el árbol de trabajo (2026-11-27), el fallo está presente:*
  - `.claude/settings.json:17`: `"command": "node claude-hooks/pre-tool-guard.js"` (relativa).
  - `.claude-plugin/.claude/settings.json:9`: `"command": "node .claude/hooks/pre-tool-guard.js"` (relativa).
  - El instalador reescribe la plantilla a `.claude/hooks/` también relativa: `cli/comandos/instalar.js:373-376` (el comentario del código dice «relativa a CWD del proyecto»).
  - `grep` de `CLAUDE_PROJECT_DIR` en `*.js`, `*.json`, `*.sh` y `*.md` (fuera de `docs/informes/`): solo `claude-hooks/agent-memory.sh:51`. Ningún registro del guardián lo usa.
  - `fragua doctor` solo comprueba que la cadena `pre-tool-guard` aparezca en `PreToolUse` (`cli/comandos/doctor.js:436-445`) y que los archivos existan bajo `.claude/hooks/` y compilen (`:456-470`). **No comprueba que la ruta registrada resuelva** desde otra carpeta.
- *Otras herramientas.* El guardián se registra como `fragua guardian evaluar --anfitrion <x>` (`core/instalacion/hooks-anfitrion.js:368`). Si `fragua` no está en el `PATH`, el fallo (127) se interpreta según el anfitrión; solo Cursor declara `failClosed: true` (`hooks-anfitrion.js:280-282`). [NV] qué hace cada anfitrión ante un código que no es el de bloqueo: el plan dice que falla abierto en Gemini, Codex y Windsurf (§3.9) y no se verificó en ejecución.

**Rodeos conocidos que el plan pide cerrar junto con C-07** (§3.3 M2: «Cerrar C-07 y los rodeos (`cd` + ruta relativa, borrar hooks)»):

- `cd` a otra carpeta y uso de rutas relativas: el guardián resuelve rutas relativas contra su propio `cwd`; [NV] si un comando de varios pasos con `cd` puede apuntar a un archivo protegido que el análisis no resuelve (no se probó en esta revisión).
- Borrar o mover los hooks con una orden de shell: `esRutaCriticaDelGuardian` cubre `.claude/hooks`, `claude-hooks` y `.claude/settings*` (`core/evidencia/guardian-reglas.js:153-171`), y `rm`, `mv` y similares están en `ESCRITORES_TODOS` (`:196-198`). [NV] la combinación con `cd` y rutas relativas.
- Otros rodeos listados en la reverificación, **fuera del alcance de esta spec salvo el primero**: `Grep` sobre `.env` (C-04: `claude-hooks/pre-tool-guard.js:374-376` deja pasar toda herramienta que no sea de escritura, `Read`, `Bash` o `PowerShell`; [NV] sin reproducir hoy), guardia de solo lectura que depende de `CLAUDE_AGENT_NAME` (C-06, `pre-tool-guard.js:225-233`), dos catálogos de secretos (C-09/C-11) y `.sdd/estado.json` escribible (C-01/C-05; ver la spec `aprobacion-verificable-en-todos-los-caminos`).

## 2. Objetivo

Que, en Claude Code, si el guardián no puede ejecutarse o no se encuentra, la acción se bloquee en vez de ejecutarse; que `doctor` lo compruebe; y que las formas conocidas de saltarlo (cambiar de carpeta, rutas relativas, borrar o mover los hooks) tengan una prueba que falle hoy y pase después. Sin prometer más que «red de seguridad».

## 3. Usuarios y Actores

| Actor | Rol | Necesidad principal |
|---|---|---|
| Persona que usa Claude Code con Fragua | Dueña del proyecto | Que el guardián no se apague sin avisar por una ruta rota |
| Agente | Ejecuta herramientas | (no debe poder desactivar el guardián) |
| `fragua doctor` | Diagnóstico | Detectar un guardián mal registrado |
| Mantenedor | Mantiene el instalador | Que la ruta registrada sea correcta por construcción |

## 4. Historias de Usuario

### HU-001: Una ruta de hook que no resuelve bloquea
**Como** persona que usa Claude Code
**Quiero** que, si el guardián no se encuentra o no arranca, la herramienta no se ejecute
**Para** que una carpeta equivocada o un archivo borrado no desactiven la protección

**Criterios de aceptación:**
- [ ] **CA-001-01**: El comando que se registra para el guardián en Claude Code no depende del directorio de trabajo: se resuelve contra el directorio del proyecto que da el anfitrión. Una prueba toma el comando registrado de `.claude/settings.json` y de la plantilla instalada, lo ejecuta desde otra carpeta con un evento destructivo y obtiene exit 2. (P1)
- [ ] **CA-001-02**: Con el archivo del guardián ausente o ilegible, el comando registrado sale con exit 2 (no 1). Prueba: renombrar `pre-tool-guard.js` y ejecutar el comando registrado con un evento cualquiera. (P1)
- [ ] **CA-001-03**: Con `node` ausente del `PATH`, el comando registrado sale con exit 2 (no 127) o la alternativa registrada falla cerrado. Prueba con un `PATH` vacío. (P1)
- [ ] **CA-001-04**: La misma regla vale para la plantilla del plugin (`.claude-plugin/.claude/settings.json`) y para lo que escribe `fragua init` (`instalar.js`): una prueba de consistencia falla si algún registro del guardián usa una ruta relativa al cwd. (P1)
- [ ] **CA-001-05**: Los demás hooks (memoria, convenciones) no cambian de comportamiento: su fallo sigue siendo no bloqueante. (P2)

### HU-002: `doctor` detecta un guardián que no resuelve
**Como** persona que diagnostica su instalación
**Quiero** que `fragua doctor` compruebe que el comando registrado se puede ejecutar
**Para** enterarme antes de depender de un guardián apagado

**Criterios de aceptación:**
- [ ] **CA-002-01**: `doctor` ejecuta el comando registrado del guardián con un evento inocuo desde otra carpeta y cuenta como problema (salida distinta de 0) si no responde con exit 0 a un evento benigno y exit 2 a uno destructivo de prueba. (P1)
- [ ] **CA-002-02**: Si el guardián está registrado pero no resuelve, `doctor` dice en una línea qué ruta falló y cómo corregirla. (P2)
- [ ] **CA-002-03**: `doctor` distingue «registrado» de «funciona»: hoy imprime ✓ solo por encontrar la cadena `pre-tool-guard` (`doctor.js:436-445`). (P1)

### HU-003: Los rodeos conocidos tienen prueba
**Como** mantenedor
**Quiero** una prueba por cada rodeo conocido que hoy esquiva el guardián
**Para** que no vuelvan a abrirse sin que falle la suite

**Criterios de aceptación:**
- [ ] **CA-003-01**: Una orden que cambia de carpeta (`cd`) y luego escribe, borra o mueve con ruta relativa un archivo protegido (`.claude/settings.json`, `claude-hooks/*`, `.claude/hooks/*`, `.sdd/aprobaciones.jsonl`, `.sdd/execution-level.json`) se bloquea con exit 2; si no es posible resolverla, se bloquea por defecto (falla cerrado) en vez de pasar. (P1)
- [ ] **CA-003-02**: Borrar o mover los archivos del guardián con `rm`, `mv`, `Remove-Item`, `del` o un intérprete con código en línea se bloquea con exit 2, en forma absoluta, relativa y con `..`. (P1)
- [ ] **CA-003-03**: `Grep` con `path` o `glob` sobre `.env*` (salvo `.env.example`) se bloquea con exit 2; hoy pasa (`pre-tool-guard.js:374-376`, a confirmar con una prueba que primero falle). (P1)
- [ ] **CA-003-04**: Los casos de `tests/evals/casos-guardian.json` siguen bloqueando (sin regresión). (P1)

### HU-004: Se dice lo que no se cierra
**Como** persona que decide cuánto fiarse del guardián
**Quiero** que la documentación diga qué cubre y qué no
**Para** no tomar una red de seguridad por un límite

**Criterios de aceptación:**
- [ ] **CA-004-01**: `SECURITY.md` y `docs/hooks.md` indican que el guardián es consultivo fuera de Claude Code, que algunas herramientas fallan abierto y que Kiro no lo tiene (plan §3.9, `docs/limitations.md:44-45`). [NV] el texto actual de esos documentos. (P2)
- [ ] **CA-004-02**: La tabla «Estado de la mitigación» de `docs/informes/SEGURIDAD-CIBER.md` (C-07: «Parcial», `:223`) se actualiza al estado real tras la corrección. (P2)

## 5. Escenarios de Uso

### Escenario 1: Caso feliz
**Dado** un proyecto con el guardián instalado y Claude Code lanzado desde la raíz
**Cuando** el agente pide una orden benigna
**Entonces** el guardián responde exit 0 y la orden se ejecuta.

### Escenario 2: Caso de error
**Dado** Claude Code lanzado desde una subcarpeta del proyecto (o con `claude-hooks/` movido)
**Cuando** el agente pide cualquier herramienta
**Entonces** el comando del guardián no puede cargar su script y sale con exit 2: la herramienta se bloquea y el mensaje dice cómo repararlo (`fragua doctor`).

### Escenario 3: Caso borde
**Dado** un agente que ejecuta `cd .claude && rm -f hooks/pre-tool-guard.js`
**Cuando** el guardián evalúa la orden
**Entonces** la bloquea o, si no puede resolver el destino, la bloquea igual (falla cerrado).

## 6. Requisitos Funcionales

- **RF-001**: El sistema DEBE registrar el guardián con un comando cuyo fallo de arranque o de resolución equivalga a bloquear (exit 2).
- **RF-002**: El sistema DEBE comprobar en `doctor` que el comando registrado funciona, no solo que existe.
- **RF-003**: El sistema DEBE bloquear las órdenes que esquivan la protección de los archivos del guardián mediante cambio de carpeta, rutas relativas, borrado o movimiento.
- **RF-004**: El sistema DEBE fallar cerrado cuando no pueda resolver el destino de una orden que parece escribir en una ruta crítica.
- **RF-005**: El sistema NO DEBE prometer protección frente a un agente que ejecute código arbitrario con el mismo usuario (límite ya declarado).
- **RF-006**: El sistema NO DEBE bloquear herramientas legítimas por una ruta que no resuelve en los hooks no críticos (memoria, convenciones).

## 7. Requisitos No Funcionales

| Categoría | Requisito | Métrica |
|---|---|---|
| Seguridad | Falla cerrado en todo arranque fallido del guardián en Claude Code | Pruebas CA-001-01 a CA-001-03 con exit 2 |
| Compatibilidad | Windows, Linux y macOS | La prueba corre en ambos jobs de la CI (en Windows el comando registrado se ejecuta con el intérprete de comandos de Claude Code; [NV] su sintaxis para variables) |
| Rendimiento | Sin coste perceptible por herramienta | [NV] sin medir; el hook ya corre por cada herramienta |

## 8. Fuera de Alcance (Exclusiones Explícitas)

- ❌ Un analizador completo de bash o PowerShell (es red de seguridad; la defensa principal es `permissions.deny` y el sandbox).
- ❌ El comportamiento de las demás herramientas (Cursor, Gemini, Codex, Windsurf): se documenta, no se cierra aquí (spec `2026-11-11-guardian-fuera-de-claude-code`).
- ❌ C-06 (identidad del agente por variable), C-09 y C-11 (catálogo único de secretos) y la protección de `.sdd/estado.json`, salvo lo que ya cubra la spec `aprobacion-verificable-en-todos-los-caminos`.
- ❌ Separar la clave HMAC del alcance del agente.

## 9. Dependencias y Asunciones

### Dependencias
- `2026-11-06-guardian-endurecido` (borrador) y `2026-11-11-guardian-fuera-de-claude-code`.
- `docs/informes/PARCHE-HOOK-PENDIENTE.md`: el hook y `.claude/settings*` están protegidos para el agente; los cambios en esos archivos los hace el dueño, con `FORGE_EDITAR_GUARDIAN=1`.

### Asunciones
- [NECESITA_ACLARACION]: Claude Code expone `$CLAUDE_PROJECT_DIR` al comando de los hooks y trata un exit 2 como bloqueo y cualquier otro código distinto de 0 como error no bloqueante. Es lo que afirman los informes del repositorio; no se contrastó contra la documentación de Claude Code en esta redacción.
- Un registro con `.sh` (que ya falla cerrado) puede ser la alternativa si la sintaxis de variables no es portable a Windows. [NV] decisión de implementación; la spec solo exige el comportamiento (CA-001-01 a CA-001-03).

## 10. Términos del Dominio

- **Falla abierto / cerrado**: ante un error, dejar pasar la acción / bloquearla.
- **Ruta anclada**: ruta resuelta contra el directorio del proyecto y no contra el directorio de trabajo actual.
- **Rodeo**: forma de esquivar una regla del guardián sin que la regla lo vea.

## 11. Preguntas Abiertas

- [ ] [POR_DECIDIR]: forma del registro (`node "$CLAUDE_PROJECT_DIR/…"` o el `.sh`) y qué hacer en Windows sin shell POSIX.
- [ ] [POR_DECIDIR]: ¿se incluye `Grep`/`Glob` sobre `.env` (CA-003-03) en esta spec o en una de C-04? Se propone aquí por ser la misma clase (herramienta que el hook no inspecciona).
- [ ] [POR_DECIDIR]: con la ruta anclada, ¿cómo conviven los hooks no críticos (memoria) que no deben bloquear si fallan?

## 12. Criterios de Éxito Medibles

- 0 registros del guardián en Claude Code con ruta relativa al cwd (prueba de consistencia sobre `.claude/settings.json`, la plantilla del plugin y lo que escribe `init`).
- 3 fallos de arranque (ruta, archivo ausente, `node` ausente) que hoy salen con 1 o 127 y después con 2.
- 100 % de los casos de `tests/evals/casos-guardian.json` en bloqueo.

## 13. Referencias

- `reports/Plan consolidado de modos y componentes Forja.md` (§3.3 M2, §5 fase 2d, §8.2: «C-07 del guardián: el estado posterior a 2026-11-07 es [NV]»).
- `docs/informes/SEGURIDAD-CIBER.md` (C-07, `:128`, `:223`), `docs/informes/REVERIFICACION-SEGURIDAD.md` (`:38-39`, `:69`, `:84`), `docs/informes/PARCHE-HOOK-PENDIENTE.md` (§4).
- `claude-hooks/pre-tool-guard.js`, `claude-hooks/pre-tool-guard.sh`, `.claude/settings.json`, `.claude-plugin/.claude/settings.json`, `cli/comandos/instalar.js`, `cli/comandos/doctor.js`, `core/evidencia/guardian-reglas.js`, `core/instalacion/hooks-anfitrion.js`.
- Constitución, Principio VI y `AGENTS.md` («NO degradar en silencio»).

## 14. Historial de Aclaraciones

| # | Categoría | Pregunta | Decisión | Fecha |
|---|-----------|----------|----------|-------|
| – | – | Sin aclaraciones todavía | – | – |
