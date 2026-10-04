---
spec_id: 2026-10-03-herramientas-mcp
plan_id: 2026-10-03-herramientas-mcp-plan
estado: aprobado  # pendiente_aprobacion | aprobado | obsoleto
creado: 2026-10-03
constitucion_version: 1.0.0
agentes_participantes: [arquitecto, desarrollador-backend, tester, documentador]
---

# Plan Técnico: Herramientas de FORGE para agentes externos

## 1. Resumen Ejecutivo

Un servidor MCP por entrada y salida estándar, sin dependencias, en `core/mcp/`. Habla JSON-RPC 2.0 (`protocolo.js`), ofrece tres herramientas (`herramientas.js`) que reutilizan el código del ciclo verificado, y se arranca con `forge mcp` (`servidor.js`, `cli/index.js`). Aprobado por delegación del dueño ("sigue la fase siguiente sin preguntar").

## 2. Verificación de Constitución (Constitution Check)

| Principio | Cumple | Justificación |
|-----------|--------|--------------|
| I. La especificación manda | ✅ | Spec escrita antes que el código |
| II. La aprobación es humana | ⚠️ | Aprobada por delegación expresa; ver sección 15 |
| III. Local primero | ✅ | Sin red; solo entrada y salida estándar |
| IV. Dependencias mínimas | ✅ | Cero dependencias; el SDK oficial (17 directas) se descartó en ADR-12 |
| V. Nada generado en el anfitrión | ✅ | Las pruebas solo corren en el contenedor; sin Docker, error |
| VI. Decisiones deterministas | ✅ | Reutiliza el clasificador del ciclo |
| VII. Pruebas antes y por otro rol | ✅ | Dos roles de escritura: implementación y pruebas |
| VIII. Gasto acotado | ✅ | No llama a modelos |
| IX. Reanudable y auditable | ⚠️ | Respaldo de lo escrito; sin registro de eventos propio (ver sección 14) |
| X. Reusar antes que reescribir | ✅ | Una sola implementación de las reglas de rutas |
| XI. Honestidad documental | ✅ | Límites documentados |
| XII. Español primero | ✅ | |

## 3. Enfoque Técnico

El protocolo es una clase que toma entrada y salida como flujos y una lista de herramientas, así que se prueba entera en memoria y se podría montar sobre otro transporte. Las herramientas son funciones puras sobre un proyecto: `leer_archivo` y `escribir_archivo` llaman a `validarRuta` y `aplicarArchivos` del ciclo; `ejecutar_pruebas` usa `SandboxRunner` y toma el candado de proyecto por llamada, lo que la serializa con el ciclo y con otros servidores. Docker se comprueba al primer uso, para que leer y escribir funcionen sin él.

## 4. Decisiones Técnicas

| # | Decisión | Opción elegida | Alternativas descartadas | Razón |
|---|----------|---------------|--------------------------|-------|
| 1 | Protocolo | Propio, sobre stdio, verificado con el cliente oficial | SDK oficial; SDK opcional | 17 dependencias directas para un transporte sin HTTP (ADR-12) |
| 2 | Reglas de rutas | Las del ciclo, sin copia | Reglas propias | Una sola lista que mantener |
| 3 | Errores de herramienta | Resultado con `isError` | Errores de protocolo | El agente puede corregirlos |
| 4 | Exclusión mutua | Candado de proyecto del ciclo, por llamada | Cola interna | Compartido con el ciclo y con otros procesos |
| 5 | Roles de escritura | Implementación y pruebas | Lista de pruebas protegidas | No hay estado entre llamadas |

## 5. Estructura de Carpetas Afectada

```
core/mcp/
├── protocolo.js        ServidorMcp, validarArgumentos
├── herramientas.js     crearHerramientas
└── servidor.js         iniciarServidor, runner de Docker bajo demanda
cli/index.js            case "mcp"
docs/servidor-mcp.md
tests/mcp-protocolo.test.js · mcp-herramientas.test.js · mcp-e2e.test.js
```

## 6. Archivos Afectados

| Acción | Ruta | Propósito | Agente responsable |
|--------|------|-----------|--------------------|
| CREAR | `core/mcp/protocolo.js` | JSON-RPC y MCP sobre flujos | desarrollador-backend |
| CREAR | `core/mcp/herramientas.js` | Las tres herramientas | desarrollador-backend |
| CREAR | `core/mcp/servidor.js` | Arranque | desarrollador-backend |
| MODIFICAR | `cli/index.js` | Comando `forge mcp` y ayuda | desarrollador-backend |
| CREAR | `tests/mcp-*.test.js` | Pruebas | tester |
| CREAR | `docs/servidor-mcp.md` | Uso y límites | documentador |

No se modifica ningún archivo del ciclo.

## 7. Modelo de Datos

No hay persistencia propia. Se escribe un respaldo en `.sdd/motor/mcp-<n>/respaldo/mcp/` (formato de `core/ciclo/respaldo.js`).

## 8. Contratos de API

Protocolo MCP, versiones 2024-11-05, 2025-03-26 y 2025-06-18. Métodos: `initialize`, `notifications/initialized`, `ping`, `tools/list`, `tools/call`.

```yaml
ejecutar_pruebas: { argumentos: {}, resultado: texto con categoría, código, duración y final de la salida }
leer_archivo:     { argumentos: { ruta: string }, resultado: contenido, hasta 256 KB }
escribir_archivo: { argumentos: { ruta: string, contenido: string, rol: implementacion|pruebas }, resultado: ruta y sha256, hasta 1 MB }
errores:          resultado con isError y la razón; -32700 / -32600 / -32601 / -32602 del protocolo
```

## 9. Estrategia de Tests

### Tests unitarios
- Protocolo en memoria (flujos `PassThrough`): versiones, errores estándar, notificaciones, líneas enormes, orden de respuestas concurrentes.
- Herramientas con un entorno aislado falso: resultados, redacción, candado, rutas, roles, respaldo, topes.

### Tests de integración
- `forge mcp` como proceso real por pipes; sin Docker en el PATH (la prueba que escribiría una marca en el anfitrión no se ejecuta).

### Tests E2E
- Con `FORGE_TEST_DOCKER=1`: un agente corrige el código y las pruebas pasan en el contenedor.
- Con `FORGE_MCP_SDK`: cliente oficial del protocolo.

## 10. Dependencias Nuevas

Ninguna.

## 11. Riesgos Técnicos

| # | Riesgo | Probabilidad | Impacto | Mitigación |
|---|--------|--------------|---------|-----------|
| 1 | El protocolo evoluciona y un cliente exige algo que no ofrecemos | M | M | Cliente oficial en las pruebas; tres versiones soportadas |
| 2 | Las reglas de rutas tienen huecos (las mismas que el ciclo) | M | A | Comparten implementación: se corrigen en un sitio. Ver `revision-seguridad.md` |
| 3 | Un agente escribe código dañino en una ruta permitida | M | M | Documentado; revisar el diff |
| 4 | Un cliente hostil o roto envía basura | B | M | Límite de línea de 10 MB, validación de argumentos, errores estándar |
| 5 | Dos servidores compiten por Docker | M | B | Candado de proyecto |

## 12. Plan de Implementación en Fases

### Fase A: Fundamentos
ADR-12 y el protocolo.

### Fase B: Tests primero (si TDD)
Los tests del protocolo se escribieron junto con él.

### Fase C: Capa de datos
No aplica.

### Fase D: Lógica de negocio
Las tres herramientas.

### Fase E: Interfaz / API
`forge mcp` y su ayuda.

### Fase F: UI (si aplica)
No aplica.

### Fase G: Integración
Proceso real, cliente oficial y Docker.

### Fase H: Verificación
Matriz de criterios y documentación.

## 13. Cambios Breaking

Ninguno.

## 14. Métricas y Observabilidad

El servidor no usa el registro de eventos del ciclo: no llama a modelos ni gasta. Los fallos internos van a la salida de errores. Pendiente valorar un registro de las escrituras.

## 15. Complejidad Justificada

| Desviación | Principio | Justificación |
|---|---|---|
| Spec y plan aprobados por delegación | II | El dueño pidió seguir con la fase siguiente sin preguntar |
| Sin registro de eventos de las escrituras | IX | Se guarda un respaldo; el registro queda como mejora |

## 16. Estimación

- Complejidad global: Media
- Tareas estimadas: 9

## 17. Aportes por Agente

### Arquitecto
Protocolo propio sobre flujos y reutilización total de las reglas del ciclo.

### Diseñador de API
Tres herramientas con esquemas cerrados (sin argumentos extra); errores como resultados.

### Asesor de datos
Sin datos propios.

### Crítico
El mayor riesgo es heredado: la lista de rutas del ciclo. Y la autoevaluación no es independiente.

### Seguridad
Sin autenticación: confía en quien lanza el proceso. Las pruebas solo corren en el contenedor. Falta una revisión independiente.
