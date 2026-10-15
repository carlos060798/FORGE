# Estándares de ingeniería para una fábrica de software con agentes (Fragua)

Fecha: 2026-10-14. Alcance: qué estándares debe reflejar una capa de verificación y gobierno de código escrito con IA.

## 0. Honestidad sobre las fuentes

Verificado en esta sesión (fuente primaria leída): NIST SP 800-218A, SLSA v1.1 niveles de build, página OWASP del Top 10 Agentic 2026 (solo la fecha). Todo lo demás es **no verificado en esta sesión**: viene de conocimiento previo y debe confirmarse antes de citarlo. No se citan números de controles que no se hayan confirmado.

| Fuente | URL | Fecha | Estado |
|---|---|---|---|
| NIST SP 800-218A, perfil SSDF para IA generativa | https://csrc.nist.gov/pubs/sp/800/218/a/final | final 2024-07-26 (consultado 2026-10-14) | Verificado: extiende SSDF 1.1 con prácticas, tareas y recomendaciones específicas de IA; se usa junto a SP 800-218 |
| NIST SP 800-218 (SSDF 1.1) | https://csrc.nist.gov/pubs/sp/800/218/final | 2022 | No verificado en sesión |
| OWASP Top 10 for Agentic Applications 2026 | https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/ | publicado 2025-12-09 | Fecha verificada; la lista de 10 riesgos no se pudo leer (tras descarga): no verificado |
| OWASP Top 10 for LLM Applications | https://genai.owasp.org/llm-top-10/ | edición 2025 | No verificado en sesión |
| SLSA v1.1, niveles Build | https://slsa.dev/spec/v1.1/levels | consultado 2026-10-14 | Verificado |
| DORA, informe 2025 sobre IA en el desarrollo | https://dora.dev/research/ | 2025 | No verificado en sesión |
| ISO/IEC 25010, NIST AI RMF, ISO/IEC 42001, OWASP ASVS/SAMM | sitios de ISO, NIST, OWASP | varias | No verificado en sesión |

Hecho verificado de SLSA: L1 la provenance existe (puede ser incompleta o sin firmar); L2 plataforma hospedada y provenance firmada, el consumidor valida autenticidad; L3 builds endurecidos, ejecuciones aisladas entre sí y secretos de firma inaccesibles a los pasos del usuario. La provenance identifica quién construyó, el proceso y las entradas.

## 1. Prácticas y controles, fuente y rol/puerta

| Práctica | Fuente | Rol o puerta en la fábrica |
|---|---|---|
| Especificación y requisitos de seguridad aprobados antes de codificar | SSDF 1.1 (diseño; no verificado el detalle) | Puerta 0: spec aprobada por humano |
| Revisión y pruebas del código por parte distinta del autor | SSDF 1.1 (no verificado el detalle) | Rol probador separado del implementador |
| Pruebas ejecutadas en entorno aislado y reproducible | SSDF 1.1; SLSA L3 (aislamiento entre ejecuciones) | Puerta de ejecución aislada |
| Veredicto basado en reglas y no en un modelo | Buena práctica; sin cita normativa confirmada | Puerta de veredicto determinista |
| Procedencia firmada del resultado (qué, quién, con qué entradas) | SLSA L2/L3 | Emisor de evidencia / firmante |
| Gestión del riesgo del modelo y de los datos, prácticas específicas de IA | SP 800-218A | Rol gobernador / política de modelos |
| Límites de autonomía, mínimo privilegio, contención de herramientas | OWASP Agentic 2026 (temas; no verificado el detalle) | Puerta de contención del agente |
| Inyección de prompt, salida insegura, consumo desmedido | OWASP LLM Top 10 (no verificado el detalle) | Puerta de entradas no confiables y tope de gasto |
| Supervisión humana en decisiones de alto impacto | NIST AI RMF (Govern, Map, Measure, Manage; no verificado el detalle) | Puerta de aprobación humana |
| Requisitos verificables de seguridad de aplicación | OWASP ASVS (no verificado) | Rol revisor de seguridad (checklist por nivel) |
| Madurez de proceso | OWASP SAMM (no verificado) | Solo autoevaluación de la fábrica; baja prioridad |
| Atributos de calidad (fiabilidad, seguridad, mantenibilidad) | ISO/IEC 25010 (no verificado) | Vocabulario para criterios de aceptación de la spec |
| Sistema de gestión de IA | ISO/IEC 42001 (no verificado) | Solo si hay certificación organizativa; no es requisito del producto |
| Métricas de entrega y capacidades de equipo | DORA (no verificado el detalle 2025) | Panel de métricas |

## 2. Evidencia por tarea verificada (campos propuestos)

| Campo | Para qué |
|---|---|
| id de tarea, id de spec, hash de la spec aprobada, aprobador y fecha | Trazabilidad requisito a resultado |
| hash del commit/árbol de entrada y hash de las pruebas | Qué se verificó exactamente |
| rol y agente autor del código; rol y agente autor de las pruebas; modelo y versión de cada uno | Demostrar separación de roles |
| imagen de contenedor (digest), red desactivada, límites de tiempo y memoria | Prueba de aislamiento |
| comando, código de salida, pruebas escritas/ejecutadas/pasadas, duración | Veredicto reproducible |
| veredicto y regla que lo causó; señales de éxito sospechoso | Determinismo explicable |
| resultado de mutación (probadas, detectadas, mínimo) | Calidad de las pruebas |
| coste (tokens, USD), tope vigente, degradación de modelo | Gobierno de gasto |
| decisión humana (continuar, aceptar, abortar), quién, cuándo, motivo | Aprobación auditable |
| herramientas y rutas que el agente tocó o intentó tocar | Contención |
| hash del propio registro, firma o cadena de hashes, versión de formato | Integridad (SLSA L2) |
| avisos y redacciones aplicadas | Fuga de secretos |

## 3. Qué cubre ya Fragua

Limitación: `PLAN-MAESTRO.md` no se analizó a fondo; esta tabla se basa en `docs/FORGE-5.0-GUIA.md` y `core/verificar/resultado.js`.

| Tema | Estado |
|---|---|
| Spec aprobada por persona | Cubierto (según guía) |
| Pruebas por otro rol | Cubierto (según guía) |
| Ejecución aislada sin red | Cubierto; verificado solo en Windows con Docker; Linux no verificado |
| Veredicto determinista (`pasa`, `falla`, `sin_pruebas`, `infraestructura`); sin_pruebas no es éxito | Cubierto en `resultado.js` |
| Éxito sospechoso | Cubierto (según guía) |
| Mutación | Cubierto, opcional (`no/informar/exigir`) |
| Tope de gasto y degradación | Cubierto |
| Aprobación humana | Cubierto |
| Redacción de secretos y salida acotada a 8192 bytes | Cubierto |
| `formato` versionado, `duracionMs`, cortes, `imagen` (nombre) | Evidencia parcial |
| Registro con `--registrar` | Existe; contenido e integridad no revisados |
| Procedencia firmada (SLSA) | **No cubierto**: sin firma ni hash de entradas |
| Hash de spec, commit, pruebas, digest de imagen | **No presente** en el resultado |
| Identidad de modelo/agente autor y probador | **No presente** en el resultado |
| Coste y decisión humana en el mismo registro | No presente en el resultado |
| Revisión de seguridad (ASVS, riesgos agénticos, inyección) | No cubierto; sin rol ni puerta |
| Contención de herramientas del agente | No verificado; la guía describe aislamiento de pruebas, no del agente |
| Métricas DORA | No cubierto |
| OpenAI/Ollama, integraciones, Linux | Sin prueba real (según la guía) |

## 4. Recomendaciones ordenadas

1. Ampliar el resultado con identidades y hashes: spec, commit, pruebas, digest de imagen, roles y modelos. Es barato y es la base de la auditoría.
2. Emitir una atestación firmada o encadenada por hashes (SLSA L2 como objetivo realista; L3 exige secretos de firma fuera del alcance del agente).
3. Unificar en un solo registro veredicto, mutación, coste y decisión humana.
4. Rol revisor de seguridad con checklist derivado de ASVS y de los riesgos agénticos de OWASP, tras confirmar la lista oficial.
5. Puerta de contención: política declarativa de herramientas, rutas y red por rol, con registro de intentos denegados.
6. Skill de entradas no confiables (inyección de prompt) para specs, issues y salidas de herramientas.
7. Verificar Linux/CI y los proveedores no probados antes de afirmar cobertura.
8. Métricas: veredicto `pasa` a la primera, iteraciones por tarea, tasa de éxito sospechoso, puntuación de mutación, coste por tarea aprobada, tiempo hasta decisión humana, tasa de rechazo humano, defectos escapados tras aceptar; de DORA, plazo de cambio, frecuencia de despliegue, tasa de fallo y tiempo de recuperación (confirmar formulación 2025).
9. ISO 25010 solo como vocabulario de criterios; SAMM e ISO 42001 fuera hasta que haya necesidad organizativa.
