# Auditoría de ramas y planes de FORGE/Fragua

Fecha: 2026-11-06. Solo lectura: no se hizo merge, rebase, checkout, reset ni push. Las simulaciones usaron `git merge-tree --write-tree`, que no toca el árbol de trabajo ni el índice.

## 0. Conclusión corta

- La historia es **lineal**: `main` (64 commits) -> `feature/motor-agentico` (+233) -> `mejoras/auditoria` (+7 más). `main` está 0 adelante y 240 detrás de `mejoras/auditoria`. Integrar es un **fast-forward**, sin conflictos posibles.
- El riesgo real no es de conflictos de git sino de **trabajo sin publicar**: 29 commits locales de `feature/motor-agentico` y 2 de `mejoras/auditoria` no están en `origin`.
- De las 63 ramas `worktree-agent-*` más `revision/validacion-modelo-real-bd7cd9f`: 53 ya están contenidas en `mejoras/auditoria`. 11 tienen 1 commit propio: 9 son informes de revisión (solo docs, fusión limpia) y 2 ya están integradas por equivalencia (cherry-pick con otro hash).

## 1. Inventario de ramas

| Rama | Commits | Respecto a `main` | Contenido |
|---|---|---|---|
| `main` / `origin/main` (6372ca0) | 64 | base | Paquete `forja-mvp` v4.2.0. Último commit: renombrar `forge-sdd` a `forja-mvp`. |
| `feature/motor-agentico` (local, 2e421a8) | 297 | +233 / 0 | Motor agéntico: ciclo verificado, MCP, API, proveedores, integraciones, perfiles, puertas, evidencia. Ancestro de `mejoras/auditoria`. |
| `origin/feature/motor-agentico` (804edf0) | 268 | +204 / 0 | 29 commits por detrás de la local (sin subir). |
| `mejoras/auditoria` (HEAD, 95d6554) | 304 | +240 / 0 | `feature/motor-agentico` + 7 commits: flujo nativo de IA, evals, correcciones de revisión, archivo de docs v2. Paquete `fragua` 5.0.0. |
| `origin/mejoras/auditoria` (8af9834) | 302 | +238 / 0 | La local lleva 2 más sin subir: `52cfd54` (correcciones de revisión y cierre de catálogo) y `95d6554` (archivo de docs v2). |
| 63 `worktree-agent-*` y `revision/validacion-modelo-real-bd7cd9f` | 32 a 240 | todas 0 por detrás de `main` | Una rama por worktree de `.claude/worktrees/`. Casi todas contenidas en `mejoras/auditoria`. |

Notas:
- Varias ramas de agentes apuntan al mismo commit: 6372ca0 (= `main`: a4ad1604, a5d446a5, a72b15ab, aead7a17) y 323626c (a264788f, a4f9b499, aea08235).
- El worktree `agent-a5d446a5...` tiene en realidad la rama `revision/validacion-modelo-real-bd7cd9f` (7e53827), que sí tiene 1 commit único.
- `worktree-agent-aeb873ba23c60e0f7` es un WIP ("agente detenido antes de verificar"), pero está contenida en `mejoras/auditoria`.
- Hay 63 worktrees en `.claude/worktrees/` (452 MB según `PLAN-DE-CIERRE.md`). No hay etiquetas ni stash.

### Commits únicos fuera de `mejoras/auditoria` (11 ramas, 1 commit cada una)

Informes de revisión independiente que **no existen** en `mejoras/auditoria` (cada uno añade un archivo nuevo; fusión limpia):

| Rama (commit) | Archivo que añade |
|---|---|
| `revision/validacion-modelo-real-bd7cd9f` (7e53827) | `.sdd/especificaciones/2026-10-09-validacion-modelo-real/revision-independiente.md` |
| `worktree-agent-a4672142430d758b0` (ffd250c) | `.../validacion-modelo-real/revision-independiente-2.md` |
| `worktree-agent-a144ec2fffc41431a` (68836a6) | `.../validacion-modelo-real/revision-independiente-3.md` |
| `worktree-agent-a7cb7e0316d1c917d` (5ea6758) | `.../validacion-modelo-real/revision-independiente-4.md` |
| `worktree-agent-a882123e815d9e3ab` (5404f3d) | `.../integraciones-externas/revision-independiente-1.md` |
| `worktree-agent-ab009b75c404f0e1d` (67cf7ce) | `.../integraciones-externas/revision-independiente-2.md` |
| `worktree-agent-ac13e183747ca587a` (8cca839) | `.../implementador-con-herramientas/revision-independiente.md` |
| `worktree-agent-adec75f8324e2d513` (becd5b1) | `.../puesta-al-dia/revision-independiente.md` |
| `worktree-agent-af1815a7ed749e6ba` (332448f) | `.../pruebas-confiables/revision-independiente.md` |

Estos 9 son lo único que se perdería al podar los worktrees. Las otras dos ramas con commit propio dan conflicto en `merge-tree`, pero su contenido ya está integrado:

| Rama | Conflicto simulado | Veredicto |
|---|---|---|
| `worktree-agent-a4c56a5d86fd3378f` (spikes S0 de integraciones, batería hostil) | add/add en `tests/fixtures/integraciones/hostiles.json` y `tests/integraciones-hostiles-fixture.test.js` | `git cherry` no lo lista: el parche ya está en `mejoras/auditoria` con otro hash. **No integrar.** |
| `worktree-agent-a8faa089d3d5de0dc` (hallazgos de la revisión de la fase 9) | content en `core/sandbox/politica.js`, `core/session-budget.js`, `tests/mcp-protocolo.test.js`, `tests/mcp-sin-estado.test.js`; add/add en `tests/puesta-al-dia-revision.test.js` | `mejoras/auditoria` tiene `95102cb fix: hallazgos de la revision independiente de la fase 9`, la versión rebasada. **No integrar; descartar.** |

## 2. Predicción de conflictos (`git merge-tree --write-tree`)

| Fusión simulada | Resultado |
|---|---|
| `main` <- `mejoras/auditoria` | limpia (fast-forward) |
| `main` <- `feature/motor-agentico` | limpia (fast-forward) |
| `origin/main` <- `origin/mejoras/auditoria` | limpia |
| `origin/feature/motor-agentico` <- `mejoras/auditoria` | limpia |
| `origin/feature/motor-agentico` <- `origin/mejoras/auditoria` | limpia |
| `origin/feature/motor-agentico` <- `feature/motor-agentico` | limpia |
| `mejoras/auditoria` <- cada una de las 9 ramas de revisión | limpias |
| `mejoras/auditoria` <- `a4c56a5d`, `a8faa089` | CONFLICTO (ya integradas, ver arriba) |

Tamaño: `main..mejoras/auditoria` son 765 archivos (+101 893 / -1 117); `feature/motor-agentico..mejoras/auditoria`, 69 archivos (+2 438 / -255).

Árbol de trabajo: solo hay sin seguimiento `logs/` (con `bitacora-rendimiento.md`, que no está en git) y `docs/informes/`.

## 3. Orden de integración, planes y contradicciones

### Orden recomendado

1. **Subir lo local** (`feature/motor-agentico` 29 commits, `mejoras/auditoria` 2). Es el único paso con riesgo de pérdida.
2. Rescatar los 9 informes de revisión a `mejoras/auditoria` con `cherry-pick`.
3. Avanzar `main` a `mejoras/auditoria` (fast-forward).
4. Retirar worktrees y ramas de agentes solo cuando 2 y 3 estén verificados.

`feature/motor-agentico` no necesita fusión propia: es ancestro de `mejoras/auditoria`.

### Planes que debieron aplicarse antes del código

El proyecto es spec-driven (`AGENTS.md`): spec, plan y tareas antes del código.
- **Con plan y tareas previos:** `integraciones-externas`, `instalacion-agnostica`, `proveedores-agnosticos`, `renombrar-a-fragua`, `verificar-sin-modelo`, `ciclo-por-mcp`, `contrato-publico`, `defensa-inyeccion-y-fuga`, `perfiles-de-agente`, `puertas-de-calidad-y-evidencia`.
- **Código sin plan ni tareas formales** (según `.sdd/INDICE.md`): `validacion-modelo-real`, `implementador-con-herramientas`, `pruebas-confiables`, `puesta-al-dia`, `memoria-semantica`; `flujo-nativo-de-ia` tiene tareas pero no plan.
- **Sin implementar:** `despliegue-con-aprobacion` (0 de 43 tareas; único borrador real).
- Avance medido en `tareas.md` (hechas/total): integraciones 49/55, instalación agnóstica 16/19, proveedores 26/31, renombrar 23/28, verificar-sin-modelo 19/23, ciclo-por-mcp 22/34, contrato-público 26/28, defensa 18/23, perfiles 19/25, puertas 42/48, flujo-nativo 12/13. Las cuatro specs del 2026-10-03 no usan casillas.

### Contradicciones y duplicados

1. **Estados desfasados en `INDICE.md`:** marca "borrador" y "nada implementado" en `instalacion-agnostica`, `verificar-sin-modelo` y `proveedores-agnosticos`, y "borrador" en `perfiles-de-agente`, cuando sus tareas están hechas entre el 76 y el 89 %. "Completadas: 0" tampoco refleja la realidad. `PLAN-DE-CIERRE.md` ya lo señala y no cambia estados sin decisión del dueño.
2. **Dos nombres:** `main` usa `forja-mvp` 4.2.0 y `mejoras/auditoria` usa `fragua` 5.0.0. El último commit de `main` queda superado. Confirmar que `forja-mvp` no se publicó en npm.
3. **Planes archivados encadenados y solapados:** `PLAN-MOTOR-AGENTICO` -> `PLAN-CIERRE-BRECHAS` -> `PLAN-EJECUCION-FINAL` -> `PLAN-ESCALADO` -> `PLAN-INCREMENTAL` -> `PLAN-MAESTRO` (los tres últimos, del 2026-10-13, se citan entre sí; `PLAN-MAESTRO` agrupa a los demás: duplicado parcial). `PLAN-V280-V300` y `PLAN-MIGRACION-NUCLEO-REAL` (junio) están superados por el motor agéntico.
4. **Plan suelto:** `docs/PLAN-FLUJO-AI-NATIVO.md` duplica el estado de la spec `flujo-nativo-de-ia`; `PLAN-DE-CIERRE.md` propone archivarlo. `PLAN-DE-CIERRE.md` fija cifras que cambian (4039 pruebas, 63 worktrees).
5. **Spec activa:** `.sdd/estado.json` apunta a `2026-10-03-ciclo-verificado` (ya cerrada), por lo que la spec nueva no pasa por el job `evidencia`.
6. **Rama obsoleta en los planes:** todos citan `feature/motor-agentico`, ya contenida en `mejoras/auditoria`.

## 4. Riesgos y comandos para el dueño

### Riesgos

| Riesgo | Gravedad | Mitigación |
|---|---|---|
| 29 + 2 commits sin subir | Alta | Paso A antes que nada. |
| `logs/bitacora-rendimiento.md` no está en git | Media | Copiarlo antes de limpiar. |
| 9 informes solo en ramas de agentes | Media | Paso B antes de podar. |
| Quitar worktrees con cambios sin confirmar | Media | `git -C <ruta> status --short` antes de quitar; sin `--force`. |
| `forja-mvp` ya publicado | Baja | `npm view forja-mvp`. |
| CI de Linux nunca ejecutado | Media | Mirar CI tras subir, antes de dar por buena la rama principal. |

### Comandos (en `FORGE`, en este orden)

```bash
# 0. Respaldo
git bundle create ../forge-respaldo.bundle --all
cp -r logs ../logs-respaldo

# A. Publicar lo que solo existe en local (avance, sin force)
git push origin feature/motor-agentico
git push origin mejoras/auditoria

# B. Rescatar los 9 informes (desde mejoras/auditoria)
git cherry-pick 7e53827 ffd250c 68836a6 5ea6758 5404f3d 67cf7ce 8cca839 becd5b1 332448f
git push origin mejoras/auditoria

# C. Probar antes de mover main
git merge-tree --write-tree main mejoras/auditoria     # debe imprimir solo un hash
npm test && npm run typecheck

# D. Llevar main a la rama (fast-forward; mejor mediante pull request)
git switch main
git merge --ff-only mejoras/auditoria
git push origin main
git switch mejoras/auditoria

# E. Limpieza, solo tras comprobar C y D
git worktree list | grep claude/worktrees
git worktree remove .claude/worktrees/agent-XXXX     # una a una, sin --force
git branch -d worktree-agent-XXXX                    # -d falla si no está fusionada
git branch -d feature/motor-agentico
git push origin --delete feature/motor-agentico      # opcional, al final
```

Si algún `cherry-pick` fallara, `git cherry-pick --abort`. No hacer cherry-pick de `a4c56a5d` ni `a8faa089`. Tras integrar, actualizar `.sdd/INDICE.md` (estados y estadísticas) y `.sdd/estado.json` (spec activa); las tareas abiertas son decisión del dueño.
