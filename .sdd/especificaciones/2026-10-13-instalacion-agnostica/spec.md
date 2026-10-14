---
id: 2026-10-13-instalacion-agnostica
titulo: "Instalación agnóstica de herramienta: integraciones por clave y comandos como skills"
tamano: mediano  # micro | pequeño | mediano | grande
estado: borrador  # borrador | en_revision | aprobada | en_implementacion | completada
creada: 2026-10-13
actualizada: 2026-10-13
autor: humano  # humano | importado
constitucion_version: 1.1.0
etiquetas: [instalacion, agnostico, skills, agents-md]
---

# Especificación: Instalación agnóstica de herramienta

> **Estado: borrador.** Redactada por un agente por encargo del dueño (2026-10-13); **no está aprobada** y no se implementa hasta que el dueño la apruebe (Principio II). Corresponde a los incrementos I1 e I2 de `PLAN-INCREMENTAL.md`.

## 1. Contexto y Motivación

`forge init` copia comandos, agentes, skills y hooks siempre a `.claude/` (`cli/index.js:87`, `copiarNucleo`). FORGE ya tiene 31 skills en el formato abierto `SKILL.md` y genera `AGENTS.md`, dos formatos que hoy leen decenas de herramientas (consultado el 2026-10-13 en agentskills.io y agents.md). Pero quien use otra herramienta no recibe nada: el destino está fijado, y los 39 comandos están en un formato propio de Claude Code.

Spec Kit resuelve lo mismo con una clave de integración por herramienta y una opción genérica; OpenSpec, con un perfil corto de cuatro comandos por defecto. FORGE tiene 39 comandos visibles desde el primer día, lo que es una barrera de entrada.

## 2. Objetivo

Que `forge init` pueda instalar las capacidades de FORGE en la carpeta que lee **la herramienta que el usuario elija**, que los comandos existan también como skills generadas desde una sola fuente, y que la instalación por defecto ofrezca un conjunto corto de comandos, **sin cambiar nada para quien hoy instala sin opciones**.

## 3. Usuarios y Actores

| Actor | Rol | Necesidad principal |
|---|---|---|
| Usuario de Claude Code | Instala como hoy | Que nada cambie |
| Usuario de otra herramienta | Usa Codex, Cursor, Copilot u otra | Recibir las skills donde su herramienta las lee y saber cómo invocarlas |
| Usuario nuevo | Llega sin conocer FORGE | Ver pocos comandos y entender por cuál empezar |
| Mantenedor | Añade o cambia comandos | Editar una sola fuente, no dos copias |

## 4. Historias de Usuario

### HU-001: Instalar para otra herramienta
**Como** usuario de otra herramienta
**Quiero** indicar mi herramienta al instalar
**Para** recibir las skills donde ella las lee

**Criterios de aceptación:**
- [ ] **CA-001-01**: `forge init --integracion <clave>` instala las skills en la carpeta de esa herramienta. La tabla de claves y carpetas vive en un solo módulo y cada entrada cita la URL de la documentación oficial y la fecha en que se comprobó. (P1)
- [ ] **CA-001-02**: `--integracion generica --carpeta-skills <ruta>` instala en una carpeta que elige el usuario, para herramientas no listadas. La ruta debe quedar dentro del proyecto o de la carpeta personal; cualquier otra se rechaza. (P1)
- [ ] **CA-001-03**: Una clave desconocida se rechaza con la lista de claves válidas, sin escribir nada. (P1)
- [ ] **CA-001-04**: Toda escritura pasa por `core/escritura-segura.js`: no se siguen enlaces ni uniones hacia fuera, y un archivo existente que no es de FORGE no se pisa sin avisar. (P1)
- [ ] **CA-001-05**: Al terminar, el instalador imprime cómo se invoca una skill en esa herramienta y por cuál empezar. (P2)
- [ ] **CA-001-06**: `AGENTS.md` se genera o actualiza en todas las integraciones, con `core/agents-md.js`. (P2)
- [ ] **CA-001-07**: La primera entrega cubre Claude Code, la opción genérica y al menos dos herramientas más cuya carpeta se haya confirmado en el spike S0.1. Ninguna entra en la tabla sin confirmar. (P1)

### HU-002: Quien instala como hoy no nota nada
**Como** usuario de Claude Code
**Quiero** que `forge init` sin opciones haga lo mismo que hoy
**Para** no tener que migrar

**Criterios de aceptación:**
- [ ] **CA-002-01**: Sin `--integracion`, el resultado de `forge init` y de `forge update` es idéntico, archivo por archivo, al de la versión anterior, salvo lo que añade HU-003 de forma explícita. (P1)
- [ ] **CA-002-02**: `forge update` respeta la integración con la que se instaló; no hay que repetir la opción. (P1)
- [ ] **CA-002-03**: Hooks y agentes con cabecera de Claude Code solo se instalan con la integración de Claude Code; las demás reciben skills y `AGENTS.md`, y el instalador dice qué no se instaló y por qué. (P1)

### HU-003: Comandos como skills desde una sola fuente
**Como** mantenedor
**Quiero** que cada comando se escriba una vez
**Para** que el comando de Claude Code y la skill no diverjan

**Criterios de aceptación:**
- [ ] **CA-003-01**: Los 39 comandos existen como skills con `SKILL.md` válido (nombre y descripción como mínimo), generadas desde la fuente del comando. (P1)
- [ ] **CA-003-02**: Una prueba falla si un comando y su skill generada no corresponden a la misma fuente. (P1)
- [ ] **CA-003-03**: Una skill generada no incluye instrucciones que solo valen en Claude Code (por ejemplo `allowed-tools`) sin una alternativa neutral o un aviso. (P2)
- [ ] **CA-003-04**: El paquete publicado (`npm pack`) contiene las skills generadas; una prueba lo comprueba. (P1)

### HU-004: Perfil corto por defecto en instalaciones nuevas
**Como** usuario nuevo
**Quiero** ver pocos comandos
**Para** saber por dónde empezar

**Criterios de aceptación:**
- [ ] **CA-004-01**: Existe un perfil `esencial` con un máximo de seis comandos y un perfil `completo` con todos. La lista del perfil esencial se decide en la pregunta abierta 2. (P1)
- [ ] **CA-004-02**: `forge init --perfil esencial|completo` elige el perfil; `forge config` permite cambiarlo después y `forge update` lo aplica. (P1)
- [ ] **CA-004-03**: El perfil por defecto de una instalación **existente** no cambia al actualizar. (P1)
- [ ] **CA-004-04**: El perfil por defecto de una instalación nueva lo decide el dueño (pregunta abierta 1); hasta entonces sigue siendo `completo`. (P1)

## 5. Escenarios de Uso

### Escenario 1: Caso feliz con otra herramienta
`forge init --integracion <clave>` en un proyecto vacío: se crean la carpeta de skills de esa herramienta y `AGENTS.md`; el instalador imprime la forma de invocar la primera skill.

### Escenario 2: Herramienta no listada
`forge init --integracion generica --carpeta-skills .mi-herramienta/skills`: se instala ahí. Con `--carpeta-skills ../../fuera` se rechaza sin escribir.

### Escenario 3: Proyecto hostil
El proyecto trae la carpeta de destino como una unión hacia fuera. No se escribe al otro lado y el instalador lo dice, como ya hace `forge config set`.

### Escenario 4: Actualización
Un proyecto instalado para Claude Code ejecuta `forge update` con la versión nueva: mismo destino, mismo perfil, mismos archivos más las skills generadas.

## 6. Requisitos Funcionales

| ID | Requisito | Prioridad |
|---|---|---|
| RF-01 | Tabla de integraciones en un módulo, con clave, carpeta de skills, forma de invocación, fuente y fecha | P1 |
| RF-02 | Opción genérica con carpeta elegida y validada | P1 |
| RF-03 | Generador de skills a partir de los comandos | P1 |
| RF-04 | Perfiles de comandos | P1 |
| RF-05 | La integración y el perfil elegidos se guardan en la configuración del proyecto | P1 |
| RF-06 | `forge doctor` informa de la integración y el perfil instalados | P2 |

## 7. Requisitos No Funcionales

| ID | Requisito |
|---|---|
| RNF-01 | Sin dependencias nuevas (Principio IV) |
| RNF-02 | Sin red: la tabla de integraciones es estática (Principio III) |
| RNF-03 | Escritura segura en todos los caminos (misma política que `forge init` hoy) |
| RNF-04 | Funciona en Windows y en Linux; las pruebas no asumen separador de rutas |
| RNF-05 | Documentación al día: guía, `getting-started.md` y `README.md` (Principio XI) |

## 8. Fuera de Alcance (Exclusiones Explícitas)

- Adaptadores que ejecuten otra herramienta desde FORGE (`forge dispatch`): no cambian.
- Convertir los 14 agentes a un formato neutral: es otra especificación.
- Publicar en registros de skills de terceros.
- Mantener una clave por cada herramienta del mercado: para las no listadas existe la opción genérica.
- Cambiar el nombre del comando `forge` (ver pregunta abierta 3).

## 9. Dependencias y Asunciones

### Spikes obligatorios antes de construir
- **S0.1** Carpeta exacta de skills y forma de invocación de cada herramienta candidata, desde su documentación oficial, con URL y fecha. Lo confirmado hasta ahora, de segunda mano por la página de integraciones de Spec Kit: Copilot `.github/skills/`; Codex y Zed `.agents/skills`.
- **S0.2** Qué campos de la cabecera de `SKILL.md` son obligatorios en la especificación abierta y cuáles son extensiones de una herramienta.

### Dependencias
- `cli/index.js` (`copiarNucleo`, `copiarSeguro`), `core/escritura-segura.js`, `core/agents-md.js`, `commands/`, `skills/`, `presets/`.

### Asunciones
- El formato `SKILL.md` sigue siendo estable y abierto.
- Los comandos actuales pueden expresarse como skills sin perder contenido esencial; si alguno no puede, se documenta.

## 10. Riesgos

| Riesgo | Mitigación |
|---|---|
| Una carpeta de destino mal documentada deja las skills donde nadie las lee | Ninguna clave sin spike; prueba manual registrada por herramienta |
| Las skills generadas pesan en el contexto de la herramienta | Carga progresiva del formato: solo nombre y descripción al inicio; descripciones cortas |
| Dos fuentes de verdad durante la transición | Prueba CA-003-02 desde el primer commit |
| Un repositorio hostil redirige la escritura | Escritura segura y prueba con uniones, como en `proyecto-hostil.test.js` |

## 11. Términos del Dominio

- **Integración:** herramienta de destino de la instalación, identificada por una clave.
- **Skill:** carpeta con `SKILL.md` según el formato abierto Agent Skills.
- **Perfil:** conjunto de comandos que se instalan.

## 12. Preguntas Abiertas

| # | Pregunta | Recomendación |
|---|---|---|
| 1 | ¿El perfil por defecto de una instalación nueva pasa a ser `esencial`? | Sí, a partir de la primera versión que lo incluya, anunciándolo en el CHANGELOG |
| 2 | ¿Qué comandos forman el perfil esencial? | Los del camino principal: idea, especificación, plan, tareas, implementación y estado |
| 3 | El comando `forge` choca con otra herramienta del mismo nombre que figura en la lista de integraciones de Spec Kit. ¿Se mantiene? | Decidirlo antes de publicar; `sdd-es` ya existe como alias en `package.json` |
| 4 | ¿Qué herramientas entran en la primera entrega además de Claude Code y la genérica? | Las dos con más uso entre quienes prueben la beta |

## 13. Criterios de Éxito Medibles

- Las skills se instalan y se invocan en al menos tres herramientas, con una prueba manual registrada por cada una.
- `forge init` sin opciones produce el mismo árbol que antes (prueba automática).
- Cero comandos con skill divergente (prueba automática).

## 14. Referencias

- `PLAN-INCREMENTAL.md` (I1, I2), `PLAN-ESCALADO.md` (E2).
- Agent Skills: https://agentskills.io/ · AGENTS.md: https://agents.md/
- Spec Kit, integraciones: https://github.com/github/spec-kit/blob/main/docs/reference/integrations.md
- OpenSpec: https://github.com/Fission-AI/OpenSpec

## 15. Historial de Aclaraciones

- 2026-10-13: creada en borrador a partir de la investigación de herramientas parecidas.
