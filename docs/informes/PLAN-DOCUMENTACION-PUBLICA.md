# Plan de documentación pública de Fragua

Fecha: 2026-11-10. Alcance: el sitio publicado en https://carlos060798.github.io/FORGE/ (código en `docs-site/`) y los documentos de `docs/`. Objetivo: llegar al nivel de documentación de las librerías de referencia (el modelo es react.dev y proyectos similares), con los recursos de un solo mantenedor.

Método: leí el sitio publicado (como lo ve un visitante) y el código de `docs-site/`, y comparé su contenido con el repositorio. Las cifras salen de esos archivos; lo que no pude comprobar va marcado.

## 1. Diagnóstico

### El sitio publicado

| Hallazgo | Evidencia | Por qué importa |
|---|---|---|
| **Sin JavaScript no hay contenido.** Todo se pinta desde un archivo de datos con JavaScript | El sitio, leído como lo ve un buscador, solo muestra cabecera y etiquetas; `index.html` no tiene `noscript` | Buscadores, lectores de pantalla y vistas previas no ven la documentación |
| **El contenido es de antes de la 5.0.** La cabecera dice 5.0.0-beta.1, pero el texto se escribió el 2026-06-27 («refleja Etapas 0-5») y solo se cambió el número de versión | `docs-site/assets/data.js`, cabecera; `app.js` sin cambios desde 2026-06-21 | La documentación pública describe un producto que ya no existe |
| **No menciona la característica central.** Ninguna de las 16 páginas dice «Docker» ni «ciclo verificado», ni el perfil esencial | Búsqueda de términos en las 16 páginas | Lo que distingue a Fragua es invisible para quien llega por el sitio |
| **Nombre antiguo.** 251 menciones de «forge» frente a 3 de «fragua» | Mismo análisis | El producto se llama Fragua desde el 2026-10-13 |
| **Dos fuentes de verdad.** 112 KB de contenido escrito a mano en `data.js` duplican los 46 documentos de `docs/` | Tamaño de `data.js`; recuento de `docs/*.md` | Cada cambio hay que hacerlo dos veces y se desincronizan, como ya pasó |
| **Inglés a medias.** El inglés ocupa un 38 % del texto español (28 KB frente a 74 KB) | Suma de las 16 páginas en cada idioma | El interruptor de idioma promete una traducción que no existe |
| **Una página huérfana de 31 KB** (`DESARROLLADORES-ARQUITECTURA.html`) que nada enlaza | `grep` sin resultados | Contenido que nadie puede alcanzar |
| **Sin lo básico de un sitio público.** No hay 404, mapa del sitio, `robots.txt`, icono, metadatos sociales, enlace «editar en GitHub», registro de cambios ni selector de versión | Listado de `docs-site/`; `<head>` de `index.html` | Se ve y se comparte peor, y los lectores no pueden corregir errores |
| **Script externo sin versión ni integridad.** Carga `mermaid` desde un CDN sin fijar versión | `index.html:81` | Contradice la regla del resto del repositorio de fijar todo por SHA |
| **Sin control de calidad.** El despliegue sube la carpeta tal cual: ni construye, ni revisa enlaces, ni prueba nada | `.github/workflows/docs.yml` | Los errores llegan a producción sin que nadie los vea |

### Los documentos del repositorio

- 51 documentos de entrada en `docs/`; 39 sin cambios desde antes de noviembre.
- Seis de los técnicos son de junio: conceptos, agentes, flujos, referencia de API, ejemplos y extensión. Tres agentes los están auditando contra el código mientras se escribe este plan.
- Faltaban código de conducta, soporte, gobierno y plantilla de solicitudes de cambio. Están en curso.
- Lo que ya funciona y no hay que rehacer: 250 enlaces internos sin ninguno roto, cifras de agentes, comandos y skills comprobadas por prueba, y garantías enlazadas a pruebas.

## 2. El estándar que se busca

Lo que tienen en común las documentaciones de referencia como react.dev, y dónde está Fragua hoy:

| Capacidad | Referentes | Fragua hoy | Meta |
|---|---|---|---|
| Camino de aprendizaje guiado (inicio rápido, tutorial, «pensar en X») | Sí | Una guía de 15 minutos, solo en el repositorio | Home, tutorial y conceptos en el sitio |
| Referencia completa y exacta de cada API | Sí, una página por elemento | Parcial, a mano, desfasada | Generada desde el código y comprobada por pruebas |
| Documentos de un solo tipo (aprender, hacer, consultar, entender) | Sí | Mezclados; ahora el índice sigue Diátaxis | Cada página declara su tipo |
| HTML real sin JavaScript, buscable, indexable | Sí | No | Sitio estático generado |
| Búsqueda | Sí | Búsqueda en cliente sobre `data.js` | Búsqueda local sobre el contenido real |
| Varias lenguas con proceso de traducción | Sí | Español completo, inglés al 38 % | Decidir (ver sección 4) |
| Versiones y guías de actualización | Sí | `MIGRACION-5.0.md` en el repositorio | Registro de cambios y guías en el sitio; selector de versión cuando haya dos mayores |
| «Editar esta página» | Sí | No | Enlace en cada página |
| Ejemplos que se ejecutan | Sí | Texto | Ejemplos comprobados en CI |
| Calidad automatizada | Sí | Cifras y enlaces comprobados en el repositorio, nada en el sitio | Enlaces, accesibilidad, ejemplos y frescura en CI |

## 3. Plan por fases

Las estimaciones son días de trabajo de una persona y son una aproximación, no un compromiso.

### Fase 0: dejar de desinformar (1 a 2 días)

Se hace sin cambiar de tecnología, porque el sitio ya está público.
1. Reescribir en `data.js` las páginas que describen la 5.0: ciclo verificado, Docker, perfil esencial, nombre Fragua, límites reales, estado pre-beta.
2. Aviso visible de «pre-beta» y enlace al estado actual.
3. Contenido de reserva para quien no tenga JavaScript: un `noscript` con el resumen y los enlaces a los documentos del repositorio.
4. Fijar `mermaid` a una versión con hash de integridad, o quitarlo.
5. Corregir la descripción de `index.html` y decidir qué hacer con la página huérfana.
6. Extender la prueba de cifras para que revise también los términos obligatorios del sitio («ciclo verificado», «Docker») y la ausencia del nombre antiguo en títulos.

Salida: ninguna página del sitio contradice el código, y una prueba lo vigila.

### Fase 1: una sola fuente de verdad (3 a 5 días)

1. **ADR** que fije la herramienta. Mi recomendación a verificar en un spike de un día es **Starlight** (sobre Astro), por generar HTML estático, tener búsqueda local, soporte de varios idiomas y estar pensado para documentación. La alternativa es **VitePress**. **Docusaurus** es la más completa para versiones, pero la más pesada. No he comprobado las versiones ni las características actuales de ninguna: eso es lo primero que hace el spike.
2. El sitio vive en `docs-site/` con su propio `package.json` y no entra en el paquete de npm (la lista `files` ya lo excluye), pero igual exige un ADR por la regla de dependencias.
3. Los `docs/*.md` pasan a ser la fuente. Cada uno recibe cabecera con título, tipo Diátaxis y fecha de revisión.
4. `docs.yml` construye el sitio, falla si hay un enlace roto y publica. Se conservan las rutas antiguas con redirecciones.
5. Se borran `data.js` y los 112 KB duplicados.

Salida: ningún contenido escrito dos veces; el sitio se genera desde `docs/` y el despliegue falla si algo está roto.

### Fase 2: camino de aprendizaje (3 a 5 días)

1. Portada con la propuesta de valor y los cinco comandos.
2. Tutoriales: los 15 minutos, la API REST de punta a punta, y uno sobre qué hacer cuando el ciclo se pausa.
3. «Pensar en Fragua»: por qué decide el código de salida y no un modelo, qué es la aprobación y por qué no prueba que se revisó.
4. Recetario de guías: añadir un agente, añadir un proveedor, usarlo con otro editor, publicar en CI.

Salida: una persona sin contexto llega a su primera tarea verificada solo con el sitio.

### Fase 3: referencia de verdad (5 a 8 días)

Todo lo que se pueda se genera desde el código, con una prueba que falla si se desincroniza, igual que ya hace `generar-skills --verificar`.
1. CLI: subcomandos, opciones, códigos de salida y variables de entorno (en curso por un agente, con prueba).
2. Configuración: todas las claves y quién manda sobre quién.
3. Catálogo de agentes, comandos y skills, a partir de sus cabeceras.
4. Servidor MCP y API HTTP, a partir de los esquemas de `docs/contrato/`.
5. Catálogo de errores: mensaje, causa, qué hacer.
6. Mapa de módulos y decisiones de arquitectura renderizadas desde `.sdd/arquitectura/`.

Salida: cada dato exacto del producto tiene una página, y ninguna se puede desfasar sin que falle una prueba.

### Fase 4: versiones y cambios (3 a 5 días)

1. Registro de cambios y guías de actualización dentro del sitio.
2. «Editar esta página» en cada documento.
3. Selector de versión, solo cuando exista una segunda versión mayor: hoy sería ruido.

### Fase 5: inglés (5 a 10 días, depende de la decisión)

Si la meta es una comunidad internacional, el inglés no es opcional. Estrategia propuesta: traducir primero portada, inicio rápido y conceptos; cada página traducida guarda el commit del original, y la CI marca como desactualizada la que quede atrás. Hasta que haya paridad, quitar el interruptor de idioma o marcar lo que falta, en vez de prometer una traducción incompleta.

### Fase 6: calidad como código (continuo)

Pruebas que se ejecutan en cada cambio:
- Enlaces internos, y externos una vez por semana.
- Todo comando `/sdd.*` y todo subcomando citado existe (hoy lo hace una comprobación manual).
- Los ejemplos de la CLI se ejecutan contra un proyecto temporal.
- Accesibilidad y rendimiento con un umbral mínimo.
- Avisos de documentos sin revisar en más de 90 días.
- Plantilla de incidencia para errores de documentación.

### Fase 7: opcional

Ejemplos ejecutables en un repositorio aparte con CI propia, y una grabación del flujo de cinco comandos.

## 4. Decisiones que necesito de ti

1. **Idioma:** ¿solo español por ahora, o inglés desde el principio? Cambia el tamaño de la Fase 5 y la urgencia del resto.
2. **Herramienta:** ¿Starlight, como propongo, o prefieres otra? Se confirma con un spike de un día.
3. **Cuándo se anuncia la beta:** mi recomendación es no anunciarla públicamente antes de cerrar las fases 0, 1 y 2. Hoy el sitio no menciona lo único que la distingue.
4. **Quién mantiene esto:** con una sola persona, todo lo que no sea generado y comprobado se desfasa. Por eso el plan prioriza la generación sobre la escritura a mano.

## 5. Esfuerzo y orden

| Fases | Días estimados | Cuándo |
|---|---|---|
| 0 | 1 a 2 | Ya, antes de dar publicidad al sitio |
| 1 a 3 | 11 a 18 | Antes de anunciar la beta |
| 4 | 3 a 5 | Con la beta publicada |
| 5 | 5 a 10 | Si se decide inglés |
| 6 | continuo | Se va añadiendo desde la fase 1 |

Total entre 20 y 35 días de trabajo, más el mantenimiento continuo.

## 6. Riesgos

- **Una herramienta nueva para documentación** añade una cadena de construcción que mantener. Se mitiga con el spike y con fijar versiones por SHA como en el resto del repositorio.
- **Generar referencia desde el código** obliga a que el código tenga cabeceras y esquemas consistentes; donde no los tenga, habrá que ordenarlo primero.
- **La traducción** envejece más rápido que el original. Sin el marcado de frescura, el inglés volverá a quedar a medias.

## 7. Qué ya está hecho

En esta sesión, sin esperar a este plan: README público con estado honesto, índice por tipo de documento, guía de 15 minutos, citas a comandos inexistentes corregidas, y tres agentes auditando los documentos técnicos y los archivos comunitarios.

## 8. Avance

| Fase | Estado | Detalle |
|---|---|---|
| 0 | **Hecha el 2026-11-10** (pendiente de publicar con un `git push` a `main`) | Cinco páginas del sitio reescritas en español e inglés (visión general, ciclo verificado nueva, instalación, limitaciones, madurez); aviso con enlace al documento al día en las otras doce; nombre Fragua en la interfaz; `mermaid` eliminado (no se usaba en ninguna página y cargaba 3,3 MB de un CDN sin versión); `noscript`, metadatos sociales y canónico; página huérfana movida a `docs/archivo/`; `tests/sitio-docs.test.js` vigila términos, versión, anclas, enlaces a GitHub y scripts externos. No se ha abierto el sitio en un navegador; el HTML de las 34 páginas está balanceado |
| 1 | Pendiente | Necesita el ADR de la herramienta y un spike de un día |
| 2 | Pendiente | |
| 3 | **Casi hecha, a mano** (2026-11-10) | Auditados contra el código 36 documentos técnicos: referencia de la CLI con su prueba, interfaces, configuración, agentes, flujos, arquitectura, extensión, ejemplos, solución de problemas, seguridad, compatibilidad, MCP, API HTTP, evidencia, puertas, proveedores, integraciones, herramientas, glosario e inventario. Cada uno lleva tipo y fecha de revisión, y lo no comprobado va marcado. Falta lo que el plan pedía **generado**: catálogo de errores como referencia propia, esquemas renderizados y las tablas de agentes y comandos desde sus cabeceras. Hoy se vigilan con pruebas, no se generan |
| 4 a 7 | Pendiente | |

El inglés del sitio pasó del 38 % al 50 % del español, por las páginas nuevas. Sigue incompleto: las doce páginas con aviso conservan su traducción parcial anterior.

## 9. Defectos de código que salieron al documentar

Dejaron de afirmarse en la documentación, pero **siguen en el código**. Cada uno pide su especificación si se decide corregirlo.

| # | Qué pasa | Dónde |
|---|---|---|
| 1 | `calidad.cobertura_tests_minima` se lee pero ningún código la aplica; los presets la fijan en 60, 75 y 85 sin efecto | `claude-hooks/post-write-conventions.js` |
| 2 | Los hooks de `.sdd/hooks/` los ejecuta el modelo al seguir el comando, no el motor; no cancelan por código de salida y no reciben variables | `commands/*.md` |
| 3 | ~~`fragua export` estampa «FORGE v4.0.0» fijo en los artefactos~~ **Corregido el 2026-11-11** (spec `2026-11-11-correcciones-de-precision`) | `cli/export.js` |
| 4 | `consumo.jsonl` lo escriben dos hooks con campos distintos: uno estima tokens como bytes entre 3,5 y el otro registra tokens y coste solo si el evento trae `usage` (no verificado que Claude Code lo envíe). `fragua logs` lo presenta como «consumo de tokens»; el gasto real del ciclo está en `gasto.jsonl` | `claude-hooks/agent-memory.js`, `claude-hooks/context-manager.js` |
| 5 | `ProjectMemory.update()` y `setPipelineStep()` no comprueban aprobaciones | `core/project-memory.js` |
| 6 | ~~El tipo `ForgeEstado` no declara `spec_aprobado` ni otros campos del archivo real~~ **Corregido el 2026-11-11** | `core/project-memory.js` |
| 7 | `fragua doctor` termina con código 0 aunque detecte problemas, así que no sirve como puerta en una integración continua | `cli/comandos/doctor.js`, según `docs/referencia-cli.md`; **no ejecutado en esta revisión** |
| 8 | Hay un runner de Rust pero ninguna imagen base para Rust | `core/runners/rust-runner.js`, `core/sandbox/preparar-imagen.js` |
