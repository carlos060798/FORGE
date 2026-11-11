---
id: 2026-11-11-sitio-generado-desde-docs
titulo: "Sitio de documentación generado desde docs/ con enlaces comprobados"
tamano: mediano  # micro | pequeño | mediano | grande
estado: borrador  # borrador | en_revision | aprobada | en_implementacion | completada
creada: 2026-11-11
actualizada: 2026-11-11
autor: humano  # humano | importado
constitucion_version: 1.1.0
etiquetas: [documentacion, sitio, ci, fase-1]
---

# Especificación: sitio generado desde `docs/`

> **Estado (2026-11-11): borrador, solo especificación; no hay código en el repositorio.** Fase 1 del [plan de documentación pública](../../../docs/informes/PLAN-DOCUMENTACION-PUBLICA.md). Se apoya en la prueba de viabilidad [SPIKE-SITIO-STARLIGHT.md](../../../docs/informes/SPIKE-SITIO-STARLIGHT.md) y en [ADR-25](../../arquitectura/ADR-25-sitio-de-documentacion-generado-con-starlight.md), ambos pendientes de aprobación. Necesita las decisiones de la sección 6.

## 1. Contexto y Motivación

El sitio publicado duplica a mano el contenido de `docs/` en un archivo de datos y no muestra nada sin JavaScript. Se desfasó de la 5.0 y nada lo detectó. La prueba de viabilidad mostró que un generador puede construir el sitio desde los Markdown actuales sin tocarlos, siempre que un conversor corrija los enlaces: sin él, 532 de 533 enlaces internos salen rotos.

## 2. Objetivo

Que el sitio sea una **salida** de `docs/` y no una segunda copia, que se lea sin JavaScript, y que un enlace roto, una versión desfasada o un término obligatorio ausente **impidan el despliegue**.

## 3. Criterios de aceptación

### Fuente única
- **CA-001-01** El sitio se construye desde los archivos de `docs/`. No existe contenido de documentación escrito a mano dentro del directorio del sitio, y `docs-site/assets/data.js` se elimina.
- **CA-001-02** Los archivos de `docs/` no se modifican para construir el sitio, y sus enlaces relativos siguen resolviendo en GitHub.

### Enlaces
- **CA-002-01** La construcción falla si, en el sitio resultante, algún enlace interno no apunta a una página o archivo que existe.
- **CA-002-02** Un enlace de `docs/` a otro documento de `docs/` se publica como enlace a su página del sitio, con su ancla conservada.
- **CA-002-03** Un enlace que sale de `docs/` (`../SECURITY.md`, `../.sdd/…`) o apunta a `docs/archivo/`, `docs/informes/`, `docs/contrato/` o `docs/uso-real/` se publica como enlace a GitHub.
- **CA-002-04** El sitio tiene página de inicio: el logotipo y el enlace al inicio no dan 404.

### Contenido
- **CA-003-01** Cada página tiene en el HTML su texto (se lee con JavaScript desactivado) y declara el idioma.
- **CA-003-02** La versión del paquete aparece en el sitio, y la construcción falla si no coincide con `package.json`.
- **CA-003-03** Los términos que distinguen la 5.0 («ciclo verificado», «Docker», «pre-beta») están en el sitio; la construcción falla si faltan.
- **CA-003-04** Cada página lleva un enlace para editarla en GitHub.

### Dependencias
- **CA-004-01** Las dependencias de construcción tienen versión exacta fijada, viven en el `package.json` del directorio del sitio y no en el del paquete, y `npm audit` de ese directorio da cero vulnerabilidades. La CI lo comprueba.
- **CA-004-02** Las acciones de CI del despliegue siguen fijadas por SHA (`tests/endurecimiento-f3.test.js`).
- **CA-004-03** Mermaid, si se usa, va con versión exacta, y la página documenta que los diagramas necesitan JavaScript.

### Despliegue
- **CA-005-01** `docs.yml` construye el sitio, ejecuta las comprobaciones de arriba y publica solo si pasan. Un cambio en `docs/` o en el conversor lanza el despliegue (hoy solo lo hace `docs-site/**`).

## 4. Fuera de alcance

- Traducción al inglés y versiones del sitio (fases 4 y 5 del plan).
- Generar la referencia (CLI, configuración, errores) desde el código (fase 3).
- Cambiar el contenido de los documentos.

## 5. Cambios de comportamiento visibles

El sitio cambia de aspecto y de rutas (de `#ancla` a una página por documento). Las direcciones antiguas con `#` dejan de funcionar; se puede conservar una redirección sencilla para las más enlazadas.

## 6. Decisiones abiertas (del dueño)

1. Aprobar el ADR-25. Si prefiere otra herramienta, el spike se repite con ella antes de escribir código.
2. Idioma: ¿solo español en esta fase? El plan propone empezar así.
3. ¿Se aceptan los 5 MB que añade Mermaid y que los diagramas necesiten JavaScript, o se prefiere ASCII y SVG pregenerado?
4. Dirección pública definitiva: ¿se queda `github.io/FORGE`, o hay un dominio propio?
