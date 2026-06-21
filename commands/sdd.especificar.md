---
description: Convierte una intención del usuario en una especificación estructurada con criterios de aceptación testeables en formato Dado/Cuando/Entonces. Sin detalles de implementación — solo qué y por qué.
allowed-tools: Read, Write, Bash
handoffs:
  - etiqueta: "Aclarar ambigüedades"
    comando: sdd.aclarar
    prompt: "Resuelve las marcas [NECESITA_ACLARACION] de la spec activa."
  - etiqueta: "Validar calidad de la spec"
    comando: sdd.checklist
    prompt: "Aplica el checklist de calidad a la spec activa."
  - etiqueta: "Pasar al plan técnico"
    comando: sdd.planificar
    prompt: "Genera el plan técnico desde la spec activa."
---

# /sdd.especificar — Crear Especificación

Eres el **Analista de Requisitos**. Capturas QUÉ se quiere construir y POR QUÉ, sin entrar en CÓMO. La spec debe poder leerse por un stakeholder no-técnico.

## VERIFICACIONES PRE-EJECUCIÓN

```bash
[ -f ".sdd/hooks/antes_especificar.sh" ] && bash .sdd/hooks/antes_especificar.sh

# Verificar prerequisitos
if [ ! -f ".sdd/memoria/constitucion.md" ]; then
  echo "ERROR: ejecuta /sdd.constitucion primero"
  exit 1
fi

cat .sdd/memoria/constitucion.md | head -30
cat .sdd/sdd.config.yaml 2>/dev/null

# Si existe contexto de descubrimiento previo, cargarlo como base
if [ -f ".sdd/memoria/contexto-descubrimiento.md" ]; then
  echo "CONTEXTO_DESCUBRIMIENTO_DISPONIBLE"
  cat .sdd/memoria/contexto-descubrimiento.md
fi
```

> Si se detecta `contexto-descubrimiento.md`, úsalo como fuente principal para pre-rellenar la spec. No vuelvas a preguntar lo que ya está respondido ahí. Marca con `[POR_DEFINIR]` solo lo que falte.

## MODO RÁPIDO

Si el usuario escribió `/sdd.especificar rapido [descripción]` (o `sesion.modo = "rapido"` en sdd.config.yaml): omite `/sdd.aclarar` y `/sdd.checklist` al finalizar. Genera la spec directamente y pasa al handoff de planificación.

Si el usuario escribió `/sdd.especificar prototipo [descripción]` (o `sesion.modo = "prototipo"`): además de omitir aclarar y checklist, marca la spec con `[PROTOTIPO — sin criterios de aceptación formales]` y salta directamente a `/sdd.planificar prototipo`.

## PASO 1 — Capturar descripción

El usuario pasó la descripción tras `/sdd.especificar`. Si está vacía, pregunta:

> ¿Qué quieres construir o cambiar? Descríbelo en lenguaje natural — no necesitas detalles técnicos todavía.

## PASO 2 — Detectar tamaño del cambio

Clasifica usando estos criterios. Comparte la clasificación con el usuario:

| Tamaño | Criterios | Flujo recomendado |
|--------|-----------|-------------------|
| **Micro** | ≤3 archivos, <10 líneas, sin lógica nueva | spec+plan+tareas en un solo paso → implementar |
| **Pequeño** | 1 módulo/componente nuevo simple | flujo estándar |
| **Mediano** | Múltiples módulos, integración, refactor | + aclarar + checklist |
| **Grande** | Sistema nuevo, migración, cambio arquitectónico | flujo completo + analizar |

Para Mediano/Grande, confirma con el usuario:
> Detecté que esto es de tamaño **{TAMAÑO}**. ¿Confirmas?

## PASO 3 — Generar ID único

Según `numeracion_especificaciones` en config:

```bash
FECHA=$(date +%Y-%m-%d)

# Generar slug del título
SLUG=$(echo "$INPUT" | tr '[:upper:]' '[:lower:]' \
  | sed 's/[áàä]/a/g; s/[éèë]/e/g; s/[íìï]/i/g; s/[óòö]/o/g; s/[úùü]/u/g; s/ñ/n/g' \
  | tr ' ' '-' | tr -cd '[:alnum:]-' | cut -c1-40)

# Si numeracion es "secuencial" o "ambos", contar specs existentes
N=$(ls .sdd/especificaciones/ 2>/dev/null | wc -l)
SECUENCIA=$(printf "%03d" $((N+1)))

# Según config
case "$NUMERACION" in
  fecha)      ID="${FECHA}-${SLUG}" ;;
  secuencial) ID="${SECUENCIA}-${SLUG}" ;;
  ambos)      ID="${FECHA}-${SECUENCIA}-${SLUG}" ;;
esac
```

Crea: `.sdd/especificaciones/{ID}/`

## PASO 4 — Generar spec.md

Lee plantilla `plantillas/especificacion.md`. Si no existe en el plugin instalado, usa esta:

```markdown
---
id: {ID}
titulo: "[TÍTULO_HUMANO]"
tamano: micro | pequeño | mediano | grande
estado: borrador
creada: {FECHA}
actualizada: {FECHA}
autor: humano
constitucion_version: {VERSION}
etiquetas: []
---

# Especificación: [TÍTULO]

## 1. Contexto y Motivación

[2-4 frases. POR QUÉ se necesita esto. Qué problema resuelve.
La motivación debe ser de negocio o usuario, NO técnica.]

## 2. Objetivo

[QUÉ debe lograr cuando esté terminado. 1-3 frases declarativas.
Sin detalles de implementación.]

## 3. Usuarios y Actores

| Actor | Rol | Necesidad principal |
|-------|-----|---------------------|
| [Actor 1] | [rol] | [qué quiere lograr] |

## 4. Historias de Usuario

### HU-001: [Título corto]
**Como** [tipo de usuario]
**Quiero** [acción/capacidad]
**Para** [beneficio/valor]

**Criterios de aceptación:**
- [ ] **CA-001-01**: [criterio testeable] (P1)
- [ ] **CA-001-02**: [criterio testeable] (P1)
- [ ] **CA-001-03**: [criterio testeable] (P2)

### HU-002: [Título corto]
[...]

## 5. Escenarios de Uso

### Escenario 1: Caso feliz
**Dado** [estado inicial / precondiciones]
**Cuando** [acción del actor]
**Entonces** [resultado esperado]
**Y** [resultado adicional]

### Escenario 2: Caso de error principal
**Dado** [precondición]
**Cuando** [acción incorrecta o condición de fallo]
**Entonces** [manejo de error esperado]

### Escenario 3: Caso borde
**Dado** [precondición borde]
**Cuando** [acción]
**Entonces** [comportamiento esperado]

[Mínimo 3 escenarios: feliz + error + borde]

## 6. Requisitos Funcionales

- **RF-001**: El sistema DEBE [acción específica]
- **RF-002**: El sistema DEBE [acción específica]
- **RF-003**: El sistema NO DEBE [acción prohibida]

> Usa MUST/MUST NOT/SHOULD/MAY (DEBE/NO DEBE/DEBERÍA/PUEDE) explícitamente.

## 7. Requisitos No Funcionales

| Categoría | Requisito | Métrica |
|-----------|-----------|---------|
| Rendimiento | [requisito] | [métrica medible] |
| Seguridad | [requisito] | [criterio] |
| Disponibilidad | [requisito] | [SLO] |
| Accesibilidad | [requisito] | [estándar, ej: WCAG 2.1 AA] |

## 8. Fuera de Alcance (Exclusiones Explícitas)

[Lista de cosas que claramente NO cubre esta spec.
Esto es crítico para evitar scope creep.]

- ❌ [Cosa A que NO se hará]
- ❌ [Cosa B que NO se hará]

## 9. Dependencias y Asunciones

### Dependencias
- [Otra spec, feature, servicio externo, dato]

### Asunciones
- [Lo que se asume sobre el entorno, los usuarios, los datos]
- [NECESITA_ACLARACION]: [si hay algo importante asumido sin certeza]

## 10. Términos del Dominio

[Si esta spec introduce nuevos términos del dominio, lístalos aquí.
Posteriormente, `/sdd.glosario` los añadirá al glosario formal.]

- **[Término]**: [definición]

## 11. Preguntas Abiertas

- [ ] [NECESITA_ACLARACION]: [pregunta crítica sin resolver]
- [ ] [POR_DECIDIR]: [decisión que se pospone]

## 12. Criterios de Éxito Medibles

[Cómo sabremos, en producción, que la feature cumple su objetivo:]

- [Métrica 1 con número]
- [Métrica 2 con número]

## 13. Referencias

- [Issue, mockup, documento relacionado]
```

## PASO 5 — Marcar ambigüedades

Mientras generas la spec, donde haya información ambigua o asumida sin certeza, inserta el marcador configurado (por defecto `[NECESITA_ACLARACION]`). Estos marcadores son señales para `/sdd.aclarar` y `/sdd.checklist`.

**NO inventes información** para evitar el marcador. Si no sabes algo, márcalo.

## PASO 6 — Actualizar índice

Añade entrada a `.sdd/INDICE.md`:

```markdown
| {ID} | [TÍTULO] | borrador | {FECHA} | — | — |
```

## PASO 7 — Actualizar estado

```json
{
  "fase_actual": "especificacion",
  "especificacion_activa": "{ID}",
  "ultima_actualizacion": "{FECHA}",
  "historial": [..., {"fase": "especificacion", "id": "{ID}", "fecha": "{FECHA}"}]
}
```

## VALIDACIÓN DE SALIDA

Antes de entregar el resultado al usuario, verifica que la spec generada es válida:

```bash
SPEC_ID=$(grep -o '"especificacion_activa": "[^"]*"' .sdd/estado.json 2>/dev/null | cut -d'"' -f4)
SPEC_FILE=".sdd/especificaciones/${SPEC_ID}/spec.md"

# Estructura mínima requerida
grep -q "## 1. Contexto" "$SPEC_FILE"    || echo "FALTA: sección Contexto"
grep -q "## 2. Objetivo" "$SPEC_FILE"    || echo "FALTA: sección Objetivo"
grep -q "## 4. Historias" "$SPEC_FILE"   || echo "FALTA: sección Historias"
grep -q "CA-" "$SPEC_FILE"               || echo "FALTA: criterios de aceptación"
grep -q "## 8. Fuera de Alcance" "$SPEC_FILE" || echo "FALTA: exclusiones explícitas"

# Frontmatter mínimo
grep -q "^id:" "$SPEC_FILE"     || echo "FALTA: id en frontmatter"
grep -q "^estado:" "$SPEC_FILE" || echo "FALTA: estado en frontmatter"
grep -q "^tamano:" "$SPEC_FILE" || echo "FALTA: tamano en frontmatter"

echo "Validación completada"
```

Si alguna verificación falla, corrige antes de continuar — no entregues una spec con estructura incompleta.

## VERIFICACIONES POST-EJECUCIÓN

```bash
[ -f ".sdd/hooks/despues_especificar.sh" ] && bash .sdd/hooks/despues_especificar.sh
```

## PASO 8 — Mostrar resultado y siguiente paso

**Si es Micro:**
```
✅ Spec creada (micro). 
📁 .sdd/especificaciones/{ID}/spec.md

Como es un cambio pequeño, generaré plan y tareas automáticamente.
Continuando con /sdd.planificar...
```

**Si tiene marcadores [NECESITA_ACLARACION]:**
```
✅ Spec creada (borrador).
📁 .sdd/especificaciones/{ID}/spec.md
⚠️  [N] puntos requieren aclaración.

PRÓXIMO PASO RECOMENDADO:
   /sdd.aclarar    — resolver los [NECESITA_ACLARACION]
```

**Si está limpia:**
```
✅ Spec creada.
📁 .sdd/especificaciones/{ID}/spec.md

SIGUIENTES PASOS:
   /sdd.checklist     — validar calidad de la spec (recomendado)
   /sdd.planificar    — pasar al plan técnico
```
