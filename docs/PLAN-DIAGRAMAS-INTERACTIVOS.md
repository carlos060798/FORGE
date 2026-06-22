# Plan de Mejora: Diagramas Interactivos en docs-site

**Estado:** Planificación  
**Impacto:** UX/Comprensión visual del sistema  
**Esfuerzo:** 3-4 horas  
**Tecnología:** Mermaid + SVG inline + CSS interactivo

---

## Problemas actuales

### 1. Diagramas ASCII estáticos
- En `ARQUITECTURA.md` se usan cajas ASCII (líneas 3-44)
- No escalables, difíciles de mantener
- No responsivos en móvil
- Difíciles de entender para no-técnicos

### 2. docs-site sin visualización
- `docs-site/` tiene estructura HTML/JS/CSS (SPA)
- `data.js` es 78KB de contenido procesado
- No hay diagramas integrados ni interactivos
- Cargas de página lentas (probablemente sin compresión)

### 3. Flujo de usuarios confuso
Usuarios no entienden:
- Cuándo se activa cada agente
- Qué modelo usa cada uno
- Cómo se comunican entre sí
- Dónde están los datos en `.sdd/`

---

## Solución: Diagrama interactivo Mermaid

### Diagrama 1: Arquitectura del sistema

Convertir este ASCII:
```
┌─────────────────────────────────────────────────────────────────┐
│                        CLAUDE CODE (host)                        │
│  ┌──────────────┐    ┌─────────────────────────────────────┐    │
│  │  Usuario     │───▶│           FORGE Hub (/forge)         │    │
│  │  /forge "…"  │    │         commands/forge.md            │    │
│  └──────────────┘    └──────────────────┬──────────────────┘    │
│                                          │                        │
│                           ┌─────────────▼─────────────┐         │
│                           │     38 Comandos SDD        │         │
│                           │  commands/sdd.*.md         │         │
│                           └─────────────┬─────────────┘         │
```

A este diagrama Mermaid:
```mermaid
graph TD
    User["👤 Usuario<br/>/forge 'idea'"]
    Hub["⚙️ FORGE Hub<br/>commands/forge.md"]
    Commands["📋 38 Comandos SDD<br/>commands/sdd.*.md<br/>(interpretar → especificar → implementar)"]
    Agents["🤖 14 Agentes<br/>agents/*.md<br/>(arquitecto, tester, etc.)"]
    Skills["✨ 26 Skills<br/>skills/*.md<br/>(indexador, github-connect, etc.)"]
    State[".sdd/ Estado<br/>├ especificaciones/<br/>├ codigo/<br/>├ memoria/<br/>└ observabilidad/"]
    
    User -->|/forge| Hub
    Hub -->|orquesta| Commands
    Commands -->|dispara| Agents
    Agents -->|usa| Skills
    Agents -->|escribe en| State
    Skills -->|modifica| State
    
    style User fill:#4CAF50,color:#fff
    style Hub fill:#2196F3,color:#fff
    style Commands fill:#FF9800,color:#fff
    style Agents fill:#9C27B0,color:#fff
    style Skills fill:#E91E63,color:#fff
    style State fill:#00BCD4,color:#fff
```

### Diagrama 2: Pipeline SDD (flujo de ejecución)

```mermaid
graph LR
    Idea["💡 Idea<br/>(texto libre)"]
    Discover["🔍 Descubrir<br/>sdd.descubrir"]
    IR["📊 IR<br/>(Intermediate Repr.)"]
    Spec["📄 Especificación<br/>spec.md"]
    Plan["📋 Plan<br/>plan.md"]
    Tasks["✅ Tareas<br/>tasks.md"]
    Implement["💻 Implementar<br/>sdd.implementar"]
    Code["🔧 Código<br/>src/"]
    Test["🧪 Testing<br/>sdd.verificar"]
    Deploy["🚀 Deploy<br/>sdd.desplegar"]
    
    Idea -->|preguntas rápidas| Discover
    Discover -->|crea| IR
    IR -->|expande a| Spec
    Spec -->|traduce a| Plan
    Plan -->|detalla| Tasks
    Tasks -->|ejecuta| Implement
    Implement -->|genera| Code
    Code -->|valida| Test
    Test -->|prepara| Deploy
    Deploy -->|lanza a prod| Prod["🌐 Producción"]
    
    style Idea fill:#4CAF50,color:#fff
    style Discover fill:#2196F3,color:#fff
    style IR fill:#FF9800,color:#fff
    style Spec fill:#9C27B0,color:#fff
    style Plan fill:#E91E63,color:#fff
    style Tasks fill:#00BCD4,color:#fff
    style Implement fill:#607D8B,color:#fff
    style Code fill:#795548,color:#fff
    style Test fill:#CDDC39,color:#333
    style Deploy fill:#4CAF50,color:#fff
    style Prod fill:#f44336,color:#fff
```

### Diagrama 3: Encaminamiento de agentes (modelo dinámico)

```mermaid
graph TD
    Router["🎯 Router de Agentes<br/>(Complejidad IR)"]
    
    Low["Baja complejidad"]
    Haiku["claude-haiku-4-5<br/>documentador<br/>operaciones"]
    
    Mid["Complejidad media"]
    Sonnet["claude-sonnet-4-6<br/>backend, frontend<br/>tester, revisor"]
    
    High["Alta complejidad"]
    Opus["claude-opus-4-8<br/>arquitecto<br/>crítico<br/>seguridad"]
    
    Router -->|<4 HU| Low
    Router -->|4-8 HU| Mid
    Router -->|>8 HU| High
    
    Low --> Haiku
    Mid --> Sonnet
    High --> Opus
    
    style Router fill:#2196F3,color:#fff,stroke:#1565c0,stroke-width:3px
    style Low fill:#4CAF50,color:#fff
    style Mid fill:#FF9800,color:#fff
    style High fill:#f44336,color:#fff
    style Haiku fill:#81C784,color:#333
    style Sonnet fill:#FFB74D,color:#333
    style Opus fill:#EF5350,color:#fff
```

### Diagrama 4: Estructura de `.sdd/` y memoria

```mermaid
graph TD
    SDD[".sdd/ (Estado persistent)"]
    
    Spec["📋 especificaciones/<br/>├ YYYY-MM-DD-auth/<br/>│  └ spec.md<br/>└ YYYY-MM-DD-api/<br/>   └ spec.md"]
    
    Code["💻 codigo/<br/>├ backend/<br/>├ frontend/<br/>└ tests/"]
    
    Mem["🧠 memoria/<br/>├ memoria.db (SQLite) ⚡<br/>├ agente-*.md (fallback)<br/>├ indice.jsonl<br/>└ ..."]
    
    Obs["📊 observabilidad/<br/>├ consumo.jsonl<br/>└ mutaciones.jsonl"]
    
    Config["⚙️ sdd.config.yaml<br/>├ backend: sqlite|markdown<br/>├ umbral_bytes<br/>└ recuperacion..."]
    
    SDD --> Spec
    SDD --> Code
    SDD --> Mem
    SDD --> Obs
    SDD --> Config
    
    style SDD fill:#00BCD4,color:#fff,stroke:#0097A7,stroke-width:3px
    style Spec fill:#9C27B0,color:#fff
    style Code fill:#2196F3,color:#fff
    style Mem fill:#4CAF50,color:#fff
    style Obs fill:#FF9800,color:#fff
    style Config fill:#795548,color:#fff
```

---

## Implementación en docs-site

### Paso 1: Añadir Mermaid al HTML

En `docs-site/index.html`:

```html
<script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
<script>
  mermaid.initialize({ startOnLoad: true, theme: 'default' });
  mermaid.contentLoaded();
</script>
```

### Paso 2: Convertir markdown a SVG

En el build (`docs-site/build.js` o similar):

```javascript
import mermaid from 'mermaid';

async function diagramToSVG(diagram) {
  const svg = await mermaid.render('diagram', diagram);
  return svg.data;
}

// Para cada diagrama, generar SVG y incrustarlo
const diagramas = {
  arquitectura: `graph TD
    ... (copiar de arriba) ...`,
  pipeline: `graph LR
    ... (copiar de arriba) ...`,
  // etc.
};

for (const [nombre, definicion] of Object.entries(diagramas)) {
  const svg = await diagramToSVG(definicion);
  // Guardar en assets/diagramas/
}
```

### Paso 3: Añadir interactividad CSS

```css
/* Hover en nodos del diagrama */
.mermaid svg g:hover > g > text {
  font-weight: bold;
  fill: #2196F3;
}

/* Animación suave */
.mermaid svg {
  transition: opacity 0.3s ease-in-out;
}

.mermaid:hover {
  opacity: 0.95;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
```

### Paso 4: Modal de detalles (opcional)

Al hacer click en un nodo, mostrar detalles:

```javascript
document.querySelectorAll('.mermaid svg g').forEach(node => {
  node.addEventListener('click', () => {
    const titulo = node.querySelector('text')?.textContent;
    showModal(titulo, getDetails(titulo));
  });
});

function getDetails(titulo) {
  const info = {
    'arquitecto': {
      modelo: 'claude-opus-4-8',
      rol: 'Diseño técnico de alto nivel',
      entrada: 'Especificación completa',
      salida: 'Plan + ADR (Architecture Decision Record)'
    },
    // ...
  };
  return info[titulo] || {};
}
```

---

## Mejoras secundarias

### 1. Comprimir data.js

```bash
# Analizar qué hay en data.js
# Probablemente contenido duplicado de markdown

# Soluciones:
# - Minificar + gzip
# - Lazy-load por sección
# - Eliminar duplicados de documentación
```

### 2. Buscador en docs-site

Integrar busca por texto en los diagramas:

```javascript
const buscar = (query) => {
  const resultados = [];
  document.querySelectorAll('.mermaid text').forEach(el => {
    if (el.textContent.includes(query)) {
      resultados.push(el);
      el.parentElement.setAttribute('data-highlight', 'true');
    }
  });
  return resultados;
};
```

### 3. Exportar diagramas

Permitir descargar como PNG/SVG:

```javascript
async function exportarDiagrama(nombre, formato) {
  const svg = document.querySelector(`#${nombre} svg`);
  if (formato === 'svg') {
    download(new XMLSerializer().serializeToString(svg), `${nombre}.svg`);
  } else if (formato === 'png') {
    // Usar canvas para convertir SVG → PNG
    const canvas = document.createElement('canvas');
    // ...
  }
}
```

---

## Estimación de esfuerzo

| Tarea | Horas | Prioridad |
|-------|-------|-----------|
| Crear 4 diagramas Mermaid | 1 | Alta |
| Integrar Mermaid en HTML | 0.5 | Alta |
| CSS + hover effects | 0.5 | Media |
| Modal de detalles (click) | 1 | Media |
| Comprimir data.js | 1 | Baja |
| Buscador en diagramas | 1.5 | Baja |
| Exportar PNG/SVG | 1 | Baja |
| **Total** | **5-6** | — |

**MVP (prioritario):** 4 diagramas + integración = 1.5-2h

---

## Impacto esperado

✅ Usuarios entienden arquitectura a primera vista  
✅ Documentación más amigable (no-técnicos)  
✅ Reducir preguntas de "¿cómo funciona X?"  
✅ Mejor SEO (diagramas son indexables)  
✅ Repositorio más profesional  

---

## Próximos pasos

1. Crear archivos `.mermaid` de los 4 diagramas
2. Integrar CDN de Mermaid en `index.html`
3. Actualizar `ARQUITECTURA.md` para referenciar diagramas
4. Probar en navegador y mobile
5. Opcional: Añadir interactividad
