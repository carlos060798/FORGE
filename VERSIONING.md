# Versionamiento de FORGE

Este documento describe la estrategia de versionamiento semántico (SemVer) para FORGE y cómo mantener versiones consistentes entre el plugin y npm.

## Semantic Versioning (SemVer)

FORGE sigue el formato: **MAJOR.MINOR.PATCH**

```
v2.6.0
  │  │  │
  │  │  └─ PATCH: Bug fixes, hotfixes, optimizaciones
  │  └───── MINOR: Nuevas funcionalidades, compatibles hacia atrás
  └──────── MAJOR: Cambios incompatibles (breaking changes)
```

### Casos de uso

| Cambio | Versión | Ejemplo |
|--------|---------|---------|
| Nuevo comando SDD | MINOR | 2.5.0 → 2.6.0 |
| Nuevo design system | MINOR | 2.6.0 → 2.7.0 |
| Nuevo agente | MINOR | 2.6.0 → 2.7.0 |
| Fix en skill existente | PATCH | 2.6.0 → 2.6.1 |
| Optimización de performance | PATCH | 2.6.0 → 2.6.1 |
| API breaking change | MAJOR | 2.6.0 → 3.0.0 |
| Eliminación de comando | MAJOR | 2.6.0 → 3.0.0 |
| Cambio en IR schema | MAJOR | 2.6.0 → 3.0.0 |

---

## Flujo de release

### 1. Desarrollo (rama `main` o feature branch)

Desarrolla normalmente. Los commits siguen esta convención:

```
[LAYER] [ACTION]: descripción

Ejemplos:
[FORGE] ADD: nuevo comando sdd.exportar
[SKILLS] FIX: interpreter-idea genera IR con confidence correcta
[DESIGN] ADD: nuevo design system vibrant-consumer
[PIPELINE] IMPROVE: wireframe generador 3x más rápido
[DOCS] UPDATE: CHANGELOG con nuevas funcionalidades
```

**Layers disponibles:**
- `FORGE` — cambios en nivel de pipeline o SPA
- `COMMANDS` — nuevos o modificados comandos SDD
- `AGENTS` — nuevos o modificados agentes
- `SKILLS` — nuevos o modificados skills
- `DESIGN` — design systems y craft
- `PIPELINE` — lógica de orquestación
- `PROVIDERS` — soporte de nuevos modelos / proveedores
- `TESTS` — cobertura de tests
- `DOCS` — documentación

**Actions disponibles:**
- `ADD` — nueva funcionalidad
- `FIX` — corrección de bug
- `IMPROVE` — mejora de feature existente
- `UPDATE` — actualización (docs, deps)
- `REMOVE` — eliminación de feature
- `REFACTOR` — cambio de estructura sin cambio de comportamiento

---

### 2. Preparación de release (rama temporal `release/X.Y.Z`)

Cuando esté listo para un release:

**2.1. Crear rama de release**

```bash
git checkout -b release/2.6.0
```

**2.2. Actualizar versión en `package.json`**

```json
{
  "name": "sdd-es",
  "version": "2.6.0",
  ...
}
```

Usa **exactamente** el formato `X.Y.Z` (sin `v` prefijo en package.json).

**2.3. Actualizar `CHANGELOG.md`**

1. Cambia la sección `[Unreleased]` → `[2.6.0] - 2026-06-13`
2. Revisa que todos los cambios desde el release anterior estén documentados
3. Agrupa por categoría: Agregado, Cambiado, Deprecado, Removido, Fixed, Seguridad

Ejemplo:

```markdown
## [2.6.0] - 2026-06-13

### Agregado
- Nuevo endpoint `/api/wireframe`
- Soporte para Ollama local

### Cambiado
- IR schema v2 con confidence scores
- Performance del interpreter +40%

### Fixed
- Bug en direction picker con design systems custom
```

**2.4. Commit de release**

```bash
git add package.json CHANGELOG.md
git commit -m "release: v2.6.0"
```

**2.5. Tag semántico**

```bash
git tag -a v2.6.0 -m "FORGE v2.6.0 — SPA + GitHub Actions + 5 design systems"
git push origin v2.6.0
```

---

### 3. Publicación en npm

**Requiere:** Tener credenciales npm configuradas (`npm adduser` o `.npmrc`)

```bash
# Verifica que estés en la rama release
git branch   # debe mostrar: * release/2.6.0

# Build y test antes de publicar (opcional pero recomendado)
npm test

# Publica en npm
npm publish

# Respuesta esperada:
# npm notice Publishing to registry
# npm notice 📦  sdd-es@2.6.0
# npm notice === Tarball Contents ===
```

Para ver el paquete publicado:

```bash
npm view sdd-es@2.6.0
npm info sdd-es versions  # lista todas las versiones publicadas
```

---

### 4. Mergear release a `main`

Después de publicar en npm:

```bash
git checkout main
git merge release/2.6.0
git push origin main
```

Opcionalmente, elimina la rama:

```bash
git branch -d release/2.6.0
git push origin --delete release/2.6.0
```

---

## Versionamiento de componentes internos

Algunos componentes tienen sus propias versiones compatibles entre sí:

| Componente | Dónde | Impacto en release |
|-----------|-------|-------------------|
| IR Schema | `.sdd/ir.json` | MAJOR si hay breaking changes |
| SDD Config | `.sdd/sdd.config.yaml` | MINOR si hay nuevas opciones |
| CLI API | `cli/index.js` | MAJOR si cambian argumentos |
| Pipeline Steps | `pipeline/*/STEP.md` | MINOR si hay nuevos steps |
| Design System tokens | `design-systems/*/tokens.json` | MINOR si hay nuevos tokens |

**Ejemplo:** Si el IR schema cambia (p.ej. se agregan campos), es MINOR. Pero si se remueven campos requeridos, es MAJOR.

---

## Pre-release y versiones candidatas

Para versiones inestables, usa estos formatos:

```
2.6.0-alpha.1      # Versión alpha (alpha testing phase)
2.6.0-beta.1       # Versión beta (feature complete)
2.6.0-rc.1         # Release candidate (ready for production)
```

En `package.json`:

```json
{
  "version": "2.6.0-rc.1"
}
```

Con npm:

```bash
npm publish --tag rc
npm dist-tags ls sdd-es

# Resultado:
# latest: 2.5.0
# rc: 2.6.0-rc.1
```

Usuarios instalan así:

```bash
npm install sdd-es@rc      # última RC
npm install sdd-es@latest  # estable
```

---

## Deprecación y EOL

Si una funcionalidad debe desaparecer:

1. **v X.Y.Z** — Marca como deprecated en docs y logs
2. **v X+3.0.0** — Remueve (breaking change)

Ejemplo:

```bash
# v2.6.0
npm deprecate sdd-es@2.5.0 "Use v2.6.0+ instead"

# v3.0.0 remueve feature antigua
```

---

## Checklist de release

Antes de publicar, verifica:

- [ ] `npm test` — 579/579 tests passing
- [ ] `package.json` — versión actualizada a X.Y.Z
- [ ] `CHANGELOG.md` — nuevas features documentadas
- [ ] `README.md` — ejemplos y docs sincronizados
- [ ] Tag git — `git tag v X.Y.Z`
- [ ] Credenciales npm — `npm whoami` funciona
- [ ] Sin cambios sin commitear — `git status` limpio
- [ ] Main branch actualizado — `git pull origin main`

---

## Troubleshooting

### ¿Publiqué la versión equivocada?

```bash
npm unpublish sdd-es@2.6.1  # elimina
# O marca deprecated:
npm deprecate sdd-es@2.6.1 "Use 2.6.0"
```

### ¿Necesito re-publicar con cambios?

Sube a una nueva PATCH:

```bash
# En package.json: 2.6.0 → 2.6.1
npm publish

# Tag el commit:
git tag v2.6.1
git push origin v2.6.1
```

### ¿Cómo revertir a una versión anterior?

Los usuarios pueden instalar cualquier versión histórica:

```bash
npm install sdd-es@2.5.0
npx sdd-es@2.5.0   # ejecutar una versión específica
```

---

## Referencias

- [Semantic Versioning Official](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [npm semver calculator](https://semver.npmjs.com/)
- [npm dist-tags](https://docs.npmjs.com/adding-dist-tags-to-packages)

