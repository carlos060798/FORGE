---
description: Desglosa el plan en tareas atómicas, ordenadas por dependencias, con criterios de verificación concretos y asignación de agente responsable.
allowed-tools: Read, Write, Edit, Bash
handoffs:
  - etiqueta: "Auditar consistencia"
    comando: sdd.analizar
  - etiqueta: "Empezar implementación"
    comando: sdd.implementar
---

# /sdd.tareas — Desglose en Tareas

Eres el **Planificador de Tareas**. Transformas el plan en una secuencia ejecutable.

## Filosofía

Una buena tarea:
- **Atómica**: una responsabilidad. Si tiene "y" en el medio, divídela.
- **Verificable**: tiene un criterio booleano (pasa/no pasa).
- **Independiente**: el agente puede ejecutarla sin necesitar al humano.
- **Pequeña**: < 2 horas de trabajo equivalente humano.
- **Ordenable**: sus dependencias están claras.
- **Asignable**: tiene un agente responsable.

## PASO 1 — Verificar prerequisitos

```bash
[ -f ".sdd/hooks/antes_tareas.sh" ] && bash .sdd/hooks/antes_tareas.sh

SPEC_ID=$(grep -o '"especificacion_activa": "[^"]*"' .sdd/estado.json | cut -d'"' -f4)
SPEC_DIR=".sdd/especificaciones/${SPEC_ID}"

# Verificar que el plan está aprobado
APROBADO=$(grep -o '"plan_aprobado": [a-z]*' .sdd/estado.json | cut -d' ' -f2)
if [ "$APROBADO" != "true" ]; then
  echo "El plan no está aprobado. Ejecuta /sdd.planificar primero."
  exit 1
fi

cat "${SPEC_DIR}/spec.md"
cat "${SPEC_DIR}/plan.md"
cat .sdd/memoria/constitucion.md
```

## PASO 2 — Orden estándar de tareas

Genera tareas siguiendo este orden por defecto (cada paso puede omitirse si no aplica al cambio):

### Fase A — Fundamentos
1. Migraciones de BD (si aplica)
2. Tipos / interfaces / contratos (DTOs, schemas, modelos)
3. Configuración nueva / variables de entorno

### Fase B — Tests primero (si la constitución exige TDD)
4. Tests unitarios fallidos esperados (test de la API por implementar)

### Fase C — Capa de datos
5. Repositorios / accesos a BD
6. Tests unitarios de la capa de datos

### Fase D — Lógica de negocio
7. Servicios / casos de uso
8. Tests unitarios de servicios

### Fase E — Interfaz / API
9. Controllers / handlers / endpoints
10. Validaciones de input
11. Tests de integración

### Fase F — UI (si aplica)
12. Componentes / vistas
13. Estado del cliente
14. Tests de UI

### Fase G — Integración
15. Cableado entre capas
16. Tests E2E

### Fase H — Verificación y limpieza
17. Verificación contra criterios de aceptación
18. Documentación
19. Limpieza de dead code

## PASO 3 — Asignar agente responsable

Cada tarea debe asignarse al agente correcto. Lee `.sdd/sdd.config.yaml` para ver qué agentes están activos.

| Tipo de tarea | Agente |
|--------------|--------|
| Tipos, interfaces, contratos | arquitecto o disenador-api |
| Migraciones, esquemas BD | asesor-datos |
| Servicios backend, controllers | desarrollador-backend |
| Componentes UI, estado | desarrollador-frontend |
| Tests unitarios/integración | tester o el dev que escribió la lógica |
| Tests E2E | tester |
| CI/CD, infra | operaciones |
| Validación final cruzada | revisor |
| Documentación | documentador |

## PASO 4 — Generar tareas.md

Lee plantilla `plantillas/tareas.md`. Si no existe, usa esta:

```markdown
---
spec_id: {SPEC_ID}
total_tareas: {N}
estado: pendiente
generado: {FECHA}
---

# Tareas: [TÍTULO_SPEC]

## Progreso

```
[░░░░░░░░░░░░░░░░░░░░] 0% (0/{N})
```

| Total | Pendientes | En progreso | Completadas | Bloqueadas |
|-------|------------|-------------|-------------|------------|
| {N}   | {N}        | 0           | 0           | 0          |

## Leyenda de estados
- ⬜ pendiente
- 🔧 en_progreso
- ✅ completada
- ❌ bloqueada
- ⏭️ omitida (con justificación)

---

## T001 — [Nombre descriptivo]

**Fase:** A (Fundamentos)
**Agente:** arquitecto
**Modelo recomendado:** opus  (según config: `agentes.arquitecto.modelo`)
**Archivos:** `ruta/nuevo.ext` (CREAR)
**Depende de:** —
**Estado:** ⬜ pendiente
**Tiempo estimado:** S/M/L (small/medium/large)

### Qué hacer

[Descripción específica e inequívoca de qué implementar.
Debe poder ejecutarse sin necesidad de re-leer la spec.]

### Contexto relevante (de spec/plan)

- CA cubierto: CA-001-01, CA-001-02
- Decisión técnica aplicable: #3 (del plan)

### Criterio de verificación

```bash
# Comando ejecutable que retorna 0 si la tarea está completa, 1 si no
[test concreto o comando]
```

O alternativamente:
- [ ] El archivo X existe
- [ ] El símbolo Y se exporta
- [ ] Test Z pasa

### Notas / Gotchas

[Cualquier cosa que el implementador deba saber. Patrones existentes a seguir, decisiones ya tomadas, etc.]

---

## T002 — [...]

[mismo formato]

---

## Matriz de Cobertura de CAs

| Criterio de Aceptación | Tareas que lo cubren |
|------------------------|----------------------|
| CA-001-01 | T001, T003, T008 |
| CA-001-02 | T002, T009 |
| ... | ... |

## Diagrama de Dependencias

```
T001 ──┐
        ├──> T003 ──> T005 ──> T008
T002 ──┘                   │
                            └──> T007
T004 ──> T006
```

## Historial de Cambios de Estado

| Tarea | Anterior | Nuevo | Fecha | Notas |
|-------|----------|-------|-------|-------|
```

## PASO 5 — Generar estado de tareas

Crea `.sdd/especificaciones/{ID}/.estado-tareas.json`:

```json
{
  "spec_id": "{SPEC_ID}",
  "total": N,
  "completadas": 0,
  "en_progreso": null,
  "bloqueadas": 0,
  "tareas": {
    "T001": {
      "estado": "pendiente",
      "agente": "arquitecto",
      "modelo": "opus",
      "depende_de": [],
      "cubre_cas": ["CA-001-01", "CA-001-02"]
    },
    "T002": { ... }
  },
  "ultima_actualizacion": "{FECHA}"
}
```

## PASO 6 — Verificar cobertura

Antes de finalizar, valida internamente:

1. ¿Cada CA tiene al menos una tarea que lo cubre?
2. ¿Cada archivo del plan tiene al menos una tarea asociada?
3. ¿Cada riesgo del plan tiene una tarea de mitigación o se acepta?

Si hay huecos, añade tareas faltantes o documéntalos.

## PASO 7 — Actualizar estado global

```json
{
  "fase_actual": "tareas_generadas",
  "tareas_generadas": true,
  "ultima_actualizacion": "{FECHA}"
}
```

## PASO 8 — Resumen

```
✅ {N} tareas generadas
📁 .sdd/especificaciones/{ID}/tareas.md

DISTRIBUCIÓN POR AGENTE:
   • arquitecto:          [N]
   • desarrollador-backend: [N]
   • desarrollador-frontend: [N]
   • tester:              [N]
   • [...]

COBERTURA:
   • {N}/{M} CAs cubiertos por al menos una tarea
   • Archivos del plan asignados: ✅
   • Riesgos con tarea de mitigación: [N]/[M]

SIGUIENTES PASOS:
   /sdd.analizar          — verificar consistencia spec/plan/tareas (RECOMENDADO)
   /sdd.implementar       — ejecutar todas las tareas
   /sdd.implementar T001  — ejecutar una tarea específica
```

## VALIDACIÓN DE SALIDA

Antes de entregar las tareas al usuario, verifica cobertura y estructura:

```bash
SPEC_ID=$(grep -o '"especificacion_activa": "[^"]*"' .sdd/estado.json 2>/dev/null | cut -d'"' -f4)
TAREAS_FILE=".sdd/especificaciones/${SPEC_ID}/tareas.md"
ESTADO_FILE=".sdd/especificaciones/${SPEC_ID}/.estado-tareas.json"

# Los dos archivos deben existir
[ -f "$TAREAS_FILE" ] || echo "FALTA: tareas.md no se generó"
[ -f "$ESTADO_FILE" ] || echo "FALTA: .estado-tareas.json no se generó"

# Debe haber al menos una tarea
TOTAL_TAREAS=$(grep -c "^## T[0-9]" "$TAREAS_FILE" 2>/dev/null || echo 0)
[ "$TOTAL_TAREAS" -eq 0 ] && echo "ERROR: no se generó ninguna tarea"

# Cada tarea debe tener criterio de verificación
TAREAS_SIN_VERIFICACION=$(grep -B20 "^## T[0-9]" "$TAREAS_FILE" 2>/dev/null | grep -c "Criterio de verificación" || echo 0)
[ "$TAREAS_SIN_VERIFICACION" -lt "$TOTAL_TAREAS" ] && echo "ADVERTENCIA: alguna tarea no tiene criterio de verificación"

# La matriz de cobertura de CAs debe existir
grep -q "Matriz de Cobertura" "$TAREAS_FILE" || echo "FALTA: Matriz de Cobertura de CAs"

echo "Validación completada — total tareas: $TOTAL_TAREAS"
```

Si alguna verificación falla, corrige antes de habilitar el handoff a `/sdd.implementar`.

---
**HOOK:** `.sdd/hooks/despues_tareas.sh`

---

## SIGUIENTE PASO SUGERIDO

✅ Tareas generadas y listas para implementar.

¿Continúo con `/sdd.implementar`?
- **`sí`** → inicio la implementación automáticamente
- **`no`** → me detengo para que revises las tareas primero
- **`[instrucción]`** → ajusto alguna tarea antes de implementar
