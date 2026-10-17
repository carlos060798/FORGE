# Spike S0.3: aprobador, fecha y hash de la spec aprobada

> Solo lectura (2026-10-17).

## Qué se guarda hoy

- `forge aprobar spec` solo pone `spec_aprobado: true` y `ultima_actualizacion` en `.sdd/estado.json` (`cli/index.js:2035`). **No registra quién, ni cuándo aprobó (solo la hora de la última actualización de todo el archivo), ni el hash de la spec.** Es un booleano global, no por spec: `spec_activa` dice cuál está en uso, nada vincula el `true` a un contenido concreto.
- `estado.historial` es una lista libre. Hay entradas `{ fase: "aprobacion", spec, modo: "delegada", fecha }` (`.sdd/estado.json`, entrada «aprobacion» de 2026-10-03), escritas a mano o por una skill, sin aprobador ni hash. La spec nueva lleva `estado: borrador` y `actualizada` en su front matter (`.sdd/especificaciones/*/spec.md`, líneas 2-8); `aprobada` es un valor posible, pero lo edita quien quiera.
- La máquina de estados solo consulta el booleano (`core/state-machine.js:65`).
- Todo esto vive en el árbol del proyecto: lo controla quien escribió el repositorio. No hay prueba criptográfica de nada.
- No hay estado de aprobación del lado del usuario para specs. Sí lo hay para integraciones (cola firmada en `core/estado-usuario.js`, `core/integraciones/aprobacion.js`), que es el patrón reutilizable.

## Qué se puede registrar sin inventar

| Campo | Fuente | Fiabilidad |
|---|---|---|
| `spec.id` | `estado.spec_activa` o carpeta | declarado por el proyecto |
| `spec.sha256` | hash del `spec.md` **en el momento de verificar** (`huella` de `protocolo-archivos.js`/`createHash`) | fiable como hash del contenido que había; NO prueba que ese contenido fuera el aprobado |
| `spec.aprobada` | `estado.spec_aprobado` | declarado, booleano |
| `spec.fecha` | `ultima_actualizacion` o la entrada `historial` de aprobación más reciente de esa spec | declarado; puede ser posterior a la aprobación |
| `spec.aprobador` | **no existe** | `null` con motivo «el proyecto no registra quién aprueba» |

## Recomendaciones

1. Informe: `spec: { id, sha256, aprobada: true|false|null, fecha: ...|null, aprobador: null, motivoAprobador: "..." }`. No rellenar el aprobador con el autor del commit (`git config user.name` es libre); si se quiere, `commitDeLaSpec` (hash del último commit que tocó `spec.md`) es un dato verificable por quien tenga el repositorio, y es más honesto que un nombre.
2. Para tener aprobación atada a contenido hace falta una escritura nueva en `forge aprobar spec`: añadir `spec_aprobada_sha256` y una entrada `historial` `{ fase:'aprobacion', spec, sha256, fecha, aprobador: <usuario del sistema, declarado> }`. Es un cambio pequeño y de otra spec; no entra en esta. Hasta entonces el informe dice «la spec cambió desde la última actualización del estado» solo si se compara `sha256` con una huella guardada (no existe hoy).
3. Si el informe necesita fuerza real, sellar la aprobación **con la clave local del usuario** (`firmar(clave, {spec, sha256, fecha})` en el estado del usuario, no en el árbol): sería la primera aprobación de spec no fabricable por el repositorio. Es mejora de F6, opcional.

## Qué cambia en la spec o el plan

- Spec/plan §5: `spec{id,sha256,aprobador,fecha}` se reescribe como arriba; **`aprobador` es siempre `null` hoy** y los CA que lo exijan (CA-004-01/02) deben aceptar `null` con motivo.
- Añadir riesgo: «aprobado» en el informe es una afirmación del proyecto, no una prueba (mismo estatus que `ejecuciones` en estado del ciclo).
- Tarea nueva sugerida (fuera de esta spec): ampliar `aprobar spec` con hash y fecha.
