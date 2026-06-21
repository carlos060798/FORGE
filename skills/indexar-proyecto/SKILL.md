---
name: indexar-proyecto
model: claude-haiku-4-5
description: Genera índice AST de archivos JS/TS para navegación estructural sin leer archivos completos
allowed-tools: Bash, Read
---

# Skill: Indexar Proyecto

**Propósito:** Crear un índice AST (`.sdd/arquitectura/ast-index.jsonl`) de todos los archivos JS/TS del proyecto. Permite a los agentes entender la estructura del código con ~60% menos tokens que leyendo archivos completos.

## Cuándo usar este skill

- Al inicio de una sesión de implementación en proyectos JS/TS grandes (>20 archivos)
- Cuando un agente necesita saber qué exporta un módulo sin leer el archivo completo
- Antes de refactorizar — para conocer qué funciones están expuestas
- Cuando el agente recibe errores de "función no encontrada" — para localizar rápido

## Uso

```
/indexar-proyecto              → indexa todo el proyecto
/indexar-proyecto src/         → indexa solo el directorio src/
/indexar-proyecto src/auth.ts  → indexa un archivo específico
```

## Pasos

### PASO 1 — Verificar prerequisitos

```bash
node --version  # Debe ser >= 18
ls .sdd/arquitectura/ 2>/dev/null || echo "directorio no existe aún"
```

### PASO 2 — Ejecutar indexer

```bash
# Indexar todo el proyecto
node claude-hooks/ast-indexer.js

# O un directorio específico
node claude-hooks/ast-indexer.js --dir src/

# O un archivo
node claude-hooks/ast-indexer.js src/auth.ts
```

### PASO 3 — Verificar resultado

```bash
# Ver estadísticas del índice
node claude-hooks/ast-query.js --stats

# Consultar exports de un archivo
node claude-hooks/ast-query.js --archivo "src/auth.ts" --tipo exports

# Buscar una función específica
node claude-hooks/ast-query.js --buscar "login"
```

## Cómo usan el índice los agentes

En lugar de `Read src/auth.ts` (carga el archivo completo, ~2000 tokens), el agente hace:

```bash
# Ver qué exporta el módulo (~50 tokens)
node claude-hooks/ast-query.js --archivo "src/auth.ts" --tipo exports

# Buscar dónde está definida una función (~30 tokens)
node claude-hooks/ast-query.js --buscar "hashPassword"

# Ver imports de un archivo para entender dependencias (~60 tokens)
node claude-hooks/ast-query.js --archivo "src/auth.ts" --tipo imports
```

Solo usa `Read` completo si necesitas el **cuerpo** de una función específica.

## Limitaciones

- Solo cubre JS/TS (.js, .mjs, .cjs, .ts, .tsx, .jsx)
- TypeScript avanzado (decoradores, tipos complejos) puede omitirse sin error
- El índice es una **foto fija** — re-indexar si cambian los archivos significativamente
- Para Python/Go/Rust usar Read directamente (soporte multilenguaje en v3.x)

## Output esperado

```
✅ ast-indexer: 47 archivos indexados, 312 símbolos → .sdd/arquitectura/ast-index.jsonl
   3 archivos omitidos (TS avanzado o parse error)
```
