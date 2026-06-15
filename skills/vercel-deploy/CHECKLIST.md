# Pre-Deploy Checklist: vercel-deploy

Antes de invocar el skill, asegúrate de que todas estas condiciones se cumplen.

## 1. Autenticación y credenciales

- [ ] **VERCEL_TOKEN** configurado
  ```bash
  echo $VERCEL_TOKEN  # Debe mostrar un token
  ```
  Si no aparece nada:
  ```bash
  export VERCEL_TOKEN="vercel_xxx_..."
  # O añade a .env.local:
  echo 'VERCEL_TOKEN=vercel_xxx_...' >> .env.local
  ```

- [ ] **VERCEL_PROJECT_ID** (opcional, pero recomendado si ya existe el proyecto)
  ```bash
  echo $VERCEL_PROJECT_ID  # Debe mostrar algo como "prj_xxx123..."
  ```

## 2. Código y repositorio

- [ ] **Rama limpia** (sin cambios sin stagear)
  ```bash
  git status  # Debe mostrar "working tree clean"
  ```
  Si hay cambios:
  ```bash
  git add .
  git commit -m "Descripción de cambios"
  ```

- [ ] **Todos los cambios están committeados**
  ```bash
  git log --oneline -5  # Verifica que veas tus commits
  ```

- [ ] **Rama sincronizada con remoto** (opcional pero recomendado)
  ```bash
  git pull origin main  # O tu rama principal
  ```

## 3. Seguridad

- [ ] **Sin secretos hardcodeados en src/**
  ```bash
  grep -r "VERCEL_TOKEN\|API_KEY\|SECRET\|password" src/ 2>/dev/null
  # Debe NO mostrar nada (o solo comentarios de documentación)
  ```
  
  Si encuentra secretos:
  - Muévelos a `.env.local` o variables de entorno de Vercel
  - Commit: `git add . && git commit -m "Move secrets to env"`

- [ ] **Archivo `.env.local` en `.gitignore`**
  ```bash
  grep ".env.local" .gitignore
  # Debe mostrar: .env.local
  ```
  Si no está:
  ```bash
  echo ".env.local" >> .gitignore
  git add .gitignore
  git commit -m "Add .env.local to gitignore"
  ```

## 4. Tests y calidad

- [ ] **Tests pasan localmente**
  ```bash
  npm test
  # O si usas un comando personalizado:
  npm test -- --passWithNoTests
  # Exit code debe ser 0 (éxito)
  ```

- [ ] **Build local exitoso**
  ```bash
  npm run build
  # Debe compilar sin errores
  ```

- [ ] **Sin warnings críticos en el build**
  ```bash
  npm run build 2>&1 | grep -i "error\|critical"
  # Idealmente debe estar vacío
  ```

## 5. Configuración de Vercel

- [ ] **vercel.json existe o se generará automáticamente**
  ```bash
  ls -la vercel.json
  # Si no existe, el skill lo generará automáticamente
  ```

- [ ] **package.json está presente y tiene scripts de build**
  ```bash
  grep -A2 '"scripts"' package.json | grep 'build'
  # Debe mostrar algo como: "build": "next build" o similar
  ```

- [ ] **Framework detectado correctamente**
  ```bash
  # El skill debe detectar: next, react, vue, astro, python, etc.
  grep '"next"\|"react"\|"vue"\|"astro"' package.json
  ```

## 6. Dependencias y environment

- [ ] **Todas las dependencias están instaladas**
  ```bash
  npm ls 2>&1 | grep -i "unmet\|missing"
  # Debe estar vacío
  ```

- [ ] **Node.js versión compatible**
  ```bash
  node --version  # v18+ recomendado
  npm --version   # v8+ recomendado
  ```

- [ ] **Variables de entorno necesarias configuradas localmente**
  ```bash
  # Si tu app necesita env vars en runtime:
  cat .env.local | grep DATABASE_URL  # Ejemplo
  ```

## 7. Documentación y comunicación

- [ ] **Team informado del deploy**
  - [ ] Slack/Discord: "Desplegando versión X a Vercel"
  - [ ] Tickets/issues: Link a PR o commit

- [ ] **Testing plan claro**
  - [ ] URL será compartida con: [testers/QA/stakeholders]
  - [ ] Features a verificar: [lista]

## 8. Rollback y contingencia

- [ ] **Sabes cómo hacer rollback manual si falla**
  ```bash
  /sdd.revertir  # O comando equivalente
  vercel rollback --token="$VERCEL_TOKEN"
  ```

- [ ] **Contactos de escalado disponibles**
  - [ ] DevOps lead: [nombre/email]
  - [ ] Vercel support: [link a dashboard]

---

## Checklist rápido (una línea cada una)

```bash
# Run this before deploying
[ ! -z "$VERCEL_TOKEN" ] && echo "✅ VERCEL_TOKEN set" || echo "❌ VERCEL_TOKEN missing"
git diff-files --quiet && echo "✅ Working tree clean" || echo "❌ Uncommitted changes"
grep -r "VERCEL_TOKEN\|API_KEY\|SECRET" src/ && echo "❌ Secrets found" || echo "✅ No secrets"
npm test -- --passWithNoTests && echo "✅ Tests passing" || echo "❌ Tests failing"
npm run build && echo "✅ Build successful" || echo "❌ Build failed"
```

Si todos dicen ✅, estás listo para:
```bash
/sdd.desplegar
```

---

## Después de cada línea verde

| Checklist | Sí | No | Acción |
|-----------|----|----|--------|
| VERCEL_TOKEN | ✅ |    | Procede |
|            |    | ❌ | Crea token en vercel.com/account/tokens |
| Rama limpia | ✅ |    | Procede |
|            |    | ❌ | git add . && git commit |
| Sin secretos | ✅ |    | Procede |
|            |    | ❌ | Mueve a .env.local |
| Tests verdes | ✅ |    | Procede |
|            |    | ❌ | Ejecuta /sdd.implementar |
| Build OK | ✅ |    | **PROCEDE CON DEPLOY** |
|            |    | ❌ | Revisa errores y corrije |

---

## Estado final: "All systems go" ✅

Cuando todas las checks están verdes, puedes ejecutar con confianza:

```bash
/sdd.desplegar
```

O manualmente:

```bash
bash ./skills/vercel-deploy/deploy.sh
```

Esto invocará el flujo de 6 pasos del skill **vercel-deploy**.

