---
id: 2026-10-13-renombrar-a-fragua
titulo: "El proyecto pasa a llamarse Fragua, sin romper a quien ya usa FORGE"
tamano: mediano  # micro | pequeño | mediano | grande
estado: en_implementacion  # borrador | en_revision | aprobada | en_implementacion | completada
creada: 2026-10-13
actualizada: 2026-10-13
autor: humano  # humano | importado
constitucion_version: 1.1.0
etiquetas: [nombre, compatibilidad, publicacion]
---

# Especificación: Renombrar el proyecto a Fragua

> **Estado: en implementación por instrucción del dueño (2026-10-13).** El dueño eligió el nombre y pidió empezar los cambios. La fase F1 está hecha. Las fases que tocan seguridad (F3, F4) y lo que solo puede hacer el dueño (F6) esperan a que responda las preguntas abiertas.

## 1. Contexto y Motivación

El comando `forge` y el nombre «Forge» chocan con otra herramienta de código con IA (forgecode, cuyo comando también es `forge` y que figura con la clave `forge` en la lista de integraciones de Spec Kit; consultado el 2026-10-13). El propio README avisa de que `npx forge` descarga otro paquete. Publicar con ese nombre confunde al instalar y al buscar.

El dueño eligió **Fragua** (2026-10-13). En npm, `fragua` y `fragua-cli` estaban libres ese día; no se comprobaron marcas registradas, dominios ni organizaciones de GitHub.

El nombre actual está en unos 300 archivos, 28 variables de entorno `FORGE_*`, la carpeta de estado del usuario (`…/forge/integraciones/`), las etiquetas de los contenedores (`forge.sandbox=1`) y el paquete `forja-mvp`. Varias de esas piezas son de seguridad: un cambio descuidado puede dejar dos nombres capaces de fijar la misma política, o dejar inservible la cola de aprobaciones firmada.

## 2. Objetivo

Que el proyecto, el paquete y el comando se llamen Fragua **antes de publicar la 5.0**, que todo lo que hoy funciona con el nombre antiguo siga funcionando durante al menos una versión, y que el cambio no abra ninguna vía para relajar una política de seguridad.

## 3. Usuarios y Actores

| Actor | Rol | Necesidad principal |
|---|---|---|
| Usuario nuevo | Instala por primera vez | Un solo nombre, sin confusión con otra herramienta |
| Usuario actual | Tiene FORGE 4.x instalado | Que sus órdenes, su configuración y sus variables sigan valiendo |
| Usuario de integraciones | Tiene cola de aprobaciones y clave local | No perder lo pendiente ni tener que volver a aprobar |
| Dueño | Publica | Nombre libre y repositorio coherente |

## 4. Historias de Usuario

### HU-001: El comando nuevo
**Como** usuario
**Quiero** usar `fragua`
**Para** no chocar con otra herramienta

**Criterios de aceptación:**
- [x] **CA-001-01**: `fragua` es una orden del paquete y apunta al mismo programa que `forge`. (P1) — *F1, `package.json`, `tests/integration.test.js`.*
- [x] **CA-001-02**: `forge` y `sdd-es` siguen funcionando igual. (P1) — *F1.*
- [ ] **CA-001-03**: Los mensajes y la ayuda nombran la orden con la que se invocó el programa, y los ejemplos nuevos usan `fragua`. (P2)
- [ ] **CA-001-04**: Al invocar `forge`, un aviso de una línea, una vez por sesión de terminal como máximo y nunca con `--json` ni en una salida no interactiva, dice que el nombre nuevo es `fragua`. (P2)

### HU-002: El paquete
**Como** usuario nuevo
**Quiero** instalar un paquete llamado como el proyecto
**Para** encontrarlo

**Criterios de aceptación:**
- [ ] **CA-002-01**: El paquete se publica con el nombre que decida el dueño (pregunta abierta 1). (P1)
- [ ] **CA-002-02**: `forja-mvp` no se abandona en silencio: su siguiente versión, o su aviso de obsolescencia en npm, indica el paquete nuevo. Publicar y marcar como obsoleto son acciones del dueño. (P1)
- [ ] **CA-002-03**: Las pruebas que fijan el nombre del paquete y el kit de pruebas independientes usan el nombre nuevo desde un solo sitio. (P1)

### HU-003: Las variables de entorno, sin relajar ninguna política
**Como** usuario actual
**Quiero** que mis variables `FORGE_*` sigan valiendo
**Para** no reconfigurar mi entorno

**Criterios de aceptación:**
- [ ] **CA-003-01**: Cada variable tiene un nombre nuevo `FRAGUA_*` y el antiguo `FORGE_*` se sigue aceptando. La lectura pasa por una sola función. (P1)
- [ ] **CA-003-02**: Si las dos formas de una misma variable están definidas con valores distintos, el programa **se detiene con un error** que nombra las dos; no elige una. (P1)
- [ ] **CA-003-03**: Para las variables de política (`…_INTEGRACIONES`, `…_INTEGRACIONES_HOSTS`, `…_ESCRITURA`, `…_DESTINOS`, `…_RUNTIMES_PERMITIDOS`, `…_HOME`, `…_NIVEL_MAXIMO`, `…_BUDGET_USD`), una prueba por variable demuestra que ninguna combinación de los dos nombres produce una política más permisiva que la de cualquiera de ellos por separado. (P1)
- [ ] **CA-003-04**: Los nombres de variables de token que el usuario elige (`*_token_env`) aceptan los prefijos `FRAGUA_` y `FORGE_`, y ningún otro. (P1)
- [ ] **CA-003-05**: Las variables siguen leyéndose solo del entorno del usuario, nunca de un archivo del proyecto. (P1)

### HU-004: El estado del usuario
**Como** usuario de integraciones
**Quiero** conservar mi cola de aprobaciones y mi clave local
**Para** no perder lo pendiente

**Criterios de aceptación:**
- [ ] **CA-004-01**: Una instalación nueva guarda el estado en una carpeta `fragua`. (P1)
- [ ] **CA-004-02**: Si existe estado en la carpeta antigua y no en la nueva, se sigue usando la antigua. No se copia ni se mueve ninguna clave de forma automática. (P1)
- [ ] **CA-004-03**: Si existen las dos, se usa la nueva y `doctor` avisa de que hay estado antiguo sin usar. (P2)
- [ ] **CA-004-04**: Las comprobaciones existentes (estado fuera del proyecto, ruta absoluta, sin enlaces) valen igual para las dos carpetas. (P1)

### HU-005: Contenedores y restos
**Como** usuario actual
**Quiero** que el barrido de restos encuentre lo que dejó la versión anterior
**Para** no acumular contenedores ni copias

**Criterios de aceptación:**
- [ ] **CA-005-01**: Los contenedores nuevos llevan la etiqueta nueva; el barrido de huérfanos reconoce la nueva y la antigua. (P1)
- [ ] **CA-005-02**: El prefijo de rama de las propuestas (`forge/`) y el marcador de los comentarios publicados no cambian en esta entrega: cambiarlos rompería la detección de duplicados de lo ya publicado. (P1)

### HU-006: Documentación y repositorio
**Como** usuario nuevo
**Quiero** leer un solo nombre
**Para** no dudar de qué instalar

**Criterios de aceptación:**
- [ ] **CA-006-01**: README, guía, primeros pasos y ayuda usan Fragua; una sección corta explica el cambio y la equivalencia con FORGE. (P1)
- [ ] **CA-006-02**: Los documentos históricos (planes, ADR, revisiones, evidencia) **no se reescriben**: llevan una nota al principio del índice que explica el cambio. (P1)
- [ ] **CA-006-03**: Los 39 comandos y las 31 skills conservan sus nombres (`sdd.*`); solo cambia el texto que nombra al producto. (P1)
- [ ] **CA-006-04**: Renombrar el repositorio de GitHub es una acción del dueño; el plan indica qué enlaces actualizar después. (P2)

## 5. Escenarios de Uso

### Escenario 1: Usuario nuevo
Instala el paquete nuevo, ejecuta `fragua init` y `fragua doctor`. No ve «forge» salvo en la nota de equivalencia.

### Escenario 2: Usuario actual
Actualiza. Sigue escribiendo `forge run`; funciona y un aviso breve le dice el nombre nuevo. Sus variables `FORGE_*` siguen valiendo.

### Escenario 3: Las dos variables
`FORGE_INTEGRACIONES_ESCRITURA=github` y `FRAGUA_INTEGRACIONES_ESCRITURA=github,gitlab`: el programa se detiene y nombra las dos. No se concede escritura a ninguna plataforma.

### Escenario 4: Aprobaciones pendientes
Un usuario con tres publicaciones pendientes actualiza: siguen en la carpeta antigua, firmadas con la misma clave, y se pueden aprobar.

## 6. Requisitos Funcionales

| ID | Requisito | Prioridad |
|---|---|---|
| RF-01 | Orden `fragua` | P1 (hecho) |
| RF-02 | Una función única de lectura de entorno con nombre nuevo, alias antiguo y error ante conflicto | P1 |
| RF-03 | Resolución de la carpeta de estado con la regla de HU-004 | P1 |
| RF-04 | Etiqueta nueva de contenedor y barrido de las dos | P1 |
| RF-05 | Nombre del producto en un solo sitio, usado por la ayuda y los mensajes | P2 |
| RF-06 | Nombre del paquete nuevo | P1 |

## 7. Requisitos No Funcionales

| ID | Requisito |
|---|---|
| RNF-01 | Ninguna política de seguridad queda más permisiva (falla cerrado ante conflicto) |
| RNF-02 | Compatibilidad con el nombre antiguo durante al menos una versión mayor |
| RNF-03 | Sin dependencias nuevas |
| RNF-04 | La suite completa pasa en cada fase, en Windows y en Linux |
| RNF-05 | Honestidad documental: no se reescribe la historia |

## 8. Fuera de Alcance (Exclusiones Explícitas)

- Renombrar la carpeta `.sdd/`, `sdd.config.yaml` y los comandos `sdd.*`.
- Cambiar el prefijo de rama `forge/` y los marcadores de lo ya publicado.
- Reescribir documentos históricos.
- Registrar marcas o dominios.
- Renombrar archivos internos del código que no ve el usuario.

## 9. Dependencias y Asunciones

### Spikes obligatorios antes de F3 y F4
- **S0.1** Inventario de todas las lecturas de `process.env.FORGE_*` y de parámetros `env` en el código, con archivo y línea, y clasificación en política, configuración y pruebas.
- **S0.2** Inventario de todos los sitios donde aparece la carpeta de estado, la etiqueta de contenedor y el nombre del paquete como dato (no como texto).
- **S0.3** Comprobar en npm el nombre final el día de publicar, y que npm no lo rechace por parecido con otro.

### Dependencias
- `package.json`, `cli/index.js`, `core/integraciones/estado-usuario.js`, `core/integraciones/config.js`, `core/sandbox/politica.js`, `core/ciclo/config.js`, `core/llm-providers/index.js`, `scripts/pruebas-independientes.mjs`, pruebas que fijan nombres.

### Asunciones
- El nombre sigue libre cuando se publique.
- Nadie depende de `forja-mvp` por programa (no exporta una API pública).

## 10. Capas de seguridad

| Riesgo | Control |
|---|---|
| Dos nombres para una misma política: un atacante que controle una variable añade permisos | Conflicto entre las dos formas es un error; prueba por cada variable de política |
| Un repositorio hostil aprovecha el alias | Las variables siguen saliendo solo del entorno del usuario; se añade a la batería de proyecto hostil |
| Migración automática de la clave local | No hay migración: se usa la carpeta que exista |
| El barrido deja contenedores con la etiqueta antigua | Barrido de las dos etiquetas |
| Paquete con nombre parecido publicado por un tercero | Comprobación el día de publicar; el aviso en `forja-mvp` apunta al nombre exacto |

Las fases F3 y F4 necesitan una revisión independiente antes de fusionar, como las anteriores.

## 11. Términos del Dominio

- **Fragua:** nombre del proyecto, del paquete y de la orden.
- **Alias:** nombre antiguo que se sigue aceptando.

## 12. Preguntas Abiertas

| # | Pregunta | Recomendación |
|---|---|---|
| 1 | Nombre exacto del paquete en npm: `fragua` o con ámbito (`@<organización>/fragua`) | `fragua` si sigue libre; decidirlo el día de publicar |
| 2 | ¿Se renombra el repositorio de GitHub? | Sí, después de fusionar a `main`; GitHub redirige el enlace antiguo |
| 3 | ¿Hasta qué versión se aceptan `forge`, `sdd-es` y `FORGE_*`? | Toda la serie 5.x; retirarlos, si acaso, en la 6.0 con aviso previo |
| 4 | ¿El aviso al usar `forge` se muestra desde la primera versión? | Sí, discreto y nunca en salidas para máquinas |
| 5 | ¿Se comprueba marca registrada y dominio antes de publicar? | Es decisión y gestión del dueño; no la puede hacer un agente |

## 13. Criterios de Éxito Medibles

- Un usuario nuevo completa instalación y primera ejecución sin escribir «forge».
- Las pruebas actuales pasan sin cambiar su intención, con el nombre antiguo.
- Cero combinaciones de variables que amplíen una política (prueba automática).

## 14. Referencias

- `PLAN-MAESTRO.md` (riesgo de nombre, decisiones del dueño).
- Forge (forgecode): https://github.com/antinomyhq/forge
- Spec Kit, integraciones: https://github.com/github/spec-kit/blob/main/docs/reference/integrations.md

## 15. Historial de Aclaraciones

- 2026-10-13: el dueño elige Fragua y pide empezar. F1 hecha el mismo día.
