# Verificación: instalacion-agnostica

> **Fecha:** 2026-11-11 · Escrita a mano leyendo `spec.md`, `tareas.md`, `core/instalacion/`, `cli/comandos/instalar.js` y los archivos de `tests/` citados. Sustituye al listado generado del 2026-10-24, que solo enlazaba por identificador. **No se ejecutó la suite al escribirla.** La última pasada que consta en `tareas.md` (2026-10-31: Windows 4035 pasan, 0 fallan, 31 omitidas; Linux en contenedor 4043 pasan, 0 fallan) es anterior a los cambios de 2026-11-10 y 2026-11-11; la sesión posterior dio 4245 pruebas con 0 fallos en Windows. Sin revisión independiente.

## Criterio → pruebas

| Criterio | Prueba | Estado |
|---|---|---|
| CA-001-01 instalar en la carpeta de la herramienta; tabla con fuente y fecha | `tests/instalacion-integraciones.test.js`: «${clave} instala en ${carpeta}» (una por clave); «cada fila cita su URL y su fecha de consulta» | **Con prueba** |
| CA-001-02 genérica con carpeta validada | «carpeta genérica: dentro del proyecto o de la personal; fuera, no»; «genérica sin carpeta o con carpeta fuera del proyecto se rechaza sin escribir»; `tests/instalacion-proyecto-hostil.test.js` | **Con prueba** |
| CA-001-03 clave desconocida rechazada con la lista | «clave desconocida se rechaza con la lista de válidas»; «clave desconocida: error con la lista y no escribe nada» | **Con prueba** |
| CA-001-04 escritura segura | F1.4: «una unión hacia fuera no se sigue...», «un enlace duro hacia un archivo de fuera no se pisa», «un archivo ajeno existente no se pisa sin avisar» | **Con prueba.** Las de enlaces dependen de poder crear enlaces; en Windows algunas se omiten (`docs/ESTADO-ACTUAL.md`) |
| CA-001-05 imprime qué instaló, qué no y cómo invocar | «genérica: solo skills y AGENTS.md...» comprueba `Instalado:`, `No instalado:` y `Cómo invocar:` | **Con prueba** |
| CA-001-06 `AGENTS.md` en todas las integraciones | La misma prueba comprueba `AGENTS.md` solo con `generica` | **A medias:** no se comprueba en las demás claves |
| CA-001-07 Claude Code, genérica y al menos dos más con carpeta confirmada | «solo herramientas con carpeta confirmada; Zed y Goose no entran» (lista fija de claves, hoy incluye `codex`) | **Con prueba de la tabla.** «Confirmada» es lectura de documentación (`spikes/carpetas-de-skills.md`), no prueba en la herramienta |
| CA-002-01 `init` sin opciones idéntico al anterior | `tests/instalacion-equivalencia.test.js` | **Con prueba** |
| CA-002-02 `update` respeta la integración | «init guarda integración y perfil; update sin opciones los respeta» | **Con prueba** |
| CA-002-03 hooks y agentes de Claude solo con `claude` | «genérica: solo skills y AGENTS.md; sin comandos, agentes, hooks, settings ni CLAUDE.md» | **Con prueba para `generica`.** Desde 2026-11-11 las integraciones no nativas instalan además roles `rol-*` (spec `2026-11-10-metodologia-agnostica`); los agentes con cabecera de Claude Code siguen sin instalarse |
| CA-003-01 los 39 comandos como skills con `SKILL.md` válido | `tests/instalacion-skills-comandos.test.js`: «todos los comandos producen un SKILL.md válido con name igual a la carpeta» | **Con prueba** |
| CA-003-02 falla si comando y skill divergen | «las skills generadas del repositorio están al día»; «modificar una copia del comando se detecta» | **Con prueba** |
| CA-003-03 sin instrucciones solo de Claude Code sin alternativa o aviso | «allowed-tools pasa de comas a espacios; handoffs y aliases van a metadata y se avisa»; para otras herramientas, además, `tests/instalacion-anfitrion.test.js` | **Con prueba** |
| CA-003-04 el paquete lleva las skills generadas | «npm pack --dry-run contiene las skills generadas» | **Con prueba** |
| CA-004-01 perfiles `esencial` (máx. seis) y `completo` | «esencial tiene como máximo seis comandos, todos existentes; completo, todos» | **Con prueba** |
| CA-004-02 `--perfil`, `forge config`, `update` lo aplica | «forge config set instalacion.perfil cambia el perfil y update lo aplica»; «perfil desconocido se rechaza sin escribir» | **Con prueba** |
| CA-004-03 una instalación existente no cambia de perfil | «una instalación existente completa (sin sección) sigue siendo completa tras update»; «update sobre una instalación esencial no añade comandos que la persona no tenía» | **Con prueba** |
| CA-004-04 perfil por defecto lo decide el dueño | «el valor por defecto es esencial (ADR-24, CA-001-01)» | **Cambiado respecto a la spec:** la spec decía `completo` hasta decisión; ADR-24 (propuesta, 2026-11-09) lo pasó a `esencial` |
| RF-06 `forge doctor` informa integración y perfil | `tests/doctor-instalacion.test.js` (tres tests) | **Con prueba** |

## Tareas abiertas

- **F4.2 Prueba manual por herramienta:** **no hecha.** La hace el dueño. No consta ningún registro de instalar e invocar una skill en una herramienta real; hasta entonces el criterio de éxito «se invocan en al menos tres herramientas» no se cumple.
- **F5.4 Este documento:** hecho con esta versión.
- **F4.1 Dos filas nuevas:** la tabla de `core/instalacion/herramientas-destino.js` tiene hoy `agents`, `codex`, `copilot`, `cursor`, `gemini`, `windsurf`, `opencode` y `kiro`, cada una con fuente y fecha. Hecho; sin prueba en las herramientas.

## Límites de este documento

- Se leyó el código y las pruebas, no se corrieron.
- Las pruebas con Docker real no intervienen en esta spec.
- Los nombres de test son los de los archivos al 2026-11-11.
