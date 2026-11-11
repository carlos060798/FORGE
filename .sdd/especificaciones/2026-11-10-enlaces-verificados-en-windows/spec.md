---
id: 2026-11-10-enlaces-verificados-en-windows
titulo: "Pruebas de enlaces que se ejecutan en Windows y omisiones honestas («NO VERIFICADO»)"
tamano: pequeño  # micro | pequeño | mediano | grande
estado: borrador  # borrador | en_revision | aprobada | en_implementacion | completada
creada: 2026-11-10
actualizada: 2026-11-10
autor: humano  # humano | importado
constitucion_version: 1.1.0
etiquetas: [pruebas, seguridad, windows, enlaces]
---

# Especificación: enlaces verificados en Windows

> **Estado (2026-11-10): borrador.** La redactó un agente; **la aprueba el dueño** con `fragua aprobar spec`. Los cambios de pruebas se hicieron en el mismo cambio para que el dueño los revise junto con esta spec; eso no sustituye su aprobación.

## 1. Contexto y Motivación

`docs/informes/CRITICA-HOSTIL.md` §2 critica que varias pruebas de seguridad (rutas fuera del proyecto por enlaces) se saltan en silencio con `t.skip` cuando el sistema no deja crear enlaces (EPERM). En Windows sin modo desarrollador ni administrador no se pueden crear enlaces simbólicos, pero sí **uniones** (`junction`, solo directorios) y **enlaces duros**. Medido el 2026-11-10 en Windows 11: de las 46 pruebas omitidas, las que dependen de enlaces son las de enlace simbólico **de archivo**; las de directorio ya usaban `junction` y se ejecutan. Aun así, una omisión por esa causa decía cosas distintas en cada archivo y nadie las contaba.

## 2. Objetivo

Que toda prueba de enlaces use un único ayudante que pruebe, en orden, las alternativas equivalentes, y que lo que de verdad no se pueda reproducir en una plataforma se diga como **«NO VERIFICADO en esta plataforma: <motivo>»** y se cuente a la vista, en vez de pasar por una omisión anónima.

## 3. Criterios de aceptación

- **CA-001-01** `tests/helpers-enlaces.js` ofrece `crearEnlace(destino, ruta, tipo)` y devuelve `{ creado, tipo }` (`symlink`, `junction`, `duro` o `null`). Intenta primero el enlace simbólico; si el sistema lo niega (EPERM, EACCES, ENOSYS, UNKNOWN) y el destino es un directorio, una unión; si es un archivo y el tipo es `"archivo-o-duro"`, un enlace duro. Cualquier otro error se propaga.
- **CA-001-02** Un enlace duro solo sustituye a uno simbólico cuando la prueba defiende algo que también demuestra el enlace duro (que escribir o leer por la ruta llega al otro archivo). Si lo defendido es propio del enlace simbólico (detectarlo con `lstat`, que pueda quedar colgante, que `realpath` salga del proyecto), el tipo es `"archivo"` y no hay alternativa.
- **CA-002-01** Las pruebas de enlaces a directorio crean el enlace con el ayudante (símbolico o unión) y conservan sus aserciones.
- **CA-002-02** Las pruebas que no se pueden reproducir (enlace simbólico de archivo sin privilegio) se saltan con `noVerificado(t, motivo)`: el texto empieza por «NO VERIFICADO en esta plataforma:» y da el motivo concreto.
- **CA-003-01** `tests/enlaces-no-verificados.test.js` imprime (con `t.diagnostic`) qué enlaces permite crear el equipo y cuántas pruebas dependen de lo que no permite, con archivo, línea y motivo de cada una.
- **CA-003-02** Esa misma prueba falla si un archivo de prueba salta con un `t.skip` suelto cuyo texto hable de enlaces, uniones, symlinks o EPERM: hay que usar `noVerificado`.
- **CA-004-01** Ninguna aserción se debilita: cada prueba migrada falla si se quita la defensa del código (se comprueba deshaciendo la defensa a mano, sin commitearlo; resultado en `verificacion.md`).

## 4. Fuera de alcance

- Conseguir privilegio de enlaces en el equipo del dueño o en la CI de Windows (la prueba de symlink de archivo seguirá «NO VERIFICADA» allí; sí corre en Linux).
- Defender contra enlaces duros dentro del proyecto hacia secretos (ver hallazgo en `verificacion.md`; si el dueño lo quiere, es otra spec sobre `core/`).
- Cambiar código de `core/`.

## 5. Cambios de comportamiento visibles

Ninguno en el producto. Solo cambian pruebas: el texto de las omisiones por enlaces y un archivo de prueba nuevo que las cuenta.

## 6. Decisiones abiertas (del dueño)

1. Aprobar esta spec con `fragua aprobar spec`.
2. Si quiere ejecutar en un runner o equipo con privilegio de enlaces simbólicos (modo desarrollador) para cubrir las omisiones restantes.
