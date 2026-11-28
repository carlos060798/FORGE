---
id: 2026-11-27-contrato-de-componente
titulo: "Contrato de componente opcional"
tamano: mediano
estado: borrador
creada: 2026-11-27
actualizada: 2026-11-27
autor: humano  # redactada por Claude como propuesta; pendiente de aprobación del dueño con `fragua aprobar spec`
constitucion_version: 1.0.0  # [NV] el plan consolidado §5 fase 0 señala 1.1.0 frente a 1.0.0 sin resolver
etiquetas: [componentes, listas-cerradas, invariancia, seguridad]
---

# Especificación: Contrato de componente opcional

> Leyenda: **[V-código]** comprobado en el código del worktree `tmp-specs-modos` el 2026-11-27. **[NV]** sin verificar.
> Decisión de arquitectura asociada: ADR-29 (propuesta). Contrato de resultados: ADR-30 (propuesta).

## 1. Contexto y Motivación

Fragua quiere ofrecer piezas opcionales (guardián de git, seguridad, revisión IA, DevOps) sin engordar el núcleo ni abrir agujeros. Hoy cada ampliación exige editar a mano listas cerradas repartidas por el código: `PROVEEDORES` y `OPERACIONES` del puerto (`core/integraciones/puerto.js:12`, `:18`), una segunda `OPERACIONES` homónima y distinta en `core/integraciones/aprobacion.js:44`, `OPERACIONES_AUDITADAS` (`core/integraciones/auditoria.js:37`), `AGENTES_SOLO_LECTURA` (`core/evidencia/guardian-reglas.js:22`), los perfiles MCP (`core/mcp/perfiles.js:19`) y los de instalación (`core/instalacion/perfiles.js:14`) [V-código]. Editar a mano es propenso a errores y no deja claro qué amplía cada pieza. Además, si un componente pudiera activarse desde el repositorio, un repo hostil podría ampliar permisos con solo declarar algo.

## 2. Objetivo

Un contrato único por el que un componente declara, en un manifiesto que viaja **dentro del paquete**, qué listas cerradas amplía y qué necesita; un registro que solo carga los componentes que el **usuario** activó y publica listas congeladas = núcleo ∪ ampliaciones; y la garantía, comprobada por prueba, de que ningún componente vuelve más permisivo el veredicto del núcleo.

## 3. Usuarios y Actores

| Actor | Rol | Necesidad principal |
|-------|-----|---------------------|
| Usuario de Fragua | Activa componentes en su estado de usuario o con `FRAGUA_COMPONENTES` | Elegir qué piezas usa sin que el repo decida por él |
| Mantenedor de Fragua | Escribe componentes dentro del paquete | Ampliar listas sin editarlas a mano y sin romper el núcleo |
| Repo ajeno (posible hostil) | Solo puede recomendar en `modo:` | Ninguna; es una amenaza que contener |
| `doctor` / `init` | Muestran recomendaciones | Informar de lo recomendado frente a lo activo |

## 4. Historias de Usuario

### HU-001: Manifiesto dentro del paquete
**Como** mantenedor **quiero** declarar un componente en `componentes/<id>/componente.json` dentro del paquete **para** que su ampliación sea revisable y se versione con Fragua.

Campos mínimos (plan consolidado §4.2; ejemplo en C1 §2.2): `id`, `version`, `contrato`, `puerto`, `amplia{...}`, `permisos{red, modelo, tope_usd_obligatorio}`, `dependencias_externas[{bin, adr, si_falta}]`, `modos_sugeridos`.

**Criterios de aceptación:**
- [ ] **CA-001-01**: Un manifiesto con un campo desconocido, un campo obligatorio ausente o un tipo incorrecto hace que el registro rechace el componente; la orden que lo carga termina con código distinto de 0 y un mensaje que nombra el campo. (P1)
- [ ] **CA-001-02**: Un manifiesto cuyo `contrato` no es una versión soportada se rechaza con código distinto de 0. (P1)
- [ ] **CA-001-03**: Un manifiesto que declare `amplia` sobre una lista no ampliable (`puertas.claves`, ver HU-004) se rechaza. (P1)
- [ ] **CA-001-04**: Toda entrada de `dependencias_externas` exige `adr` no vacío y `si_falta` igual a `not_evaluable`; cualquier otro valor se rechaza. (P1)
- [ ] **CA-001-05**: Un componente con `permisos.modelo: true` y sin `tope_usd_obligatorio: true` se rechaza. (P1)

### HU-002: Activación solo desde el usuario
**Como** usuario **quiero** que solo yo active componentes **para** que un repo no pueda ampliar lo que Fragua permite.

**Criterios de aceptación:**
- [ ] **CA-002-01**: Sin activación en el estado de usuario ni en `FRAGUA_COMPONENTES`, el registro publica listas idénticas (mismo contenido y orden) a las del núcleo. (P1)
- [ ] **CA-002-02**: **Repo hostil**: un repositorio que incluya `componentes/<id>/componente.json`, una clave `componentes:` en `.sdd/sdd.config.yaml` o una recomendación en `modo:` no activa nada; las listas publicadas siguen idénticas a las del núcleo y el componente figura como «no activo». (P1)
- [ ] **CA-002-03**: Un id en `FRAGUA_COMPONENTES` que no existe en el paquete hace terminar con código distinto de 0 (falla cerrado) y nombra el id; no se arranca con un registro parcial. (P1)
- [ ] **CA-002-04**: `doctor` muestra por separado «recomendado por el repo» y «activado por el usuario»; una recomendación nunca aparece como activa. (P2)

### HU-003: Listas generadas y congeladas
**Como** mantenedor **quiero** que las listas cerradas se generen como núcleo ∪ ampliaciones activadas **para** dejar de editarlas a mano.

Listas afectadas [V-código]: `PROVEEDORES` (`puerto.js:12`), `OPERACIONES` del puerto (`puerto.js:18`), `OPERACIONES` de aprobación (`aprobacion.js:44`, se renombra a `OPERACIONES_APROBABLES`), `OPERACIONES_AUDITADAS` (`auditoria.js:37`), `AGENTES_SOLO_LECTURA` (`guardian-reglas.js:22`), perfiles MCP (`core/mcp/perfiles.js:19`) y de instalación (`core/instalacion/perfiles.js:14`). `AGENTES_CON_MEMORIA` y `SKILLS_SOLO_CLAUDE` también [NV: ubicación tomada de la nota C1, no abierta].

**Criterios de aceptación:**
- [ ] **CA-003-01**: Las listas publicadas están congeladas: intentar mutarlas en ejecución lanza error (una prueba por lista). (P1)
- [ ] **CA-003-02**: Una operación que un componente añade al puerto y que no aparece también en `OPERACIONES_AUDITADAS` hace que el componente no se cargue (código distinto de 0). (P1)
- [ ] **CA-003-03**: Una operación de escritura añadida al puerto sin entrada en `OPERACIONES_APROBABLES` se rechaza. (P1)
- [ ] **CA-003-04**: `validarProveedor` sigue rechazando las operaciones genéricas (`GENERICAS`, `puerto.js:24`) aunque un componente las declare. (P1)
- [ ] **CA-003-05**: Un componente no puede **quitar** elementos del núcleo: el núcleo es subconjunto de toda lista publicada. (P1)
- [ ] **CA-003-06**: Dos componentes activos que añaden el mismo elemento producen una lista sin duplicados y en orden determinista (núcleo primero, luego por id de componente). (P2)

### HU-004: `CLAVES_PUERTAS` no se abre
**Como** dueño **quiero** que el conjunto de puertas (`tipos, linter, seguridad, cobertura`, `core/puertas/config.js:35` [V-código]) siga fijo **para** que un componente rellene una puerta existente y no invente otras.

**Criterios de aceptación:**
- [ ] **CA-004-01**: Con cualquier combinación de componentes activos, `CLAVES_PUERTAS` publicada es idéntica a la del núcleo. (P1)

### HU-005: Pruebas de caracterización antes de migrar
**Como** dueño **quiero** que la migración de cada lista no cambie el comportamiento **para** poder revertirla sin sorpresas.

**Criterios de aceptación:**
- [ ] **CA-005-01**: Antes de tocar cada lista existe una prueba de caracterización que fija su contenido actual y el comportamiento observable de quien la consume; esa prueba está en verde antes y después de la migración, sin editarse. (P1)
- [ ] **CA-005-02**: Sin componentes activos, la suite completa (`npm test`) da el mismo número de pruebas pasadas antes y después de migrar. (P1)

### HU-006: Invariancia del veredicto
**Como** dueño **quiero** una prueba de que ningún componente vuelve más permisivo el veredicto del núcleo **para** que «opcional» nunca signifique «puerta trasera».

**Criterios de aceptación:**
- [ ] **CA-006-01**: Para un conjunto fijo de casos del ciclo (prueba que falla, puerta que falla, mutación insuficiente, aprobación ausente), el veredicto con cualquier combinación de componentes activos es igual o más estricto que sin ellos. Orden de estrictez: `pass` < `not_evaluable` < `fail`. Nunca se pasa de `fail` o `not_evaluable` a `pass`. (P1)
- [ ] **CA-006-02**: Un componente de prueba diseñado para devolver siempre `pass` no cambia ningún `fail` del núcleo. (P1)
- [ ] **CA-006-03**: Si un componente falla o lanza una excepción, su resultado es `not_evaluable` (ADR-30), nunca `pass`. (P1)

## 5. Escenarios de Uso

### Escenario 1: Caso feliz
**Dado** un usuario con `FRAGUA_COMPONENTES=guardian-git` **cuando** arranca el motor **entonces** el registro carga ese manifiesto del paquete, valida su esquema y publica listas = núcleo ∪ ampliaciones de `guardian-git`.

### Escenario 2: Repo hostil
**Dado** un repo clonado que trae `componentes/x/componente.json` y una recomendación `x` en `modo:` **cuando** el usuario ejecuta cualquier orden **entonces** nada se activa, las listas son las del núcleo y `doctor` lo muestra como recomendación no activa.

### Escenario 3: Caso borde
**Dado** `FRAGUA_COMPONENTES=inexistente` **cuando** arranca el motor **entonces** termina con código distinto de 0 y no carga ningún componente.

## 6. Requisitos Funcionales

- **RF-001**: El sistema DEBE leer manifiestos solo del directorio de componentes del paquete instalado, nunca del repo del usuario.
- **RF-002**: El sistema DEBE activar componentes solo desde el estado de usuario o `FRAGUA_COMPONENTES`.
- **RF-003**: El sistema DEBE validar el esquema del manifiesto y fallar cerrado ante cualquier error.
- **RF-004**: El sistema DEBE publicar cada lista cerrada como núcleo ∪ ampliaciones, congelada.
- **RF-005**: El sistema DEBE renombrar `OPERACIONES` de `aprobacion.js:44` a `OPERACIONES_APROBABLES` sin cambiar su contenido.
- **RF-006**: El sistema NO DEBE permitir que un componente amplíe `CLAVES_PUERTAS` ni quite elementos del núcleo.
- **RF-007**: El sistema DEBE combinar los resultados de los componentes con el veredicto del núcleo tomando siempre el más estricto.

## 7. Fuera de Alcance

- Componentes concretos (specs `componente-guardian-git`, `componente-seguridad`, `componente-revision-ia`).
- Enmienda del ADR-22 para operaciones de revisión: el ADR-22 sigue en propuesta y no se construye encima (plan §4.3).
- Componentes de terceros fuera del paquete o descargados: no se admiten.
- Corregir `disenador-api` (según la nota declara `Write` [NV]) es requisito previo de migrar `AGENTES_SOLO_LECTURA`, pero lo cubre otra spec.

## 8. Dependencias y Asunciones

- `modos_sugeridos` depende de la fase 4 (modos, ADR-28, aún no redactado aquí); hasta entonces se valida pero no se usa [NV].
- `tope_usd_obligatorio` asume la spec `tope-duro-comun` (libro de costos común).

## 9. Riesgos

| Riesgo | Mitigación |
|---|---|
| Un componente amplía permisos sin que se note | Invariancia (HU-006) y validación de auditoría y aprobación (CA-003-02/03) |
| La migración cambia comportamiento | Caracterización previa (HU-005) |
| Confusión entre las dos `OPERACIONES` | Renombre (RF-005) |

## 10. Preguntas Abiertas

- Formato y ubicación exacta del «estado de usuario» que guarda la activación [NV].
- ¿Activación por proyecto (lista por ruta dentro del estado de usuario)? Propuesta: sí, siempre en el estado de usuario, nunca en el repo.

## 11. Criterios de Éxito Medibles

- Todas las CA P1 con prueba automatizada que decide por código de salida o estado.
- Suite igual antes y después de migrar.

## 12. Referencias

- Plan consolidado de modos y componentes Forja, §4.1, §4.2, §5 fase 5, §6.
- Notas del consejo: C1_arquitectura.md §2.2-2.3; C3_riesgo_calidad.md.
- ADR-29, ADR-30 (propuestas).
