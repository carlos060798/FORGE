---
name: orquestacion-ptc
description: Patrón Programmatic Tool Calling para despachar subagentes en paralelo y agregar solo resultados mínimos. Reduce ~85% de tokens en orquestación multi-agente. Aplica en /sdd.implementar y /sdd.analizar.
---

# Skill: Orquestación PTC (Programmatic Tool Calling)

## ¿Qué es PTC?

En lugar de invocar subagentes uno a uno (secuencial, cada resultado en contexto completo), el orquestador **escribe un bloque de código** que despacha todos los agentes independientes en paralelo dentro de un sandbox de Claude Code, luego **agrega solo el resumen** — estado PASA/FALLA + diff mínimo — antes de devolver el control al modelo.

Resultado: −85% de tokens en orquestación con 3+ agentes independientes (referencia: PTC cookbook de Anthropic).

---

## Cuándo aplicar PTC

### ✅ Aplica PTC cuando:

1. **Tareas independientes en paralelo** — múltiples tareas de `/sdd.implementar` sin dependencias entre sí (distintos archivos, distintas capas).
2. **Lotes de verificación** — `/sdd.analizar` corre 7 dimensiones de auditoría; las dimensiones son independientes entre sí.
3. **Revisión multi-agente** — invocar revisor + crítico + seguridad al mismo tiempo cuando sus entradas no cambian entre sí.
4. **Cualquier fan-out N≥3** donde los subagentes reciben el mismo contexto base y sus resultados se agregan.

### ❌ NO aplica PTC cuando:

1. **El siguiente paso depende del resultado del anterior** — ej. el agente arquitecto diseña, el backend implementa usando esa arquitectura. Secuencial obligatorio.
2. **Acciones irreversibles** — deploy, escritura en BD de producción, envío de notificaciones. Confirmación explícita primero; nunca paralelizar sin gate.
3. **El usuario debe revisar entre pasos** — si hay decisión humana en el medio, no hay PTC: es un punto de pausa.
4. **Solo 1 o 2 agentes** — el overhead de PTC supera el beneficio; invocar directo.

---

## Patrón de implementación

### Estructura del bloque PTC

```javascript
// Bloque PTC — orquestador despacha en paralelo
// Entrada: lista de tareas independientes con su agente asignado
// Salida: array [{id, estado, archivos_modificados, resumen_1_linea}]

const tareas = [
  { id: "T001", agente: "desarrollador-backend", contexto: "..." },
  { id: "T003", agente: "tester",                contexto: "..." },
  { id: "T005", agente: "documentador",           contexto: "..." }
];

// Despacho paralelo
const resultados = await Promise.all(
  tareas.map(t => invocarAgente(t.agente, t.contexto))
);

// Agregación mínima — solo PASA/FALLA + archivos
return resultados.map((r, i) => ({
  id: tareas[i].id,
  estado: r.verificacion_ok ? "PASA" : "FALLA",
  archivos: r.archivos_modificados,
  resumen: r.primera_linea_resultado
}));
// El output completo de cada agente NO vuelve al modelo — solo el agregado
```

### Cuándo incluir más contexto en el agregado

- Si `estado === "FALLA"`: incluir el mensaje de error completo (necesario para el retry).
- Si hay un hallazgo de seguridad: incluir extracto, no el análisis completo.
- Nunca incluir diffs completos de archivos en el agregado; solo lista de rutas modificadas.

---

## Fallback secuencial

Si el entorno no soporta ejecución de código programática (sandbox no disponible, Claude Code en modo lectura, política de permisos):

```
MODO_PTC_DISPONIBLE = false
→ ejecutar tareas en secuencia con el ciclo estándar del paso 4 de /sdd.implementar
→ notificar al usuario: "Ejecutando en modo secuencial (PTC no disponible en este entorno)"
```

El fallback es transparente; el resultado final es idéntico, solo más lento y con más tokens.

---

## Cómo medirlo

Antes de PTC: observar tokens de entrada en la respuesta con `/sdd.estado` + `--verbose`.
Después de PTC: comparar para la misma spec con 3+ tareas independientes.
Ahorro esperado: −70 a −85% en tokens de entrada del orquestador.

---

## Referencia

Patrón documentado en: Anthropic Cookbook — "Programmatic Tool Calling" (parallel subagent dispatch + result aggregation).
