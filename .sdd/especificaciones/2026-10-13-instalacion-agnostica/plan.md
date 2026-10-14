# Plan de implementación: Instalación agnóstica de herramienta

> Spec: `spec.md` · Estado: **borrador, sin aprobar** · Sin ADR nuevo salvo que la pregunta 3 cambie el nombre del comando

## 1. Suposiciones tomadas (corregibles)

| # | Pregunta de la spec | Suposición del plan | Qué cambia si se invierte |
|---|---|---|---|
| 1 | Perfil por defecto en instalaciones nuevas | Se implementan los dos perfiles y el valor por defecto queda en `completo` hasta que el dueño decida | Una constante y una nota en el CHANGELOG |
| 2 | Comandos del perfil esencial | Los seis del camino principal | La lista del perfil |
| 3 | Nombre del comando | No se toca | Otra especificación |
| 4 | Herramientas de la primera entrega | Claude Code, genérica y las dos que confirme el spike | Entradas de la tabla |

## 2. Principios del diseño

- **Sin opción, sin cambio:** el camino actual de `forge init` es el caso `claude` de la tabla y se compara archivo por archivo con el anterior.
- **Una fuente:** los comandos siguen en `commands/`; las skills se generan, no se editan.
- **Tabla, no código por herramienta:** añadir una herramienta es añadir una fila con su fuente.
- **Misma política de escritura** que el instalador actual.

## 3. Módulos

| Módulo | Responsabilidad |
|---|---|
| `core/instalacion/integraciones.js` (nuevo) | Tabla de integraciones: clave, carpeta de skills, qué más se instala (comandos, agentes, hooks), forma de invocación, URL y fecha de la fuente; validación de la clave y de la carpeta genérica |
| `core/instalacion/skills-de-comandos.js` (nuevo) | Convierte un comando de `commands/` en una carpeta de skill con `SKILL.md`; avisa de lo que no es neutral |
| `core/instalacion/perfiles.js` (nuevo) | Perfiles `esencial` y `completo` |
| `scripts/generar-skills.mjs` (nuevo) | Genera las skills de los comandos antes de empaquetar; lo usa también la prueba de divergencia |
| `cli/index.js` | `copiarNucleo` recibe la integración y el perfil; `init`, `update` y `doctor` |
| `core/agents-md.js` | Sin cambios de formato; se llama en todas las integraciones |

## 4. Flujo

1. `forge init [--integracion <clave>] [--perfil <p>] [--carpeta-skills <ruta>]`.
2. Se valida la clave contra la tabla; desconocida, se rechaza sin escribir.
3. Se resuelven los destinos y se validan con la escritura segura.
4. Se copian las skills propias y las generadas según el perfil; comandos, agentes y hooks solo si la integración los admite.
5. Se genera `AGENTS.md`.
6. Se guarda integración y perfil en la configuración del proyecto.
7. Se imprime qué se instaló, qué no y cómo invocar la primera skill.

## 5. Datos

- Configuración del proyecto: `instalacion.integracion`, `instalacion.perfil`, `instalacion.carpeta_skills` (solo en la genérica). Ausentes equivalen a `claude` y `completo`.

## 6. Fases

| Fase | Contenido | Sale con |
|---|---|---|
| S0 | Spikes de carpetas y de campos de `SKILL.md` | `spikes/carpetas-de-skills.md` |
| F1 | Tabla, validación y `--integracion` con `claude` y `generica`; prueba de equivalencia con el instalador actual | HU-001 parcial, HU-002 |
| F2 | Generador de skills y prueba de divergencia; skills en el paquete | HU-003 |
| F3 | Perfiles | HU-004 |
| F4 | Dos herramientas más, con prueba manual registrada | HU-001 completa |
| F5 | `doctor`, documentación y verificación | Cierre |

## 7. Pruebas

- Equivalencia: árbol de `forge init` sin opciones antes y después.
- Tabla: clave desconocida, carpeta genérica fuera del proyecto, unión hacia fuera, archivo ajeno existente.
- Generador: los 39 comandos producen `SKILL.md` válido; divergencia detectada al modificar una copia.
- Paquete: `npm pack --dry-run` contiene las skills generadas.
- Plataforma: las pruebas pasan en Windows y en el contenedor Linux usado el 2026-10-13.

## 8. Riesgos del plan

| Riesgo | Señal | Respuesta |
|---|---|---|
| El spike no confirma ninguna carpeta más | S0.1 sin fuentes primarias | Se entrega con `claude` y `generica` y se documenta |
| Algún comando depende de herramientas propias de Claude Code | Aviso del generador | Se excluye del perfil esencial y se anota |
| `forge update` cambia instalaciones existentes | Falla la prueba de equivalencia | No se fusiona |
