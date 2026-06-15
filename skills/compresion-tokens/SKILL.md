---
description: Define reglas de compresión tipo caveman adaptadas al español. Genera diccionario de reemplazos y valida que no toque código. Se invoca por /sdd.comprimir.
---

# Skill: Compresión de Tokens

Aplica transformaciones seguras al español para reducir input tokens sin perder sustancia técnica.

## Diccionario de reemplazos (80+ pares)

### Artículos (quitar)
```
el → [quitar]
la → [quitar]
los → [quitar]
las → [quitar]
un → [quitar]
una → [quitar]
unos → [quitar]
unas → [quitar]
```

### Conectores (simplificar)
```
sin embargo → pero
por lo tanto → por eso
además → y
en conclusión → conclusión:
es importante notar que → nota:
cabe mencionar que → nota:
```

### Hedging (quitar si no es crítico)
```
creo que → [quitar]
podría ser que → [quitar]
tal vez → [quitar]
probablemente → [quitar]
parece que → [quitar]
podría → [quitar si es sugerencia débil]
```

### Frases de cortesía (quitar)
```
por favor → [quitar]
feliz de ayudar → [quitar]
claro que sí → [quitar]
sin problema → [quitar]
```

### Compresión de frases comunes
```
para que → para
es necesario que → debe
es importante que → debe
de acuerdo con → según
a partir de → desde
con el fin de → para
en el caso de que → si
a fin de cuentas → total
```

### Términos técnicos (abreviatura segura)
```
base de datos → BD
autenticación → auth
autorización → authz
usuario → user
contraseña → pwd
token → token (ya corto)
función → fn
variable → var
objeto → obj
arreglo → arr
lista → list
diccionario → dict
base de datos relacional → RDBMS
programación orientada a objetos → POO
interfaz de programación → API
máquina virtual → VM
computadora → PC
servidor → srv
cliente → cli
solicitud → req
respuesta → res
error → err
identificador → ID
```

## Patrones que NUNCA se comprimen

Estos patrones se detienen completamente:

```regex
# Seguridad
PELIGRO|DANGER|NO USAR EN PRODUCCIÓN
NO hacer|NUNCA hacer|CUIDADO
Security warning|Advertencia de seguridad

# Acciones irreversibles
ELIMINAR|BORRAR|DELETE|DROP|RESET|borrar permanently
Esto no se puede deshacer|This cannot be undone

# Código
```[a-z]+ (dentro de bloques de código)
^---$ (frontmatter YAML)
^\| .* \|$ (tablas)
^  [0-9]+\. (listas numeradas)
^https?:// (URLs)
^/[a-z] (comandos/paths)
```

## Lógica de compresión

### Paso 1: Validar archivo

```bash
# ¿Es código?
file archivo.ts | grep -q "ASCII text"  # si no, SKIP

# ¿Tiene extensión prohibida?
[[ "archivo" =~ \.(py|js|ts|go|rs|java|cs|rb|php|json|yaml|yml|toml|env|lock)$ ]]
  → NUNCA comprimir código

# ¿Tiene bloques de código?
grep -q '^```' archivo.md
  → Comprime SOLO fuera de bloques ```...```
```

### Paso 2: Protección de patrones críticos

```bash
# Líneas que mencionan peligro
grep -n "PELIGRO\|CUIDADO\|NO USAR" archivo.md
  → Marca esas líneas como "NO TOCAR"

# Bloques de código
sed -n '/^```/,/^```/p' archivo.md
  → Excluye de compresión
```

### Paso 3: Aplicar reemplazos seguros

Para cada pareja (antes → después):

```bash
# Buscar palabra completa, no parcial
sed -i 's/\bpara que\b/para/g' archivo.md
sed -i 's/\bsin embargo\b/pero/g' archivo.md
# ... (80+ reemplazos)
```

### Paso 4: Backup

```bash
cp archivo.md archivo.md.original
# Edita archivo.md comprimido
```

## Niveles de compresión

### Lite (baja agresividad)
- Quita solo: artículos + conectores obvios + cortesía
- Mantiene: hedging, estructura, conectores complejos
- Tokens ahorrados: ~20-30%

### Full (media, default)
- Quita: artículos + conectores + hedging simple + cortesía
- Mantiene: explicaciones técnicas, estructura
- Tokens ahorrados: ~40-50%

### Ultra (alta agresividad)
- Quita: TODO lo anterior + TAMBIÉN comprime términos técnicos
- Fragmentos OK
- Abreviaciones agresivas
- Tokens ahorrados: ~60-75%
- ⚠️ Riesgo: puede quedar ilegible para humanos que lean el `.original.md`

## Validación pre-guardar

Antes de sobrescribir archivo:

```bash
# Cuenta tokens aproximados
wc -w archivo.md.original  # palabras
wc -w archivo.md.comprimido
# Ratio: palabras_nuevas / palabras_viejas

if (( ratio > 0.80 )); then
  echo "⚠️ Compresión baja (solo 20% ahorro). ¿Continuar?"
fi

if (( ratio < 0.30 )); then
  echo "⚠️ Compresión agresiva (70% ahorro). Revisar legibilidad antes de comitear."
fi
```

## Ejemplo paso a paso

**Archivo original** (358 palabras):

```markdown
# Tareas pendientes para el proyecto

Estas son las tareas que debemos completar en el proyecto actual.
Es absolutamente necesario que se realicen en el orden de prioridad 
que se especifica a continuación.

Además, es importante que tengas en cuenta lo siguiente:

- La tarea de autenticación requiere que el usuario sea validado 
  en la base de datos antes de que se genere un token JWT. 
  Sin embargo, esto puede hacerse de forma asincrónica.
```

**Con compresión Full** (148 palabras, 59% ahorro):

```markdown
# Tareas pendientes

Tareas a completar. Orden por prioridad.

Importante:

- Auth: validar usuario BD → generar JWT. (Puede ser asincrónico)
```

## Seguridad: auto-claridad

Si el archivo tiene:
- `PELIGRO` o `CUIDADO` → NO comprimir esa línea
- `DELETE` o `BORRAR` → NO comprimir ese párrafo
- Instrucciones multi-paso ambiguas → NO comprimir

Ejemplo:

```markdown
# ⚠️ PELIGRO: Esta operación no se puede deshacer
# [Esta línea NO se comprime]

Para eliminar la base de datos:
1. Ejecuta el comando X
2. Confirma escribiendo "SÍ" en mayúscula
3. La BD se borrará PERMANENTEMENTE

# [Estas líneas NO se comprimen — son pasos críticos]
```

## Limitaciones

- ❌ No entiende contexto profundo (un "talvez" crítico podría comprimirse erróneamente)
- ⚠️ Manual review recomendado para documentos importantes
- ⚠️ Algunos reemplazos pueden alterar tono (formal → casual)

## Output

```bash
/sdd.comprimir aplicar archivo.md full

# Resultado:
archivo.md             ← comprimido
archivo.md.original    ← backup automático
.sdd/.comprimir.log    ← registro: antes/después, ratio, patrones preservados
```
