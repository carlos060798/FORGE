---
id: 2026-11-27-componente-seguridad
titulo: "Componente seguridad: secretos y dependencias sin red en la puerta seguridad"
tamano: mediano
estado: borrador
creada: 2026-11-27
actualizada: 2026-11-27
autor: humano  # redactada por Claude como propuesta; pendiente de aprobación del dueño
constitucion_version: 1.0.0  # [NV] versión de la constitución sin ratificar (plan §5 fase 0)
etiquetas: [componentes, seguridad, secretos, dependencias, puertas, not_evaluable]
---

# Especificación: Componente `seguridad`

> Leyenda: **[V-código]** comprobado en el worktree el 2026-11-27. **[NV]** sin verificar.
> Depende de: spec `2026-11-27-contrato-de-componente`, ADR-30 (resultados) y ADR-32 (binarios opcionales).

## 1. Contexto y Motivación

La puerta `seguridad` ya existe en el conjunto cerrado `CLAVES_PUERTAS` (`core/puertas/config.js:35`) [V-código], pero hoy solo ejecuta el comando que el proyecto declare. Nada garantiza que se busquen secretos ni dependencias vulnerables. El ejecutor de puertas ya trata el código 127 (herramienta ausente) como `no_ejecutable` y cualquier resultado distinto de `pass` como no éxito (`core/puertas/ejecutar.js:48-51`, `:120-135`) [V-código]. Falta un componente que rellene esa puerta con dos chequeos concretos, locales y sin red, y que diga con honestidad cuándo no pudo evaluar.

## 2. Objetivo

Que, con el componente activo, la puerta `seguridad` evalúe (1) secretos en el árbol y la historia y (2) dependencias con vulnerabilidades conocidas usando una base local sin red, y traduzca cada resultado a `pass | fail | not_evaluable` (ADR-30). Si falta la herramienta, el resultado es `not_evaluable`, visible, y en modo `producto` cuenta como fallo.

## 3. Usuarios y Actores

| Actor | Rol | Necesidad principal |
|-------|-----|---------------------|
| Usuario | Activa el componente | No publicar secretos ni dependencias vulnerables |
| Motor (puertas) | Ejecuta y juzga | Un resultado traducido y determinista |
| Dueño | Decide los binarios (ADR-32) | Que nada se instale en silencio |

## 4. Historias de Usuario

### HU-001: Secretos
**Como** usuario **quiero** que la puerta detecte secretos **para** no filtrarlos al publicar.

**Criterios de aceptación:**
- [ ] **CA-001-01**: Con un secreto sembrado en un repo temporal, el resultado es `fail` y el código común es 1. (P1)
- [ ] **CA-001-02**: El informe solo contiene regla, archivo y línea; el valor del secreto no aparece en stdout, stderr, evidencia ni registros (prueba: buscar el valor sembrado en todas las salidas da 0 coincidencias). (P1)
- [ ] **CA-001-03**: Un error de la herramienta (no un hallazgo) se traduce a 8 y a `not_evaluable`, nunca a `pass` ni a 1. (P1)
- [ ] **CA-001-04**: Un repo sin secretos da `pass` y código 0. (P1)

### HU-002: Dependencias sin red
**Como** usuario **quiero** que la puerta detecte dependencias vulnerables sin conectarse a nada **para** que el análisis no filtre información del proyecto.

**Criterios de aceptación:**
- [ ] **CA-002-01**: Con una dependencia vulnerable conocida en la base local, el resultado es `fail` (código 1). (P1)
- [ ] **CA-002-02**: El escaneo se ejecuta en el contenedor sin red de las puertas; con la red bloqueada el resultado es el mismo. (P1)
- [ ] **CA-002-03**: Sin base local disponible, el resultado es `not_evaluable` (código 6), nunca `pass`. (P1)
- [ ] **CA-002-04**: «No hay paquetes que analizar» se traduce a `not_evaluable` (código 6) y se informa como tal [NV: según el informe, OSV-Scanner devuelve 128 en ese caso]. (P2)

### HU-003: Herramienta ausente
**Como** dueño **quiero** que una herramienta ausente se vea **para** no confundir «no se miró» con «está limpio».

**Criterios de aceptación:**
- [ ] **CA-003-01**: Sin el binario en el entorno, el chequeo da `not_evaluable` (código 6) y el informe nombra la herramienta y su ADR. (P1)
- [ ] **CA-003-02**: Ningún binario se descarga ni instala durante la ejecución (prueba: con red bloqueada y binario ausente, no hay intentos de descarga y el sistema de archivos fuera del proyecto no cambia). (P1)
- [ ] **CA-003-03**: En modo `producto`, un `not_evaluable` en la puerta `seguridad` hace que `juzgarPuertas` devuelva veredicto de falla (no éxito). (P1)
- [ ] **CA-003-04**: En modos que no lo exigen, `not_evaluable` no es éxito silencioso: aparece en el informe y en la evidencia con la cobertura de chequeos evaluados. (P1)

### HU-004: Solo endurece
**Como** dueño **quiero** que el componente no relaje la puerta **para** cumplir la invariancia.

**Criterios de aceptación:**
- [ ] **CA-004-01**: Si el proyecto ya declara un comando en `puertas.seguridad`, ese comando se sigue ejecutando; el resultado final es el más estricto de los dos. (P1)
- [ ] **CA-004-02**: El componente no añade claves a `CLAVES_PUERTAS` (CA-004-01 del contrato). (P1)

## 5. Escenarios de Uso

### Escenario 1: Caso feliz
**Dado** el componente activo y ambos binarios presentes **cuando** el motor ejecuta las puertas en un repo limpio **entonces** `seguridad` da `pass`.

### Escenario 2: Caso de error
**Dado** un secreto sembrado **cuando** se ejecutan las puertas **entonces** `seguridad` da `fail` y el valor no aparece en ninguna salida.

### Escenario 3: Caso borde
**Dado** modo `producto` y el escáner de dependencias ausente **cuando** se ejecutan las puertas **entonces** el resultado es `not_evaluable` y el veredicto final es de falla.

## 6. Requisitos Funcionales

- **RF-001**: El sistema DEBE rellenar la puerta `seguridad` existente, sin crear puertas nuevas.
- **RF-002**: El sistema DEBE traducir los códigos nativos a ADR-30.
- **RF-003**: El sistema DEBE detectar los binarios en ejecución y NO DEBE instalarlos (ADR-32).
- **RF-004**: El sistema NO DEBE emitir valores de secretos.
- **RF-005**: El sistema DEBE tratar `not_evaluable` como fallo en modo `producto`.

## 7. Fuera de Alcance

- SAST y SBOM (semgrep, syft): en cola (plan §4.5).
- Escáneres que verifican credenciales contra servicios externos (excluidos por defecto: usan red).
- Ingesta de SARIF o informes de GitLab: posterior.

## 8. Dependencias y Asunciones

- Los modos aún no existen en el código (fase 4, ADR-28 sin redactar). El plan §4.4 dice que en `mvp` `not_evaluable` = fallo y la tabla §4.5 exige SCA desde `mvp`; esta spec fija el mínimo pedido (`producto`) y deja `mvp` como pregunta abierta [NV].
- Que los binarios estén disponibles dentro del contenedor sin red de las puertas está [NV].

## 9. Riesgos

| Riesgo | Mitigación |
|---|---|
| El propio escáner es el vector (incidente Trivy 2026 citado en el informe) | Versión fijada y verificada por ADR-32 |
| «No se miró» leído como «limpio» | `not_evaluable` visible; fallo en `producto` |
| Fuga del secreto por la salida | CA-001-02 y redacción obligatoria |

## 10. Preguntas Abiertas

- ¿`not_evaluable` cuenta como fallo también en `mvp` (plan §4.4)? Decisión del dueño.
- ¿Cómo llegan los binarios al contenedor sin red sin instalarlos en silencio? [NV]

## 11. Criterios de Éxito Medibles

- Secretos sembrados: 100 % detectados en el corpus propio; 0 valores en salidas.
- Binario ausente: 100 % `not_evaluable`, 0 `pass`.

## 12. Referencias

- Plan consolidado §4.4, §4.5, §5 fase 6.
- Informe «Skills agnósticas git y DevOps» (códigos de OSV-Scanner y gitleaks).
- `core/puertas/config.js:35`, `core/puertas/ejecutar.js:48-51`, `:120-135`.
