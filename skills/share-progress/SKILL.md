---
id: share-progress
nombre: Compartir progreso del proyecto
descripcion: Genera un resumen compartible del estado actual del pipeline FORGE en formato Markdown con estadísticas.
aliases: ["/forge.compartir", "/forge share", "/forge progress"]
version: 1.0.0
---

# Skill: Compartir Progreso

## Propósito

Generar un resumen estructurado y visualmente atractivo del estado actual del proyecto FORGE, listo para compartir en Slack, GitHub, email o como comentario en un PR.

## Cuándo usar este skill

- Cuando el usuario escribe `/forge.compartir`, `/forge share`, o `/forge progress`
- Cuando el usuario pide "genera un resumen del estado"
- Cuando el usuario quiere compartir progreso con su equipo

## Qué genera

Un documento Markdown con:
1. **Resumen ejecutivo** — nombre del proyecto, fase actual, % completado
2. **Tareas completadas** — lista con checkmarks
3. **En progreso** — qué está activo ahora
4. **Pendiente** — qué falta
5. **Métricas de uso** — agentes utilizados, estimado de tokens
6. **Próximo paso** — una acción concreta

## Cómo generar el resumen

### Paso 1 — Recopilar datos

```bash
# Estado del pipeline
cat .sdd/estado.json

# Tareas
cat .sdd/estado-tareas.json 2>/dev/null || echo "{}"

# Últimas entradas de consumo
tail -20 .sdd/observabilidad/consumo.jsonl 2>/dev/null || echo ""

# Nombre del proyecto
cat .sdd/ir.json 2>/dev/null | grep '"name"' | head -1
```

### Paso 2 — Calcular métricas

- **% completado**: `(tareas_done / tareas_total) * 100`
- **Agentes activos**: lista única de `agente` en las últimas entradas de consumo.jsonl
- **Tokens estimados**: suma de `bytes` en consumo.jsonl (estimación aproximada)

### Paso 3 — Generar documento

```markdown
# 📦 [Nombre del Proyecto] — Estado del proyecto

**Fecha:** [fecha actual]
**Fase:** [traducción humana del pipeline_step]
**Progreso:** [%] completado

---

## ✅ Completado

[Lista de tareas con estado `done`]

## 🔄 En progreso

[Tareas con estado `in_progress`]

## ⬜ Pendiente

[Tareas con estado `pending` — máximo 5, resumir si hay más]

---

## 📊 Métricas de sesión

| Métrica | Valor |
|---|---|
| Agentes utilizados | [lista de agentes únicos] |
| Archivos generados | [count de archivos escritos] |
| Fase actual | [pipeline_step en lenguaje humano] |

---

## 🎯 Próximo paso

[Descripción de qué hacer a continuación, en lenguaje humano]

---
*Generado por FORGE — [enlace a forge.dev o repositorio]*
```

## Formato de salida

- Genera el Markdown directamente en la respuesta (no en un archivo)
- El usuario puede copiar y pegar donde necesite
- Si el usuario pide "guárdalo en un archivo", créalo en `.sdd/progreso-[fecha].md`

## Ejemplo de salida

```markdown
# 📦 API de Gestión de Tareas — Estado del proyecto

**Fecha:** 21 de junio de 2026
**Fase:** Implementación en curso
**Progreso:** 65% completado (13/20 tareas)

---

## ✅ Completado

- Especificación aprobada (autenticación JWT, CRUD de tareas, validación)
- Plan de 20 tareas generado y aprobado
- Modelos de base de datos definidos
- Endpoints de autenticación implementados y testeados
- Endpoints CRUD de tareas implementados

## 🔄 En progreso

- Tests de integración de la API

## ⬜ Pendiente

- Validación de entrada en todos los endpoints
- Documentación de la API (Swagger)
- Configuración de despliegue en Vercel
- Tests end-to-end

---

## 📊 Métricas de sesión

| Métrica | Valor |
|---|---|
| Agentes utilizados | arquitecto, desarrollador-backend, tester |
| Archivos generados | 12 archivos |
| Fase actual | Implementación |

---

## 🎯 Próximo paso

Esperar a que los tests de integración finalicen. Si hay errores, FORGE
los reportará y los corregirá automáticamente antes de continuar.

---
*Generado por FORGE v5.0.0*
```
