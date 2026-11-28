---
id: 2026-11-27-runner-falla-cerrado
titulo: "Runner falla cerrado: un lenguaje sin runner es un error con código propio, nunca `npm test`"
tamano: pequeño  # micro | pequeño | mediano | grande
estado: aprobada  # por delegación del dueño el 2026-11-28 (bloque MVP, respuesta «Aprobar bloque MVP por delegación»); pendiente de ratificación
creada: 2026-11-27
actualizada: 2026-11-27
autor: humano  # humano | importado
constitucion_version: 1.1.0
etiquetas: [nucleo, runners, falla-cerrado, plan-modos-fase-2a]
---

# Especificación: Runner falla cerrado

> **Estado: borrador, sin aprobar.** Punto 2a del «Plan consolidado de modos y componentes de Forja» (2026-11-27, §5 fase 2 y §6). La aprobación es del dueño del proyecto; ningún agente la marca. Orden de trabajo: spec aprobada → pruebas (una en rojo antes del arreglo) → código.

## 1. Contexto y Motivación

Cuando el motor no tiene un runner para el lenguaje detectado, hoy usa en silencio el de Node y ejecuta `npm test` sobre un proyecto que no es de Node. Eso rompe dos reglas del proyecto: «NO degradar en silencio» (`AGENTS.md`) y «el código generado no se ejecuta en el equipo anfitrión sin decirlo» (Principio V, mínimo M4 del plan). Un proyecto Java, Ruby, PHP, C#, Dart o sin manifiesto reconocido recibe un veredicto de un comando que no tiene que ver con su lenguaje, y puede recibirlo en verde.

**Comportamiento actual, verificado en el código (confirmado: el fallo existe hoy):**

- `core/runners/index.js:31-32`: el `default` del `switch` de `runnerForStack` devuelve `createNodeRunner(cwd)`. Solo `typescript`, `javascript`, `python`, `go` y `rust` tienen runner propio (`:22-30`).
- `core/stack-detector.js:138-169` detecta además `java`, `ruby`, `php` y `unknown` (y el tipo `Lenguaje` declara `csharp` y `dart`, `:9`): todos caen en el `default`. `NodeRunner` usa `npm test` por defecto (`core/runners/node-runner.js:13`). [NV] el resto de `createNodeRunner` (`node-runner.js:73` en adelante) no se leyó entero.
- `core/engine-cli.js:131` llama a `runnerForStack` dentro de `buildDeps`, que usan también `status` y `resume` (`:288`, `:300`), no solo `run`.
- El runner solo se usa de verdad en el motor clásico: `core/orchestrator.js:179-182` y `:269` (`this.options.runner`). En el ciclo verificado, un lenguaje sin imagen ya se rechaza antes: `core/sandbox/preparar-imagen.js:56-58` (`comprobarProyecto`) y `core/engine-cli.js:169-171` (`comprobarEntorno` y `err(...)`, salida 1).
- Los códigos de salida del motor son 0, 1, 3 y 4 (cabecera `core/engine-cli.js:10` y objeto `SALIDA` en `:42`).

## 2. Objetivo

Que un lenguaje sin runner detenga la ejecución con un error claro y un código de salida propio, y que nunca se ejecute `npm test` (ni ningún comando de otro lenguaje) sobre un proyecto que no es de Node.

## 3. Usuarios y Actores

| Actor | Rol | Necesidad principal |
|---|---|---|
| Persona con un proyecto Java, Ruby, PHP u otro sin runner | Usuaria de `fragua run --motor clasico` | Saber que su lenguaje no está soportado, en vez de recibir un veredicto de `npm test` |
| Motor y guiones de CI | Consumen el código de salida | Distinguir «lenguaje no soportado» de un fallo de pruebas |
| Mantenedor | Añade lenguajes | Que añadir uno sea explícito y que olvidarlo nunca degrade en silencio |

## 4. Historias de Usuario

### HU-001: Un lenguaje sin runner no cae en Node
**Como** persona que usa el motor clásico
**Quiero** que se detenga si mi lenguaje no tiene runner
**Para** no recibir un veredicto de `npm test` sobre un proyecto que no es de Node

**Criterios de aceptación:**
- [ ] **CA-001-01**: `runnerForStack` con un lenguaje fuera de {`typescript`, `javascript`, `python`, `go`, `rust`} (por ejemplo `java`, `ruby`, `php`, `csharp`, `dart`, `unknown`) lanza un error de una clase propia, con el lenguaje recibido, y no devuelve un `NodeRunner`. (P1)
- [ ] **CA-001-02**: Un proyecto Java de prueba (con `pom.xml`) lanzado con `--motor clasico` sale con un código de salida propio, distinto de 0, 1, 3 y 4, y no ejecuta `npm test` (comprobable porque un `npm` falso en el `PATH` no se invoca). (P1)
- [ ] **CA-001-03**: Los cinco lenguajes con runner siguen devolviendo el mismo tipo de runner que hoy (prueba de caracterización escrita antes del cambio). (P1)
- [ ] **CA-001-04**: La decisión de parar se toma por la clase del error, no por buscar texto en el mensaje (Principio VI). (P1)

### HU-002: El error es claro y bilingüe
**Como** persona que ve el error
**Quiero** un mensaje que diga qué lenguaje se detectó, cuáles se soportan y qué puedo hacer
**Para** no tener que leer el código

**Criterios de aceptación:**
- [ ] **CA-002-01**: El mensaje nombra el lenguaje detectado, lista los lenguajes con runner y dice que no se ejecutó nada. Sale en español y en inglés. (P1)
- [ ] **CA-002-02**: El código de salida nuevo figura en la cabecera y en `SALIDA` de `core/engine-cli.js` (`:10`, `:42`; donde hoy están 0, 1, 3 y 4) y en la documentación de uso. (P2)

### HU-003: Los comandos que no necesitan runner no se rompen
**Como** persona con un proyecto en un lenguaje sin runner
**Quiero** poder seguir usando `status`
**Para** que el error aparezca solo cuando de verdad se iba a ejecutar algo

**Criterios de aceptación:**
- [ ] **CA-003-01**: `status` en un proyecto Java sale con 0 y no lanza el error de runner. (P1)
- [ ] **CA-003-02**: `run --motor ciclo` en un proyecto Java sigue rechazándose en `comprobarProyecto` con su mensaje y salida actuales (sin regresión). (P1)

## 5. Escenarios de Uso

### Escenario 1: Caso feliz
**Dado** un proyecto TypeScript
**Cuando** se ejecuta `fragua run --motor clasico`
**Entonces** se usa el runner de Node como hoy.

### Escenario 2: Caso de error
**Dado** un proyecto con `pom.xml` y `--motor clasico`
**Cuando** el motor va a crear el runner
**Entonces** se detiene con el código propio, sin ejecutar `npm test` ni llamar a ningún modelo.

### Escenario 3: Caso borde
**Dado** un directorio sin ningún manifiesto reconocido (`unknown`)
**Cuando** se ejecuta `fragua run --motor clasico`
**Entonces** es el mismo error: «sin lenguaje detectado» no es «Node».

## 6. Requisitos Funcionales

- **RF-001**: El sistema DEBE lanzar un error de clase propia cuando no hay runner para el lenguaje detectado.
- **RF-002**: El sistema DEBE salir con un código propio, distinto de 0, 1, 3 y 4, cuando ese error detiene `run` o `resume`.
- **RF-003**: El sistema DEBE crear el runner de forma perezosa o tolerar su ausencia en los comandos que no ejecutan pruebas (`status`).
- **RF-004**: El sistema NO DEBE ejecutar `npm test`, `npm install` ni ningún comando de otro lenguaje como sustituto.
- **RF-005**: El sistema NO DEBE añadir un runner nuevo en esta spec (añadir lenguajes es otra spec: `descriptor-de-lenguaje`).

## 7. Requisitos No Funcionales

| Categoría | Requisito | Métrica |
|---|---|---|
| Seguridad | Falla cerrado antes de ejecutar nada en el equipo anfitrión | Prueba con `npm` falso en el `PATH` que no se invoca |
| Compatibilidad | Los lenguajes con runner no cambian de comportamiento | Prueba de caracterización en verde antes y después |

## 8. Fuera de Alcance (Exclusiones Explícitas)

- ❌ Añadir runners para Java, Ruby, PHP, C# o Dart.
- ❌ Cambiar el rechazo del ciclo verificado (`comprobarProyecto`).
- ❌ El descriptor declarativo de lenguajes (spec `descriptor-de-lenguaje`, fase 8 del plan).

## 9. Dependencias y Asunciones

### Dependencias
- Plan consolidado de modos, fase 2a. Sin dependencia de otra spec.

### Asunciones
- El runner de `core/runners/` solo lo consume el motor clásico (`orchestrator.js`). [NV] no se buscaron consumidores en `skills/` ni en scripts fuera de `core/` y `cli/`.

## 10. Términos del Dominio

- **Runner**: objeto que instala, prueba, analiza y construye un proyecto en un lenguaje (`core/runners/runner.js`).
- **Falla cerrado**: ante un caso no previsto, se detiene en vez de continuar con otra cosa.

## 11. Preguntas Abiertas

- [ ] [POR_DECIDIR]: valor del código de salida propio (propuesta: 5; hoy 0, 1, 3 y 4). Debe quedar en `SALIDA` y en la documentación.
- [ ] [POR_DECIDIR]: ¿el error se lanza en `buildDeps` solo para `run` y `resume`, o en el primer uso del runner? Cualquiera cumple CA-003-01.

## 12. Criterios de Éxito Medibles

- 0 rutas del motor que ejecuten `npm test` sobre un lenguaje sin runner (prueba con proyecto Java y `npm` falso).
- 6 lenguajes sin runner cubiertos por la prueba (`java`, `ruby`, `php`, `csharp`, `dart`, `unknown`).

## 13. Referencias

- `reports/Plan consolidado de modos y componentes Forja.md` (§3.3 M4, §5 fase 2a, §6).
- `core/runners/index.js`, `core/stack-detector.js`, `core/engine-cli.js`, `core/orchestrator.js`, `core/sandbox/preparar-imagen.js`.
- `AGENTS.md` («NO degradar en silencio»), Principios V y VI de la constitución.

## 14. Historial de Aclaraciones

| # | Categoría | Pregunta | Decisión | Fecha |
|---|-----------|----------|----------|-------|
| – | – | Sin aclaraciones todavía | – | – |
