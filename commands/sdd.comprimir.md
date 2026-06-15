---
description: Comprime archivos para ahorrar input tokens usando reglas caveman-like adaptadas al español. Optimiza archivos de memoria y config del plugin.
aliases: compress, ahorrar, tokens-lite
allowed-tools: Read, Write, Edit, Bash
---

# /sdd.comprimir — Comprimir para ahorrar tokens

Aplica reglas de compresión tipo caveman al español para reducir tokens de lectura en archivos que Claude carga en contexto (CLAUDE.md, preferencias, notas de proyecto).

## Uso

```
/sdd.comprimir aplicar [archivo]        ← comprime archivo específico
/sdd.comprimir plugin                   ← comprime internamente commands/, agents/, skills/
/sdd.comprimir revertir [archivo]       ← restaura desde .original.md
/sdd.comprimir reglas                   ← muestra diccionario de reglas de compresión
/sdd.comprimir validar [archivo]        ← muestra antes/después sin guardar
```

## Qué comprime

| Tipo de archivo | ¿Comprimible? | Recomendación |
|-----------------|---------------|---------------|
| `CLAUDE.md`, `notas.md`, tareas | ✅ Sí | **Obligatorio** — son memoria que se carga siempre |
| `preferencias.md`, configuración personal | ✅ Sí | **Recomendado** — reduce contexto innecesario |
| `README.md`, documentación para usuario | ❌ No | Mantén legible para humanos |
| `spec.md`, `plan.md`, `tareas.md` | ❌ No | Documentación del proyecto, debe ser clara |
| Código (`.ts`, `.py`, `.rs`, etc.) | ❌ No | **NUNCA** se comprime código |

## Cómo funciona

Aplica estas transformaciones al español (100% reversibles):

| Cambio | Ejemplo |
|--------|---------|
| Quitar artículos | "El sistema crea..." → "Sistema crea..." |
| Abreviar palabras | "para que" → "para", "es necesario que" → "debe" |
| Reemplazar conectores | "sin embargo" → "pero", "además" → "y", "por lo tanto" → "por eso" |
| Quitar hedging | "creo que", "podría ser", "tal vez" → quitar si no es crítico |
| Abreviar términos técnicos | "base de datos" → "BD", "autenticación" → "auth", "función" → "fn" |
| Quitar cortesía | "por favor", "feliz de ayudar", "claro que sí" → quitar |

**Preserva intacto**: código, URLs, paths, frontmatter, tablas, listas numeradas.

## Ejemplo

### Antes (328 tokens)
```markdown
# Tareas pendientes

Estas son las tareas que debemos completar en el proyecto. 
Es necesario que se realicen en orden de prioridad.

- La tarea de autenticación requiere que el usuario sea validado 
  en la base de datos antes de generar un token JWT.
- La tarea de caché debe asegurar que los datos se recuperan 
  rápidamente desde la memoria en lugar de hacer consultas costosas 
  a la base de datos cada vez que un usuario solicita información.
```

### Después (117 tokens, 64% ahorro)
```markdown
# Tareas pendientes

Tareas a completar. Orden por prioridad.

- Auth: validar usuario BD → generar JWT.
- Caché: datos en memoria rápido. Evita queries BD costosas.
```

## Niveles de compresión

| Nivel | Agresividad | Cuándo usar |
|-------|-------------|------------|
| **Lite** | Baja — quita solo obvio | Documentación que alguien edita frecuentemente |
| **Full** | Media — compresión balanceada (default) | Memoria de proyecto, notas, tareas |
| **Ultra** | Alta — fragmentos, abreviaciones maxim | Archivos internos, no visibles al usuario |

```bash
/sdd.comprimir aplicar CLAUDE.md full    # comprimir con nivel Full
/sdd.comprimir aplicar notas.md lite     # solo quitar hedging/relleno
```

## Seguridad (auto-claridad)

El comando NUNCA comprime en estos casos:

- ❌ Advertencias de seguridad ("no usar en producción", "peligro")
- ❌ Instrucciones de acciones irreversibles ("eliminar", "resetear", "borrar")
- ❌ Secuencias multi-paso donde ambigüedad causa error
- ❌ Líneas que contienen "CUIDADO", "PELIGRO", "IMPORTANTE"

Si detecta estos patrones, deja el texto como estaba.

## Backup automático

Cuando comprimes un archivo:

```
archivo.md          ← comprimido (nuevo)
archivo.md.original ← backup legible (automático)
```

Para revertir:

```bash
/sdd.comprimir revertir archivo.md
```

## Integración automática

Si tienes archivos comprimidos, Claude Code los detecta automáticamente y:

1. Los lee normalmente (ya están en texto)
2. Entiende que están en formato comprimido
3. Mantiene la compresión en outputs internos

## Diccionario de reglas

```bash
/sdd.comprimir reglas
```

Muestra todas las reglas de reemplazo (~80 pares español-caveman-lite).

Ejemplos:
```
el/la/los/las        → quitar
un/una/unos/unas     → quitar
para que            → para
es necesario que    → debe
sin embargo         → pero
por lo tanto        → por eso
creo que            → [quitar si contexto lo permite]
base de datos       → BD
autenticación       → auth
función             → fn
objeto              → obj
...
```

## Advertencia

- ✅ Reversible — siempre hay `.original.md`
- ✅ Seguro — NO toca código, solo prosa
- ⚠️ Editorial — la compresión pierde matices. Revisa el resultado antes de comitear si es documento importante
- ⚠️ Equipo — si trabajas en equipo, comunica que comprimiste para que no confundan los `.original.md`

## Caso de uso típico

```bash
# Tu CLAUDE.md tiene 5k tokens de contexto permanente
# Comprimirlo = 1.5k tokens (70% ahorro)

/sdd.comprimir aplicar CLAUDE.md full

# Ahora cada sesión carga 70% menos — suma a lo largo de semanas
```

## Tips

- **Comienza con `lite`**: menos agresivo, más seguro
- **Valida antes**: `/sdd.comprimir validar archivo.md` para ver el resultado sin guardar
- **Mantén `.original.md` en git**: el verdadero documento es el readable
- **No comprimas everythin**: documentación dirigida a usuarios humanos debe ser legible
