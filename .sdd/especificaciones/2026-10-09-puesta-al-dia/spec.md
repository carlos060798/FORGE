---
id: 2026-10-09-puesta-al-dia
titulo: "Puesta al día: costo por repetición, protocolo de herramientas, instrucciones para agentes y aislamiento elegible"
tamano: mediano  # micro | pequeño | mediano | grande
estado: borrador  # borrador | en_revision | aprobada | en_implementacion | completada
creada: 2026-10-09
actualizada: 2026-10-09
autor: humano  # humano | importado
constitucion_version: 1.1.0
etiquetas: [costo, protocolo, interoperabilidad, aislamiento]
---

# Especificación: Puesta al día

## 1. Contexto y Motivación

Cuatro puntos pequeños separan a FORGE de la práctica actual, cada uno con un costo para el usuario. El ciclo paga el precio completo por instrucciones idénticas en cada iteración. Las herramientas que FORGE ofrece a agentes externos hablan una revisión del protocolo que puede haber quedado atrás. Los agentes de código que no son el anfitrión habitual no encuentran las reglas del proyecto donde las buscan. Y quien dispone de un aislamiento más estricto que el de por defecto no puede pedir que se use. Ninguno justifica una spec propia; juntos sí.

## 2. Objetivo

El ciclo gasta menos por repetir lo mismo, las herramientas de FORGE siguen funcionando con clientes actuales y antiguos, cualquier agente de código encuentra las reglas del proyecto, y el operador puede elegir un aislamiento más estricto.

## 3. Usuarios y Actores

| Actor | Rol | Necesidad principal |
|-------|-----|---------------------|
| Dueño del proyecto | Paga el gasto | Menos gasto sin perder el control del tope |
| Operador | Configura el ciclo | Elegir el aislamiento disponible en su equipo |
| Agente externo | Usa las herramientas de FORGE | Conectarse con la revisión del protocolo que hable |
| Agente de código ajeno | Trabaja en un proyecto con FORGE | Encontrar las reglas del proyecto |

## 4. Historias de Usuario

### HU-001: No pagar dos veces por lo mismo
**Como** dueño del proyecto
**Quiero** que las instrucciones que se repiten en cada llamada se cobren reducidas cuando el proveedor lo permite
**Para** gastar menos en tareas con varias iteraciones

**Criterios de aceptación:**
- [ ] **CA-001-01**: Con un proveedor que lo permite, la parte fija de cada llamada se marca como reutilizable. (P1)
- [ ] **CA-001-02**: El gasto registrado distingue lo cobrado a precio normal, lo guardado para reutilizar y lo reutilizado, cada uno a su precio. (P1)
- [ ] **CA-001-03**: El tope de gasto se calcula con esos precios; nunca se registra menos de lo que el proveedor cobra. (P1)
- [ ] **CA-001-04**: Con un proveedor que no lo permite, nada cambia. (P1)
- [ ] **CA-001-05**: La reutilización se puede desactivar en la configuración. (P2)

### HU-002: Herramientas que hablan la revisión vigente
**Como** agente externo
**Quiero** conectarme a las herramientas de FORGE con la revisión del protocolo que uso
**Para** no quedar excluido por ser más nuevo ni por ser más antiguo

**Criterios de aceptación:**
- [ ] **CA-002-01**: Existe un informe, basado en la especificación oficial del protocolo, que dice cuál es la revisión vigente y qué cambia para un servidor por entrada y salida estándar. (P1)
- [ ] **CA-002-02**: Si el informe confirma una revisión nueva aplicable, un cliente que la habla se conecta y usa las tres herramientas. (P1)
- [ ] **CA-002-03**: Los clientes de las revisiones hoy aceptadas siguen funcionando igual. (P1)
- [ ] **CA-002-04**: Una revisión desconocida recibe una respuesta clara con las revisiones admitidas. (P2)
- [ ] **CA-002-05**: Si el informe concluye que no hay nada que cambiar, la historia se cierra con el informe como evidencia. (P1)

### HU-003: Reglas del proyecto donde los agentes las buscan
**Como** agente de código ajeno
**Quiero** encontrar las reglas del proyecto en el archivo de instrucciones que leen los agentes de código
**Para** respetarlas sin conocer FORGE

**Criterios de aceptación:**
- [ ] **CA-003-01**: El repositorio de FORGE tiene ese archivo, con las restricciones de su constitución, cómo ejecutar las pruebas y dónde están los artefactos. (P2)
- [ ] **CA-003-02**: Al inicializar FORGE en un proyecto se crea ese archivo a partir de la constitución del proyecto, si no existe. (P2)
- [ ] **CA-003-03**: Si el archivo ya existe, no se sobrescribe: se informa y se ofrece el contenido propuesto aparte. (P1)
- [ ] **CA-003-04**: El archivo no contiene secretos ni rutas del equipo del usuario. (P1)

### HU-004: Elegir un aislamiento más estricto
**Como** operador
**Quiero** indicar qué mecanismo de aislamiento usa el entorno aislado
**Para** usar uno más estricto cuando mi equipo lo tiene

**Criterios de aceptación:**
- [ ] **CA-004-01**: El operador puede indicar un mecanismo de aislamiento en la configuración; sin indicarlo, se usa el actual. (P2)
- [ ] **CA-004-02**: Si el mecanismo indicado no está disponible, el ciclo no empieza, lo explica y termina con el código de «aislamiento no disponible». Nunca cae al mecanismo por defecto en silencio. (P1)
- [ ] **CA-004-03**: Todas las restricciones actuales (sin red, sin privilegios, límites de recursos) se mantienen con cualquier mecanismo. (P1)
- [ ] **CA-004-04**: Un valor con caracteres que pudieran interpretarse como opciones se rechaza. (P1)
- [ ] **CA-004-05**: La consulta de estado y el diagnóstico muestran qué mecanismo está en uso. (P3)

## 5. Escenarios de Uso

### Escenario 1: Caso feliz
**Dado** una tarea que necesita tres iteraciones con un proveedor que permite reutilizar
**Cuando** corre el ciclo
**Entonces** la segunda y la tercera llamada del implementador registran parte de la entrada a precio reducido

### Escenario 2: Caso de error
**Dado** un mecanismo de aislamiento configurado que no está instalado
**Cuando** el operador lanza el ciclo
**Entonces** no se ejecuta nada y el mensaje nombra el mecanismo que falta

### Escenario 3: Caso borde
**Dado** un proyecto que ya tiene su archivo de instrucciones para agentes
**Cuando** se inicializa FORGE
**Entonces** el archivo queda intacto y la propuesta se deja aparte

## 6. Requisitos Funcionales

- **RF-001**: El sistema DEBE contabilizar cada tipo de token al precio que le corresponde.
- **RF-002**: El sistema NO DEBE dejar de aceptar ninguna revisión del protocolo que hoy acepta.
- **RF-003**: El sistema NO DEBE sobrescribir archivos de instrucciones existentes.
- **RF-004**: El sistema NO DEBE degradar el aislamiento en silencio.

## 7. Requisitos No Funcionales

| Categoría | Requisito | Métrica |
|-----------|-----------|---------|
| Costo | Ahorro en tareas repetitivas | Al menos un 30 % menos de gasto de entrada en una tarea de tres iteraciones |
| Dependencias | Ninguna nueva | Sin cambios en las dependencias del paquete |
| Compatibilidad | Nada cambia sin configurar | Suite actual en verde |
| Honestidad | Lo no verificado se marca | El informe de HU-002 cita la fuente oficial |

## 8. Fuera de Alcance (Exclusiones Explícitas)

- ❌ Transporte de las herramientas por red
- ❌ Construir o instalar un mecanismo de aislamiento: solo se elige uno ya presente
- ❌ Aislamiento con máquinas virtuales gestionadas por FORGE
- ❌ Adoptar un estándar de telemetría (sin versión estable; se revisa cuando la tenga)
- ❌ Generar instrucciones para agentes a partir de algo distinto de la constitución

## 9. Dependencias y Asunciones

### Dependencias
- Spec `2026-10-09-validacion-modelo-real` (precios configurables, para los precios de reutilización)
- Spec `2026-10-03-herramientas-mcp`
- Spec `2026-10-03-ciclo-verificado` (política de aislamiento)

### Asunciones
- El proveedor por defecto informa por separado de los tokens guardados y reutilizados.
- [NECESITA_ACLARACION]: la existencia y el contenido de una revisión nueva del protocolo vienen de fuentes secundarias; HU-002 empieza comprobándolo.
- [NECESITA_ACLARACION]: no se ha probado ningún mecanismo de aislamiento alternativo en el equipo de desarrollo.

## 10. Términos del Dominio

- **Parte fija**: lo que se repite idéntico entre llamadas de una misma tarea (instrucciones del agente y contrato de salida).
- **Reutilización**: cobro reducido de la parte fija cuando el proveedor la reconoce.
- **Mecanismo de aislamiento**: el componente que separa el entorno aislado del equipo anfitrión.
- **Archivo de instrucciones para agentes**: archivo en la raíz del proyecto que los agentes de código leen antes de trabajar.

## 11. Preguntas Abiertas

- [ ] [POR_DECIDIR]: ¿La reutilización se activa por defecto? Propuesta: sí, donde el proveedor la permite.
- [ ] [POR_DECIDIR]: ¿HU-004 entra en esta entrega o espera a que alguien tenga un mecanismo alternativo con el que probarla?
- [ ] [NECESITA_ACLARACION]: ¿El archivo de instrucciones se regenera cuando cambia la constitución, o solo se crea una vez?

## 12. Criterios de Éxito Medibles

- Los 19 criterios de aceptación tienen test o evidencia registrada.
- Gasto de entrada al menos un 30 % menor en una tarea de tres iteraciones.
- 0 clientes actuales rotos.
- 0 dependencias nuevas.

## 13. Referencias

- `PLAN-CIERRE-BRECHAS.md`, FASE 9
- `.sdd/arquitectura/ADR-02-aislamiento-con-contenedores.md`, `ADR-06-presupuesto-en-el-estado.md`, `ADR-12-servidor-mcp-sin-dependencias.md`
- `docs/servidor-mcp.md`, `docs/ciclo-verificado.md`

## 14. Historial de Aclaraciones

| # | Categoría | Pregunta | Decisión | Fecha |
|---|-----------|----------|----------|-------|
