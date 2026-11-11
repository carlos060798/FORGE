<!-- Lee CONTRIBUTING.md y REVIEW.md. Un cambio de documentación (errata, enlace) solo necesita las dos últimas casillas. -->

## Qué cambia y por qué

<!-- Una o dos frases. -->

## Especificación

- [ ] Enlazo la spec: `.sdd/especificaciones/<id>/spec.md` (o es un cambio menor de documentación y no la necesita)
- [ ] La spec está aprobada por el dueño, o este PR la propone como `borrador` (la aprobación es del dueño, no mía)
- [ ] Hago lo que dice la spec y nada más

## Pruebas

- [ ] Escribí las pruebas antes que el código, y la prueba nueva falla sin mi cambio
- [ ] No debilité ninguna prueba existente
- [ ] Cada criterio `CA-NNN-NN` afectado tiene una prueba que lo cita
- [ ] No añadí pruebas que necesiten una clave o un modelo de pago
- [ ] `npm test` pasa en mi equipo (SO y versión de Node: ______)
- [ ] `npm run typecheck` sin errores (si toqué `core/`)

## Decisiones y restricciones

- [ ] Una decisión técnica no trivial tiene su ADR (`.sdd/arquitectura/ADR-NN-*.md`), con el siguiente número libre
- [ ] Sin dependencias nuevas (si las hay, hay ADR)
- [ ] Sin secretos en registros, estados ni copias de trabajo; sin escrituras fuera del proyecto ni en `.git/`, `.sdd/` o `.env*` desde una salida de modelo
- [ ] Nada se degrada en silencio y no fijo un proveedor de modelos en un módulo
- [ ] Probé rutas con `\` y `/` si toqué rutas (Windows)

## Documentación

- [ ] Actualicé la documentación afectada y no afirma nada que el código no haga
- [ ] Si cambié agentes, comandos o skills: registrados en `.claude-plugin/plugin.json`, cifras actualizadas y `npm run generar-skills` ejecutado
- [ ] Actualicé `verificacion.md` de la spec y, si es visible para quien usa el paquete, `CHANGELOG.md`
- [ ] Mi PR es en español (artefactos, mensajes y comentarios)
