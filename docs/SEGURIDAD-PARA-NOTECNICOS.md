# 🔐 Seguridad para No-Técnicos

> SDD-ES maneja tokens de GitHub y Vercel. Esta guía te explica qué son, cómo protegerlos, y qué hacer si cometes un error.

---

## ¿Qué es un "token"?

Un **token** es como una **contraseña especial** que funciona solo para una cosa.

### Comparación

```
Contraseña normal:
├─ Acceso a: email, redes sociales, archivos, TODO
└─ Riesgo: si alguien la roba, controla tu cuenta

Token:
├─ Acceso a: SOLO GitHub (o SOLO Vercel)
├─ Duración: puedes ponerle límite de tiempo
└─ Riesgo: si alguien lo roba, SOLO puede hacer lo que le diste permiso
```

**Ejemplo real:**
```
Token de GitHub para SDD-ES:
├─ ✅ PUEDE: crear repositorio, hacer commits, pushear código
├─ ✅ PUEDE: leer público el repositorio
└─ ❌ NO PUEDE: ver tus emails privados, cambiar contraseña, acceder a otros proyectos
```

---

## ¿Por qué SDD-ES pide tokens?

SDD-ES necesita tokens para:

1. **GitHub:** Crear tu repositorio automáticamente (sin que escribas `git init`)
2. **Vercel:** Publicar tu app en internet (sin que escribas `vercel deploy`)

Sin tokens, tendrías que hacer todo manualmente (comandos, CLI, etc.).

**Con tokens:** SDD-ES lo hace automáticamente por ti.

---

## 🚨 NUNCA hagas ESTO con tokens

### ❌ NO 1: No compartas tu token

```
❌ MALO:
- Enviar token por Whatsapp a un amigo
- Pegar token en Slack o Discord
- Guardar token en Notas o Google Docs
- Decirle a alguien tu token
```

**¿Por qué?** Si alguien tiene tu token, puede:
- Acceder a tu GitHub/Vercel
- Hacer commits en tu nombre
- Borrar repositorios
- Cambiar configuración de apps

---

### ❌ NO 2: No guardes token en archivos

```
❌ MALO (SDD-ES NO hace esto):
- No guardes token en .env
- No lo guardes en un archivo de texto
- No lo commitess a GitHub

✅ BIEN (SDD-ES SÍ hace esto):
- Token se usa en memoria mientras se necesita
- Cuando termina, se borra automáticamente
- Nunca se escribe en archivos persistentes
```

---

### ❌ NO 3: No commitess archivos sensibles

```
❌ MALO:
git add .
git commit -m "Mi proyecto"
[Si accidentalmente commiteas .env o credenciales]

✅ BIEN:
SDD-ES usa .gitignore para proteger:
- .sdd/.vercel-deploy.json (metadata de deploy)
- .env (variables de entorno)
- Cualquier archivo con secretos

[Git automáticamente ignora estos archivos]
```

---

## 📋 ¿Cómo generar un token SEGURO?

### Token de GitHub (para SDD-ES)

**Paso 1:** Abre https://github.com/settings/tokens?type=pat

**Paso 2:** Click "Generate new token" → "Fine-grained tokens"

**Paso 3:** Configura permisos **MÍNIMOS**:
```
Repository access:
  ✅ All repositories (SDD-ES creará uno nuevo)
  
Permissions:
  ✅ Repository: READ + WRITE (crear repo, hacer commits)
  ✅ Administration: NONE (no cambiar settings)
  ✅ Secrets: NONE (no leer otros secrets)
  ❌ User: NONE (no acceder emails)
```

**Paso 4:** Expiration:
```
⚠️ IMPORTANTE: Pon un límite de 90 días
(No "No expiration" — riesgo si token se roba)
```

**Paso 5:** Click "Generate token", copia y **úsalo INMEDIATAMENTE**

**Paso 6:** En SDD-ES, pega el token cuando pida

---

### Token de Vercel (para SDD-ES)

**Paso 1:** Abre https://vercel.com/account/tokens

**Paso 2:** Click "Create Token"

**Paso 3:** Configura:
```
Token Name: "SDD-ES [nombre-proyecto]" (ej: SDD-ES Mi Tienda)
Scope: Todos los equipos (o tu equipo)
Expiration: 90 días (NO "No expiration")
```

**Paso 4:** Click "Create", copia y **úsalo INMEDIATAMENTE**

---

## ✅ Si generaste token correctamente

```
Después de pegar el token en SDD-ES:

Sistema: "✅ Token válido"
Sistema: "[invoca skill de GitHub/Vercel]"
Sistema: "✅ Tu proyecto está en GitHub/Vercel"

El token se BORRA de la memoria automáticamente.
Ya NO lo necesitas más.
```

---

## 🚨 Si cometiste un error (compartiste token accidentalmente)

### Escenario 1: Compartiste token por Whatsapp/Slack

**¿Qué hacer?**

1. **IMMEDIATO — Revoca el token:**
   - GitHub: https://github.com/settings/tokens
   - Busca el token
   - Click "Delete"

2. **Genera uno NUEVO:**
   - Sigue los pasos de arriba
   - USA el nuevo en SDD-ES

3. **Chequea que no pasó nada malo:**
   - GitHub: Mira el repositorio, ¿alguien cambió código?
   - Vercel: ¿Apps raras desplegadas?

4. **Si sospechas actividad extraña:**
   - Cambia contraseña de GitHub/Vercel
   - Activa 2FA (autenticación de dos factores)

---

### Escenario 2: Accidentalmente commitease token a GitHub

```
(SDD-ES NO hace esto, pero si ocurre por error)

❌ MALO: El token está en GitHub público
         Cualquiera puede verlo en git log

✅ RECUPERACIÓN:
1. Revoca el token INMEDIATAMENTE (arriba)
2. Borra el archivo de histórico de git:
   git filter-branch --tree-filter 'rm -f .env' HEAD
3. Force push: git push --force
4. Avisa a GitHub (https://github.com/security/advisories)
```

---

## 🔒 SDD-ES protege tu seguridad

### Cómo SDD-ES cuida los tokens

```
✅ TOKENS EN VARIABLES DE ENTORNO (memoria)
   └─ No se escriben en archivos
   └─ Se borran cuando termina el script

✅ VALIDACIÓN INMEDIATA
   └─ Si token es inválido, sale rápido
   └─ No continúa si hay problema

✅ .gitignore AUTOMÁTICO
   └─ Protege archivos sensibles
   └─ Aunque hagas "git add .", no se commitean

✅ SIN GUARDAR CREDENTIALS
   └─ sdd.config.yaml SOLO guarda URLs, no tokens
   └─ Tokens se usan ONCE y desaparecen
```

---

## 📋 Checklist de Seguridad

Antes de usar SDD-ES, asegúrate de:

```
[ ] Generé un token NUEVO (no uno viejo)
[ ] Token tiene expiración 90 días (no "No expiration")
[ ] Token tiene permisos MÍNIMOS (solo repo, no everything)
[ ] Guardé el token en un lugar SEGURO temporalmente (1Password, Bitwarden)
[ ] Voy a pegar el token INMEDIATAMENTE en SDD-ES
[ ] NO voy a guardar el token en archivos
[ ] NO voy a compartir el token en mensajes
```

---

## 🆘 Emergencia: Creo que mi token fue robado

```
ACCIÓN: REVOCA INMEDIATAMENTE

1. GitHub: https://github.com/settings/tokens
   → Busca token → Click "Delete"

2. Vercel: https://vercel.com/account/tokens
   → Click "Delete"

3. Genera NUEVOS tokens

4. IMPORTANTE: Cambia contraseña GitHub/Vercel
   (por si alguien también robó contraseña)
```

---

## 📚 Más información

- **GitHub Security:** https://docs.github.com/en/authentication/keeping-your-account-and-data-secure
- **Vercel Security:** https://vercel.com/docs/security
- **OWASP (Seguridad general):** https://owasp.org/

---

## 💬 ¿Preguntas?

Si no estás seguro sobre algo de seguridad, **mejor pregunta que arreglar después.**

Abre un issue en GitHub: https://github.com/carlos060798/sdd-lite/issues
