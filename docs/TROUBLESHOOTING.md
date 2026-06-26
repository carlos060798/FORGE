# Guía de resolución de problemas

Errores reales de FORGE ordenados por fase del flujo. Cada entrada incluye el mensaje exacto, la causa y la solución.

Para problemas de negocio o escenarios de usuario (deploy falló, cambié de idea, etc.) ver [QUE-PASA-SI-FALLA.md](QUE-PASA-SI-FALLA.md).

---

## Instalación y arranque

### `npx forge init` falla con 404 o conflicto de paquete

**Causa**: en npm existe otro paquete llamado `forge` que puede colisionar con el comando.

**Solución**: el paquete se publica como `forge-sdd`. Usa el nombre exacto:
```bash
npx forge-sdd init
# o instala globalmente:
npm install -g forge-sdd
forge init
```

---

### Los agentes no responden

**Causa probable**: `ANTHROPIC_API_KEY` no está definida en el entorno.

**Diagnóstico**:
```bash
forge doctor   # mostrará ⚠ si la clave no está configurada
```

**Solución**: exporta la clave en tu shell o añádela a `.env`:
```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

---

### `forge ui` falla al iniciarse

**Causa**: el dashboard UI requiere instalación explícita con el flag `--ui`.

**Solución**:
```bash
npx forge-sdd init --ui   # instala también el servidor de dashboard
forge ui
```

---

### Los comandos `/sdd.X` no hacen nada en la terminal

**Causa**: los comandos `/sdd.*` son instrucciones para Claude Code, no comandos de shell.

**Solución**: escribe los comandos `/sdd.X` directamente en el **chat de Claude Code**, no en la terminal.

---

### Las protecciones de `sdd.config.yaml` no bloquean nada

**Causa**: la sección `protecciones` en `sdd.config.yaml` es declarativa — los hooks que la hacen cumplir se instalan en `.claude/hooks/` al ejecutar `forge init`.

**Solución**:
```bash
npx forge-sdd init   # instala los hooks en .claude/hooks/
```

Verifica que los hooks estén registrados:
```bash
cat .claude/settings.json | grep -A5 "hooks"
```

---

### El pipeline se detuvo a mitad

**Solución**: usa `forge resume` para ver tareas pendientes y relanzarlas:
```bash
forge resume
```

O consulta el estado completo con `/sdd.estado` en Claude Code.

---

### `Error: Cannot find module 'sdd-es'`

**Causa**: el paquete no está instalado globalmente o el PATH no lo incluye.

**Solución**:
```bash
npx sdd-es init        # siempre funciona sin instalación global
# o instalar globalmente:
npm install -g sdd-es
```

---

### `npx sdd-es init` no copia los archivos

**Causa**: permisos insuficientes en el directorio destino, o el directorio ya existe con archivos en conflicto.

**Solución**:
```bash
# Verificar qué archivos existen
ls -la .sdd/ .claude/

# Si el directorio está corrupto, reinicializar:
rm -rf .sdd/
npx sdd-es init
```

---

### Los hooks no se activan (Claude Code no muestra advertencias)

**Causa**: los hooks no están registrados en `settings.json`, o el archivo del hook no es ejecutable.

**Diagnóstico**:
```bash
# Verificar que el hook está registrado
cat .claude/settings.json | grep -A5 "hooks"

# Verificar que el archivo existe
ls -la claude-hooks/pre-tool-guard.js
ls -la claude-hooks/agent-memory.js
```

**Solución**:
```bash
# En Linux/macOS: dar permisos de ejecución
chmod +x claude-hooks/pre-tool-guard.js
chmod +x claude-hooks/agent-memory.js

# Verificar el registro en settings.json:
# "hooks": {
#   "PreToolUse": [{ "matcher": "*", "hooks": [{ "type": "command", "command": "node claude-hooks/pre-tool-guard.js" }] }],
#   "PostToolUse": [{ "matcher": "*", "hooks": [{ "type": "command", "command": "node claude-hooks/agent-memory.js" }] }]
# }
```

---

## Fase: `/sdd.interpretar`

### `IR validation failed: missing required field 'product.name'`

**Causa**: la idea era demasiado vaga y el agente no pudo extraer un nombre de producto.

**Solución**: añade más contexto a tu idea:
```
# Antes (vaga):
/sdd.interpretar "algo para gestionar cosas"

# Después (concreta):
/sdd.interpretar "una app web para gestionar inventario de una tienda pequeña"
```

---

### `ir.json` se genera pero las features son incorrectas

**Causa**: el agente interpretó la idea de forma diferente a lo que querías.

**Solución**: edita `.sdd/ir.json` directamente antes de continuar con `/sdd.diseñar`, o vuelve a ejecutar `/sdd.interpretar` con más detalles:
```bash
# Ver el IR actual
cat .sdd/ir.json

# Editar manualmente la sección features.core
```

---

## Fase: `/sdd.planificar`

### `Error: spec.md not found for spec ID [ID]`

**Causa**: se invocó `/sdd.planificar` antes de `/sdd.especificar`, o el ID de especificación activa en `estado.json` apunta a un directorio que no existe.

**Diagnóstico**:
```bash
cat .sdd/estado.json | grep especificacion_activa
ls .sdd/especificaciones/
```

**Solución**: ejecuta primero `/sdd.especificar [descripción]`, o corrige manualmente el campo `especificacion_activa` en `estado.json` para que apunte al ID correcto.

---

### El `critico` bloquea el plan y no avanza

**Causa esperada**: el plan tiene riesgos altos que el crítico detectó. Esto es correcto — el crítico no bloquea, solo reporta.

**Si el loop se cuelga de verdad**:
1. Lee el reporte del crítico — propone una mitigación para cada riesgo.
2. Aprueba el plan incluyendo las mitigaciones: `/sdd.planificar aprobar`.
3. Si quieres continuar sin el crítico para un prototipo:
```yaml
# .sdd/sdd.config.yaml
agentes:
  critico:
    activo: false
```

---

### `ConstitutionViolation: [principio] violated by [decisión]`

**Causa**: el agente `arquitecto` o `critico` detectó que el plan contradice la constitución del proyecto.

**Solución A** — actualizar la constitución si el principio ya no aplica:
```bash
/sdd.constitucion
# Edita el principio conflictivo
```

**Solución B** — añadir una excepción documentada en el plan:
En la sección `Complejidad Justificada` del plan, explica por qué esta decisión específica se aparta del principio y bajo qué condición.

---

## Fase: `/sdd.implementar`

### `Task bloqueada: decisión arquitectónica no contemplada en el plan`

**Causa**: el agente desarrollador encontró algo no cubierto en el plan y (por diseño) no improvisa.

**Solución**: el mensaje incluye el problema específico y 2-3 opciones. Elige una y responde al orquestador:
```
@desarrollador-backend usa la opción B: repositorio patrón con interfaz separada
```

Luego el agente retoma la tarea.

---

### `Hook bloqueó la operación: comando destructivo detectado`

**Causa**: el agente intentó ejecutar un comando en la lista de prohibidos de `pre-tool-guard.js` (ej: `git reset --hard`, `DROP DATABASE`, `rm -rf`).

**Si el bloqueo es un falso positivo** (el comando es seguro en tu contexto):
```bash
# Ver la lista de prohibidos
head -80 claude-hooks/pre-tool-guard.js

# Comentar el patrón específico si es necesario (con cuidado)
```

**Si el bloqueo es correcto** (el agente estaba tomando una acción destructiva no solicitada): el hook funcionó bien. Revisa la tarea y reformúlala para que el agente no necesite ese comando.

---

### `Hook bloqueó Write: agente read-only intentó escribir`

**Causa**: `arquitecto`, `critico` o `asesor-datos` intentaron escribir un archivo. Son agentes de análisis — L5 les bloquea escritura por diseño.

**Esto no debería ocurrir en flujos normales.** Si ocurre:
1. El agente mal-enrutó la tarea. Revisa el skill `enrutador-agentes`.
2. Invocaste el agente manualmente para una tarea de implementación. Usa `@desarrollador-backend` en su lugar.

---

### Los tests fallan después de implementar

**Diagnóstico por pasos**:
```bash
# 1. Ver output completo de tests
node --test --reporter=spec tests/*.test.js

# 2. Aislar el test que falla
node --test --reporter=spec tests/nombre.test.js

# 3. Verificar que las dependencias están instaladas
npm install

# 4. Verificar que no hay conflictos de imports ESM/CJS
# FORGE usa ESM puro (type: "module" en package.json)
# Si importas con require(): cambia a import
```

**Error frecuente**: `SyntaxError: Cannot use import statement in a module that is not an ESM module`

**Causa**: un archivo de test usa `require()` (CJS) en lugar de `import` (ESM).

**Solución**: convierte el test a ESM:
```javascript
// Antes (CJS — falla)
const { miFuncion } = require('../src/mi-modulo.js');

// Después (ESM — correcto)
import { miFuncion } from '../src/mi-modulo.js';
```

---

### `AssertionError: [archivo].md existe pero no está en plugin.json`

**Causa**: creaste un comando, agente o skill nuevo pero no lo registraste en `.claude-plugin/plugin.json`. El test de consistencia en `tests/consistency.test.js` lo detecta.

**Solución**: añade el nombre (sin extensión) al array correspondiente en `.claude-plugin/plugin.json`:
```json
{
  "commands": ["sdd", "sdd.especificar", "mi-nuevo-comando"],
  "agents": ["arquitecto", "mi-nuevo-agente"],
  "skills": ["enrutador-agentes", "mi-nuevo-skill"]
}
```

---

### La compresión de memoria no se activa aunque el contexto supera el umbral

**Causa**: el umbral configurable en `sdd.config.yaml` no está siendo leído, o el hook `agent-memory.js` no está activo.

**Diagnóstico**:
```bash
# Ver el umbral actual
grep -A3 "memoria:" .sdd/sdd.config.yaml

# Ver si el hook PostToolUse está registrado
cat .claude/settings.json | grep -A3 "PostToolUse"

# Test manual del hook
echo '{"tool":"Write","input":{"file_path":"test.txt","content":"x"}}' | node claude-hooks/agent-memory.js
```

**Solución**: si `sdd.config.yaml` no tiene sección `memoria`, añádela:
```yaml
memoria:
  umbral_bytes: 50000   # ajusta según tu proyecto
```

---

## Fase: `/sdd.verificar`

### `Verificación fallida: CA-[N] no cubierto`

**Causa**: el criterio de aceptación N del spec no tiene cobertura en el código o en los tests.

**Opciones**:
1. Volver a implementar la parte que falta: `/sdd.implementar continuar`
2. Si el CA ya está cubierto pero el verificador no lo detecta: añade un test explícito que pruebe exactamente ese comportamiento.
3. Si el CA cambió desde que escribiste la spec: actualiza la spec antes de verificar.

---

### `Gate duro: tests no están en verde antes de desplegar`

**Causa**: `/sdd.desplegar` requiere tests verdes. Es un bloqueo intencional.

**Solución**:
```bash
# Ver qué tests fallan
npm test

# Corregir los fallos y volver a intentar
/sdd.desplegar
```

No hay forma de saltarse este gate en un flujo normal. Si necesitas desplegar con tests rojos (solo en emergencias), puedes hacerlo manualmente fuera de FORGE.

---

## Problemas de contexto y memoria

### Claude Code dice "no tengo contexto del proyecto"

**Causa**: la sesión se inició en un directorio diferente, o el archivo `.sdd/estado.json` no existe.

**Solución**:
```bash
# Verificar el estado
cat .sdd/estado.json

# Si no existe, FORGE no está inicializado
npx sdd-es init

# Si existe pero Claude no lo lee, ejecuta:
/sdd.estado
```

---

### La memoria del agente crece demasiado y ralentiza las respuestas

**Causa**: el hook `agent-memory.js` acumula entradas sin comprimir.

**Solución manual**:
```bash
# Ver tamaño de los archivos de memoria
ls -lh .sdd/memoria/

# Comprimir manualmente
/sdd.comprimir aplicar
# o el alias:
/compact
```

Para reducir la frecuencia de crecimiento, baja el umbral:
```yaml
# .sdd/sdd.config.yaml
memoria:
  umbral_bytes: 20000   # comprime más agresivamente
```

---

## Diagnóstico general

Cuando no sabes qué está fallando, empieza aquí:

```bash
# 1. Estado completo del proyecto
/sdd.estado

# 2. Doctor (verifica hooks, config, dependencias)
node cli/index.js doctor

# 3. Tests de la suite de FORGE
npm test

# 4. Logs de hooks (si están activos)
cat .sdd/observabilidad/hooks.log 2>/dev/null | tail -50
```

Si el problema persiste después de estos pasos, abre un issue en el repositorio incluyendo:
- Output de `/sdd.estado`
- Output de `npm test`
- El mensaje de error exacto
- El comando FORGE que lo triggereó
