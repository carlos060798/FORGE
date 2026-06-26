# Referencia de API

Este documento es la referencia técnica completa de las interfaces programáticas de FORGE: la CLI, la clase `ProjectMemory`, los tipos TypeScript, los endpoints del servidor UI y las variables de entorno.

---

## CLI — forge / sdd-es

FORGE expone dos comandos equivalentes: `forge` y `sdd-es` (alias de compatibilidad).

### Entrypoint

```
forge <subcomando> [opciones]
sdd-es <subcomando> [opciones]
```

---

### `forge init`

Instala FORGE en el directorio de trabajo actual.

```bash
forge init [opciones]
```

| Opción | Tipo | Descripción |
|--------|------|-------------|
| `--global` | flag | Instala en `$HOME/.claude` en lugar del proyecto actual |
| `--guided` | flag | Activa el asistente interactivo de configuración |
| `--preset <nombre>` | string | `lean` \| `startup` \| `enterprise` |
| `--ui` | flag | Inicia el dashboard UI automáticamente tras la instalación |
| `--template <nombre>` | string | Usa una plantilla personalizada de `plantillas/` |

**Comportamiento:**
1. Copia `commands/`, `agents/`, `skills/` a `.claude/`
2. Copia `claude-hooks/` a `.claude/hooks/`
3. Registra hooks en `.claude/settings.json`
4. Crea `.sdd/` con `sdd.config.yaml` y `estado.json`
5. Si `--guided`, ejecuta el wizard interactivo primero
6. Muestra mensaje de bienvenida con ejemplo concreto de uso

**Si la instalación ya existe:** Añade archivos faltantes sin sobreescribir los existentes.

---

### `forge update`

Actualiza los archivos de comandos, agentes y skills sin tocar `.sdd/` ni la configuración.

```bash
forge update
```

Útil cuando hay una nueva versión de FORGE disponible y quieres actualizar los artefactos sin reiniciar el proyecto.

---

### `forge doctor`

Verifica la instalación y reporta el estado de salud.

```bash
forge doctor
```

**Verificaciones:**
1. Variable de entorno `ANTHROPIC_API_KEY` presente
2. Hooks registrados en `.claude/settings.json`
3. Archivos de hook presentes en disco (`.claude/hooks/*.js`)
4. Sintaxis de `sdd.config.yaml` válida
5. Claves obligatorias presentes (`agentes`, `comportamiento`)
6. `memoria.umbral_bytes` es número positivo (si está presente)
7. Modelos declarados son valores válidos
8. `estado.json` presente con `schemaVersion: "1.0"`
9. Versión de Node ≥ 18.0.0
10. Providers detectados (Anthropic siempre, OpenAI/Google si hay env vars)
11. Backend SQLite disponible (si Node ≥ 22.5)
12. Servidor UI: `forge ui` disponible

**Códigos de salida:**
- `0` — todo correcto
- `1` — advertencias (funcional pero mejorable)
- `2` — errores críticos (FORGE no funcionará correctamente)

---

### `forge status`

Muestra el estado del proyecto con presupuesto de sesión y nivel del circuit breaker.

```bash
forge status
```

**Salida ejemplo:**

```
FORGE v4.0.0 — Estado del proyecto

  Pipeline:          implementar (etapa 6/10)
  Spec activa:       2026-06-21-auth-jwt
  Presupuesto:       $0.38 USD gastados esta sesión
  Circuit breaker:   sandbox  (niveles: sandbox → local → confirmado)
  Agentes activos:   6/14
  Tests:             907/907 ✅
```

El campo **Presupuesto** acumula el costo USD de la sesión actual usando `SessionBudget` (lee `consumo.jsonl`). El campo **Circuit breaker** refleja el nivel de ejecución persistido en `.sdd/execution-level.json` — ver [Configuración: circuit_breaker](#sección-circuit_breaker).

---

### `forge logs`

Muestra el historial de consumo de la sesión actual o de sesiones anteriores.

```bash
forge logs [opciones]
```

| Opción | Tipo | Descripción |
|--------|------|-------------|
| `--last <N>` | integer | Muestra las últimas N entradas del log (predeterminado: 20) |

**Fuente de datos:** Lee `.sdd/observabilidad/consumo.jsonl` — el ledger NDJSON que `agent-memory.js` actualiza tras cada llamada a herramienta. Cada línea contiene: `timestamp`, `agente`, `accion`, `tokens_in`, `tokens_out`, `costo_usd`.

**Ejemplo:**

```bash
forge logs --last 5
```

```
2026-06-25T14:32:01Z  arquitecto      write    in=1240 out=890   $0.021
2026-06-25T14:32:45Z  desarrollador-backend  bash  in=320  out=50    $0.004
2026-06-25T14:33:10Z  tester          bash     in=410  out=120   $0.006
2026-06-25T14:33:55Z  revisor         read     in=890  out=340   $0.014
2026-06-25T14:34:20Z  arquitecto      edit     in=560  out=230   $0.010
```

---

### `forge ui`

Inicia el servidor del dashboard de observabilidad.

```bash
forge ui [opciones]
```

| Opción | Tipo | Descripción |
|--------|------|-------------|
| `--port <n>` | integer | Puerto del servidor (predeterminado: 3001) |
| `--no-open` | flag | No abrir el navegador automáticamente |

El servidor se cierra automáticamente tras 30 minutos sin peticiones.

---

### `forge --version`

Imprime la versión instalada de FORGE.

```bash
forge --version
# → 4.0.0
```

---

## ProjectMemory

`ProjectMemory` es la clase TypeScript principal para leer y escribir el estado del proyecto. Vive en `core/project-memory.ts`.

### Constructor

```typescript
import { ProjectMemory } from './core/project-memory.js';

const memory = new ProjectMemory(cwd?: string);
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `cwd` | string \| undefined | Directorio de trabajo. Si se omite, usa `process.cwd()` |

---

### `memory.read()`

Lee y devuelve el estado actual del proyecto.

```typescript
read(): ForgeEstado
```

**Cachéo:** Cachea el resultado intra-proceso basándose en el `mtime` del archivo. Invocaciones sucesivas en el mismo proceso no leen el disco si el archivo no ha cambiado.

**Si `estado.json` no existe:** Devuelve un `ForgeEstado` vacío con `schemaVersion: "1.0"`.

---

### `memory.update(fields)`

Actualiza campos específicos del estado y persiste a disco.

```typescript
update(fields: Partial<ForgeEstado>): ForgeEstado
```

**Comportamiento:** Hace merge superficial — solo los campos especificados en `fields` se actualizan. Los campos no especificados se preservan.

**Ejemplo:**
```typescript
memory.update({
  pipeline_step: 'plan',
  artefactos_sesion: {
    complejidad_estimada: 'medium'
  }
});
```

---

### `memory.validate()`

Valida que el estado actual tiene la estructura correcta.

```typescript
validate(): ValidationResult
```

```typescript
interface ValidationResult {
  valid: boolean;
  errors: string[];  // mensajes de error si valid === false
}
```

---

### `memory.migrate()`

Migra estados de versiones anteriores al esquema actual (`"1.0"`).

```typescript
migrate(): ForgeEstado
```

**Comportamiento:** Si el estado no tiene `schemaVersion` (versión anterior), aplica las transformaciones necesarias y escribe el estado migrado a disco. Si ya tiene `schemaVersion: "1.0"`, devuelve el estado sin cambios.

---

### `memory.saveIR(ir)`

Guarda el IR a `.sdd/ir.json` y actualiza el estado.

```typescript
saveIR(ir: object): string  // devuelve la ruta del archivo guardado
```

---

### `memory.loadIR()`

Carga el IR desde `.sdd/ir.json`.

```typescript
loadIR(): object | null  // null si no existe
```

---

### `memory.saveProductDesign(pd)`

Guarda el ProductDesign a `.sdd/product-design.json`.

```typescript
saveProductDesign(pd: object): string
```

---

### `memory.loadProductDesign()`

Carga el ProductDesign desde `.sdd/product-design.json`.

```typescript
loadProductDesign(): object | null
```

---

### `memory.setPipelineStep(step)`

Actualiza `pipeline_step` en el estado.

```typescript
setPipelineStep(step: ForgeEstado['pipeline_step']): void
```

---

### `memory.getActiveDesignSystem()`

Devuelve la ruta al design system activo del proyecto.

```typescript
getActiveDesignSystem(): string  // ruta relativa a design-systems/
```

---

### `memory.summary()`

Devuelve un resumen legible del estado actual (usado por `/sdd.estado`).

```typescript
summary(): string
```

---

## Tipos TypeScript

### `ForgeEstado`

```typescript
export interface ForgeEstado {
  schemaVersion?: "1.0";

  // Estado del pipeline
  pipeline_step?: 'idea' | 'discovery' | 'ir' | 'design' | 'spec' |
                  'plan' | 'tasks' | 'code' | 'done';

  // Artefactos activos
  spec_activa?: string;
  plan_activo?: string;

  // IR
  ir_generado?: boolean;
  ir_path?: string;

  // ProductDesign
  product_design_generado?: boolean;
  product_design_aprobado?: boolean;
  product_design_path?: string;
  design_direction?: string;
  design_system_path?: string;

  // Spec en borrador
  spec_draft_path?: string;

  // Timestamps
  ultima_actualizacion?: string;

  // Datos de la sesión actual
  artefactos_sesion?: {
    ir_confidence?: number | null;
    stack_decidido?: string | null;
    complejidad_estimada?: 'low' | 'medium' | 'high' | null;
    agentes_activos_ultimo_plan?: string[];
  };

  // Extensible — otros campos son permitidos
  [key: string]: unknown;
}
```

---

### `IR`

```typescript
export interface IR {
  id: string;
  created_at: string;        // ISO 8601
  raw_input: string;
  confidence: number;        // 0.0–1.0; ≥0.7 = listo para proceder

  product: {
    name: string;
    type: 'saas' | 'mobile' | 'web' | 'api' | 'cli' | 'other';
    tagline: string;
    value_proposition: string;
    target_users: string;
  };

  features: {
    core: string[];           // 2–5 items para el MVP
    nice_to_have?: string[];
  };

  constraints: {
    budget?: string;
    timeline?: string;
    team_size?: string;
    tech_preference?: string;
  };

  assumptions: string[];

  ambiguities: Array<{
    field: string;
    question: string;
  }>;

  requires_clarification: boolean;
  questions_for_user?: string[];
}
```

---

### `ProductDesign`

```typescript
export interface Screen {
  id: string;
  name: string;
  priority: 'P0' | 'P1' | 'P2';  // P0 = crítico MVP
  description: string;
  components: string[];
}

export interface ProductDesign {
  id: string;
  created_at: string;
  ir_id: string;

  product: {
    name: string;
    tagline: string;
    value_proposition: string;
  };

  user_flow: string[];           // pasos del flujo principal
  core_screens: Screen[];
  mvp_scope: string[];           // qué está EN el MVP

  design_direction: 'minimal' | 'bold' | 'warm' | 'editorial' | 'brutalist';
  design_system_ref: string;     // ruta al design system

  architecture?: {
    frontend: string;
    backend: string;
    database: string;
    deployment: string;
    rationale: string;
    estimated_complexity: 'low' | 'medium' | 'high';
  };
}
```

---

### `ValidationResult`

```typescript
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
```

---

## Endpoints del servidor UI

El servidor en `localhost:3001` (o el puerto configurado) expone los siguientes endpoints de solo lectura:

### `GET /`

Devuelve el HTML del dashboard.

**Content-Type:** `text/html`

---

### `GET /assets/:ruta`

Devuelve archivos estáticos del dashboard (JS, CSS, imágenes).

**Protección:** Valida path traversal — no se puede acceder a archivos fuera de `ui/`.

---

### `GET /estado`

Devuelve el contenido de `.sdd/estado.json`.

**Content-Type:** `application/json`

**Respuesta:** `ForgeEstado` o `{}` si no existe el archivo.

---

### `GET /tareas`

Devuelve el contenido de `.sdd/especificaciones/{id}/.estado-tareas.json` de la spec activa.

**Content-Type:** `application/json`

**Respuesta:**
```json
{
  "tareas": [
    {
      "id": "T-001",
      "titulo": "string",
      "estado": "completada | en_progreso | pendiente | fallida",
      "agente": "string"
    }
  ]
}
```

**Si no hay spec activa:** `{ "tareas": [] }`

---

### `GET /verificar`

Devuelve el resultado de verificación más reciente.

**Content-Type:** `application/json`

**Respuesta:** Objeto `verificacion.json` o `null`.

---

### `GET /consumo`

Devuelve las últimas 50 líneas de `consumo.jsonl`.

**Content-Type:** `application/json`

**Respuesta:**
```json
[
  {
    "timestamp": "2026-06-21T10:15:00Z",
    "agente": "arquitecto",
    "herramienta": "Write",
    "archivo": "src/auth/jwt.service.ts",
    "provider": "anthropic",
    "effort_level": "high"
  }
]
```

---

### `GET /actividad`

Devuelve las últimas 50 entradas de consumo en formato legible (sin campos internos).

**Content-Type:** `application/json`

---

### `GET /agentes`

Devuelve los agentes que han tenido actividad en los últimos 60 segundos.

**Content-Type:** `application/json`

**Respuesta:**
```json
[
  {
    "nombre": "desarrollador-backend",
    "ultima_actividad": "2026-06-21T10:14:55Z",
    "archivo_reciente": "src/auth/jwt.service.ts"
  }
]
```

---

### `GET /agente/:nombre`

Devuelve el perfil completo y actividad reciente de un agente específico.

**Parámetros:** `:nombre` — nombre del agente (ej: `arquitecto`)

**Content-Type:** `application/json`

**Respuesta:**
```json
{
  "nombre": "arquitecto",
  "activo": true,
  "modelo": "opus",
  "memoria": "contenido de agente-arquitecto.md",
  "actividad_reciente": [...]
}
```

---

## Variables de entorno

| Variable | Componente | Tipo | Descripción |
|----------|-----------|------|-------------|
| `CLAUDE_AGENT_NAME` | agent-memory.js | string | Nombre del agente activo en la sesión actual |
| `OPENAI_API_KEY` | model-registry.js | string | Clave de API de OpenAI. Habilita el proveedor OpenAI |
| `GOOGLE_API_KEY` | model-registry.js | string | Clave de API de Google. Habilita Gemini como proveedor |
| `GEMINI_API_KEY` | model-registry.js | string | Alternativa a `GOOGLE_API_KEY` |
| `FIGMA_PAT` | integración Figma | string | Personal Access Token de Figma |
| `FORGE_UI_PORT` | ui/server.js | integer | Puerto del dashboard (predeterminado: `3001`) |
| `SDD_AUTO` | cli/index.js | `"1"` | Si es `"1"`, salta confirmaciones interactivas |
| `HOME` / `USERPROFILE` | cli/index.js | string | Directorio home del usuario (para `--global`) |

---

## Scripts npm

```bash
npm test              # Ejecuta todos los tests
npm run test:verbose  # Tests con reporter detallado
npm run coverage      # Tests con cobertura experimental
npm run typecheck     # Verificación de tipos TypeScript sin compilar
npm run doctor        # Equivalente a `forge doctor`
```

---

## Constantes exportadas

```typescript
// core/project-memory.ts
export const SCHEMA_VERSION = "1.0" as const;
```

---

## Formato de consumo.jsonl

Cada línea del ledger de observabilidad es un objeto JSON:

```typescript
interface EntradaConsumo {
  timestamp: string;         // ISO 8601
  agente: string;            // nombre del agente
  herramienta: string;       // "Write" | "Edit" | "MultiEdit"
  archivo: string;           // ruta absoluta del archivo afectado
  provider: string;          // "anthropic" | "openai" | "google"
  effort_level: string;      // "low" | "medium" | "high"
  sesion_id?: string;        // ID único de sesión
}
```

---

## Formato de mutaciones.jsonl

```typescript
interface EntradaMutacion {
  timestamp: string;
  agente: string;
  archivo: string;
  tipo: "creacion" | "modificacion";
  hash_anterior?: string;   // SHA-256 del contenido anterior
  hash_nuevo: string;       // SHA-256 del contenido nuevo
}
```
