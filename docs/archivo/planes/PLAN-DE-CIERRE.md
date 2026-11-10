# Plan de cierre

Estado a 2026-11-05 (rama `mejoras/auditoria`). Qué se cerró, qué se limpia y qué decide el dueño. Complementa [PLAN-FLUJO-AI-NATIVO.md](PLAN-FLUJO-AI-NATIVO.md). **Archivado el 2026-11-09:** superado por el plan MVP (Fases 0 a 4); se conserva como historia.

## 1. Cerrado

| Qué | Cómo se comprobó |
|---|---|
| Fases 1 a 6 del flujo nativo de IA | `npm test`: 4039 pasan, 0 fallan, 31 omitidas; `npm run typecheck` limpio |
| Dos revisiones de agentes independientes, con correcciones | Detalle en `.sdd/especificaciones/2026-10-27-flujo-nativo-de-ia/verificacion.md` |
| Catálogo: 14 agentes, 39 comandos, 31 skills | Coinciden en `package.json`, `plugin.json`, `marketplace.json`, README e inventario |
| `skills-generadas/` al día | `node scripts/generar-skills.mjs --verificar` → 39 al día |
| Referencia rota a `docs/COMPLIANCE.md` y `/compact` ausente de la ayuda | Corregidos; `commands.test.js` y `catalogo.test.js` pasan |
| `.sdd/INDICE.md`: dos filas que faltaban y estadísticas | Recalculadas desde el frontmatter de cada `spec.md` (21 specs: 15 en implementación, 6 en borrador) |

## 2. Limpieza de documentos

Un agente detecta lo que no pertenece al marco de trabajo o está duplicado. Solo lista: **nada se borra sin que el dueño lo apruebe**. `forge/FORGE` es un repositorio git (rama `mejoras/auditoria`), así que lo rastreado se puede recuperar; `forge/doc/` está fuera del repositorio y su borrado no tiene vuelta atrás. Resultado en la sección «Candidatos» de abajo cuando termine.

## 3. Pendiente de decisión o de terceros

1. **Specs con trabajo abierto:** 12 de 21 tienen `[ ]` en `tareas.md` (unas 110 en total; `despliegue-con-aprobacion` tiene 44). Cerrarlas o replantearlas es del dueño.
2. **Estados de las specs en «borrador»** (revisión de dos agentes, sin ejecutar pruebas): solo `despliegue-con-aprobacion` es un borrador de verdad (1 tarea hecha, 44 abiertas, sin código). Las otras cinco tienen implementación con pruebas y el estado no lo refleja: `perfiles-de-agente` (20 de 27 tareas), `instalacion-agnostica` (17 de 21), `proveedores-agnosticos` (27 de 33), `verificar-sin-modelo` (20 de 25) y `validacion-modelo-real` (sin tareas.md, con evidencia y revisiones). **Ninguna consta como aprobada por el dueño**: no se les cambia el estado hasta que el dueño lo decida (`AGENTS.md`). `forge aprobar spec` solo marca `spec_aprobado` en `.sdd/estado.json`; el `estado:` del frontmatter se edita a mano.
3. **Documentos desactualizados:** `docs/COBERTURA.md` (10 de octubre), `docs/ESTADO-ACTUAL.md` (24), `docs/PROBLEMAS-CONOCIDOS.md` (12) y las cifras de `RELEASE-CHECKLIST.md`. Son cifras medidas: se actualizan cuando se vuelvan a medir, no a mano.
4. **CI en GitHub:** `tipos`, `aislamiento`, `pruebas-docker`, `evidencia` y el workflow con modelo real nunca han corrido. Requiere subir el repositorio.
5. **Revisión humana** del flujo nativo de IA y prueba del hook en un proyecto real con Claude Code.
6. **Spec activa:** `.sdd/estado.json` apunta a `2026-10-03-ciclo-verificado`; los criterios de la spec nueva no pasan por el job `evidencia` mientras no sea la activa.
7. **`.claude/worktrees/`:** 63 carpetas (452 MB). Se podan con `git worktree remove` en el repositorio real.

## Candidatos a quitar de los documentos

**A. Seguro de quitar (confianza alta; nada del repo los referencia)**

| Ruta | Qué es | Recuperable |
|---|---|---|
| `forge/doc/` (8 `.md`, ~23 KB) | Documentación de FORGE v2, reemplazada; sus cabeceras apuntan al plan nuevo. Está **fuera** de `forge/FORGE` | **No** (no está en git): conviene copiarla antes |
| `.gitignore-analisis` (217 B) | Lista cuatro análisis de la v2.6.0 que no existen | Sí (rastreado) |
| `dist/` | Carpeta vacía de compilación | n/a |

**B. Revisar con el dueño**

| Ruta | Por qué no es automático |
|---|---|
| `logs/bitacora-rendimiento.md` | Registro de una sesión real (sistema de notas); evidencia de uso, no marco. **No está en git**: borrarlo no se recupera |
| `docs/archivo/` (~350 KB, 19 `.md` + 8 planes) | Superado, pero README, RELEASE-CHECKLIST, CHANGELOG y PROBLEMAS-CONOCIDOS lo citan: habría que actualizar esas referencias. Se puede sacar del paquete con `.npmignore` sin borrarlo |
| `docs/FORGE-DOCUMENTACION.html` | Casi duplicado de `FORGE-5.0-GUIA.md`; solo lo cita un plan archivado |
| `docs/PLAN-FLUJO-AI-NATIVO.md` | Plan suelto que nada enlaza; podría ir a `docs/archivo/` |
| `docs/investigacion/` (3 `.md`) | Investigación de apoyo sin verificar contra el índice |

**C. Mantener:** `.sdd/` completo, `docs/` vigente, `docs-site/` (lo publica `docs.yml`), `skills-generadas/` (parte versionada a propósito), código, agentes, comandos, skills y pruebas. No hay documentos de trading ni de finanzas, ni temporales (`.tmp`, `.bak`).

Además, `docs/FORGE-5.0-GUIA.md` y `docs/MIGRACION-5.0.md` están enlazados desde el índice y el README: no se quitan.

## Limpieza aplicada (2026-11-06)

- `forge/doc/` (v2, fuera de git) se copió a `docs/archivo/forge-v2/` (8 archivos, ahora versionados) y se quitó el original.
- `.gitignore-analisis` eliminado (rastreado, recuperable) y `dist/` vacío quitado.
- **Sin tocar:** `logs/bitacora-rendimiento.md`, `docs/archivo/` anterior, `docs/FORGE-DOCUMENTACION.html`, `docs/investigacion/` y los 63 worktrees: quedan para decisión del dueño.
