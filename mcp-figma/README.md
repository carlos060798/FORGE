# sdd-figma-mcp

MCP server local para integración de Figma con proyectos que usan SDD-ES. Lo usa el agente `desarrollador-frontend` para analizar el sistema de diseño del proyecto, traer componentes de Figma y generar código adaptado — sin romper lo que ya existe.

## Qué hace

| Herramienta | Qué resuelve |
|---|---|
| `analizar_sistema_diseño` | Lee tokens, colores, tipografía y componentes del proyecto local |
| `evaluar_ui_existente` | Score 0-100 + problemas + sugerencias de mejora |
| `conectar_figma` | Verifica PAT y metadata del archivo |
| `listar_componentes` | Lista componentes publicados en el archivo Figma |
| `traer_componente` | Detalle completo de un nodo: estructura, fills, texto, dimensiones |
| `mapear_estilos` | Cruza colores/tipografía de Figma con tokens del proyecto |
| `generar_componente` | Código React/Vue adaptado al sistema de diseño local |
| `sugerir_mejoras` | Lista priorizada de mejoras al design system |

## Instalación

### 1. Sin dependencias — listo para ejecutar

No hay `npm install`. El servidor usa exclusivamente módulos built-in de Node.js (`readline`, `fs`, `path`) y `fetch` nativo (disponible desde Node 18). El `package.json` es solo un descriptor — no instala nada.

### 2. Obtener el Personal Access Token de Figma

1. Abre Figma → Menú de usuario (esquina superior derecha) → **Settings**
2. Pestaña **Security** → **Personal access tokens** → **Generate new token**
3. Dale un nombre (ej. `sdd-figma-mcp`) y copia el token

### 3. Definir FIGMA_PAT como variable de entorno del sistema

El MCP lee el token desde `process.env.FIGMA_PAT` — **no está hardcodeado en ningún archivo de configuración** para evitar que quede en el repositorio.

Claude Code hereda las variables de entorno de la sesión donde se lanza, así que basta con definirla una vez en el sistema:

**Windows (PowerShell, permanente para el usuario):**
```powershell
[System.Environment]::SetEnvironmentVariable("FIGMA_PAT", "tu-token-aqui", "User")
# Cierra y vuelve a abrir la terminal para que tome efecto
```

**Windows (solo sesión actual):**
```powershell
$env:FIGMA_PAT = "tu-token-aqui"
```

**macOS / Linux (permanente):**
```bash
echo 'export FIGMA_PAT="tu-token-aqui"' >> ~/.zshrc   # o ~/.bashrc
source ~/.zshrc
```

> Si el proyecto tiene un `.env` que Claude Code carga automáticamente, también puedes agregar `FIGMA_PAT=tu-token` ahí — el proceso Node lo hereda igual.

### 4. Registrar el MCP en Claude Code

Agrega esto a tu `.claude/settings.json` (o `~/.claude/settings.json` para uso global):

```json
{
  "mcpServers": {
    "sdd-figma": {
      "command": "node",
      "args": ["/ruta/absoluta/al/sdd-lite/mcp-figma/src/index.js"]
    }
  }
}
```

No hay campo `env` — el servidor hereda `FIGMA_PAT` directamente del entorno del sistema (paso 3). Así el token nunca queda registrado en ningún archivo de configuración del repositorio.

> Reemplaza `/ruta/absoluta/al/sdd-lite` con la ruta real donde instalaste SDD-ES.
> En Windows usa barras invertidas dobles: `"c:\\\\Users\\\\usuario\\\\sdd-lite\\\\mcp-figma\\\\src\\\\index.js"`

### 5. Verificar

Reinicia Claude Code y ejecuta en cualquier proyecto frontend:

```
analizar_sistema_diseño({ project_root: "." })
```

Deberías ver el perfil del sistema de diseño del proyecto.

## Cómo encontrar el file_key de Figma

La URL de Figma tiene este formato:

```
https://www.figma.com/file/ABCDEF123456/nombre-del-archivo?node-id=0:1
                           ^^^^^^^^^^^^
                           este es el file_key
```

## Cómo encontrar el node_id

1. Selecciona el frame o componente en Figma
2. La URL cambia a: `?node-id=123:456`
3. Ese valor (`123:456` o en formato `123-456`) es el `node_id`

## Flujo típico de uso

```
# 1. Analiza lo que ya tiene el proyecto
analizar_sistema_diseño({ project_root: "/mi/proyecto" })

# 2. Conecta con el archivo de Figma
conectar_figma({ file_key: "ABCDEF123456" })

# 3. Lista los componentes disponibles
listar_componentes({ file_key: "ABCDEF123456", filter: "Button" })

# 4. Trae el componente que quieres implementar
traer_componente({ file_key: "ABCDEF123456", node_id: "123:456" })

# 5. Verifica que los estilos tienen equivalente en el proyecto
mapear_estilos({ file_key: "ABCDEF123456", node_id: "123:456", project_root: "/mi/proyecto" })

# 6. Genera el código adaptado
generar_componente({ file_key: "ABCDEF123456", node_id: "123:456", project_root: "/mi/proyecto" })
```

## Stacks soportados

| Framework | CSS | Estado |
|---|---|---|
| React / Next.js | Tailwind CSS | ✅ Completo |
| React / Next.js | CSS Modules | ✅ Completo |
| Vue 3 | Tailwind / Scoped CSS | ✅ Completo |
| React / Next.js | styled-components | ⚠️ Parcial (genera CSS Module) |
| Angular | Cualquiera | ⚠️ Genera React, ajusta manualmente |
| Svelte | Cualquiera | 🔜 En roadmap |

## Variables de entorno

| Variable | Requerida | Descripción |
|---|---|---|
| `FIGMA_PAT` | Sí | Personal Access Token de Figma |

## Estructura del proyecto

```
mcp-figma/
├── src/
│   ├── index.js                  ← Servidor MCP + definición de tools
│   ├── mcp.js                    ← Protocolo JSON-RPC 2.0 sobre stdio (sin deps)
│   ├── figma-client.js           ← Cliente HTTP de la API de Figma
│   ├── design-system-analyzer.js ← Análisis del sistema de diseño local
│   ├── style-mapper.js           ← Mapeo de estilos Figma ↔ tokens locales
│   └── component-generator.js   ← Generación de código por framework
└── package.json                  ← Cero dependencias — solo descriptor
```

## Limitaciones conocidas

- La detección de tokens en Tailwind usa análisis estático de texto (no ejecuta el módulo), por lo que configs muy dinámicas pueden no detectarse completamente
- La generación de componentes es un punto de partida — siempre revisa accesibilidad, props faltantes y manejo de estado
- La API de Figma Variables (tokens del sistema de diseño de Figma) requiere plan Professional o superior
