# Checklist de release FORGE

## Pre-publish
- [ ] `npm run typecheck` — sin errores. **Hoy pasa**: 0 errores el 2026-10-12 en `82815b4` (eran 36 el 2026-10-10). Lo ejecuta el job `tipos` de CI, que no ha corrido (`npm run build` es un `echo` y no comprueba nada)
- [ ] `npm test` — todos pasando, 0 fallos (con `FORGE_TEST_DOCKER=1` si hay Docker)
- [ ] CI en verde sin Node 18: el job `test` (matriz de Node 20 y 22, `npm test` completo sin Docker), el job `tipos`, **y los jobs `aislamiento` y `pruebas-docker`, con Docker real en Linux** (ninguno ha corrido nunca)
- [x] `forge probar-modelo` ejecutado con un modelo real y el informe revisado (2026-10-09: `.sdd/especificaciones/2026-10-09-validacion-modelo-real/evidencia-2026-10-09.md`)
- [ ] Gasto calculado comparado con el facturado por el proveedor (la lista de `core/precios.js` se contrastó el 2026-10-09 con la tarifa publicada, no con una factura)
- [ ] Versión en package.json, plugin.json, marketplace.json y README coinciden (5.0.0), también `docs-site/assets/data.js` y `docs-site/index.html`
- [ ] CHANGELOG.md actualizado
- [ ] Branch mergeada a main

## Publish
- [ ] `npm pack --dry-run` — verificar archivos incluidos
- [ ] `npm publish --access public`

## Post-publish
- [ ] `npx -p forja-mvp@latest forge init` en proyecto de prueba (el paquete es `forja-mvp`: `npx forge@latest` descargaría otro paquete de npm llamado `forge`)
- [ ] `forge doctor` sin errores críticos
- [ ] Tag git: `git tag v5.0.0 && git push --tags`

---

## Beta

Una beta es una versión para que la prueben otras personas **sin que la reciba quien instala `forja-mvp` sin más**. Se publica con la etiqueta `beta` de npm y `latest` se queda donde está (4.2.0, consultado el 2026-10-10 con `npm view forja-mvp dist-tags`).

Nada de esta sección se ha ejecutado. Publicar y cambiar la versión del paquete son decisiones del dueño.

### Criterios de salida

Los seis tienen que cumplirse sobre **el mismo commit**, que es el que se publica. La columna «Hoy» es el estado del 2026-10-12 en el commit `82815b4` (la versión anterior de este documento lo describía el 2026-10-10 en `9180814`).

| # | Criterio | Cómo se mide | Hoy |
|---|---|---|---|
| B1 | **Integración continua en verde en Linux**: matriz `test` (Node 20 y 22), `tipos`, `aislamiento` y `pruebas-docker` | Las cinco comprobaciones de `.github/workflows/ci.yml` (`Tests (Node 20)`, `Tests (Node 22)`, `Tipos (Node 22)`, `Aislamiento con Docker real` y `Pruebas con Docker real`) en verde sobre ese commit, tras abrir la solicitud de cambio hacia `main`. `aislamiento` ejecuta `tests/sandbox-real.test.js`; `pruebas-docker` ejecuta, con `FORGE_TEST_DOCKER=1` y un archivo cada vez, todos los de `tests/` que mencionan esa variable (16 hoy, descubiertos por `grep`), con 60 minutos como máximo. Hay que anotar cuántas pruebas omitió | ❌ No han corrido nunca (los jobs `tipos` y `pruebas-docker` se añadieron el 2026-10-12 y no se pudieron ejecutar fuera de GitHub Actions) |
| B2 | **Suite con 0 fallos en tres pasadas seguidas** | `npm test` tres veces seguidas, sin tocar nada entre ellas, en el mismo equipo: `fail 0` en las tres. Lo mismo con `FORGE_TEST_DOCKER=1` en un equipo con Docker. Se anotan equipo, versión de Node, fecha y los totales de cada pasada. Una pasada con un fallo reinicia la cuenta | ⚠️ Sin Docker, en Windows: tres pasadas seguidas con 0 fallos el 2026-10-10 sobre `9180814` (ver «Registro de pasadas»); el 2026-10-11 hubo otra, con 0 fallos, de la que solo constan los totales (PLAN). **Desde entonces el árbol cambió** (correcciones de la tercera revisión y las integraciones externas): no hay tres seguidas sobre `82815b4`. Con Docker: sin hacer; la única pasada completa registrada, del 2026-10-09, tuvo un fallo |
| B3 | **Conjunto de tareas reales con su tasa de éxito** | Una lista fija de tareas guardada en el repositorio (propuesta: al menos 20; los tres lenguajes cubiertos; al menos la mitad sobre código que ya existe y alguna de varios archivos). Cada una se ejecuta una vez con los niveles de modelo por defecto y un tope de gasto fijo. Se anota por tarea: resultado, iteraciones, gasto y motivo de la pausa si la hubo. Tasa de éxito = tareas que terminan en `exito` sin ninguna decisión humana, entre el total. **El umbral lo fija el dueño antes de ejecutar** (propuesta: 80 %), y se publica la tasa obtenida sea cual sea | ❌ El conjunto no existe. Las ejecuciones del 2026-10-09 fueron exploratorias, con el código cambiando entre rondas: no dan una tasa |
| B4 | **Gasto calculado dentro del 5 % del facturado** | Con una clave usada solo para esto: suma del gasto de `.sdd/motor/<sesión>/gasto.jsonl` de las sesiones de B3, frente a lo que muestra la consola del proveedor para esa clave y ese periodo. Diferencia = \|calculado − facturado\| ÷ facturado ≤ 0,05 | ❌ Sin medir |
| B5 | **Revisión independiente de las últimas correcciones sin hallazgos altos ni bloqueantes** | Un revisor que no haya escrito esas correcciones revisa las que son posteriores a la revisión anterior. La tercera (2026-10-11) cubrió `90596cb`, `fa0f342`, `230317f`, `de73eb7` y `95102cb`; la cuarta tiene que cubrir `1aaf169`, `f70e641` y `27ea407`, más lo confirmado después. El informe se guarda junto a los anteriores, con veredicto y la tabla de riesgos | ⚠️ La tercera se hizo (aprobada con observaciones) y tuvo **cuatro hallazgos altos**: N-01, N-03 y N-04 están corregidos y N-02 sigue abierto (funciones trampa que inflan la puntuación de mutación). Falta la cuarta, que además no ha visto las integraciones externas |
| B6 | **0 errores de tipos** | `npm run typecheck` termina con código 0, y el job `tipos` de CI en verde | ✅ Local: 0 errores el 2026-10-12 en `82815b4` (TypeScript 6.0.3). CI: sin ejecutar |

Además, antes de anunciarla: `docs/PROBLEMAS-CONOCIDOS.md`, `docs/MIGRACION-5.0.md` y `docs/COBERTURA.md` revisados contra ese commit, con su fecha puesta al día (hoy: `PROBLEMAS-CONOCIDOS.md` y `MIGRACION-5.0.md` al 2026-10-12 sobre `82815b4`; `COBERTURA.md` sigue siendo del 2026-10-10 sobre `9180814`).

**Las integraciones externas no son un criterio de la beta.** Están apagadas por defecto, en construcción y sin ejecutar contra una plataforma real (`docs/integraciones-externas.md`). Si se anuncian, que sea como experimentales; no deben bloquear ni justificar la beta.

### Registro de pasadas (criterio B2)

| Fecha | Commit | Equipo | Orden | Pruebas | Pasan | Fallan | Omitidas |
|---|---|---|---|---|---|---|---|
| 2026-10-10 | `9180814` | Windows 11, Node 24.20.0, sin Docker | `node --test tests/*.test.js` | 2004 | 1996 | 0 | 8 |
| 2026-10-10 | `9180814` más el script `test:cobertura` | el mismo | `npm run test:cobertura` | 2004 | 1996 | 0 | 8 |
| 2026-10-10 | `9180814` más cambios de documentación | el mismo | `npm test` | 2055 | 2045 | 0 | 10 |
| 2026-10-10 | el árbol del commit que añade esta sección | el mismo | `npm test`, 1.ª de tres seguidas (228 s) | 2055 | 2045 | 0 | 10 |
| 2026-10-10 | el mismo | el mismo | `npm test`, 2.ª (222 s) | 2055 | 2045 | 0 | 10 |
| 2026-10-10 | el mismo | el mismo | `npm test`, 3.ª (192 s) | 2055 | 2045 | 0 | 10 |
| 2026-10-10 | el mismo | el mismo | `node --test tests/*.test.js` (223 s) | 2004 | 1996 | 0 | 8 |
| 2026-10-11 | `27ea407` | equipo, versión de Node y uso de Docker sin anotar (cifras tomadas de `PLAN-CIERRE-BRECHAS.md`) | `npm test` | 2214 | 2202 | 0 | 12 |

Las tres últimas se lanzaron una tras otra con una sola orden. Durante la primera se editó el texto de tres documentos (`docs/PROBLEMAS-CONOCIDOS.md`, `docs/MIGRACION-5.0.md` y `VERSIONING.md`), cuyo contenido no lee ninguna prueba; durante la segunda y la tercera no cambió nada. El equipo ejecutaba otros trabajos a la vez. **Esto cubre B2 solo sin Docker y solo en Windows**: no hay tres pasadas seguidas con `FORGE_TEST_DOCKER=1`, ni ninguna en Linux.

### Pasos para publicar la beta

1. **Árbol limpio y en el commit que cumple los criterios.** `git status` sin cambios.
2. **Versión `5.0.0-beta.1`.** Hay que cambiarla en todos los sitios donde vive, en un solo commit:
   - `package.json` (`npm version 5.0.0-beta.1 --no-git-tag-version` lo hace sin crear etiqueta);
   - `.claude-plugin/plugin.json` y `.claude-plugin/marketplace.json` (dos campos);
   - la insignia del `README.md`, `docs-site/assets/data.js` y `docs-site/index.html`;
   - **`tests/integration.test.js`**, que comprueba la cadena `"5.0.0"` en dos pruebas («reporta versión 5.0.0» y «version es 5.0.0»). Si no se actualizan, `npm test` falla, y como `prepublishOnly` ejecuta `npm test`, **la publicación se detiene**. Es lo esperado: actualízalas en el mismo commit.
3. **CHANGELOG.** La cabecera `## [5.0.0] — Sin publicar` pasa a nombrar la beta y su fecha.
4. **Mirar lo que se va a publicar:** `npm pack --dry-run`. El 2026-10-10, sobre `9180814` más estos documentos, daba 333 archivos y 2,5 MB sin comprimir, sin nada de `.sdd/`, `tests/` ni `.github/`.
5. **Publicar con la etiqueta:**

   ```bash
   npm publish --tag beta --access public
   ```

   **Nunca sin `--tag beta`.** Sin la etiqueta, npm asigna `latest` a lo que se publica, y quien instale `forja-mvp` recibiría la beta. (Las versiones recientes de npm se niegan a publicar una versión preliminar sin `--tag`; no lo comprobé con la 11.19.0 de este equipo. No cuentes con ello.)
6. **Comprobar que `latest` no se movió:**

   ```bash
   npm view forja-mvp dist-tags
   # esperado: { latest: '4.2.0', beta: '5.0.0-beta.1' }
   ```

7. **Probar la instalación** en una carpeta vacía:

   ```bash
   npx -p forja-mvp@beta forge --version    # 5.0.0-beta.1
   npx -p forja-mvp@beta forge init
   npx -p forja-mvp@beta forge doctor
   npm install forja-mvp && npx forge --version    # sigue dando 4.2.0
   ```

8. **Etiqueta de git:** `git tag -a v5.0.0-beta.1 -m "FORGE 5.0.0-beta.1"` y `git push origin v5.0.0-beta.1`.
9. **Anunciarla** con el enlace a `docs/PROBLEMAS-CONOCIDOS.md` y a la plantilla de fallos (`.github/ISSUE_TEMPLATE/fallo.md`).

### Después de la beta

- **Otra beta:** `5.0.0-beta.2` con los mismos pasos. La etiqueta `beta` pasa a la nueva.
- **Retirar una beta defectuosa:** `npm deprecate forja-mvp@5.0.0-beta.1 "motivo"` y, si hace falta, `npm dist-tag rm forja-mvp beta`. No cuentes con `npm unpublish`.
- **Pasar a estable:** la sección «Pre-publish» de arriba entera, versión `5.0.0` y `npm publish --access public` sin etiqueta. Solo entonces se mueve `latest`.
