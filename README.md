# SDD-ES

> **Una capa de opinión en español sobre las primitivas oficiales de Claude Code**
> Skills, subagentes, hooks y slash commands orquestados en un flujo idea→deploy, agnóstico al stack.
>
> **Para quién:** no-técnicos que quieren construir sin programar (modo guiado) y developers que quieren estándares de ingeniería altos sin boilerplate (modo experto).

[![npm](https://img.shields.io/npm/v/sdd-es)](https://www.npmjs.com/package/sdd-es)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

📚 **[Documentación completa →](https://carlos060798.github.io/FORGE/)** · sitio navegable bilingüe (ES/EN) con buscador, para no-técnicos y developers. También disponible como Markdown en [`docs/`](docs/README.md).

---

## Instalación

Requiere **Node.js ≥ 18** y **Claude Code**.

```bash
# Desde la carpeta de tu proyecto
npx sdd-es init
```

Eso es todo. SDD-ES instala comandos, agentes, skills y hooks en `.claude/` y crea la estructura `.sdd/` en tu proyecto.

### Opciones adicionales

```bash
npx sdd-es init --global   # instala para todos tus proyectos ($HOME/.claude)
npx sdd-es update          # actualiza el núcleo sin tocar tu .sdd/ ni settings
npx sdd-es doctor          # diagnostica la instalación
```

### Windows (PowerShell nativo)

```powershell
.\instalar.ps1             # proyecto actual
.\instalar.ps1 -Global     # global
# Si la política de ejecución lo bloquea:
powershell -ExecutionPolicy Bypass -File .\instalar.ps1
```

### macOS / Linux

```bash
bash instalar.sh           # proyecto actual
bash instalar.sh --global  # global
```

---

## 🔐 Seguridad (IMPORTANTE)

SDD-ES pide **tokens de GitHub y Vercel** para automatizar GitHub + deployment.

**Cómo SDD-ES cuida tu seguridad:**

- ✅ Tokens se usan en memoria, NUNCA se guardan en archivos
- ✅ `.gitignore` automático protege archivos sensibles
- ✅ Tokens se validan inmediatamente
- ✅ Instrucciones para revocar tokens si cometes un error

**Lee la guía de seguridad:** [docs/SEGURIDAD-PARA-NOTECNICOS.md](docs/SEGURIDAD-PARA-NOTECNICOS.md)

**IMPORTANTE:** No compartas tokens, no los guardes en archivos, no los commitess a GitHub.

---

## ¿Qué protege FORGE por defecto?

FORGE instala dos hooks de Claude Code que actúan como guardianes en cada acción del agente:

| Guardrail | Qué previene | ¿Bloquea o advierte? |
|---|---|---|
| Comandos destructivos | `rm -rf /`, `git reset --hard`, `DROP DATABASE` | Bloquea |
| Detección de secrets | Contraseñas, API keys, tokens hardcodeados en código | Bloquea |
| Agentes read-only | Arquitecto, crítico, revisor no pueden escribir archivos | Bloquea |
| Edit sobre archivo inexistente | Previene sobrescritura ciega | Bloquea |
| `git push`, `DROP TABLE`, `terraform apply` | Operaciones de riesgo moderado | Advierte |
| Memoria de decisiones | Registra qué modificó cada agente y por qué | Silencioso |
| ADR automáticos | Extrae decisiones de arquitectura de comentarios del código | Silencioso |

**Configura el comportamiento** con [`forge.config.json`](configuracion-ejemplo/forge.config.json) en la raíz del proyecto.
**Documentación completa:** [docs/guardrails.md](docs/guardrails.md)

---

## ¿Eres programador o no?

### 👨‍💻 Para programadores (modo experto)

Abre Claude Code en tu proyecto e inicia con lenguaje natural:

```
/sdd quiero crear una API REST con autenticación
```

El hub entiende tu intención y te guía al siguiente paso. Flujo técnico completo:

```
/sdd.constitucion            ← principios, stack, restricciones (solo primera vez)
/sdd.especificar [idea]      ← captura requirements con criterios de aceptación
/sdd.planificar              ← plan técnico con arquitectura
/sdd.planificar aprobar      ← apruebas el plan explícitamente
/sdd.tareas                  ← desglosa en tareas atómicas con agente asignado
/sdd.analizar                ← auditoría cruzada de consistencia
/sdd.implementar             ← agentes especializados lo construyen en paralelo
/sdd.qa                      ← QA en navegador real (Playwright)
/sdd.verificar               ← verificación final contra spec original
/sdd.desplegar               ← gate de calidad → health check → publica
```

**Docs técnicos:** [docs/FLUJO.md](docs/FLUJO.md) (comandos completos), [docs/INICIO-RAPIDO.md](docs/INICIO-RAPIDO.md) (ejemplos).

---

### 👤 Para no-programadores (modo guiado)

**Buenas noticias:** No necesitas saber programar. SDD-ES elige la tecnología automáticamente y te guía con lenguaje simple.

Flujo simplificado (sin jerga técnica):

1. **Describe tu idea:** "Una tienda donde vendo artesanías" (como hablarías con un amigo)
2. **SDD-ES entiende:** Crea un plan que tú apruebas
3. **Se construye:** 14 especialistas trabajan en paralelo (sin que hagas nada)
4. **Se verifica:** Pruebas automáticas comprueban que todo funciona
5. **Está en internet:** Tu app está viva en 15-20 minutos

**No ves:** comandos, jerga técnica, código, decisiones técnicas.
**Confirmas:** cada paso importante con "sí" o "cambio esto".

**Ejemplo completo:** Lee [docs/FABRICA.md](docs/FABRICA.md) — la historia real de Martina que pasó de idea a app en vivo sin saber programar.

**Resumen sin jerga:** [docs/SEGURIDAD-PARA-NOTECNICOS.md](docs/SEGURIDAD-PARA-NOTECNICOS.md)

### Crear una app desde cero

```
/sdd.crear-app quiero una app para anotar mis ideas diarias
```

### Crear una herramienta para Claude (servidor MCP)

```
/sdd.crear-mcp quiero una herramienta que consulte el precio del dólar
```

---

## Los 35 comandos

### Inicialización

| Comando | Descripción |
|---------|-------------|
| `/sdd` | Hub central — entiende lenguaje natural y enruta al comando correcto |
| `/sdd.constitucion` | Establece principios, stack y restricciones del proyecto |
| `/sdd.configurar` | Ajusta agentes activos y modelos asignados |
| `/sdd.descubrir` | Extrae contexto de una idea vaga — punto de entrada para proyectos nuevos |
| `/sdd.ayuda` | Guía completa de todos los comandos |

### Especificación

| Comando | Descripción |
|---------|-------------|
| `/sdd.especificar` | Convierte una intención en spec con criterios de aceptación testeables |
| `/sdd.importar` | Importa spec externa (URL, archivo) |
| `/sdd.aclarar` | Resuelve marcas `[NECESITA_ACLARACION]` de la spec |
| `/sdd.checklist` | Valida calidad formal de la spec |

### Planificación e implementación

| Comando | Descripción |
|---------|-------------|
| `/sdd.planificar` | Genera plan técnico |
| `/sdd.tareas` | Desglosa el plan en tareas atómicas con agente asignado |
| `/sdd.analizar` | Auditoría cruzada constitución↔spec↔plan↔tareas (con PTC paralelo) |
| `/sdd.implementar` | Ejecuta tareas con agentes especializados (con PTC paralelo) |
| `/sdd.qa` | QA en navegador real desde los Criterios de Aceptación (Playwright) |
| `/sdd.verificar` | Verificación final contra la spec original |

### Despliegue

| Comando | Descripción |
|---------|-------------|
| `/sdd.desplegar` | Gate de calidad → confirmación explícita → deploy → health check |
| `/sdd.canary` | Monitoreo post-deploy: rounds de health check con latencia |
| `/sdd.retro` | Retrospectiva del ciclo, registra aprendizajes en SNAPSHOT |

### Fábrica (idea → producto instalable)

| Comando | Descripción |
|---------|-------------|
| `/sdd.crear-app` | Genera app web o CLI desde descripción en lenguaje natural |
| `/sdd.crear-mcp` | Genera servidor MCP empaquetado como `.mcpb` instalable |

### Producto y dominio

| Comando | Descripción |
|---------|-------------|
| `/sdd.snapshot` | Actualiza SNAPSHOT.md con el estado actual del producto |
| `/sdd.glosario` | Gestiona términos del dominio |
| `/sdd.estado` | Dashboard de progreso |
| `/sdd.release` | Versión semántica + CHANGELOG desde specs completadas |

### Utilidades

| Comando | Descripción |
|---------|-------------|
| `/sdd.mapear` | Indexa estructura, símbolos y dependencias (ahorra tokens) |
| `/sdd.comprimir` | Comprime archivos de memoria para reducir tokens por sesión |

---

## Los 14 agentes especializados

| Agente | Rol | Modelo recomendado |
|--------|-----|--------------------|
| `arquitecto` | Decisiones técnicas de alto nivel | opus |
| `disenador-api` | Contratos OpenAPI / GraphQL / gRPC | sonnet |
| `asesor-datos` | Esquemas, queries, índices, migraciones | opus |
| `desarrollador-backend` | Lógica de servidor, servicios, APIs | sonnet |
| `desarrollador-frontend` | UI, componentes, estado cliente | sonnet |
| `operaciones` | CI/CD, deploy, infraestructura | sonnet |
| `tester` | Tests unitarios, integración, E2E | sonnet |
| `revisor` | Revisión cruzada contra spec y constitución | opus |
| `critico` | Riesgos, puntos ciegos, devil's advocate | opus |
| `seguridad` | Auditoría de vulnerabilidades | opus |
| `investigador` | Stack existente, deuda técnica, patrones | sonnet |
| `documentador` | Documentación técnica útil | sonnet |
| `product-designer` | Wireframes, UX, validación de diseño | opus |
| `architecture-designer` | Blueprints técnicos, diagramas de arquitectura | sonnet |

Cambia modelos y activa/desactiva agentes con `/sdd.configurar` o editando `.sdd/sdd.config.yaml`.

---

## Las 25 skills

| Skill | Formato | Qué hace |
|-------|---------|----------|
| `deteccion-stack` | `.md` | Detecta lenguaje, framework, plataforma de deploy |
| `gestion-estado` | `.md` | Lee y escribe `estado.json` con RAG en 3 capas |
| `validacion-spec` | `.md` | Verifica criterios de calidad de una spec |
| `enrutador-agentes` | `.md` | Asigna el agente correcto a cada tarea |
| `verificador-implementacion` | `.md` | Comprueba que el código cumple los CAs |
| `indexador` | `.md` | Genera mapas de estructura, símbolos y dependencias |
| `compresion-tokens` | `.md` | Reglas de compresión estilo caveman para Markdown |
| `constitucion-constraint` | `.md` | Aplica DEBE/NUNCA de la constitución como hard constraint |
| `modo-guiado` | `📁 SKILL.md` | Conduce el flujo sin jerga para no-programadores |
| `orquestacion-ptc` | `📁 SKILL.md` | Patrón PTC: despacha agentes en paralelo, reduce tokens de orquestación |

---

## Estándares de ingeniería incluidos

### Deploy verificado
`/sdd.desplegar` nunca declara éxito con el servicio caído:
1. Gate duro: tests verdes + spec verificada + constitución cumplida + sin secretos
2. Confirmación explícita obligatoria (el usuario escribe "desplegar")
3. Deploy vía agente `operaciones` (Vercel / Railway / Fly.io / Docker / K8s)
4. Health check post-deploy con latencia medida
5. Registro de URL en `estado.json`

### QA en navegador real
`/sdd.qa` genera casos E2E desde cada Criterio de Aceptación y los ejecuta en un navegador real vía Playwright MCP — no solo unitarios.

### Orquestación PTC
`/sdd.implementar` y `/sdd.analizar` usan Programmatic Tool Calling para despachar agentes independientes en paralelo, agregando solo PASA/FALLA + diff mínimo. El patrón reduce el contexto de orquestación multi-agente al enviar solo resúmenes de resultado en vez del output completo de cada agente.

### Sprint estructurado

| Fase | Comandos |
|------|----------|
| Pensar | `/sdd.constitucion`, `/sdd.descubrir` |
| Planear | `/sdd.especificar`, `/sdd.aclarar`, `/sdd.planificar`, `/sdd.analizar` |
| Construir | `/sdd.implementar` |
| Revisar | `/sdd.verificar` |
| Probar | `/sdd.qa` |
| Publicar | `/sdd.desplegar`, `/sdd.canary` |
| Reflexionar | `/sdd.retro`, `/sdd.snapshot` |

Cada flecha tiene un control. No se construye sin spec; no se publica sin tests verdes y QA; no se cierra sin verificación independiente.

---

## Estructura generada en tu proyecto

```
tu-proyecto/
├── .claude/
│   ├── commands/sdd.*.md     ← 35 comandos
│   ├── agents/*.md           ← 14 agentes
│   ├── skills/               ← 25 skills (flat .md + carpetas SKILL.md)
│   └── hooks/                ← hooks de seguridad pre-instalados
└── .sdd/
    ├── sdd.config.yaml       ← configuración personalizable
    ├── estado.json           ← estado global del flujo
    ├── INDICE.md
    ├── SNAPSHOT.md
    ├── memoria/
    │   └── constitucion.md   ← principios del proyecto
    ├── dominio/glosario.md
    ├── arquitectura/         ← ADRs
    ├── hooks/                ← tus hooks personalizados
    └── especificaciones/{ID}/
        ├── spec.md
        ├── plan.md
        ├── tareas.md
        ├── analisis.md
        ├── qa.md
        ├── verificacion.md
        └── .estado-tareas.json
```

---

## Personalización

Todo el plugin es Markdown plano. Personaliza editando archivos:

| Quieres cambiar… | Edita… |
|------------------|--------|
| Agentes activos / modelos | `.sdd/sdd.config.yaml` |
| Formato de spec / plan / tareas | `.sdd/plantillas/*.md` |
| Comportamiento de comandos | `.claude/commands/sdd.*.md` |
| Personalidad de agentes | `.claude/agents/*.md` |
| Integraciones (Git, Slack, CI…) | `.sdd/hooks/*.sh` |

---

## MCP integrado

SDD-ES declara un servidor MCP en `.mcp.json`:

| MCP | Cuándo se activa | Para qué |
|-----|-----------------|----------|
| `playwright` | `/sdd.qa`, palabras clave `e2e`, `prueba` | QA en navegador real sin mantener un navegador propio |

---

## Reducción de contexto

Las siguientes técnicas reducen el volumen de artefactos que Claude lee por sesión. Los números son estimaciones de bytes de artefactos generados, **no tokens de facturación medidos**.

| Técnica | Reducción de artefactos |
|---------|------------------------|
| Mapas estáticos (`/sdd.mapear`) | Reemplaza indexación completa en cada turno por un índice precalculado |
| Compresión caveman (`/sdd.comprimir`) | Reduce tamaño de archivos de memoria eliminando redundancias |
| RAG en 3 capas (estado.json → spec activa → constitución) | Carga solo lo necesario por fase en lugar del proyecto completo |
| PTC paralelo (`orquestacion-ptc`) | Agrega solo PASA/FALLA por agente en vez de output completo |

---

## Documentación

| Archivo | Contenido |
|---------|-----------|
| [docs/FABRICA.md](docs/FABRICA.md) | Recorrido idea→deploy para no-programadores |
| [docs/INICIO-RAPIDO.md](docs/INICIO-RAPIDO.md) | Primeros pasos |
| [docs/FLUJO.md](docs/FLUJO.md) | Sprint completo y diagrama del flujo |
| [docs/CASO-COMPLETO.md](docs/CASO-COMPLETO.md) | Ejemplo completo de principio a fin |
| [docs/EJEMPLOS.md](docs/EJEMPLOS.md) | Recetario de ejemplos y hooks |
| [docs/AGENTES.md](docs/AGENTES.md) | Cuándo usar cada agente |
| [docs/MODELOS.md](docs/MODELOS.md) | Recomendaciones de modelos por rol |
| [docs/PERSONALIZACION.md](docs/PERSONALIZACION.md) | Guía exhaustiva de personalización |
| [docs/EJEMPLOS.md](docs/EJEMPLOS.md) | Ejemplos por stack |
| [docs/FILOSOFIA.md](docs/FILOSOFIA.md) | Qué es SDD y por qué funciona con IA |

---

## Filosofía

SDD-ES no impone — recomienda. Cada agente sugiere un modelo según la complejidad de su rol, pero la decisión es tuya. Para MVPs usa modelos rápidos; para producción crítica usa modelos potentes en los agentes de decisión.

**Sin acoplamiento a Git/GitHub/GitLab.** Tu flujo de control de versiones es tuyo. Si quieres integrar Git, hazlo desde hooks (`.sdd/hooks/*.sh`).

---

## Arquitectura: FORGE como ACI (Agent-Computer Interface)

FORGE implementa las 6 capas del Agentic SDLC:

| Capa | Nombre | Implementación FORGE |
|---|---|---|
| L0 | Foundation Model | Claude Opus 4.8 / Sonnet 4.6 (routing dinámico) |
| L1 | Memory + Reflection | `.sdd/memoria/agente-*.md` + `agent-memory.js` |
| L2 | ACI | Comandos `/sdd.*` — traducen intent a operaciones concretas |
| L3 | Tools | Read, Write, Bash, Task — operaciones reales sobre filesystem |
| L4 | Orchestration | `sdd.implementar.md` — coordina 14 agentes especializados |
| L5 | Governance | `pre-tool-guard.js` + `post-write-conventions.js` — guardrails activos |

### L5 Guardrails — Qué protege FORGE por defecto

| Guardrail | Qué previene | Nivel |
|---|---|---|
| Bloqueo `rm -rf /`, `DROP DATABASE`, `push --force` | Destrucción irreversible | Duro (exit 2) |
| Detección secrets hardcodeados (8 patrones) | Leak de credenciales | Duro (exit 2) |
| Write con secret en contenido | Leak vía escritura de archivo | Duro (exit 2) |
| Agentes read-only no pueden Write/Edit | Aislamiento de roles | Duro (exit 2) |
| Advertencias git push, DROP TABLE, terraform | Operaciones de alto impacto | Advertencia (exit 0) |
| Captura automática de decisiones en memoria | Pérdida de contexto entre sesiones | Pasivo |
| Validación de convenciones post-write | Code style inconsistente | Configurable |

> **Tip de contexto**: ejecuta `/compact` (alias de `/sdd.comprimir aplicar`) cuando el indicador de contexto supere el 60%.
> FORGE genera archivos de observabilidad (`.sdd/observabilidad/`) que se excluyen
> automáticamente del contexto via `.claudeignore`.

---

## Contribuir

El plugin está diseñado para ser forkeado y personalizado. Si mejoras algo genérico, abre un PR.

---

## Licencia

MIT — úsalo, modifícalo, compártelo libremente.
