---
id: 2026-11-06-aprobaciones-con-identidad
titulo: "Aprobaciones con identidad: terminal real, código de un solo uso y registro firmado"
tamano: mediano  # micro | pequeño | mediano | grande
estado: borrador  # borrador | en_revision | aprobada | en_implementacion | completada
creada: 2026-11-06
actualizada: 2026-11-09
autor: humano  # humano | importado
constitucion_version: 1.1.0
etiquetas: [seguridad, aprobaciones, evidencia, c-03]
---

# Especificación: aprobaciones con identidad

> **Estado (2026-11-06): borrador.** La redactó un agente; **la aprueba el dueño del proyecto**, no un agente. El código y las pruebas ya existen en el árbol de trabajo para que el dueño los revise junto con esta spec; eso no sustituye su aprobación (no es el orden que pide `AGENTS.md`).

## 1. Contexto y Motivación

Hallazgo C-03 de `docs/informes/SEGURIDAD-CIBER.md`: las aprobaciones y la cadena de evidencia se firman con una clave HMAC guardada en el estado del usuario (`core/estado-usuario.js`). El agente de código corre con el mismo usuario del sistema operativo que la persona, así que puede leer la clave, y `forge aprobar spec` se podía ejecutar desde cualquier herramienta sin que nadie lo viera. Además, `aprobado_por_delegacion` figura en dos planes del repositorio sin registro de quién, cuándo ni sobre qué contenido (`docs/informes/MADUREZ-FORGE.md`, punto 8), y `forge step --force` salta los guards sin dejar rastro del motivo.

## 2. Objetivo

Que una aprobación solo se pueda dar desde un terminal interactivo real, con un gesto humano (teclear un código que se muestra en pantalla); que quede atribuida, fechada y atada al contenido aprobado en un registro de solo adición firmado; que `aprobado_por_delegacion` no valga sin ese registro; y que forzar una transición deje un evento firmado con motivo obligatorio.

## 3. Límite (se declara, no se oculta)

Con el mismo usuario del sistema operativo **no hay separación criptográfica total** entre la persona y el agente. Un proceso con los permisos de ese usuario podría leer la clave local y fabricar registros firmados, o abrir un seudoterminal y teclear el código que lee en pantalla. Esta mitigación hace que lo accidental, lo automático y lo no atribuido deje de funcionar y que lo deliberado deje huella; no impide a un agente malicioso con los permisos del usuario. Guardar la clave en el llavero del SO (DPAPI en Windows, Keychain en macOS) o firmar con una clave que pida confirmación es una **decisión futura (ADR), fuera de esta spec**.

## 4. Criterios de aceptación

### Terminal real y código
- **CA-001-01** `forge aprobar …` exige que la entrada y la salida estándar sean un terminal interactivo; si no, rechaza con un mensaje que lo explica y código de salida distinto de 0, sin aprobar ni registrar nada.
- **CA-001-02** No existe ninguna opción ni variable de entorno para saltarse el terminal; `--sin-tty` y cualquier otra opción de `forge aprobar` se rechazan como desconocidas.
- **CA-001-03** Antes de registrar, se muestra un código nuevo de un solo uso y la persona debe teclearlo; un código incorrecto, vacío o la ausencia de respuesta no aprueban nada. El código cambia en cada intento.

### Registro
- **CA-002-01** Cada aprobación añade una línea a `.sdd/aprobaciones.jsonl` con: quién (`git config user.email` y `user.name` si existen, y siempre el usuario del SO), cuándo (ISO 8601), qué (tipo e identificador) y el SHA-256 del archivo aprobado.
- **CA-002-02** Cada línea lleva un HMAC con la clave local y el HMAC de la línea anterior. Editar una línea, quitar una del principio o del medio, o añadir una fabricada sin la clave se detecta; no se añade nada encima de un registro roto.
- **CA-002-03** `forge aprobar spec` fija el hash del archivo de la spec que se aprueba; si no se puede localizar o leer, no aprueba.

### Delegación
- **CA-003-01** Un archivo de `.sdd/especificaciones/` con `estado: aprobado_por_delegacion` en su cabecera solo se considera aprobado si hay un registro verificable de tipo `delegacion` con su identificador y el hash vigente del archivo.
- **CA-003-02** `forge verificar --comprobar-aprobaciones` (solo lectura) devuelve 1 si alguno no cumple y 0 si todos cumplen o no hay ninguno. La persona crea el registro con `forge aprobar delegacion <carpeta>/<archivo>.md`.

### Forzar transiciones
- **CA-004-01** `forge step <paso> --force` exige `--motivo` de al menos 10 caracteres; sin él no avanza y sale con código distinto de 0.
- **CA-004-02** Un avance forzado deja en el registro de eventos un `pipeline_step_forzado` con motivo, origen, destino, quién y fecha, firmado con la clave local; alterar el evento invalida la firma.

### Documentación del límite
- **CA-005-01** La cabecera de `core/aprobaciones-identidad.js` y la de `core/evidencia/cadena.js` declaran el límite de la sección 3.

### Puerta real de la spec (añadido 2026-11-09, hallazgo C-03 de `docs/informes/REVERIFICACION-SEGURIDAD.md`)
- **CA-006-01** Pasar de `spec` a `plan` con `forge step plan` exige, además de `spec_aprobado: true`, un registro de tipo `spec` en `.sdd/aprobaciones.jsonl` con el identificador de la spec activa y el SHA-256 **vigente** de su archivo. Si falta, o el archivo cambió después de aprobarse, la transición se rechaza con un mensaje que dice cómo aprobar. Solo `--force --motivo` la salta (CA-004).
- **CA-006-02** `forge aprobar spec` no da por aprobada una spec cuyo `spec_aprobado` esté a `true` sin ese registro verificable: avisa y la aprueba de nuevo (con terminal y código, CA-001).
- **CA-007-01** `.sdd/aprobaciones.jsonl` es ruta crítica del guardián (`esRutaCriticaDelGuardian`): una escritura, redirección o `Write` sobre él desde un agente se bloquea, sin distinguir mayúsculas.

## 5. Fuera de alcance

- Llavero del SO, firma asimétrica o cualquier separación criptográfica real (ADR futuro).
- Los `--force` de `core/engine-cli.js` (`forge run`/`resume`, que omiten avisos del ciclo verificado) y `forge reset --force`: no cambian aquí.
- Detectar el truncado de las últimas líneas del registro (igual que la cadena de evidencia sin cabeza guardada).
- Migrar los dos planes actuales con `aprobado_por_delegacion`: el dueño decide si los registra o los reaprueba.

## 6. Cambios de comportamiento visibles

`forge aprobar spec` ya no funciona sin terminal (antes escribía `spec_aprobado: true` directamente), y falla si no encuentra el archivo de la spec. `forge step --force` exige `--motivo`. Las pruebas de `tests/state-machine-aprobacion.test.js` y `tests/proyecto-hostil.test.js` que aprobaban sin terminal se actualizaron para comprobar el rechazo; el camino con terminal se prueba inyectando la lectura en `tests/aprobaciones-identidad.test.js`.
