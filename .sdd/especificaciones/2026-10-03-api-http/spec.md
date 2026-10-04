---
id: 2026-10-03-api-http
titulo: "API HTTP local del ciclo verificado"
tamano: mediano  # micro | pequeño | mediano | grande
estado: en_implementacion  # borrador | en_revision | aprobada | en_implementacion | completada
creada: 2026-10-03
actualizada: 2026-10-03
autor: humano  # humano | importado
constitucion_version: 1.0.0
etiquetas: [api, http, seguridad]
---

# Especificación: API HTTP local del ciclo verificado

## 1. Contexto y Motivación

El ciclo verificado solo se maneja desde la terminal: lanzar, consultar y decidir una revisión exigen ejecutar comandos. Quien quiera integrarlo en otra herramienta (un panel, un script, un servicio local) no tiene una interfaz programable. El panel que ya existe es de solo lectura y responde a cualquier página web, por lo que no sirve de base para operaciones que escriben.

## 2. Objetivo

Un programa que se ejecuta en el mismo equipo puede lanzar el ciclo verificado, consultar su estado y decidir las revisiones pendientes mediante peticiones HTTP, sin que una página web abierta en el navegador del usuario pueda hacer lo mismo y sin que la API pueda ejecutar código generado fuera del entorno aislado.

## 3. Usuarios y Actores

| Actor | Rol | Necesidad principal |
|-------|-----|---------------------|
| Operador | Arranca la API y entrega el acceso a sus herramientas | Un comando, y un secreto que solo él conoce |
| Programa local | Cliente de la API | Operaciones claras y errores que pueda entender |
| Página web hostil | Atacante que el operador no controla | Intentar usar la API a través del navegador del operador |

## 4. Historias de Usuario

### HU-001: Que solo el operador pueda usar la API
**Como** operador
**Quiero** que solo mis programas puedan llamar a la API
**Para** que ni otra persona de la red ni una página web puedan lanzar tareas en mi equipo

**Criterios de aceptación:**
- [ ] **CA-001-01**: Toda petición exige un secreto que conoce el operador; sin él, o con otro, se rechaza, también en rutas que no existen. (P1)
- [ ] **CA-001-02**: Toda petición que venga de un navegador (la que lleva cabecera de origen) se rechaza, aunque lleve el secreto. (P1)
- [ ] **CA-001-03**: Toda petición dirigida a un nombre de servidor que no es el propio se rechaza. (P1)
- [ ] **CA-001-04**: La API no autoriza a ninguna página web: no emite cabeceras de acceso entre orígenes ni atiende las peticiones previas del navegador. (P1)
- [ ] **CA-001-05**: Solo es accesible desde el propio equipo. (P1)

### HU-002: Lanzar el ciclo
**Como** programa local
**Quiero** lanzar el ciclo verificado
**Para** construir las tareas sin abrir una terminal

**Criterios de aceptación:**
- [ ] **CA-002-01**: Una petición lanza el ciclo verificado y responde de inmediato con un identificador de ejecución. (P1)
- [ ] **CA-002-02**: La API nunca lanza el modo clásico ni ninguna opción que se salte las protecciones: el modo no se puede elegir. (P1)
- [ ] **CA-002-03**: Solo puede haber una ejecución a la vez; una segunda petición se rechaza, y la ejecución se puede consultar mientras corre y cuando termina, con el final de su salida sin secretos. (P1)
- [ ] **CA-002-04**: Las tareas que se envían se validan (identificadores, agentes, tamaños, campos permitidos); una tarea inválida no lanza nada. (P1)

### HU-003: Decidir las revisiones
**Como** programa local
**Quiero** decidir las tareas que esperan una persona
**Para** continuar, aceptar o abortar sin abrir una terminal

**Criterios de aceptación:**
- [ ] **CA-003-01**: Una petición con la decisión (y, si procede, las ampliaciones y la tarea) lanza la reanudación del ciclo. (P1)
- [ ] **CA-003-02**: Las decisiones inválidas (valor desconocido, números fuera de rango, tarea mal formada, campos no permitidos) se rechazan sin lanzar nada. (P1)
- [ ] **CA-003-03**: Los cuerpos hostiles (demasiado grandes, que no son JSON, de un tipo de contenido distinto o que no son un objeto) se rechazan con un error claro. (P1)
- [ ] **CA-003-04**: Los métodos y las rutas que no existen reciben el error estándar correspondiente. (P2)

### HU-004: Consultar el estado
**Como** programa local
**Quiero** saber en qué está el proyecto
**Para** mostrarlo o decidir qué hacer

**Criterios de aceptación:**
- [ ] **CA-004-01**: La consulta devuelve la etapa del proyecto, la sesión, cada tarea con su situación (y, si espera una decisión, el motivo y el detalle) y el gasto de la sesión. (P1)

## 5. Escenarios de Uso

### Escenario 1: Caso feliz
**Dado** una API en marcha y un secreto conocido
**Cuando** un programa lanza el ciclo, consulta el estado y decide una revisión pendiente
**Entonces** cada paso responde, y la ejecución termina con el código de salida de la terminal

### Escenario 2: Caso de error — página web hostil
**Dado** una página web abierta en el navegador del operador que conoce la dirección de la API
**Cuando** intenta lanzar una ejecución
**Entonces** se rechaza por llevar cabecera de origen, y no se lanza nada

### Escenario 3: Caso borde — rebinding de nombres
**Dado** un atacante que apunta su propio nombre de dominio a 127.0.0.1
**Cuando** el navegador del operador llama a la API con ese nombre
**Entonces** se rechaza por el nombre de servidor

### Escenario 4: Fallo de dependencia — sin entorno aislado
**Dado** un equipo sin Docker
**Cuando** se lanza el ciclo
**Entonces** la ejecución termina con el código de «aislamiento no disponible» y no se ejecuta nada en el equipo

### Escenario 5: Concurrencia
**Dado** una ejecución en curso
**Cuando** llega otra petición de lanzar o de decidir
**Entonces** se rechaza y se indica cuál está en curso

### Escenario 6: Datos extremos
**Dado** un cuerpo de 70 KB
**Cuando** se envía
**Entonces** se rechaza sin procesarlo

## 6. Requisitos Funcionales

- **RF-001**: El sistema DEBE exigir un secreto en toda petición, comparado en tiempo constante.
- **RF-002**: El sistema DEBE rechazar toda petición con cabecera de origen y toda con un nombre de servidor que no sea el propio.
- **RF-003**: El sistema NO DEBE emitir cabeceras de acceso entre orígenes.
- **RF-004**: El sistema DEBE escuchar solo en la interfaz local.
- **RF-005**: El sistema NO DEBE permitir elegir el modo de ejecución: siempre el ciclo verificado.
- **RF-006**: El sistema DEBE ejecutar como máximo una ejecución a la vez.
- **RF-007**: El sistema DEBE validar todo lo que recibe y rechazar lo desconocido.
- **RF-008**: El sistema NO DEBE revelar el secreto en ninguna respuesta, y DEBE redactar la salida de las ejecuciones.

## 7. Requisitos No Funcionales

| Categoría | Requisito | Métrica |
|-----------|-----------|---------|
| Seguridad | Una página web no puede operar la API | 0 peticiones con origen aceptadas en la suite |
| Seguridad | Sin dependencias nuevas | `package.json` sin cambios en `dependencies` |
| Robustez | Entradas hostiles | Cuerpos de 70 KB, JSON roto y tipos equivocados rechazados sin lanzar nada |
| Compatibilidad | Mismo comportamiento que la terminal | El código de salida de la ejecución se devuelve tal cual |

## 8. Fuera de Alcance (Exclusiones Explícitas)

- ❌ Acceso desde otras máquinas, TLS y usuarios múltiples
- ❌ Autenticación con usuarios, roles o caducidad del secreto
- ❌ Streaming de la salida en directo (se consulta por sondeo)
- ❌ Lanzar el modo clásico o cualquier opción que se salte las protecciones
- ❌ Sustituir el panel de solo lectura existente
- ❌ Limitar la frecuencia de peticiones fallidas

## 9. Dependencias y Asunciones

### Dependencias
- Especificación `2026-10-03-ciclo-verificado`: el comando `forge run|resume --motor ciclo` y su código de salida.

### Asunciones
- El operador y los programas que llaman a la API están en el mismo equipo y el mismo usuario del sistema.
- El secreto se entrega al arrancar, por la salida estándar, y no se guarda en disco.

## 10. Términos del Dominio

- **Secreto**: valor aleatorio que identifica a quien puede usar la API.
- **Ejecución**: un lanzamiento del ciclo o de una reanudación, que corre como un proceso aparte.

## 11. Preguntas Abiertas

- [ ] [POR_DECIDIR]: ¿Debe la API aceptar un límite de intentos fallidos? Hoy no (fuera de alcance).
- [ ] [POR_DECIDIR]: ¿Se guarda el secreto en un archivo con permisos restringidos para que lo lea un programa sin ver la salida del arranque?

## 12. Criterios de Éxito Medibles

- Los 14 criterios de aceptación tienen al menos un test.
- 0 dependencias nuevas.
- Un recorrido real lanza, consulta y decide un ciclo por HTTP.

## 13. Referencias

- `.sdd/arquitectura/ADR-13-api-http-separada-del-panel.md`
- `.sdd/especificaciones/2026-10-03-ciclo-verificado/`
- `PLAN-MOTOR-AGENTICO.md`, FASE 4
- `ui/server.js` (panel de solo lectura, con `Access-Control-Allow-Origin: *`)

## 14. Historial de Aclaraciones

| # | Categoría | Pregunta | Decisión | Fecha |
|---|-----------|----------|----------|-------|
| 1 | Proceso | ¿Se empieza S4 sin aprobación expresa? | Sí: el dueño pidió seguir con la fase siguiente sin preguntar. Aprobada por delegación | 2026-10-03 |
| 2 | Seguridad | ¿Se extiende el panel existente? | No: responde a cualquier origen. Una API que escribe va aparte (ADR-13) | 2026-10-03 |
| 3 | Seguridad | ¿Puede la API lanzar el modo clásico? | No: ejecutaría en el equipo el código que escribió un modelo | 2026-10-03 |
