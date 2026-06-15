---
description: Actualiza el SNAPSHOT.md del producto con las funcionalidades activas. Se ejecuta después de completar una spec.
allowed-tools: Read, Write, Bash
---

# /sdd.snapshot — Actualizar SNAPSHOT del Producto

Eres el **Cartógrafo del Producto**. Mantienes una vista consolidada de qué tiene el producto actualmente, qué hace y para quién.

## Filosofía

El `SNAPSHOT.md` no es un changelog (historia). Es una **foto del presente**: si alguien lee solo este archivo, entiende qué hace el producto HOY.

## PASO 1 — Cargar contexto

```bash
cat .sdd/SNAPSHOT.md 2>/dev/null
cat .sdd/INDICE.md
ls .sdd/especificaciones/
cat .sdd/dominio/glosario.md 2>/dev/null

# Última spec completada
SPEC_ID=$(grep -o '"especificacion_activa": "[^"]*"' .sdd/estado.json | cut -d'"' -f4)
cat ".sdd/especificaciones/${SPEC_ID}/spec.md" 2>/dev/null
cat ".sdd/especificaciones/${SPEC_ID}/verificacion.md" 2>/dev/null
```

## PASO 2 — Identificar qué actualizar

A partir de la spec recién completada (si la hay), extrae:
- **Funcionalidades nuevas** añadidas
- **Funcionalidades modificadas**
- **Funcionalidades removidas**
- **Actores nuevos** que aparecen
- **Términos del dominio** nuevos

## PASO 3 — Actualizar SNAPSHOT.md

Mantén esta estructura, reemplazando solo las secciones afectadas:

```markdown
# SNAPSHOT del Producto: [NOMBRE_PROYECTO]

> Última actualización: {FECHA}
> Versión de constitución: [vN]
> Última spec aplicada: {SPEC_ID}

## ¿Qué es este producto?

[2-4 frases. Descripción ejecutiva del producto en su estado actual.]

## ¿Para quién?

[Lista de actores/usuarios con su necesidad principal.]

## Funcionalidades Activas

### [Categoría 1, ej: "Autenticación"]
- ✅ **[Nombre funcionalidad]** — [descripción breve]. *Spec: {ID}*
- ✅ **[...]**

### [Categoría 2]
- ✅ **[...]**

## Arquitectura de Alto Nivel

[Diagrama ASCII simple o descripción de los componentes principales]

```
┌────────────┐    ┌────────────┐    ┌────────────┐
│  Frontend  │───>│  Backend   │───>│  Base Datos│
└────────────┘    └────────────┘    └────────────┘
```

## Integraciones

| Sistema externo | Propósito | Estado |
|----------------|-----------|--------|
| [Sistema] | [para qué] | activo/planeado |

## Datos que se manejan

[Tipos de datos principales que el sistema almacena/procesa]

## Términos del dominio (resumen)

> Ver glosario completo en `.sdd/dominio/glosario.md`

- **[Término]**: [definición breve]

## Especificaciones aplicadas (últimas 10)

| ID | Título | Fecha |
|----|--------|-------|
| {ID} | [título] | {fecha} |

## Roadmap (próximas specs)

[Si hay specs en borrador o pendientes, listarlas]

## Métricas del producto (si se trackean)

[Si la constitución establece métricas de éxito, listarlas con valor actual]
```

## PASO 4 — Actualizar INDICE.md

Marca la spec recién completada como `✅ completada` en el índice.

## PASO 5 — Reportar

```
✅ SNAPSHOT actualizado
📁 .sdd/SNAPSHOT.md

CAMBIOS:
   + [N] funcionalidades nuevas
   ~ [N] funcionalidades modificadas
   - [N] funcionalidades removidas

El producto ahora cuenta con [N] funcionalidades activas.
```
