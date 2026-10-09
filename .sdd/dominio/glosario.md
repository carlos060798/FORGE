# Glosario del Dominio

> Términos del dominio del proyecto. Una definición precisa por término.
> Editar con: `/sdd.glosario`

## Términos

### Ciclo verificado

**Definición:** secuencia automática de planificar, reunir contexto, escribir pruebas, implementar y ejecutar, que se repite hasta que las pruebas pasan o se alcanza un tope.
**Categoría:** proceso
**Sinónimos a evitar:**
- ~~bucle ReAct~~, ~~loop de corrección~~ (usar "ciclo verificado")

**Referenciado en:**
- 2026-10-03-ciclo-verificado

**Última actualización:** 2026-10-03

### Iteración

**Definición:** una ejecución de las pruebas contra una versión de la implementación dentro de un ciclo verificado.
**Categoría:** proceso
**Ejemplos:**
- Un fallo del entorno aislado no cuenta como iteración.

**Referenciado en:**
- 2026-10-03-ciclo-verificado

**Última actualización:** 2026-10-03

### Entorno aislado

**Definición:** espacio de ejecución separado del equipo anfitrión, sin red, sin privilegios y con límites de tiempo, memoria y procesos, donde corre el código generado.
**Categoría:** técnico
**Sinónimos a evitar:**
- ~~sandbox~~ cuando se refiera al nivel del interruptor de circuito (usar "nivel de ejecución")

**Referenciado en:**
- 2026-10-03-ciclo-verificado

**Última actualización:** 2026-10-03

### Equipo anfitrión

**Definición:** el ordenador del usuario donde se ejecuta FORGE.
**Categoría:** técnico
**Sinónimos a evitar:**
- ~~host~~ (usar "equipo anfitrión")

**Referenciado en:**
- 2026-10-03-ciclo-verificado

**Última actualización:** 2026-10-03

### Área de trabajo aislada

**Definición:** copia desechable del proyecto, sin secretos, sobre la que opera el entorno aislado.
**Categoría:** técnico
**Referenciado en:**
- 2026-10-03-ciclo-verificado

**Última actualización:** 2026-10-03

### Huella

**Definición:** resumen calculado del contenido de un archivo que permite detectar si cambió.
**Categoría:** técnico
**Sinónimos a evitar:**
- ~~hash~~ en textos para usuarios (usar "huella")

**Referenciado en:**
- 2026-10-03-ciclo-verificado

**Última actualización:** 2026-10-03

### Sesión

**Definición:** una ejecución de `forge run` y todas sus reanudaciones, identificada por un mismo identificador de ejecución.
**Categoría:** proceso
**Referenciado en:**
- 2026-10-03-ciclo-verificado

**Última actualización:** 2026-10-03

### Tope de gasto

**Definición:** importe máximo que una sesión puede gastar en llamadas a modelos; al alcanzarlo no se inicia ninguna llamada más.
**Categoría:** negocio
**Sinónimos a evitar:**
- ~~budget~~ (usar "tope de gasto" o "presupuesto")

**Referenciado en:**
- 2026-10-03-ciclo-verificado

**Última actualización:** 2026-10-03

### Umbral de degradación

**Definición:** importe de gasto a partir del cual las llamadas siguientes usan un modelo más barato.
**Categoría:** negocio
**Referenciado en:**
- 2026-10-03-ciclo-verificado

**Última actualización:** 2026-10-03

### Revisión humana

**Definición:** pausa del ciclo en la que una persona decide continuar, aceptar el resultado o abortar.
**Categoría:** proceso
**Sinónimos a evitar:**
- ~~human-in-the-loop~~, ~~hard stop~~ (usar "revisión humana")

**Referenciado en:**
- 2026-10-03-ciclo-verificado

**Última actualización:** 2026-10-03

### Punto de guardado

**Definición:** estado del ciclo escrito en disco después de cada paso, desde el que se puede reanudar.
**Categoría:** técnico
**Sinónimos a evitar:**
- ~~checkpoint~~ en textos para usuarios (usar "punto de guardado")

**Referenciado en:**
- 2026-10-03-ciclo-verificado

**Última actualización:** 2026-10-03

### Parte fija

**Definición:** lo que se repite idéntico entre las llamadas a un modelo dentro de una misma tarea: las instrucciones del agente y el contrato de salida.
**Categoría:** técnico
**Referenciado en:**
- 2026-10-09-puesta-al-dia

**Última actualización:** 2026-10-09

### Reutilización

**Definición:** cobro reducido de la parte fija de una llamada cuando el proveedor de modelos reconoce que ya la recibió poco antes. El proveedor distingue lo guardado para reutilizar (más caro que la entrada normal) de lo reutilizado (más barato).
**Categoría:** técnico
**Sinónimos a evitar:**
- ~~prompt caching~~ en textos para usuarios (usar "caché de prompts" o "reutilización")

**Referenciado en:**
- 2026-10-09-puesta-al-dia

**Última actualización:** 2026-10-09

### Mecanismo de aislamiento

**Definición:** el componente que separa el entorno aislado del equipo anfitrión. El operador puede elegir uno de los que su equipo ya tiene instalados; si el elegido no está, el ciclo no empieza.
**Categoría:** técnico
**Sinónimos a evitar:**
- ~~runtime~~ a secas en textos para usuarios (es también el nombre del entorno de ejecución del lenguaje)

**Referenciado en:**
- 2026-10-09-puesta-al-dia

**Última actualización:** 2026-10-09

### Archivo de instrucciones para agentes

**Definición:** archivo en la raíz del proyecto que los agentes de código leen antes de trabajar. Resume las reglas de la constitución, cómo ejecutar las pruebas y dónde están las especificaciones y las decisiones.
**Categoría:** técnico
**Referenciado en:**
- 2026-10-09-puesta-al-dia

**Última actualización:** 2026-10-09

### Revisión del protocolo

**Definición:** versión fechada del protocolo con el que los agentes externos usan las herramientas de FORGE. Hay revisiones «con saludo» (el cliente se presenta una vez al conectarse) y «sin estado» (cada petición dice qué revisión habla).
**Categoría:** técnico
**Referenciado en:**
- 2026-10-09-puesta-al-dia
- 2026-10-03-herramientas-mcp

**Última actualización:** 2026-10-09

### Modo clásico

**Definición:** el comportamiento actual del motor: cada tarea se ejecuta una vez y, si falla, se marca como fallida sin intento de corrección.
**Categoría:** técnico
**Referenciado en:**
- 2026-10-03-ciclo-verificado

**Última actualización:** 2026-10-03
