---
description: Detecta automáticamente el stack del proyecto (lenguaje, framework, BD, tests, build) analizando archivos de configuración. Se invoca internamente por /sdd.constitucion y otros comandos.
---

# Skill: Detección de Stack

Detecta el stack sin preguntar al usuario lo que se puede inferir.

## Proceso

### 1. Lenguaje principal

```bash
# Archivos de manifest
ls package.json pyproject.toml setup.py Cargo.toml go.mod \
   pom.xml build.gradle build.gradle.kts composer.json \
   mix.exs Gemfile *.csproj *.fsproj *.gemspec \
   pubspec.yaml deno.json bun.lockb 2>/dev/null

# Frecuencia por extensión
find . -type f -not -path '*/.git/*' -not -path '*/node_modules/*' \
  -not -path '*/target/*' -not -path '*/__pycache__/*' -not -path '*/.sdd/*' \
  -not -path '*/dist/*' -not -path '*/build/*' \
  | sed 's/.*\.//' | sort | uniq -c | sort -rn | head -10
```

### 2. Framework

```bash
# JS/TS
[ -f package.json ] && grep -oE '"(react|vue|angular|svelte|next|nuxt|express|fastify|nestjs|hono|koa|remix|astro|solid)":' package.json

# Python
[ -f pyproject.toml ] && grep -iE 'django|flask|fastapi|starlette|tornado|sanic' pyproject.toml
[ -f requirements.txt ] && grep -iE 'django|flask|fastapi|starlette' requirements.txt

# Rust
[ -f Cargo.toml ] && grep -iE 'axum|actix|rocket|warp|tide|tower' Cargo.toml

# Go
[ -f go.mod ] && grep -iE 'gin-gonic|echo|fiber|chi|gorilla' go.mod

# Java/Kotlin
[ -f pom.xml ] && grep -iE 'spring-boot|quarkus|micronaut' pom.xml
[ -f build.gradle* ] && grep -iE 'spring-boot|quarkus|ktor' build.gradle*

# .NET
ls *.csproj 2>/dev/null | head -3
grep -l 'Microsoft.AspNetCore' *.csproj 2>/dev/null

# Ruby
[ -f Gemfile ] && grep -iE 'rails|sinatra|hanami|roda' Gemfile

# PHP
[ -f composer.json ] && grep -iE 'laravel|symfony|slim|phalcon' composer.json
```

### 3. Base de datos / Almacenamiento

```bash
# ORM/Driver
cat package.json pyproject.toml Cargo.toml go.mod composer.json Gemfile 2>/dev/null | \
  grep -iE 'postgres|psycopg|mysql|sqlite|mongodb|redis|prisma|drizzle|sequelize|typeorm|sqlalchemy|django.db|diesel|sqlx|gorm|sqlc|activerecord|hibernate|ef|entityframework|doctrine|eloquent'

# Docker
[ -f docker-compose.yml ] && grep -iE 'image: (postgres|mysql|mongo|redis|elasticsearch|cassandra|clickhouse)' docker-compose.yml

# Schema files
ls schema.sql migrations/ db/ prisma/ alembic/ 2>/dev/null
```

### 4. Testing

```bash
[ -f package.json ] && grep -oE '"(jest|vitest|mocha|jasmine|playwright|cypress)":' package.json
[ -f pyproject.toml ] && grep -iE 'pytest|unittest' pyproject.toml
[ -f Cargo.toml ] && grep -iE 'criterion|proptest' Cargo.toml
ls pytest.ini setup.cfg phpunit.xml karma.conf* 2>/dev/null
```

### 5. Linting/Formato

```bash
ls .eslintrc* biome.json prettier.config* .prettierrc* \
   ruff.toml .ruff.toml mypy.ini .mypy.ini pyright.json \
   .rubocop.yml rubocop.yml \
   clippy.toml rustfmt.toml \
   .editorconfig \
   golangci.yml golangci-lint.yml \
   2>/dev/null
```

### 6. Build/Bundler

```bash
ls webpack.config* vite.config* rollup.config* tsconfig.json \
   esbuild.config* turbo.json nx.json lerna.json pnpm-workspace.yaml \
   Cargo.lock pdm.lock poetry.lock uv.lock 2>/dev/null
```

### 7. CI/CD

```bash
ls .github/workflows/ .gitlab-ci.yml .circleci/ Jenkinsfile \
   .buildkite/ bitbucket-pipelines.yml azure-pipelines.yml \
   2>/dev/null
```

### 8. Plataforma de despliegue (deploy)

Detecta a dónde se publica el proyecto. Lo usa `/sdd.desplegar`.

```bash
# Manifiestos de plataforma (señal fuerte)
ls vercel.json .vercel/ 2>/dev/null          && echo "PLATAFORMA: Vercel"
ls netlify.toml 2>/dev/null                   && echo "PLATAFORMA: Netlify"
ls railway.json railway.toml 2>/dev/null      && echo "PLATAFORMA: Railway"
ls fly.toml 2>/dev/null                       && echo "PLATAFORMA: Fly.io"
ls render.yaml 2>/dev/null                    && echo "PLATAFORMA: Render"
ls app.yaml 2>/dev/null                       && echo "PLATAFORMA: Google App Engine"
ls Procfile 2>/dev/null                       && echo "PLATAFORMA: Heroku/Procfile"

# Contenedores (señal media — destino genérico)
ls Dockerfile docker-compose.yml compose.yaml 2>/dev/null && echo "CONTENEDOR: Docker"
ls k8s/ kubernetes/ *.k8s.yaml chart/ 2>/dev/null         && echo "ORQUESTADOR: Kubernetes"

# Infra como código
ls *.tf terraform/ 2>/dev/null                && echo "IAC: Terraform"
ls serverless.yml serverless.yaml 2>/dev/null && echo "IAC: Serverless Framework"

# CLI de plataforma disponible en PATH (qué se puede ejecutar)
for cli in vercel netlify railway flyctl gcloud aws heroku; do
  command -v "$cli" >/dev/null 2>&1 && echo "CLI_DISPONIBLE: $cli"
done
```

Si **no hay ninguna señal**, la plataforma queda como `"por definir"`: en ese caso `/sdd.desplegar` debe preguntar (o, en perfil guiado, recomendar la más simple según el stack — p. ej. Vercel para web Node, contenedor Docker para API).

## Output

Devuelve objeto estructurado:

```json
{
  "lenguaje": "TypeScript",
  "runtime": "Node.js",
  "framework": "Next.js 14",
  "base_datos": "PostgreSQL (via Prisma)",
  "testing": "Vitest + Playwright",
  "linting": "ESLint + Prettier",
  "build": "Turbopack",
  "ci": "GitHub Actions",
  "plataforma_deploy": "Vercel",
  "deploy_cli_disponible": "vercel",
  "confianza": "alta",
  "señales_detectadas": [
    "package.json con next: 14.x",
    "prisma/schema.prisma con provider postgres",
    "vitest.config.ts presente",
    ".github/workflows/ci.yml presente",
    "vercel.json presente + CLI 'vercel' en PATH"
  ]
}
```

## Cuándo SÍ preguntar al usuario

- Confianza baja en aspectos críticos (lenguaje, BD)
- Múltiples lenguajes con similar peso (monorepo poliglota)
- Frameworks que coexisten sin uno dominante

## Cuándo NO preguntar

- Si los archivos manifest son claros
- Si la decisión es deducible sin riesgo
