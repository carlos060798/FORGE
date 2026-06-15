---
description: Gestiona el glosario del dominio. Añade, edita o consulta términos del dominio del proyecto.
allowed-tools: Read, Write, Edit, Bash
---

# /sdd.glosario — Glosario del Dominio

Mantienes la definición única y consistente de cada término del dominio. Esto evita que distintos agentes/devs usen sinónimos confusos para el mismo concepto.

## Modos de uso

```
/sdd.glosario                          # Mostrar glosario completo
/sdd.glosario añadir [término]         # Añadir nuevo término
/sdd.glosario editar [término]         # Editar término existente
/sdd.glosario buscar [palabra]         # Buscar términos relacionados
/sdd.glosario importar                 # Importar términos pendientes de las specs
```

## PASO 1 — Cargar glosario

```bash
mkdir -p .sdd/dominio/definiciones
[ ! -f .sdd/dominio/glosario.md ] && cat > .sdd/dominio/glosario.md << 'EOF'
# Glosario del Dominio

> Términos del dominio del proyecto. Cada término tiene UNA definición precisa.
> Editar con: `/sdd.glosario`

## Términos
EOF

cat .sdd/dominio/glosario.md
```

## Modo: Mostrar (sin args)

Lista todos los términos con su definición resumida y la fecha de última actualización.

## Modo: Añadir

Pide al usuario:
1. **Término** (sustantivo, mayúscula inicial si es propio)
2. **Definición** precisa (1-2 frases)
3. **Sinónimos a evitar** (palabras que NO deben usarse)
4. **Ejemplos** (1-3 casos concretos)
5. **Categoría** (negocio | técnico | usuario | proceso)

Añade al glosario:

```markdown
### [Término]

**Definición:** [una frase precisa]

**Categoría:** [categoría]

**Sinónimos a evitar:**
- ~~[sinónimo 1]~~ (usar siempre "[Término]")

**Ejemplos:**
- [ejemplo 1]
- [ejemplo 2]

**Referenciado en specs:**
- {ID_spec_1}, {ID_spec_2}

**Última actualización:** {FECHA}
```

Si la definición es compleja, crea archivo separado en `.sdd/dominio/definiciones/[termino].md` y enlázalo desde el glosario.

## Modo: Editar

Lee la entrada actual, presenta al usuario, recibe cambios, actualiza con marca de versión.

## Modo: Buscar

Búsqueda fuzzy en términos y definiciones. Útil para detectar duplicados/sinónimos antes de añadir.

## Modo: Importar

Escanea todas las specs en `.sdd/especificaciones/` buscando términos en la sección 10 "Términos del Dominio". Para cada uno no presente en el glosario:

> Detectado en spec {ID}: "[término]"
> ¿Añadir al glosario? (sí/no/saltar todos)

## Verificación de consistencia

Al añadir un término, verifica que no haya términos similares ya:

```bash
# Búsqueda fuzzy en términos existentes
grep -i "[parte del término]" .sdd/dominio/glosario.md
```

Si encuentra parecido:
> ⚠️ "[Nuevo término]" se parece a "[Término existente]". 
> ¿Son el mismo concepto? Si sí, añade el nuevo como sinónimo a evitar del existente.

## Reporte

```
✅ Glosario actualizado
📁 .sdd/dominio/glosario.md
📚 [N] términos definidos
🆕 [M] añadidos en esta sesión
```
