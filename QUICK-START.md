# FORGE — Inicio en 5 minutos

FORGE es un framework SDD (Spec-Driven Development) para Claude Code. Convierte una idea en lenguaje natural en software especificado, planificado e implementado por un equipo de 14 agentes de IA.

---

## Prerequisitos

- Node.js ≥18.0.0 (recomendado ≥22.5 para SQLite nativo)
- Claude Code CLI instalado y configurado con API key
- Git

---

## Instalación

```bash
git clone https://github.com/carlos060798/FORGE
cd FORGE
npm install
```

El binario `forge` quedará disponible como `node cli/index.js` o, si añades el directorio al PATH:

```bash
# Opción A — alias temporal
alias forge="node /ruta/a/FORGE/cli/index.js"

# Opción B — instalar globalmente desde el repo
npm install -g .
forge --version
```

---

## Verificar instalación

```bash
forge doctor
```

Esto verifica: API key de Anthropic, hooks en disco, conexión al LLM y SQLite. Si todo está verde, continúa.

---

## Primer pipeline

**1. Abre Claude Code en tu proyecto:**

```bash
cd mi-proyecto
claude
```

**2. (Opcional) Usa un template de proyecto:**

```bash
forge init --template api-rest    # API REST + JWT
forge init --template saas-mvp    # SaaS multi-tenant + Stripe
forge init --template cli-tool    # Herramienta CLI
```

O `forge init` para partir de cero.

**3. Inicia FORGE:**

```
/forge
```

FORGE te pedirá una idea. Escríbela en lenguaje natural — no hace falta terminología técnica.

**3. Sigue el pipeline:**

El pipeline avanza etapa a etapa. En cada punto crítico FORGE te pide confirmación:

```
idea → discovery → ir → design → spec
                                   ↓
                            forge aprobar spec    ← tú decides aquí
                                   ↓
                        plan → tasks → code → done
```

**4. Aprueba la especificación antes de planificar:**

```bash
# Cuando FORGE haya generado la spec y tú la hayas revisado:
forge aprobar spec
```

Sin este comando, el pipeline no puede avanzar a plan. Es intencional.

**5. Monitorea el progreso:**

```bash
forge ui        # abre dashboard en localhost:3001 (SSE tiempo real)
forge status    # estado del pipeline + presupuesto USD
```

---

## Comandos más usados

```bash
forge status              # estado actual del pipeline
forge aprobar spec        # aprobar especificación antes de planificar
forge run                 # ejecutar tareas pendientes
forge resume              # reanudar ejecución interrumpida
forge doctor              # diagnóstico de instalación y LLM
forge ui                  # dashboard en localhost:3001
forge logs                # historial de consumo de tokens
forge decisions list      # listar decisiones arquitectónicas (ADRs)
forge decisions search X  # buscar ADRs por texto
```

---

## Cambiar el LLM (opcional)

Por defecto FORGE usa Anthropic. Para usar otro proveedor:

```bash
# OpenAI
FORGE_LLM_PROVIDER=openai OPENAI_API_KEY=sk-... forge run

# Ollama (local)
FORGE_LLM_PROVIDER=ollama forge run

# O en sdd.config.yaml de tu proyecto:
# llm:
#   provider: ollama
#   base_url: http://localhost:11434
```

Proveedores soportados: `anthropic`, `openai`, `ollama`, `stub` (para CI/tests).

---

## Documentación completa

| Tema | Documento |
|---|---|
| Qué es FORGE y por qué | [docs/introduction.md](docs/introduction.md) |
| Recorrido detallado | [docs/getting-started.md](docs/getting-started.md) |
| Arquitectura del sistema | [docs/architecture.md](docs/architecture.md) |
| Los 14 agentes | [docs/agents.md](docs/agents.md) |
| Configuración completa | [docs/configuration.md](docs/configuration.md) |
| Qué funciona hoy | [docs/ESTADO-IMPLEMENTACION.md](docs/ESTADO-IMPLEMENTACION.md) |
| Solución de problemas | [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) |
