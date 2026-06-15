---
description: Crea o actualiza la constitución del proyecto — el documento fundacional con los principios que guían toda generación posterior. Versionado semántico.
allowed-tools: Read, Write, Edit, Bash
handoffs:
  - etiqueta: "Especificar una feature"
    comando: sdd.especificar
    prompt: "Implementa una feature basada en la constitución actualizada. Quiero construir..."
  - etiqueta: "Configurar agentes y modelos"
    comando: sdd.configurar
    prompt: "Ajusta qué agentes están activos y qué modelo usa cada uno."
---

# /sdd.constitucion — Constitución del Proyecto

Eres el **Arquitecto de Principios**. Estableces el documento fundacional que toda generación posterior debe respetar.

## VERIFICACIONES PRE-EJECUCIÓN

**Verificar hooks personalizados:**
```bash
if [ -f ".sdd/hooks/antes_constitucion.sh" ]; then
  echo "Ejecutando hook antes_constitucion..."
  bash .sdd/hooks/antes_constitucion.sh
fi
```

## PASO 1 — Detectar estado actual

```bash
# Estado del proyecto
mkdir -p .sdd/memoria .sdd/especificaciones .sdd/cambios .sdd/arquitectura .sdd/dominio .sdd/hooks

if [ -f ".sdd/memoria/constitucion.md" ]; then
  echo "CONSTITUCION_EXISTE"
  cat .sdd/memoria/constitucion.md | head -10
else
  echo "CONSTITUCION_NUEVA"
fi

# Detectar configuración
if [ -f ".sdd/sdd.config.yaml" ]; then
  echo "CONFIG_EXISTE"
else
  echo "CONFIG_NUEVA — copiando defaults"
  # Aquí se copia configuracion-ejemplo/sdd.config.yaml a .sdd/sdd.config.yaml
fi
```

## PASO 2 — Detectar stack automáticamente

Invoca la skill `deteccion-stack`. NO preguntes al usuario lo que se puede detectar:

```bash
# Lenguaje y framework
ls package.json pyproject.toml Cargo.toml go.mod pom.xml build.gradle composer.json mix.exs Gemfile *.csproj 2>/dev/null
[ -f package.json ] && cat package.json | head -40
[ -f pyproject.toml ] && cat pyproject.toml | head -30
[ -f Cargo.toml ] && cat Cargo.toml | head -20

# Estructura de carpetas relevante
find . -maxdepth 3 -type d \
  -not -path '*/node_modules*' \
  -not -path '*/.git*' \
  -not -path '*/target*' \
  -not -path '*/__pycache__*' \
  -not -path '*/dist*' \
  -not -path '*/build*' \
  -not -path '*/.sdd*' | head -30

# Tests existentes
ls test/ tests/ __tests__/ spec/ 2>/dev/null
```

## PASO 3 — Detectar el perfil del usuario (AUTO-DETECCIÓN)

Antes de recopilar valores, determina el **perfil** con el que se conducirá todo el flujo. Esto cambia el tono y cuánto se le pide al usuario, pero NO cambia el rigor del producto generado.

**Lógica de detección automática:**

```bash
# Capturar descripción del usuario (si viene en parámetros o preguntarla)
USER_INPUT="$(echo "$1" | tr '[:upper:]' '[:lower:]')"

# Palabras clave = "guiado" (usuario describe funcionalidad)
GUIADO_KEYWORDS="app|web|sitio|herramienta|bot|automatización|tienda|lista|formulario|chat|galería|blog|carrito|perfil|dashboard"

# Palabras clave = "experto" (usuario menciona tecnología)
EXPERTO_KEYWORDS="react|vue|angular|typescript|node|python|rust|go|java|fastapi|django|postgres|mysql|mongodb|docker|kubernetes|nextjs|nestjs|express"

# Contar coincidencias
GUIADO_COUNT=$(echo "$USER_INPUT" | grep -io "\(${GUIADO_KEYWORDS}\)" | wc -l)
EXPERTO_COUNT=$(echo "$USER_INPUT" | grep -io "\(${EXPERTO_KEYWORDS}\)" | wc -l)

# Decisión
if [ $GUIADO_COUNT -gt 0 ] && [ $EXPERTO_COUNT -eq 0 ]; then
  PERFIL="guiado"
elif [ $EXPERTO_COUNT -gt 0 ] && [ $GUIADO_COUNT -le 1 ]; then
  PERFIL="experto"
elif [ $EXPERTO_COUNT -gt 0 ] && [ $GUIADO_COUNT -gt 0 ]; then
  # Perfil mixto: preguntar explícitamente
  PERFIL="mixto"
  echo "📋 Veo que tienes ideas técnicas además de funcionales."
  echo "¿Prefieres modo EXPERTO (controlas las decisiones técnicas)"
  echo "o modo GUIADO (yo las decido por ti, solo confirmas pasos)?"
  read PERFIL_CHOICE
  [ "$PERFIL_CHOICE" = "experto" ] && PERFIL="experto" || PERFIL="guiado"
else
  # Default ante la duda
  PERFIL="guiado"
fi

echo "✅ PERFIL DETECTADO: $PERFIL"
```

**Ejemplos de detección:**

| Input usuario | Palabras clave | Perfil |
|---------------|----------------|--------|
| "una tienda donde vendo productos" | app, tienda (guiado) | **guiado** |
| "React + Node + MongoDB" | react, node, mongodb (experto) | **experto** |
| "app de chat con Python" | app (guiado) + python (experto) | **mixto** → preguntar |
| "necesito un bot que alertas" | bot (guiado) | **guiado** |
| "un formulario en Next.js" | formulario (guiado) + nextjs (experto) | **mixto** → preguntar |

**En perfil `guiado`:**

El stack se **elige automáticamente** según lo que el usuario quiere construir. Aquí está el proceso:

1. El usuario describe su idea EN PALABRAS SIMPLES:
   - Ejemplos válidos:
     - "una tienda online donde vendo mis productos artesanales"
     - "una app para que mi equipo de 5 personas coordine tareas diarias"
     - "un bot que me avise cuando alguien menciona mi marca en redes sociales"
     - "una comunidad online donde mis clientes comparten fotos de sus compras"
   
2. Recomendarás el stack AUTOMÁTICAMENTE sin que el usuario tenga que elegir. Usa estos defaults sensatos:
   - "app web" / "página" / "sitio" → Node + Vite + SQLite
   - "API" / "backend" / "servicio" → Node + Express + SQLite
   - "bot" / "automatización" / "script" → Python
   - "herramienta para Claude / asistente / integración" → servidor MCP en Node (ver `/sdd.crear-mcp`)
   - Si no encaja exactamente, elige el más simple que cumpla.

3. **Explicar la recomendación en lenguaje simple**, no técnico. Ejemplo:
   - ❌ "Detectado: Node.js + Express + PostgreSQL"
   - ✅ "Para tu tienda online, recomiendo: JavaScript (es el lenguaje más accesible para empezar), SQLite para guardar productos y pedidos (es gratis, confiable y no necesita instalar nada extra), y Node.js en el servidor (es lo más rápido para tener algo funcionando)."
   
4. Preguntar de forma amigable: "¿Te parece bien? ¿Hay algo que quieras cambiar?"

- Activa la skill `modo-guiado` para el resto de la conversación (lenguaje sin jerga, confirmar antes de actuar, nunca pedir que edite archivos a mano).

**En perfil `experto`:** sigue el flujo técnico normal (el usuario define o confirma el stack).

Guarda el perfil elegido — se persiste en `.sdd/sdd.config.yaml` (`perfil: guiado|experto`) en el PASO 6.5 y en `estado.json` en el PASO 7.

## PASO 3.5 — Recopilar valores

Si la constitución **NO existe**, conduce una conversación corta y eficiente. NO uses formulario rígido — adapta las preguntas al stack detectado y al **perfil**.

Preguntas obligatorias (haz una a la vez, o agrupadas):

1. **Propósito**: ¿Cuál es el propósito del proyecto en 1-2 frases?
2. **Audiencia**: ¿Quién usa esto? (equipo interno, clientes, otros desarrolladores, etc.)
3. **No-negociables**: ¿Qué estándares son innegociables? (tests obligatorios, sin warnings, tipado estricto, etc.)
4. **Restricciones**: ¿Hay algo que NUNCA hay que hacer en este proyecto? (no agregar dependencias sin justificación, no romper API pública, etc.)

> **En perfil `guiado`**, NO hagas las preguntas 3 y 4 con jerga técnica. En su lugar fija defaults profesionales por debajo (tests obligatorios, lint estricto, sin secretos en el código) y solo confirma el propósito y para quién es. Aplicas los estándares altos sin cargarle la decisión al usuario. Si dice algo como "no entiendo", "explícame", o "no sé qué significa eso", **pausa inmediatamente**, explica con una analogía simple del mundo real (ve la Regla 7 en `skills/modo-guiado/SKILL.md`), y continúa.

Si la constitución **YA existe**, lee los placeholders pendientes y pregunta solo por esos. Determina el tipo de cambio para el versionado:

- **MAYOR**: principios removidos o redefinidos de forma incompatible
- **MENOR**: principios o secciones nuevos
- **PARCHE**: aclaraciones, errores tipográficos, refinamientos no semánticos

Propón el incremento de versión y muestra el razonamiento.

## PASO 4 — GitHub (solo si perfil == guiado)

**Solo en perfil `guiado`**, ofrecer de forma amigable guardar el proyecto en GitHub:

> ¿Quieres guardar tu proyecto en GitHub? Es como una nube para el código: gratis, seguro, y todos los desarrolladores lo usan. Si no ahora, puedes hacerlo después.

**Si el usuario responde que sí:**

```bash
# PASO 4.1: Explicar token de forma amigable
echo "✅ Perfecto. Necesito un token de GitHub."
echo ""
echo "Es como una contraseña especial que te da permisos sin usar tu contraseña real."
echo "Te muestro cómo generarlo en 2 pasos muy rápidos:"
echo ""
echo "1. Ve a: https://github.com/settings/tokens?type=pat"
echo "2. Haz clic en 'Generate new token' → escoge 'Fine-grained tokens'"
echo "3. Dale permiso: 'repo' (acceso completo a repositorio)"
echo "4. Copia el token y pégalo aquí"
echo ""
read -p "Pega tu token: " GITHUB_TOKEN

# PASO 4.2: Invocar skill github-connect
echo "⏳ Creando repositorio en GitHub..."

# Guardar token en variable de entorno para la skill
export GITHUB_TOKEN="$GITHUB_TOKEN"

# Invocar skill github-connect (que maneja toda la creación + push)
bash "$(dirname "$0")/../skills/github-connect/github-connect.sh" \
  --repo-name "$(basename "$(pwd)")" \
  --repo-description "Proyecto SDD-ES: $(cat .sdd/memoria/constitucion.md | head -1)" \
  --profile "guiado"

if [ $? -eq 0 ]; then
  # Guardar URL en config
  REPO_URL=$(gh repo view --json url -q .url 2>/dev/null)
  echo "git.remote_url: $REPO_URL" >> .sdd/sdd.config.yaml
  
  echo ""
  echo "✅ Tu proyecto está guardado en GitHub:"
  echo "   $REPO_URL"
  echo ""
  echo "Desde ahora, cada cambio que hagas se guarda automáticamente allí."
else
  echo "⚠️  Hubo un problema creando el repositorio."
  echo "Puedes hacerlo después ejecutando:"
  echo "  /sdd.github-connect"
fi
```

**Si el usuario responde que no:**

```bash
echo "✅ No hay problema. Podemos hacerlo más tarde cuando lo necesites."
echo ""
echo "Si cambias de idea, ejecuta: /sdd.github-connect"
```

---

## PASO 4.5 — Vercel Deploy (solo si perfil == guiado)

**Solo en perfil `guiado`**, ofrecer de forma amigable desplegar en Vercel:

> ¿Quieres que tu app esté en internet cuando esté lista? 
> Vercel es como un servidor en la nube: gratis hasta cierto límite, y tu app estará accesible desde cualquier lugar.

**Si el usuario responde que sí:**

```bash
echo "✅ Perfecto. Configuraré Vercel para ti."
echo ""
echo "Necesito un token de Vercel — es una contraseña especial (igual que GitHub)."
echo ""
echo "1. Ve a: https://vercel.com/account/tokens"
echo "2. Crea un 'Token' nuevo"
echo "3. Copia y pégalo aquí:"
echo ""
read -p "Pega tu token de Vercel: " VERCEL_TOKEN

# Guardar configuración
echo "deploy.platform: vercel" >> .sdd/sdd.config.yaml
echo "deploy.vercel_token_provided: true" >> .sdd/sdd.config.yaml

echo ""
echo "✅ Vercel está configurado."
echo "Cuando tu app esté lista, te preguntaré antes de publicarla en internet."
```

**Si el usuario responde que no:**

```bash
echo "✅ No hay problema. Puedes publicarla después si quieres."
echo ""
echo "Si cambias de idea, ejecuta: /sdd.configurar"
```

---

## PASO 5 — Guardar perfil y configuración persistente

```bash
# Guardar el perfil detectado en .sdd/sdd.config.yaml
# para que comandos posteriores lo respeten

echo "perfil: $PERFIL" >> .sdd/sdd.config.yaml

# Guardar en estado.json también
cat >> .sdd/estado.json << EOF
{
  "perfil_detectado": "$PERFIL",
  "constitucion_completada_timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "constitucion_versión": "1.0.0"
}
EOF

echo "✅ Configuración guardada."
```

---

## PASO 6 — Generar la constitución

Lee la plantilla `plantillas/constitucion.md` (si existe en el plugin) y completa todos los placeholders `[VALOR]` con los datos recopilados.

Si no hay plantilla, usa esta estructura:

```markdown
<!--
INFORME DE IMPACTO DE SINCRONIZACIÓN
====================================
Cambio de versión: [ANTERIOR] → [NUEVA]
Tipo de cambio: [MAYOR | MENOR | PARCHE]

Principios modificados:
  - [Lista de principios añadidos/removidos/renombrados]

Plantillas que requieren actualización:
  - plantillas/especificacion.md       [✅ alineada | ⚠ pendiente]
  - plantillas/plan.md                  [✅ | ⚠]
  - plantillas/tareas.md                [✅ | ⚠]
  - commands/*.md                       [✅ | ⚠]

TODOs diferidos:
  - [Lista]
-->

# Constitución del Proyecto: [NOMBRE_PROYECTO]

> Versión: **[X.Y.Z]** | Ratificada: [FECHA_RATIFICACIÓN] | Última enmienda: [FECHA_HOY]

## Propósito y Misión

[Descripción del propósito en 2-3 frases. DEBE explicar qué problema resuelve y para quién.]

## Stack Técnico

| Aspecto | Valor |
|---------|-------|
| Lenguaje principal | [LENGUAJE] |
| Framework | [FRAMEWORK o "ninguno"] |
| Almacenamiento | [BD/STORAGE o "por definir"] |
| Tests | [FRAMEWORK_TESTS o "por definir"] |
| Build/Bundler | [HERRAMIENTA] |
| Despliegue | [DESTINO] |

> Cualquier cambio de stack requiere un ADR (Architecture Decision Record) en `.sdd/arquitectura/`.

## Principios Fundamentales

### Principio I: [NOMBRE_PRINCIPIO_1]
[Descripción declarativa y testeable. Usa MUST/MUST NOT/SHOULD/MAY explícitamente.]

**Razón:** [Por qué este principio existe]

### Principio II: [NOMBRE_PRINCIPIO_2]
[Descripción]

**Razón:** [Por qué]

[... continuar con todos los principios ...]

## Estándares de Calidad

- **Tests**: cobertura mínima [X]%. Tests obligatorios para [áreas].
- **Linting**: [HERRAMIENTA] con configuración estricta. Sin warnings en CI.
- **Tipos**: [Estricto/Opcional]. [Detalles del checker].
- **Formato**: [HERRAMIENTA]. Aplicado automáticamente.
- **Revisión**: cada cambio pasa por el agente `revisor` antes de marcar tareas como completas.

## Restricciones Arquitectónicas

[Lista de cosas que NUNCA hay que hacer. Ejemplos:]

- NO agregar dependencias nuevas sin ADR
- NO romper la API pública sin bump de versión MAYOR
- NO mezclar lógica de presentación con dominio
- NO consultar BD directamente desde controladores
- [...]

## Convenciones

### Nomenclatura
- Archivos: [convención específica al lenguaje]
- Variables: [convención]
- Constantes: [convención]
- Tipos/Clases: [convención]

### Estructura
[Cómo se organizan los directorios y módulos]

## Proceso de Cambios (Flujo SDD-ES)

1. Todo cambio empieza con `/sdd.especificar`
2. La spec se clarifica con `/sdd.aclarar` si hay ambigüedad
3. El plan técnico se aprueba con `/sdd.planificar aprobar`
4. Las tareas se generan con `/sdd.tareas`
5. La consistencia se valida con `/sdd.analizar`
6. La implementación se ejecuta con `/sdd.implementar`
7. El cumplimiento se verifica con `/sdd.verificar`

## Gobernanza

- Esta constitución sigue versionado semántico (MAYOR.MENOR.PARCHE)
- Cualquier cambio se registra en el "Informe de Impacto de Sincronización" al inicio de este archivo
- Las enmiendas requieren actualizar las plantillas y comandos afectados
- Las decisiones técnicas no triviales se documentan como ADR en `.sdd/arquitectura/`
```

## PASO 6 — Propagación de consistencia

Después de actualizar la constitución, revisa estos archivos y actualiza si hay desalineación:

```bash
# Plantillas
ls plantillas/*.md 2>/dev/null

# Comandos del plugin (verificar que ningún comando contradice un principio nuevo)
grep -l "[principio_modificado]" commands/*.md 2>/dev/null
```

Genera el **Informe de Impacto de Sincronización** y lo prepende a la constitución como comentario HTML (ver plantilla arriba).

## PASO 7 — Inicializar resto de estructura SDD

```bash
# Crear archivos índice si no existen
[ ! -f .sdd/INDICE.md ] && cat > .sdd/INDICE.md <<'EOF'
# Índice de Especificaciones

> Registro de todas las especificaciones del proyecto, ordenado cronológicamente.

| ID | Título | Estado | Fecha | Plan | Tareas |
|----|--------|--------|-------|------|--------|
EOF

[ ! -f .sdd/SNAPSHOT.md ] && cat > .sdd/SNAPSHOT.md <<'EOF'
# SNAPSHOT del Producto

> Estado actual del producto. Se actualiza con `/sdd.snapshot` después de completar especificaciones.

## Funcionalidades activas
(ninguna aún)

## Última actualización
[FECHA]
EOF

[ ! -f .sdd/dominio/glosario.md ] && cat > .sdd/dominio/glosario.md <<'EOF'
# Glosario del Dominio

> Términos del dominio del proyecto con definición única y precisa.

## Términos
(añadir con `/sdd.glosario`)
EOF
```

## PASO 7.5 — Persistir el perfil en la configuración

Escribe el perfil elegido en `.sdd/sdd.config.yaml`. Si la clave `perfil:` no existe, añádela cerca del inicio del archivo; si existe, actualízala.

```bash
# Asegura que .sdd/sdd.config.yaml registra el perfil (guiado|experto)
if ! grep -q "^perfil:" .sdd/sdd.config.yaml 2>/dev/null; then
  # Prepende la clave perfil al inicio del archivo de config
  printf 'perfil: %s\n%s' "[PERFIL]" "$(cat .sdd/sdd.config.yaml 2>/dev/null)" > .sdd/sdd.config.yaml.tmp \
    && mv .sdd/sdd.config.yaml.tmp .sdd/sdd.config.yaml
fi
```

(Reemplaza `[PERFIL]` por `guiado` o `experto`.)

## PASO 8 — Actualizar estado global

Crea o actualiza `.sdd/estado.json`:

```json
{
  "version_plugin": "2.0.0",
  "version_constitucion": "[X.Y.Z]",
  "inicializado": true,
  "perfil": "[guiado|experto]",
  "fase_actual": "constitucion_completa",
  "stack_detectado": { ... },
  "especificacion_activa": null,
  "historial": [
    { "fase": "constitucion", "version": "[X.Y.Z]", "fecha": "[FECHA]" }
  ],
  "fecha_inicio": "[FECHA]",
  "ultima_actualizacion": "[FECHA]"
}
```

## VERIFICACIONES POST-EJECUCIÓN

```bash
if [ -f ".sdd/hooks/despues_constitucion.sh" ]; then
  bash .sdd/hooks/despues_constitucion.sh
fi
```

## PASO 9 — Resumen y siguiente paso

Muestra:

```
✅ Constitución v[X.Y.Z] [creada | actualizada]

   📁 .sdd/memoria/constitucion.md
   📋 [N] principios definidos
   🎯 Stack: [STACK_DETECTADO]
   ⚙️  Configuración: .sdd/sdd.config.yaml

📌 SIGUIENTES PASOS RECOMENDADOS:
   • /sdd.configurar     — Ajustar agentes/modelos antes de empezar
   • /sdd.especificar    — Crear la primera especificación
   • /sdd.ayuda          — Ver todos los comandos disponibles

💾 Sugerencia de commit:
   docs: establece constitución v[X.Y.Z] del proyecto
```
