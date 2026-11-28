# ADR-33: Retirada de la dependencia `@sqlite.org/sqlite-wasm`

> Estado: propuesta  # propuesta | aceptada | obsoleta | reemplazada-por-ADR-XX
> Fecha: 2026-11-27
> Spec relacionada: 2026-11-27-honestidad-documental-2 (I6, número de dependencias); plan consolidado de modos y componentes, §6 («ADR Retirada de `sqlite-wasm`»)
> Autor: Claude (pendiente de aceptación por el dueño)
> Evidencia: búsqueda en el árbol de trabajo el 2026-11-27, descrita abajo. No se instaló nada ni se ejecutó `npm test` en esta redacción.

## Contexto

El Principio IV de la constitución dice que toda dependencia nueva exige un ADR y que el paquete «tiene dos dependencias» (`.sdd/memoria/constitucion.md`, Principio IV). `package.json` declara **tres** en `dependencies`: `@anthropic-ai/sdk`, `@sqlite.org/sqlite-wasm` y `acorn` (`package.json:83-87`). Ningún ADR justifica `@sqlite.org/sqlite-wasm`: ni el ADR-14 (índice vectorial propio, que se hizo precisamente «sin dependencias nuevas») ni ningún otro lo nombra (búsqueda de `sqlite-wasm` en `.sdd/`: sin resultados en la constitución, las especificaciones ni los ADR; solo aparece `sqlite` genérico en ADR-04 y ADR-23). Es un incumplimiento silencioso del principio.

**Comprobación de que no se usa.** El 2026-11-27 se buscó `sqlite-wasm` y `sqlite.org` en todo el árbol de trabajo (excluyendo `node_modules`, `package-lock.json` y `docs/archivo/`):

- En código (`*.js`, `*.mjs`, `*.cjs`, `*.ts`): **ninguna importación ni referencia**. La única coincidencia con «wasm» en un `.js` es texto de documentación dentro de `docs-site/assets/data.js`.
- Las coincidencias están todas en prosa y metadatos: `package.json:85`, `package-lock.json:13` y `:58-60`, `CONTRIBUTING.md:20` y `:103`, `SECURITY.md:72`, `docs/mapa-de-modulos.md:31`, `docs/informes/SEGURIDAD-CIBER.md:161`, `docs/PROBLEMAS-CONOCIDOS.md:484` y `docs-site/assets/data.js:68`, `:107`, `:1833` y `:1944`.
- Lo que sí usa SQLite el código es el módulo nativo `node:sqlite`, cargado de forma perezosa y solo en Node ≥22.5, con alternativa en archivos: `core/decisions/decision-store.js:22-31`, `claude-hooks/agent-memory.js:258-273`, `claude-hooks/shared/config.js:61-78`. No pasa por el paquete de npm.
- En el archivo de bloqueo, el paquete solo lo exige el proyecto raíz (`package-lock.json:13`) y declara `engines.node >=22` (`package-lock.json:58-68`), por encima del mínimo del proyecto (`package.json:28-30`: Node ≥20), que el Principio IV pide evitar para dependencias de ejecución.
- [NV] No se pudo ejecutar `npm ls` ni una instalación limpia (no hay `node_modules` en el árbol de trabajo): que ningún otro paquete lo necesite se deduce del archivo de bloqueo, no de una instalación.

## Decisión

Retirar `@sqlite.org/sqlite-wasm` de `dependencies` en `package.json` y de `package-lock.json`, y corregir los documentos que lo listan, de modo que el paquete quede con dos dependencias de ejecución (`@anthropic-ai/sdk` y `acorn`), como ya afirma el Principio IV.

La memoria con SQLite sigue siendo opcional y se apoya en `node:sqlite` (Node ≥22.5), sin cambios.

## Alternativas consideradas

- **A. Dejarla y justificarla con un ADR retroactivo**: rechazada. No se usa; justificar una dependencia sin uso solo documenta un error y pesa en cada instalación y en cada auditoría de dependencias.
- **B. Mantenerla y enmendar el Principio IV a «tres dependencias»**: rechazada. Convierte el incumplimiento en norma sin que nada lo necesite.
- **C. Retirarla (elegida)**: aceptada porque restablece el principio, quita una dependencia con requisito de runtime superior al mínimo y reduce la superficie de cadena de suministro.

## Consecuencias

### Positivas
- La afirmación de la constitución («dos dependencias») pasa a ser cierta; se cierra una de las inconsistencias de la spec `2026-11-27-honestidad-documental-2` (I6).
- Menos tamaño de instalación y menos código de terceros que auditar.
- Sin cambio de comportamiento: ningún módulo la importa.

### Negativas
- Hay que editar los documentos que listan tres dependencias: `CONTRIBUTING.md:20` y `:103`, `SECURITY.md:72`, `docs/mapa-de-modulos.md:31` y `docs-site/assets/data.js` (cuatro sitios, en español y en inglés). Los informes con fecha (`docs/informes/SEGURIDAD-CIBER.md`, `docs/PROBLEMAS-CONOCIDOS.md`) no se reescriben; llevan una nota de que quedó superado.
- Quien la usara por fuera del repositorio, importándola desde `node_modules` de este paquete, dejaría de tenerla. No es interfaz pública: no está documentada como tal [NV: no se buscó en el exterior].
- Cambia `package.json` y el archivo de bloqueo; la seguridad de `npm ci` y la matriz de CI deben volver a pasar.

### Neutrales
- Retirar una dependencia no rompe la interfaz pública (`forge run`, `forge resume`, formato de `.sdd/`), así que no exige versión MAYOR (Principio X).
- La constitución no cambia. Si el dueño acepta, la enmienda de la razón del Principio IV ya no hace falta (`docs/PROBLEMAS-CONOCIDOS.md:484` la proponía como corrección PATCH).

## Cuándo revisitar

Si una funcionalidad futura necesitara SQLite en Node 20 o 22.0-22.4 sin alternativa en archivos, se abre un ADR nuevo que la justifique, la haga opcional y perezosa, y diga qué requisito de runtime añade.

## Referencias

- `.sdd/memoria/constitucion.md` (Principio IV); `package.json:83-87`; `package-lock.json:13`, `:58-68`.
- `core/decisions/decision-store.js:22-31`; `claude-hooks/agent-memory.js:258-273`; `claude-hooks/shared/config.js:61-78`.
- ADR-14 (precedente: capacidad resuelta sin dependencia nueva).
- `docs/PROBLEMAS-CONOCIDOS.md:484`; `reports/Plan consolidado de modos y componentes Forja.md` §6.
