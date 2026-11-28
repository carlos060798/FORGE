---
id: 2026-11-27-componente-guardian-git
titulo: "Componente guardian-git: bloqueo de git destructivo y verificación de commits"
tamano: mediano
estado: borrador
creada: 2026-11-27
actualizada: 2026-11-27
autor: humano  # redactada por Claude como propuesta; pendiente de aprobación del dueño
constitucion_version: 1.0.0  # [NV] versión de la constitución sin ratificar (plan §5 fase 0)
etiquetas: [componentes, git, guardian, local, sin-red]
---

# Especificación: Componente `guardian-git`

> Leyenda: **[V-código]** comprobado en el worktree el 2026-11-27. **[NV]** sin verificar.
> Depende de: spec `2026-11-27-contrato-de-componente` (ADR-29) y ADR-30 (contrato de resultados).

## 1. Contexto y Motivación

Toda pieza que modifica estado de git (commit, push, release) necesita una base que impida operaciones destructivas. El guardián actual ya bloquea parte de ellas por análisis de argv, no por regex: `git push` forzado, de borrado o espejo, refspec `+ref`/`:ref`, `reset --hard`, `clean` que borra, `reflog expire`, `gc --prune=now` (`core/evidencia/guardian-reglas.js:253-265`, función `evaluarComando` en `:337`) [V-código]. Falta empaquetarlo como componente opcional con códigos de salida comunes y añadir la verificación de un rango de commits (informe «Skills agnósticas git y DevOps», catálogo P0 `guardian-git` y P1 `verificar-commits`).

## 2. Objetivo

Un componente local y sin red que (a) rechaza operaciones git destructivas reutilizando `evaluarComando`, y (b) verifica un rango de commits contra una política declarada, decidiendo siempre por código de salida (ADR-30).

## 3. Usuarios y Actores

| Actor | Rol | Necesidad principal |
|-------|-----|---------------------|
| Usuario | Activa el componente | No perder trabajo por una orden destructiva |
| Agente anfitrión | Ejecuta git | Saber por código si puede seguir |
| Otras skills (release, revisión previa a PR) | Consumidoras | Una base común de bloqueo |

## 4. Historias de Usuario

### HU-001: Bloqueo de git destructivo
**Como** usuario **quiero** que las órdenes git destructivas se rechacen **para** no perder historia ni archivos.

**Criterios de aceptación:**
- [ ] **CA-001-01**: La decisión de bloqueo se toma llamando a `evaluarComando` (`guardian-reglas.js:337`); no hay un segundo analizador. Prueba: el conjunto de órdenes que bloquea el componente es igual al que bloquea `evaluarComando` para un corpus fijo. (P1)
- [ ] **CA-001-02**: Para cada orden destructiva del corpus (`push --force`, `push -f`, `push +main`, `push :rama`, `push --mirror`, `reset --hard`, `clean -fdx`, `reflog expire`, `gc --prune=now`) el componente sale con **4** (ADR-30). (P1)
- [ ] **CA-001-03**: Variantes de flags agrupadas o envueltas (`-fu`, `sudo git ...`, `git -C x push -f`) también salen con 4. (P1)
- [ ] **CA-001-04**: `push --force-with-lease=<ref>:<sha> --force-if-includes` no sale con 4 por el solo hecho del forzado [NV: hoy `evaluarComando` bloquea todo `--force*`; requiere decisión del dueño sobre si se abre esta excepción]. (P2)
- [ ] **CA-001-05**: Commit o push sobre la rama por defecto o una rama protegida configurada sale con 4. (P1)
- [ ] **CA-001-06**: Árbol sucio cuando la operación exige árbol limpio sale con 3. (P1)
- [ ] **CA-001-07**: `--no-verify` en commit o push sale con 4. (P1)
- [ ] **CA-001-08**: Antes de una reescritura permitida se crea la rama `backup/<rama>-<ts>`; prueba por existencia del ref. (P2)
- [ ] **CA-001-09**: Sin permiso de escritura en `.git`, sale con 6 (`not_evaluable`) y no con 0. (P2)
- [ ] **CA-001-10**: En el adaptador de hooks de Claude Code, el 4 se traduce a 2 (código con el que ese anfitrión bloquea), y un argumento inválido nunca produce 2 en ese adaptador. (P1)

### HU-002: Verificación de commits
**Como** usuario **quiero** verificar un rango de commits **para** saber por código si cumple la política activa.

**Criterios de aceptación:**
- [ ] **CA-002-01**: Un rango con un asunto que no cumple Conventional Commits sale con 1. (P1)
- [ ] **CA-002-02**: Una ruptura (`!:` o pie `BREAKING CHANGE:`) frente a un bump declarado menor que MAJOR sale con 1. (P1)
- [ ] **CA-002-03**: Con la política DCO activa, un commit sin `Signed-off-by` sale con 1. (P2)
- [ ] **CA-002-04**: Con la política de firma activa y sin las claves para comprobarla, sale con 6, nunca con 0. (P1)
- [ ] **CA-002-05**: Un rango que cumple todo sale con 0 y emite JSON con `resultado: "pass"` y la cobertura de chequeos evaluados. (P1)
- [ ] **CA-002-06**: Un rango inválido (ref inexistente) sale con 2 o 3, nunca con 0. (P1)

### HU-003: Local y sin red
**Como** dueño **quiero** que el componente no use red **para** que funcione igual en todos los anfitriones y no filtre nada.

**Criterios de aceptación:**
- [ ] **CA-003-01**: El manifiesto declara `permisos.red: []` y `permisos.modelo: false`; el registro lo valida. (P1)
- [ ] **CA-003-02**: Las pruebas del componente pasan con la red bloqueada (repositorios git temporales, sin remoto real). (P1)
- [ ] **CA-003-03**: El componente no ejecuta git por shell: usa ejecución sin shell [NV: el informe recomienda `spawn` sin shell; detalle de implementación para el plan]. (P2)

## 5. Escenarios de Uso

### Escenario 1: Caso feliz
**Dado** un árbol limpio en una rama de trabajo **cuando** se valida `git commit -m "feat: x"` **entonces** sale con 0.

### Escenario 2: Caso de error
**Dado** cualquier rama **cuando** el agente pide `git push --force origin main` **entonces** sale con 4 y el motivo de `evaluarComando`.

### Escenario 3: Caso borde
**Dado** que no hay claves de firma **cuando** se verifica la firma **entonces** sale con 6 y el informe lo marca `not_evaluable`.

## 6. Requisitos Funcionales

- **RF-001**: El sistema DEBE reutilizar `evaluarComando` como única fuente de reglas de bloqueo.
- **RF-002**: El sistema DEBE devolver los códigos comunes de ADR-30.
- **RF-003**: El sistema NO DEBE usar red ni modelo.
- **RF-004**: El sistema DEBE emitir JSON `pass|fail|not_evaluable` con cobertura.

## 7. Fuera de Alcance

- Protección de ramas en la plataforma, colas de merge, procedencia: dependen de plataforma (se detectan como `not_evaluable` en otra spec).
- `revision-previa-pr`, `etiquetado-release`: otras specs.

## 8. Dependencias y Asunciones

- El guardián no es una frontera de seguridad, es una capa más (`guardian-reglas.js:10` [V-código]). Si el agente llama a git directamente sin pasar por el componente o el hook, no hay bloqueo.
- Que los hooks bloqueantes funcionen fuera de Claude Code y Kiro está [NV] (informe Skills agnósticas, conclusiones).

## 9. Riesgos

| Riesgo | Mitigación |
|---|---|
| Falsa sensación de protección | Documentar «capa, no frontera» en la salida |
| Divergencia con el guardián del núcleo | CA-001-01 (mismo corpus, mismo resultado) |
| Confundir 2 (argumentos) con bloqueo en Claude Code | CA-001-10 |

## 10. Preguntas Abiertas

- ¿Se permite `--force-with-lease=<ref>:<sha> --force-if-includes` (CA-001-04)? Decisión del dueño.
- Lista de ramas protegidas por defecto (¿solo la rama por defecto?) [NV].
- Que GitHub marque como verificadas las firmas de gitsign está [NV].

## 11. Criterios de Éxito Medibles

- Corpus de órdenes destructivas: 100 % con código 4.
- Pruebas en verde con red bloqueada en Windows y Linux.

## 12. Referencias

- Informe «Skills agnósticas git y DevOps», tabla de códigos y catálogo P0/P1.
- Plan consolidado §4.5, §5 fase 6.
- `core/evidencia/guardian-reglas.js:253-265`, `:337`.
