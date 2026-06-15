# Skill: vercel-deploy

**Despliegue automático en Vercel con pre-checks, health checks y rollback automático.**

Cierra el ciclo idea→producción sin salir del flujo. Diferenciador vs Bolt/v0: verificación independiente **PRE-deploy**, no post-deploy.

---

## 📋 Archivos en este directorio

### `SKILL.md` ⭐ (Principal)
**Documento maestro** con la especificación completa del skill.

Contenido:
- Propósito y visión
- Entrada requerida (VERCEL_TOKEN, variables de entorno)
- Flujo detallado de 6 pasos (código Bash ejecutable)
  - PASO 1: Pre-checks (bloquea si hay issues)
  - PASO 2: Auto-generar vercel.json
  - PASO 3: Build y deploy a Vercel
  - PASO 4: Health check con retry y backoff
  - PASO 5: Rollback automático si falla
  - PASO 6: Registrar resultado en `.sdd/estado.json`
- Output visual para el usuario
- Tabla de manejo de errores
- Notas de implementación (atomicidad, idempotencia, seguridad)

**Leer esto primero para entender qué hace el skill.**

---

### `deploy.sh` (Ejecutable)
**Script Bash funcional** que implementa los 6 pasos.

Características:
- Colores y emojis en el output
- Manejo robusto de errores
- Funciones modulares para cada paso
- Exit codes correctos
- Logging a `.sdd/estado.json`

Uso:
```bash
bash ./skills/vercel-deploy/deploy.sh
# O si tiene permisos de ejecución:
./skills/vercel-deploy/deploy.sh
```

**Para testing y ejecución real del flujo.**

---

### `README.md` (Inicio rápido)
**Guía de usuario con setup mínimo.**

Contenido:
- Uso rápido (copy-paste commands)
- Cómo obtener VERCEL_TOKEN
- Tabla de errores comunes
- Próximos pasos post-deploy
- Invocación (automática vs manual)

**Para usuarios que quieren empezar rápido.**

---

### `CHECKLIST.md` (Pre-requisitos)
**Checklist interactivo** antes de desplegar.

Contenido:
- 8 secciones: autenticación, código, seguridad, tests, vercel config, dependencias, comunicación, contingencia
- Comandos para verificar cada condición
- Acciones remediales si algo falla
- Checklist de una línea (copy-paste)
- Tabla "estado final: all systems go"

**Para verificar que todo está ready antes de desplegar.**

---

### `INTEGRATION.md` (Integración con sdd.implementar)
**Guía para conectar vercel-deploy en el flujo `/sdd.implementar`.**

Contenido:
- Overview del flujo (dónde se invoca)
- Requisitos previos (VERCEL_TOKEN, VERCEL_PROJECT_ID)
- Configuración en sdd.implementar (YAML frontmatter)
- Gate humano ("¿Despliego?")
- Flujo esperado (éxito, fallo, rollback)
- Ejemplo completo de sdd.implementar.md
- Archivos generados (.sdd/estado.json, vercel.json)
- Troubleshooting por escenario
- Variables de entorno en Vercel Dashboard
- Monitoreo post-deploy

**Para integrar el skill en tu workflow SDD.**

---

### `INDEX.md` (Este archivo)
**Mapa de navegación** de toda la documentación.

Contenido:
- Descripción de cada archivo
- Qué leer según tu caso de uso
- Relaciones entre documentos

**Para orientarte en la estructura.**

---

## 🎯 Qué leer según tu caso de uso

### "Quiero desplegar ahora mismo"
1. Lee [README.md](./README.md) (2 min)
2. Lee [CHECKLIST.md](./CHECKLIST.md) (5 min)
3. Ejecuta: `bash ./skills/vercel-deploy/deploy.sh`

### "Quiero entender qué hace el skill"
1. Lee [SKILL.md](./SKILL.md) (10 min)
2. Analiza [deploy.sh](./deploy.sh) (5 min)
3. Revisa ejemplos en [README.md](./README.md)

### "Quiero integrarlo en mi /sdd.implementar"
1. Lee [INTEGRATION.md](./INTEGRATION.md) (15 min)
2. Copia la sección YAML del ejemplo
3. Añade el gate humano en tu workflow
4. Configura VERCEL_TOKEN

### "Algo falló y necesito troubleshoot"
1. Consulta tabla de errores en [README.md](./README.md)
2. Más detalles en [SKILL.md](./SKILL.md) → "Manejo de errores"
3. Si es de integración, ve a [INTEGRATION.md](./INTEGRATION.md) → "Troubleshooting"

### "Quiero ver el código ejecutable"
1. Revisa [deploy.sh](./deploy.sh)
2. Lee comentarios alineados con [SKILL.md](./SKILL.md)
3. Test localmente con variables mock

---

## ⚡ Flujo de 6 pasos (resumen)

```
PASO 1: Pre-checks
  ✓ VERCEL_TOKEN presente
  ✓ Rama limpia (git)
  ✓ Sin secretos en src/
  ✓ Tests verdes
  ↓ (bloquea si algo falla)

PASO 2: Configuración
  ✓ Detectar framework (next, react, vue, astro, python...)
  ✓ Auto-generar vercel.json si no existe
  ↓

PASO 3: Deploy
  ✓ Build local: npm run build
  ✓ Enviar a Vercel: vercel deploy --prod
  ✓ Capturar URL de salida
  ↓

PASO 4: Health Check
  ✓ Retry 3 veces: curl -s $DEPLOY_URL
  ✓ Esperar backoff si falla (5s entre intentos)
  ✓ Si HTTP 200: ✅ éxito
  ↓ (si no, ir a PASO 5)

PASO 5: Rollback
  ✓ Si health check falla: vercel rollback --prod
  ✓ Revertir a deploy anterior
  ✓ Loguear y notificar usuario
  ↓

PASO 6: Registrar
  ✓ Guardar metadatos en .sdd/estado.json
  ✓ Timestamp, URL, status, health_check, framework
  ✓ Disponible para auditoría y monitoreo
```

---

## 📦 Input del skill

```env
# Requerido
VERCEL_TOKEN=vercel_xxx_abc123...

# Opcional pero recomendado
VERCEL_PROJECT_ID=prj_xyz123...

# Auto-detectado
framework=nextjs  # O react, vue, astro, python, etc.
```

## 📤 Output del skill

```
🚀 DESPLIEGUE A VERCEL — COMPLETADO

  ✅ Pre-checks completados
  ✅ Build exitoso
  ✅ Vercel deployment: https://mi-proyecto.vercel.app
  ✅ Health check: HTTP 200
  
  Tu app está en vivo: https://mi-proyecto.vercel.app
  Tiempo total: 3m 42s

Próximos pasos:
  • Comparte la URL
  • Monitorea por 15 minutos
  • Ejecuta /sdd.snapshot
```

---

## 🔐 Seguridad

- ✅ VERCEL_TOKEN nunca se loguea en stdout
- ✅ Secretos detectados pre-deploy (grep en src/)
- ✅ .env.local en .gitignore
- ✅ Credenciales en variables de entorno, no en código
- ✅ Atomicidad: o todo se despliega o se revierte

---

## 📚 Relaciones entre documentos

```
INDEX.md (Tú estás aquí)
  ├─ README.md ← Empezar aquí
  ├─ CHECKLIST.md ← Antes de desplegar
  ├─ SKILL.md ← Entender el flujo
  │   └─ deploy.sh ← Implementación
  ├─ INTEGRATION.md ← Conectar con sdd.implementar
  └─ Este mismo archivo
```

---

## 💡 Tips

1. **Siempre verifica el checklist antes de desplegar** → Lee [CHECKLIST.md](./CHECKLIST.md)

2. **Si algo falla, revisa logs en Vercel Dashboard** → https://vercel.com/dashboard

3. **VERCEL_TOKEN va en .env.local** (nunca en git):
   ```bash
   echo 'VERCEL_TOKEN=vercel_xxx_...' >> .env.local
   ```

4. **El skill es idempotente** → Ejecutar dos veces produce el mismo resultado

5. **Health check reintenta 3 veces automáticamente** → Maneja cold starts

6. **Rollback es automático si health check falla** → Protección contra deployments rotos

---

## 🚀 Próximos pasos

| Quiero... | Ir a... |
|-----------|---------|
| Desplegar ahora | [README.md](./README.md) |
| Entender el flujo | [SKILL.md](./SKILL.md) |
| Verificar prerequisites | [CHECKLIST.md](./CHECKLIST.md) |
| Integrar en /sdd.implementar | [INTEGRATION.md](./INTEGRATION.md) |
| Ver código ejecutable | [deploy.sh](./deploy.sh) |

---

**Versión:** 1.0  
**Última actualización:** 2026-06-13  
**Framework:** Bash + Vercel CLI  
**Estado:** ✅ Listo para usar

