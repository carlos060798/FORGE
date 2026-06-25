/**
 * stack-detector.ts — Implementación real de skills/deteccion-stack/SKILL.md
 *
 * Lee manifests del proyecto y devuelve un StackInfo tipado.
 * El engine usa StackInfo para seleccionar el runner correcto.
 * No invoca al LLM: detección determinista por archivos presentes.
 */

import * as fs from 'fs';
import * as path from 'path';

// ── Tipos ────────────────────────────────────────────────────────────────────

export type Lenguaje = 'typescript' | 'javascript' | 'python' | 'go' | 'rust' | 'java' | 'csharp' | 'ruby' | 'php' | 'dart' | 'unknown';

export interface StackInfo {
  lenguaje: Lenguaje;
  runtime: string;        // "Node.js", "CPython", "Go", "Rust", etc.
  framework: string | null;
  base_datos: string | null;
  test_cmd: string;       // comando listo para correr tests
  lint_cmd: string | null;
  build_cmd: string | null;
  install_cmd: string;
  confianza: 'alta' | 'media' | 'baja';
  señales: string[];      // evidencia que justifica la detección
}

// ── Detector principal ───────────────────────────────────────────────────────

export function detectStack(cwd: string = process.cwd()): StackInfo {
  const señales: string[] = [];
  const exists = (f: string) => fs.existsSync(path.join(cwd, f));
  const read = (f: string): string => {
    try { return fs.readFileSync(path.join(cwd, f), 'utf8'); } catch { return ''; }
  };
  const contains = (content: string, ...terms: string[]): boolean =>
    terms.some(t => content.toLowerCase().includes(t.toLowerCase()));

  // ── Node.js / TypeScript / JavaScript ──────────────────────────────────────
  if (exists('package.json')) {
    const pkg = read('package.json');
    let pkgJson: Record<string, unknown> = {};
    try { pkgJson = JSON.parse(pkg); } catch { /* ignorar */ }

    const isTS = exists('tsconfig.json') || exists('tsconfig.base.json');
    const lenguaje: Lenguaje = isTS ? 'typescript' : 'javascript';
    if (isTS) señales.push('tsconfig.json presente');
    señales.push('package.json presente');

    const deps = {
      ...(pkgJson['dependencies'] as Record<string, string> ?? {}),
      ...(pkgJson['devDependencies'] as Record<string, string> ?? {}),
    };
    const hasDep = (...names: string[]) => names.some(n => n in deps);

    // Framework
    let framework: string | null = null;
    if (hasDep('next')) { framework = 'Next.js'; señales.push('dep: next'); }
    else if (hasDep('nuxt', 'nuxt3')) { framework = 'Nuxt'; señales.push('dep: nuxt'); }
    else if (hasDep('@angular/core')) { framework = 'Angular'; señales.push('dep: @angular/core'); }
    else if (hasDep('react')) { framework = 'React'; señales.push('dep: react'); }
    else if (hasDep('vue')) { framework = 'Vue'; señales.push('dep: vue'); }
    else if (hasDep('svelte')) { framework = 'Svelte'; señales.push('dep: svelte'); }
    else if (hasDep('@nestjs/core')) { framework = 'NestJS'; señales.push('dep: @nestjs/core'); }
    else if (hasDep('fastify')) { framework = 'Fastify'; señales.push('dep: fastify'); }
    else if (hasDep('hono')) { framework = 'Hono'; señales.push('dep: hono'); }
    else if (hasDep('express')) { framework = 'Express'; señales.push('dep: express'); }
    else if (hasDep('koa')) { framework = 'Koa'; señales.push('dep: koa'); }

    // Test runner
    let test_cmd = 'npm test';
    if (hasDep('vitest')) { test_cmd = 'npx vitest run'; señales.push('dep: vitest'); }
    else if (hasDep('jest', '@jest/core')) { test_cmd = 'npx jest'; señales.push('dep: jest'); }
    else if (hasDep('mocha')) { test_cmd = 'npx mocha'; señales.push('dep: mocha'); }
    else if ((pkgJson['scripts'] as Record<string, string>)?.['test']) {
      señales.push('scripts.test definido en package.json');
    }

    // Lint
    let lint_cmd: string | null = null;
    if (hasDep('eslint')) { lint_cmd = 'npx eslint .'; señales.push('dep: eslint'); }
    else if (hasDep('biome')) { lint_cmd = 'npx biome check .'; señales.push('dep: biome'); }

    // Build
    let build_cmd: string | null = null;
    if (hasDep('typescript', 'ts-node')) { build_cmd = 'npx tsc --noEmit'; }
    if ((pkgJson['scripts'] as Record<string, string>)?.['build']) {
      build_cmd = 'npm run build';
    }

    // Package manager
    const install_cmd = exists('pnpm-lock.yaml') ? 'pnpm install'
      : exists('yarn.lock') ? 'yarn install'
      : exists('bun.lockb') ? 'bun install'
      : 'npm install';

    // Base de datos
    const base_datos = detectDb(deps, {}, señales);

    return {
      lenguaje,
      runtime: 'Node.js',
      framework,
      base_datos,
      test_cmd,
      lint_cmd,
      build_cmd,
      install_cmd,
      confianza: 'alta',
      señales,
    };
  }

  // ── Python ──────────────────────────────────────────────────────────────────
  if (exists('pyproject.toml') || exists('setup.py') || exists('requirements.txt')) {
    señales.push(exists('pyproject.toml') ? 'pyproject.toml' : exists('setup.py') ? 'setup.py' : 'requirements.txt');
    const toml = read('pyproject.toml');
    const req = read('requirements.txt');
    const combined = toml + req;

    let framework: string | null = null;
    if (contains(combined, 'fastapi')) { framework = 'FastAPI'; señales.push('dep: fastapi'); }
    else if (contains(combined, 'django')) { framework = 'Django'; señales.push('dep: django'); }
    else if (contains(combined, 'flask')) { framework = 'Flask'; señales.push('dep: flask'); }
    else if (contains(combined, 'starlette')) { framework = 'Starlette'; señales.push('dep: starlette'); }

    const test_cmd = exists('pytest.ini') || contains(toml, 'pytest')
      ? 'python -m pytest'
      : 'python -m unittest discover';

    return {
      lenguaje: 'python',
      runtime: 'CPython',
      framework,
      base_datos: detectPythonDb(combined, señales),
      test_cmd,
      lint_cmd: contains(combined, 'ruff') ? 'ruff check .' : contains(combined, 'flake8') ? 'flake8 .' : null,
      build_cmd: null,
      install_cmd: exists('poetry.lock') ? 'poetry install' : exists('Pipfile') ? 'pipenv install' : 'pip install -r requirements.txt',
      confianza: 'alta',
      señales,
    };
  }

  // ── Go ──────────────────────────────────────────────────────────────────────
  if (exists('go.mod')) {
    señales.push('go.mod presente');
    const gomod = read('go.mod');
    let framework: string | null = null;
    if (contains(gomod, 'gin-gonic/gin')) { framework = 'Gin'; señales.push('dep: gin'); }
    else if (contains(gomod, 'labstack/echo')) { framework = 'Echo'; señales.push('dep: echo'); }
    else if (contains(gomod, 'gofiber/fiber')) { framework = 'Fiber'; señales.push('dep: fiber'); }
    else if (contains(gomod, 'go-chi/chi')) { framework = 'Chi'; señales.push('dep: chi'); }

    return {
      lenguaje: 'go',
      runtime: 'Go',
      framework,
      base_datos: null,
      test_cmd: 'go test ./...',
      lint_cmd: 'golangci-lint run',
      build_cmd: 'go build ./...',
      install_cmd: 'go mod download',
      confianza: 'alta',
      señales,
    };
  }

  // ── Rust ─────────────────────────────────────────────────────────────────────
  if (exists('Cargo.toml')) {
    señales.push('Cargo.toml presente');
    const cargo = read('Cargo.toml');
    let framework: string | null = null;
    if (contains(cargo, 'axum')) { framework = 'Axum'; señales.push('dep: axum'); }
    else if (contains(cargo, 'actix-web')) { framework = 'Actix-web'; señales.push('dep: actix-web'); }
    else if (contains(cargo, 'rocket')) { framework = 'Rocket'; señales.push('dep: rocket'); }

    return {
      lenguaje: 'rust',
      runtime: 'Rust',
      framework,
      base_datos: null,
      test_cmd: 'cargo test',
      lint_cmd: 'cargo clippy',
      build_cmd: 'cargo build --release',
      install_cmd: 'cargo fetch',
      confianza: 'alta',
      señales,
    };
  }

  // ── Java / Kotlin ─────────────────────────────────────────────────────────
  if (exists('pom.xml') || exists('build.gradle') || exists('build.gradle.kts')) {
    const manifest = exists('pom.xml') ? 'pom.xml' : 'build.gradle';
    señales.push(`${manifest} presente`);
    const content = read(manifest);
    let framework: string | null = null;
    if (contains(content, 'spring-boot')) { framework = 'Spring Boot'; señales.push('dep: spring-boot'); }
    else if (contains(content, 'quarkus')) { framework = 'Quarkus'; señales.push('dep: quarkus'); }
    else if (contains(content, 'micronaut')) { framework = 'Micronaut'; señales.push('dep: micronaut'); }
    else if (contains(content, 'ktor')) { framework = 'Ktor'; señales.push('dep: ktor'); }

    const isMaven = exists('pom.xml');
    return {
      lenguaje: 'java',
      runtime: 'JVM',
      framework,
      base_datos: null,
      test_cmd: isMaven ? 'mvn test -q' : './gradlew test',
      lint_cmd: null,
      build_cmd: isMaven ? 'mvn package -q' : './gradlew build',
      install_cmd: isMaven ? 'mvn dependency:resolve -q' : './gradlew dependencies',
      confianza: 'alta',
      señales,
    };
  }

  // ── Desconocido ──────────────────────────────────────────────────────────────
  return {
    lenguaje: 'unknown',
    runtime: 'unknown',
    framework: null,
    base_datos: null,
    test_cmd: 'echo "No se detectó framework de tests"',
    lint_cmd: null,
    build_cmd: null,
    install_cmd: 'echo "No se detectó gestor de dependencias"',
    confianza: 'baja',
    señales: ['Ningún manifest reconocido encontrado'],
  };
}

// ── Helpers privados ─────────────────────────────────────────────────────────

function detectDb(
  deps: Record<string, string>,
  _extra: Record<string, string>,
  señales: string[]
): string | null {
  const hasDep = (...names: string[]) => names.some(n => n in deps);
  if (hasDep('prisma', '@prisma/client')) { señales.push('dep: prisma'); return 'Prisma ORM'; }
  if (hasDep('drizzle-orm')) { señales.push('dep: drizzle-orm'); return 'Drizzle ORM'; }
  if (hasDep('pg', 'postgres')) { señales.push('dep: pg'); return 'PostgreSQL'; }
  if (hasDep('mysql2', 'mysql')) { señales.push('dep: mysql2'); return 'MySQL'; }
  if (hasDep('better-sqlite3', 'sqlite3')) { señales.push('dep: sqlite3'); return 'SQLite'; }
  if (hasDep('mongodb', 'mongoose')) { señales.push('dep: mongodb'); return 'MongoDB'; }
  if (hasDep('ioredis', 'redis')) { señales.push('dep: redis'); return 'Redis'; }
  return null;
}

function detectPythonDb(content: string, señales: string[]): string | null {
  const c = content.toLowerCase();
  if (c.includes('sqlalchemy')) { señales.push('dep: sqlalchemy'); return 'SQLAlchemy'; }
  if (c.includes('psycopg')) { señales.push('dep: psycopg'); return 'PostgreSQL'; }
  if (c.includes('pymongo')) { señales.push('dep: pymongo'); return 'MongoDB'; }
  if (c.includes('sqlite')) { señales.push('dep: sqlite'); return 'SQLite'; }
  if (c.includes('redis')) { señales.push('dep: redis'); return 'Redis'; }
  return null;
}
