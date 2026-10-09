---
id: 2026-10-09-validacion-modelo-real
titulo: "Validación del ciclo verificado con un modelo real y gasto bien calculado"
tamano: pequeño  # micro | pequeño | mediano | grande
estado: borrador  # borrador | en_revision | aprobada | en_implementacion | completada
creada: 2026-10-09
actualizada: 2026-10-09
autor: humano  # humano | importado
constitucion_version: 1.1.0
etiquetas: [validacion, presupuesto, publicacion]
---

# Especificación: Validación con un modelo real

## 1. Contexto y Motivación

El ciclo verificado es el modo por defecto desde la versión 5.0.0, pero solo se ha ejecutado con respuestas escritas de antemano. Nadie sabe si un modelo real devuelve lo que el ciclo espera, cuántos intentos necesita ni si el gasto que el ciclo calcula coincide con lo que el proveedor cobra. Publicar así sería afirmar una capacidad no demostrada (Principio XI). Además, el tope de gasto (Principio VIII) se calcula con una lista de modelos y precios escrita en el código, sin fecha y de generaciones anteriores.

## 2. Objetivo

Antes de publicar, existe evidencia registrada de que el ciclo completa tareas con un modelo real, y el gasto que el ciclo calcula se puede ajustar sin cambiar el código y coincide con el gasto real.

## 3. Usuarios y Actores

| Actor | Rol | Necesidad principal |
|-------|-----|---------------------|
| Dueño del proyecto | Decide si se publica | Evidencia de que funciona y de cuánto cuesta |
| Operador | Configura y lanza el ciclo | Indicar qué modelos usa y a qué precio, sin esperar una versión nueva |
| Revisor independiente | Verifica lo corregido | Un guion de riesgos contra el que revisar |

## 4. Historias de Usuario

### HU-001: Evidencia con un modelo real
**Como** dueño del proyecto
**Quiero** un informe de ejecuciones reales del ciclo
**Para** publicar sabiendo qué funciona y qué no

**Criterios de aceptación:**
- [ ] **CA-001-01**: Existe un informe guardado junto a la verificación del ciclo con, por cada ejecución real: resultado final, iteraciones, gasto, revisiones pedidas y su motivo. (P1)
- [ ] **CA-001-02**: El informe cubre al menos una tarea en cada uno de los dos lenguajes de la primera entrega. (P1)
- [ ] **CA-001-03**: El informe cuenta cuántas respuestas del modelo no se pudieron interpretar y cuántas necesitaron un segundo intento. (P1)
- [ ] **CA-001-04**: Sin un proveedor real configurado, la prueba no se ejecuta y lo dice; nunca presenta un resultado del proveedor de pruebas como evidencia. (P1)

### HU-002: Modelos y precios ajustables
**Como** operador
**Quiero** indicar qué modelo corresponde a cada nivel y cuánto cuesta
**Para** que el tope de gasto sea correcto cuando el proveedor cambia modelos o precios

**Criterios de aceptación:**
- [ ] **CA-002-01**: El operador puede indicar en la configuración del proyecto el modelo de cada nivel y su precio de entrada y de salida; lo indicado manda sobre la lista incluida. (P1)
- [ ] **CA-002-02**: La lista incluida lleva la fecha de su última revisión y esa fecha se muestra al consultar el estado. (P2)
- [ ] **CA-002-03**: Cuando se usa un modelo sin precio conocido, se cobra al precio más alto conocido y queda un aviso en el registro con el nombre del modelo. (P1)
- [ ] **CA-002-04**: Un precio no numérico o negativo en la configuración impide empezar el ciclo, con un mensaje que nombra la clave. (P1)
- [ ] **CA-002-05**: Sin nada indicado, el comportamiento es el de la lista incluida. (P1)

### HU-003: Gasto calculado igual al real
**Como** dueño del proyecto
**Quiero** comparar lo que el ciclo dice haber gastado con lo que cobró el proveedor
**Para** fiarme del tope

**Criterios de aceptación:**
- [ ] **CA-003-01**: El informe de HU-001 incluye el gasto calculado y el gasto que informa el proveedor para las mismas ejecuciones. (P1)
- [ ] **CA-003-02**: La diferencia entre ambos es menor del 5 %; si es mayor, el informe lo marca como hallazgo abierto. (P1)

### HU-004: Revisión independiente de lo pendiente
**Como** dueño del proyecto
**Quiero** que lo corregido después de la última verificación lo revise alguien que no lo escribió
**Para** no publicar sobre una autoevaluación

**Criterios de aceptación:**
- [ ] **CA-004-01**: Cada corrección marcada como «sin revisar» en la verificación del ciclo tiene un veredicto independiente. (P1)
- [ ] **CA-004-02**: La revisión de seguridad recorre una lista pública de riesgos de aplicaciones con agentes y deja, por cada riesgo, «cubierto», «parcial» o «no aplica» con su evidencia. (P2)
- [ ] **CA-004-03**: Las comprobaciones automáticas del aislamiento se han ejecutado al menos una vez en un sistema distinto del de desarrollo y no dejan entornos residuales. (P1)

## 5. Escenarios de Uso

### Escenario 1: Caso feliz
**Dado** un proveedor de pago configurado y un tope bajo
**Cuando** el operador lanza la prueba con un modelo real
**Entonces** obtiene un informe con resultado, iteraciones y gasto, y el informe queda guardado

### Escenario 2: Caso de error
**Dado** un modelo que el proveedor ya no ofrece
**Cuando** el ciclo lo llama
**Entonces** la tarea pasa a revisión por infraestructura con el nombre del modelo en el detalle, sin gastar iteraciones

### Escenario 3: Caso borde
**Dado** un modelo nuevo que no está en la lista ni en la configuración
**Cuando** el ciclo lo usa
**Entonces** se cobra al precio más alto conocido y queda un aviso

## 6. Requisitos Funcionales

- **RF-001**: El sistema DEBE guardar el informe de cada prueba real de forma que se pueda citar desde la verificación.
- **RF-002**: El sistema DEBE permitir fijar modelos y precios por proyecto sin modificar el producto.
- **RF-003**: El sistema NO DEBE cobrar en silencio un modelo desconocido a un precio inferior al más alto conocido.
- **RF-004**: El sistema NO DEBE escribir la clave del proveedor en el informe ni en el registro.

## 7. Requisitos No Funcionales

| Categoría | Requisito | Métrica |
|-----------|-----------|---------|
| Costo | La validación completa tiene un tope | Como máximo 5 USD en total |
| Dependencias | Ninguna nueva | Sin cambios en las dependencias del paquete |
| Compatibilidad | Las configuraciones existentes siguen valiendo | Suite actual en verde sin cambios de configuración |

## 8. Fuera de Alcance (Exclusiones Explícitas)

- ❌ Comparar proveedores o modelos entre sí
- ❌ Consultar precios en línea de forma automática
- ❌ Corregir lo que la validación descubra: cada hallazgo se trata en su propia tarea o spec
- ❌ Probar el modo con un proveedor local en marcha

## 9. Dependencias y Asunciones

### Dependencias
- Spec `2026-10-03-ciclo-verificado` y su verificación
- Una clave de un proveedor de pago, aportada por el dueño
- La rama subida al repositorio remoto

### Asunciones
- El proveedor informa del gasto o de los tokens facturados de un modo consultable.
- [NECESITA_ACLARACION]: no se sabe si los modelos que la lista incluida nombra siguen disponibles.

## 10. Términos del Dominio

- **Nivel de modelo**: una de las tres categorías (alta, media, económica) que un agente pide sin nombrar un modelo concreto.
- **Lista incluida**: los modelos y precios que el producto trae por defecto.
- **Prueba real**: ejecución del ciclo contra un proveedor de pago, con gasto real.

## 11. Preguntas Abiertas

- [ ] [NECESITA_ACLARACION]: ¿Con qué proveedor y qué niveles se hace la validación?
- [ ] [POR_DECIDIR]: ¿Cuántas tareas por lenguaje bastan como evidencia? Propuesta: 3.
- [ ] [POR_DECIDIR]: Si la tasa de respuestas no interpretables supera el 20 %, ¿se retrasa la publicación o se publica con el límite documentado?

## 12. Criterios de Éxito Medibles

- Los 14 criterios de aceptación tienen prueba o evidencia registrada.
- Al menos 6 ejecuciones reales registradas, 3 por lenguaje.
- Diferencia entre gasto calculado y real menor del 5 %.
- 0 correcciones «sin revisar» en la verificación del ciclo.

## 13. Referencias

- `PLAN-CIERRE-BRECHAS.md`, FASE 6
- `.sdd/arquitectura/ADR-19-modelos-y-precios-configurables.md`
- `.sdd/especificaciones/2026-10-03-ciclo-verificado/verificacion.md`
- `RELEASE-CHECKLIST.md`, `docs/ciclo-verificado.md` (límites conocidos)

## 14. Historial de Aclaraciones

| # | Categoría | Pregunta | Decisión | Fecha |
|---|-----------|----------|----------|-------|
