# MANIFEST: Skill vercel-deploy

**Despliegue automático en Vercel con 6 pasos atómicos, health checks y rollback automático.**

Versión: 1.0.0  
Fecha: 2026-06-13  
Estado: ✅ Listo para usar

---

## 📦 Contenido del paquete

### Documentación (6 archivos)

| Archivo | Tipo | Tamaño | Propósito |
|---------|------|--------|----------|
| **SKILL.md** | Especificación | ~10 KB | Documento maestro: flujo de 6 pasos con código ejecutable |
| **README.md** | Quick start | ~2 KB | Guía rápida para empezar inmediatamente |
| **CHECKLIST.md** | Pre-requisitos | ~5 KB | 8 secciones de validación antes de desplegar |
| **INTEGRATION.md** | Integración | ~8 KB | Cómo conectar con `/sdd.implementar` |
| **INDEX.md** | Navegación | ~6 KB | Mapa de documentos y rutas de lectura |
| **FLOW.txt** | Diagrama visual | ~15 KB | Flujo visual ASCII de toda la ejecución |

### Ejecutables (1 archivo)

| Archivo | Tipo | Tamaño | Propósito |
|---------|------|--------|----------|
| **deploy.sh** | Script Bash | ~8 KB | Implementación funcional de los 6 pasos |

### Configuración (2 archivos)

| Archivo | Tipo | Tamaño | Propósito |
|---------|------|--------|----------|
| **skill.yaml** | Metadata YAML | ~10 KB | Metadatos del skill para registración en SDD |
| **estado.json.example** | Ejemplo JSON | ~15 KB | Ejemplo de salida: `.sdd/estado.json` generado |

### Navegación (1 archivo)

| Archivo | Tipo | Propósito |
|---------|------|----------|
| **MANIFEST.md** | Resumen | Este archivo: índice de contenidos |

---

## 🚀 Inicio rápido

### 1. Verificar requisitos (1 min)
```bash
cd c:\Users\usuario\sdd-lite\sdd-lite\skills\vercel-deploy
grep -l "VERCEL_TOKEN\|npm\|git\|curl" README.md
```

### 2. Leer documentación (5-10 min)
```bash
# Empezar con el README
cat README.md

# Luego revisar el checklist
cat CHECKLIST.md
```

### 3. Configurar VERCEL_TOKEN (2 min)
```bash
export VERCEL_TOKEN="vercel_xxx_abc123..."
# O persistente:
echo 'VERCEL_TOKEN=vercel_xxx_abc123...' >> .env.local
```

### 4. Ejecutar el skill (3-4 min)
```bash
# Opción A: Script directo
bash ./skills/vercel-deploy/deploy.sh

# Opción B: Integrado en /sdd.desplegar
/sdd.desplegar
```

---

## 📖 Rutas de lectura según tu perfil

### "Quiero desplegar YA" (10 min total)
1. [README.md](./README.md) — Setup y commands
2. [CHECKLIST.md](./CHECKLIST.md) — Validar prerequisites
3. Ejecutar: `bash deploy.sh`

### "Soy arquitecto/DevOps" (30 min total)
1. [SKILL.md](./SKILL.md) — Especificación completa
2. [deploy.sh](./deploy.sh) — Revisión de código
3. [skill.yaml](./skill.yaml) — Metadata y configuración
4. [FLOW.txt](./FLOW.txt) — Diagrama de flujo

### "Voy a integrar en /sdd.implementar" (25 min total)
1. [INTEGRATION.md](./INTEGRATION.md) — Cómo conectar
2. [CHECKLIST.md](./CHECKLIST.md) — Qué validar
3. [skill.yaml](./skill.yaml) — Configuración YAML
4. [SKILL.md](./SKILL.md) — Detalles completos

### "Solo necesito un diagrama visual" (5 min)
1. [FLOW.txt](./FLOW.txt) — Flujo completo
2. [INDEX.md](./INDEX.md) — Relaciones entre documentos

---

## 🎯 Características principales

✅ **Flujo atómico** — 6 pasos secuenciales bloqueantes  
✅ **Pre-checks** — Valida VERCEL_TOKEN, rama limpia, sin secretos, tests verdes  
✅ **Auto-configuración** — Detecta framework (next, react, vue, astro, python)  
✅ **Health checks** — 3 reintentos automáticos con backoff exponencial  
✅ **Rollback automático** — Revertir a deploy anterior si falla health check  
✅ **Observabilidad** — `.sdd/estado.json` con metadatos completos  
✅ **Seguridad** — Detección de secretos, VERCEL_TOKEN nunca se loguea  
✅ **Idempotencia** — Ejecutar 2x produce el mismo resultado  
✅ **UX** — Output visual con emojis, colores, pasos numerados  
✅ **Documentación** — 9 archivos (docs + ejecutables + ejemplos)

---

## 📋 Flujo de 6 pasos (TL;DR)

```
1. PRE-CHECKS → Valida VERCEL_TOKEN, rama, secretos, tests
2. CONFIGURACIÓN → Detecta framework, auto-genera vercel.json
3. BUILD & DEPLOY → npm run build + vercel deploy --prod
4. HEALTH CHECK → Verifica HTTP 200 (retry 3x, backoff 5s)
5. ROLLBACK → Si falla, revertir a deploy anterior (automático)
6. REGISTRAR → Guardar en .sdd/estado.json
```

---

## 🔧 Requisitos previos

### Obligatorios
- ✅ Bash (4+)
- ✅ Git (2+)
- ✅ Node.js (18+) con npm
- ✅ Vercel CLI (`npm install -g vercel`)
- ✅ curl (7+)
- ✅ VERCEL_TOKEN (generar en vercel.com/account/tokens)

### Opcionales
- 🟡 VERCEL_PROJECT_ID (si ya existe en Vercel)
- 🟡 Notificaciones (Slack, email)

---

## 📊 Estadísticas

| Métrica | Valor |
|---------|-------|
| Total de archivos | 9 |
| Líneas de documentación | ~2,500 |
| Líneas de código (deploy.sh) | ~250 |
| Líneas de metadata (skill.yaml) | ~300 |
| Pasos del flujo | 6 |
| Pre-checks | 4 |
| Health check retries | 3 |
| Documentos para diferentes perfiles | 4 |
| Duración típica | 3-4 minutos |

---

## ✨ Diferenciadores vs Bolt/v0

| Aspecto | vercel-deploy | Bolt/v0 |
|--------|---------------|---------|
| **Pre-deploy checks** | ✅ Sí (4 validaciones) | ❌ No |
| **Secretos en código** | ✅ Detecta y bloquea | ❌ Puede estar oculto |
| **Tests** | ✅ Valida antes de deploy | ❌ Después del deploy |
| **Health check** | ✅ 3 reintentos automáticos | ❌ Manual o inexistente |
| **Rollback** | ✅ Automático si falla | ❌ Manual |
| **Observabilidad** | ✅ .sdd/estado.json completo | ❌ Logs en Vercel |
| **Framework detection** | ✅ Automático | ❌ Manual |
| **Atomicidad** | ✅ Todo o nada | ❌ Estados intermedios |

---

## 🔐 Seguridad

- ✅ VERCEL_TOKEN nunca se imprime en logs
- ✅ Grep de secretos comunes (API_KEY, SECRET, password) en src/
- ✅ Fuerza .env.local en .gitignore
- ✅ No permite deploy si hay cambios sin stagear
- ✅ Valida rama limpia ante de proceder

---

## 📌 Cómo se genera .sdd/estado.json

Después de un deploy exitoso, el script crea:

```json
{
  "ultimo_despliegue": {
    "timestamp": "2026-06-13T14:30:00Z",
    "url": "https://proyecto.vercel.app",
    "status": "OK",
    "health_check": "200 OK",
    "framework": "nextjs"
  }
}
```

Ver ejemplo completo en [estado.json.example](./estado.json.example).

---

## 🔗 Integración con flujos SDD

```yaml
# En tu sdd.implementar.md:
deploy:
  plataforma: vercel
  framework: auto
  environment: production
  skill: vercel-deploy
```

Gate humano antes de ejecutar:
```
¿Despliego en Vercel? [sí/no/después]
```

---

## 📞 Troubleshooting rápido

| Problema | Solución |
|----------|----------|
| VERCEL_TOKEN ausente | Generar en vercel.com/account/tokens |
| Tests fallando | Ejecutar `/sdd.implementar` nuevamente |
| Health check 502/503 | Reintenta automáticamente (3x); si persiste, rollback |
| Build falla | Revisar `npm run build` localmente |
| Cambios sin stagear | `git add . && git commit` |
| Secretos en código | Mueve a .env.local |

Ver [CHECKLIST.md](./CHECKLIST.md) para validación completa.

---

## 🎓 Ejemplos de uso

### Uso simple
```bash
export VERCEL_TOKEN="vercel_xxx_..."
bash ./skills/vercel-deploy/deploy.sh
```

### Integrado en /sdd.implementar
```bash
/sdd.implementar
# ... pasos 1-4 ...
# PASO 5: Deploy
# ¿Despliego en Vercel? [sí]
# → Ejecuta vercel-deploy automáticamente
```

### Con diferentes ambientes
```bash
/sdd.desplegar --environment staging
/sdd.desplegar --environment production
```

---

## 📝 Versionamiento

| Versión | Fecha | Cambios |
|---------|-------|---------|
| 1.0.0 | 2026-06-13 | Release inicial |

---

## 📚 Referencias

- Vercel Docs: https://vercel.com/docs
- Vercel API: https://vercel.com/docs/api
- Vercel CLI: https://vercel.com/cli
- Deployment best practices: https://vercel.com/docs/concepts/deployments

---

## ✅ Checklist de instalación

- [ ] Descargado en `sdd-lite/skills/vercel-deploy/`
- [ ] VERCEL_TOKEN generado y guardado
- [ ] Leer README.md (2 min)
- [ ] Revisar CHECKLIST.md (5 min)
- [ ] Ejecutar deploy.sh (3-4 min)
- [ ] Verificar URL en vivo
- [ ] Guardar estado en .sdd/estado.json

---

## 🎯 Próximos pasos

1. **Ahora**: Leer [README.md](./README.md)
2. **Luego**: Revisar [CHECKLIST.md](./CHECKLIST.md)
3. **Ejecutar**: `bash ./skills/vercel-deploy/deploy.sh`
4. **Integrar**: En `/sdd.implementar` con [INTEGRATION.md](./INTEGRATION.md)
5. **Monitorear**: Post-deploy con `/sdd.canary`

---

**Estado:** ✅ Listo para usar  
**Mantenedor:** SDD Team  
**Soporte:** Referir a documentación interna  

