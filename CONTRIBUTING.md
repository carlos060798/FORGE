# Contribuir a Fragua (FORGE)

Gracias por querer mejorar el proyecto. Esta guía dice cómo se trabaja de verdad en este repositorio: no hay atajos aparte de los que describe.

Antes de empezar, dos avisos de honestidad:

- El proyecto está en **pre-beta** y hoy lo mantiene **una sola persona** ([GOVERNANCE.md](GOVERNANCE.md)). No hay plazo garantizado de revisión: una PR puede tardar. Una PR pequeña, con spec y pruebas, es la que más rápido se puede revisar.
- Participar implica respetar el [código de conducta](CODE_OF_CONDUCT.md).

Documentos hermanos: [AGENTS.md](AGENTS.md) (reglas y convenciones, léelo entero), [REVIEW.md](REVIEW.md) (con qué criterios se revisa tu cambio), [SUPPORT.md](SUPPORT.md) (dónde preguntar), [SECURITY.md](SECURITY.md) (vulnerabilidades: nunca por incidencia pública).

---

## Primera contribución: un cambio de documentación en 15 minutos

Para corregir una errata, un enlace roto o una frase desfasada en `docs/`, `README.md` o similares no hace falta spec ni ADR.

1. Haz un fork de https://github.com/carlos060798/FORGE y clónalo.
2. Necesitas Node.js ≥ 20 (`node --version`). No necesitas Docker, ni Claude Code, ni claves de modelos.
3. `npm install` (instala `@anthropic-ai/sdk`, `@sqlite.org/sqlite-wasm`, `acorn` y las herramientas de tipos).
4. Crea una rama y edita el archivo. Respeta el español del resto del documento.
5. Si tocas cifras («14 agentes», «39 comandos», «31 skills») o enlaces, ejecuta `node --test tests/consistencia-cifras.test.js`: comprueba que las cifras de los documentos coinciden con el disco y que los enlaces relativos de los índices existen.
6. Ejecuta `npm run test:rapido` (salta los archivos lentos).
7. Abre la PR contra `main` y rellena la plantilla. Una afirmación nueva en un documento debe poder comprobarse en el código: «ningún documento afirma una capacidad que el código no tiene» (AGENTS.md).

Si no estás seguro de si algo es un error, abre antes una incidencia (ver [SUPPORT.md](SUPPORT.md)).

---

## Preparar el entorno

```bash
git clone https://github.com/<tu-usuario>/FORGE.git
cd FORGE
npm install
npm test
```

- Node.js ≥ 20. La CI prueba Node 20 y 22 en Linux y Node 22 en Windows.
- Docker solo es necesario para las pruebas de aislamiento real. Sin Docker esas pruebas se saltan solas.
- Windows y Linux/macOS son plataformas de primera clase: las rutas con `\` y `/` y las mayúsculas en Windows y macOS son casos de revisión (REVIEW.md). En Windows, crear enlaces simbólicos de archivo puede estar prohibido: las pruebas afectadas se marcan «NO VERIFICADO» en vez de pasar en silencio. En Windows usa PowerShell o Git Bash; las órdenes `npm` son las mismas.
- Para variables de entorno de una orden: en Bash `FORGE_TEST_DOCKER=1 npm test`; en PowerShell `$env:FORGE_TEST_DOCKER = "1"; npm test`.

---

## El flujo de un cambio

Es el de [AGENTS.md](AGENTS.md), sección «Cómo se cambia algo». Resumen:

1. **Todo cambio empieza por una especificación** en `.sdd/especificaciones/<AAAA-MM-DD-slug>/spec.md`, a partir de [plantillas/especificacion.md](plantillas/especificacion.md). La spec dice qué se pide y por qué; no nombra lenguajes, bibliotecas ni herramientas. Mira las existentes en `.sdd/especificaciones/` como ejemplo y añade tu fila a [.sdd/INDICE.md](.sdd/INDICE.md).
2. **La aprobación es del dueño del proyecto.** Ningún agente ni comando marca una aprobación por su cuenta, y tampoco tú: propón la spec en la PR o en una incidencia y espera. Mientras no esté aprobada, su estado es `borrador`.
3. **Las pruebas se escriben antes que el código.** Son obligatorias para enrutado, presupuesto, política de aislamiento y confinamiento de rutas. Una prueba nueva debe fallar sin tu cambio. No debilites pruebas existentes para que pasen.
4. **ADR para toda decisión técnica no trivial**, en `.sdd/arquitectura/ADR-NN-slug.md` (plantilla: [plantillas/decision-arquitectura.md](plantillas/decision-arquitectura.md)). `NN` es el siguiente número libre de esa carpeta: míralo el día que escribas (hoy el último es el ADR-24). La fecha va en la cabecera. Una dependencia nueva siempre exige un ADR.
5. **Cierre:** el `verificacion.md` de la spec dice, criterio a criterio, qué tiene prueba, qué quedó a medias y qué no se hizo. Cada criterio `CA-NNN-NN` debe tener una prueba que lo cite (`npx fragua verificar --criterios`; lo ejecuta el job `evidencia`).
6. Actualiza [CHANGELOG.md](CHANGELOG.md) si el cambio es visible para quien usa el paquete.

Cambios muy pequeños (errata, corrección evidente de un mensaje) no necesitan spec propia; si dudas, pregunta en la incidencia.

---

## Comprobaciones antes de abrir la PR

| Orden | Para qué |
|---|---|
| `npm run test:rapido` | Mientras trabajas: salta los archivos de `tests/lentos.txt` |
| `npm test` | Suite completa (`scripts/pruebas.mjs todo`). Es la que corre la CI. Úsala antes de entregar |
| `npm run typecheck` | `tsc` sobre `core/**/*.js` con JSDoc. Debe terminar con 0 errores |
| `node --test tests/<módulo>.test.js` | Un archivo suelto |
| `FORGE_TEST_DOCKER=1 npm test` | Solo si tienes Docker en marcha: ejecuta también las pruebas de aislamiento real |

Las pruebas no llaman a modelos de pago: usan el proveedor de pruebas (`FORGE_LLM_PROVIDER=stub`) y dobles. No añadas una prueba que necesite una clave, y no simules el sistema de archivos (usa directorios temporales).

### La cuarentena de pruebas (ADR-23)

Una prueba que falla solo bajo carga o por el entorno, y pasa aislada, se puede apartar en `tests/cuarentena.txt` **solo** con una incidencia abierta que la nombre. El formato de línea es `ruta | #N | AAAA-MM-DD | motivo`. `npm test` la excluye; `npm run test:cuarentena` (job `cuarentena` de la CI, no bloqueante) la sigue ejecutando. Caduca a los 30 días, hay un tope de 5 y sale cuando pasa tres veces seguidas en ese job. No se suben tiempos límite a ciegas ni se reintentan pruebas.

### Qué CI debe pasar

Jobs de [.github/workflows/ci.yml](.github/workflows/ci.yml):

| Job | Qué comprueba | ¿Bloquea? |
|---|---|---|
| `test` | `npm test` en Node 20 y 22 (Linux), sin Docker real | Sí |
| `test-windows` | `npm test` en Windows, Node 22, sin Docker real | Sí |
| `tipos` | `npm run typecheck` | Sí |
| `evidencia` | Criterios de aceptación con prueba citada y cadena de evidencia, sin modelo | Sí |
| `aislamiento` | `tests/sandbox-real.test.js` con Docker real en Linux | Sí |
| `pruebas-docker` | Todos los archivos que usan `FORGE_TEST_DOCKER`, uno a uno | Sí |
| `cuarentena` | Pruebas apartadas | No (`continue-on-error`) |

Estado honesto: la CI de `main` ha estado en rojo en Linux ([docs/ESTADO-ACTUAL.md](docs/ESTADO-ACTUAL.md)). Si tu PR falla en un job que parece ajeno a tu cambio, dilo en la PR; no lo ocultes ni lo silencies. Las acciones de GitHub van fijadas por SHA de commit (`tests/endurecimiento-f3.test.js` lo exige); si añades o actualizas una, usa el SHA con el comentario de versión.

---

## Convenciones

Fuente: [AGENTS.md](AGENTS.md) y [.sdd/memoria/constitucion.md](.sdd/memoria/constitucion.md), que manda si hay diferencias.

- **Idioma:** español en artefactos, mensajes al usuario, comentarios y nombres del dominio.
- **Nombres:** archivos `kebab-case.js`; variables `camelCase`; constantes `MAYUSCULAS_CON_GUION_BAJO`; clases y tipos `PascalCase`.
- **Módulos:** ESM puro (`import`/`export`), Node ≥ 20, sin paso de compilación. Tipos en JSDoc, opcionales. No hay linter ni formateador, y no se inventa uno sin un ADR.
- **Pruebas:** `node:test` nativo, un archivo `tests/<módulo>.test.js` por módulo de `core/`.
- **Dependencias:** hoy `@anthropic-ai/sdk`, `@sqlite.org/sqlite-wasm` y `acorn` (más `typescript` y `@types/node` solo para desarrollo). Ninguna dependencia nueva sin un ADR; las pesadas son opcionales y se cargan de forma perezosa. No se sube el mínimo de Node (≥ 20) sin versión MAYOR. Los hooks de `claude-hooks/` usan solo módulos `node:`.
- **Restricciones no negociables** (no ejecutar código de un modelo en el anfitrión con el ciclo activo, no escribir secretos en registros, no degradar en silencio, no fijar un proveedor de modelos en un módulo, etc.): lista completa en AGENTS.md, sección «Restricciones».
- **Comentarios:** solo los porqués no obvios.
- Versionado y publicación: [VERSIONING.md](VERSIONING.md) y [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md). Subir versión o publicar es decisión del dueño.

---

## Cómo añadir un agente

Un agente es un archivo Markdown en `agents/`. No hay plantilla de agente en `plantillas/`: copia uno existente parecido (por ejemplo `agents/revisor.md`) y respeta su cabecera. Guía de uso y de ejemplos: [docs/extending-forge.md](docs/extending-forge.md); referencia de agentes: [docs/agents.md](docs/agents.md).

Pasos que las pruebas exigen:

1. Crea `agents/<nombre>.md`. Cabecera YAML con `name` igual al nombre del archivo, `description` no vacía, `model` en `opus | sonnet | haiku` y `tools` como lista entre corchetes (`["Read", "Grep"]`) no vacía (`tests/catalogo.test.js`, `core/agent-registry.js`).
2. Declara el agente en `agents` de [.claude-plugin/plugin.json](.claude-plugin/plugin.json) (`tests/consistency.test.js`, bloque 7).
3. Añade su entrada en [configuracion-ejemplo/sdd.config.yaml](configuracion-ejemplo/sdd.config.yaml) (`<nombre>:` en la sección de agentes).
4. Menciónalo en [commands/sdd.ayuda.md](commands/sdd.ayuda.md).
5. Si el agente cita `skills/<x>.md`, esa skill debe existir: la prueba falla si no.
6. Actualiza las cifras («N agentes») en `README.md`, `package.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `docs/introduction.md`, `docs/GLOSARIO.md`, `docs-site/assets/data.js` y `docs-site/index.html`: `tests/consistencia-cifras.test.js` las compara con el disco. (`docs/0-INDICE.md` también se comprueba.)
7. Si el agente es de solo lectura, añádelo a `READ_ONLY_AGENTS` en `claude-hooks/pre-tool-guard.js`; si necesita memoria, a `AGENTES_CON_MEMORIA` en `claude-hooks/agent-memory.js`. El reparto entre solo lectura y escritura también lo comprueba la prueba de cifras.
8. Escribe las pruebas de lo que añada comportamiento. Los criterios del rol no solapado con agentes existentes los revisa la persona que mantiene el proyecto.

Para proponer un agente sin implementarlo, usa la plantilla de incidencia «Propuesta de agente».

## Cómo añadir un comando

1. Crea `commands/<nombre>.md` (por ejemplo `sdd.algo.md`). La cabecera YAML lleva `description` no vacía y `allowed-tools` no vacío (`tests/catalogo.test.js`).
2. Declara el comando en `commands` de `.claude-plugin/plugin.json` (`tests/consistency.test.js`: todo comando en disco debe estar declarado y viceversa).
3. Menciónalo en `commands/sdd.ayuda.md` y mapéalo en `commands/sdd.md` (los comandos `sdd.*` los exige `tests/commands.test.js`).
4. Cada comando tiene una skill generada: ejecuta `npm run generar-skills`, que escribe `skills-generadas/<nombre>/SKILL.md`. No se editan a mano; `node scripts/generar-skills.mjs --verificar` sale con 1 si lo que hay en disco diverge. El perfil de instalación `esencial` (ADR-24) instala solo seis comandos: no añadas a él sin decisión.
5. Actualiza las cifras («N comandos») como en el caso de un agente.

## Cómo añadir una skill

1. Crea `skills/<nombre>/SKILL.md` (o `skills/<nombre>.md`). La cabecera exige: `name` igual al nombre de la carpeta (minúsculas, números y guiones, hasta 64), `description` de 80 a 1024 caracteres, `allowed-tools` explícito y no vacío, y `model` solo `opus | sonnet | haiku` si aparece (`tests/catalogo.test.js`).
2. Declárala en `skills` de `.claude-plugin/plugin.json`.
3. Actualiza las cifras («N skills») y, si el inventario lo lista, `docs/INVENTARIO-AGENTES-Y-SKILLS.md`.

## Cómo añadir un proveedor de modelos

La guía completa es [docs/guia-anadir-proveedor.md](docs/guia-anadir-proveedor.md). En corto: implementar el contrato de `core/llm-providers/provider-interface.js`; pasar la batería común `tests/proveedores-conformidad.test.js` (servidores falsos, sin red ni claves) añadiendo un adaptador y, si habla HTTP, su formato en `tests/fixtures/proveedores/servidor-falso.js`; declarar los precios solo si están contrastados con la tarifa oficial (`core/precios.js`); y mientras no se pruebe con un modelo real, la documentación dice «sin probar con modelo real». Nunca se fija un proveedor en un módulo, y la clave se redacta en cualquier error. Una dependencia nueva para el proveedor exige un ADR.

---

## Cómo reportar un bug

Mira primero [docs/PROBLEMAS-CONOCIDOS.md](docs/PROBLEMAS-CONOCIDOS.md). Después abre una incidencia con la plantilla [Reporte de bug](.github/ISSUE_TEMPLATE/bug_report.md) o, si el fallo es del ciclo verificado, del CLI, del servidor MCP o de la API, con [Reporte de fallo](.github/ISSUE_TEMPLATE/fallo.md) (pide la versión de Docker, el comando y el fragmento de `.sdd/events.jsonl`, y avisa de qué revisar para no publicar secretos). Incluye siempre la versión de Fragua, la de Node y el sistema operativo, el comando que falló y la salida de `node cli/index.js doctor`.

**Una vulnerabilidad no se reporta por incidencia pública**: usa el aviso privado descrito en [SECURITY.md](SECURITY.md).

## Proceso de revisión

1. Abre la PR contra `main` y rellena la plantilla.
2. La CI se ejecuta automáticamente. Los jobs bloqueantes están en la tabla de arriba.
3. La persona que mantiene el proyecto revisa con [REVIEW.md](REVIEW.md): corrección, seguridad y cumplimiento de la spec. **No hay plazo garantizado**; si pasan semanas sin respuesta, puedes dejar un comentario en la PR.
4. La aprobación final es siempre de una persona. Se pueden pedir cambios.

---

## Licencia

Al contribuir aceptas que tu aportación se distribuya bajo la [licencia MIT](LICENSE).
