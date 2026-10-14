---
id: 2026-10-13-verificar-sin-modelo
titulo: "forge verificar: veredicto aislado sobre el código y las pruebas que ya existen, sin llamar a un modelo"
tamano: mediano  # micro | pequeño | mediano | grande
estado: borrador  # borrador | en_revision | aprobada | en_implementacion | completada
creada: 2026-10-13
actualizada: 2026-10-13
autor: humano  # humano | importado
constitucion_version: 1.1.0
etiquetas: [verificacion, sandbox, agnostico, mutacion]
---

# Especificación: `forge verificar`

> **Estado: borrador.** Redactada por un agente por encargo del dueño (2026-10-13); **no está aprobada** y no se implementa hasta que el dueño la apruebe (Principio II). Corresponde al incremento I3 de `PLAN-INCREMENTAL.md`.

## 1. Contexto y Motivación

Lo que distingue a FORGE es que el veredicto lo da el código de salida de las pruebas, ejecutadas en un contenedor sin red, y no la opinión de un modelo. Hoy esa garantía solo se obtiene pasando por el ciclo entero (`forge run`), que además escribe las pruebas y el código con sus propios agentes.

Quien ya escribe el código con otra herramienta no puede usar solo la parte que le falta. Aider cubre el caso simple con `--test-cmd` (consultado el 2026-10-13): ejecuta el comando del usuario y trata la salida distinta de cero como fallo, pero en el equipo del usuario, sin aislamiento. La investigación de mercado (`docs/MERCADO-CLASIFICACION.md`) recomienda ofrecer FORGE como capa de verificación compatible con otros flujos.

La pieza ya existe: `SandboxRunner.test(cwd)` (`core/sandbox/sandbox-runner.js:143`) copia el proyecto, prepara la imagen, ejecuta el comando de pruebas sin red y devuelve el código de salida. Falta un comando que la ofrezca sola.

## 2. Objetivo

Un comando que, **sin llamar a ningún modelo y sin gastar**, ejecute las pruebas de un proyecto en el mismo aislamiento que el ciclo, devuelva un veredicto determinista con evidencia y, si se pide, mida la calidad de esas pruebas por mutación.

## 3. Usuarios y Actores

| Actor | Rol | Necesidad principal |
|---|---|---|
| Desarrollador con otra herramienta | Escribe código con cualquier asistente | Saber si pasa, sin ejecutar código generado en su equipo |
| Otra herramienta o agente | Invoca el comando y lee el resultado | Una salida estable y legible por máquina |
| Integración continua | Ejecuta el comando en un pipeline | Código de salida fiable |
| Revisor | Lee el resultado | Evidencia: qué se ejecutó, con qué imagen y qué salió |

## 4. Historias de Usuario

### HU-001: Verificar un proyecto que nunca usó FORGE
**Como** desarrollador con otra herramienta
**Quiero** ejecutar `forge verificar` en mi proyecto
**Para** obtener un veredicto sin instalar el flujo de FORGE

**Criterios de aceptación:**
- [ ] **CA-001-01**: `forge verificar [--cwd <dir>]` funciona en un proyecto sin `.sdd/` ni `sdd.config.yaml`: detecta el lenguaje y el comando de pruebas con los detectores que ya usa el ciclo. (P1)
- [ ] **CA-001-02**: `--comando "<comando de pruebas>"` sustituye al detectado. El comando se ejecuta sin intérprete de órdenes: no hay encadenamiento ni redirecciones, y así se documenta. (P1)
- [ ] **CA-001-03**: El comando **no llama a ningún proveedor de modelo ni lee ninguna clave de API**. Una prueba lo comprueba interceptando la red y el entorno. (P1)
- [ ] **CA-001-04**: Las pruebas corren solo en el contenedor, sin red, con los límites y el mecanismo de aislamiento de `sandbox.*`. El proyecto real no se modifica: el contenedor ve una copia. (P1)
- [ ] **CA-001-05**: Sin Docker, el comando termina con el código 4 y un mensaje que dice qué falta. **No existe una opción para ejecutar sin aislamiento.** (P1)
- [ ] **CA-001-06**: Si el lenguaje no está entre los admitidos por el ciclo, termina con un mensaje claro y código 1, sin ejecutar nada. (P1)

### HU-002: Veredicto estable y legible por máquina
**Como** otra herramienta
**Quiero** una salida con forma fija
**Para** decidir qué hacer sin interpretar texto libre

**Criterios de aceptación:**
- [ ] **CA-002-01**: Códigos de salida: 0 las pruebas pasan; 1 fallan o no se ejecutó ninguna; 4 sin aislamiento o fallo de infraestructura. Coinciden con los de `forge run` (`core/engine-cli.js:43`). (P1)
- [ ] **CA-002-02**: `--json` escribe en la salida estándar un solo objeto con: veredicto, código de salida de las pruebas, comando ejecutado, lenguaje, imagen, duración, si hubo corte por tiempo o por memoria, y la salida de las pruebas acotada y redactada. (P1)
- [ ] **CA-002-03**: «Cero pruebas ejecutadas» no cuenta como éxito, con la misma regla que el ciclo (`core/ciclo/router.js`, `sinPruebasEjecutadas`). (P1)
- [ ] **CA-002-04**: La salida de las pruebas se redacta de secretos antes de mostrarse o guardarse (`core/ciclo/redactar.js`). (P1)
- [ ] **CA-002-05**: El objeto lleva un campo de versión del formato. (P2)

### HU-003: Medir la calidad de las pruebas
**Como** revisor
**Quiero** saber si las pruebas detectarían un cambio en el código
**Para** no fiarme de pruebas que pasan siempre

**Criterios de aceptación:**
- [ ] **CA-003-01**: `--mutacion` mide la detección con la medición propia del ciclo (ADR-20) sobre los archivos indicados con `--archivos` o, sin indicar, sobre los cambiados respecto a una referencia de git que se pasa con `--desde`. (P1)
- [ ] **CA-003-02**: Sin `--archivos` ni `--desde`, `--mutacion` se rechaza con un mensaje que explica las dos opciones. No se muta el proyecto entero. (P1)
- [ ] **CA-003-03**: `--mutacion-minima <0..1>` hace que el comando termine con código 1 si la detección queda por debajo; sin ella, la mutación solo se informa. (P1)
- [ ] **CA-003-04**: Con menos mutantes concluyentes que `mutacion_min_concluyentes`, el resultado es «no concluyente» y, con `--mutacion-minima`, el código es 1 (falla cerrado), igual que el modo `exigir`. (P1)
- [ ] **CA-003-05**: El informe declara el límite conocido: un adversario deliberado puede imitar la señal de aserción (`docs/PROBLEMAS-CONOCIDOS.md`). (P2)

### HU-004: Evidencia
**Como** revisor
**Quiero** que quede registro de la verificación
**Para** poder citarla

**Criterios de aceptación:**
- [ ] **CA-004-01**: Con `--registrar`, el resultado se añade a `.sdd/events.jsonl` y se guarda en `.sdd/verificaciones/<id>.json`. Sin la opción no se crea nada en el proyecto. (P2)
- [ ] **CA-004-02**: Toda escritura pasa por `core/escritura-segura.js`. (P1)
- [ ] **CA-004-03**: Dos verificaciones simultáneas del mismo proyecto no se pisan: carpetas de trabajo distintas y, si comparten estado, el candado existente. (P1)

## 5. Escenarios de Uso

### Escenario 1: Caso feliz
`forge verificar` en un proyecto de Node con pruebas: imagen preparada, pruebas en el contenedor, salida 0.

### Escenario 2: Proyecto hostil
El proyecto trae un `package.json` cuyo script de pruebas intenta leer la carpeta personal y abrir una conexión. Corre en el contenedor sin red y sin acceso al equipo; el veredicto es el código de salida.

### Escenario 3: Sin Docker
Mensaje de qué falta y código 4. No se ejecuta nada en el equipo.

### Escenario 4: Pruebas que no prueban
`--mutacion --desde main --mutacion-minima 0.6` con pruebas que no afirman nada: detección baja, código 1.

## 6. Requisitos Funcionales

| ID | Requisito | Prioridad |
|---|---|---|
| RF-01 | Comando `forge verificar` con `--cwd`, `--comando`, `--json`, `--mutacion`, `--archivos`, `--desde`, `--mutacion-minima`, `--registrar` | P1 |
| RF-02 | Reutiliza `SandboxRunner`, los detectores de lenguaje y pruebas, el enrutador y la medición de mutación, sin copiar su lógica | P1 |
| RF-03 | Carga perezosa: el comando no importa proveedores de modelo ni integraciones | P1 |
| RF-04 | Barrido de copias y contenedores huérfanos al empezar, como el ciclo | P1 |
| RF-05 | Aparece en `forge --help` y en la guía | P2 |

## 7. Requisitos No Funcionales

| ID | Requisito |
|---|---|
| RNF-01 | Sin dependencias nuevas (Principio IV) |
| RNF-02 | Mismo aislamiento que el ciclo, sin opción de degradarlo (Principio V) |
| RNF-03 | Veredicto solo por código de salida y reglas fijas (Principio VI) |
| RNF-04 | Coste cero en modelos: no hay llamada posible (Principio VIII) |
| RNF-05 | Windows y Linux |

## 8. Fuera de Alcance (Exclusiones Explícitas)

- Corregir el código cuando falla: eso es `forge run`.
- Ejecutar sin Docker.
- Linters y formateadores.
- Lenguajes que el ciclo no admite (ADR-18).
- Exponer este comando por MCP: va en la especificación del ciclo por MCP, con su revisión de seguridad.
- Órdenes encadenadas en `--comando`.

## 9. Dependencias y Asunciones

### Spikes obligatorios antes de construir
- **S0.1** Confirmar leyendo el código que `medirMutacion` puede usarse fuera de un ciclo en curso: qué necesita del estado y qué hay que proporcionarle.
- **S0.2** Confirmar cómo se obtienen los archivos cambiados desde una referencia de git sin ejecutar nada del repositorio (ganchos, filtros, configuración local).

### Dependencias
- `core/sandbox/` (`SandboxRunner`), `core/stack-detector.js`, `core/pytest-deteccion.js`, `core/ciclo/router.js`, `core/ciclo/mutacion.js`, `core/ciclo/redactar.js`, `core/ciclo/candado.js`, `core/ciclo/config.js`.

### Asunciones
- La medición de mutación no depende del diario ni del presupuesto del ciclo; si depende, se limita el alcance de HU-003 y se documenta.

## 10. Capas de seguridad

| Riesgo | Control |
|---|---|
| El proyecto es de un tercero y sus pruebas son código hostil | Contenedor sin red, usuario sin privilegios, límites de CPU, memoria y procesos; el equipo solo comparte una copia |
| `--comando` como vía de inyección | Sin intérprete de órdenes; argumentos separados por `dividirComando` |
| `git` ejecuta ganchos o filtros del repositorio al calcular los cambios | Spike S0.2; invocación con la configuración del repositorio neutralizada, o lectura sin `git` |
| La salida de las pruebas contiene secretos | Redacción antes de mostrar y de guardar |
| Otra herramienta toma un «no concluyente» por éxito | Códigos de salida fijos y campo de veredicto explícito; cero pruebas no es éxito |

## 11. Términos del Dominio

- **Veredicto:** `pasa`, `falla`, `sin_pruebas`, `infraestructura`.
- **Verificación:** una ejecución de `forge verificar` y su evidencia.

## 12. Preguntas Abiertas

| # | Pregunta | Recomendación |
|---|---|---|
| 1 | ¿Nombre del comando: `verificar` o `comprobar`? | `verificar`, coherente con «ciclo verificado» |
| 2 | ¿`--registrar` activado por defecto cuando ya existe `.sdd/`? | No: explícito siempre |
| 3 | ¿Se ofrece también como paso reutilizable de integración continua? | Después de la primera entrega, cuando la CI de Linux esté en verde |

## 13. Criterios de Éxito Medibles

- Funciona en los cinco proyectos de `scripts/pruebas-independientes.mjs` sin clave de API.
- Cero llamadas de red y cero lecturas de claves (prueba automática).
- Un proyecto hostil de prueba no altera el equipo ni el proyecto original.

## 14. Referencias

- `PLAN-INCREMENTAL.md` (I3), `PLAN-ESCALADO.md` (E2.3), ADR-18, ADR-20.
- Aider, lint y pruebas: https://aider.chat/docs/usage/lint-test.html

## 15. Historial de Aclaraciones

- 2026-10-13: creada en borrador a partir de la investigación de herramientas parecidas.
