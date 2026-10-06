---
id: 2026-10-03-saneamiento
titulo: "Saneamiento del motor y del instalador"
tamano: pequeño  # micro | pequeño | mediano | grande
estado: en_implementacion  # borrador | en_revision | aprobada | en_implementacion | completada
creada: 2026-10-03
actualizada: 2026-10-03
autor: humano  # humano | importado
constitucion_version: 1.0.0
etiquetas: [saneamiento, motor, instalador, windows]
---

# Especificación: Saneamiento del motor y del instalador

## 1. Contexto y Motivación

Al revisar FORGE para planificar el Motor Agéntico aparecieron defectos previos: órdenes de terminal que fallan nada más instalarse, una instalación que deja los hooks sin poder cargar, pruebas que no pasan en Windows y un motor que no entiende las tareas que genera la propia metodología. Mientras existan, ninguna mejora posterior se puede comprobar con fiabilidad.

## 2. Objetivo

Las órdenes de consulta de estado funcionan en una instalación limpia, la instalación deja los hooks operativos, el motor ejecuta las tareas generadas por la metodología y la suite de pruebas pasa completa también en Windows.

## 3. Usuarios y Actores

| Actor | Rol | Necesidad principal |
|-------|-----|---------------------|
| Operador | Instala y usa FORGE desde la terminal | Que las órdenes documentadas funcionen tras instalar |
| Colaborador | Desarrolla FORGE | Una suite de pruebas fiable en su sistema |

## 4. Historias de Usuario

### HU-001: Instalación que funciona
**Como** operador
**Quiero** que lo instalado funcione sin pasos manuales
**Para** empezar a usar FORGE de inmediato

**Criterios de aceptación:**
- [x] **CA-001-01**: Tras instalar en un proyecto, los hooks encuentran todos los archivos que necesitan. (P1)
- [x] **CA-001-02**: La consulta de estado funciona en una instalación sin paso de compilación. (P1)
- [x] **CA-001-03**: La lista de contenido del paquete no nombra carpetas inexistentes. (P2)

### HU-002: El motor entiende las tareas de la metodología
**Como** operador
**Quiero** ejecutar con el motor las tareas que generó la metodología
**Para** no tener que convertirlas a mano

**Criterios de aceptación:**
- [x] **CA-002-01**: El motor ejecuta las tareas pendientes de la especificación activa tal como las deja la metodología. (P1)
- [x] **CA-002-02**: El motor reconoce la especificación activa con cualquiera de los dos nombres que usa hoy el proyecto. (P1)
- [x] **CA-002-03**: Al indicar otro directorio de proyecto, el motor lee y escribe en ese directorio y no en el actual. (P2)
- [x] **CA-002-04**: El motor entiende la etapa del proyecto tanto si la registró el propio motor como si la registró la metodología. (P2)

### HU-003: Pruebas fiables en cualquier sistema
**Como** colaborador
**Quiero** que la suite pase en mi sistema
**Para** distinguir una regresión de un fallo previo

**Criterios de aceptación:**
- [x] **CA-003-01**: La suite completa pasa en Windows. (P1)
- [x] **CA-003-02**: La lista de archivos seguros descarta rutas de fuera del proyecto, incluidas las de carpetas vecinas con nombre parecido. (P1)
- [x] **CA-003-03**: La utilidad de escaneo de decisiones arranca y encuentra decisiones sin instalar nada adicional. (P2)
- [x] **CA-003-04**: El registro de memoria de agentes carga la tabla de modelos en lugar de caer siempre al valor de reserva. (P2)

### HU-004: Una sola convención para las decisiones de arquitectura
**Como** colaborador
**Quiero** un único lugar y nombre para las decisiones
**Para** que las herramientas y las personas busquen en el mismo sitio

**Criterios de aceptación:**
- [ ] **CA-004-01**: Los comandos, las plantillas y la guarda de escritura usan la misma ubicación y el mismo esquema de nombre. (P2)

## 5. Escenarios de Uso

### Escenario 1: Caso feliz
**Dado** un proyecto vacío
**Cuando** el operador instala FORGE y consulta el estado
**Entonces** ve la etapa actual, sin errores

### Escenario 2: Caso de error
**Dado** un proyecto sin tareas generadas
**Cuando** el operador lanza el motor
**Entonces** recibe un mensaje que indica cómo generarlas

### Escenario 3: Caso borde
**Dado** una lista de archivos que incluye uno de una carpeta vecina cuyo nombre empieza igual que el del proyecto
**Cuando** se filtran los archivos seguros
**Entonces** ese archivo queda descartado

## 6. Requisitos Funcionales

- **RF-001**: El sistema DEBE cargar su núcleo sin un paso de compilación.
- **RF-002**: La instalación DEBE copiar todos los archivos de los que dependen los hooks.
- **RF-003**: El motor DEBE leer las tareas de la especificación activa en el formato que genera la metodología.
- **RF-004**: El motor NO DEBE usar el directorio actual cuando se le indica otro.
- **RF-005**: El sistema NO DEBE considerar segura una ruta de fuera del proyecto.
- **RF-006**: La suite de pruebas NO DEBE depender de rutas propias de un sistema operativo.

## 7. Requisitos No Funcionales

| Categoría | Requisito | Métrica |
|-----------|-----------|---------|
| Compatibilidad | Comportamiento existente intacto | 0 pruebas previas modificadas en sus aserciones |
| Seguridad | Confinamiento de rutas | 0 rutas externas aceptadas en la prueba de confinamiento |
| Disponibilidad | Suite en Windows | 100 % en verde |
| Accesibilidad | Mensajes de error accionables | Indican el siguiente paso |

## 8. Fuera de Alcance (Exclusiones Explícitas)

- ❌ El ciclo verificado, el aislamiento y el presupuesto (especificación `2026-10-03-ciclo-verificado`)
- ❌ Corregir los errores de tipos previos del núcleo
- ❌ Activar la guarda de decisiones sobre la carpeta de arquitectura sin revisar antes su heurística

## 9. Dependencias y Asunciones

### Dependencias
- Ninguna.

### Asunciones
- Los dos nombres de la especificación activa deben seguir aceptándose: hay proyectos con cualquiera de ellos.

## 10. Términos del Dominio

- **Especificación activa**: la especificación sobre la que trabajan los comandos y el motor en un momento dado.

## 11. Preguntas Abiertas

- [x] CA-002-04. Resuelto sin cambiar ningún comando: la etapa del motor manda y, si falta, se traduce la de la metodología (`core/state-machine.js`). Unificar los dos vocabularios en los 19 archivos sigue siendo una opción, pero ya no bloquea.
- [x] CA-004-01. Resuelto (2026-10-05, ADR-16): la guarda lee los ADR aceptados de `.sdd/arquitectura/`, pero solo los términos de su sección `## Patrones prohibidos`; no deduce nada del texto libre.

## 12. Criterios de Éxito Medibles

- Suite: de 975 de 1014 a 1029 de 1029 en Windows (medido el 2026-10-03).
- 16 pruebas nuevas en `tests/saneamiento.test.js`.
- 0 errores de tipos nuevos (32 antes y 32 después).

## 13. Referencias

- `PLAN-MOTOR-AGENTICO.md`, FASE 0
- Cambios: `cli/runner.js`, `cli/index.js`, `claude-hooks/agent-memory.js`, `core/tareas.js` (nuevo), `core/engine-cli.js`, `core/state-machine.js`, `core/orchestrator.js`, `core/execution-context.js`, `core/runners/runner.js`, `utils/adr-parser.js`, `utils/episodic-memory.js`, `package.json`, cuatro archivos de `tests/`

## 14. Historial de Aclaraciones

| # | Categoría | Pregunta | Decisión | Fecha |
|---|-----------|----------|----------|-------|
| 1 | Proceso | ¿Se ejecuta S0 antes de aprobar S1? | Sí. El dueño ordenó empezar la ejecución y dio aprobación automática para continuar | 2026-10-03 |
| 2 | Alcance | ¿Se resuelven aquí CA-002-04 y CA-004-01? | No. Cambian comportamiento visible y quedan como decisiones del dueño | 2026-10-03 |
