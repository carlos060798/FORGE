---
id: 2026-10-09-implementador-con-herramientas
titulo: "Implementador que lee, busca y edita por pasos"
tamano: grande  # micro | pequeño | mediano | grande
estado: en_implementacion  # borrador | en_revision | aprobada | en_implementacion | completada
creada: 2026-10-09
actualizada: 2026-10-09
autor: humano  # humano | importado
constitucion_version: 1.1.0
etiquetas: [ciclo, implementador, herramientas, costo]
---

# Especificación: Implementador con herramientas

## 1. Contexto y Motivación

Hoy el implementador del ciclo verificado recibe en un solo mensaje todo lo que va a ver del proyecto y debe responder con cada archivo completo. No puede abrir un archivo que nadie le mostró, ni buscar dónde se usa una función, ni cambiar tres líneas de un archivo largo sin reescribirlo entero. En proyectos reales eso produce código que no encaja con el existente, respuestas enormes y caras, y fallos cuando un archivo no cabe en la respuesta. Es la forma de trabajar que más se aleja de cómo operan hoy los agentes de código.

## 2. Objetivo

El implementador puede consultar el proyecto y modificarlo por pasos pequeños dentro de una misma tarea, con las mismas protecciones que hoy, con gasto acotado y pudiendo reanudarse, y quien no pueda o no quiera usar esta forma conserva la actual.

## 3. Usuarios y Actores

| Actor | Rol | Necesidad principal |
|-------|-----|---------------------|
| Dueño del proyecto | Recibe las tareas | Código que encaja con el existente, a menor costo |
| Operador | Configura el ciclo | Elegir la forma de trabajo del implementador y limitarla |
| Agente implementador | Escribe y corrige el código | Ver lo que necesita y cambiar solo lo necesario |
| Proveedor de modelos | Responde a las llamadas | Puede o no admitir trabajo por pasos |

## 4. Historias de Usuario

### HU-001: Consultar el proyecto
**Como** agente implementador
**Quiero** leer archivos, listar carpetas y buscar texto en el proyecto
**Para** escribir código que encaje con el que ya existe

**Criterios de aceptación:**
- [ ] **CA-001-01**: El implementador puede leer un archivo del proyecto, entero o por tramos, listar una carpeta y buscar un texto. (P1)
- [ ] **CA-001-02**: No puede leer, listar ni encontrar nada que hoy esté vetado para un modelo (secretos, rutas protegidas, carpetas internas, enlaces que salen del proyecto). (P1)
- [ ] **CA-001-03**: Cada resultado tiene un tamaño máximo; al superarlo se recorta y el implementador recibe el aviso de que está recortado. (P1)
- [ ] **CA-001-04**: Una consulta rechazada devuelve el motivo al implementador y queda registrada; no detiene la tarea. (P1)

### HU-002: Editar por partes
**Como** agente implementador
**Quiero** cambiar un fragmento de un archivo o crear uno nuevo
**Para** no reescribir archivos enteros

**Criterios de aceptación:**
- [ ] **CA-002-01**: El implementador puede sustituir un fragmento exacto de un archivo por otro, y crear un archivo nuevo. (P1)
- [ ] **CA-002-02**: Una sustitución cuyo fragmento no aparece, o aparece más de una vez, se rechaza sin cambiar nada y devuelve el motivo. (P1)
- [ ] **CA-002-03**: Toda escritura respeta exactamente las reglas actuales: no toca pruebas, exige revisión humana para dependencias y configuración, y no sale del proyecto. (P1)
- [ ] **CA-002-04**: Antes de cada primera modificación de un archivo existe un respaldo, y abortar la tarea restaura todos los archivos tocados. (P1)

### HU-003: Probar durante el trabajo
**Como** agente implementador
**Quiero** ejecutar las pruebas mientras trabajo
**Para** corregir antes de dar la tarea por terminada

**Criterios de aceptación:**
- [ ] **CA-003-01**: El implementador puede pedir que se ejecuten las pruebas y recibe su resultado resumido. (P1)
- [ ] **CA-003-02**: Esa ejecución ocurre en el entorno aislado, con los mismos límites que la ejecución final. (P1)
- [ ] **CA-003-03**: El éxito de la tarea lo decide únicamente la ejecución final que hace el ciclo, no las que pidió el implementador. (P1)
- [ ] **CA-003-04**: El implementador no puede ejecutar ningún otro comando. (P1)

### HU-004: Gasto y pasos acotados
**Como** dueño del proyecto
**Quiero** que el trabajo por pasos tenga tope
**Para** que no gaste sin límite

**Criterios de aceptación:**
- [ ] **CA-004-01**: Cada paso que llama al modelo cuenta para el tope de gasto de la sesión, con la degradación y la parada actuales. (P1)
- [ ] **CA-004-02**: Hay un máximo de pasos por intento de implementación; al alcanzarlo se ejecutan las pruebas finales con lo que haya escrito. (P1)
- [ ] **CA-004-03**: Una iteración del ciclo sigue siendo una ejecución final de pruebas: los pasos no consumen iteraciones. (P1)
- [ ] **CA-004-04**: El registro muestra, por tarea, cuántos pasos y cuánto gasto hubo. (P2)

### HU-005: Reanudar sin pagar dos veces
**Como** operador
**Quiero** que un corte a mitad del trabajo por pasos se pueda reanudar
**Para** no repetir lo ya pagado

**Criterios de aceptación:**
- [ ] **CA-005-01**: Tras un corte, la reanudación continúa desde el último paso completado sin repetir llamadas ya respondidas. (P1)
- [ ] **CA-005-02**: Un paso cuya escritura quedó a medias no deja un archivo corrupto. (P1)
- [ ] **CA-005-03**: Lo pausado en la forma actual se reanuda en la forma actual aunque la configuración haya cambiado. (P1)

### HU-006: Elegir y conservar la forma actual
**Como** operador
**Quiero** elegir entre la forma actual y la nueva
**Para** adoptarla cuando esté probada

**Criterios de aceptación:**
- [ ] **CA-006-01**: La forma de trabajo del implementador es configurable y, sin configurarla, es la actual. (P1)
- [ ] **CA-006-02**: Si el proveedor configurado no admite el trabajo por pasos, el ciclo lo avisa y usa la forma actual; no falla ni lo oculta. (P1)
- [ ] **CA-006-03**: Con la forma actual, el comportamiento del ciclo no cambia respecto a la versión anterior. (P1)

### HU-007: El contenido leído no manda
**Como** dueño del proyecto
**Quiero** que un texto dentro de un archivo no pueda ampliar lo que el implementador puede hacer
**Para** que un archivo del proyecto no se convierta en una orden

**Criterios de aceptación:**
- [ ] **CA-007-01**: Ningún contenido leído cambia qué rutas se pueden leer o escribir, qué comandos se ejecutan ni los topes. (P1)
- [ ] **CA-007-02**: Un proyecto de prueba con un archivo que pide leer un secreto y escribir fuera del proyecto termina con ambas acciones rechazadas y registradas. (P1)

## 5. Escenarios de Uso

### Escenario 1: Caso feliz
**Dado** una tarea que exige cambiar tres líneas de un archivo de dos mil
**Cuando** el implementador trabaja por pasos
**Entonces** busca el punto, sustituye el fragmento, ejecuta las pruebas y termina, sin reescribir el archivo

### Escenario 2: Caso de error
**Dado** un proveedor que no admite trabajo por pasos
**Cuando** el operador lo configura
**Entonces** el ciclo avisa y completa la tarea en la forma actual

### Escenario 3: Caso borde
**Dado** un corte del proceso entre el paso cuatro y el cinco
**Cuando** el operador reanuda
**Entonces** el trabajo sigue en el paso cinco y el gasto registrado no cuenta dos veces los cuatro primeros

## 6. Requisitos Funcionales

- **RF-001**: El sistema DEBE aplicar a cada lectura y escritura por pasos las mismas reglas de ruta que a la forma actual, desde un único lugar.
- **RF-002**: El sistema DEBE guardar cada paso completado antes de iniciar el siguiente.
- **RF-003**: El sistema NO DEBE dar al implementador ninguna capacidad de ejecución distinta de las pruebas del proyecto.
- **RF-004**: El sistema NO DEBE fijar un proveedor: la capacidad se declara por proveedor.
- **RF-005**: El sistema DEBE dejar la decisión de éxito en el paso de ejecución final y en el router.

## 7. Requisitos No Funcionales

| Categoría | Requisito | Métrica |
|-----------|-----------|---------|
| Costo | Menos tokens de salida en tareas de edición | Al menos un 50 % menos que la forma actual en el caso del Escenario 1 |
| Seguridad | Mismas fronteras que hoy | La suite de confinamiento pasa íntegra a través de las acciones por pasos |
| Dependencias | Ninguna nueva | Sin cambios en las dependencias del paquete |
| Compatibilidad | Opt-in | Suite actual en verde con la forma actual |
| Auditabilidad | Cada acción queda registrada | Un evento por acción, con su resultado |

## 8. Fuera de Alcance (Exclusiones Explícitas)

- ❌ Trabajo por pasos para el planificador y el agente de pruebas
- ❌ Ejecutar comandos arbitrarios, instalar dependencias o acceder a la red
- ❌ Varios implementadores en paralelo sobre la misma tarea
- ❌ Hacer esta forma la predeterminada: queda para la siguiente versión MAYOR
- ❌ Consumir herramientas de servidores externos

## 9. Dependencias y Asunciones

### Dependencias
- Spec `2026-10-03-ciclo-verificado` (reglas de escritura, respaldo, diario, presupuesto)
- Spec `2026-10-03-herramientas-mcp` (mismas reglas de lectura, escritura y ejecución)
- Spec `2026-10-09-pruebas-confiables`: va antes, porque esta spec da más libertad al implementador
- La caché de la spec `2026-10-09-puesta-al-dia` conviene antes de medir el costo

### Asunciones
- Al menos el proveedor por defecto admite trabajo por pasos.
- Sigue sin comprobar qué modelos locales lo admiten ni con qué fiabilidad: en esta entrega los proveedores de modelos locales declaran que no lo admiten (aclaración 5).
- La prioridad ya no depende de la tasa de respuestas no interpretables: el dueño delegó la aprobación y pidió implementarla como forma opcional (aclaración 1).

## 10. Términos del Dominio

- **Paso**: una respuesta del modelo dentro de un intento de implementación, que pide una acción o declara que ha terminado.
- **Acción**: una de las cinco operaciones permitidas: leer, listar, buscar, editar, ejecutar pruebas.
- **Forma de bloque**: la actual; una respuesta con todos los archivos completos.
- **Forma por pasos**: la nueva; varias respuestas con acciones entre medias.

## 11. Preguntas Abiertas

Todas resueltas el 2026-10-09 (ver el historial de aclaraciones):

- [x] Máximo de pasos por intento: 30, configurable.
- [x] Las ejecuciones de pruebas que pide el implementador tienen un máximo propio: 5 por intento, configurable.
- [x] En la forma por pasos el implementador no recibe el contexto del recuperador: recibe la lista de archivos del proyecto y consulta lo que necesita. El recuperador sigue sirviendo al agente de pruebas.
- [x] El implementador sigue sin poder borrar archivos.

## 12. Criterios de Éxito Medibles

- Los 24 criterios de aceptación tienen test.
- La misma tarea termina en éxito en las dos formas, con gasto e iteraciones comparados en la verificación.
- 0 rutas aceptadas por pasos que la forma de bloque rechace.
- 0 dependencias nuevas.

## 13. Referencias

- `PLAN-CIERRE-BRECHAS.md`, FASE 8
- `.sdd/arquitectura/ADR-21-implementador-por-turnos-con-herramientas.md`
- `.sdd/arquitectura/ADR-07-salida-de-agentes-como-archivos.md`, `ADR-15-sin-cliente-mcp-en-los-nodos.md`
- `docs/ciclo-verificado.md`, `docs/servidor-mcp.md`

## 14. Historial de Aclaraciones

| # | Categoría | Pregunta | Decisión | Fecha |
|---|-----------|----------|----------|-------|
| 1 | Aprobación | ¿Se aprueba la spec para implementarla? | Aprobada por delegación del dueño, 2026-10-09. Se implementa como forma opcional; la forma actual sigue siendo la predeterminada | 2026-10-09 |
| 2 | Límites | Máximo de pasos por intento | 30 por defecto, configurable entre 1 y 200. Al alcanzarlo se ejecutan las pruebas finales con lo que haya escrito | 2026-10-09 |
| 3 | Límites | ¿Máximo propio para las ejecuciones de pruebas que pide el implementador? | Sí: 5 por intento, configurable (0 las desactiva). Alcanzado el máximo, la petición se rechaza con el motivo y el trabajo sigue | 2026-10-09 |
| 4 | Alcance | ¿El recuperador de contexto se ejecuta antes del implementador en la forma por pasos? | No se le entrega su contexto: recibe la lista de archivos del proyecto y lee lo que necesita. Evita reenviar ese contexto en cada paso. El recuperador sigue ejecutándose para el agente de pruebas | 2026-10-09 |
| 5 | Alcance | ¿Qué proveedores admiten el trabajo por pasos en esta entrega? | El proveedor por defecto y el de pruebas. Los demás declaran que no lo admiten y el ciclo avisa y usa la forma actual (CA-006-02). Queda fuera de esta entrega, no de la spec | 2026-10-09 |
| 6 | Alcance | ¿Puede el implementador borrar archivos? | No. Sigue como hoy | 2026-10-09 |
| 7 | Reanudación | ¿Qué significa «lo pausado en la forma actual» (CA-005-03)? | La forma de trabajo se fija la primera vez que el implementador trabaja en una tarea y se conserva hasta que la tarea termina, en los dos sentidos. Cambiar la configuración afecta a las tareas nuevas | 2026-10-09 |
| 8 | Costo | ¿Cómo se verifica el requisito de costo? | Queda pendiente: exige un modelo de pago. El procedimiento está en `verificacion.md` | 2026-10-09 |
