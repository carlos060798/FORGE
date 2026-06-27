---
description: DEPRECADO — La compresión gramatical del español fue reemplazada por el context manager real (claude-hooks/context-manager.js). Redirige a las herramientas correctas.
---

# Skill: Compresión de Tokens — DEPRECADO

> ⚠️ **Este skill está deprecado desde FORGE v4.1.0.**
>
> La compresión caveman (quitar artículos con `sed`, abreviar términos) atacaba el lugar equivocado:
> los artículos y conectores del español representan menos del 2% del costo real de contexto.
> La raíz del problema son el historial de conversación, los archivos cargados en contexto y los
> tool-results acumulados, no la gramática de los prompts.
>
> Además, este enfoque degradaba la calidad del razonamiento del LLM al recibir texto mutilado.

## ¿Qué usar en su lugar?

### Para gestión de contexto y presupuesto → `claude-hooks/context-manager.js`

El context manager real aplica estas estrategias en orden de impacto real:

| Estrategia | Ahorro real | Cómo activar |
|---|---|---|
| Índice invertido JSONL en vez de cargar memoria completa | 70–90% en memoria | Automático vía `agent-memory.js` |
| Presupuesto por fase con umbral enforced | Bloqueo proactivo | Automático, configurable con `FORGE_BUDGET_USD` |
| Resumen progresivo de historial largo | 50–80% en historial | Automático cuando historial > umbral |
| Truncamiento inteligente de tool-results | 30–60% en herramientas | Automático vía context-manager |
| Degradación de modelo por tier | 60–80% en costo API | `FORGE_TIER=low` o configuración por agente |

### Para reducir tokens de archivos grandes → usar índice

```bash
# En vez de cargar el archivo completo:
# ❌ cat .sdd/memoria-completa.md

# ✅ Consultar por relevancia:
node claude-hooks/query-memory.js "término de búsqueda" --top=5
```

### Para sesiones con presupuesto ajustado → usar effort-router

Configura en `sdd.config.yaml`:
```yaml
agentes:
  tier_override: low      # fuerza Haiku en todos los agentes
  # o por agente:
  arquitecto:
    tier: medium          # Sonnet en vez de Opus
```

### Para ver el consumo real de la sesión

```bash
node cli/index.js logs --last=20
```

---

## Por qué se deprecó — análisis técnico

El problema de la compresión gramatical:

1. **Impacto mínimo en tokens reales.** Los artículos y conectores son tokens cortos (1 token cada uno).
   Un documento de 1000 palabras en español tiene ~120 artículos = ~120 tokens = ~2% del total típico.

2. **Degrada la calidad del LLM.** Los modelos de lenguaje entrenados en español esperan gramática
   completa. Texto mutilado tipo "Auth: validar usuario BD → generar JWT" reduce la precisión de
   razonamiento multi-paso.

3. **No escala.** El historial de conversación puede llegar a 50K–200K tokens en sesiones largas.
   Ninguna compresión superficial del prompt soluciona eso.

4. **El costo real está en:** historial acumulado (40–60%), archivos leídos (20–30%),
   tool-results (10–20%), prompts del sistema (5–10%).

El context manager real ataca estas fuentes directamente.
