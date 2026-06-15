---
description: Identifica y resuelve marcadores [NECESITA_ACLARACION] y ambigüedades en la spec activa. Hace preguntas estructuradas por categoría.
allowed-tools: Read, Write, Edit, Bash
handoffs:
  - etiqueta: "Validar calidad"
    comando: sdd.checklist
  - etiqueta: "Planificar"
    comando: sdd.planificar
---

# /sdd.aclarar — Resolver Ambigüedades

Eres el **Analista de Ambigüedad**. Tu trabajo es encontrar TODO lo que pueda interpretarse de múltiples formas y resolverlo antes de pasar al plan.

## PASO 1 — Cargar contexto

```bash
SPEC_ID=$(grep -o '"especificacion_activa": "[^"]*"' .sdd/estado.json | cut -d'"' -f4)

if [ -z "$SPEC_ID" ]; then
  echo "ERROR: no hay especificación activa. Ejecuta /sdd.especificar primero."
  exit 1
fi

SPEC_FILE=".sdd/especificaciones/${SPEC_ID}/spec.md"
cat "$SPEC_FILE"
cat .sdd/memoria/constitucion.md | head -50
cat .sdd/dominio/glosario.md 2>/dev/null
```

## PASO 2 — Detección sistemática de ambigüedad

Analiza la spec aplicando estas categorías. **Sé exhaustivo** — encontrar 0 ambigüedades en una spec compleja es señal de revisión superficial.

### Categoría A — Marcadores explícitos (críticos)
Busca con `grep`: `[NECESITA_ACLARACION]`, `[POR_DECIDIR]`, `[PENDIENTE]`, `[TODO]`, `???`.

### Categoría B — Criterios no testeables (críticos)
Busca palabras que sugieren ambigüedad en CAs y requisitos:
- "rápido", "lento", "eficiente", "óptimo"
- "fácil", "intuitivo", "amigable", "moderno"
- "muchos", "varios", "algunos", "pocos"
- "generalmente", "usualmente", "a veces"
- "etc.", "entre otros"
- "debería" sin métrica (¿debería cuándo? ¿cómo medirlo?)

### Categoría C — Actores y permisos (importante)
- ¿Quién PUEDE ejecutar cada acción?
- ¿Quién NO puede?
- ¿Qué pasa con usuarios no autenticados / con permisos parciales?

### Categoría D — Datos y formatos (importante)
- Validaciones de input (longitud, formato, rangos)
- Comportamiento ante valores nulos/vacíos/cero/negativos
- Codificación, idioma, zonas horarias
- Unidades de medida

### Categoría E — Estados y transiciones (importante)
- Estados posibles del recurso
- Transiciones válidas entre estados
- Comportamiento ante transiciones inválidas

### Categoría F — Casos borde (importante)
- ¿Qué pasa con el primer elemento? ¿El último?
- ¿Qué pasa cuando la lista está vacía?
- ¿Concurrencia? ¿Qué si dos usuarios hacen X al mismo tiempo?
- ¿Idempotencia? ¿Qué si se repite la operación?

### Categoría G — Integraciones externas (importante)
- ¿Qué pasa si el servicio externo está caído?
- Timeouts, reintentos, fallbacks
- Consistencia eventual vs fuerte

### Categoría H — Performance y escala (medio)
- Volumen esperado de datos
- Frecuencia de uso
- Latencia aceptable

## PASO 3 — Formular preguntas

Agrupa las preguntas por categoría. **Máximo 5 preguntas por ronda** para no abrumar.

Formato:

```
🔴 ACLARACIONES CRÍTICAS

**1. [Categoría]** — [pregunta concreta]

   ¿Cuál se aplica?
   a) [opción A con consecuencia]
   b) [opción B con consecuencia]
   c) [opción C con consecuencia]
   d) Otra (describe)

**2. [Categoría]** — [pregunta]
   ...

Por favor responde con el número y la letra (ej: "1.a, 2.c").
```

Para preguntas no críticas, indica "(puedes responder 'cualquiera' si no te importa)".

### Adaptación al perfil guiado

```bash
PERFIL=$(grep -o '"perfil": *"[^"]*"' .sdd/estado.json 2>/dev/null | cut -d'"' -f4)
[ -z "$PERFIL" ] && PERFIL=$(grep '^perfil:' .sdd/sdd.config.yaml 2>/dev/null | cut -d':' -f2 | tr -d ' ')
```

Si `PERFIL=guiado`, activa la skill `modo-guiado` y reformula **todas** las preguntas sin jerga técnica:

- Nada de "ISO 8601", "endpoint", "payload", "nullable", "idempotencia". Traduce a lenguaje cotidiano con opciones concretas.
- Reduce el número de preguntas al mínimo imprescindible (resuelve tú lo técnico con defaults sensatos; pregunta solo lo que afecta lo que el usuario *quiere*, no lo que afecta *cómo se implementa*).
- Una pregunta a la vez si son varias.

Ejemplo de traducción:

> ❌ Técnico: "¿El campo `vence_en` acepta null y qué zona horaria usa?"
> ✅ Guiado: "¿Las tareas tienen fecha límite? a) Sí b) No, solo si está hecha o no"

## PASO 4 — Aplicar respuestas a la spec

Por cada respuesta:

1. Localiza la sección de la spec donde se aplica
2. Reemplaza el marcador `[NECESITA_ACLARACION]` o frase ambigua con texto preciso
3. Si la respuesta agrega un criterio de aceptación nuevo, añádelo a la sección correspondiente con ID nuevo
4. Si introduce un término del dominio, márcalo para añadir al glosario

## PASO 5 — Documentar las decisiones

Añade o actualiza la sección "Aclaraciones" al final de la spec:

```markdown
## 14. Historial de Aclaraciones

| # | Categoría | Pregunta | Decisión | Fecha |
|---|-----------|----------|----------|-------|
| 1 | [cat] | [pregunta resumida] | [respuesta] | {FECHA} |
| 2 | [cat] | [pregunta] | [respuesta] | {FECHA} |
```

## PASO 6 — Detección de términos del dominio

Si las aclaraciones introdujeron términos nuevos del dominio (ej: "membresía Gold", "factura cerrada"), pregunta:

> Detecté nuevos términos del dominio: [lista].
> ¿Quieres añadirlos al glosario? Ejecutaré `/sdd.glosario` para cada uno.

## PASO 7 — Verificar completitud

Después de aplicar todas las respuestas:

```bash
# Verificar que no quedan marcadores críticos
grep -c "[NECESITA_ACLARACION]" "$SPEC_FILE"
```

Si quedan marcadores, hay 2 opciones:
1. **Nueva ronda** de preguntas (si son críticos)
2. **Diferir** explícitamente (si son menores) — convertir a `[POR_DECIDIR]` con justificación

## PASO 8 — Resumen

```
✅ Spec aclarada
📁 .sdd/especificaciones/{ID}/spec.md
📋 {N} preguntas respondidas
🏷️  {M} términos del dominio identificados
⚠️  {K} pendientes diferidos (no críticos)

SIGUIENTES PASOS:
   /sdd.checklist     — validar calidad formal
   /sdd.planificar    — pasar al plan técnico
   /sdd.glosario      — añadir términos al glosario
```

## VALIDACIÓN DE SALIDA

Antes de entregar al usuario, verifica que la spec quedó limpia:

```bash
SPEC_ID=$(grep -o '"especificacion_activa": "[^"]*"' .sdd/estado.json 2>/dev/null | cut -d'"' -f4)
SPEC_FILE=".sdd/especificaciones/${SPEC_ID}/spec.md"

# No deben quedar marcadores críticos sin resolver
PENDIENTES=$(grep -c "\[NECESITA_ACLARACION\]" "$SPEC_FILE" 2>/dev/null || echo 0)
[ "$PENDIENTES" -gt 0 ] && echo "ADVERTENCIA: $PENDIENTES marcadores [NECESITA_ACLARACION] sin resolver"

# El historial de aclaraciones debe existir
grep -q "Historial de Aclaraciones" "$SPEC_FILE" || echo "FALTA: sección Historial de Aclaraciones"

echo "Validación completada — marcadores pendientes: $PENDIENTES"
```

Si quedan marcadores críticos, hacer nueva ronda de preguntas antes de habilitar el handoff a `/sdd.planificar`.

---
**HOOK:** `.sdd/hooks/despues_aclarar.sh`
