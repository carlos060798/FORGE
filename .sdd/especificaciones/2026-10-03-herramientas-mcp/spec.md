---
id: 2026-10-03-herramientas-mcp
titulo: "Herramientas de FORGE para agentes externos"
tamano: mediano  # micro | pequeño | mediano | grande
estado: en_implementacion  # borrador | en_revision | aprobada | en_implementacion | completada
creada: 2026-10-03
actualizada: 2026-10-03
autor: humano  # humano | importado
constitucion_version: 1.0.0
etiquetas: [mcp, aislamiento, herramientas]
---

# Especificación: Herramientas de FORGE para agentes externos

## 1. Contexto y Motivación

El ciclo verificado ejecuta el código generado en un entorno aislado y escribe archivos con reglas estrictas, pero solo lo usa el propio ciclo. Quien trabaja con otro agente (Claude Code u otro cliente compatible con el protocolo MCP) no puede aprovechar ese aislamiento ni esas reglas: su agente ejecuta pruebas directamente en el equipo y escribe donde quiera. Esta especificación ofrece esas dos capacidades como herramientas que cualquier cliente MCP puede usar.

## 2. Objetivo

Un cliente MCP puede ejecutar las pruebas del proyecto en el entorno aislado, leer archivos del proyecto y escribir archivos, con exactamente las mismas reglas de confinamiento que usa el ciclo verificado, y sin que ninguna de esas herramientas ejecute código en el equipo anfitrión.

## 3. Usuarios y Actores

| Actor | Rol | Necesidad principal |
|-------|-----|---------------------|
| Operador | Configura su cliente para usar FORGE | Un comando que arranque el servidor y una configuración que copiar |
| Agente externo | Cliente MCP que trabaja sobre el proyecto | Herramientas con descripciones claras y errores que pueda corregir |
| Dueño del proyecto | Responsable del código | Que el agente externo no pueda salirse del proyecto ni ejecutar nada fuera del entorno aislado |

## 4. Historias de Usuario

### HU-001: Ejecutar las pruebas en el entorno aislado
**Como** agente externo
**Quiero** ejecutar las pruebas del proyecto en el entorno aislado
**Para** comprobar mi trabajo sin ejecutar nada en el equipo del operador

**Criterios de aceptación:**
- [ ] **CA-001-01**: La herramienta devuelve el resultado de las pruebas (pasan, fallan, tiempo agotado o fallo del entorno), el código de salida y el final de la salida, sin secretos. (P1)
- [ ] **CA-001-02**: Si el entorno aislado no está disponible, la herramienta lo dice con un error y no ejecuta nada en el equipo anfitrión. (P1)
- [ ] **CA-001-03**: Dos ejecuciones simultáneas, o una durante un ciclo verificado en marcha, no se pisan: la segunda recibe un error que indica que el proyecto está ocupado. (P1)
- [ ] **CA-001-04**: La herramienta no acepta un comando a medida: ejecuta únicamente el comando de pruebas que FORGE detecta en el proyecto. (P1)

### HU-002: Leer archivos del proyecto
**Como** agente externo
**Quiero** leer archivos del proyecto
**Para** entender el código sobre el que trabajo

**Criterios de aceptación:**
- [ ] **CA-002-01**: La herramienta devuelve el contenido de un archivo del proyecto. (P1)
- [ ] **CA-002-02**: Rechaza, con una razón comprensible, las rutas que salen del proyecto, las vetadas (repositorio, estado de FORGE, secretos) y las que llegan a ellas por un enlace. (P1)
- [ ] **CA-002-03**: Un archivo mayor que el tope se devuelve recortado, e indica que lo está. (P2)
- [ ] **CA-002-04**: Se pueden leer los manifiestos de dependencias y la configuración, que no se pueden escribir sin revisión. (P2)

### HU-003: Escribir archivos con las reglas del ciclo
**Como** dueño del proyecto
**Quiero** que un agente externo escriba bajo las mismas reglas que el ciclo verificado
**Para** que no pueda alterar lo que no debe

**Criterios de aceptación:**
- [ ] **CA-003-01**: La herramienta escribe un archivo permitido y devuelve su huella. (P1)
- [ ] **CA-003-02**: Rechaza las mismas rutas que el ciclo: fuera del proyecto, vetadas, no portables y enlaces. (P1)
- [ ] **CA-003-03**: No aplica cambios en dependencias ni en configuración que alguna herramienta ejecuta sola, e indica que requieren revisión humana. (P1)
- [ ] **CA-003-04**: Con el rol de implementación no escribe archivos de prueba; con el rol de pruebas escribe solo archivos de prueba. (P1)
- [ ] **CA-003-05**: Antes de la primera escritura de cada archivo guarda un respaldo de su contenido previo. (P2)
- [ ] **CA-003-06**: Rechaza contenidos mayores que el tope. (P2)

### HU-004: Hablar el protocolo MCP
**Como** operador
**Quiero** que mi cliente se conecte sin adaptaciones
**Para** no depender de una versión concreta de FORGE

**Criterios de aceptación:**
- [ ] **CA-004-01**: Un cliente que sigue el protocolo puede inicializar la conexión, listar las herramientas y llamarlas. (P1)
- [ ] **CA-004-02**: El servidor acepta las versiones del protocolo 2024-11-05, 2025-03-26 y 2025-06-18, y responde con la que el cliente pide si la soporta. (P1)
- [ ] **CA-004-03**: Las peticiones mal formadas, los métodos desconocidos y las herramientas inexistentes reciben los errores estándar del protocolo; el servidor no se cae. (P1)
- [ ] **CA-004-04**: Los errores de una herramienta (ruta rechazada, entorno no disponible) se devuelven como resultado de la herramienta marcado como error, para que el agente pueda corregirlos. (P1)
- [ ] **CA-004-05**: El servidor solo escribe mensajes del protocolo en su salida; sus avisos van por la salida de errores. (P1)
- [ ] **CA-004-06**: Funciona con el cliente oficial del protocolo. (P2)

### HU-005: Arrancar el servidor
**Como** operador
**Quiero** un comando para arrancar el servidor sobre un proyecto
**Para** configurarlo en mi cliente

**Criterios de aceptación:**
- [ ] **CA-005-01**: `forge mcp` arranca el servidor sobre el proyecto actual, o sobre el indicado con `--cwd`. (P1)
- [ ] **CA-005-02**: La documentación incluye la configuración que hay que añadir al cliente. (P2)

## 5. Escenarios de Uso

### Escenario 1: Caso feliz
**Dado** un proyecto con pruebas y el entorno aislado disponible
**Cuando** el agente externo escribe una implementación y ejecuta las pruebas
**Entonces** recibe "pasan" con el código 0 y el final de la salida

### Escenario 2: Caso de error
**Dado** un agente que intenta escribir `sub/.git/config`
**Cuando** llama a la herramienta de escritura
**Entonces** recibe un error que dice que la ruta está vetada, y no se escribe nada

### Escenario 3: Caso borde — cambio de dependencias
**Dado** un agente que escribe `package.json`
**Cuando** llama a la herramienta de escritura
**Entonces** el cambio no se aplica y el error explica que requiere revisión humana

### Escenario 4: Fallo de dependencia — sin entorno aislado
**Dado** un equipo sin el entorno aislado en marcha
**Cuando** el agente pide ejecutar las pruebas
**Entonces** recibe un error que lo explica y no se ejecuta nada

### Escenario 5: Concurrencia
**Dado** un ciclo verificado en marcha sobre el mismo proyecto
**Cuando** el agente externo pide ejecutar las pruebas
**Entonces** recibe un error que indica que el proyecto está ocupado

### Escenario 6: Datos extremos
**Dado** un archivo de varios megabytes
**Cuando** el agente lo lee
**Entonces** recibe el principio recortado y un aviso

## 6. Requisitos Funcionales

- **RF-001**: El sistema DEBE ofrecer tres herramientas: ejecutar pruebas, leer archivo y escribir archivo.
- **RF-002**: El sistema DEBE aplicar a leer y escribir las mismas reglas de rutas que el ciclo verificado, con una sola implementación compartida.
- **RF-003**: El sistema NO DEBE ejecutar nada en el equipo anfitrión; las pruebas solo se ejecutan en el entorno aislado.
- **RF-004**: El sistema NO DEBE aceptar comandos a medida.
- **RF-005**: El sistema DEBE serializar el uso del entorno aislado con el ciclo verificado y entre sí.
- **RF-006**: El sistema DEBE devolver los errores de las herramientas como resultados marcados como error.
- **RF-007**: El sistema DEBE seguir el protocolo MCP sobre la entrada y salida estándar, sin dependencias nuevas.

## 7. Requisitos No Funcionales

| Categoría | Requisito | Métrica |
|-----------|-----------|---------|
| Seguridad | Mismas garantías que el ciclo | Las suites de rutas se ejecutan también contra las herramientas, 0 rutas rechazadas por el ciclo y aceptadas aquí |
| Compatibilidad | Sin dependencias nuevas | `package.json` sin cambios en `dependencies` |
| Compatibilidad | Cliente oficial | Una conexión real con el cliente oficial completa inicialización, listado y las tres llamadas |
| Robustez | Entradas hostiles | Una línea de 10 MB, JSON inválido o un mensaje a medias no tumban el servidor |

## 8. Fuera de Alcance (Exclusiones Explícitas)

- ❌ Comandos a medida o un shell remoto
- ❌ Transporte por red (HTTP, SSE): solo entrada y salida estándar
- ❌ Autenticación: el servidor corre en el equipo del operador, lanzado por su cliente
- ❌ Restaurar los respaldos desde una herramienta (se guardan, pero se restauran a mano)
- ❌ Usar el servidor desde el propio ciclo verificado (el ciclo sigue llamando a las funciones directamente)
- ❌ Recursos, prompts y muestreo del protocolo: solo herramientas

## 9. Dependencias y Asunciones

### Dependencias
- Especificación `2026-10-03-ciclo-verificado`: aislamiento, reglas de rutas y candado de proyecto.

### Asunciones
- El cliente lanza el servidor como proceso hijo y habla por la entrada y salida estándar.
- Un solo proyecto por servidor.

## 10. Términos del Dominio

- **Cliente MCP**: programa que se conecta a un servidor MCP y llama a sus herramientas.
- **Herramienta**: operación con nombre y argumentos que ofrece el servidor.

## 11. Preguntas Abiertas

- [x] ¿Tres herramientas o más? → tres (decisión 21 de la especificación anterior: lo mínimo del plan maestro).
- [x] ¿Dependencia del SDK oficial? → no; ver ADR-12.
- [ ] [POR_DECIDIR]: ¿Debe el servidor publicarse en `.mcp.json` del plugin? Hoy no: se documenta la configuración.

## 12. Criterios de Éxito Medibles

- Los 22 criterios de aceptación tienen al menos un test.
- 0 dependencias nuevas.
- Una conexión real con el cliente oficial del protocolo completa las tres llamadas.

## 13. Referencias

- `.sdd/arquitectura/ADR-12-servidor-mcp-sin-dependencias.md`
- `.sdd/especificaciones/2026-10-03-ciclo-verificado/`
- `PLAN-MOTOR-AGENTICO.md`, FASE 2
- Protocolo MCP: https://modelcontextprotocol.io

## 14. Historial de Aclaraciones

| # | Categoría | Pregunta | Decisión | Fecha |
|---|-----------|----------|----------|-------|
| 1 | Proceso | ¿Se empieza S2 sin aprobación expresa? | Sí: el dueño pidió seguir con la fase siguiente sin preguntar. Aprobada por delegación | 2026-10-03 |
| 2 | Alcance | ¿El ciclo pasa a usar el servidor? | No: el ciclo sigue llamando a las funciones directamente; el servidor es para agentes externos | 2026-10-03 |
| 3 | Seguridad | ¿Qué rol tiene quien escribe? | Dos: implementación (no puede escribir pruebas) y pruebas (solo puede escribir pruebas), sin lista de pruebas protegidas | 2026-10-03 |
