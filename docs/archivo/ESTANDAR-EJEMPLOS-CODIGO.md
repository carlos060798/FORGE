# 📋 Estándar de Ejemplos de Código — FORGE v4.0.0

**Fecha:** 2026-06-22  
**Versión:** 1.0  
**Propósito:** Definir un formato único y verificable para todos los bloques de código en documentación de FORGE  

---

## Estructura Mínima de un Ejemplo

Todo bloque de código debe tener esta estructura:

```
[Párrafo de contexto explicando QUÉ hace el ejemplo]

[Ubicación o requisito previo si aplica]

\`\`\`[lenguaje]
[código]
\`\`\`

[Explicación de QUÉ hace cada línea importante si es no-obvio]

[Nota de ejecución o resultado esperado si aplica]
```

---

## Formato Detallado

### 1. Párrafo previo: Explicar el QUÉ

Antes de cada bloque de código, incluir 1-2 oraciones explicando:
- **Qué** hace el código (no cómo)
- **Cuándo** se usa
- **Por qué** es relevante

**Ejemplo:**
```
Para crear un agente personalizado, usa la skill `crear-agente`. 
Esto genera un archivo base que puedes personalizar según tu caso de uso.
```

### 2. Lenguaje identificado

SIEMPRE especificar el lenguaje en la apertura del bloque:

✅ Correcto:
```bash
npm install
```

✅ Correcto:
```javascript
const forge = require('forge-sdd');
```

✅ Correcto:
```yaml
perfil: guiado
```

❌ INCORRECTO (sin lenguaje):
````
npm install
````

### 3. Ubicación o contexto

Si el código es para ejecutar en un lugar específico, indicarlo:

```bash
# Ubicación: terminal del proyecto
# Requisito: Node.js ≥ 18
npx forge-sdd init
```

O dentro del código como comentario:

```javascript
// archivo: .claude/hooks/pre-tool-guard.js
const { readFileSync } = require('fs');
```

O antes del bloque:

> En el archivo `.sdd/sdd.config.yaml`:

```yaml
perfil: experto
agentes:
  arquitecto:
    activo: true
    modelo: opus
```

### 4. Explicación post-código

Después de código complejo, explicar:
- Qué líneas son críticas
- Qué hace cada sección
- Cuál es el resultado esperado

**Ejemplo:**

```bash
#!/bin/bash
# Ubicación: .sdd/hooks/post-write-conventions.js (fragmento)

# Leer constitución desde memoria
const constitucion = JSON.parse(readFileSync('.sdd/memoria/constitucion.json'));

# Validar el archivo escrito contra convenciones
if (!validarConvenciones(archivo, constitucion)) {
  process.exit(2);  # ← Código de salida 2 = rechazar, revertir cambio
}
```

Después:
```
El script:
1. Lee la constitución desde .sdd/memoria/ (fuente de verdad)
2. Valida el nuevo archivo contra esas convenciones
3. Si falla validación, devuelve exit code 2 → Claude Code revierte el cambio
```

### 5. Resultado esperado

Indicar qué esperar después de ejecutar:

```bash
$ npx forge-sdd init
# Resultado esperado:
# ✓ Hooks de Claude Code registrados (PreToolUse, PostToolUse)
# ✓ .claude/ creado con comandos, agentes, skills
# ✓ .sdd/ creado con sdd.config.yaml
```

---

## Checklist de Validación

Para cada bloque de código en documentación de FORGE:

- [ ] **¿Tiene párrafo previo explicando el QUÉ?**
  - Si no: agregar 1-2 oraciones antes

- [ ] **¿Se especifica el lenguaje?**
  - Si no: agregar lenguaje en ` ```[lenguaje] `

- [ ] **¿Se indica la ubicación si es código de un archivo?**
  - Si aplica: agregar comentario `# archivo: ruta/archivo.ext`

- [ ] **¿Se indica el contexto de ejecución si es terminal?**
  - Si aplica: agregar `# Ubicación: terminal del proyecto`

- [ ] **¿La sintaxis es correcta?**
  - Ejecutar mentalmente o verificar contra API documentada

- [ ] **¿Usa indentación consistente?**
  - Bash/JS/TS: 2 espacios (preferencia FORGE)
  - YAML: 2 espacios (estándar YAML)
  - JSON: 2 espacios (estándar)

- [ ] **¿El código es actual?**
  - ¿Referencia APIs que existen?
  - ¿Usa nombres/flags correctos?

- [ ] **¿Hay explicación del resultado si no es obvio?**
  - Si es complejo: agregar párrafo explicativo post-código

---

## Ejemplos de Formato Correcto

### Ejemplo 1: Bash — Instalación

> Para instalar FORGE en tu proyecto, usa el instalador:

```bash
# Ubicación: terminal en la raíz de tu proyecto
# Requisito: Node.js ≥ 18

npx forge-sdd init
```

Esto:
1. Descarga FORGE desde npm
2. Copia comandos, agentes, skills a `.claude/`
3. Crea `.sdd/` con configuración inicial
4. Genera `.claude/CLAUDE.md` con instrucciones

---

### Ejemplo 2: JavaScript — API de Memoria

> Para consultar la memoria persistente del proyecto, usa la API de ProjectMemory:

```javascript
// ubicación: script Node.js en la raíz del proyecto
const { ProjectMemory } = require('forge-sdd/core');

const memory = new ProjectMemory('.sdd/');
const agentNotes = await memory.getAgentMemory('arquitecto');

console.log(agentNotes);
// Resultado: { id: "...", memoria: [...], timestamp: "..." }
```

---

### Ejemplo 3: YAML — Configuración

> Para habilitar el backend SQLite (requiere Node ≥ 22.5), modifica `.sdd/sdd.config.yaml`:

```yaml
# archivo: .sdd/sdd.config.yaml

perfil: experto
agentes:
  arquitecto:
    activo: true
    modelo: opus

memoria:
  backend: sqlite    # ← Requiere Node ≥ 22.5
  umbral_bytes: 50000
```

**Nota:** Si tu Node.js es <22.5, FORGE caerá automáticamente a Markdown con warning.

---

### Ejemplo 4: JSON — IR (Interpreted Requirement)

> El IR generado por `/sdd.interpretar` tiene esta estructura:

```json
{
  "id": "ir-2026-06-21-abc123",
  "created_at": "2026-06-21T10:00:00Z",
  "raw_input": "quiero un gestor de tareas para equipos",
  "confidence": 0.87,
  
  "product": {
    "name": "TaskFlow",
    "type": "saas",
    "tagline": "Gestión de tareas colaborativa para equipos"
  },
  
  "features": {
    "core": ["crear tareas", "asignar a miembros", "notificaciones"],
    "nice_to_have": ["integración Slack"]
  }
}
```

**Campos importantes:**
- `confidence`: 0.0–1.0, indica preparación para diseño (umbral: 0.7)
- `requires_clarification`: true si hay ambigüedades que bloquean

---

## Formato por Tipo de Ejemplo

### 🔧 Instalación / Configuración

```
[Párrafo: "Para... ejecuta"]
[Ubicación: terminal/archivo]
[Bloque de código]
[Resultado esperado]
[Notas de prerequisitos]
```

### 📖 Lectura de API

```
[Párrafo: "Para leer X desde Y"]
[Ubicación: lenguaje/framework]
[Bloque de código]
[Explicación de resultado]
[Ejemplos de output]
```

### ✍️ Escritura / Creación

```
[Párrafo: "Para crear X"]
[Ubicación: archivo donde va]
[Bloque de código]
[Explicación de qué se crea]
[Cómo verificar que funcionó]
```

### 🔄 Flujo Multi-paso

```
[Párrafo inicial explicando el flujo]
[Paso 1: código + explicación]
[Paso 2: código + explicación]
[Paso 3: código + explicación]
[Resultado final esperado]
```

---

## Antipatrones: QUÉ EVITAR

### ❌ Código sin contexto

```bash
npm install
```

**Problema:** ¿Dónde ejecuto esto? ¿Qué es lo que se instala?

**Correcto:**
```bash
# Ubicación: terminal en la raíz del proyecto
npx forge-sdd init
```

---

### ❌ Código sin lenguaje especificado

````
const memory = new ProjectMemory('.sdd/');
````

**Problema:** No se ve highlighting, no se sabe qué es

**Correcto:**
```javascript
const memory = new ProjectMemory('.sdd/');
```

---

### ❌ Código incorrecto o desactualizado

```bash
# ❌ INCORRECTO - comando no existe
npm forge init

# ✅ CORRECTO
npx forge-sdd init
```

---

### ❌ Código sin explicación en contexto de complejo

```javascript
const { stateDiagram } = await memory.queryAST('SELECT * FROM pipeline_state');
```

**Problema:** ¿Qué es queryAST? ¿De dónde viene stateDiagram?

**Correcto:**
```javascript
// Consultar el estado actual del pipeline desde memoria
const state = await memory.getPipelineState();
console.log(state.current_stage); // Ej: "implementacion"
```

---

## Herramientas de Validación

### Markdown Linter

```bash
npm install -g markdownlint-cli
markdownlint "docs/**/*.md"
```

Detecta:
- Bloques de código sin lenguaje
- Indentación inconsistente
- Links rotos

### Verificación manual

Para cada archivo de documentación:
1. [ ] Abrir en editor de texto
2. [ ] Buscar ` ``` ` (bloques de código)
3. [ ] Por cada bloque: revisar checklist arriba
4. [ ] Si falta elemento: agregarlo

---

## Auditoría de Documentación Existente

### Por categoría de documento

**Getting-started.md**
- [ ] Instalación: formato correcto
- [ ] Primeros pasos: contexto claro
- [ ] Troubleshooting: ejemplos verificables

**EJEMPLO-API-REST.md**
- [ ] Paso 1-10: cada paso tiene código
- [ ] Cada bloque: lenguaje identificado
- [ ] Resultados esperados: claros

**EJEMPLOS-MEMORIA-API.md**
- [ ] Cada ejemplo: has_context
- [ ] Cada ejemplo: es_ejecutable
- [ ] Cada ejemplo: muestra_output

---

## Versionado de Ejemplos

Cuando actualices un ejemplo:
1. Cambiar el código
2. Cambiar la explicación si es necesaria
3. Cambiar el "resultado esperado" si cambió
4. Notar la versión de FORGE a la que aplica

Ejemplo:

```javascript
// Disponible en: FORGE v3.5+
// Para versiones anteriores, usar: memory.readAgentMemory(name)

const agentMemory = await memory.getAgentMemory('arquitecto');
```

---

## 🎯 Recomendaciones de Implementación

Para implementar este estándar:

1. **Inmediato:** Crear checklist (este documento) ✅
2. **Esta semana:** Auditar ejemplos existentes en EJEMPLO-API-REST.md y EJEMPLOS-MEMORIA-API.md
3. **Próxima semana:** Aplicar correcciones a ejemplos no conformes
4. **Futuro:** Agregar validación en CI/CD (linter de ejemplos)

---

## 📝 Plantilla para nuevos ejemplos

Usa esta plantilla cuando agregues nuevos ejemplos:

```markdown
### [Nombre del ejemplo]

> [Párrafo explicando QUÉ hace, NO CÓMO]

**Requisitos:** [Node version, archivos, etc.]

**Ubicación:** [Dónde ejecutar/qué archivo]

\`\`\`[lenguaje]
[código comentado si es no-obvio]
\`\`\`

**Explicación:**
[1-2 párrafos sobre QUÉ sucede en el código]

**Resultado esperado:**
[Qué debería suceder después de ejecutar]
```

---

**Documento preparado por:** Principal Documentation Architect  
**Fecha:** 2026-06-22  
**Versión:** 1.0  
**Estado:** ✅ Listo para aplicar a documentación existente
