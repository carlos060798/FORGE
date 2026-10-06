---
id: 2026-10-04-memoria-semantica
titulo: "Memoria semántica del repositorio para el ciclo verificado"
tamano: pequeño  # micro | pequeño | mediano | grande
estado: en_implementacion  # borrador | en_revision | aprobada | en_implementacion | completada
creada: 2026-10-04
actualizada: 2026-10-04
autor: humano  # humano | importado
constitucion_version: 1.0.0
etiquetas: [memoria, contexto, busqueda]
---

# Especificación: Memoria semántica del repositorio

## 1. Contexto y Motivación

El ciclo verificado solo da a los agentes los archivos que la tarea o el plan nombran. Si el código relevante está en otro archivo que nadie nombró, el agente no lo ve y escribe algo que no encaja. El plan original (RAG) pedía buscar en el repositorio por similitud.

## 2. Objetivo

Los agentes reciben, además de los archivos nombrados, los trozos del repositorio más parecidos a la tarea, sin superar el tope de contexto, sin leer nada que un modelo no pueda leer y sin que un fallo de la búsqueda detenga el ciclo.

## 3. Usuarios y Actores

| Actor | Rol | Necesidad principal |
|-------|-----|---------------------|
| Operador | Configura el ciclo | Activar la búsqueda con una opción y saber qué hace |
| Agente | Recibe el contexto | Ver el código relacionado aunque nadie lo nombrara |

## 4. Historias de Usuario

### HU-001: Contexto por similitud
**Como** operador
**Quiero** que el ciclo añada al contexto los trozos del repositorio parecidos a la tarea
**Para** que los agentes escriban código que encaje con el existente

**Criterios de aceptación:**
- [ ] **CA-001-01**: Con la opción activada, el contexto lleva primero los archivos de la tarea y después trozos parecidos de otros archivos, sin repetir archivos. (P1)
- [ ] **CA-001-02**: El contexto entregado, cabeceras incluidas, nunca supera el tope de bytes, con cualquier tope. (P1)
- [ ] **CA-001-03**: Lo que un modelo no puede leer (secretos, carpetas vetadas, enlaces) no se indexa ni se devuelve. (P1)
- [ ] **CA-001-04**: Si la búsqueda falla, el ciclo continúa con el contexto por archivos y el motivo queda anotado. (P1)
- [ ] **CA-001-05**: Sin la opción, el comportamiento es el de siempre. (P1)

### HU-002: Índice mantenido solo
**Como** operador
**Quiero** que el índice se mantenga sin pasos manuales
**Para** no tener que reconstruirlo

**Criterios de aceptación:**
- [ ] **CA-002-01**: El índice solo vuelve a vectorizar los archivos que cambiaron, y olvida los borrados. (P2)
- [ ] **CA-002-02**: Un índice dañado o de otro embedder se reconstruye en lugar de usarse. (P2)

### HU-003: Elegir cómo se calculan los vectores
**Como** operador
**Quiero** elegir entre un cálculo local sin red y un servidor de embeddings local
**Para** ajustar calidad frente a dependencias

**Criterios de aceptación:**
- [ ] **CA-003-01**: Con el cálculo local no hace falta red ni servicios; con el servidor local, las peticiones solo van a la dirección configurada y los errores del servidor son claros. (P2)
- [ ] **CA-003-02**: Una opción desconocida es un error claro. (P2)

## 5. Escenarios de Uso

### Escenario 1: Caso feliz
**Dado** una tarea «reembolso de un pago» y un archivo de pagos que nadie nombró
**Cuando** corre el ciclo con la búsqueda activada
**Entonces** el agente recibe también los trozos de ese archivo

### Escenario 2: Fallo de dependencia
**Dado** el servidor de embeddings apagado
**Cuando** corre el ciclo
**Entonces** sigue con el contexto por archivos y lo anota

### Escenario 3: Datos extremos
**Dado** un tope de contexto de 50 bytes
**Cuando** se pide contexto
**Entonces** el texto no lo supera

## 6. Requisitos Funcionales

- **RF-001**: El sistema DEBE tratar el recuperador como sustituible sin tocar el resto del ciclo.
- **RF-002**: El sistema NO DEBE indexar ni devolver rutas vetadas ni seguir enlaces simbólicos.
- **RF-003**: El sistema DEBE respetar el tope de bytes y no partir caracteres UTF-8.

## 7. Requisitos No Funcionales

| Categoría | Requisito | Métrica |
|-----------|-----------|---------|
| Dependencias | Ninguna nueva | `package.json` sin cambios en `dependencies` |
| Rendimiento | Incremental | Una segunda actualización sin cambios reindexa 0 archivos |

## 8. Fuera de Alcance (Exclusiones Explícitas)

- ❌ LanceDB, pgvector o cualquier base de datos (ADR-14)
- ❌ Embeddings en la nube
- ❌ Sustituir el indexador de `utils/hybrid-indexer.js`
- ❌ Calidad semántica con el cálculo local: es léxico, no semántico

## 9. Dependencias y Asunciones

- Puerto `Recuperador` (ADR-08).
- Asunción: para vectores semánticos de verdad hace falta un Ollama local con un modelo de embeddings descargado; no está probado aquí.

## 10. Términos del Dominio

- **Trozo**: 40 líneas de un archivo, con 10 de solape con el siguiente.
- **Embedder**: función que convierte texto en un vector.

## 11. Preguntas Abiertas

- [ ] [POR_DECIDIR]: ¿Se quiere LanceDB cuando el repositorio supere unos miles de trozos?
- [ ] [POR_DECIDIR]: ¿Se activa `semantico` por defecto en 5.0.0?

## 12. Criterios de Éxito Medibles

- Los 9 criterios de aceptación tienen test.
- 0 dependencias nuevas.

## 13. Referencias

- `.sdd/arquitectura/ADR-08-puerto-recuperador.md`, `ADR-14-indice-vectorial-propio.md`
- `PLAN-MOTOR-AGENTICO.md`, FASE 3
- `docs/memoria-semantica.md`

## 14. Historial de Aclaraciones

| # | Categoría | Pregunta | Decisión | Fecha |
|---|-----------|----------|----------|-------|
| 1 | Proceso | ¿Se empieza S3 sin aprobación expresa? | Sí: el dueño pidió seguir con las tareas pendientes. Aprobada por delegación | 2026-10-04 |
| 2 | Alcance | ¿LanceDB? | No ahora (ADR-14): índice propio con embedders enchufables | 2026-10-04 |
