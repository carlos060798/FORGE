# Plan de ejecución final — qué falta para terminar el proyecto

> **Fecha:** 2026-10-12 · **Rama:** `feature/motor-agentico` · **Continúa a:** `PLAN-CIERRE-BRECHAS.md`
> Este documento es la lista de lo que falta y el orden en que se hace. El estado de cada brecha sigue en `PLAN-CIERRE-BRECHAS.md`; aquí está el trabajo.

## 1. Dónde estamos

| Concepto | Estado |
|---|---|
| Fases 6 a 9 del motor agéntico | Implementadas, revisadas tres veces, sin publicar |
| Integraciones externas (GitHub, GitLab, Jira) | Núcleo y tres adaptadores hechos y probados con servidores falsos; publicación con aprobación y CLI en construcción |
| Pruebas | 2555 pasan, 0 fallan, 12 saltadas; tipos en 0 errores |
| Pruebas con una cuenta real | Ninguna de las integraciones; 24 ejecuciones con modelo real del motor |
| Integración continua en Linux | Nunca ha corrido sobre esta rama |
| Publicación | 5.0.0 sin publicar; en npm solo hay 4.0.0 y 4.2.0 |

## 2. Lo que falta, por bloque

Leyenda de quién: **A** agente · **D** dueño (necesita algo suyo) · **A+D** el agente prepara y el dueño ejecuta o decide.

### Bloque 1 — Integraciones externas (spec `2026-10-11-integraciones-externas`)

| # | Tarea | Quién | Depende de |
|---|---|---|---|
| 1.1 | Publicación con vista previa y aprobación, cola de pendientes, idempotencia (F3) | A | — |
| 1.2 | `forge integraciones leer/publicar/aprobar/estado/apagar` y diagnóstico en `forge doctor` (F4) | A | 1.1 |
| 1.3 | Revisión de seguridad independiente de núcleo y adaptadores (F1, F2) | A | — |
| 1.4 | Corregir los hallazgos altos de 1.3 | A | 1.3 |
| 1.5 | Prueba de no filtración de token y de que ningún camino lleva del modelo a la red, de extremo a extremo (F5.1 a F5.3) | A | 1.2 |
| 1.6 | Revisión de seguridad independiente de publicación y CLI | A | 1.2 |
| 1.7 | Pruebas opt-in con cuentas reales: `draft` en GitLab, borradores en GitHub gratuito, ADF y permisos en Jira | A+D | cuentas del dueño |
| 1.8 | Decidir REST frente a cliente MCP, enmienda del Principio III, aprobación en terminal o en la plataforma | D | — |
| 1.9 | Cliente MCP de solo lectura detrás del mismo puerto (F6) | A | 1.8 |

### Bloque 2 — Mutación y calidad de las pruebas

| # | Tarea | Quién |
|---|---|---|
| 2.1 | N-02: filtrar la muestra por cobertura y limitar archivos por medición | A |
| 2.2 | Medición real con Docker en Python y TypeScript, con cifras | A |
| 2.3 | Refuerzo de pruebas visto con un modelo real (`exigir` con puntuación baja) | A+D (crédito) |

### Bloque 3 — Gasto, llamadas y robustez del ciclo

| # | Tarea | Quién |
|---|---|---|
| 3.1 | Tiempo por intento y reintento acotado de llamadas que no responden (H13) | A |
| 3.2 | Mejor estimación del gasto de llamadas canceladas (texto no ASCII) | A |
| 3.3 | Consumo inválido bajo el tope: que `continuar` no pague sin fin (N-06) | A |
| 3.4 | Tiempos de espera repetidos cuentan para «sin progreso» | A |
| 3.5 | Precios de OpenAI contrastados con su fuente oficial | A |
| 3.6 | Comparar el gasto calculado con lo facturado | D |

### Bloque 4 — Configuración, diagnóstico y protocolo

| # | Tarea | Quién |
|---|---|---|
| 4.1 | Aviso cuando una clave de configuración está mal sangrada | A |
| 4.2 | `forge doctor` comprueba Docker siempre | A |
| 4.3 | MCP: respuesta a una versión desconocida según la especificación oficial (N-10) | A |
| 4.4 | pytest: continuaciones de línea, `#egg=` y `-r` en requisitos (N4) | A |
| 4.5 | Topes de tamaño en manifiestos y nombres no ASCII en el mapa | A |
| 4.6 | Cliente MCP oficial contra la revisión nueva del protocolo | A+D (instalar el paquete) |

### Bloque 5 — Verificación independiente

| # | Tarea | Quién |
|---|---|---|
| 5.1 | Cuarta revisión de lo corregido en la tercera pasada y de la robustez | A |
| 5.2 | Corregir sus hallazgos altos | A |
| 5.3 | Revisión final de todo lo anterior antes de publicar (quinta pasada, corta, solo lo corregido en 5.2 y 1.4) | A |

### Bloque 6 — Integración continua, documentación y publicación

| # | Tarea | Quién |
|---|---|---|
| 6.1 | Jobs de tipos y de pruebas con Docker en `.github/workflows/ci.yml` | A |
| 6.2 | Test que compare las cifras de prosa con el disco | A |
| 6.3 | Documentación al día: problemas conocidos, migración, README, CHANGELOG, `docs/integraciones-externas.md` | A |
| 6.4 | Abrir la solicitud de cambio hacia `main` para que corra la integración continua | D |
| 6.5 | Corregir lo que falle en la integración continua de Linux | A (cuando 6.4 esté hecho) |
| 6.6 | Ratificar las cuatro especificaciones, los ADR-19 a ADR-22 y el Principio VII | D |
| 6.7 | Decidir cómo se publica: 5.0.0 entera, separada por fases o `5.0.0-beta.1` | D |
| 6.8 | Rotar la clave de API usada en las pruebas reales | D |
| 6.9 | `npm publish` y etiqueta de git | D, solo con 6.5 en verde |

## 3. Orden de ejecución

```
Ola 1 (en marcha, en paralelo, sin tocar los mismos archivos)
  1.1+1.2 Publicación y CLI ─────────────┐
  1.3 Revisión de seguridad F1+F2 ───────┤
  2.1+2.2 Cobertura en mutación          ├──▶ Ola 2: integrar, suite completa con Docker
  3.1 a 3.3 Gasto y llamadas             │
  4.1 a 4.5 + 3.4 + 3.5 Configuración    │
  6.1 a 6.3 CI y documentación           │
  5.1 Cuarta revisión ───────────────────┘

Ola 2 (después de integrar la ola 1)
  1.4 y 5.2 Corregir hallazgos altos de las revisiones
  1.5 Prueba de no filtración de extremo a extremo
  1.6 Revisión de seguridad de publicación y CLI

Ola 3 (cierre)
  5.3 Revisión final corta
  Suite completa con Docker, tres pasadas
  6.4 → 6.5 solicitud de cambio y corrección de la integración continua

Fuera del control de los agentes (el dueño)
  1.7 cuentas reales · 1.8 decisiones · 3.6 gasto frente a factura
  6.6 ratificar · 6.7 cómo publicar · 6.8 rotar la clave · 6.9 publicar
```

### Reglas de ejecución para los agentes

1. Cada agente trabaja en su copia con archivos propios; los cruces se resuelven al integrar.
2. **Ningún agente ejecuta la suite completa**: comparten temporales con nombre fijo y la carga de la máquina provoca fallos que no son defectos. Solo la ejecuta quien integra, sin nada más corriendo.
3. Nadie sube a la rama sin `fail 0` y 0 errores de tipos en su resumen.
4. Cada informe distingue lo que quedó hecho, lo que no, y lo que está sin confirmar.
5. Los hallazgos altos de una revisión se corrigen antes de dar por cerrado su bloque.

## 4. Criterio de «terminado»

El proyecto está terminado para publicar cuando:

- [ ] La integración continua en Linux pasa, con los jobs de tipos y de pruebas con Docker.
- [ ] La suite completa tiene 0 fallos en tres pasadas seguidas, con Docker.
- [ ] Las cuatro revisiones independientes y la final no dejan hallazgos altos abiertos.
- [ ] N-02 está cerrado y la mutación medida con Docker en los lenguajes que se prometen.
- [ ] El gasto calculado está dentro del 5 % de lo facturado.
- [ ] Las integraciones tienen una prueba real, aunque sea mínima, con una cuenta de prueba por plataforma, o están documentadas como «sin probar contra la plataforma real».
- [ ] La documentación coincide con el código (la prueba de consistencia pasa).
- [ ] El dueño ratificó las especificaciones y decidió cómo se publica.

## 5. Riesgos del plan

| Riesgo | Mitigación |
|---|---|
| Siete agentes a la vez cargan la máquina y las pruebas fallan sin ser defectos | Nadie corre la suite completa; se repite aislado lo que falle |
| Conflictos al integrar (`cli/index.js`, `core/ciclo/config.js`, documentos) | Cambios localizados, integración de una rama cada vez, y pruebas entre cada una |
| Una revisión encuentra un bloqueante en integraciones | La ola 2 lo corrige antes de dar por cerrada la fase |
| Las integraciones no se prueban nunca contra una plataforma real | Se documenta como límite y se publican apagadas |
| El límite de uso de la sesión corta a los agentes | Los trabajos quedan confirmados en su rama; se reanudan |
