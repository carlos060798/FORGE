# Público objetivo de FORGE 5.0 (beta)

> Fecha: 2026-10-13. Base: `FORGE-5.0-GUIA.md`, `EVALUACION-PUBLICACION.md`, `PLAN-GO-TO-MARKET.md`, `ANALISIS-COMPETITIVO-FINAL.md`. Datos de mercado: búsqueda web (URL citada); lo no confirmado va como «no verificado».
> Nota: `PLAN-GO-TO-MARKET.md` y el análisis competitivo describen SDD-ES/FORGE 4.2 y citan cifras («0 bugs», «40h a 15h») sin respaldo en el repositorio. No se reutilizan aquí.

## Contexto de mercado (fuentes)

| Dato | Valor | Fuente |
|---|---|---|
| Desarrolladores que usan o planean usar IA (2025) | 84 % (76 % en 2024) | [InfoWorld sobre Stack Overflow Survey](https://infoworld.com/article/4031673/ai-use-among-software-developers-grows-but-trust-remains-an-issue-stack-overflow-survey.html) |
| Confían en la precisión de la IA | 33 % (43 % en 2024; otra fuente da 40 %) | [Tech.co](https://tech.co/news/survey-developers-using-ai-more-trust-less) |
| Quejas: «casi correcto, pero no del todo» / depurar cuesta más | 66 % / 45,2 % | [ADT Magazine](https://adtmag.com/blogs/watersworks/2026/01/stack-overflow-survey.aspx) |
| Obligaciones de alto riesgo del AI Act (Anexo III) | aplazadas a 2-dic-2027 | [Cooley](https://cdp.cooley.com/digital-ai-omnibus-delays-key-deadlines-introduces-new-rules/), [Gibson Dunn](https://www.gibsondunn.com/eu-ai-act-omnibus-agreement) (las fuentes difieren en fechas del acuerdo) |
| Tamaño de la base de usuarios de Claude Code | no verificado | — |

Lectura: la desconfianza en código generado es real y creciente, pero no hay cifra fiable de cuántos usuarios de Claude Code querrían un ciclo con verificación en Docker. El mercado direccionable es **no verificado**.

## 1. Segmentos candidatos

Ajuste 0-5 con lo que FORGE ofrece HOY (JS/TS, Python, Go; Docker; Windows probado; Anthropic probado).

| Segmento | Ajuste | Justificación | Evidencia que falta |
|---|---|---|---|
| Desarrollador individual con Claude Code, proyectos pequeños | 4 | Es donde están las 24 ejecuciones y 3/3 instalaciones externas; tope de gasto y reanudación le sirven | Uso por terceros, Linux/macOS, coste real vs factura (G-1) |
| Equipos pequeños (2-5) | 2 | Aprobación humana y auditoría ayudan, pero sin proyectos grandes ni monorepo probados | Un equipo real, proyecto >1 000 archivos, CI |
| Consultoras/agencias | 2 | Auditoría de consumo y spec aprobada atraen; múltiples stacks (Java, C#) no entran en modo ciclo | Pruebas en varios clientes, más lenguajes |
| Equipos con requisitos de cumplimiento/auditoría | 2 | Registro y aprobación humana son la base; no hay certificación ni evidencia de que satisfaga un auditor | Revisión por un auditor real; trazabilidad firmada |
| Educadores/aprendices | 3 | Spec, pruebas y veredicto por código de salida enseñan SDD; proyectos pequeños encajan. Docker y claves son fricción | Piloto en un aula; coste por alumno |
| Mantenedores open source | 1 | Integración GitHub nunca probada con cuenta real; proyectos grandes y CI Linux sin evidencia | Linux, GitHub real, repos medianos |
| Empresas reguladas | 1 | Faltan SSO, políticas, soporte, Linux/CI probado; integraciones sin validar | Casi todo; fuera de alcance de una beta |

## 2. Perfil del usuario ideal

| Aspecto | Descripción |
|---|---|
| Quién | Desarrollador con Claude Code diario, en Windows con Docker Desktop, proyecto JS/TS, Python o Go pequeño, con pruebas automáticas |
| Trabajo a resolver | «Que el código que genera el modelo lo juzgue algo que no sea el mismo modelo, y poder dejar la tarea sin que gaste de más» |
| Dolor | Código «casi correcto» (66 % según Stack Overflow 2025), pruebas que el propio modelo escribe a su medida, gasto sin control |
| Alternativa actual | Claude Code solo + revisión manual + `npm test` propio; Spec Kit u otros SDD sin ejecución aislada (comparación detallada: no verificada en esta ronda) |
| Por qué cambiaría | Pruebas escritas por otro rol, veredicto por código de salida, tope de 2 USD, reanudación, `forge logs` |
| Qué le frenaría | Docker obligatorio (sale 4 sin él); coste de API y su cifra sin contrastar; curva (spec, YAML con 2 espacios, `tareas.json`); solo probado en Windows; solo etapa `code`; JS/Py/Go |

## 3. Público a evitar por ahora

| Público | Motivo (lo no probado) |
|---|---|
| Empresas reguladas y cumplimiento formal | Ninguna evidencia de aceptación por auditor; «pruebas pasan» no es corrección (P-1, P-2) |
| Equipos en Linux/macOS o con CI propio | CI Linux nunca corrió; Docker en Linux sin comprobar |
| Usuarios de OpenAI/Ollama | Sin prueba extremo a extremo; sin herramientas |
| Quien dependa de GitHub/GitLab/Jira | Solo servidores falsos |
| Monorepos, proyectos grandes, Java/Rust/C# | No soportado o no probado |
| Compradores que exijan cifras de ahorro | No existen mediciones propias de bugs ni horas |

## 4. Mensaje y posicionamiento

**Frase de valor:** «FORGE hace que otro rol escriba las pruebas y que un contenedor sin red, no un modelo, decida si el código del modelo funciona, con tope de gasto y tu aprobación.»

| Prueba | Evidencia en el repositorio |
|---|---|
| 1. El ciclo completa tareas con modelo real | 24 ejecuciones (JS, Python, Go), ~2,4 USD; `evidencia-2026-10-09.md`; ej. 8: 27/27 pruebas en 3 iteraciones |
| 2. Funciona instalado fuera del repo | 3/3 éxitos con paquete instalado, 0,13 USD (`PLAN-EJECUCION-FINAL.md` §6; `PRUEBAS-INDEPENDIENTES.md`) |
| 3. Controles de gasto y pausa operan | Pausa por presupuesto y reanudación probadas; detección de «éxito sospechoso»; salidas 0/1/3/4 documentadas |

**Qué NO prometer:** corrección garantizada; ahorro de horas o «0 bugs»; soporte Linux/macOS; integraciones funcionando; factura igual al gasto calculado; compatibilidad con cumplimiento normativo o AI Act; proyectos grandes; OpenAI/Ollama.

## 5. Plan de beta en 3 fases (`5.0.0-beta.1`, etiqueta `next`)

| Fase | Quién | Canal | Métrica de éxito | Criterio para ampliar |
|---|---|---|---|---|
| 1. Cerrada (4 semanas, 5-10) | Usuarios Windows+Docker+Claude Code, proyectos pequeños, conocidos del autor | Invitación directa, repo, issues | ≥70 % completa instalación y 1ª ejecución; ≥1 tarea verificada por usuario | CI Linux en verde; gasto contrastado con factura (≤5 %); 0 incidencias críticas |
| 2. Abierta acotada (6 semanas, 20-50) | Individuales y educadores, incl. Linux/macOS | Comunidad de Claude Code, dev.to, Reddit r/ClaudeAI (canales a validar) | ≥50 % repite en 7 días; mediana de coste por tarea estable; retroalimentación en issues | Linux/macOS con evidencia; ≥3 usuarios con proyecto no trivial |
| 3. Pública `next` (continuo) | Equipos pequeños, 1-2 consultoras piloto | npm `next`, documentación, casos publicados con datos medidos | Retención a 30 días ≥30 %; casos con medición real | Una integración probada con cuenta real; decisión del dueño sobre `latest` |

No publicar en `latest` hasta cumplir los bloqueantes de `EVALUACION-PUBLICACION.md` §6. Los umbrales son propuestas, no datos.

## 6. Riesgos de adopción y medición

| Riesgo | Señal | Cómo medirlo |
|---|---|---|
| Fallo de instalación (Node <20, `npx forge` instala otro paquete, Docker apagado) | Abandono antes de `forge doctor`; salida 4 | Encuesta de inicio + issues etiquetados; tasa de salida 4 en reportes voluntarios |
| Primera ejecución sin éxito (YAML mal sangrado, `requirements.txt` ausente) | Primer `forge run` termina en 1 o 3 | % de primeras ejecuciones con salida 0; tiempo hasta primera tarea verificada |
| Coste inesperado | Gasto > tope, llamadas colgadas (H13), diferencia con factura | Comparar `forge logs` con la factura de cada beta; gasto mediano por tarea |
| Abandono tras la novedad | Sin ejecuciones en 7/30 días | Retención por cohorte (telemetría solo opt-in, o encuesta) |
| Falsa confianza | Éxito con pruebas triviales | Tasa de «éxito sospechoso»; revisión manual de una muestra con `mutacion: informar` |
| Mensaje exagerado | Reclamos de ahorro sin datos | Revisión de textos públicos contra la sección 4 |
