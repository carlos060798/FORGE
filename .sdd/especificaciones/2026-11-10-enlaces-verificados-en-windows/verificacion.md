# Verificación: enlaces verificados en Windows

Estado: borrador, sin aprobar. Medido en Windows 11 sin privilegio de enlaces simbólicos de archivo (uniones y enlaces duros sí).

## Omisiones por no poder crear enlaces (EPERM), antes y después
- Antes: 6 (ciclo-datos, ciclo-hallazgos, escritura-global, mcp-herramientas, proyecto-hostil, puesta-al-dia-revision), cada una con un texto distinto.
- Después: 6, todas «NO VERIFICADO en esta plataforma: symlink de archivo …» y contadas por `tests/enlaces-no-verificados.test.js`. No bajan porque lo que falta (symlink de archivo) no tiene sustituto honesto; lo que se gana es que ya no son silenciosas ni distintas.

## Comprobación sin la defensa (mutaciones temporales, no commiteadas)
Quitando la comprobación `dentroDe(raizReal, real)` de `validarRuta` (`core/ciclo/protocolo-archivos.js`, línea 242) fallan: ciclo-hallazgos «una carpeta enlazada fuera del proyecto sigue rechazada»; ciclo-protocolo «un enlace simbólico no sirve para salir del proyecto»; ciclo-tercera-pasada «una junction hacia fuera … en una entrada se rechaza»; herramientas-coder «un enlace que sale del proyecto no se sigue»; y la de confinamiento de `leer_archivo`.
Quitando la comprobación de enlace en `directorioDeEstado` (`core/estado-usuario.js`, línea 150) falla estado-propietario.

## Hallazgo
Un enlace duro dentro del proyecto hacia un secreto (`inocente.txt` → `.npmrc`) no se puede detectar por nombre ni por `lstat`; el código solo mira `nlink` en `core/aprobaciones-identidad.js`. No se probó ni se tocó `core/`; ver sección 4.
