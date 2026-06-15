# GitHub Connect Skill - Índice de Documentación

Skill para conectar proyectos a GitHub automáticamente.

## Archivos del Skill

### Archivos de Usuario

| Archivo | Tamaño | Propósito |
|---------|--------|----------|
| **QUICK-START.md** | 2.5 KB | Comienza en 5 minutos - la lectura más rápida |
| **README.md** | 9.3 KB | Documentación completa para usuarios |
| **SKILL.md** | 9.1 KB | Especificación oficial del skill |

### Archivos Técnicos

| Archivo | Tamaño | Propósito |
|---------|--------|----------|
| **github-connect.sh** | 12 KB | Script bash ejecutable - implementación principal |
| **INTEGRATION.md** | 7.8 KB | Guía de integración técnica con SDD-ES |
| **example-config.yaml** | 1.2 KB | Ejemplo de configuración generada |

### Archivos de Referencia

| Archivo | Tamaño | Propósito |
|---------|--------|----------|
| **STRUCTURE.txt** | 4.2 KB | Descripción visual de la estructura |
| **IMPLEMENTATION-CHECKLIST.md** | 6.1 KB | Checklist para implementadores |
| **RESUMEN_IMPLEMENTACION.txt** | 5.8 KB | Resumen ejecutivo de la implementación |
| **INDEX.md** | Este archivo | Índice y guía de navegación |

## Guía de Lectura

### Para Usuarios Finales (15 minutos)

1. Comienza con: **QUICK-START.md**
   - Instala requisitos
   - Genera token GitHub
   - Ejecuta el skill
   - Verifica que funciona

2. Luego lee: **README.md**
   - Parámetros disponibles
   - Ejemplos prácticos
   - Troubleshooting

### Para Integradores/Arquitectos (45 minutos)

1. Lee: **SKILL.md**
   - Especificación oficial
   - Flujo detallado
   - Interfaz del skill

2. Lee: **INTEGRATION.md**
   - Cómo se integra con SDD-ES
   - Interfaz pública
   - Casos de uso

3. Revisa: **github-connect.sh**
   - Implementación real
   - Manejo de errores
   - Funciones principales

### Para Administradores/DevOps (60 minutos)

1. Lee: **IMPLEMENTATION-CHECKLIST.md**
   - Pre-implementación
   - Testing
   - Deployment

2. Consulta: **INTEGRATION.md**
   - Variables de entorno
   - Integración continua
   - Rollback plan

3. Revisa: **STRUCTURE.txt**
   - Archivos modificados
   - Seguridad
   - Requisitos

## Referencia Rápida

### Invocar el Skill

```bash
# Forma simple
/github-connect

# Con parámetros
/github-connect repo_name=mi-proyecto repo_visibility=private
```

### Parámetros Principales

- `repo_name` - Nombre del repositorio (default: nombre de carpeta)
- `repo_description` - Descripción (default: "Proyecto SDD-ES")
- `repo_visibility` - "public" o "private" (default: "public")
- `branch_name` - Rama principal (default: "main")
- `auto_init_commit` - Hacer commit inicial (default: true)

### Requisitos

```bash
git --version          # 2.20+
gh --version           # 1.0+
export GITHUB_TOKEN=   # Token válido
```

### Verificar Después

```bash
git remote -v          # Ver remote
gh repo view           # Ver repo
cat .sdd/sdd.config.yaml  # Ver config
```

## Estructura de Carpeta

```
/skills/github-connect/
├── SKILL.md                      ← Especificación
├── github-connect.sh             ← Script ejecutable
├── README.md                     ← Manual de usuario
├── INTEGRATION.md                ← Integración técnica
├── example-config.yaml           ← Ejemplo de config
├── STRUCTURE.txt                 ← Descripción visual
├── IMPLEMENTATION-CHECKLIST.md   ← Checklist
├── RESUMEN_IMPLEMENTACION.txt    ← Resumen ejecutivo
├── QUICK-START.md                ← Inicio rápido
└── INDEX.md                      ← Este archivo
```

## Flujo de Ejecución Simplificado

```
Usuario ejecuta: /github-connect
         ↓
github-connect.sh valida requisitos
         ↓
Obtiene info del usuario GitHub
         ↓
Verifica/crea repositorio
         ↓
Configura git remote
         ↓
Hace commit y push
         ↓
Guarda .sdd/sdd.config.yaml
         ↓
Muestra resumen con URL
```

## Características Principales

✅ Validación automática de token  
✅ Creación de repositorio  
✅ Configuración de remote  
✅ Commit y push inicial  
✅ Configuración persistente  
✅ Manejo de errores robusto  
✅ Salida clara y legible  
✅ Idempotente (seguro ejecutar múltiples veces)  

## Seguridad

- Token nunca se loguea
- Configuración guardada NO contiene secretos
- Validación de entrada
- Permisos correctos
- Comunicación HTTPS

## Casos de Uso

1. **Repositorio público nuevo** - Caso estándar
2. **Repositorio privado** - Con `repo_visibility=private`
3. **Repositorio existente** - El skill lo detecta y reutiliza
4. **Rama personalizada** - Con `branch_name=develop`
5. **Sin commit inicial** - Con `auto_init_commit=false`

## Errores Comunes

| Error | Solución |
|-------|----------|
| Token no configurado | `export GITHUB_TOKEN=ghp_xxx` |
| GitHub CLI no instalado | `brew install gh` |
| Git no configurado | `git config user.name/email` |
| Repositorio existe | El skill lo reutiliza automáticamente |

## Próximos Pasos Recomendados

1. **Inmediato:** Leer QUICK-START.md y ejecutar
2. **Después:** Integrar con sdd.constitucion.md
3. **Testing:** Ejecutar en staging antes de producción
4. **Monitoreo:** Rastrear tasa de éxito y errores

## Soporte y Contacto

- **Especificación:** Ver SKILL.md
- **Problemas:** Consultar sección de errores en README.md
- **Integración:** Ver INTEGRATION.md
- **Implementación:** Ver IMPLEMENTATION-CHECKLIST.md

## Changelog

### v1.0.0 (2026-06-13)
- Versión inicial
- Todas las características base implementadas
- Documentación completa
- Listo para producción

## Notas

- El skill es **idempotente**: seguro ejecutar múltiples veces
- El skill es **no-destructivo**: nunca sobrescribe datos
- El script es **autoexplicativo**: logging en cada paso
- La documentación es **exhaustiva**: >3000 palabras

---

**Estado:** LISTO PARA PRODUCCIÓN  
**Versión:** 1.0.0  
**Última actualización:** 2026-06-13  
**Mantenedor:** SDD-ES Orchestrator
