# Spike S0.6: configuraciones de herramientas que un agente puede reescribir hoy

> Experimento ejecutado (2026-10-17): `clasificarRuta` de `core/ciclo/protocolo-archivos.js:114-125` sobre nombres de archivo de herramientas, y `leerSeccion` de `core/ciclo/config.js` sobre un YAML de prueba. Sin Docker.

## Regla actual (`clasificarRuta`)

`configuracion` (pausa la tarea, no se escribe) si: algún segmento empieza por punto (`:121`); el nombre coincide con `CONFIGURACION` (`protocolo-archivos.js:54-65`: `*.config.{js,cjs,mjs,ts,cts,mts,json}`, `Makefile`, `Dockerfile*`, `docker-compose*`, `conftest.py`, `pytest.ini`, `tox.ini`, `jest.setup.*`, `vitest.workspace.*`, `karma.conf.*`, `CLAUDE.md`, `AGENTS.md`); o carpeta `__mocks__`. `dependencias` para `MANIFIESTOS` (`package.json`, `pyproject.toml`, `setup.cfg`, `go.mod`…).

## Resultado del experimento

| Archivo | Clasificación | Herramienta |
|---|---|---|
| `tsconfig.json`, `tsconfig.base.json`, `src/tsconfig.json`, `jsconfig.json` | **null (el agente puede escribirlos)** | tipos (la puerta `tipos`) |
| `biome.json` | **null** | linter/formato |
| `tslint.json` | **null** | linter |
| `mypy.ini`, `ruff.toml`, `pylintrc` | **null** | tipos/linter Python |
| `semgrep.yml`, `bandit.yaml` | **null** | seguridad |
| `codecov.yml`, `sonar-project.properties`, `deno.json` | **null** | cobertura/otros |
| `eslint.config.js`, `.eslintrc*`, `.flake8`, `.golangci.y*ml`, `.semgrep.yml`, `.coveragerc`, `.c8rc.json`, `.nycrc`, `.mocharc.json`, `jest.config.js`, `.bandit`, `.gitleaks.toml`, `.pylintrc`, `stylelint.config.js` | configuracion (protegido) | varios |
| `pyproject.toml`, `setup.cfg`, `package.json` | dependencias (protegido) | varias (incluye `[tool.mypy]`, `[tool.ruff]`, `eslintConfig`) |

Es decir, **confirmado**: el riesgo del plan §8 es real. La puerta de tipos más común, `tsconfig.json`, no está protegida (la doc lo dice con otras palabras: «una configuración que no esté en la lista se escribirá», `docs/ciclo-verificado.md:224`). Un implementador que debilite `strict` o añada `exclude` hace pasar la puerta. Igual `mypy.ini`, `ruff.toml`, `biome.json`.

## Qué proponer

1. Ampliar `CONFIGURACION` con: `tsconfig*.json`, `jsconfig*.json`, `biome.json`, `biome.jsonc`, `tslint.json`, `mypy.ini`, `ruff.toml`, `pylintrc`, `.pylintrc`, `semgrep*.y*ml`, `bandit*.y*ml`, `codecov.yml`, `sonar-project.properties`, `deno.json*`, `.editorconfig` (ya cubierto por el punto). Es una constante, test de tabla, cambio de bajo riesgo; afecta también al servidor MCP (`escribir_archivo` usa el mismo `aplicarArchivos`, `mcp/herramientas.js:152`).
2. Mejor que una lista: **ligar las protegidas a las puertas declaradas**. Si `puertas.tipos` es `tsc -p tsconfig.build.json`, ese archivo y los que referencie (`extends`) deberían protegerse aunque el nombre no esté en la lista. Hacerlo en `leerRutasProtegidas`/`vetadas` (`config.js:270-310`: hoy el proyecto solo puede AÑADIR rutas protegidas por `protecciones.no_tocar_archivos`), con la regla «solo aprieta». Parseo de `extends` = JSON con comentarios (tsconfig admite comentarios): sin confirmar viabilidad sin dependencias; empezar solo por el argumento `-p/--project` y `tsconfig*.json`.
3. Una puerta no debe leer configuración desde un archivo que el implementador pueda cambiar y que no esté en `no_cambiar` ni protegido: la prueba F8.1 (proyecto hostil) debe incluir «el implementador reescribe `tsconfig.json`».

## Lector de `sdd.config.yaml`: `#` y comillas

`leerSeccion` (`config.js:99-122`) usa `^\s{2}(clave)\s*:\s*([^#]+?)\s*(?:#.*)?$` y recorta una comilla inicial y una final por separado. Salida real:

| YAML | Valor leído | Consecuencia |
|---|---|---|
| `tipos: tsc -p "a b"` | `tsc -p "a b` (se pierde la comilla final) | `dividirComando` falla «comilla sin cerrar»: **se rechaza (falla cerrado), pero con un comando legítimo**. Hay que corregir el recorte (solo quitar comillas si envuelven todo el valor) o documentar no usar comillas internas. |
| `linter: eslint . # nota` | `eslint .` | correcto |
| `otra: x#y z` | `x` | **truncado en silencio** en el primer `#` aunque no vaya precedido de espacio; un comando con `#` en un argumento se acorta sin avisar (puede aflojar una puerta: p. ej. `semgrep --config a#b` → `semgrep --config a`). |
| `seguridad: 'semgrep --config x'` | `semgrep --config x` | correcto |
| `extra: "a: b"` | `a: b` | correcto |
| clave desconocida dentro de `puertas:` (p. ej. `otra:`) | se lee sin error | `leerConfigCiclo` solo recorre las claves de `POR_DEFECTO` (`config.js:313-318`); con la sección `puertas:` aún no definida, **`config.puertas` es `undefined` y todo se ignora en silencio**. CA-001-02 («clave desconocida es error con su línea») exige validar con la lista de claves aceptada; `leerSeccion` no da la línea (guarda solo clave/valor), habrá que ampliarlo como hace `clavesSinValor` (`config.js:~190`) o devolver el número de línea. |

## Qué cambia en la spec o el plan

- Plan §8, fila 1: el riesgo está confirmado; la respuesta es la ampliación (1) más la ligadura a puertas (2). Añadir tarea F1.5 «ampliar `CONFIGURACION`» o hacerlo parte de F7.4.
- F1.1/F1.4: el lector necesita (a) rechazar `#` pegado dentro de un valor de `puertas.*` en lugar de truncar (o exigir comillas), (b) quitar comillas solo si envuelven todo, (c) devolver línea por clave para el error de clave desconocida.
- CA-001-03 (ninguna clave afloja): incluir en la prueba exhaustiva que `sandbox.*` tiene techo (ver `varias-ejecuciones.md`).

## Riesgos

- Ampliar la lista pausa tareas de proyectos que hoy escriben `tsconfig.json` legítimamente (p. ej. al crear un proyecto TS desde cero): fricción real; puede suavizarse con «pausa solo si el archivo ya existía».
