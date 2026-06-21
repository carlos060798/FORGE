# Guardrails de FORGE — ¿Qué protege por defecto?

FORGE instala dos hooks de Claude Code que actúan como guardianes antes y después de cada acción del agente. Este documento explica qué protege cada uno y cómo configurarlos.

---

## Resumen rápido

| Guardrail | Qué previene | Hook | ¿Bloquea o advierte? |
|---|---|---|---|
| Comandos destructivos | `rm -rf /`, `git reset --hard`, `DROP DATABASE` | `pre-tool-guard.js` | Bloquea (exit 2) |
| Detección de secrets | Contraseñas, API keys, tokens hardcodeados | `pre-tool-guard.js` | Bloquea (exit 2) |
| Agentes read-only | Arquitecto, crítico, revisor no pueden escribir archivos | `pre-tool-guard.js` | Bloquea (exit 2) |
| Edit sobre archivo inexistente | Previene sobrescritura ciega | `pre-tool-guard.js` | Bloquea (exit 2) |
| Operaciones de riesgo moderado | `git push`, `DROP TABLE`, `terraform apply` | `pre-tool-guard.js` | Advierte (stderr) |
| Memoria de decisiones | Captura qué modificó cada agente y por qué | `agent-memory.js` | Registra silenciosamente |
| ADR automáticos | Extrae decisiones de arquitectura de los comentarios del código | `agent-memory.js` | Registra silenciosamente |
| Ledger de consumo | Registra tokens y bytes por agente y archivo | `agent-memory.js` | Registra silenciosamente |
| Alerta de memoria global | Avisa si `MEMORY.md` supera 150 líneas | `agent-memory.js` | Advierte (stderr) |
| Verify imports (opt-in) | Detecta imports relativos que no existen | `pre-tool-guard.js` | Advierte (stderr) |

---

## Detalle por guardrail

### 1. Comandos destructivos — bloqueo duro

El hook intercepta `Bash` y `PowerShell` antes de ejecutarlos. Si el comando coincide con cualquiera de estos patrones, el agente recibe un error y el comando **no se ejecuta**:

```
rm -rf /          rm -rf ~          rm -rf .
rm -rf ..         Remove-Item -Recurse -Force /
git push --force  git reset --hard  git clean -xfd
DROP DATABASE     DROP SCHEMA       git config ...password
chmod 777         rm .../etc/       cat .env
```

**¿Por qué no bloquear `git push` normal?** Porque empuja código válido al remoto. Solo bloqueamos `--force` sin `--force-with-lease`, que es el que puede destruir historial de otros.

### 2. Detección de secrets

Antes de ejecutar `Write`, `Edit`, o un comando de shell, FORGE revisa si el contenido incluye patrones de credenciales:

```
password = "..."     secret = "..."      api_key = "..."
token = "..."        sk-xxxx (OpenAI)    ghp_xxxx (GitHub PAT)
AKIA... (AWS key)    BEGIN RSA PRIVATE KEY
```

Si detecta alguno, bloquea y muestra: `"FORGE detectó que el archivo a escribir incluye una contraseña o clave secreta."`

### 3. Agentes read-only

Los siguientes agentes tienen **permiso solo de lectura** — no pueden crear ni modificar archivos:

- `arquitecto` — diseña, no implementa
- `asesor-datos` — recomienda, no escribe schemas
- `critico` — revisa, no modifica
- `seguridad` — audita, no parchea
- `investigador` — analiza, no produce código
- `revisor` — comenta, no edita
- `disenador-api` — especifica contratos, no implementa

Si uno de estos agentes intenta un `Write` o `Edit`, el hook lo bloquea con un mensaje explicativo.

### 4. Verify imports (opt-in)

Desactivado por defecto. Para activarlo, crea `forge.config.json` en la raíz del proyecto:

```json
{
  "guardrails": {
    "verify_local_imports": true
  }
}
```

Con esto activo, antes de escribir un archivo `.js` o `.ts`, FORGE verifica que los imports relativos (`./foo`, `../utils/bar`) existen en disco. Si no existen, emite una advertencia (no bloquea — puede haber falsos positivos con barrel files).

---

## forge.config.json — Configuración avanzada

Crea este archivo en la raíz del proyecto para ajustar el comportamiento de FORGE:

```json
{
  "memoria": {
    "umbral_compresion_bytes": 40000,
    "max_archivos_agente": 3
  },
  "routing": {
    "usar_complexity_ir": true,
    "complexity_umbral_opus": "high"
  },
  "guardrails": {
    "write_safety": true,
    "verify_local_imports": false
  },
  "ignore_patterns": []
}
```

| Campo | Default | Descripción |
|---|---|---|
| `memoria.umbral_compresion_bytes` | `40000` | Comprime el `.md` de un agente cuando supera este tamaño |
| `memoria.max_archivos_agente` | `3` | Máximo de entradas SQLite por (agente, archivo) antes de rotar |
| `routing.usar_complexity_ir` | `true` | Lee `ir.json` para decidir modelo del arquitecto |
| `routing.complexity_umbral_opus` | `"high"` | Solo usa Opus si complexity >= este valor |
| `guardrails.write_safety` | `true` | Activa protecciones básicas de escritura |
| `guardrails.verify_local_imports` | `false` | Advierte sobre imports relativos inexistentes (opt-in) |

Si `forge.config.json` no existe, se usan los valores de la columna **Default**. El archivo es opcional.

---

## ¿Cómo registro un evento manualmente?

Los hooks escriben en estas ubicaciones. Puedes leerlas con `cat` o `grep`:

```
.sdd/observabilidad/consumo.jsonl       ← tokens y bytes por agente
.sdd/observabilidad/mutaciones.jsonl    ← qué archivo modificó qué agente
.sdd/observabilidad/agent-tool-audit.jsonl  ← auditoría de tools por agente
.sdd/memoria/agente-*.md                ← memoria narrativa por agente
.sdd/memoria/indice.jsonl               ← índice grep-able de toda la memoria
.sdd/arquitectura/ADRs.jsonl            ← decisiones de arquitectura capturadas
```

---

## Desactivar un guardrail

No recomendamos desactivar los guardrails de producción, pero si estás en un entorno controlado:

```bash
# Deshabilitar pre-tool-guard (no recomendado en producción)
# Edita .claude/settings.json y elimina la entrada PreToolUse
```

O para desactivar solo verify-imports:
```json
{ "guardrails": { "verify_local_imports": false } }
```
