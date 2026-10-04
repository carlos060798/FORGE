---
spec_id: 2026-10-03-saneamiento
fecha_verificacion: 2026-10-04
veredicto: AUTOEVALUADA  # sin verificación independiente; falta CA-004-01
---

# Verificación: 2026-10-03-saneamiento

## Veredicto: **AUTOEVALUADA** — 12 de 13 criterios; CA-004-01 abierto por decisión del dueño

La hizo quien implementó. No hay verificación independiente de esta spec (las del ciclo, la API y el MCP sí la tienen y, de paso, ejercitaron el modo clásico tocado por estos cambios).

| CA | Test | Estado |
|---|---|---|
| CA-001-01 | `saneamiento`: «forge init instala hooks que cargan» (copia `shared/config.js` y los `.sh`) | ✅ |
| CA-001-02 | `saneamiento`: «forge status funciona sin dist/» | ✅ |
| CA-001-03 | `release-safety` (`files[]` sin carpetas inexistentes) | ✅ |
| CA-002-01 | `saneamiento`: `seccionesDeTareas`, `normalizarTareas`, `cargarTareas` | ✅ |
| CA-002-02 | `saneamiento`: `specActiva`, `cargarTareas` con las dos claves, state machine | ✅ |
| CA-002-03 | `saneamiento`: «forzarNivel persiste en cwd». **Parcial**: el orquestador y el motor leen `--cwd` y lo ejercitan los tests del ciclo, pero no hay un test que compare dos directorios | ⚠️ |
| CA-002-04 | `saneamiento`: «la etapa del proyecto se entiende venga de quien venga» | ✅ |
| CA-003-01 | Suite completa: 1405 de 1408 pasan en Windows con Docker (3 saltados, 0 fallos) | ✅ |
| CA-003-02 | `saneamiento`: `safeFiles` (hermano con prefijo igual, rutas absolutas) | ✅ |
| CA-003-03 | `saneamiento`: `adr-parser` (`globARegex`, `scanCodigo`) | ✅ |
| CA-003-04 | `saneamiento`: añadido el 2026-10-04 (única variable de ruta, el archivo existe y carga). Es una comprobación estática más una carga del módulo; no ejecuta el hook completo | ✅ (débil) |
| CA-004-01 | — | ⏸ **abierto**: decisión del dueño |

Total: 11 ✅ (uno débil), 1 ⚠️, 1 abierto.

## Cambios de comportamiento del modo clásico (respecto a 4.2.0)

Siete, documentados en `docs/ciclo-verificado.md` (sección «Cambios en el modo clásico»).

## Lo que NO demuestra

- Que `npx forge init` en un proyecto real funcione de extremo a extremo con todos los hooks: se prueba la copia de archivos y que carguen, no su ejecución dentro de Claude Code.
- Nada en Linux o macOS: la suite completa solo se ejecutó en Windows (más Linux en contenedor sin Docker interno).
