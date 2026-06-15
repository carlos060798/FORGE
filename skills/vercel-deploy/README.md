# Skill: vercel-deploy

Despliegue automático en Vercel con pre-checks, health checks y rollback automático.

## Uso rápido

```bash
# Generar VERCEL_TOKEN
export VERCEL_TOKEN="xxx_your_token_xxx"

# Desplegar (automáticamente en /sdd.implementar)
/sdd.desplegar
```

## Flujo

1. **Pre-checks**: Validar VERCEL_TOKEN, rama limpia, sin secretos, tests verdes
2. **vercel.json**: Auto-generar si no existe (detecta framework automáticamente)
3. **Build & Deploy**: Compilar localmente y enviar a Vercel
4. **Health Check**: Verificar que la URL responde HTTP 200 (3 reintentos con backoff)
5. **Rollback**: Revertir a deploy anterior si health check falla
6. **Log**: Guardar metadatos en `.sdd/estado.json` para auditoría

## Obtener VERCEL_TOKEN

1. Ve a https://vercel.com/account/tokens
2. Crea un nuevo token con scope **full**
3. Guárdalo en el entorno:
   ```bash
   export VERCEL_TOKEN="vercel_xxx_..."
   ```
   O en `.env.local`:
   ```
   VERCEL_TOKEN=vercel_xxx_...
   ```

## Errores comunes

| Error | Solución |
|-------|----------|
| VERCEL_TOKEN ausente | Ejecutar `export VERCEL_TOKEN="..."` |
| Tests fallando | Ejecutar `/sdd.implementar` nuevamente |
| Health check fallando | Revisar logs de Vercel; revisar env vars |
| Cambios sin stagear | Ejecutar `git add . && git commit` |

## Próximos pasos post-deploy

- Compartir URL con testers: https://mi-proyecto.vercel.app
- Monitorear anomalías (15 minutos)
- Ejecutar `/sdd.snapshot` para actualizar estado del producto
- Si hay issues: `/sdd.revertir` para rollback manual

## Invocación

**Automática**: PASO final de `/sdd.implementar` (con confirmación humana)

**Manual**: 
```bash
/sdd.desplegar
/sdd.desplegar --environment staging
```

---

Para detalles completos del flujo de 6 pasos, ver [SKILL.md](./SKILL.md).
