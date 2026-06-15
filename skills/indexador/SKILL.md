---
description: Detecta lenguajes del proyecto y genera mapas estáticos (estructura, símbolos, dependencias) usando regex por lenguaje. Se invoca por /sdd.mapear.
---

# Skill: Indexador de Proyecto

Analiza el código del proyecto sin dependencias externas (solo bash + grep + find) y genera 3 mapas estáticos en `.sdd/mapa/`.

## Proceso

### Paso 1: Detectar lenguajes

```bash
find . -type f -name "*.{ts,js,py,rs,go,java,cs,rb,php}" \
  -not -path './.git/*' -not -path './node_modules/*' -not -path './.sdd/*' \
  -not -path './dist/*' -not -path './build/*' \
  | sed 's/.*\.//' | sort | uniq -c | sort -rn | head -5
```

Resultado: lista de lenguajes presentes + frecuencia.

### Paso 2: Generar estructura.md

Árbol de directorios con descripciones por archivo.

Para cada archivo, extrae:
- Ruta
- 1 línea de descripción (automática o manual)

Descripción automática por lenguaje:

| Patrón de archivo | Descripción automática |
|------------------|------------------------|
| `*/service.ts` | Servicio: [nombre extraído] |
| `*/controller.ts` | HTTP: [métodos detectados] |
| `*/repo.ts`, `*/repository.ts` | Repositorio: acceso a BD |
| `*/types.ts`, `*.types.ts` | Tipos: [enums/interfaces detectados] |
| `*/index.ts` | Exporta símbolos públicos |
| `auth/` | Autenticación y autorización |
| `components/` | Componentes UI |
| `models/` | Modelos de datos |
| `utils/` | Utilidades y helpers |
| `tests/`, `__tests__/`, `spec/` | Tests y specs |

### Paso 3: Generar símbolos.md

Símbolos públicos (funciones, clases, tipos) por archivo.

Detección por lenguaje con regex:

**TypeScript/JavaScript**:
```regex
^export (function|class|const|type|interface|enum) (\w+)
  → extrae nombre + tipo
  → grep -nE '^export (function|const|class|type)' archivo.ts
```

**Python**:
```regex
^(def|class) (\w+)
  → funciones y clases en módulo principal
  → grep -nE '^(def|class) ' archivo.py
```

**Rust**:
```regex
^(pub fn|pub struct|pub enum|pub trait)
  → ítems públicos
```

**Go**:
```regex
^func ([A-Z]\w+)
  → funciones exportadas (mayúscula inicial)
```

### Paso 4: Generar dependencias.md

Extrae imports/requires/use por archivo.

**TypeScript/JavaScript**:
```regex
^import .* from ['"]([^'"]+)['"]
^import .* require(['"]([^'"]+)['"])
  → extrae ruta del módulo
```

**Python**:
```regex
^import (\w+)
^from (\w+) import
```

**Rust**:
```regex
^use (crate::|super::|std::)?(\w+)
```

Luego construye grafo:
- archivo.ts depende de: [lista de archivos/módulos importados]
- archivo.ts es usado por: [archivos que lo importan]

Detecta dependencias circulares (A → B → A).

### Paso 5: Guardar checksums

Para detección de cambios:

```bash
md5sum archivo.ts > .sdd/mapa/.checksums
```

Próxima ejecución compara:
```bash
md5sum -c .sdd/mapa/.checksums 2>/dev/null | grep FAILED
  → archivos modificados desde último mapeo
```

## Lógica de actualización

### Primera ejecución
- Re-indexa TODO el proyecto
- Genera los 3 mapas + `.checksums`

### Ejecuciones posteriores (sin `regenerar`)

1. Compara checksums: `md5sum -c`
2. Si hay archivos con FAILED: re-indexa solo esos
3. Si no hay cambios: "ya fresco"
4. Si hay archivos NUEVOS (no en checksums): indexa también

### Con `regenerar`

- Borra `.sdd/mapa/*` completamente
- Empieza de cero
- Re-indexa TODO

## Errores comunes y manejo

| Error | Mitigación |
|-------|-----------|
| Proyecto muy grande (>5000 archivos) | Capa un máximo de 2000, avisa al usuario |
| Archivo binario en src/ | Detecta por magic bytes, lo salta |
| Import dinámico (`require(variable)`) | Detecta patrón, marca como "???" |
| Ruta relativa confusa (`../../`) | Resuelve a path absoluto |

## Output de la skill

Tres archivos `.sdd/mapa/`:

```markdown
# estructura.md
src/
├── auth/
│   ├── login.service.ts        — Servicio: autenticación local+JWT
│   ├── magic-link.service.ts   — Servicio: magic links por email
│   └── ...
├── users/
│   └── ...
└── shared/
    └── logger.ts               — Utilidad: logger con contexto

# simbolos.md
## src/auth/login.service.ts
- autenticarUsuario(email, password): Promise<Session>
- cerrarSesion(sessionId): Promise<void>
- type AuthResult = { session, user }

## src/users/user.service.ts
- crearUsuario(datos): Promise<User>
- obtenerPorId(id): Promise<User>
- ...

# dependencias.md
auth/login.service.ts
  ↳ depende: users/user.repo.ts, shared/logger.ts, auth/session.repo.ts
  ↳ usado por: auth/auth.controller.ts
  ↳ importado por: [1 archivo]

users/user.service.ts
  ↳ depende: users/user.repo.ts, shared/logger.ts
  ↳ usado por: users/user.controller.ts, auth/login.service.ts
  ↳ importado por: [2 archivos]

Acoplamientos:
  shared/logger.ts    → 47 usos (alto, esperado)
  errors.ts           → 23 usos (medio)
  
Ciclos detectados: NINGUNO ✅
```

## Limitaciones honestas

- ❌ **Imports dinámicos no detectados**: `require(variable)` no se indexa
- ⚠️ **Descripciones manuales perdidas**: si habías editado `.md`, regenerar sobrescribe. Por eso existe `.original.md`
- ⚠️ **Lenguajes políglotas complejos**: monorepositorio con 5 lenguajes → cada uno con sus reglas
- ❌ **Análisis de tipos**: no sigue tipos a través de funciones, solo detecta firmas

Estos son trade-offs aceptables para una solución sin dependencias.
