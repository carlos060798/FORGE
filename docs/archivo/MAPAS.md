# Mapas del Proyecto — Ahorrar 50-65k tokens por sesión

## El problema

Una sesión típica de SDD-ES (`constitucion → especificar → planificar → implementar → verificar`):

- Claude necesita entender la estructura del proyecto
- Corre `find . -type f` → 50-100 archivos
- Lee cada archivo para entender qué hace → ~50k tokens
- Esto se repite cada sesión

## La solución: Mapas estáticos

En lugar de que Claude lea archivos, consulta 3 archivos Markdown pequeños:

1. **estructura.md** — árbol + 1 línea por archivo
2. **simbolos.md** — funciones, clases, tipos exportados
3. **dependencias.md** — quién depende de quién

Total: ~10k tokens. Ahorro: 80-85%.

## Cómo usarlo

```bash
# Primera vez: genera todos los mapas
/sdd.mapear

# Después: detecta cambios, actualiza automáticamente
/sdd.mapear

# Forzar regeneración completa (casi nunca)
/sdd.mapear regenerar

# Verificar estado sin actualizar
/sdd.mapear validar
```

## Dónde van

```
.sdd/mapa/
├── estructura.md          (~5KB)
├── simbolos.md            (~8KB)
├── dependencias.md        (~3KB)
├── .estado-mapeo          (timestamp)
└── .checksums             (md5 de archivos)
```

## Cómo Claude los usa

Durante `/sdd.planificar`:
1. Busca si existen mapas
2. Los lee (rápido, 10k tokens)
3. Entiende la estructura sin leer código
4. Si necesita más detalle: entonces corre `/Read archivo.ts`

Result: típicamente **no necesita leer nada** — el mapa le alcanza.

## Actualización automática

- **Hook `despues_implementar`** actualiza mapas después de que ejecutas una tarea
- **Validación perezosa** — al inicio de comandos SDD, verifica si hay archivos nuevos y actualiza silenciosamente
- **Backup** — `.estructura.md.backup`, etc.

## Manual vs Auto-descripción

Cada archivo en `estructura.md` tiene una descripción:

```markdown
src/
├── auth/
│   ├── login.service.ts        — Servicio: autenticación local+JWT
│   │                            ^ puedes editar esto manualmente
```

Si editas la descripción, la próxima ejecución de `/sdd.mapear` respeta tus cambios.

## Lenguajes soportados

Detección automática: TypeScript, JavaScript, Python, Rust, Go, Java, C#, Ruby, PHP.

Otros lenguajes: edita manualmente el mapa o ejecuta desde proyecto raíz con esos lenguajes presentes.

## Ignorar directorios

Edita `.sdd/.mapeoignore`:

```
node_modules/
dist/
.git/
vendor/
__pycache__/
```

Próxima ejecución los salta.

## Limitaciones honestas

- ❌ Imports dinámicos (`require(variable)`) no se detectan
- ⚠️ Proyectos >5000 archivos: capa un máximo de 2000 (avisa al usuario)
- ❌ No sigue tipos a través de funciones (solo detecta firmas)

Son trade-offs aceptables para una solución sin dependencias.

## ROI

Si una sesión típica carga 200k tokens:
- Sin mapas: ~200k
- Con mapas: ~140k (30% ahorro)
- Multiplicado por 20 sesiones/mes: **1.2M tokens ahorrados/mes**

En pesos: ~USD 5 de ahorro al mes por usuario (con Claude Pro).
