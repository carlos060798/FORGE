# ADR-25: El sitio de documentación se genera desde `docs/` con Starlight

> Estado: propuesta (pendiente de aceptación formal del dueño)  # propuesta | aceptada | obsoleta | reemplazada-por-ADR-XX
> Fecha: 2026-11-11
> Spec relacionada: 2026-11-11-sitio-generado-desde-docs
> Autor: Claude (pendiente de aceptación por el dueño)
> Evidencia: docs/informes/SPIKE-SITIO-STARLIGHT.md
> No cambia ADR-03 (dependencias sin red en el ciclo): el sitio no forma parte del paquete ni del ciclo.

## Contexto

El sitio publicado en `carlos060798.github.io/FORGE/` es una aplicación escrita a mano que pinta todo con JavaScript desde un archivo de datos de 112 KB (`docs-site/assets/data.js`). Ese archivo duplica el contenido de los 50 documentos de `docs/` y se desincroniza: tras la 5.0 describía un producto anterior y no mencionaba Docker ni el ciclo verificado. Sin JavaScript no muestra nada, no tiene página de error, ni mapa del sitio, ni enlace para editar, y el despliegue sube la carpeta sin construir ni comprobar nada ([plan de documentación pública](../../docs/informes/PLAN-DOCUMENTACION-PUBLICA.md)).

La regla del repositorio prohíbe añadir dependencias sin un ADR. Las de construcción del sitio no viajan en el paquete de npm (la lista `files` de `package.json` excluye `docs-site/`), pero igualmente se decide aquí.

## Decisión

El sitio se construye en cada despliegue a partir de los Markdown de `docs/`, **que siguen siendo la única fuente y siguen funcionando en GitHub sin cambios**. La herramienta es **Starlight** (sobre Astro), en su propio directorio con su propio `package.json`, con **versiones exactas fijadas** y `npm audit` en cero como condición. Un conversor de unas 40 líneas, que vive en el repositorio y tiene su prueba, añade el título, reescribe los enlaces entre documentos y los que salen de `docs/`, y crea la portada. El despliegue falla si queda un enlace interno roto. Se elimina `docs-site/assets/data.js`.

## Alternativas consideradas

- **A. Mantener el sitio a mano (`data.js`), solo corregido**: rechazada. Es lo que produjo el desfase; arreglarlo una vez no evita el siguiente. Es la fase 0 del plan y se hizo como medida provisional.
- **B. VitePress**: no descartada ni medida. Es la alternativa razonable si Starlight da problemas; no se probó.
- **C. Docusaurus**: no medida. Más completa para versiones y traducciones y más pesada; sería la opción si el proyecto necesitara varias versiones mayores a la vez, lo que hoy no ocurre.
- **D. Starlight con un conversor sobre `docs/` intacto (elegida)**: la prueba de viabilidad construyó los 50 documentos en 13 a 21 segundos, con búsqueda local, HTML que se lee sin JavaScript, enlace de edición y mapa del sitio, y con el conversor quedaron **0 enlaces rotos de 395** (sin él, 532 de 533).
- **E. Reescribir los enlaces de `docs/` para que apunten al sitio**: rechazada. Los dejaría rotos en GitHub, que es donde se lee la documentación cuando se explora el repositorio.

## Consecuencias

### Positivas
- Una sola fuente: lo que se corrige en `docs/` se corrige en el sitio y en GitHub.
- El HTML trae el texto, así que lo ven buscadores, lectores de pantalla y vistas previas.
- La construcción es un punto donde hacer cumplir calidad: enlaces rotos, ejemplos, frescura.

### Negativas
- Una dependencia de construcción nueva que mantener, y es joven: Starlight retiró una forma de configurar la barra lateral entre versiones menores. Hay que fijar versiones y revisar al actualizar.
- Mermaid añade unos 5 MB y los diagramas necesitan JavaScript: sin él solo se ve el código. La versión 11.12.0 trajo 9 vulnerabilidades en la prueba; la 12.3.0, ninguna.
- El conversor es código nuevo que depende de convenciones de nombres (identificadores de página sin puntos, rutas fuera de `docs/`): su prueba debe vigilar los enlaces del sitio construido.

### Neutrales
- El inglés, las versiones y el selector de idioma no se resuelven aquí: son las fases 4 y 5 del plan.
- No se midió el aspecto real en un navegador, la accesibilidad ni el rendimiento; se mide al implementar.

## Cuándo revisitar

Si una actualización menor de Starlight rompe la construcción más de una vez, o si `npm audit` del árbol del sitio no se puede mantener en cero, o si hace falta publicar dos versiones mayores a la vez (entonces mirar Docusaurus), o si el tamaño de Mermaid pesa más que el valor de los diagramas.

## Referencias

- `docs/informes/SPIKE-SITIO-STARLIGHT.md`, con el conversor y los números
- `.sdd/especificaciones/2026-11-11-sitio-generado-desde-docs/spec.md`
- `docs/informes/PLAN-DOCUMENTACION-PUBLICA.md`
