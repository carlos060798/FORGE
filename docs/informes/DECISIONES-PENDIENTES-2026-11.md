# Decisiones pendientes del dueño (noviembre de 2026)

> Tipo: Informe · Fecha: 2026-11-24 · Rama: `feature/cierre-auditoria` · Lectura: unos 5 minutos.
> Este documento **no decide nada**. Reúne lo que solo puede decidir o hacer la persona responsable, con la recomendación que ya figura en cada especificación y lo que pasa con cada opción. Cada dato se comprobó en el archivo que se cita; lo que no se pudo comprobar está marcado «no verificado».

## Cómo leerlo

- **Aprobar una spec** lo registra el dueño con `fragua aprobar` en una terminal real ([GOVERNANCE.md](../../GOVERNANCE.md)). Ningún agente lo hace por su cuenta.
- **Aceptar un ADR** es cambiar su estado de `propuesta` a `aceptada` ([GOVERNANCE.md](../../GOVERNANCE.md)).
- Las dos especificaciones de agnosticismo se aprobaron «por delegación» el 2026-11-11 y siguen **pendientes de ratificación**.

## 1. Specs y ADR

| # | Decisión | Recomendación que consta | Si dices que sí | Si dices que no |
|---|---|---|---|---|
| 1 | **Ratificar** `2026-10-13-instalacion-agnostica` y `2026-11-10-metodologia-agnostica` (aprobadas por delegación el 2026-11-11) | Ratificar: la instalación por herramienta y la adaptación de comandos están implementadas y con pruebas (`verificacion.md` de cada una) | Pasan de «por delegación» a aprobadas por ti, sin tocar código | Hay que decir qué parte se revierte; la tabla de integraciones y el instalador dependen de ellas |
| 2 | **Specs que siguen en borrador** según `.sdd/INDICE.md` (15): `verificar-sin-modelo`, `proveedores-agnosticos`, `guardian-endurecido`, `aprobaciones-con-identidad`, `aislamiento-opcional`, `ci-verde-y-cuarentena`, `puerta-de-entrada-solo-dev`, `enlaces-verificados-en-windows`, `correcciones-de-precision`, `sitio-generado-desde-docs`, `aislamiento-usuario-linux`, `equipos-y-ciclo-en-ci`, `guardian-fuera-de-claude-code`, `despliegue-con-aprobacion`, `perfiles-de-agente` | Sin recomendación única. Varias están **implementadas sin aprobar** (por ejemplo `guardian-endurecido`, `aprobaciones-con-identidad`, `puerta-de-entrada-solo-dev`): conviene aprobarlas o decidir qué se revierte. Las que son solo especificación (`aislamiento-opcional`, `equipos-y-ciclo-en-ci`, `despliegue-con-aprobacion`) pueden esperar | Aprobar deja el registro limpio | Sin aprobar, el repositorio afirma código que ninguna decisión tuya respalda |
| 3 | **Aceptar los ADR en `propuesta`:** ADR-22 (integraciones externas), ADR-23 (cuarentena de pruebas), ADR-24 (perfil esencial por defecto), ADR-25 (sitio con Starlight), ADR-26 (el guardián clasifica por su entrada lo que no reconoce) | ADR-22, 23, 24 y 26 están implementados; ADR-25 no tiene código | Pasan a `aceptada` | Hay que indicar la alternativa; ADR-24 cambia lo que ve un usuario nuevo |

## 2. Equipos y CI (`2026-11-10-equipos-y-ciclo-en-ci`)

Nada de esto se implementa hasta cerrar el MVP (CI verde, beta publicada, uso real). Las cinco decisiones de la spec, tal como están escritas en su sección 4:

| # | Pregunta | Propuesta de la spec |
|---|---|---|
| 1 | **Firma** de las aprobaciones: ¿SSH (reutiliza la clave de firmar commits, sin dependencias) o GPG (más extendido en empresas, exige binario)? | SSH primero |
| 2 | **Versionar `.sdd/aprobaciones.jsonl`:** cambia la regla de que `.sdd/` no se versiona salvo artefactos. ¿Sí o no? | Sin propuesta escrita |
| 3 | **Exportar ciclos** frente a «cada persona empieza su ciclo y el CI es la fuente de verdad» | **Aplazar** la exportación; hacer solo aprobaciones firmadas más ciclo en CI |
| 4 | **Código de salida** para «decisión pendiente» en CI (hoy: 0 éxito, 1 fallo, 4 sin aislamiento, 5 cero pruebas) | 6, que está libre |
| 5 | **Tope de gasto en CI:** por ejecución, por día de repositorio, o ambos | Sin propuesta escrita |

## 3. Publicación y nombres

| # | Decisión | Estado verificado | Qué hay que saber |
|---|---|---|---|
| 4 | **Cuándo publicar** `5.0.0-beta.1` con la etiqueta `beta` (`npm publish --tag beta`) | Sin publicar ([roadmap.md](../roadmap.md), [RELEASE-CHECKLIST.md](../../RELEASE-CHECKLIST.md)) | Los criterios B1 a B5 de la checklist siguen abiertos: CI verde en Linux, gasto frente a lo facturado, tasa de éxito en tareas reales y cuarta revisión independiente. «Nada de esta sección se ha ejecutado» |
| 5 | **Nombre del paquete y de las órdenes** | `package.json`: paquete `fragua`; órdenes `fragua`, `forge` y `sdd-es` | La checklist avisa de que `npx forge@latest` descargaría **otro** paquete de npm llamado `forge`; por eso se usa `npx -p fragua forge`. Que `fragua` esté libre en npm se comprobó el 2026-10-14: **repetirlo el día de publicar** (no verificado hoy). Decidir si se conservan las tres órdenes |
| 6 | **Marca y dominio de «Fragua»** | Pendiente: [roadmap.md](../roadmap.md) y [ESTADO-ACTUAL.md](../ESTADO-ACTUAL.md) lo dejan como tarea del dueño | No hay comprobación de marca registrada hecha (no verificado). Afecta también la dirección pública del sitio (decisión 4 de `sitio-generado-desde-docs`: `github.io/FORGE` o dominio propio) |
| 7 | **Titular de la licencia** | `LICENSE` dice «Copyright (c) 2026 Danilo Angarita»; `GOVERNANCE.md` dice que el titular de la licencia MIT es **carlos060798**, propietario del repositorio; el `CODEOWNERS` y las URL del paquete usan `carlos060798` | Los dos nombres pueden ser la misma persona (nombre real y usuario de GitHub); el repositorio no lo dice. Conviene que `LICENSE` y `GOVERNANCE.md` nombren lo mismo antes de publicar |

## 4. Cosas que solo puedes hacer tú

| # | Tarea | Dónde consta | Para qué |
|---|---|---|---|
| 8 | `gh auth login` y leer los logs del último run rojo de `main` (**tarea T8**) | `.sdd/especificaciones/2026-11-09-ci-verde-y-cuarentena/tareas.md` | Sin los logs no se puede clasificar por qué falla la CI en Linux (carga, rutas, Docker, otro). Es el primer criterio de publicación |
| 9 | Proteger `main` con los checks requeridos y crear el tag `v5.0.0-beta.1` (**T10**), cuando `main` esté verde | misma `tareas.md` | La spec propone requerir `test` (Node 20 y 22), `test-windows`, `tipos` y `evidencia`; los de Docker solo si llegan a verde |
| 10 | Reproducir la suite en Linux (WSL2 con Docker) (**T9**) | misma `tareas.md` | No hay ninguna pasada verde en Linux ni en macOS |
| 11 | **Rotar la clave de Anthropic** que apareció en una conversación y poner una nueva con un tope | [ESTADO-ACTUAL.md](../ESTADO-ACTUAL.md), «Lo que solo puede hacer la persona responsable» | Higiene de credenciales; no depende de ningún cambio de código |
| 12 | **Prueba manual en herramientas reales** (F5) | Guion en `.sdd/especificaciones/2026-11-10-metodologia-agnostica/verificacion.md` | Hoy ninguna herramienta distinta de Claude Code está probada; el informe de evaluación concluyó «parcialmente» ([EVALUACION-AGNOSTICISMO.md](EVALUACION-AGNOSTICISMO.md)) |

## 5. Decisiones de diseño que esperan en otras specs

| Spec | Decisiones (de su sección «Decisiones abiertas») |
|---|---|
| `2026-11-06-aislamiento-opcional` | ¿Se acepta el nivel `local` o se prefiere Podman como segundo runtime? ¿`requerido` por defecto en proyectos nuevos? ¿Cuánto se avisa en `local`? Cambia la garantía «el código generado nunca se ejecuta en tu equipo» |
| `2026-11-11-sitio-generado-desde-docs` | Aprobar ADR-25; idioma solo español; aceptar o no los 5 MB de Mermaid; dirección pública definitiva |
| `2026-11-09-ci-verde-y-cuarentena` | Aprobar la spec; qué jobs son requeridos al proteger `main` |

## Orden sugerido

1. `gh auth login` y leer los logs de CI (decisión 8): desbloquea todo lo demás.
2. Rotar la clave (11) y probar a mano (12): son independientes del resto.
3. Ratificar y aprobar specs y ADR (1 a 3), con el `verificacion.md` de cada una delante.
4. Con la CI verde: proteger `main`, decidir nombres, licencia y publicación (4 a 7, 9).
5. Las decisiones de equipos (sección 2) esperan al MVP cerrado.
