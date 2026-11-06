# Evaluación del marco FORGE/Fragua 5.0.0

Fecha: 2026-11-06. Revisión de solo lectura. Alcance: agents/, commands/, skills/, core/, cli/, claude-hooks/, docs/, tests/.
Nota: el directorio de agentes se llama `agents/` (no `agentes/`).

## Verificación ejecutada

- `npm test`: 4057 pruebas, 4025 pasan, 1 falla, 31 omitidas, 494 s. Falla el archivo completo `tests/verificar-mutacion.test.js` (110 s, sin mensaje: probable timeout o proceso colgado; no se diagnosticó para no repetir la suite).
- `npm run typecheck` (`tsc`): sin errores.
- Inventario real coincide con package.json:4: 14 agentes, 39 comandos, 31 skills (`skills/*/SKILL.md`) y 39 skills generadas (`skills-generadas/`).

## Calificaciones

| Área | Nota | Evidencia |
|---|---|---|
| Coherencia agentes/comandos/skills | B+ | Conteos exactos; pruebas F2.1-F2.3 (comando a skill, divergencia, paquete) pasan; `tests/agent-cabecera-tools.test.js`. Solapes en H-05 a H-07. |
| Calidad de prompts (muestreo) | B+ | Frontmatter completo con goal, backstory y límites de responsabilidad (`agents/critico.md:2-9`, `agents/arquitecto.md:2-9`). 12 de 14 agentes sin Write/Edit. |
| Duplicados y huecos | B- | `arquitecto` / `architecture-designer`; `deploy-vercel` / `vercel-deploy`; `sdd.optimizar` / `sdd.optimizar-memoria` / `sdd.comprimir` / `compact`. |
| Documentación vs código | B | Muy franca (`docs/PROBLEMAS-CONOCIDOS.md`, `GARANTIAS-Y-LIMITES.md`). Riesgo de desfase: 95 archivos en docs/; PROBLEMAS-CONOCIDOS describe el commit `82815b4` del 2026-10-12. |
| Cobertura de pruebas | A- | 4057 pruebas: unitarias, e2e (`tests/e2e/`), evals (`tests/evals/guardian.test.js`), mutación. Debilidad: 1 archivo en rojo, 31 omitidas. |
| Deuda técnica | C+ | `cli/index.js` 2243 líneas; `core/ciclo/mutacion.js` con parsers por regex de salidas de herramientas (líneas 678, 969, 988). Solo 15 TODO/FIXME. |
| Seguridad | C+ | H-01 a H-03. |
| Experiencia de uso | B+ | `--help`/`-h` (`cli/index.js:2222,2232`), `/sdd.ayuda`, `/forge ayuda` (:586), `doctor`, QUICK-START, guía para no técnicos. |

## Hallazgos priorizados

### Alto

**H-01. Las regex de `rm` y de `.env` son esquivables.** `claude-hooks/pre-tool-guard.js:53-56` usa `rm\s+-rf?\s+...`: cubre `-r` y `-rf`, pero no `-fr`, `-Rf`, `-r -f`, `--recursive --force`. Los patrones de `.env` (líneas 87-93) cubren echo/tee/cp/mv/editores, pero no `sed -i`, `python -c`, `node -e`. Acción: tokenizar el comando y normalizar banderas en lugar de regex; ampliar `tests/evals/casos-guardian.json` con variantes de evasión; dejar claro en `docs/GARANTIAS-Y-LIMITES.md` que el hook es red de seguridad y no un límite.

**H-02. El fallback sin Node es casi decorativo.** `claude-hooks/pre-tool-guard.sh:46-70` extrae `command` con grep sobre JSON (se rompe con comillas escapadas, lo normal en comandos reales) y usa una lista mínima. Además el wrapper acepta Node >=18 mientras `package.json` exige >=20. Acción: fallar cerrado para Bash si no hay Node, o avisar en `doctor`; unificar versión mínima.

**H-03. El hook falla abierto con entrada malformada.** `pre-tool-guard.js:197-203`: si el JSON no se parsea, `exit(0)`. Razonable para no romper la sesión, pero sin rastro. Acción: registrar el evento en la auditoría y bloquear si se pudo identificar una herramienta Bash.

**H-04. La suite del propio paquete no está verde.** `tests/verificar-mutacion.test.js` falla (110 s) y `prepublishOnly` ejecuta `npm test` (package.json), así que bloquea publicar. Acción: reproducir con `node --test tests/verificar-mutacion.test.js`, decidir si es timeout de entorno o regresión, fijar timeout explícito o mover a `test:lento`.

### Medio

**H-05. Solape `arquitecto` / `architecture-designer`.** Ambos deciden stack/estructura (`agents/arquitecto.md:3`, `agents/architecture-designer.md:3`). Se separan por fase, pero un usuario no técnico no lo distingue. Acción: tabla de desambiguación en `docs/INVENTARIO-AGENTES-Y-SKILLS.md` y en ambas descripciones.

**H-06. Skills de despliegue duplicadas.** `skills/deploy-vercel`, `skills/vercel-deploy` y `sdd.desplegar`. Acción: consolidar y dejar un alias documentado.

**H-07. Cuatro comandos de ahorro de contexto sin frontera clara.** `sdd.comprimir`, `sdd.optimizar`, `sdd.optimizar-memoria`, `compact`, más skills `compresion-tokens`, `memory-compactor`, `token-budget`, `cache-audit`. Acción: matriz «cuándo usar cuál» y reducir.

**H-08. Idioma mezclado.** Nombres como `architecture-designer`, `product-designer`, `effort-router`, `token-budget` contradicen «marco en español». Acción: política de nomenclatura en CONTRIBUTING.md y alias.

**H-09. `cli/index.js` monolítico (2243 líneas).** Dificulta pruebas y revisión por subcomando. Acción: dividir en `cli/comandos/`, con `dispatch.js` y `runner.js` como modelo.

**H-10. Validación operativa limitada.** `docs/PROBLEMAS-CONOCIDOS.md` ("Antes de nada"): aislamiento probado solo en Windows con Docker Desktop; gasto nunca comparado con una factura; evidencia con modelo real de 24 ejecuciones y un solo proveedor. Acción: matriz en CI Linux antes de publicar 5.0.0.

### Bajo

**H-11.** Pares `.sh`/`.js` duplicados en hooks (agent-memory, post-write-conventions, pre-tool-guard). Acción: wrappers delgados o misma batería de pruebas para ambos.

**H-12.** `docs/` con 95 archivos y planes antiguos (`PLAN-DE-CIERRE.md`, `PLAN-FLUJO-AI-NATIVO.md`). Acción: fecha de vigencia en cada archivo y mover obsoletos a `archivo/`.

**H-13.** Errores de auditoría silenciados (`pre-tool-guard.js:459-463`). Acción: avisar una vez por sesión.

**H-14.** 31 pruebas omitidas. Acción: listar motivo (Docker, Go, Python) en `docs/COBERTURA.md`.

## Puntos fuertes

- Conteos coherentes y verificados por pruebas; tsc limpio; 99,2 % de pruebas en verde.
- Documentación honesta sobre límites.
- Agentes revisores y críticos con herramientas acotadas y fronteras de responsabilidad explícitas.

## Plan de acción

1. Semana 1: H-04, H-01, H-02, H-03 (suite verde y guardia endurecida con casos de evasión).
2. Semana 2: H-05, H-06, H-07 (desambiguar y consolidar).
3. Semana 3: H-10 (CI Linux) y H-09 (dividir CLI).
4. Continuo: H-08, H-11 a H-14.

## Limitaciones

No se repitió la suite ni se diagnosticó la falla de `verificar-mutacion`. La calidad de prompts es por muestreo (critico, arquitecto, architecture-designer, token-budget, sdd.md), no lectura completa de los 14 agentes y 39 comandos.
