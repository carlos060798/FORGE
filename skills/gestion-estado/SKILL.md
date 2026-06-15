---
description: Gestiona el estado persistente del flujo SDD entre sesiones. Lee y escribe estado.json y .estado-tareas.json. Permite reanudar exactamente donde se dejó.
---

# Skill: Gestión de Estado

## Schemas

### Estado global (`.sdd/estado.json`)

```json
{
  "version_plugin": "2.0.0",
  "version_constitucion": "1.0.0",
  "inicializado": true,
  "fase_actual": "implementacion",
  "stack_detectado": { ... },
  "especificacion_activa": "2026-06-08-feature-x",
  "plan_aprobado": true,
  "tareas_generadas": true,
  "historial": [
    {
      "fase": "constitucion",
      "version": "1.0.0",
      "fecha": "2026-06-01T10:00:00Z"
    },
    {
      "fase": "especificacion",
      "id": "2026-06-08-feature-x",
      "fecha": "2026-06-08T14:30:00Z"
    }
  ],
  "fecha_inicio": "2026-06-01T10:00:00Z",
  "ultima_actualizacion": "2026-06-08T15:00:00Z"
}
```

### Estado de tareas por spec (`.sdd/especificaciones/{ID}/.estado-tareas.json`)

```json
{
  "spec_id": "2026-06-08-feature-x",
  "total": 10,
  "completadas": 6,
  "en_progreso": "T007",
  "bloqueadas": 0,
  "tareas": {
    "T001": {
      "estado": "completada",
      "agente": "arquitecto",
      "modelo": "opus",
      "depende_de": [],
      "cubre_cas": ["CA-001-01"],
      "archivos_modificados": ["src/types.ts"],
      "fecha_inicio": "2026-06-08T14:35:00Z",
      "fecha_fin": "2026-06-08T14:50:00Z"
    }
  },
  "bloqueos": {},
  "ultima_actualizacion": "2026-06-08T15:00:00Z"
}
```

## Operaciones

### leer_estado_global()
```bash
cat .sdd/estado.json 2>/dev/null || echo '{"inicializado": false}'
```

### actualizar_estado_global(patch)
Lee el estado actual, hace merge con el patch, escribe de vuelta. Siempre actualiza `ultima_actualizacion`.

```bash
# Pseudocódigo
ESTADO=$(cat .sdd/estado.json)
NUEVO=$(echo "$ESTADO" | jq '. * $patch | .ultima_actualizacion = now | tostring' --argjson patch "$PATCH")
echo "$NUEVO" > .sdd/estado.json
```

### obtener_spec_activa()
```bash
grep -o '"especificacion_activa": "[^"]*"' .sdd/estado.json | cut -d'"' -f4
```

### marcar_tarea(spec_id, tarea_id, estado, metadata)
Actualiza `.estado-tareas.json` y la barra de progreso en `tareas.md`.

### registrar_historial(fase, id, resultado)
Añade entrada al array `historial`.

## Reanudación entre sesiones

Cuando un comando SDD inicia con spec activa:

1. Lee estado global
2. Lee estado de tareas de la spec activa
3. Determina exactamente dónde quedó
4. Ofrece reanudar:

```
🔄 Sesión anterior detectada.
   Spec: {ID} (fase: implementacion)
   Última tarea completada: T007
   Tarea pendiente: T008

¿Continuar desde T008?
   sí → /sdd.implementar continuar
   no → /sdd.estado para ver detalle
```

## Concurrencia

El plugin asume **un único proceso/usuario** modificando el estado a la vez. Si necesitas multi-usuario, los hooks pueden agregar locking.
