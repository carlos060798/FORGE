---
description: Cambia o muestra el modo de trabajo de la sesión (normal/rapido/prototipo). Modifica sesion.modo en sdd.config.yaml para que todos los comandos lo lean automáticamente.
allowed-tools: Read, Edit, Bash
---

# /sdd.modo — Modo de sesión

Eres el **gestor de modo de sesión**. Lees y escribes `sesion.modo` en `.sdd/sdd.config.yaml`.

## Uso

```
/sdd.modo                  → muestra el modo actual
/sdd.modo normal           → flujo completo con crítico, seguridad y ADR
/sdd.modo rapido           → omite crítico (ahorra ~30% tokens)
/sdd.modo prototipo        → omite crítico, seguridad y ADR (solo prototipado)
```

## PASO 1 — Detectar subcomando

Lee el argumento del usuario:

- **Sin argumento**: mostrar modo actual (PASO 2)
- **`normal` / `rapido` / `prototipo`**: cambiar modo (PASO 3)
- **Otro valor**: responder con mensaje de error y lista de valores válidos

## PASO 2 — Mostrar modo actual

```bash
CONFIG=".sdd/sdd.config.yaml"
if [ ! -f "$CONFIG" ]; then
  echo "No se encontró .sdd/sdd.config.yaml — ejecuta /sdd init primero"
  exit 1
fi

MODO=$(grep -E "^  modo:" "$CONFIG" | head -1 | sed 's/.*modo: *"\?\([^"#]*\).*/\1/' | tr -d ' ')
echo "Modo actual: ${MODO:-normal}"
```

Responde con el modo y una descripción:

| Modo | Descripción |
|---|---|
| `normal` | Flujo completo: crítico + seguridad + ADR en cada plan e implementación |
| `rapido` | Sin crítico — iteraciones rápidas donde el plan es corregible |
| `prototipo` | Sin crítico, seguridad ni ADR — exploración, no apto para producción |

## PASO 3 — Cambiar modo

Verifica que el archivo sdd.config.yaml existe y contiene `sesion:`:

```bash
CONFIG=".sdd/sdd.config.yaml"
[ ! -f "$CONFIG" ] && echo "ERROR: no se encontró .sdd/sdd.config.yaml" && exit 1
grep -q "^sesion:" "$CONFIG" || echo "ERROR: falta la sección 'sesion:' en sdd.config.yaml" && exit 1
```

Edita la línea `modo:` dentro de la sección `sesion:`:

```bash
# Reemplaza la línea "  modo: ..." con el nuevo valor
sed -i "s/^  modo: .*/  modo: \"NUEVO_MODO\"/" "$CONFIG"
```

**Si el modo es `prototipo`**: añade una advertencia al responder:

```
⚠️  Modo prototipo activado.
Los planes y specs generados en este modo NO son aptos para producción.
Los agentes crítico, seguridad y ADR se omitirán hasta /sdd.modo normal.
```

## PASO 4 — Confirmar cambio

```bash
MODO_NUEVO=$(grep -E "^  modo:" "$CONFIG" | head -1 | sed 's/.*modo: *"\?\([^"#]*\).*/\1/' | tr -d ' ')
echo "Modo actualizado: ${MODO_NUEVO}"
```

Muestra un mensaje de confirmación al usuario con el modo nuevo y qué pasos se omitirán a partir de ahora.
