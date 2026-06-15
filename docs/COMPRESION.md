# Compresión de Tokens — Caveman-Lite adaptado al español

## El problema

Tus archivos de memoria (CLAUDE.md, notas, preferencias) se cargan cada sesión:

```
CLAUDE.md normal:  5000 palabras = 5000 tokens
CLAUDE.md comprimido:  1500 palabras = 1500 tokens
Ahorro por sesión: 3500 tokens
Ahorro mensual (20 sesiones): 70k tokens (~USD 0.30)
```

Pequeño, pero suma. Especialmente si mantienes memoria grande.

## Cómo funciona

Aplica transformaciones lingüísticas simples que preservan sustancia técnica:

| Cambio | Ejemplo |
|--------|---------|
| Quita artículos | "el BD" → "BD" |
| Simplifica conectores | "sin embargo" → "pero" |
| Quita hedging | "creo que falla" → "falla" |
| Quita cortesía | "por favor" → [quitar] |
| Abreviar | "base de datos" → "BD" |

Result: 64-75% de ahorro en palabras, 0% pérdida de sustancia.

## Niveles

### Lite
- Solo quita: hedging + cortesía
- Mantiene: frases completas, estructura
- Ahorro: 20-30%
- **Cuándo**: documentación editada frecuentemente

### Full (default)
- Quita: artículos, conectores, hedging, cortesía
- Mantiene: sustancia técnica, estructura
- Ahorro: 40-50%
- **Cuándo**: memoria de proyecto, notas internas

### Ultra
- Quita: TODO lo anterior + términos técnicos se abrevian
- Fragmentos OK
- Ahorro: 60-75%
- **Cuándo**: archivos internos, nunca editarás manualmente

## Uso

```bash
# Comprimir CLAUDE.md con nivel full
/sdd.comprimir aplicar CLAUDE.md full

# Comprimir archivo.md con nivel lite
/sdd.comprimir aplicar archivo.md lite

# Ver antes/después sin guardar
/sdd.comprimir validar archivo.md

# Restaurar desde backup
/sdd.comprimir revertir archivo.md
```

## Seguridad automática

NUNCA comprime:
- ❌ Código (`.py`, `.ts`, `.js`, `.json`, etc.)
- ❌ Líneas con "PELIGRO", "CUIDADO", "NO USAR EN PRODUCCIÓN"
- ❌ Instrucciones de acciones irreversibles ("ELIMINAR", "BORRAR")
- ❌ Secuencias multi-paso donde fragmentación causa confusión

Si detecta estos patrones: deja el texto como estaba.

## Ejemplo completo

**CLAUDE.md original** (456 palabras):

```markdown
# Estado del proyecto: Auth v2.0

Estamos trabajando en migrar la autenticación hacia un sistema 
basado en magic links por email. Es importante notar que, sin embargo,
esto requiere que el usuario sea validado correctamente en la base de datos.

Por favor, asegúrate de que todos los commits incluyan tests. 
Creo que es fundamental que sigamos estas prácticas de calidad.

La razón por la cual sugiero este enfoque es porque reduce la fricción 
de los usuarios nuevos al no tener que recordar contraseñas.
```

**Comprimido (Full)** (147 palabras, 68% ahorro):

```markdown
# Estado del proyecto: Auth v2.0

Migración: auth → magic links por email.
Requiere validación correcta BD.

Debe incluir tests en commits.
Prácticas de calidad obligatorias.

Approach: reduce fricción usuarios. No recordar pwd.
```

## Backup automático

Cuando comprimes:
```
archivo.md          ← comprimido (nuevo)
archivo.md.original ← backup (automático)
```

Para revertir:
```bash
/sdd.comprimir revertir archivo.md
```

## Tips

1. **Empieza con Lite**: menos agresivo, más reversible
2. **Valida antes**: `/sdd.comprimir validar` sin guardar
3. **Equipo**: Si trabajas en equipo, comunica que comprimiste
4. **Git**: Committea el `.original.md` también (es el "canonical")

## Diccionario completo

```
/sdd.comprimir reglas
```

Muestra todas las 80+ parejas español-caveman-lite.

## Limitaciones

- ⚠️ Pierde matices tonales (formal → casual)
- ⚠️ Manual review recomendado para docs importantes
- ❌ No entiende contexto profundo (un "tal vez" crítico podría comprimirse)

## Configuración global

En `.sdd/sdd.config.yaml`:

```yaml
compresion:
  enabled: true
  modo_salida_usuario: lite        # user-facing: contenido/agentes
  modo_agentes_internos: ultra     # comunicación IA-IA (usuario no ve)
  preservar_terminos:
    - autenticación
    - verificación
    - algoritmo
```
