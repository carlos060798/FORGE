# Configuración

FORGE se configura mediante el archivo `.sdd/sdd.config.yaml` en la raíz de cada proyecto. Este documento describe todas las secciones, claves y valores posibles.

---

## Estructura general del archivo

```yaml
# .sdd/sdd.config.yaml

idioma: "español"
perfil: "guiado"

agentes:
  # 14 agentes configurables

rutas:
  # rutas de artefactos SDD

comportamiento:
  # comportamiento del pipeline

control_versiones:
  # integración con VCS

calidad:
  # umbrales de calidad

protecciones:
  # archivos y comandos protegidos

figma:
  # integración con Figma

mapeos:
  # indexación de código

memoria:
  # backend de memoria de agentes

sesion:
  # modo de sesión actual

compresion:
  # compresión de tokens
```

---

## Sección: raíz

### `idioma`

Idioma de todos los artefactos generados por FORGE.

```yaml
idioma: "español"    # español | english
```

**Predeterminado:** `"español"`

---

### `perfil`

Modo de interacción principal.

```yaml
perfil: "guiado"    # guiado | experto
```

| Valor | Comportamiento |
|-------|---------------|
| `guiado` | Lenguaje llano, pausas para aprobación, sin jerga técnica |
| `experto` | Detalle técnico completo, menos interrupciones |

**Predeterminado:** `"guiado"` (instalación con `--guided` o `--preset startup`)

---

## Sección: `agentes`

Configura cada uno de los 14 agentes del sistema.

```yaml
agentes:
  arquitecto:
    activo: true
    modelo: opus
    descripcion: "Decisiones técnicas de alto nivel"

  critico:
    activo: true
    modelo: opus

  revisor:
    activo: true
    modelo: opus

  seguridad:
    activo: true
    modelo: opus

  product-designer:
    activo: true
    modelo: opus

  asesor-datos:
    activo: true
    modelo: opus

  desarrollador-backend:
    activo: true
    modelo: sonnet

  desarrollador-frontend:
    activo: true
    modelo: sonnet

  operaciones:
    activo: true
    modelo: sonnet

  tester:
    activo: true
    modelo: sonnet

  disenador-api:
    activo: true
    modelo: sonnet

  architecture-designer:
    activo: true
    modelo: sonnet

  investigador:
    activo: true
    modelo: sonnet

  documentador:
    activo: false      # desactivado por defecto
    modelo: sonnet
```

### Claves por agente

| Clave | Tipo | Descripción |
|-------|------|-------------|
| `activo` | boolean | Si el agente participa en el pipeline |
| `modelo` | string | `opus` \| `sonnet` \| `haiku` |
| `descripcion` | string | Texto libre (informativo) |

### Restricciones

Los agentes `arquitecto`, `critico`, `revisor`, `seguridad`, `asesor-datos` y `product-designer` siempre usan Anthropic como proveedor. El campo `modelo` controla el nivel dentro de Anthropic pero no el proveedor.

---

## Sección: `rutas`

Define dónde FORGE genera sus artefactos.

```yaml
rutas:
  raiz_sdd: ".sdd"
  constitucion: ".sdd/memoria/constitucion.md"
  estado_global: ".sdd/estado.json"
  especificaciones: ".sdd/especificaciones"
  cambios: ".sdd/observabilidad/consumo.jsonl"
  arquitectura: ".sdd/arquitectura"
  dominio: ".sdd/dominio"
  indice: ".sdd/INDICE.md"
  snapshot: ".sdd/SNAPSHOT.md"
```

En la mayoría de proyectos no es necesario cambiar estas rutas. Son útiles cuando el directorio raíz del proyecto no está en la raíz del repositorio (ej. monorepos).

---

## Sección: `comportamiento`

Controla cómo opera el pipeline.

```yaml
comportamiento:
  deteccion_tamano_automatica: true
  ruta_rapida_micro: true
  marcador_clarificacion: "[NECESITA_ACLARACION]"
  numeracion_especificaciones: true
  requerir_aprobacion_plan: true
  requerir_aprobacion_tareas: false
  versionado_constitucion: true
```

| Clave | Tipo | Descripción |
|-------|------|-------------|
| `deteccion_tamano_automatica` | boolean | Detecta si la feature es micro/pequeña/mediana/grande |
| `ruta_rapida_micro` | boolean | Features micro omiten algunos pasos del pipeline |
| `marcador_clarificacion` | string | Texto que se inserta donde falta información |
| `numeracion_especificaciones` | boolean | Numera automáticamente las specs (0001, 0002...) |
| `requerir_aprobacion_plan` | boolean | Pausa para aprobación humana antes de implementar |
| `requerir_aprobacion_tareas` | boolean | Pausa para aprobación de la lista de tareas |
| `versionado_constitucion` | boolean | Guarda versiones históricas de la constitución |

---

## Sección: `control_versiones`

```yaml
control_versiones:
  sistema: "git"
  crear_ramas: true
  hacer_commits: true
```

| Clave | Tipo | Descripción |
|-------|------|-------------|
| `sistema` | string | `git` (único valor soportado actualmente) |
| `crear_ramas` | boolean | Si FORGE puede crear ramas automáticamente |
| `hacer_commits` | boolean | Si FORGE puede hacer commits automáticamente |

---

## Sección: `calidad`

Umbrales que el agente `revisor` aplica durante la verificación.

```yaml
calidad:
  cobertura_tests_minima: 80
  permitir_warnings_lint: false
  permitir_codigo_comentado: false
  longitud_funcion_maxima: 40
  longitud_archivo_maxima: 300
```

| Clave | Tipo | Descripción |
|-------|------|-------------|
| `cobertura_tests_minima` | integer | Porcentaje mínimo de cobertura (0–100) |
| `permitir_warnings_lint` | boolean | Si warnings de linting son aceptables |
| `permitir_codigo_comentado` | boolean | Si se permite código comentado |
| `longitud_funcion_maxima` | integer | Líneas máximas por función |
| `longitud_archivo_maxima` | integer | Líneas máximas por archivo |

**Preset `lean`:**
```yaml
calidad:
  cobertura_tests_minima: 60
  permitir_warnings_lint: true
  longitud_funcion_maxima: 60
```

**Preset `enterprise`:**
```yaml
calidad:
  cobertura_tests_minima: 90
  permitir_warnings_lint: false
  permitir_codigo_comentado: false
  longitud_funcion_maxima: 30
  longitud_archivo_maxima: 200
```

---

## Sección: `protecciones`

Define qué archivos y comandos nunca deben ser modificados por los agentes.

```yaml
protecciones:
  no_tocar_archivos:
    - ".env"
    - ".env.production"
    - "secrets/"
    - "*.pem"
  comandos_prohibidos:
    - "rm -rf"
    - "DROP DATABASE"
    - "git push --force"
  requerir_confirmacion:
    - "npm publish"
    - "terraform apply"
    - "kubectl apply"
  ramas_protegidas:
    - "main"
    - "production"
```

| Clave | Tipo | Descripción |
|-------|------|-------------|
| `no_tocar_archivos` | string[] | Globs de archivos que los agentes no pueden modificar |
| `comandos_prohibidos` | string[] | Comandos que `pre-tool-guard` bloquea adicionalmente |
| `requerir_confirmacion` | string[] | Comandos que requieren confirmación explícita antes de ejecutar |
| `ramas_protegidas` | string[] | Ramas a las que los agentes no pueden hacer push directo |

Los comandos en `comandos_prohibidos` se añaden a los ya bloqueados por defecto en `pre-tool-guard.js`. No se pueden desbloquear los predeterminados desde aquí.

---

## Sección: `figma`

Configura la integración con Figma via MCP.

```yaml
figma:
  enabled: false
  file_key: ""              # ID del archivo Figma (de la URL)
  auto_analizar_sistema_diseño: false
  auto_mapear_si_file_key: false
```

| Clave | Tipo | Descripción |
|-------|------|-------------|
| `enabled` | boolean | Activa la integración Figma |
| `file_key` | string | ID del archivo Figma principal del proyecto |
| `auto_analizar_sistema_diseño` | boolean | Analiza automáticamente el design system de Figma al inicio |
| `auto_mapear_si_file_key` | boolean | Genera mapa de componentes si hay `file_key` definido |

**Requisito:** Variable de entorno `FIGMA_PAT` con un Personal Access Token de Figma.

---

## Sección: `mapeos`

Configura la indexación de código para navegación sin contexto completo.

```yaml
mapeos:
  enabled: true
  modo_actualizacion: "incremental"
  validacion_perezosa: true
  lenguajes:
    - "javascript"
    - "typescript"
  ignorar:
    - "node_modules"
    - "dist"
    - ".next"
    - "build"
```

| Clave | Tipo | Descripción |
|-------|------|-------------|
| `enabled` | boolean | Activa la indexación automática |
| `modo_actualizacion` | string | `incremental` (solo cambios) \| `completo` |
| `validacion_perezosa` | boolean | Solo valida archivos al accederlos, no todos al inicio |
| `lenguajes` | string[] | Lenguajes a indexar |
| `ignorar` | string[] | Directorios a excluir del índice |

---

## Sección: `memoria`

Configura el sistema de memoria persistente de agentes.

```yaml
memoria:
  umbral_bytes: 50000
  backend: "markdown"
  recuperacion_por_defecto: "reciente"
```

| Clave | Tipo | Descripción |
|-------|------|-------------|
| `umbral_bytes` | integer | Tamaño en bytes que dispara la compactación automática |
| `backend` | string | `markdown` \| `sqlite` (requiere Node ≥22.5) |
| `recuperacion_por_defecto` | string | `reciente` \| `relevante` (método de recuperación) |

**Backend `sqlite`:** Requiere Node ≥22.5. Habilita consultas indexadas y búsqueda semántica. No migra automáticamente desde `markdown` — cambiar el backend en un proyecto existente inicia una nueva memoria vacía.

---

## Sección: `sesion`

Configura el modo de la sesión actual.

```yaml
sesion:
  modo: "normal"
  omitir_pasos: []
```

| Clave | Tipo | Descripción |
|-------|------|-------------|
| `modo` | string | `normal` \| `rapido` \| `prototipo` |
| `omitir_pasos` | string[] | Pasos específicos a omitir: `["checklist", "aclarar", "critico"]` |

**Equivalente desde Claude Code:** `/sdd.modo rapido` actualiza `sesion.modo` automáticamente.

| Modo | Qué omite |
|------|-----------|
| `normal` | Nada — flujo completo |
| `rapido` | Agente `critico`, checklist automático |
| `prototipo` | `critico`, `seguridad`, generación de ADRs |

---

## Sección: `compresion`

Configura la compresión de tokens para reducir el costo de las sesiones.

```yaml
compresion:
  enabled: true
  modo_salida_usuario: "normal"
  modo_agentes_internos: "comprimido"
  comprimir_plugin: false
  preservar_terminos:
    - "JWT"
    - "OAuth"
    - "PostgreSQL"
  patrones_protegidos:
    - "criterios de aceptación"
    - "definición de hecho"
```

| Clave | Tipo | Descripción |
|-------|------|-------------|
| `enabled` | boolean | Activa la compresión |
| `modo_salida_usuario` | string | `normal` (legible) \| `comprimido` para mensajes al usuario |
| `modo_agentes_internos` | string | `comprimido` para comunicación interna entre agentes |
| `comprimir_plugin` | boolean | Comprime los comandos y skills al copiarlos |
| `preservar_terminos` | string[] | Términos que nunca se comprimen |
| `patrones_protegidos` | string[] | Frases exactas que no se abrevian |

---

## Presets predefinidos

FORGE incluye tres presets en `presets/`:

### `lean.yaml`

```yaml
perfil: experto
memoria:
  umbral_bytes: 30000
calidad:
  cobertura_tests_minima: 60
  permitir_warnings_lint: true
sesion:
  modo: rapido
compresion:
  enabled: true
  modo_agentes_internos: comprimido
```

Diseñado para proyectos pequeños, prototipos rápidos o cuando el costo de tokens es prioritario.

### `startup.yaml`

```yaml
perfil: guiado
memoria:
  umbral_bytes: 50000
  backend: markdown
calidad:
  cobertura_tests_minima: 80
  permitir_warnings_lint: false
sesion:
  modo: normal
```

Configuración equilibrada para la mayoría de proyectos.

### `enterprise.yaml`

```yaml
perfil: experto
memoria:
  umbral_bytes: 100000
  backend: sqlite
calidad:
  cobertura_tests_minima: 90
  permitir_warnings_lint: false
  permitir_codigo_comentado: false
  longitud_funcion_maxima: 30
  longitud_archivo_maxima: 200
comportamiento:
  requerir_aprobacion_plan: true
  requerir_aprobacion_tareas: true
```

Máximas verificaciones de calidad y aprobaciones humanas explícitas.

---

## Modificar la configuración desde Claude Code

### Ver la configuración actual

```
/sdd.configurar show
/sdd.configurar show agentes
/sdd.configurar show calidad
```

### Modificar un valor

```
/sdd.configurar set calidad.cobertura_tests_minima 90
/sdd.configurar set agentes.desarrollador-backend.modelo opus
/sdd.configurar set sesion.modo rapido
/sdd.configurar set memoria.backend sqlite
```

### Validar la configuración

```bash
forge doctor
```

`forge doctor` verifica:
- Sintaxis YAML válida
- Claves obligatorias presentes (`agentes`, `comportamiento`)
- `memoria.umbral_bytes` es un número positivo
- Los modelos declarados son valores válidos (`opus`, `sonnet`, `haiku`)
- Los hooks están registrados en `.claude/settings.json`
- `estado.json` presente y con `schemaVersion: "1.0"`
