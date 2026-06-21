---
id: deploy-vercel
nombre: Deploy a Vercel
descripcion: Despliega el proyecto FORGE en Vercel usando el MCP de Vercel. Requiere MCP vercel instalado y autenticado.
aliases: ["/forge.deploy", "/sdd.desplegar vercel"]
version: 1.0.0
requisitos:
  - mcp: vercel
    descripcion: MCP de Vercel instalado y autenticado en Claude Code
---

# Skill: Deploy a Vercel

## Propósito

Automatizar el despliegue del proyecto actual a Vercel cuando el pipeline FORGE ha completado la fase de verificación.

## Requisito previo

Este skill requiere el **MCP de Vercel** instalado en Claude Code. Para verificar:

```bash
forge doctor
# Debe mostrar: "Vercel MCP ✅ disponible"
```

Si no aparece, instala el MCP desde la configuración de Claude Code o ejecuta:
```
/add-mcp vercel
```

## Cuándo usar este skill

- Cuando `pipeline_step = "verificado"` en `.sdd/estado.json`
- Cuando el usuario escribe `/forge.deploy` o pide "despliega en Vercel"
- Al finalizar `sdd.verificar` con resultado exitoso

## Flujo de despliegue

### Paso 1 — Verificar estado del pipeline

```bash
cat .sdd/estado.json | grep pipeline_step
```

Si `pipeline_step` no es `verificado`, advertir:

> ⚠️ El proyecto aún no ha completado la verificación.
> Escribe `/forge verifica` primero para asegurarte de que todo funciona correctamente.
> ¿Quieres desplegar de todas formas? (sí / no)

### Paso 2 — Verificar MCP Vercel disponible

Intentar listar proyectos con el MCP. Si falla, indicar cómo instalar el MCP.

### Paso 3 — Detectar configuración Vercel existente

```bash
ls -la vercel.json 2>/dev/null || echo "SIN_CONFIG"
```

Si no existe `vercel.json`, crear uno básico basado en el tipo de proyecto:

**Para `tipo: api`:**
```json
{
  "version": 2,
  "builds": [{ "src": "*.js", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "/" }]
}
```

**Para `tipo: saas`:**
```json
{
  "version": 2,
  "framework": "nextjs"
}
```

**Para `tipo: cli`:**
> Los proyectos CLI no se despliegan en Vercel. Considera npm publish o GitHub Releases.

### Paso 4 — Desplegar via MCP

Usar la herramienta `deploy_to_vercel` del MCP con los parámetros del proyecto:

- `projectName`: nombre del producto desde `.sdd/ir.json → product.name`
- Rama: `main` por defecto

### Paso 5 — Confirmar y actualizar estado

Tras despliegue exitoso:
1. Registrar la URL en `.sdd/estado.json → deploy_url`
2. Mostrar al usuario:

```
✅ Proyecto desplegado exitosamente

🌐 URL: https://tu-proyecto.vercel.app

Para desplegar de nuevo después de cambios:
  /forge.deploy

Para ver logs en tiempo real:
  forge ui → pestaña Actividad
```

## Manejo de errores

| Error | Respuesta al usuario |
|---|---|
| MCP no disponible | "El MCP de Vercel no está instalado. Ve a Configuración → MCPs en Claude Code." |
| No autenticado | "Necesitas autenticarte en Vercel. El MCP te pedirá que inicies sesión." |
| Build fallida | "El despliegue falló durante la compilación. Mostrando logs..." |
| Límite de plan | "Tu plan de Vercel no permite más despliegues. Revisa tu cuenta en vercel.com." |

## Notas de implementación

- Este skill usa el MCP de Vercel, no la CLI `vercel` directamente
- Si el MCP no está disponible, sugerir usar `vercel deploy --prod` manualmente
- No almacenar tokens de Vercel en el proyecto — el MCP gestiona la autenticación
