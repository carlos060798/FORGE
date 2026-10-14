# Revisión de seguridad independiente 1 — rama worktree-agent-a4f9b4993a5909426

Veredicto: **APROBADA_CON_OBSERVACIONES** (un hallazgo MEDIA que conviene corregir antes de fusionar).

## Hallazgos

| # | Sev. | Archivo:línea | Descripción | Estado |
|---|------|---------------|-------------|--------|
| 1 | MEDIA | cli/index.js `leerInstalacionGuardada`/`resolverInstalacion`; core/instalacion/herramientas-destino.js `validarCarpetaSkills` | `instalacion.integracion/perfil/carpeta_skills` salen de `.sdd/sdd.config.yaml` (archivo del proyecto, no confiable) y deciden DÓNDE escribe `forge update`. Un repo hostil con `integracion: "generica"` y `carpeta_skills: "<home>/.claude/skills"` (ruta absoluta; se acepta cualquier cosa bajo la carpeta personal, incl. `.ssh`) hace que `forge update` escriba skills en la carpeta personal del usuario (persistencia de instrucciones en todos sus proyectos). Además `previa=true` desactiva `proteger`, así que PISA archivos del mismo nombre sin avisar. La raíz de escritura que se añade es la carpeta personal ENTERA. | CONFIRMADO (validarCarpetaSkills devuelve ok para `C:/Users/u/.claude/skills` y `.ssh`); el flujo `update` leído |
| 2 | BAJA | core/verificar/index.js:~115 (`motivo`) y resultado.js:~58 | `motivo` no pasa por `redactar` (sí comando, salida, avisos). Para `infraestructura` es la última línea de stderr: un secreto impreso ahí sale sin redactar. | SOSPECHADO (leído) |
| 3 | BAJA | core/verificar/index.js `carpetaDeVerificacion` | Carpeta `<tmp>/forge-verificar-<sha256(cwd)[0:16]>` predecible, creada con `mkdir -p` sin modo 0700 ni comprobar propietario/enlace. En un /tmp compartido (Linux) otro usuario puede pre-crearla o ponerla como enlace simbólico: lectura de la copia del código en staging, o desvío de escrituras. En Windows el temporal es por usuario: sin efecto. | SOSPECHADO |
| 4 | BAJA | core/session-budget.js:172 y claude-hooks/context-manager.js `umbral` | Ante conflicto FRAGUA_/FORGE_ la ruta "restrictiva" de los umbrales vuelve al valor por defecto (p. ej. 1.00 USD de bloqueo), que puede ser MÁS alto que el valor bajo que el usuario puso en una de las dos. Es entorno del usuario, no del proyecto; no ampliación por archivo ajeno, pero el cierre no es monótono. Para session-budget el fallback `'0'` depende de qué signifique 0 (revisar). | SOSPECHADO |
| 5 | BAJA | core/llm-providers/index.js `LOOPBACK` | `base_url` del proyecto con `http://localhost:<cualquier puerto>` se acepta y recibe la clave de OpenAI y el contenido: lo atiende cualquier proceso local. Aceptado por diseño; mitigable exigiendo puerto 11434 o que el usuario lo confirme. | CONFIRMADO (diseño) |
| 6 | BAJA | herramientas-destino.js | Nombres reservados de Windows (`nul`, `con`) aceptados como carpeta; no escapa del proyecto. | CONFIRMADO |

## Lo revisado sin hallazgo

| Área | Resultado |
|------|-----------|
| `destinoDeModeloPermitido` | Ejecutado: `127.0.0.1.evil.com`, `localhost.evil.com`, `localhost.` , `[::ffff:127.0.0.1]`, `0.0.0.0`, userinfo (`evil@localhost`, `https://evil.com@localhost`) -> false. `127.1`/`0x7f.1` se normalizan a 127.0.0.1 (true, correcto). Hosts vía `LLM_HOSTS` con conflicto FRAGUA/FORGE -> lista vacía. |
| `sanearConfigDelProyecto` | `provider` con espacios/mayúsculas (`" HTTP://evil.com "`) se elimina; `api_key`/`api_version` se borran; claves duplicadas: gana la última pero ya saneada; sangrías raras lanzan error. `provider` sin `://` válido no llega a fetch con host ajeno. |
| Providers | `redirect: 'error'` en openai y ollama. Sin otra lectura de `base_url`/`api_key` del proyecto (api_key sigue entrando por `opts.config`, solo de llamadores). OPENAI_BASE_URL/OLLAMA_BASE_URL/ANTHROPIC_BASE_URL son del entorno del usuario; no hay carga de dotenv. `anthropic-provider` solo lee `config.api_key` ya saneada. |
| Entorno | `leerVariable`: vacío vs valor -> conflicto; `normal`/`Normal` -> conflicto; solo `trim` se tolera. Listas en distinto orden/comas -> conflicto -> restrictivo (''). `NOMBRE_VARIABLE` y lista reservada cubren ambos prefijos (API_TOKEN, HOME, LLM_*, BUDGET_*). `sinVariable('API_TOKEN')` en core/api/servidor.js; el resto de lecturas directas (`process.env.ANTHROPIC_API_KEY`, `OLLAMA_BASE_URL`, `OPENAI_*`) no son FORGE_*. |
| verificar | `dividirComando` rechaza operadores antes de ejecutar; todo corre en Docker; sin modelo ni claves; candado con enlace duro y reclamación atómica; salida y comando redactados. |
| instalación | `..`, UNC, absolutas fuera de proyecto/home rechazadas (ejecutado). Escritura vía escritura-segura (no reauditada a fondo). Skills generadas son copia de comandos del plugin: sin instrucciones que desactiven controles detectadas en la muestra revisada (no se leyeron las 100+ skills completas). |

## Debe corregirse antes de fusionar

1. Hallazgo 1: ignorar `instalacion.carpeta_skills` absoluta o fuera del proyecto cuando viene del archivo del proyecto (solo aceptar `--carpeta-skills` de la línea de comandos para la carpeta personal); mantener `proteger` activo aunque `previa`; no añadir la carpeta personal completa como raíz (usar la propia carpeta).
2. Recomendado: redactar `motivo` (hallazgo 2) y crear la carpeta temporal con `mkdir 0700` + `lstat`/propietario (hallazgo 3).
