---
id: 2026-10-09-pruebas-confiables
titulo: "Pruebas confiables: que un pase demuestre algo"
tamano: mediano  # micro | pequeño | mediano | grande
estado: en_implementacion  # borrador | en_revision | aprobada | en_implementacion | completada
creada: 2026-10-09
actualizada: 2026-10-09
autor: humano  # humano | importado
constitucion_version: 1.1.0
etiquetas: [pruebas, calidad, ciclo]
---

# Especificación: Pruebas confiables

## 1. Contexto y Motivación

El ciclo verificado da una tarea por terminada cuando sus pruebas pasan. Pero no comprueba que esas pruebas comprueben algo: unas pruebas que pasan sin que exista la implementación solo dejan un aviso, y unas pruebas que ejecutan el código sin verificar su resultado pasan igual que unas buenas. El dueño recibe «completada» y no puede distinguir un éxito real de uno vacío sin leer el código. Es el límite más importante que la documentación del ciclo reconoce.

## 2. Objetivo

Una tarea solo termina en éxito sin intervención humana si sus pruebas fallaban antes de la implementación, y el dueño dispone de una medida de cuánto detectan esas pruebas, que puede convertir en exigencia.

## 3. Usuarios y Actores

| Actor | Rol | Necesidad principal |
|-------|-----|---------------------|
| Dueño del proyecto | Recibe las tareas terminadas | Saber cuánto vale un «las pruebas pasan» |
| Operador | Configura el ciclo | Elegir entre no medir, informar o exigir |
| Agente de pruebas | Escribe y refuerza las pruebas | Saber qué no detectaron sus pruebas |
| Agente implementador | Escribe el código | Nada nuevo: sigue sin poder tocar las pruebas |

## 4. Historias de Usuario

### HU-001: Las pruebas deben fallar antes de implementar
**Como** dueño del proyecto
**Quiero** que unas pruebas que ya pasan sin implementación no cuenten
**Para** que el éxito no se alcance sin haber construido nada

**Criterios de aceptación:**
- [x] **CA-001-01**: Si las pruebas recién escritas pasan antes de que exista la implementación, el agente de pruebas recibe ese resultado y lo intenta una vez más. (P1)
- [x] **CA-001-02**: Si tras ese intento siguen pasando, la tarea se pausa para revisión humana con un motivo propio y el implementador no se ejecuta. (P1)
- [x] **CA-001-03**: Una tarea que declara partir de un comportamiento ya existente queda exenta, y la exención queda anotada en el registro. (P1)
- [x] **CA-001-04**: Un fallo del entorno de ejecución en esta comprobación no cuenta ni como «fallan» ni como «pasan»: se trata como fallo de infraestructura. (P1)
- [x] **CA-001-05**: El intento adicional cuenta para el tope de gasto. (P1)

### HU-002: Medir cuánto detectan las pruebas
**Como** dueño del proyecto
**Quiero** saber qué proporción de cambios deliberados en el código detectan las pruebas
**Para** decidir si me fío del resultado

**Criterios de aceptación:**
- [x] **CA-002-01**: Tras un pase, el sistema introduce cambios pequeños y deliberados, de uno en uno, en los archivos que escribió el implementador, y ejecuta las pruebas contra cada uno. (P1)
- [x] **CA-002-02**: Cada cambio se ejecuta en el entorno aislado, nunca en el equipo anfitrión, y el proyecto real no queda alterado al terminar. (P1)
- [x] **CA-002-03**: El resultado es una puntuación (cambios detectados entre cambios probados) y la lista de los no detectados, con archivo y línea. (P1)
- [x] **CA-002-04**: La medición tiene un tope de cambios y un tope de tiempo; al alcanzarlos se detiene y la puntuación indica que es parcial. (P1)
- [x] **CA-002-05**: Si no se puede generar ningún cambio para el lenguaje o los archivos de la tarea, la medición se omite y queda anotado; no se inventa una puntuación. (P1)
- [x] **CA-002-06**: Los cambios se eligen por reglas fijas: la misma entrada produce los mismos cambios. (P1)
- [x] **CA-002-07**: La medición no llama a ningún modelo y no consume presupuesto. (P2)

### HU-003: Exigir un mínimo
**Como** operador
**Quiero** poder exigir una puntuación mínima
**Para** que las tareas con pruebas débiles no se den por buenas solas

**Criterios de aceptación:**
- [x] **CA-003-01**: Hay tres modos: no medir, informar (por defecto) y exigir. Con «no medir» el ciclo se comporta como antes de esta spec. (P1)
- [x] **CA-003-02**: Con «informar», la puntuación queda en el registro y en la consulta de estado, y nunca cambia el resultado de la tarea. (P1)
- [x] **CA-003-03**: Con «exigir», por debajo del mínimo configurado el agente de pruebas recibe la lista de cambios no detectados y refuerza las pruebas una sola vez. (P1)
- [x] **CA-003-04**: Tras el refuerzo, las pruebas nuevas se ejecutan contra la implementación: si fallan, el ciclo vuelve al implementador como en cualquier fallo. (P1)
- [x] **CA-003-05**: Si tras el refuerzo la puntuación sigue bajo el mínimo, la tarea se pausa para revisión humana con un motivo propio. (P1)
- [x] **CA-003-06**: El implementador sigue sin poder modificar las pruebas en ningún momento, tampoco las reforzadas. (P1)
- [x] **CA-003-07**: La decisión entre éxito, refuerzo y revisión depende solo de la puntuación, del mínimo y del estado de control. (P1)

### HU-004: Menos vías para anular las pruebas
**Como** dueño del proyecto
**Quiero** que el implementador no pueda cambiar cómo se ejecutan las pruebas
**Para** que no las anule desde un archivo que el ejecutor carga solo

**Criterios de aceptación:**
- [x] **CA-004-01**: Los archivos que el ejecutor de pruebas carga de forma automática y que hoy constan como límite conocido exigen revisión humana cuando el implementador los propone. (P2)

## 5. Escenarios de Uso

### Escenario 1: Caso feliz
**Dado** el modo «informar» y una tarea con pruebas que comprueban resultados
**Cuando** las pruebas pasan
**Entonces** la tarea termina en éxito y el registro muestra una puntuación alta

### Escenario 2: Caso de error
**Dado** un agente de pruebas que escribe pruebas que no comprueban nada
**Cuando** se ejecutan antes de la implementación y pasan dos veces
**Entonces** la tarea se pausa con el motivo «las pruebas no fallan» y no se gasta en implementar

### Escenario 3: Caso borde
**Dado** el modo «exigir» y unas pruebas que solo detectan la mitad de los cambios
**Cuando** el refuerzo no alcanza el mínimo
**Entonces** la tarea se pausa con la lista de cambios no detectados para que una persona decida

## 6. Requisitos Funcionales

- **RF-001**: El sistema DEBE comprobar, antes de implementar, que las pruebas nuevas fallan.
- **RF-002**: El sistema DEBE medir la fortaleza de las pruebas con reglas, sin el juicio de un modelo.
- **RF-003**: El sistema NO DEBE ejecutar código alterado fuera del entorno aislado.
- **RF-004**: El sistema NO DEBE dejar ningún cambio deliberado en el proyecto real.
- **RF-005**: El sistema DEBE guardar el avance de la medición de forma que un corte no obligue a repetirla entera.

## 7. Requisitos No Funcionales

| Categoría | Requisito | Métrica |
|-----------|-----------|---------|
| Rendimiento | La medición está acotada | Por defecto, como máximo 10 cambios y 5 minutos por tarea |
| Dependencias | Ninguna nueva | Sin cambios en las dependencias del paquete |
| Compatibilidad | Sin medición, nada cambia salvo HU-001 | Suite actual en verde con el modo «no medir» |
| Auditabilidad | Cada cambio probado queda registrado | Un evento por cambio, con su resultado |

## 8. Fuera de Alcance (Exclusiones Explícitas)

- ❌ Medir cobertura de líneas o de ramas
- ❌ Que un modelo opine sobre la calidad de las pruebas
- ❌ Lenguajes que el ciclo no cubre hoy
- ❌ Distinguir cambios que no alteran el comportamiento: pueden contar como «no detectados»
- ❌ Medir archivos que el implementador no escribió en esta tarea

## 9. Dependencias y Asunciones

### Dependencias
- Spec `2026-10-03-ciclo-verificado` (ciclo, entorno aislado, revisión humana)
- Spec `2026-10-09-validacion-modelo-real`: conviene conocer antes el comportamiento con un modelo real

### Asunciones
- Unas pruebas que fallan porque la implementación no existe cuentan como «fallan».
- Sigue sin saberse cuánto tarda la medición en un proyecto real; los topes por defecto (10 cambios, 5 minutos) se mantienen como propuesta. Única medida disponible (2026-10-09, proyecto JavaScript mínimo, Docker Desktop en Windows): 9 cambios en 40 a 67 segundos. Ver `verificacion.md`.

## 10. Términos del Dominio

- **Rojo**: estado en el que las pruebas nuevas fallan porque falta la implementación.
- **Cambio deliberado**: alteración pequeña del código (invertir una comparación, cambiar una constante, negar una condición, sustituir un valor devuelto) hecha para ver si las pruebas la detectan.
- **Puntuación de detección**: cambios deliberados detectados entre cambios probados.
- **Refuerzo**: ronda en la que el agente de pruebas añade comprobaciones a partir de los cambios no detectados.

## 11. Preguntas Abiertas

- [x] El refuerzo ocurre después de la implementación. ¿Es compatible con el Principio VII tal como está escrito, o hace falta una enmienda de la constitución? → **Se implementa sin enmienda** (aclaración 2). Las pruebas iniciales se siguen escribiendo antes que el código; el refuerzo lo hace el rol de pruebas, no el implementador, y el implementador sigue sin poder tocarlas. La constitución no se ha modificado: si el dueño quiere que la letra del Principio VII lo recoja, es una enmienda suya.
- [x] Mínimo por defecto en el modo «exigir» → **60 %** (`motor.mutacion_minima: 0.6`), configurable (aclaración 3).
- [x] ¿La exención de HU-001 la declara quien escribe la tarea, o se deduce de que los archivos objetivo ya existen? → **La declara quien escribe la tarea** (`parte_de_codigo_existente: true`). Deducirla de que los archivos existan eximiría sin querer a cualquier tarea que modifique un archivo (aclaración 4).
- [ ] [POR_DECIDIR]: ¿El modo por defecto pasa a «exigir» en la siguiente versión MAYOR? → **Sin decidir.** No hay datos para decidirlo: falta medir con un modelo real cuántos cambios equivalentes aparecen y cuánto tarda en un proyecto real. El modo por defecto queda en «informar».

## 12. Criterios de Éxito Medibles

- Los 20 criterios de aceptación tienen test.
- En un proyecto de ejemplo con pruebas vacías, 0 tareas terminan en éxito sin intervención.
- 0 dependencias nuevas.
- Tiempo añadido por tarea con los topes por defecto: como máximo 5 minutos.

## 13. Referencias

- `PLAN-CIERRE-BRECHAS.md`, FASE 7
- `.sdd/arquitectura/ADR-20-medicion-de-pruebas-por-mutacion-propia.md`
- `.sdd/arquitectura/ADR-05-router-determinista.md`
- `docs/ciclo-verificado.md` (límites conocidos)
- Spec `2026-10-03-ciclo-verificado`: CA-002-04 (P3) y aclaración «como aviso que no bloquea», que esta spec endurece

## 14. Historial de Aclaraciones

| # | Categoría | Pregunta | Decisión | Fecha |
|---|-----------|----------|----------|-------|
| 1 | Aprobación | ¿Se aprueba la spec? | Aprobada por delegación del dueño, 2026-10-09 | 2026-10-09 |
| 2 | Constitución | ¿El refuerzo tras implementar es compatible con el Principio VII? | Se implementa sin enmienda: lo hace el rol de pruebas y el implementador sigue sin poder tocar las pruebas. La constitución no se modifica | 2026-10-09 |
| 3 | Configuración | Mínimo por defecto en «exigir» | 60 %, configurable | 2026-10-09 |
| 4 | Alcance | ¿Quién declara la exención del rojo obligatorio? | Quien escribe la tarea, con un campo explícito; no se deduce | 2026-10-09 |
| 5 | Alcance | ¿Qué pasa en «exigir» si no hay nada que medir, o si el entorno falla al medir? | Sin nada que alterar: éxito, anotado (no se exige lo que no se puede medir). Si el entorno falla sin haber probado ningún cambio: revisión humana | 2026-10-09 |
| 6 | Alcance | Tras la pausa por pruebas débiles, ¿qué hace «continuar»? | Otra ronda de refuerzo, autorizada por la persona | 2026-10-09 |
| 7 | Alcance | ¿El agente de pruebas ve la implementación al reforzar? | No: recibe la tarea, sus pruebas y, de cada cambio no detectado, la línea antes y después | 2026-10-09 |
