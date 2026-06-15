---
description: Indexa la estructura del proyecto, símbolos públicos y dependencias. Genera mapas estáticos en .sdd/mapa/ para que Claude consulte en vez de escanear archivos.
aliases: mapear, indexar, map, idx
allowed-tools: Read, Write, Bash
---

# /sdd.mapear — Indexar proyecto

Genera 3 archivos de mapa estático que Claude puede consultar rápidamente, ahorrando miles de tokens en lectura de código.

## Uso

```
/sdd.mapear                    ← indexación inteligente (completa si es 1ª vez, incremental si existe)
/sdd.mapear regenerar          ← fuerza re-indexación completa (tira todo, empieza de cero)
/sdd.mapear validar            ← muestra si está obsoleto sin actualizar
/sdd.mapear actualizar         ← fuerza actualización incremental
```

## Qué genera

El comando crea `.sdd/mapa/` con:

1. **estructura.md** — árbol de directorios + 1 línea por archivo (qué contiene)
2. **simbolos.md** — funciones, clases, tipos exportados con su firma
3. **dependencias.md** — quién depende de quién (grafo de imports)

## Cómo funciona

### Primera ejecución
```bash
/sdd.mapear
```
→ Indexación completa del proyecto → genera los 3 mapas

**Costo**: ~5-15k tokens dependiendo del tamaño del proyecto (una sola vez).

### Ejecuciones posteriores
```bash
/sdd.mapear
```
→ Detección automática de archivos modificados (con `find -newer`) → re-indexa solo lo nuevo

**Costo**: ~500 tokens por archivo modificado (imperceptible).

### Si quieres forzar regeneración completa
```bash
/sdd.mapear regenerar
```
→ Borra los mapas viejos y empieza de cero.

**Cuándo**: Casi nunca. Solo si sospechas que el mapa está corrupto.

### Para validar sin actualizar
```bash
/sdd.mapear validar
```
Salida:
```
📊 Estado del mapa
├─ estructura.md       ✅ fresco (hace 2h)
├─ simbolos.md         ✅ fresco (hace 2h)
├─ dependencias.md     ⚠️ desactualizado (12 archivos nuevos)
└─ Recomendación: /sdd.mapear actualizar
```

## Beneficios

- **Ahorro de tokens**: En lugar de que Claude lea 50-100 archivos (50k tokens), lee 3 archivos de mapa (10k tokens)
- **Actualización automática**: Hooks SDD actualizan el mapa después de implementar
- **Validación perezosa**: Al inicio de cualquier comando, verifica si hay archivos nuevos y actualiza silenciosamente
- **Control total**: Los mapas son Markdown plano, editable manualmente si necesitas

## Archivos generados

```
.sdd/mapa/
├── estructura.md            — árbol + descripción por archivo
├── simbolos.md              — funciones, clases, tipos, exports
├── dependencias.md          — grafo de imports + acoplamientos
├── .estado-mapeo            — metadata: última indexación, checksums
└── .pendientes              — lista de archivos para próxima actualización (auto-gestionado)
```

## Cómo consulta Claude estos mapas

Durante comandos como `/sdd.planificar` o `/sdd.implementar`:

1. Al inicio, Claude busca si existen los mapas
2. Si existen, los lee primero (son pequeños, ~10k tokens)
3. En lugar de correr `find . -type f`, Claude consulta mentalmente el mapa
4. Si necesita más detalle, entonces corre `/Read archivo.ts` — pero normalmente el mapa le alcanza

## Integración con otros comandos

- `/sdd.planificar` — Lee mapas al inicio para entender la estructura
- `/sdd.implementar` — Consulta grafo de dependencias antes de modificar archivos
- `/sdd.verificar` — Mapea CAs a símbolos encontrados en `simbolos.md`
- Hook `despues_implementar` — Marca archivos modificados para próxima actualización

## Lenguajes soportados

Detección automática de: TypeScript, Python, Rust, Go, Java, C#, Ruby, PHP, C/C++.

Si tu proyecto usa otro lenguaje, puedes editar `.sdd/mapa/estructura.md` manualmente.

## Regeneración automática

El plugin NO regenera automáticamente (para no gastar tokens). Pero:

- Hooks de SDD-ES actualizan después de `implementar`
- Validación perezosa (al inicio de otros comandos) detecta cambios
- Usuario puede forzar con `/sdd.mapear actualizar` cuando quiera

## Tips

- **Ignorar directorios**: Edita `.sdd/.mapeoignore` (sintaxis como `.gitignore`)
- **Debugging**: `/sdd.mapear validar` te muestra exactamente qué está desactualizado
- **Backup**: Los mapas anteriores se guardan como `.estructura.md.backup`, etc.
- **Espacio**: Los mapas son pequeños (~50KB típicamente), no hay problema de disk
