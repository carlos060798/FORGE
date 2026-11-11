# Prueba de viabilidad: sitio de documentación generado con Starlight

Fecha: 2026-11-11. Fase 1 del [plan de documentación pública](PLAN-DOCUMENTACION-PUBLICA.md). Se hizo **fuera del repositorio**, en un proyecto desechable, para no añadir dependencias sin su ADR. Lo que sigue es lo medido; lo no medido está marcado.

## Qué se probó

Construir un sitio a partir de los 50 documentos reales de `docs/`, sin modificarlos, con Starlight (sobre Astro). **No se probaron VitePress ni Docusaurus:** la recomendación de Starlight se apoya en que este funciona y en las razones del plan, no en una comparación medida.

| Pieza | Versión fijada |
|---|---|
| Node | 24.20.0 |
| `astro` | 7.4.10 |
| `@astrojs/starlight` | 0.42.10 |
| `astro-mermaid` | 2.2.0 |
| `mermaid` | 12.3.0 |

`npm audit` sobre ese árbol: **0 vulnerabilidades** (con Starlight solo, y con Mermaid 12.3.0). Con `mermaid@11.12.0`, una versión anterior, salieron 9 (8 altas, una de inyección de código en `lodash`) y la construcción no terminó en 10 minutos: **hay que fijar la versión y volver a auditar al adoptar**.

## Resultados

| Medida | Resultado |
|---|---|
| Páginas construidas | 52 (50 documentos, una portada y la 404) |
| Tiempo de construcción | 13 a 21 segundos |
| Tamaño del sitio | 4,6 MB sin Mermaid, de ellos 1,4 MB de índice de búsqueda; 9,7 MB con Mermaid |
| Búsqueda | Pagefind, local, sin servicio externo: indexó 51 páginas en 2 segundos |
| Contenido sin JavaScript | Presente en el HTML (en `mapa-de-modulos`, unos 10 400 caracteres de texto visibles) |
| Idioma del documento | `es` |
| Enlace «Editar página» | Presente, apunta a `docs/` en GitHub |
| Mapa del sitio | Generado |
| **Enlaces internos sin preparar nada** | **532 de 533 rotos** |
| **Enlaces internos con el conversor de abajo** | **0 rotos de 395** |
| Diagramas Mermaid | Se emiten como bloque que dibuja el navegador: **sin JavaScript solo se ve el código** |

Por qué estaban rotos al principio: 339 enlaces apuntaban a otro `.md` (que el generador no reescribe), 144 apuntaban fuera de `docs/` (`../SECURITY.md`, `../.sdd/...`), y los 51 de la portada fallaban porque `docs/` no tiene una página de inicio.

## El conversor que lo arregla

Deja `docs/` intacto, de modo que los enlaces siguen funcionando en GitHub, y genera el contenido del sitio en cada construcción. Hace cuatro cosas: añade el título desde el primer `# `, reescribe los enlaces entre documentos a rutas del sitio, convierte los que salen de `docs/` en enlaces a GitHub, y crea la portada.

```js
// Convierte docs/*.md a contenido de Starlight sin modificar la fuente.
import { readdirSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join, posix } from 'node:path';
const origen = process.argv[2], destino = 'src/content/docs';
const BASE = '/FORGE', GH = 'https://github.com/carlos060798/FORGE';
rmSync(destino, { recursive: true, force: true }); mkdirSync(destino, { recursive: true });
const docs = new Set(readdirSync(origen).filter((x) => x.endsWith('.md')).map((x) => x.slice(0, -3)));
// Starlight quita los puntos del identificador: MIGRACION-5.0 -> migracion-50
const slug = (n) => n.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
function reescribir(t) {
  return t.replace(/\]\(([^)\s]+)\)/g, (todo, url) => {
    if (/^(https?:|mailto:|#)/.test(url)) return todo;
    const [ruta, ancla = ''] = url.split(/(?=#)/);
    const norm = posix.normalize(posix.join('docs', ruta));
    const sub = norm.startsWith('docs/') ? norm.slice(5) : null;
    if (sub && /^[A-Za-z0-9._-]+\.md$/.test(sub) && docs.has(sub.slice(0, -3))) return `](${BASE}/${slug(sub.slice(0, -3))}/${ancla})`;
    if (!sub || /^(archivo|informes|contrato|uso-real)(\/|$)/.test(sub)) {
      const esDir = ruta.endsWith('/') || !/\.[a-z0-9]+$/i.test(ruta);
      return `](${GH}/${esDir ? 'tree' : 'blob'}/main/${norm.replace(/\/$/, '')}${ancla})`;
    }
    return todo;
  });
}
for (const f of readdirSync(origen).filter((x) => x.endsWith('.md'))) {
  let t = readFileSync(join(origen, f), 'utf8').replace(/\r\n/g, '\n');
  const m = /^# (.+)$/m.exec(t);
  const titulo = (m ? m[1] : f.slice(0, -3)).replace(/"/g, '\\"');
  if (m) t = t.replace(m[0] + '\n', '');
  writeFileSync(join(destino, f), `---\ntitle: "${titulo}"\n---\n\n${reescribir(t)}`);
}
// Y una portada: sin ella, el logotipo y el enlace al inicio dan 404.
```

(El script de la prueba, con la portada completa, se comprobó contra el árbol del 2026-11-11. Esta copia resume su lógica; el código definitivo nace con su especificación y su prueba.)

## Lo que no se midió

- **El aspecto real en un navegador**, la accesibilidad y el rendimiento: solo se inspeccionó el HTML generado.
- **La calidad de la búsqueda en uso**: se comprobó que el índice se construye, no que encuentre lo que alguien buscaría.
- **El despliegue en GitHub Pages con la ruta base `/FORGE`**: la construcción usó esa ruta y los enlaces la respetan, pero no se desplegó.
- **El inglés, las versiones y la traducción** (fases 4 y 5).
- **VitePress y Docusaurus**, y por tanto si Starlight es de verdad la mejor opción.
- **La estabilidad a largo plazo de la herramienta.** La primera configuración que escribí de memoria usaba una forma de barra lateral que Starlight retiró en la 0.39, y el propio mensaje de error dio la forma nueva. Es una herramienta que cambia su configuración entre versiones menores: conviene fijar versiones y revisar al actualizar.

## Consecuencias para el plan

El conversor deja la fuente única que el plan pedía y mantiene `docs/` legible en GitHub, que era la restricción más importante. El coste real está en tres cosas: una dependencia de construcción que mantener, el tamaño que añade Mermaid, y que los diagramas necesitan JavaScript. Siguiente paso: el [ADR-25](../../.sdd/arquitectura/ADR-25-sitio-de-documentacion-generado-con-starlight.md) y la especificación `2026-11-11-sitio-generado-desde-docs`, ambos en borrador.
