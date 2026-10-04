<!--
INFORME DE IMPACTO DE SINCRONIZACIÓN
====================================
Cambio de versión: (ninguna) → 1.0.0
Tipo de cambio: MAYOR (ratificación inicial)

Principios modificados:
  - Alta de los principios I a XII. Es la primera constitución del propio repositorio FORGE.

Plantillas que requieren actualización:
  - plantillas/especificacion.md   ✅ alineada
  - plantillas/plan.md              ✅ alineada
  - plantillas/tareas.md            ✅ alineada
  - commands/*.md                   ⚠ pendiente: `sdd.planificar.md` mezcla fases 1-6 y A-H;
                                      los comandos no mencionan `forge aprobar spec` (Principio II)

TODOs diferidos:
  - Elegir linter y formateador (hoy no hay ninguno configurado).
  - Elegir herramienta de cobertura y fijar el umbral (hoy no se mide).
  - Unificar la convención de commits (conviven tres en la documentación).
  - Ratificación por el dueño: esta versión es una propuesta redactada a partir del código real.
-->

# Constitución del Proyecto: FORGE

> **Versión:** 1.0.0 | **Ratificada:** pendiente de ratificación por el dueño | **Última enmienda:** 2026-10-03

## Propósito y Misión

FORGE convierte una idea en software especificado, construido y verificado, siguiendo una metodología de desarrollo guiado por especificaciones en español. Sirve a personas que no escriben código y a equipos que exigen trazabilidad entre lo pedido, lo decidido y lo entregado. Funciona en el equipo del usuario y no depende de un único proveedor de modelos.

## Stack Técnico

| Aspecto | Valor |
|---------|-------|
| Lenguaje principal | JavaScript (módulos ESM), con tipos comprobados sobre JSDoc |
| Framework | ninguno |
| Almacenamiento | Archivos JSON y JSONL en `.sdd/`; `node:sqlite` opcional (Node ≥22.5) |
| Tests | `node:test` (runner nativo) |
| Build/Bundler | ninguno (`npm run build` es un `echo`) |
| Despliegue | npm (`forja-mvp`) y plugin de Claude Code |

Runtime: Node ≥18. Los componentes opcionales pueden exigir una versión mayor si se cargan de forma perezosa y existe una alternativa que funcione en la versión mínima.

> Cualquier cambio de stack requiere un ADR en `.sdd/arquitectura/`.

## Principios Fundamentales

### Principio I: La especificación manda

Todo cambio DEBE empezar con una especificación escrita. La especificación DEBE decir qué y por qué, y NO DEBE nombrar lenguajes, bibliotecas ni herramientas.

**Razón:** es la premisa del producto. FORGE no puede pedir a sus usuarios una disciplina que no aplica a sí mismo.

### Principio II: La aprobación es humana

La especificación y el plan DEBEN ser aprobados por el dueño del proyecto. Ningún agente NI comando DEBE marcar una aprobación por su cuenta.

**Razón:** la máquina de estados ya lo exige (`core/state-machine.js:62-66`). La aprobación es el punto donde una persona asume la responsabilidad del alcance.

### Principio III: Local primero y sin proveedor fijo

El núcleo DEBE funcionar sin red, salvo la llamada al modelo. Ningún módulo DEBE fijar un proveedor de modelos; el proveedor DEBE ser configurable, incluido uno local.

**Razón:** el código y las especificaciones del usuario son suyos. Un proveedor fijo convierte una caída o un cambio de precios ajeno en un fallo propio.

### Principio IV: Dependencias mínimas

Toda dependencia nueva DEBE justificarse con un ADR. Las dependencias pesadas o con requisitos de runtime superiores al mínimo DEBEN ser opcionales y cargarse de forma perezosa.

**Razón:** el paquete tiene dos dependencias y se instala con un comando. Esa ligereza es un argumento de venta declarado.

### Principio V: El código generado no se ejecuta en el equipo anfitrión

El código producido por un modelo DEBE ejecutarse en un entorno aislado, sin red y con límites de recursos. Un interruptor de circuito o una lista de comandos prohibidos NO DEBEN presentarse como aislamiento.

**Razón:** hoy el motor ejecuta ese código directamente en el equipo del usuario (`core/runners/runner.js:31-51`). Un modelo puede generar código dañino sin intención de nadie.

### Principio VI: Decisiones de control deterministas

Las decisiones que dirigen el flujo (éxito, reintento, parada) DEBEN basarse en códigos de resultado y en el estado de control. NO DEBEN basarse en buscar texto en una salida ni en el juicio de un modelo.

**Razón:** una decisión que no se puede reproducir no se puede probar ni auditar.

### Principio VII: Pruebas antes que código, por otro rol

Las pruebas DEBEN escribirse antes que la implementación y por un rol distinto del que implementa. El implementador NO DEBE poder modificar las pruebas.

**Razón:** quien escribe el código y sus pruebas tiende a escribir pruebas que su código pasa.

### Principio VIII: Gasto acotado

Toda sesión que consuma un modelo DEBE tener un tope de gasto, un umbral de degradación a un modelo más barato y una parada dura al alcanzar el tope.

**Razón:** un ciclo de corrección sin tope puede gastar sin límite mientras nadie mira.

### Principio IX: Todo es reanudable y auditable

El estado DEBE guardarse de forma atómica después de cada paso. Los eventos DEBEN registrarse en un registro de solo adición.

**Razón:** una interrupción no debe obligar a pagar dos veces por el mismo trabajo, y cualquier decisión del sistema debe poder reconstruirse después.

### Principio X: Reusar antes que reescribir

Las mejoras DEBEN ser incrementales y compatibles con lo que ya funciona. Romper la compatibilidad DEBE acompañarse de una versión MAYOR.

**Razón:** principio ya adoptado en `PLAN-MIGRACION-NUCLEO-REAL.md`. El valor del proyecto está en sus comandos, agentes y plantillas, que no dependen del lenguaje.

### Principio XI: Honestidad documental

Ningún documento DEBE afirmar una capacidad que el código no tiene. Lo no verificado DEBE marcarse como tal.

**Razón:** el plan "FORGE v2" se construyó sobre la afirmación de que existía un aislamiento por contenedores que nunca existió.

### Principio XII: Español primero

Los artefactos, los mensajes al usuario y los nombres del dominio DEBEN estar en español.

**Razón:** es la identidad del producto y la lengua de sus usuarios.

## Estándares de Calidad

- **Tests:** `npm test` en verde en toda la matriz de CI. Tests obligatorios para enrutado, presupuesto, política de aislamiento y confinamiento de rutas. Sin simular el sistema de archivos: se usan directorios temporales. Cobertura: sin herramienta configurada (TODO diferido).
- **Linting:** sin linter configurado (TODO diferido). No se inventa uno hasta decidirlo con un ADR.
- **Tipos:** opcional. `npm run typecheck` comprueba `core/**/*.js` sobre JSDoc.
- **Formato:** sin formateador configurado (TODO diferido).
- **Revisión:** cada cambio pasa por el agente `revisor` antes de marcar tareas como completas. Los cambios en aislamiento y confinamiento pasan además por `seguridad`.

## Restricciones Arquitectónicas

- NO ejecutar código generado en el equipo anfitrión cuando el ciclo verificado esté activo
- NO agregar dependencias nuevas sin ADR
- NO subir la versión mínima del runtime sin versión MAYOR
- NO escribir secretos en registros, estados guardados ni copias de trabajo
- NO escribir, desde una salida de modelo, fuera del directorio del proyecto ni en `.git/`, `.sdd/` o `.env*`
- NO degradar en silencio: si el aislamiento o el proveedor no están disponibles, se informa y se detiene
- NO romper `forge run` ni `forge resume` en su modo actual
- NO romper la interfaz pública (comandos, formato de `.sdd/`) sin versión MAYOR

## Convenciones

### Nomenclatura
- Archivos: `kebab-case.js`
- Variables: `camelCase`
- Constantes: `MAYUSCULAS_CON_GUION_BAJO`
- Tipos/Clases: `PascalCase`
- Identificadores del dominio: en español
- ADR: `ADR-NN-slug.md`, con la fecha en la cabecera

### Estructura
- `core/`: motor ejecutable, sin dependencia del anfitrión
- `cli/`: punto de entrada de terminal
- `claude-hooks/`: integración con Claude Code
- `commands/`, `agents/`, `skills/`, `plantillas/`: metodología en Markdown
- `tests/`: un archivo `<módulo>.test.js` por módulo de `core/`
- `.sdd/`: artefactos SDD del propio repositorio

## Proceso de Cambios (Flujo SDD-ES)

1. Todo cambio empieza con `/sdd.especificar`
2. La spec se clarifica con `/sdd.aclarar` si hay ambigüedad
3. El plan técnico se aprueba con `/sdd.planificar aprobar`
4. Las tareas se generan con `/sdd.tareas`
5. La consistencia se valida con `/sdd.analizar`
6. La implementación se ejecuta con `/sdd.implementar`
7. El cumplimiento se verifica con `/sdd.verificar`

## Gobernanza

- Esta constitución sigue versionado semántico (MAYOR.MENOR.PARCHE)
- Cualquier cambio se registra en el "Informe de Impacto de Sincronización" arriba
- Las enmiendas requieren actualizar las plantillas y comandos afectados
- Las decisiones técnicas no triviales se documentan como ADR en `.sdd/arquitectura/`
